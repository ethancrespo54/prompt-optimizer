import { IModelManager, ModelConfig, TextModelConfig } from './types';
import { IStorageProvider } from '../storage/types';
import { StorageAdapter } from '../storage/adapter';
import { getAllModels, getBuiltinModelIds } from './defaults';
import { ModelConfigError } from '../llm/errors';
import { validateOverrides } from './parameter-utils';
import { ElectronConfigManager, isElectronRenderer } from './electron-config';
import { CORE_SERVICE_KEYS } from '../../constants/storage-keys';
import { ImportExportError } from '../../interfaces/import-export';
import { IMPORT_EXPORT_ERROR_CODES } from '../../constants/error-codes';
import {
  convertLegacyToTextModelConfig,
  convertLegacyToTextModelConfigWithRegistry,
  isLegacyConfig,
  isTextModelConfig
} from './converter';
import type { ITextAdapterRegistry } from '../llm/types';

/**
 * Model manager implementation
 */
export class ModelManager implements IModelManager {
  private readonly storageKey = CORE_SERVICE_KEYS.MODELS;
  private readonly storage: IStorageProvider;
  private initPromise: Promise<void>;
  private registry?: ITextAdapterRegistry;

  constructor(storageProvider: IStorageProvider, registry?: ITextAdapterRegistry) {
    // Use an adapter to ensure all storage providers support the advanced methods
    this.storage = new StorageAdapter(storageProvider);
    this.registry = registry;
    this.initPromise = this.init().catch(err => {
      console.error('Model manager initialization failed:', err);
      throw err;
    });
  }

  /**
   * Lazily get the Registry instance
   * Uses a dynamic import to avoid circular dependencies
   */
  private async getRegistry(): Promise<ITextAdapterRegistry> {
    if (!this.registry) {
      try {
        // Dynamic import to avoid circular dependencies
        const { TextAdapterRegistry } = await import('../llm/adapters/registry');
        this.registry = new TextAdapterRegistry();
        console.log('[ModelManager] Lazy-loaded TextAdapterRegistry');
      } catch (error) {
        console.error('[ModelManager] Failed to load TextAdapterRegistry:', error);
        throw new ModelConfigError('Failed to load model adapter registry');
      }
    }
    return this.registry;
  }

  /**
   * Ensure initialization is complete
   */
  public async ensureInitialized(): Promise<void> {
    await this.initPromise;
  }

  /**
   * Check whether the manager has been initialized
   */
  public async isInitialized(): Promise<boolean> {
    const storedData = await this.storage.getItem(this.storageKey);
    return !!storedData;
  }

