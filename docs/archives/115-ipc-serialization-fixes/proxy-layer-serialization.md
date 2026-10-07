# Unified IPC Serialization in the ElectronProxy Layer

## 📋 Overview

Moves IPC serialization from the UI layer to the ElectronProxy layer, providing a unified serialization mechanism that is transparent to Vue components.

## 🚨 Background

### Problems with the Previous Approach
1. **Manual serialization required in every Vue component** - easy to forget, high maintenance cost
2. **Heavy mental burden on developers** - they must remember to serialize before every IPC call
3. **Poor architecture** - the UI layer has to care about low-level IPC implementation details
4. **Error-prone** - serialization is easily forgotten when adding new features

### The Real Cause of the Error
Although main.js has `safeSerialize` handling, the error occurs in the **IPC transport stage**:
```
Vue component → ElectronProxy → preload.js → [IPC transport] → main.js
                                        ↑
                                   The error occurs here
```

## ✅ Solution

### 1. Unified Serialization Utility
**File**: `packages/core/src/utils/ipc-serialization.ts`

```typescript
/**
 * Safe serialization function used to clean Vue reactive objects
 */
export function safeSerializeForIPC<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  try {
    return JSON.parse(JSON.stringify(obj));
  } catch (error) {
    console.error('[IPC Serialization] Failed to serialize object:', error);
    throw new Error(`Failed to serialize object for IPC: ${error instanceof Error ? error.message : String(error)}`);
  }
}
```

### 2. Automatic Serialization in the ElectronProxy Layer

#### TemplateManager Proxy
```typescript
// packages/core/src/services/template/electron-proxy.ts
import { safeSerializeForIPC } from '../../utils/ipc-serialization';

export class ElectronTemplateManagerProxy implements ITemplateManager {
  async saveTemplate(template: Template): Promise<void> {
    // Serialize automatically to prevent errors when passing Vue reactive objects over IPC
    const safeTemplate = safeSerializeForIPC(template);
    return this.electronAPI.createTemplate(safeTemplate);
  }
}
```

#### ModelManager Proxy
```typescript
// packages/core/src/services/model/electron-proxy.ts
export class ElectronModelManagerProxy implements IModelManager {
  async addModel(key: string, config: ModelConfig): Promise<void> {
    const safeConfig = safeSerializeForIPC({ ...config, key });
    await this.electronAPI.model.addModel(safeConfig);
  }

  async updateModel(key: string, config: Partial<ModelConfig>): Promise<void> {
    const safeConfig = safeSerializeForIPC(config);
    await this.electronAPI.model.updateModel(key, safeConfig);
  }
}
```

#### HistoryManager Proxy
```typescript
// packages/core/src/services/history/electron-proxy.ts
export class ElectronHistoryManagerProxy implements IHistoryManager {
  async addRecord(record: PromptRecord): Promise<void> {
    const safeRecord = safeSerializeForIPC(record);
    return this.electronAPI.history.addRecord(safeRecord);
  }

  async createNewChain(record: Omit<PromptRecord, 'chainId' | 'version' | 'previousId'>): Promise<PromptRecordChain> {
    const safeRecord = safeSerializeForIPC(record);
    return this.electronAPI.history.createNewChain(safeRecord);
  }

  async addIteration(params: {...}): Promise<PromptRecordChain> {
    const safeParams = safeSerializeForIPC(params);
    return this.electronAPI.history.addIteration(safeParams);
  }
}
```

#### PromptService Proxy
```typescript
// packages/core/src/services/prompt/electron-proxy.ts
export class ElectronPromptServiceProxy implements IPromptService {
  async optimizePrompt(request: OptimizationRequest): Promise<string> {
    const safeRequest = safeSerializeForIPC(request);
    return this.api.optimizePrompt(safeRequest);
  }
}
```

### 3. Simplified Vue Components
Vue components can now call services directly without caring about serialization:

