import type { TextModelConfig } from './types';
import type { ITextAdapterRegistry } from '../llm/types';
import { TextAdapterRegistry } from '../llm/adapters/registry';
import { getEnvVar } from '../../utils/environment';
import { generateDynamicModels } from './model-utils';

/**
 * Provider ID -> environment variable key mapping
 * To add a Provider, just add a line here
 */
const PROVIDER_ENV_KEYS = {
  openai: 'VITE_OPENAI_API_KEY',
  gemini: 'VITE_GEMINI_API_KEY',
  anthropic: 'VITE_ANTHROPIC_API_KEY',
  deepseek: 'VITE_DEEPSEEK_API_KEY',
  siliconflow: 'VITE_SILICONFLOW_API_KEY',
  zhipu: 'VITE_ZHIPU_API_KEY',
  dashscope: 'VITE_DASHSCOPE_API_KEY',
  openrouter: 'VITE_OPENROUTER_API_KEY',
  modelscope: 'VITE_MODELSCOPE_API_KEY'
} as const;

/**
 * Get the list of IDs of all built-in models
 * Includes all Providers in PROVIDER_ENV_KEYS and 'custom'
 */
export function getBuiltinModelIds(): string[] {
  return [...Object.keys(PROVIDER_ENV_KEYS), 'custom'];
}

/**
 * Create default configs for text models (TextModelConfig format)
 * Uses the Provider-Adapter architecture to generate complete metadata
 *
 * All config info (Provider ID, name, BaseURL, default model) comes from the Adapter;
 * this file is only responsible for assembling the initial config from environment variables.
 *
 * @param registry Optional text adapter registry (for dependency injection and testing)
 */
export function getDefaultTextModels(registry?: ITextAdapterRegistry): Record<string, TextModelConfig> {
  const adapterRegistry = registry || new TextAdapterRegistry();
  const result: Record<string, TextModelConfig> = {};

  // Generate standard Provider configs in bulk
  for (const [providerId, envKey] of Object.entries(PROVIDER_ENV_KEYS)) {
    const adapter = adapterRegistry.getAdapter(providerId);
    const provider = adapter.getProvider();
    const models = adapter.getModels();
    const defaultModel = models[0] || adapter.buildDefaultModel(providerId);
    const apiKey = getEnvVar(envKey).trim();

    // Initialize paramOverrides with the model's default parameter values
    const defaultParamValues = defaultModel.defaultParameterValues || {};

    result[providerId] = {
      id: provider.id,
      name: provider.name,
      enabled: !!apiKey,
      providerMeta: provider,
      modelMeta: defaultModel,
      connectionConfig: {
        apiKey,
        baseURL: provider.defaultBaseURL
      },
      paramOverrides: { ...defaultParamValues },
      customParamOverrides: {}
    };
  }

  // Handle Custom separately (baseURL and model come from environment variables)
  const openaiAdapter = adapterRegistry.getAdapter('openai');
  const customApiKey = getEnvVar('VITE_CUSTOM_API_KEY').trim();
  const customBaseURL = getEnvVar('VITE_CUSTOM_API_BASE_URL');
  const customModelId = getEnvVar('VITE_CUSTOM_API_MODEL') || 'custom-model';
  const customModelMeta = {
    ...openaiAdapter.buildDefaultModel(customModelId),
    name: customModelId,
    description: 'Custom model via OpenAI-compatible API'
  };

  result.custom = {
    id: 'custom',
    name: 'Custom',
    enabled: !!customApiKey,
    providerMeta: openaiAdapter.getProvider(),
    modelMeta: customModelMeta,
    connectionConfig: {
      apiKey: customApiKey,
      baseURL: customBaseURL || 'http://localhost:11434/v1'
    },
    paramOverrides: { ...(customModelMeta.defaultParameterValues || {}) },
    customParamOverrides: {}
  };

  return result;
}

/**
 * Get all model configs (including static and dynamic)
 * @param registry Optional text adapter registry
 * @returns Model configs in TextModelConfig format
 */
export function getAllModels(registry?: ITextAdapterRegistry): Record<string, TextModelConfig> {
  // Generate the static model configs
  const staticModels = getDefaultTextModels(registry);

  // Generate dynamic custom models (now returns the TextModelConfig format)
  const dynamicModels = generateDynamicModels();

  // Merge static and dynamic models
  return {
    ...staticModels,
    ...dynamicModels
  };
}

// Export all model configs directly (backward compatible)
export const defaultModels = getAllModels();
