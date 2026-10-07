import { ref, readonly, type Ref } from 'vue'

import type { AppServices } from '../../types/services'
import { usePreferences } from '../storage/usePreferenceManager'
import { UI_SETTINGS_KEYS } from '@prompt-optimizer/core'

export type FunctionMode = 'basic' | 'pro' | 'image'

interface UseFunctionModeApi {
  functionMode: Ref<FunctionMode>
  setFunctionMode: (mode: FunctionMode) => Promise<void>
  switchToBasic: () => Promise<void>
  switchToPro: () => Promise<void>
  switchToImage: () => Promise<void>
  ensureInitialized: () => Promise<void>
}

let singleton: {
  mode: Ref<FunctionMode>
  initialized: boolean
  initializing: Promise<void> | null
} | null = null

/**
 * Global function mode (basic/pro) singleton. Reads/writes PreferenceService.
 * - Defaults to 'basic' (backward compatible)
 * - Initialized asynchronously on the first call
 */
export function useFunctionMode(services: Ref<AppServices | null>): UseFunctionModeApi {
  if (!singleton) {
    singleton = { mode: ref<FunctionMode>('basic'), initialized: false, initializing: null }
  }

  const { getPreference, setPreference } = usePreferences(services)

  const ensureInitialized = async () => {
    if (singleton!.initialized) return
    if (singleton!.initializing) {
      await singleton!.initializing
      return
    }
    singleton!.initializing = (async () => {
      try {
        // Read function-mode; if it does not exist, return the default 'basic'
        const saved = await getPreference<FunctionMode>(UI_SETTINGS_KEYS.FUNCTION_MODE, 'basic')
        singleton!.mode.value = (saved === 'pro' || saved === 'image') ? saved : 'basic'
        // Persist the default value (if it has not been set before)
        if (saved !== 'pro' && saved !== 'basic' && saved !== 'image') {
          await setPreference(UI_SETTINGS_KEYS.FUNCTION_MODE, 'basic')
        }
        // ✅ Only mark as initialized on success
        singleton!.initialized = true
      } catch (e) {
        // ⚠️ Initialization failed; keep initialized = false to allow a later retry
        console.warn('[useFunctionMode] Initialization failed, will retry on next call:', e)
        // Keep the default 'basic' mode, but do not mark it as initialized
      } finally {
        // Clear the initialization lock, regardless of success or failure
        singleton!.initializing = null
      }
    })()
    await singleton!.initializing
  }

  const setFunctionMode = async (mode: FunctionMode) => {
    await ensureInitialized()
    singleton!.mode.value = mode
    await setPreference(UI_SETTINGS_KEYS.FUNCTION_MODE, mode)
  }

  const switchToBasic = () => setFunctionMode('basic')
  const switchToPro = () => setFunctionMode('pro')
  const switchToImage = () => setFunctionMode('image')

  return {
    functionMode: readonly(singleton.mode) as Ref<FunctionMode>,
    setFunctionMode,
    switchToBasic,
    switchToPro,
    switchToImage,
    ensureInitialized
  }
}
