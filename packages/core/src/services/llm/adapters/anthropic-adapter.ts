import Anthropic from '@anthropic-ai/sdk'
import { AbstractTextProviderAdapter } from './abstract-adapter'
import { APIError } from '../errors'
import type {
  TextProvider,
  TextModel,
  TextModelConfig,
  Message,
  LLMResponse,
  StreamHandlers,
  ParameterDefinition,
  ToolDefinition
} from '../types'

// Anthropic recommends a smaller max_tokens value for non-streaming requests
// An overly large value may trigger the "Streaming is required for operations that may take longer than 10 minutes" error
// Reference: https://github.com/anthropics/anthropic-sdk-typescript#long-requests
const DEFAULT_MAX_TOKENS = 8192

/**
 * Anthropic official SDK adapter implementation
 * Uses the @anthropic-ai/sdk package for official support
 *
 * Responsibilities:
 * - Encapsulate calls to the official Anthropic SDK
 * - Handle Claude-specific message formats and system instructions
 * - Provide the static list of Claude models
 * - Support true SSE streaming responses
 * - Support tool calls
 * - Preserve the original error stack
 */
export class AnthropicAdapter extends AbstractTextProviderAdapter {
  // ===== Provider metadata =====

  /**
   * Get Provider metadata
   */
  public getProvider(): TextProvider {
    return {
      id: 'anthropic',
      name: 'Anthropic',
      description: 'Anthropic Claude models (Official SDK)',
      requiresApiKey: true,
      defaultBaseURL: 'https://api.anthropic.com',
      supportsDynamicModels: true,
      apiKeyUrl: 'https://console.anthropic.com/settings/keys',
      connectionSchema: {
        required: ['apiKey'],
        optional: ['baseURL'],
        fieldTypes: {
          apiKey: 'string',
          baseURL: 'string',
        }
      }
    }
  }

  /**
   * Get the static model list (Claude series)
   * Migrated from fetchAnthropicModelsInfo in service.ts (L1115-1120)
   */
  public getModels(): TextModel[] {
    const providerId = 'anthropic'

    return [
      // Claude 4.0 series
      {
        id: 'claude-opus-4-20250514',
        name: 'Claude 4.0 Opus',
        description: 'Most powerful Claude model for complex tasks',
        providerId,
        capabilities: {
                    supportsTools: true,
          supportsReasoning: false,
          maxContextLength: 200000
        },
        parameterDefinitions: this.getParameterDefinitions('claude-opus-4-20250514'),
        defaultParameterValues: this.getDefaultParameterValues('claude-opus-4-20250514')
      },
      {
        id: 'claude-sonnet-4-20250514',
        name: 'Claude 4.0 Sonnet',
        description: 'Balanced Claude model for most tasks',
        providerId,
        capabilities: {
                    supportsTools: true,
          supportsReasoning: false,
          maxContextLength: 200000
        },
        parameterDefinitions: this.getParameterDefinitions('claude-sonnet-4-20250514'),
        defaultParameterValues: this.getDefaultParameterValues('claude-sonnet-4-20250514')
      }
    ]
  }

  /**
   * Dynamically fetch the model list
   * @param config Connection config
   * @returns Dynamically fetched model list
   */
  public async getModelsAsync(config: TextModelConfig): Promise<TextModel[]> {
    const client = this.createClient(config)

    try {
      const response = await client.models.list()

      // Check the response format
      if (response && response.data && Array.isArray(response.data)) {
        const models = response.data
          .map((model: any) => {
            // Use buildDefaultModel to create a TextModel object for each model ID
            // The model objects returned by the Anthropic API contain: id, name, version, capabilities
            return this.buildDefaultModel(model.id)
          })
          .sort((a, b) => a.id.localeCompare(b.id))

        if (models.length === 0) {
          throw new APIError('API returned empty model list')
        }

        console.log(`[AnthropicAdapter] Successfully fetched ${models.length} models`)
        return models
      }

      throw new APIError('Unexpected API response format')
    } catch (error: any) {
      console.error('[AnthropicAdapter] Failed to fetch models:', error)

      // Connection error handling (including CORS detection)
      if (error.message && (error.message.includes('Failed to fetch') ||
          error.message.includes('NetworkError') ||
          error.message.includes('ECONNREFUSED') ||
          error.message.includes('CORS'))) {
        throw new APIError(`Network error: ${error.message}`)
      }

      // API error handling
      if (error.status) {
        throw new APIError(`Anthropic API error (${error.status}): ${error.message}`)
      }

      // Other errors
      throw error
    }
  }

  // ===== Parameter definitions (used by buildDefaultModel) =====

