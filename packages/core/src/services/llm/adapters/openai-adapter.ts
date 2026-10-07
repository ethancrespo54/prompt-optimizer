import OpenAI from 'openai'
import { AbstractTextProviderAdapter } from './abstract-adapter'
import { APIError } from '../errors'
import type {
  TextProvider,
  TextModel,
  TextModelConfig,
  Message,
  LLMResponse,
  StreamHandlers,
  ToolDefinition,
  ParameterDefinition
} from '../types'

interface ModelOverride {
  id: string
  name: string
  description: string
  capabilities?: Partial<TextModel['capabilities']>
  defaultParameterValues?: Record<string, unknown>
}

/**
 * OpenAI static model definitions
 */
const OPENAI_STATIC_MODELS: ModelOverride[] = [
  {
    id: 'gpt-5-mini',
    name: 'GPT-5 Mini',
    description: 'Fast, capable, and efficient small model with significant improvements in instruction-following and coding',
    capabilities: {
      supportsTools: true,
      supportsReasoning: false,
      maxContextLength: 1047576
    }
  },
  {
    id: 'gpt-5.1',
    name: 'GPT-5.1',
    description: 'Latest GPT-5.1 flagship model with enhanced capabilities',
    capabilities: {
      supportsTools: true,
      supportsReasoning: false,
      maxContextLength: 1047576
    }
  }
]

/**
 * OpenAI SDK adapter implementation
 * Supports both the official OpenAI API and OpenAI-compatible APIs (DeepSeek, Zhipu, etc.)
 *
 * Responsibilities:
 * - Encapsulate OpenAI SDK call logic
 * - Handle baseURL normalization (remove the '/chat/completions' suffix)
 * - Support browser environments (dangerouslyAllowBrowser)
 * - Support dynamic model fetching (models.list() API)
 * - Preserve the original SDK error stack
 */
export class OpenAIAdapter extends AbstractTextProviderAdapter {
  // ===== Provider metadata =====

  /**
   * Get Provider metadata
   */
  public getProvider(): TextProvider {
    return {
      id: 'openai',
      name: 'OpenAI',
      description: 'OpenAI GPT models and OpenAI-compatible APIs',
      requiresApiKey: true,
      defaultBaseURL: 'https://api.openai.com/v1',
      supportsDynamicModels: true,
      apiKeyUrl: 'https://platform.openai.com/api-keys',
      connectionSchema: {
        required: ['apiKey'],
        optional: ['baseURL'],
        fieldTypes: {
          apiKey: 'string',
          baseURL: 'string'
        }
      }
    }
  }

  /**
   * Get the static model list (official OpenAI models)
   */
  public getModels(): TextModel[] {
    return OPENAI_STATIC_MODELS.map((definition) => {
      const baseModel = this.buildDefaultModel(definition.id)

      return {
        ...baseModel,
        name: definition.name,
        description: definition.description,
        capabilities: {
          ...baseModel.capabilities,
          ...(definition.capabilities ?? {})
        },
        defaultParameterValues: definition.defaultParameterValues
          ? {
              ...(baseModel.defaultParameterValues ?? {}),
              ...definition.defaultParameterValues
            }
          : baseModel.defaultParameterValues
      }
    })
  }

  /**
   * Dynamically fetch the model list (calls the OpenAI models.list() API)
   * @param config Connection config
   * @returns Dynamically fetched model list
   */
  public async getModelsAsync(config: TextModelConfig): Promise<TextModel[]> {
    // Validate that the baseURL ends with /v1
    const baseURL = config.connectionConfig.baseURL || this.getProvider().defaultBaseURL

    const openai = this.createOpenAIInstance(config, false)

    try {
      const response = await openai.models.list()

      // Check the response format
      if (response && response.data && Array.isArray(response.data)) {
        const models = response.data
          .map((model) => {
            // Use buildDefaultModel to create a TextModel object for each model ID
            return this.buildDefaultModel(model.id)
          })
          .sort((a, b) => a.id.localeCompare(b.id))

        if (models.length === 0) {
          throw new APIError('API returned empty model list')
        }

        return models
      }

      throw new APIError('Unexpected API response format')
    } catch (error: any) {
      console.error('[OpenAIAdapter] Failed to fetch models:', error)

      // Connection error handling (including CORS detection)
      if (error.message && (error.message.includes('Failed to fetch') ||
          error.message.includes('Connection error'))) {
        const isCrossOriginError = this.detectCrossOriginError(error, baseURL)

        if (isCrossOriginError) {
          throw new APIError(`Cross-origin connection failed: ${error.message}`)
        } else {
          throw new APIError(`Connection failed: ${error.message}`)
        }
      }

      // Error message returned by the API
      if (error.response?.data) {
        throw new APIError(`API error: ${JSON.stringify(error.response.data)}`)
      }

      // Other errors; keep the original message
      throw new APIError(error.message || 'Unknown error')
    }
  }

