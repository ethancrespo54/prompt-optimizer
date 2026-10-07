# Language Switch Button Fix

## 🎯 Problem Description

### Core Problem
The language switch button in function prompt management displayed "Object Promise" instead of the correct language name (such as "Chinese" or "English").

### Symptoms
- The UI component displayed the abnormal text "Object Promise"
- The language switch feature did not work
- Web and Electron environments behaved inconsistently

### Root Causes
- **Inconsistent async interfaces**: Methods in the Electron environment returned a Promise, but were used as if they returned a synchronous value
- **Incorrect IPC call handling**: The results of async IPC calls were not awaited correctly
- **Mismatched interface definitions**: The Web and Electron environments used different method signatures

## 🔧 Solution

### 1. Unify the async interface design
Create the `ITemplateLanguageService` interface to ensure cross-environment consistency:

```typescript
export interface ITemplateLanguageService {
  initialize(): Promise<void>;
  getCurrentLanguage(): Promise<BuiltinTemplateLanguage>;
  setLanguage(language: BuiltinTemplateLanguage): Promise<void>;
  toggleLanguage(): Promise<BuiltinTemplateLanguage>;
  isValidLanguage(language: string): Promise<boolean>;
  getSupportedLanguages(): Promise<BuiltinTemplateLanguage[]>;
}
```

### 2. Fix async calls in the Vue component
```vue
<!-- Before the fix -->
<span>{{ languageService.getCurrentLanguage() }}</span>

<!-- After the fix -->
<span>{{ currentLanguage }}</span>

<script setup>
const currentLanguage = ref('')

onMounted(async () => {
  currentLanguage.value = await languageService.getCurrentLanguage()
})
</script>
```

### 3. Complete the IPC call chain
```javascript
// preload.js
templateLanguage: {
  getCurrentLanguage: async () => {
    const result = await ipcRenderer.invoke('template-getCurrentBuiltinTemplateLanguage');
    if (!result.success) throw new Error(result.error);
    return result.data;
  }
}

// main.js
ipcMain.handle('template-getCurrentBuiltinTemplateLanguage', async (event) => {
  try {
    const result = await templateManager.getCurrentBuiltinTemplateLanguage();
    return createSuccessResponse(result);
  } catch (error) {
    return createErrorResponse(error);
  }
});
```

## ✅ Fix Verification

### Verification checklist
- [x] The language switch button correctly displays "Chinese" or "English"
- [x] The "Object Promise" display problem is completely resolved
- [x] Web and Electron environments behave consistently
- [x] All async calls are handled correctly

## 💡 Lessons Learned

### Core Principles
1. **Interface consistency**: Cross-environment interfaces must be consistently asynchronous
2. **Error handling**: Let errors propagate naturally to make problems easier to locate
3. **Type safety**: Use TypeScript to ensure interface implementations are complete
4. **Event propagation**: Ensure the language switch event propagates to all relevant components

### Best Practices
1. **Unified async**: All cross-environment interfaces should be asynchronous
2. **Interface-driven**: Define the interface first, then implement the concrete classes
3. **Thorough testing**: Verify the feature in both environments
4. **Complete event chain**: Establish a complete event propagation mechanism so that deeply nested components can also respond to state changes

### Related Issues
- **Template selection on the iteration page does not update**: After a language switch, the template selection on the iteration page could not update correctly because of differences in component hierarchy and a missing event propagation mechanism. The solution was to establish a complete event propagation chain so that all TemplateSelect components respond to the language switch event. See section 9 of `106-template-management/troubleshooting.md` for details.

This fix established a complete async interface design pattern and set the standard for subsequent IPC development.
