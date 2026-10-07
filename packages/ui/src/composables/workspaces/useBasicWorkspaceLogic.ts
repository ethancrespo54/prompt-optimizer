/**
 * Basic mode workspace business logic (shared)
 *
 * Responsibilities:
 * - Extract the business logic shared by BasicSystemWorkspace and BasicUserWorkspace
 * - Parameterize the session store and the optimize/iterate template types
 * - Core features such as optimization, iteration, testing, version management, and evaluation
 *
 * @param services - AppServices instance
 * @param sessionStore - Session store (BasicSystemSession or BasicUserSession)
 * @param optimizationMode - Optimization mode ('system' | 'user')
 * @param templateType - Optimization template type ('optimize' | 'userOptimize')
 */
import { ref, computed, type Ref, type ComputedRef } from 'vue'
import type { AppServices } from '../../types/services'
import type { OptimizationRequest, PromptRecord, PromptRecordChain, PromptRecordType } from '@prompt-optimizer/core'
import { v4 as uuidv4 } from 'uuid'
import { useToast } from '../ui/useToast'
import { useI18n } from 'vue-i18n'
import { getI18nErrorMessage } from '../../utils/error'
import type { IteratePayload } from '../../types/workspace'

type BasicSessionStore = {
  prompt: string
  optimizedPrompt: string
  reasoning: string
  chainId: string
  versionId: string
  testContent: string
  testResults: {
    originalResult: string
    originalReasoning: string
    optimizedResult: string
    optimizedReasoning: string
  } | null
  selectedOptimizeModelKey: string
  selectedTestModelKey: string
  selectedTemplateId: string | null
  selectedIterateTemplateId: string | null
  isCompareMode: boolean
  updatePrompt: (prompt: string) => void
  updateOptimizedResult: (payload: {
    optimizedPrompt: string
    reasoning?: string
    chainId: string
    versionId: string
  }) => void
  updateTestContent: (content: string) => void
  updateTestResults: (results: {
    originalResult: string
    originalReasoning: string
    optimizedResult: string
    optimizedReasoning: string
  } | null) => void
  updateOptimizeModel: (key: string) => void
  updateTestModel: (key: string) => void
  updateTemplate: (id: string | null) => void
  updateIterateTemplate: (id: string | null) => void
}

interface UseBasicWorkspaceLogicOptions {
  services: Ref<AppServices | null>
  sessionStore: BasicSessionStore
  optimizationMode: 'system' | 'user'
  promptRecordType: PromptRecordType
  onOptimizeComplete?: (chain: PromptRecordChain) => void
  onIterateComplete?: (chain: PromptRecordChain) => void
  onLocalEditComplete?: (chain: PromptRecordChain) => void
}

