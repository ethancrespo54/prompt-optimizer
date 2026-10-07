# Architecture Comparison and Unification Plan for the Three Modes

**Date**: 2025-01-08
**Branch**: `hapi-var-extract`
**Goal**: Align the development experience of the Basic, Context, and Image modes

---

## 📊 Architecture Differences Among the Three Modes

### Mode 1: Basic Mode (Uses a Logic Layer)

**Architecture diagram**:
```
┌─────────────────────────────────────────────────────────────┐
│              BasicSystemWorkspace.vue                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              useBasicWorkspaceLogic.ts                       │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 1. State proxy (wrapper around the Session Store)    │    │
│  │    const testResults = computed({                   │    │
│  │      get: () => sessionStore.testResults,           │    │
│  │      set: (value) => sessionStore.updateTestResults(value)│
│  │    })                                               │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │ 2. Process state management                          │    │
│  │    const isOptimizing = ref(false)                  │    │
│  │    const isTestingOriginal = ref(false)             │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │ 3. Business logic                                    │    │
│  │    const handleOptimize = async () => {...}         │    │
│  │    const handleTest = async () => {...}             │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  return {                                                    │
│    testResults,  // ComputedRef<TestResults | null>        │
│    isOptimizing,   // Ref<boolean>                         │
│    handleOptimize  // Function                              │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              useBasicSystemSession.ts                        │
│            (Pinia Store - persisted state)                   │
└─────────────────────────────────────────────────────────────┘
```

**Usage in a component**:
```typescript
<script setup>
const logic = useBasicWorkspaceLogic({
  sessionStore,
  services,
  optimizationMode: 'system'
})

// ❌ Problem: must access it with .value
const hasOriginalResult = computed(() =>
  !!logic.testResults.value?.originalResult
)

// ❌ Must be unwrapped manually before passing to child components
const unwrappedLogicProps = computed(() => ({
  testResultsOriginalResult: logic.testResults.value?.originalResult || '',
  isOptimizing: logic.isOptimizing.value
}))
</script>

<template>
  <TestResultPanel
    :originalResult="unwrappedLogicProps.testResultsOriginalResult"
  />
</template>
```

**Characteristics**:
- ✅ Code reuse: BasicSystem and BasicUser share the Logic layer
- ✅ Unified business logic: optimization, iteration, testing, version management
- ❌ Object properties must be unwrapped with `.value`
- ❌ Two-way computed violates one-way data flow
- ❌ TypeScript cannot catch a missing `.value`

---

### Mode 2: Context Mode (Uses a Tester Composable)

**Architecture diagram**:
```
┌─────────────────────────────────────────────────────────────┐
│              ContextSystemWorkspace.vue                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              useConversationTester.ts                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ const state = reactive({                            │    │
│  │   testResults: {                                    │    │
│  │     originalResult: '',                             │    │
│  │     optimizedResult: '',                            │    │
│  │     isTestingOriginal: false,                       │    │
│  │     isTestingOptimized: false,                      │    │
│  │   },                                                │    │
│  │   executeTest: async (isCompareMode) => {...}       │    │
│  │ })                                                  │    │
│  │                                                      │    │
│  │ return state  // reactive object                     │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              useProMultiSession.ts                           │
│            (Pinia Store - persisted state)                   │
│                                                              │
│  ⚠️ Needs a watch to sync Tester → Session Store            │
│  watch(                                                     │
│    () => conversationTester.testResults,                   │
│    (stable) => {                                           │
│      session.updateTestResults(stable)                      │
│    }                                                        │
│  )                                                          │
└─────────────────────────────────────────────────────────────┘
```

**Usage in a component**:
```typescript
<script setup>
const conversationTester = useConversationTester(
  services,
  modelSelection.selectedTestModelKey,
  optimizationContext,
  optimizationContextToolsRef,
  variableManager
)

// ✅ No .value needed; reactive unwraps automatically
const hasOriginalResult = computed(() =>
  !!conversationTester.testResults.originalResult
)

// ✅ Passed directly to child components
</script>

<template>
  <TestResultPanel
    :originalResult="conversationTester.testResults.originalResult"
    :isTesting="conversationTester.testResults.isTestingOriginal"
  />
</template>
```

**Characteristics**:
- ✅ No `.value` needed; reactive unwraps automatically
- ✅ Concise and clear code
- ✅ More accurate TypeScript type checking
- ❌ Requires a manual watch to sync to the Session Store
- ❌ State management is spread across several places
- ❌ Unclear data flow (two-way sync between Tester ↔️ Session)

