import { reactive } from 'vue'
import type { TemplateMetadata } from '@prompt-optimizer/core'

export type TemplateManagerTemplateType = Exclude<
  TemplateMetadata['templateType'],
  'contextSystemOptimize' | 'evaluation'
>

export interface TemplateManagerHooks {
  showTemplates: boolean
  currentType: TemplateManagerTemplateType
  openTemplateManager: (type: TemplateManagerTemplateType) => void
  handleTemplateManagerClose: (refreshCallback?: () => void) => void
}

/**
 * TemplateManager hook (no persistence side effects)
 *
 * Phase 1/2 migration notes:
 * - Persistence of template selection has moved to the Session Store of each mode (single source of truth)
 * - This hook is only responsible for:
 *   1) Controlling the display of the TemplateManager Modal
 *   2) Writing the "selected template object" into the refs provided by the caller (needed by the UI)
 *
 * IMPORTANT：
 * - Reading or writing TEMPLATE_SELECTION_KEYS here is forbidden (avoids dual sources)
 */
export function useTemplateManager(
  _services: unknown
): TemplateManagerHooks {
  void _services

  const state = reactive<TemplateManagerHooks>({
    showTemplates: false,
    currentType: 'optimize',
    openTemplateManager: (type: TemplateManagerTemplateType) => {
      state.currentType = type
      state.showTemplates = true
    },
    handleTemplateManagerClose: (refreshCallback?: () => void) => {
      if (refreshCallback) refreshCallback()
      state.showTemplates = false
    },
  })

  return state
}
