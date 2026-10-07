import type {
  ITextProviderAdapter,
  TextProvider,
  TextModel,
  TextModelConfig,
  Message,
  LLMResponse,
  StreamHandlers,
  ToolDefinition,
  ParameterDefinition
} from '../types'
import { RequestConfigError } from '../errors'

/**
 * Abstract base class for text model Provider adapters
 * Uses the template method pattern to provide unified validation and utility methods
 *
 * Responsibilities:
 * - Provide shared validation logic (validateMessages)
 * - Provide utility methods (processThinkTags, buildDefaultModel)
 * - Define abstract methods for subclasses to implement (doSendMessage, doSendMessageStream)
 */
export abstract class AbstractTextProviderAdapter implements ITextProviderAdapter {
  // ===== Abstract methods that subclasses must implement =====

  /**
   * Get Provider metadata
   */
  public abstract getProvider(): TextProvider

  /**
   * Get the static model list
   */
  public abstract getModels(): TextModel[]

  /**
   * Send a message (structured format) - concrete implementation
   * @param messages Message array
   * @param config Model config
   * @returns LLM response
   * @throws The original SDK error (full stack preserved)
   */
  protected abstract doSendMessage(
    messages: Message[],
    config: TextModelConfig
  ): Promise<LLMResponse>

  /**
   * Send a streaming message - concrete implementation
   * @param messages Message array
   * @param config Model config
   * @param callbacks Streaming response callbacks
   * @throws The original SDK error (full stack preserved)
   */
  protected abstract doSendMessageStream(
    messages: Message[],
    config: TextModelConfig,
    callbacks: StreamHandlers
  ): Promise<void>

  /**
   * Get parameter definitions (used by buildDefaultModel)
   * @param modelId Model ID
   * @returns Array of parameter definitions
   */
  protected abstract getParameterDefinitions(modelId: string): readonly ParameterDefinition[]

  /**
   * Get default parameter values (used by buildDefaultModel)
   * @param modelId Model ID
   * @returns Default parameter values
   */
  protected abstract getDefaultParameterValues(modelId: string): Record<string, unknown>

  // ===== Template methods (public interface) =====

  /**
   * Send a message (template method)
   * Calls doSendMessage after unified validation
   */
  public async sendMessage(
    messages: Message[],
    config: TextModelConfig
  ): Promise<LLMResponse> {
    // 1. Validate the message array
    this.validateMessages(messages)

    // 2. Call the concrete implementation
    return await this.doSendMessage(messages, config)
  }

  /**
   * Send a streaming message (template method)
   * Calls doSendMessageStream after unified validation
   */
  public async sendMessageStream(
    messages: Message[],
    config: TextModelConfig,
    callbacks: StreamHandlers
  ): Promise<void> {
    // 1. Validate the message array
    this.validateMessages(messages)

    // 2. Call the concrete implementation
    await this.doSendMessageStream(messages, config, callbacks)
  }

  /**
   * Send a streaming message with tool call support (template method)
   * The default implementation calls doSendMessageStream; subclasses may override
   */
  public async sendMessageStreamWithTools(
    messages: Message[],
    config: TextModelConfig,
    _tools: ToolDefinition[],
    callbacks: StreamHandlers
  ): Promise<void> {
    // Validate the message array
    this.validateMessages(messages)

    // Default implementation: pass the tool parameters to the concrete implementation
    // Subclasses should override this method to handle tool calls
    await this.doSendMessageStream(messages, config, callbacks)
  }

  // ===== Shared validation methods =====

  /**
   * Validate the message array format
   * @param messages Message array
   * @throws {RequestConfigError} When the message array is invalid
   */
  protected validateMessages(messages: Message[]): void {
    if (!Array.isArray(messages)) {
      throw new RequestConfigError('Messages must be an array')
    }

    if (messages.length === 0) {
      throw new RequestConfigError('Messages array cannot be empty')
    }

    for (const msg of messages) {
      if (!msg.role || !msg.content) {
        throw new RequestConfigError('Each message must have role and content')
      }

      if (!['system', 'user', 'assistant', 'tool'].includes(msg.role)) {
        throw new RequestConfigError(`Invalid message role: ${msg.role}`)
      }

      if (typeof msg.content !== 'string') {
        throw new RequestConfigError('Message content must be a string')
      }
    }
  }

  // ===== Utility methods =====

  /**
   * Process <think> tags, separating reasoning content from main content
   * Migrated from the processStreamContentWithThinkTags logic in the existing service.ts
   *
   * @param content Raw content
   * @returns Processed result {content: main content, reasoning?: reasoning content}
   */
  protected processThinkTags(content: string): { content: string; reasoning?: string } {
    // If the content contains no think tags, return directly
    if (!content.includes('<think>')) {
      return { content }
    }

    // Extract the <think>...</think> content as reasoning content
    const thinkRegex = /<think>([\s\S]*?)<\/think>/g
    const reasoningParts: string[] = []
    let match

    while ((match = thinkRegex.exec(content)) !== null) {
      reasoningParts.push(match[1])
    }

    // Remove all <think> tags and their content to get the main content
    const mainContent = content.replace(thinkRegex, '').trim()

    return {
      content: mainContent,
      reasoning: reasoningParts.length > 0 ? reasoningParts.join('\n') : undefined
    }
  }