  /**
   * Get parameter definitions
   */
  protected getParameterDefinitions(_modelId: string): readonly ParameterDefinition[] {
    return [
      {
        name: 'temperature',
        labelKey: 'params.temperature.label',
        descriptionKey: 'params.temperature.description',
        description: 'Sampling temperature (0-1)',
        type: 'number',
        defaultValue: 1,
        default: 1,
        minValue: 0,
        maxValue: 1,
        min: 0,
        max: 1,
        step: 0.1
      },
      {
        name: 'top_p',
        labelKey: 'params.top_p.label',
        descriptionKey: 'params.top_p.description',
        description: 'Nucleus sampling parameter',
        type: 'number',
        defaultValue: 1,
        default: 1,
        minValue: 0,
        maxValue: 1,
        min: 0,
        max: 1,
        step: 0.01
      },
      {
        name: 'top_k',
        labelKey: 'params.top_k.label',
        descriptionKey: 'params.top_k.description',
        description: 'Top-k sampling parameter',
        type: 'integer',
        minValue: 1,
        min: 1,
        step: 1
      },
      {
        name: 'max_tokens',
        labelKey: 'params.max_tokens.label',
        descriptionKey: 'params.max_tokens.description',
        description: 'Maximum tokens to generate',
        type: 'integer',
        defaultValue: DEFAULT_MAX_TOKENS,
        default: DEFAULT_MAX_TOKENS,
        minValue: 1,
        min: 1,
        unitKey: 'params.tokens.unit',
        step: 1
      },
      {
        name: 'thinking_budget_tokens',
        labelKey: 'params.thinkingBudget.label',
        descriptionKey: 'params.thinkingBudget.description',
        description: 'Extended thinking budget in tokens (requires ≥1024)',
        type: 'integer',
        minValue: 1024,
        min: 1024,
        unitKey: 'params.tokens.unit',
        step: 1,
        tags: ['advanced']
      }
    ]
  }

  /**
   * Get default parameter values
   * Returns an empty object so the server uses its official defaults, avoiding wrong client-side defaults affecting results
   */
  protected getDefaultParameterValues(_modelId: string): Record<string, unknown> {
    return {
      max_tokens: DEFAULT_MAX_TOKENS, // 8192 - required by the Anthropic API
    }
  }

  // ===== Core method implementations =====

  /**
   * Send a message (using the official SDK)
   */
  protected async doSendMessage(
    messages: Message[],
    config: TextModelConfig
  ): Promise<LLMResponse> {
    const client = this.createClient(config)

    try {
      // Extract known parameters and custom parameters
      const {
        max_tokens,
        temperature,
        top_p,
        top_k,
        thinking_budget_tokens,
        ...otherParams // Other parameters (including custom parameters)
      } = (config.paramOverrides || {}) as any

      const requestParams: any = {
        model: config.modelMeta.id,
        messages: this.convertMessages(messages),
        max_tokens: max_tokens ?? DEFAULT_MAX_TOKENS // Force a preset value; required by the Anthropic API
      }

      // Only add parameters when the user explicitly sets them, avoiding client-side defaults
      if (temperature !== undefined) {
        requestParams.temperature = temperature
      }
      if (top_p !== undefined) {
        requestParams.top_p = top_p
      }
      if (top_k !== undefined) {
        requestParams.top_k = top_k
      }

      // Add the system message (if any)
      const systemMessage = this.extractSystemMessage(messages)
      if (systemMessage) {
        requestParams.system = systemMessage
      }

      // Add the Extended Thinking config
      if (thinking_budget_tokens !== undefined && thinking_budget_tokens >= 1024) {
        requestParams.thinking = {
          type: 'enabled',
          budget_tokens: thinking_budget_tokens
        }
      }

      // Add other parameters (including custom parameters)
      Object.assign(requestParams, otherParams)

      const response = await client.messages.create(requestParams)

      // Extract the thinking content
      const reasoning = this.extractThinking(response)

      return {
        content: this.extractContent(response),
        reasoning,
        metadata: {
          model: response.model,
          finishReason: response.stop_reason || undefined,
          tokens: response.usage ? (response.usage.input_tokens || 0) + (response.usage.output_tokens || 0) : undefined
        }
      }
    } catch (error) {
      throw this.handleError(error)
    }
  }

