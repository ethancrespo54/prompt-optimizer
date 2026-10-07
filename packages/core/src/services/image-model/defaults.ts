import type { ImageModelConfig, IImageAdapterRegistry } from '../image/types'
import { ImageAdapterRegistry } from '../image/adapters/registry'
import { getEnvVar } from '../../utils/environment'

/**
 * Provider ID -> environment variable key mapping (consistent with the text model style)
 * To add a Provider, just add a line here
 */
const IMAGE_PROVIDER_ENV_KEYS = {
  openrouter: 'VITE_OPENROUTER_API_KEY',
  gemini: 'VITE_GEMINI_API_KEY',
  openai: 'VITE_OPENAI_API_KEY',
  siliconflow: 'VITE_SILICONFLOW_API_KEY',
  seedream: 'VITE_SEEDREAM_API_KEY',
  dashscope: 'VITE_DASHSCOPE_API_KEY',
  modelscope: 'VITE_MODELSCOPE_API_KEY'
} as const

/**
 * Config ID mapping (existing IDs are kept unchanged for compatibility with user data)
 * name is taken from provider.name; no need to hard-code it
 */
const IMAGE_CONFIG_IDS: Record<string, string> = {
  openrouter: 'image-openrouter-nanobanana',
  gemini: 'image-gemini-nanobanana',
  openai: 'image-openai-gpt',
  siliconflow: 'image-siliconflow-kolors',
  seedream: 'image-seedream',
  dashscope: 'image-dashscope',
  modelscope: 'image-modelscope'
}

/**
 * Special baseURL environment variables (only for Providers that need an override)
 */
const IMAGE_BASE_URL_ENV_KEYS: Record<string, string> = {
  openai: 'VITE_OPENAI_BASE_URL',
  seedream: 'VITE_SEEDREAM_BASE_URL'
}

/**
 * Default config generator for image models
 * Returns complete self-contained config objects, including full provider and model info
 *
 * Uses the Provider-Adapter architecture to generate complete metadata;
 * all config info (Provider ID, name, BaseURL, default model, parameters) comes from the Adapter.
 *
 * @param registry Optional image adapter registry (for dependency injection and testing)
 */
export function getDefaultImageModels(registry?: IImageAdapterRegistry): Record<string, ImageModelConfig> {
  const adapterRegistry = registry || new ImageAdapterRegistry()
  const result: Record<string, ImageModelConfig> = {}

  // Generate configs in bulk (consistent with the text model style)
  for (const [providerId, envKey] of Object.entries(IMAGE_PROVIDER_ENV_KEYS)) {
    const configId = IMAGE_CONFIG_IDS[providerId]
    if (!configId) continue

    const adapter = adapterRegistry.getAdapter(providerId)
    const provider = adapter.getProvider()
    const models = adapterRegistry.getStaticModels(providerId)
    const defaultModel = models[0] || adapter.buildDefaultModel(providerId)

    // Get the API key (Seedream supports an alternate environment variable)
    let apiKey = getEnvVar(envKey).trim()
    if (!apiKey && providerId === 'seedream') {
      apiKey = getEnvVar('VITE_ARK_API_KEY').trim()
    }

    // Get the baseURL (supports environment variable override)
    let baseURL = provider.defaultBaseURL || ''
    const baseURLEnvKey = IMAGE_BASE_URL_ENV_KEYS[providerId]
    if (baseURLEnvKey) {
      let envBaseURL = getEnvVar(baseURLEnvKey).trim()
      // Seedream alternate
      if (!envBaseURL && providerId === 'seedream') {
        envBaseURL = getEnvVar('VITE_ARK_BASE_URL').trim()
      }
      if (envBaseURL) baseURL = envBaseURL
    }

    // Get default parameter values directly from the model (consistent with text models)
    const defaultParamValues = defaultModel.defaultParameterValues || {}

    result[configId] = {
      id: configId,
      name: provider.name,  // Take the name from provider; no longer hard-coded
      providerId,
      modelId: defaultModel.id,
      enabled: !!apiKey,
      connectionConfig: { apiKey, baseURL },
      paramOverrides: { ...defaultParamValues },
      customParamOverrides: {},
      provider,
      model: defaultModel
    }
  }

  return result
}

/**
 * Get the list of IDs of all built-in image model configs
 * Used to determine whether a config is a built-in model (rather than user-defined)
 */
export function getBuiltinImageConfigIds(): string[] {
  return Object.values(IMAGE_CONFIG_IDS)
}

// Export all image model configs directly (backward compatible, consistent with the text model style)
export const defaultImageModels = getDefaultImageModels()
