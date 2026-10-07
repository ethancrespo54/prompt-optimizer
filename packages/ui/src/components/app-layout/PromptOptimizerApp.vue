<template>
    <!--
        PromptOptimizerApp - main application component

        Responsibilities:
        - Provide the complete Prompt Optimizer application functionality
        - Unify the core logic of the web and extension apps
        - Manage all state, composables, and event handling

        Design notes:
        - Core logic extracted from App.vue
        - Reduces duplicated code between the web/extension apps
    -->
    <NConfigProvider
        :theme="naiveTheme"
        :theme-overrides="themeOverrides"
        :hljs="hljsInstance"
    >
        <div v-if="isInitializing" class="loading-container">
            <div class="spinner"></div>
            <p>{{ t("log.info.initializing") }}</p>
        </div>
        <div v-else-if="!services" class="loading-container error">
            <p>{{ t("toast.error.appInitFailed") }}</p>
        </div>
        <div v-else-if="!isReady" class="loading-container">
            <div class="spinner"></div>
            <p>{{ t("log.info.initializing") }}</p>
        </div>
        <template v-else>
            <MainLayoutUI>
                <!-- Title Slot -->
                <template #title>
                    {{ t("promptOptimizer.title") }}
                </template>

                <!-- Core Navigation Slot -->
                <template #core-nav>
                    <AppCoreNav />
                </template>

                <!-- Actions Slot -->
                <template #actions>
                    <AppHeaderActions
                        @open-templates="openTemplateManager"
                        @open-history="historyManager.showHistory = true"
                        @open-model-manager="modelManager.showConfig = true"
                        @open-favorites="showFavoriteManager = true"
                        @open-data-manager="showDataManager = true"
                        @open-variables="handleOpenVariableManager()"
                        @open-github="openGithubRepo"
                    />
                </template>
                <template #main>
                    <!-- 🔧 Router architecture: use RouterView to automatically render the matching workspace container -->
                    <!-- - /basic/system → BasicSystemWorkspace -->
                    <!-- - /basic/user → BasicUserWorkspace -->
                    <!-- - /pro/multi → ContextSystemWorkspace -->
                    <!-- - /pro/variable → ContextUserWorkspace -->
                    <!-- - /image/text2image → ImageText2ImageWorkspace -->
                    <!-- - /image/image2image → ImageImage2ImageWorkspace -->
                    <RouterView v-slot="{ Component, route: viewRoute }">
                        <component
                            :is="Component"
                            :key="viewRoute.fullPath"
                            :ref="(instance: unknown) => setWorkspaceRef(instance, viewRoute.name)"
                        />
                    </RouterView>
                </template>
            </MainLayoutUI>

            <!-- Modals and Drawers that are conditionally rendered -->
            <ModelManagerUI
                v-if="isReady"
                v-model:show="modelManager.showConfig"
                @update:show="
                    (v: boolean) => {
                        if (!v) handleModelManagerClosed();
                    }
                "
            />
            <TemplateManagerUI
                v-if="isReady"
                v-model:show="templateManagerState.showTemplates"
                :template-type="templateManagerState.currentType"
                :basic-sub-mode="routeBasicSubMode"
                :pro-sub-mode="routeProSubMode"
                :image-sub-mode="routeImageSubMode"
                @select="handleTemplateSelected"
                @close="handleTemplateManagerClosed"
            />
            <HistoryDrawerUI
                v-if="isReady"
                v-model:show="historyManager.showHistory"
                :history="promptHistory.history"
                @reuse="handleHistoryReuse"
                @clear="promptHistory.handleClearHistory"
                @deleteChain="promptHistory.handleDeleteChain"
            />
            <DataManagerUI
                v-if="isReady"
                v-model:show="showDataManager"
                @imported="handleDataImported"
            />

            <!-- Favorites management dialog -->
            <FavoriteManagerUI
                v-if="isReady"
                :show="showFavoriteManager"
                @update:show="
                    (v: boolean) => {
                        if (!v) showFavoriteManager = false;
                    }
                "
                @optimize-prompt="handleFavoriteOptimizePrompt"
                @use-favorite="handleUseFavorite"
            />

            <!-- Save favorite dialog -->
            <SaveFavoriteDialog
                v-if="isReady"
                v-model:show="showSaveFavoriteDialog"
                :content="saveFavoriteData?.content || ''"
                :original-content="saveFavoriteData?.originalContent || ''"
                :prefill="saveFavoriteData?.prefill"
                :current-function-mode="routeFunctionMode"
                :current-optimization-mode="selectedOptimizationMode"
                @saved="handleSaveFavoriteComplete"
            />

            <!-- Variable management dialog -->
            <VariableManagerModal
                v-if="isReady"
                v-model:visible="showVariableManager"
                :variable-manager="variableManager"
                :focus-variable="focusVariableName"
            />

            <!-- 🆕 AI variable extraction result dialog -->
            <VariableExtractionResultDialog
                v-if="isReady"
                v-model:show="variableExtraction.showResultDialog.value"
                :result="variableExtraction.extractionResult.value"
                @confirm="variableExtraction.confirmBatchCreate"
            />

            <!-- Tool management dialog -->
            <ToolManagerModal
                v-if="isReady"
                v-model:visible="showToolManager"
                :tools="optimizationContextTools"
                @confirm="handleToolManagerConfirm"
                @cancel="showToolManager = false"
            />

            <!-- Context editor dialog -->
            <ContextEditor
                v-if="isReady"
                v-model:visible="showContextEditor"
                :state="contextEditorState"
                :services="servicesForContextEditor"
                :variable-manager="variableManager"
                :optimization-mode="selectedOptimizationMode"
                :scan-variables="
                    (content) =>
                        variableManager?.variableManager.value?.scanVariablesInContent(
                            content,
                        ) || []
                "
                :replace-variables="
                    (content, vars) =>
                        variableManager?.variableManager.value?.replaceVariables(
                            content,
                            vars,
                        ) || content
                "
                :isPredefinedVariable="
                    (name) =>
                        variableManager?.variableManager.value?.isPredefinedVariable(
                            name,
                        ) || false
                "
                :defaultTab="contextEditorDefaultTab"
                :only-show-tab="contextEditorOnlyShowTab"
                :title="contextEditorTitle"
                @update:state="handleContextEditorStateUpdateSafe"
                @save="handleContextEditorSaveSafe"
                @cancel="handleContextEditorCancel"
                @open-variable-manager="handleOpenVariableManager"
            />

            <!-- Prompt preview panel -->
            <PromptPreviewPanel
                v-if="isReady"
                :show="showPreviewPanel"
                @update:show="showPreviewPanel = $event"
                :previewContent="promptPreview.previewContent.value"
                :missingVariables="promptPreview.missingVariables.value"
                :hasMissingVariables="promptPreview.hasMissingVariables.value"
                :variableStats="promptPreview.variableStats.value"
                :contextMode="contextMode"
                :renderPhase="renderPhase"
            />

            <!-- Key: use NGlobalStyle to sync global styles to the body, eliminating the CSS dependency -->
            <NGlobalStyle />
        </template>
    </NConfigProvider>
</template>

<script setup lang="ts">
/**
 * PromptOptimizerApp - main application component
 *
 * @description
 * The core application logic extracted from App.vue, unifying the web and extension apps.
 * Contains all state management, composables, and event handling.
 */
import {
    ref,
    watch,
    watchEffect,
    provide,
    computed,
    shallowRef,
    onMounted,
    onBeforeUnmount,
    nextTick,
} from "vue";
import { RouterView } from "vue-router";
import { router as routerInstance } from '../../router';
import { registerOptionalIntegrations } from '../../integrations/registerOptionalIntegrations';
import { useI18n } from "vue-i18n";
import {
    NConfigProvider,
    NGlobalStyle,
} from "naive-ui";
import hljs from "highlight.js/lib/core";
import jsonLang from "highlight.js/lib/languages/json";
hljs.registerLanguage("json", jsonLang);

// Internal component imports
import MainLayoutUI from '../MainLayout.vue'
import ModelManagerUI from '../ModelManager.vue'
import TemplateManagerUI from '../TemplateManager.vue'
import HistoryDrawerUI from '../HistoryDrawer.vue'
import DataManagerUI from '../DataManager.vue'
import FavoriteManagerUI from '../FavoriteManager.vue'
import SaveFavoriteDialog from '../SaveFavoriteDialog.vue'
import VariableManagerModal from '../variable/VariableManagerModal.vue'
import { VariableExtractionResultDialog } from '../variable-extraction'
import ToolManagerModal from '../tool/ToolManagerModal.vue'
import ContextEditor from '../context-mode/ContextEditor.vue'
import PromptPreviewPanel from '../PromptPreviewPanel.vue'
import AppHeaderActions from './AppHeaderActions.vue'
import AppCoreNav from './AppCoreNav.vue'

// Composables - use barrel exports
import {
    // Prompt-related
    usePromptOptimizer,
    usePromptHistory,
    usePromptPreview,
    usePromptTester,
    // Model-related
    useModelManager,
    useModelSelectRefs,
    useFunctionModelManager,
    // Mode-related
    useFunctionMode,
    useBasicSubMode,
    useProSubMode,
    useImageSubMode,
    // Context-related
    useContextManagement,
    useContextEditorUIState,
    // Variable-related
    useVariableManager,
    useAggregatedVariables,
    useVariableExtraction,
    useTemporaryVariables,
    // UI-related
    useToast,
    useNaiveTheme,
     // System-related
     useAppInitializer,
     useTemplateManager,
     // App-level
     useAppHistoryRestore,
     useAppFavorite,
} from '../../composables'

// i18n functions
import { initializeI18nWithStorage, setI18nServices } from '../../plugins/i18n'

// Pinia functions
import { setPiniaServices, getPiniaServices } from '../../plugins/pinia'
// ⚠️ Codex suggestion: switch to direct path imports to avoid TDZ caused by circular barrel exports
import { useSessionManager, type SubModeKey } from '../../stores/session/useSessionManager'
import { useBasicSystemSession } from '../../stores/session/useBasicSystemSession'
import { useBasicUserSession } from '../../stores/session/useBasicUserSession'
import { useProMultiMessageSession } from '../../stores/session/useProMultiMessageSession'
import { useProVariableSession } from '../../stores/session/useProVariableSession'
import { useSessionRestoreCoordinator } from '../../composables/session/useSessionRestoreCoordinator'
import { useImageText2ImageSession } from '../../stores/session/useImageText2ImageSession'
import { useImageImage2ImageSession } from '../../stores/session/useImageImage2ImageSession'
import { useGlobalSettings } from '../../stores/settings/useGlobalSettings'

