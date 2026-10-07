/**
 * Function model manager composable
 *
 * Provides a reactive interface for the evaluation model config
 */

import { ref, computed, watch, type Ref, type ComputedRef } from 'vue'
import { usePreferences } from '../storage/usePreferenceManager'
import {
  FUNCTION_MODEL_KEYS,
} from '@prompt-optimizer/core'
import type { AppServices } from '../../types/services'

/**
 * Function model manager return interface
 */
export interface UseFunctionModelManagerReturn {
  /** Evaluation model */
  evaluationModel: Ref<string>
  /** Effective evaluation model (follows the current global optimize model if not set) */
  effectiveEvaluationModel: ComputedRef<string>
  /** Whether loading */
  isLoading: Ref<boolean>
  /** Whether initialized */
  isInitialized: Ref<boolean>

  /** Set the evaluation model */
  setEvaluationModel: (modelId: string) => Promise<void>
  /** Get the effective evaluation model (compatible with the old API) */
  getEffectiveEvaluationModel: () => ComputedRef<string>

  /** Initialize */
  initialize: () => Promise<void>
  /** Refresh the config */
  refresh: () => Promise<void>
}

// Global singleton instance (the evaluation model config is global and shared by all components)
// Note: the singleton pattern fits the current architecture (Web/Extension/Desktop each run in their own process/page)
// If a multi-host scenario on the same page ever appears, switch to a keyed singleton or dependency injection
let instance: UseFunctionModelManagerReturn | null = null
// Keep an updatable reference to globalOptimizeModelKey
let globalOptimizeModelKeyRef: Ref<string> | ComputedRef<string> | null = null

/**
 * Function model manager composable
 *
 * Uses the global singleton pattern, because the evaluation model config is a global setting and does not need to be distinguished by services.
 *
 * Architecture constraints:
 * - Web/Extension/Desktop currently run independently and do not share a JS context
 * - The singleton binds the services passed in first, and later calls reuse the same instance
 * - For multi-host support, use resetFunctionModelManagerSingleton() to reset or switch to a keyed singleton
 */
export function useFunctionModelManager(
  services: Ref<AppServices | null>,
  globalOptimizeModelKey?: Ref<string> | ComputedRef<string>
): UseFunctionModelManagerReturn {
  // If a new globalOptimizeModelKey is passed in, update the reference
  if (globalOptimizeModelKey) {
    globalOptimizeModelKeyRef = globalOptimizeModelKey
  }

  // If an instance already exists, return it directly (the evaluation model config is global)
  if (instance) {
    return instance
  }

  const { getPreference, setPreference } = usePreferences(services)

  const isLoading = ref(false)
  const isInitialized = ref(false)
  const evaluationModel = ref('')
  const globalOptimizeModelFallback = ref('')
  let initPromise: Promise<void> | null = null

  // Create a fixed computed (created only once)
  // Use the global globalOptimizeModelKeyRef to make sure parameters passed in later take effect
  const effectiveEvaluationModel = computed(() => {
    // Priority:
    // 1) The evaluation model configured by the user
    // 2) The global optimize model key passed in by the caller (runtime state)
    // 3) The global optimize model read from the preferences (persisted state)
    return (
      evaluationModel.value ||
      globalOptimizeModelKeyRef?.value ||
      globalOptimizeModelFallback.value
    )
  })

  // Initialize
  const initialize = async (): Promise<void> => {
    if (initPromise) {
      return initPromise
    }

    initPromise = (async () => {
      if (isInitialized.value) return

      isLoading.value = true
      try {
        // Fallback: pick one from the currently available models
        if (services.value?.modelManager) {
          const allModels = await services.value.modelManager.getAllModels()
          const enabledModels = allModels.filter(m => m.enabled)
          globalOptimizeModelFallback.value = enabledModels[0]?.id || ''
        } else {
          globalOptimizeModelFallback.value = ''
        }

        // Read the evaluation model
        const savedEvaluationModel = await getPreference(
          FUNCTION_MODEL_KEYS.EVALUATION_MODEL,
          ''
        )
        evaluationModel.value = savedEvaluationModel

        isInitialized.value = true
      } finally {
        isLoading.value = false
      }
    })()

    return initPromise
  }

  const refresh = async (): Promise<void> => {
    isInitialized.value = false
    initPromise = null
    await initialize()
  }

  // Set the evaluation model
  const setEvaluationModel = async (modelId: string): Promise<void> => {
    evaluationModel.value = modelId
    await setPreference(FUNCTION_MODEL_KEYS.EVALUATION_MODEL, modelId)
  }

  // Get the effective evaluation model (returns the same computed instance)
  const getEffectiveEvaluationModel = (): ComputedRef<string> => {
    return effectiveEvaluationModel
  }

  // Watch service changes and initialize automatically
  watch(
    services,
    async (newServices) => {
      if (newServices && !isInitialized.value) {
        await initialize()
      }
    },
    { immediate: true }
  )

  instance = {
    evaluationModel,
    effectiveEvaluationModel,
    isLoading,
    isInitialized,
    setEvaluationModel,
    getEffectiveEvaluationModel,
    initialize,
    refresh,
  }

  return instance
}

/**
 * Reset the singleton (for testing)
 */
export function resetFunctionModelManagerSingleton(): void {
  instance = null
  globalOptimizeModelKeyRef = null
}
