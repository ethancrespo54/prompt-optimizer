<template>
  <div
    class="test-result-section"
    :style="{
      flex: 1,
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column'
    }"
  >
    <!-- Compare mode: two-column layout -->
    <NFlex
      v-if="isCompareMode && showOriginal"
      :vertical="verticalLayout"
      justify="space-between"
      :style="{
        flex: 1,
        overflow: 'hidden',
        height: '100%',
        gap: '12px'
      }"
    >
      <!-- Original result -->
      <NCard
        size="small"
        :style="{
          flex: 1,
          height: '100%',
          overflow: 'hidden'
        }"
        content-style="height: 100%; max-height: 100%; overflow: hidden; display: flex; flex-direction: column;"
      >
        <template #header>
          <div class="card-header-content">
            <NText style="font-size: 16px; font-weight: 600;">
              {{ originalTitle }}
            </NText>
            <!-- Original result evaluation entry -->
            <div v-if="showEvaluation && hasOriginalResult" class="evaluation-entry">
              <EvaluationScoreBadge
                v-if="hasOriginalEvaluation || isEvaluatingOriginal"
                :score="originalScore"
                :level="originalScoreLevel"
                :loading="isEvaluatingOriginal"
                :result="originalEvaluationResult"
                type="original"
                size="small"
                @show-detail="handleShowOriginalDetail"
                @evaluate="handleEvaluateOriginal"
                @evaluate-with-feedback="handleEvaluateWithFeedback"
                @apply-improvement="handleApplyImprovement"
                @apply-patch="handleApplyPatch"
              />
              <FocusAnalyzeButton
                v-else
                type="original"
                :label="t('evaluation.evaluate')"
                :loading="isEvaluatingOriginal"
                :button-props="{ size: 'tiny', secondary: true }"
                @evaluate="handleEvaluateOriginal"
                @evaluate-with-feedback="handleEvaluateWithFeedback"
              />
            </div>
          </div>
        </template>
        <div class="result-body">
          <slot name="original-result"></slot>
        </div>
        <!-- Tool calls of the original result -->
        <ToolCallDisplay
          v-if="originalResult?.toolCalls"
          :tool-calls="originalResult.toolCalls"
          :size="size"
          class="tool-calls-section"
        />
      </NCard>

      <!-- Optimized result -->
      <NCard
        size="small"
        :style="{
          flex: 1,
          height: '100%',
          overflow: 'hidden'
        }"
        content-style="height: 100%; max-height: 100%; overflow: hidden; display: flex; flex-direction: column;"
      >
        <template #header>
          <div class="card-header-content">
            <NText style="font-size: 16px; font-weight: 600;">
              {{ optimizedTitle }}
            </NText>
            <!-- Optimized result evaluation entry -->
            <div v-if="showEvaluation && hasOptimizedResult" class="evaluation-entry">
              <EvaluationScoreBadge
                v-if="hasOptimizedEvaluation || isEvaluatingOptimized"
                :score="optimizedScore"
                :level="optimizedScoreLevel"
                :loading="isEvaluatingOptimized"
                :result="optimizedEvaluationResult"
                type="optimized"
                size="small"
                @show-detail="handleShowOptimizedDetail"
                @evaluate="handleEvaluateOptimized"
                @evaluate-with-feedback="handleEvaluateWithFeedback"
                @apply-improvement="handleApplyImprovement"
                @apply-patch="handleApplyPatch"
              />
              <FocusAnalyzeButton
                v-else
                type="optimized"
                :label="t('evaluation.evaluate')"
                :loading="isEvaluatingOptimized"
                :button-props="{ size: 'tiny', secondary: true }"
                @evaluate="handleEvaluateOptimized"
                @evaluate-with-feedback="handleEvaluateWithFeedback"
              />
            </div>
          </div>
        </template>
        <div class="result-body">
          <slot name="optimized-result"></slot>
        </div>
        <!-- Tool calls of the optimized result -->
        <ToolCallDisplay
          v-if="optimizedResult?.toolCalls"
          :tool-calls="optimizedResult.toolCalls"
          :size="size"
          class="tool-calls-section"
        />
      </NCard>
    </NFlex>

    <!-- Single mode: single-column layout -->
    <NCard
      v-else
      size="small"
      :style="{
        flex: 1,
        height: '100%',
        overflow: 'hidden'
      }"
      content-style="height: 100%; max-height: 100%; overflow: hidden; display: flex; flex-direction: column;"
    >
      <template #header>
        <div class="card-header-content">
          <NText style="font-size: 16px; font-weight: 600;">
            {{ singleResultTitle }}
          </NText>
          <!-- Single result evaluation entry (uses the optimized result's evaluation state) -->
          <div v-if="showEvaluation && hasOptimizedResult" class="evaluation-entry">
            <EvaluationScoreBadge
              v-if="hasOptimizedEvaluation || isEvaluatingOptimized"
              :score="optimizedScore"
              :level="optimizedScoreLevel"
              :loading="isEvaluatingOptimized"
              :result="optimizedEvaluationResult"
              type="optimized"
              size="small"
              @show-detail="handleShowOptimizedDetail"
              @evaluate="handleEvaluateOptimized"
              @evaluate-with-feedback="handleEvaluateWithFeedback"
              @apply-improvement="handleApplyImprovement"
            />
            <FocusAnalyzeButton
              v-else
              type="optimized"
              :label="t('evaluation.evaluate', 'Evaluate')"
              :loading="isEvaluatingOptimized"
              :button-props="{ size: 'tiny', secondary: true }"
              @evaluate="handleEvaluateOptimized"
              @evaluate-with-feedback="handleEvaluateWithFeedback"
            />
          </div>
        </div>
      </template>
      <div class="result-body">
        <slot name="single-result"></slot>
      </div>
      <!-- Tool calls of the single result -->
      <ToolCallDisplay
        v-if="singleResult?.toolCalls"
        :tool-calls="singleResult.toolCalls"
        :size="size"
        class="tool-calls-section"
      />
    </NCard>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NFlex, NCard, NText } from 'naive-ui'
