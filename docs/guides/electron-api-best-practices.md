# Electron API Best Practices Guide

## 🎯 Core Principle

**Keep it simple, call directly, and resolve IDE warnings through type definitions**

## 📝 The Correct Approach

### 1. Complete the Type Definitions

Define the complete API types in `packages/ui/src/types/electron.d.ts`:

```typescript
declare global {
  interface Window {
    electronAPI: {
      updater: {
        checkAllVersions(): Promise<{
          currentVersion: string
          stable?: {
            remoteVersion?: string
            hasUpdate?: boolean
            message?: string
            releaseDate?: string
            releaseNotes?: string
            remoteReleaseUrl?: string
          }
          prerelease?: {
            remoteVersion?: string
            hasUpdate?: boolean
            message?: string
            releaseDate?: string
            releaseNotes?: string
            remoteReleaseUrl?: string
          }
        }>
        installUpdate(): Promise<void>
        ignoreVersion(version: string, versionType?: 'stable' | 'prerelease'): Promise<void>
        downloadSpecificVersion(versionType: 'stable' | 'prerelease'): Promise<{
          hasUpdate: boolean
          message: string
          version?: string
          reason?: 'ignored' | 'latest' | 'error'
        }>
      }
      shell: {
        openExternal(url: string): Promise<void>
        showItemInFolder(path: string): Promise<void>
      }
      on: (event: string, callback: Function) => void
      off: (event: string, callback: Function) => void
    }
  }
}
```

### 2. Use the API Directly

Call it directly in business code, with no wrapper:

```typescript
// ✅ Correct usage
export function useUpdater() {
  const checkBothVersions = async () => {
    try {
      // Direct call: type-safe, no IDE warnings
      const results = await window.electronAPI!.updater.checkAllVersions()
      
      // Use the returned data directly
      console.log('Current version:', results.currentVersion)
      if (results.stable?.hasUpdate) {
        console.log('Stable update available:', results.stable.remoteVersion)
      }
      
      return results
    } catch (error) {
      console.error('Version check failed:', error)
      throw error
    }
  }

  const installUpdate = async () => {
    try {
      await window.electronAPI!.updater.installUpdate()
      console.log('Update installation initiated')
    } catch (error) {
      console.error('Install failed:', error)
    }
  }

  const openReleaseUrl = async (url: string) => {
    try {
      await window.electronAPI!.shell.openExternal(url)
    } catch (error) {
      console.error('Failed to open URL:', error)
    }
  }

  return {
    checkBothVersions,
    installUpdate,
    openReleaseUrl
  }
}
```

### 3. Event Listening

```typescript
// ✅ Correct event listening
const setupEventListeners = () => {
  if (!window.electronAPI?.on) return

  const updateAvailableListener = (info: any) => {
    console.log('Update available:', info)
  }

  window.electronAPI.on('update-available-info', updateAvailableListener)

  // Cleanup function
  return () => {
    if (window.electronAPI?.off) {
      window.electronAPI.off('update-available-info', updateAvailableListener)
    }
  }
}
```

## ❌ Anti-Patterns to Avoid

### 1. Over-Abstraction

```typescript
// ❌ Wrong: unnecessary wrapper layer
const useElectronAPI = () => {
  const safeCall = async (apiCall) => {
    try {
      const data = await apiCall()
      return { success: true, data }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  return {
    updater: {
      checkAllVersions: () => safeCall(() => window.electronAPI.updater.checkAllVersions())
    }
  }
}
```

### 2. Complex Response Formats

```typescript
// ❌ Wrong: introduces an unnecessary wrapper format
const response = await electronAPI.updater.checkAllVersions()
if (!response.success) {  // Adds complexity
  throw new Error(response.error)
}
const data = response.data  // Redundant unwrapping
```

## 🔧 preload.js Best Practices

Keep preload.js simple:

```javascript
// ✅ Correct: simple and direct
const electronAPI = {
  updater: {
    checkAllVersions: async () => {
      const result = await ipcRenderer.invoke('update-check-all-versions')
      if (!result.success) {
        throw new Error(result.error)
      }
      return result.data  // Return the data directly
    },
    
    installUpdate: async () => {
      const result = await ipcRenderer.invoke('update-install')
      if (!result.success) {
        throw new Error(result.error)
      }
      // Returns void, no data to return
    }
  },
  
  shell: {
    openExternal: async (url) => {
      const result = await ipcRenderer.invoke('shell-open-external', url)
      if (!result.success) {
        throw new Error(result.error)
      }
      // Returns void
    }
  },
  
  on: (event, callback) => ipcRenderer.on(event, callback),
  off: (event, callback) => ipcRenderer.off(event, callback)
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
```

## 🎯 Key Takeaways

1. **Type safety comes from type definitions**, not runtime wrappers
2. **Keep API calls direct** and reduce abstraction layers
3. **Handle errors in the business layer**, not by wrapping them in the API layer
4. **preload.js only exposes the API** and does not contain complex logic
5. **Solve the core problem first** and avoid over-engineering

## 🚀 Benefits

- **Better performance**: No extra function call overhead
- **Easy debugging**: Problems trace directly to the source
- **Clear code**: The intent is explicit and easy to understand
- **Easy maintenance**: Fewer abstraction layers to maintain
- **Type safety**: Full TypeScript support

---

**Remember**: The best abstraction is no abstraction. Only introduce complexity when it is truly needed.
