import { describe, it, beforeEach, beforeAll } from 'vitest';
import { PromptService } from '../../../src/services/prompt/service';
import { ModelManager } from '../../../src/services/model/manager';
import { TemplateManager } from '../../../src/services/template/manager';
import { HistoryManager } from '../../../src/services/history/manager';
import { LocalStorageProvider } from '../../../src/services/storage/localStorageProvider';
import { PreferenceService } from '../../../src/services/preference/service';
import { createLLMService } from '../../../src/services/llm/service';
import { createTemplateManager } from '../../../src/services/template/manager';
import { createTemplateLanguageService } from '../../../src/services/template/languageService';
import { createModelManager } from '../../../src/services/model/manager';
import { createHistoryManager } from '../../../src/services/history/manager';
import { TextAdapterRegistry } from '../../../src/services/llm/adapters/registry';
import { TextModelConfig } from '../../../src/services/model/types';
import type { MessageOptimizationRequest, ConversationMessage } from '../../../src/services/prompt/types';

/**
 * Advanced multi-conversation mode optimization template test (condensed)
 *
 * This test verifies the effect of the three context message optimization templates:
 * 1. context-message-optimize - general message optimization (recommended)
 * 2. context-analytical-optimize - analytical optimization (technical scenarios)
 * 3. context-output-format-optimize - format optimization (data scenarios)
 *
 * Test scenarios: 4 scenarios × 3 templates = 12 tests
 *
 * How to run:
 *   pnpm -F @prompt-optimizer/core test -- --run context-message-optimize
 */

// ============================================================================
// Test case definitions
// ============================================================================

interface TestScenario {
  /** Scenario name */
  name: string;
  /** Scenario description */
  description: string;
  /** Conversation messages */
  messages: ConversationMessage[];
  /** ID of the message to optimize */
  selectedMessageId: string;
  /** Evaluation points */
  evaluationPoints: string[];
}

/** List of templates to test */
const TEMPLATES_TO_TEST = [
  { id: 'context-message-optimize', name: 'General message optimization (recommended)' },
  { id: 'context-analytical-optimize', name: 'Analytical optimization (technical scenarios)' },
  { id: 'context-output-format-optimize', name: 'Format optimization (data scenarios)' },
];

/** Test scenario array - condensed (4 scenarios × 3 templates = 12 tests) */
const TEST_SCENARIOS: TestScenario[] = [
  // Scenario 1: catgirl style (with variables) - style preservation + variable retention
  {
    name: 'Catgirl style (with variables)',
    description: 'Tests style preservation and variable retention',
    messages: [
      { id: 'cat-1', role: 'user', content: 'How is the weather today?' },
      { id: 'cat-2', role: 'assistant', content: 'Nya~ the weather is lovely today, the sun is warm, perfect for sunbathing, nya! If master goes out, remember to bring an umbrella~ (●\'◡\'●)' },
      { id: 'cat-3', role: 'user', content: 'Then now give me {{instruction to complete}}' },
    ],
    selectedMessageId: 'cat-3',
    evaluationPoints: [
      'Is the light/cute style kept?',
      'Is the variable placeholder {{instruction to complete}} kept?',
      'Is it overly complicated?',
    ],
  },

  // Scenario 2: code review style (with variables) - technical scenario
  {
    name: 'Code review style (with variables)',
    description: 'Tests the optimization effect in a technical scenario',
    messages: [
      { id: 'tech-1', role: 'user', content: 'Help me see what is wrong with this code' },
      { id: 'tech-2', role: 'assistant', content: 'Sure, please send me the code and I will help you analyze it.' },
      { id: 'tech-3', role: 'user', content: '```javascript\nfunction add(a, b) { return a + b }\n```\nThis function needs {{optimization direction}}' },
    ],
    selectedMessageId: 'tech-3',
    evaluationPoints: [
      'Is the code block kept correctly?',
      'Is the variable placeholder {{optimization direction}} kept?',
      'Does the analytical template moderately add technical analysis dimensions?',
    ],
  },

  // Scenario 3: tsundere style (no variables) - ⚠️ role preservation test
  {
    name: 'Tsundere style (no variables)',
    description: '⚠️ Key test: a user request must not turn into an assistant reply',
    messages: [
      { id: 'tsun-1', role: 'user', content: 'Help me check tomorrow\'s weather' },
      { id: 'tsun-2', role: 'assistant', content: 'Hmph, it\'s not like I wanted to help you check! I just happened to have nothing to do... Tomorrow is cloudy turning sunny, 18-25 degrees, don\'t think I looked it up specially for you!' },
      { id: 'tsun-3', role: 'user', content: 'Recommend a few songs' },
    ],
    selectedMessageId: 'tsun-3',
    evaluationPoints: [
      '⚠️ [Key] Is the output still a user request? (It must not be a tsundere reply)',
      'Is it kept concise?',
    ],
  },

  // Scenario 4: customer service scenario (no variables) - ⚠️ role opposition test
  {
    name: 'Customer service scenario (no variables)',
    description: '⚠️ Key test: a user complaint must not turn into a customer service reply',
    messages: [
      { id: 'cs-1', role: 'user', content: 'My order still has not shipped after three days' },
      { id: 'cs-2', role: 'assistant', content: 'We are very sorry for the inconvenience! I have checked your order status, and it currently shows the warehouse is processing it urgently. What is your order number? I will help you expedite it.' },
      { id: 'cs-3', role: 'user', content: 'Refund' },
    ],
    selectedMessageId: 'cs-3',
    evaluationPoints: [
      '⚠️ [Key] Is the output still the user\'s refund request? (It must not be a customer service reply)',
      'A refund reason may be added, but the role is still the customer',
    ],
  },
];

