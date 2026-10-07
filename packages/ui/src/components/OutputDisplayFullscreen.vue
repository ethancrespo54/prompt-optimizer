<template>
  <FullscreenDialog v-model="internalVisible" :title="title || t('common.content')">
    <NFlex vertical :wrap="false" style="flex: 1; min-height: 0; overflow: hidden;">
      <NFlex vertical :wrap="false" style="flex: 1; min-height: 0; overflow: hidden;">
        <OutputDisplayCore
            ref="coreDisplayRef"
            :content="internalContent"
            :originalContent="originalContent"
            :reasoning="reasoning"
            :mode="mode"
            :reasoningMode="reasoningMode"
            :enabledActions="coreEnabledActions"
            height="100%"
            :placeholder="placeholder"
            :loading="loading"
            :streaming="streaming"
            :compareService="compareService"
            @update:content="handleContentUpdate"
            @copy="handleCopy"
        />
      </NFlex>

      <NDivider v-if="$slots['extra-content']" style="margin: 12px 0 8px;" />

      <NScrollbar
        v-if="$slots['extra-content']"
        style="flex: 0 0 auto; max-height: 42%;"
      >
        <slot name="extra-content" />
      </NScrollbar>
    </NFlex>
  </FullscreenDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch, inject, nextTick, type Ref } from 'vue'

import { useI18n } from 'vue-i18n'
import { NDivider, NFlex, NScrollbar } from 'naive-ui'
import FullscreenDialog from './FullscreenDialog.vue'
import OutputDisplayCore from './OutputDisplayCore.vue'
import type { AppServices } from '../types/services';

const { t } = useI18n()

// Props
interface Props {
  modelValue: boolean
  content?: string
  originalContent?: string
  reasoning?: string
  title?: string
  mode: 'readonly' | 'editable'
  reasoningMode?: 'show' | 'hide' | 'auto'
  enabledActions?: ('fullscreen' | 'diff' | 'copy' | 'edit' | 'reasoning' | 'favorite')[]
  streaming?: boolean
  loading?: boolean
  placeholder?: string
}
const props = withDefaults(defineProps<Props>(), {
  content: '',
  originalContent: '',
  reasoning: '',
  title: '',
  mode: 'readonly',
  reasoningMode: 'auto',
  enabledActions: () => ['diff', 'copy', 'edit', 'reasoning', 'favorite'],
  placeholder: ''
})

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:content': [content: string]
  'copy': [content: string, type: 'content' | 'reasoning' | 'all']
}>()


// Inject services and get CompareService
const services = inject<Ref<AppServices | null>>('services');
if (!services) {
  throw new Error('[OutputDisplayFullscreen] services was not injected correctly; make sure services is provided in the App component');
}

const compareService = computed(() => {
  const servicesValue = services.value;
  if (!servicesValue) {
    throw new Error('[OutputDisplayFullscreen] services is not initialized; make sure the app has started correctly');
  }

  const service = servicesValue.compareService;
  if (!service) {
    throw new Error('[OutputDisplayFullscreen] compareService is not initialized; make sure the services are configured correctly');
  }

  return service;
});

// Internal state
const coreDisplayRef = ref<InstanceType<typeof OutputDisplayCore> | null>(null)
const internalVisible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const coreEnabledActions = computed(() => {
  // The fullscreen view only needs to remove fullscreen (to avoid recursive fullscreen)
  // The diff feature is kept: when originalContent exists, OutputDisplayCore shows the compare button
  return props.enabledActions?.filter(action => action !== 'fullscreen')
})

const internalContent = ref(props.content)
// const isFullscreenReasoningExpanded = ref(true)  // Kept for future extension

watch(() => props.content, (newVal) => {
  internalContent.value = newVal
})

// Sync back changes when dialog closes
watch(internalVisible, (newVal) => {
  if (newVal) {
    // Dialog is opening, decide the initial state of the reasoning panel.
    const hasMainContent = !!props.content;
    // Main content is loading if streaming has started AND there's some content already.
    const isMainContentLoading = props.loading || (props.streaming && hasMainContent);

    const shouldReasoningBeExpanded = !(hasMainContent || isMainContentLoading);

    nextTick(() => {
      coreDisplayRef.value?.resetReasoningState(shouldReasoningBeExpanded)
    })
  } else {
    // Dialog is closing
    if (props.content !== internalContent.value) {
      emit('update:content', internalContent.value || '')
    }
  }
})

// Methods
const handleContentUpdate = (newContent: string) => {
    internalContent.value = newContent
}

const handleCopy = (content: string, type: 'content' | 'reasoning' | 'all') => {
  emit('copy', content, type)
}

</script> 