---

### Mode 3: Image Mode (Uses the Store Directly)

**Architecture diagram**:
```
┌─────────────────────────────────────────────────────────────┐
│              ImageText2ImageWorkspace.vue                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ├────────────────────────────────┐
                              ▼                                ▼
┌──────────────────────────┐  ┌──────────────────────────────┐
│  useImageText2ImageSession│  │  useImageGeneration          │
│    (Pinia Store)          │  │    (Composable)              │
│                          │  │                              │
│  - originalPrompt        │  │  - imageModels: Ref(...)     │
│  - optimizedPrompt       │  │  - generating: Ref(...)      │
│  - selectedModelKey      │  │  - generate: Function        │
│  - testResults           │  │                              │
└──────────────────────────┘  └──────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│  Two-way computed bindings defined inside the component       │
│                                                              │
│  const originalPrompt = computed<string>({                   │
│    get: () => session.originalPrompt || '',                  │
│    set: (value) => session.updatePrompt(value || '')         │
│  })                                                          │
│                                                              │
│  const optimizedPrompt = computed<string>({                  │
│    get: () => session.optimizedPrompt || '',                 │
│    set: (value) => {                                         │
│      session.updateOptimizedResult({...})                    │
│    }                                                         │
│  })                                                          │
└─────────────────────────────────────────────────────────────┘
```

**Usage in a component**:
```typescript
<script setup>
const session = useImageText2ImageSession()

// ❌ Many two-way computed definitions inside the component
const originalPrompt = computed<string>({
  get: () => session.originalPrompt || '',
  set: (value) => session.updatePrompt(value || '')
})

const optimizedPrompt = computed<string>({
  get: () => session.optimizedPrompt || '',
  set: (value) => {
    session.updateOptimizedResult({
      optimizedPrompt: value || '',
      reasoning: session.reasoning || '',
      chainId: session.chainId || '',
      versionId: session.versionId || ''
    })
  }
})

const {
  imageModels,
  generating: isGenerating,
  result: imageResult,
  generate: generateImage
} = useImageGeneration()
</script>

<template>
  <PromptPanel
    v-model="originalPrompt"
    v-model:optimized="optimizedPrompt"
  />
</template>
```

**Characteristics**:
- ✅ Uses the Store directly, with a clear data flow
- ✅ Business logic is separated into dedicated composables
- ❌ Lots of computed boilerplate defined inside the component
- ❌ Two-way computed violates one-way data flow
- ❌ Complex update logic (multiple fields must be passed manually)

---

## 🔍 In-depth Comparison

### Dimension 1: State Management

| Aspect | Basic mode | Context mode | Image mode |
|------|-----------|-------------|-----------|
| **Persisted state** | Session Store | Session Store | Session Store |
| **Process state** | Logic-layer ref | Tester reactive | In-component ref |
| **Derived state** | In-component computed | In-component computed | In-component computed |
| **State sync** | Logic proxies the Store | Two-way sync via watch | Direct Store access |

**Problems**:
- ❌ The state management strategies of the three modes are completely different
- ❌ Context mode needs a manual watch sync, which is error-prone
- ❌ Image mode's complex update logic is scattered inside the component

---

### Dimension 2: Data Flow Clarity

| Aspect | Basic mode | Context mode | Image mode |
|------|-----------|-------------|-----------|
| **Reading data** | `logic.testResults.value` | `tester.testResults` | `session.xxx` |
| **Updating data** | `logic.testResults.value = ...` | `tester.testResults.xxx = ...` | `session.updateXxx()` |
| **Data flow direction** | Two-way computed | Two-way (Tester ↔️ Store) | Two-way computed |

**Problems**:
- ❌ All three modes use two-way binding, violating Vue 3's one-way data flow principle
- ❌ Context mode's data sync logic is the most complex

---

### Dimension 3: Developer Experience

| Aspect | Basic mode | Context mode | Image mode |
|------|-----------|-------------|-----------|
| **Needs .value** | Yes (object properties) | No (reactive) | No (top-level ref) |
| **Code conciseness** | Medium | High | Low (lots of computed) |
| **Type safety** | ⚠️ Runtime errors | ✅ Compile-time checks | ✅ Compile-time checks |
| **Boilerplate** | Medium (unwrapping logic) | Little | Much (two-way computed) |
| **Testability** | Medium | High | Low (depends on the component) |

**Conclusion**: Context mode has the best developer experience

---

### Dimension 4: Architectural Consistency

