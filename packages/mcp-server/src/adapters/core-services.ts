/**
 * Core service manager
 * 
 * Responsible for initializing and managing all Core module services
 * Uses the singleton pattern to ensure the uniqueness of the service instances
 */

import {
  MemoryStorageProvider,
  createModelManager,
  createLLMService,
  createTemplateManager,
  createHistoryManager,
  createPromptService,
  PromptService,
  IPromptService,
  ModelManager,
  ILLMService,
  TemplateManager,
  HistoryManager,

} from '@prompt-optimizer/core';

import { MCPServerConfig } from '../config/environment.js';
import { setupDefaultModel } from '../config/models.js';
import * as logger from '../utils/logging.js';
import { createSimpleLanguageService, SimpleLanguageService } from './language-service.js';

export class CoreServicesManager {
  private static instance: CoreServicesManager;
  private promptService: PromptService | null = null;
  private modelManager: ModelManager | null = null;
  private llmService: ILLMService | null = null;
  private templateManager: TemplateManager | null = null;
  private languageService: SimpleLanguageService | null = null;
  private historyManager: HistoryManager | null = null;
  private initialized = false;

  private constructor() {
    // The constructor is now more concise
  }

  static getInstance(): CoreServicesManager {
    if (!CoreServicesManager.instance) {
      CoreServicesManager.instance = new CoreServicesManager();
    }
    return CoreServicesManager.instance;
  }

  async initialize(config: MCPServerConfig): Promise<void> {
    if (this.initialized) {
      logger.warn('CoreServicesManager already initialized');
      return;
    }

    try {
      logger.info('Initializing Core services...');

      // 1. Create the in-memory storage provider
      logger.debug('Creating memory storage provider');
      const storage = new MemoryStorageProvider();

      // 2. Initialize the model manager
      logger.debug('Initializing ModelManager');
      this.modelManager = createModelManager(storage);

      // 3. Configure the default model
      await this.setupDefaultModel(config);

      // 4. Initialize the LLM service
      logger.debug('Initializing LLMService');
      this.llmService = createLLMService(this.modelManager);

      // 5. Initialize the language service
      logger.debug('Initializing LanguageService');
      const defaultLanguage = config.defaultLanguage || process.env.MCP_DEFAULT_LANGUAGE || 'en';
      this.languageService = createSimpleLanguageService(defaultLanguage);
      await this.languageService.initialize();

      // 6. Initialize the template manager
      logger.debug('Initializing TemplateManager');
      this.templateManager = createTemplateManager(storage, this.languageService);
      // Note: the built-in templates of core are available automatically, no extra setup needed

      // 8. Initialize the history manager
      logger.debug('Initializing HistoryManager');
      this.historyManager = createHistoryManager(storage, this.modelManager);

      // 9. Create the prompt service
      logger.debug('Creating PromptService');
      this.promptService = createPromptService(
        this.modelManager,
        this.llmService,
        this.templateManager,
        this.historyManager
      );

      // 10. Validate the service health
      await this.validateServices();

      this.initialized = true;
      logger.info('Core services initialized successfully');

    } catch (error) {
      // Record detailed error info
      logger.error('Failed to initialize Core services', error as Error);

      // Check whether any model config is available
      this.showEnvironmentHint();

      throw new Error(`Core services initialization failed: ${(error as Error).message}`);
    }
  }

  private async setupDefaultModel(config: MCPServerConfig): Promise<void> {
    if (!this.modelManager) {
      throw new Error('ModelManager not initialized');
    }

    try {
      // Use the refactored setupDefaultModel function, passing only preferredProvider
      await setupDefaultModel(
        this.modelManager,
        config.preferredModelProvider
      );

      // Get and display the info of the model currently in use
      const mcpModel = await this.modelManager.getModel('mcp-default');
      if (mcpModel) {
        logger.info(`✅ Using model: ${mcpModel.name} (${mcpModel.provider})`);
        logger.info(`   Model: ${mcpModel.defaultModel}`);
        logger.info(`   Base URL: ${mcpModel.baseURL}`);
      } else {
        logger.info(`Default model configured with preferred provider: ${config.preferredModelProvider || 'auto-selected'}`);
      }
    } catch (error) {
      throw new Error(`Failed to setup default model: ${(error as Error).message}`);
    }
  }



