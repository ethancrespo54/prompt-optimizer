<template>
  <NPopover
    v-model:show="popoverVisible"
    trigger="manual"
    placement="bottom"
    flip
    ref="popoverInstRef"
    :style="{ padding: '0' }"
    :content-style="{ padding: '0' }"
    :disabled="loading"
    :delay="200"
    :duration="150"
    @clickoutside="handleClickOutside"
  >
    <template #trigger>
      <NButton
        secondary
        :type="badgeType"
        :size="buttonSize"
        :loading="loading"
        :disabled="loading"
        class="evaluation-score-badge-btn"
        :data-testid="`score-badge-${type}`"
        :data-eval-type="type"
        @click="handleClick"
        @mouseenter="handleMouseEnter"
        @mouseleave="handleMouseLeave"
      >
        <span v-if="!loading" data-testid="score-value">{{ displayText }}</span>
      </NButton>
    </template>
    <div
      class="hover-card-wrapper"
      ref="hoverCardWrapperRef"
      @mouseenter="handlePopoverMouseEnter"
      @mouseleave="handlePopoverMouseLeave"
      @focusin.capture="handlePopoverFocusIn"
      @focusout.capture="handlePopoverFocusOut"
    >
      <EvaluationHoverCard
        :result="result"
        :type="type"
        :loading="loading"
        :visible="popoverVisible"
        @show-detail="handleShowDetail"
        @evaluate="handleEvaluate"
        @evaluate-with-feedback="handleEvaluateWithFeedback"
        @apply-improvement="handleApplyImprovement"
        @apply-patch="handleApplyPatch"
      />
    </div>
  </NPopover>
</template>

<script setup lang="ts">
import { computed, ref, onBeforeUnmount, watch, nextTick } from 'vue'
import { NButton, NPopover } from 'naive-ui'
import EvaluationHoverCard from './EvaluationHoverCard.vue'
import type { EvaluationResponse, EvaluationType, PatchOperation } from '@prompt-optimizer/core'
import type { ScoreLevel } from './types'

type PopoverInst = {
  syncPosition?: () => void
}

const props = withDefaults(
  defineProps<{
    /** Score value (0-100) */
    score?: number | null
    /** Score grade */
    level?: ScoreLevel | null
    /** Whether loading */
    loading?: boolean
    /** Size */
    size?: 'small' | 'medium'
    /** Evaluation result (used for the hover preview) */
    result?: EvaluationResponse | null
    /** Evaluation type */
    type?: EvaluationType
  }>(),
  {
    score: null,
    level: null,
    loading: false,
    size: 'small',
    result: null,
    type: 'original',
  }
)

const emit = defineEmits<{
  (e: 'show-detail'): void
  (e: 'evaluate'): void
  (e: 'evaluate-with-feedback', payload: { type: EvaluationType; feedback: string }): void
  (e: 'apply-improvement', payload: { improvement: string; type: EvaluationType }): void
  (e: 'apply-patch', payload: { operation: PatchOperation }): void
}>()

// Popover display state
const popoverVisible = ref(false)
const isHoveringBadge = ref(false)
const isHoveringPopover = ref(false)
const isPinnedByClick = ref(false)
const hasFocusWithinPopover = ref(false)
const popoverInstRef = ref<PopoverInst | null>(null)
const hoverCardWrapperRef = ref<HTMLElement | null>(null)
const POPOVER_CLOSE_DELAY = 250
let closeTimer: ReturnType<typeof setTimeout> | null = null

const clearCloseTimer = () => {
  if (closeTimer) {
    clearTimeout(closeTimer)
    closeTimer = null
  }
}

onBeforeUnmount(() => {
  clearCloseTimer()
})

// Since the inner content (especially the textarea autosize) may change the layout after mounting,
// the position is actively synced after opening to reduce the chance of being obscured near the viewport edge.
watch(popoverVisible, (visible) => {
  if (!visible) return

  nextTick(() => {
    popoverInstRef.value?.syncPosition?.()

    // Sync once more to cover height changes caused by async layout (such as font loading and internal component measurement)
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => popoverInstRef.value?.syncPosition?.())
    }
  })
})