  /**
   * Initialize the model manager
   */
  private async init(): Promise<void> {
    try {
      console.log('[ModelManager] Initializing...');

      // In the Electron renderer process, sync the environment variables first
      if (isElectronRenderer()) {
        console.log('[ModelManager] Electron environment detected, syncing config from main process...');
        const configManager = ElectronConfigManager.getInstance();
        await configManager.syncFromMainProcess();
        console.log('[ModelManager] Environment variables synced from main process');
      }

      // Load the existing configs from storage
      const storedData = await this.storage.getItem(this.storageKey);

      if (storedData) {
        try {
          const storedModels = JSON.parse(storedData);
          console.log('[ModelManager] Loaded existing models from storage');

          // Ensure all default models exist, while keeping the user's custom configs
          const defaults = this.getDefaultModels();
          let hasUpdates = false;
          const updatedModels = { ...storedModels };

          for (const [key, defaultConfig] of Object.entries(defaults)) {
            if (!updatedModels[key]) {
              // Add missing default models
              updatedModels[key] = defaultConfig;
              hasUpdates = true;
              console.log(`[ModelManager] Added missing default model: ${key}`);
            } else {
              // Check whether the existing model is in the new format
              const existingModel = updatedModels[key];

              if (isTextModelConfig(existingModel)) {
                // Already in the new format; keep the user config and only fill in defaults for missing key fields
                const updatedModel = { ...existingModel } as TextModelConfig;
                let patched = false;

                if (!updatedModel.providerMeta && defaultConfig.providerMeta) {
                  updatedModel.providerMeta = defaultConfig.providerMeta;
                  patched = true;
                }

                if (!updatedModel.modelMeta && defaultConfig.modelMeta) {
                  updatedModel.modelMeta = defaultConfig.modelMeta;
                  patched = true;
                }

                if (patched) {
                  updatedModels[key] = updatedModel;
                  hasUpdates = true;
                  console.log(`[ModelManager] Patched missing metadata for model: ${key}`);
                }

                // Check whether the apiKey needs to be auto-injected and the built-in model enabled
                if (this.shouldAutoEnableBuiltinModel(key, updatedModel, defaultConfig)) {
                  updatedModels[key] = {
                    ...updatedModel,
                    connectionConfig: {
                      ...(updatedModel.connectionConfig || {}),
                      apiKey: defaultConfig.connectionConfig?.apiKey
                    },
                    enabled: true
                  };
                  hasUpdates = true;
                  console.log(`[ModelManager] Auto-enabled builtin model with new API key: ${key}`);
                }
              } else if (isLegacyConfig(existingModel)) {
                // Old format; try to convert to the new format using the Registry
                try {
                  const registry = await this.getRegistry();
                  const convertedModel = await convertLegacyToTextModelConfigWithRegistry(key, existingModel, registry);
                  updatedModels[key] = convertedModel;
                  hasUpdates = true;
                  console.log(`[ModelManager] Converted legacy model to new format (via Registry): ${key}`);
                } catch (error) {
                  // Fall back to hard-coded conversion
                  console.warn(`[ModelManager] Registry conversion failed for ${key}, using fallback:`, error);
                  const convertedModel = convertLegacyToTextModelConfig(key, existingModel);
                  updatedModels[key] = convertedModel;
                  hasUpdates = true;
                  console.log(`[ModelManager] Converted legacy model to new format (via fallback): ${key}`);
                }
              } else {
                // Unknown format; replace with the default config
                updatedModels[key] = defaultConfig;
                hasUpdates = true;
                console.log(`[ModelManager] Replaced unknown format with default: ${key}`);
              }
            }
          }

          // If anything was updated, save it to storage
          if (hasUpdates) {
            await this.storage.setItem(this.storageKey, JSON.stringify(updatedModels));
            console.log('[ModelManager] Saved updated models to storage');
          }
        } catch (error) {
          console.error('[ModelManager] Failed to parse stored models, initializing with defaults:', error);
          await this.storage.setItem(this.storageKey, JSON.stringify(this.getDefaultModels()));
        }
      } else {
        console.log('[ModelManager] No existing models found, initializing with defaults');
        await this.storage.setItem(this.storageKey, JSON.stringify(this.getDefaultModels()));
      }

      console.log('[ModelManager] Initialization completed');
    } catch (error) {
      console.error('[ModelManager] Initialization failed:', error);
      // If initialization fails, at least save the default configs to storage
      try {
        await this.storage.setItem(this.storageKey, JSON.stringify(this.getDefaultModels()));
      } catch (saveError) {
        console.error('[ModelManager] Failed to save default models:', saveError);
      }
    }
  }

  /**
   * Get the default model configs (returns the TextModelConfig format)
   * Note: recomputed on every call, so environment variable changes are picked up
   */
  private getDefaultModels(): Record<string, TextModelConfig> {
    // In the Electron environment, use the config manager to generate configs
    if (isElectronRenderer()) {
      const configManager = ElectronConfigManager.getInstance();
      if (configManager.isInitialized()) {
        // ElectronConfigManager already supports getAllModels()
        return configManager.generateDefaultModels();
      }
    }

    // Call the function to recompute (rather than using static constants) so environment variable changes are picked up
    return getAllModels();
  }

  /**
   * Migrate config: merge customParamOverrides into paramOverrides
   * Used to read the old data format for backward compatibility
   */
  private migrateConfig(config: TextModelConfig): TextModelConfig {
    // If there is no customParamOverrides, return directly
    if (!config.customParamOverrides || Object.keys(config.customParamOverrides).length === 0) {
      return config
    }

    // Add a migration log
    console.warn(
      `[ModelManager] Migrating customParamOverrides to paramOverrides for model '${config.id}'. ` +
      `The 'customParamOverrides' field is deprecated and will be removed in v3.0.`
    )

    // Merge customParamOverrides into paramOverrides
    return {
      ...config,
      paramOverrides: {
        ...(config.paramOverrides || {}),
        ...(config.customParamOverrides || {})
      }
      // Keep the customParamOverrides field in case of a version rollback, but new code no longer uses it
    }
  }

