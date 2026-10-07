# Session Store Test Results Display Bug Fix Record

**Date**: 2025-01-08
**Branch**: `hapi-var-extract`
**Scope of impact**: Test functionality in Basic mode (Basic mode - system/user prompts)
**Severity**: P0 (core functionality broken)

---

## 📋 Problem Description

### Symptoms
When running the test feature in Basic mode:
- ✅ Streaming updates are visible while the test is running
- ❌ After the test completes, the result area shows "No content yet"
- ❌ The `testResults` data in the Session Store does exist, but the UI does not display it

### Steps to Reproduce
1. Visit http://localhost:18181/#/basic/system
2. Enter an original prompt (e.g. "You are a poet")
3. Click the "Optimize" button to generate the optimized prompt
4. Click the "Test" button to run the test
5. Observe the result area: content is shown during the test, and "No content yet" is shown after the test completes

### Scope of Impact
- `BasicSystemWorkspace.vue` (system prompt mode)
- `BasicUserWorkspace.vue` (user prompt mode)
- All features that depend on test results (evaluation, comparison, etc.)

---

## 🔍 Investigation Process

### Phase 1: Data Flow Tracing

**Hypothesis 1**: The Session Store data was cleared
```typescript
// Check the Session Store's updateTestResults method
const updateTestResults = (results: TestResults | null) => {
  // Add a debug log
  console.log('[updateTestResults] called with:', results)
  testResults.value = results
}
```

**Conclusion**: The data was not cleared; the `testResults` value in the Session Store is correct

**Hypothesis 2**: Reactive tracking is broken
```typescript
// Check the computed getter in useBasicWorkspaceLogic.ts
const testResults = computed({
  get: () => {
    const result = sessionStore.testResults || {
      originalResult: '',
      originalReasoning: '',
      optimizedResult: '',
      optimizedReasoning: ''
    }
    console.log('[testResults getter] returning:', result)
    return result  // ❌ Returns a temporary object
  }
})
```

**Finding**: The getter returns a temporary default object, which breaks reactive tracking

### Phase 2: Investigation Assisted by Codex

After handing the problem to Codex for a deeper investigation, the **real root cause** was found:

```typescript
// ❌ The wrong code in BasicSystemWorkspace.vue
const hasOriginalResult = computed(() => !!logic.testResults?.originalResult)
//                                              ^^^^^^ missing .value

// ✅ The correct code
const hasOriginalResult = computed(() => !!logic.testResults.value?.originalResult)
```

**Core finding**:
- `logic.testResults` is a `ComputedRef<TestResults | null>`
- In `<script setup>`, a ComputedRef is **not unwrapped automatically**
- `.value` must be used to access the actual value
- Without `.value`, the boolean was always `false`

---

## 🎯 Root Cause Analysis

### 1. The Error-prone Nature of Vue 3's Reactivity System

```typescript
// In <template>: computed is unwrapped automatically ✅
<template>
  <div v-if="testResults?.originalResult">...</div>
</template>

// In <script setup>: computed is not unwrapped automatically ❌
<script setup>
const testResults = computed(() => sessionStore.testResults)
console.log(testResults?.originalResult)  // undefined!
console.log(testResults.value?.originalResult)  // Correct
</script>
```

**Key rules**:
- Only refs that are **top-level variables** are unwrapped automatically in `<script setup>`
- Refs inside object properties are **not** unwrapped automatically
- `ComputedRef` is a kind of ref and follows the same rule

### 2. Architecture Design Problems

```
Session Store (Pinia)
    ↓ testResults: Ref<TestResults | null>
Logic Layer (Composable)
    ↓ testResults: ComputedRef<TestResults | null>  ← double wrapping
Component
    ↓ hasOriginalResult = computed(() => !!logic.testResults?.originalResult)
    ↑                                        ^^^^ forgot .value
```

