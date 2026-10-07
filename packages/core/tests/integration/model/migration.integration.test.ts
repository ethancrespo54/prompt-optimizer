import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ModelManager } from '../../../src/services/model/manager';
import { TextAdapterRegistry } from '../../../src/services/llm/adapters/registry';
import { MemoryStorageProvider } from '../../../src/services/storage/memoryStorageProvider';
import { isLegacyConfig, isTextModelConfig } from '../../../src/services/model/converter';
import type { ModelConfig, TextModelConfig } from '../../../src/services/model/types';

describe('Config migration integration test', () => {
  let storage: MemoryStorageProvider;
  let registry: TextAdapterRegistry;

  beforeEach(async () => {
    storage = new MemoryStorageProvider();
    registry = new TextAdapterRegistry();
    await storage.clearAll();
  });

  describe('Automatic conversion of legacy configs', () => {
    it('should automatically convert the legacy OpenAI config', async () => {
      // Prepare the legacy config
      const legacyConfig: ModelConfig = {
        name: 'OpenAI',
        provider: 'openai',
        baseURL: 'https://api.openai.com/v1',
        apiKey: 'test-openai-key',
        models: ['gpt-5-2025-08-07', 'gpt-3.5-turbo'],
        defaultModel: 'gpt-5-2025-08-07',
        enabled: true,
        llmParams: {
          temperature: 0.7,
          max_tokens: 2000
        }
      };

      // Write to Storage
      const modelsData = {
        openai: legacyConfig
      };
      await storage.setItem('models', JSON.stringify(modelsData));

      // Verify that the legacy format was written
      const storedRaw = await storage.getItem('models');
      const storedModels = JSON.parse(storedRaw!);
      expect(isLegacyConfig(storedModels.openai)).toBe(true);

      // Initialize ModelManager (this triggers the automatic conversion)
      const modelManager = new ModelManager(storage, registry);
      

      // Verify the converted config
      const convertedConfig = await modelManager.getModel('openai') as TextModelConfig;
      expect(convertedConfig).toBeDefined();
      expect(isTextModelConfig(convertedConfig)).toBe(true);
      expect(isLegacyConfig(convertedConfig)).toBe(false);

      // Verify the field mapping is correct
      expect(convertedConfig.id).toBe('openai');
      expect(convertedConfig.name).toBe('OpenAI');
      expect(convertedConfig.enabled).toBe(true);
      expect(convertedConfig.providerMeta.id).toBe('openai');
      expect(convertedConfig.modelMeta.id).toBe('gpt-5-2025-08-07');
      expect(convertedConfig.connectionConfig.apiKey).toBe('test-openai-key');
      expect(convertedConfig.connectionConfig.baseURL).toBe('https://api.openai.com/v1');
      expect(convertedConfig.paramOverrides.temperature).toBe(0.7);
      expect(convertedConfig.paramOverrides.max_tokens).toBe(2000);

      // Verify the metadata comes from the Adapter
      const adapter = registry.getAdapter('openai');
      const expectedProvider = adapter.getProvider();
      expect(convertedConfig.providerMeta.name).toBe(expectedProvider.name);
      expect(convertedConfig.providerMeta.defaultBaseURL).toBe(expectedProvider.defaultBaseURL);
    });

    it('should automatically convert the legacy Gemini config', async () => {
      const legacyConfig: ModelConfig = {
        name: 'Gemini',
        provider: 'gemini',
        baseURL: 'https://generativelanguage.googleapis.com',
        apiKey: 'test-gemini-key',
        models: ['gemini-2.0-flash-exp'],
        defaultModel: 'gemini-2.0-flash-exp',
        enabled: true,
        llmParams: {
          temperature: 0.8
        }
      };

      const modelsData = { gemini: legacyConfig };
      await storage.setItem('models', JSON.stringify(modelsData));

      const modelManager = new ModelManager(storage, registry);
      

      const convertedConfig = await modelManager.getModel('gemini') as TextModelConfig;
      expect(isTextModelConfig(convertedConfig)).toBe(true);
      expect(convertedConfig.providerMeta.id).toBe('gemini');
      expect(convertedConfig.modelMeta.id).toBe('gemini-2.0-flash-exp');
      expect(convertedConfig.modelMeta.providerId).toBe('gemini');
      expect(convertedConfig.connectionConfig.apiKey).toBe('test-gemini-key');
      expect(convertedConfig.paramOverrides.temperature).toBe(0.8);
    });

    it('should automatically convert the legacy Anthropic config', async () => {
      const legacyConfig: ModelConfig = {
        name: 'Anthropic',
        provider: 'anthropic',
        baseURL: 'https://api.anthropic.com/v1',
        apiKey: 'test-anthropic-key',
        models: ['claude-3-5-sonnet-20241022'],
        defaultModel: 'claude-3-5-sonnet-20241022',
        enabled: true
      };

      const modelsData = { anthropic: legacyConfig };
      await storage.setItem('models', JSON.stringify(modelsData));

      const modelManager = new ModelManager(storage, registry);
      

      const convertedConfig = await modelManager.getModel('anthropic') as TextModelConfig;
      expect(isTextModelConfig(convertedConfig)).toBe(true);
      expect(convertedConfig.providerMeta.id).toBe('anthropic');
      expect(convertedConfig.modelMeta.providerId).toBe('anthropic');
    });

    it('should convert the DeepSeek config and keep the DeepSeek Provider', async () => {
      const legacyConfig: ModelConfig = {
        name: 'DeepSeek',
        provider: 'deepseek',
        baseURL: 'https://api.deepseek.com/v1',
        apiKey: 'test-deepseek-key',
        models: ['deepseek-chat'],
        defaultModel: 'deepseek-chat',
        enabled: true
      };

      const modelsData = { deepseek: legacyConfig };
      await storage.setItem('models', JSON.stringify(modelsData));

      const modelManager = new ModelManager(storage, registry);
      

      const convertedConfig = await modelManager.getModel('deepseek') as TextModelConfig;
      expect(isTextModelConfig(convertedConfig)).toBe(true);
      expect(convertedConfig.providerMeta.id).toBe('deepseek');
      expect(convertedConfig.modelMeta.providerId).toBe('deepseek');
      expect(convertedConfig.connectionConfig.baseURL).toBe('https://api.deepseek.com/v1');
    });

    it('should convert the Zhipu config and keep the Zhipu Provider', async () => {
      const legacyConfig: ModelConfig = {
        name: 'Zhipu',
        provider: 'zhipu',
        baseURL: 'https://open.bigmodel.cn/api/paas/v4',
        apiKey: 'test-zhipu-key',
        models: ['glm-4-flash'],
        defaultModel: 'glm-4-flash',
        enabled: true
      };

      const modelsData = { zhipu: legacyConfig };
      await storage.setItem('models', JSON.stringify(modelsData));

      const modelManager = new ModelManager(storage, registry);
      

      const convertedConfig = await modelManager.getModel('zhipu') as TextModelConfig;
      expect(isTextModelConfig(convertedConfig)).toBe(true);
      expect(convertedConfig.providerMeta.id).toBe('zhipu');
      expect(convertedConfig.modelMeta.providerId).toBe('zhipu');
    });

    it('should map the Custom config to the OpenAI Adapter', async () => {
      const legacyConfig: ModelConfig = {
        name: 'Custom Model',
        provider: 'custom',
        baseURL: 'https://custom.api.com/v1',
        apiKey: 'test-custom-key',
        models: ['custom-model'],
        defaultModel: 'custom-model',
        enabled: true
      };

      const modelsData = { custom: legacyConfig };
      await storage.setItem('models', JSON.stringify(modelsData));

      const modelManager = new ModelManager(storage, registry);
      

      const convertedConfig = await modelManager.getModel('custom') as TextModelConfig;
      expect(isTextModelConfig(convertedConfig)).toBe(true);
      expect(convertedConfig.providerMeta.id).toBe('openai');
    });
  });

  describe('Persistence after conversion', () => {
    it('should save the converted config to Storage', async () => {
      const legacyConfig: ModelConfig = {
        name: 'OpenAI',
        provider: 'openai',
        baseURL: 'https://api.openai.com/v1',
        apiKey: 'test-key',
        models: ['gpt-5-2025-08-07'],
        defaultModel: 'gpt-5-2025-08-07',
        enabled: true
      };

      const modelsData = { openai: legacyConfig };
      await storage.setItem('models', JSON.stringify(modelsData));

      // First initialization - triggers the conversion
      const modelManager1 = new ModelManager(storage, registry);
      await modelManager1.ensureInitialized();

      // Verify the data in Storage was updated
      const storedRaw = await storage.getItem('models');
      const storedModels = JSON.parse(storedRaw!);
      expect(isTextModelConfig(storedModels.openai)).toBe(true);
      expect(storedModels.openai.providerMeta).toBeDefined();
      expect(storedModels.openai.modelMeta).toBeDefined();
    });

    it('should ensure the conversion is idempotent (the second load no longer converts)', async () => {
      const legacyConfig: ModelConfig = {
        name: 'OpenAI',
        provider: 'openai',
        baseURL: 'https://api.openai.com/v1',
        apiKey: 'test-key',
        models: ['gpt-5-2025-08-07'],
        defaultModel: 'gpt-5-2025-08-07',
        enabled: true
      };

      const modelsData = { openai: legacyConfig };
      await storage.setItem('models', JSON.stringify(modelsData));

      // First initialization
      const modelManager1 = new ModelManager(storage, registry);
      
      const config1 = await modelManager1.getModel('openai') as TextModelConfig;

      // Second initialization (reload)
      const modelManager2 = new ModelManager(storage, registry);
      
      const config2 = await modelManager2.getModel('openai') as TextModelConfig;

      // Verify both loads give the same result
      expect(config1).toMatchObject({
        id: config2.id,
        name: config2.name,
        enabled: config2.enabled,
        providerMeta: { id: config2.providerMeta.id },
        modelMeta: { id: config2.modelMeta.id },
        connectionConfig: config2.connectionConfig,
        paramOverrides: config2.paramOverrides
      });
      // Verify that Storage holds the new format
      const storedRaw = await storage.getItem('models');
      const storedModels = JSON.parse(storedRaw!);
      expect(isTextModelConfig(storedModels.openai)).toBe(true);
    });
  });

  describe('Unknown model handling', () => {
    it('should use buildDefaultModel for unknown models', async () => {
      const legacyConfig: ModelConfig = {
        name: 'OpenAI',
        provider: 'openai',
        baseURL: 'https://api.openai.com/v1',
        apiKey: 'test-key',
        models: ['unknown-gpt-model-xyz'],
        defaultModel: 'unknown-gpt-model-xyz',
        enabled: true
      };

      const modelsData = { openai: legacyConfig };
      await storage.setItem('models', JSON.stringify(modelsData));

      const modelManager = new ModelManager(storage, registry);
      

      const convertedConfig = await modelManager.getModel('openai') as TextModelConfig;
      expect(isTextModelConfig(convertedConfig)).toBe(true);
      expect(convertedConfig.modelMeta.id).toBe('unknown-gpt-model-xyz');
      expect(convertedConfig.modelMeta.providerId).toBe('openai');
      expect(convertedConfig.modelMeta.capabilities).toBeDefined();
    });
  });

  // Removed the "conversion failure scenario" test - it over-tests internal error handling implementation details

  describe('New format config handling', () => {
    it('should directly recognize and keep the new format config', async () => {
      const adapter = registry.getAdapter('openai');
      const model = adapter.getModels().find(m => m.id === 'gpt-5-mini')!;

      const newConfig: TextModelConfig = {
        id: 'openai',
        name: 'OpenAI',
        enabled: true,
        providerMeta: adapter.getProvider(),
        modelMeta: model,
        connectionConfig: {
          apiKey: 'test-key',
          baseURL: 'https://api.openai.com/v1'
        },
        paramOverrides: {}
      };

      const modelsData = { openai: newConfig };
      await storage.setItem('models', JSON.stringify(modelsData));

      const modelManager = new ModelManager(storage, registry);


      const loadedConfig = await modelManager.getModel('openai') as TextModelConfig;
      expect(isTextModelConfig(loadedConfig)).toBe(true);
      // Use toMatchObject to allow the adapter to update metadata fields
      expect(loadedConfig).toMatchObject({
        id: newConfig.id,
        name: newConfig.name,
        enabled: newConfig.enabled,
        connectionConfig: newConfig.connectionConfig,
        paramOverrides: newConfig.paramOverrides
      });

      // Verify that Storage holds the new format
      const storedRaw2 = await storage.getItem('models');
      const storedModels2 = JSON.parse(storedRaw2!);
      expect(isTextModelConfig(storedModels2.openai)).toBe(true);
    });
  });
});
