/**
 * Global Settings Store
 *
 * Manages global UI config across sessions (Phase 1).
 *
 * Design principles:
 * - Use Pinia to manage the state boundary uniformly
 * - Use PreferenceService for persistence (unified for Web/Electron, async)
 * - Full snapshot storage (single key): 'global-settings/v1'
 *
 * Migration strategy (one-time, executed at restore):
 * - If 'global-settings/v1' does not exist or fields are missing, read from the old UI_SETTINGS_KEYS and fill in
 */

import { defineStore } from 'pinia'
import { ref, watch, type Ref } from 'vue'
import { UI_SETTINGS_KEYS } from '@prompt-optimizer/core'
import { getPiniaServices } from '../../plugins/pinia'

export type FunctionMode = 'basic' | 'pro' | 'image'
export type BasicSubMode = 'system' | 'user'
export type ProSubMode = 'multi' | 'variable'
export type ImageSubMode = 'text2image' | 'image2image'

export interface GlobalSettingsState {
  selectedThemeId: string
  preferredLanguage: string
  builtinTemplateLanguage: string

  functionMode: FunctionMode
  basicSubMode: BasicSubMode
  proSubMode: ProSubMode
  imageSubMode: ImageSubMode

  lastActiveAt: number
}

const STORAGE_KEY = 'global-settings/v1'

const createDefaultState = (): GlobalSettingsState => ({
  selectedThemeId: 'auto',
  preferredLanguage: 'en-US',
  builtinTemplateLanguage: 'en-US',
  functionMode: 'basic',
  basicSubMode: 'system',
  proSubMode: 'variable',
  imageSubMode: 'text2image',
  lastActiveAt: Date.now(),
})

const isFunctionMode = (value: unknown): value is FunctionMode =>
  value === 'basic' || value === 'pro' || value === 'image'

const isBasicSubMode = (value: unknown): value is BasicSubMode =>
  value === 'system' || value === 'user'

const isProSubMode = (value: unknown): value is ProSubMode =>
  value === 'multi' || value === 'variable'

const normalizeLegacyProSubMode = (value: unknown): ProSubMode | null => {
  if (value === 'multi' || value === 'variable') return value
  if (value === 'system') return 'multi'
  if (value === 'user') return 'variable'
  return null
}

const isImageSubMode = (value: unknown): value is ImageSubMode =>
  value === 'text2image' || value === 'image2image'

