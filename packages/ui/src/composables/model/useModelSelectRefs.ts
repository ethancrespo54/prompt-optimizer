import { ref, nextTick, type Ref } from 'vue'


// Type definition of the model selector component instance
interface ModelSelectInstance {
  refresh?: () => Promise<void>
}

export interface ModelSelectRefsHooks {
  optimizeModelSelect: Ref<ModelSelectInstance | null>
  testModelSelect: Ref<ModelSelectInstance | null>
  refreshAll: () => Promise<void>
  refreshOptimize: () => Promise<void>
  refreshTest: () => Promise<void>
}

/**
 * Model selector ref management hook
 * Dedicated to managing the refs of model selector components and batch refresh operations
 * @returns ModelSelectRefsHooks
 */
export function useModelSelectRefs(): ModelSelectRefsHooks {
  const optimizeModelSelect = ref<ModelSelectInstance | null>(null)
  const testModelSelect = ref<ModelSelectInstance | null>(null)

  const refreshOptimize = async () => {
    await nextTick()
    try {
      await optimizeModelSelect.value?.refresh?.()
    } catch (error) {
      console.error('Failed to refresh optimize model select:', error)
    }
  }

  const refreshTest = async () => {
    await nextTick()
    try {
      await testModelSelect.value?.refresh?.()
    } catch (error) {
      console.error('Failed to refresh test model select:', error)
    }
  }

  const refreshAll = async () => {
    await Promise.all([
      refreshOptimize(),
      refreshTest()
    ])
  }

  return {
    optimizeModelSelect,
    testModelSelect,
    refreshAll,
    refreshOptimize,
    refreshTest
  }
}