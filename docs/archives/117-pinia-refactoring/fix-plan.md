# Pinia Refactoring Issue Fix Plan

**Based on the joint Claude + Codex review**

## 📋 Fix Checklist

### 🔴 P0 - Unify the Service Access Entry Point (Smallest Change)

**Decision**: Make `getPiniaServices()` the only business entry point

**Rationale** (Codex + Claude consensus):
- The current code already uses `getPiniaServices()` everywhere
- The functional style fits the Vue 3 Composition API better
- Simpler to test (no need to deal with the this context)
- Avoids the loss of this in setup stores
- Avoids diverging usage / misuse by new team members later

**Changes**:

#### 1. Modify `packages/ui/src/plugins/pinia-services-plugin.ts`

```typescript
/**
 * Pinia plugin: injects $services into all Stores
 *
 * ⚠️ Note: $services is only a debug/compatibility property and is not recommended in business code
 *
 * **Recommended**:
 * ```typescript
 * import { getPiniaServices } from '../plugins/pinia'
 *
 * const $services = getPiniaServices()
 * if ($services) {
 *   await $services.modelManager.getAllModels()
 * }
 * ```
 *
 * **Not recommended**:
 * ```typescript
 * // ❌ Avoid using this.$services in setup stores
 * this.$services?.modelManager.getAllModels()
 * ```
 *
 * Usage:
 * pinia.use(piniaServicesPlugin(servicesRef))
 */

import { type PiniaPluginContext } from 'pinia'
import type { AppServices } from '../types/services'

/**
 * Pinia services injection plugin
 *
 * @param servicesRef - reactive reference to the application services
 * @returns the Pinia plugin function
 */
export function piniaServicesPlugin(servicesRef: { value: AppServices | null }) {
  return (context: PiniaPluginContext) => {
    // Inject into the store instance
    // Note: assign the ref directly; Pinia unwraps it automatically
    // Accessing store.$services automatically returns servicesRef.value
    context.store.$services = servicesRef as any
  }
}

// TypeScript type extension
declare module 'pinia' {
  export interface PiniaCustomProperties {
    /**
     * Application services instance (debug/compatibility property, not recommended for business code)
     *
     * ⚠️ Note:
     * - What is actually injected is a Ref<AppServices | null>, but Pinia unwraps it automatically
     * - Use this.$services directly when accessing (already unwrapped)
     * - May be null during initialization; check before use
     * - **Prefer getPiniaServices() instead**
     *
     * @deprecated Prefer getPiniaServices() instead
     * @see getPiniaServices
     */
    $services: AppServices | null
  }
}
```

#### 2. Improve `packages/ui/src/plugins/pinia.ts`

```typescript
/**
 * Get the Pinia services instance
 *
 * Used to access services inside a Store; this is the **recommended way to access services**
 *
 * **Design notes**:
 * - This is the service access method recommended by this project (an engineering trade-off)
 * - Based on the singleton pattern, suitable for single-app scenarios
 * - In tests, use setPiniaServices() to set mock services
 * - After tests, call setPiniaServices(null) to clean up and avoid pollution
 *
 * **Why a function is recommended over this.$services**:
 * - Avoids dependence on the this context (this is lost when called after destructuring)
 * - Fits a functional programming style better and is consistent with the Composition API
 * - Simpler to test (call the function directly, no need to bind this)
 * - Setup Stores do not need to depend on this, so the code is clearer
 *
 * **Usage example**:
 * ```typescript
 * import { getPiniaServices } from '@/plugins/pinia'
 *
 * export const useMyStore = defineStore('myStore', () => {
 *   const loadData = async () => {
 *     const $services = getPiniaServices()
 *     if (!$services) {
 *       console.warn('Services not available')
 *       return
 *     }
 *
 *     const models = await $services.modelManager.getAllModels()
 *     // ...
 *   }
 *
 *   return { loadData }
 * })
 * ```
 *
 * @returns the application services instance (or null)
 */
export function getPiniaServices(): AppServices | null {
  return servicesRef.value
}
```

**Time estimate**: 30 minutes
**Risk assessment**: Low (only changes documentation and comments)

---

### 🟠 P1 - Standardize the Test Cleanup Mechanism (Combine Both)

