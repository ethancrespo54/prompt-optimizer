## **`TestPanel.vue` Component Upgrade Document**

### 1. **Goal**

Fully upgrade the `OutputPanelUI` component used in the `TestPanel.vue` component to display the "original prompt result" and the "optimized prompt result" to the more powerful and more consistent `OutputDisplay` component.

### 2. **Core Principles**

This change follows the same architecture pattern as the use of `OutputDisplay` in `PromptPanel.vue`, ensuring a consistent code style and maintainability across the codebase. The core principles are as follows:

*   **The parent component owns the state**: `TestPanel.vue` is the owner of the data and is fully responsible for managing the streaming reception, content storage, and loading state of the test results.
*   **One-way data flow**: All state (such as content and loading state) is passed one-way to the child component `OutputDisplay` via `props`.
*   **Separation of concerns**: `TestPanel.vue` focuses on business logic (how to obtain data), while `OutputDisplay` focuses on view presentation (how to display data).

### 3. **Scope of Changes**

*   **File**: `packages/ui/src/components/TestPanel.vue`

### 4. **Detailed Implementation Steps**

#### **4.1. Template (`<template>`) changes**

1.  **Remove the Markdown toggle buttons**:
    *   In the template, find and completely delete the two `<button>` elements used to toggle Markdown rendering, along with the related `enableMarkdown` logic. `OutputDisplay` has its own view switching, so external control is no longer needed.

2.  **Replace the "original prompt test result" panel**:
    *   Find the `div` with `v-show="isCompareMode"`.
    *   Delete the `<OutputPanelUI ... />` component inside it.
    *   Add the following new structure in its place:
        ```html
        <h3 class="text-lg font-semibold theme-text truncate mb-3">{{ t('test.originalResult') }}</h3>
        <OutputDisplay
          :content="originalTestResult"
          :streaming="isTestingOriginal"
          mode="readonly"
          class="flex-1 h-full"
        />
        ```

3.  **Replace the "optimized prompt test result" panel**:
    *   Find the `div` that displays the optimized result.
    *   Delete the `<OutputPanelUI ... />` component inside it.
    *   Add the following new structure in its place:
        ```html
        <h3 class="text-lg font-semibold theme-text truncate mb-3">
          {{ isCompareMode ? t('test.optimizedResult') : t('test.testResult') }}
        </h3>
        <OutputDisplay
          :content="optimizedTestResult"
          :streaming="isTestingOptimized"
          mode="readonly"
          class="flex-1 h-full"
        />
        ```

4.  **Remove the `ref` attributes**:
    *   Delete the `ref="originalOutputPanelRef"` and `ref="optimizedOutputPanelRef"` attributes from the template; they will no longer be used.

#### **4.2. Script (`<script setup>`) changes**

1.  **Update imports**:
    *   Remove `OutputPanelUI` from the import statement from `'./OutputPanel.vue'`.
    *   Add an import of `OutputDisplay` from `'./OutputDisplay.vue'`.
    *   Make sure `useToast` is imported from `'../composables/useToast'` and `const toast = useToast()` is initialized.

2.  **Remove obsolete state**:
    *   Delete the following `ref` definitions:
        ```javascript
        const originalOutputPanelRef = ref(null)
        const optimizedOutputPanelRef = ref(null)
        const enableMarkdown = ref(true); // if present
        ```

3.  **Refactor the `testOriginalPrompt` function**:
    *   This function changes from a delegation pattern to an active management pattern.
    *   The complete logic **after the change** should be as follows:
        ```javascript
        const testOriginalPrompt = async () => {
          if (!props.originalPrompt) return

          isTestingOriginal.value = true
          originalTestResult.value = ''
          originalTestError.value = '' // Optional, mainly for debugging
          
          await nextTick(); // Ensure the state update and DOM clearing are complete

          try {
            const streamHandler = {
              onToken: (token) => {
                originalTestResult.value += token
              },
              onComplete: () => { /* No need to set isTesting after the stream ends; finally handles it */ },
              onError: (err) => {
                const errorMessage = err.message || t('test.error.failed')
                originalTestError.value = errorMessage
                toast.error(errorMessage)
              }
            }

            // ... the logic for building systemPrompt and userPrompt here stays unchanged ...

            await props.promptService.testPromptStream(
              systemPrompt,
              userPrompt,
              selectedTestModel.value,
              streamHandler
            )
          } catch (error) {
            console.error('[TestPanel] Original prompt test failed:', error); // Add detailed error logging
            const errorMessage = error.message || t('test.error.failed')
            originalTestError.value = errorMessage
            toast.error(errorMessage)
            originalTestResult.value = ''
          } finally {
            // Ensure that the loading state is always turned off, whether it succeeds or fails
            isTestingOriginal.value = false
          }
        }
        ```

4.  **Refactor the `testOptimizedPrompt` function**:
    *   Apply exactly the same refactor logic as `testOriginalPrompt`, but operate on the `optimized`-related state (`props.optimizedPrompt`, `isTestingOptimized`, `optimizedTestResult`, `optimizedTestError`).
    *   **Key enhancement**: The `try-catch-finally` structure here also needs `await nextTick()` and the `console.error` log.

5.  **Remove `defineExpose`**:
    *   Since the component's internal `ref`s or methods no longer need to be referenced from outside, delete the entire `defineExpose` code block.

### 5. **Expected Results**

*   `TestPanel.vue` no longer depends on `OutputPanel.vue` and uses `OutputDisplay.vue` entirely.
*   The test result area gets the same look and interactions as the main optimization panel (such as view switching and fullscreen), but is restricted to read-only mode.
*   The streaming data display logic is correctly moved to the `<script>` section of `TestPanel.vue`, giving a clearer code structure and more reliable state management.
*   The project loses an `OutputPanel.vue` component used only in a specific scenario, improving code reuse and consistency. 
