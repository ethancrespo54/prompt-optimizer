# Template Management Troubleshooting Checklist

## Common Problems and Solutions

### 1. Template deletion error: "Template not found"

**Symptoms:**
- A `TemplateError: Template not found: template-xxx` error appears when deleting a template
- The error is usually thrown at line `index.js:1683`

**Causes:**
- The async method call is missing the `await` keyword
- Timing issue: `deleteTemplate` and `loadTemplates` execute concurrently
- The template is accessed by other operations during deletion

**Solutions:**
1. Make sure all async template operations use `await`:
   ```javascript
   // ❌ Wrong
   getTemplateManager.value.deleteTemplate(templateId)
   await loadTemplates()
   
   // ✅ Correct
   await getTemplateManager.value.deleteTemplate(templateId)
   await loadTemplates()
   ```

2. Check the async calls in the following functions:
   - `confirmDelete()`
   - `handleSubmit()`
   - `handleFileImport()`
   - `applyMigration()`

### 2. Wrong template type: after switching categories in the management interface, the added template type is still wrong

**Symptoms:**
- After switching to the user prompt category in the template management interface, clicking the add button still adds a system prompt template
- The type of the added template does not match the currently displayed category

**Cause:**
- **Core problem**: The `getCurrentTemplateType()` function returns the fixed `props.templateType`, which does not change when the user switches categories within the management interface
- The wrong source was used for the template type when adding a template

**Important clarification:**
- **Category switching in the template management interface**: Users can switch within the management interface to view different types of templates
- **Behavior of the add button**: It should decide what type of template to add based on the currently displayed category
  - Currently displaying the system prompt category → add a system prompt template (`templateType: 'optimize'`)
  - Currently displaying the user prompt category → add a user prompt template (`templateType: 'userOptimize'`)
  - Currently displaying the iteration prompt category → add an iteration prompt template (`templateType: 'iterate'`)

**Solutions:**
1. Fix the `getCurrentTemplateType()` function so that it decides based on the current category rather than props:
   ```javascript
   // ❌ Wrong: uses the fixed props value
   function getCurrentTemplateType() {
     return props.templateType
   }

   // ✅ Correct: decides based on the current category
   function getCurrentTemplateType() {
     switch (currentCategory.value) {
       case 'system-optimize': return 'optimize'
       case 'user-optimize': return 'userOptimize'
       case 'iterate': return 'iterate'
       default: return 'optimize'
     }
   }
   ```

2. Make sure the category switch buttons update `currentCategory` correctly:
   ```javascript
   @click="currentCategory = 'user-optimize'"
   ```

3. Verify that the correct template type is used when adding a template:
   ```javascript
   templateType: getCurrentTemplateType() // Now returns the correct type based on the current category
   ```

### 3. Template manager opens at the wrong position

**Symptoms:**
- Clicking manage from the system optimization prompt dropdown opens a different category
- Opening the template manager from the navigation bar positions it at the wrong category
- The initial position of the template manager does not match where it was opened from

**Causes:**
- `currentCategory` is set only when the component is initialized and does not respond to changes in `props.templateType`
- The wrong default logic was used when opening from the navigation bar

**Solutions:**
1. Add a watcher for changes in `props.templateType`:
   ```javascript
   // Watch for changes in props.templateType and update the current category
   watch(() => props.templateType, (newTemplateType) => {
     currentCategory.value = getCategoryFromProps()
   }, { immediate: true })
   ```

2. Fix the default logic for opening from the navigation bar:
   ```javascript
   // ❌ Wrong: decides based on the current optimization mode
   const openTemplateManager = (templateType?: string) => {
     currentTemplateManagerType.value = templateType || (selectedOptimizationMode.value === 'system' ? 'optimize' : 'userOptimize')
   }

   // ✅ Correct: defaults to the system optimization prompt
   const openTemplateManager = (templateType?: string) => {
     currentTemplateManagerType.value = templateType || 'optimize'
   }
   ```

3. Make sure the positioning rules are correct:
   - From the system optimization prompt dropdown → position at the system optimization prompt category
   - From the user optimization prompt dropdown → position at the user optimization prompt category
   - From the iteration prompt dropdown → position at the iteration prompt category
   - From the navigation bar → position at the system optimization prompt category (the first one by default)

### 4. Template save fails

**Symptoms:**
- An error occurs when saving a template
- The template list is not updated

**Checklist:**
- [ ] Does the `saveTemplate()` call use `await`
- [ ] Does the `loadTemplates()` call use `await`
- [ ] Is the template data format correct
- [ ] Does the template ID meet the format requirements (at least 3 characters, only lowercase letters, digits, and hyphens)

### 5. Template import fails

**Symptoms:**
- An error occurs when importing a JSON file
- The template list is not updated after the import

**Checklist:**
- [ ] Does the `importTemplate()` call use `await`
- [ ] Does the `loadTemplates()` call use `await`
- [ ] Is the JSON file format correct
- [ ] Does the template schema validation pass

### 6. Architecture design principles

**Service dependency injection:**
- [ ] Use dependency injection instead of creating service instances directly
- [ ] Avoid using `StorageFactory.createDefault()` in UI components
- [ ] Ensure service instances stay consistent across the whole application

