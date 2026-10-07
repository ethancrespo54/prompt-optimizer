import { AbstractImageProviderAdapter } from './abstract-adapter'
import { ImageError } from '../errors'
import type {
  ImageProvider,
  ImageModel,
  ImageRequest,
  ImageResult,
  ImageModelConfig,
  ImageParameterDefinition
} from '../types'
import { IMAGE_ERROR_CODES } from '../../../constants/error-codes'

export class OpenRouterImageAdapter extends AbstractImageProviderAdapter {
  protected normalizeBaseUrl(base: string): string {
    const trimmed = base.replace(/\/$/, '')
    if (/\/api\/v1$/.test(trimmed)) return trimmed
    if (/\/api$/.test(trimmed)) return `${trimmed}/v1`
    return `${trimmed}/api/v1`
  }
  getProvider(): ImageProvider {
    return {
      id: 'openrouter',
      name: 'OpenRouter',
      description: 'OpenRouter image generation service, dynamically fetching models that support image output',
      requiresApiKey: true,
      defaultBaseURL: 'https://openrouter.ai/api/v1',
      supportsDynamicModels: true,
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

  // Static preset models (as a fallback)
  getModels(): ImageModel[] {
    return [
      {
        id: 'google/gemini-2.5-flash-image',
        name: 'Gemini 2.5 Flash Image (Nano Banana)',
        description: 'Google Gemini 2.5 Flash image model (via OpenRouter), supporting text-to-image, image-to-image, and multi-turn conversational editing',
        providerId: 'openrouter',
        capabilities: {
          text2image: true,
          image2image: true,
          multiImage: true
        },
        parameterDefinitions: [],
        defaultParameterValues: {}
      },
      {
        id: 'openai/gpt-5-image-mini',
        name: 'GPT-5 Image Mini',
        description: 'OpenAI GPT-5 Image Mini (via OpenRouter), supporting text-to-image and image-to-image',
        providerId: 'openrouter',
        capabilities: {
          text2image: true,
          image2image: true,
          multiImage: true
        },
        parameterDefinitions: [],
        defaultParameterValues: {}
      }
    ]
  }

  /**
   * Dynamically fetch the list of models that support image output
   * Fetches all models via the OpenRouter /models API and filters those whose output_modalities include "image"
   */
  public async getModelsAsync(connectionConfig: Record<string, any>): Promise<ImageModel[]> {
    const apiKey = connectionConfig?.apiKey

    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {})
        }
      })

      if (!response.ok) {
        console.warn(`OpenRouter models API error: ${response.status}`)
        return this.getModels()
      }

      const data = await response.json()
      const models = data.data || []

      // Filter models that support image output
      const imageModels: ImageModel[] = models
        .filter((model: any) => {
          const outputModalities = model.architecture?.output_modalities || []
          return outputModalities.includes('image')
        })
        .map((model: any) => {
          const inputModalities = model.architecture?.input_modalities || []
          const supportsImageInput = inputModalities.includes('image')

          return {
            id: model.id,
            name: model.name || model.id,
            description: model.description || `${model.name} image generation model`,
            providerId: 'openrouter',
            capabilities: {
              text2image: true,
              image2image: supportsImageInput,
              multiImage: supportsImageInput
            },
            parameterDefinitions: [],
            defaultParameterValues: {}
          }
        })

      return imageModels.length > 0 ? imageModels : this.getModels()
    } catch (error) {
      console.warn('Failed to fetch OpenRouter models:', error)
      return this.getModels()
    }
  }

  protected getTestImageRequest(testType: 'text2image' | 'image2image'): Omit<ImageRequest, 'configId'> {
    if (testType === 'text2image') {
      return {
        prompt: 'a simple red flower',
        count: 1
      }
    }

    if (testType === 'image2image') {
      return {
        prompt: 'make this image more colorful',
        inputImage: {
          b64: AbstractImageProviderAdapter.TEST_IMAGE_BASE64.split(',')[1], // Strip the data URL prefix
          mimeType: 'image/png'
        },
        count: 1
      }
    }

    throw new ImageError(IMAGE_ERROR_CODES.UNSUPPORTED_TEST_TYPE, undefined, { testType })
  }

  protected getParameterDefinitions(_modelId: string): readonly ImageParameterDefinition[] {
    // OpenRouter exposes no user-level parameters; modalities is set automatically at API call time
    return []
  }

  protected getDefaultParameterValues(_modelId: string): Record<string, unknown> {
    // OpenRouter needs no user-level parameter configuration
    return {}
  }

  protected async doGenerate(request: ImageRequest, config: ImageModelConfig): Promise<ImageResult> {
    // Build the OpenRouter Chat API request
    const messages: any[] = [
      {
        role: 'user',
        content: request.prompt
      }
    ]

    // If there is an input image, add it to the message
    if (request.inputImage) {
      const imageContent = `data:${request.inputImage.mimeType || 'image/png'};base64,${request.inputImage.b64}`

      messages[0].content = [
        { type: 'text', text: request.prompt },
        { type: 'image_url', image_url: { url: imageContent } }
      ]
    }

    const payload = {
      model: config.modelId,
      messages,
      // modalities is an OpenRouter-internal parameter and is set to a fixed value
      modalities: ['image', 'text']
      // Do not merge user parameter overrides, since OpenRouter image generation needs no extra configuration
    }

    const response = await this.apiCall(config, '/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.connectionConfig?.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    // Parse the response
    const choice = response.choices?.[0]
    if (!choice) {
      throw new ImageError(IMAGE_ERROR_CODES.INVALID_RESPONSE_FORMAT)
    }

    const message = choice.message
    const images = message.images || []

    // Convert the image format
    const resultImages = images.map((img: any) => {
      const dataUrl = img.image_url?.url
      if (!dataUrl || !dataUrl.startsWith('data:')) {
        throw new ImageError(IMAGE_ERROR_CODES.INVALID_RESPONSE_FORMAT)
      }

      // Parse the data URL: data:image/png;base64,iVBORw0KGgo...
      const [header, base64Data] = dataUrl.split(',')
      const mimeMatch = header.match(/data:([^;]+)/)
      const mimeType = mimeMatch?.[1] || 'image/png'

      return {
        b64: base64Data,
        mimeType,
        url: dataUrl // Keep the original data URL
      }
    })

    return {
      images: resultImages,
      text: message.content || undefined,
      metadata: {
        providerId: 'openrouter',
        modelId: config.modelId,
        configId: config.id,
        finishReason: choice.finish_reason,
        usage: response.usage
      }
    }
  }

  private async apiCall(config: ImageModelConfig, endpoint: string, options: any) {
    const url = this.resolveEndpointUrl(config, endpoint)
    const response = await fetch(url, options)

    if (!response.ok) {
      // Pass errors through directly, no special handling
      const errorText = await response.text()
      throw new ImageError(
        IMAGE_ERROR_CODES.GENERATION_FAILED,
        `OpenRouter API error: ${response.status} ${response.statusText}${errorText ? ': ' + errorText : ''}`
      )
    }

    return await response.json()
  }
}
