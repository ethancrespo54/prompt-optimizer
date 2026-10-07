import type {
  ITextAdapterRegistry,
  ITextProviderAdapter,
  TextProvider,
  TextModel,
  TextModelConfig
} from '../types';
import { AbstractAdapterRegistry } from '../../adapters/abstract-registry';
import { OpenAIAdapter } from './openai-adapter';
import { AnthropicAdapter } from './anthropic-adapter';
import { GeminiAdapter } from './gemini-adapter';
import { DeepseekAdapter } from './deepseek-adapter';
import { SiliconflowAdapter } from './siliconflow-adapter';
import { ZhipuAdapter } from './zhipu-adapter';
import { DashScopeAdapter } from './dashscope-adapter';
import { OpenRouterAdapter } from './openrouter-adapter';
import { ModelScopeAdapter } from './modelscope-adapter';
import { OllamaAdapter } from './ollama-adapter';
import { RequestConfigError } from '../errors';

/**
 * Text model adapter registry implementation
 * Extends the abstract base class and provides text-model-specific implementations
 */
export class TextAdapterRegistry
  extends AbstractAdapterRegistry<
    ITextProviderAdapter,
    TextProvider,
    TextModel,
    TextModelConfig
  >
  implements ITextAdapterRegistry
{
  protected createUnknownProviderError(providerId: string): Error {
    return new RequestConfigError(
      `Unknown ${this.getProviderTypeDescription()}: ${providerId}`,
    );
  }

  protected createDynamicModelUnsupportedError(provider: TextProvider): Error {
    return new RequestConfigError(
      `${provider.name} does not support dynamic model fetching`,
    );
  }

  /**
   * Initialize and register all adapters
   */
  protected initializeAdapters(): void {
    // Register adapters
    const openaiAdapter = new OpenAIAdapter();
    const deepseekAdapter = new DeepseekAdapter();
    const siliconflowAdapter = new SiliconflowAdapter();
    const zhipuAdapter = new ZhipuAdapter();
    const anthropicAdapter = new AnthropicAdapter();
    const geminiAdapter = new GeminiAdapter();
    const dashscopeAdapter = new DashScopeAdapter();
    const openrouterAdapter = new OpenRouterAdapter();
    const modelscopeAdapter = new ModelScopeAdapter();
    const ollamaAdapter = new OllamaAdapter();

    this.adapters.set('openai', openaiAdapter);
    this.adapters.set('deepseek', deepseekAdapter);
    this.adapters.set('siliconflow', siliconflowAdapter);
    this.adapters.set('zhipu', zhipuAdapter);
    this.adapters.set('anthropic', anthropicAdapter);
    this.adapters.set('gemini', geminiAdapter);
    this.adapters.set('dashscope', dashscopeAdapter);
    this.adapters.set('openrouter', openrouterAdapter);
    this.adapters.set('modelscope', modelscopeAdapter);
    this.adapters.set('ollama', ollamaAdapter);

    // Preload the static model cache
    this.preloadStaticModels();
  }

  /**
   * Get Provider metadata from an adapter
   */
  protected getProviderFromAdapter(adapter: ITextProviderAdapter): TextProvider {
    return adapter.getProvider();
  }

  /**
   * Get the static model list from an adapter
   */
  protected getModelsFromAdapter(adapter: ITextProviderAdapter): TextModel[] {
    return adapter.getModels();
  }

  /**
   * Call the adapter's async model fetching method
   */
  protected async getModelsAsyncFromAdapter(
    adapter: ITextProviderAdapter,
    config: TextModelConfig
  ): Promise<TextModel[]> {
    if (!adapter.getModelsAsync) {
      const provider = adapter.getProvider();
      throw new RequestConfigError(
        `Adapter ${provider.name} does not implement getModelsAsync method`,
      );
    }
    return await adapter.getModelsAsync(config);
  }

  /**
   * Get the provider type description used in error messages
   */
  protected getProviderTypeDescription(): string {
    return 'text model provider';
  }
}

/**
 * Factory function: create a TextAdapterRegistry instance
 */
export const createTextAdapterRegistry = () => new TextAdapterRegistry();
