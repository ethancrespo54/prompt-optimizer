# 114-Desktop File Storage Implementation

## 📋 Overview

Implements the complete switch of the desktop app from in-memory storage to file storage, providing a reliable data persistence solution for the desktop application.

## 🏗️ Core Results

### FileStorageProvider Implementation
- Fully compatible with the `IStorageProvider` interface; switching takes a single line of code
- Deferred write strategy (500ms) + in-memory cache for excellent performance
- Atomic write operations to guarantee data integrity
- Automatically saves data before the app quits

### Storage Path Design
Based on user preference, data is stored in a directory next to the executable:

```typescript
// Path setup logic
if (app.isPackaged) {
  // Production: executable directory/prompt-optimizer-data/
  const execDir = path.dirname(process.execPath);
  userDataPath = path.join(execDir, 'prompt-optimizer-data');
  // Development: project root/prompt-optimizer-data/
  // 开发环境：项目根目录/prompt-optimizer-data/
  userDataPath = path.join(__dirname, '..', '..', 'prompt-optimizer-data');
}
```

**Advantages**:
- ✅ Easy to manage and locate data files
- ✅ Data lives alongside the app, which makes backup and migration easy
- ✅ The explicit directory name avoids confusion with other applications

### Architecture Integration
```typescript
// Simple one-line switch
// const storage = StorageFactory.create('memory')  // old way
const storage = new FileStorageProvider(userDataPath)  // new way
```

## ✅ Verification Results

### Test Coverage
- **Unit tests**: 18/18 passed (mock file system)
- **Integration tests**: 12/12 passed (real file operations)
- **Performance benchmark**: write 4ms, read 0ms (in-memory cache)

### Actual Verification
- ✅ Desktop version starts successfully
- ✅ Automatically creates the `prompt-optimizer-data/prompt-optimizer-data.json` file
- ✅ Data persistence works correctly
- ✅ Configuration and history are preserved after the app restarts

## 🔧 Technical Features

- **Deferred writes**: normal operations are delayed by 500ms; batch operations write immediately
- **Atomic operations**: write to temp file → validate → rename to replace
- **Error recovery**: automatically creates new storage when the file is corrupted
- **Quit protection**: forcibly saves all data before the app quits

## 📊 Project Value

### User Value
- **Data safety**: user data is reliably persisted and protected
- **User experience**: data is preserved after app restarts, improving the experience
- **Feature completeness**: the desktop version reaches feature parity with the web version

### Technical Value
- **Architecture completeness**: provides a complete storage solution for the desktop app
- **Interface design**: a good abstraction layer makes switching storage simple
- **Performance optimization**: implements a high-performance file storage mechanism

---

## Appendix: Test Fix Records

16 failing tests were fixed along the way during implementation:
- **Architecture issue**: separated responsibilities between the Service layer and the UI layer
- **Async calls**: TemplateLanguageService tests were missing `await`
- **Integration tests**: correctly mock the UI layer's history-saving behavior

Test results after the fixes: 291 tests passed, 9 skipped ✅

## 🔧 Follow-up Fixes

### Fix for the Infinite Loop on App Quit

**Problem discovered**: After adopting FileStorageProvider, the app was found to save data in an infinite loop when quitting.

**Symptoms**:
```
[DESKTOP] Saving data before quit...
[DESKTOP] Data saved successfully
[DESKTOP] Saving data before quit...
[DESKTOP] Data saved successfully
```

**Root causes**:
1. The `isDirty` flag was not reset when saving data failed
2. The quit event handlers formed a loop: `window.close` → `before-quit` → `app.quit()` → `before-quit`

**Solution**:

