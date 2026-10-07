import { reactive, type Ref } from 'vue'
import { useToast } from '../ui/useToast'
import { useI18n } from 'vue-i18n'
import { getI18nErrorMessage } from '../../utils/error'
import type { AppServices } from '../../types/services'
import type { ConversationMessage } from '../../types/variable'
import type { VariableManagerHooks } from './useVariableManager'

/**
 * ContextUser mode test result interface
 */
export interface ContextUserTestResults {
  // Original prompt result
  originalResult: string
  originalReasoning: string
  isTestingOriginal: boolean

  // Optimized prompt result
  optimizedResult: string
  optimizedReasoning: string
  isTestingOptimized: boolean
}

/**
 * ContextUser mode tester interface
 */
export interface UseContextUserTester {
  // Test result state
  testResults: ContextUserTestResults

  // Methods
  executeTest: (
    prompt: string,
    optimizedPrompt: string,
    isCompareMode: boolean,
    testVariables?: Record<string, string>
  ) => Promise<void>
}

/**
 * ContextUser mode prompt tester composable
 *
 * Dedicated to the test logic of ContextUserWorkspace, with these characteristics:
 * - Only handles user mode testing (user mode)
 * - Independent test result state management
 * - Supports compare mode (original vs optimized)
 * - Symmetric with useConversationTester of ContextSystem
 *
 * @param services Service instance reference
 * @param selectedTestModel Test model selection
 * @param variableManager Variable manager
 * @returns ContextUser tester interface
 *
 * @example
 * ```ts
 * const contextUserTester = useContextUserTester(
 *   services,
 *   computed(() => props.selectedTestModel),
 *   variableManager
 * )
 *
 * // Run the test
 * await contextUserTester.executeTest(
 *   prompt,
 *   optimizedPrompt,
 *   isCompareMode,
 *   testVariables
 * )
 * ```
 */
export function useContextUserTester(
  services: Ref<AppServices | null>,
  selectedTestModel: Ref<string>,
  variableManager: VariableManagerHooks | null
): UseContextUserTester {
  const toast = useToast()
  const { t } = useI18n()

  type InternalTesterState = UseContextUserTester & {
    testPromptWithType: (
      type: 'original' | 'optimized',
      prompt: string,
      optimizedPrompt: string,
      testVars?: Record<string, string>
    ) => Promise<void>
  }

  // Create the reactive state object
  const state = reactive<InternalTesterState>({
    // Test result state
    testResults: {
      // Original prompt result
      originalResult: '',
      originalReasoning: '',
      isTestingOriginal: false,

      // Optimized prompt result
      optimizedResult: '',
      optimizedReasoning: '',
      isTestingOptimized: false,
    },

    // Run the test (supports compare mode)
    executeTest: async (
      prompt: string,
      optimizedPrompt: string,
      isCompareMode: boolean,
      testVariables?: Record<string, string>
    ) => {
      if (!services.value?.promptService) {
        toast.error(t('toast.error.serviceInit'))
        return
      }

      if (!selectedTestModel.value) {
        toast.error(t('test.error.noModel'))
        return
      }

      if (isCompareMode) {
        // Compare mode: test the original and optimized prompts concurrently
        await Promise.all([
          state.testPromptWithType(
            'original',
            prompt,
            optimizedPrompt,
            testVariables
          ),
          state.testPromptWithType(
            'optimized',
            prompt,
            optimizedPrompt,
            testVariables
          )
        ])
      } else {
        // Single mode: only test the optimized prompt
        await state.testPromptWithType(
          'optimized',
          prompt,
          optimizedPrompt,
          testVariables
        )
      }
    },

    /**
     * Test a specific kind of prompt (internal method)
     */
    testPromptWithType: async (
      type: 'original' | 'optimized',
      prompt: string,
      optimizedPrompt: string,
      testVars?: Record<string, string>
    ) => {
      const isOriginal = type === 'original'
      const selectedPrompt = isOriginal ? prompt : optimizedPrompt

      // Check the prompt
      if (!selectedPrompt) {
        toast.error(
          isOriginal ? t('test.error.noOriginalPrompt') : t('test.error.noOptimizedPrompt')
        )
        return
      }

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
            console.error(`[useContextUserTester] ${type} test failed:`, errorMessage)
            const testTypeKey = type === 'original' ? 'originalTestFailed' : 'optimizedTestFailed'
            toast.error(`${t(`test.error.${testTypeKey}`)}: ${errorMessage}`)
          },
        }

        // ContextUser mode: the prompt is used as the user input
        // optimizationMode is fixed to 'user'
        const systemPrompt = ''
        const userPrompt = selectedPrompt

        // Variables: merge global variables + test variables
        const baseVars = variableManager?.variableManager.value?.resolveAllVariables() || {}
        const variables = {
          ...baseVars,
          ...(testVars || {}),
          currentPrompt: selectedPrompt,
          userQuestion: userPrompt,
        }

        // Construct a simple message list (ContextUser mode only has user messages)
        const messages: ConversationMessage[] = [
          { role: 'user' as const, content: userPrompt },
        ]

        // Use the custom conversation test
        await services.value!.promptService.testCustomConversationStream(
          {
            modelKey: selectedTestModel.value,
            messages,
            variables,
            tools: [], // ContextUser mode does not support tool calls by default (can be extended if needed)
          },
          streamHandler
        )
      } catch (error: unknown) {
        console.error(`[useContextUserTester] ${type} test error:`, error)
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

  return state as UseContextUserTester
}
