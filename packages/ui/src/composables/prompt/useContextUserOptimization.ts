import { ref, nextTick, computed, reactive, type Ref } from 'vue'
import { useToast } from '../ui/useToast'
import { useI18n } from 'vue-i18n'
import { getI18nErrorMessage } from '../../utils/error'
import { v4 as uuidv4 } from 'uuid'
import type {
  Template,
  PromptRecord,
  PromptRecordChain,
  OptimizationRequest
} from '@prompt-optimizer/core'
import type { AppServices } from '../../types/services'

type PromptChain = PromptRecordChain

export interface ContextUserOptimizationBindings {
  prompt?: Ref<string>
  optimizedPrompt?: Ref<string>
  optimizedReasoning?: Ref<string>
  currentChainId?: Ref<string>
  currentVersionId?: Ref<string>
}

/**
 * ContextUser mode prompt optimizer interface
 */
export interface UseContextUserOptimization {
  // State
  prompt: string
  optimizedPrompt: string
  optimizedReasoning: string
  isOptimizing: boolean
  isIterating: boolean
  selectedTemplate: Template | null
  selectedIterateTemplate: Template | null
  currentChainId: string
  currentVersions: PromptChain['versions']
  currentVersionId: string

  // Methods
  optimize: () => Promise<void>
  iterate: (payload: { originalPrompt: string, optimizedPrompt: string, iterateInput: string }) => Promise<void>
  switchVersion: (version: PromptChain['versions'][number]) => Promise<void>
  switchToV0: (version: PromptChain['versions'][number]) => Promise<void>  // 🆕 V0 switching
  loadFromHistory: (payload: { rootPrompt?: string, chain: PromptChain, record: PromptRecord }) => void
  saveLocalEdit: (payload: { optimizedPrompt: string; note?: string; source?: 'patch' | 'manual' }) => Promise<void>
  handleAnalyze: () => void  // 🆕 Analyze feature
}

/**
 * ContextUser mode prompt optimizer composable
 *
 * Dedicated to the optimization logic of ContextUserWorkspace, with these characteristics:
 * - Only handles optimization of a single user message
 * - Independent state management
 * - Supports version history and iteration
 * - Symmetric with useConversationOptimization of ContextSystem
 *
 * @param services Service instance reference
 * @param selectedOptimizeModel Optimize model selection
 * @param selectedTemplate Optimization template (user mode)
 * @param selectedIterateTemplate Iterate template
 * @returns ContextUser optimizer interface
 *
 * @example
 * ```ts
 * const contextUserOptimization = useContextUserOptimization(
 *   services,
 *   computed(() => props.selectedOptimizeModel),
 *   computed(() => props.selectedTemplate),
 *   computed(() => props.selectedIterateTemplate)
 * )
 *
 * // Run the optimization
 * await contextUserOptimization.optimize()
 * ```
 */
