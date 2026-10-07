/**
 * Static constant definitions
 * This file only contains pure static constants, with no dynamic logic or side effects
 * It can be loaded safely in the sandbox environment of the Electron preload script
 */

// IPC event name constants
const IPC_EVENTS = {
  UPDATE_CHECK: 'updater-check-update',
  UPDATE_CHECK_ALL_VERSIONS: 'updater-check-all-versions',
  UPDATE_START_DOWNLOAD: 'updater-start-download',
  UPDATE_INSTALL: 'updater-install-update',
  UPDATE_IGNORE_VERSION: 'updater-ignore-version',
  UPDATE_UNIGNORE_VERSION: 'updater-unignore-version',
  UPDATE_GET_IGNORED_VERSIONS: 'updater-get-ignored-versions',
  UPDATE_DOWNLOAD_SPECIFIC_VERSION: 'updater-download-specific-version',
  UPDATE_DOWNLOAD_STARTED: 'updater-download-started',

  // Events sent from the main process to the renderer process
  UPDATE_AVAILABLE_INFO: 'update-available-info',
  UPDATE_NOT_AVAILABLE: 'update-not-available',
  UPDATE_DOWNLOAD_PROGRESS: 'update-download-progress',
  UPDATE_DOWNLOADED: 'update-downloaded',
  UPDATE_ERROR: 'update-error'
};

// Preference key name constants
const PREFERENCE_KEYS = {
  IGNORED_VERSIONS: 'updater.ignoredVersions' // Multi-version ignore storage
};

// Default config
const DEFAULT_CONFIG = {
  autoDownload: false,
  checkInterval: 24 * 60 * 60 * 1000, // 24 hours
  timeout: 30000 // 30 seconds
};

module.exports = {
  IPC_EVENTS,
  PREFERENCE_KEYS,
  DEFAULT_CONFIG
};