export const useGlobalSettings = defineStore('globalSettings', () => {
  /**
   * Global settings snapshot (persistable)
   */
  const state: Ref<GlobalSettingsState> = ref(createDefaultState())

  /**
   * Restore flag (prevents "defaults + watch" from overwriting persisted content before the restore)
   */
  const isInitialized = ref(false)
  const hasRestored = ref(false)
  const restoreInFlight = ref<Promise<void> | null>(null)
  const isRestoring = ref(false)

  /**
   * Save mutex (avoids concurrent writes)
   */
  const saveInFlight = ref(false)
  const saveQueued = ref(false)

  const touch = () => {
    state.value.lastActiveAt = Date.now()
  }

  const updateSelectedThemeId = (themeId: string) => {
    if (state.value.selectedThemeId === themeId) return
    state.value.selectedThemeId = themeId
    touch()
  }

  // ✅ Unified external naming: updateThemeId
  const updateThemeId = (themeId: string) => updateSelectedThemeId(themeId)

  const updatePreferredLanguage = (language: string) => {
    if (state.value.preferredLanguage === language) return
    state.value.preferredLanguage = language
    touch()
  }

  const updateBuiltinTemplateLanguage = (language: string) => {
    if (state.value.builtinTemplateLanguage === language) return
    state.value.builtinTemplateLanguage = language
    touch()
  }

  const updateFunctionMode = (mode: FunctionMode) => {
    if (state.value.functionMode === mode) return
    state.value.functionMode = mode
    touch()
  }

  const updateBasicSubMode = (mode: BasicSubMode) => {
    if (state.value.basicSubMode === mode) return
    state.value.basicSubMode = mode
    touch()
  }

  const updateProSubMode = (mode: ProSubMode) => {
    if (state.value.proSubMode === mode) return
    state.value.proSubMode = mode
    touch()
  }

  const updateImageSubMode = (mode: ImageSubMode) => {
    if (state.value.imageSubMode === mode) return
    state.value.imageSubMode = mode
    touch()
  }

  const reset = () => {
    state.value = createDefaultState()
  }

  /**
   * Save to persistent storage
   * Uses PreferenceService
   */
  const saveGlobalSettings = async () => {
    if (!hasRestored.value) return
    if (isRestoring.value) return

    if (saveInFlight.value) {
      saveQueued.value = true
      return
    }

    const $services = getPiniaServices()
    if (!$services?.preferenceService) {
      console.warn('[GlobalSettings] PreferenceService is unavailable, cannot save the global settings')
      return
    }

    saveInFlight.value = true
    try {
      do {
        saveQueued.value = false
        const snapshot = JSON.stringify(state.value)
        await $services.preferenceService.set(STORAGE_KEY, snapshot)
      } while (saveQueued.value)
    } catch (error) {
      console.error('[GlobalSettings] Failed to save the global settings:', error)
    } finally {
      saveInFlight.value = false
    }
  }

  type MigrationMode = 'fill-empty' | 'override-defaults'

  /**
   * Migrate from the old UI_SETTINGS_KEYS
   * - fill-empty: only fill in when a field is empty/missing
   * - override-defaults: allow overriding when a field is at its default value (used for the migration when global-settings/v1 is first introduced)
   */
  const migrateFromUiSettingsKeys = async (mode: MigrationMode) => {
    const $services = getPiniaServices()
    if (!$services?.preferenceService) return

    try {
      const defaults = createDefaultState()
      const shouldOverride = (current: unknown, fallback: unknown) =>
        mode === 'override-defaults' ? current === fallback : !current

      if (shouldOverride(state.value.selectedThemeId, defaults.selectedThemeId)) {
        const themeId = await $services.preferenceService.get<string>(
          UI_SETTINGS_KEYS.THEME_ID,
          ''
        )
        if (themeId) state.value.selectedThemeId = themeId
      }

      if (shouldOverride(state.value.preferredLanguage, defaults.preferredLanguage)) {
        const language = await $services.preferenceService.get<string>(
          UI_SETTINGS_KEYS.PREFERRED_LANGUAGE,
          ''
        )
        if (language) state.value.preferredLanguage = language
      }

      if (shouldOverride(state.value.builtinTemplateLanguage, defaults.builtinTemplateLanguage)) {
        const language = await $services.preferenceService.get<string>(
          UI_SETTINGS_KEYS.BUILTIN_TEMPLATE_LANGUAGE,
          ''
        )
        if (language) state.value.builtinTemplateLanguage = language
      }

      if (shouldOverride(state.value.functionMode, defaults.functionMode)) {
        const mode = await $services.preferenceService.get<string>(
          UI_SETTINGS_KEYS.FUNCTION_MODE,
          ''
        )
        if (isFunctionMode(mode)) state.value.functionMode = mode
      }

      if (shouldOverride(state.value.basicSubMode, defaults.basicSubMode)) {
        const mode = await $services.preferenceService.get<string>(
          UI_SETTINGS_KEYS.BASIC_SUB_MODE,
          ''
        )
        if (isBasicSubMode(mode)) state.value.basicSubMode = mode
      }

      if (shouldOverride(state.value.proSubMode, defaults.proSubMode)) {
        const mode = await $services.preferenceService.get<string>(
          UI_SETTINGS_KEYS.PRO_SUB_MODE,
          ''
        )
        const normalized = normalizeLegacyProSubMode(mode)
        if (normalized) {
          state.value.proSubMode = normalized
          if (mode !== normalized) {
            await $services.preferenceService.set(UI_SETTINGS_KEYS.PRO_SUB_MODE, normalized)
          }
        }
      }

      if (shouldOverride(state.value.imageSubMode, defaults.imageSubMode)) {
        const mode = await $services.preferenceService.get<string>(
          UI_SETTINGS_KEYS.IMAGE_SUB_MODE,
          ''
        )
        if (isImageSubMode(mode)) state.value.imageSubMode = mode
      }
    } catch (error) {
      console.warn('[GlobalSettings] Migration from UI_SETTINGS_KEYS failed (ignored):', error)
    }
  }

  /**
   * Restore from persistent storage
   * Uses PreferenceService
   */
  const restoreGlobalSettings = async () => {
    // Restore from persistence is already done: no need to run it again
    // Note: isInitialized only means "available", not "already restored from persistence"
    if (hasRestored.value) return

    if (restoreInFlight.value) {
      await restoreInFlight.value
      return
    }

    const task = (async () => {
      isRestoring.value = true
      try {
        const $services = getPiniaServices()
        if (!$services?.preferenceService) {
          // PreferenceService may not be injected yet during startup:
          // - Do not output a console warning here (E2E treats warnings as failures)
          // - Mark as initialized first, allowing the router/UI to continue running (e.g. RootBootstrapRoute jumping to the default workspace)
          // - Keep hasRestored=false so that a restore can run again once PreferenceService is injected
          isInitialized.value = true
          return
        }

        const defaults = createDefaultState()
        const saved = await $services.preferenceService.get(STORAGE_KEY, '')
        if (saved) {
          const parsed = JSON.parse(saved) as Partial<GlobalSettingsState>
          state.value = {
            ...defaults,
            ...parsed,
            functionMode: isFunctionMode(parsed.functionMode)
              ? parsed.functionMode
              : defaults.functionMode,
            basicSubMode: isBasicSubMode(parsed.basicSubMode)
              ? parsed.basicSubMode
              : defaults.basicSubMode,
            proSubMode: normalizeLegacyProSubMode(parsed.proSubMode) ?? defaults.proSubMode,
            imageSubMode: isImageSubMode(parsed.imageSubMode)
              ? parsed.imageSubMode
              : defaults.imageSubMode,
            lastActiveAt: Date.now(),
          }
        } else {
          // No snapshot: keep the current in-memory values (possibly already written by legacy localStorage, etc.) and fill in the default fields
          state.value = {
            ...defaults,
            ...state.value,
            functionMode: isFunctionMode(state.value.functionMode)
              ? state.value.functionMode
              : defaults.functionMode,
            basicSubMode: isBasicSubMode(state.value.basicSubMode)
              ? state.value.basicSubMode
              : defaults.basicSubMode,
            proSubMode: normalizeLegacyProSubMode(state.value.proSubMode) ?? defaults.proSubMode,
            imageSubMode: isImageSubMode(state.value.imageSubMode)
              ? state.value.imageSubMode
              : defaults.imageSubMode,
            lastActiveAt: Date.now(),
          }
        }

        // Migration:
        // - With a snapshot: only fill in empty fields
        // - Without a snapshot: allow overriding defaults (first introduction of global-settings/v1)
        await migrateFromUiSettingsKeys(saved ? 'fill-empty' : 'override-defaults')

        state.value.lastActiveAt = Date.now()
        hasRestored.value = true
        isInitialized.value = true

        // Persist once after the migration to make sure the new key is written (best-effort)
        await saveGlobalSettings()
      } catch (error) {
        console.error('[GlobalSettings] Failed to restore the global settings:', error)
        // On a restore failure, degrade to the defaults without blocking continued use
        reset()
        hasRestored.value = true
        isInitialized.value = true
      } finally {
        isRestoring.value = false
      }
    })()

    restoreInFlight.value = task
    try {
      await task
    } finally {
      restoreInFlight.value = null
    }
  }

  // Automatic persistence: watch state changes and save (only effective after the restore completes)
  watch(
    state,
    () => {
      void saveGlobalSettings()
    },
    { deep: true }
  )

  return {
    // State
    state,
    isInitialized,
    hasRestored,

    // Persistence
    saveGlobalSettings,
    restoreGlobalSettings,

    // Update methods
    updateThemeId,
    updateSelectedThemeId, // backward-compatible alias
    updatePreferredLanguage,
    updateBuiltinTemplateLanguage,
    updateFunctionMode,
    updateBasicSubMode,
    updateProSubMode,
    updateImageSubMode,

    // Utility methods
    reset,
  }
})

export type GlobalSettingsApi = ReturnType<typeof useGlobalSettings>
