/**
 * Context management composable
 * Responsible for managing the optimization context, context variables, the context editor, and related features
 */

import { ref, computed, watch, type Ref, type ComputedRef } from 'vue'

import { useToast } from "../ui/useToast";
import type {
  ConversationMessage,
  ToolDefinition,
  ContextEditorState as CoreContextEditorState,
} from "@prompt-optimizer/core";
import type { AppServices } from "../../types/services";
import type { VariableManagerHooks } from "../prompt/useVariableManager";

export interface ContextManagementOptions {
  services: Ref<AppServices | null>;
  // ✅ Removed selectedOptimizationMode - unused inside the function, can be computed dynamically from route-computed
  advancedModeEnabled: Ref<boolean>;
  showContextEditor: Ref<boolean>;
  contextEditorDefaultTab: Ref<"messages" | "variables" | "tools">;
  contextEditorState: Ref<CoreContextEditorState>;
  variableManager: VariableManagerHooks | null;
  optimizer: { prompt?: string; optimizedPrompt?: string } | null;
}

export function useContextManagement(options: ContextManagementOptions) {
  const {
    services,
    advancedModeEnabled,
    showContextEditor,
    contextEditorDefaultTab,
    contextEditorState,
    variableManager,
    optimizer,
  } = options;

  // ==================== State definitions ====================

  // Context mode
  const contextMode =
    ref<import("@prompt-optimizer/core").ContextMode>("system");

  // Optimization-stage context state
  const optimizationContext = ref<ConversationMessage[]>([]);
  const optimizationContextTools = ref<ToolDefinition[]>([]);

  // Flag for whether the context has been loaded from the persistent repository
  const isContextLoaded = ref(false);

  // Context persistence state
  const currentContextId = ref<string | null>(null);
  const contextRepo = computed(() => services.value?.contextRepo);

  // Built-in predefined variables
  const predefinedVariables = computed(() => {
    // The optimizer may be null during initialization, so it must be accessed safely
    if (!optimizer || typeof optimizer !== "object") {
      return {
        originalPrompt: "",
        lastOptimizedPrompt: "",
      };
    }
    return {
      originalPrompt: optimizer.prompt || "",
      lastOptimizedPrompt: optimizer.optimizedPrompt || "",
    };
  });

  // ==================== Watch contextMode changes ====================

  // Watch contextMode changes in services and sync them to the local ref
  watch(
    () => {
      const cm = services.value?.contextMode
      if (!cm) return undefined
      return typeof cm === 'string' ? cm : cm.value
    },
    (newMode) => {
      if (newMode !== undefined) {
        contextMode.value = newMode;
        console.log("[useContextManagement] contextMode changed:", newMode);
      }
    },
    { immediate: true },
  );

  // ==================== Persistence-related ====================

  // Initialize context persistence
  const initializeContextPersistence = async () => {
    if (!contextRepo.value) return;

    try {
      // Get the current context ID
      currentContextId.value = await contextRepo.value.getCurrentId();

      if (currentContextId.value) {
        // Load the current context
        const context = await contextRepo.value.get(currentContextId.value);
        if (context) {
          optimizationContext.value = [...context.messages];
          optimizationContextTools.value = [...(context.tools || [])];

          // Sync the context variables to contextEditorState
          contextEditorState.value = {
            ...contextEditorState.value,
            messages: [...context.messages],
            variables: context.variables || {},
            tools: [...(context.tools || [])],
          };
          console.log(
            "[useContextManagement] Initialized context variables from persistence:",
            Object.keys(context.variables || {}),
          );
        }
      }
    } catch (error) {
      console.warn(
        "[useContextManagement] Failed to initialize context persistence:",
        error,
      );
    } finally {
      isContextLoaded.value = true;
    }
  };

  // Persist context updates (lightly throttled)
  let persistContextUpdateTimer: ReturnType<typeof setTimeout> | null = null;
  const persistContextUpdate = async (patch: {
    messages?: ConversationMessage[];
    // variables has been removed - temporary variables are managed by useTemporaryVariables(): persisted to the session for Pro/Image, in-memory only for Basic
    tools?: ToolDefinition[];
  }) => {
    if (!contextRepo.value || !currentContextId.value) return;

    // Clear the previous timer
    if (persistContextUpdateTimer) {
      clearTimeout(persistContextUpdateTimer);
    }

    // Set a new throttle timer (300ms delay)
    persistContextUpdateTimer = setTimeout(async () => {
      try {
        await contextRepo.value!.update(currentContextId.value!, patch);
        console.log("[useContextManagement] Context persisted to storage");
      } catch (error) {
        console.warn(
          "[useContextManagement] Failed to persist context update:",
          error,
        );
      }
    }, 300);
  };

  // Watch message changes in the main UI context manager and persist automatically
  watch(
    optimizationContext,
    async (newMessages) => {
      // Avoid duplicate persistence with the fullscreen editor
      if (showContextEditor.value) return;
      await persistContextUpdate({ messages: newMessages });
    },
    { deep: true },
  );

  // ==================== Context editor-related ====================

  // Open the context editor
  const handleOpenContextEditor = async (
    messagesOrTab?: ConversationMessage[] | "messages" | "variables" | "tools",
    _variables?: Record<string, string>,
  ) => {
    // Parameter type check
    let messages: ConversationMessage[] | undefined;
    let defaultTab: "messages" | "variables" | "tools" = "messages";

    if (typeof messagesOrTab === "string") {
      defaultTab = messagesOrTab;
      messages = undefined;
    } else {
      messages = messagesOrTab;
    }

    // Set the default tab
    contextEditorDefaultTab.value = defaultTab;

    // Make sure the global variables are loaded and refreshed
    try {
      await variableManager?.refresh?.();
    } catch (e) {
      console.warn(
        "[useContextManagement] Variable manager refresh failed:",
        e,
      );
    }

    // Set the initial state
    contextEditorState.value = {
      messages: messages || [...optimizationContext.value],
      variables: {}, // Session variables are no longer used
      tools: [...optimizationContextTools.value],
      showVariablePreview: false, // The variable preview is no longer shown
      showToolManager: contextMode.value === "user",
      mode: "edit",
    };
    showContextEditor.value = true;
  };

  // Handle saving the context editor
  const handleContextEditorSave = async (context: {
    messages: ConversationMessage[];
    variables: Record<string, string>; // Parameter kept for interface compatibility but not used
    tools: ToolDefinition[];
  }) => {
    // Update the optimization context
    optimizationContext.value = [...context.messages];
    optimizationContextTools.value = [...context.tools];

    // Persist to contextRepo (without temporary variables; temporary variables go through the session store / in-memory state)
    await persistContextUpdate({
      messages: context.messages,
      // variables are not persisted - temporary variables are managed by useTemporaryVariables()
      tools: context.tools,
    });

    // Close the editor
    showContextEditor.value = false;

    // Show a success message
    useToast().success("Context updated");
  };

  // Handle real-time state updates of the context editor
  const handleContextEditorStateUpdate = async (state: {
    messages: ConversationMessage[];
    variables?: Record<string, string>; // Kept for compatibility but not used
    tools: ToolDefinition[];
  }) => {
    // Sync the state to contextEditorState in real time (without variables)
    contextEditorState.value.messages = [...state.messages];
    contextEditorState.value.tools = [...state.tools];
    // variables are not synced - temporary variables are managed by useTemporaryVariables()

    // Update the optimization context in real time
    optimizationContext.value = [...state.messages];
    optimizationContextTools.value = [...(state.tools || [])];

    // Persist in real time (without temporary variables)
    await persistContextUpdate({
      messages: state.messages,
      // variables are not persisted
      tools: state.tools,
    });

    console.log("[useContextManagement] Context editor state synchronized");
  };

  // ==================== Context mode switching ====================

  const handleContextModeChange = async (
    mode: import("@prompt-optimizer/core").ContextMode,
  ) => {
    if (!services.value) {
      console.warn("[useContextManagement] Services not ready");
      return;
    }

    try {
      // Update the local contextMode (synced to App.vue through the watch)
      if (contextMode.value !== mode) {
        contextMode.value = mode;
        console.log("[useContextManagement] Context mode changed to:", mode);
      }

      // Update contextMode in services (type check needed, since it may already be a string)
      if (services.value?.contextMode) {
        // If contextMode is a Ref, update its value
        if (
          typeof services.value.contextMode === "object" &&
          "value" in services.value.contextMode
        ) {
          if (services.value.contextMode.value !== mode) {
            services.value.contextMode.value = mode;
          }
        }
      }
    } catch (error) {
      console.error(
        "[useContextManagement] Failed to change context mode:",
        error,
      );
      useToast().error("Failed to switch the context mode");
    }
  };

  // Session variable management has been removed - the test area's temporary variables are used now

  // ==================== Return ====================

  return {
    // State
    contextMode,
    optimizationContext,
    optimizationContextTools,
    isContextLoaded,
    currentContextId,
    contextRepo,
    predefinedVariables,

    // Methods
    initializeContextPersistence,
    persistContextUpdate,
    handleOpenContextEditor,
    handleContextEditorSave,
    handleContextEditorStateUpdate,
    handleContextModeChange,
  };
}
