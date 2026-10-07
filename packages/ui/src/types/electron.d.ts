/**
 * Electron API type definitions
 *
 * Used only by the UI package; defines the Electron API types exposed to the renderer process via contextBridge
 * Kept in sync with the actual implementation in desktop/preload.js
 */

import type {
  ContextPackage,
  ContextListItem,
  ContextBundle,
  ImportMode,
  ImportResult,
  ContextMode
} from '@prompt-optimizer/core'

// Base response type
interface ElectronErrorPayload {
  message: string
  code?: string
  params?: Record<string, unknown>
}

interface ElectronResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string | ElectronErrorPayload
}

// App-related APIs
interface AppAPI {
  getVersion(): Promise<string>
  /** Sync UI locale to Electron main process (for localized native menus, etc.) */
  setLocale(locale: string): Promise<void>
  getPath(name: string): Promise<string>
  quit(): Promise<void>
}

// Updater-related API - simple and direct type definitions
interface UpdaterAPI {
  checkUpdate(): Promise<unknown>
  checkAllVersions(): Promise<{
    currentVersion: string
    stable?: {
      remoteVersion?: string
      remoteReleaseUrl?: string
      error?: string
      noVersionFound?: boolean
      hasUpdate?: boolean
      message?: string
      versionType?: string
      releaseDate?: string
      releaseNotes?: string
    }
    prerelease?: {
      remoteVersion?: string
      remoteReleaseUrl?: string
      error?: string
      noVersionFound?: boolean
      hasUpdate?: boolean
      message?: string
      versionType?: string
      releaseDate?: string
      releaseNotes?: string
    }
  }>
  downloadSpecificVersion(versionType: 'stable' | 'prerelease'): Promise<{
    hasUpdate: boolean
    message: string
    version?: string
    reason?: 'ignored' | 'latest' | 'error'
  }>
  installUpdate(): Promise<void>
  ignoreVersion(version: string, versionType?: 'stable' | 'prerelease'): Promise<void>
  unignoreVersion(versionType: 'stable' | 'prerelease'): Promise<void>
  getIgnoredVersions(): Promise<{
    stable: string | null
    prerelease: string | null
  }>
}

// Shell-related API - simplified types
interface ShellAPI {
  openExternal(url: string): Promise<void>
  showItemInFolder(path: string): Promise<void>
}

// Event listener API
interface EventAPI {
  on<K extends keyof ElectronEventMap>(channel: K, listener: (...args: ElectronEventMap[K]) => void): void
  on(channel: string, listener: (...args: unknown[]) => void): void

  off<K extends keyof ElectronEventMap>(channel: K, listener: (...args: ElectronEventMap[K]) => void): void
  off(channel: string, listener: (...args: unknown[]) => void): void

  once<K extends keyof ElectronEventMap>(channel: K, listener: (...args: ElectronEventMap[K]) => void): void
  once(channel: string, listener: (...args: unknown[]) => void): void
}

interface ElectronEventMap {
  'update-available-info': [UpdateInfo]
  'update-not-available': [{ version?: string; reason?: string }]
  'update-download-progress': [DownloadProgress]
  'update-downloaded': [UpdateInfo]
  'update-error': [{ message?: string; code?: string; error?: string }]
  'updater-download-started': [{ versionType?: 'stable' | 'prerelease'; version?: string }]
}

type LlmStreamCallbacks = {
  onContent?: (content: string) => void
  onThinking?: (thinking: string) => void
  onToolCall?: (toolCall: unknown) => void
  onFinish?: () => void
  onError?: (error: Error) => void
}

interface LlmAPI {
  testConnection(provider: string): Promise<void>
  sendMessage(messages: unknown[], provider: string): Promise<string>
  sendMessageStructured(messages: unknown[], provider: string): Promise<unknown>
  sendMessageStream(messages: unknown[], provider: string, callbacks: LlmStreamCallbacks): Promise<void>
  sendMessageStreamWithTools(messages: unknown[], provider: string, tools: unknown[], callbacks: LlmStreamCallbacks): Promise<void>
  fetchModelList(provider: string, customConfig?: unknown): Promise<Array<{ value: string; label: string }>>
}