  // ===== Parameter definitions (used by buildDefaultModel) =====

  /**
   * Get parameter definitions
   * Based on the official OpenAI docs: https://platform.openai.com/docs/api-reference/chat/create
   */
  protected getParameterDefinitions(_modelId: string): readonly ParameterDefinition[] {
    return [
      {
        name: 'temperature',
        labelKey: 'params.temperature.label',
        descriptionKey: 'params.temperature.description',
        description: 'Sampling temperature (0-2). Higher values make output more random.',
        type: 'number',
        defaultValue: 1,
        default: 1,
        minValue: 0,
        maxValue: 2,
        min: 0,
        max: 2,
        step: 0.1
      },
      {
        name: 'top_p',
        labelKey: 'params.top_p.label',
        descriptionKey: 'params.top_p.description',
        description: 'Nucleus sampling parameter (0-1). Alternative to temperature.',
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
        name: 'max_completion_tokens',
        labelKey: 'params.max_completion_tokens.label',
        descriptionKey: 'params.max_completion_tokens.description',
        description: 'Maximum tokens in completion (recommended over max_tokens)',
        type: 'integer',
        minValue: 1,
        maxValue: 1000000,
        min: 1,
        max: 1000000,
        step: 1,
        unitKey: 'params.tokens.unit'
      },
      {
        name: 'max_tokens',
        labelKey: 'params.max_tokens.label',
        descriptionKey: 'params.max_tokens.description',
        description: 'Deprecated: Use max_completion_tokens instead',
        type: 'integer',
        minValue: 1,
        maxValue: 1000000,
        min: 1,
        max: 1000000,
        step: 1,
        unitKey: 'params.tokens.unit'
      },
      {
        name: 'presence_penalty',
        labelKey: 'params.presence_penalty.label',
        descriptionKey: 'params.presence_penalty.description',
        description: 'Presence penalty (-2.0 to 2.0). Penalizes tokens based on presence.',
        type: 'number',
        defaultValue: 0,
        default: 0,
        minValue: -2,
        maxValue: 2,
        min: -2,
        max: 2,
        step: 0.1
      },
      {
        name: 'frequency_penalty',
        labelKey: 'params.frequency_penalty.label',
        descriptionKey: 'params.frequency_penalty.description',
        description: 'Frequency penalty (-2.0 to 2.0). Penalizes tokens based on frequency.',
        type: 'number',
        defaultValue: 0,
        default: 0,
        minValue: -2,
        maxValue: 2,
        min: -2,
        max: 2,
        step: 0.1
      },
      {
        name: 'logprobs',
        labelKey: 'params.logprobs.label',
        descriptionKey: 'params.logprobs.description',
        description: 'Return log probabilities of output tokens',
        type: 'boolean',
        defaultValue: false,
        default: false
      },
      {
        name: 'top_logprobs',
        labelKey: 'params.top_logprobs.label',
        descriptionKey: 'params.top_logprobs.description',
        description: 'Number of most likely tokens to return (0-20)',
        type: 'integer',
        minValue: 0,
        maxValue: 20,
        min: 0,
        max: 20,
        step: 1
      },
      {
        name: 'seed',
        labelKey: 'params.seed.label',
        descriptionKey: 'params.seed.description',
        description: 'Seed for deterministic sampling (integer)',
        type: 'integer',
        minValue: 0,
        maxValue: 2147483647,
        min: 0,
        max: 2147483647,
        step: 1
      },
      {
        name: 'n',
        labelKey: 'params.n.label',
        descriptionKey: 'params.n.description',
        description: 'Number of completions to generate (default: 1)',
        type: 'integer',
        defaultValue: 1,
        default: 1,
        minValue: 1,
        maxValue: 10,
        min: 1,
        max: 10,
        step: 1
      },
      {
        name: 'timeout',
        labelKey: 'params.timeout.label',
        descriptionKey: 'params.timeout.description_openai',
        description: 'Client timeout in milliseconds (OpenAI SDK setting)',
        type: 'integer',
        defaultValue: 60000,
        default: 60000,
        minValue: 1000,
        maxValue: 600000,
        min: 1000,
        max: 600000,
        step: 1000,
        unit: 'ms'
      }
    ]
  }

