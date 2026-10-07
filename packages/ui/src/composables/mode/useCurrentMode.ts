import { computed, ref, type Ref, type ComputedRef } from 'vue'

import { useFunctionMode, type FunctionMode } from './useFunctionMode'
import { useProSubMode } from './useProSubMode'
import type { ProSubMode } from '@prompt-optimizer/core'

/**
 * Return type of the read-only mode access composable
 */
export interface UseCurrentModeReturn {
  /** Current function mode (first-level mode) */
  functionMode: ComputedRef<FunctionMode>
  /** Current Pro sub-mode (second-level mode, only valid in Pro mode) */
  proSubMode: ComputedRef<ProSubMode>
  /** Whether in basic mode */
  isBasicMode: ComputedRef<boolean>
  /** Whether in context mode (Pro mode) */
  isProMode: ComputedRef<boolean>
  /** Whether in image mode */
  isImageMode: ComputedRef<boolean>
  /** Whether in multi-message mode (Pro mode + multi sub-mode) */
  isMultiMode: ComputedRef<boolean>
  /** Whether in variable mode (Pro mode + variable sub-mode) */
  isVariableMode: ComputedRef<boolean>
}

/**
 * Read-only mode access composable
 *
 * **Use cases**:
 * For UI components that only need to read the current mode state without modifying the mode.
 * For example: showing/hiding some UI elements by mode, or adjusting component behavior by mode.
 *
 * **Core features**:
 * - ✅ No need to pass the services parameter, simpler to use
 * - ✅ Accesses the global singleton mode state, guaranteeing data consistency
 * - ✅ Read-only access with no ability to modify, avoiding accidental operations
 * - ✅ Provides convenient boolean computed properties
 *
 * **Why services is not needed**:
 * - `useFunctionMode` and `useProSubMode` manage state with the singleton pattern
 * - The singleton has already loaded its data (from preferenceService) when App.vue initializes
 * - Components only need to read the in-memory singleton state, with no need to access preferenceService
 * - Passing `null` services does not affect reads; it only errors when trying to write (consistent with the read-only design)
 *
 * **Relationship with useFunctionMode/useProSubMode**:
 * - Reuses the singleton pattern of the existing composables, avoiding duplicate implementation
 * - Provides a friendlier read-only interface that hides the write capability
 * - Adds convenient boolean checks to reduce repeated code in components
 *
 * **Architecture notes**:
 * ```
 * App.vue (has services)
 *   └─> useFunctionMode(services)  <── responsible for initialization and persistence
 *         └─> Singleton (in-memory state)
 *
 * UI Component (no services)
 *   └─> useCurrentMode()  <── read-only access
 *         └─> useFunctionMode(null)
 *               └─> Singleton (in-memory state, same reference)
 * ```
 *
 * @example
 * ```typescript
 * // Use in a UI component
 * const { isBasicMode, isProMode, functionMode } = useCurrentMode()
 *
 * // Conditional rendering by mode
 * const showVariableForm = computed(() => {
 *   if (isBasicMode.value) return false  // Basic mode does not show variable features
 *   return true
 * })
 *
 * // Adjust behavior by mode
 * watch(functionMode, (mode) => {
 *   console.log('Current mode:', mode)
 * })
 * ```
 *
 * @returns Reactive object containing the read-only mode state
 */
export function useCurrentMode(): UseCurrentModeReturn {
  // Access the singleton state with null services (read-only mode)
  const nullServices = ref(null) as Ref<null>

  // Get the read-only references of the function mode and the Pro sub-mode
  const { functionMode: _functionMode } = useFunctionMode(nullServices)
  const { proSubMode: _proSubMode } = useProSubMode(nullServices)

  return {
    // Base state (wrapped as computed to provide type safety)
    functionMode: computed(() => _functionMode.value),
    proSubMode: computed(() => _proSubMode.value),

    // Convenient boolean checks (first-level mode)
    isBasicMode: computed(() => _functionMode.value === 'basic'),
    isProMode: computed(() => _functionMode.value === 'pro'),
    isImageMode: computed(() => _functionMode.value === 'image'),

    // Convenient boolean checks (second-level mode, only valid in Pro mode)
    isMultiMode: computed(() =>
      _functionMode.value === 'pro' && _proSubMode.value === 'multi'
    ),
    isVariableMode: computed(() =>
      _functionMode.value === 'pro' && _proSubMode.value === 'variable'
    ),
  }
}
