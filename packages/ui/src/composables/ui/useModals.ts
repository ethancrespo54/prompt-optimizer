import { computed, reactive, type Ref } from 'vue'

import { useToast } from './useToast'
import { useI18n } from 'vue-i18n'
import type { AppServices } from '../../types/services'

/**
 * Modal management hook
 * @param services Service instance reference
 * @param optimizeModelSelect Optimize model selector reference
 * @param testModelSelect Test model selector reference
 * @param loadModels Function that loads models
 * @param initTemplateSelection Function that initializes the template selection
 * @returns Modal management methods and state
 */
interface ModelSelectRef {
  refresh: () => void
}

export function useModals(
  services: Ref<AppServices | null>,
  optimizeModelSelect: Ref<ModelSelectRef | null>,
  testModelSelect: Ref<ModelSelectRef | null>,
  loadModels: () => Promise<void>,
  initTemplateSelection: () => Promise<void>
) {
  const toast = useToast()
  const { t } = useI18n()
  
  // Get the template manager reference
  const templateManager = computed(() => services.value?.templateManager)
  
  // Create a reactive state object
  const state = reactive({
    // Dialog state
    showConfig: false,
    showHistory: false,
    showTemplates: false,
    currentType: 'optimize',

    // Open the prompt manager
    openTemplateManager: (type = 'optimize') => {
      state.currentType = type
      state.showTemplates = true
    },

    // Close the prompt manager
    handleTemplateManagerClose: () => {
      // Template loading is now handled by useTemplateManager; here we only need to close the dialog
      state.showTemplates = false
    },

    // Close the model manager
    handleModelManagerClose: async () => {
      await loadModels()
      optimizeModelSelect.value?.refresh()
      testModelSelect.value?.refresh()
      state.showConfig = false
    }
  })

  return state
} 