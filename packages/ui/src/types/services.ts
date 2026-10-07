import { type Ref } from 'vue'

import type {
  IModelManager,
  ITemplateManager,
  IHistoryManager,
  IDataManager,
  ILLMService,
  IPromptService,
  ITemplateLanguageService,
  ICompareService,
  IPreferenceService,
  ContextRepo,
  IImageModelManager,
  IImageService,
  IImageAdapterRegistry,
  ITextAdapterRegistry,
  IFavoriteManager,
  ContextMode,
  IEvaluationService,
  IVariableExtractionService,
  IVariableValueGenerationService,
  IImageStorageService
} from '@prompt-optimizer/core'

/**
 * Unified app service interface definition
 */
export interface AppServices {
  modelManager: IModelManager;
  templateManager: ITemplateManager;
  historyManager: IHistoryManager;
  dataManager: IDataManager;
  llmService: ILLMService;
  promptService: IPromptService;
  templateLanguageService: ITemplateLanguageService;
  preferenceService: IPreferenceService;
  compareService: ICompareService;
  contextRepo: ContextRepo;
  favoriteManager: IFavoriteManager;
  // 🆕 Context mode (compatible: early implementations may pass a string; passing a Ref is recommended now)
  contextMode: Ref<ContextMode> | ContextMode;
  // Text model adapter registry (local instance)
  textAdapterRegistry?: ITextAdapterRegistry;
  // Image-related (Web first, optional)
  imageModelManager?: IImageModelManager;
  imageService?: IImageService;
  imageAdapterRegistry?: IImageAdapterRegistry;
  // 🆕 Image storage service (optional)
  imageStorageService?: IImageStorageService;
  // Favorite snapshot image storage (isolated from the session image storage)
  favoriteImageStorageService?: IImageStorageService;
  // 🆕 Evaluation service (optional)
  evaluationService?: IEvaluationService;
  // 🆕 Variable extraction service (optional)
  variableExtractionService?: IVariableExtractionService;
  // 🆕 Variable value generation service (optional)
  variableValueGenerationService?: IVariableValueGenerationService;
}
