<template>
  <NSelect
    :value="modelValue?.id || null"
    @update:value="handleTemplateSelect"
    :options="selectOptions"
    :placeholder="t('template.select')"
    :loading="!isReady"
    size="medium"
    @focus="handleFocus"
    filterable
  >
    <template #empty>
      <NSpace vertical align="center" class="py-4">
        <NText class="text-center text-gray-500">{{ t('template.noAvailableTemplates') }}</NText>
        <NButton 
          type="tertiary" 
          size="small" 
          @click="$emit('manage', props.type)" 
          class="w-full mt-2" 
          ghost 
        > 
          <template #icon> 
            <NText>📝</NText> 
          </template> 
          {{ t('template.configure') }} 
        </NButton>
      </NSpace>
    </template>
  </NSelect>
</template>

<script setup lang="ts">
import { ref, computed, watch, inject, type Ref } from 'vue'

import { useI18n } from 'vue-i18n'
import { NSelect, NButton, NSpace, NText } from 'naive-ui'
import type { OptimizationMode, Template, TemplateMetadata } from '@prompt-optimizer/core'
import type { AppServices } from '../types/services'

const { t } = useI18n()

type TemplateType = TemplateMetadata['templateType'];

const props = defineProps({
  modelValue: {
    type: Object as () => Template | null,
    default: null
  },
  type: {
    type: String as () => TemplateType,
    required: true,
    validator: (value: string): boolean => (
      ['optimize', 'userOptimize', 'text2imageOptimize', 'image2imageOptimize', 'imageIterate', 'iterate', 'conversationMessageOptimize', 'contextUserOptimize', 'contextIterate'] as string[]
    ).includes(value)
  },
  optimizationMode: {
    type: String as () => OptimizationMode,
    required: true
  },
  // Removed the services prop; inject is used uniformly
})

const emit = defineEmits<{
  'update:modelValue': [template: Template | null]
  'manage': [type: TemplateType]
  'select': [template: Template, showToast?: boolean]
}>()

const isReady = ref(false)

// Get services via inject; it must not be null
const services = inject<Ref<AppServices | null>>('services')
if (!services) {
  throw new Error('[TemplateSelect] services was not injected correctly; make sure services is provided in the App component')
}

// Get templateManager from services
const templateManager = computed(() => {
  const servicesValue = services.value
  if (!servicesValue) {
    throw new Error('[TemplateSelect] services is not initialized; make sure the app has started correctly')
  }

  const manager = servicesValue.templateManager
  if (!manager) {
    throw new Error('[TemplateSelect] templateManager is not initialized; make sure the services are configured correctly')
  }

  console.debug('[TemplateSelect] templateManager computed:', {
    hasServices: !!servicesValue,
    hasTemplateManager: !!manager,
    servicesKeys: Object.keys(servicesValue)
  })
  return manager
})

// Select options
const selectOptions = computed(() => {
  const templateOptions = templates.value.map(template => ({
    label: template.name,
    value: template.id,
    template: template,
    isBuiltin: template.isBuiltin,
    description: template.metadata.description || t('template.noDescription'),
    type: 'template'
  }))
  
  // If there are no templates, return an empty array so the placeholder shows
  if (templateOptions.length === 0) {
    return []
  }
  
  // Add the config button option
  const configOption = {
    label: '📝' + t('template.configure'),
    value: '__config__',
    type: 'config'
  }
  
  return [...templateOptions, configOption]
})

// Handle template selection
const handleTemplateSelect = (value: string | null) => {
  // If the config option is selected, do not update the value; trigger the config event directly
  if (value === '__config__') {
    emit('manage', props.type)
    return
  }
  
  const template = templates.value.find(t => t.id === value) || null
  if (template && template.id !== props.modelValue?.id) {
    emit('update:modelValue', template)
    emit('select', template, true)
  }
}

// Handle the focus event
const handleFocus = async () => {
  if (!isReady.value) {
    await ensureTemplateManagerReady()
    await loadTemplatesByType()
  }
}

// Make sure the template manager is ready
const ensureTemplateManagerReady = async () => {
  // The templateManager check is already done in the computed, so use it directly here
  isReady.value = true
  console.debug('[TemplateSelect] Template manager is ready')
  return true
}

// Changed to reactive data since it needs async loading
const templates = ref<Template[]>([])

// Load the template list asynchronously
const loadTemplatesByType = async () => {
  if (!isReady.value || !templateManager.value) {
    throw new Error('Template manager is not ready or not available')
  }

  // Use the async method uniformly and throw immediately without silently swallowing errors
  const typeTemplates = await templateManager.value.listTemplatesByType(props.type)
  templates.value.splice(0, templates.value.length, ...typeTemplates)
}

