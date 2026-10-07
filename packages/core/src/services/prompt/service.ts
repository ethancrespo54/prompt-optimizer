import {
  IPromptService,
  OptimizationRequest,
  MessageOptimizationRequest,
  CustomConversationRequest,
  ConversationMessage,
  ToolDefinition,
} from "./types";
import { Message, StreamHandlers, ILLMService } from "../llm/types";
import { PromptRecord } from "../history/types";
import { IModelManager } from "../model/types";
import { ITemplateManager } from "../template/types";
import { IHistoryManager } from "../history/types";
import {
  OptimizationError,
  IterationError,
  TestError,
  ServiceDependencyError,
} from "./errors";
import { TemplateProcessor, TemplateContext } from "../template/processor";

/**
 * Default template IDs used by the system
 */
const DEFAULT_TEMPLATES = {
  OPTIMIZE: "general-optimize",
  ITERATE: "iterate",
  TEST: "test-prompt",
} as const;

/**
 * Prompt service implementation
 */
export class PromptService implements IPromptService {
  constructor(
    private modelManager: IModelManager,
    private llmService: ILLMService,
    private templateManager: ITemplateManager,
    private historyManager: IHistoryManager,
  ) {
    this.checkDependencies();
  }

  /**
   * Check whether the dependent services have been initialized
   */
  private checkDependencies() {
    if (!this.modelManager) {
      throw new ServiceDependencyError("ModelManager", "Model manager not initialized");
    }
    if (!this.llmService) {
      throw new ServiceDependencyError("LLMService", "LLM service not initialized");
    }
    if (!this.templateManager) {
      throw new ServiceDependencyError(
        "TemplateManager",
        "Template manager not initialized",
      );
    }
    if (!this.historyManager) {
      throw new ServiceDependencyError(
        "HistoryManager",
        "History manager not initialized",
      );
    }
  }

  /**
   * Validate input parameters
   */
  private validateInput(prompt: string, modelKey: string) {
    if (!prompt?.trim()) {
      throw new OptimizationError(prompt, 'Prompt cannot be empty');
    }

    if (!modelKey?.trim()) {
      throw new OptimizationError(prompt, 'Model key is required');
    }
  }

  /**
   * Validate the LLM response
   */
  private validateResponse(response: string, prompt: string) {
    if (!response?.trim()) {
      throw new OptimizationError(prompt, 'LLM service returned empty result');
    }
  }

  /**
   * Validate the message optimization request parameters
   */
  private validateMessageOptimizationRequest(request: MessageOptimizationRequest) {
      if (!request.selectedMessageId?.trim()) {
        throw new OptimizationError("", "Selected message ID is required");
      }

      if (!request.messages || request.messages.length === 0) {
        throw new OptimizationError("", "Messages array is required and cannot be empty");
      }

      if (!request.modelKey?.trim()) {
        throw new OptimizationError("", "Model key is required");
      }

      // Validate that the selected message exists
      const selectedMessage = request.messages.find(
        msg => msg.id === request.selectedMessageId
      );

      if (!selectedMessage) {
        throw new OptimizationError(
          "",
          `Message with ID ${request.selectedMessageId} not found in messages array`,
        );
      }

      // Validate that the message content is not empty
      if (!selectedMessage.content?.trim()) {
        throw new OptimizationError(
          "",
          "Selected message content cannot be empty",
        );
      }
  }

