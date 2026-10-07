# Connection Test Fix Summary

## 🔍 Problem Description
When users ran a connection test in the image model manager with a custom/arbitrary model ID (such as `user-custom-model-123`), the system reported an error:
```
Connection test failed: Error: Selected model not found
    at he (useImageModelManager.ts:329:15)
```

## 🎯 Root Cause
The connection test function only looked up the model ID entered by the user in the static model list `models.value`:
```typescript
// 🚫 Old logic (problematic code)
const selectedModel = models.value.find(m => m.id === configForm.value.modelId)
if (!selectedModel) {
  throw new Error('Selected model not found')  // The error is thrown here
}
```

But the save-configuration feature has a complete fallback mechanism:
```typescript
// ✅ Correct logic of save configuration
let cachedModel = models.value.find(m => m.id === selectedModelId.value)
if (!cachedModel) {
  const adapter = registry.getAdapter(selectedProviderId.value)
  cachedModel = adapter.buildDefaultModel(selectedModelId.value)  // Fallback mechanism
}
```

## ✅ Fix
Add the same `buildDefaultModel` fallback mechanism as save configuration to the connection test function:

```typescript
// ✅ Logic after the fix
let selectedModel = models.value.find(m => m.id === configForm.value.modelId)
if (!selectedModel) {
  // For a custom model ID, build it with the adapter's buildDefaultModel method
  try {
    const adapter = registry.getAdapter(selectedProviderId.value)
    selectedModel = adapter.buildDefaultModel(configForm.value.modelId)
  } catch (error) {
    throw new Error(`Unable to build model ${configForm.value.modelId}: ${error instanceof Error ? error.message : String(error)}`)
  }
}
```

## 📋 Changes
1. **Unified model lookup logic**: The connection test and save configuration use the same model lookup strategy
2. **Custom model ID support**: Users can run a connection test with any model ID
3. **Improved error handling**: Provides clear error messages for easier debugging

## 🧪 Verification Results
Created 4 test cases to verify the fix:
- ✅ Model lookup in the static model list works normally
- ✅ Custom model IDs are handled correctly through `buildDefaultModel`
- ✅ `buildDefaultModel` errors are captured correctly
- ✅ Before/after behavior comparison verified

## 🎉 Expected Results
- Users can now run a connection test with **any model ID**
- System behavior is **fully consistent** with the save-configuration feature
- Error messages are more **friendly and specific**
- The overall **user experience** is improved

Now when users enter an arbitrary model ID (such as `my-custom-model`) for a connection test, the system will:
1. First look it up in the static model list
2. If it is not found, automatically build a default model configuration
3. Continue with the connection test instead of reporting an error directly