// Image generation API
interface ImageAPI {
  generate(request: unknown): Promise<unknown>
  generateText2Image(request: unknown): Promise<unknown>
  generateImage2Image(request: unknown): Promise<unknown>

  validateRequest(request: unknown): Promise<unknown>
  validateText2ImageRequest(request: unknown): Promise<unknown>
  validateImage2ImageRequest(request: unknown): Promise<unknown>

  testConnection(config: unknown): Promise<unknown>
  getDynamicModels(providerId: string, connectionConfig: unknown): Promise<unknown[]>
}

// Image model management API
interface ImageModelAPI {
  ensureInitialized(): Promise<void>
  isInitialized(): Promise<boolean>
  getAllConfigs(): Promise<unknown[]>
  getConfig(id: string): Promise<unknown>
  addConfig(config: unknown): Promise<void>
  updateConfig(id: string, updates: unknown): Promise<void>
  deleteConfig(id: string): Promise<void>
  getEnabledConfigs(): Promise<unknown[]>
  exportData(): Promise<unknown>
  importData(data: unknown): Promise<void>
  getDataType(): Promise<string>
  validateData(data: unknown): Promise<boolean>
}

// Context management API
interface ContextAPI {
  list(): Promise<ContextListItem[]>
  getCurrentId(): Promise<string>
  setCurrentId(id: string): Promise<void>
  get(id: string): Promise<ContextPackage>
  create(meta?: { title?: string; mode?: ContextMode }): Promise<string>
  duplicate(id: string, options?: { mode?: ContextMode }): Promise<string>
  rename(id: string, title: string): Promise<void>
  save(ctx: ContextPackage): Promise<void>
  update(id: string, patch: Partial<ContextPackage>): Promise<void>
  remove(id: string): Promise<void>
  exportAll(): Promise<ContextBundle>
  importAll(bundle: ContextBundle, mode: ImportMode): Promise<ImportResult>
  exportData(): Promise<ContextBundle>
  importData(data: unknown): Promise<void>
  getDataType(): Promise<string>
  validateData(data: unknown): Promise<boolean>
}

// Data management API
interface DataStorageInfo {
  userDataPath: string
  mainFilePath: string
  mainSizeBytes: number
  backupFilePath: string
  backupSizeBytes: number
  totalBytes: number
}

interface DataAPI {
  // Export/import all app data as JSON string
  exportAllData(): Promise<string>
  importAllData(dataString: string): Promise<void>

  // Desktop-only helpers
  getStorageInfo(): Promise<DataStorageInfo>
  openStorageDirectory(): Promise<boolean>
}

// Complete ElectronAPI interface
interface ElectronAPI {
  app: AppAPI
  updater: UpdaterAPI
  shell: ShellAPI
  llm: LlmAPI
  image: ImageAPI
  imageModel: ImageModelAPI
  context: ContextAPI
  data: DataAPI
  on: EventAPI['on']
  off: EventAPI['off']
  once: EventAPI['once']
}

// Global Window type extension
declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }

  // Extend the Error interface to support custom properties
  interface Error {
    detailedMessage?: string
    originalError?: unknown
    code?: string
    params?: Record<string, unknown>
  }
}

// Download progress type
interface DownloadProgress {
  percent: number
  bytesPerSecond: number
  total: number
  transferred: number
}

// Update info type
interface UpdateInfo {
  version: string
  releaseDate?: string
  releaseUrl?: string
  releaseNotes?: string
}

// Version check result type
interface VersionCheckResult {
  remoteVersion?: string
  remoteReleaseUrl?: string
  error?: string
  noVersionFound?: boolean
}

// Download result type
interface DownloadResult {
  hasUpdate: boolean
  message: string
  version?: string
  reason?: 'ignored' | 'latest' | 'error'
}

// Exported types (optional, for reference by other files)
export type {
  ElectronResponse,
  AppAPI,
  UpdaterAPI,
  ShellAPI,
  EventAPI,
  ImageAPI,
  ImageModelAPI,
  ContextAPI,
  DataAPI,
  DataStorageInfo,
  ElectronAPI,
  DownloadProgress,
  UpdateInfo,
  VersionCheckResult,
  DownloadResult
}
