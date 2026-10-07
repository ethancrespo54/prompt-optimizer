# Desktop App Release and Smart Update System - Technical Implementation Details

## 1. Overall Design Goals

Build a professional, cross-platform, user-experience-first desktop app update system. The system should be non-intrusive, give full control to the user, and ensure the stability of the update process and the safety of data.

---

## 2. Packaging and Release Strategy (CI/CD)

**Goal**: Automatically build installers that support auto-update and portable packages for advanced users, and publish them to GitHub Releases.

- **Files involved**:
  - `packages/desktop/package.json`
  - `.github/workflows/release.yml`

#### 2.1. Build Configuration (`package.json`)

1.  **Core dependency**: Add `electron-updater` to `dependencies`.
2.  **Update source configuration**: Under the `build` node, add a `publish` configuration pointing to the project's GitHub repository (provide `owner` and `repo`).
3.  **Multi-target builds**:
    -   `win.target`: set to `['nsis', 'zip']`, generating both a Windows installer and a portable package.
    -   `mac.target`: set to `['dmg', 'zip']`, generating both a macOS installer and a portable package.
    -   `linux.target`: set to `['AppImage', 'zip']`, generating both a Linux installer and a portable package.

#### 2.2. Automated Workflow (`release.yml`)

1.  **Upload all artifacts**: In the three `job`s `build-windows`, `build-macos` and `build-linux`, modify the `actions/upload-artifact` step to make sure all generated files (such as `*.exe`, `*.dmg`, `*.AppImage`, `*.zip`, `*.yml`) are uploaded, not just `.zip`.
2.  **Publish all artifacts**: In the final `create-release` `job`, modify the `files` parameter of `softprops/action-gh-release` to use a wildcard (such as `artifacts/**/*`) to attach all downloaded `artifact` files to the GitHub Release.

---

## 3. Core Update Logic (Main Process)

**Goal**: Write robust main-process logic that serves as the backend engine of the whole interactive update flow.

- **Files involved**: `packages/desktop/main.js`

#### 3.1. The `checkUpdate` Async Function

1.  **Read persisted settings**: At the start of the function, asynchronously read the values of `updater.allowPrerelease` and `updater.ignoredVersion` from `PreferenceService`.
2.  **Configure the updater**:
    -   Set `autoUpdater.allowPrerelease` according to the loaded preference.
    -   **Must** set `autoUpdater.autoDownload = false`, handing download control to the user.
3.  **Handle the `update-available` event**:
    -   **Smart ignore**: On the first line of the callback, check: `if (info.version === ignoredVersion) return;`. If the discovered version is one the user has ignored, terminate the flow early.
    -   **Build the details link**: Based on the `publish` configuration in `package.json` and `info.version`, dynamically build the `releaseUrl` pointing to the GitHub Release page.
    -   **Send the notification**: Send an object containing the version information and `releaseUrl` to the UI layer via IPC (`update-available-info`).

#### 3.2. IPC Handlers

1.  **`start-download-update`**: Calls `autoUpdater.downloadUpdate()` to start downloading the update.
2.  **`install-update`**: Calls `autoUpdater.quitAndInstall()` to install the update and restart the app.
3.  **`ignore-update`**: Receives a version number parameter and saves it to `updater.ignoredVersion` in `PreferenceService`.
4.  **`open-external-link`**: Receives a URL parameter and uses `shell.openExternal()` to open the link in the user's default browser.

---

## 4. UI Layer Interaction Design

**Goal**: Design a simple, intuitive user interface that lets users easily control the update flow.

- **Files involved**:
  - `packages/ui/src/composables/useUpdater.ts`
  - `packages/ui/src/components/UpdaterIcon.vue`
  - `packages/ui/src/components/UpdaterModal.vue`

#### 4.1. `useUpdater` Composable

1.  **State management**: Define reactive states such as `hasUpdate`, `updateInfo`, `downloadProgress`, `isDownloading`, `isDownloaded` and `allowPrerelease`.
2.  **IPC communication**: Wrap the IPC communication with the main process, providing methods such as `checkUpdate`, `startDownload`, `installUpdate`, `ignoreUpdate` and `togglePrerelease`.
3.  **Event listening**: Listen for the `update-available-info`, `update-download-progress` and `update-downloaded` events sent by the main process, and update the corresponding states.

#### 4.2. The `UpdaterIcon` Component

1.  **Conditional rendering**: Shown only in the Electron environment, using `isRunningInElectron()` for environment detection.
2.  **Status indication**: Show an update hint (such as a red dot) based on the `hasUpdate` state.
3.  **Click interaction**: Clicking the icon opens the `UpdaterModal` component.

