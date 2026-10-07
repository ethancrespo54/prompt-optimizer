import { watch, computed, reactive, nextTick, type Ref } from 'vue'

import { useToast } from '../ui/useToast'
import { useI18n } from 'vue-i18n'
import type { AppServices } from '../../types/services'
import type { ModelSelectRefsHooks } from './useModelSelectRefs'

export interface ModelManagerHooks {
  showConfig: boolean
  isModelSelectionReady: boolean
  handleModelManagerClose: () => void
  handleModelsUpdated: (modelKey: string) => void
  initModelSelection: () => void
  loadModels: () => void
}

/**
 * Model manager hook (only responsible for refreshing model configs/lists; no longer responsible for persisting model "selection")
 *
 * Design notes:
 * - Model selection has moved to the Session Store of each mode (single source of truth)
 * - No "global model selection key" is read or written here anymore, avoiding dual sources and sync complexity
 */
export function useModelManager(
  services: Ref<AppServices | null>,
  modelSelectRefs: ModelSelectRefsHooks,
): ModelManagerHooks {
  const toast = useToast()
  const { t } = useI18n()

  const modelManager = computed(() => services.value?.modelManager)

  const state = reactive<ModelManagerHooks>({
    showConfig: false,
    isModelSelectionReady: false,
    handleModelManagerClose: () => {
      state.showConfig = false

      nextTick(async () => {
        try {
          await state.loadModels()
          await modelSelectRefs.refreshAll()
        } catch (error) {
          console.error('[ModelManager] Failed to refresh models after close:', error)
        }
      })
    },
    handleModelsUpdated: (modelKey: string) => {
      console.log(t('toast.info.modelUpdated'), modelKey)
    },
    initModelSelection: async () => {
      try {
        if (!modelManager.value) return
        await modelManager.value.getAllModels()
        state.isModelSelectionReady = true
      } catch (error) {
        console.error(t('toast.error.initModelSelectFailed'), error)
        toast.error(t('toast.error.initModelSelectFailed'))
        state.isModelSelectionReady = true
      }
    },
    loadModels: async () => {
      try {
        if (!modelManager.value) return
        await modelManager.value.getAllModels()
      } catch (error) {
        console.error(t('toast.error.loadModelsFailed'), error)
        toast.error(t('toast.error.loadModelsFailed'))
      }
    },
  })

  watch(
    services,
    async () => {
      if (services.value?.modelManager) {
        await state.initModelSelection()
      }
    },
    { immediate: true },
  )

  return state
}
