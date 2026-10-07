import { Template } from "./types";
import { Message } from "../llm/types";
import { Mustache } from "./minimal";
import { TemplateValidationError } from "./errors";
import type {
  OptimizationMode,
  ConversationMessage,
  ToolDefinition,
} from "../prompt/types";

/**
 * Template variable context
 */
export interface TemplateContext {
  originalPrompt?: string;
  iterateInput?: string;
  lastOptimizedPrompt?: string;
  optimizationMode?: OptimizationMode; // Optimization mode
  // Context mode (used to distinguish system/user modes, although there is no difference at the rendering level anymore)
  contextMode?: import("../context/types").ContextMode; // 'system' | 'user'
  // Advanced mode context (optional)
  customVariables?: Record<string, string>; // Custom variables
  tools?: ToolDefinition[]; // Tool definition info
  // Formatted context text (for template injection)
  conversationContext?: string; // Formatted conversation context
  toolsContext?: string; // Formatted tools context
  // Fields dedicated to message optimization
  messageRole?: string; // Role of the selected message (system/user)
  conversationMessages?: any[]; // Message array with metadata (used for template loops)
  selectedMessage?: any; // Detailed info of the selected message (used for template display)
  // Allow additional properties for template flexibility
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/**
 * Simplified template processor with organized methods
 */
export class TemplateProcessor {
  /**
   * Process template and return message array
   */
  static processTemplate(
    template: Template,
    context: TemplateContext,
  ): Message[] {
    // Validate template content
    this.validateTemplate(template);

    // Build messages based on template type
    return this.buildMessages(template, context);
  }

  /**
   * Validate template content
   */
  private static validateTemplate(template: Template): void {
    if (!template?.content) {
      throw new TemplateValidationError(
        `Template content is missing or invalid for template: ${template?.id || "unknown"}`,
      );
    }

    // Check for empty array content
    if (Array.isArray(template.content) && template.content.length === 0) {
      throw new TemplateValidationError(
        `Template content cannot be empty for template: ${template.id}`,
      );
    }
  }

  /**
   * Build messages from template
   */
  private static buildMessages(
    template: Template,
    context: TemplateContext,
  ): Message[] {
    // Simple template: no template technology, directly use as system prompt
    if (typeof template.content === "string") {
      const messages: Message[] = [
        { role: "system", content: template.content },
      ];

      // Add user message - pass user content directly without template replacement
      if (context.originalPrompt) {
        messages.push({ role: "user", content: context.originalPrompt });
      }

      return messages;
    }

    // Advanced template: render with Mustache
    if (Array.isArray(template.content)) {
      return template.content.map((msg) => {
        // Render uniformly with Mustache
        // Mustache will:
        // 1. Replace the built-in variables in the template (such as {{originalPrompt}})
        // 2. Automatically preserve placeholders in values (such as originalPrompt = "Write a song in {{style}} style")
        // 3. Support conditional rendering ({{#var}}...{{/var}}) and loops
        // Ensure array variables are at least empty arrays, so undefined does not make {{#var}} blocks fail to render (Mustache behavior: undefined/null/false are falsy)
        // But do we need to distinguish "does not exist" from "empty array"? For {{^var}}, undefined/null/empty array are all true (inverted)
        // As long as the correct key is passed in the context.

        const renderedContent = Mustache.render(msg.content, context);

        return {
          role: msg.role,
          content: renderedContent,
        };
      });
    }

    throw new TemplateValidationError(
      `Invalid template content format for template: ${template.id}`,
    );
  }

  /**
   * Check if template is simple type
   */
  static isSimpleTemplate(template: Template): boolean {
    return typeof template.content === "string";
  }

  /**
   * Create the extended template context
   * Merges the base context and the advanced context (custom variables)
   */
  static createExtendedContext(
    baseContext: TemplateContext,
    customVariables?: Record<string, string>,
    conversationMessages?: ConversationMessage[],
  ): TemplateContext {
    // Merge all variables into the context
    const extendedContext: TemplateContext = {
      ...baseContext,
      customVariables,
      conversationMessages,
    };

    // Add custom variables directly to the context so templates can access them directly
    if (customVariables) {
      Object.entries(customVariables).forEach(([key, value]) => {
        // Only add when the key is not in the base context (predefined variables take precedence)
        if (extendedContext[key] === undefined) {
          extendedContext[key] = value;
        }
      });
    }

    return extendedContext;
  }

  /**
   * Process conversation messages: convert the message array to text
   * Used to inject the conversation context into the template during the optimization phase
   */
  static formatConversationAsText(messages: ConversationMessage[]): string {
    if (!messages || messages.length === 0) {
      return "";
    }

    return messages
      .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join("\n\n");
  }


  /**
   * Substitute variables in conversation messages
   * Used to actually substitute variables during the test phase
   */
  static processConversationMessages(
    messages: ConversationMessage[],
    variables: Record<string, string>,
  ): Message[] {
    if (!messages || messages.length === 0) {
      return [];
    }

    return messages.map((msg) => {
      // Use Mustache for variable substitution
      // Mustache automatically preserves placeholders in values, so no special handling is needed
      const processedContent = Mustache.render(msg.content, variables);

      return {
        role: msg.role,
        content: processedContent,
      };
    });
  }

  /**
   * Format tool info as text
   * Used to inject the tool context into the template during the optimization phase, helping the LLM understand the available tools
   */
  static formatToolsAsText(tools: ToolDefinition[]): string {
    if (!tools || tools.length === 0) {
      return "";
    }

    return tools
      .map((tool) => {
        const func = tool.function;
        let toolText = `Tool name: ${func.name}`;

        if (func.description) {
          toolText += `\nDescription: ${func.description}`;
        }

        if (func.parameters) {
          toolText += `\nParameter schema: ${JSON.stringify(func.parameters, null, 2)}`;
        }

        return toolText;
      })
      .join("\n\n");
  }
}
