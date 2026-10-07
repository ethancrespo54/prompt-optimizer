import { ref, computed, watch, type Ref } from 'vue'
import type { ComposerTranslation } from 'vue-i18n'

/**
 * ContextEditor UI state management composable
 * Manages the editor's display mode, title, and state in one place
 */
export function useContextEditorUIState(
  showContextEditor: Ref<boolean>,
  t: ComposerTranslation
) {
  // Show-only-the-specified-tab mode (hides the other tabs and the tab bar)
  const onlyShowTab = ref<'messages' | 'variables' | 'tools' | undefined>(undefined)

  // Dynamically compute the editor title based on onlyShowTab
  const title = computed(() => {
    if (!onlyShowTab.value) {
      return t('contextEditor.title')
    }

    const tab = onlyShowTab.value
    const titleMap: Record<string, string> = {
      messages: t('contextEditor.messagesTab'),
      variables: t('contextEditor.variablesTab'),
      tools: t('contextEditor.toolsTab'),
    }

    return titleMap[tab] || t('contextEditor.title')
  })

  // Watch the editor's display state and reset onlyShowTab when it closes
  watch(showContextEditor, (visible) => {
    if (!visible) {
      onlyShowTab.value = undefined
    }
  })

  // Cancel handler: close the editor and reset the state
  const handleCancel = () => {
    showContextEditor.value = false
    onlyShowTab.value = undefined
  }

  // Open the specified-tab mode
  const openWithTab = (tab: 'messages' | 'variables' | 'tools') => {
    onlyShowTab.value = tab
  }

  // Reset to normal mode (show all tabs)
  const resetToNormalMode = () => {
    onlyShowTab.value = undefined
  }

  return {
    onlyShowTab,
    title,
    handleCancel,
    openWithTab,
    resetToNormalMode,
  }
}
