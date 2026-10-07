import { ref, nextTick, computed, reactive, type Ref, type ComputedRef } from 'vue'

import { useToast } from '../ui/useToast'
import { useI18n } from 'vue-i18n'
import { getI18nErrorMessage } from '../../utils/error'

import { v4 as uuidv4 } from 'uuid'
import type {
  IModelManager,
  IHistoryManager,
  Template,
  PromptRecordChain,
  PromptRecordType,
  IPromptService,
  ITemplateManager,
  OptimizationMode,
  OptimizationRequest,
  ConversationMessage,
  ToolDefinition,
} from '@prompt-optimizer/core'
import type { AppServices } from '../../types/services'
import { useFunctionMode, type FunctionMode } from '../mode'


type PromptChain = PromptRecordChain

interface AdvancedContextPayload {
  variables: Record<string, string>
  messages?: ConversationMessage[]
  tools?: ToolDefinition[]
}

/**
 * Prompt optimizer hook
 * @param services Service instance reference
 * @param optimizationMode Current optimization mode (a computed derived from basicSubMode/proSubMode)
 * @param selectedOptimizeModel Optimize model selection
 * @param selectedTestModel Test model selection
 * @param contextMode Context mode (used for the variable substitution strategy, kept for compatibility)
 * @returns Prompt optimizer interface
 * @deprecated The optimizationMode parameter should preferably be a computed value (computed dynamically from basicSubMode/proSubMode)
 */
type OptimizationModeSource = Ref<OptimizationMode> | ComputedRef<OptimizationMode>

