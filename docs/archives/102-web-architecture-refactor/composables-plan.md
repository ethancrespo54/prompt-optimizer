# Vue Composable Architecture Refactor Plan

## 1. Background and Problems

After the "de-singletonization" refactor of the core services, a series of serious problems related to Vue's reactivity system and component communication surfaced at application startup. They initially appeared as a variety of warnings and errors:

1.  **Prop type mismatch**: Child components received props of an unexpected type, e.g. expecting `Boolean` but receiving `Object` (`[Vue warn]: Invalid prop: type check failed`). This was common across many components such as `PromptPanel`.
2.  **Invalid watch source**: Composables such as `useStorage` ended up with `watch` observing an `undefined` source (`[Vue warn]: Invalid watch source: undefined`) because the `services` object they depended on had not yet been initialized.
3.  **Top-level call errors**: Attempting to call a Composable inside some asynchronous initialization logic caused Vue to throw `Must be called at the top of a 'setup' function`.

## 2. Root Cause Analysis

On investigation, these seemingly scattered problems all pointed to the same systemic architectural flaw: **an improper state encapsulation pattern in Composables**.

Many business-logic Composables (such as `usePromptOptimizer` and `useModelManager`) returned a plain JavaScript object containing multiple `ref`s, like this:

```typescript
// Old pattern
function usePromptOptimizer() {
  const isIterating = ref(false);
  const someOtherState = ref('');
  return { isIterating, someOtherState }; 
}
```

When used in `App.vue`:

```html
<!-- App.vue -->
<script setup>
const optimizer = usePromptOptimizer();
</script>

<template>
  <!-- 
    The problem: optimizer.isIterating is a ref object,
    not the value inside it. Vue's automatic template unwrapping does not reach into object properties.
  -->
  <PromptPanel :is-iterating="optimizer.isIterating" />
</template>
```

The `is-iterating` prop received by the `PromptPanel` component was a `Ref<boolean>` object rather than the expected `boolean` value, so the type check failed. This problem was at the core of the whole chain reaction.

## 3. Solution: Uniformly Return a `reactive` Object

To fix the problem at its root, we made a unified architectural decision: **refactor all core business Composables so that they return a single `reactive` object**.

```typescript
// ✅ New pattern
function usePromptOptimizer() {
  const state = reactive({
    isIterating: false,
    someOtherState: '',
  });
  
  // ... logic code that modifies state ...

  return state; // Return a reactive object
}
```

When used in `App.vue`, the problem disappears:

```html
<!-- App.vue (after the change) -->
<script setup>
const optimizerState = usePromptOptimizer();
</script>

<template>
  <!-- 
    Now optimizerState.isIterating is directly a boolean value,
    matching what the child component's prop expects.
  -->
  <PromptPanel :is-iterating="optimizerState.isIterating" />
</template>
```

This pattern ensures that child components receive raw values rather than `ref` wrappers, while still preserving state reactivity across components.

## 4. Implementation and Results (Completed) ✅

This refactor has been **successfully completed**.

**Core refactors**:
- [x] **`usePromptOptimizer`**: Refactored to return a `reactive` object.
- [x] **`useModelManager`**: Refactored to return a `reactive` object.
- [x] **`useHistoryManager`**: Refactored to return a `reactive` object.
- [x] **`useTemplateManager`**: Refactored to return a `reactive` object.
- [x] **`usePromptTester`**: Refactored to return a `reactive` object.
- [x] **`useModals`**: Refactored to return a `reactive` object.

**Supporting fixes**:
- [x] **Fixed `useStorage`**: The `ThemeToggleUI` and `LanguageSwitch` components were changed to obtain the `services` instance via `inject` and pass it to `useStorage`, fixing the problem of dependencies being initialized too early.
- [x] **Adapted `App.vue`**: Adjusted the template bindings and `computed` properties in `App.vue` to fit the new `reactive` state structure, and fixed the resulting type errors.
- [x] **Dependency injection**: In components such as `ModelSelect` and `DataManager`, promoted the pattern of using `inject` to obtain dependencies directly from `services`, simplifying the `App.vue` template.

**Final results**:
- Completely eliminated all Vue `warn`s and `error`s at startup.
- Established a more robust, more predictable state management paradigm that better follows Vue best practices.
- Application code, especially `App.vue`, became more concise and easier to maintain.

## 5. Lessons Learned

- **`reactive` vs. a `ref`-wrapping object**: For a group of highly cohesive reactive state that is passed around or manipulated together, encapsulating it with `reactive` is a better pattern than returning an object containing multiple `ref`s. It effectively avoids deep unwrapping problems and simplifies consumer code.
- **`provide`/`inject` is a great tool for service injection**: For global or cross-level services/dependencies (such as the `services` object), `provide`/`inject` is a more elegant and efficient solution than passing `props` down layer by layer.
- **Systemic problems need systemic solutions**: When facing a series of seemingly different errors, it is crucial to analyze deeply for their common root cause. By identifying the core "state encapsulation pattern" problem, this effort resolved all the surface symptoms at once.
