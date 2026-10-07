import { ref, computed, nextTick, watch, type Ref, type ComputedRef } from 'vue'
import { useToast } from '../ui/useToast'
import { useI18n } from 'vue-i18n'
import { getI18nErrorMessage } from '../../utils/error'
import { v4 as uuidv4 } from 'uuid'
import type {
  IHistoryManager,
  IPromptService,
  ConversationMessage,
  PromptRecordChain,
  OptimizationMode,
  OptimizationRequest,
  MessageOptimizationRequest,
  Template
} from '@prompt-optimizer/core'
import type { AppServices } from '../../types/services'
import { useProMultiMessageSession } from '../../stores/session/useProMultiMessageSession'

/**
 * Return value interface of the multi-turn conversation message optimization composable
 */
export interface UseConversationOptimization {
  // State
  selectedMessageId: Ref<string>
  /** Currently selected message (used for Pro Multi auto-selection / evaluation context) */
  selectedMessage: ComputedRef<ConversationMessage | undefined>
  currentChainId: Ref<string>
  currentRecordId: Ref<string>
  currentVersions: Ref<PromptRecordChain['versions']>
  optimizedPrompt: Ref<string>
  isOptimizing: Ref<boolean>
  messageChainMap: Ref<Map<string, string>>

  // Methods
  selectMessage: (message: ConversationMessage) => Promise<void>
  optimizeMessage: () => Promise<void>
  iterateMessage: (payload: { originalPrompt: string, optimizedPrompt: string, iterateInput: string }) => Promise<void>
  switchVersion: (version: PromptRecordChain['versions'][number]) => Promise<void>
  switchToV0: (version: PromptRecordChain['versions'][number]) => Promise<void>  // 🆕 V0 switching
  applyToConversation: (messageId: string, content: string) => void
  applyCurrentVersion: () => Promise<void>
  cleanupDeletedMessageMapping: (messageId: string, options?: { keepSelection?: boolean }) => void
  saveLocalEdit: (payload: { optimizedPrompt: string; note?: string; source?: 'patch' | 'manual' }) => Promise<void>
  restoreFromSessionStore: () => void  // 🔧 Codex fix: explicit restore function
}

/**
 * Multi-turn conversation message optimization composable
 *
 * Provides message-level optimization, supporting:
 * - Selecting any system/user message to optimize
 * - Version management and history
 * - Automatically applying optimization results
 * - Smart reuse of working chains
 *
 * @param services Service instance reference
 * @param conversationMessages Conversation message list
 * @param optimizationMode Optimization mode (system/user)
 * @param selectedOptimizeModel Optimize model
 * @param selectedTemplate Optimization template
 * @param selectedIterateTemplate Iterate template
 */