  /**
   * Get default parameter values
   * Returns an empty object so the server uses its official defaults, avoiding wrong client-side defaults affecting results
   */
  protected getDefaultParameterValues(_modelId: string): Record<string, unknown> {
    return {}
  }

  // ===== Error detection helper methods =====

  /**
   * Detect whether this is a CORS error
   * Logic migrated from service.ts.backup (L1048-1094)
   *
   * Description:
   * - Distinguishes CORS errors from ordinary network errors
   * - Detection only happens in browser environments
   * - Identified by comparing the URL origin and error characteristics
   *
   * @param error The caught error object
   * @param baseURL The API baseURL
   * @returns true means a CORS error, false means another kind of error
   */
  private detectCrossOriginError(error: any, baseURL: string): boolean {
    // CORS issues do not exist outside browser environments
    if (typeof window === 'undefined') {
      return false
    }

    try {
      const apiUrl = new URL(baseURL)
      const currentUrl = new URL(window.location.href)

      const errorString = error.toString()

      // Only treat it as CORS when the origins differ and there is no obvious DNS/connection error
      const isDifferentOrigin = apiUrl.origin !== currentUrl.origin
      const hasNetworkError =
        errorString.includes('ERR_NAME_NOT_RESOLVED') ||
        errorString.includes('ERR_CONNECTION_REFUSED') ||
        errorString.includes('ERR_NETWORK_CHANGED') ||
        errorString.includes('ERR_INTERNET_DISCONNECTED') ||
        errorString.includes('ERR_EMPTY_RESPONSE')

      return isDifferentOrigin && !hasNetworkError
    } catch (urlError) {
      // URL parsing failed; treat it as an ordinary connection error
      console.warn('[OpenAIAdapter] Failed to parse URL for CORS detection:', urlError)
      return false
    }
  }

  /**
   * In browser environments, cross-origin requests are forced to use credentials='omit'
   * This avoids some compatible endpoints being blocked by the browser when they return "Access-Control-Allow-Origin: *".
   */
  private shouldForceCrossOriginCredentialOmit(input: RequestInfo | URL): boolean {
    if (typeof window === 'undefined') {
      return false
    }

    try {
      const requestURL = this.resolveRequestURL(input, window.location.href)
      return requestURL.origin !== window.location.origin
    } catch (error) {
      console.warn('[OpenAIAdapter] Failed to resolve request URL for credentials mode:', error)
      return false
    }
  }

  private resolveRequestURL(input: RequestInfo | URL, baseHref: string): URL {
    if (typeof input === 'string') {
      return new URL(input, baseHref)
    }

    if (input instanceof URL) {
      return new URL(input.toString(), baseHref)
    }

    if (typeof Request !== 'undefined' && input instanceof Request) {
      return new URL(input.url, baseHref)
    }

    return new URL(String(input), baseHref)
  }

