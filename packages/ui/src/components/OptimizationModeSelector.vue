<!-- Optimization mode selector component - uses Naive UI RadioGroup -->
<template>
  <NRadioGroup data-testid="optimization-mode-selector"
    :value="modelValue"
    @update:value="updateOptimizationMode"
    size="small"
    class="optimization-mode-selector"
  >
    <!-- Basic mode: system | user -->
    <template v-if="functionMode !== 'pro'">
      <NRadioButton
        v-if="!hideSystemOption"
        data-testid="sub-mode-system"
        value="system"
        :title="systemHelp"
      >
        {{ systemLabel }}
      </NRadioButton>
      <NRadioButton
        data-testid="sub-mode-user"
        value="user"
        :title="userHelp"
      >
        {{ userLabel }}
      </NRadioButton>
    </template>
    <!-- Pro mode: variable | multi-conversation -->
    <template v-else>
      <NRadioButton
        data-testid="sub-mode-variable"
        value="variable"
        :title="userHelp"
      >
        {{ userLabel }}
      </NRadioButton>
      <NRadioButton
        v-if="!hideSystemOption"
        data-testid="sub-mode-multi"
        value="multi"
        :title="systemHelp"
      >
        {{ systemLabel }}
      </NRadioButton>
    </template>
  </NRadioGroup>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NRadioGroup, NRadioButton } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { BasicSubMode, ProSubMode } from '@prompt-optimizer/core'
import type { FunctionMode } from '../composables/mode'

const { t } = useI18n()

type SubMode = BasicSubMode | ProSubMode

interface Props {
  modelValue: SubMode
  /** Whether to hide the system prompt option (used to temporarily disable the feature) */
  hideSystemOption?: boolean
  /** Current function mode, used to decide the display text */
  functionMode?: FunctionMode
}

interface Emits {
  (e: 'update:modelValue', value: SubMode): void
  (e: 'change', value: SubMode): void
}

const props = withDefaults(defineProps<Props>(), {
  hideSystemOption: false,
  functionMode: 'basic',
})
const emit = defineEmits<Emits>()

// Get the button text dynamically based on the function mode
const systemLabel = computed(() => {
  return props.functionMode === 'pro'
    ? t('contextMode.optimizationMode.message')
    : t('promptOptimizer.systemPrompt')
})

const userLabel = computed(() => {
  return props.functionMode === 'pro'
    ? t('contextMode.optimizationMode.variable')
    : t('promptOptimizer.userPrompt')
})

const systemHelp = computed(() => {
  return props.functionMode === 'pro'
    ? t('contextMode.system.tooltip')
    : t('promptOptimizer.systemPromptHelp')
})

const userHelp = computed(() => {
  return props.functionMode === 'pro'
    ? t('contextMode.user.tooltip')
    : t('promptOptimizer.userPromptHelp')
})

/**
 * Update the optimization mode
 */
const updateOptimizationMode = (mode: SubMode) => {
  emit('update:modelValue', mode)
  emit('change', mode)
}
</script>

<style scoped>
/* Responsive design - full-width display on mobile */
@media (max-width: 640px) {
  .optimization-mode-selector {
    width: 100%;
  }

  .optimization-mode-selector :deep(.n-radio-button) {
    flex: 1;
  }
}
</style>
