import { ref } from 'vue'

/**
 * Session restore coordinator composable
 *
 * Responsible for coordinating the session restore flow, handling:
 * - Concurrent restore control (mutex lock)
 * - Restore request retries (pendingRestore)
 * - Cleanup after the component unmounts (isUnmounted)
 *
 * Design principles:
 * - Only handles restore coordination logic, not concrete restore implementations
 * - The concrete restore function is provided by the caller
 * - Minimally invasive, lowering the regression risk
 *
 * @param restoreFn The concrete restore function (provided by the caller)
 */
export function useSessionRestoreCoordinator(restoreFn: () => Promise<void> | void) {
  // 🔧 Codex fix: mutex lock, preventing concurrent calls to restoreSessionToUI()
  const isRestoring = ref(false)
  // 🔧 Codex fix: pending restore flag, preventing restore requests from being lost
  // If a new request arrives while isRestoring=true, this flag is set and the restore is re-run after the lock is released
  const pendingRestore = ref(false)
  // 🔧 Codex fix: component unmount flag, so microtasks do not run a restore after unmounting
  const isUnmounted = ref(false)

  /**
   * Run a restore (with coordination logic)
   *
   * Features:
   * 1. Mutex control: only one restore operation may run at a time
   * 2. Request retry: if a new request arrives during a restore, it is re-run after the current restore completes
   * 3. Unmount check: no restore runs after the component unmounts
   */
  const executeRestore = async () => {
    // 🔧 Mutex check: if a restore is in progress, set the pending flag and return
    if (isRestoring.value) {
      console.warn('[SessionRestoreCoordinator] executeRestore is already running, setting the pendingRestore flag')
      pendingRestore.value = true
      return
    }

    isRestoring.value = true
    try {
      // Run the concrete restore logic (provided by the caller)
      await restoreFn()
    } catch (error) {
      // 🔧 Fix: add error handling to avoid unhandled Promise rejections propagating to the Vue watcher
      console.error('[SessionRestoreCoordinator] restore failed', error)
    } finally {
      // 🔧 Release the lock whether it succeeds or fails
      isRestoring.value = false

      // 🔧 Codex fix: if a new request arrived during the restore, re-run once
      // 🔧 Codex suggestion: use queueMicrotask to queue asynchronously, avoiding recursion pressure (rather than await recursion)
      if (pendingRestore.value) {
        pendingRestore.value = false
        console.log('[SessionRestoreCoordinator] Detected pendingRestore, queueing the restore re-run asynchronously')
        queueMicrotask(() => {
          // 🔧 Codex fix: skip the restore after the component unmounts, avoiding pointless work/log noise
          if (isUnmounted.value) {
            console.log('[SessionRestoreCoordinator] The component has unmounted, skipping the pending restore')
            return
          }
          // 🔧 Codex fix: add error handling to avoid unhandled Promise rejections
          void executeRestore().catch(err => {
            console.error('[SessionRestoreCoordinator] pending restore failed', err)
          })
        })
      }
    }
  }

  /**
   * Mark the component as unmounted
   * Should be called in the component's onBeforeUnmount
   */
  const markUnmounted = () => {
    isUnmounted.value = true
  }

  return {
    // State
    isRestoring,
    pendingRestore,
    isUnmounted,

    // Methods
    executeRestore,
    markUnmounted
  }
}