import type { TemplateManagerTemplateType } from '../../composables/prompt/useTemplateManager'

// Data Transformation
import { DataTransformer } from '../../utils/data-transformer'

// Types
import type { ModelSelectOption, TestAreaPanelInstance } from '../../types'
import { type IPromptService, type PromptRecordChain, type PatchOperation, type Template, type TemplateType, type FunctionMode, type BasicSubMode, type ProSubMode, type ImageSubMode, type OptimizationMode, type ConversationMessage, type ToolDefinition, type ContextEditorState, type ContextMode } from "@prompt-optimizer/core";

// 1. Base composables
const hljsInstance = hljs;
const i18n = useI18n();
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const t = i18n.t;  // Used in the template
const toast = useToast();

// ========= Chunk-load failure recovery =========
// A long-lived tab can keep running an old main bundle after a new deployment.
// Its dynamic-import chunk URLs (hashed) may no longer exist and get rewritten to index.html,
// which fails strict MIME checks and breaks route-based lazy loading.
// We prompt users to refresh (one-time) instead of auto-reloading.
const CHUNK_LOAD_REFRESH_GUARD_KEY = 'prompt-optimizer:chunk-load-refresh-prompted';

const getUnknownErrorMessage = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  return String(err);
};

const isChunkLoadFailure = (err: unknown): boolean => {
  const msg = getUnknownErrorMessage(err).toLowerCase();
  return (
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('chunkloaderror') ||
    msg.includes('loading chunk') ||
    msg.includes('strict mime type') ||
    msg.includes('expected a javascript-or-wasm module script')
  );
};

let removeRouterErrorHandler: (() => void) | null = null;

const promptRefreshForNewDeploy = async (reason: unknown) => {
  if (typeof window === 'undefined') return;

  try {
    if (window.sessionStorage.getItem(CHUNK_LOAD_REFRESH_GUARD_KEY)) {
      return;
    }
    window.sessionStorage.setItem(CHUNK_LOAD_REFRESH_GUARD_KEY, '1');

    const ok = window.confirm(t('toast.warning.chunkLoadRefreshConfirm'));
    if (!ok) {
      toast.warning(t('toast.warning.chunkLoadRefreshDeclined'), 8000);
      return;
    }

    try {
      await sessionManager.saveAllSessions();
    } catch (e) {
      console.warn('[PromptOptimizerApp] saveAllSessions failed before refresh:', e);
    }

    window.location.reload();
  } catch (e) {
    console.error('[PromptOptimizerApp] refresh prompt failed:', e, reason);
  }
};

const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
  if (!isChunkLoadFailure(event.reason)) return;
  void promptRefreshForNewDeploy(event.reason);
};

// 2. Initialize app services
const { services, isInitializing } = useAppInitializer();

// 3. Initialize function modes and sub-modes (must come before sessionManager)
//
// ⚠️ Important: these composables are only for one-time initialization (ensureInitialized) and must not be used as a state source!
// 🔧 Step E done: all mode/sub-mode reads now use route-computed values (routeFunctionMode/route*SubMode)
// 🔴 Prohibited:
//   - Never read the .value of functionMode/basicSubMode/proSubMode/imageSubMode in business logic
//   - Never use the set* methods of these composables (replaced by navigateToSubModeKey)
//   - Never register new watches based on these states (the route is the single source of truth)
// ✅ Allowed uses:
//   - Only call ensureInitialized in the services-ready watch for one-time initialization
//   - Make sure historical preferences in PreferenceService can be loaded (without affecting route-driven behavior)
//
// TODO (later refactor): split ensureInitialized into a pure initModePreferences() function and fully remove the dependency on these composables
// ⚠️ Note: calling these composables triggers initialization side effects, but the returned state must not be used as a state source for business logic
// 🔧 Fix: keep the composable return values to avoid repeated calls inside watch callbacks (which cause inject() errors)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const functionModeApi = useFunctionMode(services);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const basicSubModeApi = useBasicSubMode(services);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const proSubModeApi = useProSubMode(services);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const imageSubModeApi = useImageSubMode(services);

// 3.5. 🔧 Step A: establish the route-driven single source of truth (takes priority over state to avoid dual sources)
//
// ⚠️ Note: PromptOptimizerApp is not inside a RouterView context, so useRoute/useRouter cannot be used
// Solution: import the router instance directly and access the route state via currentRoute
// ⚠️ Important: computed only does pure parsing; correction logic is moved to a separate watch (to avoid circular navigation)
//
// Pure parsing function: extract the mode and sub-mode from the route path
const parseRouteInfo = () => {
  const currentRoute = routerInstance.currentRoute.value
  const path = currentRoute.path
  const subMode = path.split('/')[2]

  // Parse functionMode
  let functionMode: 'basic' | 'pro' | 'image' = 'basic'
  if (path.startsWith('/basic')) functionMode = 'basic'
  else if (path.startsWith('/pro')) functionMode = 'pro'
  else if (path.startsWith('/image')) functionMode = 'image'
  else if (path === '/' || path === '') functionMode = 'basic'  // Root path defaults

  // Parse the sub-mode (with whitelist validation)
  const parseSubMode = (
    mode: 'basic' | 'pro' | 'image',
    subModeParam: string | undefined
  ): { subMode: string; isValid: boolean; canonicalSubMode: string } => {
    const validSubModes: Record<string, string[]> = {
      basic: ['system', 'user'],
      pro: ['multi', 'variable'],  // ✅ pro mode supports multi and variable
      image: ['text2image', 'image2image'],
    }

    const allowed = validSubModes[mode] || []
    const isValid = subModeParam !== undefined && allowed.includes(subModeParam)

    // ✅ Removed the wrong compatibility mapping; use the original subMode directly
    let canonicalSubMode = subModeParam || ''

    // Default value (only used when subModeParam is empty or invalid)
    if (!canonicalSubMode || !isValid) {
      if (mode === 'image') canonicalSubMode = 'text2image'
      else if (mode === 'pro') canonicalSubMode = 'variable'
      else canonicalSubMode = 'system'
    }

    return { subMode: canonicalSubMode, isValid, canonicalSubMode }
  }

  const subModeInfo = parseSubMode(functionMode, subMode)

  return {
    functionMode,
    basicSubMode:
      (functionMode === 'basic' ? subModeInfo.canonicalSubMode : 'system') as 'system' | 'user',
    proSubMode:
      (functionMode === 'pro' ? subModeInfo.canonicalSubMode : 'variable') as 'multi' | 'variable',
    imageSubMode:
      (functionMode === 'image' ? subModeInfo.canonicalSubMode : 'text2image') as 'text2image' | 'image2image',
    isValid: subModeInfo.isValid,
    canonicalPath: `/${functionMode}/${subModeInfo.canonicalSubMode}`,
  }
}

// Route-computed (pure parsing, no side effects)
const routeFunctionMode = computed<FunctionMode>(() => parseRouteInfo().functionMode)
const routeBasicSubMode = computed<BasicSubMode>(() => parseRouteInfo().basicSubMode)
const routeProSubMode = computed<ProSubMode>(() => parseRouteInfo().proSubMode)
const routeImageSubMode = computed<ImageSubMode>(() => parseRouteInfo().imageSubMode)

// ========== GlobalSettings initialization gate (avoids rendering/correcting before restore) ==========
// Purpose: after PreferenceService is injected, restoreGlobalSettings first, then allow the UI to render / some watches to run
let _routeInitInFlight: Promise<void> | null = null
const routeInitialized = ref(false)  // 🔧 Marks route initialization as done, preventing premature rendering

// 🔧 Route correction watch: no longer responsible for redirecting (only used to parse/sync route info)
// - "Correction / compatibility redirects" for non-root paths are handled by the route guard (beforeRouteSwitch)
// - The initial workspace jump from the root path (/) is handled by RootBootstrapRoute
watch(
  () => routerInstance.currentRoute.value.path,
  (currentPath) => {
    // The root path (/) is handled by RootBootstrapRoute, which waits for globalSettings initialization before jumping; no correction here
    if (currentPath === '/' || currentPath === '') return

    // ✅ No correction before route initialization completes, to avoid interfering with initialization
    if (!routeInitialized.value) return

    parseRouteInfo()
  },
  { immediate: true }  // Check once immediately
)

// ========== Route ⇢ GlobalSettings (record only; does not drive the route in reverse) ==========
watch(
  () => routerInstance.currentRoute.value.path,
  () => {
    const globalSettings = useGlobalSettings()
    if (!globalSettings.hasRestored) return

    const routeInfo = parseRouteInfo()

    if (routeInfo.functionMode !== globalSettings.state.functionMode) {
      globalSettings.updateFunctionMode(routeInfo.functionMode)
    }

    // Sub-mode isolation: only update the subMode corresponding to the "current function mode"
    if (routeInfo.functionMode === 'basic' && routeInfo.basicSubMode !== globalSettings.state.basicSubMode) {
      globalSettings.updateBasicSubMode(routeInfo.basicSubMode)
    }
    if (routeInfo.functionMode === 'pro' && routeInfo.proSubMode !== globalSettings.state.proSubMode) {
      globalSettings.updateProSubMode(routeInfo.proSubMode)
    }
    if (routeInfo.functionMode === 'image' && routeInfo.imageSubMode !== globalSettings.state.imageSubMode) {
      globalSettings.updateImageSubMode(routeInfo.imageSubMode)
    }
  }
)

// 4. Initialize SessionManager (must come before the services watch)
const sessionManager = useSessionManager();

// 🔧 Step B: inject route-computed readers (replacing the old state, avoiding dual sources)
sessionManager.injectSubModeReaders({
  getFunctionMode: () => routeFunctionMode.value,
  getBasicSubMode: () => routeBasicSubMode.value,
  getProSubMode: () => routeProSubMode.value,
  getImageSubMode: () => routeImageSubMode.value,
});

// 5. Initialize i18n with storage when services are ready
watch(
    services,
        async (newServices) => {
            if (newServices) {
                setI18nServices(newServices);
                setPiniaServices(newServices);
                // Phase 1: restore the global settings store (global-settings/v1) and migrate from the old UI_SETTINGS_KEYS (if empty)
              // The initial workspace jump from the root path (/) is handled by RootBootstrapRoute:
              // - Wait for the globalSettings restore to complete
              // - Only redirect if still on /, to avoid overriding explicit navigation (E2E/user clicks)
              if (!_routeInitInFlight) {
                _routeInitInFlight = (async () => {
                  const globalSettings = useGlobalSettings()
                  await globalSettings.restoreGlobalSettings()

                  // Mark route initialization as done (allow the UI to render)
                  routeInitialized.value = true
                })()
              }
              await _routeInitInFlight
                await initializeI18nWithStorage();
            }
        },
    // 🔧 Must be immediate: in some runtime environments, services may already be ready before the watch is registered,
    // and if it doesn't fire, Pinia/Preferences are never injected, appearing as "everything is lost after refresh / nothing persists".
    { immediate: true },
);