| Aspect | Basic mode | Context mode | Image mode |
|------|-----------|-------------|-----------|
| **Intermediate layer** | Logic layer | Tester layer | None |
| **State wrapping** | ComputedRef | Reactive | Direct Ref |
| **Code reuse** | ✅ High (System/User shared) | ✅ High (System/User shared) | ❌ Low (each independent) |
| **Learning curve** | Steep (must understand the Logic layer) | Flat | Flat |

**Problems**:
- ❌ Basic mode's Logic layer adds to the cost of understanding
- ❌ Image mode lacks code reuse

---

## 💡 Recommended Unification Options

### Option A: Unify on Context Mode's Reactive Architecture ⭐️⭐️⭐️⭐️⭐️

**Core idea**: All modes use a `reactive` object and no two-way `computed` bindings

**Architecture design**:
```typescript
// ✅ Unified Workspace Composable
export function useWorkspace(options: {
  mode: 'basic-system' | 'basic-user' | 'context-system' | 'context-user' | 'image-text2image'
}) {
  const sessionStore = useSessionStore(options.mode)
  const toast = useToast()
  const { t } = useI18n()

  // ✅ Use reactive to manage all state (auto-unwrapping, no .value needed)
  const state = reactive({
    // Persisted state proxy
    prompt: sessionStore.prompt,
    optimizedPrompt: sessionStore.optimizedPrompt,
    testResults: sessionStore.testResults,

    // Process state (not persisted)
    isOptimizing: false,
    isTestingOriginal: false,
    isTestingOptimized: false,

    // History management (not persisted)
    currentVersions: [],
    currentChainId: '',
    currentVersionId: ''
  })

  // ✅ Business logic methods
  const handleOptimize = async () => {
    state.isOptimizing = true
    try {
      // Business logic...

      // ✅ One-way update: modify state directly, watch syncs to the store
      state.optimizedPrompt = newPrompt

      sessionStore.updateOptimizedResult({
        optimizedPrompt: newPrompt
      })
    } finally {
      state.isOptimizing = false
    }
  }

  const handleTest = async () => {
    // ...
  }

  // ✅ Automatically sync state → sessionStore
  watch(
    () => state.optimizedPrompt,
    (value) => {
      sessionStore.updateOptimizedResult({ optimizedPrompt: value })
    }
  )

  // ✅ Return the reactive object (auto-unwrapping, no .value needed)
  return state
}
```

**Usage in a component**:
```typescript
<script setup>
const workspace = useWorkspace({ mode: 'basic-system' })

// ✅ No .value needed
const hasOriginalResult = computed(() =>
  !!workspace.testResults.originalResult
)

// ✅ Call methods directly
const handleOptimize = () => workspace.handleOptimize()
</script>

<template>
  <TestResultPanel
    :originalResult="workspace.testResults.originalResult"
    :isTesting="workspace.testResults.isTestingOriginal"
  />
</template>
```

**Pros**:
- ✅ Unified architecture, consistent across all modes
- ✅ No `.value` needed, the best developer experience
- ✅ Concise and clear code
- ✅ Type safe
- ✅ Follows Vue 3 one-way data flow

**Cons**:
- ⚠️ All modes need to be refactored
- ⚠️ State must be synced manually with watch

---

### Option B: Unify on Basic Mode's Logic Layer + toRefs ⭐️⭐️⭐️

**Core idea**: Keep the Logic layer but use `toRefs` for automatic unwrapping

**Architecture design**:
```typescript
export function useWorkspaceLogic(options: { mode: string }) {
  const sessionStore = useSessionStore(options.mode)

  // Process state
  const isOptimizing = ref(false)
  const isTestingOriginal = ref(false)

  // State proxy
  const testResults = computed({
    get: () => sessionStore.testResults,
    set: (value) => sessionStore.updateTestResults(value)
  })

  // Business logic
  const handleTest = async () => {
    // ...
  }

  // ✅ Use toRefs for automatic unwrapping
  return {
    ...toRefs({
      testResults,
      isOptimizing,
      isTestingOriginal
    }),
    handleTest
  }
}
```

**Usage in a component**:
```typescript
<script setup>
const workspace = useWorkspaceLogic({ mode: 'basic-system' })

// ✅ No .value needed
const hasOriginalResult = computed(() =>
  !!workspace.testResults?.originalResult
)
</script>
```

**Pros**:
- ✅ Minimal changes
- ✅ Keeps the existing architecture
- ✅ No `.value` needed

**Cons**:
- ⚠️ Still uses two-way computed
- ⚠️ The Logic layer is still an indirection layer

