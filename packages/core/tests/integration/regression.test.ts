import { describe, it, expect, beforeEach } from 'vitest';
import { ModelManager } from '../../src/services/model/manager';
import { createLLMService } from '../../src/services/llm/service';
import { MemoryStorageProvider } from '../../src/services/storage/memoryStorageProvider';
import { TextAdapterRegistry } from '../../src/services/llm/adapters/registry';
import type { ModelConfig, TextModelConfig } from '../../src/services/model/types';

/**
 * Regression test - verifies that the new architecture does not break existing features
 *
 * Test focus:
 * 1. API compatibility: core APIs such as createLLMService and ModelManager stay unchanged
 * 2. Config compatibility: automatic conversion of the legacy ModelConfig is supported
 * 3. Feature completeness: core features such as sendMessage and sendMessageStream work normally
 */
describe('Architecture refactoring regression test', () => {
  let storage: MemoryStorageProvider;
  let registry: TextAdapterRegistry;

  beforeEach(async () => {
    storage = new MemoryStorageProvider();
    registry = new TextAdapterRegistry();
    await storage.clearAll();
  });

  describe('API compatibility', () => {
    it('createLLMService should create a service instance successfully', () => {
      const modelManager = new ModelManager(storage);
      const llmService = createLLMService(modelManager);

      expect(llmService).toBeDefined();
      expect(typeof llmService.sendMessage).toBe('function');
      expect(typeof llmService.sendMessageStream).toBe('function');
    });

    it('ModelManager should keep the original API', async () => {
      const modelManager = new ModelManager(storage, registry);
      

      // Verify the core methods exist
      expect(typeof modelManager.getModel).toBe('function');
      expect(typeof modelManager.getAllModels).toBe('function');
      expect(typeof modelManager.addModel).toBe('function');
      expect(typeof modelManager.updateModel).toBe('function');
      expect(typeof modelManager.deleteModel).toBe('function');
    });
  });

  describe('Config compatibility', () => {
    it('should support the legacy ModelConfig format (automatic conversion)', async () => {
      const legacyConfig: ModelConfig = {
        name: 'Test OpenAI',
        provider: 'openai',
        baseURL: 'https://api.openai.com/v1',
        apiKey: 'test-key',
        models: ['gpt-5-2025-08-07'],
        defaultModel: 'gpt-5-2025-08-07',
        enabled: true,
        llmParams: {
          temperature: 0.7
        }
      };

      const modelsData = { test: legacyConfig };
      await storage.setItem('models', JSON.stringify(modelsData));

      const modelManager = new ModelManager(storage, registry);

      const config = await modelManager.getModel('test');
      expect(config).toBeDefined();
      expect(config.name).toBe('Test OpenAI');
      expect(config.enabled).toBe(true);
    });

    it('should support the new TextModelConfig format', async () => {
      const adapter = registry.getAdapter('openai');
      const newConfig: TextModelConfig = {
        id: 'openai',
        name: 'OpenAI',
        enabled: true,
        providerMeta: adapter.getProvider(),
        modelMeta: adapter.getModels()[0],
        connectionConfig: {
          apiKey: 'test-key',
          baseURL: 'https://api.openai.com/v1'
        },
        paramOverrides: {}
      };

      const modelsData = { openai: newConfig };
      await storage.setItem('models', JSON.stringify(modelsData));

      const modelManager = new ModelManager(storage, registry);
      

      const config = await modelManager.getModel('openai') as TextModelConfig;
      expect(config).toBeDefined();
      expect(config.providerMeta).toBeDefined();
      expect(config.modelMeta).toBeDefined();
    });

    it('should support mixed formats (legacy + new coexisting)', async () => {
      const legacyConfig: ModelConfig = {
        name: 'Legacy Model',
        provider: 'openai',
        baseURL: 'https://api.openai.com/v1',
        apiKey: 'legacy-key',
        models: ['gpt-3.5-turbo'],
        defaultModel: 'gpt-3.5-turbo',
        enabled: true
      };

      const adapter = registry.getAdapter('gemini');
      const newConfig: TextModelConfig = {
        id: 'gemini',
        name: 'Gemini',
        enabled: true,
        providerMeta: adapter.getProvider(),
        modelMeta: adapter.getModels()[0],
        connectionConfig: {
          apiKey: 'gemini-key'
        },
        paramOverrides: {}
      };

      const modelsData = {
        legacy: legacyConfig,
        gemini: newConfig
      };
      await storage.setItem('models', JSON.stringify(modelsData));

      const modelManager = new ModelManager(storage, registry);
      

      const legacyResult = await modelManager.getModel('legacy');
      const newResult = await modelManager.getModel('gemini');

      expect(legacyResult).toBeDefined();
      expect(newResult).toBeDefined();
      expect(legacyResult.name).toBe('Legacy Model');
      expect(newResult.name).toBe('Gemini');
    });
  });

  describe('ModelManager core features', () => {
    it('addModel should work normally', async () => {
      const modelManager = new ModelManager(storage, registry);
      

      const adapter = registry.getAdapter('openai');
      const config: TextModelConfig = {
        id: 'new-model',
        name: 'New Model',
        enabled: true,
        providerMeta: adapter.getProvider(),
        modelMeta: adapter.getModels()[0],
        connectionConfig: {
          apiKey: 'test-key',
          baseURL: 'https://api.openai.com/v1'
        },
        paramOverrides: {}
      };

      await modelManager.addModel('new-model', config);

      const result = await modelManager.getModel('new-model');
      expect(result).toBeDefined();
      expect(result.id).toBe('new-model');
    });

    it('updateModel should work normally', async () => {
      const adapter = registry.getAdapter('openai');
      const config: TextModelConfig = {
        id: 'test',
        name: 'Original Name',
        enabled: true,
        providerMeta: adapter.getProvider(),
        modelMeta: adapter.getModels()[0],
        connectionConfig: {
          apiKey: 'original-key',
          baseURL: 'https://api.openai.com/v1'
        },
        paramOverrides: {}
      };

      await storage.setItem('models', JSON.stringify({ test: config }));

      const modelManager = new ModelManager(storage, registry);
      

      await modelManager.updateModel('test', {
        name: 'Updated Name',
        connectionConfig: {
          apiKey: 'updated-key',
          baseURL: 'https://api.openai.com/v1'
        }
      });

      const result = await modelManager.getModel('test') as TextModelConfig;
      expect(result.name).toBe('Updated Name');
      expect(result.connectionConfig.apiKey).toBe('updated-key');
    });

    it('deleteModel should work normally', async () => {
      const adapter = registry.getAdapter('openai');
      const config: TextModelConfig = {
        id: 'test',
        name: 'Test',
        enabled: true,
        providerMeta: adapter.getProvider(),
        modelMeta: adapter.getModels()[0],
        connectionConfig: {
          apiKey: 'test-key',
          baseURL: 'https://api.openai.com/v1'
        },
        paramOverrides: {}
      };

      await storage.setItem('models', JSON.stringify({ test: config }));

      const modelManager = new ModelManager(storage, registry);
      

      await modelManager.deleteModel('test');

      const result = await modelManager.getModel('test');
      expect(result).toBeUndefined();
    });

    it('getAllModels should return all models', async () => {
      const adapter = registry.getAdapter('openai');
      const config1: TextModelConfig = {
        id: 'model1',
        name: 'Model 1',
        enabled: true,
        providerMeta: adapter.getProvider(),
        modelMeta: adapter.getModels()[0],
        connectionConfig: { apiKey: 'key1', baseURL: 'https://api.openai.com/v1' },
        paramOverrides: {}
      };

      const config2: TextModelConfig = {
        id: 'model2',
        name: 'Model 2',
        enabled: true,
        providerMeta: adapter.getProvider(),
        modelMeta: adapter.getModels()[1] || adapter.getModels()[0],
        connectionConfig: { apiKey: 'key2', baseURL: 'https://api.openai.com/v1' },
        paramOverrides: {}
      };

      await storage.setItem('models', JSON.stringify({ model1: config1, model2: config2 }));

      const modelManager = new ModelManager(storage, registry);
      

      const allModels = await modelManager.getAllModels();
      // The new architecture returns an array and automatically adds the default models
      expect(allModels.length).toBeGreaterThanOrEqual(2);
      expect(allModels.find(m => m.id === 'model1')).toBeDefined();
      expect(allModels.find(m => m.id === 'model2')).toBeDefined();
    });
  });

  describe('Persistence compatibility', () => {
    it('the config should be saved to Storage correctly', async () => {
      const modelManager = new ModelManager(storage, registry);
      

      const adapter = registry.getAdapter('openai');
      const config: TextModelConfig = {
        id: 'persist-test',
        name: 'Persist Test',
        enabled: true,
        providerMeta: adapter.getProvider(),
        modelMeta: adapter.getModels()[0],
        connectionConfig: {
          apiKey: 'test-key',
          baseURL: 'https://api.openai.com/v1'
        },
        paramOverrides: { temperature: 0.5 }
      };

      await modelManager.addModel('persist-test', config);

      // Verify the data in Storage
      const storedRaw = await storage.getItem('models');
      const storedModels = JSON.parse(storedRaw!);
      expect(storedModels['persist-test']).toBeDefined();
      expect(storedModels['persist-test'].name).toBe('Persist Test');
      expect(storedModels['persist-test'].paramOverrides.temperature).toBe(0.5);
    });

    it('the config should stay consistent after reloading', async () => {
      const adapter = registry.getAdapter('openai');
      const config: TextModelConfig = {
        id: 'reload-test',
        name: 'Reload Test',
        enabled: true,
        providerMeta: adapter.getProvider(),
        modelMeta: adapter.getModels()[0],
        connectionConfig: {
          apiKey: 'test-key',
          baseURL: 'https://api.openai.com/v1'
        },
        paramOverrides: {}
      };

      await storage.setItem('models', JSON.stringify({ 'reload-test': config }));

      // First load
      const modelManager1 = new ModelManager(storage, registry);
      const config1 = await modelManager1.getModel('reload-test');

      // Second load
      const modelManager2 = new ModelManager(storage, registry);
      const config2 = await modelManager2.getModel('reload-test');

      expect(config1).toEqual(config2);
    });
  });

  describe('Multi-Provider support', () => {
    it('should support all Provider types', async () => {
      const providers = ['openai', 'gemini', 'anthropic'] as const;
      const modelManager = new ModelManager(storage, registry);


      for (const providerId of providers) {
        const adapter = registry.getAdapter(providerId);
        // Use a unique key to avoid conflicts with the default models
        const modelKey = `test-${providerId}`;
        const config: TextModelConfig = {
          id: modelKey,
          name: `${providerId} Model`,
          enabled: true,
          providerMeta: adapter.getProvider(),
          modelMeta: adapter.getModels()[0],
          connectionConfig: {
            apiKey: `${providerId}-key`
          },
          paramOverrides: {}
        };

        await modelManager.addModel(modelKey, config);
        const result = await modelManager.getModel(modelKey);
        expect(result).toBeDefined();
        expect(result.providerMeta.id).toBe(providerId);
      }
    });

    it('should load the corresponding Adapter for OpenAI-compatible Providers', async () => {
      const providerExpectations = [
        ['deepseek', 'deepseek'],
        ['zhipu', 'zhipu'],
        ['siliconflow', 'siliconflow'],
        ['custom', 'openai']
      ] as const;

      for (const [provider, expectedProviderId] of providerExpectations) {
        const legacyConfig: ModelConfig = {
          name: `${provider} Model`,
          provider: provider,
          baseURL: `https://${provider}.com/v1`,
          apiKey: `${provider}-key`,
          models: ['test-model'],
          defaultModel: 'test-model',
          enabled: true
        };

        const modelsData = { [provider]: legacyConfig };
        await storage.setItem('models', JSON.stringify(modelsData));

        const modelManager = new ModelManager(storage, registry);
        

        const config = await modelManager.getModel(provider) as TextModelConfig;
        expect(config).toBeDefined();
        expect(config.providerMeta.id).toBe(expectedProviderId);
        expect(config.connectionConfig.baseURL).toBe(`https://${provider}.com/v1`);

        await storage.clearAll();
      }
    });
  });

  describe('Error handling', () => {
    it('getting a non-existent model should return null', async () => {
      const modelManager = new ModelManager(storage, registry);
      

      const result = await modelManager.getModel('non-existent');
      expect(result).toBeUndefined();
    });

    it('deleting a non-existent model should throw an error', async () => {
      const modelManager = new ModelManager(storage, registry);


      // In the new architecture, deleting a non-existent model throws ModelConfigError
      await expect(modelManager.deleteModel('non-existent')).rejects.toThrow();
    });

    it('an invalid config should be rejected', async () => {
      const modelManager = new ModelManager(storage, registry);
      

      const invalidConfig = {
        id: 'invalid',
        name: 'Invalid',
        enabled: true,
        // Missing required fields
      } as any;

      await expect(modelManager.addModel('invalid', invalidConfig))
        .rejects.toThrow();
    });
  });
});
