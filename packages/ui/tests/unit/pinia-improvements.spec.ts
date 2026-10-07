/**
 * Pinia improvements test
 *
 * Regression tests added based on Codex suggestions:
 * 1. useTemporaryVariables() throws when there is no active pinia
 * 2. Cleanup/restore behavior of withMockPiniaServices()
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { setPiniaServices, getPiniaServices } from '../../src/plugins/pinia'
import { useTemporaryVariables } from '../../src/composables/variable/useTemporaryVariables'
import { createTestPinia, withMockPiniaServices, createPreferenceServiceStub } from '../utils/pinia-test-helpers'

describe('Pinia improvements test', () => {
  // Clean up global services before each test
  beforeEach(() => {
    setPiniaServices(null)
  })

  describe('useTemporaryVariables error handling', () => {
    it('should throw a clear error when there is no active pinia', () => {
      // ✅ Codex suggestion: test the error thrown when there is no active pinia
      expect(() => {
        useTemporaryVariables()
      }).toThrow('[useTemporaryVariables] Pinia not installed or no active pinia instance')
    })

    it('the error message should include installPinia guidance', () => {
      // ✅ Codex suggestion: make sure the error message includes guidance on how to fix it
      try {
        useTemporaryVariables()
        expect.fail('Should have thrown an error')
      } catch (error: any) {
        expect(error.message).toContain('installPinia(app)')
        expect(error.message).toContain('component setup')
      }
    })

    it('should work normally when there is an active pinia', () => {
      // Create the test environment
      const { pinia } = createTestPinia()

      // Should not throw
      expect(() => {
        useTemporaryVariables()
      }).not.toThrow()
    })
  })

  describe('withMockPiniaServices cleanup/restore behavior', () => {
    it('should restore to the service state before the call after the test', async () => {
      // ✅ Codex suggestion: test the "set → restore" behavior

      // 1. Set the initial services
      const initialService = { test: 'initial' } as any
      setPiniaServices(initialService)
      expect(getPiniaServices()).toBe(initialService)

      // 2. Use the new services inside withMockPiniaServices
      await withMockPiniaServices(
        { preferenceService: createPreferenceServiceStub() },
        async ({ services }) => {
          // Inside should be the new services
          expect(getPiniaServices()).not.toBe(initialService)
          expect(services.preferenceService).toBeDefined()
        }
      )

      // 3. After exiting, it should restore to the initial services
      expect(getPiniaServices()).toBe(initialService)
    })

    it('should support nested calls', async () => {
      // ✅ Codex suggestion: support nested helpers

      const outerService = { test: 'outer' } as any
      const innerService = { test: 'inner' } as any

      setPiniaServices(outerService)

      await withMockPiniaServices(
        { preferenceService: createPreferenceServiceStub() },
        async () => {
          const currentOuter = getPiniaServices()
          expect(currentOuter).not.toBe(outerService)

          // Nested call
          await withMockPiniaServices(
            { preferenceService: createPreferenceServiceStub() },
            async () => {
              const currentInner = getPiniaServices()
              expect(currentInner).not.toBe(currentOuter)
            }
          )

          // After exiting the inner call, it should restore to the outer one
          expect(getPiniaServices()).toBe(currentOuter)
        }
      )

      // After exiting the outer call, it should restore to the original
      expect(getPiniaServices()).toBe(outerService)
    })

    it('should still restore the state when the test function throws', async () => {
      // ✅ Test the error handling scenario

      const initialService = { test: 'initial' } as any
      setPiniaServices(initialService)

      try {
        await withMockPiniaServices(
          { preferenceService: createPreferenceServiceStub() },
          async () => {
            throw new Error('Test error')
          }
        )
        expect.fail('Should have thrown an error')
      } catch (error: any) {
        expect(error.message).toBe('Test error')
      }

      // Even if the test function throws, the state should be restored
      expect(getPiniaServices()).toBe(initialService)
    })

    it('should also restore correctly from a null state', async () => {
      // The initial state is null
      setPiniaServices(null)
      expect(getPiniaServices()).toBeNull()

      await withMockPiniaServices(
        { preferenceService: createPreferenceServiceStub() },
        async () => {
          expect(getPiniaServices()).not.toBeNull()
        }
      )

      // Should restore to null
      expect(getPiniaServices()).toBeNull()
    })
  })

  describe('createTestPinia basic functionality', () => {
    it('should create a preconfigured Pinia instance', () => {
      const { pinia, services, cleanup } = createTestPinia()

      expect(pinia).toBeDefined()
      expect(services).toBeDefined()
      expect(services.preferenceService).toBeDefined()
      expect(cleanup).toBeInstanceOf(Function)
    })

    it('should support service overrides', () => {
      const customGet = vi.fn()
      const { services } = createTestPinia({
        preferenceService: createPreferenceServiceStub({
          get: customGet
        })
      })

      expect(services.preferenceService.get).toBe(customGet)
    })

    it('cleanup should clear the global services', () => {
      const { cleanup } = createTestPinia()

      expect(getPiniaServices()).not.toBeNull()

      cleanup()

      expect(getPiniaServices()).toBeNull()
    })
  })
})