  private sanitizeCrossOriginHeaders(headers?: HeadersInit): Headers | undefined {
    if (!headers) {
      return undefined
    }

    const source = new Headers(headers)
    const sanitized = new Headers()

    source.forEach((value, key) => {
      const normalizedKey = key.toLowerCase()

      // Trim the diagnostic headers injected by the SDK to reduce the chance of CORS preflight failures with third-party gateways.
      if (
        normalizedKey.startsWith('x-stainless-') ||
        normalizedKey === 'user-agent' ||
        normalizedKey === 'content-length'
      ) {
        return
      }

      sanitized.set(key, value)
    })

    return sanitized
  }

  // ===== SDK instance creation (migrated from service.ts) =====

  /**
   * Create an OpenAI SDK instance
   * Migrated from the getOpenAIInstance method in service.ts
   *
   * @param config Model config
   * @param isStream Whether this is a streaming request
   * @returns OpenAI SDK instance
   */
  // NOTE: protected so OpenAI-compatible providers (e.g. Ollama) can tweak auth/baseURL
  // without re-implementing the whole chat/stream/tool plumbing.
  protected createOpenAIInstance(config: TextModelConfig, isStream: boolean = false): OpenAI {
    const apiKey = config.connectionConfig.apiKey || ''

    // Handle the baseURL; strip it if it ends with '/chat/completions'
    let processedBaseURL = config.connectionConfig.baseURL || this.getProvider().defaultBaseURL
    if (processedBaseURL?.endsWith('/chat/completions')) {
      processedBaseURL = processedBaseURL.slice(0, -'/chat/completions'.length)
    }

    // Create the OpenAI instance config
    const defaultTimeout = isStream ? 90000 : 60000
    const timeout =
      config.paramOverrides?.timeout !== undefined
        ? (config.paramOverrides.timeout as number)
        : defaultTimeout

    const sdkConfig: any = {
      apiKey: apiKey,
      baseURL: processedBaseURL,
      timeout: timeout,
      maxRetries: isStream ? 2 : 3
    }

    // Browser environment detection
    if (typeof window !== 'undefined') {
      sdkConfig.dangerouslyAllowBrowser = true

      const runtimeFetch =
        typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : undefined

      if (runtimeFetch) {
        sdkConfig.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
          if (!this.shouldForceCrossOriginCredentialOmit(input)) {
            return runtimeFetch(input, init)
          }

          const sanitizedHeaders = this.sanitizeCrossOriginHeaders(init?.headers)

          return runtimeFetch(input, {
            ...(init ?? {}),
            ...(sanitizedHeaders ? { headers: sanitizedHeaders } : {}),
            mode: init?.mode ?? 'cors',
            credentials: 'omit'
          })
        }
      }

      console.log('[OpenAIAdapter] Browser environment detected. Setting dangerouslyAllowBrowser=true.')
    }

    const instance = new OpenAI(sdkConfig)

