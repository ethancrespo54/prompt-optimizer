import { ref, watch, computed, reactive, type Ref } from 'vue'

import { useToast } from '../ui/useToast'
import { useI18n } from 'vue-i18n'

import { v4 as uuidv4 } from 'uuid'
import type { IHistoryManager, PromptRecordChain, PromptRecord } from '@prompt-optimizer/core'
import type { AppServices } from '../../types/services'

type PromptChain = PromptRecordChain

interface HistorySelectionContext {
  record: PromptRecord
  chainId: string
  rootPrompt: string
}

/**
 * Prompt history management hook
 * @param services Service instance reference
 * @param prompt Prompt
 * @param optimizedPrompt Optimized prompt
 * @param currentChainId Current chain ID
 * @param currentVersions Current version list
 * @param currentVersionId Current version ID
 * @returns Prompt history management interface
 */
export function usePromptHistory(
  services: Ref<AppServices | null>,
  prompt: Ref<string>,
  optimizedPrompt: Ref<string>,
  currentChainId: Ref<string>,
  currentVersions: Ref<PromptChain['versions']>,
  currentVersionId: Ref<string>
) {
  const toast = useToast()
  const { t } = useI18n()
  
  // History manager reference
  const historyManager = computed(() => services.value?.historyManager)

  // Create a reactive state object
  const state = reactive({
    history: [] as PromptChain[],
    showHistory: false,
    
    handleSelectHistory: async (context: HistorySelectionContext) => {
      try {
        const { record, chainId, rootPrompt } = context

        // Set the workspace content
        prompt.value = rootPrompt
        optimizedPrompt.value = record.optimizedPrompt

        // Load an existing chain (rather than creating a new one) - the key to fixing the iteration discontinuity problem
        const existingChain = await historyManager.value!.getChain(chainId)

        // Restore the full chain state, keeping the version history continuous
        currentChainId.value = existingChain.chainId
        currentVersions.value = existingChain.versions
        currentVersionId.value = record.id

        await refreshHistory()
        state.showHistory = false

        toast.success(t('toast.success.historyLoaded'))
      } catch (error) {
        console.error('[History] Failed to load history records:', error)
        toast.error(t('toast.error.loadHistoryFailed'))
      }
    },

    handleClearHistory: async () => {
    try {
      await historyManager.value!.clearHistory()
      
      // Clear the currently displayed content
      prompt.value = '';
      optimizedPrompt.value = '';
      currentChainId.value = '';
      currentVersions.value = [];
      currentVersionId.value = '';
      
      // Update the history records immediately so the UI reflects the latest state
        state.history = []
      toast.success(t('toast.success.historyClear'))
    } catch (error) {
      console.error(t('toast.error.clearHistoryFailed'), error)
      toast.error(t('toast.error.clearHistoryFailed'))
    }
    },

    handleDeleteChain: async (chainId: string) => {
    try {
      // Get all records in the chain
      const allChains = await historyManager.value!.getAllChains()
      const chain = allChains.find((c) => c.chainId === chainId)
      
      if (chain) {
        // Delete all records in the chain
        for (const record of chain.versions) {
          await historyManager.value!.deleteRecord(record.id)
        }
        
        // If the chain currently being viewed is deleted, clear the current display
        if (currentChainId.value === chainId) {
          prompt.value = '';
          optimizedPrompt.value = '';
          currentChainId.value = '';
          currentVersions.value = [];
          currentVersionId.value = '';
        }
        
        // Update the history records immediately so the UI reflects the latest state
        const updatedChains = await historyManager.value!.getAllChains()
          state.history = [...updatedChains]
        toast.success(t('toast.success.historyChainDeleted'))
      }
    } catch (error) {
      console.error(t('toast.error.historyChainDeleteFailed'), error)
      toast.error(t('toast.error.historyChainDeleteFailed'))
    }
    },

    initHistory: async () => {
    try {
      await refreshHistory()
    } catch (error) {
      console.error(t('toast.error.loadHistoryFailed'), error)
      toast.error(t('toast.error.loadHistoryFailed'))
    }
  }
  })

  // Add a function to refresh the history records
  const refreshHistory = async () => {
    const chains = await historyManager.value!.getAllChains()
    state.history.splice(0, state.history.length, ...chains)
  }

  // Watch history display state
  watch(() => state.showHistory, async (newVal) => {
    if (newVal) {
      await refreshHistory()
    }
  })

  // Watch version and chain changes, update history
  watch([currentVersions, currentChainId], async (newValues, oldValues) => {
    await refreshHistory()
  })

  // Watch service instance changes and initialize the history records
  watch(services, async () => {
    if (services.value?.historyManager) {
      await refreshHistory()
    }
  }, { immediate: true })

  return state
} 