// 6. Provide services to child components
provide("services", services);

// ✅ After app initialization, restore state from the session store to the UI
// Used to avoid "default values being written back" overwriting persisted content (selections lost after refresh)
const hasRestoredInitialState = ref(false);

// ✅ Flag for external data loading (prevents the automatic restore on mode switch from overwriting external data)
// Applies to any case where external data loading causes a mode switch: history restore, favorites loading, template import, etc.
const isLoadingExternalData = ref(false);

// 5. Flag controlling the main UI rendering
// 🔧 Must wait for route initialization to finish, to avoid briefly showing a blank page at the root path
const isReady = computed(
    () =>
        !!services.value &&
        !isInitializing.value &&
        routeInitialized.value &&
        hasRestoredInitialState.value,
);

// Create the services reference used by ContextEditor
const servicesForContextEditor = computed(() => services?.value || null);

// 6. Create all necessary references
const promptService = shallowRef<IPromptService | null>(null);
const showDataManager = ref(false);

type ContextWorkspaceExpose = {
    // Vue ComponentPublicInstance automatically unwraps the Refs in expose, so the unwrapped type is used here
    testAreaPanelRef?: TestAreaPanelInstance | null;
    restoreFromHistory?: (payload: unknown) => void;
    openIterateDialog?: (input?: string) => void;
    applyLocalPatch?: (operation: PatchOperation) => void;
    reEvaluateActive?: () => Promise<void>;
    restoreConversationOptimizationFromSession?: () => void; // 🔧 Codex fix: session restore method
};

const systemWorkspaceRef = ref<ContextWorkspaceExpose | null>(null);
type ContextUserWorkspaceExpose = ContextWorkspaceExpose & {
    // Provide a minimal usable API so the parent does not depend on the child's internal implementation details
    contextUserOptimization?: import("../../composables/prompt/useContextUserOptimization").UseContextUserOptimization;
    setPrompt?: (prompt: string) => void;
    getPrompt?: () => string;
    getOptimizedPrompt?: () => string;
    getTemporaryVariableNames?: () => string[];
};

const userWorkspaceRef = ref<ContextUserWorkspaceExpose | null>(null);
const basicModeWorkspaceRef = ref<{
    promptPanelRef?: {
        openIterateDialog?: (input?: string) => void;
        refreshIterateTemplateSelect?: () => void;
    } | null;
    openIterateDialog?: (input?: string) => void;
} | null>(null);

// 🔧 Step E: use route-computed instead of the old state
type WorkspaceRouteName = string | symbol | null | undefined;
const setWorkspaceRef = (instance: unknown, routeName: WorkspaceRouteName) => {
    const resolvedInstance = instance ?? null;

    switch (routeName) {
        case "basic-system":
        case "basic-user":
            basicModeWorkspaceRef.value =
                resolvedInstance as typeof basicModeWorkspaceRef.value;
            break;
        case "pro-multi":
            systemWorkspaceRef.value =
                resolvedInstance as typeof systemWorkspaceRef.value;
            break;
        case "pro-variable":
            userWorkspaceRef.value =
                resolvedInstance as typeof userWorkspaceRef.value;
            break;
    }
};

const selectedOptimizationMode = computed<OptimizationMode>(() => {
    if (routeFunctionMode.value === 'basic') return routeBasicSubMode.value;
    if (routeFunctionMode.value === 'pro') return routeProSubMode.value === 'multi' ? 'system' : 'user';
    return 'system';
});

// 🔧 Step D: advancedModeEnabled is now read-only (read from route-computed; writes are no longer supported)
const advancedModeEnabled = computed(() => routeFunctionMode.value === "pro");

// 🔧 Step D: dead code removed - handleModeSelect/handleBasicSubModeChange/handleProSubModeChange/handleImageSubModeChange
// These functions have been replaced by router.push navigation in AppCoreNav (2024-01-06)

// Test content state
const testContent = ref("");
const isCompareMode = ref(true);

// Naive UI theme config
const { naiveTheme, themeOverrides, initTheme } = useNaiveTheme();

// Initialize the theme system
if (typeof window !== "undefined") {
    initTheme();
}

// Variable management state
const showVariableManager = ref(false);
const focusVariableName = ref<string | undefined>(undefined);

// Tool management state
const showToolManager = ref(false);

// Context mode
const contextMode = ref<ContextMode>("system");

// Context editor state
const showContextEditor = ref(false);
const contextEditorDefaultTab = ref<"messages" | "variables" | "tools">("messages");

// Use a composable to manage the editor UI state
const {
    onlyShowTab: contextEditorOnlyShowTab,
    title: contextEditorTitle,
    handleCancel: handleContextEditorCancelBase,
} = useContextEditorUIState(showContextEditor, t);

type ContextEditorOwner = 'context-repo' | 'pro-multi'
const contextEditorOwner = ref<ContextEditorOwner>('context-repo')

watch(showContextEditor, (visible) => {
    if (!visible) {
        contextEditorOwner.value = 'context-repo'
    }
})

const handleContextEditorCancel = () => {
    contextEditorOwner.value = 'context-repo'
    handleContextEditorCancelBase()
}

const contextEditorState = ref<ContextEditorState>({
    messages: [],
    variables: {},
    tools: [],
    showVariablePreview: true,
    showToolManager: false,
    mode: 'edit',
});

// Prompt preview panel state
const showPreviewPanel = ref(false);

// Variable manager instance
const variableManager = useVariableManager(services);

// Temporary variable manager:
// - Pro/Image: persisted per sub-mode session store (survives refresh; isolated between sub-modes)
// - Basic: keeps the old behavior, in-memory only
const tempVarsManager = useTemporaryVariables();

// 🆕 AI smart variable extraction
const variableExtraction = useVariableExtraction(
    services,
    (variableName: string, variableValue: string) => {
        // Callback when variables are created: save to temporary variables (persisted in each session for Pro/Image; in-memory only for Basic)
        tempVarsManager.setVariable(variableName, variableValue);
    },
    (replacedPrompt: string) => {
        // Callback to replace the prompt: update the prompt content of the ContextUser workspace
        userWorkspaceRef.value?.setPrompt?.(replacedPrompt);
    }
);

// Use the aggregated variable manager
const aggregatedVariables = useAggregatedVariables(variableManager);
const promptPreviewContent = ref("");
const promptPreviewVariables = computed(() => {
    return aggregatedVariables.allVariables.value;
});

// Render stage (for preview)
const renderPhase = ref<"optimize" | "test">("optimize");

const promptPreview = usePromptPreview(
    promptPreviewContent,
    promptPreviewVariables,
    contextMode,
);

// Variable management handlers
const handleOpenVariableManager = (variableName?: string) => {
    if (variableName) {
        focusVariableName.value = variableName;
    }
    showVariableManager.value = true;
};

// 🆕 AI variable extraction handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const handleExtractVariables = async (
    promptContent: string,
    extractionModelKey: string
) => {
    const existingVariableNames = Object.keys(
        variableManager.customVariables.value || {}
    );

    await variableExtraction.extractVariables(
        promptContent,
        extractionModelKey,
        existingVariableNames
    );
};

// Tool manager handlers
const handleToolManagerConfirm = (tools?: ToolDefinition[]) => {
    optimizationContextTools.value = tools ?? [];
    showToolManager.value = false;
};

// 6. Call all composables at the top level
const modelSelectRefs = useModelSelectRefs();
const modelManager = useModelManager(services, modelSelectRefs);

// ========== Session Store (single source of truth: persistable fields) ==========
// Note: this must be initialized before the optimizer is created, so the Basic mode fields can be bound directly to the session store
const basicSystemSession = useBasicSystemSession();
const basicUserSession = useBasicUserSession();
const proMultiMessageSession = useProMultiMessageSession();
const proVariableSession = useProVariableSession();
const imageText2ImageSession = useImageText2ImageSession();
const imageImage2ImageSession = useImageImage2ImageSession();

// 🔧 Step E: use route-computed instead of the old state
const activeBasicSession = computed(() =>
    routeBasicSubMode.value === "system" ? basicSystemSession : basicUserSession,
);

// ========== Text Model Selection (single source of truth: Session Store) ==========
// Goal: remove the legacy "global model selection key" concept, avoiding dual sources and reverse-sync watches
const selectedOptimizeModelKey = computed<string>({
    get: () => {
        if (routeFunctionMode.value === "basic") {
            return activeBasicSession.value.selectedOptimizeModelKey || "";
        }
        if (routeFunctionMode.value === "pro") {
            const session =
                routeProSubMode.value === "multi"
                    ? proMultiMessageSession
                    : proVariableSession;
            return session.selectedOptimizeModelKey || "";
        }
        if (routeFunctionMode.value === "image") {
            const session =
                routeImageSubMode.value === "text2image"
                    ? imageText2ImageSession
                    : imageImage2ImageSession;
            return session.selectedTextModelKey || "";
        }
        return "";
    },
    set: (value) => {
        const next = value || "";
        if (routeFunctionMode.value === "basic") {
            activeBasicSession.value.updateOptimizeModel(next);
            return;
        }
        if (routeFunctionMode.value === "pro") {
            const session =
                routeProSubMode.value === "multi"
                    ? proMultiMessageSession
                    : proVariableSession;
            session.updateOptimizeModel(next);
            return;
        }
        if (routeFunctionMode.value === "image") {
            const session =
                routeImageSubMode.value === "text2image"
                    ? imageText2ImageSession
                    : imageImage2ImageSession;
            session.updateTextModel(next);
        }
    },
});

const selectedTestModelKey = computed<string>({
    get: () => {
        if (routeFunctionMode.value === "basic") {
            return activeBasicSession.value.selectedTestModelKey || "";
        }
        if (routeFunctionMode.value === "pro") {
            const session =
                routeProSubMode.value === "multi"
                    ? proMultiMessageSession
                    : proVariableSession;
            return session.selectedTestModelKey || "";
        }
        return "";
    },
    set: (value) => {
        const next = value || "";
        if (routeFunctionMode.value === "basic") {
            activeBasicSession.value.updateTestModel(next);
            return;
        }
        if (routeFunctionMode.value === "pro") {
            const session =
                routeProSubMode.value === "multi"
                    ? proMultiMessageSession
                    : proVariableSession;
            session.updateTestModel(next);
        }
    },
});

