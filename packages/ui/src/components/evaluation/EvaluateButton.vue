<template>
  <NDropdown
    trigger="click"
    :options="evaluationOptions"
    @select="handleSelect"
  >
    <NButton
      :disabled="!hasAnyResult || isEvaluating"
      :loading="isEvaluating"
      quaternary
      size="small"
    >
      <template #icon>
        <NIcon><ChartIcon /></NIcon>
      </template>
      {{ t('evaluation.button') }}
    </NButton>
  </NDropdown>
</template>

<script setup lang="ts">
import { computed, h } from 'vue'
import { useI18n } from 'vue-i18n'
import { NDropdown, NButton, NIcon, type DropdownOption } from 'naive-ui'
import type { EvaluationType } from '@prompt-optimizer/core'

// Use a simple SVG icon as the chart icon
const ChartIcon = {
  render() {
    return h('svg', {
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: '0 0 24 24',
      width: '1em',
      height: '1em',
      fill: 'currentColor',
    }, [
      h('path', {
        d: 'M3 3v18h18v-2H5V3H3zm4 14h2v-5H7v5zm4 0h2V8h-2v9zm4 0h2v-7h-2v7zm4 0h2V5h-2v12z',
      }),
    ])
  },
}

// Props
const props = defineProps<{
  /** Whether there is an original test result */
  hasOriginalResult: boolean
  /** Whether there is an optimized test result */
  hasOptimizedResult: boolean
  /** Whether in compare mode */
  isCompareMode: boolean
  /** Whether an evaluation is in progress */
  isEvaluating: boolean
}>()

// Emits
const emit = defineEmits<{
  (e: 'evaluate', type: EvaluationType): void
}>()

const { t } = useI18n()

// Whether there are any test results
const hasAnyResult = computed(() => {
  return props.hasOriginalResult || props.hasOptimizedResult
})

// Dropdown menu options
const evaluationOptions = computed<DropdownOption[]>(() => {
  const options: DropdownOption[] = []

  // Original prompt evaluation (requires an original test result)
  if (props.hasOriginalResult) {
    options.push({
      label: t('evaluation.type.original'),
      key: 'original',
      disabled: !props.hasOriginalResult,
    })
  }

  // Optimized evaluation (requires an optimized test result)
  if (props.hasOptimizedResult) {
    options.push({
      label: t('evaluation.type.optimized'),
      key: 'optimized',
      disabled: !props.hasOptimizedResult,
    })
  }

  // Compare evaluation (requires both results, and compare mode)
  if (props.isCompareMode && props.hasOriginalResult && props.hasOptimizedResult) {
    options.push({
      type: 'divider',
      key: 'd1',
    })
    options.push({
      label: t('evaluation.type.compare'),
      key: 'compare',
      disabled: !(props.hasOriginalResult && props.hasOptimizedResult),
    })
  }

  return options
})

// Handle selection
const handleSelect = (key: string) => {
  emit('evaluate', key as EvaluationType)
}
</script>

<style scoped>
</style>
