import { computed, type Ref, type ComputedRef } from 'vue'
import type { ConversationMessage, PromptRecord } from '@prompt-optimizer/core'
import type { UseConversationOptimization } from './useConversationOptimization'

/**
 * Prompt display adapter options
 */
export interface PromptDisplayAdapterOptions {
  // Enable message optimization mode
  enableMessageOptimization: Ref<boolean>

  // Context message list
  optimizationContext: Ref<ConversationMessage[]>

  // Global optimization chain (used for viewing history records)
  globalVersions: Ref<PromptRecord[]>
  globalCurrentVersionId: Ref<string | undefined>
  globalIsOptimizing: Ref<boolean>
}

/**
 * Prompt display adapter return value
 */
export interface UsePromptDisplayAdapter {
  // Mode flag
  isInMessageOptimizationMode: ComputedRef<boolean>

  // Display data (the data source switches automatically by mode)
  displayedOriginalPrompt: ComputedRef<string>
  displayedOptimizedPrompt: ComputedRef<string>
  displayedVersions: ComputedRef<PromptRecord[]>
  displayedCurrentVersionId: ComputedRef<string | null>
  displayedIsOptimizing: ComputedRef<boolean>
}

/**
 * Prompt display adapter composable
 *
 * Features:
 * - Automatically switches the data source between "message optimization mode" and "history viewing mode"
 * - Provides a unified data interface for PromptPanel
 * - Solves the data isolation problem between message-level optimization and global optimization
 *
 * Use cases:
 * - ContextSystemWorkspace: needs to switch between message optimization and viewing history records
 * - Other components that need similar adapter logic
 *
 * @param conversationOptimization - Conversation optimization composable instance
 * @param options - Adapter config options
 * @returns Display layer data and the mode flag
 *
 * @example
 * ```ts
 * const displayAdapter = usePromptDisplayAdapter(
 *   conversationOptimization,
 *   {
 *     enableMessageOptimization: computed(() => props.enableMessageOptimization),
 *     optimizationContext: computed(() => props.optimizationContext),
 *     globalVersions: computed(() => props.versions || []),
 *     globalCurrentVersionId: computed(() => props.currentVersionId),
 *     globalIsOptimizing: computed(() => props.isOptimizing),
 *   }
 * )
 * ```
 */
export function usePromptDisplayAdapter(
  conversationOptimization: UseConversationOptimization,
  options: PromptDisplayAdapterOptions
): UsePromptDisplayAdapter {
  const selectedMessageId = conversationOptimization.selectedMessageId

  /**
   * Message optimization mode determination
   * Only enters message optimization mode when message optimization is enabled and a message is selected
   */
  const isInMessageOptimizationMode = computed(() => {
    return options.enableMessageOptimization.value && !!selectedMessageId.value
  })

  /**
   * Displayed original prompt
   * - Message optimization mode: the original content of the currently selected message
   * - History viewing mode: empty string (not displayed)
   */
  const displayedOriginalPrompt = computed(() => {
    if (!isInMessageOptimizationMode.value) return ''

    const message = options.optimizationContext.value?.find(
      m => m.id === selectedMessageId.value
    )
    return message?.originalContent || message?.content || ''
  })

  /**
   * Displayed optimization result
   * - Message optimization mode: message-level optimization result
   * - History viewing mode: empty string (not displayed)
   */
  const displayedOptimizedPrompt = computed(() => {
    return isInMessageOptimizationMode.value
      ? conversationOptimization.optimizedPrompt.value
      : ''
  })

  /**
   * Displayed version list
   * - Message optimization mode: message-level optimization version chain
   * - History viewing mode: global optimization version chain
   */
  const displayedVersions = computed(() => {
    if (isInMessageOptimizationMode.value) {
      return conversationOptimization.currentVersions.value || []
    }
    return options.globalVersions.value || []
  })

  /**
   * Displayed current version ID
   * - Message optimization mode: message-level current version ID
   * - History viewing mode: global current version ID
   */
  const displayedCurrentVersionId = computed(() => {
    if (isInMessageOptimizationMode.value) {
      return conversationOptimization.currentRecordId.value || null
    }
    return options.globalCurrentVersionId.value || null
  })

  /**
   * Displayed optimizing state
   * - Message optimization mode: message-level optimization state
   * - History viewing mode: global optimization state
   */
  const displayedIsOptimizing = computed(() => {
    return isInMessageOptimizationMode.value
      ? conversationOptimization.isOptimizing.value
      : options.globalIsOptimizing.value
  })

  return {
    isInMessageOptimizationMode,
    displayedOriginalPrompt,
    displayedOptimizedPrompt,
    displayedVersions,
    displayedCurrentVersionId,
    displayedIsOptimizing,
  }
}
