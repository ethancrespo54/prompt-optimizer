<template>
  <NCard
    :bordered="false"
    class="output-display-core h-full  max-height: 100% "
    content-style="padding: 0; height: 100%; max-height: 100%; display: flex; flex-direction: column; overflow: hidden;"
    :data-testid="testId"
  >
    <NFlex vertical style="height: 100%; min-height: 0; overflow: hidden;">
      <!-- Unified top-level toolbar -->
      <NFlex v-if="hasToolbar" justify="space-between" align="center" style="flex: 0 0 auto;">
        <!-- Left: view control button group -->
        <NButtonGroup>
          <NButton 
            @click="internalViewMode = 'render'"
            :disabled="internalViewMode === 'render'"
            size="small"
            :type="internalViewMode === 'render' ? 'primary' : 'default'"
          >
            {{ t('common.render') }}
          </NButton>
          <NButton 
            @click="internalViewMode = 'source'"
            :disabled="internalViewMode === 'source'"
            size="small"
            :type="internalViewMode === 'source' ? 'primary' : 'default'"
          >
            {{ t('common.source') }}
          </NButton>
          <NButton 
            v-if="isActionEnabled('diff') && originalContent"
            @click="internalViewMode = 'diff'"
            :disabled="internalViewMode === 'diff' || !originalContent"
            size="small"
            :type="internalViewMode === 'diff' ? 'primary' : 'default'"
          >
            {{ t('common.compare') }}
          </NButton>
        </NButtonGroup>
        
        <!-- Right: action buttons -->
        <NFlex align="center" :size="8" :wrap="false">
          <slot name="toolbar-right-extra"></slot>
          <NButtonGroup>
          <NButton
            v-if="isActionEnabled('favorite')"
            @click="handleFavorite"
            size="small"
            quaternary
            circle
          >
            <template #icon>
              <NIcon>
                <Star />
              </NIcon>
            </template>
          </NButton>
          <NButton
            v-if="isActionEnabled('copy')"
            @click="handleCopy('content')"
            size="small"
            quaternary
            circle
          >
            <template #icon>
              <NIcon>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.03 1.125 0 1.13.094 1.976 1.057 1.976 2.192V7.5M8.25 7.5h7.5M8.25 7.5h-1.5a1.5 1.5 0 00-1.5 1.5v11.25c0 .828.672 1.5 1.5 1.5h10.5a1.5 1.5 0 001.5-1.5V9a1.5 1.5 0 00-1.5-1.5h-1.5" />
                </svg>
              </NIcon>
            </template>
          </NButton>
          <NButton
            v-if="isActionEnabled('fullscreen')"
            @click="handleFullscreen"
            size="small"
            quaternary
            circle
          >
            <template #icon>
              <NIcon>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </NIcon>
            </template>
          </NButton>
          </NButtonGroup>
        </NFlex>
      </NFlex>

      <!-- Reasoning content area -->
      <NFlex v-if="shouldShowReasoning" style="flex: 0 0 auto;">
        <NCollapse v-model:expanded-names="reasoningExpandedNames" style="width: 100%;">
          <NCollapseItem name="reasoning">
            <template #header>
              <NFlex justify="space-between" align="center" style="width: 100%;">
                <NText class="text-sm font-medium">
                  {{ t('common.reasoning') }}
                </NText>
                <NFlex v-if="isReasoningStreaming" align="center" :size="4">
                  <NSpin :size="12" />
                  <NText class="text-xs">{{ t('common.generating') }}</NText>
                </NFlex>
              </NFlex>
            </template>
            
            <NScrollbar class="reasoning-content" ref="reasoningContentRef" style="max-height: clamp(160px, 28vh, 360px); overflow: auto;">
              <MarkdownRenderer
                v-if="displayReasoning"
                :content="displayReasoning"
                :streaming="streaming"
                :disableInternalScroll="true"
                class="prose-sm max-w-none px-3 py-2"
              />
              <NSpace v-else-if="streaming" class="text-gray-500 text-sm italic px-3 py-2">
                <NText>{{ t('common.generatingReasoning') }}</NText>
              </NSpace>
            </NScrollbar>
          </NCollapseItem>
        </NCollapse>
      </NFlex>
      <!-- Main content area -->
      <NFlex vertical style="flex: 1; min-height: 0; max-height: 100%; overflow: hidden;">
        <!-- Compare mode -->
        <TextDiffUI v-if="internalViewMode === 'diff' && content && originalContent"
          :originalText="originalContent"
          :optimizedText="content"
          :compareResult="compareResult"
          class="w-full"
          style="height: 100%; min-height: 0; overflow: auto;"
        />

        <!-- Original text mode -->
        <template v-if="internalViewMode === 'source'">
          <!-- 🆕 Pro mode: uses the variable-aware input -->
          <VariableAwareInput
            v-if="shouldEnableVariables && variableData"
            :model-value="content"
            @update:model-value="handleSourceInput"
            :readonly="mode !== 'editable' || streaming"
            :placeholder="placeholder"
            :autosize="true"
            v-bind="variableData"
            @variable-extracted="handleVariableExtracted"
            @add-missing-variable="handleAddMissingVariable"
            style="height: 100%; min-height: 0;"
          />

          <!-- Basic/Image mode: uses a regular input -->
          <NInput
            v-else
            :value="content"
            @input="handleSourceInput"
            :readonly="mode !== 'editable' || streaming"
            type="textarea"
            :placeholder="placeholder"
            :autosize="{ minRows: 10 }"
            style="height: 100%; min-height: 0;"
          />
        </template>

        <!-- Render mode (default) -->
        <NFlex v-else
          vertical
          :align="displayContent ? 'stretch' : 'center'"
          :justify="displayContent ? 'start' : 'center'"
          style="flex: 1; min-height: 0; overflow: hidden;"
        >
          <MarkdownRenderer
            v-if="displayContent"
            :content="displayContent"
            :streaming="streaming"
            style="flex: 1; min-height: 0; overflow: auto;"
          />
          <NEmpty
            v-else-if="!loading && !streaming"
            :description="placeholder || t('common.noContent')"
            class="flex items-center justify-center"
            style="height: 100%;"
          />
          <NText  v-else class="ml-2">{{ placeholder || t('common.loading') }}</NText>
        </NFlex>
      </NFlex>
  
    </NFlex>
  </NCard>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted, inject, type Ref } from 'vue'