    return instance
  }

  // ===== Core method implementations =====

  /**
   * Send a message (structured format)
   * Migrated from sendOpenAIMessageStructured in service.ts (L126-186)
   *
   * @param messages Message array
   * @param config Model config
   * @returns LLM response
   * @throws The original SDK error (full stack preserved)
   */
  protected async doSendMessage(messages: Message[], config: TextModelConfig): Promise<LLMResponse> {
    const openai = this.createOpenAIInstance(config, false)

    // Format the messages
    const formattedMessages = messages.map((msg) => ({
      role: msg.role,
      content: msg.content
    }))

    // Extract parameters from paramOverrides, excluding special fields
    const {
      timeout, // Already handled in createOpenAIInstance
      model: _paramModel, // Avoid overriding the main model
      messages: _paramMessages, // Avoid overriding the main messages
      ...restParams
    } = (config.paramOverrides || {}) as any

    const completionConfig: any = {
      model: config.modelMeta.id,
      messages: formattedMessages,
      ...restParams // Spread the other parameters
    }

    try {
      const response: any = await openai.chat.completions.create(completionConfig)

      // Handle raw SSE string responses (some APIs return unparsed SSE format)
      if (typeof response === 'string') {
        return this.parseSSEResponse(response, config.modelMeta.id)
      }

      // Detect streaming responses (some APIs always return a streaming response)
      if (this.isStreamResponse(response)) {
        return await this.consumeStreamResponse(response as AsyncIterable<any>, config.modelMeta.id)
      }

      // Handle reasoning_content and regular content in the response
      if (!response.choices || response.choices.length === 0) {
        throw new APIError('API returned invalid response: choices is empty or missing')
      }

      const choice = response.choices[0]
      if (!choice?.message) {
        throw new APIError('No valid response received')
      }

      let content = choice.message.content || ''
      let reasoning = ''

      // Handle reasoning content (if present)
      // Providers such as SiliconFlow provide a reasoning_content field alongside choice.message
      if ((choice.message as any).reasoning_content) {
        reasoning = (choice.message as any).reasoning_content
      } else {
        // Detect and separate think tags in the content
        const processed = this.processThinkTags(content)
        content = processed.content
        reasoning = processed.reasoning || ''
      }

      const result: LLMResponse = {
        content: content,
        reasoning: reasoning || undefined,
        metadata: {
          model: config.modelMeta.id,
          finishReason: choice.finish_reason || undefined
        }
      }

      return result
    } catch (error) {
      console.error('[OpenAIAdapter] API call failed:', error)
      throw error // Preserve the original error stack without wrapping
    }
  }

  /**
   * Parse a raw SSE string response
   * Some OpenAI-compatible APIs return unparsed SSE format strings
   */
  private parseSSEResponse(sseString: string, modelId: string): LLMResponse {
    let accumulatedContent = ''
    let accumulatedReasoning = ''
    let finishReason: string | undefined

    // Split the SSE data by line
    const lines = sseString.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()

      // Skip empty lines
      if (!trimmed) {
        continue
      }

      // Skip the [DONE] marker (compatible with both data: [DONE] and data:[DONE])
      if (trimmed === 'data: [DONE]' || trimmed === 'data:[DONE]') {
        continue
      }

      // Parse lines with the data: prefix (compatible with or without a space: data: or data:)
      if (trimmed.startsWith('data:')) {
        const jsonStr = trimmed.slice(5).trimStart() // Remove the 'data:' prefix and any leading space
        if (!jsonStr) {
          continue
        }
        try {
          const chunk = JSON.parse(jsonStr)

          // Handle reasoning content
          const reasoningContent = chunk.choices?.[0]?.delta?.reasoning_content || ''
          if (reasoningContent) {
            accumulatedReasoning += reasoningContent
          }

          // Handle main content
          const content = chunk.choices?.[0]?.delta?.content || ''
          if (content) {
            accumulatedContent += content
          }

          // Record the finish reason
          if (chunk.choices?.[0]?.finish_reason && chunk.choices[0].finish_reason !== '') {
            finishReason = chunk.choices[0].finish_reason
          }
        } catch (e) {
          // Ignore chunks that cannot be parsed
        }
      }
    }

    // Fallback: if SSE parsing yields no content, try parsing directly as JSON
    if (!accumulatedContent && !accumulatedReasoning) {
      try {
        const fallbackJson = JSON.parse(sseString)
        // Try to extract the standard OpenAI response format
        const fallbackContent = fallbackJson.choices?.[0]?.message?.content || ''
        const fallbackReasoning = fallbackJson.choices?.[0]?.message?.reasoning_content || ''
        if (fallbackContent || fallbackReasoning) {
          const processed = this.processThinkTags(fallbackContent)
          return {
            content: processed.content,
            reasoning: fallbackReasoning || processed.reasoning || undefined,
            metadata: {
              model: modelId,
              finishReason: fallbackJson.choices?.[0]?.finish_reason
            }
          }
        }
      } catch {
        // JSON parsing failed; continue to throw the error
      }
      // Both SSE and JSON parsing failed; throw a clear error
      throw new APIError(
        `SSE response parsing failed: unable to extract any content from response. First 200 chars: ${sseString.slice(0, 200)}`
      )
    }

    // Handle think tags
    const processed = this.processThinkTags(accumulatedContent)

    return {
      content: processed.content,
      reasoning: accumulatedReasoning || processed.reasoning || undefined,
      metadata: {
        model: modelId,
        finishReason
      }
    }
  }

  /**
   * Detect whether the response is a streaming response
   * Some OpenAI-compatible APIs always return a streaming response
   */
  private isStreamResponse(response: any): boolean {
    // First check whether it is a standard non-streaming response format
    // If the response contains a choices array and the first choice has a message property, it is a non-streaming response
    if (response && response.choices && Array.isArray(response.choices) && response.choices.length > 0) {
      const firstChoice = response.choices[0]
      // Non-streaming responses have a message property; streaming responses have a delta property
      if (firstChoice && firstChoice.message !== undefined) {
        return false
      }
    }

    // Detect an async iterator (a characteristic of streaming responses)
    if (response && typeof response[Symbol.asyncIterator] === 'function') {
      return true
    }

    return false
  }

  /**
   * Consume a streaming response and aggregate it into a complete response
   * Used to handle APIs that always return a streaming response
   */
  private async consumeStreamResponse(stream: AsyncIterable<any>, modelId: string): Promise<LLMResponse> {
    let accumulatedContent = ''
    let accumulatedReasoning = ''
    let finishReason: string | undefined

    for await (const chunk of stream) {
      // Handle reasoning content
      const reasoningContent = chunk.choices?.[0]?.delta?.reasoning_content || ''
      if (reasoningContent) {
        accumulatedReasoning += reasoningContent
      }

      // Handle main content
      const content = chunk.choices?.[0]?.delta?.content || ''
      if (content) {
        accumulatedContent += content
      }

      // Record the finish reason
      if (chunk.choices?.[0]?.finish_reason) {
        finishReason = chunk.choices[0].finish_reason
      }
    }

    // Handle think tags
    const processed = this.processThinkTags(accumulatedContent)

    return {
      content: processed.content,
      reasoning: accumulatedReasoning || processed.reasoning || undefined,
      metadata: {
        model: modelId,
        finishReason
      }
    }
  }

  /**
   * Send a streaming message
   * Migrated from streamOpenAIMessage in service.ts (L504-585)
   *
   * @param messages Message array
   * @param config Model config
   * @param callbacks Streaming response callbacks
   * @throws The original SDK error (full stack preserved)
   */
  protected async doSendMessageStream(
    messages: Message[],
    config: TextModelConfig,
    callbacks: StreamHandlers
  ): Promise<void> {
    try {
      // Get the streaming OpenAI instance
      const openai = this.createOpenAIInstance(config, true)

      const formattedMessages = messages.map((msg) => ({
        role: msg.role,
        content: msg.content
      }))

      const {
        timeout, // Already handled in createOpenAIInstance
        model: _paramModel, // Avoid overriding the main model
        messages: _paramMessages, // Avoid overriding the main messages
        stream: _paramStream, // Avoid overriding the stream flag
        ...restParams
      } = (config.paramOverrides || {}) as any

      const completionConfig: any = {
        model: config.modelMeta.id,
        messages: formattedMessages,
        stream: true, // Streaming flag
        ...restParams // User-defined parameters
      }

      // Use the streaming response directly
      const stream = await openai.chat.completions.create(completionConfig)

      // Accumulate content
      let accumulatedReasoning = ''
      let accumulatedContent = ''

      // Track the think tag state
      const thinkState = { isInThinkMode: false, buffer: '' }

      for await (const chunk of stream as any) {
        // Handle reasoning content (providers such as SiliconFlow supply reasoning_content in the delta)
        const reasoningContent = chunk.choices[0]?.delta?.reasoning_content || ''
        if (reasoningContent) {
          accumulatedReasoning += reasoningContent

          // If there is a reasoning callback, send the reasoning content
          if (callbacks.onReasoningToken) {
            callbacks.onReasoningToken(reasoningContent)
          }
        }

        // Handle main content
        const content = chunk.choices[0]?.delta?.content || ''
        if (content) {
          accumulatedContent += content

          // Use streaming think tag processing
          this.processStreamContentWithThinkTags(content, callbacks, thinkState)
        }
      }

      // Build the complete response
      const response: LLMResponse = {
        content: accumulatedContent,
        reasoning: accumulatedReasoning || undefined,
        metadata: {
          model: config.modelMeta.id
        }
      }

      callbacks.onComplete(response)
    } catch (error) {
      console.error('[OpenAIAdapter] Stream error:', error)
      callbacks.onError(error instanceof Error ? error : new Error(String(error)))
      throw error // Preserve the original error stack
    }
  }

  /**
   * Send a streaming message with tool call support
   * Migrated from streamOpenAIMessageWithTools in service.ts (L591-702)
   *
   * @param messages Message array
   * @param config Model config
   * @param tools Array of tool definitions
   * @param callbacks Streaming response callbacks
   * @throws The original SDK error (full stack preserved)
   */
  public async sendMessageStreamWithTools(
    messages: Message[],
    config: TextModelConfig,
    tools: ToolDefinition[],
    callbacks: StreamHandlers
  ): Promise<void> {
    try {
      // Get the streaming OpenAI instance
      const openai = this.createOpenAIInstance(config, true)

      const formattedMessages = messages.map((msg) => ({
        role: msg.role,
        content: msg.content
      }))

      const {
        timeout,
        model: _paramModel,
        messages: _paramMessages,
        stream: _paramStream,
        tools: _paramTools,
        ...restParams
      } = (config.paramOverrides || {}) as any

      const completionConfig: any = {
        model: config.modelMeta.id,
        messages: formattedMessages,
        tools: tools,
        tool_choice: 'auto',
        stream: true,
        ...restParams
      }

      const stream = await openai.chat.completions.create(completionConfig)

      let accumulatedReasoning = ''
      let accumulatedContent = ''
      const toolCalls: any[] = []
      const thinkState = { isInThinkMode: false, buffer: '' }

      for await (const chunk of stream as any) {
        // Handle reasoning content
        const reasoningContent = chunk.choices[0]?.delta?.reasoning_content || ''
        if (reasoningContent) {
          accumulatedReasoning += reasoningContent
          if (callbacks.onReasoningToken) {
            callbacks.onReasoningToken(reasoningContent)
          }
        }

        // Handle tool calls
        const toolCallDeltas = chunk.choices[0]?.delta?.tool_calls
        if (toolCallDeltas) {
          for (const toolCallDelta of toolCallDeltas) {
            if (toolCallDelta.index !== undefined) {
              while (toolCalls.length <= toolCallDelta.index) {
                toolCalls.push({
                  id: '',
                  type: 'function' as const,
                  function: { name: '', arguments: '' }
                })
              }

              const currentToolCall = toolCalls[toolCallDelta.index]

              if (toolCallDelta.id) currentToolCall.id = toolCallDelta.id
              if (toolCallDelta.type) currentToolCall.type = toolCallDelta.type
              if (toolCallDelta.function) {
                if (toolCallDelta.function.name) {
                  currentToolCall.function.name += toolCallDelta.function.name
                }
                if (toolCallDelta.function.arguments) {
                  currentToolCall.function.arguments += toolCallDelta.function.arguments
                }

                // Notify the callback when the tool call is complete
                if (
                  currentToolCall.id &&
                  currentToolCall.function.name &&
                  toolCallDelta.function.arguments &&
                  callbacks.onToolCall
                ) {
                  try {
                    JSON.parse(currentToolCall.function.arguments)
                    callbacks.onToolCall(currentToolCall)
                  } catch {
                    // The JSON is not complete yet
                  }
                }
              }
            }
          }
        }

        // Handle main content
        const content = chunk.choices[0]?.delta?.content || ''
        if (content) {
          accumulatedContent += content
          this.processStreamContentWithThinkTags(content, callbacks, thinkState)
        }
      }

      const response: LLMResponse = {
        content: accumulatedContent,
        reasoning: accumulatedReasoning || undefined,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        metadata: { model: config.modelMeta.id }
      }

      callbacks.onComplete(response)
    } catch (error) {
      console.error('[OpenAIAdapter] Stream with tools error:', error)
      callbacks.onError(error instanceof Error ? error : new Error(String(error)))
      throw error // Preserve the original error stack
    }
  }
}
