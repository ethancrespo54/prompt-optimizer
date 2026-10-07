import { GoogleGenAI } from '@google/genai'
import { AbstractTextProviderAdapter } from './abstract-adapter'
import type {
  TextProvider,
  TextModel,
  TextModelConfig,
  Message,
  LLMResponse,
  StreamHandlers,
  ParameterDefinition,
  ToolDefinition,
  ToolCall
} from '../types'

// Define the types required by the new SDK (the SDK may provide them via its main export)
type Content = any
type GenerateContentConfig = any
type FunctionDeclaration = any
type Tool = any
type FunctionCall = any

interface ModelOverride {
  id: string
  name: string
  description: string
  capabilities?: Partial<TextModel['capabilities']>
  defaultParameterValues?: Record<string, unknown>
}

/**
 * Gemini static model definitions
 */
const GEMINI_STATIC_MODELS: ModelOverride[] = [
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: 'Latest Gemini 2.5 Flash model, fast and efficient',
    capabilities: {
      supportsTools: true,
      supportsReasoning: false,
      maxContextLength: 1000000
    }
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    description: 'Gemini 2.5 Pro model with enhanced reasoning capabilities',
    capabilities: {
      supportsTools: true,
      supportsReasoning: true,
      maxContextLength: 1000000
    }
  },
  {
    id: 'gemini-3-pro-preview',
    name: 'Gemini 3 Pro Preview',
    description: 'Preview version of Gemini 3 Pro with cutting-edge capabilities',
    capabilities: {
      supportsTools: true,
      supportsReasoning: true,
      maxContextLength: 1000000
    }
  }
]

/**
 * Google Gemini adapter implementation
 * Uses the new @google/genai SDK (the unified Google Gen AI SDK)
 *
 * Responsibilities:
 * - Encapsulate @google/genai SDK call logic
 * - Handle system messages (systemInstruction)
 * - Format history messages (Content format)
 * - Support dynamic model list fetching (models.list API)
 * - Support tool calls (Function Calling)
 * - Support the thinking feature (Thinking with thinkingConfig)
 * - Handle baseURL normalization (setDefaultBaseUrls)
 * - Preserve the original SDK error stack
 */
export class GeminiAdapter extends AbstractTextProviderAdapter {
  // ===== Provider metadata =====

