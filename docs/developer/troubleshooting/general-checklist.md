# UI Module File-Level Troubleshooting Checklist (v3)

This document organizes and indexes the common troubleshooting checklists **by specific file**. When you hit a problem, you can go straight to the relevant file and check all the key points listed below. Whenever a team member solves a problem using this checklist, they should consider updating this file to keep it current.

---

## Part 1: Application Entry and State Assembly

### 📍 `packages/web/src/App.vue`

This is the main entry point that assembles all core Composables and UI components, and is the starting point for investigating problems.

- **[x] Top-level Composable calls**: Confirm that all `use...()` hooks are called at the top level of `<script setup>`. They must never live inside `async` functions, `.then()` callbacks, or any other asynchronous logic.
- **[x] `toRef` adapter**: Check all props passed to child Composables. If a property of a `reactive` object (such as `optimizerState.currentChainId`) is passed to a Composable that expects a `Ref` parameter, make sure it is correctly wrapped with `toRef(optimizerState, 'currentChainId')`.

---

## Part 2: Composable Architecture and Logic

### 📍 `packages/ui/src/composables/useAppInitializer.ts`
- **[x] Dependency injection completeness**: Confirm that all services the app depends on (such as `templateLanguageService`) are correctly registered in the `services` object and returned.

### 📍 `packages/ui/src/composables/usePromptOptimizer.ts`
- **[x] Returns `reactive`**: Confirm that the `return` statement returns a single `reactive` object.
- **[x] `nextTick` guard**: In functions such as `handleOptimizePrompt`, confirm that state cleanup (such as `optimizedPrompt.value = ''`) is completed synchronously **before** `await`ing the async service, followed immediately by `await nextTick()`.

### 📍 `packages/ui/src/composables/useModelManager.ts`
- **[x] Returns `reactive`**: Confirm that the `return` statement returns a single `reactive` object.
- **[x] `watch` internal dependency**: Confirm that it uses `watch` internally to listen for the readiness of `services` before running initialization logic.

### 📍 `packages/ui/src/composables/useTemplateManager.ts`
- **[x] Returns `reactive`**: Confirm that the `return` statement returns a single `reactive` object.
- **[x] `watch` internal dependency**: Confirm that it uses `watch` internally to listen for the readiness of `services`.

### 📍 `packages/ui/src/composables/useHistoryManager.ts`
- **[x] Returns `reactive`**: Confirm that the `return` statement returns a single `reactive` object.
- **[x] `watch` internal dependency**: Confirm that it uses `watch` internally to listen for the readiness of `services`.

### 📍 `packages/ui/src/composables/usePromptHistory.ts`
- **[x] `watch` internal dependency**: Confirm that it uses `watch` internally to listen for the readiness of `services`.
- **[x] `Ref` parameter types**: Confirm that parameters it receives, such as `currentChainId`, are all `Ref` types.

### 📍 `packages/ui/src/composables/usePromptTester.ts`
- **[x] Returns `reactive`**: Confirm that the `return` statement returns a single `reactive` object.
- **[x] `watch` internal dependency**: Confirm that it uses `watch` internally to listen for the readiness of `services`.

### 📍 `packages/ui/src/composables/useStorage.ts`
- **[x] `watch` internal dependency**: Confirm that it uses `watch` internally to listen for the readiness of `services`, to avoid the `Invalid watch source` warning.

---

## Part 3: UI Component Implementation

### 📍 `packages/ui/src/components/MainLayout.vue`
- **[x] Flexbox parent container**: Check whether the root element is a `flex` container, providing the constraint for `flex-1` on child elements (such as `InputPanel`).

### 📍 `packages/ui/src/components/InputPanel.vue`
- **[x] `min-h-0` constraint**: For the internal scrollable `textarea` area, check whether `flex-1 min-h-0` is applied along its chain of parent containers for correct space allocation.

### 📍 `packages/ui/src/components/OutputPanel.vue`
- **[x] `min-h-0` constraint**: Same as `InputPanel.vue`; check the Flex constraints on the scrollable area.

### 📍 `packages/ui/src/components/TestPanel.vue`
- **[x] `min-h-0` constraint**: Pay special attention to this component, because its layout is complex and all `flex` children need correct `min-h-0` constraints.

### 📍 `packages/ui/src/components/Modal.vue`
- **[x] `v-if` root element**: Confirm that the component's root DOM element has the `v-if="modelValue"` directive.
- **[x] `v-model` support**: Confirm that the `close()` method calls `emit('update:modelValue', false)`.
- **[x] Safe backdrop click**: Confirm that the backdrop's `@click` handler uses the `event.target === event.currentTarget` check.

### 📍 `packages/ui/src/components/FullscreenDialog.vue`
- **[x] `v-if` / `v-model`**: Same as `Modal.vue`.
- **[x] Safe backdrop click**: Same as `Modal.vue`.

