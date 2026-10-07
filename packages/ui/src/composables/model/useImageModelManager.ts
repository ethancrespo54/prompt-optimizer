import { ref, computed, inject } from 'vue'

import { useI18n } from 'vue-i18n'
import { useToast } from '../ui/useToast'
import { getI18nErrorMessage } from '../../utils/error'
import type {
  ImageProvider,
  ImageModel,
  ImageModelConfig,
  IImageAdapterRegistry,
  IImageModelManager,
  IImageService
} from '@prompt-optimizer/core'
import { useModelAdvancedParameters } from './useModelAdvancedParameters'
import { computeConnectionConfig, normalizeProviderChangeOptions } from './useConnectionConfig'

type EditableImageModelConfig = Omit<ImageModelConfig, 'provider' | 'model'> & {
  provider?: ImageProvider
  model?: ImageModel
}

const toErrorMessage = (error: unknown): string => {
  return getI18nErrorMessage(error, 'Unknown error')
}

export function useImageModelManager() {
  const { t } = useI18n()
  const toast = useToast()

  // Use dependency injection per the spec design
  const registry = inject<IImageAdapterRegistry>('imageRegistry')!
  const imageModelManager = inject<IImageModelManager>('imageModelManager')!
  const imageService = inject<IImageService>('imageService')!

  // State management
  const providers = ref<ImageProvider[]>([])
  const models = ref<ImageModel[]>([])
  const dynamicModels = ref<ImageModel[]>([])
  const configs = ref<ImageModelConfig[]>([])

  // UI state
  const isLoadingDynamicModels = ref(false)
  const isLoadingProviders = ref(false)
  const isTestingConnection = ref(false)
  const isSaving = ref(false)
  const selectedProviderId = ref('')
  const selectedModelId = ref('')

  // Form state (does not include the provider and model fields; only used for editing)
  const configForm = ref<EditableImageModelConfig>({
    id: '',
    name: '',
    providerId: '',
    modelId: '',
    enabled: true,
    connectionConfig: {},
    paramOverrides: {}
  })

  // Connection and model loading state
  const connectionStatus = ref<{
    type: 'success' | 'error' | 'warning' | 'info'
    messageKey: string
    detail?: string
  } | null>(null)

  const testResult = ref<{
    success: boolean
    image?: {
      url?: string
      b64?: string
      mimeType?: string
    }
    testType: 'text2image' | 'image2image'
  } | null>(null)

  const modelLoadingStatus = ref<{
    type: 'success' | 'error' | 'warning' | 'info'
    messageKey: string
    count?: number
    detail?: string
  } | null>(null)

  // Computed properties (state management enhanced per the spec design)
  const isLoadingModels = computed(() => isLoadingDynamicModels.value)

  const selectedProvider = computed(() =>
    providers.value.find(p => p.id === selectedProviderId.value)
  )

  const selectedModel = computed(() =>
    models.value.find(m => m.id === selectedModelId.value)
  )

  // Simplified interface: pass in the necessary parameters directly
  const advancedParameters = useModelAdvancedParameters({
    mode: 'image',
    registry: computed(() => registry),
    providerId: selectedProviderId,
    modelId: selectedModelId,
    savedModelMeta: computed(() => {
      if (configForm.value.id) {
        const existing = configs.value.find(config => config.id === configForm.value.id)
        if (existing?.model && existing.model.id === selectedModelId.value) {
          return existing.model
        }
      }
      if (configForm.value.model && configForm.value.model.id === selectedModelId.value) {
        return configForm.value.model
      }
      return selectedModel.value
    }),
    getParamOverrides: () => configForm.value.paramOverrides ?? {},
    setParamOverrides: value => {
      configForm.value.paramOverrides = { ...value }
    }
  })

  const {
    currentParameterDefinitions,
    currentParamOverrides,
    availableParameterCount,
    updateParamOverrides,
    applyDefaultsFromModel
  } = advancedParameters

  // Extra state computed properties (improving the user experience)
  const hasStaticModels = computed(() => {
    if (!selectedProviderId.value) return false
    try {
      return registry.getStaticModels(selectedProviderId.value).length > 0
    } catch {
      return false
    }
  })

  const hasDynamicModels = computed(() => dynamicModels.value.length > 0)

  const supportsDynamicModels = computed(() =>
    selectedProvider.value?.supportsDynamicModels || false
  )

  const isConnectionConfigured = computed(() => {
    if (!selectedProvider.value?.supportsDynamicModels) return true
    return hasValidConnectionConfig(configForm.value.connectionConfig || {})
  })

  const canRefreshModels = computed(() =>
    supportsDynamicModels.value && isConnectionConfigured.value && !isLoadingDynamicModels.value
  )

  const canTestConnection = computed(() => {
    // Disabled during testing
    if (isTestingConnection.value) return false
    // Must have the required connection config
    if (!isConnectionConfigured.value) return false
    // Must have a model ID (needed to send the request)
    if (!configForm.value.modelId?.trim()) return false
    // Must have a provider
    if (!configForm.value.providerId) return false

    return true
  })

  // Initial data loading
  const loadProviders = async () => {
    isLoadingProviders.value = true
    try {
      providers.value = registry.getAllProviders()
    } catch (error) {
      console.error('Failed to load providers:', error)
      toast.error(t('image.provider.loadFailed'))
    } finally {
      isLoadingProviders.value = false
    }
  }

  const loadConfigs = async () => {
    try {
      const allConfigs = await imageModelManager.getAllConfigs()
      // Sort: enabled models first, then by display name
      configs.value = allConfigs.sort((a: ImageModelConfig, b: ImageModelConfig) => {
        // First level: sort by enabled state (enabled first)
        if (a.enabled !== b.enabled) {
          return a.enabled ? -1 : 1
        }
        // Second level: sort alphabetically by name
        return a.name.localeCompare(b.name)
      })
    } catch (error) {
      console.error('Failed to load configs:', error)
      toast.error(t('image.config.loadFailed'))
    }
  }

  // Call the new interface directly
  const updateConfig = async (id: string, updates: Partial<ImageModelConfig>) => {
    await imageModelManager.updateConfig(id, updates)
  }

  const addConfig = async (config: ImageModelConfig) => {
    await imageModelManager.addConfig(config)
  }

  const deleteConfig = async (id: string) => {
    await imageModelManager.deleteConfig(id)
  }

  // Provider change handling (progressive experience per the spec design)
  const onProviderChange = async (
    providerId: string,
    options: boolean | { autoSelectFirstModel?: boolean; resetOverrides?: boolean; resetConnectionConfig?: boolean } = true
  ) => {
    const normalized = normalizeProviderChangeOptions(options)

    selectedProviderId.value = providerId
    configForm.value.providerId = providerId

    if (normalized.resetOverrides) {
      configForm.value.paramOverrides = {}
    }

    // Only reset the model ID when auto-selection is needed
    if (normalized.autoSelectFirstModel) {
      selectedModelId.value = ''
      configForm.value.modelId = ''
    }

    // Reset all related state
    connectionStatus.value = null
    modelLoadingStatus.value = null
    dynamicModels.value = []

    if (!providerId) {
      models.value = []
      configForm.value.connectionConfig = {}
      return
    }

    // Use the shared function to handle the connection config
    const providerMeta = providers.value.find(p => p.id === providerId)
    configForm.value.connectionConfig = computeConnectionConfig(
      configForm.value.connectionConfig,
      providerMeta,
      normalized.resetConnectionConfig
    )

    // 1. Show the static models immediately (instant response)
    try {
      const staticModels = registry.getStaticModels(providerId)
      models.value = staticModels

      // Only auto-select the first model when auto-selection is needed and no model is currently selected
      if (normalized.autoSelectFirstModel && staticModels.length > 0) {
        const firstModel = staticModels[0]
        selectedModelId.value = firstModel.id
        configForm.value.modelId = firstModel.id
        // After switching providers, automatically apply the default parameters of the first model
        if (firstModel.id && providerId) {
          applyDefaultsFromModel(false)
        }

        modelLoadingStatus.value = {
          type: 'success',
          messageKey: 'image.model.staticLoaded',
          count: staticModels.length
        }
      } else if (staticModels.length > 0) {
        // Edit mode: no auto-selection, but still show the successfully loaded state
        modelLoadingStatus.value = {
          type: 'success',
          messageKey: 'image.model.staticLoaded',
          count: staticModels.length
        }
      } else {
        modelLoadingStatus.value = {
          type: 'info',
          messageKey: 'image.model.noStaticModels'
        }
      }
    } catch (error) {
      console.error('Failed to load static models:', error)
      models.value = []
      modelLoadingStatus.value = {
        type: 'error',
        messageKey: 'image.model.staticLoadFailed'
      }
    }

    // 2. If dynamic fetching is supported and the user has configured the connection info
    if (registry.supportsDynamicModels(providerId)) {
      const connectionConfig = getConnectionConfig()
      if (connectionConfig && hasValidConnectionConfig(connectionConfig)) {
        // Load dynamic models asynchronously without blocking the UI
        refreshDynamicModels().catch(error => {
          console.warn('Dynamic model loading failed after provider change:', error)
        })
      } else {
        // Prompt the user that connection info needs to be configured
        modelLoadingStatus.value = {
          type: 'warning',
          messageKey: 'image.model.connectionRequired'
        }
      }
    }
  }

  // Get the connection config (helper method)
  const getConnectionConfig = () => {
    return configForm.value.connectionConfig ?? {}
  }

  // Validate that the connection config is valid (helper method)
  const hasValidConnectionConfig = (connectionConfig: Record<string, unknown>) => {
    const provider = selectedProvider.value
    if (!provider?.connectionSchema) return true

    return provider.connectionSchema.required.every(field => connectionConfig[field])
  }

  // Detailed validation: returns the lists of missing fields and mismatched types
  const validateConnectionConfigDetailed = (connectionConfig: Record<string, unknown>) => {
    const provider = selectedProvider.value
    const missing: string[] = []
    const typeErrors: { field: string; expected: string; actual: string }[] = []
    if (!provider?.connectionSchema) return { ok: true, missing, typeErrors }
    const schema = provider.connectionSchema

    for (const field of schema.required) {
      if (!(field in (connectionConfig || {})) || connectionConfig[field] === '' || connectionConfig[field] === undefined) {
        missing.push(field)
      }
    }
    for (const [field, expected] of Object.entries(schema.fieldTypes || {})) {
      if (field in (connectionConfig || {})) {
        const actual = typeof connectionConfig[field]
        if (actual !== expected) {
          typeErrors.push({ field, expected, actual })
        }
      }
    }
    return { ok: missing.length === 0 && typeErrors.length === 0, missing, typeErrors }
  }

  // Connection config change handling (enhanced reactivity)
  const onConnectionConfigChange = async () => {
    connectionStatus.value = null

    // If dynamic models are supported and the connection config is complete, refresh the models automatically
    if (selectedProvider.value?.supportsDynamicModels) {
      const connectionConfig = configForm.value.connectionConfig || {}
      if (hasValidConnectionConfig(connectionConfig)) {
        // When the config is valid, refresh the dynamic models asynchronously
        refreshDynamicModels().catch(error => {
          console.warn('Failed to refresh models after connection config change:', error)
          modelLoadingStatus.value = {
            type: 'warning',
            messageKey: 'image.model.refreshFailed'
          }
        })
      } else {
        // When the config is invalid, fall back to the static models and prompt
        try {
          const staticModels = registry.getStaticModels(selectedProviderId.value)
          models.value = staticModels
          dynamicModels.value = []

          modelLoadingStatus.value = {
            type: 'warning',
            messageKey: 'image.model.connectionRequired'
          }
        } catch (error) {
          console.error('Failed to load static models:', error)
          models.value = []
        }
      }
    }
  }

  // Connection test
  // Helper function: choose the test type based on model capabilities
  const selectTestType = (model: ImageModel): 'text2image' | 'image2image' => {
    const capabilities = model.capabilities || {}
    const text2image = capabilities?.text2image
    const image2image = capabilities?.image2image

    if (text2image && !image2image) {
      return 'text2image'  // Only supports text-to-image
    }

    if (!text2image && image2image) {
      return 'image2image' // Only supports image-to-image
    }

    if (text2image && image2image) {
      return 'text2image'  // Supports both; prefer text-to-image
    }

    throw new Error('The model does not support any image generation feature')
  }

  const testConnection = async () => {
    if (!selectedProvider.value || !hasValidConnectionConfig(configForm.value.connectionConfig || {})) {
      return
    }

    // Check whether a model is selected
    if (!configForm.value.modelId) {
      toast.error(t('image.model.selectRequired'))
      return
    }

    isTestingConnection.value = true
    connectionStatus.value = { type: 'info', messageKey: 'image.connection.testing' }

    try {
      // Do a detailed local validation first and give hints for missing and wrongly typed fields
      const detail = validateConnectionConfigDetailed(configForm.value.connectionConfig || {})
      if (!detail.ok) {
        const parts: string[] = []
        if (detail.missing.length) parts.push(t('image.connection.validation.missing', { fields: detail.missing.join(', ') }))
        if (detail.typeErrors.length) {
          parts.push(detail.typeErrors.map(e => t('image.connection.validation.invalidType', e)).join('; '))
        }
        connectionStatus.value = { type: 'error', messageKey: 'image.connection.testFailed', detail: parts.join('；') }
        toast.error(parts.join('；'))
        return
      }

      // Get the selected model info: prefer the cache; when absent, build it through the registry
      let selectedModel = models.value.find(m => m.id === configForm.value.modelId)
      if (!selectedModel) {
        // For custom model IDs, use the adapter's buildDefaultModel method to build it
        try {
          const adapter = registry.getAdapter(selectedProviderId.value)
          selectedModel = adapter.buildDefaultModel(configForm.value.modelId)
        } catch (error) {
          throw new Error(`Unable to build model ${configForm.value.modelId}: ${error instanceof Error ? error.message : String(error)}`)
        }
      }

      // Determine the test type based on the model capabilities
      const testType = selectTestType(selectedModel)

      // Build the complete model config
      const completeConfig: ImageModelConfig = {
        id: configForm.value.id || 'test',
        name: configForm.value.name || 'Test Config',
        providerId: selectedProviderId.value,
        modelId: configForm.value.modelId,
        enabled: true,
        connectionConfig: configForm.value.connectionConfig || {},
        paramOverrides: configForm.value.paramOverrides || {},
        // Use simplified provider and model objects when testing
        provider: selectedProvider.value!,
        model: selectedModel!
      }

      // Seamless IPC: run the connection test uniformly through imageService
      const result = await imageService.testConnection(completeConfig)

      // Test succeeded
      connectionStatus.value = {
        type: 'success',
        messageKey: 'image.connection.testSuccess'
      }

      // Save the test result images for display
      testResult.value = {
        success: true,
        image: result.images[0],
        testType
      }

      // After a successful connection, refresh the models automatically (if dynamic fetching is supported)
      await refreshDynamicModels()
      toast.success(t('image.connection.testSuccess'))

    } catch (error) {
      const message = toErrorMessage(error)
      console.error('Connection test failed:', error)
      connectionStatus.value = {
        type: 'error',
        messageKey: 'image.connection.testError',
        detail: message
      }
      toast.error(`${t('image.connection.testError')}: ${message}`)
    } finally {
      isTestingConnection.value = false
    }
  }

  // Dynamic model refresh (merge logic per the spec design)
  const refreshDynamicModels = async () => {
    if (!selectedProviderId.value || !registry.supportsDynamicModels(selectedProviderId.value)) {
      return
    }

    const connectionConfig = getConnectionConfig()
    if (!connectionConfig || !hasValidConnectionConfig(connectionConfig)) {
      const detail = validateConnectionConfigDetailed(connectionConfig || {})
      const parts: string[] = []
      if (detail.missing.length) parts.push(t('image.connection.validation.missing', { fields: detail.missing.join(', ') }))
      if (detail.typeErrors.length) parts.push(detail.typeErrors.map(e => t('image.connection.validation.invalidType', e)).join('; '))
      modelLoadingStatus.value = { type: 'warning', messageKey: 'image.model.connectionRequired', detail: parts.join('；') }
      return
    }

    isLoadingDynamicModels.value = true
    modelLoadingStatus.value = {
      type: 'info',
      messageKey: 'image.model.loading'
    }

    try {
      // Seamless IPC: fetch dynamic models uniformly through imageService
      const fetchedDynamicModels = await imageService.getDynamicModels(selectedProviderId.value, connectionConfig)
      dynamicModels.value = fetchedDynamicModels

      // Merge the static and dynamic models, with dynamic models taking precedence (per the spec design)
      const staticModels = registry.getStaticModels(selectedProviderId.value)
      models.value = mergeDynamicModels(staticModels, fetchedDynamicModels)

      modelLoadingStatus.value = {
        type: 'success',
        messageKey: 'image.model.dynamicLoaded',
        count: fetchedDynamicModels.length
      }

    } catch (error) {
      console.warn('Failed to load dynamic models, using static list:', error)

      // Automatically fall back to the static models to keep the user experience (per the spec design)
      const staticModels = registry.getStaticModels(selectedProviderId.value)
      models.value = staticModels
      dynamicModels.value = []

      modelLoadingStatus.value = {
        type: 'warning',
        messageKey: 'image.model.dynamicFailed',
        count: staticModels.length,
        detail: toErrorMessage(error)
      }
    } finally {
      isLoadingDynamicModels.value = false
    }
  }

  // Helper method for merging dynamic models (per the spec design)
  const mergeDynamicModels = (staticModels: ImageModel[], dynamicModels: ImageModel[]): ImageModel[] => {
    const dynamicIds = new Set(dynamicModels.map(m => m.id))
    return [...dynamicModels, ...staticModels.filter(m => !dynamicIds.has(m.id))]
  }

  // Manually refresh the models
  const refreshModels = async () => {
    if (!selectedProvider.value?.supportsDynamicModels) {
      toast.info(t('image.model.refreshNotSupported'))
      return
    }

    if (!hasValidConnectionConfig(configForm.value.connectionConfig || {})) {
      toast.warning(t('image.connection.configRequired'))
      return
    }

    // Show the loading state
    isLoadingDynamicModels.value = true
    modelLoadingStatus.value = {
      type: 'info',
      messageKey: 'image.model.refreshing'
    }

    try {
      await refreshDynamicModels()
      toast.success(t('image.model.refreshSuccess'))
    } catch (error) {
      toast.error(t('image.model.refreshError'))
    } finally {
      isLoadingDynamicModels.value = false
    }
  }

  // Model selection change
  const onModelChange = (modelId: string) => {
    selectedModelId.value = modelId
    configForm.value.modelId = modelId

    if (modelId && selectedProviderId.value) {
      // Edit mode (configForm.id exists): merge parameters (keep the user's existing config)
      // Create mode: replace parameters (use the new model's default values)
      const isEditing = !!configForm.value.id
      applyDefaultsFromModel(isEditing)
    }
  }

  // Save the config (optimized version: uses the cached model object)
  const saveConfig = async () => {
    if (!configForm.value.name || !selectedProviderId.value || !selectedModelId.value) {
      toast.error(t('image.config.incomplete'))
      return
    }

    isSaving.value = true

    try {
      // Get the provider info from the cache
      const cachedProvider = providers.value.find(p => p.id === selectedProviderId.value)

      if (!cachedProvider) {
        throw new Error(`Provider does not exist: ${selectedProviderId.value}`)
      }

      // Get the model info: prefer the cache; when absent, build it through the registry
      let cachedModel = models.value.find(m => m.id === selectedModelId.value)
      if (!cachedModel) {
        // For custom model IDs, use the adapter's buildDefaultModel method to build it
        try {
          const adapter = registry.getAdapter(selectedProviderId.value)
          cachedModel = adapter.buildDefaultModel(selectedModelId.value)
        } catch (error) {
          throw new Error(`Unable to build model ${selectedModelId.value}: ${error instanceof Error ? error.message : String(error)}`)
        }
      }

      // Assemble the complete self-contained config
      const completeConfig: ImageModelConfig = {
        ...configForm.value,
        // Embed the complete provider and model info
        provider: cachedProvider,
        model: cachedModel
      }

      if (configForm.value.id) {
        await imageModelManager.updateConfig(configForm.value.id, completeConfig)
        toast.success(t('image.config.updateSuccess'))
      } else {
        const newConfig = { ...completeConfig, id: generateConfigId() }
        await imageModelManager.addConfig(newConfig)
        toast.success(t('image.config.createSuccess'))
      }

      // Reload the config list
      await loadConfigs()

      // Reset the form
      resetForm()

    } catch (error) {
      console.error('Failed to save config:', error)
      toast.error(`${t('image.config.saveFailed')}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      isSaving.value = false
    }
  }

  // Reset the form
  const resetForm = () => {
    selectedProviderId.value = ''
    selectedModelId.value = ''
    configForm.value = {
      id: '',
      name: '',
      providerId: '',
      modelId: '',
      enabled: true,
      connectionConfig: {},
      paramOverrides: {}
      // Note: the provider and model fields are not set; they are filled in from the cache in saveConfig
    }
    models.value = []
    connectionStatus.value = null
    modelLoadingStatus.value = null
    testResult.value = null
  }

  // Generate the config ID
  const generateConfigId = () => {
    return `config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Initialize
  const initialize = async () => {
    await Promise.all([
      loadProviders(),
      loadConfigs()
    ])
  }

  return {
    // Data state
    providers,
    models,
    dynamicModels,
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
    modelLoadingStatus,
    testResult,

    // Computed properties (state management enhanced per the spec design)
    selectedProvider,
    selectedModel,
    hasStaticModels,
    hasDynamicModels,
    supportsDynamicModels,
    isConnectionConfigured,
    canRefreshModels,
    canTestConnection,
    currentParameterDefinitions,
    currentParamOverrides,
    availableParameterCount,

    // Methods
    onProviderChange,
    onConnectionConfigChange,
    testConnection,
    refreshModels,
    onModelChange,
    updateParamOverrides,
    saveConfig,
    resetForm,
    initialize,
    loadConfigs,
    loadProviders,
    updateConfig,
    deleteConfig
  }
}
