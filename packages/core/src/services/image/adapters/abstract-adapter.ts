import type {
  IImageProviderAdapter,
  ImageProvider,
  ImageModel,
  ImageRequest,
  ImageResult,
  ImageModelConfig,
  ImageParameterDefinition
} from '../types'
import { ImageError } from '../errors'
import { IMAGE_ERROR_CODES } from '../../../constants/error-codes'

/**
 * Abstract base class for image provider adapters
 * Uses the template method pattern to provide unified validation and error handling
 */
export abstract class AbstractImageProviderAdapter implements IImageProviderAdapter {
  // Preset test image - managed in one place (a simple 64x64 red circle)
  protected static readonly TEST_IMAGE_BASE64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAOxAAADsQBlSsOGwAABGVJREFUeJztm01oXFUUx3/vzZtJMmnapPWjraZN/SCNrS200KKgIGhBXYhQcOHChYJbwY3gQnDhwoWgi4ILQRFciCCCC1sQwYKLii1YC1ppbWsb29Sm+Zg0mWTevHfvcefOm8nMm5lk3ryZvPwgvHvfO+fcO//cc8+79wZCQkJCQkJCQrZJAC5wC3gd+B54HfgCuO7ad4C/KsuLtR3E6gFvAH1AAiwDPwBLwBzwmXveaH4H8ASwF7yfawNYBL4Cfq7VPrMF3AVcB/qATdJ6x8CXwNEa+x6qY8BDwG/AADAKzAJZYMLN7zMfnCYA4G3gJDAJzAO9wPfAEPCKG7vE6sYAfAK8BOwDFoC7gVHgWWARsL0VX6wGYANYBnYCu4BjQMIVKyfdcxH4FrgJfOiOHnAM+BWwgZNAGhjw4rZZM4BF4BzwJ3DCjUWkqaXABeAi8CKQAl4DFoATwB1uxd8wCxQZ0XPBYuAJoO3DfOOZjhvAOeB5V6SdABYZWKkNwAbwDLAKnDZP7Qa+Av4Gzo/xH7IbuOJe+yTwByvBr+3VwxrrQKvkL+Bf4LE2VsU8cBGYIIKfuxRFJiYJAL9nE8zf/M2zW/Ll7zqgBBxoY1XMAmNE8HOXothNJiYJAL9hE9wdGF4IcVlmNPqfk4QsXFkCQu3fBrAjQNVsChFJ6CeS4CaZJqAnQNVsChFZeECCm0y9N0AAGElwk1lTSewNUDWbQkQS3GQaeIsAngBUsyn0E0lwk1lN6NeB3jZWxZOElIQHUC8J/UQS3GRqQh8E2hnfVBL7Atb9phGRhAckuMnUhD4A/N3GqlCShJ5NMMGJJLjJ1AT3AXOEVJS7Qcrb2zhGJMFNpiZ0P/APcG+AqtkUIpLgJlMT2gfs3SaP5N8EEnwP8Kf7gGFgO8x0xyUhK+Dre4K6o82g0o4h2zDTbVpHyMrLanxT9AV9a9VpQWgJV1HKBq4CqeKG6KbL9bbN3OVqw7q1W8gMlLOHh40TzE0hKwqjbO6qFJO5sn+OE9u0JnQGJiXJ1mKdR/gSF5Z9E0ywFaHbXGDEg4j8WjSC7hJyIcmP0SjMCWElwW0MEUH0s4k4zWuIyGKFmGDl5aBGdI/9/8mABDeZmtB7gV4iekKT2BNwD7DfYx4+W5JZd1fI0xDKq+qJakTi0xRzMKTGsR7eI+J9gptMTWg/+Ku6tSXhEt7hCTfgJXjX6wa8hBfwxVPgaLW8hNeUbDK7hVxuLcLVF0zSh3R+Q/hsKIr2+zZLT8jnJOQ7wn5H2O8I+x1hvyPsd4T9jrDfEfY7wn5H2O8I+x1hvyPsd4T9jrDfEfY7wn5H2O8I+x1hfZKwvyVd10ukBOvMNeAj4B9gAnh3+wfbEy9TZx+c7R+Ay3Q2v1ek3gJOufblO7/YnphrCfn8Yr0F7HOfgG35j5tOpK4+GWfA6y4y5ePa8t0v4wyY8pq/Am9tQ10hISEhISEhIaFo/gOE5C7Cek1g0wAAAABJRU5ErkJggg=="

  // Abstract methods that subclasses must implement
  public abstract getProvider(): ImageProvider
  public abstract getModels(): ImageModel[]
  protected abstract doGenerate(
    request: ImageRequest,
    config: ImageModelConfig
  ): Promise<ImageResult>

  // Test request builder that subclasses must implement
  protected abstract getTestImageRequest(testType: 'text2image' | 'image2image'): Omit<ImageRequest, 'configId'>

