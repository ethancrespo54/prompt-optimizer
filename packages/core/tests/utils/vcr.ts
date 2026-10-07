/**
 * VCR (Video Cassette Recorder) for LLM API testing
 *
 * Automated record-and-replay system:
 * - First run: call the real LLM API and save the response as a fixture
 * - Subsequent runs: replay the fixture automatically (no real API needed)
 * - Supports full timing simulation of streaming responses
 *
 * @module tests/utils/vcr
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * VCR mode
 */
export type VCRMode = 'auto' | 'record' | 'replay' | 'off'

/**
 * LLM request interface
 */
export interface LLMRequest {
  provider: string
  model: string
  messages: Array<{ role: string; content: string }>
  stream?: boolean
  temperature?: number
  max_tokens?: number
  [key: string]: any
}

/**
 * Streaming response chunk
 */
export interface StreamChunk {
  content: string
  timestamp: number
  [key: string]: any
}

/**
 * LLM response interface
 */
export interface LLMResponse {
  type: 'streaming' | 'single'
  chunks?: StreamChunk[]
  content?: string
  model?: string
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  finish_reason?: string
  [key: string]: any
}

/**
 * Fixture metadata
 */
export interface FixtureMetadata {
  recordedAt: string
  scenarioName: string
  description?: string
  duration: number
  recordedBy: 'auto' | 'manual'
  tags?: string[]
}

/**
 * Complete fixture file
 */
export interface Fixture {
  request: LLMRequest
  response: LLMResponse
  metadata: FixtureMetadata
}

/**
 * VCR configuration options
 */
export interface VCROptions {
  /**
   * Fixtures storage directory
   * @default packages/core/tests/fixtures
   */
  fixtureDir?: string

  /**
   * VCR mode
   * - auto: auto-detect (replay if a fixture exists, otherwise record)
   * - record: force recording (overwrites existing fixtures)
   * - replay: force replay (fails when there is no fixture)
   * - off: disable VCR (always call the real API)
   * @default process.env.VCR_MODE || 'auto'
   */
  mode?: VCRMode

  /**
   * Whether to enable the real LLM (required for record mode)
   * @default process.env.ENABLE_REAL_LLM === 'true' || process.env.RUN_REAL_API === '1'
   */
  enableRealLLM?: boolean
}

/**
 * VCR class
 */
export class VCR {
  private fixtureDir: string
  private mode: VCRMode
  private enableRealLLM: boolean

  constructor(options: VCROptions = {}) {
    // Default fixtures directory: packages/core/tests/fixtures
    this.fixtureDir = options.fixtureDir || join(__dirname, '..', 'fixtures')

    // Whether to enable the real LLM
    const envEnableReal =
      process.env.ENABLE_REAL_LLM === 'true' ||
      process.env.RUN_REAL_API === '1'
    this.enableRealLLM = options.enableRealLLM ?? envEnableReal

    // Read the mode from the environment variable
    const envMode = process.env.VCR_MODE as VCRMode

    // Default strategy for the core module: when the real LLM is enabled, use 'off' mode by default (always call the real API)
    // This ensures the core module's integration tests actually exercise the API instead of replaying fixtures
    if (this.enableRealLLM && !options.mode && !envMode) {
      this.mode = 'off'
    } else {
      this.mode = options.mode || envMode || 'auto'
    }
  }

  /**
   * Intercept and handle LLM API calls
   *
   * @param scenarioName - Scenario name (used to generate the fixture file name)
   * @param request - LLM request object
   * @param realFn - Function that calls the real API
   * @returns Promise<LLMResponse>
   *
   * @example
   * ```typescript
   * const vcr = new VCR()
   * const response = await vcr.intercept('optimize-simple-prompt', request, () =>
   *   openai.chat.completions.create(request)
   * )
   * ```
   */
  async intercept<T = LLMResponse>(
    scenarioName: string,
    request: LLMRequest,
    realFn: () => Promise<T>
  ): Promise<T> {
    // Mode determination
    if (this.mode === 'off') {
      return realFn()
    }

    const fixturePath = this.getFixturePath(request.provider, scenarioName)

    // Replay mode: force replay
    if (this.mode === 'replay') {
      if (!existsSync(fixturePath)) {
        throw new Error(
          `Fixture not found: ${fixturePath}\n` +
          `Run with VCR_MODE=record to create it, or VCR_MODE=auto to auto-record.`
        )
      }
      return this.replayFixture(fixturePath) as T
    }

    // Record mode: force recording
    if (this.mode === 'record') {
      return this.recordAndSave(scenarioName, fixturePath, request, realFn)
    }

    // Auto mode: auto-detect
    if (existsSync(fixturePath)) {
      // Fixture exists: replay
      return this.replayFixture(fixturePath) as T
    } else {
      // Fixture does not exist: record
      console.log(`[VCR] Recording new fixture: ${scenarioName}`)
      return this.recordAndSave(scenarioName, fixturePath, request, realFn)
    }
  }

