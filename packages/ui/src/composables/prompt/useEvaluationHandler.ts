/**
 * Evaluation handler composable
 *
 * Encapsulates the complete handling logic of the evaluation feature for reuse across components
 * Integrates useEvaluation with business logic, providing an out-of-the-box evaluation feature
 */

import { computed, watch, type Ref, type ComputedRef } from 'vue'
import { useEvaluation, type UseEvaluationReturn, type ScoreLevel } from './useEvaluation'
import type { AppServices } from '../../types/services'
import type { EvaluationType, EvaluationResponse, ProEvaluationContext } from '@prompt-optimizer/core'
import type { PersistedEvaluationResults } from '../../types/evaluation'

/**
 * Test result data structure
 */
export interface TestResultsData {
  originalResult?: string
  optimizedResult?: string
}

/**
 * Evaluation handler options
 */
export interface UseEvaluationHandlerOptions {
  /** Service instance */
  services: Ref<AppServices | null>
  /** Original prompt */
  originalPrompt: Ref<string> | ComputedRef<string>
  /** Optimized prompt */
  optimizedPrompt: Ref<string> | ComputedRef<string>
  /** Test content */
  testContent: Ref<string> | ComputedRef<string>
  /** Test result data */
  testResults: Ref<TestResultsData | null>
  /** Evaluation model key */
  evaluationModelKey: Ref<string> | ComputedRef<string>
  /** Function mode (required) */
  functionMode: Ref<string> | ComputedRef<string>
  /** Sub-mode (required) */
  subMode: Ref<string> | ComputedRef<string>
  /**
   * Pro mode context (optional)
   * - Pro-System: contains targetMessage and conversationMessages
   * - Pro-User: contains variables, rawPrompt, resolvedPrompt
   */
  proContext?: Ref<ProEvaluationContext | undefined> | ComputedRef<ProEvaluationContext | undefined>
  /**
   * Current iteration requirement (optional)
   * Used for the re-evaluation of the prompt-iterate type, taken from the iterationNote of the current version
   */
  currentIterateRequirement?: Ref<string> | ComputedRef<string>
  /**
   * External evaluation instance (optional)
   * If provided, that instance is used instead of creating a new one
   * Used in scenarios where the Workspace shares the global evaluation state
   */
  externalEvaluation?: UseEvaluationReturn

  /**
   * Persist evaluation results (per type) into a submode session store.
   *
   * This keeps results stable across restart and avoids global cross-mode state.
   */
  persistedResults?: Ref<PersistedEvaluationResults>
}

/**
 * PromptPanel component reference type (used to open the iterate dialog)
 */
export interface PromptPanelRef {
  openIterateDialog?: (input?: string) => void
}

/**
 * Evaluation handler return type
 */
export interface UseEvaluationHandlerReturn {
  /** Original useEvaluation return value */
  evaluation: UseEvaluationReturn

  /** Run an evaluation */
  handleEvaluate: (type: EvaluationType, options?: { userFeedback?: string }) => Promise<void>

  /** Evaluation with user feedback */
  handleEvaluateWithFeedback: (type: EvaluationType, userFeedback: string) => Promise<void>

  /** Re-evaluate (triggered from the details panel) */
  handleReEvaluate: () => Promise<void>

  /** Evaluate with feedback (triggered based on the current details type) */
  handleEvaluateActiveWithFeedback: (userFeedback: string) => Promise<void>

  /**
   * Clear the evaluation results before testing
   * Should be called before running a test, to make sure old evaluation results do not linger
   */
  clearBeforeTest: () => void

  /**
   * Create a handler for applying improvement suggestions
   * @param promptPanelRef PromptPanel component reference
   * @returns A handler function that can be bound directly to the @apply-improvement event
   */
  createApplyImprovementHandler: (
    promptPanelRef: Ref<PromptPanelRef | null>
  ) => (payload: { improvement: string; type: EvaluationType }) => void

  /** TestAreaPanel evaluation event handlers */
  handlers: {
    onEvaluateOriginal: () => Promise<void>
    onEvaluateOptimized: () => Promise<void>
    onEvaluateCompare: () => Promise<void>
    onShowOriginalDetail: () => void
    onShowOptimizedDetail: () => void
    onShowCompareDetail: () => void
  }

