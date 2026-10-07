/**
 * Session Manager - session management coordinator
 *
 * Responsibilities:
 * - Watch mode and sub-mode switches
 * - Automatically save the current session and restore the target session
 * - Coordinate the 6 sub-mode Session Stores
 * - Provide a switch transaction lock to avoid race conditions
 *
 * Design principles (based on the Codex review):
 * - Do not store subModePreferences separately (avoids dual sources)
 * - Consume the existing state through injectSubModeReaders
 * - Use the isSwitching lock to prevent race conditions during switching
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { BasicSubMode, ProSubMode, ImageSubMode } from '@prompt-optimizer/core'
import type { FunctionMode } from '../../composables/mode/useFunctionMode'
import { getPiniaServices } from '../../plugins/pinia'
import { useBasicSystemSession } from './useBasicSystemSession'
import { useBasicUserSession } from './useBasicUserSession'
import { useProMultiMessageSession } from './useProMultiMessageSession'
import { useProVariableSession } from './useProVariableSession'
import { useImageText2ImageSession } from './useImageText2ImageSession'
import { useImageImage2ImageSession } from './useImageImage2ImageSession'

/**
 * Sub-mode key mapping table
 * Format: {functionMode}-{subMode}
 */
export type SubModeKey =
  | 'basic-system'
  | 'basic-user'
  | 'pro-multi'       // Pro - multi-message mode
  | 'pro-variable'    // Pro - variable mode
  | 'image-text2image'  // Text-to-image
  | 'image-image2image' // Image-to-image

/**
 * Sub-mode reader interface (injected from outside)
 */
export interface SubModeReaders {
  getFunctionMode: () => FunctionMode
  getBasicSubMode: () => BasicSubMode
  getProSubMode: () => ProSubMode
  getImageSubMode: () => ImageSubMode
}

