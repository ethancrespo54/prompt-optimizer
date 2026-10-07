/**
 * Platform detection utility
 * Used to identify the operating system and provide platform-related config
 */

export interface Platform {
  /** Whether macOS */
  isMac: boolean
  /** Whether Windows */
  isWindows: boolean
  /** Whether Linux */
  isLinux: boolean
  /** Get the undo shortcut */
  getUndoKey: () => string
  /** Get the redo shortcut */
  getRedoKey: () => string
  /** Get the command key (Mac: Cmd, other: Ctrl) */
  getCommandKey: () => string
}

/**
 * Detect the current platform
 * @returns Platform info object
 */
export function getPlatform(): Platform {
  const platform = navigator.platform.toUpperCase()
  const isMac = platform.indexOf('MAC') >= 0
  const isWindows = platform.indexOf('WIN') >= 0
  const isLinux = platform.indexOf('LINUX') >= 0

  return {
    isMac,
    isWindows,
    isLinux,
    getUndoKey: () => (isMac ? 'Cmd+Z' : 'Ctrl+Z'),
    getRedoKey: () => (isMac ? 'Cmd+Shift+Z' : 'Ctrl+Y'),
    getCommandKey: () => (isMac ? 'Cmd' : 'Ctrl')
  }
}

/**
 * Global platform instance (singleton)
 */
export const platform = getPlatform()
