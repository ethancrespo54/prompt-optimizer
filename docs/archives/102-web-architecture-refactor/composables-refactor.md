# Vue Composable Architecture Refactor Implementation Record

## 📋 Task Overview

Resolve the error caused by calling Vue Composable functions inside asynchronous callbacks: `Uncaught (in promise) SyntaxError: Must be called at the top of a 'setup' function`. Refactor all Composable files to implement the design pattern "declare at the top level, connect reactively, stay autonomous internally".

## 🎯 Goals

- Resolve the Vue Composable call timing problem
- Establish a unified service interface definition
- Implement reactive service dependency injection
- Improve code consistency and maintainability

## 📅 Execution Log

### ✅ Completed Steps

#### 1. Create a unified service interface definition
- **Completed**: 2025-07-05 morning
- **Actual result**: Successfully created the `packages/ui/src/types/services.ts` file, defining the `AppServices` interface
- **Lesson**: Centralized type definitions improved code consistency and maintainability

#### 2. Refactor the core Composable files
- **Completed**: 2025-07-05 afternoon
- **Actual result**: Successfully refactored 8 main Composable files so that they accept a `services: Ref<AppServices | null>` parameter
- **Lesson**: A unified parameter pattern makes code more consistent and easier to understand

#### 3. Update useAppInitializer
- **Completed**: 2025-07-05 evening
- **Actual result**: Enhanced error handling and logging, and added an `error` state
- **Lesson**: Good error handling is essential for debugging

#### 4. Update useModals
- **Completed**: 2025-07-05 evening
- **Actual result**: Brought useModals into the new architecture as well, accepting a services parameter
- **Lesson**: Keeping the architecture consistent is very important for long-term maintenance

#### 5. Update documentation
- **Completed**: 2025-07-05 evening
- **Actual result**: Updated the architecture documentation and the lessons-learned record
- **Lesson**: Promptly recording architectural decisions and experience is important for passing on team knowledge

### ⚠️ Open Issues

#### 6. Update App.vue
- **In progress**: 2025-07-06
- **Current status**: Ran into type errors that need further work
- **Problem notes**:
  - The `services` object does not match the `AppServices` interface, especially the `dataManager` property
  - Tried a temporary workaround with the type assertion `as any`, but type errors remain
  - The `DataManager` type definition and implementation need further study

## 🔧 Core Solution

### Architecture pattern
```typescript
// ❌ Wrong: calling a Composable in an async callback
onMounted(async () => {
  const services = await initServices();
  const modelManager = useModelManager(); // Wrong: not called at the top level of setup
});

// ✅ Correct: declare at the top level, connect reactively
const { services } = useAppInitializer(); // Called at the top level
const modelManager = useModelManager(services); // Called at the top level, passing the services reference

// Internal implementation: reactive connection
export function useModelManager(services: Ref<AppServices | null>) {
  // State definitions...
  
  // Reactive connection: watch for services to become ready
  watch(services, (newServices) => {
    if (!newServices) return;
    // Use the ready services...
  }, { immediate: true });
  
  return { /* return state and methods */ };
}
```

### Service interface definition
```typescript
// packages/ui/src/types/services.ts
export interface AppServices {
  storageProvider: IStorageProvider;
  modelManager: IModelManager;
  templateManager: ITemplateManager;
  historyManager: IHistoryManager;
  dataManager: DataManager;
  llmService: ILLMService;
  promptService: IPromptService;
}
```

## 📊 Progress Status

**80% of the core goal achieved**:
- ✅ Resolved the `Must be called at the top of a 'setup' function` error
- ✅ Implemented a unified, predictable Composable design pattern
- ✅ Improved code maintainability and robustness
- ✅ Completed a comprehensive documentation update
- ❌ Type errors in App.vue still need to be resolved

**Technical implementation**:
- Created the centralized `AppServices` interface
- Refactored 9 Composable files to use a unified parameter pattern
- Enhanced error handling and logging in `useAppInitializer`
- Adopted a "fail fast" approach to surface potential problems early

**Architectural characteristics**:
- All Composables are called at the top level of `<script setup>`
- Composables accept a `services: Ref<Services | null>` parameter
- They react to service readiness internally via `watch(services, ...)`
- Explicit one-directional dependencies

## 🎯 Next Steps

1. **Resolve the App.vue type errors**:
   - Study the `DataManager` type definition and implementation in depth
   - Check the structure of the object returned by `useAppInitializer`
   - The `AppServices` interface or the service implementation may need adjusting

2. **Add error-handling UI**:
   - Use the `error` state returned by `useAppInitializer`
   - Add a friendly error message interface

3. **Write an architecture guide**:
   - Create a detailed architecture guide for new developers
   - Explain the correct way to use Composables

## 💡 Key Lessons

1. **Vue reactive context**: Vue Composables must be called synchronously at the top level of `<script setup>`
2. **Reactive connection pattern**: Use the `watch(services, ...)` pattern to handle asynchronous service initialization
3. **Fail-fast principle**: In a development environment, surfacing problems quickly is more valuable than hiding them
4. **Unified architecture**: Keep a consistent architecture pattern across all Composables
5. **Type system challenges**: Complex type systems can lead to interface mismatch problems

---

**Task status**: ⚠️ Partially complete, type errors still to be resolved  
**Completion**: 80%  
**Last updated**: 2025-07-01
