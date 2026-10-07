import {
  IImageModelManager,
  ImageModelConfig,
  IImageAdapterRegistry
} from '../image/types'
import { IStorageProvider } from '../storage/types'
import { StorageAdapter } from '../storage/adapter'
import { CORE_SERVICE_KEYS } from '../../constants/storage-keys'
import { ImportExportError } from '../../interfaces/import-export'
import { IMAGE_ERROR_CODES, IMPORT_EXPORT_ERROR_CODES, type ErrorParams } from '../../constants/error-codes'
import { BaseError } from '../llm/errors'
import { getDefaultImageModels, getBuiltinImageConfigIds } from './defaults'

class ImageModelManagerError extends BaseError {
  constructor(code: string, message?: string, params?: ErrorParams) {
    super(code, message, params)
  }
}

/**
 * Image model manager: focused on config management, following the new three-layer architecture
 * Responsible for CRUD operations on ImageModelConfig and combined queries
 */
export class ImageModelManager implements IImageModelManager {
  private readonly storageKey = CORE_SERVICE_KEYS.IMAGE_MODELS
  private readonly storage: IStorageProvider
  private readonly registry: IImageAdapterRegistry
  private initPromise: Promise<void> | null = null

  constructor(storageProvider: IStorageProvider, registry: IImageAdapterRegistry) {
    this.storage = new StorageAdapter(storageProvider)
    this.registry = registry
  }