export function useContextUserOptimization(
  services: Ref<AppServices | null>,
  selectedOptimizeModel: Ref<string>,
  selectedTemplate: Ref<Template | null>,
  selectedIterateTemplate: Ref<Template | null>,
  bindings?: ContextUserOptimizationBindings
): UseContextUserOptimization {
  const toast = useToast()
  const { t } = useI18n()

  // Service reference
  const historyManager = computed(() => services.value?.historyManager)
  const promptService = computed(() => services.value?.promptService)

  const boundPrompt = bindings?.prompt ?? ref('')
  const boundOptimizedPrompt = bindings?.optimizedPrompt ?? ref('')
  const boundOptimizedReasoning = bindings?.optimizedReasoning ?? ref('')
  const boundCurrentChainId = bindings?.currentChainId ?? ref('')
  const boundCurrentVersionId = bindings?.currentVersionId ?? ref('')

  // Use reactive to create the reactive state object
  const state = reactive({
    // State
    prompt: boundPrompt,
    optimizedPrompt: boundOptimizedPrompt,
    optimizedReasoning: boundOptimizedReasoning,
    isOptimizing: false,
    isIterating: false,
    selectedTemplate: null as Template | null,
    selectedIterateTemplate: null as Template | null,
    currentChainId: boundCurrentChainId,
    currentVersions: [] as PromptChain['versions'],
    currentVersionId: boundCurrentVersionId,

    // Methods
    optimize: async () => {
      if (!state.prompt.trim() || state.isOptimizing) return

      if (!selectedTemplate.value) {
        toast.error(t('toast.error.noOptimizeTemplate'))
        return
      }

      if (!selectedOptimizeModel.value) {
        toast.error(t('toast.error.noOptimizeModel'))
        return
      }

      // Clear the state immediately before starting the optimization
      state.isOptimizing = true
      state.optimizedPrompt = ''
      state.optimizedReasoning = ''

      // Wait for a microtask to make sure the state update is complete
      await nextTick()

      try {
        // Build the optimization request
        const request: OptimizationRequest = {
          optimizationMode: 'user',  // ContextUser is fixed to user mode
          targetPrompt: state.prompt,
          templateId: selectedTemplate.value.id,
          modelKey: selectedOptimizeModel.value
        }

        // Use the streaming optimization API
        await promptService.value!.optimizePromptStream(
          request,
          {
            onToken: (token: string) => {
              state.optimizedPrompt += token
            },
            onReasoningToken: (reasoningToken: string) => {
              state.optimizedReasoning += reasoningToken
            },
            onComplete: async () => {
              if (!selectedTemplate.value) return

              try {
                // Create the history record
                const recordData = {
                  id: uuidv4(),
                  originalPrompt: state.prompt,
                  optimizedPrompt: state.optimizedPrompt,
                  type: 'contextUserOptimize' as const,  // Type dedicated to ContextUser
                  modelKey: selectedOptimizeModel.value,
                  templateId: selectedTemplate.value.id,
                  timestamp: Date.now(),
                  metadata: {
                    optimizationMode: 'user' as const,
                    functionMode: 'pro' as const  // ContextUser belongs to pro mode
                  }
                }

                const newRecord = await historyManager.value!.createNewChain(recordData)

                state.currentChainId = newRecord.chainId
                state.currentVersions = newRecord.versions
                state.currentVersionId = newRecord.currentRecord.id

                toast.success(t('toast.success.optimizeSuccess'))
              } catch (error: unknown) {
                console.error('Failed to create the history record:', error)
                toast.error('Failed to create the history record: ' + getI18nErrorMessage(error, t('toast.error.optimizeFailed')))
              } finally {
                state.isOptimizing = false
              }
            },
            onError: (error: Error) => {
              console.error(t('toast.error.optimizeProcessFailed'), error)
              toast.error(getI18nErrorMessage(error, t('toast.error.optimizeFailed')))
              state.isOptimizing = false
            }
          }
        )
      } catch (error: unknown) {
        console.error(t('toast.error.optimizeFailed'), error)
        toast.error(getI18nErrorMessage(error, t('toast.error.optimizeFailed')))
      } finally {
        state.isOptimizing = false
      }
    },

    // Iterative optimization
    iterate: async (
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
      // 🔧 Fix: the iterate template does not actually need originalPrompt, only lastOptimizedPrompt and iterateInput
      // Removed the !originalPrompt check, allowing users to iterate after editing directly in the workspace
      if (!lastOptimizedPrompt || state.isIterating) return
      if (!iterateInput) return

      if (!selectedIterateTemplate.value) {
        toast.error(t('toast.error.noIterateTemplate'))
        return
      }

      // Clear the state immediately before starting the iteration
      state.isIterating = true
      state.optimizedPrompt = ''
      state.optimizedReasoning = ''

      // Wait for a microtask to make sure the state update is complete
      await nextTick()

      try {
        await promptService.value!.iteratePromptStream(
          originalPrompt,
          lastOptimizedPrompt,
          iterateInput,
          selectedOptimizeModel.value,
          {
            onToken: (token: string) => {
              state.optimizedPrompt += token
            },
            onReasoningToken: (reasoningToken: string) => {
              state.optimizedReasoning += reasoningToken
            },
            onComplete: async () => {
              if (!selectedIterateTemplate.value) {
                state.isIterating = false
                return
              }

              try {
                // Save the iteration history
                const iterationData = {
                  chainId: state.currentChainId,
                  originalPrompt: originalPrompt,
                  optimizedPrompt: state.optimizedPrompt,
                  iterationNote: iterateInput,
                  modelKey: selectedOptimizeModel.value,
                  templateId: selectedIterateTemplate.value.id
                }

                const updatedChain = await historyManager.value!.addIteration(iterationData)

                state.currentVersions = updatedChain.versions
                state.currentVersionId = updatedChain.currentRecord.id

                toast.success(t('toast.success.iterateComplete'))
              } catch (error: unknown) {
                console.error('[History] Failed to record the iteration:', error)
                toast.warning(t('toast.warning.historyFailed'))
              } finally {
                state.isIterating = false
              }
            },
            onError: (error: Error) => {
              console.error('[Iterate] Iteration failed:', error)
              toast.error(t('toast.error.iterateFailed'))
              state.isIterating = false
            }
          },
          selectedIterateTemplate.value.id,
        )
      } catch (error: unknown) {
        console.error('[Iterate] Iteration failed:', error)
        toast.error(t('toast.error.iterateFailed'))
        state.isIterating = false
      }
    },

    /**
     * Switch to the specified optimization version
     *
     * 📌 Design notes:
     * - state.prompt uses a fallback (version.originalPrompt || state.prompt)
     * - Purpose: compatible with early history records that may only have saved the optimization result and lack originalPrompt
     * - Effect: keep the current input unchanged when switching, avoiding accidentally clearing the user's content
     */
    switchVersion: async (version: PromptChain['versions'][number]) => {
      // Force a content update to make sure the UI is in sync
      state.optimizedPrompt = version.optimizedPrompt
      // 🔧 Compatible with old version chains: early records may lack originalPrompt, so use the fallback to avoid clearing the current input
      state.prompt = version.originalPrompt || state.prompt
      state.currentVersionId = version.id

      // Wait for a microtask to make sure the state update is complete
      await nextTick()
    },

    /**
     * Switch to the V0 version (the unoptimized original prompt)
     *
     * 📌 Design notes:
     * - Unlike switchVersion, this method requires originalPrompt to be present (precondition check)
     * - Semantics: V0 means "view the unoptimized original version", so an original input is required to roll back
     * - So it can safely assign directly without fallback protection
     */
    switchToV0: async (version: PromptChain['versions'][number]) => {
      // ✅ Switching to V0 requires an original input, otherwise it cannot roll back to the "unoptimized" state
      if (!version || !version.originalPrompt) {
        toast.error(t('toast.error.invalidVersion'))
        return
      }
      // V0 state: the optimization result shows the original input (meaning "unoptimized")
      state.optimizedPrompt = version.originalPrompt
      state.prompt = version.originalPrompt
      state.currentVersionId = version.id

      // Wait for a microtask to make sure the state update is complete
      await nextTick()
    },

    /**
     * Restore the full state from the history record
     *
     * 📌 When it is called:
     * - Triggered when the user clicks a Context User mode history record in the history panel
     * - Called by the parent component (App.vue), after handleSelectHistory updates the global state
     *
     * 📌 State separation design:
     * - handleSelectHistory updates the global optimizer state (App.vue level)
     * - loadFromHistory updates the independent state inside ContextUserWorkspace
     * - The two operate on different state trees, so there is no race risk
     *
     * @param payload - Payload object containing the history record data
     * @param payload.rootPrompt - Root prompt (preferred)
     * @param payload.chain - Prompt chain data (including all versions)
     * @param payload.record - The currently selected prompt record
     */
    loadFromHistory: ({ rootPrompt, chain, record }: { rootPrompt?: string; chain: PromptChain; record: PromptRecord }) => {
      state.prompt = rootPrompt || record.originalPrompt || ''
      state.optimizedPrompt = record.optimizedPrompt || ''
      state.optimizedReasoning = ''
      state.currentChainId = chain.chainId
      state.currentVersions = chain.versions
      state.currentVersionId = record.id
    },

    /**
     * Save local changes as a new version (does not trigger the LLM)
     * - Used for "direct fix" and explicit saving after manual edits
     */
    saveLocalEdit: async ({ optimizedPrompt, note, source }: { optimizedPrompt: string; note?: string; source?: 'patch' | 'manual' }) => {
      try {
        if (!historyManager.value) throw new Error('History service unavailable')
        if (!optimizedPrompt) return

        const currentRecord = state.currentVersions.find((v) => v.id === state.currentVersionId)
        const modelKey = currentRecord?.modelKey || selectedOptimizeModel.value || 'local-edit'
        const templateId =
          currentRecord?.templateId ||
          selectedIterateTemplate.value?.id ||
          selectedTemplate.value?.id ||
          'local-edit'

        // If there is currently no chain (rare), create a new chain for later version management
        if (!state.currentChainId) {
          const recordData = {
            id: uuidv4(),
            originalPrompt: state.prompt,
            optimizedPrompt,
            type: 'contextUserOptimize' as const,
            modelKey,
            templateId,
            timestamp: Date.now(),
            metadata: {
              optimizationMode: 'user' as const,
              functionMode: 'pro' as const,
              localEdit: true,
              localEditSource: source || 'manual',
            }
          }
          const newRecord = await historyManager.value.createNewChain(recordData)
          state.currentChainId = newRecord.chainId
          state.currentVersions = newRecord.versions
          state.currentVersionId = newRecord.currentRecord.id
          return
        }

        const updatedChain = await historyManager.value.addIteration({
          chainId: state.currentChainId,
          originalPrompt: state.prompt,
          optimizedPrompt,
          modelKey,
          templateId,
          iterationNote: note || (source === 'patch' ? 'Direct fix' : 'Manual edit'),
          metadata: {
            optimizationMode: 'user' as const,
            functionMode: 'pro' as const,
            localEdit: true,
            localEditSource: source || 'manual',
          }
        })

        state.currentVersions = updatedChain.versions
        state.currentVersionId = updatedChain.currentRecord.id
      } catch (error: unknown) {
        console.error('[useContextUserOptimization] Failed to save local changes:', error)
        toast.warning(t('toast.warning.saveHistoryFailed'))
      }
    },

    /**
     * Analyze feature: clear the version chain and create V0 (the original version)
     * - Does not write history records
     * - Only creates a virtual V0 version in memory
     */
    handleAnalyze: () => {
      if (!state.prompt.trim()) return

      // Generate a virtual V0 version record (not written to history)
      const virtualV0Id = uuidv4()
      const virtualV0: PromptChain['versions'][number] = {
        id: virtualV0Id,
        chainId: '', // Virtual chain, not associated with real history
        version: 0,
        originalPrompt: state.prompt,
        optimizedPrompt: state.prompt, // The optimized content of V0 is the original content
        type: 'userOptimize',
        timestamp: Date.now(),
        modelKey: '',
        templateId: '',
      }

      // Clear the old chain and set the new V0
      state.currentChainId = ''
      state.currentVersions = [virtualV0]
      state.currentVersionId = virtualV0Id
      state.optimizedPrompt = state.prompt
    }
  })

  // Sync selectedTemplate and selectedIterateTemplate
  // So that it can be controlled externally through props and also accessed internally
  const syncTemplates = () => {
    state.selectedTemplate = selectedTemplate.value
    state.selectedIterateTemplate = selectedIterateTemplate.value
  }

  // Initial sync
  syncTemplates()

  // Watch changes and sync (handled automatically by Vue's reactivity system)
  const unwatchTemplate = () => {
    state.selectedTemplate = selectedTemplate.value
  }
  const unwatchIterateTemplate = () => {
    state.selectedIterateTemplate = selectedIterateTemplate.value
  }

  // Return the reactive object
  return state
}