  /**
   * Send a streaming message (true SSE stream)
   */
  protected async doSendMessageStream(
    messages: Message[],
    config: TextModelConfig,
    callbacks: StreamHandlers
  ): Promise<void> {
    const client = this.createClient(config)
    const thinkState = { isInThinkMode: false, buffer: '' }

    try {
      // Extract known parameters and custom parameters
      const {
        max_tokens,
        temperature,
        top_p,
        top_k,
        thinking_budget_tokens,
        ...otherParams // Other parameters (including custom parameters)
      } = (config.paramOverrides || {}) as any

      const requestParams: any = {
        model: config.modelMeta.id,
        messages: this.convertMessages(messages),
        max_tokens: max_tokens ?? DEFAULT_MAX_TOKENS // Force a preset value; required by the Anthropic API
      }

      // Only add parameters when the user explicitly sets them, avoiding client-side defaults
      if (temperature !== undefined) {
        requestParams.temperature = temperature
      }
      if (top_p !== undefined) {
        requestParams.top_p = top_p
      }
      if (top_k !== undefined) {
        requestParams.top_k = top_k
      }

      // Add the system message (if any)
      const systemMessage = this.extractSystemMessage(messages)
      if (systemMessage) {
        requestParams.system = systemMessage
      }

      // Add the Extended Thinking config
      if (thinking_budget_tokens !== undefined && thinking_budget_tokens >= 1024) {
        requestParams.thinking = {
          type: 'enabled',
          budget_tokens: thinking_budget_tokens
        }
      }

      // Add other parameters (including custom parameters)
      Object.assign(requestParams, otherParams)

      const stream = await client.messages.stream(requestParams)

      let accumulatedReasoning = ''

      // Listen for native thinking events (Extended Thinking)
      ;(stream as any).on('thinking', (thinkingDelta: string) => {
        accumulatedReasoning += thinkingDelta
        if (callbacks.onReasoningToken) {
          callbacks.onReasoningToken(thinkingDelta)
        }
      })

      // Listen for text content events (<think> tags are also supported)
      ;(stream as any).on('text', (text: string) => {
        this.processStreamContentWithThinkTags(text, callbacks, thinkState)
      })

      // Listen for the final message
      ;(stream as any).on('message', (message: any) => {
        const response: LLMResponse = {
          content: this.extractContent(message),
          reasoning: accumulatedReasoning || undefined,
          metadata: {
            model: message.model,
            finishReason: message.stop_reason || undefined,
            tokens: message.usage ? (message.usage.input_tokens || 0) + (message.usage.output_tokens || 0) : undefined
          }
        }
        callbacks.onComplete(response)
      })

      ;(stream as any).on('error', (error: any) => {
        callbacks.onError(error)
      })

      // Wait for the stream to complete
      await stream.finalMessage()
    } catch (error) {
      callbacks.onError(this.handleError(error))
      throw error
    }
  }

