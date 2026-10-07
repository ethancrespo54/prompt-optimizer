# Architecture Migration Guide: Detailed Analysis

## 📋 Document Overview

**Document name**: `architecture-migration-guide.md`
**Nature**: Long-term planning document (not executed)
**Goal**: Unify the three modes onto the **Store + Operations** architecture

---

## 🎯 Core Goals

### Problems to Solve
1. **Root cause of the P0 bug**: `logic.testResults?.originalResult` missed `.value`, causing UI display issues
2. **Inconsistent architecture**: The Basic/Context/Image modes use different state management patterns
3. **Reactivity trap**: The Logic layer returns "ComputedRef inside object properties", which is easy to misuse
4. **High maintenance cost**: Multiple patterns coexist and the code style is inconsistent

### Ideal Architecture (Target State)
```
Component (consumes the store directly)
    ↓
Operations composable (side effects / flow logic)
    ↓
Pinia Session Store (single source of truth)
```

---

## 📊 Actual Current Architecture State

### 1. Basic Mode (Partially fixed, not migrated)

#### Current State
```
BasicSystemWorkspace.vue / BasicUserWorkspace.vue
    ↓
useBasicWorkspaceLogic (state proxy + business logic)  ← still in use
    ↓
useBasicSystemSession / useBasicUserSession (Pinia Store)
```

#### Code Evidence

**The Logic layer is still in use** (`packages/ui/src/composables/workspaces/useBasicWorkspaceLogic.ts`):
```typescript
// ✅ P0 bug fixed: the testResults getter no longer returns a temporary object
const testResults = computed<BasicSessionStore['testResults']>({
  get: () => {
    // Key fix: always return sessionStore.testResults (even if it is null)
    return sessionStore.testResults
  },
  set: (value) => {
    sessionStore.updateTestResults(value)
  }
})

// ❌ But the Logic layer still returns many computed wrappers
export function useBasicWorkspaceLogic(options) {
  return {
    // State proxies (all are ComputedRef)
    prompt,              // ComputedRef<string>
    optimizedPrompt,     // ComputedRef<string>
    testResults,         // ComputedRef<TestResults | null>
    testContent,         // ComputedRef<string>

    // Process state
    isOptimizing,        // Ref<boolean>
    isTestingOriginal,   // Ref<boolean>

    // Business methods
    handleOptimize,
    handleTest,
    handleIterate,
    // ...
  }
}
```

**How the component consumes it** (`BasicSystemWorkspace.vue:323-365`):
```typescript
const logic = useBasicWorkspaceLogic({
  services,
  sessionStore: session,
  optimizationMode: 'system',
  promptRecordType: 'optimize'
})

// ✅ P0 bug fixed: `.value` is used correctly in the component
const hasOriginalResult = computed(() => !!logic.testResults.value?.originalResult)
const hasOptimizedResult = computed(() => !!logic.testResults.value?.optimizedResult)
```

#### Analysis

**Completed work**:
- ✅ The P0 bug is fixed (`.value` is used correctly in the component)
- ✅ The `testResults` getter in the Logic layer no longer returns a temporary object
- ✅ The Session Store uses standalone refs (no longer `state.xxx`)

**Incomplete migration**:
- ❌ The Logic layer still exists (19KB, 597 lines of code)
- ❌ The Logic layer still returns many ComputedRef wrappers
- ❌ Components still access state through `logic.xxx` rather than directly through `session.xxx`
- ❌ Business logic (handleOptimize/handleTest) is still in the Logic layer and has not been extracted into standalone Operations

**Why hasn't it been migrated?**
1. **Short-term stopgap first**: The P0 bug was resolved by fixing how components consume the state, and it does not affect functionality
2. **High migration cost**: Requires refactoring components + creating Operations + test verification
3. **Risk control**: The current architecture is not ideal but has been running stably

---

### 2. Context Mode (Dominated by the Tester composable)

#### Current State
```
ContextSystemWorkspace.vue
    ↓
useConversationTester (reactive state tree + business logic)
    ↓
Some data is written to the Session Store
```

#### Code Evidence

**Tester composable** (`ContextSystemWorkspace.vue:461`):
```typescript
const conversationTester = useConversationTester(
  services,
  optimizationContext,
  // ... other parameters
)
```

**The Tester uses a reactive state tree internally**:
```typescript
// Inside useConversationTester (inferred)
const state = reactive({
  testResults: null,
  isTestingOriginal: false,
  isTestingOptimized: false,
  // ... lots of temporary state
})
```

#### Analysis

**Problems**:
- ❌ The Tester composable manages both temporary state and persisted state
- ❌ The reactive state tree and the Session Store may have split state
- ❌ Components have difficulty accessing the Session Store directly (it is encapsulated by the Tester)