// Update the "global optimize model key" reference of functionModelManager (the singleton replaces the ref internally)
useFunctionModelManager(services, selectedOptimizeModelKey);

const patchActiveBasicOptimizedResult = (
    partial: Partial<{
        optimizedPrompt: string;
        reasoning: string;
        chainId: string;
        versionId: string;
    }>,
) => {
    const session = activeBasicSession.value;
    session.updateOptimizedResult({
        optimizedPrompt:
            partial.optimizedPrompt ?? session.optimizedPrompt ?? "",
        reasoning: partial.reasoning ?? session.reasoning ?? "",
        chainId: partial.chainId ?? session.chainId ?? "",
        versionId: partial.versionId ?? session.versionId ?? "",
    });
};

const basicSessionPrompt = computed<string>({
    get: () => activeBasicSession.value.prompt ?? "",
    set: (value) => activeBasicSession.value.updatePrompt(value || ""),
});

const basicSessionOptimizedPrompt = computed<string>({
    get: () => activeBasicSession.value.optimizedPrompt ?? "",
    set: (value) =>
        patchActiveBasicOptimizedResult({ optimizedPrompt: value || "" }),
});

const basicSessionOptimizedReasoning = computed<string>({
    get: () => activeBasicSession.value.reasoning ?? "",
    set: (value) => patchActiveBasicOptimizedResult({ reasoning: value || "" }),
});

const basicSessionChainId = computed<string>({
    get: () => activeBasicSession.value.chainId ?? "",
    set: (value) => patchActiveBasicOptimizedResult({ chainId: value || "" }),
});

const basicSessionVersionId = computed<string>({
    get: () => activeBasicSession.value.versionId ?? "",
    set: (value) => patchActiveBasicOptimizedResult({ versionId: value || "" }),
});

// Prompt optimizer
const optimizer = usePromptOptimizer(
    services,
    selectedOptimizationMode,
    selectedOptimizeModelKey,
    selectedTestModelKey,
    contextMode,
    {
        prompt: basicSessionPrompt,
        optimizedPrompt: basicSessionOptimizedPrompt,
        optimizedReasoning: basicSessionOptimizedReasoning,
        currentChainId: basicSessionChainId,
        currentVersionId: basicSessionVersionId,
    },
);

// Context management
const contextManagement = useContextManagement({
    services,
    advancedModeEnabled,
    showContextEditor,
    contextEditorDefaultTab,
    contextEditorState,
    variableManager,
    optimizer,
});

// Extract other state and methods from contextManagement
const optimizationContext = contextManagement.optimizationContext;
const optimizationContextTools = contextManagement.optimizationContextTools;
const initializeContextPersistence = contextManagement.initializeContextPersistence;
const persistContextUpdate = contextManagement.persistContextUpdate;
const handleContextEditorSave = contextManagement.handleContextEditorSave;
const handleContextEditorStateUpdate = contextManagement.handleContextEditorStateUpdate;

const handleContextEditorStateUpdateSafe = (state?: ContextEditorState) => {
    if (!state) return;
    if (contextEditorOwner.value === 'pro-multi') {
        // Pro-multi: keep edits local until user hits Save.
        contextEditorState.value = {
            ...contextEditorState.value,
            messages: [...(state.messages || [])],
            tools: [...(state.tools || [])],
        };
        return;
    }
    void handleContextEditorStateUpdate(state);
};

const handleContextEditorSaveSafe = (context?: {
    messages: ConversationMessage[];
    variables: Record<string, string>;
    tools: ToolDefinition[];
}) => {
    if (!context) return;

    if (contextEditorOwner.value === 'pro-multi') {
        const prevMessages = proMultiMessageSession.conversationMessagesSnapshot || []
        const prevIds = new Set(
            prevMessages
                .map((m) => m.id)
                .filter((id): id is string => typeof id === 'string' && id.length > 0),
        )
        const nextIds = new Set(
            (context.messages || [])
                .map((m) => m.id)
                .filter((id): id is string => typeof id === 'string' && id.length > 0),
        )

        // Remove chain mappings for deleted messages.
        for (const id of prevIds) {
            if (!nextIds.has(id)) {
                proMultiMessageSession.removeMessageChainMapping(id)
            }
        }

        proMultiMessageSession.updateConversationMessages([...(context.messages || [])])

        const selectedId = proMultiMessageSession.selectedMessageId
        if (selectedId && ![...(context.messages || [])].some((m) => m.id === selectedId)) {
            proMultiMessageSession.selectMessage('')
        }

        // Keep tools in the context repo (unchanged architecture for now).
        optimizationContextTools.value = [...(context.tools || [])]
        void persistContextUpdate({ tools: context.tools || [] })

        showContextEditor.value = false
        contextEditorOwner.value = 'context-repo'

        // Best-effort persist the pro-multi session after an explicit save.
        void proMultiMessageSession.saveSession()
        toast.success('Context updated')
        return
    }

    void handleContextEditorSave(context);
};
const handleContextModeChange = contextManagement.handleContextModeChange;

// Provide dependencies to child components
provide("variableManager", variableManager);
provide("optimizationContext", optimizationContext);
provide("optimizationContextTools", optimizationContextTools);

// Basic mode prompt testing
const promptTester = usePromptTester(
    services,
    selectedTestModelKey,
    selectedOptimizationMode,
    variableManager
);

// ========== Session Store state sync ==========

// 🔧 Step E: use route-computed instead of the old state
const getCurrentSession = () => {
    if (routeFunctionMode.value === 'basic') {
        return routeBasicSubMode.value === 'system' ? basicSystemSession : basicUserSession;
    } else if (routeFunctionMode.value === 'pro') {
        return routeProSubMode.value === 'multi' ? proMultiMessageSession : proVariableSession;
    } else if (routeFunctionMode.value === 'image') {
        return routeImageSubMode.value === 'text2image' ? imageText2ImageSession : imageImage2ImageSession;
    }
    return basicSystemSession;
};

const getCurrentBasicSession = () =>
    routeBasicSubMode.value === 'system' ? basicSystemSession : basicUserSession;

const getCurrentImageSession = () =>
    routeImageSubMode.value === 'text2image'
        ? imageText2ImageSession
        : imageImage2ImageSession;

/**
 * 🔧 Plan A fix: restore the session state of Basic mode (removing redundant assignments)
 *
 * Design principles:
 * - The core state of Basic mode (prompt/optimizedPrompt/reasoning/chainId/versionId)
 *   is already bound to the session store via computed (single source of truth), so no manual assignment is needed
 * - Only restore the unbound UI state (testContent/modelManager/isCompareMode/testResults)
 *
 * Root cause analysis:
 * - The old logic manually assigned fields such as optimizer.prompt, breaking the "single source of truth" architecture
 * - When switching modes, the old mode's UI state could pollute the new mode's session store through watches
 */
const restoreBasicOrProVariableSession = () => {
    if (routeFunctionMode.value !== 'basic') return;
    const session = getCurrentBasicSession();

    // ✅ Core state (prompt/optimizedPrompt/reasoning/chainId/versionId)
    // is already bound via computed such as basicSessionPrompt and read automatically from the session store, so no manual assignment is needed

    // ✅ Restore unbound UI state
    testContent.value = session.testContent || '';

    // Restore the compare mode
    isCompareMode.value = session.isCompareMode;

    // 🔧 Restore test results (only Basic mode uses promptTester)
    // Only restore stable fields; do not restore the transient isTesting* state
    if (session.testResults) {
        promptTester.testResults.originalResult =
            session.testResults.originalResult || '';
        promptTester.testResults.originalReasoning =
            session.testResults.originalReasoning || '';
        promptTester.testResults.optimizedResult =
            session.testResults.optimizedResult || '';
        promptTester.testResults.optimizedReasoning =
            session.testResults.optimizedReasoning || '';
        // Reset the testing state
        promptTester.testResults.isTestingOriginal = false;
        promptTester.testResults.isTestingOptimized = false;
    } else {
        // If the session has no test results, clear the current test results
        promptTester.testResults.originalResult = '';
        promptTester.testResults.originalReasoning = '';
        promptTester.testResults.optimizedResult = '';
        promptTester.testResults.optimizedReasoning = '';
        promptTester.testResults.isTestingOriginal = false;
        promptTester.testResults.isTestingOptimized = false;
    }
};

/**
 * 🔧 Plan A fix: Pro-user (variable mode) session restore (removing redundant assignments)
 *
 * Design principles:
 * - Pro-user uses the useContextUserOptimization state tree inside ContextUserWorkspace
 * - The core state (prompt/optimizedPrompt/reasoning/chainId/versionId)
 *   is already bound to proVariableSession via computed (single source of truth), so no manual assignment is needed
 * - Only restore the unbound UI state (testContent/isCompareMode) and reset the in-progress state
 *
 * Root cause analysis:
 * - The old logic manually assigned fields such as contextUserOptimization.prompt, breaking the "single source of truth" architecture
 * - When switching modes, the old mode's UI state could pollute the new mode's session store through watches
 */
const restoreProVariableSessionToUserWorkspace = async () => {
    // ✅ Core state (prompt/optimizedPrompt/reasoning/chainId/versionId)
    // is already bound to proVariableSession via computed such as sessionPrompt, so no manual assignment is needed

    // ✅ Restore unbound UI state
    testContent.value = proVariableSession.testContent || '';
    isCompareMode.value = proVariableSession.isCompareMode;

    // Wait for the DOM update to make sure ContextUserWorkspace is mounted and its ref is established
    await nextTick();

    let contextUserOptimization = userWorkspaceRef.value?.contextUserOptimization;
    if (!contextUserOptimization) {
        // Defensive retry: on some switching paths the ref may still not be established after the first nextTick
        await nextTick();
        contextUserOptimization = userWorkspaceRef.value?.contextUserOptimization;
        if (!contextUserOptimization) return;
    }

    // ✅ Only restore the unbound fields
    // currentVersions needs to be re-fetched from the history records
    contextUserOptimization.currentVersions = [];

    // Reset the in-progress state (avoids staying in loading after restore)
    contextUserOptimization.isOptimizing = false;
    contextUserOptimization.isIterating = false;

    // Try to restore the version list from the history records
    const historyManager = services.value?.historyManager;
    const chainId = proVariableSession.chainId || '';
    if (historyManager && chainId) {
        try {
            const chain = await historyManager.getChain(chainId);
            contextUserOptimization.currentVersions = chain.versions;
            // currentVersionId is already bound via binding, so no manual assignment is needed
        } catch (error) {
            console.warn('[PromptOptimizerApp] Pro-user chain restore failed, continuing with the session snapshot:', error);
        }
    }
};