**Problems**:
- The Logic layer returns refs wrapped in an object
- Components need to unwrap them manually with `.value`
- TypeScript cannot catch this kind of runtime error
- It is easy to forget `.value`, causing bugs

### 3. Temporary Objects Break Reactivity

```typescript
// ❌ The code before the fix
const testResults = computed({
  get: () => {
    return sessionStore.testResults || {
      originalResult: '',
      originalReasoning: '',
      optimizedResult: '',
      optimizedReasoning: ''
    }
    // ^^^^ Returns a new temporary object every time; Vue cannot track it!
  }
})
```

**Problems**:
- When `sessionStore.testResults` is `null`, a temporary object is returned
- The reference of the temporary object is different every time
- Vue's reactivity system relies on object references to track changes
- Components that depend on this computed therefore cannot update correctly

---

## 🔧 Current Fix

### Fix 1: useBasicWorkspaceLogic.ts

**File**: `packages/ui/src/composables/workspaces/useBasicWorkspaceLogic.ts`

```typescript
// ❌ Before the fix
const testResults = computed<BasicSessionStore['testResults']>({
  get: () => {
    const result = sessionStore.testResults || {
      originalResult: '',
      originalReasoning: '',
      optimizedResult: '',
      optimizedReasoning: ''
    }
    console.log('[testResults getter]', result)
    return result
  },
  set: (value) => {
    console.log('[testResults setter]', value)
    sessionStore.updateTestResults(value)
  }
})

// ✅ After the fix
const testResults = computed<BasicSessionStore['testResults']>({
  get: () => {
    // ✅ Always return sessionStore.testResults (even if it is null)
    // Avoid returning a temporary object, which breaks reactive tracking
    return sessionStore.testResults
  },
  set: (value) => {
    sessionStore.updateTestResults(value)
  }
})
```

**Key improvements**:
1. Removed the temporary default object; always return `sessionStore.testResults`
2. Removed all debug logs
3. Simplified the code logic

### Fix 2: BasicSystemWorkspace.vue

**File**: `packages/ui/src/components/basic-mode/BasicSystemWorkspace.vue`

```typescript
// ❌ Before the fix
const hasOriginalResult = computed(() => !!logic.testResults?.originalResult)

// ✅ After the fix
const hasOriginalResult = computed(() => !!logic.testResults.value?.originalResult)
const hasOptimizedResult = computed(() => !!logic.testResults.value?.optimizedResult)

// ✅ Unwrap the refs in logic so they can be passed to child components
const unwrappedLogicProps = computed(() => ({
  isOptimizing: logic.isOptimizing.value,
  isTestingOriginal: logic.isTestingOriginal.value,
  optimizedReasoning: logic.optimizedReasoning.value,
  // ✅ Handle the case where testResults may be null
  testResultsOriginalResult: logic.testResults.value?.originalResult || '',
  testResultsOriginalReasoning: logic.testResults.value?.originalReasoning || '',
  testResultsOptimizedResult: logic.testResults.value?.optimizedResult || '',
  testResultsOptimizedReasoning: logic.testResults.value?.optimizedReasoning || ''
}))

// ✅ Evaluation handler
const testResultsComputed = computed(() => ({
  originalResult: logic.testResults.value?.originalResult || undefined,
  optimizedResult: logic.testResults.value?.optimizedResult || undefined
}))
```

### Fix 3: BasicUserWorkspace.vue

**File**: `packages/ui/src/components/basic-mode/BasicUserWorkspace.vue`

Apply the same fix pattern as BasicSystemWorkspace.vue.

---

## ✅ Verification Results

### Test Scenario 1: Basic-System Mode
```
Visit: http://localhost:18181/#/basic/system
Input: "You are a poet"
Optimize: ✅ Success
Test: ✅ Streaming updates display normally
      ✅ Results stay displayed after the test completes
      ✅ No longer reverts to "No content yet"
```

### Test Scenario 2: Basic-User Mode
```
Visit: http://localhost:18181/#/basic/user
Input: "You are a poet"
Optimize: ✅ Success
Test: ✅ Streaming updates display normally
      ✅ Results stay displayed after the test completes
```