  /**
   * Get Provider metadata
   */
  public getProvider(): TextProvider {
    return {
      id: 'gemini',
      name: 'Google Gemini',
      description: 'Google Generative AI models',
      requiresApiKey: true,
      defaultBaseURL: 'https://generativelanguage.googleapis.com',
      supportsDynamicModels: true, // The new SDK supports dynamic model fetching
      apiKeyUrl: 'https://aistudio.google.com/apikey',
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
   * Get the static model list (Gemini series)
   */
  public getModels(): TextModel[] {
    return GEMINI_STATIC_MODELS.map((definition) => {
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
   * Dynamically fetch the model list (using the models.list API of the new SDK)
   */
  public async getModelsAsync(config: TextModelConfig): Promise<TextModel[]> {
    try {
      const apiKey = config.connectionConfig.apiKey || ''

      const customBaseURL = config.connectionConfig.baseURL
      const genAI = new GoogleGenAI(
        customBaseURL
          ? {
              apiKey,
              httpOptions: {
                baseUrl: customBaseURL
              }
            }
          : { apiKey }
      )

      const modelsPager = await genAI.models.list({
        config: {
          pageSize: 100 // Fetch more models
        }
      })

      const dynamicModels: TextModel[] = []
      const providerId = 'gemini'

      for await (const model of modelsPager) {
        // Only include models that support generateContent
        // Note: the Model type of the new SDK may not include supportedGenerationMethods, so all models are included for now
        dynamicModels.push({
          id: model.name?.replace('models/', '') || model.name || '', // Remove the 'models/' prefix
          name: model.displayName || model.name || '',
          description: model.description || '',
          providerId,
          capabilities: {
            supportsTools: true,
            supportsReasoning: false,
            maxContextLength: model.inputTokenLimit || 1000000
          },
          parameterDefinitions: this.getParameterDefinitions(model.name || ''),
          defaultParameterValues: this.getDefaultParameterValues(model.name || '')
        })
      }

      // If dynamic fetching fails, return the static list
      return dynamicModels.length > 0 ? dynamicModels : this.getModels()
    } catch (error) {
      console.error('[GeminiAdapter] Failed to fetch models dynamically, falling back to static list:', error)
      return this.getModels()
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
        description: 'Sampling temperature (0-2)',
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
        name: 'topP',
        labelKey: 'params.top_p.label',
        descriptionKey: 'params.top_p.description',
        description: 'Nucleus sampling parameter',
        type: 'number',
        defaultValue: 0.95,
        default: 0.95,
        minValue: 0,
        maxValue: 1,
        min: 0,
        max: 1,
        step: 0.01
      },
      {
        name: 'topK',
        labelKey: 'params.top_k.label',
        descriptionKey: 'params.top_k.description',
        description: 'Top-k sampling parameter',
        type: 'integer',
        defaultValue: 1,
        default: 1,
        minValue: 1,
        min: 1,
        step: 1
      },
      {
        name: 'maxOutputTokens',
        labelKey: 'params.maxOutputTokens.label',
        descriptionKey: 'params.maxOutputTokens.description',
        description: 'Maximum tokens to generate',
        type: 'integer',
        defaultValue: 8192,
        default: 8192,
        minValue: 1,
        min: 1,
        unitKey: 'params.tokens.unit',
        step: 1
      },
      {
        name: 'candidateCount',
        labelKey: 'params.candidateCount.label',
        descriptionKey: 'params.candidateCount.description',
        description: 'Number of response candidates',
        type: 'integer',
        defaultValue: 1,
        default: 1,
        minValue: 1,
        maxValue: 8,
        min: 1,
        max: 8,
        step: 1
      },
      {
        name: 'stopSequences',
        labelKey: 'params.stopSequences.label',
        descriptionKey: 'params.stopSequences.description',
        description: 'Stop sequences for generation',
        type: 'string',
        defaultValue: [],
        tags: ['string-array']
      },
      {
        name: 'thinkingBudget',
        labelKey: 'params.thinkingBudget.label',
        descriptionKey: 'params.thinkingBudget.description',
        description: 'Thinking budget in tokens (Gemini 2.5+). Set to 0 to disable thinking.',
        type: 'number',
        defaultValue: 0,
        default: 0,
        minValue: 0,
        maxValue: 8192,
        min: 0,
        max: 8192,
        unitKey: 'params.tokens.unit',
        step: 1
      },
      {
        name: 'includeThoughts',
        labelKey: 'params.includeThoughts.label',
        descriptionKey: 'params.includeThoughts.description',
        description: 'Include thinking process in response (Gemini 2.5+)',
        type: 'boolean',
        defaultValue: false
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

  // ===== SDK instance creation and config building =====

  /**
   * Create a GoogleGenAI instance
   *
   * @param config Model config
   * @returns GoogleGenAI instance
   */
  private createClient(config: TextModelConfig): GoogleGenAI {
    const apiKey = config.connectionConfig.apiKey || ''

    const customBaseURL = config.connectionConfig.baseURL

    return new GoogleGenAI(
      customBaseURL
        ? {
            apiKey,
            httpOptions: {
              baseUrl: customBaseURL
            }
          }
        : { apiKey }
    )
  }

  /**
   * Build the GenerateContentConfig
   * Migrated from the old buildGeminiGenerationConfig and adapted to the new API
   *
   * @param params Parameters object
   * @param systemInstruction System instruction (optional)
   * @returns GenerateContentConfig
   */
  private buildGenerationConfig(
    params: Record<string, any> = {},
    systemInstruction?: string
  ): GenerateContentConfig {
    const {
      temperature,
      maxOutputTokens,
      topP,
      topK,
      candidateCount,
      stopSequences,
      thinkingBudget,      // Thinking budget (number of tokens)
      includeThoughts,      // Whether to include the thinking process
      ...otherParams
    } = params

    const config: GenerateContentConfig = {}

    // Add the system instruction
    if (systemInstruction) {
      config.systemInstruction = systemInstruction
    }

    // Add known parameters
    if (temperature !== undefined) {
      config.temperature = temperature
    }
    if (maxOutputTokens !== undefined) {
      config.maxOutputTokens = maxOutputTokens
    }
    if (topP !== undefined) {
      config.topP = topP
    }
    if (topK !== undefined) {
      config.topK = topK
    }
    if (candidateCount !== undefined) {
      config.candidateCount = candidateCount
    }
    if (stopSequences !== undefined && Array.isArray(stopSequences)) {
      config.stopSequences = stopSequences
    }

    // Add the thinking config (supported by Gemini 2.5+)
    if (thinkingBudget !== undefined || includeThoughts !== undefined) {
      ;(config as any).thinkingConfig = {}

      if (thinkingBudget !== undefined) {
        ;(config as any).thinkingConfig.thinkingBudget = thinkingBudget
      }

      if (includeThoughts !== undefined) {
        ;(config as any).thinkingConfig.includeThoughts = includeThoughts
      }
    }

    // Add other parameters (excluding those that clearly do not belong in generationConfig)
    for (const [key, value] of Object.entries(otherParams)) {
      if (!['timeout', 'model', 'messages', 'stream'].includes(key)) {
        ;(config as any)[key] = value
      }
    }

    return config
  }

  /**
   * Convert tool definitions to the Gemini format
   * Converts the standard ToolDefinition to the Tool format required by the Gemini SDK
   *
   * @param tools Array of tool definitions
   * @returns Array of tools in Gemini format
   */
  private convertToolsToGemini(tools: ToolDefinition[]): Tool[] {
    if (!tools || tools.length === 0) {
      return []
    }

    const functionDeclarations: FunctionDeclaration[] = tools.map((tool) => ({
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters
    }))

    return [{ functionDeclarations }]
  }

  /**
   * Convert Gemini's FunctionCall to the standard ToolCall format
   *
   * @param functionCalls Array of function calls returned by Gemini
   * @returns Array of tool calls in the standard format
   */
  private convertGeminiFunctionCallsToToolCalls(functionCalls: FunctionCall[]): ToolCall[] {
    if (!functionCalls || functionCalls.length === 0) {
      return []
    }

    return functionCalls.map((fc) => ({
      id: fc.id || `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'function' as const,
      function: {
        name: fc.name || '',
        arguments: JSON.stringify(fc.args || {})
      }
    }))
  }

  /**
   * Format messages into the new SDK's Content format
   * The new SDK uses the standard Content[] format and no longer needs to distinguish history from the last message
   *
   * @param messages Message array
   * @returns Messages in Content[] format
   */
  private formatMessages(messages: Message[]): Content[] {
    const formattedContents: Content[] = []

    for (const msg of messages) {
      if (msg.role === 'user') {
        formattedContents.push({
          role: 'user',
          parts: [{ text: msg.content }]
        })
      } else if (msg.role === 'assistant') {
        formattedContents.push({
          role: 'model', // Gemini uses 'model' rather than 'assistant'
          parts: [{ text: msg.content }]
        })
      }
      // Skip system messages; they are handled in systemInstruction
    }

    return formattedContents
  }

  // ===== Core method implementations =====

  /**
   * Send a message (structured format)
   * Uses the models.generateContent API of the new SDK
   *
   * @param messages Message array
   * @param config Model config
   * @returns LLM response
   * @throws The original SDK error (full stack preserved)
   */
  protected async doSendMessage(messages: Message[], config: TextModelConfig): Promise<LLMResponse> {
    // Extract system messages
    const systemMessages = messages.filter((msg) => msg.role === 'system')
    const systemInstruction =
      systemMessages.length > 0 ? systemMessages.map((msg) => msg.content).join('\n') : ''

    // Filter out user and assistant messages
    const conversationMessages = messages.filter((msg) => msg.role !== 'system')

    // If there are no conversation messages, return an empty response
    if (conversationMessages.length === 0) {
      return {
        content: '',
        metadata: {
          model: config.modelMeta.id
        }
      }
    }

    try {
      const client = this.createClient(config)

      // Build the config (including the system instruction)
      const generationConfig = this.buildGenerationConfig(
        config.paramOverrides || {},
        systemInstruction
      )

      // Format the messages
      const contents = this.formatMessages(conversationMessages)

      // Call the new API
      const response = await client.models.generateContent({
        model: config.modelMeta.id,
        contents,
        config: generationConfig
      })

      // Extract the text content and thinking content
      let textContent = ''
      let reasoning: string | undefined

      // Prefer the response.text property recommended by the new SDK
      if ((response as any).text) {
        textContent = (response as any).text
      } else if (response.candidates?.[0]?.content?.parts) {
        // Fall back to extracting from parts (for the old response format or special cases)
        const contentParts: string[] = []
        const reasoningParts: string[] = []

        for (const part of response.candidates[0].content.parts) {
          // Extract the text content
          if ((part as any).text) {
            const text = (part as any).text
            // If this part is thinking, add it to reasoning; otherwise add it to content
            if ((part as any).thought) {
              reasoningParts.push(text)
            } else {
              contentParts.push(text)
            }
          }
        }

        textContent = contentParts.join('')
        if (reasoningParts.length > 0) {
          reasoning = reasoningParts.join('')
        }
      } else if (response.candidates?.[0]?.content) {
        // Finally try accessing the content field directly
        const content = response.candidates[0].content
        if (typeof content === 'string') {
          textContent = content
        } else if ((content as any).text) {
          textContent = (content as any).text
        }
      }

      return {
        content: textContent,
        reasoning,
        metadata: {
          model: config.modelMeta.id,
          finishReason: response.candidates?.[0]?.finishReason
        }
      }
    } catch (error) {
      console.error('[GeminiAdapter] API call failed:', error)
      throw error // Preserve the original error stack
    }
  }

  /**
   * Send a streaming message
   * Uses the models.generateContentStream API of the new SDK
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
    // Extract system messages
    const systemMessages = messages.filter((msg) => msg.role === 'system')
    const systemInstruction =
      systemMessages.length > 0 ? systemMessages.map((msg) => msg.content).join('\n') : ''

    // Filter out user and assistant messages
    const conversationMessages = messages.filter((msg) => msg.role !== 'system')

    // If there are no conversation messages, send an empty response
    if (conversationMessages.length === 0) {
      const response: LLMResponse = {
        content: '',
        metadata: {
          model: config.modelMeta.id
        }
      }

      callbacks.onComplete(response)
      return
    }

    try {
      const client = this.createClient(config)

      // Build the config (including the system instruction)
      const generationConfig = this.buildGenerationConfig(
        config.paramOverrides || {},
        systemInstruction
      )

      // Format the messages
      const contents = this.formatMessages(conversationMessages)

      // Call the new streaming API
      const responseStream = await client.models.generateContentStream({
        model: config.modelMeta.id,
        contents,
        config: generationConfig
      })

      let accumulatedContent = ''
      let accumulatedReasoning = ''

      // Iterate over the streaming response
      for await (const chunk of responseStream) {
        let emittedContentToken = false

        // Extract the text content from parts
        if (chunk.candidates?.[0]?.content?.parts) {
          for (const part of chunk.candidates[0].content.parts) {
            const partText = (part as any).text
            if (!partText) {
              continue
            }

            if ((part as any).thought) {
              // This is thinking content
              accumulatedReasoning += partText
              if (callbacks.onReasoningToken) {
                callbacks.onReasoningToken(partText)
              }
            } else {
              // This is regular content
              emittedContentToken = true
              accumulatedContent += partText
              callbacks.onToken(partText)
            }
          }
        }

        // If the SDK only provides chunk.text, fall back to that field
        const chunkText = (chunk as any).text
        if (chunkText && !emittedContentToken) {
          accumulatedContent += chunkText
          callbacks.onToken(chunkText)
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
      console.error('[GeminiAdapter] Stream error:', error)
      callbacks.onError(error instanceof Error ? error : new Error(String(error)))
      throw error // Preserve the original error stack
    }
  }

  /**
   * Send a streaming message with tool calls
   * Uses the tool calling feature of the new SDK
   *
   * @param messages Message array
   * @param config Model config
   * @param tools Array of tool definitions
   * @param callbacks Streaming response callbacks
   * @throws The original SDK error (full stack preserved)
   */
  protected async doSendMessageStreamWithTools(
    messages: Message[],
    config: TextModelConfig,
    tools: ToolDefinition[],
    callbacks: StreamHandlers
  ): Promise<void> {
    // Extract system messages
    const systemMessages = messages.filter((msg) => msg.role === 'system')
    const systemInstruction =
      systemMessages.length > 0 ? systemMessages.map((msg) => msg.content).join('\n') : ''

    // Filter out user and assistant messages
    const conversationMessages = messages.filter((msg) => msg.role !== 'system')

    if (conversationMessages.length === 0) {
      const response: LLMResponse = {
        content: '',
        metadata: { model: config.modelMeta.id }
      }
      callbacks.onComplete(response)
      return
    }

    try {
      const client = this.createClient(config)

      // Build the config (including the system instruction and tools)
      const generationConfig = this.buildGenerationConfig(
        config.paramOverrides || {},
        systemInstruction
      )

      // Add the tool config
      const geminiTools = this.convertToolsToGemini(tools)
      if (geminiTools.length > 0) {
        ;(generationConfig as any).tools = geminiTools
      }

      // Format the messages
      const contents = this.formatMessages(conversationMessages)

      // Call the new streaming API
      const responseStream = await client.models.generateContentStream({
        model: config.modelMeta.id,
        contents,
        config: generationConfig
      })

      let accumulatedContent = ''
      let accumulatedReasoning = ''
      const toolCalls: ToolCall[] = []

      // Iterate over the streaming response
      for await (const chunk of responseStream) {
        const text = chunk.text
        if (text) {
          accumulatedContent += text
          callbacks.onToken(text)
        }

        // Check for function calls
        if (chunk.functionCalls && chunk.functionCalls.length > 0) {
          const convertedCalls = this.convertGeminiFunctionCallsToToolCalls(chunk.functionCalls)
          toolCalls.push(...convertedCalls)

          // Notify about each tool call
          if (callbacks.onToolCall) {
            convertedCalls.forEach((toolCall) => callbacks.onToolCall!(toolCall))
          }
        }

        if (chunk.candidates?.[0]?.content?.parts) {
          for (const part of chunk.candidates[0].content.parts) {
            if ((part as any).thought) {
              const rawThought = (part as any).text ?? (part as any).thought
              if (rawThought !== undefined) {
                const thoughtStr = typeof rawThought === 'string'
                  ? rawThought
                  : JSON.stringify(rawThought)

                accumulatedReasoning += thoughtStr

                if (callbacks.onReasoningToken) {
                  callbacks.onReasoningToken(thoughtStr)
                }
              }
            }
          }
        }
      }

      // Build the complete response
      const response: LLMResponse = {
        content: accumulatedContent,
        reasoning: accumulatedReasoning || undefined,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        metadata: {
          model: config.modelMeta.id
        }
      }

      callbacks.onComplete(response)
    } catch (error) {
      console.error('[GeminiAdapter] Stream with tools error:', error)
      callbacks.onError(error instanceof Error ? error : new Error(String(error)))
      throw error
    }
  }
}
