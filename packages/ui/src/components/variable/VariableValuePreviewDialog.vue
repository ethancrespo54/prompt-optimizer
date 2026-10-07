<template>
  <NModal
    v-model:show="visible"
    preset="dialog"
    :title="t('test.variableValueGeneration.dialogTitle')"
    style="width: 900px"
    :positive-text="t('test.variableValueGeneration.batchApply', { count: selectedKeys.length })"
    :negative-text="t('common.cancel')"
    :positive-button-props="{ disabled: selectedKeys.length === 0 }"
    @positive-click="handleConfirm"
    @negative-click="handleCancel"
  >
    <!-- Top summary -->
    <NAlert
      v-if="result"
      :type="result.values.length > 0 ? 'success' : 'warning'"
      :title="result.summary"
      style="margin-bottom: 16px"
    />

    <!-- Variable value table (editable) -->
    <NDataTable
      v-if="result && result.values.length > 0"
      :columns="columns"
      :data="editableValues"
      :checked-row-keys="selectedKeys"
      :row-key="(row: EditableVariableValue) => row.name"
      @update:checked-row-keys="handleSelectionChange"
      :pagination="editableValues.length > 10 ? { pageSize: 10 } : false"
      max-height="400"
    />

    <!-- Empty state -->
    <NEmpty
      v-else-if="result && result.values.length === 0"
      :description="t('test.variableValueGeneration.noValues')"
    />

    <!-- Bottom statistics -->
    <template v-if="result && result.values.length > 0" #footer>
      <NSpace justify="space-between" style="width: 100%">
        <NText depth="3">
          {{ t('test.variableValueGeneration.selected') }}: {{ selectedKeys.length }} / {{ editableValues.length }}
        </NText>
      </NSpace>
    </template>
  </NModal>
</template>

<script setup lang="ts">
import { ref, computed, watch, h } from 'vue'
import {
  NModal,
  NAlert,
  NDataTable,
  NEmpty,
  NSpace,
  NText,
  NInput,
  NProgress,
  type DataTableColumns,
} from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { VariableValueGenerationResponse, GeneratedVariableValue } from '@prompt-optimizer/core'

type RowKey = string | number

/**
 * Editable variable value (with an editing state added)
 */
interface EditableVariableValue extends GeneratedVariableValue {
  // Inherits name, value, reason, confidence
}

/**
 * Component props
 */
interface Props {
  /** Whether to show the dialog */
  show: boolean
  /** Generation result */
  result: VariableValueGenerationResponse | null
}

/**
 * Component emits
 */
interface Emits {
  /** Update the display state */
  (event: 'update:show', value: boolean): void
  /** Confirm the batch apply */
  (event: 'confirm', values: GeneratedVariableValue[]): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const { t } = useI18n()

// Two-way binding of the display state
const visible = computed({
  get: () => props.show,
  set: (value: boolean) => emit('update:show', value),
})

// Editable variable value list (deep copy)
const editableValues = ref<EditableVariableValue[]>([])

// Selected variable keys (variable names)
const selectedKeys = ref<string[]>([])

// Watch result changes and initialize the editable data
watch(
  () => props.result,
  (newResult) => {
    if (newResult && newResult.values.length > 0) {
      // Deep-copy the data to support editing
      editableValues.value = newResult.values.map((v) => ({ ...v }))
      // By default, only select non-empty generated values, to avoid overwriting existing variable values with '' (when the LLM omits a variable, the service fills in an empty value)
      selectedKeys.value = newResult.values
        .filter((v) => String(v.value || '').trim() !== '')
        .map((v) => v.name)
    } else {
      editableValues.value = []
      selectedKeys.value = []
    }
  },
  { immediate: true }
)

// Table column definitions
const columns = computed<DataTableColumns<EditableVariableValue>>(() => [
  {
    type: 'selection',
  },
  {
    title: t('test.variableValueGeneration.variableName'),
    key: 'name',
    width: 120,
  },
  {
    title: t('test.variableValueGeneration.generatedValue'),
    key: 'value',
    width: 200,
    render: (row: EditableVariableValue) => {
      return h(NInput, {
        value: row.value,
        placeholder: t('test.variableValueGeneration.valuePlaceholder'),
        onUpdateValue: (newValue: string) => {
          row.value = newValue
        },
      })
    },
  },
  {
    title: t('test.variableValueGeneration.reason'),
    key: 'reason',
    ellipsis: {
      tooltip: true,
    },
  },
  {
    title: t('test.variableValueGeneration.confidence'),
    key: 'confidence',
    width: 100,
    render: (row: EditableVariableValue) => {
      if (typeof row.confidence === 'number') {
        const percentage = Math.round(row.confidence * 100)
        return h(NProgress, {
          type: 'line',
          percentage,
          indicatorPlacement: 'inside',
          processing: false,
        })
      }
      return '-'
    },
  },
])

// Handle selection changes
const handleSelectionChange = (keys: RowKey[]) => {
  selectedKeys.value = keys.map((key) => String(key))
}

// Handle confirmation
const handleConfirm = () => {
  if (selectedKeys.value.length === 0) {
    return
  }

  // Get the selected variable value objects
  const selectedValues = editableValues.value.filter((v) =>
    selectedKeys.value.includes(v.name)
  )

  emit('confirm', selectedValues)
}

// Handle cancellation
const handleCancel = () => {
  visible.value = false
}
</script>
