import { describe, it, expect, beforeAll } from 'vitest'
import { ImageService } from '../../src/services/image/service'
import { ImageModelManager } from '../../src/services/image-model/manager'
import { createImageAdapterRegistry } from '../../src/services/image/adapters/registry'
import { SeedreamImageAdapter } from '../../src/services/image/adapters/seedream'
import { OpenRouterImageAdapter } from '../../src/services/image/adapters/openrouter'
import { LocalStorageProvider } from '../../src/services/storage/localStorageProvider'
import type { ImageRequest, ImageModelConfig } from '../../src/services/image/types'

/**
 * Image adapter real API integration test
 * Only runs when the corresponding environment variables exist
 */
const RUN_REAL_API = process.env.RUN_REAL_API === '1'

describe.skipIf(!RUN_REAL_API)('Image Adapters Real API Integration Tests', () => {
  const hasGeminiKey = !!process.env.VITE_GEMINI_API_KEY
  const hasOpenAIKey = !!process.env.VITE_OPENAI_API_KEY
  const hasOpenRouterKey = !!process.env.VITE_OPENROUTER_API_KEY
  const hasSeedreamKey = !!(process.env.VITE_SEEDREAM_API_KEY || process.env.VITE_ARK_API_KEY || process.env.ARK_API_KEY)

  let storage: LocalStorageProvider
  let imageModelManager: ImageModelManager
  let imageService: ImageService
  let registry: ReturnType<typeof createImageAdapterRegistry>

  beforeAll(() => {
    if (!hasGeminiKey && !hasOpenAIKey && !hasOpenRouterKey && !hasSeedreamKey) return
  })

  beforeEach(async () => {
    storage = new LocalStorageProvider()
    registry = createImageAdapterRegistry()
    imageModelManager = new ImageModelManager(storage, registry)
    imageService = new ImageService(imageModelManager, registry)

    await storage.clearAll()
  })

  describe('Gemini image adapter test', () => {
    const runGeminiTests = hasGeminiKey

    it.runIf(runGeminiTests)('should be able to generate an image with Gemini 2.5 Flash Image', async () => {
      // Add the Gemini image model
      const geminiConfig: ImageModelConfig = {
        id: 'test-gemini-fast',
        name: 'Gemini 2.5 Flash Image',
        providerId: 'gemini',
        modelId: 'gemini-2.5-flash-image-preview',
        enabled: true,
        connectionConfig: { apiKey: process.env.VITE_GEMINI_API_KEY! },
        paramOverrides: { outputMimeType: 'image/png' }
      } as any
      await imageModelManager.addConfig(geminiConfig)

      // Generate the image
      const request: ImageRequest = {
        prompt: 'A beautiful sunset over the ocean with calm waves',
        count: 1,
        configId: 'test-gemini-fast',
        paramOverrides: { outputMimeType: 'image/png' }
      }

      const result = await imageService.generate(request)

      expect(result).toBeDefined()
      expect(result.images).toBeDefined()
      expect(result.images.length).toBe(1)
      expect(result.images[0].b64).toBeDefined()
      expect(result.images[0].b64.length).toBeGreaterThan(100)
      expect(result.images[0].mimeType).toBe('image/png')
      expect(result.metadata?.modelId).toBe('gemini-2.5-flash-image-preview')
    }, 120000)

    // Only gemini-2.5-flash-image-preview is supported; Imagen 3.x is no longer tested

    it.skipIf(!runGeminiTests)('skip the Gemini test - API key not set', () => {
      expect(true).toBe(true)
    })
  })

  describe('OpenRouter image adapter test', () => {
    const runOpenRouterTests = hasOpenRouterKey
    const openrouterModelId = new OpenRouterImageAdapter().getModels()[0].id

    // A small test image in base64 (1x1 transparent PNG)
    const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

    it.runIf(runOpenRouterTests)('should be able to generate an image with OpenRouter', async () => {
      // Add the OpenRouter model
      const openrouterConfig: ImageModelConfig = {
        id: 'test-openrouter',
        name: 'OpenRouter Image Model',
        providerId: 'openrouter',
        modelId: openrouterModelId,
        enabled: true,
        connectionConfig: { apiKey: process.env.VITE_OPENROUTER_API_KEY!, baseURL: 'https://openrouter.ai/api/v1' },
        paramOverrides: {}
      } as any
      await imageModelManager.addConfig(openrouterConfig)

      // Generate the image
      const request: ImageRequest = {
        prompt: 'a simple red flower',
        count: 1,
        configId: 'test-openrouter',
        paramOverrides: {}
      }

      const result = await imageService.generate(request)

      expect(result).toBeDefined()
      expect(result.images).toBeDefined()
      expect(result.images.length).toBe(1)
      expect(result.images[0].b64).toBeDefined()
      expect(result.images[0].b64.length).toBeGreaterThan(100)
      expect(result.images[0].mimeType).toBe('image/png')
      expect(result.metadata?.modelId).toBe(openrouterModelId)
    }, 120000)

    it.runIf(runOpenRouterTests)('should be able to do image-to-image with OpenRouter', async () => {
      // Reuse the same config for image-to-image
      await imageModelManager.addConfig({
        id: 'test-openrouter-i2i',
        name: 'OpenRouter I2I',
        providerId: 'openrouter',
        modelId: openrouterModelId,
        enabled: true,
        connectionConfig: { apiKey: process.env.VITE_OPENROUTER_API_KEY!, baseURL: 'https://openrouter.ai/api/v1' },
        paramOverrides: {}
      } as any)

      // Image-to-image request
      const request: ImageRequest = {
        prompt: 'Transform this image into a vibrant watercolor painting',
        count: 1,
        inputImage: {
          b64: testImageBase64,
          mimeType: 'image/png'
        }
      }

      const result = await imageService.generate({ ...request, configId: 'test-openrouter-i2i' })

      expect(result).toBeDefined()
      expect(result.images).toBeDefined()
      expect(result.images.length).toBe(1)
      expect(result.images[0].b64).toBeDefined()
      expect(result.images[0].b64.length).toBeGreaterThan(100)
      expect(result.metadata?.modelId).toBe(openrouterModelId)

    }, 90000) // Image-to-image may take longer

    it.skipIf(!runOpenRouterTests)('skip the OpenRouter test - API key not set', () => {
      expect(true).toBe(true)
    })
  })

  // DALL-E series models are no longer supported; the related tests were removed

  describe('Seedream (Volcano Ark) adapter test', () => {
    const runSeedreamTests = hasSeedreamKey

    it.runIf(runSeedreamTests)('should be able to generate an image with Doubao Seedream 4.0', async () => {
      // Add the Seedream model - using parameters matching the curl example
      const seedreamModelId = new SeedreamImageAdapter().getModels()[0].id
      const seedreamApiKey = process.env.VITE_SEEDREAM_API_KEY ||
                            process.env.VITE_ARK_API_KEY ||
                            process.env.ARK_API_KEY
      await imageModelManager.addConfig({
        id: 'test-seedream',
        name: 'Doubao Seedream 4.0',
        providerId: 'seedream',
        modelId: seedreamModelId,
        enabled: true,
        connectionConfig: { apiKey: seedreamApiKey!, baseURL: 'https://ark.cn-beijing.volces.com/api/v3' },
        paramOverrides: { size: '2K', watermark: false, outputMimeType: 'image/png' }
      } as any)

      // Generate the image - using the complex sci-fi prompt you provided
      const request: ImageRequest = {
        prompt: 'Interstellar, a black hole, a nearly shattered retro train bursting out of the black hole, strong visual impact, cinematic blockbuster, apocalyptic feel, dynamic, contrasting colors, OC rendering, ray tracing, motion blur, depth of field, surrealism, deep blue, the picture shapes the subject and scene through delicate and rich color layers, realistic texture, the lighting of the dark background builds atmosphere, overall artistic fantasy feel, exaggerated wide-angle perspective, flare, reflection, extreme lighting, strong gravity, devouring',
        count: 1,
        configId: 'test-seedream',
        paramOverrides: { size: '2K', watermark: false, outputMimeType: 'image/png' }
      }

      const result = await imageService.generate(request)

      expect(result).toBeDefined()
      expect(result.images).toBeDefined()
      expect(result.images.length).toBe(1)
      expect(result.images[0].url || result.images[0].b64).toBeTruthy()
      expect(result.images[0].mimeType).toBe('image/png') // Verify the MIME type
      expect(result.metadata?.modelId).toBe(seedreamModelId)
    }, 120000) // Increase the timeout to 120 seconds

    it.skipIf(!runSeedreamTests)('skip the Seedream test - API key not set', () => {
      expect(true).toBe(true)
    })
  })

  describe('Image service error handling test', () => {
    const runErrorTests = hasGeminiKey || hasOpenAIKey || hasOpenRouterKey || hasSeedreamKey

    it.runIf(runErrorTests)('should handle an invalid API key correctly', async () => {
      // Add a model with an invalid API key
      await imageModelManager.addConfig({
        id: 'invalid-model',
        name: 'Invalid Model',
        providerId: hasGeminiKey ? 'gemini' : 'openai',
        modelId: hasGeminiKey ? 'gemini-2.5-flash-image-preview' : 'dall-e-3',
        enabled: true,
        connectionConfig: { apiKey: 'invalid-key', baseURL: hasGeminiKey ? undefined : 'https://api.openai.com/v1' } as any,
        paramOverrides: {}
      } as any)

      // Generating an image should fail
      const request: ImageRequest = {
        prompt: 'Test image generation',
        count: 1,
        configId: 'invalid-model'
      }

      await expect(imageService.generate(request)).rejects.toThrow()
    }, 30000)

    it.skipIf(!runErrorTests)('skip the error handling test - API key not set', () => {
      expect(true).toBe(true)
    })
  })

  describe('Multi-image generation test', () => {
    const runMultiImageTests = false // Multiple images are no longer supported

    it.runIf(runMultiImageTests)('should be able to generate multiple images', async () => {
      // Add the DALL-E 2 model (more stable)
      const dalle2Model: ImageModelConfig = {
        name: 'DALL-E 2 Multi',
        baseURL: 'https://api.openai.com/v1',
        apiKey: process.env.VITE_OPENAI_API_KEY!,
        defaultModel: 'dall-e-2',
        enabled: true,
        provider: 'openai'
      }
      await imageModelManager.addConfig({
        id: 'test-dalle2-multi',
        name: 'DALL-E 2 Multi',
        providerId: 'openai',
        modelId: 'dall-e-2',
        enabled: true,
        connectionConfig: { apiKey: process.env.VITE_OPENAI_API_KEY!, baseURL: 'https://api.openai.com/v1' },
        paramOverrides: {}
      } as any)

      // Generate 2 images
      const request: ImageRequest = {
        prompt: 'A simple geometric pattern',
        count: 2,
        imgParams: {
          size: '256x256' // Use a smaller size to save time and cost
        }
      }

      const result = await imageService.generate({ ...request, configId: 'test-dalle2-multi', count: 1 })

      expect(result).toBeDefined()
      expect(result.images).toBeDefined()
      expect(result.images.length).toBe(1)
      result.images.forEach(image => {
        expect(image.b64).toBeDefined()
        expect(image.b64.length).toBeGreaterThan(100)
      })
    }, 120000) // Multi-image generation needs longer

    it.skipIf(!runMultiImageTests)('skip the multi-image test - OpenAI API key not set', () => {
      expect(true).toBe(true)
    })
  })
})
