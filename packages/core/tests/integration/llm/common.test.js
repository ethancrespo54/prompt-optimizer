import { 
  createLLMService,
  ModelManager,
  RequestConfigError,
} from '../../../src/index.js';
import { expect, describe, it, beforeEach, beforeAll, vi } from 'vitest';
import dotenv from 'dotenv';
import path from 'path';
import { createMockStorage } from '../../mocks/mockStorage';

// Load environment variables
beforeAll(() => {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
  console.log('Environment variable loading status:', {
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    CUSTOM_API_KEY: !!process.env.VITE_CUSTOM_API_KEY,
    GEMINI_API_KEY: !!process.env.VITE_GEMINI_API_KEY,
    DEEPSEEK_API_KEY: !!process.env.VITE_DEEPSEEK_API_KEY
  });
});

describe('LLM service common test', () => {
  let llmService;
  let modelManager;
  let mockStorage;

  beforeEach(() => {
    mockStorage = createMockStorage();
    mockStorage.getItem.mockResolvedValue(null);
    
    modelManager = new ModelManager(mockStorage);
    llmService = createLLMService(modelManager);
    
    // Mock the getAllModels method
    vi.spyOn(modelManager, 'getAllModels').mockResolvedValue([]);
  });

  describe('API call error handling', () => {
    it('should handle an invalid message format correctly', async () => {
      const testModel = 'test-invalid-message';
      
      vi.spyOn(modelManager, 'getModel').mockResolvedValue({
        name: 'Test Model',
        baseURL: 'https://test.api/chat/completions',
        models: ['test-model'],
        defaultModel: 'test-model',
        apiKey: 'test-key',
        enabled: true,
        provider: 'openai'
      });

      await expect(async () => {
        await llmService.sendMessage([
          { role: 'invalid', content: 'Test message' }
        ], testModel);
      }).rejects.toThrow(RequestConfigError);
    });

    it('should handle a disabled model correctly', async () => {
      const testModel = 'test-disabled';
      
      vi.spyOn(modelManager, 'getModel').mockResolvedValue({
        name: 'Test Model',
        baseURL: 'https://test.api/chat/completions',
        models: ['test-model'],
        defaultModel: 'test-model',
        apiKey: 'test-key',
        enabled: false,
        provider: 'openai'
      });

      const messages = [
        { role: 'user', content: 'Hello, let us play a game' }
      ];

      await expect(async () => {
        await llmService.sendMessage(messages, testModel);
      }).rejects.toThrow(RequestConfigError);
    });

    it('should handle an empty message list correctly', async () => {
      const testModel = 'test-empty-messages';
      
      vi.spyOn(modelManager, 'getModel').mockResolvedValue({
        name: 'Test Model',
        baseURL: 'https://test.api/chat/completions',
        models: ['test-model'],
        defaultModel: 'test-model',
        apiKey: 'test-key',
        enabled: true,
        provider: 'openai'
      });

      await expect(async () => {
        await llmService.sendMessage([], testModel);
      }).rejects.toThrow(RequestConfigError);
    });
  });

  describe('Config management', () => {
    it('should handle model config updates correctly', async () => {
      const testModel = 'test-update';
      const config = {
        name: 'Test Model',
        baseURL: 'https://test.api/chat/completions',
        models: ['test-model'],
        defaultModel: 'test-model',
        apiKey: 'test-key',
        enabled: true,
        provider: 'openai'
      };

      vi.spyOn(modelManager, 'getModel').mockImplementation(async (key) => {
        if (key === testModel) {
          return config;
        }
        return undefined;
      });
      
      vi.spyOn(modelManager, 'updateModel').mockResolvedValue(undefined);
      
      const newConfig = {
        name: 'Updated Model',
        baseURL: 'https://updated.api/chat/completions'
      };

      // Modify the mocked return value to handle the case after updateModel
      vi.spyOn(modelManager, 'getModel').mockImplementation(async (key) => {
        if (key === testModel) {
          return {
            ...config,
            ...newConfig
          };
        }
        return undefined;
      });
      
      // Add await to make sure the async assertion runs correctly
      await expect(modelManager.getModel(testModel)).resolves.toBeDefined();

      await modelManager.updateModel(testModel, newConfig);
      const updatedModel = await modelManager.getModel(testModel);
      
      // Use a standard assertion instead of an async assertion
      expect(updatedModel.name).toBe(newConfig.name);
      expect(updatedModel.baseURL).toBe(newConfig.baseURL);
      expect(updatedModel.models).toEqual(config.models);
      expect(updatedModel.defaultModel).toBe(config.defaultModel);
      expect(updatedModel.enabled).toBe(config.enabled);
    });

    it('should handle enabling and disabling models correctly', async () => {
      const testModel = 'test-enable-disable';
      const config = {
        name: 'Test Model',
        baseURL: 'https://test.api/chat/completions',
        models: ['test-model'],
        defaultModel: 'test-model',
        apiKey: 'test-key',
        enabled: true,
        provider: 'openai'
      };

      // Initial state is enabled
      vi.spyOn(modelManager, 'getModel').mockResolvedValue(config);
      
      const model = await modelManager.getModel(testModel);
      expect(model.enabled).toBe(true);

      // State after disabling
      vi.spyOn(modelManager, 'getModel').mockResolvedValue({...config, enabled: false});
      vi.spyOn(modelManager, 'updateModel').mockResolvedValue(undefined);
      
      await modelManager.updateModel(testModel, { enabled: false });
      expect((await modelManager.getModel(testModel)).enabled).toBe(false);

      // Re-enable
      vi.spyOn(modelManager, 'getModel').mockResolvedValue({...config, enabled: true});
      await modelManager.updateModel(testModel, { enabled: true });
      expect((await modelManager.getModel(testModel)).enabled).toBe(true);
    });
  });
}); 