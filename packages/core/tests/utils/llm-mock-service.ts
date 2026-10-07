/**
 * LLM Mock service
 *
 * Integrates MSW (Mock Service Worker) to provide LLM API mocking:
 * - Intercepts real fetch/XMLHttpRequest calls
 * - Returns pre-recorded responses based on VCR fixtures
 * - Simulates streaming responses
 * - Simulates error scenarios
 *
 * @module tests/utils/llm-mock-service
 */

import { http, HttpResponse, delay } from 'msw'
import type { HttpHandler } from 'msw'
import { getVCR, type LLMRequest, type LLMResponse } from './vcr.js'
import { createStreamFromFixture } from './stream-simulator.js'
import { createHash } from 'crypto'

/**
 * LLM provider config
 */
interface LLMProviderConfig {
  baseURL: string
  endpoints: {
    chat: string
    completions?: string
  }
  headers?: Record<string, string>
}

/**
 * Supported LLM providers
 */
const LLM_PROVIDERS: Record<string, LLMProviderConfig> = {
  openai: {
    baseURL: 'https://api.openai.com/v1',
    endpoints: {
      chat: '/chat/completions',
      completions: '/completions'
    }
  },
  deepseek: {
    baseURL: 'https://api.deepseek.com/v1',
    endpoints: {
      chat: '/chat/completions'
    }
  },
  gemini: {
    baseURL: 'https://generativelanguage.googleapis.com/v1beta',
    endpoints: {
      chat: '/models/gemini-pro:generateContent'
    }
  },
  anthropic: {
    baseURL: 'https://api.anthropic.com/v1',
    endpoints: {
      chat: '/messages'
    }
  }
}

/**
 * Error scenario types
 */
export type ErrorScenario =
  | 'timeout'
  | 'rate_limit'
  | 'network_error'
  | 'server_error_500'
  | 'invalid_api_key'
  | 'insufficient_quota'

/**
 * LLM Mock service options
 */
export interface LLMMockServiceOptions {
  /**
   * Whether to use VCR fixtures
   * @default true
   */
  useVCR?: boolean

  /**
   * Error scenario simulation (for testing error handling)
   */
  errorScenario?: ErrorScenario | null

  /**
   * Base delay (milliseconds)
   * @default 100
   */
  baseDelay?: number

  /**
   * Whether to enable verbose logging
   * @default false
   */
  debug?: boolean
}

/**
 * LLM Mock service class
 */
export class LLMMockService {
  private options: Required<LLMMockServiceOptions>

  constructor(options: LLMMockServiceOptions = {}) {
    this.options = {
      useVCR: options.useVCR ?? true,
      errorScenario: options.errorScenario ?? null,
      baseDelay: options.baseDelay ?? 100,
      debug: options.debug ?? false
    }
  }

  /**
   * Generate MSW handlers
   */
  getHandlers(): HttpHandler[] {
    const handlers: HttpHandler[] = []

    // Generate handlers for each provider
    for (const [provider, config] of Object.entries(LLM_PROVIDERS)) {
      handlers.push(...this.createProviderHandlers(provider, config))
    }

    return handlers
  }

  /**
   * Create handlers for a specific provider
   */
  private createProviderHandlers(provider: string, config: LLMProviderConfig): HttpHandler[] {
    const handlers: HttpHandler[] = []

    // Chat completions endpoint
    handlers.push(
      http.post(`${config.baseURL}${config.endpoints.chat}`, async ({ request }) => {
        this.log(`[LLM Mock] Intercepted ${provider} chat request`)

        // Error scenario simulation
        if (this.options.errorScenario) {
          return this.simulateError(this.options.errorScenario)
        }

        // Parse the request (provider-native format)
        const rawBody = await request.json()
        const normalizedRequest = this.normalizeRequest(provider, rawBody)
        const wantsStream = Boolean((rawBody as any)?.stream ?? normalizedRequest.stream)

        // Try to get the response from VCR
        if (this.options.useVCR) {
          try {
            const scenarioName = this.deriveScenarioName(normalizedRequest)
            const vcr = getVCR()
            const fixture = await vcr.intercept(scenarioName, normalizedRequest, async () => {
              // If there is no fixture, return the default mock response
              return this.getDefaultMockResponse(provider, normalizedRequest)
            })

            // Simulate latency
            await delay(this.options.baseDelay)

            // For streaming responses, return the SSE format
            if (wantsStream) {
              return this.createStreamingResponse(fixture as unknown as LLMResponse)
            }

            // Otherwise return JSON
            return HttpResponse.json(this.transformToAPIFormat(provider, fixture as unknown as LLMResponse))
          } catch (error) {
            this.log(`[LLM Mock] VCR error: ${(error as Error).message}`)
            if (process.env.VCR_MODE === 'replay') {
              throw error
            }
            // Fall back to the default mock
            return HttpResponse.json(
              this.transformToAPIFormat(provider, this.getDefaultMockResponse(provider, normalizedRequest))
            )
          }
        }

        // Without VCR, return the default mock directly
        await delay(this.options.baseDelay)
        return HttpResponse.json(
          this.transformToAPIFormat(provider, this.getDefaultMockResponse(provider, normalizedRequest))
        )
      })
    )

    return handlers
  }

