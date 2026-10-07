import { TextModelConfig, TextProvider, TextModel } from './types';
import { ValidatedCustomModelEnvConfig, scanCustomModelEnvVars } from '../../utils/environment';
import { getDefaultTextModels } from './defaults';

/**
 * Get the list of static model keys
 * Gets the key list dynamically by creating temporary static model configs, avoiding hard-coding
 */
function getStaticModelKeys(): string[] {
  const tempStaticModels = getDefaultTextModels();
  return Object.keys(tempStaticModels);
}

/**
 * Generate the display name of a custom model
 * @param suffix Suffix name
 * @returns Formatted display name
 */
export function generateCustomModelName(suffix: string): string {
  // Replace underscores and hyphens with spaces and convert to title case
  return suffix
    .replace(/[_-]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Convert a validated custom model environment variable config into a TextModelConfig
 * The input config has passed validateCustomModelConfig, ensuring all required fields exist
 * @param envConfig Validated environment variable config
 * @returns TextModelConfig object
 */
export function generateTextModelConfig(envConfig: ValidatedCustomModelEnvConfig): TextModelConfig {
  // The input config has been validated; use it directly (all required fields are guaranteed to exist)
  const modelName = generateCustomModelName(envConfig.suffix);

  // OpenAI-compatible Provider (all custom models use an OpenAI-compatible API)
  const customProvider: TextProvider = {
    id: 'openai',
    name: 'OpenAI',
    description: 'OpenAI-compatible API',
    requiresApiKey: true,
    defaultBaseURL: 'https://api.openai.com/v1',
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

  // Custom model metadata
  const customModel: TextModel = {
    id: envConfig.model,
    name: modelName,
    description: `Custom model: ${envConfig.model}`,
    providerId: 'openai',
    capabilities: {
      supportsTools: false,
      supportsReasoning: false,
      maxContextLength: 4096
    },
    parameterDefinitions: [
      {
        name: 'temperature',
        type: 'number',
        description: 'Sampling temperature',
        default: 1,
        min: 0,
        max: 2
      }
    ],
    defaultParameterValues: {
      temperature: 1
    }
  };

  return {
    id: `custom_${envConfig.suffix}`,
    name: modelName,
    enabled: true,
    providerMeta: customProvider,
    modelMeta: customModel,
    connectionConfig: {
      apiKey: envConfig.apiKey,
      baseURL: envConfig.baseURL
    },
    paramOverrides: {}
  };
}

/**
 * Generate all dynamic custom model configs (TextModelConfig format)
 * @returns Map of dynamic model configs
 */
export function generateDynamicModels(): Record<string, TextModelConfig> {
  const dynamicModels: Record<string, TextModelConfig> = {};

  try {
    // Get the validated custom model configs (scanCustomModelEnvVars has done all validation)
    const customModelConfigs = scanCustomModelEnvVars();

    Object.entries(customModelConfigs).forEach(([suffix, envConfig]) => {
      try {
        const modelKey = `custom_${suffix}`;

        // Check for conflicts with static model keys (get the static model keys dynamically to avoid hard-coding)
        const staticModelKeys = getStaticModelKeys();
        if (staticModelKeys.includes(suffix)) {
          console.warn(`[generateDynamicModels] Suffix conflict: ${suffix} conflicts with static model, skipping`);
          return;
        }

        // The config has been validated; generate the model config directly
        dynamicModels[modelKey] = generateTextModelConfig(envConfig);
        console.log(`[generateDynamicModels] Generated model: ${modelKey} (${dynamicModels[modelKey].name})`);
      } catch (error) {
        console.error(`[generateDynamicModels] Error generating model for ${suffix}:`, error);
        // Continue with the other models; one model's error should not interrupt the rest
      }
    });

    console.log(`[generateDynamicModels] Successfully generated ${Object.keys(dynamicModels).length} dynamic custom models`);
  } catch (error) {
    console.error('[generateDynamicModels] Error scanning custom model environment variables:', error);
  }

  return dynamicModels;
}
