/**
 * Variable manager composable
 * Provides a reactive interface for variable management
 */

import { ref, computed, watch, onMounted, onUnmounted, type Ref, type ComputedRef } from 'vue'

import type { AppServices } from '../../types/services'
import type { IVariableManager, ConversationMessage } from '../../types/variable'
import { VariableManager, createVariableManager } from '../../services/VariableManager'

export interface VariableManagerOptions {
  autoSync?: boolean  // Whether to sync the variable state automatically
  context?: Record<string, unknown>  // Context used to resolve predefined variables
}

export interface VariableManagerHooks {
  // Variable manager instance
  variableManager: Ref<IVariableManager | null>
  
  // State
  isReady: Ref<boolean>
  isAdvancedMode: Ref<boolean>
  customVariables: Ref<Record<string, string>>
  allVariables: Ref<Record<string, string>>
  statistics: Ref<{
    customVariableCount: number
    predefinedVariableCount: number
    totalVariableCount: number
    advancedModeEnabled: boolean
  }>
  
  // Methods
  setAdvancedMode: (enabled: boolean) => void
  addVariable: (name: string, value: string) => void
  updateVariable: (name: string, value: string) => void
  deleteVariable: (name: string) => void
  getVariable: (name: string) => string | undefined
  validateVariableName: (name: string) => boolean
  scanVariablesInContent: (content: string) => string[]
  replaceVariables: (content: string, variables?: Record<string, string>) => string
  detectMissingVariables: (content: string | ConversationMessage[]) => string[]
  
  // Session management
  getConversationMessages: () => ConversationMessage[]
  setConversationMessages: (messages: ConversationMessage[]) => void
  
  // Import/export
  exportVariables: () => string
  importVariables: (data: string) => void
  
  // Refresh state
  refresh: () => void
}

/**
 * Use the variable manager
 * @param services - Service instance, supports Ref or ComputedRef
 * @param options - Config options
 */
export function useVariableManager(
  services: Ref<AppServices | null> | ComputedRef<AppServices | null>,
  options: VariableManagerOptions = {}
): VariableManagerHooks {
  
  const variableManager = ref<IVariableManager | null>(null)
  const isReady = ref(false)
  
  // Reactive state
  const isAdvancedMode = ref(false)
  const customVariables = ref<Record<string, string>>({})
  const allVariables = ref<Record<string, string>>({})
  
  // Statistics
  const statistics = computed(() => {
    if (!variableManager.value) {
      return {
        customVariableCount: 0,
        predefinedVariableCount: 0,
        totalVariableCount: 0,
        advancedModeEnabled: false
      }
    }
    return variableManager.value.getStatistics()
  })
  
  // Initialize the variable manager
  const initializeVariableManager = async () => {
    if (!services.value?.preferenceService) {
      isReady.value = false
      return
    }

    try {
      // Use the factory function, which waits for initialization to complete automatically
      const manager = await createVariableManager(services.value.preferenceService)
      variableManager.value = manager
      refreshState()
      isReady.value = true
    } catch (error) {
      console.error('[useVariableManager] Failed to initialize variable manager:', error)
      isReady.value = false
    }
  }
  
  // Refresh state
  const refreshState = () => {
    if (!variableManager.value) {
      return
    }

    try {
      isAdvancedMode.value = variableManager.value.getAdvancedModeEnabled()
      customVariables.value = variableManager.value.listVariables()
      allVariables.value = variableManager.value.resolveAllVariables(options.context)
    } catch (error) {
      console.error('[useVariableManager] Failed to refresh state:', error)
    }
  }
  
  // Method implementations
  const setAdvancedMode = (enabled: boolean) => {
    if (!variableManager.value) return
    
    try {
      variableManager.value.setAdvancedModeEnabled(enabled)
      refreshState()
    } catch (error) {
      console.error('[useVariableManager] Failed to set advanced mode:', error)
    }
  }
  
  const addVariable = (name: string, value: string) => {
    if (!variableManager.value) return
    
    try {
      variableManager.value.setVariable(name, value)
      refreshState()
    } catch (error) {
      console.error(`[useVariableManager] Failed to add variable ${name}:`, error)
      throw error
    }
  }
  
  const updateVariable = (name: string, value: string) => {
    if (!variableManager.value) return
    
    try {
      variableManager.value.setVariable(name, value)
      refreshState()
    } catch (error) {
      console.error(`[useVariableManager] Failed to update variable ${name}:`, error)
      throw error
    }
  }
  
  const deleteVariable = (name: string) => {
    if (!variableManager.value) return
    
    try {
      variableManager.value.deleteVariable(name)
      refreshState()
    } catch (error) {
      console.error(`[useVariableManager] Failed to delete variable ${name}:`, error)
      throw error
    }
  }
  
  const getVariable = (name: string): string | undefined => {
    return variableManager.value?.getVariable(name)
  }
  
  const validateVariableName = (name: string): boolean => {
    return variableManager.value?.validateVariableName(name) ?? false
  }
  
  const scanVariablesInContent = (content: string): string[] => {
    return variableManager.value?.scanVariablesInContent(content) ?? []
  }
  
  const replaceVariables = (content: string, variables?: Record<string, string>): string => {
    if (!variableManager.value) return content
    return variableManager.value.replaceVariables(content, variables)
  }
  
  const detectMissingVariables = (content: string | ConversationMessage[]): string[] => {
    if (!variableManager.value) return []
    return variableManager.value.detectMissingVariables(content)
  }
  
  // Session management methods
  const getConversationMessages = (): ConversationMessage[] => {
    return variableManager.value?.getLastConversationMessages() ?? []
  }
  
  const setConversationMessages = (messages: ConversationMessage[]) => {
    if (!variableManager.value) return
    
    try {
      variableManager.value.setLastConversationMessages(messages)
    } catch (error) {
      console.error('[useVariableManager] Failed to set conversation messages:', error)
    }
  }
  
  // Import/export methods
  const exportVariables = (): string => {
    return variableManager.value?.exportVariables() ?? ''
  }
  
  const importVariables = (data: string) => {
    if (!variableManager.value) return
    
    try {
      variableManager.value.importVariables(data)
      refreshState()
    } catch (error) {
      console.error('[useVariableManager] Failed to import variables:', error)
      throw error
    }
  }
  
  // Watch service changes
  watch(services, (newServices) => {
    if (newServices?.preferenceService) {
      initializeVariableManager()
    } else {
      variableManager.value = null
      isReady.value = false
    }
  }, { immediate: true })
  
  // Watch context changes and refresh allVariables automatically
  if (options.autoSync) {
    watch(() => options.context, () => {
      if (variableManager.value) {
        allVariables.value = variableManager.value.resolveAllVariables(options.context)
      }
    }, { deep: true })
  }
  
  // Lifecycle
  onMounted(() => {
    if (services.value?.preferenceService) {
      initializeVariableManager()
    }
  })
  
  onUnmounted(() => {
    // Clean up resources
    variableManager.value = null
    isReady.value = false
  })
  
  return {
    // State
    variableManager,
    isReady,
    isAdvancedMode,
    customVariables,
    allVariables,
    statistics,
    
    // Methods
    setAdvancedMode,
    addVariable,
    updateVariable,
    deleteVariable,
    getVariable,
    validateVariableName,
    scanVariablesInContent,
    replaceVariables,
    detectMissingVariables,
    
    // Session management
    getConversationMessages,
    setConversationMessages,
    
    // Import/export
    exportVariables,
    importVariables,
    
    // Utility methods
    refresh: refreshState
  }
}