### Console Logs
- ✅ No leftover debug logs
- ✅ No errors or warnings
- ✅ Reactive updates trigger normally

---

## 🏗️ Architecture Analysis

### Current Architecture: The Role of the Logic Layer

```
┌─────────────────────────────────────────────────────────────┐
│                    BasicSystemWorkspace.vue                  │
│                    (BasicUserWorkspace.vue)                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              useBasicWorkspaceLogic.ts                       │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 1. State proxy (wrapper around the Session Store)    │    │
│  │    - prompt, optimizedPrompt, testResults            │    │
│  │    - Adds default value handling (|| '')             │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │ 2. Process state management (non-persisted UI state) │    │
│  │    - isOptimizing, isTestingOriginal, isIterating    │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │ 3. History management (non-persisted history data)  │    │
│  │    - currentVersions, currentChainId                 │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │ 4. Business logic (shared core operations)           │    │
│  │    - handleOptimize, handleTest, handleIterate       │    │
│  │    - handleSwitchVersion, loadVersions              │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              useBasicSystemSession.ts                        │
│              (useBasicUserSession.ts)                        │
│            ┌──────────────────────────────────┐              │
│            │ Persisted state (Session Store)   │              │
│            │ - prompt, optimizedPrompt         │              │
│            │ - testResults, chainId, versionId │              │
│            │ - selectedModelKey, templateId    │              │
│            └──────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

### The Value of the Logic Layer

| Responsibility | Value | Cost |
|------|------|------|
| **Code reuse** | BasicSystem and BasicUser share 99% of the business logic | None |
| **State proxy** | Handles empty-value defaults uniformly (`|| ''`) | Components need `.value` |
| **Process state management** | Keeps the Session Store from being polluted by temporary state | Adds a layer of abstraction |
| **History management** | Does not persist large history data | Adds state management complexity |
| **Error handling** | Unified toast messages and error handling | None |

### Pain Points of the Current Architecture

#### Pain Point 1: Two-way Computed Violates One-way Data Flow

```typescript
// ❌ Current implementation
const prompt = computed<string>({
  get: () => sessionStore.prompt || '',
  set: (value) => sessionStore.updatePrompt(value || '')
})
```

**Problems**:
- Vue 3 advocates one-way data flow: `state → view → actions → state`
- Two-way computed breaks the clarity of the data flow direction
- Components cannot control when updates are triggered

#### Pain Point 2: Refs in Object Properties Must Be Unwrapped Manually

```typescript
// The Logic layer returns refs wrapped in an object
return {
  testResults,  // ComputedRef<TestResults | null>
  isOptimizing  // Ref<boolean>
}

// ❌ Components must use .value
const hasResult = computed(() => !!logic.testResults.value?.originalResult)
//                                                       ^^^^^^ easy to forget

// An unwrapped version must be created to pass to child components
const unwrappedLogicProps = computed(() => ({
  testResultsOriginalResult: logic.testResults.value?.originalResult || '',
  isOptimizing: logic.isOptimizing.value
  // ... lots of boilerplate
}))
```

**Problems**:
- Violates the design philosophy of the Composition API: refs should be unwrapped automatically in `<script setup>`
- Refs are unwrapped automatically only when they are **top-level variables**
- Refs in object properties are **not** unwrapped automatically

#### Pain Point 3: TypeScript Cannot Catch Runtime Errors

```typescript
// ✅ TypeScript type checking passes
const hasResult = computed(() => !!logic.testResults?.originalResult)

// ❌ Wrong runtime behavior
// logic.testResults is a ComputedRef object and has no originalResult property
// It should be logic.testResults.value?.originalResult
```

**Problems**:
- The TypeScript compiler cannot catch a missing `.value`
- `logic.testResults?.originalResult` is legal as far as types go
- But what is actually accessed is the ComputedRef object, not the TestResults

#### Pain Point 4: Over-abstraction

```typescript
// The Logic layer is merely forwarding Store operations
const prompt = computed<string>({
  get: () => sessionStore.prompt || '',
  set: (value) => sessionStore.updatePrompt(value || '')
})

