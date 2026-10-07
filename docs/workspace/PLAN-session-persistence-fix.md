# Session Persistence Fix Plan

## 📋 Problem Description

### Symptom
A user opens the app in incognito mode, changes the value of a dropdown (optimization model, test model, template), and then refreshes the page. The selected value is lost and reverts to the default.

### User Expectation
After changing a dropdown and refreshing the page, the selection should be preserved.

---

## 🔍 Problem Analysis

### Root Cause
**When a dropdown is changed, the data is not saved to persistent storage immediately; only memory is updated.**

### Data Flow Analysis

#### Current implementation (the problematic flow):
```
User changes the dropdown
  ↓
The dropdown component fires an update event
  ↓
The session store's updateOptimizeModel(modelKey) is called
  ↓
The in-memory ref is updated: selectedOptimizeModelKey.value = modelKey  ✅
  ↓
[Problem] saveSession() is not called  ❌
  ↓
User refreshes the page
  ↓
The pagehide event fires, but the async save has not completed
  ↓
The page refreshes and memory is cleared
  ↓
restoreSession() restores data from IndexedDB
  ↓
[Problem] The restored data is stale or the defaults  ❌
  ↓
The dropdown shows the wrong value
```

#### The correct flow should be:
```
User changes the dropdown
  ↓
updateOptimizeModel(modelKey) is called
  ↓
Update memory: selectedOptimizeModelKey.value = modelKey  ✅
  ↓
[Fix] Call saveSession() immediately  ✅
  ↓
saveSession() asynchronously saves to IndexedDB
  ↓
User refreshes the page
  ↓
restoreSession() restores data from IndexedDB
  ↓
The dropdown shows the correct value  ✅
```

---

## 🛠️ Approaches Already Tried

### Approach 1: Debounced save (abandoned)
**What was implemented**:
- Added a `createDebounceSave` function in the session store
- Called `debouncedSave()` in methods such as `updateOptimizeModel`
- Debounce delay of 500ms

**Problems**:
- ❌ A 500ms delay is too long; if the user refreshes within 500ms, data is lost
- ❌ It complicated the problem and introduced extra state management
- ❌ It violated the "save immediately" principle

### Approach 2: Synchronous save on pagehide (abandoned)
**What was implemented**:
- Added a synchronous localStorage write in `handlePagehide` in `PromptOptimizerApp.vue`

**Problems**:
- ❌ Only saves some fields (selectedOptimizeModelKey, selectedTemplateId)
- ❌ Logic error: the `if (existingData)` check prevents saving on the first change
- ❌ It broke the architecture (bypassed the core layer abstraction)

### Approach 3: Remove debounce and call saveSession directly (current approach)
**What was implemented**:
- Removed the debounce mechanism
- Called `saveSession()` directly in methods such as `updateOptimizeModel`

**Problems**:
- ❌ The test still fails; the data is not saved
- ⚠️ `saveSession()` may be async but is not awaited
- ⚠️ The `saveSession()` call may be failing

### Approach 4: Double save (sync + async)
**What was implemented**:
- In `updateOptimizeModel`, first write to localStorage synchronously
- Then call `saveSession()` asynchronously to save to IndexedDB

**Problems**:
- ❌ It violates the architectural principles (bypasses the core layer)
- ❌ Logic error: the `if (existingData)` check prevents saving on the first change

---

## 📂 Key File Locations

### Session Store Files
```
packages/ui/src/stores/session/
├── useBasicSystemSession.ts
├── useBasicUserSession.ts
├── useProVariableSession.ts
├── useProMultiMessageSession.ts
├── useImageText2ImageSession.ts
└── useImageImage2ImageSession.ts
```

### Session Manager
```
packages/ui/src/stores/session/useSessionManager.ts
```

### App Initialization
```
packages/ui/src/components/app-layout/PromptOptimizerApp.vue
```

### Storage Initialization
```
packages/ui/src/composables/system/useAppInitializer.ts
```

