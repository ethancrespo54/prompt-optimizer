<template>
  <div class="tcb-root">
    <!-- Left: label + model dropdown + optional tags (tags are hidden at breakpoints and must not squeeze the right-hand controls) -->
    <NSpace class="tcb-left" align="center" :size="12" :wrap="false">
      <NText :depth="2" strong class="tcb-label">
        {{ modelLabel }}：
      </NText>
      <div class="tcb-model-select">
        <slot name="model-select"></slot>
      </div>
      <NTag
        v-if="modelName"
        class="tcb-tags"
        size="small"
        type="primary"
        :bordered="false"
      >
        <NEllipsis :style="{ maxWidth: '180px' }">
          {{ modelName }}
        </NEllipsis>
      </NTag>
    </NSpace>

    <!-- Right: strongly constrained controls (must always be usable and not be covered) -->
    <NSpace class="tcb-right" align="center" justify="end" :size="12" :wrap="false">
      <NSpace v-if="showCompareToggle" align="center" :size="8" :wrap="false">
        <NSwitch
          :value="isCompareMode"
          @update:value="handleCompareToggle"
          :size="buttonSize === 'large' ? 'medium' : 'small'"
          :data-testid="compareToggleTestId"
        />
        <NText :depth="3" tag="span" class="tcb-compare-label">
          {{ t('test.compareMode') }}
        </NText>
      </NSpace>

      <slot name="secondary-controls"></slot>

      <NButton
        @click="handlePrimaryAction"
        :disabled="primaryActionDisabled"
        :loading="primaryActionLoading"
        type="primary"
        :size="buttonSize"
        :data-testid="primaryActionTestId"
      >
        {{ primaryActionText }}
      </NButton>

      <slot name="custom-actions"></slot>
    </NSpace>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { NSpace, NText, NButton, NSwitch, NTag, NEllipsis } from 'naive-ui'

const { t } = useI18n()

interface Props {
  // Model selection-related
  modelLabel: string
  modelName?: string

  // Compare mode control
  showCompareToggle?: boolean
  isCompareMode?: boolean

  // Primary action button
  primaryActionText: string
  primaryActionDisabled?: boolean
  primaryActionLoading?: boolean

  // Layout config
  buttonSize?: 'small' | 'medium' | 'large'

  /** E2E: stable selector for compare toggle */
  compareToggleTestId?: string

  /** E2E: stable selector for primary action button */
  primaryActionTestId?: string
}

withDefaults(defineProps<Props>(), {
  showCompareToggle: true,
  isCompareMode: false,
  primaryActionDisabled: false,
  primaryActionLoading: false,
  buttonSize: 'medium',
  compareToggleTestId: undefined,
  primaryActionTestId: undefined
})

const emit = defineEmits<{
  'compare-toggle': []
  'primary-action': []
}>()

const handleCompareToggle = () => {
  emit('compare-toggle')
}

const handlePrimaryAction = () => {
  emit('primary-action')
}
</script>

<style scoped>
.tcb-root {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  column-gap: 12px;
  align-items: center;
  width: 100%;
}

.tcb-left {
  min-width: 0;
  overflow: hidden;
}

.tcb-label {
  white-space: nowrap;
}

.tcb-model-select {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
}

.tcb-tags {
  flex-shrink: 1;
  min-width: 0;
}

.tcb-right {
  flex-shrink: 0;
}

.tcb-compare-label {
  white-space: nowrap;
}

/* Breakpoint hiding: when space is insufficient, hide tags first to keep the right-hand controls usable */
@media (max-width: 900px) {
  .tcb-tags {
    display: none;
  }
}

/* Very narrow screens: move the right-hand controls to the next row to avoid any overlap */
@media (max-width: 640px) {
  .tcb-root {
    grid-template-columns: 1fr;
    row-gap: 8px;
  }
}
</style>
