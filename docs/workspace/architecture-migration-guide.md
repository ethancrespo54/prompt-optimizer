# Architecture Migration Guide: Unifying the Session Store and Workspace Architecture (2025-01-08)

> This document consolidates:
> - `docs/workspace/session-store-testresults-bug-fix-2025-01-08.md` (bug fix record)
> - `docs/workspace/workspace-architecture-comparison-2025-01-08.md` (architecture comparison analysis)
>
> Goal: provide an **actionable, rollback-friendly, phased** migration roadmap that ends up unified on **Option C: Store + Operations**.
> Note: this document only covers solution design and the roadmap; it does not execute any migration.

---

## 0. Executive Summary

- **Root cause of the P0 bug**: Basic mode components missed `.value` when accessing a `ComputedRef` in `<script setup>` (for example `logic.testResults?.originalResult`), so the derived boolean was always `false`, and after a test finished the UI fell back to "No content yet". There is also a latent hazard where a computed getter returns a temporary object (breaking dependency tracking).
- **Short-term strategy (1-2 weeks)**: Establish team rules and guardrails (lint/tsc/tests), with "reducing the chance of missing `.value`" as the first goal, to avoid another P0 of the same kind.
- **Medium-term strategy (2-5 weeks)**: Use Basic mode as a pilot and introduce an **Operations layer** (side effects / flow logic) so components **consume the Pinia Store (single source of truth) directly**, reducing the "Logic layer wraps another layer of refs/computed".
- **Long-term strategy (1-2 months)**: Unify all three modes onto **Store + Operations**; delete the deprecated Logic layer; optimize the performance path of streaming token updates.

---

## 1. Problem Discovery and Root Cause Analysis (from document 1)

### 1.1 Symptoms and Reproduction
- When a test runs in Basic mode: content is visible during the streaming phase; after the test finishes, the result area goes back to "No content yet".
- The `testResults` data in the Session Store actually exists, but the UI does not display it.

Reproduction (example):
1) Visit `/#/basic/system`  
2) Generate an optimized prompt  
3) Click "Test"  
4) It is displayed during streaming; it disappears after completion

### 1.2 Investigation Conclusions
1) **"Data was cleared" is not the main cause**: the `testResults` value in the store is correct.
2) **A computed returning a temporary object is a hazard**: when `testResults` is `null`, returning a new object breaks dependency tracking (especially in reference comparison/caching/derived computation).
3) **The real root cause (which triggered the P0)**: the component treats a `ComputedRef` as a plain object inside `<script setup>` and misses `.value`:

```ts
// Wrong: logic.testResults is ComputedRef<TestResults | null>
const hasOriginalResult = computed(() => !!logic.testResults?.originalResult)

// Correct
const hasOriginalResult = computed(() => !!logic.testResults.value?.originalResult)
```

### 1.3 Lessons Learned (Transferable Rules)
- Refs are automatically unwrapped in `<template>`; but in JS expressions in `<script setup>`, **refs/computed still need `.value` (or `unref()`/`toValue()`)**.
- "Refs/computed inside object properties" are very easy to mistake for plain values.
- TypeScript cannot always catch this kind of error (common reasons: `any`/overly broad types, lost inference, opaque return types from indirection layers).

---

## 2. Comparison of the Three Mode Architectures (from document 2)

### 2.1 Basic Mode (Store → Logic → Component)
```
Component (BasicSystem/UserWorkspace)
  ↓
useBasicWorkspaceLogic (state proxy + process state + business logic)
  ↓
Pinia Session Store (persisted fields, single source of truth)
```

Characteristics:
- Pros: system/user reuse; logic is centralized.
- Cons: the Logic layer returns "ComputedRef/Ref inside object properties", so components easily miss `.value`; it may introduce two-way computed and implicit write chains.

### 2.2 Context Mode (Tester composable → Component)
```
Component (Context workspace)
  ↓
Tester composable (reactive state tree + flow logic)
  ↓
(Partial) Session/Preference persistence
```

Characteristics:
- Pros: a good consumption experience for the reactive state tree; convenient organization of streaming/process state.
- Cons: easily "grows into another store"; inconsistent style with Basic/Image.