**Migration guide recommendation**:
```typescript
// Target architecture
useContextWorkspaceOperations (public interface)
    ↓
useConversationTester (internal implementation, manages temporary state only)
    ↓
Session Store (the single source of truth for persisted state)
```

---

### 3. Image Mode (Already close to the target architecture)

#### Current State
```
ImageText2ImageWorkspace.vue
    ↓
Consumes useImageText2ImageSession (Pinia Store) directly
    ↓
ImageStorageService (image data storage)
```

#### Code Evidence

**Session Store** (`useImageText2ImageSession.ts:41-56`):
```typescript
export const useImageText2ImageSession = defineStore('imageText2ImageSession', () => {
  // ✅ Uses standalone refs, in line with Pinia best practices
  const originalPrompt = ref('')
  const optimizedPrompt = ref('')
  const reasoning = ref('')
  const originalImageResult = ref<ImageResult | null>(null)
  const optimizedImageResult = ref<ImageResult | null>(null)

  // ✅ Provides concise action methods
  const updatePrompt = (prompt: string) => {
    if (originalPrompt.value === prompt) return
    originalPrompt.value = prompt
    lastActiveAt.value = Date.now()
  }

  return {
    // state
    originalPrompt,
    optimizedPrompt,
    // ...

    // actions
    updatePrompt,
    updateOptimizedResult,
    // ...
  }
})
```

**Image storage separation** (`ImageStorageService`):
```typescript
// ✅ base64 data is stored in a separate IndexedDB
// ✅ The Session Store only stores an ImageRef
{
  id: 'img_123',
  _type: 'image-ref'
}
```

#### Analysis

**Pros**:
- ✅ Closest to the target architecture (Store + Operations)
- ✅ The Session Store uses standalone refs
- ✅ Reasonable data separation (image data vs metadata)
- ✅ Components can access the store directly

**Cons**:
- ⚠️ Business logic may be written directly in the component (Operations not extracted)
- ⚠️ The component may grow bloated (2205 lines)

---

## 🗺️ Migration Roadmap Analysis

### Phase 1: Infrastructure Preparation (Not started)

**Goal**: Establish guardrails and conventions

**Specific tasks**:
1. ✅ **Done**: Component consumption rules document (via the bug fix summary)
2. ❌ **Not done**: ESLint rule (forbid computed returning temporary objects)
3. ❌ **Not done**: Operations template/example
4. ❌ **Not done**: Migration checklist

**Why hasn't it been done?**
- The P0 bug was resolved with a local fix
- Building guardrails requires team coordination
- The return on investment is not high (the current architecture is stable)

---

### Phase 2: Basic Mode Migration (Not started)

**Goal**: Logic → Operations

**Migration steps** (as described in the guide):
```typescript
// Step 1: Create a new Operations composable
export function useBasicWorkspaceOperations(options) {
  // Only return process state and methods; do not wrap state
  const isOptimizing = ref(false)
  const handleOptimize = async () => { /* ... */ }

  return {
    isOptimizing,
    handleOptimize,
    handleTest,
    handleIterate
  }
}

// Step 2: The component consumes the store directly
const session = useBasicSystemSession()
const ops = useBasicWorkspaceOperations({ services, sessionStore: session })

// Access the store directly (not through the Logic layer)
const hasOriginalResult = computed(() => !!session.testResults?.originalResult)

// Trigger the operation
<button @click="ops.handleOptimize()">Optimize</button>
```

**Current vs target comparison**:

| Dimension | Current (Logic layer) | Target (Operations) |
|------|-----------------|-------------------|
| State access | `logic.testResults.value` | `session.testResults` |
| State type | ComputedRef | Native Ref |
| Business logic | Inside the Logic layer | Standalone Operations |
| Component binding | `logic.handleOptimize` | `ops.handleOptimize` |
| Reactivity trap | Easy to miss `.value` | Direct store access, no trap |

**Why hasn't it been migrated?**
1. **The current approach already works**: The P0 bug is fixed and functionality is normal
2. **High migration cost**: Requires refactoring 2 components + creating new Operations + regression testing
3. **High risk**: Basic mode is a core feature, so a failed migration has a wide impact
4. **Low priority**: No urgent business need is driving it

---

### Phases 3-5 (Not started)

- **Phase 3**: Context mode migration (Tester → Operations)
- **Phase 4**: Image mode alignment (add Operations extraction)
- **Phase 5**: Clean up deprecated code + performance optimization

---

## 💡 Key Findings

### 1. How the P0 Bug Was Actually Fixed

**Migration guide description**: Need to migrate to Store + Operations
**Actual fix**: A local fix to how components consume the state

**Before the fix** (`BasicSystemWorkspace.vue`):
```typescript
// ❌ Wrong: logic.testResults is a ComputedRef and `.value` was missed
const hasOriginalResult = computed(() => !!logic.testResults?.originalResult)
```

