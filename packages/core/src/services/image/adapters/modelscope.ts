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

/**
 * ModelScope image generation adapter
 *
 * API endpoint: https://api-inference.modelscope.cn/v1/images/generations
 * Free quota: 2000 calls per day
 * Docs: https://modelscope.cn/docs/model-service/API-Inference/intro
 *
 * Supported models:
 * - Tongyi-MAI/Z-Image-Turbo: 6B-parameter efficient image generation model (verified working)
 * - For other models, see the ModelScope docs for the current supported list
 * - Use buildDefaultModel() to create a config for any model ID for testing
 *
 * Environment variable support:
 * - MODELSCOPE_API_KEY: SDK Token (Docker environment, no VITE_ prefix)
 * - VITE_MODELSCOPE_API_KEY: SDK Token (development environment, Vite build)
 */
export class ModelScopeImageAdapter extends AbstractImageProviderAdapter {
  protected normalizeBaseUrl(base: string): string {
    const trimmed = base.replace(/\/$/, '')
    // Ensure the URL ends with /v1
    return /\/v1$/.test(trimmed) ? trimmed : `${trimmed}/v1`
  }

  getProvider(): ImageProvider {
    return {
      id: 'modelscope',
      name: 'ModelScope',
      description: 'ModelScope community image generation service, 2000 free calls per day',
      corsRestricted: true,
      requiresApiKey: true,
      defaultBaseURL: 'https://api-inference.modelscope.cn/v1',
      supportsDynamicModels: false,
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
        id: 'Tongyi-MAI/Z-Image-Turbo',
        name: 'Z-Image-Turbo',
        description: 'Z-Image-Turbo 6B-parameter efficient image generation model, strong at portraits and fast generation (within 10 steps)',
        providerId: 'modelscope',
        capabilities: {
          text2image: true,
          image2image: false,
          multiImage: false
        },
        parameterDefinitions: this.getDefaultParameterDefinitions(),
        defaultParameterValues: {
          size: '1024x1024',
          n: 1
        }
      }
    ]
  }

  private getDefaultParameterDefinitions(): ImageParameterDefinition[] {
    return [
      {
        name: 'size',
        labelKey: 'image.params.size.label',
        descriptionKey: 'image.params.size.description',
        type: 'string',
        defaultValue: '1024x1024',
        allowedValues: ['1024x1024', '1536x1024', '1024x1536']
      },
      {
        name: 'n',
        labelKey: 'image.params.count.label',
        descriptionKey: 'image.params.count.description',
        type: 'integer',
        defaultValue: 1,
        minValue: 1,
        maxValue: 4
      }
    ]
  }

  protected getTestImageRequest(testType: 'text2image' | 'image2image'): Omit<ImageRequest, 'configId'> {
    if (testType === 'text2image') {
      return {
        prompt: 'A simple red flower',
        count: 1
      }
    }

    throw new ImageError(IMAGE_ERROR_CODES.UNSUPPORTED_TEST_TYPE, undefined, { testType })
  }

  protected getParameterDefinitions(_modelId: string): readonly ImageParameterDefinition[] {
    return this.getDefaultParameterDefinitions()
  }

  protected getDefaultParameterValues(_modelId: string): Record<string, unknown> {
    return {
      size: '1024x1024',
      n: 1
    }
  }

  protected async doGenerate(request: ImageRequest, config: ImageModelConfig): Promise<ImageResult> {
    // The ModelScope adapter only supports text-to-image
    if (request.inputImage) {
      throw new ImageError(IMAGE_ERROR_CODES.MODEL_NOT_SUPPORT_IMAGE2IMAGE, undefined, { modelName: config.modelId })
    }

    return await this.generateImage(request, config)
  }

  private async generateImage(request: ImageRequest, config: ImageModelConfig): Promise<ImageResult> {
    const url = this.resolveEndpointUrl(config, '/images/generations')

    const merged: Record<string, any> = {
      ...config.paramOverrides,
      ...request.paramOverrides
    }

    const payload = {
      model: config.modelId,
      prompt: request.prompt,
      size: merged.size || '1024x1024',
      n: merged.n || request.count || 1
    }

    // Submit the async task
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.connectionConfig?.apiKey}`,
        'Content-Type': 'application/json',
        'X-ModelScope-Async-Mode': 'true' // Async mode
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      let errorMessage = `ModelScope API error: ${response.status} ${response.statusText}`
      try {
        const errorData = await response.json()
        if (errorData.message || errorData.error?.message) {
          errorMessage = errorData.message || errorData.error.message
        }
      } catch {
        // Ignore JSON parse errors
      }
      throw new ImageError(IMAGE_ERROR_CODES.GENERATION_FAILED, errorMessage)
    }

    const submitData = await response.json()
    const taskId = submitData.task_id

    if (!taskId) {
      throw new ImageError(IMAGE_ERROR_CODES.GENERATION_FAILED, 'No task_id received from ModelScope API')
    }

    // Poll the task status
    return await this.pollTaskResult(taskId, config, 120, 3000)
  }

  /**
   * Poll for the task result
   */
  private async pollTaskResult(
    taskId: string,
    config: ImageModelConfig,
    maxAttempts: number = 60,
    intervalMs: number = 2000
  ): Promise<ImageResult> {
    const taskUrl = this.resolveEndpointUrl(config, `/tasks/${taskId}`)

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, intervalMs))

      const response = await fetch(taskUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.connectionConfig?.apiKey}`,
          'X-ModelScope-Task-Type': 'image_generation'
        }
      })

      if (!response.ok) {
        // Try to parse the error response body to provide more detailed error info
        let errorMessage = `${response.status} ${response.statusText}`
        try {
          const errorData = await response.json()
          if (errorData.error || errorData.message) {
            errorMessage = errorData.error || errorData.message
          }
        } catch {
          // If the JSON cannot be parsed, use the default error message
        }
        throw new ImageError(IMAGE_ERROR_CODES.GENERATION_FAILED, `Failed to poll task status: ${errorMessage}`)
      }

      const data = await response.json()
      const status = data.task_status

      if (status === 'SUCCEED') {
        // Task succeeded, parse the result
        const outputImages = data.output_images || []
        if (outputImages.length === 0) {
          throw new ImageError(IMAGE_ERROR_CODES.INVALID_RESPONSE_FORMAT)
        }

        const images = outputImages.map((imageUrl: string) => ({
          url: imageUrl,
          mimeType: 'image/png'
        }))

        return {
          images,
          metadata: {
            providerId: 'modelscope',
            modelId: config.modelId,
            configId: config.id,
            taskId
          }
        }
      } else if (status === 'FAILED' || status === 'ERROR' || status === 'CANCELLED' || status === 'CANCELED') {
        // Task failed or was cancelled, extract the error message
        const errorMessage = data.error?.message || data.error || data.message || 'Unknown error'
        throw new ImageError(IMAGE_ERROR_CODES.GENERATION_FAILED, `Task ${status.toLowerCase()}: ${errorMessage}`)
      } else if (status !== 'PENDING' && status !== 'RUNNING' && status !== 'PROCESSING') {
        // Unknown terminal state, treat as failure
        throw new ImageError(IMAGE_ERROR_CODES.GENERATION_FAILED, `Unknown task status: ${status}`)
      }
      // task_status is PENDING, RUNNING, or PROCESSING; continue polling
    }

    throw new ImageError(IMAGE_ERROR_CODES.GENERATION_FAILED, `Task timeout after ${maxAttempts} attempts`)
  }

}