import { useI18n } from 'vue-i18n'
import {
  NCard, NButton, NButtonGroup, NIcon, NCollapse, NCollapseItem,
  NInput, NEmpty, NSpin, NScrollbar, NFlex, NText, NSpace
} from 'naive-ui'
import { useToast } from '../composables/ui/useToast'
import { Star } from '@vicons/tabler'
import { useClipboard } from '../composables/ui/useClipboard'
import MarkdownRenderer from './MarkdownRenderer.vue'
import TextDiffUI from './TextDiff.vue'
import type { CompareResult, ICompareService } from '@prompt-optimizer/core'
import { VariableAwareInput } from './variable-extraction'
import { useTemporaryVariables } from '../composables/variable/useTemporaryVariables'
import { useVariableAwareInputBridge } from '../composables/variable/useVariableAwareInputBridge'
import { useVariableManager } from '../composables/prompt/useVariableManager'
import type { AppServices } from '../types/services'
import { router as routerInstance } from '../router'

type ActionName = 'fullscreen' | 'diff' | 'copy' | 'edit' | 'reasoning' | 'favorite'

const { t } = useI18n()
const { copyText } = useClipboard()

const message = useToast()

// 🆕 Inject services (for variable management)
const services = inject<Ref<AppServices | null>>('services') ?? ref<AppServices | null>(null)

// Favorite state management removed (now handled by the parent component)

// Component props
interface Props {
  // Content-related
  content?: string
  originalContent?: string
  reasoning?: string

  /** data-testid for E2E/test targeting (attached to the component root node) */
  testId?: string
  
  // Display mode
  mode: 'readonly' | 'editable'
  reasoningMode?: 'show' | 'hide' | 'auto'
  
  // Feature toggles
  enabledActions?: ActionName[]
  
  // Style config
  height?: string | number
  placeholder?: string
  
  // State
  loading?: boolean
  streaming?: boolean
  
  // Services
  compareService?: ICompareService
}

const props = withDefaults(defineProps<Props>(), {
  content: '',
  originalContent: '',
  reasoning: '',
  testId: undefined,
  mode: 'readonly',
  reasoningMode: 'auto',
  enabledActions: () => ['fullscreen', 'diff', 'copy', 'edit', 'reasoning', 'favorite'],
  height: '100%',
  placeholder: ''
})

const testId = computed(() => props.testId || undefined)

// Event definitions
const emit = defineEmits<{
  'update:content': [content: string]
  'update:reasoning': [reasoning: string]
  'copy': [content: string, type: 'content' | 'reasoning' | 'all']
  'fullscreen': []
  'edit-start': []
  'edit-end': []
  'reasoning-toggle': [expanded: boolean]
  'view-change': [mode: 'base' | 'diff']
  'save-favorite': [data: { content: string; originalContent?: string }]
}>()

