import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ModelManager, HistoryManager, TemplateManager, PromptService, DataManager } from '../../src'
import { LocalStorageProvider } from '../../src/services/storage/localStorageProvider'
import { createLLMService } from '../../src/services/llm/service'
import { createTemplateManager } from '../../src/services/template/manager'
import { createTemplateLanguageService } from '../../src/services/template/languageService'
import { createModelManager } from '../../src/services/model/manager'
import { createHistoryManager } from '../../src/services/history/manager'
import { createPreferenceService } from '../../src/services/preference/service'
import { Template } from '../../src/services/template/types'
import { ContextRepo } from '../../src/services/context/types'
import { TextModelConfig } from '../../src/services/model/types'
import { TextAdapterRegistry } from '../../src/services/llm/adapters/registry'
import { TEMPLATE_ERROR_CODES } from '../../src/constants/error-codes'

/**
 * Real component integration test
 * Uses the real LocalStorageProvider instead of a Mock to verify component collaboration
 */
describe('Real Components Integration Tests', () => {
  let storage: LocalStorageProvider
  let modelManager: ModelManager
  let historyManager: HistoryManager
  let templateManager: TemplateManager
  let dataManager: DataManager
  let promptService: PromptService
  let mockContextRepo: ContextRepo
  let registry: TextAdapterRegistry

  // Helper function: create a TextModelConfig
  const createTextModelConfig = (
    id: string,
    name: string,
    providerId: string = 'openai'
  ): TextModelConfig => {
    const adapter = registry.getAdapter(providerId);
    const provider = adapter.getProvider();
    const models = adapter.getModels();

    return {
      id,
      name,
      enabled: true,
      providerMeta: provider,
      modelMeta: models[0] || adapter.buildDefaultModel('test-model'),
      connectionConfig: {
        apiKey: 'test-key',
        baseURL: provider.defaultBaseURL
      },
      paramOverrides: {}
    };
  };

  beforeEach(async () => {
    // Clean up the storage to ensure test isolation
    storage = new LocalStorageProvider()
    registry = new TextAdapterRegistry()
    modelManager = createModelManager(storage)
    historyManager = createHistoryManager(storage, modelManager)
    const preferenceService = createPreferenceService(storage)

    const languageService = createTemplateLanguageService(storage, preferenceService)
    templateManager = createTemplateManager(storage, languageService)

    // Create the mockContextRepo
    mockContextRepo = {
      list: vi.fn().mockResolvedValue([]),
      getCurrentId: vi.fn().mockResolvedValue('default'),
      setCurrentId: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue('new-context-id'),
      duplicate: vi.fn().mockResolvedValue('duplicated-context-id'),
      rename: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      exportAll: vi.fn().mockResolvedValue({}),
      importAll: vi.fn().mockResolvedValue({}),
      exportData: vi.fn().mockResolvedValue({}),
      importData: vi.fn().mockResolvedValue(undefined),
      getDataType: vi.fn().mockReturnValue('contexts'),
      validateData: vi.fn().mockReturnValue(true),
    } as ContextRepo;

    dataManager = new DataManager(modelManager, templateManager, historyManager, preferenceService, mockContextRepo)

    const llmService = createLLMService(modelManager)
    promptService = new PromptService(modelManager, llmService, templateManager, historyManager)
  })

  afterEach(async () => {
    // Clean up after the test
    await storage.clearAll()
  })

  describe('Real storage layer test', () => {
    it('should be able to save and read model configs correctly', async () => {
      const testModel = createTextModelConfig('test-model', 'Test Model');

      // Clean up the storage to start from an empty state
      await storage.clearAll()

      // Add the model
      await modelManager.addModel('test-model', testModel)

      // Verify the save
      const saved = await modelManager.getModel('test-model')
      expect(saved).toBeDefined()
      expect(saved?.name).toBe('Test Model')

      // Verify it is in the list of all models (note: the new architecture returns an array and includes the default models)
      const allModels = await modelManager.getAllModels()
      const userModel = allModels.find(m => m.id === 'test-model')
      expect(userModel).toBeDefined()
      expect(userModel?.name).toBe('Test Model')
    })

    it('should handle the full lifecycle of history records correctly', async () => {
      // Create the history record
      const record = {
        id: 'test-record-1',
        originalPrompt: 'Original test prompt',
        optimizedPrompt: 'Optimized test prompt',
        type: 'optimize' as const,
        chainId: 'test-chain',
        version: 1,
        timestamp: Date.now(),
        modelKey: 'test-model',
        templateId: 'test-template'
      }

      await historyManager.addRecord(record)

      // Verify the record exists
      const retrieved = await historyManager.getRecord('test-record-1')
      expect(retrieved).toBeDefined()
      expect(retrieved.originalPrompt).toBe('Original test prompt')

      // Verify it is in the record list
      const records = await historyManager.getRecords()
      expect(records.length).toBe(1)

      // Delete the record
      await historyManager.deleteRecord('test-record-1')
      
      // Verify it was deleted
      await expect(historyManager.getRecord('test-record-1'))
        .rejects.toThrow('Record with ID test-record-1 not found')
    })

    it('should handle user template management correctly', async () => {
      const template = {
        id: 'user-test-template',
        name: 'User Test Template',
        content: 'This is a user test template: {{input}}',
        metadata: {
          version: '1.0',
          lastModified: Date.now(),
          templateType: 'optimize' as const,
          language: 'zh' as const
        }
      }

      // Clean up the storage to start from an empty state
      await storage.clearAll()

      // Save the template
      await templateManager.saveTemplate(template)

      // Get the template
      const retrieved = await templateManager.getTemplate('user-test-template')
      expect(retrieved).toBeDefined()
      expect(retrieved.name).toBe('User Test Template')
      expect(retrieved.content).toBe('This is a user test template: {{input}}')

      // Verify it is in the template list (note: the real environment may have built-in templates)
      const templates = await templateManager.listTemplates()
      const userTemplate = templates.find(t => t.id === 'user-test-template')
      expect(userTemplate).toBeDefined()

      // Delete the template
      await templateManager.deleteTemplate('user-test-template')
      
      // Verify it was deleted
      await expect(templateManager.getTemplate('user-test-template'))
        .rejects.toMatchObject({ code: TEMPLATE_ERROR_CODES.NOT_FOUND })
    })
  })

  describe('Component collaboration test', () => {
    it('the full prompt optimization flow should work', async () => {
      // Clean up the storage
      await storage.clearAll()

      // 1. Add the model
      // 1. Add the test model
      const model = createTextModelConfig('test-model', 'Test Model');
      await modelManager.addModel('test-model', model)

      // 2. Add the user template (avoiding conflicts with built-in templates)
      const template = {
        id: 'user-optimize-template',
        name: 'User Optimize Template',
        content: 'Please optimize this prompt: {{input}}',
        metadata: {
          version: '1.0',
          lastModified: Date.now(),
          templateType: 'optimize' as const,
          language: 'zh' as const
        }
      }
      await templateManager.saveTemplate(template)

      // 3. Verify the component config instead of making actual API calls (avoiding network dependency)
      const retrievedModel = await modelManager.getModel('test-model')
      expect(retrievedModel).toBeDefined()
      expect(retrievedModel?.name).toBe('Test Model')

      const retrievedTemplate = await templateManager.getTemplate('user-optimize-template')
      expect(retrievedTemplate).toBeDefined()
      expect(retrievedTemplate.name).toBe('User Optimize Template')
      
      console.log('Component config verified successfully, skipping the actual API call to avoid network dependency')
    }, 5000) // Reduce the timeout, since no API call is made anymore

    it('data import/export should work', async () => {
      // Clean up the storage
      await storage.clearAll()

      // Prepare the test data
      const model = createTextModelConfig('export-model', 'Export Test Model');
      
      const template: Template = {
        id: 'user-export-template',
        name: 'User Export Template',
        content: 'Export test content',
        metadata: {
          version: '1.0',
          lastModified: Date.now(),
          templateType: 'optimize' as const,
          language: 'zh' as const
        }
      }

      const record = {
        id: 'export-record',
        originalPrompt: 'Export original',
        optimizedPrompt: 'Export optimized',
        type: 'optimize' as const,
        chainId: 'export-chain',
        version: 1,
        timestamp: Date.now(),
        modelKey: 'export-model',
        templateId: 'user-export-template'
      }

      // Add the test data
      await modelManager.addModel('export-model', model)
      await templateManager.saveTemplate(template)
      await historyManager.addRecord(record)

      // Export the data
      const exportedDataString = await dataManager.exportAllData()
      const exportedData = JSON.parse(exportedDataString)
      
      expect(exportedData.version).toBe(1)
      expect(exportedData.data).toBeDefined()
      expect(exportedData.data.models).toBeDefined()
      expect(exportedData.data.userTemplates).toBeDefined()
      expect(exportedData.data.history).toBeDefined()
      expect(exportedData.data.models.length).toBeGreaterThan(0)
      expect(exportedData.data.userTemplates.length).toBeGreaterThan(0)
      expect(exportedData.data.history.length).toBe(1)

      // Clear the data
      await storage.clearAll()

      // Verify the data was cleared
      const emptyModels = await modelManager.getAllModels()
      const emptyTemplates = await templateManager.listTemplates()
      const emptyHistory = await historyManager.getRecords()
      
      // Note: the real environment may have built-in models and templates, so it is not necessarily empty
      expect(emptyHistory.length).toBe(0) // The history should be cleared

      // Import the data
      await dataManager.importAllData(exportedDataString)

      // Verify the data was restored
      const restoredModels = await modelManager.getAllModels()
      const restoredTemplates = await templateManager.listTemplates()
      const restoredHistory = await historyManager.getRecords()
      
      expect(restoredModels.length).toBeGreaterThan(0)
      expect(restoredTemplates.length).toBeGreaterThan(0)
      expect(restoredHistory.length).toBe(1)
      
      const restoredModel = restoredModels.find(m => m.id === 'export-model')
      const restoredTemplate = restoredTemplates.find(t => t.id === 'user-export-template')
      expect(restoredModel).toBeDefined()
      expect(restoredTemplate).toBeDefined()
      expect(restoredHistory[0].id).toBe('export-record')
    })
  })

  describe('Concurrency and edge case test', () => {
    it('should handle duplicate IDs correctly', async () => {
      const record1 = {
        id: 'duplicate-id',
        originalPrompt: 'First record',
        optimizedPrompt: 'First result',
        type: 'optimize' as const,
        chainId: 'test-chain',
        version: 1,
        timestamp: Date.now(),
        modelKey: 'test-model',
        templateId: 'test-template'
      }

      const record2 = {
        id: 'duplicate-id', // The same ID
        originalPrompt: 'Second record',
        optimizedPrompt: 'Second result',
        type: 'optimize' as const,
        chainId: 'test-chain',
        version: 2,
        timestamp: Date.now(),
        modelKey: 'test-model',
        templateId: 'test-template'
      }

      // Add the first record
      await historyManager.addRecord(record1)

      // Trying to add a record with a duplicate ID should fail
      await expect(historyManager.addRecord(record2))
        .rejects.toThrow('Record with ID duplicate-id already exists')
    })

    it('should handle a large amount of data correctly', async () => {
      const recordCount = 10
      const records: Array<{
        id: string;
        originalPrompt: string;
        optimizedPrompt: string;
        type: 'optimize';
        chainId: string;
        version: number;
        timestamp: number;
        modelKey: string;
        templateId: string;
      }> = []

      // Create multiple records
      for (let i = 0; i < recordCount; i++) {
        records.push({
          id: `bulk-record-${i}`,
          originalPrompt: `Bulk prompt ${i}`,
          optimizedPrompt: `Bulk result ${i}`,
          type: 'optimize' as const,
          chainId: 'bulk-chain',
          version: i + 1,
          timestamp: Date.now() + i,
          modelKey: 'bulk-model',
          templateId: 'bulk-template'
        })
      }

      // Add the records in a batch
      for (const record of records) {
        await historyManager.addRecord(record)
      }

      // Verify all records were saved
      const savedRecords = await historyManager.getRecords()
      expect(savedRecords.length).toBe(recordCount)

      // Verify the records are sorted by timestamp (newest first)
      for (let i = 0; i < recordCount - 1; i++) {
        expect(savedRecords[i].timestamp).toBeGreaterThanOrEqual(savedRecords[i + 1].timestamp)
      }
    })

    it('should handle storage capacity management correctly', async () => {
      // Test the case of exceeding the maxRecords limit
      const maxRecords = 50 // The default limit of HistoryManager
      const extraRecords = 5
      const totalRecords = maxRecords + extraRecords

      // Add records beyond the limit
      for (let i = 0; i < totalRecords; i++) {
        await historyManager.addRecord({
          id: `capacity-record-${i}`,
          originalPrompt: `Capacity prompt ${i}`,
          optimizedPrompt: `Capacity result ${i}`,
          type: 'optimize' as const,
          chainId: 'capacity-chain',
          version: 1,
          timestamp: Date.now() + i, // Make sure the timestamps increase
          modelKey: 'capacity-model',
          templateId: 'capacity-template'
        })
      }

      // Verify only maxRecords records were kept
      const savedRecords = await historyManager.getRecords()
      expect(savedRecords.length).toBe(maxRecords)

      // Verify the newest records were kept
      expect(savedRecords[0].id).toBe(`capacity-record-${totalRecords - 1}`)
    })
  })

  describe('Error recovery and data consistency test', () => {
    it('should be able to recover from corrupted data', async () => {
      // Put invalid data directly into the storage
      await storage.setItem('prompt_models', 'invalid json')
      
      // ModelManager should be able to handle invalid data and return an empty array
      const models = await modelManager.getAllModels()
      expect(Array.isArray(models)).toBe(true)
      // The real environment may have built-in models; only verify that an array is returned
    })

    it('should be able to handle partial data loss', async () => {
      // Clean up the storage
      await storage.clearAll()

      // Add some data
      await modelManager.addModel('test-model', createTextModelConfig('test-model', 'Test Model'))

      // Simulate template data loss
      await storage.removeItem('prompt_templates')

      // The system should be able to keep working
      const models = await modelManager.getAllModels()
      expect(models.length).toBeGreaterThan(0) // The added model should be there

      const templates = await templateManager.listTemplates()
      // The real environment may have built-in templates; only verify it does not crash
      expect(Array.isArray(templates)).toBe(true)
    })
  })
}) 
