import { AbstractImageProviderAdapter } from './abstract-adapter'
import type {
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
 * Alibaba Bailian (DashScope) image adapter
 * Supports the Tongyi Qianwen image models (Qwen-Image text-to-image and Qwen-Image-Edit image-to-image)
 *
 * API endpoint: https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation
 * Docs:
 *   - Text-to-image: https://help.aliyun.com/zh/model-studio/qwen-image-api
 *   - Image-to-image: https://help.aliyun.com/zh/model-studio/qwen-image-edit-guide
 */
export class DashScopeImageAdapter extends AbstractImageProviderAdapter {
  protected normalizeBaseUrl(base: string): string {
    // The Alibaba Bailian image API uses a different endpoint structure
    const trimmed = base.replace(/\/$/, '')
    // If it already contains the full path, return it directly
    if (trimmed.includes('/api/v1/services')) {
      return trimmed
    }
    // Return the base URL by default
    return trimmed
  }

  getProvider(): ImageProvider {
    return {
      id: 'dashscope',
      name: 'Alibaba Bailian',
      description: 'Alibaba Cloud Bailian image generation service, supporting the Tongyi Qianwen image models (text-to-image / image-to-image)',
      corsRestricted: true,
      requiresApiKey: true,
      defaultBaseURL: 'https://dashscope.aliyuncs.com',
      supportsDynamicModels: false,
      apiKeyUrl: 'https://bailian.console.aliyun.com/#/api-key',
      connectionSchema: {
        required: ['apiKey'],
        optional: ['baseURL'],
        fieldTypes: {
          apiKey: 'string',
          baseURL: 'string'
        }
      }
    }
  }

  getModels(): ImageModel[] {
    return [
      // Qwen-Image text-to-image model
      {
        id: 'qwen-image',
        name: 'Tongyi Qianwen Image',
        description: 'Tongyi Qianwen text-to-image model, strong at complex text rendering, supporting multi-line layouts and paragraph-level text generation',
        providerId: 'dashscope',
        capabilities: {
          text2image: true,
          image2image: false,
          multiImage: false
        },
        parameterDefinitions: this.getQwenImageParameterDefinitions(),
        defaultParameterValues: {
          size: '1328*1328',
          prompt_extend: true,
          watermark: false
        }
      },
      // Qwen-Image-Edit image-to-image model
      {
        id: 'qwen-image-edit',
        name: 'Tongyi Qianwen Image Edit',
        description: 'Tongyi Qianwen image editing model, supporting multi-image input; can modify text, add or remove objects, change actions, and transfer styles',
        providerId: 'dashscope',
        capabilities: {
          text2image: false,
          image2image: true,
          multiImage: true
        },
        parameterDefinitions: this.getQwenImageEditParameterDefinitions(),
        defaultParameterValues: {
          prompt_extend: true,
          watermark: false
        }
      }
    ]
  }

  private getQwenImageParameterDefinitions(): ImageParameterDefinition[] {
    return [
      {
        name: 'size',
        labelKey: 'image.params.size.label',
        descriptionKey: 'image.params.size.description',
        type: 'string',
        defaultValue: '1328*1328',
        allowedValues: ['1664*928', '1472*1140', '1328*1328', '1140*1472', '928*1664']
      },
      {
        name: 'negative_prompt',
        labelKey: 'image.params.negativePrompt.label',
        descriptionKey: 'image.params.negativePrompt.description',
        type: 'string',
        defaultValue: ''
      },
      {
        name: 'prompt_extend',
        labelKey: 'image.params.promptExtend.label',
        descriptionKey: 'image.params.promptExtend.description',
        type: 'boolean',
        defaultValue: true
      },
      {
        name: 'watermark',
        labelKey: 'image.params.watermark.label',
        descriptionKey: 'image.params.watermark.description',
        type: 'boolean',
        defaultValue: false
      },
      {
        name: 'seed',
        labelKey: 'image.params.seed.label',
        descriptionKey: 'image.params.seed.description',
        type: 'integer',
        minValue: 0,
        maxValue: 2147483647
      }
    ]
  }

  /**
   * Get the Qwen-Image-Edit image-to-image parameter definitions
   */
  private getQwenImageEditParameterDefinitions(): ImageParameterDefinition[] {
    return [
      {
        name: 'negative_prompt',
        labelKey: 'image.params.negativePrompt.label',
        descriptionKey: 'image.params.negativePrompt.description',
        type: 'string',
        defaultValue: ''
      },
      {
        name: 'prompt_extend',
        labelKey: 'image.params.promptExtend.label',
        descriptionKey: 'image.params.promptExtend.description',
        type: 'boolean',
        defaultValue: true
      },
      {
        name: 'watermark',
        labelKey: 'image.params.watermark.label',
        descriptionKey: 'image.params.watermark.description',
        type: 'boolean',
        defaultValue: false
      },
      {
        name: 'seed',
        labelKey: 'image.params.seed.label',
        descriptionKey: 'image.params.seed.description',
        type: 'integer',
        minValue: 0,
        maxValue: 2147483647
      }
    ]
  }

  protected getTestImageRequest(testType: 'text2image' | 'image2image'): Omit<ImageRequest, 'configId'> {
    if (testType === 'text2image') {
      return {
        prompt: 'A simple red flower',
        count: 1,
        paramOverrides: {
        }
      }
    }

    throw new ImageError(IMAGE_ERROR_CODES.UNSUPPORTED_TEST_TYPE, undefined, { testType })
  }

  protected getParameterDefinitions(modelId: string): readonly ImageParameterDefinition[] {
    if (this.isQwenImageEditModel(modelId)) {
      return this.getQwenImageEditParameterDefinitions()
    }
    return this.getQwenImageParameterDefinitions()
  }

  protected getDefaultParameterValues(modelId: string): Record<string, unknown> {
    if (this.isQwenImageEditModel(modelId)) {
      return {
        prompt_extend: true,
        watermark: false
      }
    }
    return {
      size: '1328*1328',
      prompt_extend: true,
      watermark: false
    }
  }

  private isQwenImageEditModel(modelId: string): boolean {
    return modelId.startsWith('qwen-image-edit')
  }

  protected async doGenerate(request: ImageRequest, config: ImageModelConfig): Promise<ImageResult> {
    if (this.isQwenImageEditModel(config.modelId)) {
      // Qwen-Image-Edit image-to-image uses the synchronous API
      return await this.generateWithQwenImageEdit(request, config)
    }
    // Qwen-Image text-to-image uses the synchronous API
    return await this.generateWithQwenImage(request, config)
  }

  /**
   * Generate an image with the Qwen-Image model (synchronous interface)
   */
  private async generateWithQwenImage(request: ImageRequest, config: ImageModelConfig): Promise<ImageResult> {
    const baseUrl = config.connectionConfig?.baseURL || this.getProvider().defaultBaseURL
    const url = `${baseUrl}/api/v1/services/aigc/multimodal-generation/generation`

    const merged: Record<string, any> = {
      ...config.paramOverrides,
      ...request.paramOverrides
    }

    const payload = {
      model: config.modelId,
      input: {
        messages: [
          {
            role: 'user',
            content: [
              {
                text: request.prompt
              }
            ]
          }
        ]
      },
      parameters: {
        size: merged.size || '1328*1328',
        ...(merged.negative_prompt ? { negative_prompt: merged.negative_prompt } : {}),
        ...(merged.prompt_extend !== undefined ? { prompt_extend: merged.prompt_extend } : {}),
        ...(merged.watermark !== undefined ? { watermark: merged.watermark } : {}),
        ...(merged.seed !== undefined ? { seed: merged.seed } : {})
      }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.connectionConfig?.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      let errorMessage = `DashScope API error: ${response.status} ${response.statusText}`
      try {
        const errorData = await response.json()
        if (errorData.message) {
          errorMessage = errorData.message
        }
      } catch {
        // Ignore JSON parse errors
      }
      throw new ImageError(IMAGE_ERROR_CODES.GENERATION_FAILED, errorMessage)
    }

    const data = await response.json()

    // Check for errors
    if (data.code) {
      throw new ImageError(IMAGE_ERROR_CODES.GENERATION_FAILED, data.message || `DashScope API error: ${data.code}`)
    }

    // Parse the Qwen-Image response
    const choices = data.output?.choices || []
    if (choices.length === 0) {
      throw new ImageError(IMAGE_ERROR_CODES.INVALID_RESPONSE_FORMAT)
    }

    // Take only the first image
    const choice = choices[0]
    const content = choice.message?.content || []
    const imageContent = content.find((c: any) => c.image)
    if (!imageContent) {
      throw new ImageError(IMAGE_ERROR_CODES.INVALID_RESPONSE_FORMAT)
    }

    return {
      images: [{
        url: imageContent.image,
        mimeType: 'image/png'
      }],
      metadata: {
        providerId: 'dashscope',
        modelId: config.modelId,
        configId: config.id,
        usage: data.usage
      }
    }
  }

  /**
   * Edit an image with the Qwen-Image-Edit model (synchronous interface)
   */
  private async generateWithQwenImageEdit(request: ImageRequest, config: ImageModelConfig): Promise<ImageResult> {
    const baseUrl = config.connectionConfig?.baseURL || this.getProvider().defaultBaseURL
    const url = `${baseUrl}/api/v1/services/aigc/multimodal-generation/generation`

    const merged: Record<string, any> = {
      ...config.paramOverrides,
      ...request.paramOverrides
    }

    // Build the content array, containing the input image and the text prompt
    const content: Array<{ image?: string; text?: string }> = []

    // Add the input image
    if (request.inputImage) {
      // DashScope's image field requires: a public URL or data:{mime};base64,{data}.
      // This project only supports local base64, so it is always assembled into a data URL here.
      const mimeType = request.inputImage.mimeType || 'image/png'
      const b64 = request.inputImage.b64 || ''
      const dataUrl = b64.startsWith('data:') ? b64 : `data:${mimeType};base64,${b64}`
      content.push({ image: dataUrl })
    }

    // Add the text prompt
    content.push({ text: request.prompt })

    const payload = {
      model: config.modelId,
      input: {
        messages: [
          {
            role: 'user',
            content
          }
        ]
      },
      parameters: {
        ...(merged.negative_prompt ? { negative_prompt: merged.negative_prompt } : {}),
        ...(merged.prompt_extend !== undefined ? { prompt_extend: merged.prompt_extend } : {}),
        ...(merged.watermark !== undefined ? { watermark: merged.watermark } : {}),
        ...(merged.seed !== undefined ? { seed: merged.seed } : {})
      }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.connectionConfig?.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      let errorMessage = `DashScope API error: ${response.status} ${response.statusText}`
      try {
        const errorData = await response.json()
        if (errorData.message) {
          errorMessage = errorData.message
        }
      } catch {
        // Ignore JSON parse errors
      }
      throw new ImageError(IMAGE_ERROR_CODES.GENERATION_FAILED, errorMessage)
    }

    const data = await response.json()

    // Check for errors
    if (data.code) {
      throw new ImageError(IMAGE_ERROR_CODES.GENERATION_FAILED, data.message || `DashScope API error: ${data.code}`)
    }

    // Parse the response - take only the first image
    const choices = data.output?.choices || []
    if (choices.length === 0) {
      throw new ImageError(IMAGE_ERROR_CODES.INVALID_RESPONSE_FORMAT)
    }

    // Find the first image
    for (const choice of choices) {
      const contentArr = choice.message?.content || []
      for (const item of contentArr) {
        if (item.image) {
          return {
            images: [{
              url: item.image,
              mimeType: 'image/png'
            }],
            metadata: {
              providerId: 'dashscope',
              modelId: config.modelId,
              configId: config.id,
              usage: data.usage
            }
          }
        }
      }
    }

    throw new ImageError(IMAGE_ERROR_CODES.INVALID_RESPONSE_FORMAT)
  }
}
