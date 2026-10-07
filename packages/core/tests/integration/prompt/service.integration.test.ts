import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { PromptService } from '../../../src/services/prompt/service';
import { ModelManager } from '../../../src/services/model/manager';
import { TemplateManager } from '../../../src/services/template/manager';
import { HistoryManager } from '../../../src/services/history/manager';
import { LocalStorageProvider } from '../../../src/services/storage/localStorageProvider';
import { createLLMService } from '../../../src/services/llm/service';
import { createTemplateManager } from '../../../src/services/template/manager';
import { createTemplateLanguageService } from '../../../src/services/template/languageService';
import { createModelManager } from '../../../src/services/model/manager';
import { createHistoryManager } from '../../../src/services/history/manager';
import { Template, MessageTemplate } from '../../../src/services/template/types';
import { TextModelConfig } from '../../../src/services/model/types';
import { TextAdapterRegistry } from '../../../src/services/llm/adapters/registry';

/**
 * PromptService integration test - uses the real Gemini API
 */
describe('PromptService Integration Tests', () => {
  const hasGeminiKey = !!process.env.VITE_GEMINI_API_KEY;
  const DELAY_BETWEEN_TESTS = 60000; // 1-minute delay to avoid rate limiting
  const TEST_TIMEOUT = 120000; // 2-minute timeout


  let promptService: PromptService;
  let modelManager: ModelManager;
  let llmService: any;
  let templateManager: TemplateManager;
  let historyManager: HistoryManager;
  let storage: LocalStorageProvider;
  let registry: TextAdapterRegistry;
  let lastTestTime = 0;

  // Add a delay between tests to avoid API rate limits
  const delayBetweenTests = async () => {
    const now = Date.now();
    const timeSinceLastTest = now - lastTestTime;
    if (lastTestTime > 0 && timeSinceLastTest < DELAY_BETWEEN_TESTS) {
      const waitTime = DELAY_BETWEEN_TESTS - timeSinceLastTest;
      console.log(`⏳ Waiting ${Math.round(waitTime / 1000)}s before next test to avoid rate limiting...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    lastTestTime = Date.now();
  };

  beforeAll(() => {
    console.log('Gemini API Key available:', hasGeminiKey);
    if (!hasGeminiKey) {
      console.log('Skipping PromptService integration tests: GEMINI_API_KEY environment variable not set');
    }
  });

  beforeEach(async () => {
    // Initialize the storage and managers
    storage = new LocalStorageProvider();
    registry = new TextAdapterRegistry();
    modelManager = createModelManager(storage);
    llmService = createLLMService(modelManager);

    const languageService = createTemplateLanguageService(storage);
    templateManager = createTemplateManager(storage, languageService);


    historyManager = createHistoryManager(storage, modelManager);

    // Initialize the services
    promptService = new PromptService(modelManager, llmService, templateManager, historyManager);

    // Clean up the storage
    await storage.clearAll();

    // Only add the model when there is an API key
    if (hasGeminiKey) {
      const adapter = registry.getAdapter('gemini');
      // Automatically use the first available model provided by the adapter, avoiding hard-coded model IDs
      const availableModels = adapter.getModels();
      if (availableModels.length === 0) {
        throw new Error('No Gemini models available from adapter');
      }
      
      const geminiConfig: TextModelConfig = {
        id: 'test-gemini',
        name: 'Test Gemini Model',
        enabled: true,
        providerMeta: adapter.getProvider(),
        modelMeta: availableModels[0], // Use the first available model
        connectionConfig: {
          apiKey: process.env.VITE_GEMINI_API_KEY!
          // Do not override baseURL, use the adapter's default value
        },
        paramOverrides: {
          temperature: 0.7,
          maxOutputTokens: 1000,
          // Disable the thinking feature of Gemini 2.5 for stable test results
          // Reference: https://ai.google.dev/gemini-api/docs/text-generation
          thinkingBudget: 0
        }
      };

      await modelManager.addModel('test-gemini', geminiConfig);
    }
  });

  describe('optimizePrompt with different template formats', () => {
    it.runIf(hasGeminiKey)('should work with string-based templates', async () => {
      await delayBetweenTests();
      const request = {
        optimizationMode: 'system' as const,
        targetPrompt: 'Write a simple greeting',
        modelKey: 'test-gemini'
      };
      const result = await promptService.optimizePrompt(request);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);

      // Simulate the UI layer saving the history record
      await historyManager.createNewChain({
        id: `test_${Date.now()}`,
        originalPrompt: request.targetPrompt,
        optimizedPrompt: result,
        type: 'optimize',
        modelKey: request.modelKey,
        timestamp: Date.now()
      });

      // Verify the history record
      const records = await historyManager.getRecords();
      expect(records.length).toBe(1);
      expect(records[0].type).toBe('optimize');
    }, TEST_TIMEOUT);

    it.runIf(hasGeminiKey)('should work with message-based templates', async () => {
      await delayBetweenTests();
      // Add a message template - using variables that actually exist
      const messageTemplate: Template = {
        id: 'test-message-template',
        name: 'Test Message Template',
        content: [
          {
            role: 'system',
            content: 'You are a helpful AI assistant specialized in prompt optimization.'
          },
          {
            role: 'user',
            content: 'Please optimize this prompt: {{originalPrompt}}'
          }
        ] as MessageTemplate[],
        metadata: {
          version: '1.0',
          lastModified: Date.now(),
          templateType: 'optimize',
          language: 'zh' as const
        }
      };

      await templateManager.saveTemplate(messageTemplate);

      // Use a spy to mock getTemplate returning our template
      const getTemplateSpy = vi.spyOn(templateManager, 'getTemplate').mockReturnValue(messageTemplate);

      const request = {
        optimizationMode: 'system' as const,
        targetPrompt: 'Write a simple greeting',
        modelKey: 'test-gemini'
      };
      const result = await promptService.optimizePrompt(request);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);

      // Verify the template was called
      expect(getTemplateSpy).toHaveBeenCalled();

      // Restore the spy
      getTemplateSpy.mockRestore();
    }, TEST_TIMEOUT);

    it.skipIf(!hasGeminiKey)('skip string-based templates test - no Gemini API key', () => {
      expect(true).toBe(true);
    });
  });

  describe('iteratePrompt with different template formats', () => {
    it.runIf(hasGeminiKey)('should work with string-based iterate templates', async () => {
      await delayBetweenTests();
      // Add a simple iterate template for the test
      const simpleIterateTemplate: Template = {
        id: 'simple-iterate-template',
        name: 'Simple Iterate Template',
        content: [
          {
            role: 'system',
            content: 'You are an expert prompt optimizer.'
          },
          {
            role: 'user',
            content: 'Improve this prompt: {{lastOptimizedPrompt}}\n\nSuggestion: {{iterateInput}}'
          }
        ] as MessageTemplate[],
        metadata: {
          version: '1.0',
          lastModified: Date.now(),
          templateType: 'iterate',
          language: 'zh' as const
        }
      };

      await templateManager.saveTemplate(simpleIterateTemplate);

      // Mock getTemplate returning the iterate template
      const getTemplateSpy = vi.spyOn(templateManager, 'getTemplate').mockReturnValue(simpleIterateTemplate);

      const result = await promptService.iteratePrompt(
        'Write a simple greeting',
        'Hello world',
        'Make it more formal',
        'test-gemini'
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);

      // Restore the spy
      getTemplateSpy.mockRestore();

      // Simulate the UI layer saving the history record - for an iteration, a chain must be created first, then the iteration added
      const chain = await historyManager.createNewChain({
        id: `test_${Date.now()}`,
        originalPrompt: 'Write a simple greeting',
        optimizedPrompt: 'Hello world',
        type: 'optimize',
        modelKey: 'test-gemini',
        timestamp: Date.now()
      });

      await historyManager.addIteration({
        chainId: chain.chainId,
        originalPrompt: 'Write a simple greeting',
        optimizedPrompt: result,
        modelKey: 'test-gemini',
        templateId: 'iterate',
        iterationNote: 'Make it more formal'
      });

      // Verify the history record
      const records = await historyManager.getRecords();
      expect(records.length).toBe(2); // One initial record + one iteration record
      expect(records.find(r => r.type === 'iterate')).toBeDefined();
    }, TEST_TIMEOUT);

    it.runIf(hasGeminiKey)('should work with message-based iterate templates', async () => {
      await delayBetweenTests();
      // Add the iterate template - merged into a single user message
      const iterateTemplate: Template = {
        id: 'test-iterate-template',
        name: 'Test Iterate Template',
        content: [
          {
            role: 'system',
            content: 'You are an expert prompt optimizer.'
          },
          {
            role: 'user',
            content: 'Original prompt: {{originalPrompt}}\n\nLast optimized version: {{lastOptimizedPrompt}}\n\nImprovement request: {{iterateInput}}'
          }
        ] as MessageTemplate[],
        metadata: {
          version: '1.0',
          lastModified: Date.now(),
          templateType: 'iterate',
          language: 'zh' as const
        }
      };

      await templateManager.saveTemplate(iterateTemplate);

      // Mock getTemplate returning the iterate template
      const getTemplateSpy = vi.spyOn(templateManager, 'getTemplate').mockReturnValue(iterateTemplate);

      const result = await promptService.iteratePrompt(
        'Write a simple greeting',
        'Hello world',
        'Make it more creative',
        'test-gemini'
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);

      // Verify the template was called
      expect(getTemplateSpy).toHaveBeenCalled();

      // Restore the spy
      getTemplateSpy.mockRestore();
    }, TEST_TIMEOUT);

    it.skipIf(!hasGeminiKey)('skip iterate templates test - no Gemini API key', () => {
      expect(true).toBe(true);
    });
  });

  describe('streaming methods', () => {
    it.runIf(hasGeminiKey)('should handle optimizePromptStream', async () => {
      await delayBetweenTests();
      const tokens: string[] = [];
      let completed = false;

      const request = {
        optimizationMode: 'system' as const,
        targetPrompt: 'Write a simple greeting',
        modelKey: 'test-gemini',
        templateId: 'general-optimize'
      };

      // Use a Promise to make sure onComplete is awaited correctly
      await new Promise<void>((resolve, reject) => {
        promptService.optimizePromptStream(
          request,
          {
            onToken: (token) => tokens.push(token),
            onComplete: () => {
              completed = true;
              resolve();
            },
            onError: (error) => {
              reject(error);
            }
          }
        ).catch(reject);
      });

      expect(tokens.length).toBeGreaterThan(0);
      expect(completed).toBe(true);

      // Verify the received content
      const fullContent = tokens.join('');
      expect(fullContent.length).toBeGreaterThan(0);
    }, TEST_TIMEOUT);

    it.runIf(hasGeminiKey)('should handle iteratePromptStream with template objects', async () => {
      await delayBetweenTests();
      const tokens: string[] = [];
      let completed = false;

      // Add the streaming iterate template
      const streamIterateTemplate: Template = {
        id: 'stream-iterate-template',
        name: 'Stream Iterate Template',
        content: [
          {
            role: 'system',
            content: 'You are a prompt refinement expert.'
          },
          {
            role: 'user',
            content: 'Original: {{originalPrompt}}\n\nCurrent version: {{lastOptimizedPrompt}}\n\nRefinement: {{iterateInput}}'
          }
        ] as MessageTemplate[],
        metadata: {
          version: '1.0',
          lastModified: Date.now(),
          templateType: 'iterate',
          language: 'zh' as const
        }
      };

      await templateManager.saveTemplate(streamIterateTemplate);

      // Mock getTemplate returning the streaming iterate template
      const getTemplateSpy = vi.spyOn(templateManager, 'getTemplate').mockReturnValue(streamIterateTemplate);

      // Use a Promise to make sure onComplete is awaited correctly
      await new Promise<void>((resolve, reject) => {
        promptService.iteratePromptStream(
          'Write a simple greeting',
          'Hello world',
          'Make it better',
          'test-gemini',
          {
            onToken: (token) => tokens.push(token),
            onComplete: () => {
              completed = true;
              resolve();
            },
            onError: (error) => {
              reject(error);
            }
          },
          'iterate'
        ).catch(reject);
      });

      expect(tokens.length).toBeGreaterThan(0);
      expect(completed).toBe(true);

      // Verify the received content
      const fullContent = tokens.join('');
      expect(fullContent.length).toBeGreaterThan(0);

      // Restore the spy
      getTemplateSpy.mockRestore();
    }, TEST_TIMEOUT);

    it.skipIf(!hasGeminiKey)('skip streaming tests - no Gemini API key', () => {
      expect(true).toBe(true);
    });
  });

  describe('error handling', () => {
    it.runIf(hasGeminiKey)('should handle template not found errors', async () => {
      // Mock the template not being found
      const getTemplateSpy = vi.spyOn(templateManager, 'getTemplate').mockImplementation(() => {
        throw new Error('Template not found');
      });

      const request = {
        optimizationMode: 'system' as const,
        targetPrompt: 'Test prompt',
        modelKey: 'test-gemini'
      };
      await expect(
        promptService.optimizePrompt(request)
      ).rejects.toThrow(/Template not found/);

      // Restore the spy
      getTemplateSpy.mockRestore();
    });

    it.runIf(hasGeminiKey)('should handle invalid template content', async () => {
      const invalidTemplate: Template = {
        id: 'invalid',
        name: 'Invalid Template',
        content: null as any,
        metadata: {
          version: '1.0',
          lastModified: Date.now(),
          templateType: 'optimize',
          language: 'zh' as const
        }
      };

      const getTemplateSpy = vi.spyOn(templateManager, 'getTemplate').mockReturnValue(invalidTemplate);

      const request = {
        optimizationMode: 'system' as const,
        targetPrompt: 'Test prompt',
        modelKey: 'test-gemini'
      };
      await expect(
        promptService.optimizePrompt(request)
      ).rejects.toThrow(/Template not found or invalid/);

      // Restore the spy
      getTemplateSpy.mockRestore();
    });

    it.skipIf(!hasGeminiKey)('skip error handling tests - no Gemini API key', () => {
      expect(true).toBe(true);
    });
  });
});
