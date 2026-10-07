import { describe, it, expect } from 'vitest';
import {
  createPromptService,
  createModelManager,
  createTemplateManager,
  createHistoryManager,
  LocalStorageProvider,
  createLLMService,
} from '../../../src';
import { createTemplateLanguageService } from '../../../src/services/template/languageService';

const RUN_REAL_API = process.env.RUN_REAL_API === '1'

describe.skipIf(!RUN_REAL_API)('Advanced Optimize Template Real API Test', () => {
  it('should optimize "You are a poet" with real API', async () => {
    // Check whether an API key is available
    const hasApiKey = process.env.GEMINI_API_KEY || process.env.DEEPSEEK_API_KEY ||
                     process.env.OPENAI_API_KEY || process.env.CUSTOM_API_KEY ||
                     process.env.VITE_GEMINI_API_KEY || process.env.VITE_DEEPSEEK_API_KEY ||
                     process.env.VITE_OPENAI_API_KEY || process.env.VITE_CUSTOM_API_KEY;

    if (!hasApiKey) {
      return;
    }

    // 1. Create all dependencies
    const storageProvider = new LocalStorageProvider();
    await storageProvider.clearAll(); // Ensure a clean environment

    const modelManager = createModelManager(storageProvider);
    const languageService = createTemplateLanguageService(storageProvider);
    const templateManager = createTemplateManager(storageProvider, languageService);
    const historyManager = createHistoryManager(storageProvider, modelManager);
    const llmService = createLLMService(modelManager);

    // 2. Initialize services (ModelManager initializes automatically)


    // 3. Create the service under test
    const promptService = createPromptService(
      modelManager,
      llmService,
      templateManager,
      historyManager
    );

    // Get the available models
    const models = await modelManager.getAllModels();
    const availableModel = models.find(m => m.enabled);

    if (!availableModel) {
      return;
    }


    const result = await promptService.optimizePrompt({
      optimizationMode: 'system',
      targetPrompt: 'You are a poet',
      templateId: 'analytical-optimize',
      modelKey: availableModel.id
    });


    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
  }, 300000); // 300-second timeout
}); 
