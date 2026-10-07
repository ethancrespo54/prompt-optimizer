/**
 * Workspace template selection logic (shared)
 *
 * Features:
 * - Read/write selectedTemplateId and selectedIterateTemplateId from the session store
 * - Filter the option list by template type
 * - Refresh the template option list (with race protection)
 * - Provide template objects (derived from the id)
 *
 * @param services - AppServices instance
 * @param sessionStore - Session store instance
 * @param optimizeTemplateType - Optimization template type (such as 'conversationMessageOptimize' or 'contextUserOptimize')
 * @param iterateTemplateType - Iterate template type (such as 'contextIterate')
 */
import { computed, ref, watch, type Ref } from 'vue'
import type { AppServices } from '../../types/services'
import type { TemplateSelectOption } from '../../types/select-options'
import type { Template } from '@prompt-optimizer/core'
import { DataTransformer } from '../../utils/data-transformer'

type WorkspaceTemplateType = Parameters<AppServices['templateManager']['listTemplatesByType']>[0]

type WorkspaceTemplateSessionStore = {
  selectedTemplateId: string | null
  selectedIterateTemplateId: string | null
  updateTemplate: (id: string | null) => void
  updateIterateTemplate: (id: string | null) => void
}

export function useWorkspaceTemplateSelection<T extends WorkspaceTemplateSessionStore>(
  services: Ref<AppServices | null>,
  sessionStore: T,
  optimizeTemplateType: WorkspaceTemplateType,
  iterateTemplateType: WorkspaceTemplateType
) {
  const templateOptions = ref<TemplateSelectOption[]>([])
  const iterateTemplateOptions = ref<TemplateSelectOption[]>([])

  const selectedTemplate = ref<Template | null>(null)
  const selectedIterateTemplate = ref<Template | null>(null)

  // Avoid a "fallback write-back" inside refresh triggering watch(selectedId) to refresh again
  let skipNextOptimizeRefresh = false
  let skipNextIterateRefresh = false

  // Optimize template ID (two-way binding)
  const selectedTemplateId = computed<string>({
    get: () => sessionStore.selectedTemplateId ?? '',
    set: (value: string) => {
      sessionStore.updateTemplate(value || null)
    }
  })

  // Iterate template ID (two-way binding)
  const selectedIterateTemplateId = computed<string>({
    get: () => sessionStore.selectedIterateTemplateId ?? '',
    set: (value: string) => {
      sessionStore.updateIterateTemplate(value || null)
    }
  })

  // Refresh the optimize template list
  let optimizeTemplateResolveToken = 0
  const refreshOptimizeTemplates = async () => {
    const mgr = services.value?.templateManager
    if (!mgr) {
      templateOptions.value = []
      selectedTemplate.value = null
      return
    }

    const token = ++optimizeTemplateResolveToken
    try {
      const list = await mgr.listTemplatesByType(optimizeTemplateType)
      if (token !== optimizeTemplateResolveToken) return

      templateOptions.value = DataTransformer.templatesToSelectOptions(list || [])

      const templates = list || []
      if (!templates.length) {
        selectedTemplate.value = null
        return
      }

      const currentId = selectedTemplateId.value
      const found = currentId ? templates.find(t => t.id === currentId) || null : null
      if (found) {
        selectedTemplate.value = found
        return
      }

      // No selection or it is no longer valid: uniformly fall back to the first template
      const fallback = templates[0] || null
      if (fallback) {
        skipNextOptimizeRefresh = true
        sessionStore.updateTemplate(fallback.id)
        selectedTemplate.value = fallback
      } else {
        selectedTemplate.value = null
      }
    } catch (error) {
      if (token !== optimizeTemplateResolveToken) return
      console.error('[useWorkspaceTemplateSelection] refreshOptimizeTemplates failed:', error instanceof Error ? error.message : String(error), error)
      templateOptions.value = []
      selectedTemplate.value = null
    }
  }

  // Refresh the iterate template list
  let iterateTemplateResolveToken = 0
  const refreshIterateTemplates = async () => {
    const mgr = services.value?.templateManager
    if (!mgr) {
      iterateTemplateOptions.value = []
      selectedIterateTemplate.value = null
      return
    }

    const token = ++iterateTemplateResolveToken
    try {
      const list = await mgr.listTemplatesByType(iterateTemplateType)
      if (token !== iterateTemplateResolveToken) return

      iterateTemplateOptions.value = DataTransformer.templatesToSelectOptions(list || [])

      const templates = list || []
      if (!templates.length) {
        selectedIterateTemplate.value = null
        return
      }

      const currentId = selectedIterateTemplateId.value
      const found = currentId ? templates.find(t => t.id === currentId) || null : null
      if (found) {
        selectedIterateTemplate.value = found
        return
      }

      // No selection or it is no longer valid: uniformly fall back to the first template
      const fallback = templates[0] || null
      if (fallback) {
        skipNextIterateRefresh = true
        sessionStore.updateIterateTemplate(fallback.id)
        selectedIterateTemplate.value = fallback
      } else {
        selectedIterateTemplate.value = null
      }
    } catch (error) {
      if (token !== iterateTemplateResolveToken) return
      console.error('[useWorkspaceTemplateSelection] refreshIterateTemplates failed:', error instanceof Error ? error.message : String(error), error)
      iterateTemplateOptions.value = []
      selectedIterateTemplate.value = null
    }
  }

  // Watch templateManager changes and refresh the template options
  watch(
    () => services.value?.templateManager,
    () => {
      void refreshOptimizeTemplates()
      void refreshIterateTemplates()
    },
    { immediate: true }
  )

  // Watch selectedTemplateId changes and update the selectedTemplate object
  watch(
    () => selectedTemplateId.value,
    () => {
      if (skipNextOptimizeRefresh) {
        skipNextOptimizeRefresh = false
        return
      }
      void refreshOptimizeTemplates()
    }
  )

  // Watch selectedIterateTemplateId changes and update the selectedIterateTemplate object
  watch(
    () => selectedIterateTemplateId.value,
    () => {
      if (skipNextIterateRefresh) {
        skipNextIterateRefresh = false
        return
      }
      void refreshIterateTemplates()
    }
  )

  return {
    templateOptions,
    iterateTemplateOptions,
    selectedTemplateId,
    selectedIterateTemplateId,
    selectedTemplate,
    selectedIterateTemplate,
    refreshOptimizeTemplates,
    refreshIterateTemplates
  }
}