### Test File
```
tests/e2e/session-persistence/basic-user-persistence.spec.ts
```

---

## 📊 Current Code State

### Problems in `useBasicUserSession.ts`

#### 1. The updateOptimizeModel method
```typescript
const updateOptimizeModel = (modelKey: string) => {
  if (selectedOptimizeModelKey.value === modelKey) return
  selectedOptimizeModelKey.value = modelKey
  lastActiveAt.value = Date.now()

  // [Problem] Synchronous save to localStorage
  try {
    const key = 'session/v1/basic-user'
    const existing = localStorage.getItem(key)
    if (existing) {  // ⚠️ Key problem: existing is null on the first change
      const data = JSON.parse(existing)
      data.selectedOptimizeModelKey = modelKey
      data.lastActiveAt = lastActiveAt.value
      localStorage.setItem(key, JSON.stringify(data))
    }
  } catch (err) {
    console.warn('[BasicUserSession] Synchronous save failed:', err)
  }

  // [Problem] Async save, but not awaited
  saveSession()  // ⚠️ Async call, but does not wait for completion
}
```

**Problem analysis**:
1. The synchronous save has a logic error: the `if (existing)` check prevents saving on the first change
2. `saveSession()` is async but not awaited, so the caller does not know when it finishes
3. There is no error handling mechanism

#### 2. The saveSession method
```typescript
const saveSession = async () => {
  console.log('[BasicUserSession] saveSession called')
  const $services = getPiniaServices()
  if (!$services?.preferenceService) {
    console.warn('[BasicUserSession] PreferenceService unavailable, cannot save session')
    return
  }

  try {
    const sessionState = {
      prompt: prompt.value,
      optimizedPrompt: optimizedPrompt.value,
      reasoning: reasoning.value,
      chainId: chainId.value,
      versionId: versionId.value,
      testContent: testContent.value,
      testResults: testResults.value,
      selectedOptimizeModelKey: selectedOptimizeModelKey.value,
      selectedTestModelKey: selectedTestModelKey.value,
      selectedTemplateId: selectedTemplateId.value,
      selectedIterateTemplateId: selectedIterateTemplateId.value,
      isCompareMode: isCompareMode.value,
      lastActiveAt: lastActiveAt.value,
    }
    console.log('[BasicUserSession] Saving session, selectedOptimizeModelKey:', sessionState.selectedOptimizeModelKey)

    await $services.preferenceService.set(
      'session/v1/basic-user',
      JSON.stringify(sessionState)
    )

    console.log('[BasicUserSession] Session saved successfully')
  } catch (error) {
    console.error('[BasicUserSession] Failed to save session:', error)
  }
}
```

**Problem analysis**:
- ✅ The implementation looks correct
- ⚠️ But these logs were not seen in the test, which suggests it may not be called
- ⚠️ Or PreferenceService is unavailable

---

## 🧪 Test Results

### Test File Location
```
tests/e2e/session-persistence/basic-user-persistence.spec.ts
```

### Test Strategy
- ✅ Removed the dependency on localStorage
- ✅ Changed to verify the UI state (the value shown in the dropdown)

### Test Results (latest)
```
Initial optimization model: DeepSeekDeepSeek
Switched to model: SiliconFlowSiliconFlow
After switching: SiliconFlowSiliconFlow  ✅ UI updated successfully
After refresh: DeepSeekDeepSeek  ❌ Reverted to the initial value

Expected: "SiliconFlowSiliconFlow"
Actual: "DeepSeekDeepSeek"
```

**Conclusion**: The data was not saved to IndexedDB, or was not restored correctly.

---

## 🎯 Suggested Next Steps

### Suggestion 1: Simplify and use synchronous saving
**Rationale**:
- Since `saveSession()` is async and users refresh quickly, the async operation may not finish in time
- Switch to a synchronous localStorage save