  /**
   * Process <think> tags in a stream (for streaming scenarios)
   * Migrated from the processStreamContentWithThinkTags logic in the existing service.ts
   *
   * @param content Current chunk content
   * @param callbacks Streaming callbacks
   * @param thinkState State object {isInThinkMode: boolean, buffer: string}
   */
  protected processStreamContentWithThinkTags(
    content: string,
    callbacks: StreamHandlers,
    thinkState: { isInThinkMode: boolean; buffer: string }
  ): void {
    // If there is no reasoning callback, filter out think tags and send to the main content stream
    if (!callbacks.onReasoningToken) {
      // Use processThinkTags to filter out think tags
      const { content: mainContent } = this.processThinkTags(content)
      if (mainContent) {
        callbacks.onToken(mainContent)
      }
      return
    }

    // Append the new content to the buffer
    thinkState.buffer += content
    let remaining = thinkState.buffer
    let processed = ''

    while (remaining.length > 0) {
      if (!thinkState.isInThinkMode) {
        // Not in think mode; look for a <think> tag
        const thinkStartIndex = remaining.indexOf('<think>')

        if (thinkStartIndex !== -1) {
          // Found an opening tag
          // Send the content before the opening tag to the main stream
          if (thinkStartIndex > 0) {
            const beforeThink = remaining.slice(0, thinkStartIndex)
            callbacks.onToken(beforeThink)
            processed += beforeThink + '<think>'
          } else {
            processed += '<think>'
          }

          // Enter think mode
          thinkState.isInThinkMode = true
          remaining = remaining.slice(thinkStartIndex + 7) // 7 = '<think>'.length
        } else {
          // No opening tag found
          // Check whether the end of the buffer may be an incomplete tag start
          if (
            remaining.endsWith('<') ||
            remaining.endsWith('<t') ||
            remaining.endsWith('<th') ||
            remaining.endsWith('<thi') ||
            remaining.endsWith('<thin') ||
            remaining.endsWith('<think')
          ) {
            // May be an incomplete tag; keep it in the buffer and wait for more content
            thinkState.buffer = remaining
            return
          } else {
            // Definitely no tag; send all content to the main stream
            callbacks.onToken(remaining)
            processed += remaining
            remaining = ''
          }
        }
      } else {
        // In think mode; look for the </think> tag
        const thinkEndIndex = remaining.indexOf('</think>')

        if (thinkEndIndex !== -1) {
          // Found the closing tag
          // Send the content before the closing tag to the reasoning stream
          if (thinkEndIndex > 0) {
            const reasoningContent = remaining.slice(0, thinkEndIndex)
            callbacks.onReasoningToken!(reasoningContent)
            processed += reasoningContent + '</think>'
          } else {
            processed += '</think>'
          }

          // Exit think mode
          thinkState.isInThinkMode = false
          remaining = remaining.slice(thinkEndIndex + 8) // 8 = '</think>'.length
        } else {
          // No closing tag found
          // Check whether the end of the buffer may be an incomplete tag end
          if (
            remaining.endsWith('<') ||
            remaining.endsWith('</') ||
            remaining.endsWith('</t') ||
            remaining.endsWith('</th') ||
            remaining.endsWith('</thi') ||
            remaining.endsWith('</thin') ||
            remaining.endsWith('</think')
          ) {
            // May be an incomplete tag; keep it in the buffer and wait for more content
            thinkState.buffer = remaining
            return
          } else {
            // Definitely no closing tag; send all content to the reasoning stream
            callbacks.onReasoningToken!(remaining)
            processed += remaining
            remaining = ''
          }
        }
      }
    }

    // Update the buffer to the processed content
    thinkState.buffer = ''
  }

  /**
   * Get model info by modelId
   * @param modelId Model ID
   * @returns The model object or undefined
   */
  protected getModelById(modelId: string): TextModel | undefined {
    const models = this.getModels()
    return models.find((m) => m.id === modelId)
  }

  /**
   * Build default metadata for an unknown model ID (fallback logic)
   * @param modelId Model ID
   * @returns TextModel object with default capabilities
   */
  public buildDefaultModel(modelId: string): TextModel {
    const provider = this.getProvider()

    return {
      id: modelId,
      name: modelId, // Use the ID as the name by default
      description: `Custom model ${modelId} for ${provider.name}`,
      providerId: provider.id,
      capabilities: {
        supportsTools: true, // Supports tools by default
        supportsReasoning: true, // Supports reasoning by default
        maxContextLength: 128000 // Default context length
      },
      parameterDefinitions: this.getParameterDefinitions(modelId),
      defaultParameterValues: this.getDefaultParameterValues(modelId)
    }
  }
}
