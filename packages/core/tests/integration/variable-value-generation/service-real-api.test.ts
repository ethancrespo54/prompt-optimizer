/**
 * Variable value generation service - real API integration test
 *
 * Tests the integration of the variable value generation service with the real LLM API
 * Only runs when the environment variables exist
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createVariableValueGenerationService } from '../../../src/services/variable-value-generation/service';
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
  IVariableValueGenerationService,
  VariableValueGenerationRequest,
} from '../../../src/services/variable-value-generation/types';
import type { ITemplateManager } from '../../../src/services/template/types';

const RUN_REAL_API = process.env.RUN_REAL_API === '1';

describe.skipIf(!RUN_REAL_API)('VariableValueGenerationService - Real API Integration', () => {
  let context: RealLLMTestContext | undefined;
  let variableValueGenerationService: IVariableValueGenerationService;
  let templateManager: ITemplateManager;
  let storage: LocalStorageProvider;

  beforeAll(() => {
    console.log('\n=== Variable value generation service - real API test ===\n');
    printAvailableProviders();

    if (!hasAvailableProvider()) {
      console.log('⚠️  Skipping the real API test: no API key environment variable is set');
    }
  });

  beforeEach(async () => {
    // Create the storage and template manager
    storage = new LocalStorageProvider();
    await storage.clearAll();

    const languageService = createTemplateLanguageService(storage);
    templateManager = createTemplateManager(storage, languageService);

    // Create the real LLM test context
    context = await createRealLLMTestContext({
      paramOverrides: {
        temperature: 0.7,
      },
    });

    if (!context) {
      console.log('⚠️  No available LLM provider, skipping the test');
      return;
    }

    // Create the variable value generation service using the context's modelManager
    variableValueGenerationService = createVariableValueGenerationService(
      context.llmService,
      context.modelManager,
      templateManager
    );

    console.log(`\n✅ Using provider: ${context.provider.providerName}`);
    console.log(`   Model: ${context.modelConfig.modelMeta.name} (${context.modelConfig.modelMeta.id})\n`);
  });

  describe('Basic variable value generation test', () => {
    it.skipIf(!hasAvailableProvider())('should successfully generate variable values for a simple prompt', async () => {
      if (!context) {
        console.log('Skipping the test: no available LLM provider');
        return;
      }

      const request: VariableValueGenerationRequest = {
        promptContent: 'Please write an article about {{topic}}, within {{word_count}} words.',
        variables: [
          { name: 'topic' },
          { name: 'word_count' }
        ],
        generationModelKey: context.modelKey,
      };

      const result = await variableValueGenerationService.generate(request);

      // Verify the returned structure
      expect(result).toBeDefined();
      expect(result.values).toBeInstanceOf(Array);
      expect(result.summary).toBeDefined();
      expect(typeof result.summary).toBe('string');

      // Values should be generated for all variables
      expect(result.values.length).toBe(2);

      // Print the result
      console.log('\n📝 Generation result:');
      console.log(`   Summary: ${result.summary}`);
      console.log(`   Number of generated variable values: ${result.values.length}`);

      console.log('\n   Variable value details:');
      result.values.forEach((v, index) => {
        console.log(`   ${index + 1}. ${v.name} = "${v.value}"`);
        console.log(`      Reason: ${v.reason}`);
        if (v.confidence !== undefined) {
          console.log(`      Confidence: ${(v.confidence * 100).toFixed(0)}%`);
        }
      });

      // Verify the structure of the first variable value
      const firstValue = result.values[0];
      expect(firstValue.name).toBeDefined();
      expect(typeof firstValue.name).toBe('string');
      expect(firstValue.value).toBeDefined();
      expect(typeof firstValue.value).toBe('string');
      expect(firstValue.reason).toBeDefined();
      expect(typeof firstValue.reason).toBe('string');

      // Verify the variable names match
      const names = result.values.map(v => v.name);
      expect(names).toContain('topic');
      expect(names).toContain('word_count');
    }, 60000);

    it.skipIf(!hasAvailableProvider())('should be able to generate values for a complex scenario with multiple variables', async () => {
      if (!context) {
        console.log('Skipping the test: no available LLM provider');
        return;
      }

      const request: VariableValueGenerationRequest = {
        promptContent: `As a professional {{profession}}, please write a {{genre}}.
Requirements:
- Theme: {{topic}}
- Style: {{style}}
- Word count: {{word_count}} words
- Target readers: {{audience}}`,
        variables: [
          { name: 'profession' },
          { name: 'genre' },
          { name: 'topic' },
          { name: 'style' },
          { name: 'word_count' },
          { name: 'audience' }
        ],
        generationModelKey: context.modelKey,
      };

      const result = await variableValueGenerationService.generate(request);

      console.log('\n📝 Complex scenario generation result:');
      console.log(`   Summary: ${result.summary}`);
      console.log(`   Number of generated variable values: ${result.values.length}`);

      // Values should be generated for all 6 variables
      expect(result.values.length).toBe(6);

      console.log('\n   Variable value details:');
      result.values.forEach((v, index) => {
        console.log(`   ${index + 1}. ${v.name} = "${v.value}"`);
        console.log(`      Reason: ${v.reason}`);
      });

      // Verify all variables have values
      result.values.forEach((v) => {
        expect(v.value).toBeTruthy();
        expect(v.value.trim().length).toBeGreaterThan(0);
      });
    }, 60000);

    it.skipIf(!hasAvailableProvider())('should be able to generate new values with reference to the current values', async () => {
      if (!context) {
        console.log('Skipping the test: no available LLM provider');
        return;
      }

      const request: VariableValueGenerationRequest = {
        promptContent: 'Please write a {{genre}} about {{topic}}, {{word_count}} words.',
        variables: [
          { name: 'topic', currentValue: 'Artificial intelligence' },
          { name: 'genre', currentValue: 'Popular science article' },
          { name: 'word_count' }  // This one has no current value
        ],
        generationModelKey: context.modelKey,
      };

      const result = await variableValueGenerationService.generate(request);

      console.log('\n📝 Generation result with reference to the current values:');
      console.log(`   Summary: ${result.summary}`);

      console.log('\n   Variable value details:');
      result.values.forEach((v, index) => {
        const currentValue = request.variables.find(rv => rv.name === v.name)?.currentValue;
        console.log(`   ${index + 1}. ${v.name} = "${v.value}" ${currentValue ? `(current value: ${currentValue})` : ''}`);
        console.log(`      Reason: ${v.reason}`);
      });

      expect(result.values.length).toBe(3);
    }, 60000);
  });

  describe('Error handling test', () => {
    it.skipIf(!hasAvailableProvider())('should throw a validation error when the prompt is empty', async () => {
      if (!context) {
        console.log('Skipping the test: no available LLM provider');
        return;
      }

      const request: VariableValueGenerationRequest = {
        promptContent: '',
        variables: [{ name: 'topic' }],
        generationModelKey: context.modelKey,
      };

      await expect(variableValueGenerationService.generate(request)).rejects.toThrow();
    });

    it.skipIf(!hasAvailableProvider())('should throw a validation error when the variable list is empty', async () => {
      if (!context) {
        console.log('Skipping the test: no available LLM provider');
        return;
      }

      const request: VariableValueGenerationRequest = {
        promptContent: 'Test prompt',
        variables: [],
        generationModelKey: context.modelKey,
      };

      await expect(variableValueGenerationService.generate(request)).rejects.toThrow();
    });

    it.skipIf(!hasAvailableProvider())('should throw a model error when the model does not exist', async () => {
      if (!context) {
        console.log('Skipping the test: no available LLM provider');
        return;
      }

      const request: VariableValueGenerationRequest = {
        promptContent: 'Test prompt',
        variables: [{ name: 'topic' }],
        generationModelKey: 'non-existent-model',
      };

      await expect(variableValueGenerationService.generate(request)).rejects.toThrow();
    });
  });

  describe('Special scenario test', () => {
    it.skipIf(!hasAvailableProvider())('should be able to handle a pure English prompt', async () => {
      if (!context) {
        console.log('Skipping the test: no available LLM provider');
        return;
      }

      const request: VariableValueGenerationRequest = {
        promptContent: 'Write a {{type}} about {{topic}} in {{word_count}} words.',
        variables: [
          { name: 'type' },
          { name: 'topic' },
          { name: 'word_count' }
        ],
        generationModelKey: context.modelKey,
      };

      const result = await variableValueGenerationService.generate(request);

      console.log('\n📝 English prompt generation result:');
      console.log(`   Summary: ${result.summary}`);

      console.log('\n   Variable value details:');
      result.values.forEach((v, index) => {
        console.log(`   ${index + 1}. ${v.name} = "${v.value}"`);
        console.log(`      Reason: ${v.reason}`);
      });

      expect(result.values.length).toBe(3);
      result.values.forEach((v) => {
        expect(v.value).toBeTruthy();
      });
    }, 60000);

    it.skipIf(!hasAvailableProvider())('should be able to handle a request with variable source identifiers', async () => {
      if (!context) {
        console.log('Skipping the test: no available LLM provider');
        return;
      }

      const request: VariableValueGenerationRequest = {
        promptContent: 'Please write an article about {{topic}} in the style of {{style}}.',
        variables: [
          { name: 'topic', source: 'global' },
          { name: 'style', source: 'test', currentValue: 'Light and humorous' }
        ],
        generationModelKey: context.modelKey,
      };

      const result = await variableValueGenerationService.generate(request);

      console.log('\n📝 Generation result with source identifiers:');
      console.log(`   Summary: ${result.summary}`);

      console.log('\n   Variable value details:');
      result.values.forEach((v, index) => {
        const variable = request.variables.find(rv => rv.name === v.name);
        console.log(`   ${index + 1}. ${v.name} = "${v.value}" [${variable?.source || 'unknown'}]`);
        console.log(`      Reason: ${v.reason}`);
      });

      expect(result.values.length).toBe(2);
    }, 60000);
  });

  describe('Data quality test', () => {
    it.skipIf(!hasAvailableProvider())('the generated values should be relevant to the prompt context', async () => {
      if (!context) {
        console.log('Skipping the test: no available LLM provider');
        return;
      }

      const request: VariableValueGenerationRequest = {
        promptContent: 'As a children education expert, write a {{course_type}} course plan for children aged 5-7, with the theme {{topic}}.',
        variables: [
          { name: 'course_type' },
          { name: 'topic' }
        ],
        generationModelKey: context.modelKey,
      };

      const result = await variableValueGenerationService.generate(request);

      console.log('\n📝 Context relevance test result:');
      result.values.forEach((v) => {
        console.log(`   ${v.name}: "${v.value}"`);
        console.log(`   Reason: ${v.reason}`);
      });

      // Verify the generated reason field is not empty (indicating the LLM understood the context)
      result.values.forEach((v) => {
        expect(v.reason.length).toBeGreaterThan(10); // The reason should have a certain length
      });
    }, 60000);

    it.skipIf(!hasAvailableProvider())('should generate values for all requested variables', async () => {
      if (!context) {
        console.log('Skipping the test: no available LLM provider');
        return;
      }

      const variableNames = ['variable_1', 'variable_2', 'variable_3', 'variable_4', 'variable_5'];
      const request: VariableValueGenerationRequest = {
        promptContent: `Test prompt containing multiple variables: ${variableNames.map(name => `{{${name}}}`).join(', ')}`,
        variables: variableNames.map(name => ({ name })),
        generationModelKey: context.modelKey,
      };

      const result = await variableValueGenerationService.generate(request);

      console.log('\n📝 Completeness test result:');
      console.log(`   Number of requested variables: ${variableNames.length}`);
      console.log(`   Number of generated variables: ${result.values.length}`);

      // Values should be generated for all variables
      expect(result.values.length).toBe(variableNames.length);

      // Verify the variable names all match
      const generatedNames = result.values.map(v => v.name);
      variableNames.forEach(name => {
        expect(generatedNames).toContain(name);
      });
    }, 60000);
  });
});
