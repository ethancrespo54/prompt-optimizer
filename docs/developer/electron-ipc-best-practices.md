# Electron IPC Best Practices

## Background

In Electron applications, Vue reactive objects cannot be passed directly over IPC (inter-process communication); doing so causes the "An object could not be cloned" error. This is because Vue reactive objects contain non-serializable proxy wrappers.

## Core Principles

### 1. The ElectronProxy Layer Handles Serialization Automatically

✅ **Current approach**:
```javascript
// Vue reactive objects can be passed directly; ElectronProxy serializes them automatically
await modelManager.addModel(newModel.value.key, {
  name: newModel.value.name,
  llmParams: newModel.value.llmParams // ElectronProxy automatically strips the reactive wrapper
})
```

**Architectural advantages**:
- Vue components don't need to care about serialization details
- All serialization logic is centralized in the ElectronProxy layer
- Automatic protection, hard to forget
- Cleaner code and a better development experience

### 2. Automatic Serialization Handling

**The ElectronProxy layer handles serialization automatically**:
- All ElectronProxy classes already have serialization built in
- Vue components don't need to call serialization functions manually
- Just pass Vue reactive objects directly; the proxy layer cleans them automatically

**Technical implementation**:
- Uses the `safeSerializeForIPC` function from `packages/core/src/utils/ipc-serialization.ts`
- Serialization is called automatically in each ElectronProxy method that needs it
- Ensures 100% IPC compatibility

### 3. How to Identify the Problem

When you see the following errors, there is an IPC serialization problem:
- `An object could not be cloned`
- `DataCloneError`
- `Failed to execute 'postMessage'`

## Common Problem Scenarios

### 1. Model Management
```javascript
// ✅ Vue reactive objects can now be passed directly
await modelManager.addModel(key, {
  llmParams: formData.value.llmParams // ElectronProxy serializes automatically
})
```

### 2. History
```javascript
// ✅ Vue reactive objects can now be passed directly
await historyManager.createNewChain({
  metadata: { mode: optimizationMode.value } // ElectronProxy serializes automatically
})
```

### 3. Template Management
```javascript
// ✅ Vue reactive objects can now be passed directly
await templateManager.saveTemplate({
  content: form.value.messages // ElectronProxy serializes automatically
})
```

## Development Checklist

Development is simpler now; you only need to check:

- [ ] Have you tested in the desktop environment?
- [ ] Are there any direct IPC calls that bypass ElectronProxy?
- [ ] Do newly added ElectronProxy methods include serialization handling?

## Debugging Tips

### 1. Check the Object Type
```javascript
console.log('Object type:', Object.prototype.toString.call(obj))
console.log('Is reactive:', obj.__v_isReactive)
console.log('Is ref:', obj.__v_isRef)
```

### 2. Test Serialization
```javascript
try {
  JSON.stringify(obj)
  console.log('Object is serializable')
} catch (error) {
  console.error('Object is not serializable:', error)
}
```

### 3. Use Developer Tools
In Chrome DevTools, reactive objects are displayed as the `Proxy` type.

## Architecture Recommendations

### 1. Unified Handling in the ElectronProxy Layer
Serialization handling has moved to the ElectronProxy layer, and Vue components can call directly:

```javascript
// In a component method - simpler now
const handleSave = async () => {
  await service.save(formData.value) // Pass directly, no manual serialization needed
}
```

### 2. Conventions for Adding ElectronProxy Methods
When adding a new ElectronProxy method, serialize complex object parameters:

```typescript
async newMethod(complexObject: SomeType): Promise<ResultType> {
  // Serialize complex object parameters
  const safeObject = safeSerializeForIPC(complexObject);
  return this.electronAPI.someService.newMethod(safeObject);
}
```

### 3. Type Safety
ElectronProxy interfaces should accept Vue reactive objects and handle them automatically inside:

```typescript
interface IModelManager {
  addModel(key: string, config: ModelConfig | Ref<ModelConfig>): Promise<void>
  // The interface supports reactive objects; the implementation serializes automatically
}
```

## Performance Considerations

- The ElectronProxy layer uses `JSON.parse(JSON.stringify())` to ensure 100% compatibility
- Serialization happens only at the IPC boundary and does not affect Vue component performance
- Avoid frequent service calls inside render loops
- For large objects, consider batching or passing data at a finer granularity

## Testing Strategy

1. **Unit tests**: Ensure the serialization function correctly handles various data types
2. **Integration tests**: Test all IPC calls in the desktop environment
3. **Regression tests**: After every change to IPC-related code, test in the desktop environment

## Summary

The current architecture has greatly simplified the use of Electron IPC:

1. **Vue component layer**: Pass reactive objects directly, without caring about serialization
2. **ElectronProxy layer**: Handles serialization automatically, ensuring IPC compatibility
3. **Main process layer**: Double protection, handling edge cases
4. **Development experience**: Cleaner code and fewer chances for mistakes

Remember: **You can now safely pass Vue reactive objects, and the architecture will handle it automatically!**

## 📚 Related Documents

- [112-Desktop IPC Fixes](../archives/112-desktop-ipc-fixes/) - IPC architecture analysis and language switching fixes
- [115-IPC Serialization Fixes](../archives/115-ipc-serialization-fixes/) - Solution for serializing Vue reactive objects
- [ElectronProxy Layer Serialization](../archives/115-ipc-serialization-fixes/proxy-layer-serialization.md) - Technical implementation details
- [Architecture Evolution Record](../archives/115-ipc-serialization-fixes/architecture-evolution.md) - The evolution from manual to automatic
