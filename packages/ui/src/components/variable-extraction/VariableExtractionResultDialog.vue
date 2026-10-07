<template>
  <NModal
    v-model:show="visible"
    preset="dialog"
    :title="t('evaluation.variableExtraction.dialogTitle')"
    style="width: 800px"
    :positive-text="t('evaluation.variableExtraction.batchCreate', { count: selectedKeys.length })"
    :negative-text="t('common.cancel')"
    :positive-button-props="{ disabled: selectedKeys.length === 0 }"
    @positive-click="handleConfirm"
    @negative-click="handleCancel"
  >
    <!-- Top summary -->
    <NAlert
      v-if="result"
      :type="result.variables.length > 0 ? 'success' : 'warning'"
      :title="result.summary"
      style="margin-bottom: 16px"
    />

    <!-- Variable table (supports multi-select) -->
    <NDataTable
      v-if="result && result.variables.length > 0"
      :columns="columns"
      :data="result.variables"
      :checked-row-keys="selectedKeys"
      :row-key="(row: ExtractedVariable) => row.name"
      @update:checked-row-keys="handleSelectionChange"
      :pagination="result.variables.length > 10 ? { pageSize: 10 } : false"
      max-height="400"
    />

    <!-- Empty state -->
    <NEmpty
      v-else-if="result && result.variables.length === 0"
      :description="t('evaluation.variableExtraction.noVariables')"
    />

    <!-- Bottom statistics -->
    <template v-if="result && result.variables.length > 0" #footer>
      <NSpace justify="space-between" style="width: 100%">
        <NText depth="3">
          {{ t('evaluation.variableExtraction.selected') }}: {{ selectedKeys.length }} / {{ result.variables.length }}
        </NText>
      </NSpace>
    </template>
  </NModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  NModal,
  NAlert,
  NDataTable,
  NEmpty,
  NSpace,
  NText,
  type DataTableColumns,
} from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { ExtractedVariable, VariableExtractionResponse } from '@prompt-optimizer/core'

/**
 * Component props
 */
interface Props {
  /** Whether to show the dialog */
  show: boolean
  /** Extraction result */
  result: VariableExtractionResponse | null
}

/**
 * Component emits
 */
interface Emits {
  /** Update the display state */
  (event: 'update:show', value: boolean): void
  /** Confirm the batch creation */
  (event: 'confirm', variables: ExtractedVariable[]): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const { t } = useI18n()

// Two-way binding of the display state
const visible = computed({
  get: () => props.show,
  set: (value: boolean) => emit('update:show', value),
})

// Selected variable keys (variable names)
const selectedKeys = ref<string[]>([])

// Watch result changes and select all automatically
watch(
  () => props.result,
  (newResult) => {
    if (newResult && newResult.variables.length > 0) {
      // Select all variables by default
      selectedKeys.value = newResult.variables.map((v) => v.name)
    } else {
      selectedKeys.value = []
    }
  },
  { immediate: true }
)

// Table column definitions
const columns = computed<DataTableColumns<ExtractedVariable>>(() => [
  {
    type: 'selection',
  },
  {
    title: t('evaluation.variableExtraction.variableName'),
    key: 'name',
    width: 150,
  },
  {
    title: t('evaluation.variableExtraction.variableValue'),
    key: 'value',
    width: 200,
    ellipsis: {
      tooltip: true,
    },
  },
  {
    title: t('evaluation.variableExtraction.reason'),
    key: 'reason',
    ellipsis: {
      tooltip: true,
    },
  },
  {
    title: t('evaluation.variableExtraction.category'),
    key: 'category',
    width: 100,
    render: (row: ExtractedVariable) => row.category || '-',
  },
])

// Handle selection changes (Naive UI RowKey = string | number)
const handleSelectionChange = (keys: Array<string | number>) => {
  selectedKeys.value = keys.map(String)
}

// Handle confirmation
const handleConfirm = () => {
  if (!props.result || selectedKeys.value.length === 0) {
    return
  }

  // Get the selected variable objects
  const selectedVariables = props.result.variables.filter((v) =>
    selectedKeys.value.includes(v.name)
  )

  emit('confirm', selectedVariables)
}

// Handle cancellation
const handleCancel = () => {
  visible.value = false
}
</script>