**Implementation steps**:
1. Remove all `saveSession()` calls
2. Write to localStorage synchronously and directly in methods such as `updateOptimizeModel`
3. Change `restoreSession` to read from localStorage
4. Keep the PreferenceService async save as a backup (optional)

**Pros**:
- ✅ Simple and direct, highly reliable
- ✅ Does not depend on async operations completing
- ✅ No data loss when the user refreshes quickly

**Cons**:
- ❌ Bypasses the core layer abstraction (PreferenceService)
- ❌ But session data is UI-layer data anyway, so using localStorage is reasonable

### Suggestion 2: Fix the async save flow
**Rationale**:
- Keep the existing architecture (using PreferenceService)
- Ensure the async save completes correctly

**Implementation steps**:
1. Check whether `saveSession()` is really called (add logs to verify)
2. Check whether `preferenceService.set()` succeeds
3. Check whether `restoreSession()` reads data from IndexedDB correctly
4. Check whether `restoreSession()` is called when the page loads

**Debugging methods**:
- Add a `console.log` at the start of `updateOptimizeModel`
- Add a `console.log` at the start of `saveSession`
- Add `console.log` before and after `preferenceService.set()`
- Add a `console.log` at the start and end of `restoreSession`
- Run the test and check the browser console logs

### Suggestion 3: Use watch for automatic saving
**Rationale**:
- Use Vue's `watch` to observe ref changes
- Automatically call `saveSession()` when a ref changes

**Implementation steps**:
```typescript
// Add in the store
watch(selectedOptimizeModelKey, (newValue) => {
  saveSession()
})
```

**Pros**:
- ✅ Automatic, no need to call `saveSession()` manually
- ✅ Decoupled: update logic and save logic are separated

**Cons**:
- ⚠️ It is still an async save and may not finish in time

---

## 🚫 Pitfalls to Avoid

### 1. Do not over-optimize
- ❌ Do not use debounce (the user may refresh quickly)
- ❌ Do not use throttle (the last update may be lost)
- ✅ Save immediately, simple and direct

### 2. Do not break the architecture
- ❌ Do not save in multiple places (localStorage + IndexedDB)
- ❌ Do not bypass the core layer abstraction (unless there is a good reason)
- ✅ Use PreferenceService consistently

### 3. Do not rely on async completion
- ❌ Do not assume async operations will finish before the page refreshes
- ❌ Do not use pagehide as the only save opportunity
- ✅ Save immediately when the data changes

---

## 📝 Additional Information

### Architecture Notes
- **Storage layer**: PreferenceService (core layer abstraction)
- **Storage provider**: DexieStorageProvider (web environment, uses IndexedDB)
- **Session Store**: Pinia store (UI layer)
- **Restore timing**: `restoreAllSessions()` is called at app startup

### Related Code
- `useAppInitializer.ts`: initializes PreferenceService
- `useSessionManager.ts`: manages saving and restoring of all sessions
- `PromptOptimizerApp.vue`: calls `restoreAllSessions()` during app initialization

### Known Issues
1. The web environment uses DexieStorageProvider (IndexedDB), not localStorage
2. `preferenceService.set()` adds a `pref:` prefix
3. The actual storage key is `pref:session/v1/basic-user`, not `session/v1/basic-user`

---

## ✅ Acceptance Criteria

The fixed code should satisfy:
1. ✅ The value is saved immediately after the user changes a dropdown
2. ✅ After the user refreshes the page, the dropdown shows the correct value
3. ✅ Even if the user refreshes immediately after switching, the data is preserved
4. ✅ The code is simple and clear, without introducing complex state management
5. ✅ The existing architecture is not broken (use PreferenceService wherever possible)
6. ✅ E2E tests pass

---

## 🔗 Related Resources

- User discussion: the user stressed that "all write operations should be saved immediately"
- User's view: don't "patch things up"; find the root of the problem
- User requirement: use the core layer storage abstraction (PreferenceService); do not manipulate localStorage directly in tests
