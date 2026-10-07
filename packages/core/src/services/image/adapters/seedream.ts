import { AbstractImageProviderAdapter } from './abstract-adapter'
import { ImageError } from '../errors'
import type {
  ImageProvider,
  ImageModel,
  ImageRequest,
  ImageResult,
  ImageModelConfig
} from '../types'
import { IMAGE_ERROR_CODES } from '../../../constants/error-codes'

export class SeedreamImageAdapter extends AbstractImageProviderAdapter {
  protected normalizeBaseUrl(base: string): string {
    const trimmed = base.replace(/\/$/, '')
    if (/\/api\/v3$/.test(trimmed)) return trimmed
    if (/\/api$/.test(trimmed)) return `${trimmed}/v3`
    return `${trimmed}/api/v3`
  }
  getProvider(): ImageProvider {
    return {
      id: 'seedream',
      name: 'Seedream (Volcano Ark)',
      description: 'Volcano Ark Seedream image generation model',
      requiresApiKey: true,
      defaultBaseURL: 'https://ark.cn-beijing.volces.com/api/v3',
      supportsDynamicModels: false,  // Dynamic fetching is not supported
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
    // Return the static model list (only the 4.0 version is kept)
    return [
      {
        id: 'doubao-seedream-4-0-250828',
        name: 'Doubao Seedream 4.0',
        description: 'Volcano Ark Doubao Seedream 4.0 high-quality image generation model',
        providerId: 'seedream',
        capabilities: {
          text2image: true,
          image2image: true,
          multiImage: false
        },
        parameterDefinitions: [
          {
            name: 'size',
            labelKey: 'params.size.label',
            descriptionKey: 'params.size.description',
            type: 'string',
            defaultValue: '2K',
            allowedValues: ['1K', '2K', '4K', '1024x1024', '512x512', '768x768', '1024x768', '768x1024']
          },
          {
            name: 'sequential_image_generation',
            labelKey: 'params.sequentialGeneration.label',
            descriptionKey: 'params.sequentialGeneration.description',
            type: 'string',
            defaultValue: 'disabled',
            allowedValues: ['disabled']
          },
          {
            name: 'response_format',
            labelKey: 'params.responseFormat.label',
            descriptionKey: 'params.responseFormat.description',
            type: 'string',
            defaultValue: 'b64_json',
            allowedValues: ['b64_json', 'url']
          },
          {
            name: 'watermark',
            labelKey: 'params.watermark.label',
            descriptionKey: 'params.watermark.description',
            type: 'boolean',
            defaultValue: false
          }
        ],
        defaultParameterValues: {
          size: '2K',
          sequential_image_generation: 'disabled',
          response_format: 'b64_json',
          watermark: false
        }
      }
    ]
  }

  protected getParameterDefinitions(_modelId: string): readonly any[] {
    // All models use unified parameter definitions (only the 4.0 version is kept)
    return [
      {
        name: 'size',
        labelKey: 'params.size.label',
        descriptionKey: 'params.size.description',
        type: 'string',
        defaultValue: '2K',
        allowedValues: ['1K', '2K', '4K', '1024x1024', '512x512', '768x768', '1024x768', '768x1024']
      },
      {
        name: 'sequential_image_generation',
        labelKey: 'params.sequentialGeneration.label',
        descriptionKey: 'params.sequentialGeneration.description',
        type: 'string',
        defaultValue: 'disabled',
        allowedValues: ['disabled']
      },
      {
        name: 'response_format',
        labelKey: 'params.responseFormat.label',
        descriptionKey: 'params.responseFormat.description',
        type: 'string',
        defaultValue: 'b64_json',
        allowedValues: ['b64_json', 'url']
      },
      {
        name: 'watermark',
        labelKey: 'params.watermark.label',
        descriptionKey: 'params.watermark.description',
        type: 'boolean',
        defaultValue: false
      }
    ]
  }

  protected getDefaultParameterValues(_modelId: string): Record<string, unknown> {
    // All models use unified default values
    return {
      size: '2K',
      sequential_image_generation: 'disabled',
      response_format: 'b64_json',
      watermark: false
    }
  }

  // public async validateConnection(connectionConfig: Record<string, any>): Promise<boolean> {
  //   try {
  //     this.validateConnectionConfig(connectionConfig)
  //     return true
  //   } catch {
  //     return false
  //   }
  // }

  protected getTestImageRequest(testType: 'text2image' | 'image2image'): Omit<ImageRequest, 'configId'> {
    if (testType === 'text2image') {
      return {
        prompt: 'A flower',
        count: 1
      }
    }

    if (testType === 'image2image') {
      return {
        prompt: 'Make it red',
        count: 1,
        inputImage: {
          b64: AbstractImageProviderAdapter.TEST_IMAGE_BASE64.split(',')[1], // Strip the data: prefix
          mimeType: 'image/png'
        }
      }
    }

    throw new ImageError(IMAGE_ERROR_CODES.UNSUPPORTED_TEST_TYPE, undefined, { testType })
  }

  protected async doGenerate(request: ImageRequest, config: ImageModelConfig): Promise<ImageResult> {
    // Build the request body (hide the multi-image-related parameters and force a single image)
    const overrides: Record<string, any> = { ...config.paramOverrides, ...request.paramOverrides }
    delete overrides.n
    delete overrides.batch_size
    const payload: any = {
      model: config.modelId,
      prompt: request.prompt,
      sequential_image_generation: 'disabled', // Fixed to disable image sets
      ...overrides,
      n: 1
    }

    // Image-to-image support: add the image input
    if (request.inputImage?.b64) {
      const mime = request.inputImage.mimeType || 'image/png'
      payload.image = `data:${mime};base64,${request.inputImage.b64}`
    }

    // The generation count is fixed to 1 (multiple images are not currently supported)

    const response = await this.apiCall(config, '/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.connectionConfig?.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    const data = response

    // Parse the response
    const images = data.data?.map((item: any) => ({
      url: item.url,
      b64: item.b64_json,
      mimeType: 'image/png'
    })) || []

    if (images.length === 0) {
      throw new ImageError(IMAGE_ERROR_CODES.INVALID_RESPONSE_FORMAT)
    }

      return {
      images,
      metadata: {
        providerId: 'seedream',
        modelId: config.modelId,
        configId: config.id,
        usage: data.usage
      }
    }
  }

  private async apiCall(config: ImageModelConfig, endpoint: string, options: any) {
    const url = this.resolveEndpointUrl(config, endpoint)
    const response = await fetch(url, options)
    if (!response.ok) {
      let errorMessage: string
      try {
        const errorData = await response.json()
        errorMessage = errorData?.error?.message || errorData?.message || response.statusText
      } catch {
        errorMessage = response.statusText
      }
      throw new ImageError(IMAGE_ERROR_CODES.GENERATION_FAILED, `Seedream API error: ${response.status} ${errorMessage}`)
    }
    return await response.json()
  }
}