const optimizedPrompt = computed<string>({
  get: () => sessionStore.optimizedPrompt || '',
  set: (value) => {
    sessionStore.updateOptimizedResult({
      optimizedPrompt: value || '',
      reasoning: sessionStore.reasoning || '',
      chainId: sessionStore.chainId || '',
      versionId: sessionStore.versionId || ''
    })
  }
})
```

**Problems**:
- The Logic layer has **no real business logic**; it only does **data forwarding**
- This is not abstraction; it is **indirection**
- It adds code complexity without bringing value

---

## 💡 Improvement Options

### Option A: Use `toRefs` for Automatic Unwrapping (Minimal Change)

**Applicable scenario**: A quick short-term fix that reduces similar bugs

```typescript
// ✅ Improved useBasicWorkspaceLogic.ts
import { toRefs } from 'vue'

export function useBasicWorkspaceLogic(...) {
  // ... existing code ...

  return {
    // ✅ Use toRefs to unwrap all refs automatically
    ...toRefs({
      prompt,
      optimizedPrompt,
      optimizedReasoning,
      testResults,
      selectedOptimizeModelKey,
      selectedTestModelKey,
      isOptimizing,
      isIterating,
      isTestingOriginal,
      isTestingOptimized,
      currentVersions,
      currentVersionId
    }),

    // Return methods directly
    handleOptimize,
    handleTest,
    handleIterate,
    handleSwitchVersion,
    loadVersions
  }
}

// ✅ No .value needed in components
const hasOriginalResult = computed(() => !!logic.testResults?.originalResult)
//                                              ^^^^^^ .value is no longer needed!
```

**Pros**:
- ✅ No `.value` needed in components
- ✅ Reactivity is preserved
- ✅ Type safe
- ✅ **Minimal change**

**Cons**:
- ⚠️ Still keeps two-way computed (violates one-way data flow)
- ⚠️ The Logic layer is still an indirection layer

---

### Option B: Remove the Logic Layer and Use the Store Directly (Recommended)

**Applicable scenario**: A long-term refactor that follows Vue 3 best practices

```typescript
// ✅ BasicSystemWorkspace.vue (after the refactor)
<script setup>
import { storeToRefs } from 'pinia'
import { useBasicSystemSession } from '../../stores/session/useBasicSystemSession'
import { useBasicWorkspaceOperations } from '../../composables/workspaces/useBasicWorkspaceOperations'

// 1. State: use the Store directly
const sessionStore = useBasicSystemSession()
const { prompt, testResults, optimizedPrompt } = storeToRefs(sessionStore)

// 2. Derived state: defined in the component
const hasOriginalResult = computed(() =>
  !!testResults.value?.originalResult
)

const hasOptimizedResult = computed(() =>
  !!testResults.value?.optimizedResult
)

// 3. Business logic: obtained from a dedicated composable
const { handleOptimize, handleTest, handleIterate } = useBasicWorkspaceOperations({
  sessionStore,
  services,
  optimizationMode: 'system'
})
</script>

