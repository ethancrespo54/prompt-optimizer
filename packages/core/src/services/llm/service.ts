import type {
  ILLMService,
  Message,
  StreamHandlers,
  LLMResponse,
  ModelOption,
  ToolDefinition,
  TextModel,
  ITextAdapterRegistry
} from './types';
import type { TextModelConfig, ModelConfig } from '../model/types';
import { ModelManager } from '../model/manager';
import { APIError, RequestConfigError } from './errors';
import { isRunningInElectron } from '../../utils/environment';
import { ElectronLLMProxy } from './electron-proxy';
import { TextAdapterRegistry } from './adapters/registry';
import { mergeOverrides, splitOverridesBySchema } from '../model/parameter-utils';

/**
 * LLM service implementation - based on the Adapter architecture
 */
export class LLMService implements ILLMService {
  private registry: ITextAdapterRegistry;

  constructor(
    private modelManager: ModelManager,
    registry?: ITextAdapterRegistry
  ) {
    this.registry = registry ?? new TextAdapterRegistry();
  }

  /**
   * Validate the message format
   */
  private validateMessages(messages: Message[]): void {
    if (!Array.isArray(messages)) {
      throw new RequestConfigError('Messages must be an array');
    }
    if (messages.length === 0) {
      throw new RequestConfigError('Messages array cannot be empty');
    }
    messages.forEach(msg => {
      if (!msg.role || !msg.content) {
        throw new RequestConfigError('Invalid message format: missing required fields');
      }
      if (!['system', 'user', 'assistant', 'tool'].includes(msg.role)) {
        throw new RequestConfigError(`Unsupported message role: ${msg.role}`);
      }
      if (typeof msg.content !== 'string') {
        throw new RequestConfigError('Message content must be a string');
      }
    });
  }

  /**
   * Validate the model configuration
   */
  private validateModelConfig(
    modelConfig: TextModelConfig,
    options: { allowDisabled?: boolean } = {}
  ): void {
    if (!modelConfig) {
      throw new RequestConfigError('Model config cannot be empty');
    }
    if (!modelConfig.providerMeta || !modelConfig.providerMeta.id) {
      throw new RequestConfigError('Model provider metadata cannot be empty');
    }
    if (!modelConfig.modelMeta || !modelConfig.modelMeta.id) {
      throw new RequestConfigError('Model metadata cannot be empty');
    }
    // Default behavior: disabled models cannot be used for normal requests.
    // Connection testing is allowed to bypass this check (align with image model test behavior).
    if (!options.allowDisabled && !modelConfig.enabled) {
      throw new RequestConfigError('Model is not enabled');
    }
  }

  /**
   * Send a message (structured format)
   */
  async sendMessageStructured(messages: Message[], provider: string): Promise<LLMResponse> {
    try {
      if (!provider) {
        throw new RequestConfigError('Model provider cannot be empty');
      }

      const modelConfig = await this.modelManager.getModel(provider);
      if (!modelConfig) {
        throw new RequestConfigError(`Model ${provider} not found`);
      }

      this.validateModelConfig(modelConfig);
      this.validateMessages(messages);

      // Get the Adapter through the Registry
      const adapter = this.registry.getAdapter(modelConfig.providerMeta.id);

      const runtimeConfig = this.prepareRuntimeConfig(modelConfig);

      // Use the Adapter to send the message
      return await adapter.sendMessage(messages, runtimeConfig);

    } catch (error: any) {
      if (error instanceof RequestConfigError || error instanceof APIError) {
        throw error;
      }
      throw new APIError(`Failed to send message: ${error.message}`);
    }
  }

  /**
   * Send a message (legacy format, returns only the main content)
   */
  async sendMessage(messages: Message[], provider: string): Promise<string> {
    const response = await this.sendMessageStructured(messages, provider);
    
    // Return only the main content, not the reasoning content
    // If you need the reasoning content, use the sendMessageStructured method
    return response.content;
  }

