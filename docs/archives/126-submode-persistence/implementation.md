# Sub-mode Persistence - Implementation Record

## 📋 Implementation Overview

This document records the complete implementation process of sub-mode persistence for the three function modes, including the core code, key decisions, and implementation steps.

## 🔧 Core Implementation

### 1. Storage Key Definitions

**File**: `packages/core/src/constants/storage-keys.ts`

```typescript
export const UI_SETTINGS_KEYS = {
  // ... existing keys ...
  FUNCTION_MODE: 'app:settings:ui:function-mode',
  
  // ✅ Sub-mode persistence (the three function modes are stored independently)
  BASIC_SUB_MODE: 'app:settings:ui:basic-sub-mode',     // Basic mode
  PRO_SUB_MODE: 'app:settings:ui:pro-sub-mode',         // Context mode
  IMAGE_SUB_MODE: 'app:settings:ui:image-sub-mode',     // Image mode
} as const
```

**Design points**:
- Three completely independent storage keys
- Names clearly reflect the function mode
- Use `as const` to ensure type safety

---

### 2. TypeScript Type Definitions

**File**: `packages/core/src/services/prompt/types.ts`

```typescript
/**
 * Sub-mode type definitions (the three function modes are independent)
 * Used to persist the sub-mode selection under each function mode
 */

// Sub-modes of Basic mode
export type BasicSubMode = "system" | "user"

// Sub-modes of Context mode
export type ProSubMode = "system" | "user"

// Sub-modes of Image mode
export type ImageSubMode = "text2image" | "image2image"
```

**Design points**:
- Three independent types, never mixed even when the value domains are the same
- Clear JSDoc comments
- Reflects the independence of the function modes

---

### 3. Composable Implementation

#### useBasicSubMode.ts

**File**: `packages/ui/src/composables/useBasicSubMode.ts`

```typescript
import { ref, readonly, type Ref } from 'vue'
import type { AppServices } from '../types/services'
import { usePreferences } from './usePreferenceManager'
import { UI_SETTINGS_KEYS, type BasicSubMode } from '@prompt-optimizer/core'

interface UseBasicSubModeApi {
  basicSubMode: Ref<BasicSubMode>
  setBasicSubMode: (mode: BasicSubMode) => Promise<void>
  switchToSystem: () => Promise<void>
  switchToUser: () => Promise<void>
  ensureInitialized: () => Promise<void>
}

let singleton: {
  mode: Ref<BasicSubMode>
  initialized: boolean
  initializing: Promise<void> | null
} | null = null

export function useBasicSubMode(services: Ref<AppServices | null>): UseBasicSubModeApi {
  // Singleton pattern: ensure globally unique state
  if (!singleton) {
    singleton = { 
      mode: ref<BasicSubMode>('system'), 
      initialized: false, 
      initializing: null 
    }
  }

  const { getPreference, setPreference } = usePreferences(services)

  // Asynchronous initialization: read from storage, with debouncing
  const ensureInitialized = async () => {
    if (singleton!.initialized) return
    if (singleton!.initializing) {
      await singleton!.initializing
      return
    }
    
    singleton!.initializing = (async () => {
      try {
        const saved = await getPreference<BasicSubMode>(
          UI_SETTINGS_KEYS.BASIC_SUB_MODE, 
          'system'
        )
        singleton!.mode.value = (saved === 'system' || saved === 'user') 
          ? saved 
          : 'system'
        
        console.log(`[useBasicSubMode] Initialization complete, current value: ${singleton!.mode.value}`)

        if (saved !== 'system' && saved !== 'user') {
          await setPreference(UI_SETTINGS_KEYS.BASIC_SUB_MODE, 'system')
          console.log('[useBasicSubMode] First initialization, default value persisted: system')
        }
      } catch (e) {
        console.error('[useBasicSubMode] Initialization failed, using default value system:', e)
        try {
          await setPreference(UI_SETTINGS_KEYS.BASIC_SUB_MODE, 'system')
        } catch {
          // Ignore set failure errors
        }
      } finally {
        singleton!.initialized = true
        singleton!.initializing = null
      }
    })()
    
    await singleton!.initializing
  }

  // Automatic persistence: save on every switch
  const setBasicSubMode = async (mode: BasicSubMode) => {
    await ensureInitialized()
    singleton!.mode.value = mode
    await setPreference(UI_SETTINGS_KEYS.BASIC_SUB_MODE, mode)
    console.log(`[useBasicSubMode] Sub-mode switched and persisted: ${mode}`)
  }

  const switchToSystem = () => setBasicSubMode('system')
  const switchToUser = () => setBasicSubMode('user')

  return {
    basicSubMode: readonly(singleton.mode) as Ref<BasicSubMode>,
    setBasicSubMode,
    switchToSystem,
    switchToUser,
    ensureInitialized
  }
}
```