/**
 * 🔧 Plan A fix: restore the session state of Pro-system mode (removing redundant assignments)
 *
 * Design principles:
 * - Pro-system mode uses the useConversationOptimization state tree (not the optimizer)
 * - The core state (optimizedPrompt/reasoning/chainId/versionId/selectedMessageId)
 *   is already bound to proMultiMessageSession via computed (single source of truth), so no manual assignment is needed
 * - Only restore the unbound UI state (modelManager/isCompareMode/optimizationContext)
 *
 * Root cause analysis:
 * - The old logic wrongly assigned to the optimizer, but Pro-system actually uses conversationOptimization
 * - This triggered the optimizer's watches and could pollute the session stores of other modes
 */
const restoreProMultiMessageSession = async () => {
    const session = proMultiMessageSession;
    const savedState = session.$state;

    // ✅ Core state (optimizedPrompt/reasoning/chainId/versionId/selectedMessageId)
    // is already bound to session.state via useConversationOptimization's computed, so no manual assignment is needed

    // ✅ Restore unbound UI state
    // Restore the compare mode
    isCompareMode.value = savedState.isCompareMode;

    // Pro Multi messages are session-owned. Ensure a default example exists when empty.
    if (!session.conversationMessagesSnapshot || session.conversationMessagesSnapshot.length === 0) {
        let seed = 0;
        const makeId = () => {
            const maybeCrypto = globalThis.crypto as unknown as { randomUUID?: () => string } | undefined;
            if (maybeCrypto && typeof maybeCrypto.randomUUID === 'function') {
                return maybeCrypto.randomUUID();
            }
            seed += 1;
            return `pro-multi-default-${Date.now()}-${seed}`;
        };

        const systemText = t('promptOptimizer.defaultOptimizationContext.proMulti.system');
        const userText = t('promptOptimizer.defaultOptimizationContext.proMulti.user');
        const defaultMessages: ConversationMessage[] = [
            {
                id: makeId(),
                role: 'system',
                content: systemText,
                originalContent: systemText,
            },
            {
                id: makeId(),
                role: 'user',
                content: userText,
                originalContent: userText,
            },
        ];
        session.updateConversationMessages(defaultMessages);
        // Keep initial selection empty (Playwright expects the empty-select UI).
        session.selectMessage('');
    }

    // 🔧 Codex fix: wait for the DOM update to make sure the child component ref is established
    await nextTick();

    // 🔧 Codex fix: explicitly restore the conversationOptimization state (selectedMessageId and messageChainMap)
    // Call it after the session restore has finished, to avoid timing issues
    // Call it via the child component ref (the child component already exposes this method in defineExpose)
    systemWorkspaceRef.value?.restoreConversationOptimizationFromSession?.();
};

/**
 * 🔧 Plan A fix: restore the session state of Image mode (removing all redundant assignments)
 *
 * Design principles:
 * - Image mode uses an independent Session Store (the optimizer is not involved at all)
 * - All state (originalPrompt/optimizedPrompt/reasoning/chainId/versionId/isCompareMode, etc.)
 *   is already bound to imageText2ImageSession/imageImage2ImageSession via computed (single source of truth)
 * - ImageWorkspace is a fully independent component whose state is managed by itself
 *
 * Root cause analysis:
 * - The old logic wrongly assigned to the optimizer, but Image mode does not use the optimizer at all
 * - This triggered the optimizer's watches and polluted the Basic mode session store (because getCurrentSession returns the new mode after switching)
 * - Even restoring isCompareMode is already synced automatically through ImageWorkspace's computed, so no manual assignment is needed
 *
 * Conclusion:
 * - All Image mode state is managed independently by ImageWorkspace, so this function does not need to do anything
 */
const restoreImageSession = () => {
    // ✅ All Image mode state is already bound to the session store via ImageWorkspace's computed
    // No manual restore is needed; the state is read automatically from the session store
};

/**
 * Restore state from the session store to the UI (internal implementation)
 * 🔧 Codex fix: call the matching restore function per mode/subMode, to avoid calling non-existent methods
 *
 * Note: this is the internal implementation and does not include mutual-exclusion control logic
 * Mutual-exclusion control is handled by useSessionRestoreCoordinator
 */
// 🔧 Step E: use route-computed instead of the old state
const restoreSessionToUIInternal = async () => {
    if (routeFunctionMode.value === 'basic') {
        // Basic mode: use the generic restore logic
        restoreBasicOrProVariableSession();
    } else if (routeFunctionMode.value === 'pro' && routeProSubMode.value === 'variable') {
        // Pro-variable (variable mode): restore to ContextUserWorkspace
        await restoreProVariableSessionToUserWorkspace();
    } else if (routeFunctionMode.value === 'pro' && routeProSubMode.value === 'multi') {
        // Pro-multi (multi-message mode): use the dedicated restore logic (async, waits for the DOM update)
        await restoreProMultiMessageSession();
    } else if (routeFunctionMode.value === 'image') {
        // Image mode: use the dedicated restore logic
        restoreImageSession();
    }
};

// 🔧 Architecture optimization: use the session restore coordinator
// Responsible for coordination logic such as mutex locks, pending retries, and unmount checks
const restoreCoordinator = useSessionRestoreCoordinator(restoreSessionToUIInternal);

// Restore function exposed externally (with coordination logic)
const restoreSessionToUI = restoreCoordinator.executeRestore;

// 🔧 Codex fix: the watch is only responsible for restoring after a mode switch (not the first restore)
// The first restore is handled by the onMounted watchEffect, to avoid conflicts between two entry points
// 🔧 Step E: use route-computed instead of the old state
watch(
    [isReady, () => routeFunctionMode.value, () => routeBasicSubMode.value, () => routeProSubMode.value],
    async ([ready]) => {
        // 🔧 Only respond to mode switches after the first restore has completed
        if (!ready || !hasRestoredInitialState.value) return;

        // 🔧 Do not respond to mode switches while external data is loading (prevents the session restore from overwriting external data)
        if (isLoadingExternalData.value) return;

        try {
            await restoreSessionToUI();
        } catch (error) {
            // 🔧 Error handling: avoid unhandled Promise rejections propagating into Vue
            console.error('[PromptOptimizerApp] Failed to restore the session after a mode switch:', error);
        }
    },
    { immediate: false }  // 🔧 Changed to false: do not execute immediately when the watch is created
);

// Sync prompt changes to the session store
// 🔧 Plan A fix: strictly limited to Basic mode to avoid cross-mode pollution
// Root cause: optimizer.prompt is already bound to the session store via computed (single source of truth)
// - Basic mode: optimizer.prompt ↔ basicSessionPrompt ↔ session.prompt
// - Pro/Image mode: optimizer.prompt is not used, but the watch still fires and writes incorrectly
watch(
    () => optimizer.prompt,
    (newPrompt) => {
        if (sessionManager.isSwitching) return;

        // ⚠️ Strictly limited to Basic mode
        // - Pro mode: has no prompt field
        // - Image mode: uses independent ImageWorkspace state and does not involve the optimizer
        if (routeFunctionMode.value !== 'basic') {
            return;
        }

        // ✅ Only Basic mode syncs to the session
        getCurrentBasicSession().updatePrompt(newPrompt || '');
    }
);

// Sync optimization results to the session store (including optimizedPrompt, reasoning, chainId, versionId)
// ⚠️ Codex requirement: remove the truthy check to support syncing cleared state
watch(
    [
        () => optimizer.optimizedPrompt,
        () => optimizer.optimizedReasoning,
        () => optimizer.currentChainId,
        () => optimizer.currentVersionId,
    ],
    ([newOptimizedPrompt, newReasoning, newChainId, newVersionId]) => {
        // 🔧 The persistable fields of Basic/Image mode are bound directly to the corresponding session store,
        // avoiding duplicate sync (especially streaming tokens, which would cause double writes).
        if (routeFunctionMode.value === 'basic') return;
        if (routeFunctionMode.value === 'image') return;

        // The Pro-user optimization results are managed inside ContextUserWorkspace; avoid overwriting the session with the optimizer
        if (routeFunctionMode.value === 'pro' && routeProSubMode.value === 'variable') {
            return;
        }

        // 🔧 The Pro-system optimization results are written directly to the session store by useConversationOptimization,
        // avoiding overwriting with unrelated optimizer state (which easily writes empty values after a refresh).
        if (routeFunctionMode.value === 'pro' && routeProSubMode.value === 'multi') {
            return;
        }

        const session = getCurrentSession();
        if (session && !sessionManager.isSwitching) {
            session.updateOptimizedResult({
                optimizedPrompt: newOptimizedPrompt || '',
                reasoning: newReasoning || '',
                chainId: newChainId || '',
                versionId: newVersionId || '',
            });
        }
    }
);

// Sync test results to the session store
// 🔧 Codex fix: Image mode has no updateTestResults method, so branch handling is needed
// 🔧 Use deep: true to capture deep changes (such as originalResult += token)
// 🔧 Filter out the transient isTesting* state and persist only stable fields
// 🔧 Fix: removed the early same-value check and let the session store handle it itself (avoiding skipping empty objects at initialization)
watch(
    () => promptTester.testResults,
    (newTestResults) => {
        if (sessionManager.isSwitching) return;

        // Only Basic mode uses promptTester (other modes have their own testers/workspaces)
        if (routeFunctionMode.value !== 'basic') return;

        // Only save stable fields, not the transient isTesting* state
        const stableResults = newTestResults
            ? {
                  originalResult: newTestResults.originalResult || '',
                  originalReasoning: newTestResults.originalReasoning || '',
                  optimizedResult: newTestResults.optimizedResult || '',
                  optimizedReasoning: newTestResults.optimizedReasoning || '',
              }
            : null;
        // 🔧 Call directly and let the session store's updateTestResults method handle the same-value check itself
        getCurrentBasicSession().updateTestResults(stableResults);
    },
    { deep: true }  // 🔧 Enable deep watching to capture deep changes such as streaming writes
);

