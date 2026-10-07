<template>
  <!-- Degraded mode: when the text is too long or the computation fails, show the new text directly -->
  <div v-if="fallback" class="inline-diff fallback">
    <span class="diff-added">{{ newText }}</span>
  </div>
  <!-- Normal diff mode -->
  <div v-else class="inline-diff">
    <span
      v-for="fragment in fragments"
      :key="fragment.index"
      :class="getFragmentClass(fragment.type)"
    >{{ fragment.text }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, type Ref } from 'vue'
import { createCompareService, type ChangeType, type TextFragment, type ICompareService } from '@prompt-optimizer/core'
import type { AppServices } from '../../types/services'
import { useNaiveTheme } from '../../composables/ui/useNaiveTheme'

const props = defineProps<{
  oldText: string
  newText: string
}>()

// Get the theme config and compute the color variables
const { themeOverrides } = useNaiveTheme()
const successBg = computed(() => themeOverrides.value?.common?.successColorSuppl || 'rgba(34, 197, 94, 0.15)')
const successColor = computed(() => themeOverrides.value?.common?.successColor || '#16a34a')
const errorBg = computed(() => themeOverrides.value?.common?.errorColorSuppl || 'rgba(239, 68, 68, 0.15)')
const errorColor = computed(() => themeOverrides.value?.common?.errorColor || '#dc2626')
const textColor3 = computed(() => themeOverrides.value?.common?.textColor3 || '#6b7280')

// Length threshold: degrade the display beyond this value
// JSON prompts in image mode can be very long; to stay consistent with the other modes, no length limit is applied here anymore
const MAX_LENGTH = Number.POSITIVE_INFINITY

// Local fallback service (only created when the global one is unavailable)
let localService: ICompareService | null = null
const getLocalService = () => {
  if (!localService) localService = createCompareService()
  return localService
}

// Dynamically get compareService (global first, local fallback)
const services = inject<Ref<AppServices | null> | null>('services', null)
const compareService = computed<ICompareService>(() => {
  const svc = services?.value?.compareService
  return svc ?? getLocalService()
})

// Error state
const hasError = ref(false)

// Whether to degrade (length exceeded or computation error)
const fallback = computed(() => {
  const totalLen = (props.oldText?.length || 0) + (props.newText?.length || 0)
  return totalLen > MAX_LENGTH || hasError.value
})

// Detect text without spaces (such as Chinese) and automatically choose a char-level diff
const detectGranularity = (text: string): 'word' | 'char' => {
  if (!text) return 'word'
  const spaceRatio = (text.match(/\s/g)?.length || 0) / text.length
  return spaceRatio < 0.05 ? 'char' : 'word'
}

const fragments = computed<TextFragment[]>(() => {
  // Reset the error state
  hasError.value = false

  if (!props.oldText && !props.newText) return []

  const totalLen = (props.oldText?.length || 0) + (props.newText?.length || 0)
  if (totalLen > MAX_LENGTH) return []

  try {
    const granularity = detectGranularity(props.oldText + props.newText)
    const result = compareService.value.compareTexts(props.oldText, props.newText, {
      granularity,
      ignoreWhitespace: false,
      caseSensitive: true
    })
    return result.fragments
  } catch {
    hasError.value = true
    return []
  }
})

const getFragmentClass = (type: ChangeType): string => {
  switch (type) {
    case 'added':
      return 'diff-added'
    case 'removed':
      return 'diff-removed'
    default:
      return 'diff-unchanged'
  }
}
</script>

<style scoped>
.inline-diff {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: inherit;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.diff-added {
  background-color: v-bind(successBg);
  color: v-bind(successColor);
  border-radius: 2px;
  padding: 0 2px;
}

.diff-removed {
  background-color: v-bind(errorBg);
  color: v-bind(errorColor);
  text-decoration: line-through;
  border-radius: 2px;
  padding: 0 2px;
}

.diff-unchanged {
  color: v-bind(textColor3);
}
</style>
