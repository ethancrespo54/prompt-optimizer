# Web Architecture Refactor: Lessons Learned

## 📋 Overview

Core lessons accumulated during the web architecture refactor, including Vue Composable architecture design, reactivity system optimization, and dependency injection best practices.

## 🎯 Vue Composable Architecture Refactor: Solving the Async Initialization Problem

### Background
Calling Vue Composable functions inside asynchronous callbacks causes the error: `Uncaught (in promise) SyntaxError: Must be called at the top of a 'setup' function`. This violates a core rule of the Vue Composition API and required an architectural refactor.

### Core solution: declare at the top level, connect reactively, stay autonomous internally
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

### Key architecture design points
1. **Unified service interface**: Create the `AppServices` interface to manage all core services in one place
2. **Service initializer**: `useAppInitializer` is responsible for creating and initializing all services
3. **Composable parameter pattern**: All Composables accept a `services` reference as a parameter

### Key lessons
1. **Vue reactive context**: Vue Composables must be called synchronously at the top level of `<script setup>`
2. **Reactive connection pattern**: Use `watch` to observe service readiness rather than calling Composables inside callbacks
3. **Fail-fast principle**: In a development environment, surfacing problems quickly is more valuable than hiding them
4. **Unified architecture**: Keep a consistent architecture pattern across all Composables
5. **Type system challenges**: Complex type systems can lead to interface mismatch problems

## 🔄 Composable Refactor: A Deep Dive into `reactive` vs `ref`

### Background
To solve the problem that deeply nested `ref`s in Vue are not automatically unwrapped, we refactored the return values of several core Composables from an object containing multiple `ref`s into a single `reactive` object.

### Core challenges and solutions

#### 1. Dependency injection failure
- **Symptom**: Components could not obtain the service instance via `inject`
- **Root cause**: The service was created but not correctly registered in the dependency injection system
- **Solution**: Ensure the full chain of service creation, registration, and provisioning

#### 2. Reactive interface mismatch
- **Symptom**: `Cannot read properties of null (reading 'value')` error
- **Root cause**: Properties of the `reactive` object did not match the interface expecting a `ref`
- **Solution**: Use `toRef` as an adapter
  ```typescript
  // Create a two-way bound ref for a property of the reactive object
  const selectedTemplateRef = toRef(optimizer, 'selectedTemplate');
  ```

#### 3. Robustness of external APIs
- **Symptom**: API detection failure caused parse errors
- **Root cause**: JSON parsing was attempted without checking the response content type
- **Solution**: Check the `Content-Type` response header before parsing

### Summary
- `reactive` is suited to managing **a group of** related state and simplifies the top-level API
- `ref` remains a reliable way to pass a **single** reactive variable across components
- `toRef` and `toRefs` are essential tools for adapting between `reactive` and `ref`
- Correct dependency injection and service initialization flow is the cornerstone of a stable complex application

## 💡 Key Lessons Summary

1. **Vue reactive context**: Vue Composables must be called synchronously at the top level of `<script setup>`
2. **Reactive connection pattern**: Use `watch` to observe service readiness, keeping code clear and maintainable
3. **Fail-fast principle**: In a development environment, surfacing problems quickly is more valuable than hiding them
4. **Unified architecture**: Keep a consistent architecture pattern across all Composables
5. **Type system**: Complex type systems require careful handling of interface matching
6. **Reactivity system**: `reactive` and `ref` each have their own use cases, and `toRef` is an important adapter

## 🔗 Related Documents

- [Web Architecture Refactor Overview](./README.md)
- [Composable Refactor Implementation Record](./composables-refactor.md)
- [Architecture Design Principles](./design-principles.md)

---

**Document type**: Lessons learned  
**Scope**: Vue Composable architecture development  
**Last updated**: 2025-07-01