---

### Option C: Remove the Intermediate Layer and Use the Store Directly ⭐️⭐️⭐️⭐

**Core idea**: All modes use the Store directly, with business logic separated into an Operations Composable

**Architecture design**:
```typescript
// ✅ Store: manages state only
const sessionStore = useSessionStore('basic-system')
const { prompt, testResults } = storeToRefs(sessionStore)

// ✅ Operations: contains business logic only
const { handleOptimize, handleTest } = useWorkspaceOperations({
  sessionStore,
  services
})

// ✅ Derived state: defined inside the component
const hasOriginalResult = computed(() =>
  !!testResults.value?.originalResult
)
```

**Usage in a component**:
```typescript
<script setup>
const sessionStore = useSessionStore('basic-system')
const { prompt, testResults, optimizedPrompt } = storeToRefs(sessionStore)

const { handleOptimize, handleTest } = useWorkspaceOperations({
  sessionStore,
  services
})

// Derived state
const hasOriginalResult = computed(() =>
  !!testResults.value?.originalResult
)
</script>

<template>
  <TestResultPanel
    :originalResult="testResults.originalResult"
    @test="handleTest"
  />
</template>
```

**Pros**:
- ✅ Follows Vue 3 best practices
- ✅ One-way data flow
- ✅ Clear separation of responsibilities
- ✅ Easy to test

**Cons**:
- ⚠️ All modes need to be refactored
- ⚠️ computed must be defined inside the component (but this is acceptable)

---

## 📊 Option Comparison

| Dimension | Option A (Reactive) | Option B (Logic + toRefs) | Option C (Store + Operations) |
|------|------------------|------------------------|----------------------------|
| **Change cost** | Large | Medium | Large |
| **Developer experience** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Code conciseness** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Type safety** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Data flow clarity** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Adherence to Vue 3 conventions** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Maintenance cost** | Low | Medium | Low |
| **Recommendation** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

---

## 🎯 Final Recommendation

### Short-term (within 1-2 weeks): Quick Alignment

**Goal**: Unify the developer experience and reduce similar bugs

**Implementation**: **Option B (Logic + toRefs)**

**Reasons**:
- ✅ Lowest change cost
- ✅ Immediately solves the `.value` problem
- ✅ Keeps the existing architecture
- ✅ No large-scale refactor needed

**Implementation steps**:
1. Modify `useBasicWorkspaceLogic.ts` to use `toRefs` for automatic unwrapping
2. Modify Context and Image modes to create a unified Logic layer
3. Update all components to remove `.value` access
4. Add an ESLint rule forbidding direct access to computed object properties

---

### Long-term (within 1-2 months): Architecture Refactor

**Goal**: Follow Vue 3 best practices and improve code quality

**Implementation**: **Option C (Store + Operations)**

**Reasons**:
- ✅ Follows Vue 3's one-way data flow principle
- ✅ Clear separation of responsibilities (state vs business logic)
- ✅ Easy to test and maintain
- ✅ Best practice in the long run

**Implementation steps**:
1. Refactor Basic mode and remove the Logic layer
2. Create the `useWorkspaceOperations` composable
3. Components use the Store + Operations directly
4. Refactor Context and Image modes in sync
5. Update documentation and development standards

---

## 📝 Action Plan

### Phase 1: Urgent Fix (Completed ✅)
- [x] Fix the missing `.value` problem in Basic mode
- [x] Verify all modes work correctly

### Phase 2: Short-term Alignment (1-2 weeks)
- [ ] Modify `useBasicWorkspaceLogic.ts` to use `toRefs`
- [ ] Create a unified Logic layer for Context and Image
- [ ] Update all components to remove `.value`
- [ ] Add the ESLint rule
- [ ] Update documentation

### Phase 3: Long-term Refactor (1-2 months)
- [ ] Design the new unified architecture
- [ ] Create the `useWorkspaceOperations` composable
- [ ] Refactor Basic mode
- [ ] Refactor Context mode
- [ ] Refactor Image mode
- [ ] Comprehensive testing
- [ ] Update documentation and standards

---

## 🔗 Related Documents

- [Session Store Test Results Bug Fix Record](./session-store-testresults-bug-fix-2025-01-08.md)
- [Vue 3 Official Docs - Reactivity Fundamentals](https://vuejs.org/guide/essentials/reactivity-fundamentals.html)
- [Vue 3 Style Guide](https://vuejs.org/style-guide/)

---

**Document maintenance**: Update this document as the refactor progresses