// 🆕 Variable management (Pro / Image mode)
// The current architecture treats the router as the single source of truth; do not rely on the legacy Preference-based functionMode.
const routeFunctionMode = computed<'basic' | 'pro' | 'image'>(() => {
  const path = routerInstance.currentRoute.value.path || ''
  if (path.startsWith('/pro')) return 'pro'
  if (path.startsWith('/image')) return 'image'
  return 'basic'
})

const shouldEnableVariables = computed(() => routeFunctionMode.value === 'pro' || routeFunctionMode.value === 'image')

// ==================== Variable management composables ====================
// Temporary variable manager (global singleton)
const tempVars = useTemporaryVariables()

// ✅ Called unconditionally; the composable waits internally for services.preferenceService to be ready
const globalVarsManager = useVariableManager(services)

const {
  variableInputData: variableData,
  handleVariableExtracted,
  handleAddMissingVariable,
} = useVariableAwareInputBridge({
  enabled: shouldEnableVariables,
  isReady: globalVarsManager.isReady,
  globalVariables: globalVarsManager.customVariables,
  temporaryVariables: tempVars.temporaryVariables,
  allVariables: globalVarsManager.allVariables,
  saveGlobalVariable: (name, value) => globalVarsManager.addVariable(name, value),
  saveTemporaryVariable: (name, value) => tempVars.setVariable(name, value),
  logPrefix: 'OutputDisplayCore',
})

// Internal state
type ScrollbarLike = {
  scrollTo: (options: { top: number; behavior?: ScrollBehavior }) => void
}

const reasoningContentRef = ref<ScrollbarLike | null>(null)
const userHasManuallyToggledReasoning = ref(false)

// New view state machine
const internalViewMode = ref<'render' | 'source' | 'diff'>('render')
const EMPTY_COMPARE_RESULT: CompareResult = {
  fragments: [],
  summary: { additions: 0, deletions: 0, unchanged: 0 },
}
const compareResult = ref<CompareResult>(EMPTY_COMPARE_RESULT)

// Reasoning collapse panel state
const reasoningExpandedNames = ref<string[]>([])

const isActionEnabled = (action: ActionName) => props.enabledActions.includes(action)

const hasToolbar = computed(() =>
  ['diff', 'copy', 'fullscreen', 'edit'].some(action => isActionEnabled(action as ActionName))
)

// Computed properties
const displayContent = computed(() => (props.content || '').trim())
const displayReasoning = computed(() => (props.reasoning || '').trim())

const hasContent = computed(() => !!displayContent.value)
const hasReasoning = computed(() => !!displayReasoning.value)

const isReasoningStreaming = computed(() => {
  return props.streaming && hasReasoning.value && !hasContent.value
})

const shouldShowReasoning = computed(() => {
  if (!isActionEnabled('reasoning')) return false
  if (props.reasoningMode === 'hide') return false
  if (props.reasoningMode === 'show') return true
  return hasReasoning.value
})

// Computed property for the reasoning expanded/collapsed state
const isReasoningExpanded = computed({
  get: () => reasoningExpandedNames.value.includes('reasoning'),
  set: (expanded: boolean) => {
    if (expanded) {
      reasoningExpandedNames.value = ['reasoning']
    } else {
      reasoningExpandedNames.value = []
    }
    emit('reasoning-toggle', expanded)
  }
})

// Handle input in original text mode
const handleSourceInput = (value: string) => {
  emit('update:content', value)
}

// Copy feature
const handleCopy = (type: 'content' | 'reasoning' | 'all') => {
  let textToCopy = ''
  const emitType: 'content' | 'reasoning' | 'all' = type
  
  switch (type) {
    case 'content':
      textToCopy = displayContent.value
      break
    case 'reasoning':
      textToCopy = displayReasoning.value
      break
    case 'all':
      textToCopy = [
        displayReasoning.value && `Reasoning:\n${displayReasoning.value}`,
        `Main content:\n${displayContent.value}`
      ].filter(Boolean).join('\n\n')
      break
  }
  
  if (textToCopy) {
    copyText(textToCopy)
    emit('copy', textToCopy, emitType)
  }
}

// Fullscreen feature
const handleFullscreen = () => {
  emit('fullscreen')
}

const scrollReasoningToBottom = () => {
  if (reasoningContentRef.value) {
    nextTick(() => {
      if (reasoningContentRef.value) {
        reasoningContentRef.value.scrollTo({
          top: 999999, // Scroll to the bottom
          behavior: 'smooth'
        })
      }
    })
  }
}