/*
// Sync the optimize model selection to the session store (deprecated: the Session Store is the single source of truth for model selection)
// 🔧 Codex fix: Image mode uses updateTextModel, Basic mode uses updateOptimizeModel
// 🔧 Cleanup: the model selection of Pro mode is already managed directly by each workspace/controller and is not written here
watch(
    () => modelManager.selectedOptimizeModel,
    (newModel) => {
        if (sessionManager.isSwitching) return;

        // 🔧 The model selection of Pro mode is already persisted to the session store by the workspace/controller
        // Avoid writing here, which would cause double writes or pollution
        if (routeFunctionMode.value === 'pro') return;

        const session = getCurrentSession();
        if (!session) return;

        // Image mode uses updateTextModel
        if (routeFunctionMode.value === 'image') {
            // Avoid the model selection overwriting the image session during initialization / a brief empty value (which would make the dropdown show "Not selected")
            if (!modelManager.isModelSelectionReady || !newModel) {
                return;
            }
            if (typeof (session as { updateTextModel?: unknown }).updateTextModel === 'function') {
                (session as { updateTextModel: (model: string) => void }).updateTextModel(newModel || '');
            }
        } else {
            // Basic mode uses updateOptimizeModel
            if (typeof (session as { updateOptimizeModel?: unknown }).updateOptimizeModel === 'function') {
                (session as { updateOptimizeModel: (model: string) => void }).updateOptimizeModel(newModel || '');
            }
        }
    }
);

// Sync the test model selection to the session store
// 🔧 Codex fix: Image mode has no corresponding testModel field, so skip the sync
// 🔧 Cleanup: the test model selection of Pro mode is already managed directly by each workspace/controller
watch(
    () => modelManager.selectedTestModel,
    (newModel) => {
        if (sessionManager.isSwitching) return;

        // 🔧 The test model selection of Pro mode is already persisted to the session store by the workspace/controller
        // Image mode does not use the testModel field
        if (routeFunctionMode.value === 'image') return;
        if (routeFunctionMode.value === 'pro') return;

        const session = getCurrentSession();
        if (session && typeof (session as { updateTestModel?: unknown }).updateTestModel === 'function') {
            (session as { updateTestModel: (model: string) => void }).updateTestModel(newModel || '');
        }
    }
);

*/
// Currently selected template (mapped to the corresponding optimizer field based on system/user mode)
// Note: this must be declared before any watch/computed references it, to avoid TDZ.
// (Selection has moved down into each workspace; currentSelectedTemplate is no longer maintained here)
const currentSelectedTemplate = computed<Template | null>({
    get: () =>
        selectedOptimizationMode.value === "system"
            ? optimizer.selectedOptimizeTemplate
            : optimizer.selectedUserOptimizeTemplate,
    set: (value) => {
        if (selectedOptimizationMode.value === "system") {
            optimizer.selectedOptimizeTemplate = value;
        } else {
            optimizer.selectedUserOptimizeTemplate = value;
        }
    },
});

// Sync the template selection to the session store
// 🔧 Plan A fix: Image mode does not use the optimizer's templates and must be excluded
// 🔧 Cleanup: the template selection of Pro mode is already managed directly by each workspace/controller
watch(
    currentSelectedTemplate,
    (newTemplate) => {
        if (sessionManager.isSwitching) return;
        if (!hasRestoredInitialState.value) return;

        // ⚠️ Image mode uses independent session template management
        // 🔧 The template selection of Pro mode is already persisted to the session store by the workspace/controller
        if (routeFunctionMode.value === 'image') return;
        if (routeFunctionMode.value === 'pro') return;

        getCurrentBasicSession().updateTemplate(newTemplate?.id || null);
    }
);

// Sync the iterate template selection to the session store
// 🔧 Cleanup: only Basic mode uses optimizer.selectedIterateTemplate
// 🔧 The iterate template selection of Pro mode is already managed directly by the workspace/controller
watch(
    () => optimizer.selectedIterateTemplate,
    (newTemplate) => {
        if (sessionManager.isSwitching) return;
        if (!hasRestoredInitialState.value) return;

        // ⚠️ Only Basic mode uses this iterate template
        // - Pro-system: has no updateIterateTemplate method
        // - Pro-user: already persisted by the workspace/controller
        // - Image: uses independent template management
        if (routeFunctionMode.value === 'image') return;
        if (routeFunctionMode.value === 'pro') return;

        getCurrentBasicSession().updateIterateTemplate(newTemplate?.id || null);
    }
);

// Sync the test content to the session store (to keep the test input after a refresh/switch)
// 🔧 Cleanup: the test content of Pro mode is already managed inside the workspace
watch(
    testContent,
    (newContent) => {
        if (sessionManager.isSwitching) return;
        if (!hasRestoredInitialState.value) return;

        // 🔧 Only Basic mode uses this testContent
        // Image mode has no testContent; Pro mode is already managed inside the workspace
        if (routeFunctionMode.value === 'image') return;
        if (routeFunctionMode.value === 'pro') return;

        getCurrentBasicSession().updateTestContent(newContent || '');
    },
    { flush: 'sync' }
);

// Sync the compare mode to the session store
// 🔧 Cleanup: the compare mode of Pro mode is already managed directly by the workspace/controller
watch(
    isCompareMode,
    (newMode) => {
        // 🔧 The compare mode of Pro mode is already persisted to the session store by the workspace/controller
        if (routeFunctionMode.value === 'pro') return;

        if (routeFunctionMode.value === 'basic') {
            getCurrentBasicSession().toggleCompareMode(newMode);
            return;
        }
        if (routeFunctionMode.value === 'image') {
            getCurrentImageSession().toggleCompareMode(newMode);
        }
    }
);

// ========== Pro multi-message mode-specific state sync ==========
// 🔧 Cleaned up: optimizationContext is now managed directly by ProWorkspaceContainer
// Avoid writing at the App layer, which would cause double writes or pollution (easily writing empty values after a refresh)

// Sync the contextMode in contextManagement to the App layer (does not drive the route)
watch(
    contextManagement.contextMode,
    async (newMode) => {
        contextMode.value = newMode;
    },
    { immediate: true },
);

// In Pro mode: take the route as the source of truth and sync the contextMode of services/contextManagement
// Purpose: avoid the "persisted/default contextMode" overriding the explicit route in reverse (E2E goes directly to /#/pro/variable)
watch(
    [services, () => routeFunctionMode.value, () => routeProSubMode.value],
    async ([newServices, functionMode, proSubMode]) => {
        if (!newServices) return;
        if (functionMode !== "pro") return;

        const desiredContextMode = proSubMode === "multi" ? "system" : "user";
        if (contextManagement.contextMode.value !== desiredContextMode) {
            await handleContextModeChange(desiredContextMode);
        }
    },
    { immediate: true },
);

const optimizerCurrentVersions = computed<PromptRecordChain["versions"]>({
    get: () => optimizer.currentVersions || [],
    set: (value) => {
        optimizer.currentVersions = value;
    },
});

// Prompt history
const promptHistory = usePromptHistory(
    services,
    basicSessionPrompt,
    basicSessionOptimizedPrompt,
    basicSessionChainId,
    optimizerCurrentVersions,
    basicSessionVersionId,
);

provide("promptHistory", promptHistory);

const historyManager = promptHistory;

const servicesForHistoryRestore = computed(() =>
    services.value ? { historyManager: services.value.historyManager } : null,
);

const SUB_MODE_KEYS: ReadonlyArray<SubModeKey> = [
    "basic-system",
    "basic-user",
    "pro-multi",
    "pro-variable",
    "image-text2image",
    "image-image2image",
];

const navigateToSubModeKeyCompat = (
    toKey: string,
    opts?: { replace?: boolean },
) => {
    if (!SUB_MODE_KEYS.includes(toKey as SubModeKey)) return;
    navigateToSubModeKey(toKey as SubModeKey, opts);
};

const optimizerPrompt = computed<string>({
    get: () => (typeof optimizer.prompt === "string" ? optimizer.prompt : ""),
    set: (value) => {
        optimizer.prompt = value;
    },
});

// App-level history restore
const { handleHistoryReuse } = useAppHistoryRestore({
    services: servicesForHistoryRestore,
    navigateToSubModeKey: navigateToSubModeKeyCompat,  // 🔧 Step D: replaces the old setFunctionMode/set*SubMode
    handleContextModeChange,
    handleSelectHistory: promptHistory.handleSelectHistory,
    proMultiMessageSession,
    systemWorkspaceRef,
    userWorkspaceRef,
    t,
    isLoadingExternalData,
});

// App-level favorites management
const {
    showFavoriteManager,
    showSaveFavoriteDialog,
    saveFavoriteData,
    handleSaveFavorite,
    handleSaveFavoriteComplete,
    handleFavoriteOptimizePrompt,
    handleUseFavorite,
} = useAppFavorite({
    navigateToSubModeKey: navigateToSubModeKeyCompat,  // 🔧 Step D: replaces the old setFunctionMode/set*SubMode
    handleContextModeChange,
    optimizerPrompt,
    t,
    isLoadingExternalData,
});

// Optional integrations (feature-flagged + lazy-loaded).
void registerOptionalIntegrations({
    router: routerInstance,
    hasRestoredInitialState,
    isLoadingExternalData,
    optimizationContext,
    basicSystemSession,
    basicUserSession,
    proMultiMessageSession,
    proVariableSession,
    imageText2ImageSession,
    imageImage2ImageSession,
    getFavoriteManager: () => services.value?.favoriteManager || null,
    getFavoriteImageStorageService:
      () => services.value?.favoriteImageStorageService || services.value?.imageStorageService || null,
    openSaveFavoriteDialog: (data) => handleSaveFavorite(data),
    optimizerCurrentVersions,
});
provide("handleSaveFavorite", handleSaveFavorite);

// Template manager
const templateManagerState = useTemplateManager(services);

// TemplateManager selection callback: writes to the Session Store (single source of truth), avoiding writes to the old TEMPLATE_SELECTION_KEYS
const handleTemplateSelected = (
    template: Template | null,
    type: Template["metadata"]["templateType"],
    category?: string,
) => {
    const session = getCurrentSession();
    if (!session && !category) return;

    const sessionByCategory = (() => {
        switch (category) {
            case "system-optimize":
            case "basic-system-iterate":
                return basicSystemSession;
            case "user-optimize":
            case "basic-user-iterate":
                return basicUserSession;
            case "context-system-optimize":
                return proMultiMessageSession;
            case "context-user-optimize":
                return proVariableSession;
            case "context-iterate":
                return routeProSubMode.value === "multi"
                    ? proMultiMessageSession
                    : proVariableSession;
            case "image-text2image-optimize":
                return imageText2ImageSession;
            case "image-image2image-optimize":
                return imageImage2ImageSession;
            case "image-iterate":
                return routeImageSubMode.value === "image2image"
                    ? imageImage2ImageSession
                    : imageText2ImageSession;
            default:
                return null;
        }
    })();

    const targetSession = sessionByCategory || session;
    if (!targetSession) return;

    const templateSession = targetSession as unknown as {
        updateTemplate?: (templateId: string | null) => void;
        updateIterateTemplate?: (templateId: string | null) => void;
    };

    const templateType = String(type || "");
    const isIterate =
        templateType === "iterate" ||
        templateType === "contextIterate" ||
        templateType === "imageIterate";

    const templateId = template?.id || null;

    if (isIterate && typeof templateSession.updateIterateTemplate === "function") {
        templateSession.updateIterateTemplate(templateId);
        return;
    }
    if (typeof templateSession.updateTemplate === "function") {
        templateSession.updateTemplate(templateId);
    }
};
const textModelOptions = ref<ModelSelectOption[]>([]);

