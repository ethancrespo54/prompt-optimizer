import {
  IImageAdapterRegistry,
  IImageProviderAdapter,
  ImageProvider,
  ImageModel
} from '../types'
import { AbstractAdapterRegistry } from '../../adapters/abstract-registry'
import { ImageError } from '../errors'
import { IMAGE_ERROR_CODES } from '../../../constants/error-codes'
import { GeminiImageAdapter } from './gemini'
import { SeedreamImageAdapter } from './seedream'
import { OpenAIImageAdapter } from './openai'
import { SiliconFlowImageAdapter } from './siliconflow'
import { OpenRouterImageAdapter } from './openrouter'
import { DashScopeImageAdapter } from './dashscope'
import { ModelScopeImageAdapter } from './modelscope'
import { OllamaImageAdapter } from './ollama'

/**
 * Image adapter registry implementation
 * Extends the abstract base class and provides image-model-specific implementations
 */
export class ImageAdapterRegistry
  extends AbstractAdapterRegistry<
    IImageProviderAdapter,
    ImageProvider,
    ImageModel,
    Record<string, unknown>
  >
  implements IImageAdapterRegistry
{
  protected createUnknownProviderError(providerId: string): Error {
    return new ImageError(IMAGE_ERROR_CODES.PROVIDER_NOT_FOUND, undefined, { providerId })
  }

  protected createDynamicModelUnsupportedError(provider: ImageProvider): Error {
    return new ImageError(IMAGE_ERROR_CODES.DYNAMIC_MODELS_NOT_SUPPORTED, undefined, { providerName: provider.name })
  }

  /**
   * Initialize and register all adapters
   */
  protected initializeAdapters(): void {
    // Register all adapters
    const geminiAdapter = new GeminiImageAdapter()
    const seedreamAdapter = new SeedreamImageAdapter()
    const siliconflowAdapter = new SiliconFlowImageAdapter()
    const openaiAdapter = new OpenAIImageAdapter()
    const openrouterAdapter = new OpenRouterImageAdapter()
    const dashscopeAdapter = new DashScopeImageAdapter()
    const modelscopeAdapter = new ModelScopeImageAdapter()
    const ollamaAdapter = new OllamaImageAdapter()

    this.adapters.set('gemini', geminiAdapter)
    this.adapters.set('seedream', seedreamAdapter)
    this.adapters.set('siliconflow', siliconflowAdapter)
    this.adapters.set('openai', openaiAdapter)
    this.adapters.set('openrouter', openrouterAdapter)
    this.adapters.set('dashscope', dashscopeAdapter)
    this.adapters.set('modelscope', modelscopeAdapter)
    this.adapters.set('ollama', ollamaAdapter)

    // Preload the static model cache
    this.preloadStaticModels()
  }

  /**
   * Get Provider metadata from an adapter
   */
  protected getProviderFromAdapter(adapter: IImageProviderAdapter): ImageProvider {
    return adapter.getProvider()
  }

  /**
   * Get the static model list from an adapter
   */
  protected getModelsFromAdapter(adapter: IImageProviderAdapter): ImageModel[] {
    return adapter.getModels()
  }

  /**
   * Call the adapter's async model fetching method
   */
  protected async getModelsAsyncFromAdapter(
    adapter: IImageProviderAdapter,
    connectionConfig: Record<string, unknown>
  ): Promise<ImageModel[]> {
    return await adapter.getModelsAsync(connectionConfig)
  }

  /**
   * Get the provider type description used in error messages
   */
  protected getProviderTypeDescription(): string {
    return 'image provider'
  }
}

export const createImageAdapterRegistry = () => new ImageAdapterRegistry()
