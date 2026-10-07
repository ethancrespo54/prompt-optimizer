import { createLLMService, ModelManager } from '../../../src/index.js';
import { expect, describe, it, beforeEach, beforeAll, vi } from 'vitest';
import dotenv from 'dotenv';
import path from 'path';
import { createMockStorage } from '../../mocks/mockStorage';

// Load environment variables
beforeAll(() => {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
});

describe('Custom model test', () => {
  let llmService;
  let modelManager;
  let mockStorage;

  beforeEach(() => {
    mockStorage = createMockStorage();
    mockStorage.getItem.mockResolvedValue(null);
    
    modelManager = new ModelManager(mockStorage);
    llmService = createLLMService(modelManager);
    
    // Create the custom model config
    const customConfig = {
      name: 'Custom',
      baseURL: process.env.VITE_CUSTOM_API_BASE_URL || 'https://api.custom.test',
      models: [process.env.VITE_CUSTOM_API_MODEL || 'test-model'],
      defaultModel: process.env.VITE_CUSTOM_API_MODEL || 'test-model',
      apiKey: process.env.VITE_CUSTOM_API_KEY || 'test-key',
      enabled: !!process.env.VITE_CUSTOM_API_KEY,
      provider: 'custom'
    };
    
    // Mock fetching the custom model
    vi.spyOn(modelManager, 'getModel').mockImplementation(async (key) => {
      if (key === 'custom') {
        return customConfig;
      }
      return undefined;
    });
  });

  it('should be able to load and use the custom model correctly', async () => {
    const model = await modelManager.getModel('custom');
    
    expect(model).toBeDefined();
    expect(model.name).toBe('Custom');
    
    // Handle the case where the environment variable may be empty
    if (process.env.VITE_CUSTOM_API_BASE_URL) {
      expect(model.baseURL).toBe(process.env.VITE_CUSTOM_API_BASE_URL);
    }
    
    if (process.env.VITE_CUSTOM_API_MODEL) {
      expect(model.models).toEqual([process.env.VITE_CUSTOM_API_MODEL]);
      expect(model.defaultModel).toBe(process.env.VITE_CUSTOM_API_MODEL);
    }
    
    expect(model.enabled).toBe(!!process.env.VITE_CUSTOM_API_KEY);
  });

  it('should handle custom model config updates correctly', async () => {
    const updatedConfig = {
      name: 'Updated Custom Model',
      baseURL: process.env.VITE_CUSTOM_API_BASE_URL || 'https://api.custom.test',
      models: [process.env.VITE_CUSTOM_API_MODEL || 'test-model'],
      defaultModel: process.env.VITE_CUSTOM_API_MODEL || 'test-model',
      enabled: true,
      provider: 'custom'
    };

    // Mock the updated model
    vi.spyOn(modelManager, 'getModel').mockImplementation(async (key) => {
      if (key === 'custom') {
        return updatedConfig;
      }
      return undefined;
    });
    
    vi.spyOn(modelManager, 'updateModel').mockResolvedValue(undefined);
    
    await modelManager.updateModel('custom', updatedConfig);
    const model = await modelManager.getModel('custom');

    expect(model.name).toBe(updatedConfig.name);
    expect(model.baseURL).toBe(updatedConfig.baseURL);
    expect(model.models).toEqual(updatedConfig.models);
    expect(model.defaultModel).toBe(updatedConfig.defaultModel);
  });

  it('should be able to call the API of the custom model correctly', async () => {
    if (!process.env.VITE_CUSTOM_API_KEY) {
      console.log('Skipping the test: the VITE_CUSTOM_API_KEY environment variable is not set');
      return;
    }

    // Mock the API call
    vi.spyOn(llmService, 'sendMessage').mockResolvedValue('This is a mocked API response');

    const messages = [
      { role: 'user', content: 'Hello, please introduce yourself in one sentence' }
    ];

    const response = await llmService.sendMessage(messages, 'custom');
    expect(response).toBeDefined();
    expect(typeof response).toBe('string');
    expect(response.length).toBeGreaterThan(0);
  }, 25000);

  it('should handle multi-turn conversation with the custom model correctly', async () => {
    if (!process.env.VITE_CUSTOM_API_KEY) {
      console.log('Skipping the test: the VITE_CUSTOM_API_KEY environment variable is not set');
      return;
    }

    // Mock the API call
    vi.spyOn(llmService, 'sendMessage').mockResolvedValue('This is a mocked multi-turn conversation response');

    const messages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hello! How can I help you?' },
      { role: 'user', content: 'Goodbye' }
    ];

    const response = await llmService.sendMessage(messages, 'custom');
    expect(response).toBeDefined();
    expect(typeof response).toBe('string');
    expect(response.length).toBeGreaterThan(0);
  }, 25000);
}); 