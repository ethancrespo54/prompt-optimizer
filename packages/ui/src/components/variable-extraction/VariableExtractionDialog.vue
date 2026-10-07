<template>
  <NModal
    v-model:show="isVisible"
    preset="dialog"
    :title="t('variableExtraction.dialogTitle')"
    :positive-text="t('common.confirm')"
    :negative-text="t('common.cancel')"
    :on-positive-click="handleConfirm"
    :on-negative-click="handleCancel"
    :mask-closable="false"
  >
    <NSpace vertical :size="16" style="margin-top: 16px;">
      <!-- Variable name input -->
      <NFormItem
        :label="t('variableExtraction.variableName')"
        :validation-status="validationStatus"
        :feedback="validationMessage"
      >
        <NInput
          v-model:value="variableName"
          :placeholder="t('variableExtraction.variableNamePlaceholder')"
          @input="handleVariableNameInput"
          @keyup.enter="handleConfirm"
        />
      </NFormItem>

      <!-- Variable value display (read-only) -->
      <NFormItem :label="t('variableExtraction.variableValue')">
        <NInput
          :value="variableValue"
          readonly
          :placeholder="t('variableExtraction.variableValuePlaceholder')"
        />
      </NFormItem>

      <!-- Variable type selection -->
      <NFormItem :label="t('variableExtraction.variableType')">
        <NRadioGroup v-model:value="variableType">
          <NSpace vertical>
            <NRadio value="temporary">
              <span>{{ t('variableExtraction.temporaryVariable') }}</span>
              <NText depth="3" :style="{ marginLeft: '8px', fontSize: '12px' }">
                {{ t('variableExtraction.temporaryVariableDesc') }}
              </NText>
            </NRadio>
            <NRadio value="global">
              <span>{{ t('variableExtraction.globalVariable') }}</span>
              <NText depth="3" :style="{ marginLeft: '8px', fontSize: '12px' }">
                {{ t('variableExtraction.globalVariableDesc') }}
              </NText>
            </NRadio>
          </NSpace>
        </NRadioGroup>
      </NFormItem>

      <!-- Replace-all option (only shown when multiple matches are detected) -->
      <NFormItem v-if="occurrenceCount > 1">
        <NCheckbox v-model:checked="replaceAll">
          {{ t('variableExtraction.replaceAll', { count: occurrenceCount }) }}
          <NText depth="3" :style="{ marginLeft: '4px' }">
            {{ t('variableExtraction.replaceAllRecommended') }}
          </NText>
        </NCheckbox>
      </NFormItem>
    </NSpace>
  </NModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

import {
  NModal,
  NSpace,
  NFormItem,
  NInput,
  NRadioGroup,
  NRadio,
  NCheckbox,
  NText
} from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useToast } from '../../composables/ui/useToast'
import { VARIABLE_VALIDATION, getVariableNameValidationError } from '../../types/variable'

/**
 * Variable extraction dialog component
 *
 * Features:
 * 1. Lets the user create a variable for the selected text
 * 2. Supports two types: global variables and temporary variables
 * 3. Validates the legality of the variable name
 * 4. Supports batch replacement of multiple identical texts
 */

// Props definition
interface Props {
  /** Dialog display state */
  show: boolean
  /** Selected text value */
  selectedText: string
  /** List of existing global variable names */
  existingGlobalVariables?: string[]
  /** List of existing temporary variable names */
  existingTemporaryVariables?: string[]
  /** List of system predefined variable names */
  predefinedVariables?: string[]
  /** Number of occurrences of this value in the current text */
  occurrenceCount?: number
}

const props = withDefaults(defineProps<Props>(), {
  existingGlobalVariables: () => [],
  existingTemporaryVariables: () => [],
  predefinedVariables: () => [],
  occurrenceCount: 1
})

// Emits definition
interface Emits {
  /** Update the dialog display state */
  (e: 'update:show', value: boolean): void
  /** Confirm variable extraction */
  (e: 'confirm', data: {
    variableName: string
    variableValue: string
    variableType: 'global' | 'temporary'
    replaceAll: boolean
  }): void
  /** Cancel the operation */
  (e: 'cancel'): void
}

const emit = defineEmits<Emits>()

const { t } = useI18n()
const message = useToast()

// Internal state
const isVisible = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value)
})

const variableName = ref('')
const variableValue = ref('')
const variableType = ref<'global' | 'temporary'>('temporary')
const replaceAll = ref(true) // "Replace all" is selected by default

const baseValidationError = computed(() => {
  if (!variableName.value) return null
  return getVariableNameValidationError(variableName.value)
})

// Variable name validation
const validationStatus = computed<'success' | 'warning' | 'error' | undefined>(() => {
  if (!variableName.value) return undefined

  // Basic checks (unified rules)
  if (baseValidationError.value) {
    return 'error'
  }

  // Validation rule 3: must not duplicate a predefined variable name
  if (props.predefinedVariables.includes(variableName.value)) {
    return 'error'
  }

  // Validation rule 4: must not duplicate an existing variable name
  const allExistingVariables = [
    ...props.existingGlobalVariables,
    ...props.existingTemporaryVariables
  ]
  if (allExistingVariables.includes(variableName.value)) {
    return 'warning'
  }

  return 'success'
})

const validationMessage = computed(() => {
  if (!variableName.value) return ''

  switch (baseValidationError.value) {
    case 'required':
      return t('variableExtraction.validation.required')
    case 'tooLong':
      return t('variableExtraction.validation.tooLong', { max: VARIABLE_VALIDATION.MAX_NAME_LENGTH })
    case 'forbiddenPrefix':
      return t('variableExtraction.validation.forbiddenPrefix')
    case 'noNumberStart':
      return t('variableExtraction.validation.noNumberStart')
    case 'reservedName':
      return t('variableExtraction.validation.reservedName')
    case 'invalidCharacters':
      return t('variableExtraction.validation.invalidCharacters')
  }

  if (props.predefinedVariables.includes(variableName.value)) {
    return t('variableExtraction.validation.predefinedVariable')
  }

  const allExistingVariables = [
    ...props.existingGlobalVariables,
    ...props.existingTemporaryVariables
  ]
  if (allExistingVariables.includes(variableName.value)) {
    return t('variableExtraction.validation.duplicateVariable')
  }

  return ''
})

// Watch props changes and update the internal state
watch(() => props.selectedText, (newValue) => {
  variableValue.value = newValue
}, { immediate: true })

watch(() => props.show, (newValue) => {
  if (newValue) {
    // Reset the state when the dialog opens
    variableName.value = ''
    variableValue.value = props.selectedText
    variableType.value = 'temporary'
    replaceAll.value = props.occurrenceCount > 1
  }
})

// Handle variable name input
const handleVariableNameInput = () => {
  // Automatically strip spaces
  variableName.value = variableName.value.replace(/\s/g, '')
}

// Confirm extraction
const handleConfirm = () => {
  // Validate the variable name
  if (!variableName.value) {
    message.warning(t('variableExtraction.validation.required'))
    return false
  }

  if (validationStatus.value === 'error') {
    message.error(validationMessage.value)
    return false
  }

  // Emit the confirm event
  emit('confirm', {
    variableName: variableName.value,
    variableValue: variableValue.value,
    variableType: variableType.value,
    replaceAll: replaceAll.value
  })

  // Close the dialog
  isVisible.value = false
  return true
}

// Cancel the operation
const handleCancel = () => {
  emit('cancel')
  isVisible.value = false
}
</script>

<style scoped>
/* Uses Naive UI's default styles; no custom CSS needed */
</style>
