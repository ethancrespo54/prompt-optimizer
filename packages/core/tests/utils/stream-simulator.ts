/**
 * Streaming response simulator
 *
 * Simulates the streaming response behavior of an LLM API, including:
 * - Returning chunks one by one in sequence
 * - Simulating network latency
 * - Simulating network jitter
 * - Supports the AsyncGenerator interface
 *
 * @module tests/utils/stream-simulator
 */

import type { StreamChunk } from './vcr.js'
import { Readable } from 'stream'

/**
 * Streaming response simulator options
 */
export interface StreamSimulatorOptions {
  /**
   * Time scaling factor (speed up/slow down tests)
   * - 1.0: normal speed
   * - 0.5: 2x faster
   * - 2.0: 2x slower
   * @default 1.0
   */
  timeScale?: number

  /**
   * Whether to add random network jitter (probability between 0 and 1)
   * @default 0
   */
  jitterProbability?: number

  /**
   * Maximum jitter delay (milliseconds)
   * @default 100
   */
  jitterMaxDelay?: number
}

/**
 * Streaming response simulator
 */
export class StreamSimulator {
  private chunks: StreamChunk[]
  private timeScale: number
  private jitterProbability: number
  private jitterMaxDelay: number

  constructor(
    chunks: StreamChunk[],
    options: StreamSimulatorOptions = {}
  ) {
    this.chunks = chunks
    this.timeScale = options.timeScale ?? 1.0
    this.jitterProbability = options.jitterProbability ?? 0
    this.jitterMaxDelay = options.jitterMaxDelay ?? 100
  }

  /**
   * Generate a streaming response (AsyncGenerator)
   *
   * @example
   * ```typescript
   * const simulator = new StreamSimulator(chunks)
   * for await (const chunk of simulator.generate()) {
   *   console.log(chunk.content)
   * }
   * ```
   */
  async *generate(): AsyncGenerator<StreamChunk> {
    let lastTimestamp = 0

    for (const chunk of this.chunks) {
      // Calculate the delay (taking time scaling into account)
      const delay = (chunk.timestamp - lastTimestamp) * this.timeScale

      if (delay > 0) {
        // Apply the delay
        await this.sleep(delay)

        // Randomly add network jitter
        if (Math.random() < this.jitterProbability) {
          const jitterDelay = Math.random() * this.jitterMaxDelay
          await this.sleep(jitterDelay)
        }
      }

      yield chunk
      lastTimestamp = chunk.timestamp
    }
  }

  /**
   * Generate a callback-style stream (compatible with the legacy API)
   *
   * @example
   * ```typescript
   * const simulator = new StreamSimulator(chunks)
   * simulator.generateCallback((chunk) => {
   *   console.log(chunk.content)
   * })
   * ```
   */
  async generateCallback(
    callback: (chunk: StreamChunk) => void,
    onComplete?: () => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    try {
      for await (const chunk of this.generate()) {
        callback(chunk)
      }
      onComplete?.()
    } catch (error) {
      onError?.(error as Error)
    }
  }

  /**
   * Convert to a ReadableStream (Web Streams API)
   *
   * @example
   * ```typescript
   * const simulator = new StreamSimulator(chunks)
   * const stream = simulator.toReadableStream()
   *
   * const response = new Response(stream)
   * ```
   */
  toReadableStream(): ReadableStream<StreamChunk> {
    return new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of this.generate()) {
            controller.enqueue(chunk)
          }
          controller.close()
        } catch (error) {
          controller.error(error)
        }
      }
    })
  }

  /**
   * Convert to a Node.js Readable stream
   */
  toNodeReadableStream(): NodeJS.ReadableStream {
    const simulatorIterator = this.generate()[Symbol.asyncIterator]()

    return new Readable({
      async read(this: Readable) {
        const { value, done } = await simulatorIterator.next()
        if (done) {
          this.push(null) // EOF
          return
        }

        this.push(JSON.stringify(value) + '\n')
      }
    })
  }

  /**
   * Wait for the specified number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    if (ms <= 0) return Promise.resolve()
    if (ms < 1) return Promise.resolve()
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get the full content (all chunks concatenated)
   */
  getFullContent(): string {
    return this.chunks.map(chunk => chunk.content).join('')
  }

  /**
   * Get the total duration
   */
  getTotalDuration(): number {
    if (this.chunks.length === 0) return 0
    return this.chunks[this.chunks.length - 1].timestamp
  }

  /**
   * Get the number of chunks
   */
  getChunkCount(): number {
    return this.chunks.length
  }
}

/**
 * Convenience function to create a streaming response simulator
 *
 * @example
 * ```typescript
 * const simulator = createStreamSimulator(chunks, { timeScale: 0.5 })
 * for await (const chunk of simulator.generate()) {
 *   console.log(chunk.content)
 * }
 * ```
 */
export function createStreamSimulator(
  chunks: StreamChunk[],
  options?: StreamSimulatorOptions
): StreamSimulator {
  return new StreamSimulator(chunks, options)
}

/**
 * Create a streaming simulator from a fixture
 *
 * @example
 * ```typescript
 * const simulator = createStreamFromFixture(fixture)
 * for await (const chunk of simulator.generate()) {
 *   console.log(chunk.content)
 * }
 * ```
 */
export function createStreamFromFixture(
  fixture:
    | { response: { type: 'streaming'; chunks?: StreamChunk[] } }
    | { type: 'streaming'; chunks?: StreamChunk[] },
  options?: StreamSimulatorOptions
): StreamSimulator | null {
  const response = 'response' in fixture ? fixture.response : fixture
  if (response.type !== 'streaming' || !response.chunks) return null
  return new StreamSimulator(response.chunks, options)
}

/**
 * Batch test helper: verify the integrity of a streaming response
 *
 * @example
 * ```typescript
 * const isValid = await validateStreamResponse(chunks, 'expected content')
 * if (!isValid) {
 *   console.error('Stream response validation failed')
 * }
 * ```
 */
export async function validateStreamResponse(
  chunks: StreamChunk[],
  expectedContent: string,
  options?: StreamSimulatorOptions
): Promise<boolean> {
  const simulator = new StreamSimulator(chunks, options)
  const actualContent = simulator.getFullContent()

  return actualContent === expectedContent
}

/**
 * Performance test: measure the generation speed of a streaming response
 *
 * @example
 * ```typescript
 * const stats = await measureStreamPerformance(chunks)
 * console.log(`Total duration: ${stats.actualDuration}ms`)
 * console.log(`Chunks per second: ${stats.chunksPerSecond}`)
 * ```
 */
export async function measureStreamPerformance(
  chunks: StreamChunk[],
  options?: StreamSimulatorOptions
): Promise<{
  actualDuration: number
  expectedDuration: number
  chunksPerSecond: number
  averageChunkDelay: number
}> {
  const startTime = Date.now()
  const simulator = new StreamSimulator(chunks, options)

  let chunkCount = 0
  for await (const _chunk of simulator.generate()) {
    chunkCount++
  }

  const actualDuration = Date.now() - startTime
  const expectedDuration = simulator.getTotalDuration() * (options?.timeScale ?? 1.0)

  return {
    actualDuration,
    expectedDuration,
    chunksPerSecond: (chunkCount / actualDuration) * 1000,
    averageChunkDelay: actualDuration / chunkCount
  }
}
