# Desktop Auto-update System - Design Document

## 🎯 Design Overview

The desktop auto-update system uses a dual-version display design, showing update information for both the stable release and the preview release at the same time so users can choose their own update path.

### Core Design Principles
1. **Clear information hierarchy**: current version → latest stable release → latest preview release
2. **Intuitive and explicit actions**: each version has its own action buttons
3. **Prominent status indicator**: a red "Update Available" label in the top-right corner
4. **Fixed bottom buttons**: only the two buttons "Close" and "Check for Updates"

## 📱 Interface Layout Design

### Complete Layout Structure
```
┌─────────────────────────────────────────┐
│ App Update                               │
├─────────────────────────────────────────┤
│ ┌─ Current Version ──────────────────┐   │
│ │ Current version: v1.2.0            │   │
│ └───────────────────────────────────┘   │
│                                         │
│ ┌─ Latest Stable ────────────────────┐ │
│ │ Stable v1.2.1   [Update Avail.] ↗  │ │
│ │ [Details] [Ignore] [Download]       │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─ Latest Preview ───────────────────┐ │
│ │ Preview v1.3.0-beta.1 [Update Avail.] ↗ │ │
│ │ [Details] [Ignore] [Download]       │ │
│ └─────────────────────────────────────┘ │
│                                         │
├─────────────────────────────────────────┤
│           [Close] [Check for Updates]    │
└─────────────────────────────────────────┘
```

### Status Display Logic
- **Update available**: shows a red "Update Available" label and a link icon in the top-right corner
- **Up to date**: shows green "Up to date" text
- **Checking**: shows a loading animation and "Checking..." text
- **Check failed**: shows an error message and a retry hint

## 🔧 Technical Architecture Design

### Dual-version Check Mechanism
```typescript
// Managed uniformly by the main process to avoid concurrency conflicts
const checkAllVersions = async () => {
  // Check the stable release serially
  autoUpdater.allowPrerelease = false
  const stableResult = await autoUpdater.checkForUpdates()
  
  // Check the preview release after a delay
  await new Promise(resolve => setTimeout(resolve, 1000))
  autoUpdater.allowPrerelease = true
  const prereleaseResult = await autoUpdater.checkForUpdates()
  
  return { stable: stableResult, prerelease: prereleaseResult }
}
```

### Version Comparison Logic
- **Stable comparison**: uses the standard semver comparison
- **Preview comparison**: compares the base version first, then the prerelease identifier
- **Ignored version handling**: supports ignoring the stable and preview releases separately

### State Management Design
```typescript
interface UpdaterState {
  // Check state
  isChecking: boolean
  hasStableUpdate: boolean
  hasPrereleaseUpdate: boolean
  
  // Version information
  currentVersion: string
  stableVersion: string | null
  prereleaseVersion: string | null
  
  // Download state
  isDownloading: boolean
  downloadProgress: number
  isDownloaded: boolean
  
  // Ignore state
  isStableVersionIgnored: boolean
  isPrereleaseVersionIgnored: boolean
}
```

## 🎨 UI Component Design

### Version Information Card
- **Title area**: version type + version number + status label
- **Action area**: details link + ignore button + download button
- **Status indicator**: link icon in the top-right corner (shown when an update is available)

### Button State Design
- **Download button**:
  - Update available and not ignored: shows "Download"
  - Downloading: shows a progress bar
  - Download complete: shows "Install and Restart"
- **Ignore button**: shown only when an update is available
- **Details link**: always shown; clicking opens the GitHub release page

### Responsive Design
- **Minimum width**: 480px
- **Maximum width**: 600px
- **Adaptive height**: adjusts dynamically to the content
- **Mobile adaptation**: optimized button sizes and spacing

## 🔄 Interaction Flow Design

### Update Check Flow
1. The user clicks "Check for Updates"
2. A loading state is shown
3. The main process checks both versions serially
4. The UI is updated to display the result
5. The corresponding action buttons are shown according to the result

### Download and Install Flow
1. The user selects a version and clicks "Download"
2. Download progress is shown
3. After the download completes, an "Install and Restart" button is shown
4. The user clicks install, and the app restarts and updates

### Ignore Version Flow
1. The user clicks the "Ignore" button
2. The ignore state is saved to local storage
3. The update hint for that version is hidden
4. The red-dot state in the main interface is updated

## 🛡️ Error Handling Design

### Network Error Handling
- **Timeout handling**: 30-second timeout, shows a retry hint
- **Connection failure**: shows a network error message
- **Authentication failure**: shows a permission error hint

### Download Error Handling
- **Download interrupted**: supports resuming from a breakpoint
- **Corrupted file**: re-download
- **Insufficient disk space**: shows an insufficient-space hint

### Installation Error Handling
- **Insufficient permissions**: prompts to run as administrator
- **File in use**: prompts to close the related programs
- **Installation failure**: shows detailed error information

## 📊 Performance Optimization Design

### Caching Strategy
- **Version information cache**: valid for 2 hours
- **Download file cache**: keeps the latest version file
- **State persistence**: ignore state stored locally

### Resource Optimization
- **Load on demand**: check for updates only when needed
- **Background check**: automatically check when the app starts
- **Smart reminders**: avoid disturbing users too frequently

---

**Design goal**: Provide an intuitive, reliable and user-friendly auto-update experience so users can easily manage app version updates.
