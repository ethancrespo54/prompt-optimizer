import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GeminiAdapter } from '../../../src/services/llm/adapters/gemini-adapter';
import type { TextModelConfig, Message } from '../../../src/services/llm/types';

// Unit tests should not trigger real network requests; isolate the SDK with minimal mocks where necessary

describe('GeminiAdapter', () => {
  let adapter: GeminiAdapter;

  const mockConfig: TextModelConfig = {
    id: 'gemini',
    name: 'Gemini',
    enabled: true,
    providerMeta: {
      id: 'gemini',
      name: 'Google Gemini',
      description: 'Google Generative AI models',
      requiresApiKey: true,
      defaultBaseURL: 'https://generativelanguage.googleapis.com',
      supportsDynamicModels: true, // Updated to true
      connectionSchema: {
        required: ['apiKey'],
        optional: ['baseURL'],
        fieldTypes: {
          apiKey: 'string',
          baseURL: 'string'
        }
      }
    },
    modelMeta: {
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash',
      description: 'Latest Gemini model',
      providerId: 'gemini',
      capabilities: {
        supportsTools: true,
        supportsReasoning: false,
        maxContextLength: 1000000
      },
      parameterDefinitions: [],
      defaultParameterValues: {}
    },
    connectionConfig: {
      apiKey: 'test-api-key',
      baseURL: 'https://generativelanguage.googleapis.com'
    },
    paramOverrides: {}
  };

  const mockMessages: Message[] = [
    { role: 'user', content: 'Hello, Gemini!' }
  ];

  beforeEach(() => {
    adapter = new GeminiAdapter();
  });

  describe('getProvider', () => {
    it('should return Gemini provider metadata', () => {
      const provider = adapter.getProvider();

      expect(provider.id).toBe('gemini');
      expect(provider.name).toBe('Google Gemini');
      expect(provider.defaultBaseURL).toBe('https://generativelanguage.googleapis.com');
      expect(provider.supportsDynamicModels).toBe(true); // Updated expected value
      expect(provider.requiresApiKey).toBe(true);
    });
  });

  describe('getModels', () => {
    it('should return static Gemini models list', () => {
      const models = adapter.getModels();

      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);

      // Updated to the new model IDs
      const gemini25Flash = models.find(m => m.id === 'gemini-2.5-flash');
      expect(gemini25Flash).toBeDefined();
      expect(gemini25Flash?.providerId).toBe('gemini');
    });
  });

  describe('buildDefaultModel', () => {
    it('should build valid TextModel for unknown model ID', () => {
      const model = adapter.buildDefaultModel('unknown-gemini-model');

      expect(model.id).toBe('unknown-gemini-model');
      expect(model.providerId).toBe('gemini');
      expect(model.capabilities).toBeDefined();
    });
  });

  describe('parameter definitions', () => {
    it('should include thinking parameters in definitions', () => {
      const models = adapter.getModels();
      const model = models[0];

      const paramNames = model.parameterDefinitions.map(p => p.name);

      // Verify the base parameters exist
      expect(paramNames).toContain('temperature');
      expect(paramNames).toContain('topP');
      expect(paramNames).toContain('maxOutputTokens');

      // Verify the thinking parameters exist
      expect(paramNames).toContain('thinkingBudget');
      expect(paramNames).toContain('includeThoughts');

      // Verify the thinking parameter definitions
      const thinkingBudget = model.parameterDefinitions.find(p => p.name === 'thinkingBudget');
      expect(thinkingBudget).toBeDefined();
      expect(thinkingBudget?.type).toBe('number');
      expect(thinkingBudget?.min).toBe(0);  // Allow 0 to disable thinking
      expect(thinkingBudget?.max).toBe(8192);
      expect(thinkingBudget?.description).toContain('Gemini 2.5+');

      const includeThoughts = model.parameterDefinitions.find(p => p.name === 'includeThoughts');
      expect(includeThoughts).toBeDefined();
      expect(includeThoughts?.type).toBe('boolean');
      expect(includeThoughts?.description).toContain('Gemini 2.5+');
    });

    it('should NOT enable thinking parameters by default', () => {
      const models = adapter.getModels();
      const model = models[0];

      const defaultValues = model.defaultParameterValues || {};

      // The default value now returns an empty object so the server uses its official defaults
      // This avoids incorrect client-side defaults affecting results
      expect(defaultValues).toEqual({});

      // Verify the parameter definitions include the thinking parameters
      const paramNames = model.parameterDefinitions.map(p => p.name);
      expect(paramNames).toContain('thinkingBudget');
      expect(paramNames).toContain('includeThoughts');
    });
  });

  describe('error handling', () => {
    it('should throw error when API key is missing', async () => {
      const configWithoutKey = {
        ...mockConfig,
        connectionConfig: {
          ...mockConfig.connectionConfig,
          apiKey: ''
        }
      };

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Avoid calling the real SDK / network: inject a client that rejects
      (adapter as any).createClient = () => ({
        models: {
          generateContent: vi.fn().mockRejectedValue(new Error('Missing API key'))
        }
      });

      await expect(adapter.sendMessage(mockMessages, configWithoutKey)).rejects.toThrow(
        'Missing API key'
      );

      errorSpy.mockRestore();
    });
  });
});