  // === Initialization (write default configs) ===
  public async ensureInitialized(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.init()
    }
    return this.initPromise
  }

  public async isInitialized(): Promise<boolean> {
    const raw = await this.storage.getItem(this.storageKey)
    return !!raw
  }

  private async init(): Promise<void> {
    try {
      const raw = await this.storage.getItem(this.storageKey)
      if (!raw) {
        // No configs at all; write the defaults directly
        const defaults = getDefaultImageModels(this.registry)
        await this.storage.setItem(this.storageKey, JSON.stringify(defaults))
        return
      }

      // Configs already exist: fill in missing defaults (without overwriting the user's existing ones)
      let data: Record<string, ImageModelConfig>
      try {
        data = JSON.parse(raw) || {}
      } catch {
        data = {}
      }
      // Lightweight migration: fill in missing ids for old data (only fills id; does not derive provider/model)
      // Note: old data only exists from the development stage, so no further field backfill (e.g. providerId/modelId/provider/model) is done.
      // The only purpose is to let the UI recognize and delete these entries, avoiding operations being impossible due to a missing id.
      let changed = false
      for (const [key, cfg] of Object.entries(data)) {
        if (cfg && typeof cfg === 'object' && !(cfg as any).id) {
          ;(cfg as any).id = key
          changed = true
        }
      }
      const defaults = getDefaultImageModels(this.registry)
      // Merge the default entries, and check whether built-in models need to be auto-enabled
      for (const [key, cfg] of Object.entries(defaults)) {
        if (!data[key]) {
          // Add missing default models
          data[key] = cfg
          changed = true
        } else {
          // Check whether the apiKey needs to be auto-injected and the built-in model enabled
          const existingConfig = data[key]
          if (this.shouldAutoEnableBuiltinModel(key, existingConfig, cfg)) {
            data[key] = {
              ...existingConfig,
              connectionConfig: {
                ...(existingConfig.connectionConfig || {}),
                apiKey: cfg.connectionConfig?.apiKey
              },
              enabled: true
            }
            changed = true
            console.log(`[ImageModelManager] Auto-enabled builtin model with new API key: ${key}`)
          }
        }
      }

      if (changed) {
        await this.storage.setItem(this.storageKey, JSON.stringify(data))
      }
    } catch (e) {
      // On initialization failure, try to write the defaults to avoid an empty list
      try {
        const defaults = getDefaultImageModels(this.registry)
        await this.storage.setItem(this.storageKey, JSON.stringify(defaults))
      } catch {}
    }
  }

  // === Config CRUD operations ===

  async addConfig(config: ImageModelConfig): Promise<void> {
    // Ensure the config is self-contained
    const completeConfig = this.ensureSelfContained(config)
    this.validateConfig(completeConfig)

    // Remove customParamOverrides on save (already merged into paramOverrides)
    const toStore = {
      ...completeConfig,
      customParamOverrides: undefined
    }

    await this.storage.updateData<Record<string, ImageModelConfig>>(
      this.storageKey,
      (current) => {
        const data = current || {}
        if (data[toStore.id]) {
          throw new ImageModelManagerError(
            IMAGE_ERROR_CODES.CONFIG_ALREADY_EXISTS,
            undefined,
            { configId: toStore.id },
          )
        }
        return { ...data, [toStore.id]: toStore }
      }
    )
  }

  async updateConfig(id: string, updates: Partial<ImageModelConfig>): Promise<void> {
    await this.storage.updateData<Record<string, ImageModelConfig>>(
      this.storageKey,
      (current) => {
        const data = current || {}
        if (!data[id]) {
          throw new ImageModelManagerError(
            IMAGE_ERROR_CODES.CONFIG_DOES_NOT_EXIST,
            undefined,
            { configId: id },
          )
        }

        const updated: ImageModelConfig = {
          ...data[id],
          ...updates,
          id: data[id].id // Protect the id from being updated
        }

        // Ensure the updated config is self-contained
        const completeConfig = this.ensureSelfContained(updated)
        this.validateConfig(completeConfig)

        // Remove customParamOverrides on save (already merged into paramOverrides)
        const toStore = {
          ...completeConfig,
          customParamOverrides: undefined
        }

        return { ...data, [id]: toStore }
      }
    )
  }

  async deleteConfig(id: string): Promise<void> {
    await this.storage.updateData<Record<string, ImageModelConfig>>(
      this.storageKey,
      (current) => {
        const data = current || {}

        // Forced delete: try to delete whether or not the config exists
        // This ensures that corrupted configs can also be cleaned up
        if (!data[id]) {
          console.warn(`[ImageModelManager] Config ${id} not found in storage, but proceeding anyway`)
          // Still return the original data, since there is truly nothing to delete
          return data
        }

        // The config exists; delete normally
        const { [id]: removed, ...rest } = data
        console.log(`[ImageModelManager] Successfully deleted config: ${id}`)
        return rest
      }
    )
  }

  async getConfig(id: string): Promise<ImageModelConfig | null> {
    const raw = await this.storage.getItem(this.storageKey)
    const data: Record<string, ImageModelConfig> = raw ? JSON.parse(raw) : {}
    const cfg = data[id]
    if (!cfg) return null

    // Lightweight migration safeguard: fill in missing ids before returning so the UI can delete them
    if (!(cfg as any).id) {
      ;(cfg as any).id = id
    }

    // Migrate on read: merge customParamOverrides into paramOverrides
    const migrated = this.migrateConfig(cfg)

    // Try to repair corrupted configs to ensure they can be read and deleted normally
    try {
      return this.ensureSelfContained(migrated)
    } catch (error) {
      // Even if the repair fails, return the config (already marked as disabled in ensureSelfContained)
      console.warn(`[ImageModelManager] Failed to fully repair config ${id}, but returning for deletion:`, error)
      return migrated
    }
  }

  async getAllConfigs(): Promise<ImageModelConfig[]> {
    const raw = await this.storage.getItem(this.storageKey)
    const data: Record<string, ImageModelConfig> = raw ? JSON.parse(raw) : {}

    // Lightweight migration safeguard: fill in ids for old records missing them, and try to repair corrupted configs
    return Object.entries(data).map(([key, cfg]) => {
      if (!cfg || typeof cfg !== 'object') {
        return null
      }

      // Always use the storage key as the public id to keep delete and similar operations consistent
      ;(cfg as any).id = key

      // Migrate on read: merge customParamOverrides into paramOverrides
      const migrated = this.migrateConfig(cfg)

      // Try to repair the config; if that fails, return a placeholder config (marked as disabled)
      try {
        return this.ensureSelfContained(migrated)
      } catch (error) {
        console.warn(`[ImageModelManager] Failed to repair config ${key}, returning placeholder:`, error)
        // Return a minimal placeholder config to ensure it can be displayed and deleted in the UI
        return {
          ...migrated,
          id: key,
          enabled: false
        } as ImageModelConfig
      }
    }).filter((cfg): cfg is ImageModelConfig => cfg !== null)
  }

  async getEnabledConfigs(): Promise<ImageModelConfig[]> {
    const all = await this.getAllConfigs()
    return all.filter(config => config.enabled)
  }

  // === Import/export ===

  async exportData(): Promise<ImageModelConfig[]> {
    try {
      return await this.getAllConfigs()
    } catch (error) {
      throw new ImportExportError(
        'Failed to export image model configurations',
        await this.getDataType(),
        error as Error,
        IMPORT_EXPORT_ERROR_CODES.EXPORT_FAILED,
      )
    }
  }

  async importData(data: any): Promise<void> {
    if (!Array.isArray(data)) {
      throw new ImportExportError(
        'Invalid data format: expected array of ImageModelConfig',
        await this.getDataType(),
        undefined,
        IMPORT_EXPORT_ERROR_CODES.VALIDATION_ERROR,
      )
    }

    const configs = data as ImageModelConfig[]
    const failed: { config: ImageModelConfig, error: Error }[] = []

    for (const config of configs) {
      try {
        this.validateConfig(config)

        // Check whether it already exists
        const existing = await this.getConfig(config.id)
        if (existing) {
          // Update the existing config
          await this.updateConfig(config.id, config)
        } else {
          // Add a new config
          await this.addConfig(config)
        }
      } catch (error) {
        failed.push({ config, error: error as Error })
      }
    }

    if (failed.length > 0) {
      console.warn(`[ImageModelManager] Failed to import ${failed.length} configurations`)
      // You can choose to throw an exception or just log a warning
    }
  }

  async getDataType(): Promise<string> {
    return 'image-model-configs'
  }

  async validateData(data: any): Promise<boolean> {
    if (!Array.isArray(data)) {
      return false
    }

    return data.every(item => {
      try {
        this.validateConfig(item)
        return true
      } catch {
        return false
      }
    })
  }

  // === Private helper methods ===

  /**
   * Migrate config: merge customParamOverrides into paramOverrides
   * Used to read the old data format for backward compatibility
   */
  private migrateConfig(config: ImageModelConfig): ImageModelConfig {
    // If there is no customParamOverrides, return directly
    if (!config.customParamOverrides || Object.keys(config.customParamOverrides).length === 0) {
      return config
    }

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

  // Ensure the config is self-contained (contains complete provider and model info)
  private ensureSelfContained(config: ImageModelConfig): ImageModelConfig {
    // If the self-contained fields are already complete, try to fill in newly added provider fields (backward compatible)
    if (config.provider && config.model) {
      const providerId = (config.provider.id || config.providerId || '').toLowerCase()

      // Historical metadata might incorrectly mark Ollama as CORS-restricted.
      // Ollama can be configured (CORS/reverse-proxy), so we force-disable the tag.
      if (providerId === 'ollama' && config.provider.corsRestricted !== false) {
        return {
          ...config,
          provider: {
            ...config.provider,
            corsRestricted: false
          }
        }
      }

      // In old stored data, provider may lack new fields; fill them in using the current adapter's provider metadata.
      if (config.provider.corsRestricted === undefined) {
        try {
          const latestProvider = this.registry.getAdapter(config.providerId).getProvider()
          if (latestProvider.corsRestricted !== undefined) {
            return {
              ...config,
              provider: {
                ...config.provider,
                corsRestricted: latestProvider.corsRestricted
              }
            }
          }
        } catch {
          // ignore - unknown provider or adapter failure
        }
      }
      return config
    }

    try {
      // Get the provider and model info
      const adapter = this.registry.getAdapter(config.providerId)
      const provider = adapter.getProvider()

      // Try to get the model info from the static model list
      let model = this.registry.getStaticModels(config.providerId).find(m => m.id === config.modelId)

      // If the static model does not exist, build it using buildDefaultModel
      if (!model) {
        model = adapter.buildDefaultModel(config.modelId)
      }

      // Return the self-contained config
      return {
        ...config,
        provider,
        model,
        paramOverrides: config.paramOverrides ?? {}
      }
    } catch (error) {
      // For old configs that cannot be repaired, create placeholder data and disable it so the user can view and delete it
      console.warn(`[ImageModelManager] Cannot repair legacy config ${config.id}, marking as disabled:`, error)
      return {
        ...config,
        enabled: false,
        provider: {
          id: config.providerId || 'unknown',
          name: `Unknown Provider (${config.providerId || 'unknown'})`,
          description: 'This config is corrupted and cannot be repaired',
          requiresApiKey: false,
          supportsDynamicModels: false,
          defaultBaseURL: '',
          connectionSchema: { required: [], optional: [], fieldTypes: {} }
        },
        model: {
          id: config.modelId || 'unknown',
          name: `Unknown Model (${config.modelId || 'unknown'})`,
          description: 'This config is corrupted; please delete it and create a new one',
          providerId: config.providerId || 'unknown',
          capabilities: {
            text2image: false,
            image2image: false,
            multiImage: false
          },
          parameterDefinitions: [],
          defaultParameterValues: {}
        },
        paramOverrides: config.paramOverrides ?? {}
      } as ImageModelConfig
    }
  }

  /**
   * Determine whether the built-in model should be auto-enabled
   * Conditions: built-in model + stored apiKey is empty + enabled is false + the new config has an apiKey
   */
  private shouldAutoEnableBuiltinModel(
    configId: string,
    storedConfig: ImageModelConfig,
    defaultConfig: ImageModelConfig
  ): boolean {
    // 1. Must be a built-in model
    const builtinIds = getBuiltinImageConfigIds()
    if (!builtinIds.includes(configId)) {
      return false
    }

    // 2. The stored config must be disabled
    if (storedConfig.enabled !== false) {
      return false
    }

    // 3. The stored apiKey must be empty
    const storedApiKey = storedConfig.connectionConfig?.apiKey?.trim() || ''
    if (storedApiKey !== '') {
      return false
    }

    // 4. The new default config must have an apiKey
    const newApiKey = defaultConfig.connectionConfig?.apiKey?.trim() || ''
    if (newApiKey === '') {
      return false
    }

    return true
  }

  private validateConfig(config: ImageModelConfig): void {
    const errors: string[] = []

    // Validate required fields
    if (!config.id || typeof config.id !== 'string') {
      errors.push('Missing or invalid id')
    }
    if (!config.name || typeof config.name !== 'string') {
      errors.push('Missing or invalid name')
    }
    if (!config.providerId || typeof config.providerId !== 'string') {
      errors.push('Missing or invalid providerId')
    }
    if (!config.modelId || typeof config.modelId !== 'string') {
      errors.push('Missing or invalid modelId')
    }
    if (typeof config.enabled !== 'boolean') {
      errors.push('Missing or invalid enabled flag')
    }

    // Validate self-contained data fields
    if (!config.provider || typeof config.provider !== 'object') {
      errors.push('Missing or invalid provider data')
    }
    if (!config.model || typeof config.model !== 'object') {
      errors.push('Missing or invalid model data')
    }

    // Validate the connection config (if present)
    if (config.connectionConfig !== undefined) {
      if (typeof config.connectionConfig !== 'object' || config.connectionConfig === null) {
        errors.push('connectionConfig must be an object')
      }
    }

    // Validate parameter overrides (if present)
    if (config.paramOverrides !== undefined) {
      if (typeof config.paramOverrides !== 'object' || config.paramOverrides === null) {
        errors.push('paramOverrides must be an object')
      }
    }

    if (config.customParamOverrides !== undefined) {
      if (typeof config.customParamOverrides !== 'object' || config.customParamOverrides === null) {
        errors.push('customParamOverrides must be an object')
      }
    }

    // Validate that the provider exists
    try {
      this.registry.getAdapter(config.providerId)
    } catch {
      errors.push(`Unknown provider: ${config.providerId}`)
    }

    // Model existence is guaranteed by each source:
    // - Dynamic models: fetched live from the API, so they should necessarily exist
    // - Static models: preset in code and maintained by developers
    // - Custom models: the user's own responsibility
    // So there is no need to validate model existence here

    if (errors.length > 0) {
      throw new ImageModelManagerError(
        IMAGE_ERROR_CODES.CONFIG_INVALID,
        errors.join(', '),
        { details: errors.join(', ') },
      )
    }
  }
}

export function createImageModelManager(
  storageProvider: IStorageProvider,
  registry: IImageAdapterRegistry
): ImageModelManager {
  return new ImageModelManager(storageProvider, registry)
}
