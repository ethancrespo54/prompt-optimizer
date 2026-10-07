import { ref, shallowRef, onMounted, type Ref } from 'vue'

import {
  StorageFactory,
  createModelManager,
  createTemplateManager,
  createHistoryManager,
  createDataManager,
  createLLMService,
  createPromptService,
  createTemplateLanguageService,
  createCompareService,
  createContextRepo,
  createEvaluationService,
  createVariableExtractionService,
  createVariableValueGenerationService,
  ElectronContextRepoProxy,
  ElectronModelManagerProxy,
  ElectronTemplateManagerProxy,
  ElectronHistoryManagerProxy,
  ElectronDataManagerProxy,
  ElectronLLMProxy,
  ElectronPromptServiceProxy,
  ElectronTemplateLanguageServiceProxy,
  isRunningInElectron,
  waitForElectronApi,
  ElectronPreferenceServiceProxy,
  createPreferenceService,
  FavoriteManager,
  createImageModelManager,
  createImageService,
  createImageAdapterRegistry,
  createTextAdapterRegistry,
  createImageStorageService,
  // migrateLegacySessions - removed; sessions were newly introduced in this refactoring
  type IImageModelManager,
  type IImageService,
  type ITextAdapterRegistry,
  type IModelManager,
  type ITemplateManager,
  type IHistoryManager,
  type ILLMService,
  type IPromptService,
  type IDataManager,
  type IPreferenceService,
  type IFavoriteManager,
  type IEvaluationService,
  type IVariableExtractionService,
  type IVariableValueGenerationService,
  type IImageStorageService,
  type ContextMode,
  DEFAULT_CONTEXT_MODE
} from '@prompt-optimizer/core';
import type { AppServices } from '../../types/services';
import { scheduleImageStorageGc } from '../../stores/session/imageStorageMaintenance'

/**
 * Unified app service initializer.
 * Responsible for creating and initializing all core services depending on the runtime environment (Web or Electron).
 * @returns { services, isInitializing, error }
 */
