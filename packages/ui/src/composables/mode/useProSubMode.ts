import { ref, readonly, type Ref } from 'vue'

import type { AppServices } from '../../types/services'
import { usePreferences } from '../storage/usePreferenceManager'
import { UI_SETTINGS_KEYS, type ProSubMode } from '@prompt-optimizer/core'

interface UseProSubModeApi {
  proSubMode: Ref<ProSubMode>
  setProSubMode: (mode: ProSubMode) => Promise<void>
  switchToMulti: () => Promise<void>
  switchToVariable: () => Promise<void>
  ensureInitialized: () => Promise<void>
}

const DEFAULT_PRO_SUB_MODE: ProSubMode = 'variable'

const normalizeLegacyProSubMode = (value: unknown): ProSubMode => {
  if (value === 'multi' || value === 'variable') return value
  if (value === 'system') return 'multi'
  if (value === 'user') return 'variable'
  return DEFAULT_PRO_SUB_MODE
}

let singleton: {
  mode: Ref<ProSubMode>
  initialized: boolean
  initializing: Promise<void> | null
} | null = null

/**
 * Context mode (Pro mode) sub-mode singleton. Reads/writes PreferenceService.
 * - Defaults to 'user'
 * - System mode (multi-conversation optimization) is available in all environments
 * - Initialized asynchronously on the first call
 * - State is independent of basic mode, isolating the sub-mode state across function modes
 */
export function useProSubMode(services: Ref<AppServices | null>): UseProSubModeApi {
  if (!singleton) {
    singleton = {
      mode: ref<ProSubMode>(DEFAULT_PRO_SUB_MODE),
      initialized: false,
      initializing: null
    }
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
        // Read pro-sub-mode; if it does not exist, return the default value
        const saved = await getPreference<ProSubMode>(UI_SETTINGS_KEYS.PRO_SUB_MODE, DEFAULT_PRO_SUB_MODE)

        const normalized = normalizeLegacyProSubMode(saved)
        singleton!.mode.value = normalized

        // Persist the normalized value (compatible with the old values system/user -> multi/variable)
        if (saved !== normalized) {
          await setPreference(UI_SETTINGS_KEYS.PRO_SUB_MODE, normalized)
        }
      } catch (e) {
        console.error(`[useProSubMode] Initialization failed, using the default value ${DEFAULT_PRO_SUB_MODE}:`, e)
        // If reading fails, keep the default value and try to persist it
        try {
          await setPreference(UI_SETTINGS_KEYS.PRO_SUB_MODE, DEFAULT_PRO_SUB_MODE)
        } catch {
          // Ignore set-failure errors
        }
      } finally {
        singleton!.initialized = true
        singleton!.initializing = null
      }
    })()
    await singleton!.initializing
  }

  const setProSubMode = async (mode: ProSubMode) => {
    await ensureInitialized()
    singleton!.mode.value = mode
    await setPreference(UI_SETTINGS_KEYS.PRO_SUB_MODE, mode)
  }

  const switchToMulti = () => setProSubMode('multi')
  const switchToVariable = () => setProSubMode('variable')

  return {
    proSubMode: readonly(singleton.mode) as Ref<ProSubMode>,
    setProSubMode,
    switchToMulti,
    switchToVariable,
    ensureInitialized
  }
}
