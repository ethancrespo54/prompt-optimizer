import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ModelManager } from '../../../src/services/model/manager';
import { TextModelConfig } from '../../../src/services/model/types';
import { MemoryStorageProvider } from '../../../src/services/storage/memoryStorageProvider';
import { TextAdapterRegistry } from '../../../src/services/llm/adapters/registry';

describe('ModelManager Import/Export', () => {
  let modelManager: ModelManager;
  let storageProvider: MemoryStorageProvider;
  let registry: TextAdapterRegistry;

  beforeEach(async () => {
    storageProvider = new MemoryStorageProvider();
    registry = new TextAdapterRegistry();
    modelManager = new ModelManager(storageProvider, registry);
    await modelManager.ensureInitialized();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('exportData', () => {
    it('should export all models', async () => {
      // Add some test models
      const adapter = registry.getAdapter('openai');
      const testModel: TextModelConfig = {
        id: 'test-model',
        name: 'Test Model',
        enabled: true,
        providerMeta: adapter.getProvider(),
        modelMeta: adapter.buildDefaultModel('test-model-1'),
        connectionConfig: {
          apiKey: 'test-key',
          baseURL: 'https://api.test.com/v1'
        },
        paramOverrides: {}
      };

      await modelManager.addModel('test-model', testModel);

      // Export data
      const exportedData = await modelManager.exportData();

      // Verify the exported data
      expect(Array.isArray(exportedData)).toBe(true);
      expect(exportedData.length).toBeGreaterThan(0);

      // Find the test models we added
      const exportedTestModel = exportedData.find(model => model.id === 'test-model');
      expect(exportedTestModel).toBeDefined();
      expect(exportedTestModel?.name).toBe('Test Model');
      expect(exportedTestModel?.enabled).toBe(true);
    });

    it('should include built-in models in export', async () => {
      const exportedData = await modelManager.exportData();

      // Should include built-in models
      const builtinModels = exportedData.filter(model =>
        ['openai', 'anthropic', 'gemini'].includes(model.id)
      );
      expect(builtinModels.length).toBeGreaterThan(0);
    });

    it('should handle export error gracefully', async () => {
      // Simulate a storage error
      vi.spyOn(modelManager, 'getAllModels').mockRejectedValue(new Error('Storage error'));

      await expect(modelManager.exportData()).rejects.toThrow('Failed to export model data');
    });
  });

  describe('importData', () => {
    it('should import new models', async () => {
      const importData = [
        {
          key: 'new-model-1',
          name: 'New Model 1',
          baseURL: 'https://api.new1.com/v1',
          models: ['new-1'],
          defaultModel: 'new-1',
          provider: 'new-provider',
          enabled: true
        },
        {
          key: 'new-model-2',
          name: 'New Model 2',
          baseURL: 'https://api.new2.com/v1',
          models: ['new-2'],
          defaultModel: 'new-2',
          provider: 'new-provider',
          enabled: false
        }
      ];

      await modelManager.importData(importData);

      // Verify the model was imported
      const model1 = await modelManager.getModel('new-model-1');
      expect(model1).toBeDefined();
      expect(model1?.name).toBe('New Model 1');
      expect(model1?.enabled).toBe(true);

      const model2 = await modelManager.getModel('new-model-2');
      expect(model2).toBeDefined();
      expect(model2?.name).toBe('New Model 2');
      expect(model2?.enabled).toBe(false);
    });

    it('should update existing models', async () => {
      // Add a model first
      const adapter = registry.getAdapter('openai');
      const originalModel: TextModelConfig = {
        id: 'existing-model',
        name: 'Original Model',
        enabled: false,
        providerMeta: adapter.getProvider(),
        modelMeta: adapter.buildDefaultModel('original'),
        connectionConfig: {
          apiKey: 'original-key',
          baseURL: 'https://api.original.com/v1'
        },
        paramOverrides: {}
      };
      await modelManager.addModel('existing-model', originalModel);

      // Import an updated model config
      const updatedConfig: TextModelConfig = {
        id: 'existing-model',
        name: 'Updated Model',
        enabled: true, // Updated enabled state
        providerMeta: adapter.getProvider(),
        modelMeta: adapter.buildDefaultModel('updated'),
        connectionConfig: {
          apiKey: 'new-api-key',
          baseURL: 'https://api.updated.com/v1'
        },
        paramOverrides: {}
      };
      const importData = [updatedConfig];

      await modelManager.importData(importData);

      // Verify the model was updated
      const updatedModel = await modelManager.getModel('existing-model');
      expect(updatedModel).toBeDefined();
      expect(updatedModel?.name).toBe('Updated Model');
      expect(updatedModel?.enabled).toBe(true); // Should use the imported enabled state
      expect(updatedModel?.connectionConfig.apiKey).toBe('new-api-key');
    });

    it('should prioritize imported enabled status', async () => {
      // Test priority handling of the enabled state
      const importData = [
        {
          key: 'openai', // Built-in model
          name: 'OpenAI',
          baseURL: 'https://api.openai.com/v1',
          models: ['gpt-4', 'gpt-3.5-turbo'],
          defaultModel: 'gpt-4',
          provider: 'openai',
          enabled: false // Set to disabled on import
        }
      ];

      await modelManager.importData(importData);

      const openaiModel = await modelManager.getModel('openai');
      expect(openaiModel?.enabled).toBe(false); // Should use the imported state
    });

    it('should skip invalid models', async () => {
      const importData = [
        {
          // Missing key field
          name: 'Invalid Model',
          baseURL: 'https://api.invalid.com/v1',
          models: ['invalid'],
          defaultModel: 'invalid',
          provider: 'invalid',
          enabled: true
        },
        {
          key: 'valid-model',
          name: 'Valid Model',
          baseURL: 'https://api.valid.com/v1',
          models: ['valid'],
          defaultModel: 'valid',
          provider: 'valid',
          enabled: true
        }
      ];

      // Should not throw, just skip invalid models
      await expect(modelManager.importData(importData)).resolves.not.toThrow();

      // Verify the valid model was imported
      const validModel = await modelManager.getModel('valid-model');
      expect(validModel).toBeDefined();
    });

    it('should handle import errors gracefully', async () => {
      const importData = [
        {
          key: 'error-model',
          name: 'Error Model',
          baseURL: 'https://api.error.com/v1',
          models: ['error'],
          defaultModel: 'error',
          provider: 'error',
          enabled: true
        }
      ];

      // Simulate an addModel error
      vi.spyOn(modelManager, 'addModel').mockRejectedValue(new Error('Add model error'));

      // Should not throw, just record the failure
      await expect(modelManager.importData(importData)).resolves.not.toThrow();
    });
  });

  describe('validateData', () => {
    it('should validate correct model data', async () => {
      const validData = [
        {
          key: 'test-model',
          name: 'Test Model',
          baseURL: 'https://api.test.com/v1',
          models: ['test'],
          defaultModel: 'test',
          provider: 'test',
          enabled: true
        }
      ];

      expect(await modelManager.validateData(validData)).toBe(true);
    });

    it('should reject invalid data formats', async () => {
      // Not an array
      expect(await modelManager.validateData({})).toBe(false);
      expect(await modelManager.validateData('string')).toBe(false);
      expect(await modelManager.validateData(null)).toBe(false);

      // Missing required fields
      expect(await modelManager.validateData([
        {
          name: 'Test Model',
          // Missing key
          baseURL: 'https://api.test.com/v1',
          models: ['test'],
          defaultModel: 'test',
          provider: 'test',
          enabled: true
        }
      ])).toBe(false);

      // Wrong field type
      expect(await modelManager.validateData([
        {
          key: 'test-model',
          name: 123, // Should be a string
          baseURL: 'https://api.test.com/v1',
          models: ['test'],
          defaultModel: 'test',
          provider: 'test',
          enabled: true
        }
      ])).toBe(false);
    });
  });

  describe('getDataType', () => {
    it('should return correct data type', async () => {
      expect(await modelManager.getDataType()).toBe('models');
    });
  });
});
