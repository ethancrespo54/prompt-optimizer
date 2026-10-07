/**
 * Real LLM test helper
 *
 * Provides basic methods for getting a real LLM interface in unit tests
 * Automatically chooses the available providers and models based on local environment variables
 */

import { getDefaultTextModels } from '../../src/services/model/defaults';
import type { TextModelConfig } from '../../src/services/llm/types';
import { createLLMService } from '../../src/services/llm/service';
import { createModelManager } from '../../src/services/model/manager';
import { LocalStorageProvider } from '../../src/services/storage/localStorageProvider';
import type { ILLMService } from '../../src/services/llm/types';
import type { IModelManager } from '../../src/services/model/types';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

/**
 * Available provider info
 */
export interface AvailableProvider {
  /** Provider ID */
  providerId: string;
  /** Provider display name */
  providerName: string;
  /** Full model config */
  modelConfig: TextModelConfig;
}

/**
 * Real LLM test context
 */
export interface RealLLMTestContext {
  /** Provider info */
  provider: AvailableProvider;
  /** Model config (uses the first available model) */
  modelConfig: TextModelConfig;
  /** LLM service instance */
  llmService: ILLMService;
  /** Model manager instance */
  modelManager: IModelManager;
  /** Model key (added to the modelManager) */
  modelKey: string;
}

/**
 * Get all available providers
 *
 * Uses the system's built-in config loading logic, handling API keys and baseURLs automatically
 *
 * @returns List of available providers
 */
export function getAvailableProviders(): AvailableProvider[] {
  // Use the system's built-in config loader
  const allConfigs = getDefaultTextModels();
  const available: AvailableProvider[] = [];

  // Filter the providers that are enabled (have an API key)
  for (const [providerId, config] of Object.entries(allConfigs)) {
    if (config.enabled && config.connectionConfig.apiKey) {
      available.push({
        providerId,
        providerName: config.name,
        modelConfig: config
      });
    }
  }

  return available;
}

/**
 * Get the first available provider
 *
 * @returns The first available provider, or undefined if there is none
 */
export function getFirstAvailableProvider(): AvailableProvider | undefined {
  const available = getAvailableProviders();
  return available.length > 0 ? available[0] : undefined;
}

/**
 * Create the test config from the provider info
 *
 * @param provider - Provider info
 * @param paramOverrides - Parameter overrides (optional)
 * @returns Model config
 */
export function createTestConfig(
  provider: AvailableProvider,
  paramOverrides: Record<string, any> = {}
): TextModelConfig {
  // Use the system-loaded config directly, only overriding the parameters
  return {
    ...provider.modelConfig,
    paramOverrides: {
      ...provider.modelConfig.paramOverrides,
      ...paramOverrides
    }
  };
}

/**
 * Create the real LLM test context
 *
 * Automatically selects the first available provider and creates the LLM service and model manager
 *
 * @param options - Optional config
 * @param options.paramOverrides - Parameter overrides
 * @returns The test context, or undefined if there is no available provider
 *
 * @example
 * ```typescript
 * const context = await createRealLLMTestContext();
 * if (!context) {
 *   console.log('No API keys available, skipping test');
 *   return;
 * }
 *
 * const messages = [{ role: 'user', content: 'Hello' }];
 * const response = await context.llmService.sendMessage(messages, context.modelKey);
 * console.log(response.content);
 * ```
 */
export async function createRealLLMTestContext(options?: {
  paramOverrides?: Record<string, any>;
}): Promise<RealLLMTestContext | undefined> {
  const provider = getFirstAvailableProvider();
  if (!provider) {
    return undefined;
  }

  // Create the storage and model manager
  const storage = new LocalStorageProvider();
  await storage.clearAll();

  const modelManager = createModelManager(storage);

  // Use the default model key directly (= providerId), avoiding cross-test dependencies on storage writes
  const modelKey = provider.providerId;
  const baseConfig = await modelManager.getModel(modelKey);
  if (!baseConfig || !baseConfig.enabled) {
    return undefined;
  }

  // Optional: override the parameters (written into the modelManager so the LLMService can read them)
  if (options?.paramOverrides && Object.keys(options.paramOverrides).length > 0) {
    await modelManager.updateModel(modelKey, {
      paramOverrides: {
        ...(baseConfig.paramOverrides ?? {}),
        ...options.paramOverrides
      }
    });
  }

  const modelConfig = await modelManager.getModel(modelKey);
  if (!modelConfig) {
    return undefined;
  }

  // Create the LLM service
  const llmService = createLLMService(modelManager);

  return {
    provider,
    modelConfig,
    llmService,
    modelManager,
    modelKey
  };
}

/**
 * Check whether any API key is available
 *
 * @returns Whether at least one provider is available
 */
export function hasAvailableProvider(): boolean {
  return getAvailableProviders().length > 0;
}

/**
 * Print the available provider info (for debugging)
 */
export function printAvailableProviders(): void {
  const available = getAvailableProviders();

  if (available.length === 0) {
    console.log('❌ No API key available');
    console.log('\nPlease configure the API key of at least one provider in the .env.local file');
    console.log('For example: VITE_OPENAI_API_KEY=your_api_key');
    return;
  }

  console.log(`✅ Found ${available.length} available providers:\n`);
  available.forEach((p, index) => {
    console.log(`${index + 1}. ${p.providerName}`);
    console.log(`   - Provider ID: ${p.providerId}`);
    console.log(`   - Model: ${p.modelConfig.modelMeta.name} (${p.modelConfig.modelMeta.id})`);
    console.log(`   - Base URL: ${p.modelConfig.connectionConfig.baseURL || 'default'}`);
    console.log('');
  });
}