**Decision** (Codex's suggestion): global afterEach as a safety net + a helper that provides the standard entry point

#### 1. Add Global Cleanup (Safety Net)

**File**: `packages/ui/tests/setup.ts` (create it if it doesn't exist)

```typescript
import { afterEach } from 'vitest'
import { setPiniaServices } from '../src/plugins/pinia'

/**
 * Global test cleanup
 * Ensures Pinia services are cleaned up after every test case to avoid test pollution
 */
afterEach(() => {
  setPiniaServices(null)
})
```

**Configure Vitest** (`packages/ui/vitest.config.ts`):
```typescript
export default defineConfig({
  test: {
    setupFiles: ['./tests/setup.ts'],  // ✅ add this line
    // ... other configuration
  }
})
```

#### 2. Provide a Standardized Helper

**File**: `packages/ui/tests/utils/pinia-test-helpers.ts` (new)

```typescript
import { createPinia, type Pinia } from 'pinia'
import { createApp } from 'vue'
import { setPiniaServices } from '../../src/plugins/pinia'
import { piniaServicesPlugin } from '../../src/plugins/pinia-services-plugin'
import type { AppServices } from '../../src/types/services'
import type { IPreferenceService } from '@prompt-optimizer/core'

/**
 * Create a PreferenceService stub (a reusable default implementation)
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
 * @param services - optional services object (a basic stub is created by default)
 * @returns { pinia, services, cleanup }
 *
 * @example
 * ```typescript
 * it('should save session', async () => {
 *   const { pinia, services, cleanup } = createTestPinia({
 *     preferenceService: createPreferenceServiceStub({
 *       set: vi.fn().mockResolvedValue(undefined)
 *     })
 *   })
 *
 *   const store = useBasicUserSession(pinia)
 *   await store.saveSession()
 *
 *   expect(services.preferenceService.set).toHaveBeenCalled()
 *   cleanup()  // optional: manual cleanup (the global afterEach is the safety net)
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
  // Create the default service stub
  const defaultServices: AppServices = {
    preferenceService: createPreferenceServiceStub(),
    // Other services can have default stubs added as needed
    ...servicesOverrides,
  } as AppServices

  // Create the Pinia instance
  const pinia = createPinia()
  pinia.use(piniaServicesPlugin({ value: defaultServices }))

  // Create the Vue app (required by Pinia)
  const app = createApp({ render: () => null })
  app.use(pinia)

  // Set the global services (used by getPiniaServices())
  setPiniaServices(defaultServices)

  // Provide the cleanup function
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
 * Run a test function with mock services (cleans up automatically)
 *
 * @param servicesOverrides - service override configuration
 * @param testFn - the test function
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
 *       // assertions...
 *     }
 *   )
 *   // Cleaned up automatically, no manual cleanup needed
 * })
 * ```
 */
export async function withMockPiniaServices(
  servicesOverrides: Partial<AppServices>,
  testFn: (ctx: { pinia: Pinia; services: AppServices }) => void | Promise<void>
): Promise<void> {
  const { pinia, services, cleanup } = createTestPinia(servicesOverrides)

  try {
    await testFn({ pinia, services })
  } finally {
    cleanup()
  }
}
```

#### 3. Update Existing Test Cases (Example)

**Before** (`packages/ui/tests/unit/pinia-services-plugin.test.ts`):
```typescript
it('allows session store to persist via preferenceService', async () => {
  const set = vi.fn<IPreferenceService['set']>().mockResolvedValue(undefined)
  const preferenceService = createPreferenceServiceStub({ set })
  const services = { preferenceService } as unknown as AppServices

  setPiniaServices(services)  // ⚠️ set manually

  const servicesRef = shallowRef<AppServices | null>(services)
  const pinia = createPinia()
  pinia.use(piniaServicesPlugin(servicesRef))
  createApp({ render: () => null }).use(pinia)

  const store = useBasicUserSession(pinia)
  store.updatePrompt('hello')
  await store.saveSession()

  expect(set).toHaveBeenCalledTimes(1)
  // ⚠️ No cleanup
})
```

**After** (using the helper):
```typescript
import { createTestPinia, createPreferenceServiceStub } from '../utils/pinia-test-helpers'

it('allows session store to persist via preferenceService', async () => {
  const set = vi.fn<IPreferenceService['set']>().mockResolvedValue(undefined)

  const { pinia, services } = createTestPinia({
    preferenceService: createPreferenceServiceStub({ set })
  })

  const store = useBasicUserSession(pinia)
  store.updatePrompt('hello')
  await store.saveSession()

  expect(set).toHaveBeenCalledTimes(1)
  // ✅ The global afterEach cleans up automatically, no manual cleanup needed
})
```

