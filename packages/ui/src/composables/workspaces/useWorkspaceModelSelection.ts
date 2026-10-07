/**
 * Workspace model selection logic (shared)
 *
 * Features:
 * - Read/write selectedOptimizeModelKey and selectedTestModelKey from the session store
 * - Refresh the text model option list
 * - Provide selectedTestModelInfo (used for display in the test area)
 * - Set defaults automatically (fallback, single source of truth: write back to the session store)
 * - Race protection (avoids old requests overwriting new ones caused by rapid switching/refreshing)
 *
 * @param services - AppServices instance
 * @param sessionStore - Session store instance (ProMultiMessageSession or ProVariableSession)
 */
import { computed, ref, watch, type Ref } from 'vue'
import type { AppServices } from '../../types/services'
import type { ModelSelectOption } from '../../types/select-options'
import { DataTransformer } from '../../utils/data-transformer'

type WorkspaceModelSessionStore = {
  selectedOptimizeModelKey: string
  selectedTestModelKey: string
  updateOptimizeModel: (key: string) => void
  updateTestModel: (key: string) => void
}

export function useWorkspaceModelSelection<T extends WorkspaceModelSessionStore>(
  services: Ref<AppServices | null>,
  sessionStore: T
) {
  const textModelOptions = ref<ModelSelectOption[]>([])

  // Optimize model (two-way binding)
  const selectedOptimizeModelKey = computed<string>({
    get: () => sessionStore.selectedOptimizeModelKey ?? '',
    set: (value: string) => {
      sessionStore.updateOptimizeModel(value || '')
    }
  })

  // Test model (two-way binding)
  const selectedTestModelKey = computed<string>({
    get: () => sessionStore.selectedTestModelKey ?? '',
    set: (value: string) => {
      sessionStore.updateTestModel(value || '')
    }
  })

  // Optimize model info (derived)
  const selectedOptimizeModelInfo = computed(() => {
    const key = selectedOptimizeModelKey.value
    const option = textModelOptions.value.find(opt => opt.value === key)
    return {
      provider: option?.raw?.providerMeta?.name || null,
      model: option?.raw?.modelMeta?.name || null
    }
  })

  // Test model info (derived)
  const selectedTestModelInfo = computed(() => {
    const key = selectedTestModelKey.value
    const option = textModelOptions.value.find(opt => opt.value === key)
    return {
      provider: option?.raw?.providerMeta?.name || null,
      model: option?.raw?.modelMeta?.name || null
    }
  })

  // Refresh the model list
  let refreshModelToken = 0
  const ensureInitializedIfSupported = async (manager: unknown) => {
    if (!manager || typeof manager !== 'object') return
    const m = manager as { ensureInitialized?: () => Promise<void> }
    if (typeof m.ensureInitialized === 'function') {
      await m.ensureInitialized()
    }
  }

  const refreshTextModels = async () => {
    const mgr = services.value?.modelManager
    if (!mgr) {
      textModelOptions.value = []
      return
    }

    const token = ++refreshModelToken
    try {
      await ensureInitializedIfSupported(mgr)

      const enabledModels = await mgr.getEnabledModels()
      if (token !== refreshModelToken) return

      textModelOptions.value = DataTransformer.modelsToSelectOptions(enabledModels)

      // Automatic fallback: if the currently selected model is not in the list, use the first one
      const fallback = textModelOptions.value[0]?.value || ''
      const modelKeys = new Set(textModelOptions.value.map(opt => opt.value))

       // Optimize model
       if (selectedOptimizeModelKey.value && !modelKeys.has(selectedOptimizeModelKey.value)) {
        selectedOptimizeModelKey.value = fallback
       }
       // Test model
       if (selectedTestModelKey.value && !modelKeys.has(selectedTestModelKey.value)) {
        selectedTestModelKey.value = fallback
       }
 
       // Only set the default when no model is selected at all
      if (!selectedOptimizeModelKey.value && fallback) {
        selectedOptimizeModelKey.value = fallback
       }
      if (!selectedTestModelKey.value && fallback) {
        selectedTestModelKey.value = fallback
       }

    } catch (error) {
      console.error('[useWorkspaceModelSelection] refreshTextModels failed:', error instanceof Error ? error.message : String(error), error)
      textModelOptions.value = []
    }
  }

  // Watch modelManager changes: aligned with template selection (refresh automatically once the component is ready)
  watch(
    () => services.value?.modelManager,
    () => {
      void refreshTextModels()
    },
    { immediate: true }
  )

  return {
    textModelOptions,
    selectedOptimizeModelKey,
    selectedTestModelKey,
    selectedOptimizeModelInfo,
    selectedTestModelInfo,
    refreshTextModels
  }
}