  /**
   * Derive the scenario name from the request
   */
  private deriveScenarioName(request: LLMRequest): string {
    const userMessage = request.messages.find(m => m.role === 'user')
    const contentPreview = userMessage?.content.slice(0, 30) || ''

    const readable =
      contentPreview
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'req'

    const hashPayload = JSON.stringify({
      provider: request.provider,
      model: request.model,
      stream: request.stream ?? false,
      temperature: request.temperature,
      max_tokens: request.max_tokens,
      messages: request.messages
    })
    const hash = createHash('sha1').update(hashPayload).digest('hex').slice(0, 12)
    return `${readable}-${hash}`
  }

  /**
   * Normalize a provider API request into an internal LLMRequest (used for the fixture key and the default mock)
   */
  private normalizeRequest(provider: string, raw: unknown): LLMRequest {
    const base: LLMRequest = {
      provider,
      model: 'unknown',
      messages: []
    }

    if (!raw || typeof raw !== 'object') return base

    const body = raw as Record<string, any>

    // OpenAI / DeepSeek / Anthropic（messages: {role, content}[]）
    if (Array.isArray(body.messages)) {
      base.model = typeof body.model === 'string' ? body.model : base.model
      base.stream = Boolean(body.stream)
      base.temperature = typeof body.temperature === 'number' ? body.temperature : undefined
      base.max_tokens = typeof body.max_tokens === 'number' ? body.max_tokens : undefined
      base.messages = body.messages
        .filter((m: any) => m && typeof m === 'object' && typeof m.role === 'string')
        .map((m: any) => ({
          role: m.role,
          content:
            typeof m.content === 'string'
              ? m.content
              : Array.isArray(m.content)
                ? m.content.map((c: any) => c?.text ?? '').join('')
                : ''
        }))
      return base
    }

    // Gemini（contents: [{parts:[{text}]}]）
    if (provider === 'gemini' && Array.isArray(body.contents)) {
      base.model = typeof body.model === 'string' ? body.model : base.model
      base.stream = Boolean(body.stream)
      base.messages = body.contents
        .map((c: any) => {
          const parts = Array.isArray(c?.parts) ? c.parts : []
          const text = parts.map((p: any) => p?.text ?? '').join('')
          return { role: c?.role ?? 'user', content: text }
        })
        .filter((m: any) => typeof m.content === 'string')
      return base
    }

    return base
  }

