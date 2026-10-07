/**
 * E2E test VCR (Video Cassette Recorder)
 *
 * Provides recording and replay of LLM API requests for E2E tests
 *
 * How it works:
 * - Intercepts real LLM API requests (OpenAI, DeepSeek, etc.)
 * - First run: calls the real API and saves the response as a fixture
 * - Later runs: replays the fixture directly, with no real API call
 *
 * @module tests/e2e/helpers/vcr
 */

import { type Page, type Route } from '@playwright/test'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as crypto from 'crypto'

/**
 * LLM API provider
 */
type LLMProvider = 'openai' | 'deepseek' | 'anthropic' | 'gemini' | 'zhipu' | 'modelscope' | 'siliconflow'

/**
 * VCR mode
 */
export type VCRMode = 'auto' | 'record' | 'replay' | 'live'

/**
 * VCR config
 */
interface VCRConfig {
  mode: VCRMode
  fixtureDir: string
}

/**
 * VCR Fixture
 */
interface VCRInteraction {
  provider: LLMProvider
  url: string
  method: string
  requestBody: any
  requestHash: string

  /** Raw response body as UTF-8 text (SSE or JSON). */
  rawBody: string

  /** Response headers captured at record time (subset). */
  responseHeaders: Record<string, string>

  /**
   * Parsed response body (for debugging only).
   * For SSE responses this is the reconstructed final JSON.
   */
  responseBody: any

  duration: number
  status: number
}

interface VCRFixture {
  testName: string
  testCase: string

  /**
   * Supports multiple LLM requests within the same test case.
   * On record, interactions are appended; on replay, entries are matched by requestHash and consumed.
   */
  interactions: VCRInteraction[]

  // --- legacy fields for backward compatibility (single interaction) ---
  provider?: LLMProvider
  url?: string
  requestBody?: any
  responseBody?: any
  rawSSE?: string // legacy only
  duration?: number
}

/**
 * E2E VCR class
 */
class E2EVCR {
  private config: VCRConfig
  private currentTestName: string = ''
  private currentTestCase: string = ''
  private recordingEnabled: boolean = false

  // Replay-only: per testCase, track how many interactions have been consumed per requestHash.
  private replayConsumedByHash: Map<string, number> = new Map()

  constructor(config: VCRConfig) {
    this.config = config
  }

  /**
   * Set the current test context
   */
  async setTestContext(testName: string, testCase: string) {
    this.currentTestName = testName
    this.currentTestCase = testCase
    this.recordingEnabled = await this.shouldRecord()
    this.replayConsumedByHash = new Map()

    // In explicit record mode, always start from a clean fixture file to avoid mixing old interactions.
    if (this.config.mode === 'record') {
      try {
        await fs.rm(this.getFixturePath(), { force: true })
      } catch {
        // ignore
      }
    }

    const modeSymbol = this.getModeSymbol()
    console.log(`[VCR] ${modeSymbol} Test: ${testName} - ${testCase}`)
  }

  /**
   * Get the mode symbol
   */
  private getModeSymbol(): string {
    const { mode } = this.config
    if (mode === 'live') return '🔴 Live'
    if (mode === 'record') return '🎬 Record'
    if (mode === 'replay') return '♻️  Replay'
    if (this.recordingEnabled) return '🎬 Auto-Record'
    return '♻️  Auto-Replay'
  }

  /**
   * Decide whether to record
   */
  private async shouldRecord(): Promise<boolean> {
    const { mode } = this.config
    if (mode === 'live') return false
    if (mode === 'record') return true
    if (mode === 'replay') return false

    // auto mode: check whether the fixture exists
    return !(await this.fixtureExists())
  }