  /**
   * Send a message (streaming, supports both structured and legacy formats)
   */
  async sendMessageStream(
    messages: Message[],
    provider: string,
    callbacks: StreamHandlers
  ): Promise<void> {
    try {
      this.validateMessages(messages);

      const modelConfig = await this.modelManager.getModel(provider);
      if (!modelConfig) {
        throw new RequestConfigError(`Model ${provider} not found`);
      }

      this.validateModelConfig(modelConfig);

      // Get the Adapter through the Registry
      const adapter = this.registry.getAdapter(modelConfig.providerMeta.id);

      const runtimeConfig = this.prepareRuntimeConfig(modelConfig);

      // Use the Adapter to send the streaming message
      await adapter.sendMessageStream(messages, runtimeConfig, callbacks);

    } catch (error) {
      console.error('Stream request failed:', error);
      callbacks.onError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Send a message (streaming, supports tool calls)
   * 🆕 Streaming message sending with tool call support
   */
  async sendMessageStreamWithTools(
    messages: Message[],
    provider: string,
    tools: ToolDefinition[],
    callbacks: StreamHandlers
  ): Promise<void> {
    try {
      this.validateMessages(messages);

      const modelConfig = await this.modelManager.getModel(provider);
      if (!modelConfig) {
        throw new RequestConfigError(`Model ${provider} not found`);
      }

      this.validateModelConfig(modelConfig);

      // Get the Adapter through the Registry
      const adapter = this.registry.getAdapter(modelConfig.providerMeta.id);

      const runtimeConfig = this.prepareRuntimeConfig(modelConfig);

      // Use the Adapter to send a streaming message with tools
      await adapter.sendMessageStreamWithTools(messages, runtimeConfig, tools, callbacks);

    } catch (error) {
      console.error('Stream request with tools failed:', error);
      callbacks.onError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }


  /**
   * Test the connection
   */
  async testConnection(provider: string): Promise<void> {
    try {
      if (!provider) {
        throw new RequestConfigError('Model provider cannot be empty');
      }

      const modelConfig = await this.modelManager.getModel(provider);
      if (!modelConfig) {
        throw new RequestConfigError(`Model ${provider} not found`);
      }

      // Align with image model connection testing: allow testing even if the model is disabled.
      this.validateModelConfig(modelConfig, { allowDisabled: true });

      // Send a simple test message
      const testMessages: Message[] = [
        {
          role: 'user',
          content: 'Please reply ok'
        }
      ];

      this.validateMessages(testMessages);

      // Send directly through the adapter to avoid the normal "enabled" constraint.
      const adapter = this.registry.getAdapter(modelConfig.providerMeta.id);
      const runtimeConfig = this.prepareRuntimeConfig(modelConfig);
      await adapter.sendMessage(testMessages, runtimeConfig);

    } catch (error: any) {
      if (error instanceof RequestConfigError || error instanceof APIError) {
        throw error;
      }
      throw new APIError(`Connection test failed: ${error.message}`);
    }
  }

  /**
   * Get the model list, returned in dropdown option format
   * @param provider Provider identifier
   * @param customConfig Custom config (optional)
   */
  async fetchModelList(
    provider: string,
    customConfig?: Partial<TextModelConfig> | Partial<ModelConfig>
  ): Promise<ModelOption[]> {
    try {
      // Get the base config
      const baseConfig = await this.modelManager.getModel(provider);
      const modelConfig = await this.buildEffectiveModelConfig(provider, baseConfig, customConfig);

      // Use the Registry to get the model list
      const providerId = modelConfig.providerMeta.id;
      let models: TextModel[] = [];

      // NOTE: Registry.getModels() will silently fall back to static models when dynamic fetch fails.
      // For explicit "fetch model list" actions, we want to surface the failure so UI can avoid
      // misleading "success" toasts and optionally fall back with a warning.
      if (this.registry.supportsDynamicModels(providerId)) {
        const dynamicModels = await this.registry.getDynamicModels(providerId, modelConfig);

        const staticModels = this.registry.getStaticModels(providerId);
        const dynamicIds = new Set(dynamicModels.map((m) => m.id));

        // Merge static + dynamic for completeness; dynamic wins.
        models = [
          ...dynamicModels,
          ...staticModels.filter((m) => !dynamicIds.has(m.id))
        ];
      } else {
        models = this.registry.getStaticModels(providerId);
      }

      // Convert to option format
      return models.map(model => ({
        value: model.id,
        label: model.name
      }));
    } catch (error: any) {
      console.error('Failed to fetch model list:', error);
      if (error instanceof RequestConfigError || error instanceof APIError) {
        throw error;
      }
      throw new APIError(`Failed to fetch model list: ${error.message}`);
    }
  }

  private prepareRuntimeConfig(modelConfig: TextModelConfig): TextModelConfig {
    const schema = modelConfig.modelMeta?.parameterDefinitions ?? [];

    // Merge parameters: supports the legacy-format customParamOverrides (backward compatible)
    // Priority: requestOverrides > customOverrides
    // requestOverrides contains the current paramOverrides (possibly merged or not)
    // customOverrides ensures that custom parameters in old data are not lost
    const mergedOverrides = mergeOverrides({
      schema,
      includeDefaults: false,
      customOverrides: modelConfig.customParamOverrides,  // 🔧 Legacy-format compatibility: custom parameters
      requestOverrides: modelConfig.paramOverrides        // Current parameters (built-in + possibly already-merged custom ones)
    });

    return {
      ...modelConfig,
      paramOverrides: mergedOverrides
    };
  }

  /**
   * Build a valid model config for fetching the model list
   * Supports both TextModelConfig and legacy ModelConfig input structures
   */
  private async buildEffectiveModelConfig(
    provider: string,
    baseConfig?: TextModelConfig | null,
    customConfig?: Partial<TextModelConfig> | Partial<ModelConfig>
  ): Promise<TextModelConfig> {
    const customTextConfig = isTextConfigLike(customConfig) ? customConfig : undefined;
    const customLegacyConfig = isLegacyConfigLike(customConfig) ? customConfig : undefined;

    const providerId = (
      baseConfig?.providerMeta.id ??
      customTextConfig?.providerMeta?.id ??
      customLegacyConfig?.provider ??
      provider
    ).toLowerCase();

    const adapter = this.registry.getAdapter(providerId);
    const providerMeta = adapter.getProvider();

    const desiredModelId = (
      baseConfig?.modelMeta.id ??
      customTextConfig?.modelMeta?.id ??
      customLegacyConfig?.defaultModel ??
      adapter.getModels()[0]?.id ??
      providerMeta.id
    );

    let modelMeta = baseConfig?.modelMeta;
    if (!modelMeta || modelMeta.id !== desiredModelId) {
      modelMeta = adapter.getModels().find(model => model.id === desiredModelId);
      if (!modelMeta) {
        modelMeta = adapter.buildDefaultModel(desiredModelId);
      }
    }

    const connectionConfig = {
      ...(baseConfig?.connectionConfig ?? {}),
      ...(customTextConfig?.connectionConfig ?? {})
    };

    if (customLegacyConfig?.apiKey) {
      connectionConfig.apiKey = customLegacyConfig.apiKey;
    }
    if (customLegacyConfig?.baseURL) {
      connectionConfig.baseURL = customLegacyConfig.baseURL;
    }
    if (!connectionConfig.baseURL && providerMeta.defaultBaseURL) {
      connectionConfig.baseURL = providerMeta.defaultBaseURL;
    }

    const schema = modelMeta.parameterDefinitions ?? [];
    const legacySplit = splitOverridesBySchema(schema, customLegacyConfig?.llmParams ?? {});
    const combinedBuiltIn = {
      ...(baseConfig?.paramOverrides ?? {}),
      ...(customTextConfig?.paramOverrides ?? {}),
      ...legacySplit.builtIn
    };
    const combinedCustom = {
      ...(baseConfig?.customParamOverrides ?? {}),
      ...(customTextConfig?.customParamOverrides ?? {}),
      ...legacySplit.custom
    };

    return {
      id: baseConfig?.id ?? provider,
      name: customTextConfig?.name ?? customLegacyConfig?.name ?? baseConfig?.name ?? providerMeta.name,
      enabled: baseConfig?.enabled ?? (customTextConfig?.enabled ?? true),
      providerMeta,
      modelMeta,
      connectionConfig,
      paramOverrides: combinedBuiltIn,
      customParamOverrides: combinedCustom
    };
  }

}

/**
 * Factory function for creating an LLM service instance
 * @param modelManager Model manager instance
 * @returns LLM service instance
 */
export function createLLMService(modelManager: ModelManager): ILLMService {
  // In the Electron environment, return the proxy instance
  if (isRunningInElectron()) {
    console.log('[LLM Service Factory] Electron environment detected, using proxy.');
    return new ElectronLLMProxy();
  }

  // Create the Registry instance
  const registry = new TextAdapterRegistry();

  // Return an LLMService instance with the Registry injected
  return new LLMService(modelManager, registry);
}

// eslint-disable-next-line @typescript-eslint/ban-types
type LegacyLike = Partial<ModelConfig> & {}

/**
 * Helper: determine whether the value has the TextModelConfig structure
 */
function isTextConfigLike(config?: Partial<TextModelConfig> | Partial<ModelConfig>): config is Partial<TextModelConfig> {
  return !!config && typeof config === 'object' && 'providerMeta' in config;
}

/**
 * Helper: determine whether the value has the legacy ModelConfig structure
 */
function isLegacyConfigLike(config?: Partial<TextModelConfig> | Partial<ModelConfig>): config is LegacyLike {
  return !!config && typeof config === 'object' && (
    'provider' in config || 'defaultModel' in config || 'baseURL' in config
  );
}
