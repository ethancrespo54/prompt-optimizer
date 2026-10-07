# IPC Architecture Analysis and Development Lessons

## 📝 Background

Analysis of the IPC architecture problems encountered while developing the Desktop version, and the lessons from resolving them.

## 🔍 Architecture Difference Analysis

### 1. Web environment vs Desktop environment

**Web environment (single process)**:
```
Vue component → direct call → service instance
```

**Desktop environment (multi-process)**:
```
Vue component → ElectronProxy → IPC → Main process → service instance
```

### 2. Common Problem Patterns

#### Problem 1: Missing interface contract
```typescript
// ❌ Incomplete interface definition
interface ITemplateManager {
  getTemplate(id: string): Promise<Template>;
  // Missing language-related methods
}

// ✅ Complete interface definition
interface ITemplateManager {
  getTemplate(id: string): Promise<Template>;
  getCurrentBuiltinTemplateLanguage(): Promise<BuiltinTemplateLanguage>;
  changeBuiltinTemplateLanguage(language: BuiltinTemplateLanguage): Promise<void>;
}
```

#### Problem 2: Incomplete proxy implementation
```typescript
// ❌ Proxy class is missing methods
class ElectronTemplateManagerProxy implements ITemplateManager {
  async getTemplate(id: string): Promise<Template> {
    return this.electronAPI.getTemplate(id);
  }
  // Implementations of the other methods are missing
}

// ✅ Complete proxy implementation
class ElectronTemplateManagerProxy implements ITemplateManager {
  async getTemplate(id: string): Promise<Template> {
    return this.electronAPI.getTemplate(id);
  }
  
  async getCurrentBuiltinTemplateLanguage(): Promise<BuiltinTemplateLanguage> {
    return this.electronAPI.getCurrentBuiltinTemplateLanguage();
  }
}
```

#### Problem 3: Incomplete IPC chain
```javascript
// preload.js - missing method exposure
window.electronAPI = {
  template: {
    getTemplate: (id) => ipcRenderer.invoke('template-getTemplate', id),
    // Missing language-related methods
  }
}

// main.js - missing handler
ipcMain.handle('template-getTemplate', async (event, id) => {
  // Handling logic
});
// Missing language-related handlers
```

## 🛠️ Fix Strategy

### 1. Interface-first design
```typescript
// Step 1: Define the complete interface
export interface ITemplateManager {
  // All required methods
}

// Step 2: Web environment implementation
export class TemplateManager implements ITemplateManager {
  // Complete implementation
}

// Step 3: Electron proxy implementation
export class ElectronTemplateManagerProxy implements ITemplateManager {
  // Complete proxy implementation
}
```

### 2. IPC chain completeness check
```
Vue component call → check proxy method → check preload exposure → check main handler → check service method
```

### 3. Error handling principles
```typescript
// ❌ Masking errors
async someMethod() {
  try {
    return await this.service.method();
  } catch (error) {
    return null; // Masks the error
  }
}

// ✅ Propagating errors
async someMethod() {
  return await this.service.method(); // Let errors propagate naturally
}
```

## 🎯 Development Checklist

### IPC feature development checks
- [ ] Is the interface definition complete?
- [ ] Is the Web environment implementation complete?
- [ ] Is the Electron proxy implementation complete?
- [ ] Does preload.js expose all methods?
- [ ] Does main.js have the corresponding handlers?
- [ ] Is error handling correct?
- [ ] Has it been tested in both environments?

### Architecture violation checks
- [ ] Does preload.js only forward calls, with no business logic?
- [ ] Are all methods asynchronous?
- [ ] Is a unified error handling format used?
- [ ] Are there any direct cross-process calls?

## 💡 Best Practices

### 1. Incremental development
1. Implement and test in the Web environment first
2. Define the complete interface
3. Implement the Electron proxy
4. Complete the IPC chain
5. Test in the Desktop environment

### 2. Debugging tips
```javascript
// Add logging at every stage
console.log('[Vue] Calling method:', methodName);
console.log('[Proxy] Forwarding to IPC:', methodName);
console.log('[Main] Handling IPC:', methodName);
console.log('[Service] Executing:', methodName);
```

### 3. Type safety
```typescript
// Use strict type checking
interface ElectronAPI {
  template: {
    [K in keyof ITemplateManager]: ITemplateManager[K];
  };
}
```

## 🔗 Related Lessons

This architecture analysis provides a foundation for later development:
- Established a complete IPC development process
- Formed an interface-first design principle
- Established a complete development and debugging checklist

These lessons were applied further in the later serialization optimization (115).