const closePopover = () => {
  clearCloseTimer()
  popoverVisible.value = false
  isPinnedByClick.value = false
  hasFocusWithinPopover.value = false
}

const scheduleClose = () => {
  // If the user is typing/interacting inside the popover (focus is inside), do not close it automatically because of hover state changes.
  if (isPinnedByClick.value || hasFocusWithinPopover.value) {
    clearCloseTimer()
    return
  }

  clearCloseTimer()
  closeTimer = setTimeout(() => {
    if (!isHoveringBadge.value && !isHoveringPopover.value) {
      closePopover()
    }
  }, POPOVER_CLOSE_DELAY)
}

// Compute the grade (computed from the score if not provided)
const computedLevel = computed<ScoreLevel | null>(() => {
  if (props.level) return props.level
  if (props.score === null || props.score === undefined) return null
  if (props.score >= 90) return 'excellent'
  if (props.score >= 80) return 'good'
  if (props.score >= 60) return 'acceptable'
  if (props.score >= 40) return 'poor'
  return 'very-poor'
})

const displayText = computed(() => {
  if (props.score === null || props.score === undefined) return '--'
  return String(props.score)
})

const buttonSize = computed(() => (props.size === 'small' ? 'tiny' : 'small'))

const badgeType = computed(() => {
  switch (computedLevel.value) {
    case 'excellent':
    case 'good':
      return 'success'
    case 'acceptable':
      return 'info'
    case 'poor':
      return 'warning'
    case 'very-poor':
      return 'error'
    default:
      return 'default'
  }
})

// Click handling - show/hide the hover preview
const handleClick = () => {
  if (props.loading) return

  if (popoverVisible.value && isPinnedByClick.value) {
    closePopover()
    return
  }

  clearCloseTimer()
  isPinnedByClick.value = true
  popoverVisible.value = true
}

// Mouse enters the badge
const handleMouseEnter = () => {
  if (!props.loading) {
    isHoveringBadge.value = true
    clearCloseTimer()

    if (!isPinnedByClick.value) {
      popoverVisible.value = true
    }
  }
}

// Mouse leaves the badge
const handleMouseLeave = () => {
  isHoveringBadge.value = false
  scheduleClose()
}

// Mouse enters the popover
const handlePopoverMouseEnter = () => {
  isHoveringPopover.value = true
  clearCloseTimer()
}

// Mouse leaves the popover
const handlePopoverMouseLeave = () => {
  isHoveringPopover.value = false
  scheduleClose()
}

const handleClickOutside = () => {
  if (isPinnedByClick.value || hasFocusWithinPopover.value) {
    closePopover()
  }
}

const handlePopoverFocusIn = () => {
  hasFocusWithinPopover.value = true
  clearCloseTimer()
}

const handlePopoverFocusOut = () => {
  if (typeof document === 'undefined') return

  const wrapper = hoverCardWrapperRef.value
  const updateFocusState = () => {
    const active = document.activeElement
    if (wrapper && active && wrapper.contains(active)) return

    hasFocusWithinPopover.value = false
    scheduleClose()
  }

  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(updateFocusState)
    return
  }

  updateFocusState()
}

// View details handling - close the hover preview and open the details panel
const handleShowDetail = () => {
  closePopover()
  emit('show-detail')
}

// Evaluate handling - close the hover preview and trigger the evaluation
const handleEvaluate = () => {
  closePopover()
  emit('evaluate')
}

// Evaluate-with-feedback handling
const handleEvaluateWithFeedback = (payload: { feedback: string }) => {
  closePopover()
  emit('evaluate-with-feedback', {
    type: props.type,
    feedback: payload.feedback,
  })
}

// Apply improvement suggestion handling - close the hover preview and forward the event
const handleApplyImprovement = (payload: { improvement: string; type: EvaluationType }) => {
  // Keep the analysis window open to make it easy to apply several suggestions in a row.
  emit('apply-improvement', payload)
}

// Apply patch handling - close the hover preview and forward the event
const handleApplyPatch = (payload: { operation: PatchOperation }) => {
  // Keep the analysis window open to make it easy to apply several patches in a row.
  emit('apply-patch', payload)
}
</script>

<style scoped>
.evaluation-score-badge-btn {
  min-width: 40px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.hover-card-wrapper {
  display: block;
}
</style>