  /** Evaluation-related props for TestAreaPanel (reactive) */
  testAreaEvaluationProps: ComputedRef<{
    showEvaluation: boolean
    hasOriginalResult: boolean
    hasOptimizedResult: boolean
    isEvaluatingOriginal: boolean
    isEvaluatingOptimized: boolean
    originalScore: number | null
    optimizedScore: number | null
    hasOriginalEvaluation: boolean
    hasOptimizedEvaluation: boolean
    // New: evaluation results and grades, used for the hover preview
    originalEvaluationResult: EvaluationResponse | null
    optimizedEvaluationResult: EvaluationResponse | null
    originalScoreLevel: ScoreLevel | null
    optimizedScoreLevel: ScoreLevel | null
  }>

  /** Computed property for compare evaluation */
  compareEvaluation: {
    hasCompareResult: ComputedRef<boolean>
    isEvaluatingCompare: ComputedRef<boolean>
    compareScore: ComputedRef<number | null>
  }

  /** Props for EvaluationPanel (reactive) */
  panelProps: ComputedRef<{
    show: boolean
    isEvaluating: boolean
    result: EvaluationResponse | null
    streamContent: string
    error: string | null
    currentType: EvaluationType | null
    scoreLevel: ScoreLevel | null
  }>
}

/**
 * Evaluation handler composable
 *
 * @param options Config options
 * @returns Evaluation handler interface
 *
 * @example
 * ```ts
 * const evaluationHandler = useEvaluationHandler({
 *   services,
 *   originalPrompt: toRef(optimizer, 'prompt'),
 *   optimizedPrompt: toRef(optimizer, 'optimizedPrompt'),
 *   testContent,
 *   testResults,
 *   evaluationModelKey: computed(() => modelManager.selectedOptimizeModel),
 * })
 *
 * // Use in TestAreaPanel
 * <TestAreaPanel
 *   v-bind="evaluationHandler.testAreaEvaluationProps.value"
 *   @evaluate-original="evaluationHandler.handlers.onEvaluateOriginal"
 *   @evaluate-optimized="evaluationHandler.handlers.onEvaluateOptimized"
 *   @show-original-detail="evaluationHandler.handlers.onShowOriginalDetail"
 *   @show-optimized-detail="evaluationHandler.handlers.onShowOptimizedDetail"
 * />
 * ```
 */