**Key design patterns**:

1. **Singleton pattern**
   ```typescript
   let singleton: { mode: Ref<SubMode>, initialized: boolean, initializing: Promise<void> | null } | null = null
   ```
   - Ensures globally unique state
   - Avoids multi-instance conflicts

2. **Debounced initialization**
   ```typescript
   if (singleton!.initialized) return
   if (singleton!.initializing) {
     await singleton!.initializing
     return
   }
   ```
   - Avoids repeated initialization
   - Handles concurrent calls

3. **Read-only state exposure**
   ```typescript
   return {
     basicSubMode: readonly(singleton.mode) as Ref<BasicSubMode>,
     // ...
   }
   ```
   - Prevents direct external modification
   - Forces updates through the setter

4. **Robust error handling**
   ```typescript
   try {
     // Read from storage
   } catch (e) {
     // Fall back to the default value
   } finally {
     singleton!.initialized = true
     singleton!.initializing = null
   }
   ```

**Other Composables**:
- `useProSubMode.ts` - Same structure as useBasicSubMode, using the ProSubMode type
- `useImageSubMode.ts` - Same structure as useBasicSubMode, with the default value 'text2image'

---

### 4. App.vue Integration

#### Imports and State Initialization

```typescript
import {
    useBasicSubMode,
    useProSubMode,
    useImageSubMode,
    // ... other imports
} from '@prompt-optimizer/ui'

// Function mode
const { functionMode, setFunctionMode } = useFunctionMode(services as any)

// Sub-mode persistence for the three function modes (stored independently)
const { basicSubMode, setBasicSubMode } = useBasicSubMode(services as any)
const { proSubMode, setProSubMode } = useProSubMode(services as any)
const { imageSubMode, setImageSubMode } = useImageSubMode(services as any)
```

#### Navigation Bar Template

```vue
<template #core-nav>
    <NSpace :size="12" align="center">
        <!-- Function mode selector -->
        <FunctionModeSelector
            :modelValue="functionMode"
            @update:modelValue="handleModeSelect"
        />

        <!-- Sub-mode selector - Basic mode -->
        <OptimizationModeSelectorUI
            v-if="functionMode === 'basic'"
            :modelValue="basicSubMode"
            @change="handleBasicSubModeChange"
        />

        <!-- Sub-mode selector - Context mode -->
        <OptimizationModeSelectorUI
            v-if="functionMode === 'pro'"
            :modelValue="proSubMode"
            @change="handleProSubModeChange"
        />

        <!-- Sub-mode selector - Image mode -->
        <ImageModeSelector
            v-if="functionMode === 'image'"
            :modelValue="imageSubMode"
            @change="handleImageSubModeChange"
        />
    </NSpace>
</template>
```

#### Application Startup Initialization

```typescript
onMounted(async () => {
    // ... other initialization code ...

    // Based on the current function mode, restore the corresponding sub-mode selection from storage
    if (functionMode.value === "basic") {
        const { ensureInitialized } = useBasicSubMode(services as any);
        await ensureInitialized();
        selectedOptimizationMode.value = basicSubMode.value as OptimizationMode;
        console.log(`[App] Basic mode sub-mode restored: ${basicSubMode.value}`);
    } else if (functionMode.value === "pro") {
        const { ensureInitialized } = useProSubMode(services as any);
        await ensureInitialized();
        selectedOptimizationMode.value = proSubMode.value as OptimizationMode;
        await handleContextModeChange(
            proSubMode.value as import("@prompt-optimizer/core").ContextMode,
        );
        console.log(`[App] Context mode sub-mode restored: ${proSubMode.value}`);
    } else if (functionMode.value === "image") {
        const { ensureInitialized } = useImageSubMode(services as any);
        await ensureInitialized();
        console.log(`[App] Image mode sub-mode restored: ${imageSubMode.value}`);
    }
})
```

