# Service Singleton Refactor Plan

## 1. Background

After thorough investigation, we found a core flaw in the current architecture: **service instances are created too early at module import time (Eager Instantiation)** and are exported and passed between packages as singletons.

This caused the following serious problems:

1.  **"Ghost" services**: In the Electron renderer process, a set of web-side services based on `Dexie` (IndexedDB) was created unexpectedly. Although these services were never ultimately used, they consumed resources and created the illusion of data corruption.
2.  **Inconsistent state**: Because service instances were created without awareness of the runtime environment, state was inconsistent between the UI process (which saw the web-version instances) and the main process (which actually executed the logic).
3.  **Architectural coupling**: The `@prompt-optimizer/ui` package needlessly exported core service instances, blurring its responsibilities and making it more of a service relay than a pure UI library.
4.  **Hard to test**: The singleton pattern made it very difficult to isolate and mock services in tests.

## 2. Refactor Goals

The core goal of this refactor is to **implement lazy initialization and dependency injection for services**, ensuring that the single correct service instance is created only when needed and in the correct environment.

- **Remove singleton exports**: No package (`core`, `ui`) should export pre-created service instances anymore.
- **Unified initialization entry point**: Create a single, environment-aware application initializer.
- **Clear separation of responsibilities**: `core` provides only service classes and factory functions, `ui` provides only UI components and Hooks, and the application entry point (`App.vue`) handles orchestration.

## 3. Implementation Plan and Results

This refactor has been **successfully completed**. All core services have been migrated from the singleton pattern to factory functions and dependency injection, achieving the goal of creating service instances on demand and per environment.

### Phase 1: Modify the Core package and remove singleton exports (Completed) ✅

**Goal**: Change every service's singleton export pattern (`export const service = new Service()`) to a factory function pattern (`export function createService()`).

**Steps**:
1.  [x] **`services/storage/factory.ts`**: Removed the `storageProvider` singleton export.
2.  [x] **`services/model/manager.ts`**: Removed the `modelManager` singleton export and made its factory function accept dependencies.
3.  [x] **`services/template/manager.ts`**: Removed the `templateManager` singleton export and made its factory function accept dependencies.
4.  [x] **`services/history/manager.ts`**: Removed the `historyManager` singleton export and made its factory function accept dependencies.
5.  [x] **`index.ts`**: Updated the entry file to export only modules and factory functions.

**Deviations found along the way and how they were handled**:

*   **Deep dependency of `TemplateManager`**:
    *   **Finding**: `TemplateManager` depended on another previously undiscovered singleton, `templateLanguageService`.
    *   **Action**: Applied the same refactor to `services/template/languageService.ts`, removing the singleton and creating a `createTemplateLanguageService` factory function. Accordingly, `createTemplateManager` now takes two instances as parameters: `storageProvider` and `languageService`.

*   **Export cleanup in `index.ts`**:
    *   **Finding**: `index.ts` exported the `electron-proxy.ts` file, which belongs to the application layer.
    *   **Action**: Cleaned up `index.ts` and removed these exports that should not be exposed by the `core` package, making the API cleaner.

### Phase 2: Clean up the UI package and stop exporting services (Completed) ✅

**Goal**: Return `@prompt-optimizer/ui` to its role as a pure UI library.

6.  **`packages/ui/src/index.ts`**
    - [x] **Removed** all service instances re-exported from `@prompt-optimizer/core`. The UI package is back to being a pure UI library.

### Phase 3: Create a unified application initializer (Completed) ✅

**Goal**: Consolidate all initialization logic into a single reusable `composable`.

7.  **File**: `packages/ui/src/composables/useAppInitializer.ts` (new)
    - [x] **Created the file** and implemented the following logic:
        - Import all `create...` factory functions and Electron proxy classes.
        - Define the `services` and `isInitializing` refs.
        - In `onMounted`, detect the environment via `isRunningInElectron()`:
            - **If Electron**: create **proxy** instances of all services.
            - **If Web**: create all **real** service instances (including `storageProvider`).
            - Aggregate all service instances into the `services` ref.
            - Update the `isInitializing` state.

### Phase 4: Refactor the application entry (`App.vue`) (Completed) ✅

**Goal**: Make the application entry concise, responsible only for consuming the services returned by the initializer.

8.  **Modify `packages/web/src/App.vue` & `packages/extension/src/App.vue`**
    - [x] **Done**: The web and extension application entries have been refactored to consume the services returned by `useAppInitializer`, giving a clear initialization flow.
    - [x] **Deepened**: Further refactored all UI child components under `App.vue` (such as `ModelSelect`, `TemplateSelect`, etc.) so they no longer import service singletons directly but receive service instances via `props` or `inject`, fully unifying the architecture of the UI layer.

## 4. Expected Outcomes (Achieved)

-   [x] **No "ghost" services**: `Dexie` will be created only once, and only in the web environment.
-   [x] **Clear data flow**: Dependencies become `useAppInitializer` -> `App.vue` -> `Components`, one-directional and clear.
-   [x] **Robust initialization**: All services are created at the right time with the right configuration.
-   [x] **Inconsistent state fully resolved**: Because the logic for creating service instances is unified and unique.

This plan fundamentally resolves the architectural problems we found and lays a solid foundation for the project's future maintainability and extensibility.

## 5. Reflections on the Refactor and Follow-up Decisions

This refactor successfully converted the core services from the singleton pattern to the factory function pattern, resolving the root problems of environment isolation and inconsistent state. However, while fixing the large number of test failures this caused, we also drew some valuable lessons and identified design decisions that need further refinement:

### 5.1 On requiring `ensureInitialized()`