**Error handling:**
- [ ] Throw exceptions immediately instead of handling them silently
- [ ] Avoid retry mechanisms that mask problems
- [ ] Fail fast when a service check fails

**Async operations:**
- [ ] Use `await` for all async method calls
- [ ] Avoid concurrently executing operations that may conflict
- [ ] Ensure the correct order of operations

### 7. Code review checklist

**Check the following when reviewing template-management-related code:**
- [ ] Do all `templateManager` method calls use `await` correctly
- [ ] Are async functions declared as `async` correctly
- [ ] Is error handling complete
- [ ] Is there a risk of race conditions
- [ ] Is the template ID generation and validation logic correct
- [ ] Have harmful default values been removed
- [ ] Is the optimization mode passed correctly to all related components

### 8. Testing suggestions

**Unit tests:**
- [ ] Test the async behavior of template CRUD operations
- [ ] Test exception handling in error cases
- [ ] Test the safety of concurrent operations

**Integration tests:**
- [ ] Test the complete template management flow
- [ ] Test the interaction between UI components and the service layer
- [ ] Test IPC communication in the Electron environment

### 9. Template selection on the iteration page does not update after switching the built-in template language

**Symptoms:**
- After switching the built-in template language in the template management interface, the optimization prompt dropdown on the main interface updates correctly
- But after running the optimization and clicking "Continue Optimization", the template selection on the iteration page shows template names in the old language
- The dropdown list has been updated to the new language, but the currently selected item is still in the old language
- The new language takes effect when the request is actually sent (because the template is re-fetched via templateId)

**Root cause:**
- **Different event propagation paths**: The TemplateSelect components on the main interface and the iteration page are at different levels
- **Component hierarchy difference**:
  - Main interface: `App.vue → TemplateSelectUI` (direct reference)
  - Iteration page: `App.vue → PromptPanelUI → TemplateSelect` (indirect reference)
- **Missing refresh mechanism**: The language switch event cannot propagate to the deeply nested TemplateSelect component

**Detailed analysis:**
1. **Why the main interface works**:
   - When TemplateManager closes, it automatically calls `templateSelectRef?.refresh?.()`
   - The component hierarchy is simple and the event propagation path is short
   - There is a direct reference and refresh mechanism

2. **Why the iteration page is abnormal**:
   - The TemplateSelect on the iteration page was not included in the refresh logic for language switching
   - The component hierarchy is deeper and requires an additional event propagation mechanism
   - A complete event propagation chain had not been established before

**Solutions:**
1. **Establish the event propagation chain**:
   ```javascript
   // TemplateManager.vue - emit the language change event
   const handleLanguageChanged = async (newLanguage: string) => {
     // ... existing logic ...

     // Emit the language change event to notify the parent component
     emit('languageChanged', newLanguage)
   }
   ```

2. **App.vue handles the event and propagates it**:
   ```javascript
   // Handle the template language change
   const handleTemplateLanguageChanged = (newLanguage: string) => {
     // Refresh the template selection component on the main interface
     if (templateSelectRef.value?.refresh) {
       templateSelectRef.value.refresh()
     }

     // Refresh the template selection component on the iteration page
     if (promptPanelRef.value?.refreshIterateTemplateSelect) {
       promptPanelRef.value.refreshIterateTemplateSelect()
     }
   }
   ```

3. **PromptPanel exposes a refresh method**:
   ```javascript
   // PromptPanel.vue - expose a method to refresh the iteration template
   const refreshIterateTemplateSelect = () => {
     if (iterateTemplateSelectRef.value?.refresh) {
       iterateTemplateSelectRef.value.refresh()
     }
   }

   defineExpose({
     refreshIterateTemplateSelect
   })
   ```

**Fix verification:**
- [x] The language switch event propagates correctly to all TemplateSelect components
- [x] The dropdown list on the iteration page updates correctly to the new language
- [x] Users can select the template in the correct language on the iteration page
- [x] The main interface and the iteration page behave consistently

**Lessons learned:**
1. **Component hierarchy affects event propagation**: Deeply nested components need an additional event propagation mechanism
2. **Unified refresh mechanism**: All related components should have a unified refresh interface
3. **Complete event chain**: Ensure events can propagate to all components that need to respond
4. **Architectural consistency**: Components with the same function should have the same response mechanism

### 10. Monitoring and debugging

**Logging:**
- [ ] Log the start and end of template operations
- [ ] Log the timing of async operations
- [ ] Log the detailed context of errors

**Debugging tips:**
- [ ] Use the browser developer tools to inspect the async call stack
- [ ] Check the initialization state of the template manager
- [ ] Verify the integrity of the template data

## Preventive Measures

1. **Code conventions:**
   - All async template operations must use `await`
   - Async functions must be declared as `async`
   - Error handling must be complete
   - Remove all harmful default values, especially those related to the optimization mode

2. **Architecture principles:**
   - Use dependency injection to manage service instances
   - Avoid creating services directly in the UI layer
   - Keep service instances consistent

3. **Test coverage:**
   - Write unit tests for all template operations
   - Test the correctness of async operations
   - Test the handling of error cases

4. **Code review:**
   - Focus on checking the correctness of async operations
   - Verify the completeness of error handling
   - Ensure adherence to the architecture principles