// ✅ useBasicWorkspaceOperations.ts (new composable)
export function useBasicWorkspaceOperations(options: {
  sessionStore: BasicSessionStore
  services: Ref<AppServices | null>
  optimizationMode: 'system' | 'user'
}) {
  const { sessionStore, services, optimizationMode } = options
  const toast = useToast()
  const { t } = useI18n()

  // UI process state (not persisted)
  const isOptimizing = ref(false)
  const isTestingOriginal = ref(false)
  const isTestingOptimized = ref(false)

  // ✅ Contains only operation logic, no state proxy
  const handleOptimize = async () => {
    if (!sessionStore.prompt?.trim()) {
      toast.error(t('prompt.error.noPrompt'))
      return
    }

    const promptService = services.value?.promptService
    if (!promptService) {
      toast.error(t('toast.error.serviceInit'))
      return
    }

    isOptimizing.value = true

    try {
      const request: OptimizationRequest = {
        optimizationMode,
        targetPrompt: sessionStore.prompt,
        templateId: sessionStore.selectedTemplateId || '',
        modelKey: sessionStore.selectedOptimizeModelKey
      }

      // Clear the history binding
      sessionStore.updateOptimizedResult({
        optimizedPrompt: '',
        reasoning: '',
        chainId: '',
        versionId: ''
      })

      await promptService.optimizePromptStream(request, {
        onToken: (token: string) => {
          // ✅ Update the store directly
          sessionStore.updateOptimizedResult({
            optimizedPrompt: (sessionStore.optimizedPrompt || '') + token,
            reasoning: sessionStore.reasoning || '',
            chainId: sessionStore.chainId || '',
            versionId: sessionStore.versionId || ''
          })
        },
        onComplete: async () => {
          // Handle the history record
          const historyManager = services.value?.historyManager
          if (historyManager) {
            const recordData = {
              id: uuidv4(),
              originalPrompt: sessionStore.prompt,
              optimizedPrompt: sessionStore.optimizedPrompt,
              type: optimizationMode === 'system' ? 'system-optimize' : 'user-optimize',
              modelKey: sessionStore.selectedOptimizeModelKey,
              templateId: sessionStore.selectedTemplateId || '',
              timestamp: Date.now()
            }

            const chain = await historyManager.createNewChain(recordData)
            sessionStore.updateOptimizedResult({
              optimizedPrompt: sessionStore.optimizedPrompt,
              reasoning: sessionStore.reasoning || '',
              chainId: chain.chainId,
              versionId: chain.currentRecord.id
            })

            toast.success(t('toast.success.optimizeSuccess'))
          }
        },
        onError: (error: Error) => {
          throw error
        }
      })
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      toast.error(t('toast.error.optimizeFailed') + ': ' + err.message)
    } finally {
      isOptimizing.value = false
    }
  }

  const handleTest = async () => {
    // ... similar implementation
  }

  const handleIterate = async () => {
    // ... similar implementation
  }

  return {
    // Process state
    isOptimizing,
    isTestingOriginal,
    isTestingOptimized,

    // Business logic
    handleOptimize,
    handleTest,
    handleIterate
  }
}
```

**Pros**:
- ✅ Follows Vue 3's one-way data flow principle
- ✅ Components use the Store directly, which is clear and straightforward
- ✅ The composable contains only business logic and UI process state, with a single responsibility
- ✅ No `.value` needed to unwrap object properties
- ✅ Easy to test and maintain

**Cons**:
- ⚠️ Multiple components need to be refactored
- ⚠️ The responsibilities of the Logic layer must be split

---

### Option C: Keep the Logic Layer but Refactor It into a Real Composable

**Applicable scenario**: You want to keep the code reuse of the Logic layer while following Vue 3 best practices

```typescript
// ✅ useBasicWorkspace.ts (after the refactor)
export function useBasicWorkspace(options: {
  mode: 'system' | 'user'
}) {
  const { mode } = options
  const sessionStore = mode === 'system'
    ? useBasicSystemSession()
    : useBasicUserSession()

  const toast = useToast()
  const { t } = useI18n()

  // ✅ UI process state (not persisted)
  const isOptimizing = ref(false)
  const isTestingOriginal = ref(false)
  const isTestingOptimized = ref(false)

  // ✅ History management (not persisted)
  const currentVersions = ref<PromptRecordChain['versions']>([])
  const currentChainId = ref('')
  const currentVersionId = ref('')

  // ✅ Derived state (defined inside the composable)
  const hasOriginalResult = computed(() =>
    !!sessionStore.testResults?.originalResult
  )

  const hasOptimizedResult = computed(() =>
    !!sessionStore.testResults?.optimizedResult
  )

  // ✅ Business logic
  const handleTest = async () => {
    if (!sessionStore.optimizedPrompt) {
      toast.error(t('prompt.error.noOptimizedPrompt'))
      return
    }

    const promptService = services.value?.promptService
    if (!promptService) return

    const isCompareMode = !!sessionStore.isCompareMode
    const testInput = sessionStore.testContent || ''

    if (mode === 'system' && !testInput.trim()) {
      toast.error(t('test.simpleMode.help'))
      return
    }

    // First clear the session store's testResults
    sessionStore.updateTestResults(null)

    // Initialize the test results
    sessionStore.updateTestResults({
      originalResult: '',
      originalReasoning: '',
      optimizedResult: '',
      optimizedReasoning: ''
    })

    try {
      // Compare mode: test the original prompt first
      if (isCompareMode) {
        isTestingOriginal.value = true
        const systemPrompt = mode === 'system' ? sessionStore.prompt : ''
        const userPrompt = mode === 'system' ? testInput : sessionStore.prompt

        await promptService.testPromptStream(
          systemPrompt,
          userPrompt,
          sessionStore.selectedTestModelKey,
          {
            onToken: (token: string) => {
              const results = sessionStore.testResults
              sessionStore.updateTestResults({
                ...results,
                originalResult: (results?.originalResult || '') + token
              })
            },
            onComplete: () => {
              isTestingOriginal.value = false
            },
            onError: (error: Error) => {
              throw error
            }
          }
        )
      }

      // Test the optimized prompt
      isTestingOptimized.value = true
      const optimizedSystemPrompt = mode === 'system' ? sessionStore.optimizedPrompt : ''
      const optimizedUserPrompt = mode === 'system' ? testInput : sessionStore.optimizedPrompt

      await promptService.testPromptStream(
        optimizedSystemPrompt,
        optimizedUserPrompt,
        sessionStore.selectedTestModelKey,
        {
          onToken: (token: string) => {
            const results = sessionStore.testResults
            sessionStore.updateTestResults({
              ...results,
              optimizedResult: (results?.optimizedResult || '') + token
            })
          },
          onComplete: () => {
            toast.success(t('toast.success.testComplete'))
          },
          onError: (error: Error) => {
            throw error
          }
        }
      )
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      toast.error(t('toast.error.testFailed') + ': ' + err.message)
    } finally {
      isTestingOriginal.value = false
      isTestingOptimized.value = false
    }
  }

  const handleOptimize = async () => {
    // ... similar implementation
  }

  const handleIterate = async () => {
    // ... similar implementation
  }

  // ✅ Return standalone refs (returned directly, not wrapped in an object)
  return {
    // Derived state
    hasOriginalResult,    // ComputedRef<boolean>
    hasOptimizedResult,   // ComputedRef<boolean>

    // Process state
    isOptimizing,         // Ref<boolean>
    isTestingOriginal,    // Ref<boolean>
    isTestingOptimized,   // Ref<boolean>

    // History management
    currentVersions,      // Ref<PromptRecord[]>
    currentChainId,       // Ref<string>
    currentVersionId,     // Ref<string>

    // Actions
    handleTest,
    handleOptimize,
    handleIterate,
    handleSwitchVersion,
    loadVersions
  }
}

