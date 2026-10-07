import {
  IImageModelManager,
  ImageRequest,
  ImageResult,
  IImageService,
  IImageAdapterRegistry,
  ImageModelConfig,
  ImageModel,
  Text2ImageRequest,
  Image2ImageRequest
} from './types'
import { createImageAdapterRegistry } from './adapters/registry'
import { BaseError } from '../llm/errors'
import { IMAGE_ERROR_CODES } from '../../constants/error-codes'
import { mergeOverrides } from '../model/parameter-utils'
import { ImageError } from './errors'
import { toErrorWithCode } from '../../utils/error'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export class ImageService implements IImageService {
  private readonly registry: IImageAdapterRegistry
  private readonly imageModelManager: IImageModelManager

  constructor(imageModelManager: IImageModelManager, registry?: IImageAdapterRegistry) {
    this.imageModelManager = imageModelManager
    this.registry = registry ?? createImageAdapterRegistry()
  }

  async validateRequest(request: ImageRequest): Promise<void> {
    // Compatibility entry: still determines the mode by whether inputImage is provided.
    // Note: this is legacy behavior; callers are recommended to use the explicit validateText2ImageRequest/validateImage2ImageRequest.
    if (request.inputImage) {
      const image2image: Image2ImageRequest = { ...request, inputImage: request.inputImage }
      await this.validateImage2ImageRequest(image2image)
      return
    }

    const { inputImage: _inputImage, ...rest } = request
    const text2image: Text2ImageRequest = rest
    await this.validateText2ImageRequest(text2image)
  }

  async validateText2ImageRequest(request: Text2ImageRequest): Promise<void> {
    // Explicit text-to-image: inputImage is not allowed (even if the caller bypasses the type with any)
    const unsafeInputImage = (request as unknown as { inputImage?: unknown }).inputImage
    if (unsafeInputImage !== undefined && unsafeInputImage !== null) {
      throw new ImageError(IMAGE_ERROR_CODES.TEXT2IMAGE_INPUT_IMAGE_NOT_ALLOWED)
    }

    await this.validateBaseRequest(request)

    const config = await this.imageModelManager.getConfig(request.configId)
    if (!config) {
      throw new ImageError(IMAGE_ERROR_CODES.CONFIG_NOT_FOUND, undefined, { configId: request.configId })
    }

    // Capability check: prefer config.model (dynamic/custom models), with the static list as a fallback
    const configModel = config.model
    const staticModels = this.registry.getStaticModels(config.providerId)
    const staticModel = staticModels.find(m => m.id === config.modelId)
    const capabilities = configModel?.capabilities ?? staticModel?.capabilities
    const modelName = configModel?.name ?? staticModel?.name ?? config.modelId

    if (capabilities && !capabilities.text2image) {
      // For models that only support image-to-image, give clearer guidance
      if (capabilities.image2image) {
        throw new ImageError(IMAGE_ERROR_CODES.MODEL_ONLY_SUPPORTS_IMAGE2IMAGE_NEED_INPUT, undefined, { modelName })
      }
      throw new ImageError(IMAGE_ERROR_CODES.MODEL_NOT_SUPPORT_TEXT2IMAGE, undefined, { modelName })
    }
  }

  async validateImage2ImageRequest(request: Image2ImageRequest): Promise<void> {
    await this.validateBaseRequest(request)

    if (!request.inputImage) {
      throw new ImageError(IMAGE_ERROR_CODES.IMAGE2IMAGE_INPUT_IMAGE_REQUIRED)
    }

    // Force base64-only input images (urls are not supported)
    const unsafeUrl = (request.inputImage as unknown as { url?: unknown }).url
    if (typeof unsafeUrl === 'string' && unsafeUrl.trim()) {
      throw new ImageError(IMAGE_ERROR_CODES.INPUT_IMAGE_URL_NOT_SUPPORTED)
    }

    if (!request.inputImage.b64 || typeof request.inputImage.b64 !== 'string' || !request.inputImage.b64.trim()) {
      throw new ImageError(IMAGE_ERROR_CODES.INPUT_IMAGE_B64_REQUIRED)
    }

    // Reuse the existing input image format/size validation
    this.validateInputImage(request.inputImage)

    const config = await this.imageModelManager.getConfig(request.configId)
    if (!config) {
      throw new ImageError(IMAGE_ERROR_CODES.CONFIG_NOT_FOUND, undefined, { configId: request.configId })
    }

    // Capability check: prefer config.model (dynamic/custom models), with the static list as a fallback
    const configModel = config.model
    const staticModels = this.registry.getStaticModels(config.providerId)
    const staticModel = staticModels.find(m => m.id === config.modelId)
    const capabilities = configModel?.capabilities ?? staticModel?.capabilities
    const modelName = configModel?.name ?? staticModel?.name ?? config.modelId

    if (capabilities && !capabilities.image2image) {
      throw new ImageError(IMAGE_ERROR_CODES.MODEL_NOT_SUPPORT_IMAGE2IMAGE, undefined, { modelName })
    }
  }

  private async validateBaseRequest(request: Pick<ImageRequest, 'prompt' | 'configId' | 'count'>): Promise<void> {
    // Validate basic fields
    if (!request?.prompt || !request.prompt.trim()) {
      throw new ImageError(IMAGE_ERROR_CODES.PROMPT_EMPTY)
    }

    if (!request?.configId || !request.configId.trim()) {
      throw new ImageError(IMAGE_ERROR_CODES.CONFIG_ID_EMPTY)
    }

    // Validate that the config exists and is enabled
    const config = await this.imageModelManager.getConfig(request.configId)
    if (!config) {
      throw new ImageError(IMAGE_ERROR_CODES.CONFIG_NOT_FOUND, undefined, { configId: request.configId })
    }
    if (!config.enabled) {
      throw new ImageError(IMAGE_ERROR_CODES.CONFIG_NOT_ENABLED, undefined, { configName: config.name })
    }

    // Quick validation: only check that the provider exists (local operation)
    try {
      this.registry.getAdapter(config.providerId)
    } catch {
      throw new ImageError(IMAGE_ERROR_CODES.PROVIDER_NOT_FOUND, undefined, { providerId: config.providerId })
    }

    // Validate the generation count (only a single image is supported)
    const count = request.count ?? 1
    if (count !== 1) {
      throw new ImageError(IMAGE_ERROR_CODES.ONLY_SINGLE_IMAGE_SUPPORTED)
    }
  }

  private validateInputImage(inputImage: { b64: string; mimeType?: string }): void {
    // validateImage2ImageRequest has already verified that b64 is non-empty

    // Validate the input image format
    if (typeof inputImage.b64 !== 'string') {
      throw new ImageError(IMAGE_ERROR_CODES.INPUT_IMAGE_INVALID_FORMAT)
    }

    // Validate the input image MIME type and size
    const mime = (inputImage.mimeType || '').toLowerCase()
    if (mime && mime !== 'image/png' && mime !== 'image/jpeg') {
      throw new ImageError(IMAGE_ERROR_CODES.INPUT_IMAGE_UNSUPPORTED_MIME, undefined, { mimeType: inputImage.mimeType })
    }

    // Estimate the base64 size: every 4 characters ≈ 3 bytes, minus trailing padding
    const len = inputImage.b64.length
    const padding = (inputImage.b64.endsWith('==') ? 2 : inputImage.b64.endsWith('=') ? 1 : 0)
    const bytes = Math.floor((len * 3) / 4) - padding
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (bytes > maxSize) {
      throw new ImageError(IMAGE_ERROR_CODES.INPUT_IMAGE_TOO_LARGE, undefined, { maxSizeMB: 10 })
    }
  }

  async generateText2Image(request: Text2ImageRequest): Promise<ImageResult> {
    await this.validateText2ImageRequest(request)
    return await this.generateInternal(request)
  }

  async generateImage2Image(request: Image2ImageRequest): Promise<ImageResult> {
    await this.validateImage2ImageRequest(request)
    return await this.generateInternal(request)
  }

  async generate(request: ImageRequest): Promise<ImageResult> {
    // Compatibility entry: keep the original behavior
    await this.validateRequest(request)
    return await this.generateInternal(request)
  }

  private async generateInternal(request: ImageRequest): Promise<ImageResult> {
    // Get the config
    const config = await this.imageModelManager.getConfig(request.configId)
    if (!config) {
      throw new ImageError(IMAGE_ERROR_CODES.CONFIG_NOT_FOUND, undefined, { configId: request.configId })
    }

    // Get the adapter
    const adapter = this.registry.getAdapter(config.providerId)
    const runtimeConfig = this.prepareRuntimeConfig(config)
    const runtimeRequest = this.prepareRuntimeRequest(request, runtimeConfig)

    try {
      // Call the adapter to generate
      const result = await adapter.generate(runtimeRequest, runtimeConfig)

      // Ensure the result contains complete metadata
      if (!result.metadata) {
        result.metadata = {
          providerId: config.providerId,
          modelId: config.modelId,
          configId: config.id
        }
      } else {
        // Add provenance info
        result.metadata.providerId = config.providerId
        result.metadata.modelId = config.modelId
        result.metadata.configId = config.id
      }

      return result
    } catch (error) {
      // Preserve structured errors (code/params) thrown by service/adapters.
      // Only wrap truly unknown errors as GENERATION_FAILED.
      if (error instanceof BaseError) {
        throw error
      }
      if (isRecord(error) && typeof error.code === 'string') {
        throw toErrorWithCode(error)
      }
      // Note: do not concatenate the underlying message for the user; leave it to the UI to translate via code+params.
      const details = error instanceof Error ? error.message : String(error)
      throw new ImageError(IMAGE_ERROR_CODES.GENERATION_FAILED, details, { details })
    }
  }


  // New: connection test (does not require the config to be saved)
  async testConnection(config: ImageModelConfig): Promise<ImageResult> {
    // Build a minimal request (choose a text or image test based on model capabilities)
    const adapter = this.registry.getAdapter(config.providerId)
    const runtimeConfig = this.prepareRuntimeConfig(config)
    const caps = (config.model?.capabilities) || this.registry.getStaticModels(config.providerId).find(m => m.id === config.modelId)?.capabilities || { text2image: true }
    const testType: 'text2image' | 'image2image' = caps.text2image ? 'text2image' : 'image2image'
    const maybeTestRequestProvider = adapter as unknown as {
      getTestImageRequest?: (type: 'text2image' | 'image2image') => Partial<ImageRequest>
    }
    const baseReq = typeof maybeTestRequestProvider.getTestImageRequest === 'function'
      ? maybeTestRequestProvider.getTestImageRequest(testType)
      : { prompt: 'hello', count: 1 }

    const request: ImageRequest = {
      prompt: baseReq.prompt ?? 'hello',
      configId: config.id || 'test',
      count: baseReq.count ?? 1,
      inputImage: baseReq.inputImage,
      paramOverrides: baseReq.paramOverrides
    }

    // Enforced: if the connection test uses image2image, it must use base64 input (urls are not supported)
    if (testType === 'image2image') {
      const unsafeInputImage = (request as unknown as { inputImage?: unknown }).inputImage
      const unsafeB64 = isRecord(unsafeInputImage) ? unsafeInputImage.b64 : undefined
      const unsafeUrl = isRecord(unsafeInputImage) ? unsafeInputImage.url : undefined

      if (typeof unsafeB64 !== 'string' || !unsafeB64.trim()) {
        throw new ImageError(IMAGE_ERROR_CODES.INPUT_IMAGE_B64_REQUIRED)
      }
      if (typeof unsafeUrl === 'string' && unsafeUrl.trim()) {
        throw new ImageError(IMAGE_ERROR_CODES.INPUT_IMAGE_URL_NOT_SUPPORTED)
      }
    }

    const runtimeRequest = this.prepareRuntimeRequest(request, runtimeConfig)
    // Call the adapter directly, bypassing the storage lookup in imageModelManager
    try {
      return await adapter.generate(runtimeRequest, runtimeConfig)
    } catch (error) {
      if (error instanceof BaseError) {
        throw error
      }
      if (isRecord(error) && typeof error.code === 'string') {
        throw toErrorWithCode(error)
      }
      const details = error instanceof Error ? error.message : String(error)
      throw new ImageError(IMAGE_ERROR_CODES.GENERATION_FAILED, details, { details })
    }
  }

  // New: get dynamic models
  async getDynamicModels(providerId: string, connectionConfig: Record<string, any>): Promise<ImageModel[]> {
    return await this.registry.getDynamicModels(providerId, connectionConfig)
  }

  private prepareRuntimeConfig(config: ImageModelConfig): ImageModelConfig {
    const schema = config.model?.parameterDefinitions ?? []

    // Merge parameters: supports the legacy-format customParamOverrides (backward compatible)
    // Priority: requestOverrides > customOverrides
    const mergedOverrides = mergeOverrides({
      schema,
      includeDefaults: false,
      customOverrides: config.customParamOverrides,  // 🔧 Legacy-format compatibility: custom parameters
      requestOverrides: config.paramOverrides        // Current parameters (built-in + possibly already-merged custom ones)
    })

    return {
      ...config,
      paramOverrides: mergedOverrides
    }
  }

  private prepareRuntimeRequest(request: ImageRequest, config: ImageModelConfig): ImageRequest {
    // Final safeguard: never pass a url input image through to the adapter.
    const unsafeInputImage = (request as unknown as { inputImage?: unknown }).inputImage
    if (isRecord(unsafeInputImage) && typeof unsafeInputImage.url === 'string' && unsafeInputImage.url.trim()) {
      throw new ImageError(IMAGE_ERROR_CODES.INPUT_IMAGE_URL_NOT_SUPPORTED)
    }

    const schema = config.model?.parameterDefinitions ?? []

    // Request-level parameter overrides must also account for the legacy format
    const unsafeCustomOverrides = (request as unknown as { customParamOverrides?: unknown }).customParamOverrides
    const customOverrides = isRecord(unsafeCustomOverrides) ? unsafeCustomOverrides : undefined
    const sanitized = mergeOverrides({
      schema,
      includeDefaults: false,
      customOverrides, // Legacy field compatibility (backward compatible)
      requestOverrides: request.paramOverrides
    })

    const normalizedOverrides =
      Object.keys(sanitized).length > 0 ? sanitized : undefined

    return {
      ...request,
      paramOverrides: normalizedOverrides
    }
  }
}

export const createImageService = (imageModelManager: IImageModelManager, registry?: IImageAdapterRegistry) => new ImageService(imageModelManager, registry)