  /**
   * Replay a fixture
   */
  private replayFixture(fixturePath: string): LLMResponse {
    const raw = JSON.parse(readFileSync(fixturePath, 'utf-8')) as Partial<Fixture>
    if (!raw || typeof raw !== 'object') {
      throw new Error(`[VCR] Invalid fixture (not an object): ${fixturePath}`)
    }
    if (!('response' in raw)) {
      throw new Error(
        `[VCR] Invalid fixture (missing { request, response, metadata }): ${fixturePath}\n` +
        `Re-record this fixture with VCR_MODE=record and ENABLE_REAL_LLM=true.`
      )
    }
    if (!raw.response) {
      throw new Error(
        `[VCR] Invalid fixture (missing response). This usually happens when recording a void-return call.\n` +
        `Fixture: ${fixturePath}\n` +
        `Delete it and re-record with VCR_MODE=record, or fix the test to return a value.`
      )
    }

    const response = raw.response

    // For streaming responses, the delay needs to be simulated
    if (response.type === 'streaming' && response.chunks) {
      return this.simulateStreamingResponse(response)
    }

    return response
  }

  /**
   * Record and save a fixture
   */
  private async recordAndSave<T>(
    scenarioName: string,
    fixturePath: string,
    request: LLMRequest,
    realFn: () => Promise<T>
  ): Promise<T> {
    // Check whether the real LLM is enabled
    if (!this.enableRealLLM) {
      throw new Error(
        `Real LLM is disabled. Cannot record fixture.\n` +
        `Set ENABLE_REAL_LLM=true to enable real API calls.\n` +
        `Or ensure fixture exists: ${fixturePath}`
      )
    }

    const startTime = Date.now()

    // Call the real API
    const result = await realFn()
    if (result === undefined) {
      throw new Error(
        `[VCR] Cannot record fixture because the intercepted function returned undefined.\n` +
        `Scenario: ${scenarioName}\n` +
        `Fix: make the function return a serializable response value, or don’t wrap void-return calls with VCR.`
      )
    }

    const duration = Date.now() - startTime

    // Build the fixture
    const fixture: Fixture = {
      request,
      response: result as any,
      metadata: {
        recordedAt: new Date().toISOString(),
        scenarioName,
        duration,
        recordedBy: 'auto'
      }
    }

    // Make sure the directory exists
    const dir = dirname(fixturePath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }

    // Save the fixture
    writeFileSync(fixturePath, JSON.stringify(fixture, null, 2), 'utf-8')
    console.log(`[VCR] Fixture saved: ${fixturePath}`)

    return result
  }

  /**
   * Simulate a streaming response (including delays)
   */
  private simulateStreamingResponse(response: LLMResponse): LLMResponse {
    // Note: this only returns the raw data; the actual delay simulation should be implemented by the caller
    // Can be used together with the StreamSimulator class
    return response
  }

  /**
   * Get the fixture file path
   */
  private getFixturePath(provider: string, scenarioName: string): string {
    return join(this.fixtureDir, 'llm', provider.toLowerCase(), `${scenarioName}.json`)
  }

  /**
   * Delete the specified fixture
   */
  deleteFixture(provider: string, scenarioName: string): boolean {
    const fixturePath = this.getFixturePath(provider, scenarioName)
    if (existsSync(fixturePath)) {
      unlinkSync(fixturePath)
      console.log(`[VCR] Fixture deleted: ${fixturePath}`)
      return true
    }
    return false
  }

  /**
   * List all fixtures
   */
  listFixtures(provider?: string): string[] {
    const fixturesDir = provider
      ? join(this.fixtureDir, 'llm', provider.toLowerCase())
      : join(this.fixtureDir, 'llm')

    if (!existsSync(fixturesDir)) {
      return []
    }

    const files: string[] = []
    const scanDir = (dir: string) => {
      const entries = readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = join(dir, entry.name)
        if (entry.isDirectory()) {
          scanDir(fullPath)
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
          files.push(fullPath)
        }
      }
    }

    scanDir(fixturesDir)
    return files
  }
}

/**
 * Global VCR instance (singleton)
 */
let globalVCR: VCR | null = null

/**
 * Get the global VCR instance
 */
export function getVCR(options?: VCROptions): VCR {
  if (options && Object.keys(options).length > 0) {
    return new VCR(options)
  }

  if (!globalVCR) {
    globalVCR = new VCR()
  }

  return globalVCR
}

/**
 * Convenience function: intercept LLM calls with VCR
 *
 * @example
 * ```typescript
 * const response = await withVCR('optimize-prompt', request, () =>
 *   llmService.optimize(request)
 * )
 * ```
 */
export async function withVCR<T>(
  scenarioName: string,
  request: LLMRequest,
  realFn: () => Promise<T>,
  options?: VCROptions
): Promise<T> {
  const vcr = getVCR(options)
  return vcr.intercept(scenarioName, request, realFn)
}
