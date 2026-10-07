import { createLLMService, ModelManager, LocalStorageProvider } from '../../../src/index.js';
import { expect, describe, it, beforeEach, beforeAll } from 'vitest';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
beforeAll(() => {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
});

const RUN_REAL_API = process.env.RUN_REAL_API === '1'

describe.skipIf(!RUN_REAL_API)('DeepSeek API test', () => {
  // Skip tests when no API key is set
  const apiKey = process.env.VITE_DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.log('Skipping the DeepSeek test: the VITE_DEEPSEEK_API_KEY environment variable is not set');
    it.skip('should be able to call the DeepSeek API correctly', () => {});
    it.skip('should be able to handle multi-turn conversation correctly', () => {});
    return;
  }

  it('should be able to call the DeepSeek API correctly', async () => {
    const storage = new LocalStorageProvider();
    const modelManager = new ModelManager(storage);
    const llmService = createLLMService(modelManager);

    // Update the DeepSeek config
    modelManager.updateModel('deepseek', {
      apiKey,
      enabled: true
    });

    const messages = [
      { role: 'user', content: 'Hello, please introduce yourself in one sentence' }
    ];

    const response = await llmService.sendMessage(messages, 'deepseek');
    expect(response).toBeDefined();
    expect(typeof response).toBe('string');
    expect(response.length).toBeGreaterThan(0);
  }, 25000);

  it('should be able to handle multi-turn conversation correctly', async () => {
    const storage = new LocalStorageProvider();
    const modelManager = new ModelManager(storage);
    const llmService = createLLMService(modelManager);

    // Update the DeepSeek config
    modelManager.updateModel('deepseek', {
      apiKey,
      enabled: true
    });

    const messages = [
      { role: 'user', content: 'Hello, let us play a game' },
      { role: 'assistant', content: 'Sure, what game do you want to play?' },
      { role: 'user', content: 'Let us play a number guessing game, between 1 and 100' }
    ];

    const response = await llmService.sendMessage(messages, 'deepseek');
    expect(response).toBeDefined();
    expect(typeof response).toBe('string');
    expect(response.length).toBeGreaterThan(0);
  }, 25000);
}); 
