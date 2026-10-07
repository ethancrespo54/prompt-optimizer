# Web and Extension Architecture Refactor Plan

## 1. Current Status and Problems

**Latest status (2024-12-29):** Both the underlying and upper-level application refactors are complete.

- **Done**: The `@prompt-optimizer/core` and `@prompt-optimizer/ui` packages have successfully removed all singleton services.
- **Resolved**: The entry files (`App.vue`) of the web app (`@prompt-optimizer/web`) and the browser extension (`@prompt-optimizer/extension`) have been adapted, and the applications **start and run normally**.

This plan aims to record and summarize the adaptation of `App.vue`.

## 2. Refactor Goals

- **Fix the application startup failure** so that it runs normally.
- **Fully align the upper-level apps with the underlying service architecture**, using the unified `useAppInitializer` for service initialization.
- **Simplify `App.vue`** so that it handles only layout and initialization, delegating business logic entirely to Composables.
- **Adopt the latest Composable architecture**, consuming Composables that return a `reactive` object instead of multiple `ref`s.

## 3. Implementation Plan

### Phase 1: Clean up the UI package (Completed) ✅

1.  **File**: `packages/ui/src/index.ts`
    -   **Task**: Remove all service instances re-exported from `@prompt-optimizer/core`.
    -   **Status**: ✅ **Completed**. The UI package now exports only components, Composables, factory functions, and types.

### Phase 2: Create a unified application initializer (Completed) ✅

1.  **File**: `packages/ui/src/composables/useAppInitializer.ts` (new)
    -   **Task**: Create a Vue Composable that creates and returns instances of all necessary services depending on the environment (Web/Electron).
    -   **Status**: ✅ **Completed**.

### Phase 3: Refactor the application entry (Completed) ✅

This phase is the core of this refactor and has now been **successfully completed**.

1.  **Files**: `packages/web/src/App.vue` and `packages/extension/src/App.vue`
    -   **Status**: ✅ **Completed**. The application now starts normally.
    -   **Final implementation**:
        1.  **[x] Clean up invalid imports**:
            -   In `<script setup>`, removed all direct imports of singleton services (`modelManager`, `templateManager`, etc.).
        2.  **[x] Depend on `useAppInitializer`**:
            -   Call `const { services, isInitializing } = useAppInitializer()` at the top level as the sole source of all services.
        3.  **[x] Call all business Composables at the top level**:
            -   Following the outcome of the [Composable refactor plan](./composables-refactor-plan.md), all business-logic Composables (such as `usePromptOptimizer` and `useModelManager`) are called at the top level of `<script setup>`.
            -   These Composables accept the `services` ref as a parameter and return a single `reactive` object.
            -   **Example code**:
                ```typescript
                // App.vue
                const { services, isInitializing, error } = useAppInitializer();
                
                // Call directly at the top level, passing the services ref
                const modelManagerState = useModelManager(services);
                const templateManagerState = useTemplateManager(services);
                const optimizerState = usePromptOptimizer(services);
                // ... other Composables
                ```
        4.  **[x] Update the template (`<template>`)**:
            -   All data bindings and event handlers in the template now link to properties of the `reactive` objects returned by the Composables (e.g., `optimizerState.isIterating`).
            -   This resolved the earlier prop type validation failures caused by passing `ref` objects.
        5.  **[x] Fix `computed` and type errors**:
            -   Corrected the `computed` properties in `App.vue` so that they no longer incorrectly access `.value`.
            -   Added missing i18n translation entries, such as `promptOptimizer.originalPromptPlaceholder`.
            -   Correctly passed deep dependencies such as `templateLanguageService` via `provide`.
        6.  **[x] Promote `provide`/`inject`**:
            -   Kept `provide('services', services)` and encouraged child components (such as `ModelSelect.vue` and `DataManager.vue`) to obtain services via `inject`, reducing props passing.

## 4. Expected Outcomes (Achieved)

- [x] The web and extension apps are back to normal, with the same functionality as before the refactor.
- [x] The `App.vue` code is extremely concise, responsible only for "initialization" and "layout".
- [x] The whole application startup flow is clear and robust, fully following best practices of dependency injection and reactive data flow.
- [x] Lays a solid foundation for adding new features on all platforms (web/extension/desktop) in the future. 

## 5. Latest Progress: Cleaning Up UI Child Components (Completed) ✅

**Background**: After `App.vue` finished adapting to `useAppInitializer`, we found that several UI components under it (`@prompt-optimizer/ui/components/*`) still imported singleton services directly from `@prompt-optimizer/core`. This violates the new dependency injection architecture and could lead to potential bugs and testing difficulties.

**Task**: Completely remove the UI component layer's direct dependency on service singletons and receive service instances through `props` instead.

**Implementation checklist**:
- [x] **`TemplateSelect.vue`**: Removed the direct import of `templateManager`; now passed in via props.
- [x] **`ModelSelect.vue`**: Removed the direct import of `modelManager`; now passed in via props.
- [x] **`OutputDisplayCore.vue`**: Removed the direct import of `compareService`; now passed in via props.
- [x] **`HistoryDrawer.vue`**: Removed the direct import of `historyManager` (the component already receives data via props, so only the unused import needed cleaning up).
- [x] **`BuiltinTemplateLanguageSwitch.vue`**: Removed the direct imports of `templateManager` and `templateLanguageService`; now passed in via props.
- [x] **`DataManager.vue`**: Removed the direct import of `dataManager`; now passed in via props or injected from `services`.
- [x] **`TemplateManager.vue`**: Ensured `templateManager` and `templateLanguageService` are obtained from the `services` injection and passed correctly to child components.

**Results**:
- All core UI display components are now decoupled from the service layer.
- Component reusability and testability improved significantly.
- The whole frontend architecture better follows the principle of "depend on interfaces, not implementations".
- The project's architectural consistency is safeguarded, clearing the way for future maintenance and iteration.
