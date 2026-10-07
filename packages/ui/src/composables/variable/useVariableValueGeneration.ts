/**
 * Variable value generation service composable
 *
 * Provides a reactive interface for the AI smart variable value generation feature
 */

import { ref, type Ref } from 'vue'
import { useToast } from '../ui/useToast'
import { useI18n } from 'vue-i18n'
import { getI18nErrorMessage } from '../../utils/error'
import type { AppServices } from '../../types/services'
import type {
  VariableValueGenerationResponse,
  GeneratedVariableValue,
  VariableToGenerate,
} from '@prompt-optimizer/core'

/**
 * Return type of the variable value generation composable
 */
export interface UseVariableValueGenerationReturn {
  /** Whether generation is in progress */
  isGenerating: Ref<boolean>
  /** Generation result */
  generationResult: Ref<VariableValueGenerationResponse | null>
  /** Whether to show the preview dialog */
  showPreviewDialog: Ref<boolean>
  /** Generate variable values method */
  generateValues: (
    promptContent: string,
    variables: VariableToGenerate[],
    generationModelKey: string
  ) => Promise<void>
  /** Batch apply variable values method */
  confirmBatchApply: (selectedValues: GeneratedVariableValue[]) => void
}

/**
 * Use the variable value generation feature
 *
 * @param services - App services
 * @param onValueApplied - Variable value applied callback (name, value) => void
 * @returns State and methods related to variable value generation
 */
export function useVariableValueGeneration(
  services: Ref<AppServices | null>,
  onValueApplied?: (name: string, value: string) => void
): UseVariableValueGenerationReturn {
  const toast = useToast()
  const { t } = useI18n()

  // State
  const isGenerating = ref(false)
  const generationResult = ref<VariableValueGenerationResponse | null>(null)
  const showPreviewDialog = ref(false)

  /**
   * Generate variable values
   */
  const generateValues = async (
    promptContent: string,
    variables: VariableToGenerate[],
    generationModelKey: string
  ): Promise<void> => {
    if (!services.value?.variableValueGenerationService) {
      toast.error(t('test.variableValueGeneration.serviceNotReady'))
      return
    }

    if (variables.length === 0) {
      toast.info(t('test.variableValueGeneration.noVariablesToGenerate'))
      return
    }

    isGenerating.value = true

    try {
      const result = await services.value.variableValueGenerationService.generate({
        promptContent,
        variables,
        generationModelKey,
      })

      generationResult.value = result

      if (result.values.length > 0) {
        showPreviewDialog.value = true
      } else {
        toast.info(t('test.variableValueGeneration.noValues'))
      }
    } catch (error) {
      const errorMsg = getI18nErrorMessage(error, 'Unknown error')
      toast.error(`${t('test.variableValueGeneration.generateFailed')}: ${errorMsg}`)
      console.error('[useVariableValueGeneration] Generate failed:', error)
    } finally {
      isGenerating.value = false
    }
  }

  /**
   * Batch apply variable values
   */
  const confirmBatchApply = (selectedValues: GeneratedVariableValue[]): void => {
    let successCount = 0

    // Apply the variable values
    for (const item of selectedValues) {
      try {
        if (onValueApplied) {
          onValueApplied(item.name, item.value)
          successCount++
        }
      } catch (error) {
        console.error(`[useVariableValueGeneration] Failed to apply value for ${item.name}:`, error)
      }
    }

    showPreviewDialog.value = false

    if (successCount > 0) {
      toast.success(t('test.variableValueGeneration.applySuccess', { count: successCount }))
    }
  }

  return {
    isGenerating,
    generationResult,
    showPreviewDialog,
    generateValues,
    confirmBatchApply,
  }
}
