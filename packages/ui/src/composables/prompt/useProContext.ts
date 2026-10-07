/**
 * Pro mode context - shares proContext using the provide/inject pattern
 *
 * Solves the problem of proContext being passed across multiple component layers in Pro mode
 * Used to provide multi-message context understanding during evaluation (especially the Pro-System scenario)
 */

import { provide, inject, type InjectionKey, type Ref, type ComputedRef } from 'vue'
import type { ProEvaluationContext } from '@prompt-optimizer/core'

/**
 * InjectionKey of ProContext, ensuring type safety
 */
export const ProContextKey: InjectionKey<Ref<ProEvaluationContext | undefined> | ComputedRef<ProEvaluationContext | undefined>> = Symbol('proContext')

/**
 * Provide the Pro mode context
 *
 * Call it in Pro mode Workspace components (such as ContextSystemWorkspace, ContextUserWorkspace)
 *
 * @param proContext - Reactive reference of the Pro mode context
 *
 * @example
 * ```typescript
 * const proContext = computed(() => ({
 *   targetMessage: { role: 'system', content: '...' },
 *   conversationMessages: [...]
 * }))
 * provideProContext(proContext)
 * ```
 */
export function provideProContext(proContext: Ref<ProEvaluationContext | undefined> | ComputedRef<ProEvaluationContext | undefined>): void {
  provide(ProContextKey, proContext)
}

/**
 * Inject the Pro mode context (optional)
 *
 * If proContext is not provided, returns undefined instead of throwing an error
 * Suited to components that may be used in both Basic mode and Pro mode
 *
 * @returns Reactive reference of the Pro mode context, or undefined when not in Pro mode
 *
 * @example
 * ```typescript
 * const proContext = useProContextOptional()
 * // Use during evaluation
 * evaluation.evaluatePromptOnly({
 *   originalPrompt,
 *   optimizedPrompt,
 *   proContext: proContext?.value,
 * })
 * ```
 */
export function useProContextOptional(): Ref<ProEvaluationContext | undefined> | ComputedRef<ProEvaluationContext | undefined> | undefined {
  return inject(ProContextKey, undefined)
}
