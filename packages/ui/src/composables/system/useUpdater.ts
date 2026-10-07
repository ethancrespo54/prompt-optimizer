import { reactive, onMounted, onUnmounted, nextTick, inject, type Ref } from 'vue'

import { isRunningInElectron } from '@prompt-optimizer/core'
import { usePreferences } from '../storage/usePreferenceManager'
import { useI18n } from 'vue-i18n'
import { asExtendedError } from '../../utils/error'
// Removed the over-abstracted Hook; use window.electronAPI directly
import type { DownloadProgress, UpdateInfo } from '@/types/electron'
import type { AppServices } from '../../types/services'

// Type definitions are now imported from @/types/electron, kept uniform

export interface UpdaterState {
  hasUpdate: boolean
  updateInfo: UpdateInfo | null
  downloadProgress: DownloadProgress | null
  isDownloading: boolean
  isDownloaded: boolean
  isCheckingUpdate: boolean
  lastCheckResult: 'none' | 'available' | 'not-available' | 'error' | 'dev-disabled'
  lastCheckMessage: string
  stableVersion: string | null
  stableReleaseUrl: string | null
  prereleaseVersion: string | null
  prereleaseReleaseUrl: string | null
  hasStableUpdate: boolean
  hasPrereleaseUpdate: boolean
  currentVersion: string | null
  isDownloadingStable: boolean
  isDownloadingPrerelease: boolean
  downloadMessage: { type: 'error' | 'warning' | 'info', content: string } | null
  lastDownloadAttempt: 'stable' | 'prerelease' | null
  // Ignore state
  isStableVersionIgnored: boolean
  isPrereleaseVersionIgnored: boolean
}

// Updater instance type
interface UpdaterInstance {
  state: UpdaterState
  checkUpdate: () => Promise<void>
  startDownload: () => Promise<void>
  installUpdate: () => Promise<void>
  ignoreUpdate: (version?: string, versionType?: 'stable' | 'prerelease') => Promise<void>
  unignoreUpdate: (versionType: 'stable' | 'prerelease') => Promise<void>
  openReleaseUrl: () => Promise<void>
  downloadStableVersion: () => Promise<void>
  downloadPrereleaseVersion: () => Promise<void>
}

// Global singleton state, ensuring all components share the same state
let globalUpdaterInstance: UpdaterInstance | null = null

