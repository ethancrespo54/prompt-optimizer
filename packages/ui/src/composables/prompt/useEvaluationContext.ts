/**
 * Evaluation context - shares the evaluation state using the provide/inject pattern
 *
 * Solves the problem of evaluation-related props being passed repeatedly across multiple component layers
 */

import { provide, inject, type InjectionKey } from 'vue'
import type { UseEvaluationReturn } from './useEvaluation'

/**
 * InjectionKey of the evaluation context, ensuring type safety
 */
export const EvaluationKey: InjectionKey<UseEvaluationReturn> = Symbol('evaluation')

/**
 * Provide the evaluation context
 *
 * Call it in the top-level application component (such as PromptOptimizerApp.vue)
 *
 * @param evaluation - The return value of useEvaluation
 *
 * @example
 * ```typescript
 * const evaluation = useEvaluation({ ... })
 * provideEvaluation(evaluation)
 * ```
 */
export function provideEvaluation(evaluation: UseEvaluationReturn): void {
  provide(EvaluationKey, evaluation)
}

/**
 * Inject the evaluation context
 *
 * Call it in child components that need the evaluation feature
 *
 * @returns The evaluation context, containing all evaluation state and methods
 * @throws Throws an error if called in a component where the evaluation context is not provided
 *
 * @example
 * ```typescript
 * const evaluation = useEvaluationContext()
 * // Access the state
 * evaluation.promptOnlyScore.value
 * evaluation.isEvaluatingPromptOnly.value
 * // Call methods
 * evaluation.evaluatePromptOnly({ ... })
 * evaluation.showDetail('prompt-only')
 * ```
 */
export function useEvaluationContext(): UseEvaluationReturn {
  const evaluation = inject(EvaluationKey)
  if (!evaluation) {
    throw new Error(
      '[useEvaluationContext] Must be used within a component tree that provides the evaluation context. ' +
      'Make sure a parent component calls provideEvaluation().'
    )
  }
  return evaluation
}

/**
 * Try to inject the evaluation context (optional)
 *
 * If the evaluation context is not provided, returns null instead of throwing an error
 * Suited to components that use the evaluation feature optionally
 *
 * @returns The evaluation context or null
 */
export function useEvaluationContextOptional(): UseEvaluationReturn | null {
  return inject(EvaluationKey, null)
}