  /**
   * In old stored data, providerMeta may lack new fields; fill them in using the current adapter's provider metadata.
   *
   * Currently mainly used to backfill `corsRestricted` so the UI can correctly show the CORS-restricted label.
   */
  private patchProviderMeta(config: TextModelConfig): TextModelConfig {
    const providerMeta = config.providerMeta
    if (!providerMeta) {
      return config
    }

    const providerId = (providerMeta.id || config.modelMeta?.providerId || '').toLowerCase()

    // Historical metadata might incorrectly mark Ollama as CORS-restricted.
    // Ollama can be configured (CORS/reverse-proxy), so we force-disable the tag.
    if (providerId === 'ollama') {
      if (providerMeta.corsRestricted === false) {
        return config
      }
      return {
        ...config,
        providerMeta: {
          ...providerMeta,
          corsRestricted: false
        }
      }
    }

    if (providerMeta.corsRestricted !== undefined) {
      return config
    }

    try {
      if (!providerId || !this.registry) {
        return config
      }

      const latestProvider = this.registry.getAdapter(providerId).getProvider()
      if (latestProvider.corsRestricted === undefined) {
        return config
      }

      return {
        ...config,
        providerMeta: {
          ...providerMeta,
          corsRestricted: latestProvider.corsRestricted
        }
      }
    } catch {
      return config
    }
  }

  /**
   * Get a model config from storage; return the default config if it does not exist
   * Returns any to be compatible with both the old and new formats
   */
  private async getModelsFromStorage(): Promise<Record<string, any>> {
    const storedData = await this.storage.getItem(this.storageKey);
    if (storedData) {
      try {
        return JSON.parse(storedData);
      } catch (error) {
        console.error('[ModelManager] Failed to parse stored models, using defaults:', error);
      }
    }
    return this.getDefaultModels();
  }

  /**
   * Get all model configs (returns TextModelConfig)
   */
  async getAllModels(): Promise<TextModelConfig[]> {
    await this.ensureInitialized();
    const models = await this.getModelsFromStorage();

    // Convert to a TextModelConfig array (finish the format/field migration first)
    const migratedConfigs = Object.entries(models).map(([key, config]) => {
      let textConfig: TextModelConfig

      // Check whether it is already in the new format
      if (isTextModelConfig(config)) {
        textConfig = config as TextModelConfig;
      }
      // Legacy format; convert to the new format
      else if (isLegacyConfig(config)) {
        textConfig = convertLegacyToTextModelConfig(key, config);
      }
      // Unknown format; try to convert
      else {
        textConfig = convertLegacyToTextModelConfig(key, config as ModelConfig);
      }

      // Migrate on read: merge customParamOverrides into paramOverrides
      return this.migrateConfig(textConfig)
    });

    const needsProviderMetaPatch = migratedConfigs.some(
      (cfg) => cfg.providerMeta && cfg.providerMeta.corsRestricted === undefined
    )

    if (needsProviderMetaPatch) {
      // Best-effort: ensure registry is available for patching provider metadata.
      try {
        await this.getRegistry()
      } catch {
        // ignore - registry is only used for optional metadata patching
      }
    }

    return migratedConfigs.map((cfg) => this.patchProviderMeta(cfg))
  }

  /**
   * Get the specified model config (returns TextModelConfig)
   */
  async getModel(key: string): Promise<TextModelConfig | undefined> {
    await this.ensureInitialized();
    const models = await this.getModelsFromStorage();
    const config = models[key];

    if (!config) {
      return undefined;
    }

    let textConfig: TextModelConfig

    // Check whether it is already in the new format
    if (isTextModelConfig(config)) {
      textConfig = config as TextModelConfig;
    }
    // Legacy format; convert to the new format
    else if (isLegacyConfig(config)) {
      textConfig = convertLegacyToTextModelConfig(key, config);
    }
    // Unknown format; try to convert
    else {
      textConfig = convertLegacyToTextModelConfig(key, config as ModelConfig);
    }

    // Migrate on read: merge customParamOverrides into paramOverrides
    const migrated = this.migrateConfig(textConfig)
    const needsProviderMetaPatch =
      !!migrated.providerMeta && migrated.providerMeta.corsRestricted === undefined

    if (needsProviderMetaPatch) {
      // Best-effort: ensure registry is available for patching provider metadata.
      try {
        await this.getRegistry()
      } catch {
        // ignore - registry is only used for optional metadata patching
      }
    }

    return this.patchProviderMeta(migrated)
  }