#### 4.3. The `UpdaterModal` Component

1.  **Multi-state views**:
    -   **Default state**: Shows the current version and provides a "Check for Updates" button.
    -   **Update available**: Shows the new version information and provides "Download", "View Details" and "Ignore" buttons.
    -   **Downloading**: Shows a download progress bar.
    -   **Download complete**: Provides an "Install and Restart" button.
2.  **User control**: Provides a prerelease toggle that lets users choose whether to receive prerelease updates.

---

## 5. Compatibility Across Product Forms

**Goal**: Ensure the update feature is visible only in the desktop environment and completely transparent to the Web and Extension environments.

#### 5.1. Environment Detection

Use the `isRunningInElectron()` function from the `@prompt-optimizer/core` package for environment detection:

```typescript
import { isRunningInElectron } from '@prompt-optimizer/core'

// Show the update component only in the Electron environment
<div v-if="isRunningInElectron()">
  <UpdaterIcon />
</div>
```

#### 5.2. Conditional Rendering Strategy

1.  **Component level**: Perform environment detection inside the `UpdaterIcon` component; return empty directly in non-Electron environments.
2.  **Composable level**: Provide an empty implementation in `useUpdater` to keep the API consistent.
3.  **Integration level**: Conditionally include the update component in `App.vue`.

---

## 6. Security Considerations

#### 6.1. External Link Safety

In the `open-external-link` IPC handler, validate the URL's protocol and only allow `http://` and `https://` links:

```javascript
if (!url.startsWith('http://') && !url.startsWith('https://')) {
  throw new Error('Only HTTP and HTTPS URLs are allowed');
}
```

#### 6.2. Version Validation

Validate the format of received version numbers to prevent malicious input:

```javascript
const versionRegex = /^v?\d+\.\d+\.\d+(-[\w.-]+)?(\+[\w.-]+)?$/;
if (!versionRegex.test(version)) {
  throw new Error('Invalid version format');
}
```

#### 6.3. Configuration Safety

Use a configuration file to manage sensitive information and avoid hardcoding:

```javascript
const { buildReleaseUrl, validateVersion } = require('./config/update-config');
```

---

## 7. Error Handling and Recovery

#### 7.1. Network Error Handling

1.  **Timeout mechanism**: Set reasonable timeouts for all network requests.
2.  **Retry strategy**: Allow users to manually retry failed operations.
3.  **Degraded handling**: Provide basic functionality when the service is unavailable.

#### 7.2. State Recovery

1.  **Smart reset**: Decide the state reset strategy based on the user's operation context.
2.  **Error boundaries**: Set up error boundaries around critical operations.
3.  **State locks**: Use state locks to prevent state confusion caused by concurrent operations.

---

## 8. Performance Optimization

#### 8.1. Event Listener Management

1.  **Lifecycle management**: Register listeners when the component mounts and clean them up when it unmounts.
2.  **Avoid duplicate registration**: Ensure event listeners are registered only once at app startup.
3.  **Memory leak protection**: Properly clean up all event listeners.

#### 8.2. State Update Optimization

1.  **Batch updates**: Merge related state update operations.
2.  **Conditional updates**: Trigger updates only when the state actually changes.
3.  **Async processing**: Use async operations to avoid blocking the UI.

---

## 9. Testing Strategy

#### 9.1. Multi-environment Testing

1.  **Web environment**: Verify that the update component is not shown.
2.  **Desktop environment**: Verify the complete update flow.
3.  **Build testing**: Verify the multi-platform build artifacts.

#### 9.2. Edge Case Testing

1.  **Network interruption**: Test network failures during download.
2.  **Concurrent operations**: Test scenarios where users repeat actions quickly.
3.  **Error recovery**: Test the recovery mechanisms for various abnormal situations.

---

## 10. Deployment and Maintenance

#### 10.1. Release Process

1.  **Version tagging**: Use semantic version numbers.
2.  **Automated builds**: Build and publish automatically through CI/CD.
3.  **Quality checks**: Perform complete quality verification before release.

#### 10.2. Monitoring and Maintenance

1.  **Update success rate**: Monitor the success rate of update operations.
2.  **Error logs**: Collect and analyze error logs.
3.  **User feedback**: Establish a user feedback mechanism.

---

## 11. Summary

This technical solution implements a complete, secure and user-friendly desktop app auto-update system. Through the compatibility design across product forms, the update feature is visible only in the environments that need it. Through thorough error handling and state management, the stability and reliability of the system are ensured.

