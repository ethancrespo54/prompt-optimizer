/**
 * VCR system unit test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { VCR, getVCR, withVCR } from '../../../tests/utils/vcr'
import type { LLMRequest, StreamChunk } from '../../../tests/utils/vcr'
import { StreamSimulator } from '../../../tests/utils/stream-simulator'
import { existsSync, unlinkSync } from 'fs'
import { join } from 'path'

describe('VCR class', () => {
  const testFixtureDir = join(process.cwd(), 'test-fixtures-temp')
  const testRequest: LLMRequest = {
    provider: 'test',
    model: 'test-model',
    messages: [{ role: 'user', content: 'test message' }],
    stream: false
  }

  let vcr: VCR

  beforeEach(() => {
    vcr = new VCR({
      fixtureDir: testFixtureDir,
      mode: 'auto',
      enableRealLLM: false
    })
  })

  afterEach(() => {
    // Clean up test fixtures
    const fixturePath = vcr['getFixturePath']('test', 'test-scenario')
    if (existsSync(fixturePath)) {
      unlinkSync(fixturePath)
    }
  })

  describe('Constructor', () => {
    it('should use the default config', () => {
      const defaultVCR = new VCR()
      expect(defaultVCR).toBeDefined()
    })

    it('should use a custom config', () => {
      const customVCR = new VCR({
        fixtureDir: './custom-fixtures',
        mode: 'record'
      })
      expect(customVCR).toBeDefined()
    })
  })

  describe('intercept method', () => {
    it('off mode should call the real function directly', async () => {
      const offVCR = new VCR({ mode: 'off' })
      const realFn = vi.fn().mockResolvedValue({ result: 'real' })

      const result = await offVCR.intercept('test-scenario', testRequest, realFn)

      expect(realFn).toHaveBeenCalledOnce()
      expect(result).toEqual({ result: 'real' })
    })

    it('auto mode with a missing fixture should record (if the real LLM is enabled)', async () => {
      const vcrWithReal = new VCR({
        fixtureDir: testFixtureDir,
        mode: 'auto',
        enableRealLLM: true
      })

      const realFn = vi.fn().mockResolvedValue({
        content: 'test response',
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
      })

      const result = await vcrWithReal.intercept('test-scenario', testRequest, realFn)

      expect(realFn).toHaveBeenCalledOnce()
      expect(result).toEqual({
        content: 'test response',
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
      })

      // Verify the fixture was saved
      const fixturePath = vcrWithReal['getFixturePath']('test', 'test-scenario')
      expect(existsSync(fixturePath)).toBe(true)

      // Clean up
      if (existsSync(fixturePath)) {
        unlinkSync(fixturePath)
      }
    })

    it('auto mode with a missing fixture and the real LLM not enabled should throw an error', async () => {
      const realFn = vi.fn().mockResolvedValue({ result: 'real' })

      await expect(
        vcr.intercept('test-scenario', testRequest, realFn)
      ).rejects.toThrow('Real LLM is disabled')
    })
  })

  describe('getFixturePath method', () => {
    it('should generate the correct fixture path', () => {
      const path = vcr['getFixturePath']('openai', 'test-scenario')
      expect(path).toContain('openai')
      expect(path).toContain('test-scenario.json')
    })
  })

  describe('listFixtures method', () => {
    it('an empty directory should return an empty array', () => {
      const fixtures = vcr.listFixtures()
      expect(fixtures).toEqual([])
    })
  })
})

describe('StreamSimulator class', () => {
  const chunks: StreamChunk[] = [
    { content: 'Hello', timestamp: 0 },
    { content: ' ', timestamp: 50 },
    { content: 'World', timestamp: 100 },
    { content: '!', timestamp: 150 }
  ]

  describe('Constructor', () => {
    it('should use the default config', () => {
      const simulator = new StreamSimulator(chunks)
      expect(simulator).toBeDefined()
    })

    it('should use a custom config', () => {
      const simulator = new StreamSimulator(chunks, { timeScale: 0.5 })
      expect(simulator).toBeDefined()
    })
  })

  describe('getFullContent method', () => {
    it('should concatenate all chunks', () => {
      const simulator = new StreamSimulator(chunks)
      const content = simulator.getFullContent()
      expect(content).toBe('Hello World!')
    })
  })

  describe('getTotalDuration method', () => {
    it('should return the total duration', () => {
      const simulator = new StreamSimulator(chunks)
      const duration = simulator.getTotalDuration()
      expect(duration).toBe(150)
    })

    it('empty chunks should return 0', () => {
      const simulator = new StreamSimulator([])
      expect(simulator.getTotalDuration()).toBe(0)
    })
  })

  describe('getChunkCount method', () => {
    it('should return the number of chunks', () => {
      const simulator = new StreamSimulator(chunks)
      expect(simulator.getChunkCount()).toBe(4)
    })
  })

  describe('generate method', () => {
    it('should generate all chunks asynchronously', async () => {
      const simulator = new StreamSimulator(chunks, { timeScale: 0.01 })
      const generatedChunks: StreamChunk[] = []

      for await (const chunk of simulator.generate()) {
        generatedChunks.push(chunk)
      }

      expect(generatedChunks).toEqual(chunks)
    })

    it('should apply time scaling correctly', async () => {
      const simulator = new StreamSimulator(chunks, { timeScale: 0.5 })
      const startTime = Date.now()

      for await (const _ of simulator.generate()) {
        // Wait for all chunks
      }

      const duration = Date.now() - startTime
      // Originally 150ms, should be ~75ms after scaling
      expect(duration).toBeGreaterThan(50)
      expect(duration).toBeLessThan(150)
    })
  })

  describe('generateCallback method', () => {
    it('should process chunks with a callback function', async () => {
      const simulator = new StreamSimulator(chunks, { timeScale: 0.01 })
      const results: string[] = []

      await simulator.generateCallback(
        (chunk) => {
          results.push(chunk.content)
        },
        () => {
          results.push('DONE')
        }
      )

      expect(results).toEqual(['Hello', ' ', 'World', '!', 'DONE'])
    })

    it('should handle errors', async () => {
      const simulator = new StreamSimulator(chunks, { timeScale: 0.01 })
      const error = new Error('Test error')

      let caughtError: Error | null = null

      await simulator.generateCallback(
        () => {
          throw error
        },
        () => {},
        (err) => {
          caughtError = err
        }
      )

      expect(caughtError).toEqual(error)
    })
  })
})

describe('getVCR singleton function', () => {
  it('should return the same instance', () => {
    const vcr1 = getVCR()
    const vcr2 = getVCR()
    expect(vcr1).toBe(vcr2)
  })
})

describe('withVCR convenience function', () => {
  it('should call VCR.intercept correctly', async () => {
    const testRequest: LLMRequest = {
      provider: 'test',
      model: 'test-model',
      messages: [{ role: 'user', content: 'test' }],
      stream: false
    }

    const realFn = vi.fn().mockResolvedValue({ result: 'mock' })

    // Use off mode to avoid real recording
    const result = await withVCR(
      'test-scenario',
      testRequest,
      realFn,
      { mode: 'off' }
    )

    expect(realFn).toHaveBeenCalledOnce()
    expect(result).toEqual({ result: 'mock' })
  })
})

describe('Performance test', () => {
  it('streaming responses should complete within a reasonable time', async () => {
    const chunks: StreamChunk[] = Array.from({ length: 100 }, (_, i) => ({
      content: `chunk-${i}`,
      timestamp: i * 10
    }))

    const simulator = new StreamSimulator(chunks, { timeScale: 0.01 })
    const startTime = Date.now()

    let count = 0
    for await (const _ of simulator.generate()) {
      count++
    }

    const duration = Date.now() - startTime

    expect(count).toBe(100)
    // Originally 990ms, should be ~10ms after scaling
    expect(duration).toBeLessThan(100)
  })
})