// Compare feature
const updateCompareResult = async () => {
  if (internalViewMode.value === 'diff' && props.originalContent && props.content) {
    try {
      const compareService = props.compareService ?? services.value?.compareService
      if (!compareService) throw new Error('CompareService not available')

      compareResult.value = await compareService.compareTexts(
        props.originalContent,
        props.content
      )
    } catch (error) {
      console.error('[OutputDisplayCore] Error calculating diff:', error)
      message.warning(t('toast.warning.compareFailed'))
      compareResult.value = EMPTY_COMPARE_RESULT
    }
  } else {
    compareResult.value = EMPTY_COMPARE_RESULT
  }
}

// Smart auto-switch logic
const previousViewMode = ref<'render' | 'source' | 'diff' | null>(null)

watch(() => props.streaming, (isStreaming, wasStreaming) => {
  if (isStreaming && !wasStreaming) {
    // A new task starts; reset the user memory
    userHasManuallyToggledReasoning.value = false
  } else if (!isStreaming && wasStreaming) {
    // When the task ends, if the user has not intervened and the reasoning area is still expanded, collapse it automatically
    if (!userHasManuallyToggledReasoning.value && isReasoningExpanded.value) {
      isReasoningExpanded.value = false
    }
  }

  if (isStreaming) {
    // Remember the current mode and force a switch to original text mode
    if (internalViewMode.value !== 'source') {
      previousViewMode.value = internalViewMode.value
      internalViewMode.value = 'source'
    }
  } else {
    // After streaming ends, restore the previous mode
    if (previousViewMode.value) {
      internalViewMode.value = previousViewMode.value
      previousViewMode.value = null
    }
  }
})

watch(internalViewMode, updateCompareResult, { immediate: true })
watch(() => [props.content, props.originalContent], () => {
  if (internalViewMode.value === 'diff') {
    updateCompareResult()
  }
})

watch(() => props.reasoning, (newReasoning, oldReasoning) => {
  // When reasoning content goes from none to some and the user has not intervened manually, expand automatically
  if (newReasoning && !oldReasoning && !userHasManuallyToggledReasoning.value) {
    isReasoningExpanded.value = true
  }
  
  // If the reasoning process is expanded and has new content, scroll to the bottom
  if (isReasoningExpanded.value && newReasoning) {
    scrollReasoningToBottom()
  }
}, { flush: 'post' })

watch(() => props.content, (newContent, oldContent) => {
  // When main content starts streaming, if the user has not intervened, collapse the reasoning process automatically
  const mainContentJustStarted = newContent && !oldContent
  if (props.streaming && mainContentJustStarted && !userHasManuallyToggledReasoning.value) {
    isReasoningExpanded.value = false
  }
})

// Watch reasoning collapse state changes
watch(reasoningExpandedNames, (newNames) => {
  const expanded = newNames.includes('reasoning')
  if (expanded !== isReasoningExpanded.value) {
    userHasManuallyToggledReasoning.value = true
  }
})

// Expose methods to the parent component
const resetReasoningState = (initialState: boolean) => {
  isReasoningExpanded.value = initialState
  userHasManuallyToggledReasoning.value = false
}

const forceExitEditing = () => {
  // In Pro/Image (variable-enabled) workspaces, keep source view as the default
  // to preserve variable highlighting instead of flipping back to Markdown.
  if (shouldEnableVariables.value) return

  internalViewMode.value = 'render'
}

const forceRefreshContent = () => {
  // This method is no longer needed in V2, but is kept to ensure backward compatibility
}

// Favorite-related methods - trigger the save dialog rather than saving directly
const handleFavorite = () => {
  if (!props.content) {
    message.warning('No content to favorite');
    return;
  }

  // Trigger the save favorite event; the parent component opens the save dialog
  emit('save-favorite', {
    content: props.content,
    originalContent: props.originalContent
  });
};

// Set the initial view mode when the component mounts
onMounted(() => {
  // ⚠️ Do not initialize functionMode here
  // Reason: useFunctionMode is a global singleton and should not have its initialization timing controlled by a single component
  // - If services are not ready, initialization fails but is still marked as done, leaving it stuck on 'basic' permanently
  // - It should be initialized uniformly at the application level (such as App.vue)
  // - functionMode has a default value of 'basic' and works normally

  // In editable mode, show the original text by default
  if (props.mode === 'editable') {
    internalViewMode.value = 'source';
  }
});

// Watch mode changes and switch the view mode automatically
watch(() => props.mode, (newMode) => {
  if (newMode === 'editable' && internalViewMode.value === 'render') {
    internalViewMode.value = 'source';
  } else if (newMode === 'readonly' && internalViewMode.value === 'source') {
    internalViewMode.value = 'render';
  }
});

defineExpose({ resetReasoningState, forceRefreshContent, forceExitEditing })
</script>