export function useUpdater() {
  // If an instance already exists, return it directly
  if (globalUpdaterInstance) {
    return globalUpdaterInstance
  }

  // Environment detection - the features are only enabled in the Electron environment
  const isElectronEnvironment = isRunningInElectron()
  
  if (!isElectronEnvironment) {
    // Non-Electron environments return an empty implementation, keeping the API consistent
    return {
      state: reactive({
        hasUpdate: false,
        updateInfo: null,
        downloadProgress: null,
        isDownloading: false,
        isDownloaded: false,
        isCheckingUpdate: false,
        lastCheckResult: 'none',
        lastCheckMessage: '',
        stableVersion: null,
        stableReleaseUrl: null,
        prereleaseVersion: null,
        prereleaseReleaseUrl: null,
        hasStableUpdate: false,
        hasPrereleaseUpdate: false,
        currentVersion: null,
        isDownloadingStable: false,
        isDownloadingPrerelease: false,
        downloadMessage: null,
        lastDownloadAttempt: null,
        isStableVersionIgnored: false,
        isPrereleaseVersionIgnored: false
      } as UpdaterState),
      checkUpdate: () => Promise.resolve(),
      startDownload: () => Promise.resolve(),
      installUpdate: () => Promise.resolve(),
      ignoreUpdate: () => Promise.resolve(),
      unignoreUpdate: () => Promise.resolve(),
      openReleaseUrl: () => Promise.resolve(),
      downloadStableVersion: () => Promise.resolve(),
      downloadPrereleaseVersion: () => Promise.resolve()
    }
  }

  // Actual implementation for the Electron environment
  const services = inject<Ref<AppServices | null>>('services')
  if (!services) {
    throw new Error('[useUpdater] services injection missing')
  }
  const { setPreference } = usePreferences(services)
  const { t } = useI18n()

  // Use window.electronAPI directly, simple and direct

  const state = reactive<UpdaterState>({
    hasUpdate: false,
    updateInfo: null,
    downloadProgress: null,
    isDownloading: false,
    isDownloaded: false,
    isCheckingUpdate: false,
    lastCheckResult: 'none',
    lastCheckMessage: '',
    stableVersion: null,
    stableReleaseUrl: null,
    prereleaseVersion: null,
    prereleaseReleaseUrl: null,
    hasStableUpdate: false,
    hasPrereleaseUpdate: false,
    currentVersion: null,
    isDownloadingStable: false,
    isDownloadingPrerelease: false,
    downloadMessage: null,
    lastDownloadAttempt: null,
    isStableVersionIgnored: false,
    isPrereleaseVersionIgnored: false
  })



  // IPC event listener references, used for cleanup
  let updateAvailableListener: ((info: UpdateInfo) => void) | null = null
  let updateNotAvailableListener: ((info: { version?: string; reason?: string }) => void) | null = null
  let downloadProgressListener: ((progress: DownloadProgress) => void) | null = null
  let updateDownloadedListener: ((info: UpdateInfo) => void) | null = null
  let updateErrorListener: ((error: { message?: string; code?: string; error?: string }) => void) | null = null
  let downloadStartedListener: ((info: { versionType?: 'stable' | 'prerelease'; version?: string }) => void) | null = null

  // Internal function that checks both versions
  const checkBothVersions = async () => {
    try {
      // Get the current version
      state.currentVersion = await getCurrentVersion()

      // Use the new unified check API to avoid concurrency conflicts
      console.log('[useUpdater] Checking all versions using unified API...')
      const results = await window.electronAPI!.updater.checkAllVersions()

      console.log('[useUpdater] Processing unified check results...', results)

      // Make sure results exists
      if (!results) {
        throw new Error('No results returned from version check')
      }

      // Save the stable version info
      if (results.stable && !results.stable.error && !results.stable.noVersionFound) {
        const newStableVersion = results.stable.remoteVersion || null
        // If the version changed, reset the ignore state
        if (state.stableVersion !== newStableVersion) {
          state.isStableVersionIgnored = false
        }
        state.stableVersion = newStableVersion
        state.stableReleaseUrl = results.stable.remoteReleaseUrl || null
        state.hasStableUpdate = hasUpdate(state.currentVersion || '0.0.0', state.stableVersion || '0.0.0')
        console.log(`[useUpdater] Stable version: current=${state.currentVersion}, remote=${state.stableVersion}, hasUpdate=${state.hasStableUpdate}`)
      } else {
        state.stableVersion = null
        state.stableReleaseUrl = null
        state.hasStableUpdate = false
        state.isStableVersionIgnored = false
        if (results.stable?.noVersionFound) {
          console.log('[useUpdater] No stable version found - this is normal if no stable releases exist yet')
        } else if (results.stable?.error) {
          console.log('[useUpdater] Stable version check failed:', results.stable.error)
        }
      }

      // Save the preview version info
      if (results.prerelease && !results.prerelease.error && !results.prerelease.noVersionFound) {
        const newPrereleaseVersion = results.prerelease.remoteVersion || null
        // If the version changed, reset the ignore state
        if (state.prereleaseVersion !== newPrereleaseVersion) {
          state.isPrereleaseVersionIgnored = false
        }
        state.prereleaseVersion = newPrereleaseVersion || null
        state.prereleaseReleaseUrl = results.prerelease.remoteReleaseUrl || null
        state.hasPrereleaseUpdate = hasUpdate(state.currentVersion || '0.0.0', state.prereleaseVersion || '0.0.0')
        console.log(`[useUpdater] Prerelease version: current=${state.currentVersion}, remote=${state.prereleaseVersion}, hasUpdate=${state.hasPrereleaseUpdate}`)
      } else {
        state.prereleaseVersion = null
        state.prereleaseReleaseUrl = null
        state.hasPrereleaseUpdate = false
        state.isPrereleaseVersionIgnored = false
        if (results.prerelease?.noVersionFound) {
          console.log('[useUpdater] No prerelease version found - this is normal if no prerelease releases exist yet')
        } else if (results.prerelease?.error) {
          console.log('[useUpdater] Prerelease version check failed:', results.prerelease.error)
        }
      }

      // Update the overall state - computed based on the user's preference
      state.hasUpdate = calculateHasUpdate()

      // Set the check result message
      if (state.hasStableUpdate || state.hasPrereleaseUpdate) {
        const updates = []
        if (state.hasStableUpdate) updates.push(`stable v${state.stableVersion}`)
        if (state.hasPrereleaseUpdate) updates.push(`prerelease v${state.prereleaseVersion}`)
        state.lastCheckResult = 'available'
        state.lastCheckMessage = `New versions available: ${updates.join(', ')}`
      } else if (state.stableVersion || state.prereleaseVersion) {
        state.lastCheckResult = 'not-available'
        state.lastCheckMessage = 'You are using the latest versions'
      } else {
        // Check whether it is because there is no published version or the check failed
        const hasStableError = results.stable?.error
        const hasPrereleaseError = results.prerelease?.error
        const hasStableNoVersionFound = results.stable?.noVersionFound
        const hasPrereleaseNoVersionFound = results.prerelease?.noVersionFound

        if (hasStableError || hasPrereleaseError) {
          state.lastCheckResult = 'error'
          const errors = []
          if (hasStableError && results.stable?.error) errors.push(`stable: ${results.stable.error}`)
          if (hasPrereleaseError && results.prerelease?.error) errors.push(`prerelease: ${results.prerelease.error}`)
          state.lastCheckMessage = `Update check failed: ${errors.join(', ')}`
        } else if (hasStableNoVersionFound && hasPrereleaseNoVersionFound) {
          state.lastCheckResult = 'not-available'
          state.lastCheckMessage = 'No releases found. This project may not have published any versions yet.'
        } else if (hasStableNoVersionFound) {
          state.lastCheckResult = 'not-available'
          state.lastCheckMessage = 'No stable releases found. Only prerelease versions may be available.'
        } else {
          state.lastCheckResult = 'error'
          state.lastCheckMessage = 'Unable to check for updates'
        }
      }

    } catch (error) {
      console.error('[useUpdater] Error checking all versions:', error)
      state.lastCheckResult = 'error'
      state.lastCheckMessage = error instanceof Error ? error.message : String(error)
    } finally {
      // Save the detection state whether it succeeds or fails
      state.isCheckingUpdate = false

      // Sync the backend's ignore state
      await syncIgnoredStates()

      await saveUpdateState()

      console.log('[useUpdater] Both versions checked. Final state:', {
        hasStableUpdate: state.hasStableUpdate,
        hasPrereleaseUpdate: state.hasPrereleaseUpdate,
        hasUpdate: state.hasUpdate,
        lastCheckResult: state.lastCheckResult,
        isStableVersionIgnored: state.isStableVersionIgnored,
        isPrereleaseVersionIgnored: state.isPrereleaseVersionIgnored
      })
    }
  }



  // Get the current app version
  const getCurrentVersion = async (): Promise<string | null> => {
    if (isRunningInElectron() && window.electronAPI?.app) {
      try {
        return await window.electronAPI.app.getVersion()
      } catch (error) {
        console.error('[useUpdater] Failed to get app version:', error)
        return null
      }
    }
    console.warn('[useUpdater] Not running in Electron environment')
    return null
  }

  // Semantic version comparison function
  const compareVersions = (version1: string, version2: string): number => {
    // Remove the 'v' prefix (if present)
    const v1 = version1.replace(/^v/, '')
    const v2 = version2.replace(/^v/, '')

    // Parse the version number
    const parseVersion = (version: string) => {
      const parts = version.split('-')
      const mainVersion = parts[0]
      const prerelease = parts[1] || null

      const [major, minor, patch] = mainVersion.split('.').map(num => parseInt(num) || 0)

      return {
        major,
        minor,
        patch,
        prerelease,
        original: version
      }
    }

    const parsed1 = parseVersion(v1)
    const parsed2 = parseVersion(v2)

    // Compare the major version
    if (parsed1.major !== parsed2.major) {
      return parsed1.major - parsed2.major
    }

    // Compare the minor version
    if (parsed1.minor !== parsed2.minor) {
      return parsed1.minor - parsed2.minor
    }

    // Compare the patch version
    if (parsed1.patch !== parsed2.patch) {
      return parsed1.patch - parsed2.patch
    }

    // If the major versions are the same, compare the pre-release versions
    if (parsed1.prerelease && parsed2.prerelease) {
      // Both are pre-release versions; compare as strings
      return parsed1.prerelease.localeCompare(parsed2.prerelease)
    } else if (parsed1.prerelease && !parsed2.prerelease) {
      // v1 is a pre-release version and v2 is a stable version, so v1 < v2
      return -1
    } else if (!parsed1.prerelease && parsed2.prerelease) {
      // v1 is a stable version and v2 is a pre-release version, so v1 > v2
      return 1
    }

    // The versions are identical
    return 0
  }

  // Check whether there is an update (the new version is greater than the current version)
  const hasUpdate = (currentVersion: string, remoteVersion: string): boolean => {
    if (!currentVersion || !remoteVersion) return false
    return compareVersions(remoteVersion, currentVersion) > 0
  }

  // Compute whether there is an update based on the current version type
  const calculateHasUpdate = (): boolean => {
    // Check whether the current version is a preview version
    const isCurrentVersionPrerelease = state.currentVersion?.includes('-') || false

    let result: boolean
    if (isCurrentVersionPrerelease) {
      // Current is a preview version: notify when either the stable or the preview version has an update (and is not ignored)
      const stableUpdateAvailable = state.hasStableUpdate && !state.isStableVersionIgnored
      const prereleaseUpdateAvailable = state.hasPrereleaseUpdate && !state.isPrereleaseVersionIgnored
      result = stableUpdateAvailable || prereleaseUpdateAvailable

      console.log('[calculateHasUpdate] Prerelease user:', {
        hasStableUpdate: state.hasStableUpdate,
        isStableVersionIgnored: state.isStableVersionIgnored,
        stableUpdateAvailable,
        hasPrereleaseUpdate: state.hasPrereleaseUpdate,
        isPrereleaseVersionIgnored: state.isPrereleaseVersionIgnored,
        prereleaseUpdateAvailable,
        result
      })
    } else {
      // Current is a stable version: only notify when the stable version has an update (and is not ignored)
      result = state.hasStableUpdate && !state.isStableVersionIgnored

      console.log('[calculateHasUpdate] Stable user:', {
        hasStableUpdate: state.hasStableUpdate,
        isStableVersionIgnored: state.isStableVersionIgnored,
        result
      })
    }

    return result
  }

  // Save the detection state to persistent storage (excluding the ignore state, which is managed by the backend)
  const saveUpdateState = async () => {
    try {
      await setPreference('updater.lastCheckTime', Date.now())
      await setPreference('updater.hasStableUpdate', state.hasStableUpdate)
      await setPreference('updater.hasPrereleaseUpdate', state.hasPrereleaseUpdate)
      await setPreference('updater.stableVersion', state.stableVersion)
      await setPreference('updater.prereleaseVersion', state.prereleaseVersion)
      await setPreference('updater.stableReleaseUrl', state.stableReleaseUrl)
      await setPreference('updater.prereleaseReleaseUrl', state.prereleaseReleaseUrl)
      await setPreference('updater.lastCheckResult', state.lastCheckResult)
      // Note: the ignore state is no longer saved to the frontend preferences; it is fully managed by the backend
      console.log('[useUpdater] Update state saved to preferences (excluding ignore states)')
    } catch (error) {
      console.warn('[useUpdater] Failed to save update state:', error)
    }
  }

  // Clean up the old detection state cache (simplified logic, re-detect on every startup)
  const clearUpdateStateCache = async () => {
    try {
      // Clean up possibly outdated cached data
      await setPreference('updater.lastCheckTime', 0)
      await setPreference('updater.hasStableUpdate', false)
      await setPreference('updater.hasPrereleaseUpdate', false)
      await setPreference('updater.stableVersion', null)
      await setPreference('updater.prereleaseVersion', null)
      await setPreference('updater.stableReleaseUrl', null)
      await setPreference('updater.prereleaseReleaseUrl', null)
      await setPreference('updater.lastCheckResult', 'none')
      console.log('[useUpdater] Update state cache cleared')
    } catch (error) {
      console.warn('[useUpdater] Failed to clear update state cache:', error)
    }
  }

  // Check for updates - enhanced version, supports a double check
  const checkUpdate = async () => {
    if (!window.electronAPI?.updater) {
      console.warn('[useUpdater] Electron updater API not available')
      return
    }

    // Prevent duplicate checks
    if (state.isCheckingUpdate) {
      console.log('[useUpdater] Update check already in progress')
      return
    }

    try {
      state.isCheckingUpdate = true
      // Clear the previous download message, since this is a new check operation
      state.downloadMessage = null

      // Smart state reset: only reset the download-related state when no download is in progress
      if (!state.isDownloading) {
        state.isDownloaded = false
        state.downloadProgress = null
        state.hasUpdate = false
        state.updateInfo = null
        state.lastCheckResult = 'none'
        state.lastCheckMessage = ''
        // Reset the version update state to make sure every detection updates correctly
        state.hasStableUpdate = false
        state.hasPrereleaseUpdate = false
        state.stableVersion = null
        state.stableReleaseUrl = null
        state.prereleaseVersion = null
        state.prereleaseReleaseUrl = null
        // Note: the ignore state is not reset, so the user's ignore choice stays effective in the new check
        // state.isStableVersionIgnored and state.isPrereleaseVersionIgnored stay unchanged
        // Clear the persisted detection state
        await saveUpdateState()
        console.log('[useUpdater] Reset states for new update check (keeping ignore states)')
      } else {
        console.log('[useUpdater] Download in progress, preserving download states')
      }

      // Check both versions: stable and preview
      await checkBothVersions()
    } catch (error) {
      console.error('[useUpdater] Check update error:', error)
      const extendedError = asExtendedError(error)
      if (extendedError) {
        console.error('[DEBUG] Error properties:', {
          message: extendedError.message,
          detailedMessage: extendedError.detailedMessage,
          originalError: extendedError.originalError,
          stack: extendedError.stack
        })
      }

      state.lastCheckResult = 'error'
      if (extendedError) {
        if (extendedError.detailedMessage) {
          // Check whether it is a missing-config-file error in the development environment
          if (extendedError.detailedMessage.includes('dev-app-update.yml') && extendedError.detailedMessage.includes('ENOENT')) {
            state.lastCheckMessage = 'Development environment: Update checking is disabled (no dev-app-update.yml configured)'
          } else {
            state.lastCheckMessage = extendedError.detailedMessage
          }
        } else if (extendedError.originalError !== undefined) {
          state.lastCheckMessage = String(extendedError.originalError)
        } else {
          let detailedMessage = `Client Error: ${extendedError.message}`
          if (extendedError.stack) {
            detailedMessage += `\n\nStack Trace:\n${extendedError.stack}`
          }
          state.lastCheckMessage = detailedMessage
        }
      } else {
        state.lastCheckMessage = String(error ?? 'Update check failed')
      }
    } finally {
      state.isCheckingUpdate = false
    }
  }

  // Start download - deprecated, please use downloadStableVersion or downloadPrereleaseVersion
  const startDownload = async () => {
    console.warn('[useUpdater] startDownload is deprecated, use downloadStableVersion or downloadPrereleaseVersion instead')

    // For backward compatibility, if there is an available update, try to download the corresponding version type
    if (state.hasStableUpdate) {
      await downloadStableVersion()
    } else if (state.hasPrereleaseUpdate) {
      await downloadPrereleaseVersion()
    } else {
      console.warn('[useUpdater] No update available for download')
    }
  }

  // Install the update
  const installUpdate = async () => {
    if (!window.electronAPI?.updater) {
      console.warn('[useUpdater] Electron updater API not available')
      return
    }

    try {
      await window.electronAPI.updater.installUpdate()
      console.log('[useUpdater] Update installation initiated successfully')
    } catch (error) {
      console.error('[useUpdater] Install update error:', error)
    }
  }

  // Sync the ignore state from the backend
  const syncIgnoredStates = async () => {
    if (!window.electronAPI?.updater?.getIgnoredVersions) {
      console.warn('[useUpdater] getIgnoredVersions API not available')
      return
    }

    try {
      const ignoredVersions = await window.electronAPI.updater.getIgnoredVersions()
      console.log('[useUpdater] Retrieved ignored versions from backend:', ignoredVersions)

      // Compute the frontend ignore state based on the current version and the backend ignore state
      state.isStableVersionIgnored = !!(ignoredVersions.stable && state.stableVersion && ignoredVersions.stable === state.stableVersion)
      state.isPrereleaseVersionIgnored = !!(ignoredVersions.prerelease && state.prereleaseVersion && ignoredVersions.prerelease === state.prereleaseVersion)

      console.log('[useUpdater] Synced ignore states:', {
        stableVersion: state.stableVersion,
        ignoredStableVersion: ignoredVersions.stable,
        isStableVersionIgnored: state.isStableVersionIgnored,
        prereleaseVersion: state.prereleaseVersion,
        ignoredPrereleaseVersion: ignoredVersions.prerelease,
        isPrereleaseVersionIgnored: state.isPrereleaseVersionIgnored
      })

      // Recompute the overall update state
      state.hasUpdate = calculateHasUpdate()
      console.log('[useUpdater] hasUpdate after sync:', state.hasUpdate)
    } catch (error) {
      console.error('[useUpdater] Failed to sync ignored states:', error)
    }
  }

  // Ignore a version
  const ignoreUpdate = async (version?: string, versionType?: 'stable' | 'prerelease') => {
    if (!window.electronAPI?.updater) {
      console.warn('[useUpdater] Electron updater API not available')
      return
    }

    try {
      const versionToIgnore = version || state.updateInfo?.version
      if (!versionToIgnore) return

      // If no type is specified, determine it automatically from the version number
      const actualVersionType = versionType || (versionToIgnore.includes('-') ? 'prerelease' : 'stable')

      console.log('[useUpdater] Before ignore - hasUpdate:', state.hasUpdate, 'isStableVersionIgnored:', state.isStableVersionIgnored, 'isPrereleaseVersionIgnored:', state.isPrereleaseVersionIgnored)

      // ignoreVersion returns null (data) on success and throws an exception on failure
      await window.electronAPI.updater.ignoreVersion(versionToIgnore, actualVersionType)

      // Update the frontend state immediately so the UI responds right away
      if (actualVersionType === 'stable') {
        state.isStableVersionIgnored = true
        console.log('[useUpdater] Immediately set isStableVersionIgnored = true')
      } else if (actualVersionType === 'prerelease') {
        state.isPrereleaseVersionIgnored = true
        console.log('[useUpdater] Immediately set isPrereleaseVersionIgnored = true')
      }

      // Recompute the hasUpdate state immediately
      const oldHasUpdate = state.hasUpdate
      state.hasUpdate = calculateHasUpdate()
      console.log('[useUpdater] Immediately updated hasUpdate from', oldHasUpdate, 'to', state.hasUpdate)

      // If the ignored version is the current updateInfo, clean it up
      if (state.updateInfo?.version === versionToIgnore) {
        state.updateInfo = null
        console.log('[useUpdater] Cleared updateInfo for ignored version')
      }

      // Wait for the next tick to make sure the state update is complete
      await nextTick()

      // Sync the backend state asynchronously (to verify consistency)
      syncIgnoredStates().catch(error => {
        console.error('[useUpdater] Failed to sync ignored states after ignore:', error)
      })

      console.log('[useUpdater] Version ignored successfully:', versionToIgnore, 'type:', actualVersionType, 'final hasUpdate:', state.hasUpdate)
    } catch (error) {
      console.error('[useUpdater] Ignore version error:', error)
    }
  }

  // Unignore a version
  const unignoreUpdate = async (versionType: 'stable' | 'prerelease') => {
    if (!window.electronAPI?.updater?.unignoreVersion) {
      console.warn('[useUpdater] unignoreVersion API not available')
      return
    }

    try {
      console.log('[useUpdater] Before unignore - hasUpdate:', state.hasUpdate, 'isStableVersionIgnored:', state.isStableVersionIgnored, 'isPrereleaseVersionIgnored:', state.isPrereleaseVersionIgnored)

      // Call the backend API to unignore
      await window.electronAPI.updater.unignoreVersion(versionType)

      // Update the frontend state immediately so the UI responds right away
      if (versionType === 'stable') {
        state.isStableVersionIgnored = false
        console.log('[useUpdater] Immediately set isStableVersionIgnored = false')
      } else if (versionType === 'prerelease') {
        state.isPrereleaseVersionIgnored = false
        console.log('[useUpdater] Immediately set isPrereleaseVersionIgnored = false')
      }

      // Recompute the hasUpdate state immediately
      const oldHasUpdate = state.hasUpdate
      state.hasUpdate = calculateHasUpdate()
      console.log('[useUpdater] Immediately updated hasUpdate from', oldHasUpdate, 'to', state.hasUpdate)

      // Wait for the next tick to make sure the state update is complete
      await nextTick()

      // Sync the backend state asynchronously (to verify consistency)
      syncIgnoredStates().catch(error => {
        console.error('[useUpdater] Failed to sync ignored states after unignore:', error)
      })

      console.log('[useUpdater] Version unignored successfully:', versionType, 'final hasUpdate:', state.hasUpdate)
    } catch (error) {
      console.error('[useUpdater] Unignore version error:', error)
    }
  }



  // Download the stable version (using an atomic operation)
  const downloadStableVersion = async () => {
    if (!state.stableVersion) {
      console.warn('[useUpdater] No stable version available for download')
      state.downloadMessage = { type: 'warning', content: t('updater.noStableVersionAvailable') }
      state.lastDownloadAttempt = 'stable'
      return
    }

    // Prevent duplicate clicks - check all download states
    if (state.isDownloadingStable || state.isDownloadingPrerelease || state.isDownloading) {
      console.log('[useUpdater] Download already in progress')
      return
    }

    try {
      console.log('[useUpdater] Starting atomic stable version download...')
      state.isDownloadingStable = true
      state.downloadMessage = null
      state.lastDownloadAttempt = 'stable'

      // Use the new atomic operation API
      if (!window.electronAPI?.updater?.downloadSpecificVersion) {
        throw new Error('electronAPI not available')
      }
      const result = await window.electronAPI.updater.downloadSpecificVersion('stable')

      if (!result) {
        throw new Error('No result data returned from download request')
      }

      if (result.hasUpdate) {
        console.log('[useUpdater] Stable download started:', result.message)
        // Set the download state immediately so the UI displays correctly
        state.isDownloading = true
        state.downloadProgress = null
      } else {
        console.log('[useUpdater] No stable update available:', result.message)
        // Show different messages for different reasons
        let content: string
        if (result.reason === 'ignored' && result.version) {
          content = t('updater.versionIgnored', { version: result.version })
        } else if (result.version) {
          content = t('updater.alreadyLatestStable', { version: result.version })
        } else {
          content = t('updater.noStableVersionAvailable')
        }

        state.downloadMessage = {
          type: 'info',
          content
        }
      }

    } catch (error) {
      console.error('[useUpdater] Atomic stable download error:', error)

      // Extract the full error message
      let errorMessage = t('updater.unknownError')
      if (error instanceof Error) {
        errorMessage = error.message
      }

      state.downloadMessage = {
        type: 'error',
        content: t('updater.stableDownloadFailed', { error: errorMessage })
      }
      // Make sure the download state is reset
      state.isDownloading = false
      state.downloadProgress = null
    } finally {
      state.isDownloadingStable = false
    }
  }

  // Download the preview version (using an atomic operation)
  const downloadPrereleaseVersion = async () => {
    if (!state.prereleaseVersion) {
      console.warn('[useUpdater] No prerelease version available for download')
      state.downloadMessage = { type: 'warning', content: t('updater.noPrereleaseVersionAvailable') }
      state.lastDownloadAttempt = 'prerelease'
      return
    }

    // Prevent duplicate clicks - check all download states
    if (state.isDownloadingStable || state.isDownloadingPrerelease || state.isDownloading) {
      console.log('[useUpdater] Download already in progress')
      return
    }

    try {
      console.log('[useUpdater] Starting atomic prerelease version download...')
      state.isDownloadingPrerelease = true
      state.downloadMessage = null
      state.lastDownloadAttempt = 'prerelease'

      // Use the new atomic operation API
      if (!window.electronAPI?.updater?.downloadSpecificVersion) {
        throw new Error('electronAPI not available')
      }
      const result = await window.electronAPI.updater.downloadSpecificVersion('prerelease')

      if (!result) {
        throw new Error('No result data returned from download request')
      }

      if (result.hasUpdate) {
        console.log('[useUpdater] Prerelease download started:', result.message)
        // Set the download state immediately so the UI displays correctly
        state.isDownloading = true
        state.downloadProgress = null
      } else {
        console.log('[useUpdater] No prerelease update available:', result.message)
        // Show different messages for different reasons
        let content: string
        if (result.reason === 'ignored' && result.version) {
          content = t('updater.versionIgnored', { version: result.version })
        } else if (result.version) {
          content = t('updater.alreadyLatestPrerelease', { version: result.version })
        } else {
          content = t('updater.noPrereleaseVersionAvailable')
        }

        state.downloadMessage = {
          type: 'info',
          content
        }
      }

    } catch (error) {
      console.error('[useUpdater] Atomic prerelease download error:', error)

      // Extract the full error message
      let errorMessage = t('updater.unknownError')
      if (error instanceof Error) {
        errorMessage = error.message
      }

      state.downloadMessage = {
        type: 'error',
        content: t('updater.prereleaseDownloadFailed', { error: errorMessage })
      }
      // Make sure the download state is reset
      state.isDownloading = false
      state.downloadProgress = null
    } finally {
      state.isDownloadingPrerelease = false
    }
  }

  // Open the release page
  const openReleaseUrl = async () => {
    if (!state.updateInfo?.releaseUrl || !window.electronAPI?.shell) {
      console.warn('[useUpdater] Release URL or shell API not available')
      return
    }

    try {
      await window.electronAPI.shell.openExternal(state.updateInfo.releaseUrl)
      console.log('[useUpdater] Release URL opened successfully')
    } catch (error) {
      console.error('[useUpdater] Open release URL error:', error)
    }
  }

  // Set up the IPC event listeners - now mainly used for download-related events
  const setupEventListeners = () => {
    if (!window.electronAPI?.on) {
      console.warn('[useUpdater] Event API not available')
      return
    }

    // Update available - kept for scenarios such as automatic checks
    updateAvailableListener = (info: UpdateInfo) => {
      console.log('[useUpdater] Update available (from auto-check):', info)
      state.updateInfo = info
      state.lastCheckResult = 'available'
      state.lastCheckMessage = `New version ${info.version} is available`
      // Do not set hasUpdate directly; compute it through calculateHasUpdate
      state.hasUpdate = calculateHasUpdate()
      console.log('[useUpdater] Update available event processed, hasUpdate:', state.hasUpdate)
    }
    window.electronAPI.on('update-available-info', updateAvailableListener)

    // No update available - now mainly used for logging; the actual logic is handled in the request-response flow
    updateNotAvailableListener = (info: { version?: string; reason?: string }) => {
      console.log('[useUpdater] No update available (from auto-check):', info)
      // Note: the UI state is no longer updated here, to avoid conflicts with the request-response pattern
    }
    window.electronAPI.on('update-not-available', updateNotAvailableListener)

    // Download progress
    downloadProgressListener = (progress: DownloadProgress) => {
      console.log('[useUpdater] Download progress:', progress)
      state.downloadProgress = progress
    }
    window.electronAPI.on('update-download-progress', downloadProgressListener)

    // Download complete
    updateDownloadedListener = (info: UpdateInfo) => {
      console.log('[useUpdater] Update downloaded:', info)
      state.isDownloading = false
      state.isDownloaded = true
      // Reset the specific download state
      state.isDownloadingStable = false
      state.isDownloadingPrerelease = false
      // Clear the download message
      state.downloadMessage = null
    }
    window.electronAPI.on('update-downloaded', updateDownloadedListener)

    // Update error (including download errors)
    updateErrorListener = (error: { message?: string; code?: string; error?: string }) => {
      console.error('[useUpdater] Update error:', error)

      // Simple handling: reset the download state and keep the update info so the user can retry
      state.isDownloading = false
      state.downloadProgress = null
      state.lastCheckResult = 'error'
      // Reset the specific download state
      state.isDownloadingStable = false
      state.isDownloadingPrerelease = false

      // Set the user-visible download error message
      const errorMessage = error.message || error.error || 'Update check failed'

      if (state.lastDownloadAttempt) {
        const versionType = state.lastDownloadAttempt === 'stable' ? t('updater.stable') : t('updater.prerelease')
        state.downloadMessage = {
          type: 'error',
          content: t('updater.downloadFailedGeneric', { type: versionType, error: errorMessage })
        }
      }

      // Use the detailed error message, preferring the message field (it contains the details)
      state.lastCheckMessage = errorMessage
      // Keep hasUpdate and updateInfo so the user can download again
    }
    window.electronAPI.on('update-error', updateErrorListener)

    // Download start event - sync the UI state immediately
    downloadStartedListener = (info: { versionType?: 'stable' | 'prerelease'; version?: string }) => {
      console.log('[useUpdater] Download started:', info)
      // Set the download state immediately to make sure the UI responds
      state.isDownloading = true
      state.downloadProgress = null
      // Set the corresponding download state based on the version type
      if (info.versionType === 'stable') {
        state.isDownloadingStable = true
      } else if (info.versionType === 'prerelease') {
        state.isDownloadingPrerelease = true
      }
      // Clear the previous message
      state.downloadMessage = null
    }
    window.electronAPI.on('updater-download-started', downloadStartedListener)
  }

  // Clean up the event listeners
  const cleanupEventListeners = () => {
    if (!window.electronAPI?.off) return

    if (updateAvailableListener) {
      window.electronAPI.off('update-available-info', updateAvailableListener)
    }
    if (updateNotAvailableListener) {
      window.electronAPI.off('update-not-available', updateNotAvailableListener)
    }
    if (downloadProgressListener) {
      window.electronAPI.off('update-download-progress', downloadProgressListener)
    }
    if (updateDownloadedListener) {
      window.electronAPI.off('update-downloaded', updateDownloadedListener)
    }
    if (updateErrorListener) {
      window.electronAPI.off('update-error', updateErrorListener)
    }
    if (downloadStartedListener) {
      window.electronAPI.off('updater-download-started', downloadStartedListener)
    }
  }

  // Initialize
  onMounted(async () => {
    try {
      // Get the current version
      state.currentVersion = await getCurrentVersion()
      console.log('[useUpdater] Current version loaded:', state.currentVersion)

      // Set up the event listeners
      setupEventListeners()

      // Clean up the old cached data
      await clearUpdateStateCache()

      // Sync the backend's ignore state to make sure the frontend and backend are consistent
      await syncIgnoredStates()

      // Automatically check for updates on every startup to make sure the state is up to date
      console.log('[useUpdater] Performing automatic update check on startup')
      // Auto-detect after a 3-second delay to avoid affecting the app startup speed
      setTimeout(() => {
        checkUpdate().catch(error => {
          console.warn('[useUpdater] Automatic update check failed:', error)
        })
      }, 3000)

      console.log('[useUpdater] Updater initialized')
    } catch (error) {
      console.error('[useUpdater] Initialization error:', error)
    }
  })

  // Cleanup
  onUnmounted(() => {
    cleanupEventListeners()
  })

  const instance = {
    state,
    checkUpdate,
    startDownload,
    installUpdate,
    ignoreUpdate,
    unignoreUpdate,
    openReleaseUrl,
    downloadStableVersion,
    downloadPrereleaseVersion
  }

  // Cache the instance to ensure it is a singleton
  globalUpdaterInstance = instance
  return instance
}
