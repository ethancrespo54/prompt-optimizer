import { reactive, type Ref, type ComputedRef } from 'vue'

import { useToast } from '../ui/useToast'
import { useI18n } from 'vue-i18n'
import { getI18nErrorMessage } from '../../utils/error'
import type { OptimizationMode } from '@prompt-optimizer/core'
import type { AppServices } from '../../types/services'
import type { ConversationMessage } from '../../types/variable'
import type { VariableManagerHooks } from './useVariableManager'

/**
 * Basic mode prompt test composable
 *
 * Specifically handles prompt testing in basic mode, supporting:
 * - System prompt testing
 * - User prompt testing
 * - Variable injection
 * - Compare mode (original vs optimized)
 *
 * @param services Service instance reference
 * @param selectedTestModel Test model selection
 * @param optimizationMode Current optimization mode
 * @param variableManager Variable manager
 * @returns Basic test interface
 */
type OptimizationModeSource = Ref<OptimizationMode> | ComputedRef<OptimizationMode>

export function usePromptTester(
  services: Ref<AppServices | null>,
  selectedTestModel: Ref<string>,
  optimizationMode: OptimizationModeSource,
  variableManager: VariableManagerHooks | null
) {
  const toast = useToast()
  const { t } = useI18n()

  // Create a reactive state object
  const state = reactive({
    // States - test result state
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

    // Methods
    /**
     * Run a basic mode test (supports compare mode)
     * @param prompt Original prompt
     * @param optimizedPrompt Optimized prompt
     * @param testContent Test content
     * @param isCompareMode Whether in compare mode
     * @param testVariables Test variables
     */
    executeTest: async (
      prompt: string,
      optimizedPrompt: string,
      testContent: string,
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
            testContent,
            testVariables
          ),
          state.testPromptWithType(
            'optimized',
            prompt,
            optimizedPrompt,
            testContent,
            testVariables
          )
        ])
      } else {
        // Single mode: only test the optimized prompt
        await state.testPromptWithType(
          'optimized',
          prompt,
          optimizedPrompt,
          testContent,
          testVariables
        )
      }
    },

    /**
     * Test a specific kind of prompt (basic mode)
     */
    testPromptWithType: async (
      type: 'original' | 'optimized',
      prompt: string,
      optimizedPrompt: string,
      testContent: string,
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
            console.error(`[usePromptTester] ${type} test failed:`, errorMessage)
            const testTypeKey = type === 'original' ? 'originalTestFailed' : 'optimizedTestFailed'
            toast.error(`${t(`test.error.${testTypeKey}`)}: ${errorMessage}`)
          },
        }

        // Construct the system message and the user message
        let systemPrompt = ''
        let userPrompt = ''

        if (optimizationMode.value === 'user') {
          // User prompt mode: the prompt is used as the user input
          systemPrompt = ''
          userPrompt = selectedPrompt
        } else {
          // System prompt mode: the prompt is used as the system message
          systemPrompt = selectedPrompt
          userPrompt = testContent || 'Please follow your role definition, show your abilities, and interact with me.'
        }

        // Variables: merge global variables + test variables
        const baseVars = variableManager?.variableManager.value?.resolveAllVariables() || {}
        const variables = {
          ...baseVars,
          ...(testVars || {}),
          currentPrompt: selectedPrompt,
          userQuestion: userPrompt,
        }

        // Construct a simple message list
        const messages: ConversationMessage[] = [
          ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
          { role: 'user' as const, content: userPrompt },
        ]

        // Use the custom conversation test
        await services.value!.promptService.testCustomConversationStream(
          {
            modelKey: selectedTestModel.value,
            messages,
            variables,
            tools: [], // Basic mode does not support tool calls
          },
          streamHandler
        )
      } catch (error: unknown) {
        console.error(`[usePromptTester] ${type} test error:`, error)
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
