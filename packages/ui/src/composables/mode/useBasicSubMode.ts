import { ref, readonly, type Ref } from 'vue'

import type { AppServices } from '../../types/services'
import { usePreferences } from '../storage/usePreferenceManager'
import { UI_SETTINGS_KEYS, type BasicSubMode } from '@prompt-optimizer/core'

interface UseBasicSubModeApi {
  basicSubMode: Ref<BasicSubMode>
  setBasicSubMode: (mode: BasicSubMode) => Promise<void>
  switchToSystem: () => Promise<void>
  switchToUser: () => Promise<void>
  ensureInitialized: () => Promise<void>
}

let singleton: {
  mode: Ref<BasicSubMode>
  initialized: boolean
  initializing: Promise<void> | null
} | null = null

/**
 * Singleton of the basic mode sub-mode
 * - Defaults to 'system' (system prompt optimization)
 * - Persisted automatically
 * - Independent of context mode and image mode
 */
export function useBasicSubMode(services: Ref<AppServices | null>): UseBasicSubModeApi {
  if (!singleton) {
    singleton = {
      mode: ref<BasicSubMode>('system'),
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
        const saved = await getPreference<BasicSubMode>(
          UI_SETTINGS_KEYS.BASIC_SUB_MODE,
          'system'
        )
        singleton!.mode.value = (saved === 'system' || saved === 'user')
          ? saved
          : 'system'

        console.log(`[useBasicSubMode] Initialization complete, current value: ${singleton!.mode.value}`)

        // Persist the default value (if it has not been set before)
        if (saved !== 'system' && saved !== 'user') {
          await setPreference(UI_SETTINGS_KEYS.BASIC_SUB_MODE, 'system')
          console.log('[useBasicSubMode] First initialization, default value persisted: system')
        }
      } catch (e) {
        console.error('[useBasicSubMode] Initialization failed, using the default value system:', e)
        // If reading fails, keep the default 'system' and try to persist it
        try {
          await setPreference(UI_SETTINGS_KEYS.BASIC_SUB_MODE, 'system')
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

  const setBasicSubMode = async (mode: BasicSubMode) => {
    await ensureInitialized()
    singleton!.mode.value = mode
    await setPreference(UI_SETTINGS_KEYS.BASIC_SUB_MODE, mode)
    console.log(`[useBasicSubMode] Sub-mode switched and persisted: ${mode}`)
  }

  const switchToSystem = () => setBasicSubMode('system')
  const switchToUser = () => setBasicSubMode('user')

  return {
    basicSubMode: readonly(singleton.mode) as Ref<BasicSubMode>,
    setBasicSubMode,
    switchToSystem,
    switchToUser,
    ensureInitialized
  }
}