  /**
   * Add a model config (accepts TextModelConfig)
   */
  async addModel(key: string, config: TextModelConfig): Promise<void> {
    await this.ensureInitialized();
    this.validateTextModelConfig(config);

    // Remove customParamOverrides on save (already merged into paramOverrides)
    const toStore = {
      ...config,
      customParamOverrides: undefined
    }

    await this.storage.updateData<Record<string, any>>(
      this.storageKey,
      (currentModels) => {
        // Use the data from storage; if it does not exist, use the default config
        const models = currentModels || this.getDefaultModels();

        if (models[key]) {
          throw new ModelConfigError(`Model ${key} already exists`);
        }

        return {
          ...models,
          [key]: toStore // Store the cleaned config
        };
      }
    );
  }

  /**
   * Update a model config (accepts a partial TextModelConfig)
   */
  async updateModel(key: string, config: Partial<TextModelConfig>): Promise<void> {
    await this.ensureInitialized();

    await this.storage.updateData<Record<string, any>>(
      this.storageKey,
      (currentModels) => {
        // Use the data from storage; if it does not exist, use the default config
        const models = currentModels || this.getDefaultModels();

        // If the model does not exist, check whether it is a built-in model
        if (!models[key]) {
          const defaults = this.getDefaultModels();
          if (!defaults[key]) {
            throw new ModelConfigError(`Model ${key} does not exist`);
          }
          // If it is a built-in model but not yet configured, create the initial config
          models[key] = defaults[key];
        }

        // Get the existing config and convert it to a TextModelConfig
        const existingConfig = models[key];
        let existingTextModelConfig: TextModelConfig;

        if (isTextModelConfig(existingConfig)) {
          existingTextModelConfig = existingConfig as TextModelConfig;
        } else if (isLegacyConfig(existingConfig)) {
          existingTextModelConfig = convertLegacyToTextModelConfig(key, existingConfig);
        } else {
          existingTextModelConfig = convertLegacyToTextModelConfig(key, existingConfig as ModelConfig);
        }

        // Merge the configs
        const updatedConfig: TextModelConfig = {
          ...existingTextModelConfig,
          ...config,
          // Ensure the enabled property exists
          enabled: config.enabled !== undefined ? config.enabled : existingTextModelConfig.enabled,
          // Deep merge connectionConfig
          connectionConfig: {
            ...existingTextModelConfig.connectionConfig,
            ...(config.connectionConfig || {})
          },
          // Handle paramOverrides: if paramOverrides is explicitly passed in, replace it directly rather than merging
          // This ensures that parameters the user deleted are not wrongly retained
          paramOverrides: config.paramOverrides !== undefined
            ? config.paramOverrides
            : existingTextModelConfig.paramOverrides || {}
        };

        // If key fields were updated, the config needs to be validated
        if (
          config.name !== undefined ||
          config.providerMeta !== undefined ||
          config.modelMeta !== undefined ||
          config.connectionConfig !== undefined ||
          config.paramOverrides !== undefined ||
          config.enabled
        ) {
          this.validateTextModelConfig(updatedConfig);
        }

        // Remove customParamOverrides on save (already merged into paramOverrides)
        const toStore = {
          ...updatedConfig,
          customParamOverrides: undefined
        }

        // Return the complete model data, ensuring all models are kept
        return {
          ...models,
          [key]: toStore
        };
      }
    );
  }

  /**
   * Delete a model config
   */
  async deleteModel(key: string): Promise<void> {
    await this.ensureInitialized();
    await this.storage.updateData<Record<string, any>>(
      this.storageKey,
      (currentModels) => {
        // Use the data from storage; if it does not exist, use the default config
        const models = currentModels || this.getDefaultModels();

        if (!models[key]) {
          throw new ModelConfigError(`Model ${key} does not exist`);
        }
        const { [key]: removed, ...remaining } = models;
        return remaining;
      }
    );
  }

  /**
   * Enable a model
   */
  async enableModel(key: string): Promise<void> {
    await this.ensureInitialized();
    await this.storage.updateData<Record<string, any>>(
      this.storageKey,
      (currentModels) => {
        // Use the data from storage; if it does not exist, use the default config
        const models = currentModels || this.getDefaultModels();

        if (!models[key]) {
          throw new ModelConfigError(`Unknown model: ${key}`);
        }

        // Get the existing config and convert it to a TextModelConfig
        const existingConfig = models[key];
        let textModelConfig: TextModelConfig;

        if (isTextModelConfig(existingConfig)) {
          textModelConfig = existingConfig as TextModelConfig;
        } else if (isLegacyConfig(existingConfig)) {
          textModelConfig = convertLegacyToTextModelConfig(key, existingConfig);
        } else {
          textModelConfig = convertLegacyToTextModelConfig(key, existingConfig as ModelConfig);
        }

        // Use full validation
        this.validateTextModelConfig(textModelConfig);

        return {
          ...models,
          [key]: {
            ...textModelConfig,
            enabled: true
          }
        };
      }
    );
  }

