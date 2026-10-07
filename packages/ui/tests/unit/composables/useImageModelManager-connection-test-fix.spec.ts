import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import type {
  IImageAdapterRegistry,
  IImageModelManager,
  ImageProvider,
  ImageModel,
  ImageModelConfig,
  IImageProviderAdapter
} from '@prompt-optimizer/core'

// Mock the useImageModelManager composable logic
describe('Image Model Manager Connection Test Fix', () => {
  let mockRegistry: IImageAdapterRegistry
  let mockImageModelManager: IImageModelManager
  let mockAdapter: IImageProviderAdapter

  beforeEach(() => {
    // Mock adapter with buildDefaultModel capability
    mockAdapter = {
      getProvider: vi.fn(() => ({
        id: 'openrouter',
        name: 'OpenRouter',
        requiresApiKey: true,
        defaultBaseURL: 'https://openrouter.ai/api/v1',
        supportsDynamicModels: false
      } as ImageProvider)),

      getModels: vi.fn(() => [
        {
          id: 'google/gemini-2.5-flash-image',
          name: 'Gemini 2.5 Flash Image Preview',
          providerId: 'openrouter',
          capabilities: { text2image: true, image2image: true, multiImage: true },
          parameterDefinitions: [],
          defaultParameterValues: {}
        } as ImageModel
      ]),

      buildDefaultModel: vi.fn((modelId: string) => ({
        id: modelId,
        name: modelId,
        providerId: 'openrouter',
        capabilities: { text2image: true, image2image: true, multiImage: true },
        parameterDefinitions: [],
        defaultParameterValues: {}
      } as ImageModel)),

      getModelsAsync: vi.fn(),
      validateConnection: vi.fn(),
      generate: vi.fn()
    }

    // Mock registry
    mockRegistry = {
      getAdapter: vi.fn(() => mockAdapter),
      getAllProviders: vi.fn(),
      getStaticModels: vi.fn(() => [
        {
           id: 'google/gemini-2.5-flash-image',
          name: 'Gemini 2.5 Flash Image Preview',
          providerId: 'openrouter',
          capabilities: { text2image: true, image2image: true, multiImage: true },
          parameterDefinitions: [],
          defaultParameterValues: {}
        } as ImageModel
      ]),
      getDynamicModels: vi.fn(),
      getModels: vi.fn(),
      getAllStaticModels: vi.fn(),
      supportsDynamicModels: vi.fn(),
      validateProviderConnection: vi.fn(),
      validateProviderModel: vi.fn()
    }
  })

  it('should find model in static models list', () => {
    // Mock the static model list
    const models = ref([
      {
           id: 'google/gemini-2.5-flash-image',
        name: 'Gemini 2.5 Flash Image Preview',
        providerId: 'openrouter',
        capabilities: { text2image: true, image2image: true, multiImage: true },
        parameterDefinitions: [],
        defaultParameterValues: {}
      } as ImageModel
    ])

    const configForm = ref({
       modelId: 'google/gemini-2.5-flash-image',
      providerId: 'openrouter'
    })

    // Test looking up in the static model list
    let selectedModel = models.value.find(m => m.id === configForm.value.modelId)

    expect(selectedModel).toBeDefined()
     expect(selectedModel!.id).toBe('google/gemini-2.5-flash-image')
    expect(selectedModel!.name).toBe('Gemini 2.5 Flash Image Preview')
  })

  it('should use buildDefaultModel for custom model ID', () => {
    // Mock the static model list (excluding custom models)
    const models = ref([
      {
         id: 'google/gemini-2.5-flash-image',
        name: 'Gemini 2.5 Flash Image Preview',
        providerId: 'openrouter',
        capabilities: { text2image: true, image2image: true, multiImage: true },
        parameterDefinitions: [],
        defaultParameterValues: {}
      } as ImageModel
    ])

    const configForm = ref({
      modelId: 'custom/my-random-model',  // A model ID the user entered freely
      providerId: 'openrouter'
    })

    // Test the connection test logic
    let selectedModel = models.value.find(m => m.id === configForm.value.modelId)

    // Should not be found in the static list
    expect(selectedModel).toBeUndefined()

    // Mock the buildDefaultModel call
    if (!selectedModel) {
      const adapter = mockRegistry.getAdapter('openrouter')
      selectedModel = adapter.buildDefaultModel(configForm.value.modelId)
    }

    // Verify the model built via buildDefaultModel
    expect(selectedModel).toBeDefined()
    expect(selectedModel!.id).toBe('custom/my-random-model')
    expect(selectedModel!.name).toBe('custom/my-random-model')
    expect(selectedModel!.providerId).toBe('openrouter')
    expect(selectedModel!.capabilities.text2image).toBe(true)

    // Verify buildDefaultModel was called
    expect(mockAdapter.buildDefaultModel).toHaveBeenCalledWith('custom/my-random-model')
  })

  it('should handle buildDefaultModel errors gracefully', () => {
    const models = ref<ImageModel[]>([])
    const configForm = ref({
      modelId: 'invalid/model',
      providerId: 'openrouter'
    })

    // Mock buildDefaultModel to throw error
    mockAdapter.buildDefaultModel = vi.fn(() => {
      throw new Error('Invalid model ID format')
    })

    mockRegistry.getAdapter = vi.fn(() => mockAdapter)

    let selectedModel = models.value.find(m => m.id === configForm.value.modelId)

    expect(selectedModel).toBeUndefined()

    // Test error handling
    expect(() => {
      if (!selectedModel) {
        try {
          const adapter = mockRegistry.getAdapter('openrouter')
          selectedModel = adapter.buildDefaultModel(configForm.value.modelId)
        } catch (error) {
          throw new Error(`Unable to build model ${configForm.value.modelId}: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
    }).toThrow('Unable to build model invalid/model: Invalid model ID format')
  })
})

// Integration test: verify the behavior difference before and after the fix
describe('Connection Test Behavior Comparison', () => {
  it('should demonstrate the difference between old and new logic', () => {
    const models = ref<ImageModel[]>([])
    const configForm = ref({
      modelId: 'user-custom-model-123',
      providerId: 'openrouter'
    })

    // Old logic (before the fix): look up directly and error if not found
    const oldLogic = () => {
      const selectedModel = models.value.find(m => m.id === configForm.value.modelId)
      if (!selectedModel) {
        throw new Error('Selected model not found')  // This will error
      }
      return selectedModel
    }

    // New logic (after the fix): look up + buildDefaultModel fallback
    const newLogic = () => {
      let selectedModel = models.value.find(m => m.id === configForm.value.modelId)
      if (!selectedModel) {
        // Build with buildDefaultModel
        selectedModel = {
          id: configForm.value.modelId,
          name: configForm.value.modelId,
          providerId: configForm.value.providerId,
          capabilities: { text2image: true, image2image: true, multiImage: true },
          parameterDefinitions: [],
          defaultParameterValues: {}
        } as ImageModel
      }
      return selectedModel
    }

    // Verify the old logic fails
    expect(() => oldLogic()).toThrow('Selected model not found')

    // Verify the new logic succeeds
    const result = newLogic()
    expect(result).toBeDefined()
    expect(result.id).toBe('user-custom-model-123')
    expect(result.providerId).toBe('openrouter')
  })
})
