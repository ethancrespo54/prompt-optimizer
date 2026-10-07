# 116 - Desktop Packaging Optimization

## Overview

Changes the desktop app from single-file portable mode to ZIP archive mode, which resolves the storage path detection problem and simplifies the code architecture.

## Background

### Existing Problems

1. **Storage path problem**:
   - In portable mode, `process.execPath` points to a temporary extraction directory
   - Data was saved in the temp directory and cleaned up after the app closed
   - The path detection logic was complex and error-prone

2. **Architectural complexity**:
   - Complex path detection and fallback logic was required
   - Lots of debug code and log output
   - Main process logs were hard to view in production

## Solution

### 1. Change the Packaging Configuration

**Before (different formats)**:
```json
{
  "win": { "target": "portable" },
  "mac": { "target": "dmg" },
  "linux": { "target": "AppImage" }
}
```

**Now (unified ZIP format)**:
```json
{
  "win": {
    "target": "zip",
    "artifactName": "${productName}-${version}-${os}-${arch}.${ext}"
  },
  "mac": {
    "target": "zip",
    "artifactName": "${productName}-${version}-${os}-${arch}.${ext}"
  },
  "linux": {
    "target": "zip",
    "artifactName": "${productName}-${version}-${os}-${arch}.${ext}"
  }
}
```

### 2. Simplify the Storage Path Logic

**Before (complex detection)**:
- Multiple path detection methods
- Temp directory checks
- Complex fallback logic
- Lots of debug logs

**Now (simplified logic)**:
```javascript
if (app.isPackaged) {
  // Portable mode after the ZIP package is extracted
  const exePath = app.getPath('exe');
  const execDir = path.dirname(exePath);
  userDataPath = path.join(execDir, 'prompt-optimizer-data');
} else {
  // Development environment
  userDataPath = path.join(__dirname, '..', '..', 'prompt-optimizer-data');
}
```

### 3. Remove Debug Code

- Delete the `debugLog` function
- Remove file log output
- Delete the debug API and IPC interfaces
- Simplify error handling

## Implementation Steps

### 1. Change the Packaging Configuration
- Update `packages/desktop/package.json`
- Switch to the ZIP target format

### 2. Simplify main.js
- Remove the complex path detection logic
- Delete the debug log function
- Simplify the storage initialization code

### 3. Clean Up preload.js
- Remove the debug API interfaces

### 4. Update Documentation and Workflows
- Modify the GitHub Actions workflow
- Update the usage instructions in README.md
- Create the archive document

## Advantages

### 1. Technical Advantages
- ✅ **Reliable paths**: paths are deterministic after ZIP extraction, with no temp directory problem
- ✅ **Concise code**: the complex detection logic is removed, improving maintainability
- ✅ **Better performance**: no extra file I/O operations

### 2. User Experience
- ✅ **Truly portable**: the data stays wherever you extract the app
- ✅ **Easy to manage**: one folder contains the app plus its data
- ✅ **Easy to back up**: copy the folder to make a complete backup

### 3. Distribution Advantages
- ✅ **Clear file names**: include version, OS and architecture information
- ✅ **Easy to download**: a single ZIP file contains everything
- ✅ **Cross-platform consistency**: all platforms use the same distribution method

## Usage

### Build
```bash
cd packages/desktop
pnpm run build
```

### Distribution
- **Windows**: `PromptOptimizer-1.2.0-win-x64.zip`
- **macOS**: `PromptOptimizer-1.2.0-darwin-x64.zip` / `PromptOptimizer-1.2.0-darwin-arm64.zip`
- **Linux**: `PromptOptimizer-1.2.0-linux-x64.zip`

All platforms:
- Users extract to any directory
- Run the corresponding executable
- Data is saved in the `prompt-optimizer-data/` directory

### Data Management
- **Backup**: copy the entire application folder
- **Migration**: move the entire folder to a new location
- **Upgrade**: replace the exe file and keep the data directory

## Lessons Learned

1. **Simple is beautiful**: simple ZIP extraction beats complex path detection
2. **User-friendly**: portable mode better matches user expectations
3. **Maintainability**: simplified code is easier to maintain and debug
4. **Reliability**: fewer edge cases improve stability

## Future Optimizations

1. **Auto update**: consider adding an in-app update feature
2. **Installer option**: provide a traditional installer for users who need it
3. **Data migration**: provide a tool to migrate data from older versions