export const useSessionManager = defineStore('sessionManager', () => {
  /**
   * Switch transaction lock (Codex requirement)
   * Auto-save is disabled during a switch to avoid race conditions
   */
  const isSwitching = ref(false)

  /**
   * Global save lock (Codex suggestion)
   * Prevents all save entries (timer, pagehide, visibilitychange, switching) from writing concurrently
   */
  const saveInFlight = ref(false)

  /**
   * Full hydrate flag (prevents "the unrestored default empty state" from overwriting persisted content in saveAllSessions)
   */
  const hasRestoredAllSessions = ref(false)
  const restoreAllInFlight = ref<Promise<void> | null>(null)

  /**
   * Sub-mode readers (injected from outside to avoid dual sources)
   */
  let readers: SubModeReaders | null = null

  /**
   * Inject the sub-mode readers
   * Must be called when the app starts (PromptOptimizerApp.vue)
   */
  const injectSubModeReaders = (injectedReaders: SubModeReaders) => {
    readers = injectedReaders
  }

  /**
   * Get the key of the currently active sub-mode
   */
  const getActiveSubModeKey = (): SubModeKey => {
    if (!readers) {
      console.warn('[SessionManager] The sub-mode readers are not injected, returning the default basic-system')
      return 'basic-system'
    }

    const mode = readers.getFunctionMode()
    let subMode: string

    switch (mode) {
      case 'basic':
        subMode = readers.getBasicSubMode()
        break
      case 'pro':
        subMode = readers.getProSubMode()
        break
      case 'image':
        subMode = readers.getImageSubMode()
        break
      default:
        subMode = 'system'
    }

    return `${mode}-${subMode}` as SubModeKey
  }

  /**
   * Compute the sub-mode key from the given mode and subMode
   * Used to compute oldKey in a watch
   */
  const computeSubModeKey = (
    mode: FunctionMode,
    basicSubMode: string,
    proSubMode: string,
    imageSubMode: string
  ): SubModeKey => {
    let subMode: string

    switch (mode) {
      case 'basic':
        subMode = basicSubMode
        break
      case 'pro':
        subMode = proSubMode
        break
      case 'image':
        subMode = imageSubMode
        break
      default:
        subMode = 'system'
    }

    return `${mode}-${subMode}` as SubModeKey
  }

  /**
   * Switch the function mode (responds to external functionMode changes)
   * @param fromKey The key of the old mode (passed in by the watch)
   * @param toKey The key of the new mode (passed in by the watch)
   */
  const switchMode = async (fromKey: SubModeKey, toKey: SubModeKey) => {
    if (isSwitching.value) {
      return
    }

    isSwitching.value = true
    try {
      // 1. Save the old mode's session
      await saveSubModeSession(fromKey)

      // 2. Restore the new mode's session
      await restoreSubModeSession(toKey)
    } catch (error) {
      console.error('[SessionManager] Mode switch failed:', error)
    } finally {
      isSwitching.value = false
    }
  }

  /**
   * Switch the sub-mode (responds to external subMode changes)
   * @param fromKey The key of the old sub-mode (passed in by the watch)
   * @param toKey The key of the new sub-mode (passed in by the watch)
   */
  const switchSubMode = async (fromKey: SubModeKey, toKey: SubModeKey) => {
    if (isSwitching.value) {
      return
    }

    isSwitching.value = true
    try {
      // 1. Save the old sub-mode's session
      await saveSubModeSession(fromKey)

      // 2. Restore the new sub-mode's session
      await restoreSubModeSession(toKey)
    } catch (error) {
      console.error('[SessionManager] Sub-mode switch failed:', error)
    } finally {
      isSwitching.value = false
    }
  }

  /**
   * Internal method: save the specified sub-mode session (without locking)
   * Only called by saveSubModeSession and saveAllSessions
   */
  const _saveSubModeSessionUnsafe = async (key: SubModeKey) => {
    try {
      switch (key) {
        case 'basic-system':
          await useBasicSystemSession().saveSession()
          break
        case 'basic-user':
          await useBasicUserSession().saveSession()
          break
        case 'pro-multi':
          await useProMultiMessageSession().saveSession()
          break
        case 'pro-variable':
          await useProVariableSession().saveSession()
          break
        case 'image-text2image':
          await useImageText2ImageSession().saveSession()
          break
        case 'image-image2image':
          await useImageImage2ImageSession().saveSession()
          break
      }
    } catch (error) {
      console.error(`[SessionManager] Failed to save the ${key} session:`, error)
    }
  }

  /**
   * Save the specified sub-mode session (protected by the global lock)
   * 🔧 Added protection: saving is not allowed before restore, to avoid overwriting persisted data
   */
  const saveSubModeSession = async (key: SubModeKey) => {
    // ✅ Forced check: must restore before saving
    if (!hasRestoredAllSessions.value) {
      console.warn(`[SessionManager] Tried to save ${key} but the global restore is not complete, skipping to avoid overwriting persisted data`)
      return
    }

    // ⚠️ Concurrency protection: if the previous save is still in progress, skip this one
    if (saveInFlight.value) {
      console.warn(`[SessionManager] A save operation is in progress, skipping the ${key} session save`)
      return
    }

    try {
      saveInFlight.value = true
      await _saveSubModeSessionUnsafe(key)
    } finally {
      saveInFlight.value = false
    }
  }

  /**
   * Restore the specified sub-mode session
   */
  const restoreSubModeSession = async (key: SubModeKey) => {
    try {
      switch (key) {
        case 'basic-system':
          await useBasicSystemSession().restoreSession()
          break
        case 'basic-user':
          await useBasicUserSession().restoreSession()
          break
        case 'pro-multi':
          await useProMultiMessageSession().restoreSession()
          break
        case 'pro-variable':
          await useProVariableSession().restoreSession()
          break
        case 'image-text2image':
          await useImageText2ImageSession().restoreSession()
          break
        case 'image-image2image':
          await useImageImage2ImageSession().restoreSession()
          break
      }
    } catch (error) {
      console.error(`[SessionManager] Failed to restore the ${key} session:`, error)
    }
  }

  /**
   * Save all sessions (used before the app exits, protected by the global lock)
   * ⚠️ Key fix: wait for the current save to complete instead of skipping it (avoids losing data on exit)
   * ⚠️ Codex fix: use an acquired flag to prevent wrongly unlocking
   */
  /**
   * Restore all sub-mode sessions into memory (hydrate all)
   *
   * Purpose: avoid the other sub-modes staying at default empty values when only the current sub-mode is restored,
   * and then being written back to persistent storage by saveAllSessions in pagehide/onBeforeUnmount, overwriting historical data.
   */
  const restoreAllSessions = async () => {
    if (hasRestoredAllSessions.value) {
      return
    }

    const $services = getPiniaServices()
    if (!$services?.preferenceService) {
      return
    }

    if (restoreAllInFlight.value) {
      await restoreAllInFlight.value
      return
    }

    const task = (async () => {
      // IMPORTANT:
      // Do NOT restore all sessions in parallel.
      // Some users may have very large persisted snapshots (e.g. long prompts / test outputs / image metadata).
      // Parallel JSON.parse + reactive assignment across 6 stores can spike memory and crash the browser process.
      // Restore sequentially to reduce peak memory usage and avoid "browser crash" reports.
      const keys: SubModeKey[] = [
        'basic-system',
        'basic-user',
        'pro-multi',
        'pro-variable',
        'image-text2image',
        'image-image2image',
      ]

      for (const key of keys) {
        await restoreSubModeSession(key)
        // Yield to the event loop to keep the UI responsive and reduce long-task pressure.
        await new Promise(resolve => setTimeout(resolve, 0))
      }
      hasRestoredAllSessions.value = true
    })()

    restoreAllInFlight.value = task
    try {
      await task
    } finally {
      restoreAllInFlight.value = null
    }
  }

  const saveAllSessions = async () => {
    // ⚠️ Wait for the current save to complete (at most 5 seconds)
    const startTime = Date.now()
    const MAX_WAIT = 5000 // 5-second timeout

    await restoreAllSessions()

    while (saveInFlight.value) {
      if (Date.now() - startTime > MAX_WAIT) {
        // ⚠️ On timeout return directly and do not force execution (avoids wrongly unlocking)
        console.warn('[SessionManager] Timed out waiting for the save to complete, giving up this save')
        return
      }
      // Retry after waiting 50ms
      await new Promise(resolve => setTimeout(resolve, 50))
    }

    // ⚠️ Record whether the lock was obtained by me (defensive programming)
    let acquired = false

    try {
      saveInFlight.value = true
      acquired = true // ✅ Mark: I obtained the lock

      // IMPORTANT:
      // Save sequentially to reduce peak memory usage for very large sessions.
      // (Parallel JSON.stringify across 6 stores can spike memory and crash the browser on pagehide/unmount.)
      const keys: SubModeKey[] = [
        'basic-system',
        'basic-user',
        'pro-multi',
        'pro-variable',
        'image-text2image',
        'image-image2image',
      ]
      for (const key of keys) {
        await _saveSubModeSessionUnsafe(key)
        await new Promise(resolve => setTimeout(resolve, 0))
      }
    } catch (error) {
      console.error('[SessionManager] Failed to save all sessions:', error)
    } finally {
      // ✅ Only release the lock if I obtained it
      if (acquired) {
        saveInFlight.value = false
      }
    }
  }

  return {
    // State
    isSwitching,

    // Methods
    injectSubModeReaders,
    getActiveSubModeKey,
    computeSubModeKey,
    switchMode,
    switchSubMode,
    saveSubModeSession,
    restoreSubModeSession,
    restoreAllSessions,
    saveAllSessions,
  }
})

export type SessionManagerApi = ReturnType<typeof useSessionManager>
