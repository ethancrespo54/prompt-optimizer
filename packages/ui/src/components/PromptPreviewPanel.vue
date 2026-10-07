<template>
  <NModal
    v-model:show="visible"
    preset="card"
    :title="$t('contextMode.preview.title')"
    :style="{ width: '80%', maxWidth: '1200px' }"
    :segmented="{ content: 'soft', footer: 'soft' }"
  >
    <NFlex vertical :size="16">
      <!-- Variable statistics -->
      <NCard size="small" :title="$t('contextMode.preview.stats')">
        <NFlex :size="12" :wrap="true">
          <NTag :bordered="false" type="info">
            {{ $t('contextMode.preview.totalVars') }}: {{ variableStats.total }}
          </NTag>
          <NTag :bordered="false" type="success">
            {{ $t('contextMode.preview.providedVars') }}: {{ variableStats.provided }}
          </NTag>
          <NTag v-if="variableStats.missing > 0" :bordered="false" type="warning">
            {{ $t('contextMode.preview.missingVars') }}: {{ variableStats.missing }}
          </NTag>
        </NFlex>
      </NCard>

      <!-- Missing variable warning -->
      <NCard
        v-if="hasMissingVariables"
        size="small"
        :title="$t('contextMode.preview.missingVarsWarning')"
        :segmented="{ content: true }"
      >
        <NFlex :size="8" :wrap="true">
          <NTag
            v-for="varName in missingVariables"
            :key="varName"
            type="warning"
            :bordered="false"
          >
            <span v-text="`{{${varName}}}`"></span>
          </NTag>
        </NFlex>
        <template #footer>
          <NText depth="3" :style="{ fontSize: '13px' }">
            {{ $t('contextMode.preview.missingVarsHint') }}
          </NText>
        </template>
      </NCard>

      <!-- Preview content -->
      <NCard size="small" :title="$t('contextMode.preview.renderedContent')">
        <NScrollbar :style="{ maxHeight: '400px' }">
          <div class="preview-content">
            {{ previewContent || $t('contextMode.preview.emptyContent') }}
          </div>
        </NScrollbar>
      </NCard>

      <!-- Mode description -->
      <NCard size="small" :title="$t('contextMode.preview.modeExplanation')">
        <NText depth="2" :style="{ fontSize: '14px' }">
          <template v-if="contextMode === 'user' && renderPhase === 'optimize'">
            {{ $t('contextMode.preview.userOptimizeHint') }}
          </template>
          <template v-else-if="contextMode === 'system' && renderPhase === 'optimize'">
            {{ $t('contextMode.preview.systemOptimizeHint') }}
          </template>
          <template v-else>
            {{ $t('contextMode.preview.testPhaseHint') }}
          </template>
        </NText>
      </NCard>
    </NFlex>

    <template #footer>
      <NFlex justify="end">
        <NButton @click="visible = false">
          {{ $t('common.close') }}
        </NButton>
      </NFlex>
    </template>
  </NModal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

import {
  NModal,
  NCard,
  NFlex,
  NTag,
  NText,
  NButton,
  NScrollbar
} from 'naive-ui'
import type { ContextMode } from '@prompt-optimizer/core'

const props = defineProps<{
  /** Preview content */
  previewContent: string
  /** Missing variables */
  missingVariables: string[]
  /** Whether there are missing variables */
  hasMissingVariables: boolean
  /** Variable statistics */
  variableStats: {
    total: number
    builtin: number
    custom: number
    missing: number
    provided: number
  }
  /** Context mode */
  contextMode: ContextMode
  /** Render stage */
  renderPhase: 'optimize' | 'test'
  /** Whether to show */
  show: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

const visible = ref(props.show)

watch(
  () => props.show,
  (newValue) => {
    visible.value = newValue
  }
)

watch(visible, (newValue) => {
  emit('update:show', newValue)
})
</script>

<style scoped>
.preview-content {
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: var(--n-font-family-mono);
  font-size: 14px;
  line-height: 1.6;
  padding: 12px;
  background-color: var(--n-color-embedded);
  border-radius: 4px;
}
</style>
