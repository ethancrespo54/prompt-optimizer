/**
 * Variable extraction service composable
 *
 * Provides a reactive interface for the AI smart variable extraction feature
 */

import { ref, type Ref } from 'vue'
import { useToast } from '../ui/useToast'
import { useI18n } from 'vue-i18n'
import { getI18nErrorMessage } from '../../utils/error'
import type { AppServices } from '../../types/services'
import { VARIABLE_VALIDATION, isValidVariableName } from '../../types/variable'
import type {
  VariableExtractionResponse,
  ExtractedVariable,
} from '@prompt-optimizer/core'

/**
 * Return type of the variable extraction composable
 */
export interface UseVariableExtractionReturn {
  /** Whether extraction is in progress */
  isExtracting: Ref<boolean>
  /** Extraction result */
  extractionResult: Ref<VariableExtractionResponse | null>
  /** Whether to show the result dialog */
  showResultDialog: Ref<boolean>
  /** Extract variables method */
  extractVariables: (
    promptContent: string,
    extractionModelKey: string,
    existingVariableNames?: string[]
  ) => Promise<void>
  /** Batch create variables method */
  confirmBatchCreate: (selectedVariables: ExtractedVariable[]) => void
}

/**
 * Use the variable extraction feature
 *
 * @param services - App services
 * @param onVariableCreated - Variable creation callback
 * @param onPromptReplaced - Prompt replacement callback (returns the replaced prompt)
 * @returns State and methods related to variable extraction
 */
export function useVariableExtraction(
  services: Ref<AppServices | null>,
  onVariableCreated?: (name: string, value: string) => void,
  onPromptReplaced?: (replacedPrompt: string) => void
): UseVariableExtractionReturn {
  const toast = useToast()
  const { t } = useI18n()

  // State
  const isExtracting = ref(false)
  const extractionResult = ref<VariableExtractionResponse | null>(null)
  const showResultDialog = ref(false)
  // Save the original prompt content for replacement
  const originalPrompt = ref('')

  /**
   * Extract variables
   */
  const extractVariables = async (
    promptContent: string,
    extractionModelKey: string,
    existingVariableNames: string[] = []
  ): Promise<void> => {
    if (!services.value) {
      toast.error(t('evaluation.error.serviceNotReady'))
      return
    }

    // 🔧 Check whether the variable extraction service exists
    if (!services.value.variableExtractionService) {
      toast.error(t('evaluation.variableExtraction.serviceNotReady'))
      return
    }

    isExtracting.value = true
    // Save the original prompt for later replacement
    originalPrompt.value = promptContent

    try {
      const result = await services.value.variableExtractionService.extract({
        promptContent,
        extractionModelKey,
        existingVariableNames,
      })

      extractionResult.value = result

      if (result.variables.length > 0) {
        showResultDialog.value = true
      } else {
        toast.info(t('evaluation.variableExtraction.noVariables'))
      }
    } catch (error) {
      const errorMsg = getI18nErrorMessage(error, 'Unknown error')
      toast.error(`${t('evaluation.variableExtraction.extractFailed')}: ${errorMsg}`)
      console.error('[useVariableExtraction] Extract failed:', error)
    } finally {
      isExtracting.value = false
    }
  }

  /**
   * Replace the variable values in the prompt with the {{variableName}} format
   */
  const replaceVariablesInPrompt = (
    prompt: string,
    variables: ExtractedVariable[]
  ): string => {
    let result = prompt

    // Sort by occurrence position from back to front, to avoid position misalignment during replacement
    const sortedVariables = [...variables].sort((a, b) => {
      const indexA = findOccurrenceIndex(prompt, a.position.originalText, a.position.occurrence)
      const indexB = findOccurrenceIndex(prompt, b.position.originalText, b.position.occurrence)
      return indexB - indexA
    })

    // Replace from back to front
    for (const variable of sortedVariables) {
      const { originalText, occurrence } = variable.position
      const placeholder = `{{${variable.name}}}`

      // Find the position of the Nth occurrence
      const index = findOccurrenceIndex(result, originalText, occurrence)
      if (index !== -1) {
        result =
          result.substring(0, index) +
          placeholder +
          result.substring(index + originalText.length)
      }
    }

    return result
  }

  /**
   * Find the index position of the Nth occurrence of the text
   */
  const findOccurrenceIndex = (
    text: string,
    searchText: string,
    occurrence: number
  ): number => {
    let count = 0
    let index = -1

    while (count < occurrence) {
      index = text.indexOf(searchText, index + 1)
      if (index === -1) {
        return -1
      }
      count++
    }

    return index
  }

  /**
   * Batch create variables
   */
  const confirmBatchCreate = (selectedVariables: ExtractedVariable[]): void => {
    // 🔧 Validate the variable names and filter out invalid variables
    const validVariables: ExtractedVariable[] = []
    const invalidVariables: string[] = []

    for (const variable of selectedVariables) {
      if (isValidVariableName(variable.name)) {
        validVariables.push(variable)
      } else {
        invalidVariables.push(variable.name)
      }
    }

    // If there are invalid variable names, notify the user
    if (invalidVariables.length > 0) {
      toast.warning(
        t('evaluation.variableExtraction.invalidVariableNames', {
          names: invalidVariables.join(', '),
          max: VARIABLE_VALIDATION.MAX_NAME_LENGTH,
        })
      )
    }

    // If there are no valid variables, return directly
    if (validVariables.length === 0) {
      showResultDialog.value = false
      return
    }

    let successCount = 0

    // Create variables (only valid variables are created)
    for (const variable of validVariables) {
      try {
        if (onVariableCreated) {
          onVariableCreated(variable.name, variable.value)
          successCount++
        }
      } catch (error) {
        console.error(`[useVariableExtraction] Failed to create variable ${variable.name}:`, error)
      }
    }

    // Replace the variable values in the prompt with {{variableName}} (only valid variables are replaced)
    if (successCount > 0 && onPromptReplaced && originalPrompt.value) {
      const replacedPrompt = replaceVariablesInPrompt(originalPrompt.value, validVariables)
      onPromptReplaced(replacedPrompt)
    }

    showResultDialog.value = false

    if (successCount > 0) {
      toast.success(t('evaluation.variableExtraction.createSuccess', { count: successCount }))
    }
  }

  return {
    isExtracting,
    extractionResult,
    showResultDialog,
    extractVariables,
    confirmBatchCreate,
  }
}
