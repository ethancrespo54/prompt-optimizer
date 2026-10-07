# Sub-mode Persistence - Lessons Learned

## 💡 Core Lessons

### 1. The Importance of State Isolation

**Key insight (from the user)**:
> "Basic mode should also have its own storage, and this should be separate too... because these two function modes essentially control different things; it just happens that their sub-modes are both called System/User Prompt Optimization."

**Takeaways**:
- ✅ **Same name ≠ shared state**: Even if the sub-mode names are the same (e.g. both called "System/User"), they should be stored independently
- ✅ **Function mode is the first dimension**: Different function modes represent different usage scenarios
- ✅ **User mental model**: Users expect each function mode to "remember" its own last choice

**Anti-pattern**:
```typescript
// ❌ Wrong: shared state
const selectedOptimizationMode = ref<'system' | 'user'>('system')

// Basic mode and Context mode both use the same variable
// causing state confusion when switching function modes
```

**Best practice**:
```typescript
// ✅ Correct: fully independent state
const { basicSubMode } = useBasicSubMode(services)
const { proSubMode } = useProSubMode(services)

// Each is stored independently and does not affect the other
```

---

### 2. Correct Use of the Singleton Pattern

**Background**: A Composable may be called multiple times; how do we ensure the state is unique?

**Solution**:
```typescript
let singleton: {
  mode: Ref<SubModeType>
  initialized: boolean
  initializing: Promise<void> | null
} | null = null

export function useSubMode(services: Ref<AppServices | null>) {
  if (!singleton) {
    singleton = { 
      mode: ref<SubModeType>('default'), 
      initialized: false, 
      initializing: null 
    }
  }
  // ...
}
```

**Key points**:
1. **Module-level variable**: `singleton` lives in module scope, ensuring global uniqueness
2. **Lazy initialization**: Created on the first call
3. **Shared state**: Subsequent calls return the same state reference

**Common pitfall**:
```typescript
// ❌ Wrong: creates new state on every call
export function useSubMode() {
  const mode = ref('default')  // New every time!
  // ...
}
```

---

### 3. Debouncing Asynchronous Initialization

**Problem**: If multiple components call `ensureInitialized()` at the same time, storage is read repeatedly.

**Solution**:
```typescript
const ensureInitialized = async () => {
  // First layer of protection: already initialized
  if (singleton!.initialized) return
  
  // Second layer of protection: currently initializing (debounce)
  if (singleton!.initializing) {
    await singleton!.initializing
    return
  }
  
  // Record the initialization Promise
  singleton!.initializing = (async () => {
    try {
      // Actual initialization logic
    } finally {
      singleton!.initialized = true
      singleton!.initializing = null
    }
  })()
  
  await singleton!.initializing
}
```

**Key mechanisms**:
1. **Double check**: `initialized` + `initializing`
2. **Shared Promise**: Multiple callers wait on the same Promise
3. **finally guarantee**: State is cleaned up whether it succeeds or fails

---

### 4. The Read-only State Exposure Pattern

**Why read-only?**
- Prevents external code from modifying state directly
- Forces updates through the setter (convenient for persistence)
- Better code maintainability

**Implementation**:
```typescript
import { readonly } from 'vue'

return {
  // ✅ Read-only: cannot be modified directly from outside
  basicSubMode: readonly(singleton.mode) as Ref<BasicSubMode>,
  
  // ✅ Mutator: update and persist through the setter
  setBasicSubMode: async (mode: BasicSubMode) => {
    singleton!.mode.value = mode
    await setPreference(STORAGE_KEY, mode)
  }
}
```

**Pitfall avoided**:
```typescript
// ❌ Wrong: exposing writable state directly
return {
  basicSubMode: singleton.mode,  // External code can modify it directly!
  // ...
}

// Resulting problem:
basicSubMode.value = 'user'  // State changed but not persisted!
```

---

### 5. Cross-component Communication Strategy

**Scenario**: The navigation bar selectors live in App.vue, but ImageWorkspace needs to know about the switch event internally.

**Comparison of approaches**:

| Approach | Pros | Cons | Applicable scenario |
|------|------|------|----------|
| Props passing | Simple and direct | High component coupling | Parent-child components |
| Provide/Inject | Decoupled | Requires a common ancestor | Deep nesting |
| Custom events | Fully decoupled | Must be managed manually | Cross-level communication |
| Shared Composable | Type safe | Requires the singleton pattern | Global state |