**Or use withMockPiniaServices** (more concise):
```typescript
import { withMockPiniaServices, createPreferenceServiceStub } from '../utils/pinia-test-helpers'

it('allows session store to persist via preferenceService', async () => {
  const set = vi.fn<IPreferenceService['set']>().mockResolvedValue(undefined)

  await withMockPiniaServices(
    { preferenceService: createPreferenceServiceStub({ set }) },
    async ({ pinia }) => {
      const store = useBasicUserSession(pinia)
      store.updatePrompt('hello')
      await store.saveSession()

      expect(set).toHaveBeenCalledTimes(1)
    }
  )
  // ✅ Cleaned up automatically
})
```

**Time estimate**: 2 hours
**Risk assessment**: Low (improves test infrastructure)

---

### 🟡 P2 - useTemporaryVariables Dependency Check (Explicit Error)

**Decision** (Codex's suggestion): detect explicitly and throw a clear error

#### Modify `packages/ui/src/composables/variable/useTemporaryVariables.ts`

```typescript
import { readonly, type Ref } from 'vue'
import { storeToRefs, getActivePinia } from 'pinia'
import { useTemporaryVariablesStore } from '../../stores/temporaryVariables'

/**
 * Temporary variable management composable
 *
 * Features:
 * - In-memory storage only (lost on refresh)
 * - The external interface is unchanged (compatible with old callers)
 * - State is held by a Pinia store underneath
 *
 * ⚠️ Prerequisite:
 * It must be called after `installPinia(app)` has been executed at the app entry point.
 * Using it in a non-component context (such as a pure function / service layer) throws an error.
 *
 * @throws {Error} If Pinia is not installed or there is no active pinia instance
 *
 * @example
 * ```typescript
 * // ✅ Correct: use inside a component or setup function
 * export default defineComponent({
 *   setup() {
 *     const tempVars = useTemporaryVariables()
 *     tempVars.setVariable('name', 'value')
 *   }
 * })
 *
 * // ❌ Wrong: use at module top level or in a pure function
 * const tempVars = useTemporaryVariables()  // will throw an error
 * ```
 */
export function useTemporaryVariables(): TemporaryVariablesManager {
  // ✅ Codex's suggestion: explicitly detect the active pinia
  const activePinia = getActivePinia()
  if (!activePinia) {
    throw new Error(
      '[useTemporaryVariables] Pinia not installed or no active pinia instance. ' +
      'Make sure you have called installPinia(app) before using this composable, ' +
      'and you are calling it within a component setup or after app is mounted.'
    )
  }

  const store = useTemporaryVariablesStore()
  const { temporaryVariables } = storeToRefs(store)

  return {
    temporaryVariables: readonly(temporaryVariables) as Readonly<
      Ref<Record<string, string>>
    >,
    setVariable: store.setVariable,
    getVariable: store.getVariable,
    deleteVariable: store.deleteVariable,
    clearAll: store.clearAll,
    hasVariable: store.hasVariable,
    listVariables: store.listVariables,
    batchSet: store.batchSet,
    batchDelete: store.batchDelete,
  }
}
```

**Optional upgrade** (if non-component contexts are needed):
```typescript
/**
 * @param pinia - optional Pinia instance (for non-component contexts)
 */
export function useTemporaryVariables(pinia?: Pinia): TemporaryVariablesManager {
  // If a pinia is provided, use it; otherwise get the active pinia
  const targetPinia = pinia || getActivePinia()

  if (!targetPinia) {
    throw new Error(
      '[useTemporaryVariables] Pinia not installed or no active pinia instance. ' +
      'Either call installPinia(app) first, or provide a pinia instance explicitly.'
    )
  }

  const store = useTemporaryVariablesStore(targetPinia)
  // ... the rest of the code is the same
}
```

**Time estimate**: 30 minutes
**Risk assessment**: Very low (only adds an error check)

---

## 🟢 P3 - Other Improvements (Optional)

### 1. Add an ESLint Rule (Prevent Circular Dependencies from Barrel Exports)

**File**: `.eslintrc.js` or `packages/ui/.eslintrc.js`

```javascript
module.exports = {
  // ... other configuration
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['**/stores', '**/stores/index'],
            message: 'Please import the specific store file directly to avoid circular dependencies from barrel exports. For example: import { useSessionManager } from "@/stores/session/useSessionManager"'
          }
        ]
      }
    ]
  }
}
```

**Time estimate**: 15 minutes
**Risk assessment**: Low

### 2. Strengthen the MessageChainMap Migration Logic

**File**: `packages/ui/src/composables/prompt/useConversationOptimization.ts`

```typescript
// ❌ Old implementation (string splitting)
const messageId = key.split(':')[1]

// ✅ New implementation (regex matching)
const PREFIX_PATTERN = /^(system|user):(.+)$/
for (const [key, chainId] of Object.entries(persistedMap)) {
  const match = key.match(PREFIX_PATTERN)
  if (match) {
    const messageId = match[2]  // ✅ keep the complete messageId
    messageChainMap.value.set(messageId, chainId)
  } else {
    // Already in the new format, use directly
    messageChainMap.value.set(key, chainId)
  }
}
```

**Time estimate**: 30 minutes
**Risk assessment**: Low (add unit tests for verification)

### 3. Introduce Error Monitoring

**File**: `packages/ui/src/utils/error-tracker.ts` (new)

```typescript
/**
 * Error tracking utility
 *
 * Can integrate services such as Sentry and Bugsnag
 */
export interface ErrorContext {
  context: string
  [key: string]: any
}

export function captureError(error: Error | unknown, context?: ErrorContext) {
  // Development environment: print to the console
  if (import.meta.env.DEV) {
    console.error('[ErrorTracker]', context, error)
  }

  // Production environment: send to the error monitoring service
  // if (import.meta.env.PROD) {
  //   Sentry.captureException(error, { extra: context })
  // }
}
```

**Time estimate**: 1 day (including integrating a third-party service)
**Risk assessment**: Low

---

## 📅 Implementation Plan

### Day 1 (P0 + P1)

- [ ] **Morning** (2 hours)
  - [ ] Modify the `pinia-services-plugin.ts` documentation (30 minutes)
  - [ ] Improve the `pinia.ts` documentation (30 minutes)
  - [ ] Create the `tests/setup.ts` global cleanup (15 minutes)
  - [ ] Create `tests/utils/pinia-test-helpers.ts` (45 minutes)

- [ ] **Afternoon** (2 hours)
  - [ ] Update existing test cases to use the helper (1.5 hours)
  - [ ] Run tests to verify (30 minutes)

### Day 2 (P2 + P3)

- [ ] **Morning** (1 hour)
  - [ ] Modify `useTemporaryVariables.ts` to add the check (30 minutes)
  - [ ] Run tests to verify (30 minutes)

- [ ] **Afternoon** (optional, 1 hour)
  - [ ] Add the ESLint rule (15 minutes)
  - [ ] Strengthen the migration logic (30 minutes)
  - [ ] Final testing and documentation update (15 minutes)

**Total time**: 5-6 hours (P0+P1+P2 are mandatory)

---

## ✅ Acceptance Criteria

### P0 - Service Access Entry Point

- [ ] All documentation uniformly recommends `getPiniaServices()`
- [ ] `$services` is marked `@deprecated`
- [ ] Code review confirms no new `this.$services` usage

### P1 - Test Cleanup

- [ ] Global `afterEach` cleanup is configured
- [ ] `pinia-test-helpers.ts` is created and exported
- [ ] At least 2 test cases already use the new helper
- [ ] All tests pass (194/194)

### P2 - Dependency Check

- [ ] `useTemporaryVariables` adds a `getActivePinia()` check
- [ ] The error message is clear and friendly
- [ ] Unit tests verify the error-throwing scenario

### P3 - Optional Improvements

- [ ] ESLint rule is added (optional)
- [ ] Migration logic is strengthened (optional)

---

## 🎯 Expected Benefits

1. **Eliminate team confusion**: unified service access conventions, so new members are no longer confused
2. **Improve test quality**: a standardized helper reduces duplicated code, and global cleanup prevents pollution
3. **Improve error messages**: explicit error messages speed up troubleshooting
4. **Reduce maintenance cost**: clear coding conventions and tooling support

---

**Author**: Claude Code + Codex AI
**Approver**: TBD
**Implementer**: TBD
**Completion date**: Suggested to complete P0+P1 this week and P2 next week
