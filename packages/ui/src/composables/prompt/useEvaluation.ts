/**
 * Evaluation service composable
 *
 * Provides a reactive interface for LLM smart evaluation
 * - Original prompt evaluation
 * - Optimized prompt evaluation
 * - Compare evaluation
 *
 * Supports independent evaluation state per type; each evaluation type has its own result cache
 */

import { reactive, ref, computed, type Ref, type ComputedRef } from 'vue'
import { useToast } from '../ui/useToast'
import { useI18n } from 'vue-i18n'
import { getI18nErrorMessage } from '../../utils/error'
import { useFunctionModelManager } from '../model/useFunctionModelManager'
import type { AppServices } from '../../types/services'
import type {
  EvaluationType,
  EvaluationResponse,
  EvaluationRequest,
  OriginalEvaluationRequest,
  OptimizedEvaluationRequest,
  CompareEvaluationRequest,
  PromptOnlyEvaluationRequest,
  PromptIterateEvaluationRequest,
  EvaluationModeConfig,
  EvaluationSubMode,
  ProEvaluationContext,
} from '@prompt-optimizer/core'

/** Score grade type */
export type ScoreLevel = 'excellent' | 'good' | 'acceptable' | 'poor' | 'very-poor'

/**
 * State of a single evaluation type
 */
export interface SingleEvaluationState {
  /** Whether an evaluation is in progress */
  isEvaluating: boolean
  /** Evaluation result */
  result: EvaluationResponse | null
  /** Streaming output content */
  streamContent: string
  /** Error message */
  error: string | null
}

/**
 * Evaluation state by type
 */
export interface TypedEvaluationState {
  /** Original prompt evaluation state */
  original: SingleEvaluationState
  /** Optimized evaluation state */
  optimized: SingleEvaluationState
  /** Compare evaluation state */
  compare: SingleEvaluationState
  /** Prompt-only evaluation state (no test results needed) */
  'prompt-only': SingleEvaluationState
  /** Prompt evaluation state with an iteration requirement */
  'prompt-iterate': SingleEvaluationState
  /** The type whose details are currently being viewed */
  activeDetailType: EvaluationType | null
}

/**
 * Evaluation composable options
 */
export interface UseEvaluationOptions {
  /** Evaluation model key (the default is used if not set) */
  evaluationModelKey?: Ref<string> | ComputedRef<string>
  /** Language setting */
  language?: Ref<string> | ComputedRef<string>
  /** Function mode (required) */
  functionMode: Ref<string> | ComputedRef<string>
  /** Sub-mode (required) */
  subMode: Ref<string> | ComputedRef<string>
}

/**
 * Evaluation composable return type
 */
export interface UseEvaluationReturn {
  /** Evaluation state by type */
  state: TypedEvaluationState
  /** Whether the details panel is visible */
  isPanelVisible: Ref<boolean>

  // ===== Original evaluation-related =====
  /** Original evaluation score */
  originalScore: ComputedRef<number | null>
  /** Original evaluation grade */
  originalLevel: ComputedRef<ScoreLevel | null>
  /** Whether the original is being evaluated */
  isEvaluatingOriginal: ComputedRef<boolean>
  /** Whether there is an original evaluation result */
  hasOriginalResult: ComputedRef<boolean>

  // ===== Optimized evaluation-related =====
  /** Optimized evaluation score */
  optimizedScore: ComputedRef<number | null>
  /** Optimized evaluation grade */
  optimizedLevel: ComputedRef<ScoreLevel | null>
  /** Whether the optimized is being evaluated */
  isEvaluatingOptimized: ComputedRef<boolean>
  /** Whether there is an optimized evaluation result */
  hasOptimizedResult: ComputedRef<boolean>

  // ===== Compare evaluation-related =====
  /** Compare evaluation score */
  compareScore: ComputedRef<number | null>
  /** Compare evaluation grade */
  compareLevel: ComputedRef<ScoreLevel | null>
  /** Whether a compare evaluation is in progress */
  isEvaluatingCompare: ComputedRef<boolean>
  /** Whether there is a compare evaluation result */
  hasCompareResult: ComputedRef<boolean>