// Add a watcher for services changes
watch(
  () => services.value?.templateManager,
  async (newTemplateManager) => {
    if (newTemplateManager) {
      console.debug('[TemplateSelect] Detected a template manager change, starting initialization...')
      await ensureTemplateManagerReady()
      await loadTemplatesByType()
    } else {
      // Throw immediately without silently swallowing the error
      isReady.value = false
      templates.value.splice(0, templates.value.length)
      throw new Error('[TemplateSelect] Template manager is not available')
    }
  },
  { immediate: true, deep: true }
)

// Watch props.type changes and reload the templates
watch(
  () => props.type,
  async () => {
    if (isReady.value) {
      await loadTemplatesByType()
    } else {
      throw new Error('[TemplateSelect] Cannot load templates: manager not ready')
    }
  }
)

// Add a watcher for optimizationMode changes
watch(
  () => props.optimizationMode,
  (newOptimizationMode, oldOptimizationMode) => {
    if (newOptimizationMode !== oldOptimizationMode) {
      // When optimizationMode changes, silently refresh the template list (avoiding duplicate toasts)
      refreshTemplates()
    }
  }
)

// Add a watcher for template list changes
watch(
  templates,  // Watch the template list
  (newTemplates) => {
    const currentTemplate = props.modelValue
    // Only switch automatically when the template list has really changed and the current template is not in the new list
    if (currentTemplate && !newTemplates.find(t => t.id === currentTemplate.id)) {
      const firstTemplate = newTemplates.find(t => t.metadata.templateType === props.type) || null
      // Avoid duplicate triggers: only emit when there is an actual change
      if (firstTemplate && firstTemplate.id !== currentTemplate?.id) {
        emit('update:modelValue', firstTemplate)
        // Select silently without showing a toast
        emit('select', firstTemplate, false)
      }
    }
  },
  { deep: true }
)

/**
 * Deep-compare template content
 * Supports both string and Array<{role: string; content: string}> types
 * Fixes the array reference comparison problem found by BugBot
 */
const deepCompareTemplateContent = (content1: string | Array<{role: string; content: string}>, content2: string | Array<{role: string; content: string}>): boolean => {
  // Check that the types are the same
  if (typeof content1 !== typeof content2) {
    return false
  }
  
  // Compare string types directly
  if (typeof content1 === 'string') {
    return content1 === content2
  }
  
  // Deep-compare array types
  if (Array.isArray(content1) && Array.isArray(content2)) {
    if (content1.length !== content2.length) {
      return false
    }
    
    return content1.every((item1, index) => {
      const item2 = content2[index]
      return item1.role === item2.role && item1.content === item2.content
    })
  }
  
  // For other cases, compare using JSON serialization (fallback)
  return JSON.stringify(content1) === JSON.stringify(content2)
}

/**
 * Refresh the template list and the currently selected template
 * Responsibilities:
 * 1. Refresh the template list display
 * 2. Check whether the currently selected template needs updating (e.g. a language switch)
 * 3. Handle a template that no longer exists (automatically select the default template)
 */
const refreshTemplates = async () => {
  try {
    // Reload the template list
    await loadTemplatesByType()
    
    // Check whether the currently selected template is still valid
    const currentTemplate = props.modelValue
    if (currentTemplate && currentTemplate.isBuiltin) {
      // For built-in templates, re-fetch to make sure the language is correct
      try {
        const updatedTemplate = await templateManager.value?.getTemplate(currentTemplate.id)
        if (updatedTemplate && deepCompareTemplateContent(updatedTemplate.content, currentTemplate.content) === false) {
          // The template content has been updated (e.g. a language switch); notify the parent component
          emit('update:modelValue', updatedTemplate)
          emit('select', updatedTemplate, false) // Silent update, no toast
        }
      } catch (error) {
        console.warn('[TemplateSelect] Failed to get updated template:', error)
        // If fetching fails, try to select the first available template
        const availableTemplates = templates.value.filter(t => t.metadata.templateType === props.type)
        if (availableTemplates.length > 0) {
          emit('update:modelValue', availableTemplates[0])
          emit('select', availableTemplates[0], false) // Silent selection
        }
      }
    }
  } catch (error) {
    console.error('[TemplateSelect] Failed to refresh templates:', error)
  }
}

/**
 * Interface exposed to the parent component
 * 
 * refresh(): when external state changes (such as a language switch or a template management operation),
 * the parent component can call this method to notify the child component to refresh its data.
 * The child component checks for data changes and updates the parent state through v-model.
 * 
 * Division of responsibilities:
 * - Parent component: detects when a refresh is needed and calls refresh()
 * - Child component: runs the concrete refresh logic, manages its own state, and notifies the parent via events
 */
defineExpose({
  refresh: refreshTemplates
})
</script>

 