  /**
   * Send a streaming message with tool calls
   * Uses the standard messages.stream API and handles tool calls manually
   */
  public async sendMessageStreamWithTools(
    messages: Message[],
    config: TextModelConfig,
    tools: ToolDefinition[],
    callbacks: StreamHandlers
  ): Promise<void> {
    const client = this.createClient(config)
    const thinkState = { isInThinkMode: false, buffer: '' }

    try {
      // Extract known parameters and custom parameters
      const {
        max_tokens,
        temperature,
        top_p,
        top_k,
        thinking_budget_tokens,
        ...otherParams // Other parameters (including custom parameters)
      } = (config.paramOverrides || {}) as any

      const requestParams: any = {
        model: config.modelMeta.id,
        messages: this.convertMessages(messages),
        tools: this.convertTools(tools),
        max_tokens: max_tokens ?? DEFAULT_MAX_TOKENS // Force a preset value; required by the Anthropic API
      }

      // Only add parameters when the user explicitly sets them, avoiding client-side defaults
      if (temperature !== undefined) {
        requestParams.temperature = temperature
      }
      if (top_p !== undefined) {
        requestParams.top_p = top_p
      }
      if (top_k !== undefined) {
        requestParams.top_k = top_k
      }

      // Add the system message (if any)
      const systemMessage = this.extractSystemMessage(messages)
      if (systemMessage) {
        requestParams.system = systemMessage
      }

      // Add the Extended Thinking config
      if (thinking_budget_tokens !== undefined && thinking_budget_tokens >= 1024) {
        requestParams.thinking = {
          type: 'enabled',
          budget_tokens: thinking_budget_tokens
        }
      }

      // Add other parameters (including custom parameters)
      Object.assign(requestParams, otherParams)

      const stream = await client.messages.stream(requestParams)

      let accumulatedContent = ''
      let accumulatedReasoning = ''
      const toolCalls: any[] = []
      let currentToolCallIndex = -1

      // Listen for native thinking events (Extended Thinking)
      ;(stream as any).on('thinking', (thinkingDelta: string) => {
        accumulatedReasoning += thinkingDelta
        if (callbacks.onReasoningToken) {
          callbacks.onReasoningToken(thinkingDelta)
        }
      })

      // Listen for content block start events
      ;(stream as any).on('contentBlockStart', (event: any) => {
        if (event.contentBlock?.type === 'tool_use') {
          currentToolCallIndex++
          toolCalls.push({
            id: event.contentBlock.id,
            type: 'function' as const,
            function: {
              name: event.contentBlock.name,
              arguments: ''
            }
          })
        }
      })

      // Listen for content block delta events
      ;(stream as any).on('contentBlockDelta', (event: any) => {
        if (event.delta?.type === 'text_delta') {
          // Handle text content
          const text = event.delta.text || ''
          accumulatedContent += text
          this.processStreamContentWithThinkTags(text, callbacks, thinkState)
        } else if (event.delta?.type === 'input_json_delta') {
          // Handle incremental tool call arguments
          if (currentToolCallIndex >= 0 && toolCalls[currentToolCallIndex]) {
            toolCalls[currentToolCallIndex].function.arguments += event.delta.partial_json || ''

            // Try to parse the complete JSON; if successful, trigger the callback
            try {
              JSON.parse(toolCalls[currentToolCallIndex].function.arguments)
              if (callbacks.onToolCall) {
                callbacks.onToolCall(toolCalls[currentToolCallIndex])
              }
            } catch {
              // The JSON is not complete yet; keep accumulating
            }
          }
        }
      })

      // Listen for the final message
      ;(stream as any).on('message', (message: any) => {
        const response: LLMResponse = {
          content: accumulatedContent,
          reasoning: accumulatedReasoning || undefined,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          metadata: {
            model: message.model,
            finishReason: message.stop_reason || undefined,
            tokens: message.usage ? (message.usage.input_tokens || 0) + (message.usage.output_tokens || 0) : undefined
          }
        }
        callbacks.onComplete(response)
      })

      ;(stream as any).on('error', (error: any) => {
        callbacks.onError(error)
      })

      // Wait for the stream to complete
      await stream.finalMessage()
    } catch (error) {
      callbacks.onError(this.handleError(error))
      throw error
    }
  }

  // ===== Internal helper methods =====

  /**
   * Create a configured client instance
   */
  private createClient(config: TextModelConfig): Anthropic {
    const options: any = {
      apiKey: config.connectionConfig?.apiKey || '',
      dangerouslyAllowBrowser: true // Configure according to the actual environment
    }

    if (config.connectionConfig?.baseURL) {
      // Normalize the baseURL: remove a trailing /v1 suffix (the SDK adds it automatically)
      let baseURL = config.connectionConfig.baseURL
      if (baseURL.endsWith('/v1')) {
        baseURL = baseURL.slice(0, -3)
      }
      options.baseURL = baseURL
    }

    if (config.connectionConfig?.timeout) {
      options.timeout = config.connectionConfig.timeout
    }

    return new Anthropic(options)
  }

  /**
   * Convert the message format
   */
  private convertMessages(messages: Message[]) {
    return messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }))
  }

  /**
   * Extract system messages
   */
  private extractSystemMessage(messages: Message[]): string | undefined {
    const systemMessages = messages.filter(msg => msg.role === 'system')
    return systemMessages.length > 0
      ? systemMessages.map(msg => msg.content).join('\n')
      : undefined
  }

  /**
   * Extract the response content
   */
  private extractContent(response: any): string {
    if (!response.content || response.content.length === 0) {
      return ''
    }

    return response.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('')
  }

  /**
   * Convert tool definitions
   */
  private convertTools(tools: ToolDefinition[]) {
    return tools.map(tool => ({
      name: tool.function.name,
      description: tool.function.description || '',
      input_schema: {
        type: 'object' as const,
        properties: (tool.function.parameters as any)?.properties || {},
        required: (tool.function.parameters as any)?.required || []
      }
    }))
  }

  /**
   * Extract the thinking content (Extended Thinking)
   */
  private extractThinking(response: any): string | undefined {
    if (!response.content || response.content.length === 0) {
      return undefined
    }

    const thinkingBlocks = response.content.filter(
      (block: any) => block.type === 'thinking'
    )

    if (thinkingBlocks.length === 0) {
      return undefined
    }

    return thinkingBlocks
      .map((block: any) => block.thinking)
      .join('\n')
  }

  /**
   * Error handling
   */
  private handleError(error: any): Error {
    if (error.status) {
      return new Error(`Anthropic API error (${error.status}): ${error.message}`)
    }
    return error instanceof Error ? error : new Error(String(error))
  }
}