- **Reflection on the current state**: The current design requires callers, after obtaining a `Manager` instance, to manually call `await manager.ensureInitialized()` to complete asynchronous initialization. While this decouples instance creation from initialization, it exposes internal implementation details and adds a burden on callers.
- **Direction for improvement**: A better design would make the factory function itself (e.g. `createTemplateManager`) asynchronous, handle all initialization logic internally, and return a fully usable instance as `Promise<Manager>`. Callers would then only need to `await` once, giving a cleaner interface and better encapsulation.
- **Decision**: **Accept the current design for now**, but mark it as a **point for future optimization**. The current core task is to stabilize the refactored code.

### 5.2 On error handling: stick to the "fail fast" principle

- **Problem found**: After the refactor, if `TemplateManager` hit a storage error during initialization, it silently fell back to the built-in templates instead of throwing an error.
- **Decision**: This masks serious underlying problems and violates the Fail-fast principle. We decided to **correct this behavior**. When `TemplateManager` encounters critical errors such as storage access failures during initialization, it **must throw an exception upward**. The top-level application logic then catches it and decides how to handle it (e.g. report an error to the user, enter safe mode).

### 5.3 On the rigor of test code

- **Problem found**: Some older unit tests were not rigorous enough.
- **Decision and result**: **Fixed**. During the test-fixing phase of this refactor, a large number of assertions were rewritten, using constructs such as `expect.objectContaining` to make the tests more stable and reliable. All core tests now pass.

### 5.4 Ripple effects on the UI layer and the response

- **Finding**: The "de-singletonization" of core services had a bigger impact on the upper UI and Composable layers than expected. Once the pattern of directly importing singletons was broken, it triggered a chain of problems including `property type check failures`, `loss of reactive state`, and `uninitialized services`.
- **Response**: We drew up dedicated plans, [`composables-refactor-plan.md`](./composables-refactor-plan.md) and [`web-refactor-plan.md`](./web-refactor-plan.md). The core measures were: 1) Refactor Composables that return multiple `ref`s to return a single `reactive` object, to solve the property passing problem. 2) At the component level, inject services through the `provide/inject` mechanism, reducing `props drilling`. This experience shows that major changes to the underlying architecture must be accompanied by a thorough assessment of the impact on upper-level applications and a careful migration plan.

## 6. Detailed Change List

All items in this list were completed in recent commits.

### **Phase 1: Modify the Core package**

1.  **File**: `packages/core/src/services/storage/factory.ts`
    - [x] **Delete** (around L125): `export const storageProvider = StorageFactory.createDefault();`

2.  **File**: `packages/core/src/services/model/manager.ts`
    - [x] **Delete** (around L427): `export const modelManager = ...`
    - [x] **Modify** (around L428): `export function createModelManager(storageProvider?: IStorageProvider): ModelManager`
        - **Change to**: `export function createModelManager(storageProvider: IStorageProvider): ModelManager`
        - **Remove**: `storageProvider = storageProvider || StorageFactory.createDefault();`

3.  **File**: `packages/core/src/services/template/manager.ts`
    - [x] **Delete** (around L300): `export const templateManager = ...`

4.  **File**: `packages/core/src/services/history/manager.ts`
    - [x] **Delete** (around L230): `export const historyManager = ...`

5.  **File**: `packages/core/src/services/data/manager.ts`
    - [x] **Delete** (around L80): `export const dataManager = ...`
    - [x] **Modify** (constructor): `constructor()` -> `constructor(modelManager: IModelManager, templateManager: ITemplateManager, historyManager: IHistoryManager)`
    - [x] **Modify** (factory function): `createDataManager()` -> `createDataManager(modelManager: IModelManager, templateManager: ITemplateManager, historyManager: IHistoryManager)`

### **Phase 2: Clean up the UI package**

6.  **File**: `packages/ui/src/index.ts`
    - [x] **Delete** (around L45-53):
        ```typescript
        export {
            templateManager,
            modelManager,
            historyManager,
            dataManager,
            storageProvider,
            createLLMService,
            createPromptService
        } from '@prompt-optimizer/core'
        ```
    - [x] **Add**: Export `createDataManager` and other necessary factory functions.

### **Phase 3: Create a unified application initializer**

7.  **File**: `packages/ui/src/composables/useAppInitializer.ts` (new)
    - [x] **Created the file** and implemented the following logic:
        - Import all `create...` factory functions and Electron proxy classes.
        - Define the `services` and `isInitializing` refs.
        - In `onMounted`, detect the environment via `isRunningInElectron()`:
            - **If Electron**: create **proxy** instances of all services.
            - **If Web**: create all **real** service instances (including `storageProvider`).
            - Aggregate all service instances into the `services` ref.
            - Update the `isInitializing` state.

### **Phase 4: Refactor the application entry**

8.  **File**: `packages/web/src/App.vue` & `packages/extension/src/App.vue`
    - [x] **Remove**: All imports of service singletons such as `modelManager`, `templateManager`, `historyManager`.
    - [x] **Replace**:
        - **Old**: `import { modelManager, ... } from '@prompt-optimizer/ui'`
        - **New**: `import { useAppInitializer } from '@prompt-optimizer/ui'`
    - [x] **Call**: `const { services, isInitializing } = useAppInitializer();`
    - [x] **Wrap**: Use `v-if="!isInitializing"` on the template's root element and add a `v-else` loading state.
    - [x] **Pass**: Pass `services.value` as props to the child components that need it, or use `services.value.modelManager` etc. in `composable`s.
    - [x] **Clean up**: Delete the manual initialization logic in `onMounted`.
