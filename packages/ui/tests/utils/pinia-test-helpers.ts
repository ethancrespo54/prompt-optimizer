/**
 * Pinia test helpers
 *
 * Provides standardized Pinia test setup and cleanup mechanisms
 *
 * Design principles (based on Codex suggestions):
 * - A global afterEach fallback cleanup (configured in tests/setup.ts)
 * - Helpers provide the standard test entry point (shorter, more consistent)
 * - Using both together means nothing breaks even if a helper forgets to clean up
 */

import { createPinia, type Pinia } from 'pinia'
import { createApp } from 'vue'
import { setPiniaServices, getPiniaServices } from '../../src/plugins/pinia'
import type { AppServices } from '../../src/types/services'
import type { IPreferenceService } from '@prompt-optimizer/core'

/**
 * Create a PreferenceService stub (reusable default implementation)
 *
 * @param overrides - Optional method overrides
 * @returns PreferenceService stub
 *
 * @example
 * ```typescript
 * const preferenceService = createPreferenceServiceStub({
 *   get: vi.fn().mockResolvedValue('saved-data'),
 *   set: vi.fn().mockResolvedValue(undefined)
 * })
 * ```
 */
export function createPreferenceServiceStub(
  overrides: Partial<IPreferenceService> = {}
): IPreferenceService {
  return {
    get: async <T,>(_key: string, defaultValue: T) => defaultValue,
    set: async () => {},
    delete: async () => {},
    keys: async () => [],
    clear: async () => {},
    getAll: async () => ({}),
    exportData: async () => ({}),
    importData: async () => {},
    getDataType: async () => 'preference',
    validateData: async () => true,
    ...overrides,
  }
}

/**
 * Create a Pinia instance and services for testing
 *
 * This is the standard test entry point suggested by Codex, providing:
 * - A preconfigured Pinia instance
 * - Default service stubs (overridable)
 * - A cleanup function (optional to call; the global afterEach is the fallback)
 *
 * @param servicesOverrides - Optional service overrides
 * @returns { pinia, services, cleanup }
 *
 * @example
 * ```typescript
 * it('should save session', async () => {
 *   const { pinia, services } = createTestPinia({
 *     preferenceService: createPreferenceServiceStub({
 *       set: vi.fn().mockResolvedValue(undefined)
 *     })
 *   })
 *
 *   const store = useBasicUserSession(pinia)
 *   await store.saveSession()
 *
 *   expect(services.preferenceService.set).toHaveBeenCalled()
 *   // Cleanup is done automatically by the global afterEach; no manual cleanup needed
 * })
 * ```
 */
export function createTestPinia(
  servicesOverrides: Partial<AppServices> = {}
): {
  pinia: Pinia
  services: AppServices
  cleanup: () => void
} {
  // Create default service stubs
  const defaultServices: AppServices = {
    preferenceService: createPreferenceServiceStub(),
    // Other services can have default stubs added as needed
    ...servicesOverrides,
  } as AppServices

  // Create the Pinia instance
  const pinia = createPinia()

  // Create the Vue app (Pinia requires it)
  const app = createApp({ render: () => null })
  app.use(pinia)

  // Set global services (used by getPiniaServices())
  setPiniaServices(defaultServices)

  // Provide a cleanup function (optional to call; the global afterEach is the fallback)
  const cleanup = () => {
    setPiniaServices(null)
  }

  return {
    pinia,
    services: defaultServices,
    cleanup,
  }
}

/**
 * Run a test function with mock services (automatic cleanup/restore)
 *
 * This is a more concise test entry point, suitable for scenarios that need automatic cleanup.
 *
 * ✅ Codex suggestion: support nested calls and restoration
 * - On exit, restore to the services from before the call instead of always setting null
 * - Avoids problems with nested helpers or switching services multiple times in one test case
 *
 * @param servicesOverrides - Service override config
 * @param testFn - Test function
 *
 * @example
 * ```typescript
 * it('should work with services', async () => {
 *   await withMockPiniaServices(
 *     {
 *       preferenceService: createPreferenceServiceStub({
 *         get: vi.fn().mockResolvedValue('saved-data')
 *       })
 *     },
 *     async ({ pinia, services }) => {
 *       const store = useBasicUserSession(pinia)
 *       await store.restoreSession()
 *       expect(store.prompt).toBe('saved-data')
 *     }
 *   )
 *   // Automatically restored to the state before the call
 * })
 *
 * // ✅ Supports nested calls
 * it('supports nested calls', async () => {
 *   await withMockPiniaServices({ service1 }, async () => {
 *     // Outer services
 *     await withMockPiniaServices({ service2 }, async () => {
 *       // Inner services
 *     })
 *     // Automatically restored to the outer services
 *   })
 * })
 * ```
 */
export async function withMockPiniaServices(
  servicesOverrides: Partial<AppServices>,
  testFn: (ctx: { pinia: Pinia; services: AppServices }) => void | Promise<void>
): Promise<void> {
  // ✅ Codex suggestion: save the services from before the call and restore them on exit
  const previousServices = getPiniaServices()

  const { pinia, services, cleanup } = createTestPinia(servicesOverrides)

  try {
    await testFn({ pinia, services })
  } finally {
    cleanup()
    // ✅ Restore to the state before the call (instead of always setting null)
    setPiniaServices(previousServices)
  }
}
