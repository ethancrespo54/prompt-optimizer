<template>
  <div class="function-model-manager">
    <NSpace vertical :size="16">
      <!-- Evaluation model config -->
      <div class="config-section">
        <NSpace align="center" :size="8" class="section-header">
          <NText strong>{{ t('functionModel.evaluationModel') }}</NText>
        </NSpace>
        <NText depth="3" class="section-hint">
          {{ t('functionModel.evaluationModelHint') }}
        </NText>

        <NSpace align="center" :size="8" class="model-select-row">
          <SelectWithConfig
            v-model="evaluationModel"
            :options="modelOptions"
            :getPrimary="OptionAccessors.getPrimary"
            :getSecondary="OptionAccessors.getSecondary"
            :getValue="OptionAccessors.getValue"
            :placeholder="t('model.select.placeholder')"
            size="medium"
            filterable
            :show-config-action="true"
            :show-empty-config-c-t-a="true"
            class="model-select"
            @focus="refreshModels"
            @config="handleOpenModelManager"
            @update:model-value="handleModelChange"
          />
          <!-- Show the model source and model name tags -->
          <template v-if="selectedModelInfo">
            <NTag v-if="selectedModelInfo.provider" size="small" type="info">
              {{ selectedModelInfo.provider }}
            </NTag>
            <NTag v-if="selectedModelInfo.model" size="small">
              {{ selectedModelInfo.model }}
            </NTag>
          </template>
        </NSpace>
      </div>
    </NSpace>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject, onMounted, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NSpace, NText, NTag } from 'naive-ui'
import SelectWithConfig from './SelectWithConfig.vue'
import { useFunctionModelManager } from '../composables/model/useFunctionModelManager'
import { DataTransformer, OptionAccessors } from '../utils/data-transformer'
import type { AppServices } from '../types/services'
import type { ModelSelectOption } from '../types/select-options'

const { t } = useI18n()

// Get services
const services = inject<AppServices | Ref<AppServices | null>>('services')
if (!services) {
  throw new Error('[FunctionModelManager] services not provided')
}

// Inject the App layer's unified openModelManager interface (if present)
const appOpenModelManager = inject<
  ((tab?: 'text' | 'image' | 'function') => void) | null
>('openModelManager', null)

// Uniformly convert to Ref format
const servicesRef: Ref<AppServices | null> = 'value' in services
  ? (services as Ref<AppServices | null>)
  : ref(services as AppServices)

// Use the function model manager (singleton)
const functionModelManager = useFunctionModelManager(servicesRef)
const { evaluationModel, setEvaluationModel } = functionModelManager

// Model option list
const modelOptions = ref<ModelSelectOption[]>([])

// Get the details of the selected model (used for displaying tags)
const selectedModelInfo = computed(() => {
  if (!evaluationModel.value) return null
  const option = modelOptions.value.find(opt => opt.value === evaluationModel.value)
  if (!option?.raw) return null
  return {
    provider: option.raw.providerMeta?.name || null,
    model: option.raw.modelMeta?.id || null,
  }
})

const ensureInitializedIfSupported = async (manager: unknown) => {
  if (!manager || typeof manager !== 'object') return
  const m = manager as { ensureInitialized?: () => Promise<void> }
  if (typeof m.ensureInitialized === 'function') {
    await m.ensureInitialized()
  }
}

// Refresh the model list
const refreshModels = async () => {
  if (!servicesRef.value?.modelManager) {
    modelOptions.value = []
    return
  }

  try {
    const manager = servicesRef.value.modelManager
    await ensureInitializedIfSupported(manager)
    const enabledModels = await manager.getEnabledModels()
    modelOptions.value = DataTransformer.modelsToSelectOptions(enabledModels)
  } catch (error) {
    console.error('[FunctionModelManager] Failed to refresh models:', error)
    modelOptions.value = []
  }
}

// Handle model changes
const handleModelChange = async (
  newValue: string | number | (string | number)[] | null
) => {
  const nextValue = typeof newValue === 'string'
    ? newValue
    : Array.isArray(newValue)
      ? String(newValue[0] ?? '')
      : newValue === null
        ? ''
        : String(newValue)

  await setEvaluationModel(nextValue)
}

// Initialize
const initialize = async () => {
  await refreshModels()
  // Make sure the function model manager is initialized
  await functionModelManager.initialize()
}

// Open the model manager
const handleOpenModelManager = () => {
  // The evaluation model depends on the text model config: switch to the text tab first
  if (appOpenModelManager) {
    appOpenModelManager('text')
    return
  }

  // Fallback: if openModelManager is not injected, we can only try switching tabs and prompt the host to fill in the injection
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('model-manager:set-tab', { detail: 'text' }))
  }
  console.warn('[FunctionModelManager] openModelManager not provided by host app')
}

// Refresh
const refresh = async () => {
  await refreshModels()
  await functionModelManager.refresh()
}

onMounted(initialize)

defineExpose({ refresh })
</script>

<style scoped>
.function-model-manager {
  padding: 12px 0;
}

.config-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-header {
  margin-bottom: 4px;
}

.section-hint {
  font-size: 12px;
  margin-bottom: 8px;
}

.model-select-row {
  flex-wrap: wrap;
}

.model-select {
  min-width: 200px;
  flex: 1;
  max-width: 300px;
}
</style>