const refreshTextModels = async () => {
    if (!services.value?.modelManager) {
        textModelOptions.value = [];
        return;
    }

    try {
        const manager = services.value.modelManager;
        const m = manager as unknown as { ensureInitialized?: () => Promise<void> };
        if (typeof m.ensureInitialized === 'function') {
            await m.ensureInitialized();
        }
        const enabledModels = await manager.getEnabledModels();
        textModelOptions.value = DataTransformer.modelsToSelectOptions(enabledModels);

        const availableKeys = new Set(textModelOptions.value.map((opt) => opt.value));
        const fallbackValue = textModelOptions.value[0]?.value || "";
        const selectionReady = modelManager.isModelSelectionReady;

        if (fallbackValue && selectionReady && hasRestoredInitialState.value) {
            if (selectedOptimizeModelKey.value && !availableKeys.has(selectedOptimizeModelKey.value)) {
                selectedOptimizeModelKey.value = fallbackValue;
            }
            if (selectedTestModelKey.value && !availableKeys.has(selectedTestModelKey.value)) {
                selectedTestModelKey.value = fallbackValue;
            }
            if (!selectedOptimizeModelKey.value) {
                selectedOptimizeModelKey.value = fallbackValue;
            }
            // Image mode does not use testModel; the setter ignores it
            if (!selectedTestModelKey.value) {
                selectedTestModelKey.value = fallbackValue;
            }
        }
    } catch (error) {
        console.warn("[PromptOptimizerApp] Failed to refresh text models:", error);
        textModelOptions.value = [];
    }
};

watch(
    () => services.value?.modelManager,
    async (manager) => {
        if (manager) {
            await refreshTextModels();
        } else {
            textModelOptions.value = [];
        }
    },
    { immediate: true },
);

// 7. Watch service initialization
watch(services, async (newServices) => {
    if (!newServices) return;

    promptService.value = newServices.promptService;
    await initializeContextPersistence();

    // Wait for the initial route initialization based on globalSettings to finish (avoids reading a wrong routeFunctionMode at the root path)
    if (_routeInitInFlight) {
        await _routeInitInFlight;
    }

    // 🔧 Fix: use the composable reference saved at the top level of setup, to avoid repeated calls inside watch callbacks (which cause inject() errors)
    if (routeFunctionMode.value === "basic") {
        await basicSubModeApi.ensureInitialized();
    } else if (routeFunctionMode.value === "pro") {
        await proSubModeApi.ensureInitialized();
        await handleContextModeChange(
            routeProSubMode.value === 'multi' ? 'system' : 'user',
        );
    } else if (routeFunctionMode.value === "image") {
        await imageSubModeApi.ensureInitialized();
    }

    const handleGlobalHistoryRefresh = () => {
        promptHistory.initHistory();
    };
    window.addEventListener(
        "prompt-optimizer:history-refresh",
        handleGlobalHistoryRefresh,
    );
});

// 8. Handle the refresh after a successful data import
const handleDataImported = () => {
    useToast().success(t("dataManager.import.successWithRefresh"));
    setTimeout(() => {
        window.location.reload();
    }, 1500);
};

// Watch the variable manager closing
watch(showVariableManager, (newValue) => {
    if (!newValue) {
        focusVariableName.value = undefined;
    }
});

// Watch advanced mode and optimization mode changes
watch(
    [advancedModeEnabled, selectedOptimizationMode],
    ([newAdvancedMode, newOptimizationMode]) => {
        if (newAdvancedMode) {
            if (
                !optimizationContext.value ||
                optimizationContext.value.length === 0
            ) {
                // Note: Pro Multi messages are now session-owned; avoid writing defaults into optimizationContext.
                if (newOptimizationMode === "user") {
                    optimizationContext.value = [
                        { role: "user", content: "{{currentPrompt}}" },
                    ];
                }
            }
        }
    },
    { immediate: false },
);

// Open the GitHub repository
const openGithubRepo = async () => {
    const url = "https://github.com/linshenkx/prompt-optimizer";

    if (typeof window !== "undefined" && window.electronAPI?.shell) {
        try {
            await window.electronAPI.shell.openExternal(url);
        } catch (error) {
            console.error("Failed to open external URL in Electron:", error);
            window.open(url, "_blank");
        }
    } else {
        window.open(url, "_blank");
    }
};

const normalizeTemplateTypeForManager = (
    templateType: TemplateType | undefined,
): TemplateManagerTemplateType => {
    if (!templateType) {
        return selectedOptimizationMode.value === "system"
            ? "optimize"
            : "userOptimize";
    }

    // Compatible with legacy values: contextSystemOptimize -> conversationMessageOptimize (context system/message optimization)
    if (templateType === "contextSystemOptimize") {
        return "conversationMessageOptimize";
    }

    const templateManagerSupportedTypes: readonly TemplateManagerTemplateType[] = [
        "optimize",
        "userOptimize",
        "iterate",
        "text2imageOptimize",
        "image2imageOptimize",
        "imageIterate",
        "conversationMessageOptimize",
        "contextUserOptimize",
        "contextIterate",
    ];

    const isTemplateManagerTemplateType = (
        type: TemplateType,
    ): type is TemplateManagerTemplateType => {
        return (templateManagerSupportedTypes as readonly string[]).includes(type);
    };

    if (isTemplateManagerTemplateType(templateType)) return templateType;

    // Types explicitly unsupported by TemplateManager (such as evaluation) must not silently fall back.
    // Throw directly, to avoid opening the wrong template set and masking the problem.
    throw new Error(
        `[PromptOptimizerApp] Unsupported template type for TemplateManager: ${templateType}`,
    );
};

// Open the template manager
const openTemplateManager = (templateType?: TemplateType) => {
    templateManagerState.currentType = normalizeTemplateTypeForManager(templateType);
    templateManagerState.showTemplates = true;
};

// 🔧 Step D: dead code removed - handleBasicSubModeChange/handleProSubModeChange/handleImageSubModeChange
// These functions have been replaced by router.push navigation in AppCoreNav (2024-01-06)

// Provide a unified openTemplateManager interface to child components
provide("openTemplateManager", openTemplateManager);

// Template manager close callback
const handleTemplateManagerClosed = () => {
    try {
        templateManagerState.handleTemplateManagerClose();
    } catch (e) {
        console.warn("[PromptOptimizerApp] Failed to run template manager close handler:", e);
    }
    if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("basic-workspace-refresh-templates"));
        window.dispatchEvent(new Event("image-workspace-refresh-templates"));
    }
};

// Provide the openModelManager interface
const openModelManager = (tab: "text" | "image" | "function" = "text") => {
    modelManager.showConfig = true;
    setTimeout(() => {
        if (typeof window !== "undefined") {
            window.dispatchEvent(
                new CustomEvent("model-manager:set-tab", { detail: tab }),
            );
        }
    }, 0);
};
provide("openModelManager", openModelManager);

// Provide the openContextEditor interface (for workspaces such as Pro Multi to call directly)
type ContextEditorOpenArg = ConversationMessage[] | "messages" | "variables" | "tools";
const openContextEditor = (
    messagesOrTab?: ContextEditorOpenArg,
    variables?: Record<string, string>,
) => {
    // Pro-multi: ContextEditor edits the session-owned conversation messages.
    if (routeFunctionMode.value === 'pro' && routeProSubMode.value === 'multi') {
        contextEditorOwner.value = 'pro-multi'

        let messages: ConversationMessage[] | undefined
        let defaultTab: 'messages' | 'variables' | 'tools' = 'messages'
        if (typeof messagesOrTab === 'string') {
            defaultTab = messagesOrTab
            messages = undefined
        } else {
            messages = messagesOrTab
        }

        contextEditorDefaultTab.value = defaultTab
        void variableManager?.refresh?.()

        contextEditorState.value = {
            messages: messages || [...(proMultiMessageSession.conversationMessagesSnapshot || [])],
            variables: {},
            tools: [...(optimizationContextTools.value || [])],
            showVariablePreview: false,
            showToolManager: contextMode.value === 'user',
            mode: 'edit',
        }
        showContextEditor.value = true
        return
    }

    contextEditorOwner.value = 'context-repo'
    void contextManagement.handleOpenContextEditor(messagesOrTab, variables);
};
provide("openContextEditor", openContextEditor);

// Model manager close callback
const handleModelManagerClosed = async () => {
    try {
        modelManager.handleModelManagerClose();
    } catch (e) {
        console.warn("[PromptOptimizerApp] Failed to refresh text models after manager close:", e);
    }
    await refreshTextModels();
    if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("basic-workspace-refresh-text-models"));
        window.dispatchEvent(new Event("image-workspace-refresh-text-models"));
        window.dispatchEvent(new Event("image-workspace-refresh-image-models"));
    }
};

// ========== Session Management ==========
/**
 * 🔧 Development rules (to prevent regressions):
 *
 * Any newly added watch or entry that triggers switchMode / switchSubMode / restoreSessionToUI
 * **must** add the following check, to prevent the session restore from overwriting external data:
 *
 *   if (isLoadingExternalData.value) return;
 *
 * Applies to any external data loading: history restore, favorites loading, template import, config restore, etc.
 *
 * The 5 entries currently protected:
 *   1. watch(functionMode, ...)              - function mode switch
 *   2. watch(basicSubMode, ...)              - Basic sub-mode switch
 *   3. watch(proSubMode, ...)                - Pro sub-mode switch
 *   4. watch(imageSubMode, ...)              - Image sub-mode switch
 *   5. watch([isReady, ...modes], ...)       - combined mode watch
 */

// ========== 🔧 Step C: route-driven mode switching (replaces the old state-watch) ==========
/**
 * Parse a SubModeKey from the route path (using the same strict parsing logic as route-computed)
 *
 * @param path - Route path, such as '/basic/system', '/pro/variable', '/image/text2image'
 * @returns SubModeKey, such as 'basic-system', 'pro-variable', 'image-text2image'
 * @returns null - if the path is invalid
 */