**Choices in this project**:
- **Navigation bar → App.vue**: Shared Composable state
- **App.vue → ImageWorkspace**: Custom events

**Custom event implementation**:
```typescript
// Sender (App.vue)
window.dispatchEvent(new CustomEvent("image-submode-changed", { 
  detail: { mode } 
}))

// Receiver (ImageWorkspace.vue)
const handleImageSubModeChanged = (e: CustomEvent) => {
  const { mode } = e.detail
  if (mode && mode !== imageMode.value) {
    handleImageModeChange(mode)
  }
}

onMounted(() => {
  window.addEventListener("image-submode-changed", handleImageSubModeChanged as EventListener)
})

onBeforeUnmount(() => {
  window.removeEventListener("image-submode-changed", handleImageSubModeChanged as EventListener)
})
```

---

### 6. The Two-layer State Synchronization Problem

**Problem found**: The file upload button was not displayed after refreshing in Image mode

**Cause analysis**:
```
Navigation bar layer (App.vue + useImageSubMode)
  ✅ Restored from UI_SETTINGS_KEYS.IMAGE_SUB_MODE
  ✅ Navigation bar displays correctly
  
Component internal layer (ImageWorkspace + useImageWorkspace)
  ❌ Did not restore from storage
  ❌ Always used the hard-coded default 'text2image'
  ❌ v-if="imageMode === 'image2image'" was always false
```

**Solution**: Both layers restore from the same storage key
```typescript
// useImageWorkspace.ts
const restoreSelections = async () => {
  // ... other restores ...
  
  // ✅ Restore from global storage
  const savedImageMode = await getPreference(
    UI_SETTINGS_KEYS.IMAGE_SUB_MODE,  // Same key as the navigation bar!
    "text2image",
  )
  if (savedImageMode === "text2image" || savedImageMode === "image2image") {
    state.imageMode = savedImageMode
  }
}
```

**Lessons**:
- ✅ **Single data source**: All layers read from the same storage key
- ✅ **Initialization checks**: Make sure everywhere that uses the state initializes it correctly
- ✅ **Log tracing**: Output logs during initialization and switching to make problems easier to spot

---

### 7. Backward Compatibility Strategy

**Challenge**: Existing code makes heavy use of `selectedOptimizationMode` and `contextMode`

**Strategy**: Keep the legacy variables and synchronize them with the new Composables

```typescript
// New state
const { basicSubMode, setBasicSubMode } = useBasicSubMode(services)
const { proSubMode, setProSubMode } = useProSubMode(services)

// Legacy variable (kept for compatibility)
const selectedOptimizationMode = ref<OptimizationMode>("system")

// Synchronize on switch
const handleBasicSubModeChange = async (mode: OptimizationMode) => {
  await setBasicSubMode(mode as BasicSubMode)
  selectedOptimizationMode.value = mode  // ✅ Synchronize the legacy variable
}
```

**Advantages**:
1. Lowers refactoring risk
2. Smooth upgrade
3. Avoids wide-ranging changes

**Long-term plan**:
- Gradually migrate usages to the new API
- Eventually deprecate the legacy variable

---

## 🎯 Design Pattern Summary

### 1. Singleton Pattern
**Purpose**: Ensure globally unique state  
**Implementation**: Module-level variable + lazy initialization

### 2. Proxy Pattern
**Purpose**: Control state access  
**Implementation**: readonly() wrapper + setter methods

### 3. Observer Pattern
**Purpose**: Cross-component communication  
**Implementation**: Custom events + addEventListener

### 4. Strategy Pattern
**Purpose**: Choose different handling according to the function mode  
**Implementation**: if-else branches + independent Composables

---

## 🚫 Common Pitfalls

### Pitfall 1: Forgetting to Initialize
```typescript
// ❌ Wrong
const { basicSubMode, setBasicSubMode } = useBasicSubMode(services)
setBasicSubMode('user')  // May be called before initialization!

// ✅ Correct
const { basicSubMode, setBasicSubMode, ensureInitialized } = useBasicSubMode(services)
await ensureInitialized()  // Initialize first
await setBasicSubMode('user')
```

### Pitfall 2: Modifying Read-only State Directly
```typescript
// ❌ Wrong
basicSubMode.value = 'user'  // TypeScript will report an error!

// ✅ Correct
await setBasicSubMode('user')
```

