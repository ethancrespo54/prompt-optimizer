/**
 * Abstract base class for adapter registries
 * Provides shared logic for text and image adapter registries
 *
 * @template TAdapter Adapter type
 * @template TProvider Provider metadata type
 * @template TModel Model metadata type
 * @template TConnectionConfig Connection config type (used for dynamic model fetching)
 */
export abstract class AbstractAdapterRegistry<
  TAdapter,
  TProvider extends { id: string; name: string; supportsDynamicModels: boolean },
  TModel extends { id: string },
  TConnectionConfig = Record<string, unknown>
> {
  protected adapters: Map<string, TAdapter> = new Map();
  protected staticModelsCache: Map<string, TModel[]> = new Map();

  constructor() {
    this.initializeAdapters();
  }

  /**
   * Subclasses must implement: initialize and register all adapters
   */
  protected abstract initializeAdapters(): void;

  /**
   * Subclasses must implement: get Provider metadata from an adapter
   */
  protected abstract getProviderFromAdapter(adapter: TAdapter): TProvider;

  /**
   * Subclasses must implement: get the static model list from an adapter
   */
  protected abstract getModelsFromAdapter(adapter: TAdapter): TModel[];

  /**
   * Subclasses must implement: call the adapter's async model fetching method
   */
  protected abstract getModelsAsyncFromAdapter(
    adapter: TAdapter,
    connectionConfig: TConnectionConfig
  ): Promise<TModel[]>;

  /**
   * Optional for subclasses: get the provider type description used in error messages
   */
  protected getProviderTypeDescription(): string {
    return 'provider';
  }

  /**
   * Overridable by subclasses: generate the "unknown Provider" error (aligned with i18n)
   */
  protected createUnknownProviderError(providerId: string): Error {
    return new Error(`Unknown ${this.getProviderTypeDescription()}: ${providerId}`);
  }

  /**
   * Overridable by subclasses: generate the "dynamic models not supported" error (aligned with i18n)
   */
  protected createDynamicModelUnsupportedError(provider: TProvider): Error {
    return new Error(`${provider.name} does not support dynamic model fetching`);
  }

  /**
   * Preload the static models of all Providers into the cache
   */
  protected preloadStaticModels(): void {
    this.adapters.forEach((adapter, providerId) => {
      const provider = this.getProviderFromAdapter(adapter);
      if (provider.id === providerId) {
        this.staticModelsCache.set(providerId, this.getModelsFromAdapter(adapter));
      }
    });
  }

  // ===== Basic adapter management =====

  /**
   * Get an adapter instance by providerId
   * @param providerId Provider ID (automatically lowercased)
   * @returns Adapter instance
   * @throws {Error} When providerId does not exist
   */
  public getAdapter(providerId: string): TAdapter {
    const adapter = this.adapters.get(providerId.toLowerCase());
    if (!adapter) {
      throw this.createUnknownProviderError(providerId);
    }
    return adapter;
  }

  // ===== Metadata queries =====

  /**
   * Get metadata for all registered Providers
   * @returns Array of Provider metadata
   */
  public getAllProviders(): TProvider[] {
    const providers: TProvider[] = [];
    const seenIds = new Set<string>();

    this.adapters.forEach((adapter) => {
      const provider = this.getProviderFromAdapter(adapter);
      if (!seenIds.has(provider.id)) {
        seenIds.add(provider.id);
        providers.push(provider);
      }
    });

    return providers;
  }

  // ===== Static model retrieval (immediately available) =====

  /**
   * Get the static model list (cached)
   * @param providerId Provider ID
   * @returns Array of static models
   */
  public getStaticModels(providerId: string): TModel[] {
    const normalizedId = providerId.toLowerCase();

    // Try to get from the cache
    if (this.staticModelsCache.has(normalizedId)) {
      return this.staticModelsCache.get(normalizedId)!;
    }

    // On a cache miss, get from the adapter
    const adapter = this.getAdapter(normalizedId);
    const models = this.getModelsFromAdapter(adapter);
    this.staticModelsCache.set(normalizedId, models);
    return models;
  }

  // ===== Dynamic model retrieval (requires connection config) =====

  /**
   * Dynamically fetch the model list
   * @param providerId Provider ID
   * @param connectionConfig Connection config
   * @returns Array of dynamically fetched models
   * @throws {Error} When the Provider does not support dynamic fetching
   */
  public async getDynamicModels(
    providerId: string,
    connectionConfig: TConnectionConfig
  ): Promise<TModel[]> {
    const adapter = this.getAdapter(providerId);
    const provider = this.getProviderFromAdapter(adapter);

    if (!provider.supportsDynamicModels) {
      throw this.createDynamicModelUnsupportedError(provider);
    }

    try {
      return await this.getModelsAsyncFromAdapter(adapter, connectionConfig);
    } catch (error) {
      console.warn(`Failed to fetch dynamic models (${providerId}):`, error);
      throw error;
    }
  }

  // ===== Unified model retrieval interface (automatically chooses static or dynamic) =====

  /**
   * Unified model retrieval interface
   * Prefers dynamic fetching and falls back to static models on failure
   *
   * @param providerId Provider ID
   * @param connectionConfig Connection config (optional; when provided, dynamic fetching is attempted)
   * @returns Array of models
   */
  public async getModels(
    providerId: string,
    connectionConfig?: TConnectionConfig
  ): Promise<TModel[]> {
    const adapter = this.getAdapter(providerId);
    const provider = this.getProviderFromAdapter(adapter);

    // If dynamic fetching is supported and a connection config is provided, try dynamic fetching
    if (provider.supportsDynamicModels && connectionConfig) {
      try {
        const dynamicModels = await this.getDynamicModels(providerId, connectionConfig);

        // Merge static and dynamic models; dynamic models take precedence
        const staticModels = this.getStaticModels(providerId);
        const dynamicIds = new Set(dynamicModels.map((m) => m.id));
        const mergedModels = [
          ...dynamicModels,
          ...staticModels.filter((m) => !dynamicIds.has(m.id))
        ];

        return mergedModels;
      } catch (error) {
        console.warn(
          `Dynamic model loading failed (${providerId}), falling back to static models:`,
          error
        );
        // Fall back to static models
        return this.getStaticModels(providerId);
      }
    }

    // Return static models
    return this.getStaticModels(providerId);
  }

  /**
   * Get a combined view of all static models
   * @returns Array of Provider-Model pairs
   */
  public getAllStaticModels(): Array<{ provider: TProvider; model: TModel }> {
    const result: Array<{ provider: TProvider; model: TModel }> = [];

    for (const provider of this.getAllProviders()) {
      const models = this.getStaticModels(provider.id);
      for (const model of models) {
        result.push({ provider, model });
      }
    }

    return result;
  }

  // ===== Capability checks =====

  /**
   * Check whether the Provider supports dynamic model fetching
   * @param providerId Provider ID
   * @returns Whether dynamic fetching is supported
   */
  public supportsDynamicModels(providerId: string): boolean {
    try {
      const adapter = this.getAdapter(providerId);
      return this.getProviderFromAdapter(adapter).supportsDynamicModels;
    } catch {
      return false;
    }
  }

  // ===== Validation methods =====

  /**
   * Validate whether the Provider and Model combination is valid
   * @param providerId Provider ID
   * @param modelId Model ID
   * @returns Whether it is valid
   */
  public validateProviderModel(providerId: string, modelId: string): boolean {
    try {
      const models = this.getStaticModels(providerId);
      return models.some((model) => model.id === modelId);
    } catch {
      return false;
    }
  }

  // ===== Helper: clear cache =====

  /**
   * Clear the static model cache and reload
   */
  public clearCache(): void {
    this.staticModelsCache.clear();
    this.preloadStaticModels();
  }
}