  /**
   * Optimize a prompt - supports prompt types and enhanced features
   */
  async optimizePrompt(request: OptimizationRequest): Promise<string> {
    try {
      this.validateOptimizationRequest(request);

      const modelConfig = await this.modelManager.getModel(request.modelKey);
      if (!modelConfig) {
        throw new OptimizationError(request.targetPrompt, "Model not found");
      }

      const template = await this.templateManager.getTemplate(
        request.templateId ||
          (await this.getDefaultTemplateId(
            request.optimizationMode === "user" ? "userOptimize" : "optimize",
          )),
      );

      if (!template?.content) {
        throw new OptimizationError(
          request.targetPrompt,
          "Template not found or invalid",
        );
      }

      const context: TemplateContext = {
        originalPrompt: request.targetPrompt,
        optimizationMode: request.optimizationMode,
        contextMode: request.contextMode,
        // Pass the advanced context info to the template
        customVariables: request.advancedContext?.variables,
        conversationMessages: request.advancedContext?.messages,
        tools: request.advancedContext?.tools,
      };

      // If there are conversation messages, format them as text and add them to the context
      if (
        request.advancedContext?.messages &&
        request.advancedContext.messages.length > 0
      ) {
        const conversationText = TemplateProcessor.formatConversationAsText(
          request.advancedContext.messages,
        );
        context.conversationContext = conversationText;
      }

      // If there is tool info, format it as text and add it to the context
      if (
        request.advancedContext?.tools &&
        request.advancedContext.tools.length > 0
      ) {
        const toolsText = TemplateProcessor.formatToolsAsText(
          request.advancedContext.tools,
        );
        context.toolsContext = toolsText;
      }

      const messages = TemplateProcessor.processTemplate(template, context);
      const result = await this.llmService.sendMessage(
        messages,
        request.modelKey,
      );

      this.validateResponse(result, request.targetPrompt);
      // Note: saving history is handled by the UI layer's historyManager.createNewChain method
      // The duplicate saveOptimizationHistory call was removed to avoid saving twice

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new OptimizationError(
        request.targetPrompt,
        `Optimization failed: ${errorMessage}`,
      );
    }
  }

  /**
   * Optimize a single message - dedicated to multi-turn conversation mode
   */
  async optimizeMessage(request: MessageOptimizationRequest): Promise<string> {
    try {
      // Validate the request parameters
      this.validateMessageOptimizationRequest(request);

      // Get the model config
      const modelConfig = await this.modelManager.getModel(request.modelKey);
      if (!modelConfig) {
        throw new OptimizationError("", "Model not found");
      }

      // Find the selected message in the message array
      const selectedMessage = request.messages.find(
        msg => msg.id === request.selectedMessageId
      )!;

      // Get the index of the selected message (starting from 0)
      const selectedIndex = request.messages.findIndex(
        msg => msg.id === request.selectedMessageId
      );

      // Get the template (context-message-optimize is used by default)
      const template = await this.templateManager.getTemplate(
        request.templateId || "context-message-optimize"
      );

      if (!template?.content) {
        throw new OptimizationError(
          selectedMessage.content,
          "Template not found or invalid",
        );
      }

      // Add metadata to the message array (used for template loops)
      const messagesWithMeta = request.messages.map((msg, idx) => ({
        index: idx + 1,  // Numbering starts from 1
        roleLabel: msg.role.toUpperCase(),
        content: msg.content,
        isSelected: msg.id === request.selectedMessageId,
      }));

      // Prepare the data of the selected message (including a length check)
      const maxLength = 200;
      const selectedMessageData = {
        index: selectedIndex + 1,
        roleLabel: selectedMessage.role.toUpperCase(),
        content: selectedMessage.content,
        contentTooLong: selectedMessage.content.length > maxLength,
        contentPreview: selectedMessage.content.length > maxLength
          ? selectedMessage.content.substring(0, 150)
          : undefined,
      };

      // Build the template context
      const context: TemplateContext = {
        originalPrompt: selectedMessage.content,
        messageRole: selectedMessage.role,
        contextMode: request.contextMode,
        customVariables: request.variables,
        tools: request.tools,
        // 🆕 Template-driven data
        conversationMessages: messagesWithMeta,
        selectedMessage: selectedMessageData,
      };

      // If there are tool definitions, format them as tool text
      if (request.tools && request.tools.length > 0) {
        context.toolsContext = TemplateProcessor.formatToolsAsText(
          request.tools
        );
      }

      // Process the template and call the LLM
      const messages = TemplateProcessor.processTemplate(template, context);
      const result = await this.llmService.sendMessage(
        messages,
        request.modelKey,
      );

      // Validate the response
      this.validateResponse(result, selectedMessage.content);

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new OptimizationError(
        "",
        `Message optimization failed: ${errorMessage}`,
      );
    }
  }