#### Sub-mode Switch Handling

```typescript
// Basic mode sub-mode change handler
const handleBasicSubModeChange = async (mode: OptimizationMode) => {
    await setBasicSubMode(mode as import("@prompt-optimizer/core").BasicSubMode);
    selectedOptimizationMode.value = mode;
    console.log(`[App] Basic mode sub-mode switched and persisted: ${mode}`);
};

// Context mode sub-mode change handler
const handleProSubModeChange = async (mode: OptimizationMode) => {
    await setProSubMode(mode as import("@prompt-optimizer/core").ProSubMode);
    selectedOptimizationMode.value = mode;
    
    if (services.value?.contextMode.value !== mode) {
        await handleContextModeChange(
            mode as import("@prompt-optimizer/core").ContextMode,
        );
    }
    console.log(`[App] Context mode sub-mode switched and persisted: ${mode}`);
};

// Image mode sub-mode change handler
const handleImageSubModeChange = async (mode: import("@prompt-optimizer/core").ImageSubMode) => {
    await setImageSubMode(mode);
    console.log(`[App] Image mode sub-mode switched and persisted: ${mode}`);
    
    // Notify ImageWorkspace to update
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("image-submode-changed", { 
            detail: { mode } 
        }));
    }
};
```

---

### 5. Special Handling for Image Mode

#### ImageWorkspace.vue Changes

**Remove the internal selector**:
```vue
<!-- ❌ Before removal -->
<ImageModeSelector v-model="imageMode" @change="handleImageModeChange" />

<!-- ✅ After removal -->
<!-- The image mode selector has been moved to the navigation bar -->
```

**Listen for navigation bar events**:
```typescript
// Image sub-mode change event handler
const handleImageSubModeChanged = (e: CustomEvent) => {
  const { mode } = e.detail
  if (mode && mode !== imageMode.value) {
    console.log(`[ImageWorkspace] Received sub-mode switch event from the navigation bar: ${mode}`)
    handleImageModeChange(mode)
  }
}

onMounted(() => {
    window.addEventListener(
        "image-submode-changed",
        handleImageSubModeChanged as EventListener,
    );
})

onBeforeUnmount(() => {
    window.removeEventListener(
        "image-submode-changed",
        handleImageSubModeChanged as EventListener,
    );
})
```

#### useImageWorkspace.ts Fix

**Problem**: `imageMode` was not restored from storage on initialization

**Fix**:
```typescript
// File: packages/ui/src/composables/useImageWorkspace.ts

// 1. Import UI_SETTINGS_KEYS
import {
  IMAGE_MODE_KEYS,
  UI_SETTINGS_KEYS,  // ✅ New
  // ...
} from '@prompt-optimizer/core'

// 2. Modify the restoreSelections method
const restoreSelections = async () => {
  try {
    state.selectedTextModelKey = await getPreference(...)
    state.selectedImageModelKey = await getPreference(...)
    state.isCompareMode = await getPreference(...)

    // ✅ Restore the image sub-mode (read from global persistent storage)
    const savedImageMode = await getPreference(
      UI_SETTINGS_KEYS.IMAGE_SUB_MODE,
      "text2image",
    );
    if (savedImageMode === "text2image" || savedImageMode === "image2image") {
      state.imageMode = savedImageMode;
      console.log(`[useImageWorkspace] Image sub-mode restored from storage: ${savedImageMode}`);
    }

    await restoreTemplateSelection();
    await restoreImageIterateTemplateSelection();
  } catch (error) {
    console.warn("Failed to restore selections:", error);
  }
}
```

---

## 🔄 Data Flow