### 2.3 Image Mode (Direct Store access → Component)
```
Component (Image workspace)
  ↓
Pinia Session Store (state wrapper, or can be migrated to split refs)
```

Characteristics:
- Pros: a good Pinia store proxy access experience; a clear single source of truth; closest to the paradigm recommended by Pinia.
- Cons: if business operations are not extracted, components will bloat (solvable with Operations).

---

## 3. Evaluation of Unification Options (combining both documents)

> Unification goal: reduce high-probability incidents like "forgot `.value` in a script"; bring the data flow closer to the **one-way data flow** and **single source of truth** recommended by Vue 3/Pinia.

### 3.1 Option A: Quick Stopgap (toRefs/unwrapping tricks)
Core idea: flatten the "refs/computed inside object properties" in the Logic layer to reduce the chance of missing `.value`.

Pros:
- Small change with quick results; suited to a 1-2 week stopgap window.

Cons:
- It is essentially a "syntax-level workaround" and does not solve structural problems such as "indirection bloat / two-way computed / unclear boundaries".
- Derived computed in scripts may still miss `.value`.

Conclusion: **Usable in the short term, but not the final form**.

### 3.2 Option B: Keep the Logic Layer but Return a Safer ViewModel
Core idea: move derived values such as `hasOriginalResult` back into the composable, and have components avoid "re-deriving" complex ref trees in scripts.

Pros:
- Medium change cost; keeps the reuse value; significantly reduces the chance of pitfalls.

Cons:
- Still keeps a custom ViewModel API layer, which may keep growing over time.

Conclusion: **Acceptable as a medium-term transitional option**.

### 3.3 Option C: Store + Operations (Long-term recommendation)
Core idea:
- **Store**: only manages state and minimal synchronous actions (single source of truth, persistable fields)
- **Operations composable**: only responsible for async flows/side effects (test, optimize, iterate, history loading), writing state through store actions
- **Component**: consumes the store directly (using `storeToRefs` when needed), with a small amount of UI-derived computed

Pros:
- Matches the Vue 3/Pinia recommendations: one-way data flow, clear responsibilities, strong testability, lowest long-term maintenance cost.
- Avoids to the greatest extent the uncertainty of "stuffing refs/computed into the object returned by the Logic layer".

Cons:
- Higher initial migration and coordination cost; needs a roadmap and guardrails.

Conclusion: **The final target option**.

---

## 4. Long-term Goal: Complete Design of Option C (Store + Operations)

### 4.1 Target Architecture Diagram (Target State)

```
┌──────────────────────────────────────────────────────┐
│ Component (Workspace)                                │
│  - Consumes the Pinia store directly (storeToRefs    │
│    when needed)                                      │
│  - A small amount of UI-derived computed (or moved   │
│    to a derived composable)                          │
│  - Triggers ops.handle*                              │
└──────────────────────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────┐
│ Operations composable (side effects / flow)          │
│  - handleOptimize / handleIterate / handleTest       │
│  - Calls services, handles streaming tokens,         │
│    exceptions and toasts                             │
│  - Writes state through store actions                │
└──────────────────────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────┐
│ Pinia Session Store (single source of truth +        │
│ persisted fields)                                    │
│  - state: prompt/optimizedPrompt/testResults/...     │
│  - actions: updatePrompt/updateTestResults/...       │
│  - saveSession/restoreSession (PreferenceService)    │
└──────────────────────────────────────────────────────┘
```

### 4.2 Responsibility Boundaries (Hard Constraints)
- The Store does not: make network calls, orchestrate complex flows, show UI toasts, or choose token concatenation strategies.
- Operations do not: implement persistence details (except by calling store.saveSession) or choose cross-mode routes.
- Components do not: orchestrate long flows (other than orchestrate-level composition), to avoid piling up business logic.

### 4.3 Component Consumption Rules (Mandatory)
1) **Prefer accessing Pinia store proxy properties directly** (avoid destructuring, which loses reactivity).
2) When destructuring is needed:
   - store: only use `storeToRefs(store)`
   - plain composable returns: return the ref itself, and the consumer uses `unref()`/`.value`