## 12. In-depth Refactoring Technical Implementation

### 12.1. Error Handling Mechanism Refactoring

#### Detailed Error Response Function
```javascript
function createDetailedErrorResponse(error) {
  const timestamp = new Date().toISOString();
  let detailedMessage = `[${timestamp}] Error Details:\n\n`;

  if (error instanceof Error) {
    detailedMessage += `Message: ${error.message}\n`;
    if (error.code) detailedMessage += `Code: ${error.code}\n`;
    if (error.statusCode) detailedMessage += `HTTP Status: ${error.statusCode}\n`;
    if (error.url) detailedMessage += `URL: ${error.url}\n`;
    if (error.stack) detailedMessage += `\nStack Trace:\n${error.stack}\n`;

    // Capture other properties and the JSON fallback mechanism
    const jsonError = JSON.stringify(error, Object.getOwnPropertyNames(error), 2);
    if (jsonError && jsonError !== '{}') {
      detailedMessage += `\nComplete Object Dump:\n${jsonError}`;
    }
  }

  return { success: false, error: detailedMessage };
}
```

#### Preserving Error Information in preload.js
```javascript
// Before the fix: detailed information was lost
if (!result.success) {
  throw new Error(result.error);
}

// After the fix: full information is preserved
if (!result.success) {
  const error = new Error(result.error);
  error.originalError = result.error;
  error.detailedMessage = result.error;
  throw error;
}
```

### 12.2. Component Architecture Refactoring

#### Smart Component Design
```vue
<!-- UpdaterModal.vue - smart component -->
<script setup lang="ts">
// Manages all update logic internally
const {
  state,
  checkUpdate,
  startDownload,
  installUpdate,
  ignoreUpdate,
  togglePrerelease,
  openReleaseUrl
} = useUpdater()

// Simplified interface
interface Props {
  modelValue: boolean
}

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>
```

#### Simplified Component Design
```vue
<!-- UpdaterIcon.vue - simplified component -->
<script setup lang="ts">
// Only gets the state for icon display
const { state } = useUpdater()

// Only manages modal display
const showModal = ref(false)
</script>

<template>
  <!-- Minimal invocation -->
  <UpdaterModal v-model="showModal" />
</template>
```

### 12.3. Smart Handling of the Development Environment

#### Environment Detection Logic
```javascript
// Update check configuration in development mode
if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
  const fs = require('fs');
  const devConfigPath = path.join(__dirname, 'dev-app-update.yml');
  if (fs.existsSync(devConfigPath)) {
    autoUpdater.forceDevUpdateConfig = true;
  } else {
    // Return a friendly development environment hint
    responseData.message = 'Development environment: Update checking is disabled';
    return createSuccessResponse(responseData);
  }
}
```

### 12.4. State Management System

#### State Type Definitions
```typescript
interface UpdaterState {
  lastCheckResult: 'none' | 'available' | 'not-available' | 'error' | 'dev-disabled'
  // ... other states
}
```

#### State Transition Logic
```javascript
if (checkData.hasUpdate && checkData.checkResult?.updateInfo) {
  state.lastCheckResult = 'available'
} else if (checkData.remoteVersion && !checkData.hasUpdate) {
  state.lastCheckResult = 'not-available'
} else if (checkData.message?.includes('Development environment')) {
  state.lastCheckResult = 'dev-disabled'
} else {
  state.lastCheckResult = 'error'
}
```

### 12.5. Dynamic UI Implementation

#### Show Different Buttons Based on State
```vue
<template #footer>
  <!-- Development environment: show only the close button -->
  <div v-if="state.lastCheckResult === 'dev-disabled'">
    <button @click="$emit('update:modelValue', false)">Close</button>
  </div>

  <!-- Default state: close + check now -->
  <div v-else-if="!state.hasUpdate && !state.isCheckingUpdate">
    <button @click="$emit('update:modelValue', false)">Close</button>
    <button @click="handleCheckUpdate">Check Now</button>
  </div>

  <!-- Update available: multiple action buttons -->
  <div v-else-if="state.hasUpdate">
    <button @click="handleStartDownload">Download Update</button>
  </div>
</template>
```

Key features:
- **User control**: users fully control the timing and choice of updates
- **Environment adaptation**: graceful compatibility across product forms
- **Secure and reliable**: complete security validation and error handling
- **Easy to maintain**: configuration-driven design and thorough documentation
- **Robust architecture**: clear component responsibilities and thorough error handling
- **Developer friendly**: smart environment detection and detailed error diagnostics
