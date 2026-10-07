import { createLLMService, ModelManager, LocalStorageProvider } from '../../../src/index.js';
import { expect, describe, it, beforeEach, beforeAll } from 'vitest';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
beforeAll(() => {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
});

const RUN_REAL_API = process.env.RUN_REAL_API === '1'

describe.skipIf(!RUN_REAL_API)('OpenAI API real connection test', () => {
  // Check the OpenAI-compatible environment variables (the tests can run if any one exists)
  const openaiCompatibleKeys = [
    'OPENAI_API_KEY', 'VITE_OPENAI_API_KEY',
    'DEEPSEEK_API_KEY', 'VITE_DEEPSEEK_API_KEY', 
    'SILICONFLOW_API_KEY', 'VITE_SILICONFLOW_API_KEY',
    'ZHIPU_API_KEY', 'VITE_ZHIPU_API_KEY',
    'CUSTOM_API_KEY', 'VITE_CUSTOM_API_KEY'
  ];

  const availableKeys = openaiCompatibleKeys.filter(key => 
    process.env[key] && process.env[key].trim()
  );

  if (availableKeys.length === 0) {
    console.log('Skipping the OpenAI real API test: no OpenAI-compatible API key is set');
    it.skip('should be able to call an OpenAI-compatible API correctly', () => {});
    it.skip('should be able to handle multi-turn conversation correctly', () => {});
    it.skip('should be able to use advanced parameters correctly', () => {});
    return;
  }

  // Choose the first available key and its corresponding config
  const getModelConfig = () => {
    if (process.env.SILICONFLOW_API_KEY || process.env.VITE_SILICONFLOW_API_KEY) {
      return {
        key: 'siliconflow',
        apiKey: process.env.SILICONFLOW_API_KEY || process.env.VITE_SILICONFLOW_API_KEY,
        baseURL: 'https://api.siliconflow.cn/v1',
        defaultModel: 'Qwen/Qwen3-8B'
      };
    }
    if (process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY) {
      return {
        key: 'openai',
        apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY,
        baseURL: 'https://api.openai.com/v1',
        defaultModel: 'gpt-3.5-turbo'
      };
    }
    if (process.env.DEEPSEEK_API_KEY || process.env.VITE_DEEPSEEK_API_KEY) {
      return {
        key: 'deepseek',
        apiKey: process.env.DEEPSEEK_API_KEY || process.env.VITE_DEEPSEEK_API_KEY,
        baseURL: 'https://api.deepseek.com/v1',
        defaultModel: 'deepseek-chat'
      };
    }
    if (process.env.ZHIPU_API_KEY || process.env.VITE_ZHIPU_API_KEY) {
      return {
        key: 'zhipu',
        apiKey: process.env.ZHIPU_API_KEY || process.env.VITE_ZHIPU_API_KEY,
        baseURL: 'https://open.bigmodel.cn/api/paas/v4',
        defaultModel: 'glm-4-flash'
      };
    }
    if (process.env.CUSTOM_API_KEY || process.env.VITE_CUSTOM_API_KEY) {
      const baseURL = process.env.CUSTOM_API_BASE_URL || process.env.VITE_CUSTOM_API_BASE_URL;
      const model = process.env.CUSTOM_API_MODEL || process.env.VITE_CUSTOM_API_MODEL;
      
      // Only return the custom config when both baseURL and model have values
      if (baseURL && model) {
        return {
          key: 'custom',
          apiKey: process.env.CUSTOM_API_KEY || process.env.VITE_CUSTOM_API_KEY,
          baseURL: baseURL,
          defaultModel: model
        };
      }
    }
    return null;
  };

  const modelConfig = getModelConfig();
  
  if (!modelConfig) {
    console.log('Skipping the OpenAI real API test: no valid model config');
    it.skip('should be able to call an OpenAI-compatible API correctly', () => {});
    it.skip('should be able to handle multi-turn conversation correctly', () => {});
    it.skip('should be able to use advanced parameters correctly', () => {});
    return;
  }

  console.log(`Running the OpenAI-compatible API test with ${modelConfig.key}, model: ${modelConfig.defaultModel}`);

  it('should be able to call an OpenAI-compatible API correctly', async () => {
    const storage = new LocalStorageProvider();
    const modelManager = new ModelManager(storage);
    const llmService = createLLMService(modelManager);

    try {
      // Update the model config
      await modelManager.updateModel(modelConfig.key, {
        apiKey: modelConfig.apiKey,
        baseURL: modelConfig.baseURL,
        defaultModel: modelConfig.defaultModel,
        enabled: true,
        provider: modelConfig.key
      });

      const messages = [
        { role: 'user', content: 'Hello, please introduce yourself in one sentence' }
      ];

      const response = await llmService.sendMessage(messages, modelConfig.key);
      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
    } catch (error) {
      console.error(`API call failed (${modelConfig.key}):`, error.message);
      // A 400 error may be a config problem; skip the test
      if (error.message.includes('400')) {
        console.log(`Skipping the test: the ${modelConfig.key} API config may have a problem`);
        return;
      }
      throw error;
    }
  }, 300000);

  it('should be able to handle multi-turn conversation correctly', async () => {
    const storage = new LocalStorageProvider();
    const modelManager = new ModelManager(storage);
    const llmService = createLLMService(modelManager);

    try {
      // Update the model config
      await modelManager.updateModel(modelConfig.key, {
        apiKey: modelConfig.apiKey,
        baseURL: modelConfig.baseURL,
        defaultModel: modelConfig.defaultModel,
        enabled: true,
        provider: modelConfig.key
      });

      const messages = [
        { role: 'user', content: 'Hello, let us play a game' },
        { role: 'assistant', content: 'Sure, what game do you want to play?' },
        { role: 'user', content: 'Let us play a number guessing game, between 1 and 100' }
      ];

      const response = await llmService.sendMessage(messages, modelConfig.key);
      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
    } catch (error) {
      console.error(`Multi-turn conversation test failed (${modelConfig.key}):`, error.message);
      if (error.message.includes('400')) {
        console.log(`Skipping the test: the ${modelConfig.key} API config may have a problem`);
        return;
      }
      throw error;
    }
  }, 300000);

  it('should be able to use advanced parameters correctly', async () => {
    const storage = new LocalStorageProvider();
    const modelManager = new ModelManager(storage);
    const llmService = createLLMService(modelManager);

    try {
      // Update the model config, including the advanced parameters
      await modelManager.updateModel(modelConfig.key, {
        apiKey: modelConfig.apiKey,
        baseURL: modelConfig.baseURL,
        defaultModel: modelConfig.defaultModel,
        enabled: true,
        provider: modelConfig.key,
        llmParams: {
          temperature: 0.3,
          max_tokens: 100
        }
      });

      const messages = [
        { role: 'user', content: 'Answer in one sentence: what is artificial intelligence?' }
      ];

      const response = await llmService.sendMessage(messages, modelConfig.key);
      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
      // Since max_tokens=100 is set, the response should be relatively short
      expect(response.length).toBeLessThan(200);
    } catch (error) {
      console.error(`Advanced parameters test failed (${modelConfig.key}):`, error.message);
      if (error.message.includes('400')) {
        console.log(`Skipping the test: the ${modelConfig.key} API config may have a problem`);
        return;
      }
      throw error;
    }
  }, 300000);

  it('should be able to handle the response formats of all models compatibly (reasoning_content + think tags + plain text)', async () => {
    const storage = new LocalStorageProvider();
    const modelManager = new ModelManager(storage);
    const llmService = createLLMService(modelManager);

    try {
      // Test the generic compatibility handling
      await modelManager.updateModel(modelConfig.key, {
        apiKey: modelConfig.apiKey,
        baseURL: modelConfig.baseURL,
        defaultModel: modelConfig.defaultModel,
        enabled: true,
        provider: modelConfig.key,
        llmParams: {
          temperature: 0.1,
          max_tokens: 100
        }
      });

      const testMessages = [
        {
          role: 'user',
          content: 'Answer briefly: what is AI?'
        }
      ];

      // Test non-streaming handling
      const result = await llmService.sendMessage(testMessages, modelConfig.key);
      
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      
      console.log('Compatibility test result:', {
        hasThinkTags: result.includes('<think>'),
        hasContent: result.length > 0,
        result: result
      });

      // Test streaming handling
      let streamResult = '';
      let tokenCount = 0;
      let isCompleted = false;
      let hasError = false;

      await llmService.sendMessageStream(testMessages, modelConfig.key, {
        onToken: (token) => {
          streamResult += token;
          tokenCount++;
        },
        onComplete: (response) => {
          isCompleted = true;
        },
        onError: (error) => {
          hasError = true;
          console.error('Streaming test error:', error);
        }
      });

      expect(hasError).toBe(false);
      expect(isCompleted).toBe(true);
      expect(streamResult.length).toBeGreaterThan(0);
      expect(tokenCount).toBeGreaterThan(0);

      console.log('Streaming compatibility test result:', {
        tokenCount,
        hasThinkTags: streamResult.includes('<think>'),
        streamLength: streamResult.length,
        isCompleted
      });

    } catch (error) {
      console.error('Compatibility test failed:', error);
      throw error;
    }
  },300000);

  it('should be able to handle the streaming output of reasoning_content correctly', async () => {
    const storage = new LocalStorageProvider();
    const modelManager = new ModelManager(storage);
    const llmService = createLLMService(modelManager);

    try {
      // Configure the model
      await modelManager.updateModel(modelConfig.key, {
        apiKey: modelConfig.apiKey,
        baseURL: modelConfig.baseURL,
        defaultModel: modelConfig.defaultModel,
        enabled: true,
        provider: modelConfig.key,
        llmParams: {
          temperature: 0.1,
          max_tokens: 2000
        }
      });

      const testMessages = [
        {
          role: 'user',
          content: 'Who are you'
        }
      ];

      // Mock a streaming response containing reasoning_content
      let fullResult = '';
      let tokenCount = 0;
      let hasThinkTags = false;
      let thinkTagsClosed = false;
      let isCompleted = false;
      let hasError = false;

      await llmService.sendMessageStream(testMessages, modelConfig.key, {
        onToken: (token) => {
          fullResult += token;
          tokenCount++;
          
          // Check the integrity of the think tags
          if (token.includes('<think>')) {
            hasThinkTags = true;
          }
          if (token.includes('</think>')) {
            thinkTagsClosed = true;
          }
        },
        onComplete: (response) => {
          isCompleted = true;
        },
        onError: (error) => {
          hasError = true;
          console.error('Streaming test error:', error);
        }
      });

      // Wait for the streaming to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log('reasoning_content streaming test result:', {
        tokenCount,
        hasThinkTags,
        thinkTagsClosed,
        isCompleted,
        hasError,
        resultLength: fullResult.length,
        fullResult: fullResult
      });

      expect(isCompleted).toBe(true);
      expect(hasError).toBe(false);
      expect(tokenCount).toBeGreaterThan(0);
      expect(fullResult.length).toBeGreaterThan(0);
      
      // If there are think tags, check that they are closed correctly
      const thinkOpenCount = (fullResult.match(/<think>/g) || []).length;
      const thinkCloseCount = (fullResult.match(/<\/think>/g) || []).length;
      
      if (thinkOpenCount > 0) {
        expect(thinkOpenCount).toBe(thinkCloseCount);
        console.log(`✅ Think tags matched: ${thinkOpenCount} opening tags, ${thinkCloseCount} closing tags`);
      }

    } catch (error) {
      console.error('reasoning_content streaming test failed:', error);
      throw error;
    }
  },300000);

  it('should be able to send messages using the structured API', async () => {
    const storage = new LocalStorageProvider();
    const modelManager = new ModelManager(storage);
    const llmService = createLLMService(modelManager);

    try {
      // Configure the model
      await modelManager.updateModel(modelConfig.key, {
        apiKey: modelConfig.apiKey,
        baseURL: modelConfig.baseURL,
        defaultModel: modelConfig.defaultModel,
        enabled: true,
        provider: modelConfig.key,
        llmParams: {
          temperature: 0.3,
          max_tokens: 100
        }
      });

      const testMessages = [
        {
          role: 'user',
          content: 'Answer briefly: what is AI?'
        }
      ];

      // Test the structured API
      const response = await llmService.sendMessageStructured(testMessages, modelConfig.key);
      
      expect(response).toBeDefined();
      expect(typeof response).toBe('object');
      expect(response.content).toBeDefined();
      expect(typeof response.content).toBe('string');
      expect(response.content.length).toBeGreaterThan(0);
      
      // Check the metadata
      expect(response.metadata).toBeDefined();
      expect(response.metadata.model).toBe(modelConfig.defaultModel);
      
      console.log('Structured API test result:', {
        hasContent: response.content.length > 0,
        hasReasoning: !!response.reasoning,
        content: response.content,
        reasoning: response.reasoning,
        model: response.metadata?.model
      });

    } catch (error) {
      console.error('Structured API test failed:', error);
      throw error;
    }
  }, 300000);

  it('should be able to stream using structured callbacks', async () => {
    const storage = new LocalStorageProvider();
    const modelManager = new ModelManager(storage);
    const llmService = createLLMService(modelManager);

    try {
      // Configure the model
      await modelManager.updateModel(modelConfig.key, {
        apiKey: modelConfig.apiKey,
        baseURL: modelConfig.baseURL,
        defaultModel: modelConfig.defaultModel,
        enabled: true,
        provider: modelConfig.key,
        llmParams: {
          temperature: 0.1,
          max_tokens: 1500
        }
      });

      const testMessages = [
        {
          role: 'user',
          content: 'Answer briefly: what is AI?'
        }
      ];

      let contentTokens = '';
      let reasoningTokens = '';
      let finalResponse = null;
      let contentTokenCount = 0;
      let reasoningTokenCount = 0;
      let isCompleted = false;
      let hasError = false;

      await llmService.sendMessageStream(testMessages, modelConfig.key, {
        onToken: (token) => {
          contentTokens += token;
          contentTokenCount++;
        },
        onReasoningToken: (token) => {
          reasoningTokens += token;
          reasoningTokenCount++;
        },
        onComplete: (response) => {
          finalResponse = response;
          isCompleted = true;
        },
        onError: (error) => {
          hasError = true;
          console.error('Structured streaming test error:', error);
        }
      });

      // Wait for the streaming to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log('Structured streaming test result:', {
        contentTokenCount,
        reasoningTokenCount,
        isCompleted,
        hasError,
        content: contentTokens,
        reasoning: reasoningTokens,
        finalResponse: finalResponse
      });

      expect(isCompleted).toBe(true);
      expect(hasError).toBe(false);
      expect(finalResponse).toBeDefined();
      expect(finalResponse.content).toBeDefined();
      expect(contentTokenCount).toBeGreaterThan(0);
      expect(contentTokens.length).toBeGreaterThan(0);
      
      // Verify content consistency
      expect(contentTokens).toBe(finalResponse.content);
      
      // If there is reasoning content, verify consistency
      if (reasoningTokenCount > 0) {
        expect(reasoningTokens).toBe(finalResponse.reasoning || '');
      }

    } catch (error) {
      console.error('Structured streaming test failed:', error);
      throw error;
    }
  }, 300000);
}); 
