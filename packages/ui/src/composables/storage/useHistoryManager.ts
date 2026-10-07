import { reactive, type Ref } from 'vue'

import type { AppServices } from '../../types/services'

import type { PromptRecordChain, PromptRecord } from '@prompt-optimizer/core'

export interface HistoryManagerHooks {
  showHistory: boolean
  handleSelectHistory: (historyItem: PromptRecord) => void
  handleClearHistory: () => void
  handleDeleteChain: (chainId: string) => void
}

/**
 * History manager hook
 * @param services Service instance reference
 * @param prompt Prompt
 * @param optimizedPrompt Optimized prompt
 * @param currentChainId Current chain ID
 * @param currentVersions Current version list
 * @param currentVersionId Current version ID
 * @param handleSelectHistoryBase Base handler function for selecting a history record
 * @param handleClearHistoryBase Base handler function for clearing the history records
 * @param handleDeleteChainBase Base handler function for deleting a chain
 * @returns HistoryManagerHooks
 */
export function useHistoryManager(
  services: Ref<AppServices | null>,
  prompt: Ref<string>,
  optimizedPrompt: Ref<string>,
  currentChainId: Ref<string | null>,
  currentVersions: Ref<PromptRecordChain['versions']>,
  currentVersionId: Ref<string | null>,
  handleSelectHistoryBase: (historyItem: PromptRecord) => void,
  handleClearHistoryBase: () => void,
  handleDeleteChainBase: (chainId: string) => void
): HistoryManagerHooks {
  // Create a reactive state object
  const state = reactive<HistoryManagerHooks>({
    showHistory: false,
    handleSelectHistory: (historyItem: PromptRecord) => {
      handleSelectHistoryBase(historyItem)
      state.showHistory = false
    },
    handleClearHistory: () => {
      // Call the base method to handle the clear at the data level
      handleClearHistoryBase()
      // Close the history drawer
      state.showHistory = false
    },
    handleDeleteChain: (chainId: string) => {
      // Call the base method to handle the delete at the data level
      handleDeleteChainBase(chainId)
      // Do not close the history drawer, so the user can keep viewing other records
    }
  })

  return state
} 