### Pitfall 3: Forgetting to Clean Up Event Listeners
```typescript
// ❌ Wrong: registered but never cleaned up
onMounted(() => {
  window.addEventListener("event", handler)
})

// ✅ Correct: clean up to avoid memory leaks
onMounted(() => {
  window.addEventListener("event", handler)
})
onBeforeUnmount(() => {
  window.removeEventListener("event", handler)
})
```

### Pitfall 4: Confusing State Types
```typescript
// ❌ Wrong: mixing types
const mode: ProSubMode = basicSubMode.value  // Type mismatch!

// ✅ Correct: type conversion
const mode = basicSubMode.value as OptimizationMode
```

---

## 📊 Performance Considerations

### 1. Initialization Performance
- ✅ **Asynchronous loading**: Does not block application startup
- ✅ **Debounce mechanism**: Avoids repeated reads
- ✅ **Single read**: localStorage reads are fast, so no caching is needed

### 2. Switching Performance
- ✅ **Reactive updates**: Handled automatically by Vue with almost no overhead
- ✅ **Partial updates**: Only the relevant components update
- ✅ **Asynchronous persistence**: Does not block the UI

### 3. Memory Usage
- ✅ **Singleton pattern**: Only one state instance
- ✅ **Lightweight data**: Only string values are stored
- ✅ **Event cleanup**: Avoids memory leaks

---

## 🧪 Testing Lessons

### Testing Strategy
1. **Unit tests**: Core logic of the Composables
2. **Integration tests**: Initialization and switching in App.vue
3. **Manual tests**: Verification in real usage scenarios

### Key Test Scenarios
1. ✅ First use (no stored data)
2. ✅ State is preserved after refreshing the page
3. ✅ Each function mode restores its own state when switching
4. ✅ Independence verification (Basic/Context do not affect each other)
5. ✅ History record restore
6. ✅ Favorites restore

### Debugging Tips
1. **Log output**: Log every key operation
2. **localStorage inspection**: Check storage in the browser dev tools
3. **Reactive tracing**: Use Vue DevTools to watch state changes

---

## 📝 Documentation Lessons

### 1. Progressive Documentation
- **v1.0**: Initial design (Context mode only)
- **v2.0**: Added Basic mode
- **v3.0**: Added Image mode
- **v4.0**: Completed and archived

### 2. Recording Decisions
- Highlight key insights from the user
- Explain the rationale behind technical decisions
- Record the cause and solution of problems encountered

### 3. Code Examples
- Provide complete code snippets
- Mark key lines
- Contrast correct and incorrect ways of writing

---

## 🎓 Reusable Lessons

### Applicable Scenarios
This architecture is suitable for the following scenarios:
1. **Multi-mode applications**: Several independent function modes
2. **State persistence**: Need to remember user choices
3. **Global state**: Need to share across multiple components
4. **Type safety**: TypeScript projects

### Extension Suggestions
When adding a new function mode:
1. Add a storage key in `storage-keys.ts`
2. Define the type in `types.ts`
3. Create the corresponding `useXxxSubMode.ts`
4. Integrate it in App.vue
5. Add test verification

---

## 💡 Key Recommendations

### For Developers
1. ✅ **Isolation over sharing**: Store independently by default unless there is a clear sharing need
2. ✅ **Singleton to avoid duplication**: Use the singleton pattern when global state is needed
3. ✅ **Asynchronous initialization**: Avoid blocking application startup
4. ✅ **Read-only state**: Prevent accidental modification and force use of the setter
5. ✅ **Thorough logging**: Easy debugging and troubleshooting

### For Architects
1. ✅ **User mental model first**: Technical implementation should match user intuition
2. ✅ **Backward compatibility**: Keep legacy interfaces during refactoring for a smooth upgrade
3. ✅ **Defensive programming**: Robust error handling and fallback mechanisms
4. ✅ **Keep documentation current**: Record design decisions and evolution promptly

---

## 🔮 Future Improvements

### Short-term (completed)
- ✅ All three modes persist independently
- ✅ Unified navigation bar UI
- ✅ Fixed the Image mode initialization problem

### Mid-term (to be discussed)
- 🔄 Deprecate the `selectedOptimizationMode` variable
- 🔄 Unify `contextMode` and `proSubMode`
- 🔄 Unify terminology (OptimizationMode → SubMode)

### Long-term (optional)
- 💡 Support more function modes
- 💡 Make sub-modes configurable (defined via configuration files)
- 💡 Finer-grained persistence control

---

**Document version**: v1.0  
**Last updated**: 2025-10-22  
**Contributors**: Claude & the user