  /**
   * Disable a model
   */
  async disableModel(key: string): Promise<void> {
    await this.ensureInitialized();
    await this.storage.updateData<Record<string, any>>(
      this.storageKey,
      (currentModels) => {
        // Use the data from storage; if it does not exist, use the default config
        const models = currentModels || this.getDefaultModels();

        if (!models[key]) {
          throw new ModelConfigError(`Unknown model: ${key}`);
        }

        // Get the existing config and convert it to a TextModelConfig
        const existingConfig = models[key];
        let textModelConfig: TextModelConfig;

        if (isTextModelConfig(existingConfig)) {
          textModelConfig = existingConfig as TextModelConfig;
        } else if (isLegacyConfig(existingConfig)) {
          textModelConfig = convertLegacyToTextModelConfig(key, existingConfig);
        } else {
          textModelConfig = convertLegacyToTextModelConfig(key, existingConfig as ModelConfig);
        }

        return {
          ...models,
          [key]: {
            ...textModelConfig,
            enabled: false
          }
        };
      }
    );
  }

  /**
   * Determine whether the built-in model should be auto-enabled
   * Conditions: built-in model + stored apiKey is empty + enabled is false + the new config has an apiKey
   */
  private shouldAutoEnableBuiltinModel(
    modelId: string,
    storedConfig: TextModelConfig,
    defaultConfig: TextModelConfig
  ): boolean {
    // 1. Must be a built-in model
    const builtinIds = getBuiltinModelIds();
    if (!builtinIds.includes(modelId)) {
      return false;
    }

    // 2. The stored config must be disabled
    if (storedConfig.enabled !== false) {
      return false;
    }

    // 3. The stored apiKey must be empty
    const storedApiKey = storedConfig.connectionConfig?.apiKey?.trim() || '';
    if (storedApiKey !== '') {
      return false;
    }

    // 4. The new default config must have an apiKey
    const newApiKey = defaultConfig.connectionConfig?.apiKey?.trim() || '';
    if (newApiKey === '') {
      return false;
    }

    return true;
  }

  /**
   * Validate a TextModelConfig
   */
  private validateTextModelConfig(config: TextModelConfig): void {
    const errors: string[] = [];

    if (!config.id) {
      errors.push('Missing configuration id');
    }
    if (!config.name) {
      errors.push('Missing model name (name)');
    }
    if (!config.providerMeta || !config.providerMeta.id) {
      errors.push('Missing or invalid provider metadata (providerMeta)');
    }
    if (!config.modelMeta || !config.modelMeta.id) {
      errors.push('Missing or invalid model metadata (modelMeta)');
    }
    if (!config.connectionConfig) {
      errors.push('Missing connection configuration (connectionConfig)');
    }

    // Validate paramOverrides & customParamOverrides structure
    if (config.paramOverrides !== undefined && (typeof config.paramOverrides !== 'object' || config.paramOverrides === null || Array.isArray(config.paramOverrides))) {
      errors.push('paramOverrides must be an object');
    }
    if (config.customParamOverrides !== undefined && (typeof config.customParamOverrides !== 'object' || config.customParamOverrides === null || Array.isArray(config.customParamOverrides))) {
      errors.push('customParamOverrides must be an object');
    }

    // Validate overrides content using unified schema
    const schema = config.modelMeta?.parameterDefinitions ?? [];
    const validation = validateOverrides({
      schema,
      overrides: config.paramOverrides,
      customOverrides: config.customParamOverrides,
      allowUnknown: true
    });

    if (validation.errors.length > 0) {
      validation.errors.forEach((error) => {
        errors.push(`Parameter ${error.parameterName}: ${error.message}`);
      });
    }

    if (validation.warnings.length > 0) {
      // warnings do not block saving, but are shown in the console
      validation.warnings.forEach((warning) => {
        console.warn(`[ModelManager] ${warning.message}`);
      });
    }

    if (errors.length > 0) {
      throw new ModelConfigError('Invalid TextModelConfig: ' + errors.join(', '));
    }
  }



  /**
   * Get all enabled model configs (returns TextModelConfig)
   */
  async getEnabledModels(): Promise<TextModelConfig[]> {
    await this.ensureInitialized();
    const allModels = await this.getAllModels();
    return allModels.filter(model => model.enabled);
  }

  // Implement the IImportExportable interface

