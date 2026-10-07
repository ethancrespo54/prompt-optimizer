/**
 * Unified storage key constant definitions
 *
 * This is the single source of truth for all storage keys; both the UI and Core packages import from here.
 * Centralizing all storage keys avoids inconsistencies caused by duplicate definitions in multiple places.
 */

// Core service storage keys
export const CORE_SERVICE_KEYS = {
  MODELS: "models", // Model config storage key
  IMAGE_MODELS: "image-models", // Image model config storage key
  USER_TEMPLATES: "user-templates", // User template storage key
  PROMPT_HISTORY: "prompt_history", // Prompt history storage key
} as const;

// UI settings
export const UI_SETTINGS_KEYS = {
  THEME_ID: "app:settings:ui:theme-id",
  PREFERRED_LANGUAGE: "app:settings:ui:preferred-language",
  BUILTIN_TEMPLATE_LANGUAGE: "app:settings:ui:builtin-template-language",
  FUNCTION_MODE: "app:settings:ui:function-mode",

  // Sub-mode persistence (the three function modes are stored independently)
  BASIC_SUB_MODE: "app:settings:ui:basic-sub-mode", // Basic mode sub-mode (system/user)
  PRO_SUB_MODE: "app:settings:ui:pro-sub-mode", // Pro mode sub-mode (multi/variable)
  IMAGE_SUB_MODE: "app:settings:ui:image-sub-mode", // Image mode sub-mode (text2image/image2image)
} as const;

// Model selection
export const TEMPLATE_SELECTION_KEYS = {
  SYSTEM_OPTIMIZE_TEMPLATE: "app:selected-optimize-template", // System optimize template (legacy compatibility)
  USER_OPTIMIZE_TEMPLATE: "app:selected-user-optimize-template", // User optimize template
  ITERATE_TEMPLATE: "app:selected-iterate-template", // Iterate template
  CONTEXT_SYSTEM_OPTIMIZE_TEMPLATE:
    "app:selected-context-system-optimize-template",
  CONTEXT_USER_OPTIMIZE_TEMPLATE: "app:selected-context-user-optimize-template",
  CONTEXT_ITERATE_TEMPLATE: "app:selected-context-iterate-template",
} as const;

// Image mode selection
export const IMAGE_MODE_KEYS = {
  SELECTED_TEXT_MODEL: "app:image-mode:selected-text-model",
  SELECTED_IMAGE_MODEL: "app:image-mode:selected-image-model",
  // Template selection stored per mode
  SELECTED_TEMPLATE_TEXT2IMAGE: "app:image-mode:selected-template:text2image",
  SELECTED_TEMPLATE_IMAGE2IMAGE: "app:image-mode:selected-template:image2image",
  SELECTED_ITERATE_TEMPLATE: "app:image-mode:selected-iterate-template",
  COMPARE_MODE_ENABLED: "app:image-mode:compare-mode-enabled",
} as const;

// Function model configuration
export const FUNCTION_MODEL_KEYS = {
  // Global evaluation model
  EVALUATION_MODEL: "app:function-model:evaluation-model",
} as const;

/**
 * Generates the storage key for a mode override
 * @param type Model type: 'optimize' or 'test'
 * @param functionMode Function mode: 'basic' | 'pro' | 'image'
 * @param subMode Sub-mode: 'system' | 'user' | 'multi' | 'variable' | 'text2image' | 'image2image'
 * @returns Storage key, in a format like "app:function-model:optimize:basic:system"
 */
export function getModeModelKey(
  type: "optimize" | "test",
  functionMode: "basic" | "pro" | "image",
  subMode: "system" | "user" | "multi" | "variable" | "text2image" | "image2image"
): string {
  return `app:function-model:${type}:${functionMode}:${subMode}`;
}

// Union type of all storage keys
export const ALL_STORAGE_KEYS = {
  ...CORE_SERVICE_KEYS,
  ...UI_SETTINGS_KEYS,
  ...TEMPLATE_SELECTION_KEYS,
  ...IMAGE_MODE_KEYS,
  ...FUNCTION_MODEL_KEYS,
} as const;

// Array of all keys (for scenarios such as DataManager that need to iterate)
export const ALL_STORAGE_KEYS_ARRAY = Object.values(ALL_STORAGE_KEYS);

// Type definitions
export type CoreServiceKey =
  (typeof CORE_SERVICE_KEYS)[keyof typeof CORE_SERVICE_KEYS];
export type UISettingsKey =
  (typeof UI_SETTINGS_KEYS)[keyof typeof UI_SETTINGS_KEYS];
export type TemplateSelectionKey =
  (typeof TEMPLATE_SELECTION_KEYS)[keyof typeof TEMPLATE_SELECTION_KEYS];
export type ImageModeKey =
  (typeof IMAGE_MODE_KEYS)[keyof typeof IMAGE_MODE_KEYS];
export type FunctionModelKey =
  (typeof FUNCTION_MODEL_KEYS)[keyof typeof FUNCTION_MODEL_KEYS];
export type StorageKey =
  (typeof ALL_STORAGE_KEYS)[keyof typeof ALL_STORAGE_KEYS];
