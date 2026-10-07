import { GoogleGenAI } from '@google/genai'
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

export class GeminiImageAdapter extends AbstractImageProviderAdapter {
  getProvider(): ImageProvider {
    return {
      id: 'gemini',
      name: 'Google Gemini',
      description: 'Google Gemini image generation service',
      requiresApiKey: true,
      defaultBaseURL: 'https://generativelanguage.googleapis.com',
      supportsDynamicModels: false,
      apiKeyUrl: 'https://aistudio.google.com/apikey',
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
      {
        id: 'gemini-2.5-flash-image',
        name: 'Gemini 2.5 Flash Image',
        description: 'Google Gemini 2.5 Flash image generation model (Nano Banana), supporting text-to-image, image-to-image, and multi-image input',
        providerId: 'gemini',
        capabilities: {
          text2image: true,
          image2image: true,
          multiImage: true
        },
        parameterDefinitions: [],  // Gemini needs no user-configurable parameters
        defaultParameterValues: {
          outputMimeType: 'image/png'
        }
      },
      {
        id: 'gemini-3-pro-image-preview',
        name: 'Gemini 3 Pro Image',
        description: 'Google Gemini 3 Pro advanced image generation model (Nano Banana Pro), supporting high-resolution output and advanced text rendering',
        providerId: 'gemini',
        capabilities: {
          text2image: true,
          image2image: true,
          multiImage: true
        },
        parameterDefinitions: [],
        defaultParameterValues: {
          outputMimeType: 'image/png'
        }
      }
    ]
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

  protected getParameterDefinitions(_modelId: string): readonly any[] {
    // Base parameter definitions (if needed)
    return []
  }

  protected getDefaultParameterValues(_modelId: string): Record<string, unknown> {
    return {
      outputMimeType: 'image/png'
    }
  }

  protected async doGenerate(request: ImageRequest, config: ImageModelConfig): Promise<ImageResult> {
    const rawBaseUrl = config.connectionConfig?.baseURL?.trim() || ''
    const normalizedBaseUrl = rawBaseUrl ? this.normalizeBaseUrl(rawBaseUrl) : ''

    const genAI = normalizedBaseUrl
      ? new GoogleGenAI({
          apiKey: config.connectionConfig?.apiKey,
          httpOptions: {
            baseUrl: normalizedBaseUrl
          }
        })
      : new GoogleGenAI({ apiKey: config.connectionConfig?.apiKey })

    // Build the request content
    let contents: any
    if (request.inputImage) {
      // Image-to-image: use the array format
      contents = [
        { text: request.prompt },
        {
          inlineData: {
            mimeType: request.inputImage.mimeType || 'image/png',
            data: request.inputImage.b64
          }
        }
      ]
    } else {
      // Text-to-image: use the text directly
      contents = request.prompt
    }

    try {
      // Call the Gemini API
      const response = await genAI.models.generateContent({
        model: config.modelId,
        contents
      })

      // Parse the response
      const candidate = response.candidates?.[0]
      if (!candidate) {
        throw new ImageError(IMAGE_ERROR_CODES.INVALID_RESPONSE_FORMAT)
      }

      const parts = candidate.content?.parts || []
      const resultImages: any[] = []
      let responseText: string | undefined

      // Process the response parts
      for (const part of parts) {
        if (part.text) {
          responseText = part.text
        } else if (part.inlineData) {
          const imageData = part.inlineData.data
          const mimeType = part.inlineData.mimeType || 'image/png'

          // Build the data URL
          const dataUrl = `data:${mimeType};base64,${imageData}`

          resultImages.push({
            b64: imageData,
            mimeType,
            url: dataUrl
          })
        }
      }

      if (resultImages.length === 0) {
        throw new ImageError(IMAGE_ERROR_CODES.INVALID_RESPONSE_FORMAT)
      }

      return {
        images: resultImages,
        text: responseText,
        metadata: {
          providerId: 'gemini',
          modelId: config.modelId,
          configId: config.id,
          finishReason: candidate.finishReason,
          usage: response.usageMetadata
        }
      }
    } catch (error) {
      if (error instanceof ImageError) {
        throw error
      }

      const details = error instanceof Error ? error.message : String(error)
      throw new ImageError(IMAGE_ERROR_CODES.GENERATION_FAILED, `Gemini API error: ${details}`)
    }
  }
}
