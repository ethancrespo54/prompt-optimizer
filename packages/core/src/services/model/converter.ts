import type { ModelConfig, TextModelConfig, TextProvider, TextModel } from './types';
import type { ITextAdapterRegistry } from '../llm/types';
import { splitOverridesBySchema } from './parameter-utils';
import { ModelError } from './errors';
import { MODEL_ERROR_CODES } from '../../constants/error-codes';

/**
 * Convert a legacy ModelConfig to a TextModelConfig (using the Registry to get metadata)
 *
 * This function is for backward compatibility, converting old-format configs to the new architecture format
 *
 * @param key Config key name
 * @param legacy Legacy config object
 * @param registry Adapter registry instance (used to get Provider and Model metadata)
 * @returns The converted TextModelConfig
 */
export async function convertLegacyToTextModelConfigWithRegistry(
  key: string,
  legacy: ModelConfig,
  registry: ITextAdapterRegistry
): Promise<TextModelConfig> {
  // Determine providerId from the provider
  let providerId: string;
  switch (legacy.provider) {
    case 'gemini':
      providerId = 'gemini';
      break;
    case 'anthropic':
      providerId = 'anthropic';
      break;
    case 'deepseek':
      providerId = 'deepseek';
      break;
    case 'siliconflow':
      providerId = 'siliconflow';
      break;
    case 'zhipu':
      providerId = 'zhipu';
      break;
    case 'openai':
    case 'custom':
    default:
      providerId = 'openai';
      break;
  }

  try {
    // Get the Adapter through the Registry
    const adapter = registry.getAdapter(providerId);

    // Get the Provider metadata from the Adapter
    const providerMeta: TextProvider = adapter.getProvider();

    // Get the Model metadata from the Adapter
    let modelMeta: TextModel | undefined;
    const staticModels = adapter.getModels();
    modelMeta = staticModels.find(m => m.id === legacy.defaultModel);

    // If it is not found in the static model list, use buildDefaultModel
    if (!modelMeta) {
      console.warn(`[Converter] Model ${legacy.defaultModel} not found in static models, building default`);
      modelMeta = adapter.buildDefaultModel(legacy.defaultModel);
    }

    const schema = modelMeta.parameterDefinitions ?? [];
    const legacyParams = legacy.llmParams || {};
    const { builtIn, custom } = splitOverridesBySchema(schema, legacyParams);

    // Build the TextModelConfig
    const textModelConfig: TextModelConfig = {
      id: key,
      name: legacy.name,
      enabled: legacy.enabled,
      providerMeta: providerMeta,
      modelMeta: modelMeta,
      connectionConfig: {
        apiKey: legacy.apiKey,
        baseURL: legacy.baseURL
      },
      paramOverrides: builtIn,
      customParamOverrides: custom
    };

    return textModelConfig;
  } catch (error) {
    console.error(`[Converter] Failed to convert legacy config for ${key}:`, error);
    // Fallback: use the OpenAI Adapter and disable the config
    try {
      const openaiAdapter = registry.getAdapter('openai');
      const providerMeta = openaiAdapter.getProvider();
      const modelMeta = openaiAdapter.buildDefaultModel(legacy.defaultModel);

      return {
        id: key,
        name: legacy.name,
        enabled: false, // Conversion failed; disable the config
        providerMeta: providerMeta,
        modelMeta: modelMeta,
        connectionConfig: {
          apiKey: legacy.apiKey,
          baseURL: legacy.baseURL
        },
        paramOverrides: legacy.llmParams || {}
      };
    } catch (fallbackError) {
      console.error(`[Converter] Fallback to OpenAI also failed for ${key}:`, fallbackError);
      const details = error instanceof Error ? error.message : String(error)
      throw new ModelError(MODEL_ERROR_CODES.CONFIG_ERROR, `Failed to convert config ${key}: ${details}`);
    }
  }
}

/**
 * Convert a legacy ModelConfig to a TextModelConfig (using hard-coded metadata)
 *
 * This function is a fallback that does not depend on the Registry, avoiding circular dependencies
 *
 * @param key Config key name
 * @param legacy Legacy config object
 * @returns The converted TextModelConfig
 */