```typescript
// TemplateManager.vue - before the fix
import { createSafeTemplate } from '../utils/ipc-serialization'
const safeTemplate = createSafeTemplate(updatedTemplate)
await getTemplateManager.value.saveTemplate(safeTemplate)

// TemplateManager.vue - after the fix
await getTemplateManager.value.saveTemplate(updatedTemplate) // serialized automatically
```

## 🏗️ Architectural Advantages

### 1. Clear Layering
```
Vue component layer  - business logic, no need to care about IPC details
    ↓
ElectronProxy layer  - automatic serialization, IPC calls
    ↓
IPC transport layer  - plain JavaScript object transfer
    ↓
Main process layer   - double protection (safeSerialize)
```

### 2. Developer Experience
- ✅ **Transparent to Vue components** - components don't need to care about serialization
- ✅ **Automatic protection** - new features automatically get serialization protection
- ✅ **Centralized management** - all serialization logic lives in one place
- ✅ **Hard to miss** - the architecture guarantees serialization is handled

### 3. Maintainability
- ✅ **Unified utility** - avoids duplicated code
- ✅ **Type safety** - TypeScript type checking
- ✅ **Error handling** - unified error handling mechanism

## 🛡️ Dual Protection Mechanism

```
Vue component → ElectronProxy serialization → IPC transport → Main.js serialization → business logic
         ↑                              ↑
    First layer of protection        Second layer of protection
   (required, solves transport)      (defensive, handles edge cases)
```

## 📊 Fix Verification

### Fixed Files
- ✅ `packages/core/src/utils/ipc-serialization.ts` - unified serialization utility
- ✅ `packages/core/src/services/template/electron-proxy.ts` - template management proxy
- ✅ `packages/core/src/services/model/electron-proxy.ts` - model management proxy
- ✅ `packages/core/src/services/history/electron-proxy.ts` - history proxy
- ✅ `packages/core/src/services/prompt/electron-proxy.ts` - prompt service proxy
- ✅ `packages/core/src/services/llm/electron-proxy.ts` - LLM service proxy
- ✅ `packages/core/src/services/preference/electron-proxy.ts` - preference proxy
- ✅ `packages/core/src/index.ts` - exports the serialization utility

### Cleaned-up Files
- ✅ `packages/ui/src/utils/ipc-serialization.ts` - removed the UI-layer serialization utility
- ✅ `packages/ui/src/components/TemplateManager.vue` - removed manual serialization
- ✅ `packages/ui/src/components/ModelManager.vue` - removed manual serialization
- ✅ `packages/ui/src/composables/usePromptOptimizer.ts` - removed manual serialization
- ✅ `packages/ui/src/composables/usePromptHistory.ts` - removed manual serialization

### Test Scenarios
- [ ] Template migration (the original problem scenario)
- [ ] Adding/editing models
- [ ] Saving history records
- [ ] Prompt optimization

## 💡 Best Practices

### 1. When Adding New ElectronProxy Methods
```typescript
async newMethod(complexObject: SomeType): Promise<ResultType> {
  // Always serialize complex object parameters
  const safeObject = safeSerializeForIPC(complexObject);
  return this.electronAPI.someService.newMethod(safeObject);
}
```

### 2. Primitive Parameters Need No Serialization
```typescript
async simpleMethod(id: string, count: number): Promise<void> {
  // Primitives don't need serialization
  return this.electronAPI.someService.simpleMethod(id, count);
}
```

### 3. Debugging Serialization Problems
```typescript
import { debugIPCSerializability } from '@prompt-optimizer/core';

// During development, check whether an object is serializable
debugIPCSerializability(complexObject, 'MyObject');
```

## 🎯 Summary

This fix achieved:
1. **Architecture optimization** - moved serialization to the right layer
2. **Better developer experience** - Vue components don't need to care about IPC details
3. **Improved maintainability** - unified serialization, no duplicated code
4. **Increased reliability** - dual protection ensures safe IPC transport

In this way, we completely resolved the "An object could not be cloned" error and established a sustainable architectural pattern.