3) When writing derived values in `<script setup>`:
   - Recommended: `computed(() => !!unref(testResults)?.originalResult)`
   - Or explicitly: `testResults.value?.originalResult`
4) Forbidden: a computed getter returning a "temporary default object" to pretend to be non-null; it should return `null`, and the UI should provide the fallback.
5) Forbidden: two write chains for the same field (`watch` sync + computed setter sync).

### 4.4 Operations API Design Suggestion (Basic example)
> Only defines the interface/responsibilities, not concrete implementation details (to be carried out in Phase 2).

```ts
export interface UseBasicWorkspaceOperationsOptions {
  services: Ref<AppServices | null>
  sessionStore: BasicSessionStore
  optimizationMode: 'system' | 'user'
  promptRecordType: PromptRecordType
}

export function useBasicWorkspaceOperations(options: UseBasicWorkspaceOperationsOptions) {
  // Process state (can be returned to the component)
  const isOptimizing = ref(false)
  const isTestingOriginal = ref(false)
  const isTestingOptimized = ref(false)

  // actions (returned to the component to bind button events)
  const handleOptimize = async () => {}
  const handleIterate = async (_payload: IteratePayload) => {}
  const handleTest = async (_testVariables?: Record<string, string>) => {}

  return {
    isOptimizing,
    isTestingOriginal,
    isTestingOptimized,
    handleOptimize,
    handleIterate,
    handleTest
  }
}
```

---

## 5. Phased Migration Roadmap (Near term → Medium term → Long term)

> Times are estimates (assuming one small team); every phase must have a rollback strategy.

### Phase 1: Infrastructure Preparation (1-2 weeks)

**Goals and deliverables**
- Unify the "component consumption rules" and coding conventions (write them into docs + the code review checklist).
- Establish guardrails: `vue-tsc`, ESLint rules, key-path test cases.
- Provide reusable composable templates/examples (Operations template, derived template).
- Produce a migration checklist (used in Phases 2-5).

**Specific steps (no migration is executed, preparation only)**
1) Add a conventions document: component consumption rules, forbidden patterns, recommended patterns.
2) ESLint rule suggestions (adapt to the existing ESLint setup):
   - Required: forbid destructuring the store directly (require `storeToRefs`)
   - Required: forbid computed getters returning temporary objects (code review + rule/convention)
   - Suggested: add restrictions on `any`/broad types (reduce TS "escapes")
3) CI/local scripts: include `pnpm -F @prompt-optimizer/ui test`, `pnpm -F @prompt-optimizer/ui build`, and `pnpm -F @prompt-optimizer/web build` in the key checks.
4) Templates and examples:
   - `useXxxOperations` template (async flows/side effects)
   - `useXxxDerived` template (derived state aggregation, optional)
5) Draft migration checklist (see §6).

**Risks**
- Guardrails that are too strict may block work during migration: go gradually, "warning → error".
- ESLint/tsc configuration differences: must be compatible with the existing toolchain.

**Acceptance criteria**
- The team consensus document is in place (reviewable).
- Key commands run stably locally and in CI.
- A copyable Operations example is provided (covering at least the interface design of one of the Basic test/optimize flows).

**Rollback strategy**
- Phase 1 only adds documents and tool configuration; if it causes blocking, downgrade to warnings or disable rules locally.

**Time estimate**
- 3-5 working days (depending on the complexity of toolchain adjustments).

---

### Phase 2: Basic Mode Migration (2-3 weeks)

**Goals and deliverables**
- Migrate Basic mode from "Store → Logic → Component" to "Store + Operations".
- Clearly separate state (store) from flow (operations).
- Eliminate the script consumption trap caused by "the Logic layer returning ComputedRef in object properties".

**Design points**
1) Store structure
   - The existing Basic store has already been migrated to the "standalone ref" form (no need to force further structural changes).
   - Only adjust when truly necessary: for example, add finer-grained actions for token streaming (`appendOriginalToken`, etc.).
2) Operations interface
   - `useBasicWorkspaceOperations({ services, sessionStore, optimizationMode, promptRecordType })`
   - Process state is managed by operations (`isTestingOriginal`, etc.) and can be returned to the component.
