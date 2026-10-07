import { describe, it, expect, beforeAll } from 'vitest';
import { TextAdapterRegistry } from '../../../src/services/llm/adapters/registry';
import type { TextModelConfig, Message, TextAdapter } from '../../../src/services/llm/types';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
beforeAll(() => {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
});

const RUN_REAL_API = process.env.RUN_REAL_API === '1';

/**
 * Helper function: create the test config from an adapter
 * Avoid hard-coding the model and baseURL, and use the adapter's default values uniformly
 */
function createTestConfig(
  adapter: TextAdapter,
  apiKey: string,
  paramOverrides: Record<string, any> = {}
): TextModelConfig {
  const models = adapter.getModels();
  if (models.length === 0) {
    throw new Error(`No models available for adapter: ${adapter.getProvider().id}`);
  }

  return {
    id: adapter.getProvider().id,
    name: adapter.getProvider().name,
    enabled: true,
    providerMeta: adapter.getProvider(),
    modelMeta: models[0], // Use the first available model
    connectionConfig: {
      apiKey
      // Do not override baseURL, use the adapter's default value
    },
    paramOverrides
  };
}

describe.skipIf(!RUN_REAL_API)('Adapter Integration Tests - Real SDK', () => {
  let registry: TextAdapterRegistry;

  beforeAll(() => {
    registry = new TextAdapterRegistry();
  });

  describe('OpenAIAdapter Real API', () => {
    const hasApiKey = !!(process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY);

    it.skipIf(!hasApiKey)('should successfully call OpenAI API with sendMessage', async () => {
      const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
      const adapter = registry.getAdapter('openai');
      
      const config = createTestConfig(adapter, apiKey!, {
        temperature: 0.7,
        max_tokens: 100
      });

      const messages: Message[] = [
        { role: 'user', content: 'Please introduce yourself in one sentence' }
      ];

      const response = await adapter.sendMessage(messages, config);

      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
      expect(typeof response.content).toBe('string');
      expect(response.content.length).toBeGreaterThan(0);
      expect(response.metadata.model).toBeDefined();

    }, 30000);

    it.skipIf(!hasApiKey)('should successfully stream OpenAI API with callbacks', async () => {
      const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
      const adapter = registry.getAdapter('openai');

      const config = createTestConfig(adapter, apiKey!);

      const messages: Message[] = [
        { role: 'user', content: 'Please say "hello"' }
      ];

      let contentTokens = '';
      let tokenCount = 0;
      let finalResponse: any = null;
      let isCompleted = false;

      await adapter.sendMessageStream(messages, config, {
        onToken: (token) => {
          contentTokens += token;
          tokenCount++;
        },
        onComplete: (response) => {
          finalResponse = response;
          isCompleted = true;
        },
        onError: (error) => {
          console.error('OpenAI streaming error:', error);
        }
      });

      expect(isCompleted).toBe(true);
      expect(tokenCount).toBeGreaterThan(0);
      expect(contentTokens.length).toBeGreaterThan(0);
      expect(finalResponse).toBeDefined();
      expect(finalResponse.content).toBe(contentTokens);
    }, 30000);

    it.skipIf(!hasApiKey)('should handle OpenAI API errors with stack trace', async () => {
      const adapter = registry.getAdapter('openai');
      const config = createTestConfig(adapter, 'invalid-api-key');

      const messages: Message[] = [
        { role: 'user', content: 'Test' }
      ];

      try {
        await adapter.sendMessage(messages, config);
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error).toBeDefined();
        expect(error.stack).toBeDefined();
        expect(error.message).toBeDefined();
      }
    }, 30000);
  });

  describe('GeminiAdapter Real API', () => {
    const hasApiKey = !!(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY);

    it.skipIf(!hasApiKey)('should successfully call Gemini API', async () => {
      const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
      const adapter = registry.getAdapter('gemini');
      
      const config = createTestConfig(adapter, apiKey!, {
        temperature: 0.7,
        maxOutputTokens: 100
      });

      const messages: Message[] = [
        { role: 'user', content: 'Please introduce yourself in one sentence' }
      ];

      const response = await adapter.sendMessage(messages, config);

      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
      expect(typeof response.content).toBe('string');
      expect(response.content.length).toBeGreaterThan(0);
    }, 30000);

    it.skipIf(!hasApiKey)('should successfully stream Gemini API', async () => {
      const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
      const adapter = registry.getAdapter('gemini');
      
      const config = createTestConfig(adapter, apiKey!);

      const messages: Message[] = [
        { role: 'user', content: 'Please say "hello"' }
      ];

      let contentTokens = '';
      let tokenCount = 0;
      let isCompleted = false;

      await adapter.sendMessageStream(messages, config, {
        onToken: (token) => {
          contentTokens += token;
          tokenCount++;
        },
        onComplete: (response) => {
          isCompleted = true;
        },
        onError: (error) => {
          console.error('Gemini streaming error:', error);
        }
      });

      expect(isCompleted).toBe(true);
      expect(tokenCount).toBeGreaterThan(0);
      expect(contentTokens.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('AnthropicAdapter Real API', () => {
    const hasApiKey = !!(process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY);

    it.skipIf(!hasApiKey)('should successfully call Anthropic API', async () => {
      const apiKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
      const adapter = registry.getAdapter('anthropic');
      
      const config = createTestConfig(adapter, apiKey!, {
        temperature: 0.7,
        max_tokens: 100
      });

      const messages: Message[] = [
        { role: 'user', content: 'Please introduce yourself in one sentence' }
      ];

      const response = await adapter.sendMessage(messages, config);

      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
      expect(typeof response.content).toBe('string');
      expect(response.content.length).toBeGreaterThan(0);
    }, 30000);

    it.skipIf(!hasApiKey)('should successfully stream Anthropic API', async () => {
      const apiKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
      const adapter = registry.getAdapter('anthropic');
      
      const config = createTestConfig(adapter, apiKey!);

      const messages: Message[] = [
        { role: 'user', content: 'Please say "hello"' }
      ];

      let contentTokens = '';
      let tokenCount = 0;
      let isCompleted = false;

      await adapter.sendMessageStream(messages, config, {
        onToken: (token) => {
          contentTokens += token;
          tokenCount++;
        },
        onComplete: (response) => {
          isCompleted = true;
        },
        onError: (error) => {
          console.error('Anthropic streaming error:', error);
        }
      });

      expect(isCompleted).toBe(true);
      expect(tokenCount).toBeGreaterThan(0);
      expect(contentTokens.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Tool Calls Integration', () => {
    const hasOpenAI = !!(process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY);

    it.skipIf(!hasOpenAI)('should handle tool calls with OpenAI', async () => {
      const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
      const adapter = registry.getAdapter('openai');
      
      const config = createTestConfig(adapter, apiKey!);

      const messages: Message[] = [
        { role: 'user', content: 'What is the weather like in Beijing now?' }
      ];

      const tools = [
        {
          type: 'function' as const,
          function: {
            name: 'get_weather',
            description: 'Get the weather info of the given city',
            parameters: {
              type: 'object',
              properties: {
                city: {
                  type: 'string',
                  description: 'City name'
                }
              },
              required: ['city']
            }
          }
        }
      ];

      let toolCalls: any[] = [];
      let isCompleted = false;

      await adapter.sendMessageStreamWithTools(messages, config, tools, {
        onToken: (token) => {
          // Content tokens
        },
        onToolCall: (toolCall) => {
          toolCalls.push(toolCall);
        },
        onComplete: (response) => {
          isCompleted = true;
        },
        onError: (error) => {
          console.error('Tool call error:', error);
        }
      });

      expect(isCompleted).toBe(true);
      expect(toolCalls.length).toBeGreaterThan(0);
      expect(toolCalls[0].function).toBeDefined();
      expect(toolCalls[0].function.name).toBe('get_weather');
      expect(toolCalls[0].function.arguments).toBeDefined();
    }, 30000);
  });

  describe('ModelScopeAdapter Real API', () => {
    const hasApiKey = !!(process.env.MODELSCOPE_API_KEY || process.env.VITE_MODELSCOPE_API_KEY);

    it.skipIf(!hasApiKey)('should successfully call ModelScope API with sendMessage', async () => {
      const apiKey = process.env.MODELSCOPE_API_KEY || process.env.VITE_MODELSCOPE_API_KEY;
      const adapter = registry.getAdapter('modelscope');

      const config = createTestConfig(adapter, apiKey!, {
        temperature: 0.7,
        max_tokens: 100
      });

      const messages: Message[] = [
        { role: 'user', content: 'Please introduce yourself in one sentence' }
      ];

      const response = await adapter.sendMessage(messages, config);

      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
      expect(typeof response.content).toBe('string');
      expect(response.content.length).toBeGreaterThan(0);
      expect(response.metadata.model).toBeDefined();
    }, 30000);

    it.skipIf(!hasApiKey)('should successfully stream ModelScope API with callbacks', async () => {
      const apiKey = process.env.MODELSCOPE_API_KEY || process.env.VITE_MODELSCOPE_API_KEY;
      const adapter = registry.getAdapter('modelscope');

      const config = createTestConfig(adapter, apiKey!);

      const messages: Message[] = [
        { role: 'user', content: 'Please say "hello"' }
      ];

      let contentTokens = '';
      let tokenCount = 0;
      let finalResponse: any = null;
      let isCompleted = false;

      await adapter.sendMessageStream(messages, config, {
        onToken: (token) => {
          contentTokens += token;
          tokenCount++;
        },
        onComplete: (response) => {
          finalResponse = response;
          isCompleted = true;
        },
        onError: (error) => {
          console.error('ModelScope streaming error:', error);
        }
      });

      expect(isCompleted).toBe(true);
      expect(tokenCount).toBeGreaterThan(0);
      expect(contentTokens.length).toBeGreaterThan(0);
      expect(finalResponse).toBeDefined();
      expect(finalResponse.content).toBe(contentTokens);
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should throw clear error for unknown provider', () => {
      expect(() => registry.getAdapter('unknown-provider'))
        .toThrow(/Unknown (provider|text model provider): unknown-provider/);
    });

    it('should return correct static models for each provider', () => {
      const openaiModels = registry.getStaticModels('openai');
      const geminiModels = registry.getStaticModels('gemini');
      const anthropicModels = registry.getStaticModels('anthropic');
      const modelscopeModels = registry.getStaticModels('modelscope');

      expect(openaiModels.length).toBeGreaterThan(0);
      expect(geminiModels.length).toBeGreaterThan(0);
      expect(anthropicModels.length).toBeGreaterThan(0);
      expect(modelscopeModels.length).toBeGreaterThan(0);

      expect(openaiModels.every(m => m.providerId === 'openai')).toBe(true);
      expect(geminiModels.every(m => m.providerId === 'gemini')).toBe(true);
      expect(anthropicModels.every(m => m.providerId === 'anthropic')).toBe(true);
      expect(modelscopeModels.every(m => m.providerId === 'modelscope')).toBe(true);
    });
  });
});