  /**
   * Check whether the fixture exists
   */
  private async fixtureExists(): Promise<boolean> {
    const fixturePath = this.getFixturePath()
    try {
      await fs.access(fixturePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get the fixture path
   */
  private getFixturePath(): string {
    const sanitizedTestName = this.sanitizeFilename(this.currentTestName)
    const sanitizedTestCase = this.sanitizeFilename(this.currentTestCase)
    return path.join(
      this.config.fixtureDir,
      sanitizedTestName,
      `${sanitizedTestCase}.json`
    )
  }

  /**
   * Sanitize the filename (keeps CJK characters, letters and digits)
   */
  private sanitizeFilename(name: string): string {
    // Windows paths contain backslashes, and inside a regex character class "\\" would be kept as a normal character,
    // which makes the fixture directory name differ from the expected one (e.g. optimize\pro-multi.spec.ts).
    // First replace path separators with '-' and then filter.
    return name
      .replace(/\\/g, '-')
      .replace(/[^\u4e00-\u9fa5a-z0-9]/gi, '-') // keep CJK, letters, digits
      .replace(/-+/g, '-') // collapse multiple hyphens
      .replace(/^-|-$/g, '') // strip leading/trailing hyphens
      .toLowerCase()
  }

  /**
   * Identify the LLM provider
   */
  private identifyProvider(url: string): LLMProvider | null {
    if (url.includes('api.openai.com')) return 'openai'
    if (url.includes('api.deepseek.com')) return 'deepseek'
    if (url.includes('api.anthropic.com')) return 'anthropic'
    if (url.includes('generativelanguage.googleapis.com')) return 'gemini'
    if (url.includes('open.bigmodel.cn')) return 'zhipu'
    if (url.includes('modelscope.cn')) return 'modelscope'
    if (url.includes('api.siliconflow.cn')) return 'siliconflow'
    return null
  }

  /**
   * Save the fixture
   */
  private stableStringify(value: any): string {
    if (value === null || value === undefined) return String(value)

    if (Array.isArray(value)) {
      return `[${value.map((v) => this.stableStringify(v)).join(',')}]`
    }

    if (typeof value === 'object') {
      const keys = Object.keys(value).sort()
      const entries = keys.map((k) => `${JSON.stringify(k)}:${this.stableStringify((value as any)[k])}`)
      return `{${entries.join(',')}}`
    }

    return JSON.stringify(value)
  }

  private computeRequestHash(provider: LLMProvider, url: string, method: string, requestBody: any): string {
    // Normalize url: for some providers, query params (e.g. cache busters) should not affect matching.
    const normalizedUrl = url.split('?')[0]

    // Image2Image requests can embed huge base64 strings; avoid hashing raw bytes.
    // The hash only needs to distinguish interactions within a test run.
    const normalizedBody = (() => {
      if (!requestBody || typeof requestBody !== 'object') return requestBody
      const cloned = JSON.parse(JSON.stringify(requestBody))
      const b64 = cloned?.inputImage?.b64
      if (typeof b64 === 'string' && b64.length > 0) {
        cloned.inputImage.b64 = `__b64_len_${b64.length}__`
      }
      return cloned
    })()

    const payload = `${provider}|${method}|${normalizedUrl}|${this.stableStringify(normalizedBody)}`
    return crypto.createHash('sha256').update(payload).digest('hex')
  }

  private normalizeFixture(fixture: VCRFixture | null): VCRFixture {
    if (fixture && Array.isArray((fixture as any).interactions)) {
      // Backward compat: older multi-interaction fixtures stored rawSSE.
      const interactions = (fixture as any).interactions as any[]
      for (const it of interactions) {
        if (typeof it.rawBody === 'undefined' && typeof it.rawSSE !== 'undefined') {
          it.rawBody = it.rawSSE
          it.responseHeaders = it.responseHeaders || { 'content-type': 'text/event-stream' }
          delete it.rawSSE
        }
      }
      return fixture
    }

    // Legacy single-interaction fixtures: normalize into interactions[].
    if (fixture && (fixture as any).rawSSE) {
      const legacyProvider = (fixture as any).provider as LLMProvider
      const legacyUrl = (fixture as any).url as string
      const legacyRequestBody = (fixture as any).requestBody
      const legacyMethod = 'POST'
      const legacyRequestHash = this.computeRequestHash(legacyProvider, legacyUrl, legacyMethod, legacyRequestBody)

      const rawBody = String((fixture as any).rawSSE || '')

      return {
        testName: fixture.testName,
        testCase: fixture.testCase,
        interactions: [
          {
            provider: legacyProvider,
            url: legacyUrl,
            method: legacyMethod,
            requestBody: legacyRequestBody,
            requestHash: legacyRequestHash,
            rawBody,
            responseHeaders: { 'content-type': 'text/event-stream' },
            responseBody: (fixture as any).responseBody,
            duration: Number((fixture as any).duration ?? 0),
            status: 200,
          },
        ],
      }
    }

    return {
      testName: this.currentTestName,
      testCase: this.currentTestCase,
      interactions: [],
    }
  }

  private async writeFixture(fixture: VCRFixture): Promise<void> {
    const fixturePath = this.getFixturePath()

    await fs.mkdir(path.dirname(fixturePath), { recursive: true })
    await fs.writeFile(fixturePath, JSON.stringify(fixture, null, 2), 'utf-8')

    const relativePath = path.relative(process.cwd(), fixturePath)
    console.log(`[VCR] ✅ Fixture saved: ${relativePath}`)
  }

  async saveFixture(
    provider: LLMProvider,
    url: string,
    requestBody: any,
    responseBody: any,
    duration: number,
    rawBody: string,
    responseHeaders: Record<string, string>,
    method: string,
    status: number
  ): Promise<void> {
    if (!this.recordingEnabled) return

    const requestHash = this.computeRequestHash(provider, url, method, requestBody)

    const existing = this.normalizeFixture(await this.loadFixture())
    const fixture: VCRFixture = {
      testName: existing.testName || this.currentTestName,
      testCase: existing.testCase || this.currentTestCase,
      interactions: [...existing.interactions],
    }

    const sanitizedBody = (() => {
      try {
        // Keep the fixture small: drop huge base64 payloads.
        if (requestBody && typeof requestBody === 'object') {
          const cloned = JSON.parse(JSON.stringify(requestBody))
          const b64 = cloned?.inputImage?.b64
          if (typeof b64 === 'string' && b64.length > 0) {
            cloned.inputImage.b64 = `__b64_len_${b64.length}__`
          }
          return cloned
        }
      } catch {
        // ignore
      }
      return requestBody
    })()

    fixture.interactions.push({
      provider,
      url,
      method,
      requestBody: sanitizedBody,
      requestHash,
      rawBody,
      responseHeaders,
      responseBody,
      duration,
      status,
    })

    try {
      await this.writeFixture(fixture)
    } catch (error) {
      console.error(`[VCR] ❌ Failed to save fixture:`, error)
    }
  }

  /**
   * Load the fixture
   */
  async loadFixture(): Promise<VCRFixture | null> {
    const fixturePath = this.getFixturePath()

    try {
      const content = await fs.readFile(fixturePath, 'utf-8')
      const fixture: VCRFixture = JSON.parse(content)

      const relativePath = path.relative(process.cwd(), fixturePath)
      const count = Array.isArray((fixture as any).interactions) ? (fixture as any).interactions.length : 1
      console.log(`[VCR] ♻️  Replaying fixture (${count} interaction(s)): ${relativePath}`)

      return fixture
    } catch {
      return null
    }
  }

  private async loadFixtureNormalized(): Promise<VCRFixture> {
    const raw = await this.loadFixture()
    return this.normalizeFixture(raw)
  }

  private findReplayInteraction(fixture: VCRFixture, requestHash: string): VCRInteraction | null {
    const consumedCount = this.replayConsumedByHash.get(requestHash) ?? 0
    const candidates = fixture.interactions.filter((it) => it.requestHash === requestHash)
    const matched = candidates[consumedCount] ?? null
    if (!matched) return null

    this.replayConsumedByHash.set(requestHash, consumedCount + 1)
    return matched
  }

  /**
   * Set up route interception
   */
  async setupRoutes(page: Page) {
    const { mode } = this.config

    // live mode: do not intercept
    if (mode === 'live') {
      return
    }

    // Intercept requests to all LLM API providers
    const apiPatterns = [
      /https:\/\/api\.openai\.com\/.*/,
      /https:\/\/api\.deepseek\.com\/.*/,
      /https:\/\/api\.anthropic\.com\/.*/,
      /https:\/\/generativelanguage\.googleapis\.com\/.*/,
      /https:\/\/open\.bigmodel\.cn\/.*/,
      /https:\/\/.*\.modelscope\.cn\/.*/,
      /https:\/\/api\.siliconflow\.cn\/.*/,
    ]

    for (const pattern of apiPatterns) {
      await page.route(pattern, async (route: Route) => {
        const request = route.request()
        const url = request.url()
        const method = request.method()

        // Only intercept POST requests
        if (method !== 'POST') {
          await route.continue()
          return
        }

        const provider = this.identifyProvider(url)
        if (!provider) {
          await route.continue()
          return
        }

        try {
          const requestBody = await request.postData()

          if (this.recordingEnabled) {
            // record mode: call the real API and save
            const startTime = Date.now()
            const response = await route.fetch()
            const endTime = Date.now()

            const responseBody = await response.text()

            // If recording returns 4xx/5xx, skip saving the fixture so the error response is not recorded
            if (response.status() >= 400) {
              const headers = { ...response.headers() }
              // route.fetch() has already decoded the body; keeping headers such as content-encoding/content-length would cause double decoding / length mismatch in the browser
              delete (headers as any)['content-encoding']
              delete (headers as any)['content-length']
              delete (headers as any)['transfer-encoding']

              await route.fulfill({
                status: response.status(),
                headers: {
                  ...headers,
                  'access-control-allow-origin': '*',
                  'access-control-allow-headers': '*',
                },
                body: responseBody
              })
              return
            }

            // Image generation and other non-SSE responses: replay the raw response as is (avoid forcing SSE synthesis, which would break semantics)
            const contentType = response.headers()['content-type'] || ''
            const isImageResponse = /\bimage\//i.test(contentType)
            const isSSE = /\btext\/event-stream\b/i.test(contentType)

            if (!isSSE && (isImageResponse || /\/images\//i.test(url))) {
              await this.saveFixture(
                provider,
                url,
                JSON.parse(requestBody || '{}'),
                null,
                endTime - startTime,
                responseBody,
                { 'content-type': contentType || 'application/octet-stream' },
                method,
                response.status()
              )

              const headers = { ...response.headers() }
              delete (headers as any)['content-encoding']
              delete (headers as any)['content-length']
              delete (headers as any)['transfer-encoding']

              await route.fulfill({
                status: response.status(),
                headers: {
                  ...headers,
                  'access-control-allow-origin': '*',
                  'access-control-allow-headers': '*',
                },
                body: responseBody
              })
              return
            }

            const hasSSE = /(^|\n)\s*data:\s*/.test(responseBody)

            let rawSSE = responseBody
            let responseJson: any = null

            if (hasSSE) {
              // Parse the SSE response and extract the full content (OpenAI-compatible format)
              const lines = responseBody
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.startsWith('data:'))

              let fullContent = ''
              let lastChunk: any = null

              for (const line of lines) {
                const jsonStr = line.replace(/^data:\s*/, '').trim()
                if (!jsonStr || jsonStr === '[DONE]') continue

                try {
                  const chunk = JSON.parse(jsonStr)
                  lastChunk = chunk
                  if (chunk.choices && chunk.choices[0] && chunk.choices[0].delta) {
                    fullContent += chunk.choices[0].delta.content || ''
                  }
                } catch {
                  // Ignore parse errors
                }
              }

              if (lastChunk) {
                responseJson = {
                  ...lastChunk,
                  choices: [{
                    ...lastChunk.choices?.[0],
                    message: {
                      role: 'assistant',
                      content: fullContent
                    }
                  }]
                }
              }
            } else {
              // Non-SSE response: try to parse as JSON and synthesize a replayable SSE
              // Purpose: make replay independent of the real API streaming implementation details
              try {
                const parsed = JSON.parse(responseBody)
                responseJson = parsed

                const content =
                  parsed?.choices?.[0]?.message?.content ??
                  parsed?.choices?.[0]?.delta?.content ??
                  parsed?.content ??
                  ''

                const created = parsed?.created ?? Math.floor(Date.now() / 1000)
                const id = parsed?.id ?? `vcr_${created}`
                const model = parsed?.model ?? 'unknown'

                const baseChunk = {
                  id,
                  object: 'chat.completion.chunk',
                  created,
                  model,
                  choices: [{
                    index: 0,
                    delta: { role: 'assistant', content: '' },
                    logprobs: null,
                    finish_reason: null,
                  }]
                }

                const contentChunk = {
                  id,
                  object: 'chat.completion.chunk',
                  created,
                  model,
                  choices: [{
                    index: 0,
                    delta: { content: String(content) },
                    logprobs: null,
                    finish_reason: null,
                  }]
                }

                const endChunk = {
                  id,
                  object: 'chat.completion.chunk',
                  created,
                  model,
                  choices: [{
                    index: 0,
                    delta: {},
                    logprobs: null,
                    finish_reason: 'stop',
                  }]
                }

                rawSSE =
                  `data: ${JSON.stringify(baseChunk)}\n\n` +
                  `data: ${JSON.stringify(contentChunk)}\n\n` +
                  `data: ${JSON.stringify(endChunk)}\n\n` +
                  `data: [DONE]\n\n`
              } catch {
                throw new Error('[VCR] LLM API returned a non-streaming response that could not be parsed as JSON')
              }
            }

            await this.saveFixture(
              provider,
              url,
              JSON.parse(requestBody || '{}'),
              responseJson,
              endTime - startTime,
              rawSSE,
              {
                'content-type': hasSSE ? 'text/event-stream' : (response.headers()['content-type'] || 'application/json'),
              },
              method,
              response.status()
            )

            // Return the real response (add CORS headers so the browser-side fetch is not blocked)
            const headers = { ...response.headers() }
            // route.fetch() has already decoded the body; keeping headers such as content-encoding/content-length would cause double decoding / length mismatch in the browser
            delete (headers as any)['content-encoding']
            delete (headers as any)['content-length']
            delete (headers as any)['transfer-encoding']

            // For stream=true requests, make sure content-type is SSE
            if (hasSSE) {
              headers['content-type'] = 'text/event-stream'
            }

            await route.fulfill({
              status: response.status(),
              headers: {
                ...headers,
                'access-control-allow-origin': '*',
                'access-control-allow-headers': '*',
              },
              body: responseBody
            })
          } else {
            // replay mode: use the fixture (multiple requests within one test are supported, matched precisely by requestHash)
            const fixture = await this.loadFixtureNormalized()
            const parsedRequestBody = JSON.parse(requestBody || '{}')
            const requestHash = this.computeRequestHash(provider, url, method, parsedRequestBody)
            const interaction = this.findReplayInteraction(fixture, requestHash)

            if (interaction) {
              // Return the raw SSE text directly (format fully identical)
              const contentType = interaction.responseHeaders?.['content-type'] || 'application/json'
              const isSSE = /text\/event-stream/i.test(contentType)

              await route.fulfill({
                status: interaction.status || 200,
                headers: {
                  'content-type': contentType,
                  ...(isSSE
                    ? {
                        'cache-control': 'no-cache',
                        'connection': 'keep-alive',
                      }
                    : {}),
                  // Key: avoid the browser-side fetch failing outright due to CORS
                  'access-control-allow-origin': '*',
                  'access-control-allow-headers': '*',
                },
                body: interaction.rawBody || ''
              })
            } else {
              if (mode === 'replay') {
                // replay mode: fail if there is no fixture
                const errorMsg =
                  `[VCR] ❌ Fixture not found for test: ${this.currentTestName} - ${this.currentTestCase}\n` +
                  `Request hash: ${requestHash} (${provider} ${method} ${url.split('?')[0]})\n` +
                  `Run with E2E_VCR_MODE=record to create it.`

                console.error(errorMsg)
                await route.abort()
              } else {
                // auto mode: fall back to the real API
                console.log(
                  `[VCR] ⚠️  No fixture for requestHash=${requestHash} (${provider} ${method} ${url.split('?')[0]}), calling real API`,
                )
                await route.continue()
              }
            }
          }
        } catch (error) {
          console.error(`[VCR] Error:`, error)
          await route.continue()
        }
      })
    }
  }
}

/**
 * Get a VCR instance (a new instance is created on each call, supporting parallel tests)
 */
export function getVCR(): E2EVCR {
  const mode = (process.env.E2E_VCR_MODE as VCRMode) || 'auto'
  const fixtureDir = process.env.E2E_VCR_FIXTURE_DIR || 'tests/e2e/fixtures/vcr'

  return new E2EVCR({ mode, fixtureDir })
}

/**
 * Set up VCR for a test
 */
export async function setupVCRForTest(page: Page, testName: string, testCase: string) {
  const vcr = getVCR()
  await vcr.setTestContext(testName, testCase)
  await vcr.setupRoutes(page)
}