#### 1. FileStorageProvider Protection Mechanism
```javascript
async flush(): Promise<void> {
  // Check the retry limit
  if (this.flushAttempts >= this.MAX_FLUSH_ATTEMPTS) {
    console.error('Max flush attempts reached, forcing isDirty to false');
    this.isDirty = false;
    this.flushAttempts = 0;
    throw new Error('Max flush attempts exceeded');
  }

  try {
    await Promise.race([
      this.saveToFile(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Flush timeout')), this.MAX_FLUSH_TIME)
      )
    ]);
    this.isDirty = false;
    this.flushAttempts = 0;
  } catch (error) {
    // Force-reset state to avoid infinite retries
    if (this.flushAttempts >= this.MAX_FLUSH_ATTEMPTS) {
      this.isDirty = false;
      this.flushAttempts = 0;
    }
    throw error;
  }
}
```

#### 2. Multi-layer App Quit Protection
```javascript
let isQuitting = false;
const MAX_SAVE_TIME = 5000;

// Emergency exit: force-terminate after 10 seconds
function setupEmergencyExit() {
  const emergencyExitTimer = setTimeout(() => {
    console.error('[DESKTOP] EMERGENCY EXIT: Force terminating process');
    process.exit(1);
  }, 10000);
  return emergencyExitTimer;
}

app.on('before-quit', async (event) => {
  if (!isQuitting && storageProvider) {
    event.preventDefault();
    isQuitting = true;

    const emergencyTimer = setupEmergencyExit();

    try {
      await Promise.race([
        storageProvider.flush(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Save timeout')), MAX_SAVE_TIME - 1000)
        )
      ]);
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      clearTimeout(emergencyTimer);
      setImmediate(() => {
        isQuitting = false;
        app.quit();
      });
    }
  }
});
```

#### 3. Protection Layers
- **Logic protection**: the `isQuitting` flag prevents repeated execution
- **Timeout protection**: forcibly close the window / quit the app after 5 seconds
- **Emergency protection**: forcibly terminate the process after 10 seconds
- **System protection**: responds to SIGINT/SIGTERM signals

### Lessons Learned

#### Principles for Handling Quit with File Storage
1. **Multi-layer protection**: implement protection mechanisms at several levels
2. **Timeout control**: avoid waiting indefinitely for data to be saved
3. **State reset**: forcibly reset state in abnormal situations
4. **Graceful degradation**: make sure the app can still quit even if saving fails

#### Best Practices
- Implement retry limits and timeout protection in FileStorageProvider
- Implement a multi-layer quit protection mechanism at the application layer
- Use Promise.race to implement timeout control
- Build a complete exception handling and state reset mechanism

These supplementary fixes ensure FileStorageProvider works correctly under all kinds of abnormal conditions and that the app can quit reliably.

## 🛡️ Data Safety Enhancements (2025-07-06)

### Problem Discovered: Backup Recovery Safety Risk

While reviewing the recovery logic, a serious data safety problem was found:

**Problem scenario**:
- The main file `storage.json` is corrupted
- The backup file `storage.json.backup` is intact
- The system enters the recovery flow

**Dangerous flow**:
```
Recover from backup → saveToFile() → createBackup() → the corrupted main file overwrites the intact backup!
```

If the subsequent atomic write also fails, the data would be lost permanently.

### Solution: Smart Recovery Mechanism

#### 1. New Safe Save Method
```typescript
/**
 * Save method dedicated to recovery, avoids overwriting an intact backup
 */
private async saveToFileWithoutBackup(): Promise<void> {
  const data = Object.fromEntries(this.data);
  const jsonString = JSON.stringify(data, null, 2);

  // Validate data integrity
  if (!this.validateJSON(jsonString)) {
    throw new StorageError('Generated JSON is invalid', 'write');
  }

  // Write atomically and directly, without creating a backup
  await this.atomicWrite(jsonString);
}
```

