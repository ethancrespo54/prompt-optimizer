/**
 * Variable extraction service - real API integration test
 *
 * Tests the integration of the variable extraction service with the real LLM API
 * Only runs when the environment variables exist
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createVariableExtractionService } from '../../../src/services/variable-extraction/service';
import { createTemplateManager } from '../../../src/services/template/manager';
import { createTemplateLanguageService } from '../../../src/services/template/languageService';
import { LocalStorageProvider } from '../../../src/services/storage/localStorageProvider';
import {
  createRealLLMTestContext,
  hasAvailableProvider,
  printAvailableProviders,
  type RealLLMTestContext,
} from '../../helpers/real-llm';
import type {
  IVariableExtractionService,
  VariableExtractionRequest,
} from '../../../src/services/variable-extraction/types';
import type { ITemplateManager } from '../../../src/services/template/types';

const RUN_REAL_API = process.env.RUN_REAL_API === '1';

describe.skipIf(!RUN_REAL_API)('VariableExtractionService - Real API Integration', () => {
  let context: RealLLMTestContext | undefined;
  let variableExtractionService: IVariableExtractionService;
  let templateManager: ITemplateManager;
  let storage: LocalStorageProvider;

  beforeAll(() => {
    printAvailableProviders();

    if (!hasAvailableProvider()) {
    }
  });

  beforeEach(async () => {
    // Create the storage and template manager first
    storage = new LocalStorageProvider();
    await storage.clearAll();

    const languageService = createTemplateLanguageService(storage);
    templateManager = createTemplateManager(storage, languageService);

    // Create the real LLM test context (it uses its own storage and modelManager)
    context = await createRealLLMTestContext({
      paramOverrides: {
        temperature: 0.7,
        // Do not use max_tokens; let the system use the default
      },
    });

    if (!context) {
      return;
    }

    // Create the variable extraction service using the modelManager returned by the context
    variableExtractionService = createVariableExtractionService(
      context.llmService,
      context.modelManager,  // Use the modelManager of the context
      templateManager
    );

  });

  describe('Basic variable extraction test', () => {
    it.skipIf(!hasAvailableProvider())('should successfully extract variables from a simple prompt', async () => {
      if (!context) {
        return;
      }

      const request: VariableExtractionRequest = {
        promptContent: 'Please write an article about spring, within 500 words.',
        extractionModelKey: context.modelKey,
        existingVariableNames: [],
      };

      const result = await variableExtractionService.extract(request);

      // Verify the returned structure
      expect(result).toBeDefined();
      expect(result.variables).toBeInstanceOf(Array);
      expect(result.summary).toBeDefined();
      expect(typeof result.summary).toBe('string');

      // Print the result

      if (result.variables.length > 0) {
        result.variables.forEach((v, index) => {
        });

        // Verify the structure of the first variable
        const firstVar = result.variables[0];
        expect(firstVar.name).toBeDefined();
        expect(typeof firstVar.name).toBe('string');
        expect(firstVar.value).toBeDefined();
        expect(typeof firstVar.value).toBe('string');
        expect(firstVar.position).toBeDefined();
        expect(firstVar.position.originalText).toBeDefined();
        expect(typeof firstVar.position.occurrence).toBe('number');
        expect(firstVar.position.occurrence).toBeGreaterThan(0);
        expect(firstVar.reason).toBeDefined();
        expect(typeof firstVar.reason).toBe('string');

        // Verify the variable name follows the rules (letters/digits/underscores, not starting with a digit)
        expect(firstVar.name).toMatch(/^[a-zA-Z_\u4e00-\u9fa5][a-zA-Z0-9_\u4e00-\u9fa5]*$/);
      }
    }, 60000);

    it.skipIf(!hasAvailableProvider())('should be able to extract variables from a complex prompt containing multiple variables', async () => {
      if (!context) {
        return;
      }

      const request: VariableExtractionRequest = {
        promptContent: `As a professional novelist, please write a science fiction story.
Requirements:
- Theme: artificial intelligence
- Style: suspenseful and tense
- Word count: 3000 words
- Target readers: adults
- Narrative perspective: first person

Please make sure the plot is engaging and the characters are distinctive.`,
        extractionModelKey: context.modelKey,
        existingVariableNames: [],
      };

      const result = await variableExtractionService.extract(request);


      // Multiple variables should be extracted (theme, style, word count, target readers, narrative perspective, etc.)
      expect(result.variables.length).toBeGreaterThan(0);

      if (result.variables.length > 0) {
        result.variables.forEach((v, index) => {
          if (v.category) {
          }
        });

        // Verify all variables have valid location info
        result.variables.forEach((v) => {
          expect(v.position.originalText).toBeTruthy();
          expect(request.promptContent).toContain(v.position.originalText);
        });
      }
    }, 60000);

    it.skipIf(!hasAvailableProvider())('should avoid name collisions with existing variables', async () => {
      if (!context) {
        return;
      }

      const request: VariableExtractionRequest = {
        promptContent: 'Please write an article about spring, within 500 words.',
        extractionModelKey: context.modelKey,
        existingVariableNames: ['season', 'topic', 'season_name', 'theme', 'word_count'],
      };

      const result = await variableExtractionService.extract(request);


      if (result.variables.length > 0) {
        result.variables.forEach((v, index) => {

          // Verify there are no name collisions
          expect(request.existingVariableNames).not.toContain(v.name);
        });
      }
    }, 60000);
  });

  describe('Error handling test', () => {
    it.skipIf(!hasAvailableProvider())('should throw a validation error when the prompt is empty', async () => {
      if (!context) {
        return;
      }

      const request: VariableExtractionRequest = {
        promptContent: '',
        extractionModelKey: context.modelKey,
        existingVariableNames: [],
      };

      await expect(variableExtractionService.extract(request)).rejects.toThrow();
    });

    it.skipIf(!hasAvailableProvider())('should throw a model error when the model does not exist', async () => {
      if (!context) {
        return;
      }

      const request: VariableExtractionRequest = {
        promptContent: 'Test prompt',
        extractionModelKey: 'non-existent-model',
        existingVariableNames: [],
      };

      await expect(variableExtractionService.extract(request)).rejects.toThrow();
    });
  });

  describe('Special scenario test', () => {
    it.skipIf(!hasAvailableProvider())('should be able to handle a prompt containing the variable marker {{}}', async () => {
      if (!context) {
        return;
      }

      const request: VariableExtractionRequest = {
        promptContent: 'Please generate an article about artificial intelligence based on {{user_input}}.',
        extractionModelKey: context.modelKey,
        existingVariableNames: ['user_input'],
      };

      const result = await variableExtractionService.extract(request);


      if (result.variables.length > 0) {
        result.variables.forEach((v, index) => {
        });
      }

      // The variables may include content such as "artificial intelligence"
      expect(result).toBeDefined();
    }, 60000);

    it.skipIf(!hasAvailableProvider())('should be able to handle a pure English prompt', async () => {
      if (!context) {
        return;
      }

      const request: VariableExtractionRequest = {
        promptContent: 'Write a story about artificial intelligence in 500 words.',
        extractionModelKey: context.modelKey,
        existingVariableNames: [],
      };

      const result = await variableExtractionService.extract(request);


      if (result.variables.length > 0) {
        result.variables.forEach((v, index) => {
        });

        // Verify the variable name follows the rules
        result.variables.forEach((v) => {
          expect(v.name).toMatch(/^[a-zA-Z_\u4e00-\u9fa5][a-zA-Z0-9_\u4e00-\u9fa5]*$/);
        });
      }
    }, 60000);

    it.skipIf(!hasAvailableProvider())('should be able to handle a prompt without obvious variables', async () => {
      if (!context) {
        return;
      }

      const request: VariableExtractionRequest = {
        promptContent: 'Hello!',
        extractionModelKey: context.modelKey,
        existingVariableNames: [],
      };

      const result = await variableExtractionService.extract(request);


      // Should return an empty array or very few variables
      expect(result.variables).toBeInstanceOf(Array);
      expect(result.summary).toBeDefined();
    }, 60000);
  });

  describe('End-to-end workflow test', () => {
    it.skipIf(!hasAvailableProvider())('should complete the full variable extraction → replacement flow', async () => {
      if (!context) {
        return;
      }

      const originalPrompt = 'Please write an article about spring, within 500 words, in a light and cheerful style.';

      // 1. Extract the variables
      const extractRequest: VariableExtractionRequest = {
        promptContent: originalPrompt,
        extractionModelKey: context.modelKey,
        existingVariableNames: [],
      };

      const extractResult = await variableExtractionService.extract(extractRequest);


      if (extractResult.variables.length > 0) {
        // 2. Simulate the replacement process (replacing from back to front)
        let replacedPrompt = originalPrompt;
        const sortedVariables = [...extractResult.variables].sort((a, b) => {
          const indexA = findOccurrenceIndex(originalPrompt, a.position.originalText, a.position.occurrence);
          const indexB = findOccurrenceIndex(originalPrompt, b.position.originalText, b.position.occurrence);
          return indexB - indexA;
        });

        for (const variable of sortedVariables) {
          const { originalText, occurrence } = variable.position;
          const placeholder = `{{${variable.name}}}`;

          const index = findOccurrenceIndex(replacedPrompt, originalText, occurrence);
          if (index !== -1) {
            replacedPrompt =
              replacedPrompt.substring(0, index) +
              placeholder +
              replacedPrompt.substring(index + originalText.length);
          }
        }

        extractResult.variables.forEach((v, index) => {
        });

        // Verify the replaced prompt contains the variable placeholders
        extractResult.variables.forEach((v) => {
          expect(replacedPrompt).toContain(`{{${v.name}}}`);
        });

        // Verify the replaced prompt no longer contains the replaced original text (except the parts that were not replaced)
        // Note: this verification is complex, because the original text may appear in many places
      }
    }, 60000);
  });
});

/**
 * Helper function: find the index of the Nth occurrence of the text
 */
function findOccurrenceIndex(text: string, searchText: string, occurrence: number): number {
  let count = 0;
  let index = -1;

  while (count < occurrence) {
    index = text.indexOf(searchText, index + 1);
    if (index === -1) {
      return -1;
    }
    count++;
  }

  return index;
}