  /**
   * Show environment variable configuration hints
   */
  private showEnvironmentHint(): void {
    try {
      // Check the current environment variable state
      const staticEnvVars = [
        'VITE_OPENAI_API_KEY',
        'VITE_GEMINI_API_KEY',
        'VITE_DEEPSEEK_API_KEY',
        'VITE_ZHIPU_API_KEY',
        'VITE_SILICONFLOW_API_KEY',
        'VITE_CUSTOM_API_KEY'
      ];

      // Scan dynamic custom model environment variables (using the unified validation logic)
      const CUSTOM_API_KEY_PATTERN = /^VITE_CUSTOM_API_KEY_(.+)$/;
      const SUFFIX_PATTERN = /^[a-zA-Z0-9_-]+$/;
      const MAX_SUFFIX_LENGTH = 50;

      const dynamicEnvVars = Object.keys(process.env).filter(key => {
        const match = key.match(CUSTOM_API_KEY_PATTERN);
        if (!match) return false;

        const [, suffix] = match;
        return suffix && suffix.length <= MAX_SUFFIX_LENGTH && SUFFIX_PATTERN.test(suffix);
      });

      const allEnvVars = [...staticEnvVars, ...dynamicEnvVars];

      const setVars = allEnvVars.filter(key => {
        const value = process.env[key];
        return value && value.trim().length > 0;
      });

      if (setVars.length === 0) {
        // No environment variables are set
        console.error('💡 No API keys found. Please set at least one:');
        console.error('   VITE_OPENAI_API_KEY=your-openai-key');
        console.error('   VITE_GEMINI_API_KEY=your-gemini-key');
        console.error('   VITE_DEEPSEEK_API_KEY=your-deepseek-key');
        console.error('   VITE_ZHIPU_API_KEY=your-zhipu-key');
        console.error('   VITE_SILICONFLOW_API_KEY=your-siliconflow-key');
        console.error('   VITE_CUSTOM_API_KEY=your-custom-key');
        console.error('   Or dynamic custom models:');
        console.error('   VITE_CUSTOM_API_KEY_qwen3=your-qwen-key');
        console.error('   VITE_CUSTOM_API_KEY_claude=your-claude-key');
      } else {
        // Some are set but may be invalid
        console.error('💡 Found API keys but no models are enabled:');
        setVars.forEach(key => {
          const value = process.env[key];
          const masked = value ? '[CONFIGURED]' : 'empty';
          console.error(`   ${key}=${masked}`);
        });
        console.error('   Please check if your API keys are valid.');
      }
    } catch (error) {
      // If checking the environment variables fails, show a generic hint
      console.error('💡 Please ensure you have set valid API keys.');
    }
  }

  private async validateServices(): Promise<void> {
    const services = [
      { name: 'ModelManager', service: this.modelManager },
      { name: 'LLMService', service: this.llmService },
      { name: 'LanguageService', service: this.languageService },
      { name: 'TemplateManager', service: this.templateManager },
      { name: 'HistoryManager', service: this.historyManager },
      { name: 'PromptService', service: this.promptService }
    ];

    for (const { name, service } of services) {
      if (!service) {
        throw new Error(`${name} is not initialized`);
      }
    }

    logger.debug('All services validated successfully');
  }

  getPromptService(): IPromptService {
    if (!this.initialized || !this.promptService) {
      throw new Error('CoreServicesManager not initialized or PromptService not available');
    }
    return this.promptService;
  }

  getModelManager(): ModelManager {
    if (!this.initialized || !this.modelManager) {
      throw new Error('CoreServicesManager not initialized or ModelManager not available');
    }
    return this.modelManager;
  }

  getTemplateManager(): TemplateManager {
    if (!this.initialized || !this.templateManager) {
      throw new Error('CoreServicesManager not initialized or TemplateManager not available');
    }
    return this.templateManager;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async getHealthStatus(): Promise<{
    initialized: boolean;
    services: Record<string, boolean>;
  }> {
    return {
      initialized: this.initialized,
      services: {
        modelManager: !!this.modelManager,
        llmService: !!this.llmService,
        languageService: !!this.languageService,
        templateManager: !!this.templateManager,
        historyManager: !!this.historyManager,
        promptService: !!this.promptService
      }
    };
  }
}