export function useBasicWorkspaceLogic(options: UseBasicWorkspaceLogicOptions) {
  const { services, sessionStore, optimizationMode, promptRecordType, onOptimizeComplete, onIterateComplete, onLocalEditComplete } = options
  const toast = useToast()
  const { t } = useI18n()

  // Transient state
  const isOptimizing = ref(false)
  const isIterating = ref(false)
  const isTestingOriginal = ref(false)
  const isTestingOptimized = ref(false)

  // Ref dedicated to history management (not written to the session store)
  const currentChainId = ref('')
  const currentVersions = ref<PromptRecordChain['versions']>([])
  const currentVersionId = ref('')

  // State proxy (read from the session store)
  const prompt = computed<string>({
    get: () => sessionStore.prompt || '',
    set: (value) => sessionStore.updatePrompt(value || '')
  })

  const optimizedPrompt = computed<string>({
    get: () => sessionStore.optimizedPrompt || '',
    set: (value) => {
      sessionStore.updateOptimizedResult({
        optimizedPrompt: value || '',
        reasoning: sessionStore.reasoning || '',
        chainId: sessionStore.chainId || '',
        versionId: sessionStore.versionId || ''
      })
    }
  })

  const optimizedReasoning = computed<string>({
    get: () => sessionStore.reasoning || '',
    set: (value) => {
      sessionStore.updateOptimizedResult({
        optimizedPrompt: sessionStore.optimizedPrompt || '',
        reasoning: value || '',
        chainId: sessionStore.chainId || '',
        versionId: sessionStore.versionId || ''
      })
    }
  })

  const testContent = computed<string>({
    get: () => sessionStore.testContent || '',
    set: (value) => sessionStore.updateTestContent(value || '')
  })

  const testResults = computed<BasicSessionStore['testResults']>({
    get: () => {
      // ✅ Key fix: always return sessionStore.testResults (even if null/undefined)
      // Avoid returning a temporary object, which would break reactive tracking
      return sessionStore.testResults
    },
    set: (value) => {
      sessionStore.updateTestResults(value)
    }
  })

  const selectedOptimizeModelKey = computed<string>({
    get: () => sessionStore.selectedOptimizeModelKey || '',
    set: (value) => sessionStore.updateOptimizeModel(value || '')
  })

  const selectedTestModelKey = computed<string>({
    get: () => sessionStore.selectedTestModelKey || '',
    set: (value) => sessionStore.updateTestModel(value || '')
  })

  const selectedTemplateId = computed<string | null>({
    get: () => sessionStore.selectedTemplateId || null,
    set: (value) => sessionStore.updateTemplate(value)
  })

  const selectedIterateTemplateId = computed<string | null>({
    get: () => sessionStore.selectedIterateTemplateId || null,
    set: (value) => sessionStore.updateIterateTemplate(value)
  })

  // ==================== Core business logic ====================

  /**
   * 1. Optimize the prompt
   */
  const handleOptimize = async () => {
    if (!prompt.value?.trim() || isOptimizing.value) return

    const promptService = services.value?.promptService
    if (!promptService) {
      toast.error(t('toast.error.serviceInit'))
      return
    }

    const templateId = selectedTemplateId.value
    const modelKey = selectedOptimizeModelKey.value

    if (!templateId) {
      toast.error(t('toast.error.noOptimizeTemplate'))
      return
    }
    if (!modelKey) {
      toast.error(t('toast.error.noOptimizeModel'))
      return
    }

    isOptimizing.value = true

    // Clear the history binding to avoid the "old chainId/versionId" polluting this optimization's transient state
    sessionStore.updateOptimizedResult({
      optimizedPrompt: '',
      reasoning: '',
      chainId: '',
      versionId: ''
    })

    try {
      const request: OptimizationRequest = {
        optimizationMode,
        targetPrompt: prompt.value,
        templateId,
        modelKey
      }

      await promptService.optimizePromptStream(request, {
        onToken: (token: string) => {
          optimizedPrompt.value += token
        },
        onReasoningToken: (token: string) => {
          optimizedReasoning.value += token
        },
        onComplete: async () => {
          const historyManager = services.value?.historyManager
          if (historyManager) {
            try {
              const recordData = {
                id: uuidv4(),
                originalPrompt: prompt.value,
                optimizedPrompt: optimizedPrompt.value,
                type: promptRecordType,
                modelKey,
                templateId,
                timestamp: Date.now(),
                metadata: {
                  optimizationMode,
                  functionMode: 'basic'
                }
              }

              const chain = await historyManager.createNewChain(recordData)
              currentChainId.value = chain.chainId
              currentVersions.value = chain.versions
              currentVersionId.value = chain.currentRecord.id

              sessionStore.updateOptimizedResult({
                optimizedPrompt: optimizedPrompt.value,
                reasoning: optimizedReasoning.value,
                chainId: chain.chainId,
                versionId: chain.currentRecord.id
              })

              onOptimizeComplete?.(chain)
              toast.success(t('toast.success.optimizeSuccess'))
            } catch (error) {
              console.error('[useBasicWorkspaceLogic] Failed to create the history record:', error)
              currentVersions.value = []
              currentChainId.value = ''
              currentVersionId.value = ''
              // Clear the binding to avoid leaving the old chainId/versionId behind
              sessionStore.updateOptimizedResult({
                optimizedPrompt: optimizedPrompt.value,
                reasoning: optimizedReasoning.value,
                chainId: '',
                versionId: ''
              })
              toast.warning(t('toast.warning.optimizeCompleteButHistoryFailed'))
            }
          } else {
            currentVersions.value = []
            currentChainId.value = ''
            currentVersionId.value = ''
            // No history service: make sure the session does not retain the old chainId/versionId
            sessionStore.updateOptimizedResult({
              optimizedPrompt: optimizedPrompt.value,
              reasoning: optimizedReasoning.value,
              chainId: '',
              versionId: ''
            })
            toast.success(t('toast.success.optimizeCompleteNoHistory'))
          }
        },
        onError: (error: Error) => {
          throw error
        }
      })
    } catch (error) {
      const fallback = t('toast.error.optimizeFailed')
      const detail = getI18nErrorMessage(error, fallback)
      if (detail === fallback) {
        toast.error(fallback)
      } else {
        toast.error(`${fallback}: ${detail}`)
      }
    } finally {
      isOptimizing.value = false
    }
  }

  /**
   * 2. Iterative optimization
   */
  const handleIterate = async (payload: IteratePayload) => {
    if (!optimizedPrompt.value?.trim() || isIterating.value) return

    const promptService = services.value?.promptService
    if (!promptService) {
      toast.error(t('toast.error.serviceInit'))
      return
    }

    const iterateTemplateId = selectedIterateTemplateId.value
    const modelKey = selectedOptimizeModelKey.value
    const iterateInput = payload?.iterateInput?.trim() || ''

    if (!iterateTemplateId) {
      toast.error(t('toast.error.noIterateTemplate'))
      return
    }
    if (!modelKey) {
      toast.error(t('toast.error.noOptimizeModel'))
      return
    }
    if (!iterateInput) {
      toast.error(t('prompt.error.noIterateInput'))
      return
    }

    isIterating.value = true
    const originalPromptValue = payload.originalPrompt || prompt.value
    const lastOptimizedPrompt = payload.optimizedPrompt || optimizedPrompt.value
    optimizedPrompt.value = ''
    optimizedReasoning.value = ''

    try {
      await promptService.iteratePromptStream(
        originalPromptValue,
        lastOptimizedPrompt,
        iterateInput,
        modelKey,
        {
        onToken: (token: string) => {
          optimizedPrompt.value += token
        },
        onReasoningToken: (token: string) => {
          optimizedReasoning.value += token
        },
        onComplete: async () => {
          const historyManager = services.value?.historyManager
          if (historyManager) {
            try {
              const chainId = currentChainId.value || sessionStore.chainId || ''

              // If there is currently no chain (for example: the history service exists but nothing was written before / it was cleared), create a new chain first and then continue
              const chain = chainId
                ? await historyManager.addIteration({
                    chainId,
                    originalPrompt: originalPromptValue,
                    optimizedPrompt: optimizedPrompt.value,
                    iterationNote: iterateInput,
                    modelKey,
                    templateId: iterateTemplateId,
                  })
                : await historyManager.createNewChain({
                    id: uuidv4(),
                    originalPrompt: originalPromptValue,
                    optimizedPrompt: optimizedPrompt.value,
                    type: promptRecordType,
                    modelKey,
                    templateId: iterateTemplateId,
                    timestamp: Date.now(),
                    metadata: { optimizationMode, functionMode: 'basic' },
                  })

              currentChainId.value = chain.chainId
              currentVersions.value = chain.versions
              currentVersionId.value = chain.currentRecord.id

              sessionStore.updateOptimizedResult({
                optimizedPrompt: optimizedPrompt.value,
                reasoning: optimizedReasoning.value,
                chainId: chain.chainId,
                versionId: chain.currentRecord.id
              })

              onIterateComplete?.(chain)
              toast.success(t('toast.success.iterateComplete'))
            } catch (error) {
              console.error('[useBasicWorkspaceLogic] Failed to save the iteration record:', error)
              currentVersions.value = []
              currentChainId.value = ''
              currentVersionId.value = ''
              sessionStore.updateOptimizedResult({
                optimizedPrompt: optimizedPrompt.value,
                reasoning: optimizedReasoning.value,
                chainId: '',
                versionId: ''
              })
              toast.warning(t('toast.warning.iterateCompleteButHistoryFailed'))
            }
          } else {
            currentVersions.value = []
            currentChainId.value = ''
            currentVersionId.value = ''
            sessionStore.updateOptimizedResult({
              optimizedPrompt: optimizedPrompt.value,
              reasoning: optimizedReasoning.value,
              chainId: '',
              versionId: ''
            })
            toast.success(t('toast.success.iterateCompleteNoHistory'))
          }
        },
        onError: (error: Error) => {
          throw error
        }
        },
        iterateTemplateId,
      )
    } catch (error) {
      const fallback = t('toast.error.iterateFailed')
      const detail = getI18nErrorMessage(error, fallback)
      if (detail === fallback) {
        toast.error(fallback)
      } else {
        toast.error(`${fallback}: ${detail}`)
      }
    } finally {
      isIterating.value = false
    }
  }

  /**
   * 3. Test the prompt
   */
  const handleTest = async (_testVariables?: Record<string, string>) => {
    void _testVariables
    if (!optimizedPrompt.value?.trim()) {
      toast.error(t('prompt.error.noOptimizedPrompt'))
      return
    }

    const promptService = services.value?.promptService
    if (!promptService) {
      toast.error(t('toast.error.serviceInit'))
      return
    }

    const modelKey = selectedTestModelKey.value
    if (!modelKey) {
      toast.error(t('toast.error.noTestModel'))
      return
    }

    const isCompareMode = !!sessionStore.isCompareMode
    const testInput = testContent.value || ''

    // system mode: test input is required
    if (optimizationMode === 'system' && !testInput.trim()) {
      toast.error(t('test.simpleMode.help'))
      return
    }

    // 🔧 Clear the session store's testResults first (to avoid old data affecting the new test)
    sessionStore.updateTestResults(null)

    // Initialize the test results
    testResults.value = {
      originalResult: '',
      originalReasoning: '',
      optimizedResult: '',
      optimizedReasoning: ''
    }

    try {
      // Compare mode: test the original prompt first
      if (isCompareMode) {
        isTestingOriginal.value = true
        const systemPrompt = optimizationMode === 'system' ? prompt.value : ''
        const userPrompt = optimizationMode === 'system' ? testInput : prompt.value
        await promptService.testPromptStream(
          systemPrompt,
          userPrompt,
          modelKey,
          {
            onToken: (token: string) => {
              testResults.value = {
                ...(testResults.value || { originalResult: '', originalReasoning: '', optimizedResult: '', optimizedReasoning: '' }),
                originalResult: ((testResults.value?.originalResult) || '') + token
              }
            },
            onReasoningToken: (token: string) => {
              testResults.value = {
                ...(testResults.value || { originalResult: '', originalReasoning: '', optimizedResult: '', optimizedReasoning: '' }),
                originalReasoning: ((testResults.value?.originalReasoning) || '') + token
              }
            },
            onComplete: () => {
              isTestingOriginal.value = false
            },
            onError: (error: Error) => {
              throw error
            }
          }
        )
      }

      // Test the optimized prompt
      isTestingOptimized.value = true
      const optimizedSystemPrompt = optimizationMode === 'system' ? optimizedPrompt.value : ''
      const optimizedUserPrompt = optimizationMode === 'system' ? testInput : optimizedPrompt.value
      await promptService.testPromptStream(
        optimizedSystemPrompt,
        optimizedUserPrompt,
        modelKey,
        {
          onToken: (token: string) => {
              testResults.value = {
                ...(testResults.value || { originalResult: '', originalReasoning: '', optimizedResult: '', optimizedReasoning: '' }),
                optimizedResult: ((testResults.value?.optimizedResult) || '') + token
              }
          },
          onReasoningToken: (token: string) => {
              testResults.value = {
                ...(testResults.value || { originalResult: '', originalReasoning: '', optimizedResult: '', optimizedReasoning: '' }),
                optimizedReasoning: ((testResults.value?.optimizedReasoning) || '') + token
              }
          },
          onComplete: () => {
            toast.success(t('toast.success.testComplete'))
          },
          onError: (error: Error) => {
            throw error
          }
        }
      )
    } catch (error) {
      const fallback = t('toast.error.testFailed')
      const detail = getI18nErrorMessage(error, fallback)
      if (detail === fallback) {
        toast.error(fallback)
      } else {
        toast.error(`${fallback}: ${detail}`)
      }
    } finally {
      isTestingOriginal.value = false
      isTestingOptimized.value = false
    }
  }

  /**
   * 3.5 Save local edits as a new version (does not trigger the LLM)
   * - Write the currently edited optimizedPrompt into the history chain
   * - Clear reasoning (to avoid misusing old reasoning content)
   */
  const handleSaveLocalEdit = async (payload: { optimizedPrompt: string; note?: string; source?: 'patch' | 'manual' }) => {
    const historyManager = services.value?.historyManager
    if (!historyManager) {
      toast.error(t('toast.error.historyUnavailable'))
      return
    }

    const newPrompt = payload.optimizedPrompt || ''
    if (!newPrompt.trim()) return

    try {
      const chainId = currentChainId.value || sessionStore.chainId || ''
      const currentRecord = currentVersions.value.find((v) => v.id === currentVersionId.value)

      const modelKey = currentRecord?.modelKey || selectedOptimizeModelKey.value || 'local-edit'
      const templateId =
        currentRecord?.templateId ||
        selectedIterateTemplateId.value ||
        selectedTemplateId.value ||
        'local-edit'

      const note = payload.note || (payload.source === 'patch' ? 'Direct fix' : 'Manual edit')

      const chain = chainId
        ? await historyManager.addIteration({
            chainId,
            originalPrompt: prompt.value,
            optimizedPrompt: newPrompt,
            modelKey,
            templateId,
            iterationNote: note,
            metadata: {
              optimizationMode,
              functionMode: 'basic',
              localEdit: true,
              localEditSource: payload.source || 'manual',
            },
          })
        : await historyManager.createNewChain({
            id: uuidv4(),
            originalPrompt: prompt.value,
            optimizedPrompt: newPrompt,
            type: promptRecordType,
            modelKey,
            templateId,
            timestamp: Date.now(),
            metadata: {
              optimizationMode,
              functionMode: 'basic',
              localEdit: true,
              localEditSource: payload.source || 'manual',
            },
          })

      currentChainId.value = chain.chainId
      currentVersions.value = chain.versions
      currentVersionId.value = chain.currentRecord.id

      sessionStore.updateOptimizedResult({
        optimizedPrompt: newPrompt,
        reasoning: '',
        chainId: chain.chainId,
        versionId: chain.currentRecord.id,
      })

      onLocalEditComplete?.(chain)
      toast.success(t('toast.success.localEditSaved'))
    } catch (error) {
      console.error('[useBasicWorkspaceLogic] Failed to save local edits:', error)
      toast.warning(t('toast.warning.saveHistoryFailed'))
    }
  }

  /**
   * 4. Switch version
   */
  const handleSwitchVersion = (version: PromptRecord) => {
    if (!version?.id) return

    optimizedPrompt.value = version.optimizedPrompt || ''
    optimizedReasoning.value = ''
    currentVersionId.value = version.id
    currentChainId.value = version.chainId || currentChainId.value || sessionStore.chainId || ''

    sessionStore.updateOptimizedResult({
      optimizedPrompt: version.optimizedPrompt || '',
      reasoning: '',
      chainId: currentChainId.value || '',
      versionId: version.id
    })
  }

  /**
   * 5. Load the version list
   */
  const loadVersions = async () => {
    const historyManager = services.value?.historyManager
    if (!historyManager) {
      currentVersions.value = []
      currentChainId.value = ''
      currentVersionId.value = ''
      return
    }

    const chainId = sessionStore.chainId
    if (!chainId) {
      currentVersions.value = []
      currentChainId.value = ''
      currentVersionId.value = ''
      return
    }

    try {
      const chain = await historyManager.getChain(chainId)
      currentVersions.value = chain.versions
      currentChainId.value = chain.chainId
      currentVersionId.value = sessionStore.versionId || chain.currentRecord.id
    } catch (error) {
      console.error('[useBasicWorkspaceLogic] Failed to load versions:', error)
      currentVersions.value = []
      currentChainId.value = ''
      currentVersionId.value = ''
    }
  }

  return {
    // State proxy
    prompt,
    optimizedPrompt,
    optimizedReasoning,
    testContent,
    testResults,
    selectedOptimizeModelKey,
    selectedTestModelKey,
    selectedTemplateId,
    selectedIterateTemplateId,

    // Transient state
    isOptimizing,
    isIterating,
    isTestingOriginal,
    isTestingOptimized,

    // History management
    currentChainId,
    currentVersions,
    currentVersionId,

    // Business logic
    handleOptimize,
    handleIterate,
    handleTest,
    handleSaveLocalEdit,
    handleSwitchVersion,
    loadVersions
  }
}
