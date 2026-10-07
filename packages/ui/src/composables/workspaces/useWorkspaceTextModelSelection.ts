/**
 * Workspace Text model selection logic (shared, used by image mode)
 *
 * Features:
 * - Read/write selectedTextModelKey from the session store
 * - Refresh the text model option list
 * - Automatically fall back to selecting the first available model (write back to the session store, single source of truth)
 * - Race protection (avoids old requests overwriting new ones caused by rapid switching/refreshing)
 *
 * @param services - AppServices instance
 * @param sessionStore - Session store instance (ImageText2ImageSession / ImageImage2ImageSession)
 */
import { computed, ref, watch, type Ref } from 'vue'
import type { AppServices } from '../../types/services'
import type { ModelSelectOption } from '../../types/select-options'
import { DataTransformer } from '../../utils/data-transformer'

type WorkspaceTextModelSessionStore = {
  selectedTextModelKey: string
  updateTextModel: (key: string) => void
}

export function useWorkspaceTextModelSelection<T extends WorkspaceTextModelSessionStore>(
  services: Ref<AppServices | null>,
  sessionStore: T
) {
  const textModelOptions = ref<ModelSelectOption[]>([])

  const selectedTextModelKey = computed<string>({
    get: () => sessionStore.selectedTextModelKey ?? '',
    set: (value: string) => sessionStore.updateTextModel(value || '')
  })

  let refreshToken = 0
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

    const token = ++refreshToken
    try {
      await ensureInitializedIfSupported(mgr)

      const enabledModels = await mgr.getEnabledModels()
      if (token !== refreshToken) return

      textModelOptions.value = DataTransformer.modelsToSelectOptions(enabledModels)

      const fallback = textModelOptions.value[0]?.value || ''
      const keys = new Set(textModelOptions.value.map(opt => opt.value))
      const current = selectedTextModelKey.value

      const invalid = current && !keys.has(current)
      const emptyNeedsFallback = !current && !!fallback
      if ((invalid || emptyNeedsFallback) && fallback) {
        selectedTextModelKey.value = fallback
      }
    } catch (error) {
      console.error('[useWorkspaceTextModelSelection] refreshTextModels failed:', error instanceof Error ? error.message : String(error), error)
      textModelOptions.value = []
    }
  }

  watch(
    () => services.value?.modelManager,
    () => {
      void refreshTextModels()
    },
    { immediate: true }
  )

  return {
    textModelOptions,
    selectedTextModelKey,
    refreshTextModels,
  }
}