3) Component layer
   - Components use the store proxy or `storeToRefs` directly, avoiding an intermediate wrapper layer.
   - UI-derived computed are either based directly on the store or extracted into `useBasicWorkspaceDerived` (optional).

**Migration steps (not executed, description only)**
1) Add `useBasicWorkspaceOperations.ts` (coexisting with the old `useBasicWorkspaceLogic.ts`).
2) In BasicSystem/UserWorkspace:
   - Switch button events from `logic.handle*` to `ops.handle*` (can be switched via a feature flag or branch).
   - Switch state reads from `logic.xxx` to `session.xxx` (`storeToRefs(session)` when necessary).
3) Run both in parallel to verify: keep the old logic path for rollback.
4) When done: converge/delete `useBasicWorkspaceLogic.ts` or keep it only as a thin adapter layer (deleted in Phase 5).

**Rollback plan**
- Keep the old `useBasicWorkspaceLogic` entry point and component binding approach; if a regression occurs, switch back to the old entry point (feature flag / revert commit).

**Acceptance criteria (must be measurable)**
- Manual acceptance: `/#/basic/system` and `/#/basic/user`
  - Test: streaming display + the result does not disappear after completion
  - Restore works after refresh (if the mode requires persistence)
  - Mode switching does not cause cross-contamination (single source of truth)
- Automated:
  - `pnpm -F @prompt-optimizer/ui test` passes
  - `pnpm -F @prompt-optimizer/ui build` passes
  - Add/update at least 1 unit test covering "test result display" (to prevent regressions)

**Risks**
- Double writes to the same field (watch + action) causing overwrites: the "single write path" must be made explicit during migration.
- High token update frequency: avoid unnecessary deep watchers or large amounts of object copying (handled in Phase 5).

**Time estimate**
- 8-12 working days (including regression verification and test completion).

---

### Phase 3: Context Mode Migration (1-2 weeks)

**Goals and deliverables**
- Align Context mode, currently dominated by the "Tester reactive state tree", with "Store + Operations".
- Keep the advantages of the Tester composable (process state organization / stream handling), but define its boundary clearly: it should become an Operations/internal implementation rather than a second store.

**Special considerations (reactive state tree)**
- A reactive state tree is suited to process and temporary state, but persisted fields should land in the store (single source of truth).
- Route the Tester's "final result writes" through store actions to avoid split state.

**Suggested integration plan**
1) Split the existing Tester composable:
   - `useContextWorkspaceOperations`: exposes handleTest/handleOptimize, etc.
   - `useConversationTester` (internal implementation, can keep the reactive state tree)
2) Components consume the Context session store directly (`storeToRefs` when needed).
3) Define "derived state (hasOriginalResult, etc.)" consistently:
   - Either as component computed (based on the store)
   - Or extract it into a derived composable (reused by multiple components)

**Rollback strategy**
- Keep the original Tester entry point; migrate page by page / feature by feature behind switches (A/B comparison).

**Acceptance criteria**
- Key Context mode flows (optimize/test/evaluate/persist) pass regression cases.
- No "mutual overwriting / out-of-sync" between the store and the reactive tree.

**Time estimate**
- 5-8 working days.

---

### Phase 4: Image Mode Alignment (1 week)

**Goals and deliverables**
- Image mode is already close to "direct Store access"; the main work is aligning with the Operations conventions and naming to form a consistent development experience.
- Keep the standalone composables (such as `useImageGeneration`) as internal implementations or dependencies of operations.

**Alignment steps (not executed, description only)**
1) Introduce `useImageWorkspaceOperations` (unifying the naming style of handleGenerate/handleIterate/handleTest, etc.).
2) Unify component consumption: store (state) + ops (flow).
3) Clarify which fields are persisted and which are process state (avoid writing temporary state into the session).

**Acceptance criteria**
- The two Image sub-modes (text2image/image2image) behave consistently; mode switching does not cause cross-contamination.
- Build and tests pass.

**Time estimate**
- 3-5 working days.

---

### Phase 5: Cleanup and Optimization (1 week)

