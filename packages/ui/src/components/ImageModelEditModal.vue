<template>
  <NModal
    :show="show"
    preset="card"
    :title="isEditing ? t('modelManager.editModel') : t('modelManager.addImageModel')"
    :style="{ width: '80vw', maxWidth: '820px' }"
    size="large"
    :bordered="false"
    :segmented="true"
    @update:show="(value) => !value && close()"
  >
    <form @submit.prevent="save">
        <NForm label-placement="left" label-width="auto" size="small">
          <!-- Basic info section -->
          <NFormItem :label="t('image.config.displayName.label')">
            <NInput v-model:value="configForm.name" :placeholder="t('image.config.displayName.placeholder')" required />
          </NFormItem>

          <NFormItem :label="t('image.config.enabledStatus.label')">
            <NCheckbox v-model:checked="configForm.enabled"></NCheckbox>
          </NFormItem>

          <!-- Provider config section -->
          <NDivider style="margin: 12px 0 8px 0;" />
          <NH4 style="margin: 0 0 12px 0; font-size: 14px;">{{ t('image.provider.section') }}</NH4>

          <NFormItem :label="t('image.provider.label')">
            <NSelect
              v-model:value="configForm.providerId"
              :options="providerOptions"
              :placeholder="t('image.provider.placeholder')"
              :loading="isLoadingProviders"
              @update:value="onProviderChange"
              required
            />
          </NFormItem>


          <!-- Dynamic connection config fields -->
          <NFormItem v-for="field in connectionFields" :key="field.name" :label="t(field.labelKey)">
            <template v-if="field.name === 'apiKey'" #label>
              <NSpace align="center" :size="4">
                <span>{{ t(field.labelKey) }}</span>
                <NButton
                  v-if="currentProviderApiKeyUrl"
                  text
                  size="tiny"
                  type="primary"
                  tag="a"
                  :href="currentProviderApiKeyUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  style="padding: 0 4px;"
                  :title="t('modelManager.getApiKey')"
                >
                  <template #icon>
                    <ExternalLinkIcon />
                  </template>
                </NButton>
              </NSpace>
            </template>

            <template v-if="field.type === 'string'">
              <NInput
                v-model:value="configForm.connectionConfig![field.name]"
                :type="field.name.toLowerCase().includes('key') ? 'password' : 'text'"
                :placeholder="field.placeholder"
                :required="field.required"
                :autocomplete="field.name.toLowerCase().includes('key') ? 'new-password' : 'on'"
                @update:value="onConnectionConfigChange"
              />
            </template>
            <template v-else-if="field.type === 'number'">
              <NInputNumber
                v-model:value="configForm.connectionConfig![field.name]"
                :placeholder="field.placeholder"
                :required="field.required"
                @update:value="onConnectionConfigChange"
              />
            </template>
            <template v-else-if="field.type === 'boolean'">
              <NCheckbox
                v-model:checked="configForm.connectionConfig![field.name]"
                @update:checked="onConnectionConfigChange"
              >
                {{ t(field.descriptionKey) }}
              </NCheckbox>
            </template>
          </NFormItem>

          <!-- Proxy config is rendered dynamically through connectionFields and filtered by availability, no longer rendered separately -->

          <!-- Model config section -->
          <NDivider style="margin: 12px 0 8px 0;" />
          <NH4 style="margin: 0 0 12px 0; font-size: 14px;">{{ t('image.model.section') }}</NH4>

          <NFormItem :label="t('image.model.label')">
            <NSpace align="center" style="width: 100%;">
              <NSelect
                v-model:value="configForm.modelId"
                :options="modelOptions"
                :placeholder="t('image.model.placeholder')"
                :loading="isLoadingModels"
                style="flex: 1; min-width: 300px; max-width: 500px;"
                clearable
                filterable
                :filter="(pattern, option) => {
                  const label = typeof option.label === 'string' ? option.label : String(option.value)
                  const value = String(option.value)
                  return label.toLowerCase().includes(pattern.toLowerCase()) || value.toLowerCase().includes(pattern.toLowerCase())
                }"
                tag
                required
                @update:value="handleModelChange"
              />

              <NTooltip :disabled="canRefreshModels" :show-arrow="false">
                <template #trigger>
                  <NButton
                    @click="refreshModels"
                    :loading="isLoadingModels"
                    :disabled="!canRefreshModels"
                    circle
                    secondary
                    type="primary"
                    size="small"
                    style="flex-shrink: 0;"
                  >
                    <template #icon>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;">
                        <polyline points="23 4 23 10 17 10"/>
                        <polyline points="1 20 1 14 7 14"/>
                        <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
                      </svg>
                    </template>
                  </NButton>
                </template>
                {{ refreshButtonTooltip }}
              </NTooltip>
            </NSpace>
          </NFormItem>


          <!-- Capability tags of the selected model - simplified to a single row -->
          <NFormItem v-if="selectedModel" :label="t('image.model.capabilities')">
            <NSpace wrap>
              <NTag v-if="selectedModel.capabilities?.text2image" type="success" size="small" :bordered="false">
                {{ t('image.capability.text2image') }}
              </NTag>
              <NTag v-if="selectedModel.capabilities?.image2image" type="info" size="small" :bordered="false">
                {{ t('image.capability.image2image') }}
              </NTag>
              <NTag v-if="(selectedModel.capabilities as any)?.highResolution" type="primary" size="small" :bordered="false">
                {{ t('image.capability.highResolution') }}
              </NTag>
            </NSpace>
          </NFormItem>

          <!-- Advanced parameter config section -->
          <NDivider style="margin: 12px 0 8px 0;" />
          <ModelAdvancedSection
            mode="image"
            :provider-type="selectedProviderId"
            :parameter-definitions="currentParameterDefinitions"
            :param-overrides="configForm.paramOverrides"
            @update:paramOverrides="updateParamOverrides"
          />
        </NForm>
    </form>

    <template #action>
      <NSpace justify="space-between" align="center" style="width: 100%;">
        <!-- Left: connection test -->
        <NSpace align="center">
          <NButton
            @click="handleTestConnection"
            :loading="isTestingConnection"
            :disabled="!canTestConnection"
            secondary
            type="info"
            size="small"
          >
            <template #icon>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
            </template>
            {{ t('image.connection.test') }}
          </NButton>

          <NTag
            v-if="connectionStatus"
            :type="connectionStatus.type as 'success' | 'error' | 'info' | 'warning' | 'default'"
            :bordered="false"
            size="small"
          >
            {{ t(connectionStatus.messageKey) }}
            <span v-if="testResult?.testType" style="margin-left: 4px;">
              ({{ t(testResult.testType === 'image2image' ? 'image.connection.functionTestImageToImage' : 'image.connection.functionTestTextToImage') }})
            </span>
          </NTag>

          <!-- Test result image thumbnails -->
          <NImage
            v-if="testResult?.image && connectionStatus?.type === 'success'"
            :src="testResult.image.url || (testResult.image.b64?.startsWith('data:') ? testResult.image.b64 : `data:image/png;base64,${testResult.image.b64}`)"
            width="32"
            height="32"
            object-fit="cover"
            :style="{ borderRadius: '4px', border: '1px solid #d9d9d9' }"
            :preview-disabled="false"
            :alt="t('image.connection.testImagePreview')"
          />
        </NSpace>

        <!-- Right: cancel/save buttons -->
        <NSpace>
          <NButton @click="close">{{ t('common.cancel') }}</NButton>
          <NButton type="primary" @click="save" :loading="isSaving" :disabled="!canSave">
            {{ isEditing ? t('common.update') : t('common.save') }}
          </NButton>
        </NSpace>
      </NSpace>

      <!-- Detailed connection status info is shown below the button area -->
      <NText v-if="connectionStatus?.detail" depth="3" style="font-size: 12px; margin-top: 8px; display: block;">
        {{ connectionStatus.detail }}
      </NText>
    </template>
  </NModal>