import ToolCallDisplay from './ToolCallDisplay.vue'
import { EvaluationScoreBadge, FocusAnalyzeButton } from './evaluation'
import type { AdvancedTestResult, EvaluationResponse, EvaluationType, PatchOperation } from '@prompt-optimizer/core'
import type { ScoreLevel } from './evaluation/types'

const { t } = useI18n()

interface Props {
  // Layout mode
  isCompareMode?: boolean
  verticalLayout?: boolean
  showOriginal?: boolean

  // Title config
  originalTitle?: string
  optimizedTitle?: string
  singleResultTitle?: string

  // Test result data (used for tool call display)
  originalResult?: AdvancedTestResult
  optimizedResult?: AdvancedTestResult
  singleResult?: AdvancedTestResult

  // Size config
  cardSize?: 'small' | 'medium' | 'large'
  size?: 'small' | 'medium' | 'large'

  // Spacing config
  gap?: string | number

  // Evaluation feature config
  showEvaluation?: boolean
  // Whether there are test results (used to show the evaluate button)
  hasOriginalResult?: boolean
  hasOptimizedResult?: boolean
  // Evaluation state
  isEvaluatingOriginal?: boolean
  isEvaluatingOptimized?: boolean
  // Evaluation score
  originalScore?: number | null
  optimizedScore?: number | null
  // Whether there are evaluation results
  hasOriginalEvaluation?: boolean
  hasOptimizedEvaluation?: boolean
  // Evaluation results and grades (used for the hover preview)
  originalEvaluationResult?: EvaluationResponse | null
  optimizedEvaluationResult?: EvaluationResponse | null
  originalScoreLevel?: ScoreLevel | null
  optimizedScoreLevel?: ScoreLevel | null
}

const props = withDefaults(defineProps<Props>(), {
  isCompareMode: false,
  verticalLayout: false,
  showOriginal: true,
  originalTitle: '',
  optimizedTitle: '',
  singleResultTitle: '',
  cardSize: 'small',
  size: 'small',
  gap: 12,
  // Evaluation defaults
  showEvaluation: false,
  hasOriginalResult: false,
  hasOptimizedResult: false,
  isEvaluatingOriginal: false,
  isEvaluatingOptimized: false,
  originalScore: null,
  optimizedScore: null,
  hasOriginalEvaluation: false,
  hasOptimizedEvaluation: false,
  originalEvaluationResult: null,
  optimizedEvaluationResult: null,
  originalScoreLevel: null,
  optimizedScoreLevel: null
})

const emit = defineEmits<{
  'evaluate-original': []
  'evaluate-optimized': []
  'evaluate-with-feedback': [payload: { type: EvaluationType; feedback: string }]
  'show-original-detail': []
  'show-optimized-detail': []
  'apply-improvement': [payload: { improvement: string; type: EvaluationType }]
  'apply-patch': [payload: { operation: PatchOperation }]
}>()

// Computed properties
const originalTitle = computed(() =>
  props.originalTitle || t('test.originalResult', 'Original Result')
)

const optimizedTitle = computed(() =>
  props.optimizedTitle || t('test.optimizedResult', 'Optimized Result')
)

const singleResultTitle = computed(() =>
  props.singleResultTitle || t('test.testResult', 'Test Result')
)

// Event handling
const handleEvaluateOriginal = () => {
  emit('evaluate-original')
}

const handleEvaluateOptimized = () => {
  emit('evaluate-optimized')
}

const handleEvaluateWithFeedback = (payload: { type: EvaluationType; feedback: string }) => {
  emit('evaluate-with-feedback', payload)
}

const handleShowOriginalDetail = () => {
  emit('show-original-detail')
}

const handleShowOptimizedDetail = () => {
  emit('show-optimized-detail')
}

// Apply improvement suggestions handling
const handleApplyImprovement = (payload: { improvement: string; type: EvaluationType }) => {
  emit('apply-improvement', payload)
}

// Apply patch handling
const handleApplyPatch = (payload: { operation: PatchOperation }) => {
  emit('apply-patch', payload)
}
</script>

<style scoped>
.test-result-section {
  /* Make sure flex behavior and height management are correct */
  min-height: 0;
  max-height: 100%;
}

/* Card header layout */
.card-header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.evaluation-entry {
  flex-shrink: 0;
  margin-left: 8px;
}

/* Three-section layout styles */
.result-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  /* Provide independent scrolling for the body area */
}

.tool-calls-section {
  flex: 0 0 auto;
  /* The tool call area adapts its height to the content */
}
</style>