  // Newly added abstract method: used to build a default model object
  protected abstract getParameterDefinitions(modelId: string): readonly ImageParameterDefinition[]
  protected abstract getDefaultParameterValues(modelId: string): Record<string, unknown>

  // Build a default model object (supports any model ID)
  public buildDefaultModel(modelId: string): ImageModel {
    const provider = this.getProvider()

    return {
      id: modelId,
      name: modelId, // Use the ID as the name by default
      description: `Custom model ${modelId} for ${provider.name}`,
      providerId: provider.id,
      capabilities: {
        text2image: true,
        image2image: true,
        multiImage: true // All capabilities by default
      },
      parameterDefinitions: this.getParameterDefinitions(modelId),
      defaultParameterValues: this.getDefaultParameterValues(modelId)
    }
  }

  // Template method: unified generation flow
  public async generate(
    request: ImageRequest,
    config: ImageModelConfig
  ): Promise<ImageResult> {
    // 1. Validate that the request is legal
    this.validateRequest(request, config)

    // 2. Validate that the config is legal
    this.validateConfig(config)

    // 3. Call the concrete implementation (let the concrete adapter handle model-related logic)
    return await this.doGenerate(request, config)
  }

  // ===== Unified URL resolution and proxy wrapping =====

  // Normalize the base URL (fix the path suffix per provider conventions)
  protected normalizeBaseUrl(base: string): string {
    // Default empty implementation: no provider-specific normalization; keep what the caller passed in
    return base
  }

  // Returns only the final "base address" (accounting for the proxy); used by SDK-style adapters (e.g. Gemini)
  protected resolveBaseUrl(config: ImageModelConfig, _isStream: boolean = false): string {
    const rawBase = (config.connectionConfig?.baseURL || this.getProvider().defaultBaseURL || '').trim()
    if (!rawBase) return ''
    const normalizedBase = this.normalizeBaseUrl(rawBase)
    if (!normalizedBase) return ''

    return normalizedBase
  }

  // Returns the final "full target URL"; used by hand-written fetch-style adapters
  protected resolveEndpointUrl(
    config: ImageModelConfig,
    endpoint: string,
    _isStream: boolean = false
  ): string {
    const base = this.normalizeBaseUrl((config.connectionConfig?.baseURL || this.getProvider().defaultBaseURL || '').trim())
    const ep = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    const full = `${base}${ep}`

    return full
  }

  // Helper: get model info by modelId
  protected getModelById(modelId: string): ImageModel | undefined {
    return this.getModels().find(model => model.id === modelId)
  }

  // Default dynamic model fetching implementation (adapters without dynamic fetching can use it)
  public async getModelsAsync(_connectionConfig: Record<string, any>): Promise<ImageModel[]> {
    const provider = this.getProvider()
    if (!provider.supportsDynamicModels) {
      throw new ImageError(IMAGE_ERROR_CODES.DYNAMIC_MODELS_NOT_SUPPORTED, undefined, { providerName: provider.name })
    }
    // Subclasses should override this method
    return this.getModels()
  }

  // Default validation implementation (can be overridden by subclasses)
  protected validateRequest(request: ImageRequest, config: ImageModelConfig): void {
    // Basic validation: check required fields
    if (!request.prompt || !request.prompt.trim()) {
      throw new ImageError(IMAGE_ERROR_CODES.PROMPT_EMPTY)
    }

    if (!config.modelId) {
      throw new ImageError(IMAGE_ERROR_CODES.MODEL_ID_REQUIRED)
    }

    // Validation of specific model capabilities is left to the concrete adapter
  }

  protected validateConfig(config: ImageModelConfig): void {
    const provider = this.getProvider()

    if (provider.requiresApiKey && !config.connectionConfig?.apiKey) {
      throw new ImageError(IMAGE_ERROR_CODES.API_KEY_REQUIRED, undefined, { providerName: provider.name })
    }

    if (config.providerId !== provider.id) {
      throw new ImageError(IMAGE_ERROR_CODES.CONFIG_PROVIDER_MISMATCH, undefined, {
        configProviderId: config.providerId,
        adapterProviderId: provider.id
      })
    }
  }

  // Helper: validate the connection config structure
  protected validateConnectionConfig(connectionConfig: Record<string, any>): void {
    const provider = this.getProvider()
    const schema = provider.connectionSchema

    if (!schema) return

    // Validate required fields
    for (const field of schema.required) {
      if (!(field in connectionConfig)) {
        throw new ImageError(IMAGE_ERROR_CODES.CONNECTION_CONFIG_MISSING_FIELD, undefined, { field })
      }
    }

    // Validate field types
    for (const [field, expectedType] of Object.entries(schema.fieldTypes)) {
      if (field in connectionConfig) {
        const actualType = typeof connectionConfig[field]
        if (actualType !== expectedType) {
          throw new ImageError(IMAGE_ERROR_CODES.CONNECTION_CONFIG_INVALID_FIELD_TYPE, undefined, {
            field,
            expectedType,
            actualType
          })
        }
      }
    }
  }
}