export function useEvaluationHandler(
  options: UseEvaluationHandlerOptions
): UseEvaluationHandlerReturn {
  const {
    services,
    originalPrompt,
    optimizedPrompt,
    testContent,
    testResults,
    evaluationModelKey,
    functionMode,
    subMode,
    proContext,
    currentIterateRequirement,
    externalEvaluation,
    persistedResults,
  } = options

  // Use the external evaluation instance or create a new one
  // When the Workspace needs to share the global evaluation state, externalEvaluation should be passed in
  const evaluation = externalEvaluation ?? useEvaluation(services, {
    evaluationModelKey,
    functionMode,
    subMode,
  })

  // Optional: bind evaluation results to a persisted store.
  // - Initialize evaluation state from persisted results.
  // - Keep persisted results updated when evaluation results change.
  if (persistedResults) {
    // Initialize (restore) results.
    evaluation.state.original.result = persistedResults.value.original ?? null
    evaluation.state.optimized.result = persistedResults.value.optimized ?? null
    evaluation.state.compare.result = persistedResults.value.compare ?? null
    evaluation.state['prompt-only'].result = persistedResults.value['prompt-only'] ?? null
    evaluation.state['prompt-iterate'].result = persistedResults.value['prompt-iterate'] ?? null

    // Keep persisted results updated.
    watch(() => evaluation.state.original.result, (next) => {
      if (persistedResults.value.original === next) return
      persistedResults.value.original = next ?? null
    })
    watch(() => evaluation.state.optimized.result, (next) => {
      if (persistedResults.value.optimized === next) return
      persistedResults.value.optimized = next ?? null
    })
    watch(() => evaluation.state.compare.result, (next) => {
      if (persistedResults.value.compare === next) return
      persistedResults.value.compare = next ?? null
    })
    watch(() => evaluation.state['prompt-only'].result, (next) => {
      if (persistedResults.value['prompt-only'] === next) return
      persistedResults.value['prompt-only'] = next ?? null
    })
    watch(() => evaluation.state['prompt-iterate'].result, (next) => {
      if (persistedResults.value['prompt-iterate'] === next) return
      persistedResults.value['prompt-iterate'] = next ?? null
    })
  }

  /**
   * Run an evaluation
   */
  const handleEvaluate = async (
    type: EvaluationType,
    options?: { userFeedback?: string }
  ): Promise<void> => {
    const original = originalPrompt.value || ''
    const optimized = optimizedPrompt.value || ''
    const content = testContent.value || ''
    const results = testResults.value
    const context = proContext?.value
    const userFeedback = options?.userFeedback?.trim() || ''

    // 🔧 Precompute the trim result to avoid repeated calls
    const originalTrimmed = original?.trim()
    const optimizedTrimmed = optimized?.trim()
    const shouldPassOriginal =
      originalTrimmed &&
      optimizedTrimmed &&
      originalTrimmed !== optimizedTrimmed

    if (type === 'original') {
      await evaluation.evaluateOriginal({
        originalPrompt: original,
        testContent: content,
        testResult: results?.originalResult || '',
        proContext: context,
        userFeedback: userFeedback || undefined,
      })
    } else if (type === 'optimized') {
      await evaluation.evaluateOptimized({
        originalPrompt: original,
        optimizedPrompt: optimized,
        testContent: content,
        testResult: results?.optimizedResult || '',
        proContext: context,
        userFeedback: userFeedback || undefined,
      })
    } else if (type === 'compare') {
      await evaluation.evaluateCompare({
        originalPrompt: original,
        optimizedPrompt: optimized,
        testContent: content,
        originalTestResult: results?.originalResult || '',
        optimizedTestResult: results?.optimizedResult || '',
        proContext: context,
        userFeedback: userFeedback || undefined,
      })
    } else if (type === 'prompt-only') {
      // Prompt-only evaluation (no test results needed)
      // 🔧 If the original and optimized content are identical, this is analysis mode and originalPrompt is not passed
      // Let the evaluation focus on the prompt itself, avoiding a "no change before and after optimization" misjudgment
      await evaluation.evaluatePromptOnly({
        originalPrompt: shouldPassOriginal ? original : '',
        optimizedPrompt: optimized,
        proContext: context,
        userFeedback: userFeedback || undefined,
      })
    } else if (type === 'prompt-iterate') {
      // Prompt evaluation with an iteration requirement
      const iterateRequirement = currentIterateRequirement?.value?.trim() || ''
      if (!iterateRequirement) {
        // When the iteration requirement is empty, degrade to a prompt-only evaluation
        // 🔧 Handle the analysis mode scenario the same way
        await evaluation.evaluatePromptOnly({
          originalPrompt: shouldPassOriginal ? original : '',
          optimizedPrompt: optimized,
          proContext: context,
          userFeedback: userFeedback || undefined,
        })
      } else {
        // 🔧 Iterative evaluation handles the analysis mode scenario the same way
        await evaluation.evaluatePromptIterate({
          originalPrompt: shouldPassOriginal ? original : '',
          optimizedPrompt: optimized,
          iterateRequirement,
          proContext: context,
          userFeedback: userFeedback || undefined,
        })
      }
    }
  }

  const handleEvaluateWithFeedback = async (
    type: EvaluationType,
    userFeedback: string
  ): Promise<void> => {
    await handleEvaluate(type, { userFeedback })
  }

  /**
   * Re-evaluate (triggered from the details panel)
   * Rule: always reassemble the request from the "current business state" and run one evaluation
   *
   * Note: this strategy does not save/replay lastRequest, and does not implicitly reuse historical feedback.
   */
  const handleReEvaluate = async (): Promise<void> => {
    const currentType = evaluation.state.activeDetailType
    if (currentType) {
      await handleEvaluate(currentType)
    }
  }

  const handleEvaluateActiveWithFeedback = async (userFeedback: string): Promise<void> => {
    const currentType = evaluation.state.activeDetailType
    if (currentType) {
      await handleEvaluate(currentType, { userFeedback })
    }
  }

  /**
   * Event handlers
   */
  const handlers = {
    onEvaluateOriginal: () => handleEvaluate('original'),
    onEvaluateOptimized: () => handleEvaluate('optimized'),
    onEvaluateCompare: () => handleEvaluate('compare'),
    onShowOriginalDetail: () => evaluation.showDetail('original'),
    onShowOptimizedDetail: () => evaluation.showDetail('optimized'),
    onShowCompareDetail: () => evaluation.showDetail('compare'),
  }

  /**
   * Evaluation-related props for TestAreaPanel
   */
  const testAreaEvaluationProps = computed(() => ({
    showEvaluation: true,
    hasOriginalResult: !!testResults.value?.originalResult,
    hasOptimizedResult: !!testResults.value?.optimizedResult,
    isEvaluatingOriginal: evaluation.isEvaluatingOriginal.value,
    isEvaluatingOptimized: evaluation.isEvaluatingOptimized.value,
    originalScore: evaluation.originalScore.value,
    optimizedScore: evaluation.optimizedScore.value,
    hasOriginalEvaluation: evaluation.hasOriginalResult.value,
    hasOptimizedEvaluation: evaluation.hasOptimizedResult.value,
    // New: evaluation results and grades, used for the hover preview
    originalEvaluationResult: evaluation.state.original.result,
    optimizedEvaluationResult: evaluation.state.optimized.result,
    originalScoreLevel: evaluation.originalLevel.value,
    optimizedScoreLevel: evaluation.optimizedLevel.value,
  }))

  /**
   * Compare evaluation-related
   */
  const compareEvaluation = {
    hasCompareResult: evaluation.hasCompareResult,
    isEvaluatingCompare: evaluation.isEvaluatingCompare,
    compareScore: evaluation.compareScore,
  }

  /**
   * EvaluationPanel props
   */
  const getIsEvaluatingForType = (type: EvaluationType): boolean => {
    switch (type) {
      case 'original':
        return evaluation.state.original.isEvaluating
      case 'optimized':
        return evaluation.state.optimized.isEvaluating
      case 'compare':
        return evaluation.state.compare.isEvaluating
      case 'prompt-only':
        return evaluation.state['prompt-only'].isEvaluating
      case 'prompt-iterate':
        return evaluation.state['prompt-iterate'].isEvaluating
    }
  }

  const panelProps = computed(() => {
    const activeType = evaluation.state.activeDetailType
    return {
      show: evaluation.isPanelVisible.value,
      isEvaluating: activeType
        ? getIsEvaluatingForType(activeType)
        : false,
      result: evaluation.activeResult.value,
      streamContent: evaluation.activeStreamContent.value,
      error: evaluation.activeError.value,
      currentType: activeType,
      scoreLevel: evaluation.activeScoreLevel.value,
    }
  })

  /**
   * Clear the evaluation results before testing
   * Should be called before running a test, to make sure old evaluation results do not linger
   * Note: only clears the test-related evaluations (original/optimized/compare), keeping the left-side prompt evaluations (prompt-only/prompt-iterate)
   */
  const clearBeforeTest = (): void => {
    evaluation.clearResult('original')
    evaluation.clearResult('optimized')
    evaluation.clearResult('compare')
  }

  /**
   * Create a handler for applying improvement suggestions
   * Closes the evaluation panel and opens the iterate dialog, prefilling the improvement suggestions
   *
   * @param promptPanelRef PromptPanel component reference
   * @returns A handler function that can be bound directly to the @apply-improvement event
   */
  const createApplyImprovementHandler = (
    promptPanelRef: Ref<PromptPanelRef | null>
  ) => {
    return (payload: { improvement: string; type: EvaluationType }): void => {
      const { improvement } = payload

      // Close the evaluation panel
      evaluation.closePanel()

      // Open the iterate dialog and prefill the improvement suggestions
      if (promptPanelRef.value?.openIterateDialog) {
        promptPanelRef.value.openIterateDialog(improvement)
      }
    }
  }

  return {
    evaluation,
    handleEvaluate,
    handleEvaluateWithFeedback,
    handleReEvaluate,
    handleEvaluateActiveWithFeedback,
    clearBeforeTest,
    createApplyImprovementHandler,
    handlers,
    testAreaEvaluationProps,
    compareEvaluation,
    panelProps,
  }
}