</template>

<script setup lang="ts">
import { computed, watch, nextTick, h } from 'vue'

import { useI18n } from 'vue-i18n'
import {
  NModal, NSpace, NInput, NInputNumber,
  NCheckbox, NSelect, NButton, NTag, NTooltip, NText,
  NDivider, NH4, NForm, NFormItem, NImage, useDialog
} from 'naive-ui'
import { useImageModelManager } from '../composables/model/useImageModelManager'
import { useToast } from '../composables/ui/useToast'
import { isRunningInElectron, type ImageModelConfig } from '@prompt-optimizer/core'
import ModelAdvancedSection from './ModelAdvancedSection.vue'
import ExternalLinkIcon from './icons/ExternalLinkIcon.vue'


const { t } = useI18n()
const toast = useToast()
const dialog = useDialog()

// Props
const props = defineProps<{
  show: boolean
  configId?: string
}>()

// Emits
const emit = defineEmits<{
  'update:show': [value: boolean]
  'saved': []
}>()

// Use composables
const {
  // data
  providers,
  models,
  configs,
  selectedProviderId,
  selectedModelId,
  configForm,

  // UI state
  isLoadingModels,
  isLoadingProviders,
  isTestingConnection,
  isSaving,
  connectionStatus,
  testResult,
  modelLoadingStatus,

  // computed helpers
  selectedProvider,
  selectedModel,
  currentParameterDefinitions,
  isConnectionConfigured,
  canTestConnection,
  canRefreshModels,

  // methods
  onProviderChange: handleProviderChange,
  onConnectionConfigChange,
  onModelChange,
  testConnection: performTestConnection,
  refreshModels: handleRefreshModels,
  updateParamOverrides,
  saveConfig,
  loadConfigs,
  loadProviders,
} = useImageModelManager()