export function convertLegacyToTextModelConfig(
  key: string,
  legacy: ModelConfig
): TextModelConfig {
  // Determine providerId from the provider
  let providerId: string;
  switch (legacy.provider) {
    case 'gemini':
      providerId = 'gemini';
      break;
    case 'anthropic':
      providerId = 'anthropic';
      break;
    case 'deepseek':
      providerId = 'deepseek';
      break;
    case 'siliconflow':
      providerId = 'siliconflow';
      break;
    case 'zhipu':
      providerId = 'zhipu';
      break;
    case 'openai':
    case 'custom':
    default:
      providerId = 'openai';
      break;
  }

  // Build the Provider metadata
  const providerMeta: TextProvider = createProviderMeta(providerId, legacy);

  // Build the Model metadata
  const modelMeta: TextModel = createModelMeta(legacy.defaultModel, providerId, legacy);

  const schema = modelMeta.parameterDefinitions ?? [];
  const legacyParams = legacy.llmParams || {};
  const { builtIn, custom } = splitOverridesBySchema(schema, legacyParams);

  // Build the TextModelConfig
  const textModelConfig: TextModelConfig = {
    id: key,
    name: legacy.name,
    enabled: legacy.enabled,
    providerMeta: providerMeta,
    modelMeta: modelMeta,
    connectionConfig: {
      apiKey: legacy.apiKey,
      baseURL: legacy.baseURL
    },
    paramOverrides: builtIn,
    customParamOverrides: custom
  };

  return textModelConfig;
}

/**
 * Create Provider metadata
 */
function createProviderMeta(providerId: string, legacy: ModelConfig): TextProvider {
  if (providerId === 'gemini') {
    return {
      id: 'gemini',
      name: 'Google Gemini',
      description: 'Google Generative AI models',
      requiresApiKey: true,
      defaultBaseURL: 'https://generativelanguage.googleapis.com',
      supportsDynamicModels: false,
      connectionSchema: {
        required: ['apiKey'],
        optional: ['baseURL', 'timeout'],
        fieldTypes: {
          apiKey: 'string',
          baseURL: 'string',
          timeout: 'number'
        }
      }
    };
  } else if (providerId === 'deepseek') {
    return {
      id: 'deepseek',
      name: 'DeepSeek',
      description: 'DeepSeek OpenAI-compatible models',
      requiresApiKey: true,
      defaultBaseURL: legacy.baseURL || 'https://api.deepseek.com/v1',
      supportsDynamicModels: true,
      connectionSchema: {
        required: ['apiKey'],
        optional: ['baseURL', 'timeout'],
        fieldTypes: {
          apiKey: 'string',
          baseURL: 'string',
          timeout: 'number'
        }
      }
    };
  } else if (providerId === 'siliconflow') {
    return {
      id: 'siliconflow',
      name: 'SiliconFlow',
      description: 'SiliconFlow OpenAI-compatible models',
      requiresApiKey: true,
      defaultBaseURL: legacy.baseURL || 'https://api.siliconflow.cn/v1',
      supportsDynamicModels: true,
      connectionSchema: {
        required: ['apiKey'],
        optional: ['baseURL', 'timeout'],
        fieldTypes: {
          apiKey: 'string',
          baseURL: 'string',
          timeout: 'number'
        }
      }
    };
  } else if (providerId === 'zhipu') {
    return {
      id: 'zhipu',
      name: 'Zhipu AI',
      description: 'Zhipu GLM OpenAI-compatible models',
      requiresApiKey: true,
      defaultBaseURL: legacy.baseURL || 'https://open.bigmodel.cn/api/paas/v4',
      supportsDynamicModels: false,
      connectionSchema: {
        required: ['apiKey'],
        optional: ['baseURL', 'timeout'],
        fieldTypes: {
          apiKey: 'string',
          baseURL: 'string',
          timeout: 'number'
        }
      }
    };
  } else if (providerId === 'anthropic') {
    return {
      id: 'anthropic',
      name: 'Anthropic',
      description: 'Anthropic Claude models',
      requiresApiKey: true,
      defaultBaseURL: 'https://api.anthropic.com/v1',
      supportsDynamicModels: false,
      connectionSchema: {
        required: ['apiKey'],
        optional: ['baseURL', 'timeout'],
        fieldTypes: {
          apiKey: 'string',
          baseURL: 'string',
          timeout: 'number'
        }
      }
    };
  } else {
    // OpenAI and compatible APIs - always use 'OpenAI' as the Provider name
    return {
      id: 'openai',
      name: 'OpenAI',
      description: 'OpenAI GPT models and OpenAI-compatible APIs',
      requiresApiKey: true,
      defaultBaseURL: legacy.baseURL || 'https://api.openai.com/v1',
      supportsDynamicModels: true,
      connectionSchema: {
        required: ['apiKey'],
        optional: ['baseURL', 'organization', 'timeout'],
        fieldTypes: {
          apiKey: 'string',
          baseURL: 'string',
          organization: 'string',
          timeout: 'number'
        }
      }
    };
  }
}