  /**
   * Get the default mock response
   */
  private getDefaultMockResponse(provider: string, request: LLMRequest): LLMResponse {
    const userMessage = request.messages.find(m => m.role === 'user')

    return {
      type: 'single',
      content: `[Mock Response] Optimized result based on "${userMessage?.content}". This is a mock response for testing purposes.`,
      model: request.model,
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30
      },
      finish_reason: 'stop'
    }
  }

  /**
   * Convert to the API-specific format
   */
  private transformToAPIFormat(provider: string, response: LLMResponse): any {
    const content = response.content ?? (response as any).finalResult?.content ?? ''
    const model = response.model ?? (response as any).finalResult?.model
    const usage = response.usage ?? (response as any).finalResult?.usage
    const finishReason = response.finish_reason ?? (response as any).finalResult?.finish_reason ?? 'stop'

    // OpenAI format
    if (provider === 'openai' || provider === 'deepseek') {
      return {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content
            },
            finish_reason: finishReason
          }
        ],
        usage
      }
    }

    // Gemini format
    if (provider === 'gemini') {
      return {
        candidates: [
          {
            content: {
              parts: [{ text: content }]
            },
            finishReason: finishReason.toUpperCase()
          }
        ],
        usageMetadata: usage
      }
    }

    // Anthropic format (minimal implementation)
    if (provider === 'anthropic') {
      return {
        id: `msg_${Date.now()}`,
        type: 'message',
        role: 'assistant',
        model,
        content: [{ type: 'text', text: content }],
        stop_reason: finishReason,
        usage
      }
    }

    // Use the OpenAI format by default
    return response
  }

  /**
   * Create a streaming response (SSE format)
   */
  private createStreamingResponse(fixture: LLMResponse): Response {
    const content = fixture.content ?? (fixture as any).finalResult?.content ?? ''
    const model = fixture.model ?? (fixture as any).finalResult?.model

    // Generate the stream with StreamSimulator; a non-streaming fixture degrades to a single chunk
    const simulator =
      createStreamFromFixture(fixture, { timeScale: 0.1 }) ||
      createStreamFromFixture(
        { type: 'streaming', chunks: [{ content, timestamp: 0 }] },
        { timeScale: 0.1 }
      )!

    // Create the SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()

        try {
          for await (const chunk of simulator.generate()) {
            // SSE format
            const sseData = JSON.stringify({
              id: `chatcmpl-${Date.now()}`,
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model,
              choices: [
                {
                  index: 0,
                  delta: { content: chunk.content },
                  finish_reason: null
                }
              ]
            })

            controller.enqueue(encoder.encode(`data: ${sseData}\n\n`))
          }

          // Send the end chunk
          const endChunk = JSON.stringify({
            choices: [{ finish_reason: 'stop' }]
          })
          controller.enqueue(encoder.encode(`data: ${endChunk}\n\n`))
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))

          controller.close()
        } catch (error) {
          controller.error(error)
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    })
  }

  /**
   * Simulate an error scenario
   */
  private simulateError(scenario: ErrorScenario): Response {
    this.log(`[LLM Mock] Simulating error: ${scenario}`)

    switch (scenario) {
      case 'timeout':
        // Return no response so the request times out
        return new Response(null, { status: 408 })

      case 'rate_limit':
        return HttpResponse.json(
          {
            error: {
              message: 'Rate limit exceeded. Please try again later.',
              type: 'rate_limit_error',
              code: 'rate_limit_exceeded'
            }
          },
          { status: 429 }
        )

      case 'network_error':
        return HttpResponse.error()

      case 'server_error_500':
        return HttpResponse.json(
          {
            error: {
              message: 'Internal server error',
              type: 'server_error',
              code: 'internal_error'
            }
          },
          { status: 500 }
        )

      case 'invalid_api_key':
        return HttpResponse.json(
          {
            error: {
              message: 'Invalid API key provided',
              type: 'invalid_request_error',
              code: 'invalid_api_key'
            }
          },
          { status: 401 }
        )

      case 'insufficient_quota':
        return HttpResponse.json(
          {
            error: {
              message: 'Insufficient quota',
              type: 'insufficient_quota',
              code: 'insufficient_quota'
            }
          },
          { status: 429 }
        )

      default:
        return HttpResponse.json(
          { error: { message: 'Unknown error' } },
          { status: 500 }
        )
    }
  }

  /**
   * Log output
   */
  private log(message: string): void {
    if (this.options.debug) {
      console.log(message)
    }
  }
}

/**
 * Create an LLM Mock service instance (convenience function)
 *
 * @example
 * ```typescript
 * // Vitest
 * const llmMock = createLLMMockService({ debug: true })
 * const server = setupServer(...llmMock.getHandlers())
 *
 * beforeAll(() => server.listen())
 * afterEach(() => server.resetHandlers())
 * afterAll(() => server.close())
 * ```
 */
export function createLLMMockService(options?: LLMMockServiceOptions): LLMMockService {
  return new LLMMockService(options)
}

/**
 * Predefined handlers (can be used directly with MSW)
 *
 * @example
 * ```typescript
 * import { llmHandlers } from './tests/utils/llm-mock-service'
 *
 * const server = setupServer(...llmHandlers)
 * ```
 */
export const llmHandlers = createLLMMockService().getHandlers()

/**
 * Test utility: enable a specific error scenario
 *
 * @example
 * ```typescript
 * const { cleanup } = withLLMErrorScenario('rate_limit')
 * // ... run the test
 * cleanup()
 * ```
 */
export function withLLMErrorScenario(scenario: ErrorScenario): {
  service: LLMMockService
  cleanup: () => void
} {
  const service = new LLMMockService({ errorScenario: scenario })

  return {
    service,
    cleanup: () => {
      // Cleanup logic (if needed)
    }
  }
}
