/*
 * Prompt Optimizer - AI prompt optimization tool
 * Copyright (C) 2025 linshenkx
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, version 3 of the License.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

// Pure Naive UI style imports - theme.css dependency removed
import "./styles/index.css";
import "./styles/scrollbar.css";
import "./styles/common.css";
// Removed: import './styles/theme.css' - fully using the Naive UI theme system

// Export plugins
export {
  installI18n,
  installI18nOnly,
  initializeI18nWithStorage,
  setI18nServices,
  i18n,
} from "./plugins/i18n";

export { pinia, installPinia, setPiniaServices } from "./plugins/pinia";

// Export Naive UI config
export {
  currentNaiveTheme as naiveTheme,
  currentThemeOverrides as themeOverrides,
  currentThemeId,
  currentThemeConfig,
  naiveThemeConfigs,
  switchTheme,
  initializeNaiveTheme,
} from "./config/naive-theme";

// Export theme-related composables
export { useNaiveTheme } from "./composables/ui/useNaiveTheme";

/**
 * Component exports
 * Note: all components are exported with a UI suffix to distinguish them from components of other libraries
 * For example: Toast.vue is exported as ToastUI
 */
// Components
export { default as ToastUI } from "./components/Toast.vue";
export { default as ModelManagerUI } from "./components/ModelManager.vue";
export { default as PromptPanelUI } from "./components/PromptPanel.vue";
export { default as OutputDisplay } from "./components/OutputDisplay.vue";
export { default as TemplateManagerUI } from "./components/TemplateManager.vue";
export { default as TemplateSelectUI } from "./components/TemplateSelect.vue";
export { default as SelectWithConfig } from "./components/SelectWithConfig.vue";
export { default as HistoryDrawerUI } from "./components/HistoryDrawer.vue";
export { default as InputPanelUI } from "./components/InputPanel.vue";
export { default as MainLayoutUI } from "./components/MainLayout.vue";
export { default as ContentCardUI } from "./components/ContentCard.vue";
export { default as ActionButtonUI } from "./components/ActionButton.vue";
export { default as ThemeToggleUI } from "./components/ThemeToggleUI.vue";
// TestPanel.vue - replaced by TestAreaPanel
export { default as ModalUI } from "./components/Modal.vue";
export { default as PanelUI } from "./components/Panel.vue";

export { default as VariableManagerModal } from "./components/variable/VariableManagerModal.vue";
export { default as VariableEditor } from "./components/variable/VariableEditor.vue";
export { default as VariableImporter } from "./components/variable/VariableImporter.vue";
export { default as ToolManagerModal } from "./components/tool/ToolManagerModal.vue";
export { default as ConversationManager } from "./components/context-mode/ConversationManager.vue";
export { default as ContextEditor } from "./components/context-mode/ContextEditor.vue";
export { default as TestAreaPanel } from "./components/TestAreaPanel.vue";
export { default as TestInputSection } from "./components/TestInputSection.vue";
export { default as TestControlBar } from "./components/TestControlBar.vue";
export { default as TestResultSection } from "./components/TestResultSection.vue";
export { default as DataManagerUI } from "./components/DataManager.vue";
export { default as OptimizationModeSelectorUI } from "./components/OptimizationModeSelector.vue";
export { default as FunctionModeSelector } from "./components/FunctionModeSelector.vue";
export { default as TextDiffUI } from "./components/TextDiff.vue";
export { default as OutputDisplayFullscreen } from "./components/OutputDisplayFullscreen.vue";
export { default as OutputDisplayCore } from "./components/OutputDisplayCore.vue";
export { default as UpdaterIcon } from "./components/UpdaterIcon.vue";
export { default as UpdaterModal } from "./components/UpdaterModal.vue";
export { default as FullscreenDialog } from "./components/FullscreenDialog.vue";
export { default as InputWithSelect } from "./components/InputWithSelect.vue";
export { default as MarkdownRenderer } from "./components/MarkdownRenderer.vue";
export { default as ToolCallDisplay } from "./components/ToolCallDisplay.vue";
export { default as FavoriteManagerUI } from "./components/FavoriteManager.vue";
export { default as CategoryManagerUI } from "./components/CategoryManager.vue";
export { default as SaveFavoriteDialog } from "./components/SaveFavoriteDialog.vue";
export { default as ContextModeActions } from "./components/context-mode/ContextModeActions.vue";
export { default as PromptPreviewPanel } from "./components/PromptPreviewPanel.vue";
export { default as ContextSystemWorkspace } from "./components/context-mode/ContextSystemWorkspace.vue";
export { default as ContextUserWorkspace } from "./components/context-mode/ContextUserWorkspace.vue";
export { default as ContextUserTestPanel } from "./components/context-mode/ContextUserTestPanel.vue";
export { default as ConversationTestPanel } from "./components/context-mode/ConversationTestPanel.vue";
export { default as FunctionModelManagerUI } from "./components/FunctionModelManager.vue";