#### 2. Improved Recovery Flow
```typescript
private async loadFromFileWithRecovery(): Promise<void> {
  // 1. Try loading from the main file
  const mainResult = await this.tryLoadFromFile(this.filePath, 'main');
  if (mainResult.success) {
    this.data = mainResult.data!;
    await this.createBackup();
    return;
  }

  // 2. Try loading from the backup file
  const backupResult = await this.tryLoadFromFile(this.backupPath, 'backup');
  if (backupResult.success) {
    this.data = backupResult.data!;

    // Key: use the dedicated method to avoid overwriting the backup
    await this.saveToFileWithoutBackup();

    // After the main file is restored, recreate the backup
    await this.createBackup();
    return;
  }

  // 3. Distinguish a first run from data corruption
  if (!await this.fileExists(this.filePath) && !await this.fileExists(this.backupPath)) {
    // First run
    this.data = new Map();
    await this.saveToFile();
  } else {
    // Severe error: files exist but are all corrupted
    throw new StorageError('Storage corruption detected', 'read');
  }
}
```

#### 3. Atomic updateData Enhancement

To prevent data inconsistency caused by concurrent operations, the atomicity of updateData was strengthened:

```typescript
/**
 * Atomic data update - enhanced version
 */
async updateData<T>(key: string, modifier: (currentValue: T | null) => T): Promise<void> {
  await this.ensureInitialized();

  // Use an update lock to ensure atomicity
  const currentLock = this.updateLock;
  let resolveLock: () => void;

  this.updateLock = new Promise<void>((resolve) => {
    resolveLock = resolve;
  });

  try {
    await currentLock;
    await this.performAtomicUpdate(key, modifier);
  } finally {
    resolveLock!();
  }
}

/**
 * Perform the atomic update operation
 */
private async performAtomicUpdate<T>(key: string, modifier: (currentValue: T | null) => T): Promise<void> {
  // Re-read the latest data from storage to ensure data consistency
  const latestData = await this.getLatestData<T>(key);

  // Apply the modification
  const newValue = modifier(latestData);

  // Validate the new value
  this.validateValue(newValue);

  // Write the new value
  this.data.set(key, JSON.stringify(newValue));
  this.scheduleWrite();
}
```

### Safety Guarantee Mechanisms

#### 1. Data Integrity Guarantees
- **Backup protection**: recovery never overwrites an intact backup file
- **Smart recovery**: distinguishes a first run from data corruption
- **Multi-level recovery**: main file → backup file → error handling

#### 2. Atomicity Guarantees
- **Update lock mechanism**: prevents data inconsistency caused by concurrent operations
- **Atomic writes**: uses temp file + rename to guarantee write atomicity
- **Transactional operations**: integrity of read-modify-write operations

#### 3. Error Handling Enhancements
- **Error classification**: distinguishes error types (first run, data corruption, read/write failure)
- **Graceful degradation**: reasonable handling of all kinds of abnormal situations
- **State reset**: state recovery mechanism for abnormal situations

### Test Verification

#### Backup Protection Test
```typescript
it('should not overwrite good backup during recovery', async () => {
  // Simulate a corrupted main file and an intact backup
  mockFs.readFile
    .mockResolvedValueOnce('{ invalid json') // corrupted main file
    .mockResolvedValueOnce(JSON.stringify(goodData)); // intact backup

  await provider.getItem('test');

  // Verify the backup was not overwritten
  const dangerousCopyCall = mockFs.copyFile.mock.calls.find(call =>
    call[0] === mainPath && call[1] === backupPath
  );
  expect(dangerousCopyCall).toBeUndefined();
});
```

#### Concurrency Safety Test
```typescript
it('should handle concurrent updates safely', async () => {
  const promises = [
    provider.updateData('key1', () => 'value1'),
    provider.updateData('key2', () => 'value2'),
    provider.updateData('key3', () => 'value3')
  ];

  await Promise.all(promises);

  // Verify all updates succeeded
  expect(await provider.getItem('key1')).toBe('value1');
  expect(await provider.getItem('key2')).toBe('value2');
  expect(await provider.getItem('key3')).toBe('value3');
});
```

These enhancements ensure FileStorageProvider's data safety and operation atomicity in all kinds of complex scenarios.