const parseSubModeKey = (path: string): SubModeKey | null => {
  if (!path) return null;

  // Remove the query parameters and hash
  const cleanPath = path.split('?')[0].split('#')[0];

  // Match the pattern: /mode/subMode
  const match = cleanPath.match(/^\/([a-z]+)\/([a-z0-9]+)$/);
  if (!match) return null;

  const [, mode, subMode] = match;

  // Strictly validate the legality of mode and subMode
  const validModes: Record<string, string[]> = {
    basic: ['system', 'user'],
    pro: ['multi', 'variable'],
    image: ['text2image', 'image2image'],
  };

  // 🔧 Pro mode compatibility mapping (kept consistent with the routeProSubMode computed)
  let normalizedSubMode = subMode;
  if (mode === 'pro') {
    if (subMode === 'system') normalizedSubMode = 'multi';
    if (subMode === 'user') normalizedSubMode = 'variable';
  }

  const validSubModes = validModes[mode];
  if (!validSubModes || !validSubModes.includes(normalizedSubMode)) {
    return null;
  }

  return `${mode}-${normalizedSubMode}` as SubModeKey;
};

/**
 * 🔧 Step C - new: route change watch (replaces the old state-watch, avoiding double triggering)
 *
 * Main flow: route change → sessionManager.switchMode/switchSubMode → restoreSessionToUI
 *
 * Design principles:
 * - A route change is the only entry that triggers a mode-switch transaction
 * - Use route-computed to parse fromKey/toKey (consistent with Step A)
 * - Keep the short-circuit logic of isLoadingExternalData and hasRestoredInitialState
 * - Coexists with the old state-watch but makes the old one short-circuit, for easy verification and rollback
 */
watch(
  () => routerInstance.currentRoute.value.fullPath,
  async (toPath, fromPath) => {
    // 🔧 Do not respond to route changes before the first restore completes
    if (!hasRestoredInitialState.value) return;

    // 🔧 Do not respond to route changes while external data is loading (prevents the session restore from overwriting external data)
    if (isLoadingExternalData.value) return;

    // Parse fromKey and toKey (using the same strict parsing logic as route-computed)
    const fromKey = parseSubModeKey(fromPath);
    const toKey = parseSubModeKey(toPath);

    // Invalid path: do not trigger a switch (handled by the redirect of route-computed)
    if (!fromKey || !toKey) return;

    // Route unchanged: do not trigger a switch
    if (fromKey === toKey) return;

    // 🔧 Determine whether this is a cross-mode switch or a same-mode sub-mode switch
    const fromMode = fromKey.split('-')[0];
    const toMode = toKey.split('-')[0];

    try {
      if (fromMode !== toMode) {
        // Cross-mode switch
        await sessionManager.switchMode(fromKey, toKey);
      } else {
        // Same-mode sub-mode switch
        await sessionManager.switchSubMode(fromKey, toKey);
      }

      // ⚠️ Restore the state to the UI after switching
      await restoreSessionToUI();
    } catch (error) {
      console.error(`[PromptOptimizerApp] Route switch failed: ${fromKey} → ${toKey}`, error);
    }
  }
);

// ========== 🔧 Step D: route navigation helper (replaces setFunctionMode/set*SubMode) ==========
/**
 * Navigate by route using a SubModeKey (replaces the old setFunctionMode/set*SubMode write entries)
 *
 * @param toKey - Target sub-mode key, such as 'basic-system', 'pro-variable', 'image-text2image'
 * @param opts - Navigation options
 * @param opts.replace - Whether to use router.replace instead of router.push (default false)
 *
 * Use cases:
 * - History restore: navigateToSubModeKey(chain.functionMode + '-' + chain.subMode)
 * - Using a favorite: navigateToSubModeKey(favorite.functionMode + '-' + favorite.subMode)
 * - Any scenario that needs to switch the mode/sub-mode
 */
function navigateToSubModeKey(
  toKey: SubModeKey,
  opts?: { replace?: boolean }
) {
  // SubModeKey format: 'basic-system' | 'pro-variable' | 'image-text2image'
  const [mode, subMode] = toKey.split('-') as [
    FunctionMode,
    BasicSubMode | ProSubMode | ImageSubMode
  ]

  const path = `/${mode}/${subMode}`

  if (opts?.replace) {
    routerInstance.replace(path)
  } else {
    routerInstance.push(path)
  }
}

// 🔧 Step C phase 2: the four old state-watches were deleted, and route-watch is now the only trigger source
// - watch(functionMode, ...) ❌ deleted (2024-01-06)
// - watch(basicSubMode, ...) ❌ deleted (2024-01-06)
// - watch(proSubMode, ...) ❌ deleted (2024-01-06)
// - watch(imageSubMode, ...) ❌ deleted (2024-01-06)
//
// Main flow: route.fullPath change → sessionManager.switchMode/switchSubMode → restoreSessionToUI
// Keep watch([isReady, ...modes], ...) for the first restore (lines 1121-1131)

// Restore the current session when the app starts (triggered automatically after services are ready)
// Note: the restore logic is integrated into the services-ready watch


// Periodic auto-save (every 30 seconds)
let autoSaveIntervalId: number | null = null
// Services initialization timeout timer
let initTimeoutId: number | null = null

// ⚠️ Named function: pagehide event handler (Codex suggestion)
const handlePagehide = () => {
  // Note: await cannot be used here because the browser does not wait for async operations to finish
  sessionManager.saveAllSessions().catch(err => {
    console.error('[PromptOptimizerApp] pagehide async save failed:', err)
  })
}

// ⚠️ Named function: visibilitychange event handler (Codex suggestion)
const handleVisibilityChange = () => {
  if (document.visibilityState === 'hidden') {
    sessionManager.saveAllSessions().catch(err => {
      console.error('[PromptOptimizerApp] visibilitychange save failed:', err)
    })
  }
}

onMounted(() => {
  // Route-level lazy loading can break after a new deployment when this tab is still running an old main bundle.
  // Prompt user to refresh instead of auto-reloading.
  if (typeof window !== 'undefined') {
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
  }
  removeRouterErrorHandler = routerInstance.onError((error) => {
    if (!isChunkLoadFailure(error)) return;
    void promptRefreshForNewDeploy(error);
  });

  // ⚠️ Use watchEffect + an independent timeout timer (Codex suggestion)
  const TIMEOUT = 10000 // 10-second timeout

  // ⚠️ Avoid the TDZ risk of calling stopWatch() inside the watchEffect callback
  let stopWatch: (() => void) | null = null

  // Set the timeout timer
  initTimeoutId = window.setTimeout(() => {
    console.error('[PromptOptimizerApp] Services initialization timed out')
    stopWatch?.()
  }, TIMEOUT)

  stopWatch = watchEffect(async () => {
    // Wait for services and initialization to complete
    if (!services.value || isInitializing.value) {
      return
    }

    // ⚠️ Defensive check: make sure the Pinia services are injected (guards against timing races)
    // In theory watch(services) runs setPiniaServices() first, but a second confirmation is added here
    const $services = getPiniaServices()
    if (!$services) {
      console.warn('[PromptOptimizerApp] Pinia services are not injected yet, but services.value already exists')
      console.warn('[PromptOptimizerApp] This may be a timing issue; continue waiting for the next round')
      // Do not call stopWatch(); continue waiting for the next round
      return
    }
    if (!$services.preferenceService) {
      // PreferenceService is not ready yet: keep waiting, to avoid restoreAllSessions() returning directly and the default values being written back over persisted content
      return
    }

    // Services and Pinia are both ready; clear the timeout timer and stop watching
    console.log('[PromptOptimizerApp] Services and Pinia are both ready, starting the session restore')
    if (initTimeoutId !== null) {
      window.clearTimeout(initTimeoutId)
      initTimeoutId = null
    }
    stopWatch?.()

    try {
      // hydrate all: avoids unrestored sub-modes overwriting persisted content with default empty values during saveAllSessions
      await sessionManager.restoreAllSessions()

      // Restore to the UI
      await restoreSessionToUI()

      // 🔧 Codex fix: mark the first restore as done, allowing the watch to respond to subsequent mode switches
      hasRestoredInitialState.value = true

      // Start the auto-save timer
      autoSaveIntervalId = window.setInterval(async () => {
        // ⚠️ Codex requirement: disable auto-save during a switch to avoid race conditions
        // ⚠️ Note: SessionManager.saveSubModeSession already has a global lock (saveInFlight) internally, so no extra lock is needed
        if (sessionManager.isSwitching) {
          return
        }

        const currentKey = sessionManager.getActiveSubModeKey()
        await sessionManager.saveSubModeSession(currentKey)
      }, 30000) // Every 30 seconds

      // ⚠️ Codex suggestion: use pagehide instead of beforeunload (more reliable)
      // pagehide fires when the page is about to unload, and is more reliable than beforeunload
      if (typeof window !== 'undefined') {
        window.addEventListener('pagehide', handlePagehide)

        // ⚠️ Extra safeguard: also trigger a save when visibilitychange becomes hidden
        document.addEventListener('visibilitychange', handleVisibilityChange)
      }
    } catch (error) {
      console.error('[PromptOptimizerApp] An error occurred during initialization:', error)
    } finally {
      // Ensure the app can render even if session restore fails.
      hasRestoredInitialState.value = true
    }
  })
})

// Clean up and save all sessions before the app unmounts
onBeforeUnmount(async () => {
  // 🔧 Codex fix: set the unmount flag to prevent subsequent microtasks from running a restore
  restoreCoordinator.markUnmounted();

  // Clear the timers
  if (autoSaveIntervalId !== null) {
    window.clearInterval(autoSaveIntervalId)
  }

  // ⚠️ Clear the initialization timeout timer (Codex suggestion: avoid dangling timers)
  if (initTimeoutId !== null) {
    window.clearTimeout(initTimeoutId)
  }

  // ⚠️ Codex suggestion: remove the event listeners to avoid memory leaks
  if (typeof window !== 'undefined') {
    window.removeEventListener('pagehide', handlePagehide)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    window.removeEventListener('unhandledrejection', handleUnhandledRejection)
  }

  removeRouterErrorHandler?.()
  removeRouterErrorHandler = null
 
  await sessionManager.saveAllSessions()
})
</script>

<style scoped>
.active-button {
    background-color: var(--primary-color, #3b82f6) !important;
    color: white !important;
    border-color: var(--primary-color, #3b82f6) !important;
}

.active-button:hover {
    background-color: var(--primary-hover-color, #2563eb) !important;
    border-color: var(--primary-hover-color, #2563eb) !important;
}

.loading-container {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100vh;
    font-size: 1.2rem;
    color: var(--text-color);
    background-color: var(--background-color);
}

.loading-container.error {
    color: #f56c6c;
}

.spinner {
    border: 4px solid rgba(128, 128, 128, 0.2);
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border-left-color: var(--primary-color);
    animation: spin 1s ease infinite;
    margin-bottom: 20px;
}

@keyframes spin {
    0% {
        transform: rotate(0deg);
    }
    100% {
        transform: rotate(360deg);
    }
}
</style>