// Basic mode components no longer have static exports (dynamically imported by the router to avoid bundling them into the main bundle)
// To use them directly, register them via the router at the app layer or import them dynamically on demand
// export { default as BasicSystemWorkspace } from "./components/basic-mode/BasicSystemWorkspace.vue";
// export { default as BasicUserWorkspace } from "./components/basic-mode/BasicUserWorkspace.vue";

// App layout components
export { AppHeaderActions, AppCoreNav, PromptOptimizerApp } from "./components/app-layout";

// Router (provided by the UI package; apps should install this router to avoid multiple instances / inconsistent injection)
export { router } from "./router";

// Evaluation components
export { EvaluationPanel, EvaluateButton, EvaluationScoreBadge } from "./components/evaluation";

// Export Naive UI components (resolves component resolution issues)
export {
  NFlex,
  NButton,
  NCard,
  NInput,
  NSelect,
  NModal,
  NSpace,
  NTag,
  NText,
  NGrid,
  NGridItem,
  NIcon,
  NImage,
  NLayout,
  NLayoutHeader,
  NLayoutContent,
  NMessageProvider,
  NButtonGroup,
  NDropdown,
  NDivider,
  NDataTable,
  NForm,
  NFormItem,
  NRadioGroup,
  NRadioButton,
  NScrollbar,
  NEmpty,
  NBadge,
  useMessage,
} from "naive-ui";

// Export directives
export { clickOutside } from "./directives/clickOutside";

// Export composables
export * from "./composables";

// Re-export what is needed from core, keeping only factory functions, proxy classes, and necessary utilities/types
export {
  StorageFactory,
  DexieStorageProvider,
  ModelManager,
  createModelManager,
  ElectronModelManagerProxy,
  TemplateManager,
  createTemplateManager,
  ElectronTemplateManagerProxy,
  createTemplateLanguageService,
  ElectronTemplateLanguageServiceProxy,
  HistoryManager,
  createHistoryManager,
  ElectronHistoryManagerProxy,
  DataManager,
  createDataManager,
  ElectronDataManagerProxy,
  createLLMService,
  ElectronLLMProxy,
  createPromptService,
  ElectronPromptServiceProxy,
  createPreferenceService,
  ElectronPreferenceServiceProxy,
  createCompareService,
  createContextRepo,
  ElectronContextRepoProxy,
  FavoriteManager,
  FavoriteManagerElectronProxy,
  isRunningInElectron,
  waitForElectronApi,
  // Evaluation service
  EvaluationService,
  createEvaluationService,
  // 🆕 Variable extraction service
  createVariableExtractionService,
  // 🆕 Variable value generation service
  createVariableValueGenerationService,
} from "@prompt-optimizer/core";

// Export types
export type {
  OptimizationMode,
  OptimizationRequest,
  ConversationMessage,
  CustomConversationRequest,
  IModelManager,
  ITemplateManager,
  IHistoryManager,
  ILLMService,
  IPromptService,
  IPreferenceService,
  ICompareService,
  ContextRepo,
  ContextPackage,
  ContextBundle,
  Template,
  IFavoriteManager,
  FavoritePrompt,
  FavoriteCategory,
  // Evaluation service types
  IEvaluationService,
  EvaluationType,
  EvaluationRequest,
  EvaluationResponse,
  EvaluationScore,
  EvaluationStreamHandlers,
  // 🆕 Variable extraction service types
  IVariableExtractionService,
  VariableExtractionRequest,
  VariableExtractionResponse,
  ExtractedVariable,
} from "@prompt-optimizer/core";

// Export newly added types and services
export * from "./types";
export * from "./services";

// Export image mode components and the core image service (forwarding core capabilities)
export { default as ImageModeSelector } from "./components/image-mode/ImageModeSelector.vue";
export {
  ImageModelManager,
  createImageModelManager,
  ImageService,
  createImageService,
} from "@prompt-optimizer/core";

// Export data conversion utilities and types
export { DataTransformer, OptionAccessors } from "./utils/data-transformer";
export type {
  SelectOption,
  ModelSelectOption,
  TemplateSelectOption,
} from "./types/select-options";