export function useAppInitializer(): {
  services: Ref<AppServices | null>;
  isInitializing: Ref<boolean>;
  error: Ref<Error | null>;
} {
  const services = shallowRef<AppServices | null>(null);
  const isInitializing = ref(true);
  const error = ref<Error | null>(null);

  onMounted(async () => {
    try {
      console.log('[AppInitializer] Starting app initialization...');


      let modelManager: IModelManager;
      let templateManager: ITemplateManager;
      let historyManager: IHistoryManager;
      let dataManager: IDataManager;
      let llmService: ILLMService;
      let promptService: IPromptService;
      let preferenceService: IPreferenceService;
      let favoriteManager: IFavoriteManager;
      let evaluationService: IEvaluationService | undefined;
      let variableExtractionService: IVariableExtractionService | undefined;
      let variableValueGenerationService: IVariableValueGenerationService | undefined;
      let imageModelManager: IImageModelManager | undefined;
      let imageService: IImageService | undefined;
      let imageAdapterRegistryInstance: ReturnType<typeof createImageAdapterRegistry> | undefined;
      let imageStorageService: IImageStorageService | undefined;
      let favoriteImageStorageService: IImageStorageService | undefined;
      let textAdapterRegistryInstance: ITextAdapterRegistry | undefined;

      if (isRunningInElectron()) {
        console.log('[AppInitializer] Electron environment detected, waiting for the API to be ready...');
        
        // Wait for the Electron API to be fully ready
        const apiReady = await waitForElectronApi();
        if (!apiReady) {
          throw new Error('Electron API initialization timed out, please check that the preload script is loaded correctly');
        }
        
        console.log('[AppInitializer] Electron API is ready, initializing proxy services...');

        // In the Electron environment, storageProvider is not needed
        // All storage operations go through the proxy of each manager

        // In the Electron environment, we instantiate all the lightweight proxy classes
        modelManager = new ElectronModelManagerProxy();
        templateManager = new ElectronTemplateManagerProxy();
        historyManager = new ElectronHistoryManagerProxy();
        llmService = new ElectronLLMProxy();
        promptService = new ElectronPromptServiceProxy();
        preferenceService = new ElectronPreferenceServiceProxy();

        // Text model adapter registry (local instance, no proxy needed)
        textAdapterRegistryInstance = createTextAdapterRegistry();

        // Image-related (Electron renderer process proxies)
        const { ElectronImageModelManagerProxy, ElectronImageServiceProxy } = await import('@prompt-optimizer/core')
        imageAdapterRegistryInstance = createImageAdapterRegistry();
        imageModelManager = new ElectronImageModelManagerProxy();
        imageService = new ElectronImageServiceProxy();

        // 🆕 Image storage service: the Electron renderer process also uses IndexedDB (same behavior as the web)
        console.log('[AppInitializer] Initializing the image storage service (Electron)...');
        imageStorageService = createImageStorageService({
          maxCacheSize: 50 * 1024 * 1024,  // 50 MB
          maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
          maxCount: 100,                     // At most 100 images
          autoCleanupThreshold: 0.8,         // Trigger cleanup at 80%
          dbName: 'PromptOptimizerImageDB',
        });

        // Favorite snapshot image storage (separate database, to avoid coupling with the session image cleanup policy)
        favoriteImageStorageService = createImageStorageService({
          maxCacheSize: 200 * 1024 * 1024,      // 200 MB
          maxAge: 365 * 24 * 60 * 60 * 1000,    // 365 days
          maxCount: 1000,
          autoCleanupThreshold: 0.9,
          dbName: 'PromptOptimizerFavoriteImageDB',
        });

        // DataManager uses the proxy pattern in the Electron environment
        dataManager = new ElectronDataManagerProxy();

        // Use the real Electron template language service proxy
        const templateLanguageService = new ElectronTemplateLanguageServiceProxy();

        // Create the CompareService (used directly, no proxy needed)
        const compareService = createCompareService();

        // Use ElectronContextRepoProxy instead of the temporary solution
        const contextRepo = new ElectronContextRepoProxy();

        // Create the favorites manager proxy
        const { FavoriteManagerElectronProxy } = await import('@prompt-optimizer/core')
        favoriteManager = new FavoriteManagerElectronProxy();

        // 🆕 Create the evaluation service (using the proxied llmService, modelManager, templateManager)
        evaluationService = createEvaluationService(llmService, modelManager, templateManager);

        // 🆕 Create the variable extraction service (using the proxied llmService, modelManager, templateManager)
        variableExtractionService = createVariableExtractionService(llmService, modelManager, templateManager);

        // 🆕 Create the variable value generation service (using the proxied llmService, modelManager, templateManager)
        variableValueGenerationService = createVariableValueGenerationService(llmService, modelManager, templateManager);

        // 🆕 Read the mode of the current context
        console.log('[AppInitializer] Reading the current context mode...');
        const contextMode = ref<ContextMode>(DEFAULT_CONTEXT_MODE);
        try {
          const currentId = await contextRepo.getCurrentId();
          const currentContext = await contextRepo.get(currentId);
          contextMode.value = currentContext.mode || DEFAULT_CONTEXT_MODE;
          console.log('[AppInitializer] Current context mode:', contextMode.value);
        } catch (err) {
          console.warn('[AppInitializer] Failed to read the context mode, using the default value:', err);
        }

        services.value = {
          modelManager,
          templateManager,
          historyManager,
          dataManager,
          llmService,
          promptService,
          templateLanguageService, // Use the proxy instead of null
          preferenceService, // Use the ElectronPreferenceServiceProxy imported from the core package
          compareService, // Used directly, no proxy needed
          contextRepo, // Use the Electron proxy
          favoriteManager, // Use the Electron proxy
          contextMode, // 🆕 Context mode
          textAdapterRegistry: textAdapterRegistryInstance,
          imageModelManager,
          imageService,
          imageAdapterRegistry: imageAdapterRegistryInstance,
          imageStorageService, // 🆕 Image storage service
          favoriteImageStorageService,
          evaluationService, // 🆕 Evaluation service
          variableExtractionService, // 🆕 Variable extraction service
          variableValueGenerationService, // 🆕 Variable value generation service
        };
        console.log('[AppInitializer] Electron proxy services initialized');

        // Keep only the images referenced by sessions: run a best-effort GC once after startup
        if (imageStorageService) {
          scheduleImageStorageGc(preferenceService, imageStorageService, {
            getFavoritesPayload: () => favoriteManager.getFavorites(),
          })
        }

      } else {
        console.log('[AppInitializer] Web environment detected, initializing the full services...');
        // In the Web environment, we create a complete set of real services
        const storageProvider = StorageFactory.create('dexie');

        // Create the preference service based on the storage provider, using createPreferenceService from the core package
        preferenceService = createPreferenceService(storageProvider);

        const languageService = createTemplateLanguageService(preferenceService);
        
        // Services with no dependencies or only storage
        const modelManagerInstance = createModelManager(storageProvider);

        // Text model adapter registry (local instance)
        textAdapterRegistryInstance = createTextAdapterRegistry();

        // Image model manager (separate storage space)
        const imageAdapterRegistry = await import('@prompt-optimizer/core').then(m => m.createImageAdapterRegistry())
        imageAdapterRegistryInstance = imageAdapterRegistry
        const imageModelManagerInstance = createImageModelManager(storageProvider, imageAdapterRegistry);

        // 🆕 Create the image storage service (separate IndexedDB database)
        console.log('[AppInitializer] Initializing the image storage service...');
        imageStorageService = createImageStorageService({
          maxCacheSize: 50 * 1024 * 1024,  // 50 MB
          maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
          maxCount: 100,                     // At most 100 images
          autoCleanupThreshold: 0.8,         // Trigger cleanup at 80%
          dbName: 'PromptOptimizerImageDB',
        });

        // Favorite snapshot image storage (separate database, to avoid coupling with the session image cleanup policy)
        favoriteImageStorageService = createImageStorageService({
          maxCacheSize: 200 * 1024 * 1024,      // 200 MB
          maxAge: 365 * 24 * 60 * 60 * 1000,    // 365 days
          maxCount: 1000,
          autoCleanupThreshold: 0.9,
          dbName: 'PromptOptimizerFavoriteImageDB',
        });

        // 📝 Image data migration was removed (sessions were newly introduced in this refactoring, so there is no historical data to migrate)
        // If a migration is needed in the future, the migrateLegacySessions() function can be used

        // Initialize language service first, as template manager depends on it
        console.log('[AppInitializer] Initializing the language service...');
        await languageService.initialize();
        
        const templateManagerInstance = createTemplateManager(storageProvider, languageService);
        templateManager = templateManagerInstance;
        console.log('[AppInitializer] TemplateManager instance in Web:', templateManager);
        
        // Initialize managers that depend on other managers
        const historyManagerInstance = createHistoryManager(storageProvider, modelManagerInstance);
        
        // Now ensure model manager with async init is ready (template manager no longer needs async init)
        console.log('[AppInitializer] Making sure the model manager initialization is complete...');
        await modelManagerInstance.ensureInitialized();

        // Assign instances after they are fully initialized
        modelManager = modelManagerInstance;
        templateManager = templateManagerInstance;
        historyManager = historyManagerInstance;

        // Create adapters that strictly conform to the interfaces
        const modelManagerAdapter: IModelManager = {
          ensureInitialized: () => modelManagerInstance.ensureInitialized(),
          isInitialized: () => modelManagerInstance.isInitialized(),
          getAllModels: () => modelManagerInstance.getAllModels(),
          getModel: (key) => modelManagerInstance.getModel(key),
          addModel: (key, config) => modelManagerInstance.addModel(key, config),
          updateModel: (id, updates) => modelManagerInstance.updateModel(id, updates),
          deleteModel: (id) => modelManagerInstance.deleteModel(id),
          enableModel: (key) => modelManagerInstance.enableModel(key),
          disableModel: (key) => modelManagerInstance.disableModel(key),
          getEnabledModels: () => modelManagerInstance.getEnabledModels(),
          // IImportExportable methods
          exportData: () => modelManagerInstance.exportData(),
          importData: (data) => modelManagerInstance.importData(data),
          getDataType: () => modelManagerInstance.getDataType(),
          validateData: (data) => modelManagerInstance.validateData(data),
        };

        const templateManagerAdapter: ITemplateManager = {
          getTemplate: (id) => templateManagerInstance.getTemplate(id),
          saveTemplate: (template) => templateManagerInstance.saveTemplate(template),
          deleteTemplate: (id) => templateManagerInstance.deleteTemplate(id),
          listTemplates: () => templateManagerInstance.listTemplates(),
          exportTemplate: (id) => templateManagerInstance.exportTemplate(id),
          importTemplate: (json) => templateManagerInstance.importTemplate(json),
          listTemplatesByType: (type) => templateManagerInstance.listTemplatesByType(type),
          changeBuiltinTemplateLanguage: (language) => templateManagerInstance.changeBuiltinTemplateLanguage(language),
          getCurrentBuiltinTemplateLanguage: async () => await templateManagerInstance.getCurrentBuiltinTemplateLanguage(),
          getSupportedBuiltinTemplateLanguages: async () => await templateManagerInstance.getSupportedBuiltinTemplateLanguages(),
          // IImportExportable methods
          exportData: () => templateManagerInstance.exportData(),
          importData: (data) => templateManagerInstance.importData(data),
          getDataType: () => templateManagerInstance.getDataType(),
          validateData: (data) => templateManagerInstance.validateData(data),
        };

        const historyManagerAdapter: IHistoryManager = {
          getRecords: () => historyManagerInstance.getRecords(),
          getRecord: (id) => historyManagerInstance.getRecord(id),
          addRecord: (record) => historyManagerInstance.addRecord(record),
          deleteRecord: (id) => historyManagerInstance.deleteRecord(id),
          clearHistory: () => historyManagerInstance.clearHistory(),
          getIterationChain: (id) => historyManagerInstance.getIterationChain(id),
          getAllChains: () => historyManagerInstance.getAllChains(),
          getChain: (id) => historyManagerInstance.getChain(id),
          createNewChain: (record) => historyManagerInstance.createNewChain(record),
          addIteration: (params) => historyManagerInstance.addIteration(params),
          deleteChain: (id) => historyManagerInstance.deleteChain(id),
          // IImportExportable methods
          exportData: () => historyManagerInstance.exportData(),
          importData: (data) => historyManagerInstance.importData(data),
          getDataType: () => historyManagerInstance.getDataType(),
          validateData: (data) => historyManagerInstance.validateData(data),
        };

        // Services that depend on initialized managers
        console.log('[AppInitializer] Creating the services that depend on other managers...');
        llmService = createLLMService(modelManagerInstance);
        promptService = createPromptService(modelManager, llmService, templateManager, historyManager);
        imageService = createImageService(imageModelManagerInstance, imageAdapterRegistryInstance);

        // Ensure image model defaults are seeded (similar to text models)
        try {
          if (typeof imageModelManagerInstance.ensureInitialized === 'function') {
            await imageModelManagerInstance.ensureInitialized()
          }
        } catch (e) {
          console.warn('[AppInitializer] ImageModelManager ensureInitialized failed (non-critical):', e)
        }

        // Create the CompareService (used directly)
        const compareService = createCompareService();

        // Create the ContextRepo (using the same storage provider)
        const contextRepo = createContextRepo(storageProvider);

        // Create the DataManager (needs contextRepo)
        dataManager = createDataManager(modelManagerInstance, templateManagerInstance, historyManagerInstance, preferenceService, contextRepo);

        // Create the favorites manager
        favoriteManager = new FavoriteManager(storageProvider);

        // 🆕 Create the evaluation service
        evaluationService = createEvaluationService(llmService, modelManagerAdapter, templateManagerAdapter);

        // 🆕 Create the variable extraction service
        variableExtractionService = createVariableExtractionService(llmService, modelManagerAdapter, templateManagerAdapter);

        // 🆕 Create the variable value generation service
        variableValueGenerationService = createVariableValueGenerationService(llmService, modelManagerAdapter, templateManagerAdapter);

        // 🆕 Read the mode of the current context
        console.log('[AppInitializer] Reading the current context mode...');
        const contextMode = ref<ContextMode>(DEFAULT_CONTEXT_MODE);
        try {
          const currentId = await contextRepo.getCurrentId();
          const currentContext = await contextRepo.get(currentId);
          contextMode.value = currentContext.mode || DEFAULT_CONTEXT_MODE;
          console.log('[AppInitializer] Current context mode:', contextMode.value);
        } catch (err) {
          console.warn('[AppInitializer] Failed to read the context mode, using the default value:', err);
        }

        // Assign all service instances to services.value
        services.value = {
          modelManager: modelManagerAdapter, // Use the adapter
          templateManager: templateManagerAdapter, // Use the adapter
          historyManager: historyManagerAdapter, // Use the adapter
          dataManager,
          llmService,
          promptService,
          templateLanguageService: languageService,
          preferenceService, // Use the PreferenceService imported from the core package
          compareService, // Used directly
          contextRepo, // Context repository
          favoriteManager, // Favorites manager
          contextMode, // 🆕 Context mode
          textAdapterRegistry: textAdapterRegistryInstance,
          imageModelManager: imageModelManagerInstance,
          imageService,
          imageAdapterRegistry: imageAdapterRegistryInstance,
          imageStorageService, // 🆕 Image storage service
          favoriteImageStorageService,
          evaluationService, // 🆕 Evaluation service
          variableExtractionService, // 🆕 Variable extraction service
          variableValueGenerationService, // 🆕 Variable value generation service
        };

        console.log('[AppInitializer] All services initialized');

        // Keep only the images referenced by sessions: run a best-effort GC once after startup
        if (imageStorageService) {
          scheduleImageStorageGc(preferenceService, imageStorageService, {
            getFavoritesPayload: () => favoriteManager.getFavorites(),
          })
        }
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("[AppInitializer] Critical service initialization failed:", errorMessage);
      console.error("[AppInitializer] Error details:", err);
      error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
      isInitializing.value = false;
      console.log('[AppInitializer] App initialization complete');
    }
  });

  return { services, isInitializing, error };
} 