**Goals and deliverables**
- Delete the deprecated Logic layer and outdated sync watches.
- Clean up two-way computed and converge the write paths.
- Performance optimization: streaming token writes reduce object allocation and deep watch cost.

**Cleanup items**
- Delete/replace: `useBasicWorkspaceLogic.ts` (or remove it after downgrading it to a thin adapter layer).
- Delete: sync watches that exist only for the old architecture (avoid double writes).
- Documentation update: write the "final best practices" into the team conventions and README/development guide.

**Performance optimization suggestions (token streaming)**
- Prefer providing finer-grained actions in the store:
  - `appendOriginalResultToken(token)` / `appendOptimizedResultToken(token)`
  - Reduce object copying such as `testResults = { ...testResults, field: field + token }`
- Avoid unnecessary `deep: true` watches (use explicit actions instead of watches where possible).

**Acceptance criteria**
- No dead code where "the old Logic layer is still referenced".
- Performance metrics: UI stutter during long-text streaming tests is noticeably reduced (subjective + simple performance sampling).
- Key commands pass: build/test.

**Rollback strategy**
- Execute the cleanup phase in "separate PRs" so each step can be reverted; avoid large one-time deletions.

**Time estimate**
- 3-5 working days.

---

## 6. Migration Checklist (Suggested Template)

> For each workspace/mode migrated, follow this checklist.

**Design checks**
- [ ] Is the store the single source of truth (persisted fields do not fork)?
- [ ] Is there a double-write chain (watch + action / computed setter + action)?
- [ ] Is there a computed getter returning a temporary object?
- [ ] Are Operations only responsible for flows and side effects, without directly holding persisted state?

**Component consumption checks**
- [ ] Does it consume the store proxy or `storeToRefs` directly? (No bare destructuring of the store)
- [ ] Are all refs/computed in `<script setup>` accessed through `.value`/`unref()`?
- [ ] Is derived state based on the store as much as possible, rather than on "refs inside object properties"?

**Regression checks**
- [ ] Test streaming display and that it remains displayed after completion
- [ ] Restore behavior after refresh is correct (if the mode requires it)
- [ ] No contamination on mode switching
- [ ] `pnpm -F @prompt-optimizer/ui test` / `build` pass

---

## 7. Appendix

### 7.1 Old vs New Architecture Diagram (Simplified)

**Old (high-risk point: refs in object properties)**
```
store → useBasicWorkspaceLogic (returns { testResults: ComputedRef }) → component
                                     ↑
                                Easy to miss .value
```

**New (target state)**
```
component → operations → store (single source of truth)
        ↘︎ (read)  ↗︎ (write)
```

### 7.2 Component Consumption Rules Cheat Sheet

| Scenario | Recommended | Not recommended | Reason |
|---|---|---|---|
| Read a store field | `session.testResults` | `const { testResults } = session` | Bare destructuring loses reactivity |
| Destructure store fields | `const { testResults } = storeToRefs(session)` | `const { testResults } = session` | Pinia recommendation |
| Read a Ref in a script | `unref(testResults)?.x` / `testResults.value?.x` | `testResults?.x` | `<script setup>` does not "auto-unwrap refs in object properties" the way you expect |
| computed default value | Fallback in the UI layer | Getter returns a new object | Temporary objects break tracking/caching |

### 7.3 Common Pitfalls and Solutions
- **Pitfall: accessing a ComputedRef as an object** → consistently use `unref()`/`.value`, or put the derived value inside the composable and return it.
- **Pitfall: bare destructuring of the store causes no updates** → consistently use `storeToRefs`.
- **Pitfall: deep watch + frequent updates to large objects** → write at fine granularity through store actions (append token).
- **Pitfall: two-way computed + watch double writes** → determine a single write path and delete the redundant syncs.

### 7.4 References
- Vue 3: Reactivity Fundamentals: https://vuejs.org/guide/essentials/reactivity-fundamentals.html
- Vue 3: Composables: https://vuejs.org/guide/reusability/composables.html
- Pinia: Core Concepts / storeToRefs: https://pinia.vuejs.org/core-concepts/
