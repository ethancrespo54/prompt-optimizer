/**
 * MCP server model config
 * Fully reuses the model management features of the core package
 */

import { ModelManager } from '@prompt-optimizer/core';

/**
 * Set the default model for the MCP server
 * Based entirely on the defaultModels of core, choosing a suitable model from the environment variables and config
 */
export async function setupDefaultModel(
  modelManager: ModelManager,
  preferredProvider?: string
): Promise<void> {
  // Dynamically import defaultModels to make sure the environment variables are already loaded
  const { defaultModels } = await import('@prompt-optimizer/core');

  // Get all available default models (enabled ones)
  const availableModels = Object.entries(defaultModels).filter(([_, config]) => config.enabled);

  if (availableModels.length === 0) {
    throw new Error('No enabled models found in core defaultModels');
  }

  let selectedModel: [string, any] | undefined;

  // 1. If preferredProvider is specified, try to match it
  if (preferredProvider) {
    const normalizedPreferred = preferredProvider.toLowerCase();

    selectedModel = availableModels.find(([key, config]) =>
      // Match the model key directly (supports custom_<suffix>)
      key.toLowerCase() === normalizedPreferred ||
      // Match the provider id
      String(config.providerMeta?.id || config.modelMeta?.providerId || config.provider || '').toLowerCase() === normalizedPreferred ||
      // Compatible with fuzzy matching by name
      String(config.name || '').toLowerCase().includes(normalizedPreferred)
    );
  }

  // 2. If no match is found or none is specified, use the first available model
  if (!selectedModel) {
    selectedModel = availableModels[0];
  }

  const [modelKey, modelConfig] = selectedModel;

  // 3. Use the model config of core and make sure the model is enabled
  const finalConfig = {
    ...modelConfig,
    // Make sure the model is enabled
    enabled: true
  };

  // 4. Use the standard API of ModelManager to add or update the model
  const mcpModelKey = `mcp-default`;

  try {
    // Try to update the existing model
    await modelManager.updateModel(mcpModelKey, finalConfig);
  } catch (error) {
    // If the model does not exist, add a new one
    await modelManager.addModel(mcpModelKey, finalConfig);
  }
}