// Computed properties
const isEditing = computed(() => !!props.configId)

// Get the API key URL of the currently selected Provider
const currentProviderApiKeyUrl = computed(() => {
  return selectedProvider.value?.apiKeyUrl || null
})

const handleTestConnection = async () => {
  const runTest = async () => {
    await performTestConnection()
  }

  if (!isRunningInElectron()) {
    if (selectedProvider.value?.corsRestricted) {
      const providerName = selectedProvider.value.name || selectedProvider.value.id || 'Unknown'
      dialog.warning({
        title: t('modelManager.corsRestrictedTag'),
        content: () => h('div', { style: 'white-space: pre-line;' }, t('modelManager.corsRestrictedConfirm', { provider: providerName })),
        positiveText: t('common.confirm'),
        negativeText: t('common.cancel'),
        // Don't block dialog close while the async test runs.
        onPositiveClick: () => {
          void runTest()
        }
      })
      return
    }
  }
  await runTest()
}

const providerOptions = computed(() =>
  providers.value.map(p => ({
    label: p.name,
    value: p.id,
    disabled: false
  }))
)

const modelOptions = computed(() =>
  models.value.map(m => ({
    label: m.id,
    value: m.id,
    disabled: false
  }))
)

const connectionFields = computed(() => {
  if (!selectedProvider.value?.connectionSchema) return []

  const schema = selectedProvider.value.connectionSchema

  interface ConnectionField {
    name: string
    required: boolean
    type: string
    labelKey: string
    descriptionKey: string
    placeholder: string
  }

  const fields: ConnectionField[] = []

  // Handle required fields
  for (const fieldName of schema.required) {
    fields.push({
      name: fieldName,
      required: true,
      type: schema.fieldTypes[fieldName] || 'string',
      labelKey: `image.connection.${fieldName}.label`,
      descriptionKey: `image.connection.${fieldName}.description`,
      placeholder: t(`image.connection.${fieldName}.placeholder`)
    })
  }

  // Handle optional fields
  for (const fieldName of schema.optional) {
    fields.push({
      name: fieldName,
      required: false,
      type: schema.fieldTypes[fieldName] || 'string',
      labelKey: `image.connection.${fieldName}.label`,
      descriptionKey: `image.connection.${fieldName}.description`,
      placeholder: fieldName === 'baseURL'
        ? selectedProvider.value.defaultBaseURL
        : t(`image.connection.${fieldName}.placeholder`)
    })
  }

  return fields
})

const refreshButtonTooltip = computed(() => {
  if (canRefreshModels.value) {
    return t('image.model.refreshTooltip')
  }

  if (!selectedProvider.value?.supportsDynamicModels) {
    return t('image.model.refreshDisabledTooltip.dynamicNotSupported')
  }

  if (!isConnectionConfigured.value) {
    return t('image.model.refreshDisabledTooltip.connectionRequired')
  }

  return ''
})

const canSave = computed(() => {
  return configForm.value.name &&
         configForm.value.providerId &&
         configForm.value.modelId &&
         isConnectionConfigured.value
})

// Methods
const close = () => {
  emit('update:show', false)
  resetFormData()
}

const resetFormData = () => {
  configForm.value = {
    id: '',
    name: '',
    providerId: '',
    modelId: '',
    enabled: true,
    connectionConfig: {},
    paramOverrides: {}
  }
  connectionStatus.value = null
  testResult.value = null
  modelLoadingStatus.value = null
}