// ✅ Usage in a component
<script setup>
import { useBasicWorkspace } from '../../composables/workspaces/useBasicWorkspace'

const {
  hasOriginalResult,    // ComputedRef - unwrapped automatically
  hasOptimizedResult,   // ComputedRef - unwrapped automatically
  isOptimizing,         // Ref - unwrapped automatically
  handleTest            // Function
} = useBasicWorkspace({ mode: 'system' })

// ✅ Use directly in the template; no .value needed
</script>

<template>
  <div v-if="hasOriginalResult">{{ testResults }}</div>
  <button :disabled="isOptimizing" @click="handleTest">Test</button>
</template>
```

**Pros**:
- ✅ Returns standalone refs, which are unwrapped automatically in `<script setup>`
- ✅ Derived state is defined inside the composable, so components do not need to care
- ✅ UI process state and business logic are encapsulated together
- ✅ Extremely concise component code
- ✅ Preserves the value of code reuse

**Cons**:
- ⚠️ The Logic layer needs to be refactored
- ⚠️ The composable becomes more complex (but also more complete)

---

## 📊 Option Comparison

| Aspect | Current architecture | Option A: toRefs | Option B: Remove Logic | Option C: Refactor Logic |
|------|---------|---------------|-------------------|-------------------|
| **Change cost** | - | Small | Large | Medium |
| **Vue 3 best practices** | ❌ | ⚠️ Partially compliant | ✅ Fully compliant | ✅ Fully compliant |
| **Data flow clarity** | ❌ Two-way | ⚠️ Two-way | ✅ One-way | ✅ One-way |
| **Component code size** | Medium | Medium | Small | Small |
| **Needs .value** | Yes (object properties) | No | No | No |
| **Type safety** | ⚠️ Runtime errors | ✅ | ✅ | ✅ |
| **Code reuse** | ✅ | ✅ | ⚠️ Manual extraction needed | ✅ |
| **Testability** | ⚠️ | ⚠️ | ✅ | ✅ |
| **Recommendation** | - | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

---

## 🎯 Recommendations

### Short-term (current phase)
- ✅ Use **Option A (toRefs)** for a quick fix
- ✅ Add an ESLint rule to detect common missing `.value` cases
- ✅ Add unit tests covering reactive updates

### Long-term (architecture refactor)
- ✅ Consider **Option B (remove the Logic layer)** or **Option C (refactor the Logic)**
- ✅ Use one-way data flow consistently
- ✅ Split the Logic layer into smaller composables with a single responsibility

---

## 📝 Lessons Learned

### 1. Pitfalls of Vue 3's Reactivity System
- ⚠️ Computed is unwrapped automatically in `<template>` but not in `<script setup>`
- ⚠️ Only top-level variable refs are unwrapped automatically; refs in object properties are not
- ⚠️ TypeScript cannot catch a missing `.value`

### 2. Architecture Design Principles
- ✅ Avoid two-way computed; use one-way data flow
- ✅ A composable should return standalone refs rather than refs wrapped in an object
- ✅ Prefer the patterns officially recommended by Vue over home-grown patterns
- ✅ Over-abstraction increases complexity and lowers maintainability

### 3. Debugging Tips
- ✅ Add detailed logs to trace the data flow
- ✅ Check that reactive dependencies are established correctly
- ✅ Verify whether temporary objects break reactivity
- ✅ Use AI assistants such as Codex for deep analysis

### 4. Code Review Points
- ⚠️ Check that all ComputedRef accesses use `.value`
- ⚠️ Check for computed getters that return temporary objects
- ⚠️ Check for two-way bindings that violate one-way data flow
- ⚠️ Check whether the Logic layer has real value or is just an indirection layer

---

## 🔗 Related Resources

- [Vue 3 Official Docs - Reactivity Fundamentals](https://vuejs.org/guide/essentials/reactivity-fundamentals.html)
- [Vue 3 Official Docs - Composables](https://vuejs.org/guide/reusability/composables.html)
- [Pinia Official Docs - Core Concepts](https://pinia.vuejs.org/core-concepts/)
- [Vue 3 Style Guide](https://vuejs.org/style-guide/)

---

## 📌 TODO

- [ ] Choose the final refactor option (A/B/C)
- [ ] Add an ESLint rule to detect missing `.value`
- [ ] Add unit tests covering reactive updates
- [ ] Refactor the Logic layer (if Option B or C is chosen)
- [ ] Update related documentation and comments

---

**Document maintenance**: Please update this document after the later refactor to record the final implementation approach and results.