  /**
   * Iteratively optimize a prompt
   */
  async iteratePrompt(
    originalPrompt: string,
    lastOptimizedPrompt: string,
    iterateInput: string,
    modelKey: string,
    templateId?: string,
    contextData?: {
      messages?: ConversationMessage[];
      selectedMessageId?: string;
      variables?: Record<string, string>;
      tools?: ToolDefinition[];
    },
  ): Promise<string> {
    try {
      // 🔧 The iterate template only needs lastOptimizedPrompt and iterateInput
      // originalPrompt may be empty (when the user iterates after editing directly in the workspace)
      this.validateInput(lastOptimizedPrompt, modelKey);
      this.validateInput(iterateInput, modelKey);

      // Get the model config
      const modelConfig = await this.modelManager.getModel(modelKey);
      if (!modelConfig) {
        throw new ServiceDependencyError("ModelManager", "Model not found");
      }

      // Get the iterate prompt
      let template;
      try {
        template = await this.templateManager.getTemplate(
          templateId || DEFAULT_TEMPLATES.ITERATE,
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        throw new IterationError(
          originalPrompt,
          iterateInput,
          `Iteration failed: ${errorMessage}`,
        );
      }

      if (!template?.content) {
        throw new IterationError(
          originalPrompt,
          iterateInput,
          "Iteration failed: Template not found or invalid",
        );
      }

      // 🔧 Iteration must use an advanced template (message array format) to support variable substitution
      if (typeof template.content === "string") {
        throw new IterationError(
          originalPrompt,
          iterateInput,
          `Iteration requires advanced template (message array format) for variable substitution.\n` +
            `Template ID: ${template.id}\n` +
            `Current template type: Simple template (string format)\n` +
            `Suggestion: Please use message array format template that supports {{lastOptimizedPrompt}} and {{iterateInput}} variables`,
        );
      }

      // Use TemplateProcessor to process the template and substitute variables
      const context: TemplateContext = {
        originalPrompt,
        lastOptimizedPrompt,
        iterateInput,
        customVariables: contextData?.variables,
        tools: contextData?.tools,
      };

      // If there are conversation messages, format them as text and add them to the context
      if (contextData?.messages && contextData.messages.length > 0) {
        const conversationText = TemplateProcessor.formatConversationAsText(
          contextData.messages,
        );
        context.conversationContext = conversationText;
      }

      // If there is tool info, format it as text and add it to the context
      if (contextData?.tools && contextData.tools.length > 0) {
        const toolsText = TemplateProcessor.formatToolsAsText(
          contextData.tools,
        );
        context.toolsContext = toolsText;
      }

      const messages = TemplateProcessor.processTemplate(template, context);

      // Send the request
      const result = await this.llmService.sendMessage(messages, modelKey);

      // Note: saving iteration history is handled by the UI layer's historyManager.addIteration method
      // The duplicate addRecord call was removed to avoid saving twice

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new IterationError(
        originalPrompt,
        iterateInput,
        `Iteration failed: ${errorMessage}`,
      );
    }
  }

  /**
   * Test a prompt - supports an optional system prompt
   */
  async testPrompt(
    systemPrompt: string,
    userPrompt: string,
    modelKey: string,
  ): Promise<string> {
    try {
      // For user prompt optimization, systemPrompt may be empty
      if (!userPrompt?.trim()) {
        throw new TestError(systemPrompt, userPrompt, "User prompt is required");
      }
      if (!modelKey?.trim()) {
        throw new TestError(systemPrompt, userPrompt, "Model key is required");
      }

      const modelConfig = await this.modelManager.getModel(modelKey);
      if (!modelConfig) {
        throw new TestError(systemPrompt, userPrompt, "Model not found");
      }

      const messages: Message[] = [];

      // Only add the system message when systemPrompt is not empty
      if (systemPrompt?.trim()) {
        messages.push({ role: "system", content: systemPrompt });
      }

      messages.push({ role: "user", content: userPrompt });

      const result = await this.llmService.sendMessage(messages, modelKey);

      // Note: the test feature does not save history, keeping the architecture consistent
      // Tests are temporary verification and should not be mixed with optimization history

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new TestError(
        systemPrompt,
        userPrompt,
        `Test failed: ${errorMessage}`,
      );
    }
  }

  /**
   * Get the history records
   */
  async getHistory(): Promise<PromptRecord[]> {
    return await this.historyManager.getRecords();
  }

  /**
   * Get the iteration chain
   */
  async getIterationChain(recordId: string): Promise<PromptRecord[]> {
    return await this.historyManager.getIterationChain(recordId);
  }

  /**
   * Test a prompt (streaming) - supports an optional system prompt
   */
  async testPromptStream(
    systemPrompt: string,
    userPrompt: string,
    modelKey: string,
    callbacks: StreamHandlers,
  ): Promise<void> {
    try {
      // For user prompt optimization, systemPrompt may be empty
      if (!userPrompt?.trim()) {
        throw new TestError(systemPrompt, userPrompt, "User prompt is required");
      }
      if (!modelKey?.trim()) {
        throw new TestError(systemPrompt, userPrompt, "Model key is required");
      }

      const modelConfig = await this.modelManager.getModel(modelKey);
      if (!modelConfig) {
        throw new TestError(systemPrompt, userPrompt, "Model not found");
      }

      const messages: Message[] = [];

      // Only add the system message when systemPrompt is not empty
      if (systemPrompt?.trim()) {
        messages.push({ role: "system", content: systemPrompt });
      }

      messages.push({ role: "user", content: userPrompt });

      // Use the new structured streaming response
      await this.llmService.sendMessageStream(messages, modelKey, {
        onToken: callbacks.onToken,
        onReasoningToken: callbacks.onReasoningToken, // Supports the reasoning content stream
        onComplete: callbacks.onComplete,
        onError: callbacks.onError,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new TestError(
        systemPrompt,
        userPrompt,
        `Test failed: ${errorMessage}`,
      );
    }
  }

  /**
   * Optimize a prompt (streaming) - supports prompt types and enhanced features
   */
  async optimizePromptStream(
    request: OptimizationRequest,
    callbacks: StreamHandlers,
  ): Promise<void> {
    try {
      this.validateOptimizationRequest(request);

      const modelConfig = await this.modelManager.getModel(request.modelKey);
      if (!modelConfig) {
        throw new OptimizationError(request.targetPrompt, "Model not found");
      }

      const template = await this.templateManager.getTemplate(
        request.templateId ||
          (await this.getDefaultTemplateId(
            request.optimizationMode === "user" ? "userOptimize" : "optimize",
          )),
      );

      if (!template?.content) {
        throw new OptimizationError(
          request.targetPrompt,
          "Template not found or invalid",
        );
      }

      // Create the base context
      const baseContext: TemplateContext = {
        originalPrompt: request.targetPrompt,
        optimizationMode: request.optimizationMode,
        // 🆕 Context mode and render phase (used by ContextPromptRenderer)
        contextMode: request.contextMode,
        renderPhase: "optimize", // Optimize phase
      };

      // Extend the context to support advanced features
      const context = TemplateProcessor.createExtendedContext(
        baseContext,
        request.advancedContext?.variables,
        request.advancedContext?.messages,
      );

      // If there are conversation messages, format them as text and add them to the context
      if (
        request.advancedContext?.messages &&
        request.advancedContext.messages.length > 0
      ) {
        const conversationText = TemplateProcessor.formatConversationAsText(
          request.advancedContext.messages,
        );
        context.conversationContext = conversationText;
      }

      // 🆕 If there is tool info, format it as text and add it to the context
      if (
        request.advancedContext?.tools &&
        request.advancedContext.tools.length > 0
      ) {
        const toolsText = TemplateProcessor.formatToolsAsText(
          request.advancedContext.tools,
        );
        context.toolsContext = toolsText;
      }

      const messages = TemplateProcessor.processTemplate(template, context);

      // Use the new structured streaming response
      await this.llmService.sendMessageStream(messages, request.modelKey, {
        onToken: callbacks.onToken,
        onReasoningToken: callbacks.onReasoningToken, // Supports the reasoning content stream
        onComplete: async (response) => {
          try {
            if (response) {
              // Validate the main content
              this.validateResponse(response.content, request.targetPrompt);

              // Note: saving history is handled by the UI layer's historyManager.createNewChain method
              // The duplicate saveOptimizationHistory call was removed to avoid saving twice
            }

            // Call the original completion callback, passing the structured response
            callbacks.onComplete(response);
          } catch (error) {
            // If validation fails, call the error callback
            callbacks.onError(
              error instanceof Error ? error : new Error(String(error)),
            );
          }
        },
        onError: callbacks.onError,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new OptimizationError(
        request.targetPrompt,
        `Optimization failed: ${errorMessage}`,
      );
    }
  }

  /**
   * Optimize a single message (streaming) - dedicated to multi-turn conversation mode
   */
  async optimizeMessageStream(
    request: MessageOptimizationRequest,
    callbacks: StreamHandlers,
  ): Promise<void> {
    try {
      // Validate the request parameters
      this.validateMessageOptimizationRequest(request);

      // Get the model config
      const modelConfig = await this.modelManager.getModel(request.modelKey);
      if (!modelConfig) {
        throw new OptimizationError("", "Model not found");
      }

      // Find the selected message in the message array
      const selectedMessage = request.messages.find(
        msg => msg.id === request.selectedMessageId
      )!;

      // Get the index of the selected message (starting from 0)
      const selectedIndex = request.messages.findIndex(
        msg => msg.id === request.selectedMessageId
      );

      // Get the template (context-message-optimize is used by default)
      const template = await this.templateManager.getTemplate(
        request.templateId || "context-message-optimize"
      );

      if (!template?.content) {
        throw new OptimizationError(
          selectedMessage.content,
          "Template not found or invalid",
        );
      }

      // Add metadata to the message array (used for template loops)
      const messagesWithMeta = request.messages.map((msg, idx) => ({
        index: idx + 1,  // Numbering starts from 1
        roleLabel: msg.role.toUpperCase(),
        content: msg.content,
        isSelected: msg.id === request.selectedMessageId,
      }));

      // Prepare the data of the selected message (including a length check)
      const maxLength = 200;
      const selectedMessageData = {
        index: selectedIndex + 1,
        roleLabel: selectedMessage.role.toUpperCase(),
        content: selectedMessage.content,
        contentTooLong: selectedMessage.content.length > maxLength,
        contentPreview: selectedMessage.content.length > maxLength
          ? selectedMessage.content.substring(0, 150)
          : undefined,
      };

      // Build the template context
      const context: TemplateContext = {
        originalPrompt: selectedMessage.content,
        messageRole: selectedMessage.role,
        contextMode: request.contextMode,
        customVariables: request.variables,
        tools: request.tools,
        // 🆕 Template-driven data
        conversationMessages: messagesWithMeta,
        selectedMessage: selectedMessageData,
      };

      // If there are tool definitions, format them as tool text
      if (request.tools && request.tools.length > 0) {
        context.toolsContext = TemplateProcessor.formatToolsAsText(
          request.tools
        );
      }

      // Process the template
      const messages = TemplateProcessor.processTemplate(template, context);

      // Send using streaming
      await this.llmService.sendMessageStream(messages, request.modelKey, {
        onToken: callbacks.onToken,
        onReasoningToken: callbacks.onReasoningToken,
        onComplete: async (response) => {
          try {
            if (response) {
              // Validate the main content
              this.validateResponse(response.content, selectedMessage.content);
            }

            // Call the original completion callback
            callbacks.onComplete(response);
          } catch (error) {
            // If validation fails, call the error callback
            callbacks.onError(
              error instanceof Error ? error : new Error(String(error)),
            );
          }
        },
        onError: callbacks.onError,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new OptimizationError(
        "",
        `Message optimization failed: ${errorMessage}`,
      );
    }
  }

  /**
   * Iteratively optimize a prompt (streaming)
   */
  async iteratePromptStream(
    originalPrompt: string,
    lastOptimizedPrompt: string,
    iterateInput: string,
    modelKey: string,
    handlers: StreamHandlers,
    templateId: string,
    contextData?: {
      messages?: ConversationMessage[];
      selectedMessageId?: string;
      variables?: Record<string, string>;
      tools?: ToolDefinition[];
    },
  ): Promise<void> {
    try {
      // 🔧 The iterate template only needs lastOptimizedPrompt and iterateInput
      // originalPrompt may be empty (when the user iterates after editing directly in the workspace)
      this.validateInput(lastOptimizedPrompt, modelKey);
      this.validateInput(iterateInput, modelKey);

      // Get the model config
      const modelConfig = await this.modelManager.getModel(modelKey);
      if (!modelConfig) {
        throw new ServiceDependencyError("ModelManager", "Model not found");
      }

      // Get the iterate prompt
      let template;
      try {
        template = await this.templateManager.getTemplate(templateId);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        throw new IterationError(
          originalPrompt,
          iterateInput,
          `Iteration failed: ${errorMessage}`,
        );
      }

      if (!template?.content) {
        throw new IterationError(
          originalPrompt,
          iterateInput,
          "Iteration failed: Template not found or invalid",
        );
      }

      // 🔧 Iteration must use an advanced template (message array format) to support variable substitution
      if (typeof template.content === "string") {
        throw new IterationError(
          originalPrompt,
          iterateInput,
          `Iteration requires advanced template (message array format) for variable substitution.\n` +
            `Template ID: ${template.id}\n` +
            `Current template type: Simple template (string format)\n` +
            `Suggestion: Please use message array format template that supports {{lastOptimizedPrompt}} and {{iterateInput}} variables`,
        );
      }

      // Use TemplateProcessor to process the template and substitute variables
      const context: TemplateContext = {
        originalPrompt,
        lastOptimizedPrompt,
        iterateInput,
        customVariables: contextData?.variables,
        tools: contextData?.tools,
      };

      // If there are conversation messages, format them as text and add them to the context
      if (contextData?.messages && contextData.messages.length > 0) {
        const conversationText = TemplateProcessor.formatConversationAsText(
          contextData.messages,
        );
        context.conversationContext = conversationText;
      }

      // If there is tool info, format it as text and add it to the context
      if (contextData?.tools && contextData.tools.length > 0) {
        const toolsText = TemplateProcessor.formatToolsAsText(
          contextData.tools,
        );
        context.toolsContext = toolsText;
      }

      const messages = TemplateProcessor.processTemplate(template, context);

      // Use the new structured streaming response
      await this.llmService.sendMessageStream(messages, modelKey, {
        onToken: handlers.onToken,
        onReasoningToken: handlers.onReasoningToken, // Supports the reasoning content stream
        onComplete: async (response) => {
          try {
            if (response) {
              // Validate the iteration result
              this.validateResponse(response.content, lastOptimizedPrompt);
            }

            // Call the original completion callback, passing the structured response
            // Note: iteration history is handled by the UI layer's historyManager.addIteration method
            handlers.onComplete(response);
          } catch (error) {
            // If validation fails, call the error callback
            handlers.onError(
              error instanceof Error ? error : new Error(String(error)),
            );
          }
        },
        onError: handlers.onError,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new IterationError(
        originalPrompt,
        iterateInput,
        `Iteration failed: ${errorMessage}`,
      );
    }
  }

  // === New: enhanced methods supporting prompt types ===

  /**
   * Validate the optimization request parameters
   */
  private validateOptimizationRequest(request: OptimizationRequest) {
    if (!request.targetPrompt?.trim()) {
      throw new OptimizationError("", "Target prompt is required");
    }
    if (!request.modelKey?.trim()) {
      throw new OptimizationError(request.targetPrompt, "Model key is required");
    }
  }

  /**
   * Get the default template ID
   */
  private async getDefaultTemplateId(
    templateType:
      | "optimize"
      | "userOptimize"
      | "text2imageOptimize"
      | "image2imageOptimize"
      | "imageIterate"
      | "iterate"
      | "conversationMessageOptimize"
      | "contextUserOptimize"
      | "contextIterate",
  ): Promise<string> {
    try {
      // Try to get the list of templates of the specified type
      const templates = await this.templateManager.listTemplatesByType(
        templateType as any,
      );
      if (templates.length > 0) {
        // Return the ID of the first template in the list
        return templates[0].id;
      }
    } catch (error) {
      console.warn(`Failed to get templates for type ${templateType}`, error);
    }

    // If there are no templates of the specified type, try templates of a related type as a fallback
    try {
      let fallbackTypes: (
        | "optimize"
        | "userOptimize"
        | "text2imageOptimize"
        | "image2imageOptimize"
        | "iterate"
      )[] = [];

      if (
        templateType === "optimize" ||
        templateType === "conversationMessageOptimize"
      ) {
        fallbackTypes = ["userOptimize"]; // The optimize type falls back to userOptimize
      } else if (
        templateType === "userOptimize" ||
        templateType === "contextUserOptimize"
      ) {
        fallbackTypes = ["optimize"]; // The userOptimize type falls back to optimize
      } else if (
        templateType === "iterate" ||
        templateType === "contextIterate"
      ) {
        fallbackTypes = ["optimize", "userOptimize"]; // The iterate type falls back to any optimize type
      } else if (templateType === "text2imageOptimize") {
        fallbackTypes = ["userOptimize", "optimize"]; // Text-to-image falls back to the basic optimize types
      } else if (templateType === "image2imageOptimize") {
        fallbackTypes = ["text2imageOptimize", "userOptimize", "optimize"]; // Image-to-image falls back to text-to-image first
      } else if (templateType === "imageIterate") {
        fallbackTypes = ["iterate", "text2imageOptimize", "userOptimize"]; // Image iteration falls back to general iteration / text-to-image
      }

      for (const fallbackType of fallbackTypes) {
        const fallbackTemplates =
          await this.templateManager.listTemplatesByType(fallbackType as any);
        if (fallbackTemplates.length > 0) {
          console.log(
            `Using fallback template type ${fallbackType} for ${templateType}`,
          );
          return fallbackTemplates[0].id;
        }
      }

      // Last fallback: get the first available built-in template among all templates
      const allTemplates = await this.templateManager.listTemplates();
      const availableTemplate = allTemplates.find((t) => t.isBuiltin);
      if (availableTemplate) {
        console.warn(
          `Using fallback builtin template: ${availableTemplate.id} for type ${templateType}`,
        );
        return availableTemplate.id;
      }
    } catch (fallbackError) {
      console.error(`Fallback template search failed:`, fallbackError);
    }

    // If all approaches fail, throw an error
    throw new ServiceDependencyError('TemplateManager', `No templates available for type: ${templateType}`);
  }

  // The saveOptimizationHistory method was removed
  // Saving history is now handled by the UI layer's historyManager.createNewChain method

  // The saveTestHistory method was removed
  // The test feature no longer saves history, keeping the architecture consistent
  // Tests are temporary verification and should not be mixed with optimization history

  // Note: iteration history is managed by the UI layer, not the core service layer
  // Reasons:
  // 1. Iteration needs an existing chainId, which is maintained by the UI layer's state manager
  // 2. Iteration is closely tied to user interaction and needs real-time UI state updates
  // 3. Version management logic is easier to handle in the UI layer
  //
  // In contrast, an optimization creates a new chain, so it can be handled in the core layer
  // This hybrid architecture is a deliberate design trade-off

  /**
   * Custom conversation test (streaming) - advanced mode feature
   */
  async testCustomConversationStream(
    request: CustomConversationRequest,
    callbacks: StreamHandlers,
  ): Promise<void> {
    try {
      // Validate the request
      if (!request.modelKey?.trim()) {
        throw new TestError("", "", "Model key is required");
      }
      if (!request.messages || request.messages.length === 0) {
        throw new TestError("", "", "At least one message is required");
      }

      // Validate that the model exists
      const modelConfig = await this.modelManager.getModel(request.modelKey);
      if (!modelConfig) {
        throw new TestError("", "", "Model not found");
      }

      // Process the conversation messages: substitute variables
      const processedMessages = TemplateProcessor.processConversationMessages(
        request.messages,
        request.variables,
      );

      if (processedMessages.length === 0) {
        throw new TestError("", "", "No valid messages after processing");
      }

      // Use streaming sends, choosing a different method depending on whether there are tools
      if (request.tools && request.tools.length > 0) {
        // 🆕 Use streaming sends with tool support
        await this.llmService.sendMessageStreamWithTools(
          processedMessages,
          request.modelKey,
          request.tools,
          {
            onToken: callbacks.onToken,
            onReasoningToken: callbacks.onReasoningToken,
            onToolCall: callbacks.onToolCall, // 🆕 Pass the tool call callback
            onComplete: async (response) => {
              if (response) {
                console.log(
                  "[PromptService] Custom conversation test with tools completed successfully",
                );
                callbacks.onComplete?.(response);
              }
            },
            onError: (error) => {
              console.error(
                "[PromptService] Custom conversation test with tools failed:",
                error,
              );
              callbacks.onError?.(error);
            },
          },
        );
      } else {
        // Traditional streaming send (no tools)
        await this.llmService.sendMessageStream(
          processedMessages,
          request.modelKey,
          {
            onToken: callbacks.onToken,
            onReasoningToken: callbacks.onReasoningToken,
            onComplete: async (response) => {
              if (response) {
                console.log(
                  "[PromptService] Custom conversation test completed successfully",
                );
                callbacks.onComplete?.(response);
              }
            },
            onError: (error) => {
              console.error(
                "[PromptService] Custom conversation test failed:",
                error,
              );
              callbacks.onError?.(error);
            },
          },
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        "[PromptService] Custom conversation test error:",
        errorMessage,
      );

      // Pass the error through the callback
      if (callbacks.onError) {
        callbacks.onError(
          new Error(`Custom conversation test failed: ${errorMessage}`),
        );
        } else {
          throw new TestError(
            "",
            "",
            `Custom conversation test failed: ${errorMessage}`,
          );
        }
    }
  }
}
