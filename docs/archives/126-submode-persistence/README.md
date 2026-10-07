# 126 - Sub-mode Persistence and Navigation Bar Unification

## 📋 Feature Overview

Implement independent persistence of the sub-modes of the three function modes (Basic / Context / Image), and move all sub-mode selectors into the navigation bar to improve the consistency of the user experience.

## ⏱️ Timeline

- **Start date**: 2025-10-22
- **Completion date**: 2025-10-22
- **Total time**: About 8 hours

## 🎯 Core Goals

### Main Goals
1. ✅ Implement independent persistence of the sub-modes of the three function modes
2. ✅ Move all sub-mode selectors into the navigation bar
3. ✅ Ensure complete state isolation (Basic and Context modes are stored independently even though their sub-mode names are the same)
4. ✅ Fix the problem of imageMode not being restored when Image mode initializes

### Secondary Goals
1. ✅ Maintain backward compatibility (synchronized with the legacy variables)
2. ✅ Robust error handling and logging
3. ✅ Comprehensive test verification

## 📊 Implementation Status

**Status**: ✅ Completed

### Completed Work

#### Phase 1: Context Mode Sub-mode Persistence
- ✅ Added the `PRO_SUB_MODE` storage key
- ✅ Defined the `ProSubMode` type
- ✅ Created the `useProSubMode` composable
- ✅ Integrated into App.vue
- ✅ Test verification

#### Phase 2: Basic Mode Sub-mode Persistence
- ✅ Added the `BASIC_SUB_MODE` storage key
- ✅ Defined the `BasicSubMode` type
- ✅ Created the `useBasicSubMode` composable
- ✅ Integrated into App.vue
- ✅ Verified independence

#### Phase 3: Image Mode Sub-mode Persistence
- ✅ Added the `IMAGE_SUB_MODE` storage key
- ✅ Defined the `ImageSubMode` type
- ✅ Created the `useImageSubMode` composable
- ✅ Moved ImageModeSelector to the navigation bar
- ✅ Communicate via custom events
- ✅ Fixed the initialization restore problem

## 🐛 Problems Resolved

### Problem 1: Basic Mode Sub-mode Selector Missing
**Symptom**: Only Context mode showed a sub-mode selector; the Basic mode selector was gone  
**Cause**: The `v-if` condition only checked `functionMode === 'pro'`  
**Fix**: Changed to show the three selectors independently

### Problem 2: Shared State Causing Confusion
**Symptom**: The sub-mode selections of Basic mode and Context mode affected each other  
**Cause**: The same `selectedOptimizationMode` variable was used  
**Fix**: Fully independent storage and state management

### Problem 3: File Upload Area Not Displayed After Refreshing in Image Mode
**Symptom**: Switching from text-to-image to image-to-image worked, but after refreshing the page the file upload button was not displayed  
**Cause**: The `restoreSelections` method of `useImageWorkspace` did not restore `imageMode`  
**Fix**: Added logic in `restoreSelections` to restore from `UI_SETTINGS_KEYS.IMAGE_SUB_MODE`

## 📁 File Structure

```
docs/archives/126-submode-persistence/
├── README.md              # This file - feature overview
├── design.md             # Complete design and implementation document (v4.0)
├── implementation.md     # Implementation details and code examples
└── experience.md         # Lessons learned and best practices
```

## 🔑 Core Design Principles

### 1. Complete State Isolation
The three function modes use completely independent storage keys and Composables; state is not shared even when sub-mode names are the same.

**Key insight from the user**:
> "Basic mode should also have its own storage, and this should be separate too... because these two function modes essentially control different things; it just happens that their sub-modes are both called System/User Prompt Optimization."

### 2. Singleton Global State
Each Composable maintains singleton state internally, ensuring global uniqueness and avoiding multi-instance conflicts.

### 3. Asynchronous Initialization
Does not block application startup; lazily loaded through `ensureInitialized()` with a debounce mechanism.

### 4. Automatic Persistence
Every sub-mode switch is automatically saved to localStorage, transparently to the user.

## 📈 Technical Highlights

1. **Complete state isolation**: Three independent storage keys and Composables
2. **Unified UI experience**: All sub-mode selectors are in the navigation bar
3. **Robust error handling**: Falls back to defaults when initialization fails
4. **Clear log output**: Easy debugging and troubleshooting
5. **Backward compatibility**: Legacy variables retained for a smooth upgrade

## 🔗 Related Documents

- [design.md](./design.md) - Complete design document (including the v1.0-v4.0 evolution history)
- [implementation.md](./implementation.md) - Detailed implementation record and code
- [experience.md](./experience.md) - Lessons learned and best practices

## 📝 Usage Notes

### Developer Reference
1. See [design.md](./design.md) for the full design approach and architectural decisions
2. See [implementation.md](./implementation.md) for concrete implementation details
3. See [experience.md](./experience.md) for lessons and best practices

### Troubleshooting
If you run into sub-mode related problems, refer to the common issues section of [experience.md](./experience.md).

## ✨ Success Criteria

- ✅ The sub-modes of all three modes persist correctly
- ✅ State is fully preserved after refreshing the page
- ✅ Each function mode restores its own independent sub-mode when switching function modes
- ✅ The sub-mode is switched correctly when restoring history records and favorites
- ✅ No compile errors or runtime errors
- ✅ No noticeable performance degradation
- ✅ All test scenarios pass

## 🎓 Lessons Learned

See [experience.md](./experience.md) for details

---

**Document version**: v1.0  
**Last updated**: 2025-10-22  
**Maintainers**: Claude & the user