/**
 * Create Model metadata
 */
function createModelMeta(modelId: string, providerId: string, legacy: ModelConfig): TextModel {
  // Default capabilities
  const defaultCapabilities = {
        supportsTools: providerId !== 'gemini', // Gemini tool support may differ
    supportsReasoning: modelId.includes('o1') || modelId.includes('reasoner') || modelId.includes('thinking'),
    maxContextLength: 4096
  };

  // Adjust capabilities based on the model ID
  if (modelId.includes('gpt-4o')) {
    defaultCapabilities.maxContextLength = 128000;
  } else if (modelId.includes('gemini')) {
    defaultCapabilities.maxContextLength = 1000000;
    defaultCapabilities.supportsTools = true;
  } else if (modelId.includes('claude')) {
    defaultCapabilities.maxContextLength = 200000;
  } else if (modelId.includes('deepseek')) {
    defaultCapabilities.maxContextLength = 64000;
  }

  if (providerId === 'siliconflow') {
    defaultCapabilities.supportsTools = false;
    defaultCapabilities.maxContextLength = 8192;
  } else if (providerId === 'zhipu') {
    defaultCapabilities.maxContextLength = 128000;
  }

  if (modelId.includes('glm-4-air')) {
    defaultCapabilities.supportsTools = false;
  }

  // Build the parameter definitions
  const parameterDefinitions = createParameterDefinitions(providerId);

  return {
    id: modelId,
    name: modelId,
    description: `Model ${modelId} from ${legacy.name}`,
    providerId: providerId,
    capabilities: defaultCapabilities,
    parameterDefinitions: parameterDefinitions,
    defaultParameterValues: legacy.llmParams || {}
  };
}

/**
 * Create parameter definitions
 */
function createParameterDefinitions(providerId: string): readonly any[] {
  if (providerId === 'gemini') {
    return [
      {
        name: 'temperature',
        labelKey: 'params.temperature.label',
        descriptionKey: 'params.temperature.description',
        type: 'number',
        defaultValue: 1,
        minValue: 0,
        maxValue: 2,
        step: 0.1
      },
      {
        name: 'maxOutputTokens',
        labelKey: 'params.maxOutputTokens.label',
        descriptionKey: 'params.maxOutputTokens.description',
        type: 'integer',
        defaultValue: 8192,
        minValue: 1,
        unitKey: 'params.tokens.unit',
        step: 1
      }
    ];
  } else {
    return [
      {
        name: 'temperature',
        labelKey: 'params.temperature.label',
        descriptionKey: 'params.temperature.description',
        type: 'number',
        defaultValue: 1,
        minValue: 0,
        maxValue: 2,
        step: 0.1
      },
      {
        name: 'max_tokens',
        labelKey: 'params.max_tokens.label',
        descriptionKey: 'params.max_tokens.description',
        type: 'integer',
        minValue: 1,
        unitKey: 'params.tokens.unit',
        step: 1
      }
    ];
  }
}

/**
 * Detect whether a config is in the legacy format
 *
 * @param config Config object
 * @returns true if it is in the legacy format
 */
export function isLegacyConfig(config: any): config is ModelConfig {
  return (
    config &&
    typeof config === 'object' &&
    'provider' in config &&
    'baseURL' in config &&
    'defaultModel' in config &&
    !('providerMeta' in config) &&
    !('modelMeta' in config)
  );
}

/**
 * Detect whether a config is in the new format
 *
 * @param config Config object
 * @returns true if it is in the new format
 */
export function isTextModelConfig(config: any): config is TextModelConfig {
  return (
    config &&
    typeof config === 'object' &&
    'providerMeta' in config &&
    'modelMeta' in config &&
    'connectionConfig' in config
  );
}
