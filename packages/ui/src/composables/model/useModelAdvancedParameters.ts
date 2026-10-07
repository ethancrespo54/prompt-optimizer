import { computed, type ComputedRef, type Ref } from 'vue'

import type {
  UnifiedParameterDefinition,
  TextModel,
  TextModelConfig,
  ITextAdapterRegistry,
  ITextProviderAdapter,
  ImageModel,
  ImageModelConfig,
  IImageAdapterRegistry,
  IImageProviderAdapter
} from '@prompt-optimizer/core'

type ParameterizedModel = {
  id: string
  parameterDefinitions?: readonly UnifiedParameterDefinition[]
  defaultParameterValues?: Record<string, unknown>
}

/**
 * Simplified parameter accessor interface
 * There is now only the unified paramOverrides, with no distinction between built-in and custom
 */
interface OverrideAccessors {
  getParamOverrides: () => Record<string, unknown>
  setParamOverrides: (value: Record<string, unknown>) => void
}

/**
 * Simplified options interface
 * Pass the necessary parameters directly instead of complex resolver functions
 */
interface UseModelAdvancedParametersOptions extends OverrideAccessors {
  mode: 'text' | 'image'
  registry: Ref<ITextAdapterRegistry | IImageAdapterRegistry>
  providerId: Ref<string>
  modelId: Ref<string>
  savedModelMeta: Ref<ParameterizedModel | undefined>
}

/**
 * Unified advanced parameter management composable
 *
 * Simplification notes:
 * 1. Removed the concept of customOverrides and uniformly use paramOverrides
 * 2. Removed the candidateModelIds array and use modelId directly
 * 3. Simplified the model metadata resolution logic: savedModelMeta → static → buildDefault
 */
export function useModelAdvancedParameters(
  options: UseModelAdvancedParametersOptions
) {
  /**
   * Resolve the current model metadata
   * Priority: savedModelMeta → static models → buildDefault
   */
  const currentModelMeta = computed(() => {
    const providerId = options.providerId.value
    const modelId = options.modelId.value
    const savedMeta = options.savedModelMeta.value

    if (!providerId || !modelId) return undefined

    // Prefer the saved model metadata (the snapshot in the config)
    if (savedMeta && savedMeta.id === modelId) {
      return savedMeta
    }

    // Try to get it from the static model list
    try {
      const registry = options.registry.value
      const staticModels = options.mode === 'text'
        ? (registry as ITextAdapterRegistry).getStaticModels(providerId)
        : (registry as IImageAdapterRegistry).getStaticModels(providerId)

      const staticMatch = staticModels.find(model => model.id === modelId)
      if (staticMatch) return staticMatch
    } catch (error) {
      console.warn(
        `[useModelAdvancedParameters] Failed to get static models for provider ${providerId}`,
        error
      )
    }

    // Finally build it with buildDefaultModel
    try {
      const registry = options.registry.value
      const adapter = options.mode === 'text'
        ? (registry as ITextAdapterRegistry).getAdapter(providerId)
        : (registry as IImageAdapterRegistry).getAdapter(providerId)

      return adapter.buildDefaultModel(modelId)
    } catch (error) {
      console.warn(
        `[useModelAdvancedParameters] Failed to build default model for provider ${providerId}, model ${modelId}`,
        error
      )
      return undefined
    }
  })

  const currentParameterDefinitions = computed(() => {
    const definitions = currentModelMeta.value?.parameterDefinitions ?? []
    return definitions.map(definition => ({ ...definition }))
  })

  const currentParamOverrides = computed(() => options.getParamOverrides())

  const availableParameterCount = computed(() => {
    const overrides = currentParamOverrides.value || {}
    return currentParameterDefinitions.value.filter(
      definition => !Object.prototype.hasOwnProperty.call(overrides, definition.name)
    ).length
  })

  const updateParamOverrides = (overrides: Record<string, unknown>) => {
    options.setParamOverrides({ ...overrides })
  }

  /**
   * Apply the model default parameters
   * @param mergeWithExisting Whether to merge with existing parameters (true: keep the user's config and fill in missing defaults; false: replace completely)
   */
  const applyDefaultsFromModel = (mergeWithExisting = false) => {
    const defaults = currentModelMeta.value?.defaultParameterValues
    if (!defaults) return

    if (mergeWithExisting) {
      // Merge mode: keep the user's existing config and only fill in missing defaults
      const currentOverrides = options.getParamOverrides()
      const merged = { ...defaults }
      // The user's configured parameters take priority
      for (const key of Object.keys(currentOverrides)) {
        if (currentOverrides[key] !== undefined) {
          merged[key] = currentOverrides[key]
        }
      }
      options.setParamOverrides(merged)
    } else {
      // Replace mode: use the default values directly
      options.setParamOverrides({ ...defaults })
    }
  }

  return {
    currentModelMeta,
    currentParameterDefinitions,
    currentParamOverrides,
    availableParameterCount,
    updateParamOverrides,
    applyDefaultsFromModel
  }
}

// ✅ Removed deprecated functions: createTextModelMetaResolver, createImageModelMetaResolver
// Please use useModelAdvancedParameters directly and pass in the simplified parameters
