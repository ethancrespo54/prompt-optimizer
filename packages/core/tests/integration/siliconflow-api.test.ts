import { describe, test, expect } from 'vitest'
import { SiliconFlowImageAdapter } from '../../src/services/image/adapters/siliconflow'
import type { ImageRequest, ImageModelConfig } from '../../src/services/image/types'

const RUN_REAL_API = process.env.RUN_REAL_API === '1'

describe.skipIf(!RUN_REAL_API)('SiliconFlowImageAdapter Integration Test', () => {
  test('should generate image with SiliconFlow API', async () => {
    const apiKey = process.env.VITE_SILICONFLOW_API_KEY
    if (!apiKey) return

    const adapter = new SiliconFlowImageAdapter()
    const models = adapter.getModels()
    expect(models.length).toBeGreaterThan(0)

    const modelId = models[0].id
    const config: ImageModelConfig = {
      id: 'siliconflow-integration',
      name: 'SiliconFlow Kolors Test',
      providerId: 'siliconflow',
      modelId,
      enabled: true,
      connectionConfig: { apiKey, baseURL: 'https://api.siliconflow.cn/v1' },
      paramOverrides: { image_size: '1024x1024', num_inference_steps: 20, guidance_scale: 7.5 }
    } as any

    const request: ImageRequest = {
      prompt: 'Interstellar, a black hole, a nearly shattered retro train bursting out of the black hole, steampunk style, sci-fi movie scene, high quality, rich in detail, 8K resolution, spectacular and shocking',
      count: 1,
      configId: 'siliconflow-integration',
      paramOverrides: { image_size: '1024x1024', num_inference_steps: 20, guidance_scale: 7.5 }
    }

    const result = await adapter.generate(request, config)

    expect(result).toBeDefined()
    expect(Array.isArray(result.images)).toBe(true)
    expect(result.images.length).toBe(1)
    expect(result.images[0]).toHaveProperty('url')
    expect(typeof result.images[0].url).toBe('string')
  }, 60000)
})
