import type { TextModel, TextProvider } from '../types'
import { OpenAIAdapter } from './openai-adapter'

interface ModelOverride {
  id: string
  name: string
  description: string
  capabilities?: Partial<TextModel['capabilities']>
  defaultParameterValues?: Record<string, unknown>
}

/**
 * ModelScope static model definitions
 * Reference: https://modelscope.cn/docs/model-service/API-Inference/intro
 */
const MODELSCOPE_STATIC_MODELS: ModelOverride[] = [
  {
    id: 'Qwen/Qwen3-Coder-480B-A35B-Instruct',
    name: 'Qwen3-Coder-480B-A35B-Instruct',
    description: 'Tongyi Qianwen Qwen/Qwen3-Coder-480B-A35B-Instruct, optimized for code generation and understanding',
    capabilities: {
      supportsTools: false, // Tool call compatibility on ModelScope is unverified
      supportsReasoning: false,
      maxContextLength: 131072
    }
  }
]

/**
 * ModelScope adapter
 * Implemented on top of the OpenAI-compatible API
 *
 * API endpoint: https://api-inference.modelscope.cn/v1
 * Free quota: 2000 calls per day
 * Docs: https://modelscope.cn/docs/model-service/API-Inference/intro
 *
 * Environment variable support:
 * - MODELSCOPE_API_KEY: SDK Token (Docker environment, no VITE_ prefix)
 * - VITE_MODELSCOPE_API_KEY: SDK Token (development environment, Vite build)
 */
export class ModelScopeAdapter extends OpenAIAdapter {
  public getProvider(): TextProvider {
    return {
      id: 'modelscope',
      name: 'ModelScope',
      description: 'Alibaba Cloud ModelScope community API inference service, 2000 free calls per day',
      requiresApiKey: true,
      defaultBaseURL: 'https://api-inference.modelscope.cn/v1',
      supportsDynamicModels: true,
      apiKeyUrl: 'https://modelscope.cn/my/myaccesstoken',
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

  public getModels(): TextModel[] {
    return MODELSCOPE_STATIC_MODELS.map((definition) => {
      const baseModel = this.buildDefaultModel(definition.id)

      return {
        ...baseModel,
        name: definition.name,
        description: definition.description,
        capabilities: {
          ...baseModel.capabilities,
          ...(definition.capabilities ?? {})
        },
        defaultParameterValues: definition.defaultParameterValues
          ? {
              ...(baseModel.defaultParameterValues ?? {}),
              ...definition.defaultParameterValues
            }
          : baseModel.defaultParameterValues
      }
    })
  }
}