export function usePromptOptimizer(
  services: Ref<AppServices | null>,
  optimizationMode: OptimizationModeSource,    // Required parameter, accepts a computed
  selectedOptimizeModel?: Ref<string>,                 // Optimize model selection
  selectedTestModel?: Ref<string>,                     // Test model selection
  contextMode?: Ref<import('@prompt-optimizer/core').ContextMode>,  // Context mode
  bindings?: {
    prompt?: Ref<string>
    optimizedPrompt?: Ref<string>
    optimizedReasoning?: Ref<string>
    currentChainId?: Ref<string>
    currentVersionId?: Ref<string>
  }
) {
  const optimizeModel = selectedOptimizeModel || ref('')
  const testModel = selectedTestModel || ref('')
  const toast = useToast()
  const { t } = useI18n()
  
  // Service reference
  const modelManager = computed(() => services.value?.modelManager)
  const templateManager = computed(() => services.value?.templateManager)
  const historyManager = computed(() => services.value?.historyManager)
  const promptService = computed(() => services.value?.promptService)
  const { functionMode } = useFunctionMode(services)
  
  const boundPrompt = bindings?.prompt ?? ref('')
  const boundOptimizedPrompt = bindings?.optimizedPrompt ?? ref('')
  const boundOptimizedReasoning = bindings?.optimizedReasoning ?? ref('')
  const boundCurrentChainId = bindings?.currentChainId ?? ref('')
  const boundCurrentVersionId = bindings?.currentVersionId ?? ref('')

  // Use reactive to create a reactive state object, instead of separate refs
  const state = reactive({
    // State
    prompt: boundPrompt,
    optimizedPrompt: boundOptimizedPrompt,
    optimizedReasoning: boundOptimizedReasoning, // Optimization reasoning content
    isOptimizing: false,
    isIterating: false,
    selectedOptimizeTemplate: null as Template | null,  // System prompt optimization template
    selectedUserOptimizeTemplate: null as Template | null,  // User prompt optimization template
    selectedIterateTemplate: null as Template | null,
    currentChainId: boundCurrentChainId,
    currentVersions: [] as PromptChain['versions'],
    currentVersionId: boundCurrentVersionId,
  
  // Methods (defined below and bound to state)
  handleOptimizePrompt: async () => {},
  handleOptimizePromptWithContext: async (_advancedContext: AdvancedContextPayload) => {},
  handleIteratePrompt: async (payload: { originalPrompt: string, optimizedPrompt: string, iterateInput: string }) => {},
  saveLocalEdit: async (_payload: { optimizedPrompt: string; note?: string; source?: 'patch' | 'manual' }) => {},
  handleSwitchVersion: async (version: PromptChain['versions'][number]) => {},
  handleAnalyze: () => {}
})
  
  // Note: storage keys are now managed uniformly by useTemplateManager
  
  // Optimize the prompt
  state.handleOptimizePrompt = async () => {
    if (!state.prompt.trim() || state.isOptimizing) return

    // Choose the corresponding template based on the optimization mode
    const currentTemplate = optimizationMode.value === 'system' 
      ? state.selectedOptimizeTemplate 
      : state.selectedUserOptimizeTemplate

    if (!currentTemplate) {
      toast.error(t('toast.error.noOptimizeTemplate'))
      return
    }

    if (!optimizeModel.value) {
      toast.error(t('toast.error.noOptimizeModel'))
      return
    }

    // Clear the state immediately before starting the optimization, to ensure no race condition
    state.isOptimizing = true
    state.optimizedPrompt = ''  // Force a synchronous clear
    state.optimizedReasoning = '' // Force a synchronous clear
    
    // Wait for a microtask to make sure the state update is complete
    await nextTick()

    try {
      // Build the optimization request
      const request: OptimizationRequest = {
        optimizationMode: optimizationMode.value,
        targetPrompt: state.prompt,
        templateId: currentTemplate.id,
        modelKey: optimizeModel.value,
        contextMode: contextMode?.value  // Pass the context mode
      }

      // Use the refactored optimization API
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
            if (!currentTemplate) return

            try {
              // Create new record chain with enhanced metadata; ElectronProxy handles serialization automatically
              // Decide the history record type based on functionMode and the current template type
              const isPro = (functionMode.value as FunctionMode) === 'pro'
              const baseType = (optimizationMode.value === 'system' ? 'optimize' : 'userOptimize') as PromptRecordType
              const recordType = (() => {
                if (isPro) {
                  return (optimizationMode.value === 'system' ? 'conversationMessageOptimize' : 'contextUserOptimize') as PromptRecordType
                }
                // Compatibility: if a context template is selected (even if the current mode is not pro), also record it as context*
                const tplType = currentTemplate.metadata?.templateType
                if (tplType === 'conversationMessageOptimize' || tplType === 'contextUserOptimize') return tplType as PromptRecordType
                return baseType
              })()

              const recordData = {
                id: uuidv4(),
                originalPrompt: state.prompt,
                optimizedPrompt: state.optimizedPrompt,
                type: recordType,
                modelKey: optimizeModel.value,
                templateId: currentTemplate.id,
                timestamp: Date.now(),
                metadata: {
                  optimizationMode: optimizationMode.value,
                  functionMode: functionMode.value
                }
              };

              const newRecord = await historyManager.value!.createNewChain(recordData);

              state.currentChainId = newRecord.chainId;
              state.currentVersions = newRecord.versions;
              state.currentVersionId = newRecord.currentRecord.id;

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
  }
  
  // Optimize the prompt with context
  state.handleOptimizePromptWithContext = async (advancedContext: AdvancedContextPayload) => {
    // For system mode, check the messages rather than the prompt
    const hasMessages = advancedContext.messages && Object.keys(advancedContext.messages).length > 0
    const hasPrompt = state.prompt.trim()

    // At least one of messages or prompt is required
    if ((!hasMessages && !hasPrompt) || state.isOptimizing) {
      console.log('[usePromptOptimizer] Skipping optimization:', { hasMessages, hasPrompt, isOptimizing: state.isOptimizing })
      return
    }

    // Choose the corresponding template based on the optimization mode
    const currentTemplate = optimizationMode.value === 'system' 
      ? state.selectedOptimizeTemplate 
      : state.selectedUserOptimizeTemplate

    if (!currentTemplate) {
      toast.error(t('toast.error.noOptimizeTemplate'))
      return
    }

    if (!optimizeModel.value) {
      toast.error(t('toast.error.noOptimizeModel'))
      return
    }

    // Clear the state immediately before starting the optimization, to ensure no race condition
    state.isOptimizing = true
    state.optimizedPrompt = ''  // Force a synchronous clear
    state.optimizedReasoning = '' // Force a synchronous clear
    
    // Wait for a microtask to make sure the state update is complete
    await nextTick()

    try {
      // Build the optimization request with the advanced context
      // In system mode, if there is no separate prompt, use the message content as the description
      const targetPrompt = state.prompt.trim() ||
        (advancedContext.messages && Object.keys(advancedContext.messages).length > 0
          ? t('toast.info.multiTurnOptimizationPrompt', { count: Object.keys(advancedContext.messages).length })
          : '');

      const request: OptimizationRequest = {
        optimizationMode: optimizationMode.value,
        targetPrompt,
        templateId: currentTemplate.id,
        modelKey: optimizeModel.value,
        contextMode: contextMode?.value,  // Pass the context mode
        // Key: add the advanced context
        advancedContext: {
          variables: advancedContext.variables,
          messages: advancedContext.messages,
          tools: advancedContext.tools  // 🆕 Add tool passing
        }
      }

      console.log('[usePromptOptimizer] Starting optimization with advanced context:', request.advancedContext)

      // Use the refactored optimization API
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
            if (!currentTemplate) return

            // Create the history record - including the context info
            try {
              const isPro = (functionMode.value as FunctionMode) === 'pro'
              const baseType = (optimizationMode.value === 'system' ? 'optimize' : 'userOptimize') as PromptRecordType
              const recordType = (() => {
                if (isPro) return (optimizationMode.value === 'system' ? 'conversationMessageOptimize' : 'contextUserOptimize') as PromptRecordType
                const tplType = currentTemplate.metadata?.templateType
                if (tplType === 'conversationMessageOptimize' || tplType === 'contextUserOptimize') return tplType as PromptRecordType
                return baseType
              })()

              const recordData = {
                id: uuidv4(),
                originalPrompt: targetPrompt,  // Use targetPrompt instead of state.prompt
                optimizedPrompt: state.optimizedPrompt,
                type: recordType,
                modelKey: optimizeModel.value,
                templateId: currentTemplate.id,
                timestamp: Date.now(),
                // Add the context info to the history record
                metadata: {
                  optimizationMode: optimizationMode.value,
                  functionMode: functionMode.value,
                  hasAdvancedContext: true,
                  variableCount: Object.keys(advancedContext.variables).length,
                  messageCount: advancedContext.messages?.length || 0,
                  conversationSnapshot: advancedContext.messages?.map(msg => ({
                    id: msg.id || '',
                    role: msg.role,
                    content: msg.content,
                    originalContent: msg.originalContent,
                    // Runtime property: metadata added dynamically after the message is optimized
                    chainId: (msg as unknown as Record<string, unknown>).chainId as string | undefined,
                    appliedVersion: (msg as unknown as Record<string, unknown>).appliedVersion as number | undefined
                  }))
                }
              };

              const newRecord = await historyManager.value!.createNewChain(recordData);

              state.currentChainId = newRecord.chainId;
              state.currentVersions = newRecord.versions;
              state.currentVersionId = newRecord.currentRecord.id;

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
  }
  
  // Iterative optimization
  state.handleIteratePrompt = async ({ originalPrompt, optimizedPrompt: lastOptimizedPrompt, iterateInput }: { originalPrompt: string, optimizedPrompt: string, iterateInput: string }) => {
    // 🔧 Fix: the iterate template does not actually need originalPrompt, only lastOptimizedPrompt and iterateInput
    // Removed the !originalPrompt check, allowing users to iterate after editing directly in the workspace
    if (!lastOptimizedPrompt || state.isIterating) return
    if (!iterateInput) return
    if (!state.selectedIterateTemplate) {
      toast.error(t('toast.error.noIterateTemplate'))
      return
    }

    // Clear the state immediately before starting the iteration, to ensure no race condition
    state.isIterating = true
    state.optimizedPrompt = ''  // Force a synchronous clear
    state.optimizedReasoning = '' // Force a synchronous clear
    
    // Wait for a microtask to make sure the state update is complete
    await nextTick()
    
    try {
      await promptService.value!.iteratePromptStream(
        originalPrompt,
        lastOptimizedPrompt,
        iterateInput,
        optimizeModel.value,
        {
          onToken: (token: string) => {
            state.optimizedPrompt += token
          },
          onReasoningToken: (reasoningToken: string) => {
            state.optimizedReasoning += reasoningToken
          },
          onComplete: async (_response: unknown) => {
            if (!state.selectedIterateTemplate) {
              state.isIterating = false
              return
            }

            try {
              // Use the correct addIteration method to save the iteration history; ElectronProxy handles serialization automatically
              const iterationData = {
                chainId: state.currentChainId,
                originalPrompt: originalPrompt,
                optimizedPrompt: state.optimizedPrompt,
                iterationNote: iterateInput,
                modelKey: optimizeModel.value,
                templateId: state.selectedIterateTemplate.id
              };

              const updatedChain = await historyManager.value!.addIteration(iterationData);

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
        state.selectedIterateTemplate.id
      )
    } catch (error: unknown) {
      console.error('[Iterate] Iteration failed:', error)
      toast.error(t('toast.error.iterateFailed'))
      state.isIterating = false
    }
  }

  /**
   * Save local changes as a new version (does not trigger the LLM)
   * - Used for "direct fix" and explicit saving after manual edits
   */
  state.saveLocalEdit = async ({ optimizedPrompt, note, source }: { optimizedPrompt: string; note?: string; source?: 'patch' | 'manual' }) => {
    try {
      if (!historyManager.value) throw new Error('History service unavailable')
      if (!optimizedPrompt) return

      const currentRecord = state.currentVersions.find((v: { id: string; modelKey?: string; templateId?: string }) => v.id === state.currentVersionId)
      const modelKey = currentRecord?.modelKey || optimizeModel.value || 'local-edit'
      const templateId =
        currentRecord?.templateId ||
        state.selectedIterateTemplate?.id ||
        (optimizationMode.value === 'system' ? state.selectedOptimizeTemplate?.id : state.selectedUserOptimizeTemplate?.id) ||
        'local-edit'

      // If there is currently no chain (rare), create a new chain for later version management
      if (!state.currentChainId) {
        const baseType = (optimizationMode.value === 'system' ? 'optimize' : 'userOptimize') as PromptRecordType
        const recordData = {
          id: uuidv4(),
          originalPrompt: state.prompt,
          optimizedPrompt,
          type: baseType,
          modelKey,
          templateId,
          timestamp: Date.now(),
          metadata: {
            optimizationMode: optimizationMode.value,
            functionMode: functionMode.value,
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
          optimizationMode: optimizationMode.value,
          functionMode: functionMode.value,
          localEdit: true,
          localEditSource: source || 'manual',
        }
      })

      state.currentVersions = updatedChain.versions
      state.currentVersionId = updatedChain.currentRecord.id
    } catch (error: unknown) {
      console.error('[usePromptOptimizer] Failed to save local changes:', error)
      toast.warning(t('toast.warning.saveHistoryFailed'))
    }
  }
  
  // Switch version - enhanced version, ensuring a forced update
  state.handleSwitchVersion = async (version: PromptChain['versions'][number]) => {
    // Force a content update to make sure the UI is in sync
    state.optimizedPrompt = version.optimizedPrompt;
    state.currentVersionId = version.id;

    // Wait for a microtask to make sure the state update is complete
    await nextTick()
  }

  /**
   * Analyze feature: clear the version chain and create V0 (the original version)
   * - Does not write history records
   * - Only creates a virtual V0 version in memory
   */
  state.handleAnalyze = () => {
    if (!state.prompt.trim()) return

    // Generate a virtual V0 version record (not written to history)
    const virtualV0Id = uuidv4()
    const virtualV0: PromptChain['versions'][number] = {
      id: virtualV0Id,
      chainId: '', // Virtual chain, not associated with real history
      version: 0,
      originalPrompt: state.prompt,
      optimizedPrompt: state.prompt, // The optimized content of V0 is the original content
      type: 'optimize',
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

  // Note: template initialization, selection saving, and change watching are now all handled by useTemplateManager

  // Return the reactive object instead of an object containing multiple refs
  return state
} 
