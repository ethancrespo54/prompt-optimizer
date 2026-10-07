import { describe, it, expect, beforeEach, beforeAll } from 'vitest'
import { ModelManager, HistoryManager, TemplateManager, PromptService } from '../../src'
import { LocalStorageProvider } from '../../src/services/storage/localStorageProvider'
import { createLLMService } from '../../src/services/llm/service'
import { createTemplateManager } from '../../src/services/template/manager'
import { createTemplateLanguageService } from '../../src/services/template/languageService'
import { createModelManager } from '../../src/services/model/manager'
import { createHistoryManager } from '../../src/services/history/manager'

/**
 * Real API integration test
 * Only runs when the corresponding environment variables exist
 */
const RUN_REAL_API = process.env.RUN_REAL_API === '1'

describe.skipIf(!RUN_REAL_API)('Real API Integration Tests', () => {
  const hasOpenAIKey = !!process.env.VITE_OPENAI_API_KEY
  const hasCustomKey = !!process.env.VITE_CUSTOM_API_KEY && !!process.env.VITE_CUSTOM_BASE_URL
  const hasGeminiKey = !!process.env.VITE_GEMINI_API_KEY
  const hasDeepSeekKey = !!process.env.VITE_DEEPSEEK_API_KEY

  let storage: LocalStorageProvider
  let modelManager: ModelManager
  let historyManager: HistoryManager
  let templateManager: TemplateManager
  let promptService: PromptService

  beforeAll(() => {
    if (!hasOpenAIKey && !hasCustomKey && !hasGeminiKey && !hasDeepSeekKey) return
  })

  beforeEach(async () => {
    storage = new LocalStorageProvider()
    modelManager = createModelManager(storage)
    historyManager = createHistoryManager(storage)
    
    const languageService = createTemplateLanguageService(storage)
    templateManager = createTemplateManager(storage, languageService)

    
    const llmService = createLLMService(modelManager)
    promptService = new PromptService(modelManager, llmService, templateManager, historyManager)

    // Clean up the storage
    await storage.clearAll()

    // Add the generic template
    const template = {
      id: 'test-optimize',
      name: 'Test Optimize',
      content: 'Please optimize this prompt for better AI responses: {{input}}',
      metadata: {
        version: '1.0',
        lastModified: Date.now(),
        templateType: 'optimize' as const,
        language: 'zh' as const
      }
    }
    await templateManager.saveTemplate(template)
  })

  describe('OpenAI API test', () => {
    const runOpenAITests = hasOpenAIKey

    it.runIf(runOpenAITests)('should be able to optimize a prompt with the OpenAI API', async () => {
      // Run the optimization
      const request = {
        optimizationMode: 'system' as const,
        targetPrompt: 'Please optimize this prompt: write a story about artificial intelligence',
        modelKey: 'openai'
      };
      const result = await promptService.optimizePrompt(request)

      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)

      // Verify the history record was saved
      const records = await historyManager.getRecords()
      expect(records.length).toBe(1)
      expect(records[0].type).toBe('optimize')
    }, 60000)

    it.skipIf(!runOpenAITests)('skip the OpenAI test - API key not set', () => {
      expect(true).toBe(true)
    })
  })

  describe('Custom API test', () => {
    const runCustomTests = hasCustomKey

    it.runIf(runCustomTests)('should be able to optimize a prompt with the Custom API', async () => {
      // Run the optimization
      const request = {
        optimizationMode: 'system' as const,
        targetPrompt: 'Please optimize this prompt: write a story about a robot',
        modelKey: 'custom'
      };
      const result = await promptService.optimizePrompt(request)

      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)

      // Verify the history record was saved
      const records = await historyManager.getRecords()
      expect(records.length).toBe(1)
      expect(records[0].type).toBe('optimize')
    }, 60000)

    it.skipIf(!runCustomTests)('skip the Custom API test - API key or base URL not set', () => {
      expect(true).toBe(true)
    })
  })

  describe('Gemini API test', () => {
    const runGeminiTests = hasGeminiKey

    it.runIf(runGeminiTests)('should be able to optimize a prompt with the Gemini API', async () => {
      // Run the optimization
      const request = {
        optimizationMode: 'system' as const,
        targetPrompt: 'Please optimize this prompt: write a story about space exploration',
        modelKey: 'gemini'
      };
      const result = await promptService.optimizePrompt(request)

      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)

      // Simulate the UI layer saving the history record
      await historyManager.createNewChain({
        id: `test_${Date.now()}`,
        originalPrompt: request.targetPrompt,
        optimizedPrompt: result,
        type: 'optimize',
        modelKey: request.modelKey,
        timestamp: Date.now()
      })

      // Verify the history record was saved
      const records = await historyManager.getRecords()
      expect(records.length).toBe(1)
      expect(records[0].type).toBe('optimize')
    }, 60000)

    it.skipIf(!runGeminiTests)('skip the Gemini test - API key not set', () => {
      expect(true).toBe(true)
    })
  })

  describe('DeepSeek API test', () => {
    const runDeepSeekTests = hasDeepSeekKey

    it.runIf(runDeepSeekTests)('should be able to optimize a prompt with the DeepSeek API', async () => {
      // Run the optimization
      const request = {
        optimizationMode: 'system' as const,
        targetPrompt: 'Please optimize this prompt: write a story about artificial intelligence',
        modelKey: 'deepseek'
      };
      const result = await promptService.optimizePrompt(request)

      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)

      // Simulate the UI layer saving the history record
      await historyManager.createNewChain({
        id: `test_${Date.now()}`,
        originalPrompt: request.targetPrompt,
        optimizedPrompt: result,
        type: 'optimize',
        modelKey: request.modelKey,
        timestamp: Date.now()
      })

      // Verify the history record was saved
      const records = await historyManager.getRecords()
      expect(records.length).toBe(1)
      expect(records[0].type).toBe('optimize')
    }, 60000)

    it.skipIf(!runDeepSeekTests)('skip the DeepSeek test - API key not set', () => {
      expect(true).toBe(true)
    })
  })

  describe('Lightweight workflow test', () => {
    const runWorkflowTests = hasOpenAIKey || (hasCustomKey && !!process.env.VITE_CUSTOM_BASE_URL)

    it.runIf(runWorkflowTests)('should be able to complete the basic optimization flow', async () => {
      // Choose an available model
      const modelKey = hasOpenAIKey ? 'openai' : 'custom'

      // Optimize the original prompt
      const request = {
        optimizationMode: 'system' as const,
        targetPrompt: 'Write a story',
        modelKey: modelKey
      };
      const optimizeResult = await promptService.optimizePrompt(request)

      expect(typeof optimizeResult).toBe('string')
      expect(optimizeResult.length).toBeGreaterThan(0)

      // Simulate the UI layer saving the history record
      await historyManager.createNewChain({
        id: `test_${Date.now()}`,
        originalPrompt: request.targetPrompt,
        optimizedPrompt: optimizeResult,
        type: 'optimize',
        modelKey: request.modelKey,
        timestamp: Date.now()
      })

      // Verify the history record was saved
      const records = await historyManager.getRecords()
      expect(records.length).toBe(1)
      expect(records[0].type).toBe('optimize')

    }, 60000) // Increase the timeout to 60 seconds

    it.skipIf(!runWorkflowTests)('skip the workflow test - API key not set', () => {
      expect(true).toBe(true)
    })
  })

  describe('Concurrency and error handling test', () => {
    const runStabilityTests = hasOpenAIKey || (hasCustomKey && !!process.env.VITE_CUSTOM_BASE_URL)

    it.runIf(runStabilityTests)('should handle API errors correctly', async () => {
      const models = await modelManager.getAllModels()
      const baseModel = models.find(m => m.enabled && m.providerMeta?.requiresApiKey && m.providerMeta?.id !== 'custom')
      if (!baseModel) return

      // Add a model with an invalid API key (reuse the metadata of an enabled model, replacing the apiKey)
      await modelManager.addModel('invalid-model', {
        ...baseModel,
        id: 'invalid-model',
        name: 'Invalid Model',
        enabled: true,
        connectionConfig: {
          ...(baseModel.connectionConfig ?? {}),
          apiKey: 'invalid-key'
        }
      })

      // Trying to optimize should fail
      const request = {
        optimizationMode: 'system' as const,
        targetPrompt: 'Test prompt',
        modelKey: 'invalid-model'
      };
      await expect(promptService.optimizePrompt(request)).rejects.toThrow()

      // Verify that no invalid history record was created
      const records = await historyManager.getRecords()
      expect(records.length).toBe(0)
    }, 30000)

    it.skipIf(!runStabilityTests)('skip the stability test - API key not set', () => {
      expect(true).toBe(true)
    })
  })
}) 