  // ===== Prompt-only evaluation-related =====
  /** Prompt-only evaluation score */
  promptOnlyScore: ComputedRef<number | null>
  /** Prompt-only evaluation grade */
  promptOnlyLevel: ComputedRef<ScoreLevel | null>
  /** Whether a prompt-only evaluation is in progress */
  isEvaluatingPromptOnly: ComputedRef<boolean>
  /** Whether there is a prompt-only evaluation result */
  hasPromptOnlyResult: ComputedRef<boolean>

  // ===== Iterate prompt evaluation-related =====
  /** Iterate prompt evaluation score */
  promptIterateScore: ComputedRef<number | null>
  /** Iterate prompt evaluation grade */
  promptIterateLevel: ComputedRef<ScoreLevel | null>
  /** Whether an iterate prompt evaluation is in progress */
  isEvaluatingPromptIterate: ComputedRef<boolean>
  /** Whether there is an iterate prompt evaluation result */
  hasPromptIterateResult: ComputedRef<boolean>

  // ===== Common computed properties =====
  /** Whether any evaluation is in progress */
  isAnyEvaluating: ComputedRef<boolean>
  /** Evaluation result of the current details */
  activeResult: ComputedRef<EvaluationResponse | null>
  /** Streaming content of the current details */
  activeStreamContent: ComputedRef<string>
  /** Error of the current details */
  activeError: ComputedRef<string | null>
  /** Score grade of the current details */
  activeScoreLevel: ComputedRef<ScoreLevel | null>

  // ===== Evaluation methods =====
  /** Evaluate the original prompt */
  evaluateOriginal: (params: {
    originalPrompt: string
    testContent?: string
    testResult: string
    proContext?: ProEvaluationContext
    userFeedback?: string
  }) => Promise<void>
  /** Evaluate the optimized prompt */
  evaluateOptimized: (params: {
    originalPrompt: string
    optimizedPrompt: string
    testContent?: string
    testResult: string
    proContext?: ProEvaluationContext
    userFeedback?: string
  }) => Promise<void>
  /** Compare evaluation */
  evaluateCompare: (params: {
    originalPrompt: string
    optimizedPrompt: string
    testContent?: string
    originalTestResult: string
    optimizedTestResult: string
    proContext?: ProEvaluationContext
    userFeedback?: string
  }) => Promise<void>
  /** Prompt-only evaluation (no test results needed) */
  evaluatePromptOnly: (params: {
    originalPrompt: string
    optimizedPrompt: string
    proContext?: ProEvaluationContext
    userFeedback?: string
  }) => Promise<void>
  /** Prompt evaluation with an iteration requirement */
  evaluatePromptIterate: (params: {
    originalPrompt: string
    optimizedPrompt: string
    iterateRequirement: string
    proContext?: ProEvaluationContext
    userFeedback?: string
  }) => Promise<void>

  // ===== State management methods =====
  /** Clear the evaluation result of the specified type */
  clearResult: (type: EvaluationType) => void
  /** Clear all evaluation results */
  clearAllResults: () => void
  /** Show the details panel of the specified type */
  showDetail: (type: EvaluationType) => void
  /** Close the details panel */
  closePanel: () => void

  // ===== Utility methods =====
  /** Get the grade from a score */
  getScoreLevel: (score: number | null) => ScoreLevel | null
}

/**
 * Create the initial value of a single evaluation state
 */
function createInitialSingleState(): SingleEvaluationState {
  return {
    isEvaluating: false,
    result: null,
    streamContent: '',
    error: null,
  }
}

/**
 * Compute the grade from a score
 */
function calculateScoreLevel(score: number | null): ScoreLevel | null {
  if (score === null || score === undefined) return null
  if (score >= 90) return 'excellent'
  if (score >= 80) return 'good'
  if (score >= 60) return 'acceptable'
  if (score >= 40) return 'poor'
  return 'very-poor'
}

/**
 * Evaluation composable
 *
 * @param services Service instance reference
 * @param options Options config
 * @returns Evaluation interface
 */