### 📍 `packages/ui/src/components/TemplateManager.vue`
- **[x] `v-if` / `v-model`**: Same as `Modal.vue`.
- **[x] Safe backdrop click**: Same as `Modal.vue`.

### 📍 `packages/ui/src/components/ModelManager.vue`
- **[x] `v-if` / `v-model`**: Same as `Modal.vue`.
- **[x] Safe backdrop click**: Same as `Modal.vue`.

### 📍 `packages/ui/src/components/HistoryDrawer.vue`
- **[x] `v-if` / `v-model`**: Check `v-if="show"` and `emit('update:show', false)`.
- **[x] Safe backdrop click**: Same as `Modal.vue`.

### 📍 `packages/ui/src/components/OutputDisplayCore.vue`
- **[x] Real-time `emit`**: Check whether `<script setup>` contains a `watch` that listens to the local editing state and **immediately** notifies the parent component via `emit('update:content', ...)` when the content changes.

### 📍 `packages/ui/src/components/MarkdownRenderer.vue`
- **[x] Real-time `emit`**: Check whether `<script setup>` contains a `watch` that listens to the local editing state and **immediately** notifies the parent component via `emit('update:content', ...)` when the content changes.
- **[x] No `prose` class**: Check the `class` attributes in the component template and confirm there is no `@apply prose` or its variants, to avoid style conflicts with the custom theme.

---

## Part 4: Architectural Consistency and Error Handling

### 📍 **Separation of Responsibilities Check** ✅
- **[✅] Single responsibility principle**: Each Composable should be responsible for only one clear functional domain and should not take on other responsibilities
- **[✅] Duplicate logic check**: Confirm that no multiple Composables implement the same functionality (such as template management or storage operations)
- **[✅] Centralized initialization logic**: Initialization logic for related resources should be centralized in one place to avoid race conditions

### 📍 **Storage Key Management** ✅
- **[✅] Unified storage key definitions**: All storage keys should be defined in `packages/ui/src/constants/storage-keys.ts`
- **[✅] Avoid magic strings**: Strings should not be used directly as storage keys in code
- **[✅] Storage key consistency**: Confirm that storage keys in DataManager stay in sync with the definitions in the UI package

### 📍 **Service Dependency Management** ✅
- **[✅] Unified service retrieval**: Prefer `inject('services')` to obtain services, and avoid mixing props and inject
- **[✅] Service null check**: If services are not injected correctly, throw an error immediately instead of handling it silently
- **[✅] Fail-fast principle**: Report an error immediately when a service dependency problem is found; do not use retry mechanisms to mask the problem

### 📍 **Error Handling Principles** ✅
- **[✅] Avoid silent handling**: Do not use try-catch to silently swallow errors; let errors propagate upward
- **[✅] Remove masking mechanisms**: There should be no fallback logic or retry mechanisms that mask the real problem
- **[✅] Clear error messages**: Error messages should clearly indicate where the problem is, to enable quick diagnosis
- **[✅] Error handling in watch**: Even inside watch callbacks, errors should not be masked and should propagate upward

### 📍 **Event Handling Consistency** ✅
- **[✅] Prefer v-model**: Prefer v-model two-way binding and avoid complex event handling chains
- **[✅] Consistent event parameters**: Confirm that the parameters of events emitted by a component match what the handler expects
- **[✅] Async event handling**: If an event handler is asynchronous, confirm that the caller handles the Promise correctly

### 📍 **Architectural Layering Check** ✅
- **[✅] Plugin layer independence**: The plugin layer (such as i18n.ts) should not depend on constants or components from the UI component layer
- **[✅] Avoid circular dependencies**: Confirm that there are no circular references between layers
- **[✅] Reasonable degradation**: Distinguish reasonable graceful degradation from silent handling that masks problems

### 📍 **Electron Compatibility Check** ✅
- **[✅] Storage instance consistency**: Ensure plugins such as i18n use the same storage instance as App.vue, to avoid data inconsistency between the UI process and the main process
- **[✅] Service dependency injection**: The plugin layer should receive service instances rather than create its own, to ensure data synchronization in the Electron environment
- **[✅] Lazy initialization**: i18n in both Web and Extension apps should wait until the storage service is ready before initializing
- **[✅] Avoid creating services in main**: main.ts should not use StorageFactory.createDefault() directly; it should be managed uniformly by App.vue
- **[✅] File extension consistency**: Both Web and Extension apps should use main.ts rather than mixing .js and .ts
- **[✅] Module-level side effect check**: Ensure that importing a module does not produce side effects such as creating storage, especially in factory files
- **[✅] Clean up historical data**: After fixing code, historical IndexedDB data in the browser needs to be cleared
- **[✅] Enforce explicitness**: Remove convenience methods such as createDefault() to force developers to specify the storage type explicitly