**After the fix** (`BasicSystemWorkspace.vue:365`):
```typescript
// ✅ Correct: explicitly use .value
const hasOriginalResult = computed(() => !!logic.testResults.value?.originalResult)
```

**Conclusion**: The P0 bug was resolved with a **minimal change**; a full architecture migration is not required.

---

### 2. The Actual Value of the Logic Layer

**The migration guide considers**: The Logic layer is "technical debt" and should be removed
**In reality**: The Logic layer provides value

**Advantages of the Logic layer**:
1. ✅ **Code reuse**: BasicSystem/BasicUser share one set of business logic (597 lines)
2. ✅ **State encapsulation**: Isolates the implementation details of the Session Store
3. ✅ **Clear responsibilities**: Components focus on UI, and Logic focuses on business logic

**Disadvantages of the Logic layer**:
1. ❌ **Reactivity trap**: Returns ComputedRef in object properties, so `.value` is easy to miss
2. ❌ **Indirection**: Adds a layer of abstraction, so debugging requires tracing multiple layers
3. ❌ **Does not match the Pinia paradigm**: Pinia recommends consuming the store directly

---

### 3. The Actual Resistance to Migration

**The migration guide assumes**: The team is willing to invest resources to complete the migration
**In reality**: There are multiple sources of resistance

**Sources of resistance**:
1. **Functionality is stable**: The P0 bug is fixed and there is no urgent business driver
2. **Low return on investment**: Migration takes weeks and the benefit is mainly "more elegant code"
3. **Regression risk**: Basic mode is a core feature, so a failed migration has a large impact
4. **Insufficient test coverage**: Without automated tests, it is hard to verify correctness after migration
5. **Team coordination cost**: Requires unified coding conventions and Code Review standards

---

## 📝 Recommendations

### Short Term (1-2 weeks)

**Keep the status quo; do not force migration**

**Reasons**:
1. The P0 bug is fixed and functionality is normal
2. The current architecture is imperfect but has been running stably
3. The cost-benefit ratio of migration is not high

**Optional improvements**:
- ✅ Add a component consumption rules document (to prevent missing `.value` again)
- ✅ Add an ESLint rule reminder (warn level)
- ✅ Add unit tests (to prevent regressions)

---

### Medium Term (1-3 months)

**Migrate gradually, ordered by priority**

**Priority**:
1. **Context mode** (highest priority)
   - Reason: The Tester composable's state management is messy and there is a risk of split state
   - Benefit: Unified architecture and improved maintainability

2. **Image mode** (medium priority)
   - Reason: Already close to the target architecture; only Operations extraction is needed
   - Benefit: Slimmer components and reuse of business logic

3. **Basic mode** (low priority)
   - Reason: The current approach already works and migration carries the greatest risk
   - Benefit: Mainly improved code elegance

---

### Long Term (3-6 months)

**Establish conventions; new code follows Store + Operations**

**Strategy**:
1. **Mandatory for new features**: All new features must use Store + Operations
2. **Refactor old code on demand**: Only refactor old code when it is being modified anyway
3. **Establish best practices**: Provide Operations templates and examples
4. **Continuous improvement**: Optimize a small part in each iteration

---

## 🎯 Conclusion

### The Role of the Migration Guide

**Nature of the document**: A long-term vision, not a mandatory execution plan
**Actual value**:
- ✅ Provides a direction for architecture improvement
- ✅ Summarizes the problems of the current architecture
- ✅ Designs a detailed migration plan

**But in reality**:
- ❌ Phases 1-5 have not started at all
- ❌ The Logic layer is still in use
- ❌ The three modes still use different architectures

### Is Migration Necessary?

**Answer**: Not mandatory; progress incrementally as needed

**Reasons**:
1. The P0 bug was resolved with a minimal change
2. The current architecture is stable and functionality is normal
3. The return on investment of migration is not high
4. The goal can be reached gradually through incremental improvement

### Recommended Path

```
Maintain the status quo (short term)
    ↓
Migrate Context mode first (medium term)
    ↓
Mandate Store + Operations for new features (long term)
    ↓
Refactor old code on demand (gradual convergence)
```

---

## 📌 Appendix: Quick Reference

### Comparison of the Three Current Modes

| Mode | Architecture | Needs migration? | Priority |
|------|------|-------------|--------|
| Basic | Store → Logic → Component | Optional | Low |
| Context | Tester → Component | Migration recommended | High |
| Image | Store → Component | Additional optimization | Medium |

### Key Code Locations

- **Basic Logic**: `packages/ui/src/composables/workspaces/useBasicWorkspaceLogic.ts` (597 lines)
- **Context Tester**: `packages/ui/src/composables/prompt/useConversationTester.ts`
- **Image Session**: `packages/ui/src/stores/session/useImageText2ImageSession.ts`
- **Migration guide**: `docs/workspace/architecture-migration-guide.md` (20 KB)