const onProviderChange = async (providerId: string, autoSelectFirstModel?: boolean) => {
  await handleProviderChange(providerId, autoSelectFirstModel)
}

const refreshModels = async () => {
  if (!canRefreshModels.value) return

  modelLoadingStatus.value = { type: 'info', messageKey: 'image.model.loading' }

  try {
    await handleRefreshModels()
    modelLoadingStatus.value = {
      type: 'success',
      messageKey: 'image.model.refreshSuccess',
      count: models.value.length
    }
    toast.success(t('image.model.refreshSuccess'))
  } catch (_error) {
    modelLoadingStatus.value = { type: 'error', messageKey: 'image.model.refreshError' }
    toast.error(t('image.model.refreshError'))
  } finally {
    // The composable manages isLoadingModels
  }
}

// Handle model changes: whether creating or editing, switching the model applies the new model's default parameters
// (edit mode merges parameters and keeps the user's existing config; create mode replaces the parameters)
const handleModelChange = (modelId: string) => {
  onModelChange(modelId)
}

const save = async () => {
  if (!canSave.value) return

  try {
    await saveConfig()
    toast.success(isEditing.value ? t('image.config.updateSuccess') : t('image.config.createSuccess'))
    emit('saved')
    close()
  } catch (_error) {
    console.error('Failed to save config:', _error)
    toast.error(t('image.config.saveFailed'))
  }
}

// Watch props changes
watch(() => props.show, async (newShow) => {
  if (newShow) {
    // Prepare data when opened
    try {
      // Make sure the provider data is up to date (refreshed on every open)
      await loadProviders()
      await loadConfigs()
      if (props.configId) {
        const existing = configs.value.find(c => c.id === props.configId)
        if (existing) {
          // Fill in the form data first so connectionConfig is available
          configForm.value = JSON.parse(JSON.stringify(existing)) as ImageModelConfig
          configForm.value.paramOverrides = configForm.value.paramOverrides || {}
          selectedProviderId.value = existing.providerId
          selectedModelId.value = existing.modelId
          // Then call handleProviderChange, now that connectionConfig is available
          // Edit mode: do not auto-select the first model, do not reset the connection config, keep the saved data
          await handleProviderChange(existing.providerId, {
            autoSelectFirstModel: false,
            resetOverrides: false,
            resetConnectionConfig: false
          })
          // Wait one frame to make sure the dropdown is visible
          await nextTick()
        }
      } else {
        // Create mode: reset the form data and auto-select the first provider and model
        resetFormData()

        // Auto-select the first provider
        if (providers.value.length > 0) {
          const firstProvider = providers.value[0]
          await handleProviderChange(firstProvider.id)

          // After models finish loading, auto-select the first model
          await nextTick()
          if (models.value.length > 0) {
            const firstModel = models.value[0]
            onModelChange(firstModel.id)
          }
        }
      }
    } catch (e) {
      console.error('Failed to load config:', e)
    }
  } else {
    resetFormData()
  }
})

// Watch configId changes separately to handle dynamic updates
watch(() => props.configId, async (newConfigId) => {
  // Only handle it when the dialog is already open
  if (props.show && newConfigId) {
    try {
      await loadConfigs()
      const existing = configs.value.find(c => c.id === newConfigId)
      if (existing) {
        // Fill in the form data first so connectionConfig is available
        configForm.value = JSON.parse(JSON.stringify(existing)) as ImageModelConfig
        configForm.value.paramOverrides = configForm.value.paramOverrides || {}
        selectedProviderId.value = existing.providerId
        selectedModelId.value = existing.modelId
        // Then call handleProviderChange, now that connectionConfig is available
        // Edit mode: do not auto-select the first model, do not reset the connection config, keep the saved data
        await handleProviderChange(existing.providerId, {
          autoSelectFirstModel: false,
          resetOverrides: false,
          resetConnectionConfig: false
        })
        await nextTick()
      }
    } catch (e) {
      console.error('Failed to handle configId change:', e)
    }
  }
}, { immediate: true })
</script>

<style scoped>
/* Removed CSS classes that are no longer used:
   - .connection-test (now uses NFormItem)
   - .number-input-wrapper (changed to NSpace inline)
   - .parameter-unit (simplified to inline NText)
   - .parameter-description (changed to template #feedback)
   - .provider-info (simplified to NText)
*/
</style>