### Initialization Flow

```
App starts
  ↓
Read FUNCTION_MODE → determine the current function mode
  ↓
Call the corresponding ensureInitialized() based on the function mode
  ↓
┌──────────┬──────────┬──────────┐
│  basic   │   pro    │  image   │
│  ↓       │   ↓      │   ↓      │
│ BASIC_   │  PRO_    │ IMAGE_   │
│ SUB_MODE │ SUB_MODE │ SUB_MODE │
└──────────┴──────────┴──────────┘
  ↓
Restore the sub-mode state → show the corresponding selector
```

### Switch Flow

```
User clicks a navigation bar selector
  ↓
Triggers the onChange event
  ↓
Calls the corresponding handleSubModeChange
  ↓
Calls setSubMode(newMode)
  ↓
Update in-memory state → save to localStorage
  ↓
Triggers a reactive update → UI refreshes automatically
  ↓
(Image mode) Send a custom event to notify ImageWorkspace
```

---

## 📝 Key Code Locations

| Function | File path | Line range |
|------|----------|----------|
| Storage key definitions | `packages/core/src/constants/storage-keys.ts` | ~28-32 |
| Type definitions | `packages/core/src/services/prompt/types.ts` | ~15-25 |
| useBasicSubMode | `packages/ui/src/composables/useBasicSubMode.ts` | Entire file |
| useProSubMode | `packages/ui/src/composables/useProSubMode.ts` | Entire file |
| useImageSubMode | `packages/ui/src/composables/useImageSubMode.ts` | Entire file |
| App.vue navigation bar | `packages/web/src/App.vue` | ~21-49 |
| App.vue initialization | `packages/web/src/App.vue` | ~1566-1586 |
| App.vue switch handlers | `packages/web/src/App.vue` | ~1788-1831 |
| ImageWorkspace events | `packages/ui/src/components/image-mode/ImageWorkspace.vue` | ~1441-1547 |
| useImageWorkspace fix | `packages/ui/src/composables/useImageWorkspace.ts` | ~282-292 |

---

## 🧪 Test Verification

### Test Scenarios

#### Scenario 1: Basic Mode Persistence
1. Switch to Basic mode
2. Select "User Prompt Optimization"
3. Refresh the page
4. ✅ Verify: Basic mode still shows "User Prompt Optimization"

#### Scenario 2: Independence Verification
1. In Basic mode, select "User Prompt Optimization"
2. Switch to Context mode and select "System Prompt Optimization"
3. Switch back to Basic mode
4. ✅ Verify: Basic mode still shows "User Prompt Optimization" (proves independence)

#### Scenario 3: Image Mode Initialization Fix
1. Switch to Image mode
2. Select "Image to Image"
3. Refresh the page
4. ✅ Verify: The file upload button is displayed correctly

### Verification Logs

Example of successful log output:
```
[useBasicSubMode] Initialization complete, current value: user
[App] Basic mode sub-mode restored: user
[useProSubMode] Initialization complete, current value: system
[App] Context mode sub-mode restored: system
[useImageSubMode] Initialization complete, current value: image2image
[useImageWorkspace] Image sub-mode restored from storage: image2image
[App] Image mode sub-mode restored: image2image
```

---

## 🎯 Implementation Summary

### Core Achievements
1. ✅ Completely independent sub-mode management for the three function modes
2. ✅ Unified navigation bar UI experience
3. ✅ Robust persistence and restore mechanism
4. ✅ Fixed the Image mode initialization problem

### Technical Highlights
1. **Singleton pattern**: Ensures globally unique state
2. **Asynchronous initialization**: Does not block application startup
3. **Automatic persistence**: State is saved transparently to the user
4. **Robust error handling**: A fallback mechanism guarantees usability
5. **Clear logs**: Easy debugging and troubleshooting

### Code Quality
- **Type safety**: Complete TypeScript type definitions
- **Maintainability**: Clear separation of responsibilities and modularity
- **Extensibility**: Easy to add new function modes
- **Backward compatibility**: Integrates smoothly with existing code

---

**Document version**: v1.0  
**Last updated**: 2025-10-22