  /**
   * Export all model configs (returns TextModelConfig)
   */
  async exportData(): Promise<TextModelConfig[]> {
    try {
      return await this.getAllModels();
    } catch (error) {
      throw new ImportExportError(
        'Failed to export model data',
        await this.getDataType(),
        error as Error,
        IMPORT_EXPORT_ERROR_CODES.EXPORT_FAILED,
      );
    }
  }

  /**
   * Import model configs (supports TextModelConfig and legacy ModelConfig)
   */
  async importData(data: any): Promise<void> {
    // Basic format validation: must be an array
    if (!Array.isArray(data)) {
      throw new ImportExportError(
        'Invalid model data format: data must be an array of model configurations',
        await this.getDataType(),
        undefined,
        IMPORT_EXPORT_ERROR_CODES.VALIDATION_ERROR,
      );
    }

    const models = data as Array<TextModelConfig | (ModelConfig & { key: string })>;
    const failedModels: { model: any; error: Error }[] = [];

    // Import each model individually, capturing failures
    for (const model of models) {
      try {
        // Determine whether it is the new or old format
        let textModelConfig: TextModelConfig;
        let key: string;

        if (isTextModelConfig(model)) {
          // New format: use directly
          textModelConfig = model as TextModelConfig;
          key = textModelConfig.id;
        } else {
          // Old format: convert before use
          const legacyModel = model as ModelConfig & { key: string };
          if (!legacyModel.key) {
            console.warn(`Skipping model without key:`, model);
            failedModels.push({ model, error: new Error('Missing key field') });
            continue;
          }
          key = legacyModel.key;
          textModelConfig = convertLegacyToTextModelConfig(key, legacyModel);
        }

        // Validate a single model
        if (!this.validateSingleTextModel(textModelConfig)) {
          console.warn(`Skipping invalid model configuration:`, model);
          failedModels.push({ model, error: new Error('Invalid model configuration') });
          continue;
        }

        // Check whether the model already exists
        const existingModel = await this.getModel(key);

        if (existingModel) {
          // The model already exists; update the config
          await this.updateModel(key, {
            ...textModelConfig,
            enabled: textModelConfig.enabled !== undefined ? textModelConfig.enabled : existingModel.enabled
          });
          console.log(`Model ${key} already exists, configuration updated`);
        } else {
          // If the model does not exist, add a new one
          await this.addModel(key, textModelConfig);
          console.log(`Imported new model ${key}`);
        }
      } catch (error) {
        console.warn(`Error importing model:`, error);
        failedModels.push({ model, error: error as Error });
      }
    }

    if (failedModels.length > 0) {
      console.warn(`Failed to import ${failedModels.length} models`);
      // Do not throw; allow a partial import to succeed
    }
  }

  /**
   * Get the data type identifier
   */
  async getDataType(): Promise<string> {
    return 'models';
  }

  /**
   * Validate the model data format (supports old and new formats)
   */
  async validateData(data: any): Promise<boolean> {
    if (!Array.isArray(data)) {
      return false;
    }

    return data.every(item => {
      // Check whether it is the new format
      if (isTextModelConfig(item)) {
        return this.validateSingleTextModel(item);
      }
      // Check whether it is the old format
      return this.validateSingleModel(item);
    });
  }

  /**
   * Validate a single TextModelConfig
   */
  private validateSingleTextModel(item: any): boolean {
    return typeof item === 'object' &&
      item !== null &&
      typeof item.id === 'string' &&
      typeof item.name === 'string' &&
      typeof item.enabled === 'boolean' &&
      item.providerMeta !== undefined &&
      typeof item.providerMeta === 'object' &&
      item.modelMeta !== undefined &&
      typeof item.modelMeta === 'object' &&
      item.connectionConfig !== undefined &&
      typeof item.connectionConfig === 'object';
  }

  /**
   * Validate a single legacy model config
   */
  private validateSingleModel(item: any): boolean {
    return typeof item === 'object' &&
      item !== null &&
      typeof item.key === 'string' && // Imported data must contain key
      typeof item.name === 'string' &&
      typeof item.baseURL === 'string' &&
      typeof item.defaultModel === 'string' &&
      typeof item.enabled === 'boolean' &&
      typeof item.provider === 'string';
  }
}

/**
 * Factory function for creating the model manager
 * @param storageProvider Storage provider instance
 * @returns Model manager instance
 */
export function createModelManager(storageProvider: IStorageProvider): ModelManager {
  return new ModelManager(storageProvider);
}
