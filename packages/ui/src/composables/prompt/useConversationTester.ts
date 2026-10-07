import { reactive, type Ref, type ComputedRef } from 'vue'
import { useToast } from '../ui/useToast'
import { useI18n } from 'vue-i18n'
import { getI18nErrorMessage } from '../../utils/error'
import type { OptimizationMode, ToolDefinition, ToolCall, ToolCallResult, ConversationMessage } from '@prompt-optimizer/core'
import type { AppServices } from '../../types/services'
import type { VariableManagerHooks } from './useVariableManager'
import type { TestAreaPanelInstance } from '../../components/types/test-area'

/**
 * Test composable dedicated to multi-conversation mode
 *
 * Specifically handles the test logic of context multi-message mode, including:
 * - V0 comparison of the selected message
 * - Conversation context handling
 * - Tool call support
 *
 * @param services Service instance reference
 * @param selectedTestModel Test model selection
 * @param optimizationContext Optimization context (conversation messages)
 * @param optimizationContextTools Context tool list
 * @param variableManager Variable manager
 * @param selectedMessageId Currently selected message ID (used for compare mode)
 * @returns Multi-conversation test interface
 */
export function useConversationTester(
  services: Ref<AppServices | null>,
  selectedTestModel: Ref<string>,
  optimizationContext: Ref<ConversationMessage[]>,
  optimizationContextTools: Ref<ToolDefinition[]>,
  variableManager: VariableManagerHooks | null,
  selectedMessageId?: Ref<string>
) {
  const toast = useToast()
  const { t } = useI18n()

  const state = reactive({
    testResults: {
      originalResult: '',
      originalReasoning: '',
      isTestingOriginal: false,

      optimizedResult: '',
      optimizedReasoning: '',
      isTestingOptimized: false,
    },

    /**
     * Run a multi-conversation test (supports compare mode)
     * @param isCompareMode Whether in compare mode
     * @param testVariables Test variables
     * @param testPanelRef Test panel reference (used for tool call callbacks)
     */
    executeTest: async (
      isCompareMode: boolean,
      testVariables?: Record<string, string>,
      testPanelRef?: TestAreaPanelInstance | null
    ) => {
      if (!services.value?.promptService) {
        toast.error(t('toast.error.serviceInit'))
        return
      }

      if (!selectedTestModel.value) {
        toast.error(t('test.error.noModel'))
        return
      }

      // Check the conversation context
      if (!optimizationContext.value || optimizationContext.value.length === 0) {
        toast.error(t('test.error.noConversation'))
        return
      }

      if (isCompareMode) {
        // Compare mode: test the original and optimized conversations concurrently
        const originalTestPromise = state.testConversation('original', testVariables, testPanelRef)
        const optimizedTestPromise = state.testConversation('optimized', testVariables, testPanelRef)
        await Promise.all([originalTestPromise, optimizedTestPromise])
      } else {
        // Single mode: only test the optimized conversation
        await state.testConversation('optimized', testVariables, testPanelRef)
      }
    },

    /**
     * Test a specific kind of conversation (original vs optimized)
     */
    testConversation: async (
      type: 'original' | 'optimized',
      testVars?: Record<string, string>,
      testPanelRef?: TestAreaPanelInstance | null
    ) => {
      const isOriginal = type === 'original'

      // Set the test state
      if (isOriginal) {
        state.testResults.isTestingOriginal = true
        state.testResults.originalResult = ''
        state.testResults.originalReasoning = ''
      } else {
        state.testResults.isTestingOptimized = true
        state.testResults.optimizedResult = ''
        state.testResults.optimizedReasoning = ''
      }

      // Clear the tool call data of the corresponding type
      testPanelRef?.clearToolCalls(isOriginal ? 'original' : 'optimized')

      try {
        const streamHandler = {
          onToken: (token: string) => {
            if (isOriginal) {
              state.testResults.originalResult += token
            } else {
              state.testResults.optimizedResult += token
            }
          },
          onReasoningToken: (reasoningToken: string) => {
            if (isOriginal) {
              state.testResults.originalReasoning += reasoningToken
            } else {
              state.testResults.optimizedReasoning += reasoningToken
            }
          },
          onComplete: () => {
            // Test completed successfully
          },
          onError: (err: Error) => {
            const errorMessage = err.message || t('test.error.failed')
            console.error(`[useConversationTester] ${type} test failed:`, errorMessage)
            const testTypeKey = type === 'original' ? 'originalTestFailed' : 'optimizedTestFailed'
            toast.error(`${t(`test.error.${testTypeKey}`)}: ${errorMessage}`)
          },
        }

        // Variables: merge global variables + test variables
        const baseVars = variableManager?.variableManager.value?.resolveAllVariables() || {}
        const variables = {
          ...baseVars,
          ...(testVars || {}),
        }

        // Construct the conversation messages:
        // - Original conversation (original): only the selected message uses originalContent (V0), other messages use the current version
        // - Optimized conversation (optimized): all messages use the current version
        const messages: ConversationMessage[] = isOriginal
          ? optimizationContext.value.map(msg => ({
              ...msg,
              content: (selectedMessageId?.value && msg.id === selectedMessageId.value)
                ? (msg.originalContent || msg.content)
                : msg.content
            }))
          : optimizationContext.value

        // Check whether there are tools
        const hasTools = optimizationContextTools.value?.length > 0

        // Use the custom conversation test
        await services.value!.promptService.testCustomConversationStream(
          {
            modelKey: selectedTestModel.value,
            messages,
            variables,
            tools: hasTools ? optimizationContextTools.value : [],
          },
          {
            ...streamHandler,
            onToolCall: (toolCall: ToolCall) => {
              if (!hasTools) return
              console.log(
                `[useConversationTester] ${type} test tool call received:`,
                toolCall
              )
              const toolCallResult: ToolCallResult = {
                toolCall,
                status: 'success',
                timestamp: new Date(),
              }
              testPanelRef?.handleToolCall(toolCallResult, type)
            },
          }
        )
      } catch (error: unknown) {
        console.error(`[useConversationTester] ${type} test error:`, error)
        const errorMessage = getI18nErrorMessage(error, t('test.error.failed'))
        const testTypeKey = type === 'original' ? 'originalTestFailed' : 'optimizedTestFailed'
        toast.error(`${t(`test.error.${testTypeKey}`)}: ${errorMessage}`)
      } finally {
        // Reset the test state
        if (isOriginal) {
          state.testResults.isTestingOriginal = false
        } else {
          state.testResults.isTestingOptimized = false
        }
      }
    },
  })

  return state
}