export function useEvaluation(
  services: Ref<AppServices | null>,
  options: UseEvaluationOptions
): UseEvaluationReturn {
  const toast = useToast()
  // NOTE: because this project's vue-i18n type augmentation and usage are complex, locale is annotated explicitly here to satisfy tsc
  const { t, locale } = useI18n() as unknown as {
    t: (key: string, ...args: unknown[]) => string
    locale: Ref<string>
  }

  // Get the function model manager
  const functionModelManager = useFunctionModelManager(services)

  // Details panel visibility
  const isPanelVisible = ref(false)

  // Evaluation state by type
  const state = reactive<TypedEvaluationState>({
    original: createInitialSingleState(),
    optimized: createInitialSingleState(),
    compare: createInitialSingleState(),
    'prompt-only': createInitialSingleState(),
    'prompt-iterate': createInitialSingleState(),
    activeDetailType: null,
  })

  // ===== Original evaluation computed properties =====
  const originalScore = computed(() => state.original.result?.score?.overall ?? null)
  const originalLevel = computed(() => calculateScoreLevel(originalScore.value))
  const isEvaluatingOriginal = computed(() => state.original.isEvaluating)
  const hasOriginalResult = computed(() => state.original.result !== null)

  // ===== Optimized evaluation computed properties =====
  const optimizedScore = computed(() => state.optimized.result?.score?.overall ?? null)
  const optimizedLevel = computed(() => calculateScoreLevel(optimizedScore.value))
  const isEvaluatingOptimized = computed(() => state.optimized.isEvaluating)
  const hasOptimizedResult = computed(() => state.optimized.result !== null)

  // ===== Compare evaluation computed properties =====
  const compareScore = computed(() => state.compare.result?.score?.overall ?? null)
  const compareLevel = computed(() => calculateScoreLevel(compareScore.value))
  const isEvaluatingCompare = computed(() => state.compare.isEvaluating)
  const hasCompareResult = computed(() => state.compare.result !== null)

  // ===== Prompt-only evaluation computed properties =====
  const promptOnlyScore = computed(() => state['prompt-only'].result?.score?.overall ?? null)
  const promptOnlyLevel = computed(() => calculateScoreLevel(promptOnlyScore.value))
  const isEvaluatingPromptOnly = computed(() => state['prompt-only'].isEvaluating)
  const hasPromptOnlyResult = computed(() => state['prompt-only'].result !== null)

  // ===== Iterate prompt evaluation computed properties =====
  const promptIterateScore = computed(() => state['prompt-iterate'].result?.score?.overall ?? null)
  const promptIterateLevel = computed(() => calculateScoreLevel(promptIterateScore.value))
  const isEvaluatingPromptIterate = computed(() => state['prompt-iterate'].isEvaluating)
  const hasPromptIterateResult = computed(() => state['prompt-iterate'].result !== null)

  // ===== Common computed properties =====
  const isAnyEvaluating = computed(() =>
    state.original.isEvaluating ||
    state.optimized.isEvaluating ||
    state.compare.isEvaluating ||
    state['prompt-only'].isEvaluating ||
    state['prompt-iterate'].isEvaluating
  )

  const activeResult = computed(() => {
    if (!state.activeDetailType) return null
    return state[state.activeDetailType].result
  })

  const activeStreamContent = computed(() => {
    if (!state.activeDetailType) return ''
    return state[state.activeDetailType].streamContent
  })

  const activeError = computed(() => {
    if (!state.activeDetailType) return null
    return state[state.activeDetailType].error
  })

  const activeScoreLevel = computed(() => {
    if (!state.activeDetailType) return null
    const score = state[state.activeDetailType].result?.score?.overall ?? null
    return calculateScoreLevel(score)
  })

  /**
   * Get the evaluation model key
   * Rules:
   * - As long as the user has configured an evaluation model in "Function models" (a persisted value exists), that value is always used
   * - Otherwise use the evaluationModelKey passed in by the caller (usually the global optimize model)
   * - If the caller did not pass one, use the effective evaluation model of the function model manager (read from the preferences)
   */
  const getModelKey = async (): Promise<string> => {
    // 1) Persisted evaluation model config: takes priority once configured
    await functionModelManager.initialize()
    if (functionModelManager.evaluationModel.value) {
      return functionModelManager.evaluationModel.value
    }

    // 2) Default: the key provided by the caller (usually the global optimize model)
    const passedModelKey = options.evaluationModelKey?.value || ''
    if (passedModelKey) {
      return passedModelKey
    }

    // 3) Fallback: use the effective evaluation model of the function model manager (the global optimize model read from the preferences)
    return functionModelManager.effectiveEvaluationModel.value || ''
  }

  /**
   * Get the language setting
   */
  const getLanguage = (): string => {
    if (options.language?.value) {
      return options.language.value
    }
    // Get the language from the i18n locale and map it to the languages supported by the templates
    const currentLocale = locale.value
    if (currentLocale.startsWith('en')) {
      return 'en'
    }
    return 'zh'
  }

  /**
   * Get the evaluation mode config
   */
  const getModeConfig = (): EvaluationModeConfig => {
    return {
      functionMode: options.functionMode.value as 'basic' | 'pro' | 'image',
      subMode: options.subMode.value as EvaluationSubMode,
    }
  }

  /**
   * General method for running an evaluation
   */
  const executeEvaluation = async (
    type: EvaluationType,
    request: EvaluationRequest,
    openPanel: boolean = true
  ): Promise<void> => {
    const evaluationService = services.value?.evaluationService
    if (!evaluationService) {
      toast.error(t('evaluation.error.serviceNotReady'))
      return
    }

    const targetState = state[type]

    // Reset the target state
    targetState.isEvaluating = true
    targetState.result = null
    targetState.streamContent = ''
    targetState.error = null

    // Set the current details type and open the panel
    if (openPanel) {
      state.activeDetailType = type
      isPanelVisible.value = true
    }

    try {
      await evaluationService.evaluateStream(request, {
        onToken: (token: string) => {
          // Guard: if the evaluation has been cleaned up/cancelled, ignore subsequent tokens
          if (!targetState.isEvaluating) return
          targetState.streamContent += token
        },
        onComplete: (result: EvaluationResponse) => {
          // Guard: if the evaluation has been cleaned up/cancelled, ignore the result
          if (!targetState.isEvaluating) return
          targetState.result = result
          targetState.isEvaluating = false
        },
        onError: (error: Error) => {
          // Guard: if the evaluation has been cleaned up/cancelled, ignore the error
          if (!targetState.isEvaluating) return
          targetState.error = getI18nErrorMessage(error)
          targetState.isEvaluating = false
          toast.error(t('evaluation.error.failed', { error: targetState.error }))
        },
      })
    } catch (error) {
      targetState.error = getI18nErrorMessage(error)
      targetState.isEvaluating = false
      toast.error(t('evaluation.error.failed', { error: targetState.error }))
    }
  }

  /**
   * Evaluate the original prompt
   */
  const evaluateOriginal = async (params: {
    originalPrompt: string
    testContent?: string
    testResult: string
    proContext?: ProEvaluationContext
    userFeedback?: string
  }): Promise<void> => {
    const request: OriginalEvaluationRequest = {
      type: 'original',
      originalPrompt: params.originalPrompt,
      testContent: params.testContent || '',
      testResult: params.testResult,
      evaluationModelKey: await getModelKey(),
      variables: { language: getLanguage() },
      mode: getModeConfig(),
      proContext: params.proContext,
      userFeedback: params.userFeedback,
    }
    await executeEvaluation('original', request, false)
  }

  /**
   * Evaluate the optimized prompt
   */
  const evaluateOptimized = async (params: {
    originalPrompt: string
    optimizedPrompt: string
    testContent?: string
    testResult: string
    proContext?: ProEvaluationContext
    userFeedback?: string
  }): Promise<void> => {
    const request: OptimizedEvaluationRequest = {
      type: 'optimized',
      originalPrompt: params.originalPrompt,
      optimizedPrompt: params.optimizedPrompt,
      testContent: params.testContent || '',
      testResult: params.testResult,
      evaluationModelKey: await getModelKey(),
      variables: { language: getLanguage() },
      mode: getModeConfig(),
      proContext: params.proContext,
      userFeedback: params.userFeedback,
      // Note: optimized evaluation does not support diagnostic mode yet; the diagnostic feature is only enabled in prompt-only/prompt-iterate
    }
    await executeEvaluation('optimized', request, false)
  }

  /**
   * Compare evaluation
   */
  const evaluateCompare = async (params: {
    originalPrompt: string
    optimizedPrompt: string
    testContent?: string
    originalTestResult: string
    optimizedTestResult: string
    proContext?: ProEvaluationContext
    userFeedback?: string
  }): Promise<void> => {
    const request: CompareEvaluationRequest = {
      type: 'compare',
      originalPrompt: params.originalPrompt,
      optimizedPrompt: params.optimizedPrompt,
      testContent: params.testContent || '',
      originalTestResult: params.originalTestResult,
      optimizedTestResult: params.optimizedTestResult,
      evaluationModelKey: await getModelKey(),
      variables: { language: getLanguage() },
      mode: getModeConfig(),
      proContext: params.proContext,
      userFeedback: params.userFeedback,
    }
    await executeEvaluation('compare', request, false)
  }

  /**
   * Prompt-only evaluation (no test results needed)
   */
  const evaluatePromptOnly = async (params: {
    originalPrompt: string
    optimizedPrompt: string
    proContext?: ProEvaluationContext
    userFeedback?: string
  }): Promise<void> => {
    const request: PromptOnlyEvaluationRequest = {
      type: 'prompt-only',
      originalPrompt: params.originalPrompt,
      optimizedPrompt: params.optimizedPrompt,
      testContent: '', // prompt-only mode needs no test content
      evaluationModelKey: await getModelKey(),
      variables: { language: getLanguage() },
      mode: getModeConfig(),
      proContext: params.proContext,
      userFeedback: params.userFeedback,
    }
    await executeEvaluation('prompt-only', request)
  }

  /**
   * Prompt evaluation with an iteration requirement
   */
  const evaluatePromptIterate = async (params: {
    originalPrompt: string
    optimizedPrompt: string
    iterateRequirement: string
    proContext?: ProEvaluationContext
    userFeedback?: string
  }): Promise<void> => {
    const request: PromptIterateEvaluationRequest = {
      type: 'prompt-iterate',
      originalPrompt: params.originalPrompt,
      optimizedPrompt: params.optimizedPrompt,
      iterateRequirement: params.iterateRequirement,
      testContent: '', // prompt-iterate mode needs no test content
      evaluationModelKey: await getModelKey(),
      variables: { language: getLanguage() },
      mode: getModeConfig(),
      proContext: params.proContext,
      userFeedback: params.userFeedback,
    }
    await executeEvaluation('prompt-iterate', request)
  }

  /**
   * Clear the evaluation result of the specified type
   * Also resets the evaluation state, to prevent an in-progress streaming evaluation from writing back
   */
  const clearResult = (type: EvaluationType): void => {
    const targetState = state[type]
    targetState.isEvaluating = false
    targetState.result = null
    targetState.streamContent = ''
    targetState.error = null

    // If the current details are of the cleared type, close the panel
    if (state.activeDetailType === type) {
      state.activeDetailType = null
      isPanelVisible.value = false
    }
  }

  /**
   * Clear all evaluation results
   */
  const clearAllResults = (): void => {
    clearResult('original')
    clearResult('optimized')
    clearResult('compare')
    clearResult('prompt-only')
    clearResult('prompt-iterate')
  }

  /**
   * Show the details panel of the specified type
   */
  const showDetail = (type: EvaluationType): void => {
    state.activeDetailType = type
    isPanelVisible.value = true
  }

  /**
   * Close the details panel
   */
  const closePanel = (): void => {
    isPanelVisible.value = false
  }

  /**
   * Get the grade from a score
   */
  const getScoreLevel = (score: number | null): ScoreLevel | null => {
    return calculateScoreLevel(score)
  }

  return {
    state,
    isPanelVisible,

    // Original evaluation
    originalScore,
    originalLevel,
    isEvaluatingOriginal,
    hasOriginalResult,

    // Optimized evaluation
    optimizedScore,
    optimizedLevel,
    isEvaluatingOptimized,
    hasOptimizedResult,

    // Compare evaluation
    compareScore,
    compareLevel,
    isEvaluatingCompare,
    hasCompareResult,

    // Prompt-only evaluation
    promptOnlyScore,
    promptOnlyLevel,
    isEvaluatingPromptOnly,
    hasPromptOnlyResult,

    // Iterate prompt evaluation
    promptIterateScore,
    promptIterateLevel,
    isEvaluatingPromptIterate,
    hasPromptIterateResult,

    // Common
    isAnyEvaluating,
    activeResult,
    activeStreamContent,
    activeError,
    activeScoreLevel,

    // Methods
    evaluateOriginal,
    evaluateOptimized,
    evaluateCompare,
    evaluatePromptOnly,
    evaluatePromptIterate,
    clearResult,
    clearAllResults,
    showDetail,
    closePanel,
    getScoreLevel,
  }
}