export function useConversationOptimization(
  services: Ref<AppServices | null>,
  conversationMessages: Ref<ConversationMessage[]>,
  optimizationMode: Ref<OptimizationMode>,
  selectedOptimizeModel: Ref<string>,
  selectedTemplate: Ref<Template | null>,
  selectedIterateTemplate: Ref<Template | null>
) {
  const toast = useToast()
  const { t } = useI18n()

  // Service reference
  const historyManager = computed(() => services.value?.historyManager)
  const promptService = computed(() => services.value?.promptService)

  // ⚠️ Pro multi-message session store (only used in Pro-system mode)
  const proMultiMessageSession = useProMultiMessageSession()

  const isSyncingMapToSession = ref(false)

  const patchProSystemOptimizedResult = (
    partial: Partial<{
      optimizedPrompt: string
      reasoning: string
      chainId: string
      versionId: string
    }>
  ) => {
    if (optimizationMode.value !== 'system') return
    proMultiMessageSession.updateOptimizedResult({
      optimizedPrompt:
        partial.optimizedPrompt ??
        proMultiMessageSession.optimizedPrompt ??
        '',
      reasoning: partial.reasoning ?? proMultiMessageSession.reasoning ?? '',
      chainId: partial.chainId ?? proMultiMessageSession.chainId ?? '',
      versionId: partial.versionId ?? proMultiMessageSession.versionId ?? '',
    })
  }

  // Helper function: sync messageChainMap to the session store
  // ⚠️ Codex fix: messageChainMap is ref(new Map()), and watch cannot track changes inside the Map
  // Changed to sync explicitly after every set/delete
  const syncMessageChainMapToSession = () => {
    if (optimizationMode.value === 'system') {
      const record: Record<string, string> = {}
      for (const [key, value] of messageChainMap.value.entries()) {
        record[key] = value
      }
      isSyncingMapToSession.value = true
      proMultiMessageSession.setMessageChainMap(record)
      isSyncingMapToSession.value = false
    }
  }

  // 🔧 Codex fix: the core mapping table now uses messageId → chainId directly, with the mode prefix removed
  // Reason: the Session Store already isolates sub-modes (session/v1/pro-multi), so the mode info need not be repeated in the key
  // Use the Map data structure to ensure O(1) lookup performance
  const messageChainMap = ref<Map<string, string>>(new Map())

  // 🔧 Codex fix: simplify the delete logic and use messageId directly
  const removeMessageMapping = (messageId?: string) => {
    if (!messageId) return false
    const removed = messageChainMap.value.delete(messageId)
    // ⚠️ Codex fix: explicitly sync to the session store
    if (removed) {
      syncMessageChainMapToSession()
    }
    return removed
  }

  // State management (bind persistable fields to the session store, eliminating dual sources)
  const localSelectedMessageId = ref<string>('')
  const localChainId = ref<string>('')
  const localRecordId = ref<string>('')
  const localOptimizedPrompt = ref<string>('')
  const localOptimizedReasoning = ref<string>('')

  const selectedMessageId = computed<string>({
    get: () =>
      optimizationMode.value === 'system'
        ? (proMultiMessageSession.selectedMessageId ?? '')
        : localSelectedMessageId.value,
    set: (id) => {
      if (optimizationMode.value === 'system') {
        proMultiMessageSession.selectMessage(id)
      } else {
        localSelectedMessageId.value = id
      }
    },
  })

  const selectedMessage = computed<ConversationMessage | undefined>(() => {
    const id = selectedMessageId.value
    if (!id) return undefined
    return conversationMessages.value.find(m => m.id === id)
  })

  const currentChainId = computed<string>({
    get: () =>
      optimizationMode.value === 'system'
        ? (proMultiMessageSession.chainId ?? '')
        : localChainId.value,
    set: (chainId) => {
      if (optimizationMode.value === 'system') {
        patchProSystemOptimizedResult({ chainId })
      } else {
        localChainId.value = chainId
      }
    },
  })

  const currentRecordId = computed<string>({
    get: () =>
      optimizationMode.value === 'system'
        ? (proMultiMessageSession.versionId ?? '')
        : localRecordId.value,
    set: (recordId) => {
      if (optimizationMode.value === 'system') {
        patchProSystemOptimizedResult({ versionId: recordId })
      } else {
        localRecordId.value = recordId
      }
    },
  })

  const optimizedPrompt = computed<string>({
    get: () =>
      optimizationMode.value === 'system'
        ? (proMultiMessageSession.optimizedPrompt ?? '')
        : localOptimizedPrompt.value,
    set: (prompt) => {
      if (optimizationMode.value === 'system') {
        patchProSystemOptimizedResult({ optimizedPrompt: prompt })
      } else {
        localOptimizedPrompt.value = prompt
      }
    },
  })

  const optimizedReasoning = computed<string>({
    get: () =>
      optimizationMode.value === 'system'
        ? (proMultiMessageSession.reasoning ?? '')
        : localOptimizedReasoning.value,
    set: (reasoning) => {
      if (optimizationMode.value === 'system') {
        patchProSystemOptimizedResult({ reasoning })
      } else {
        localOptimizedReasoning.value = reasoning
      }
    },
  })

  const currentVersions = ref<PromptRecordChain['versions']>([])
  const isOptimizing = ref<boolean>(false)

  // ========== Session Store sync logic ==========

  // ⚠️ Codex fix: messageChainMap is ref(new Map()), and watch cannot track changes inside the Map
  // Changed to sync explicitly after every set/delete (see optimizeMessage, iterateMessage, removeMessageMapping)
  // syncMessageChainMapToSession() is defined above

  /**
   * 🔧 Codex fix: restore messageChainMap from the Session Store (Pro-system mode only)
   *
   * Notes:
   * - Other persistable fields are already bound directly to the session store via computed (single source of truth)
   * - This is only responsible for Map/Record conversion + migrating old keys
   */
  const restoreFromSessionStore = () => {
    if (optimizationMode.value !== 'system') return

    const messageChainMapFromStore = proMultiMessageSession.messageChainMap

    // 🔧 Codex fix: restore the message-chain mapping table and migrate old-format keys
    if (messageChainMapFromStore && Object.keys(messageChainMapFromStore).length > 0) {
      const restoredMap = new Map<string, string>()
      let hasMigrated = false

      // 🔧 Codex suggestion: use strict prefix matching to avoid wrongly migrating a messageId that contains `:`
      const oldKeyPattern = /^(system|user|basic|pro|image):/

      for (const [key, value] of Object.entries(messageChainMapFromStore)) {
        // 🔧 Identify old-format keys (matching the prefixes "system:", "user:", "basic:", "pro:", "image:")
        const match = key.match(oldKeyPattern)
        if (match) {
          // Extract the plain messageId (the part after the prefix)
          const messageId = key.substring(match[0].length)
          if (messageId) {
            restoredMap.set(messageId, value)
            hasMigrated = true
            console.log(`[ConversationOptimization] Migrating old-format key: ${key} → ${messageId}`)
          }
        } else {
          // New-format key, use directly
          restoredMap.set(key, value)
        }
      }

      messageChainMap.value = restoredMap

      // 🔧 If a migration happened, sync to the session store immediately to save the new format
      if (hasMigrated) {
        console.log('[ConversationOptimization] Detected old-format keys, migrated and saved automatically')
        syncMessageChainMapToSession()
      }
    }
  }

  // session store → Map sync (supports restore after refresh/switch)
  watch(
    () => proMultiMessageSession.messageChainMap,
    () => {
      if (optimizationMode.value !== 'system') return
      if (isSyncingMapToSession.value) return
      restoreFromSessionStore()
    },
    { immediate: true, flush: 'sync', deep: true }
  )

  /**
   * 🆕 Helper function: get the currently applied version number of a message from the history records
   * @param messageId Message ID
   * @param chainId Optimization chain ID
   * @param currentContent Current message content
   * @param originalContent Original message content
   * @returns Version number (0=v0, 1=v1, 2=v2...)
   */
  const getMessageAppliedVersion = async (
    messageId: string,
    chainId: string | undefined,
    currentContent: string,
    originalContent?: string
  ): Promise<number> => {
    try {
      // 0. First check whether it is the original content (V0)
      if (currentContent?.trim() === originalContent?.trim()) {
        return 0
      }

      if (!chainId) return 0

      const chain = await historyManager.value?.getChain(chainId)
      if (!chain) {
        return 0
      }

      // Exact match: iterate over all versions to find the one whose content matches
      for (let i = 0; i < chain.versions.length; i++) {
        if (chain.versions[i].optimizedPrompt?.trim() === currentContent?.trim()) {
          return chain.versions[i].version // Use persistent version number
        }
      }

      // If there is no match and the content has been modified, assume it is the latest version
      const latest = chain.versions[chain.versions.length - 1]
      return latest ? latest.version : 0
    } catch (error) {
      console.warn(`[ConversationOptimization] Failed to get the version number of message ${messageId}:`, error)
      return 0 // Defaults to v0 on failure
    }
  }

  /**
   * Select a message to optimize
   * @param message The message to optimize
   */
  const selectMessage = async (message: ConversationMessage) => {
    // Validate the message role: only user and system messages can be optimized
    if (message.role !== 'user' && message.role !== 'system') {
      toast.warning(t('toast.warning.cannotOptimizeRole', { role: message.role }))
      return
    }

    // Automatically fill in a missing ID / original content (defensive strategy)
    if (!message.id) {
      message.id = uuidv4()
    }
    if (message.originalContent === undefined) {
      message.originalContent = message.content
    }

    // Update the selected message ID
    selectedMessageId.value = message.id || ''

    // 🔧 Codex fix: use messageId directly as the key, with the mode prefix removed
    const existingChainId = message.id ? messageChainMap.value.get(message.id) : undefined

    if (existingChainId) {
      // Load the existing working chain
      try {
        const history = historyManager.value
        if (!history) {
          toast.error(t('toast.error.historyUnavailable'))
          return
        }
        const chain = await history.getChain(existingChainId)
        currentChainId.value = chain.chainId
        currentVersions.value = chain.versions
        optimizedPrompt.value = chain.currentRecord.optimizedPrompt
        currentRecordId.value = chain.currentRecord.id
      } catch (error) {
        console.error('[ConversationOptimization] Failed to load the working chain:', error)
        toast.error(t('toast.error.loadChainFailed'))
        // Reset to the first-optimization state
        currentChainId.value = ''
        currentVersions.value = []
        currentRecordId.value = ''
        if (message.id) {
          removeMessageMapping(message.id)
        }
      }
    } else {
      // 🔧 No mapping exists; treat it as a new message and reset the state (the working chain is created after the first optimization completes)
      currentChainId.value = ''
      currentVersions.value = []
      optimizedPrompt.value = ''
      optimizedReasoning.value = ''
      currentRecordId.value = ''
    }
  }

  /**
   * Optimize the selected message (always creates a new optimization chain)
   */
  const optimizeMessage = async () => {
    // Find the currently selected message
    const message = conversationMessages.value.find(m => m.id === selectedMessageId.value)
    if (!message || !selectedTemplate.value || !selectedOptimizeModel.value) {
      if (!message) {
        toast.warning(t('toast.warning.messageNotFound'))
      } else if (!selectedTemplate.value) {
        toast.error(t('toast.error.noOptimizeTemplate'))
      } else if (!selectedOptimizeModel.value) {
        toast.error(t('toast.error.noOptimizeModel'))
      }
      return
    }

    if (!promptService.value) {
      toast.error(t('toast.error.promptServiceUnavailable'))
      return
    }

    // Force a state reset and start a new optimization chain
    isOptimizing.value = true
    optimizedPrompt.value = ''
    optimizedReasoning.value = ''
    currentChainId.value = ''
    currentVersions.value = []
    currentRecordId.value = ''

    await nextTick()

    const originalContentSnapshot = message.content || ''
    message.originalContent = originalContentSnapshot

    try {
      // Build the message optimization request using the dedicated MessageOptimizationRequest interface
      const request: MessageOptimizationRequest = {
        selectedMessageId: selectedMessageId.value,
        messages: conversationMessages.value,
        modelKey: selectedOptimizeModel.value,
        templateId: selectedTemplate.value.id, // Use the template chosen by the user
        variables: {}, // Custom variables (empty for now)
      }

      // Call the streaming message optimization API (using the new optimizeMessageStream)
      await promptService.value!.optimizeMessageStream(
        request,
        {
          onToken: (token: string) => {
            optimizedPrompt.value += token
          },
          onReasoningToken: (reasoningToken: string) => {
            optimizedReasoning.value += reasoningToken
          },
          onComplete: async () => {
            try {
              // Determine whether this is the first optimization or a later one
              if (!historyManager.value) {
                throw new Error('History service unavailable')
              }

              // 🔧 Apply the optimization result to the conversation first, so the snapshot saves the latest state
              applyToConversation(message.id || '', optimizedPrompt.value)

              // First optimization: create a new working chain
              // 🆕 Record the optimization chain and version number of each message
              const conversationSnapshot = await Promise.all(
                  conversationMessages.value.map(async (msg) => {
                    // 🔧 Codex fix: use messageId directly as the key
                    const msgChainId = msg.id ? messageChainMap.value.get(msg.id) : undefined
                    let appliedVersion = 0

                    // 🔧 Fix: on the first optimization, the current message has no chainId but v1 has already been applied
                    if (msg.id === message.id) {
                      // For the message currently being optimized, the first optimization is necessarily V1
                      appliedVersion = 1
                    } else if (msgChainId && msg.id) {
                      // For other already-optimized messages, detect the version using the helper function
                      appliedVersion = await getMessageAppliedVersion(
                        msg.id,
                        msgChainId,
                        msg.content,
                        msg.originalContent
                      )
                    }

                    return {
                      id: msg.id || '',
                      role: msg.role,
                      // 🔧 Make sure the latest optimized content is used
                      content: (msg.id === message.id) ? optimizedPrompt.value : msg.content,
                      originalContent: msg.originalContent,
                      chainId: msgChainId,           // 🆕 Record the optimization chain ID
                      appliedVersion: appliedVersion // 🆕 Record the applied version number
                    }
                  })
              )

              const recordData = {
                  id: uuidv4(),
                  originalPrompt: originalContentSnapshot,
                  optimizedPrompt: optimizedPrompt.value,
                  type: 'conversationMessageOptimize' as const,
                  modelKey: selectedOptimizeModel.value,
                  templateId: selectedTemplate.value!.id,
                  timestamp: Date.now(),
                  metadata: {
                    messageId: message.id,
                    messageRole: message.role,
                    optimizationMode: optimizationMode.value,
                    // 🆕 Save the full session snapshot (including version info)
                    conversationSnapshot
                  }
              }

              const newChain = await historyManager.value.createNewChain(recordData)
              currentChainId.value = newChain.chainId
              currentVersions.value = newChain.versions
              currentRecordId.value = newChain.currentRecord.id

              // 🔧 Codex fix: establish the mapping from message ID to working chain ID (using messageId directly)
              if (message.id) {
                  messageChainMap.value.set(message.id, newChain.chainId)
                  // ⚠️ Codex fix: explicitly sync to the session store
                  syncMessageChainMapToSession()
              }

              // Trigger the global history refresh event
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new Event('prompt-optimizer:history-refresh'))
              }

              // Show a success message
              toast.success(t('toast.success.optimizeAndApply', { version: 'v1' }))
            } catch (error) {
              console.error('[ConversationOptimization] Failed to save the history record:', error)
              toast.warning(t('toast.warning.saveHistoryFailed'))
              // The optimization result is still usable, but the history was not saved
            } finally {
              isOptimizing.value = false
            }
          },
          onError: (error: Error) => {
            console.error('[ConversationOptimization] Optimization failed:', error)
            toast.error(getI18nErrorMessage(error, t('toast.error.optimizeFailed')))
            isOptimizing.value = false
          }
        }
      )
    } catch (error) {
      console.error('[ConversationOptimization] Optimization failed:', error)
      toast.error(getI18nErrorMessage(error, t('toast.error.optimizeFailed')))
      isOptimizing.value = false
    }
  }

  /**
   * Iteratively optimize the currently selected message
   */
  const iterateMessage = async (
    {
      originalPrompt,
      optimizedPrompt: lastOptimizedPrompt,
      iterateInput,
    }: {
      originalPrompt: string,
      optimizedPrompt: string,
      iterateInput: string,
    },
  ) => {
    if (!selectedMessageId.value || !currentChainId.value) {
      toast.warning(t('toast.warning.noVersionSelected'))
      return
    }
    if (!iterateInput) return
    
    // Find the currently selected message
    const message = conversationMessages.value.find(m => m.id === selectedMessageId.value)
    if (!message) {
        toast.warning(t('toast.warning.messageNotFound'))
        return
    }

    if (!promptService.value) {
      toast.error(t('toast.error.promptServiceUnavailable'))
      return
    }

    isOptimizing.value = true
    optimizedPrompt.value = ''  // 🔧 Clear the old content to avoid accumulation
    optimizedReasoning.value = ''
    await nextTick()

    try {
      // 🔧 Use the iterate-specific template; if no iterate template is selected, fall back to the default iterate template
      const templateId = selectedIterateTemplate.value?.id || 'context-iterate'

      await promptService.value.iteratePromptStream(
        originalPrompt, // Original prompt
        lastOptimizedPrompt, // Previous optimization result
        iterateInput, // Iteration instruction
        selectedOptimizeModel.value,
        {
          onToken: (token: string) => {
            optimizedPrompt.value += token
          },
          onReasoningToken: (reasoningToken: string) => {
            optimizedReasoning.value += reasoningToken
          },
          onComplete: async () => {
             try {
                if (!historyManager.value) throw new Error('History service unavailable')

                // Apply the result
                applyToConversation(message.id || '', optimizedPrompt.value)
                
                // 🔧 Key fix: compute the new version number manually (consistent with the logic of addIteration)
                const newVersionNumber = (currentVersions.value[currentVersions.value.length - 1]?.version || 0) + 1

                // Build the snapshot (using the manually computed version number)
                const conversationSnapshot = await Promise.all(
                  conversationMessages.value.map(async (msg) => {
                    // 🔧 Codex fix: use messageId directly as the key
                    const msgChainId = msg.id ? messageChainMap.value.get(msg.id) : undefined
                    let appliedVersion = 0

                    // 🔧 Fix: during iterative optimization, first check whether it is the current message
                    if (msg.id === message.id) {
                      // For the message currently being optimized, use the manually computed new version number
                      appliedVersion = newVersionNumber
                    } else if (msgChainId && msg.id) {
                      // For other already-optimized messages, detect the version using the helper function
                      appliedVersion = await getMessageAppliedVersion(
                        msg.id,
                        msgChainId,
                        msg.content,
                        msg.originalContent
                      )
                    }

                    return {
                      id: msg.id || '',
                      role: msg.role,
                      content: msg.content,
                      originalContent: msg.originalContent,
                      chainId: msgChainId,
                      appliedVersion: appliedVersion // 🆕 Record the applied version number
                    }
                  })
                )

                const iterationData = {
                  chainId: currentChainId.value,
                  originalPrompt: originalPrompt,
                  optimizedPrompt: optimizedPrompt.value,
                  iterationNote: iterateInput,
                  modelKey: selectedOptimizeModel.value,
                  templateId: templateId,
                  metadata: {
                    messageId: message.id,
                    messageRole: message.role,
                    optimizationMode: optimizationMode.value,
                    // 🆕 Also update the session snapshot during iteration (including version info)
                    conversationSnapshot
                  }
                }

                const updatedChain = await historyManager.value.addIteration(iterationData)
                currentVersions.value = updatedChain.versions
                currentRecordId.value = updatedChain.currentRecord.id

                // Trigger the global history refresh event
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new Event('prompt-optimizer:history-refresh'))
                }
                
                // Show a success message
                const versionNumber = currentVersions.value.length
                toast.success(t('toast.success.optimizeAndApply', { version: `v${versionNumber}` }))

             } catch (error) {
               console.error('[ConversationOptimization] Failed to save the iteration history:', error)
               toast.warning(t('toast.warning.saveHistoryFailed'))
             } finally {
               isOptimizing.value = false
             }
          },
          onError: (error: Error) => {
            console.error('[ConversationOptimization] Iteration failed:', error)
            toast.error(getI18nErrorMessage(error, t('toast.error.iterateFailed')))
            isOptimizing.value = false
          }
        },
        templateId,
        {
          messages: conversationMessages.value,
          selectedMessageId: selectedMessageId.value,
          variables: {}, // Variables are not supported yet
          tools: [] // Tools are not supported yet
        },
      )
    } catch (error) {
      console.error('[ConversationOptimization] Iteration failed:', error)
      toast.error(getI18nErrorMessage(error, t('toast.error.iterateFailed')))
      isOptimizing.value = false
    }
  }

  /**
   * Switch version
   * @param version The version to switch to
   */
  const switchVersion = async (version: PromptRecordChain['versions'][number]) => {
    if (!version || !version.optimizedPrompt) {
      toast.error(t('toast.error.invalidVersion'))
      return
    }
    optimizedPrompt.value = version.optimizedPrompt
    currentRecordId.value = version.id
    // Wait for a microtask to make sure the state update is complete
    await nextTick()
  }

  /**
   * 🆕 Switch to V0 (the original version)
   * @param version The first version object (containing originalPrompt)
   */
  const switchToV0 = async (version: PromptRecordChain['versions'][number]) => {
    if (!version || !version.originalPrompt) {
      toast.error(t('toast.error.invalidVersion'))
      return
    }
    // Use originalPrompt as the display content
    optimizedPrompt.value = version.originalPrompt
    currentRecordId.value = version.id
    // Wait for a microtask to make sure the state update is complete
    await nextTick()
  }

  /**
   * Apply the optimization result to the conversation
   * @param messageId Message ID
   * @param content The content to apply
   */
  const applyToConversation = (messageId: string, content: string) => {
    const message = conversationMessages.value.find(m => m.id === messageId)
    if (!message) {
      toast.warning(t('toast.warning.messageNotFound'))
      return
    }
    message.content = content
  }

  /**
   * Apply the current version to the conversation (for manual rollback)
   * 🆕 Directly use the currently displayed optimizedPrompt, supporting V0 (the original content)
   */
  const applyCurrentVersion = async () => {
    if (!selectedMessageId.value) {
      toast.warning(t('toast.warning.noVersionSelected'))
      return
    }

    // 🆕 Directly use the currently displayed content, with no need to load it from the history records
    // This correctly supports applying V0 (the original content)
    if (!optimizedPrompt.value) {
      toast.warning(t('toast.warning.noContentToApply'))
      return
    }

    applyToConversation(selectedMessageId.value, optimizedPrompt.value)
    toast.success(t('toast.success.versionApplied'))
  }

  /**
   * Clean up the mapping of a deleted message
   * @param messageId The ID of the deleted message
   */
  const cleanupDeletedMessageMapping = (messageId: string, options?: { keepSelection?: boolean }) => {
    if (!messageId) return

    const removed = removeMessageMapping(messageId)
    if (removed) {
      console.log('[ConversationOptimization] Cleaned up the message mapping:', messageId)
    }

    if (selectedMessageId.value === messageId) {
      if (options?.keepSelection) {
        currentChainId.value = ''
        currentVersions.value = []
        optimizedPrompt.value = ''
        optimizedReasoning.value = ''
        currentRecordId.value = ''
      } else {
        selectedMessageId.value = ''
        currentChainId.value = ''
        currentVersions.value = []
        optimizedPrompt.value = ''
        optimizedReasoning.value = ''
        currentRecordId.value = ''
        console.log('[ConversationOptimization] Cleared the current selection state')
      }
    }
  }

  /*
   * No "soft reset" is done on mode switch here:
   * - Pro-system state separation/persistence should be handled by the session store + SessionManager
   * - Clearing and syncing to the session here would overwrite persisted data with "empty" when switching sub-modes (especially noticeable after a refresh)
   *
   * Original logic (disabled):
   * watch(optimizationMode, () => { ...clear...; syncMessageChainMapToSession() })
   */

  /**
   * Save local changes as a new version (does not trigger the LLM)
   * - Used for "direct fix" and explicit saving after manual edits
   */
  const saveLocalEdit = async ({ optimizedPrompt: newPrompt, note, source }: { optimizedPrompt: string; note?: string; source?: 'patch' | 'manual' }) => {
    try {
      if (!historyManager.value) throw new Error('History service unavailable')
      if (!newPrompt) return

      const currentRecord = currentVersions.value.find(v => v.id === currentRecordId.value)
      const modelKey = currentRecord?.modelKey || selectedOptimizeModel.value || 'local-edit'
      const templateId =
        currentRecord?.templateId ||
        selectedIterateTemplate.value?.id ||
        selectedTemplate.value?.id ||
        'local-edit'

      // Find the currently selected message
      const message = conversationMessages.value.find(m => m.id === selectedMessageId.value)
      const originalContent = message?.originalContent || message?.content || ''

      // If there is currently no chain (rare), create a new chain for later version management
      if (!currentChainId.value) {
        const recordData = {
          id: uuidv4(),
          originalPrompt: originalContent,
          optimizedPrompt: newPrompt,
          type: 'conversationMessageOptimize' as const,
          modelKey,
          templateId,
          timestamp: Date.now(),
          metadata: {
            messageId: message?.id,
            messageRole: message?.role,
            optimizationMode: optimizationMode.value,
            localEdit: true,
            localEditSource: source || 'manual',
          }
        }
        const newRecord = await historyManager.value.createNewChain(recordData)
        currentChainId.value = newRecord.chainId
        currentVersions.value = newRecord.versions
        currentRecordId.value = newRecord.currentRecord.id

        // 🔧 Codex fix: establish the mapping from message ID to working chain ID (using messageId directly)
        if (message?.id) {
          messageChainMap.value.set(message.id, newRecord.chainId)
          // ⚠️ Codex fix: explicitly sync to the session store
          syncMessageChainMapToSession()
        }
        return
      }

      const updatedChain = await historyManager.value.addIteration({
        chainId: currentChainId.value,
        originalPrompt: originalContent,
        optimizedPrompt: newPrompt,
        modelKey,
        templateId,
        iterationNote: note || (source === 'patch' ? 'Direct fix' : 'Manual edit'),
        metadata: {
          messageId: message?.id,
          messageRole: message?.role,
          optimizationMode: optimizationMode.value,
          localEdit: true,
          localEditSource: source || 'manual',
        }
      })

      currentVersions.value = updatedChain.versions
      currentRecordId.value = updatedChain.currentRecord.id
    } catch (error: unknown) {
      console.error('[useConversationOptimization] Failed to save local changes:', error)
      toast.warning(t('toast.warning.saveHistoryFailed'))
    }
  }

  return {
    // State
    selectedMessageId,
    selectedMessage,
    currentChainId,
    currentRecordId,
    currentVersions,
    optimizedPrompt,
    isOptimizing,
    messageChainMap,

    // Methods
    selectMessage,
    optimizeMessage,
    iterateMessage,
    switchVersion,
    switchToV0,  // 🆕 V0 switching method
    applyToConversation,
    applyCurrentVersion,
    cleanupDeletedMessageMapping,
    saveLocalEdit,
    restoreFromSessionStore  // 🔧 Codex fix: explicit restore function
  }
}