// ============================================================================
// Test body
// ============================================================================

describe('Context Message Optimize Templates - Real API Tests', () => {
  // Check the available API keys
  const hasDeepSeekKey = !!process.env.VITE_DEEPSEEK_API_KEY;
  const hasOpenAIKey = !!process.env.VITE_OPENAI_API_KEY;

  // Choose an available model (prefer the DeepSeek chat model)
  const availableModel = hasDeepSeekKey ? 'deepseek'
    : hasOpenAIKey ? 'openai'
    : null;

  const TEST_TIMEOUT = 120000; // 2-minute timeout

  let promptService: PromptService;
  let modelManager: ModelManager;
  let llmService: any;
  let templateManager: TemplateManager;
  let historyManager: HistoryManager;
  let storage: LocalStorageProvider;
  let registry: TextAdapterRegistry;
  let testModelKey: string;

  beforeAll(() => {
    console.log('\n📋 Environment variable check:');
    console.log('  - DEEPSEEK_API_KEY:', hasDeepSeekKey ? '✓' : '✗');
    console.log('  - OPENAI_API_KEY:', hasOpenAIKey ? '✓' : '✗');
    console.log('  - Selected model:', availableModel || 'No available model');
    console.log(`\n📦 Number of test scenarios: ${TEST_SCENARIOS.length}`);
    console.log(`📦 Number of test templates: ${TEMPLATES_TO_TEST.length}`);

    if (!availableModel) {
      console.log('\n⚠️ Skipping the test: no API key environment variable is set');
    }
  });

  beforeEach(async () => {
    // Initialize the storage
    storage = new LocalStorageProvider();
    await storage.clearAll();

    // Initialize the managers
    registry = new TextAdapterRegistry();
    modelManager = createModelManager(storage);
    llmService = createLLMService(modelManager);

    // Create the PreferenceService and the language service
    const preferenceService = new PreferenceService(storage);
    const languageService = createTemplateLanguageService(preferenceService);
    await languageService.initialize();
    await languageService.setLanguage('en-US');

    templateManager = createTemplateManager(storage, languageService);
    historyManager = createHistoryManager(storage, modelManager);

    // Initialize the services
    promptService = new PromptService(modelManager, llmService, templateManager, historyManager);

    // Configure the model based on the available API configs
    if (availableModel === 'deepseek') {
      const adapter = registry.getAdapter('deepseek');
      const models = adapter.getModels();
      const chatModel = models.find(m => m.id === 'deepseek-chat') || models[0];
      const modelConfig: TextModelConfig = {
        id: 'test-deepseek',
        name: 'Test DeepSeek Chat',
        enabled: true,
        providerMeta: adapter.getProvider(),
        modelMeta: chatModel,
        connectionConfig: {
          apiKey: process.env.VITE_DEEPSEEK_API_KEY!
        },
        paramOverrides: {}
      };
      await modelManager.addModel('test-deepseek', modelConfig);
      testModelKey = 'test-deepseek';
    } else if (availableModel === 'openai') {
      const adapter = registry.getAdapter('openai');
      const modelConfig: TextModelConfig = {
        id: 'test-openai',
        name: 'Test OpenAI',
        enabled: true,
        providerMeta: adapter.getProvider(),
        modelMeta: adapter.getModels()[0],
        connectionConfig: {
          apiKey: process.env.VITE_OPENAI_API_KEY!,
          baseURL: process.env.VITE_OPENAI_BASE_URL
        },
        paramOverrides: {}
      };
      await modelManager.addModel('test-openai', modelConfig);
      testModelKey = 'test-openai';
    }
  });

  /**
   * Format the optimization result output
   */
  const printOptimizationResult = (
    scenarioName: string,
    templateName: string,
    originalContent: string,
    optimizedContent: string,
    evaluationPoints: string[]
  ) => {
    console.log('\n' + '='.repeat(80));
    console.log(`🎭 Scenario: ${scenarioName}`);
    console.log(`📝 Template: ${templateName}`);
    console.log('='.repeat(80));
    console.log('\n📌 Original message:');
    console.log('  ' + originalContent.split('\n').join('\n  '));
    console.log('\n✨ Optimization result:');
    console.log('  ' + optimizedContent.split('\n').join('\n  '));
    console.log('\n' + '-'.repeat(80));
    console.log('💡 Evaluation points:');
    evaluationPoints.forEach((point, index) => {
      console.log(`  ${index + 1}. ${point}`);
    });
    console.log('='.repeat(80) + '\n');
  };

  // Automatically iterate over all scenarios and templates to generate tests
  TEST_SCENARIOS.forEach((scenario) => {
    describe(`Scenario: ${scenario.name}`, () => {
      TEMPLATES_TO_TEST.forEach((template) => {
        it.runIf(!!availableModel)(
          `${template.name} - ${scenario.description}`,
          async () => {
            const request: MessageOptimizationRequest = {
              selectedMessageId: scenario.selectedMessageId,
              messages: scenario.messages,
              modelKey: testModelKey,
              templateId: template.id
            };

            const result = await promptService.optimizeMessage(request);
            const originalMessage = scenario.messages.find(
              m => m.id === scenario.selectedMessageId
            )!;

            printOptimizationResult(
              scenario.name,
              template.name,
              originalMessage.content,
              result,
              scenario.evaluationPoints
            );
          },
          TEST_TIMEOUT
        );
      });
    });
  });

  // Placeholder for the skipped test
  it.skipIf(!availableModel)('skip the test - API key not set', () => {
    console.log('⚠️ Please set one of the following environment variables to run the test:');
    console.log('  - VITE_DEEPSEEK_API_KEY');
    console.log('  - VITE_OPENAI_API_KEY');
  });
});
