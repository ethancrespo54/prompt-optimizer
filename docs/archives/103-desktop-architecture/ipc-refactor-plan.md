# High-Level Service Proxy IPC Model Refactor Plan

## 📋 Task Overview

Resolve the fragility and compatibility problems caused by the incomplete emulation in the current low-level `fetch` proxy approach. Establish a stable, maintainable desktop application architecture with clear responsibilities, in which the main process is the backend service provider and the renderer process is a pure frontend consumer.

## 🎯 Goals

- Deprecate the low-level `fetch` proxy and switch to a high-level service interface proxy
- Establish a stable IPC communication protocol
- Implement the service provider role of the main process
- Improve the system's maintainability and stability

## 📅 Planned Timeline

- **Start date**: 2024-07-25
- **Current status**: 📋 Planning phase
- **Expected completion**: TBD

## 🔧 Planned Steps

### 1. Clean up the `core` package
- [ ] Remove all Electron-specific logic (such as `isRunningInElectron` and `fetch` injection)
- [ ] Return it to being a pure, platform-independent core business logic library
- [ ] Ensure the core package can run in any JavaScript environment

### 2. Rework `main.js`
- [ ] Make it a service provider
- [ ] Consume the `core` package directly via `require('@prompt-optimizer/core')`
- [ ] Instantiate core services such as `LLMService` in the main process
- [ ] Establish service management and lifecycle control

### 3. Implement main process storage
- [ ] Provide a storage solution suited to the Node.js environment for the services in `main.js`
- [ ] In the first phase, implement a temporary `MemoryStorageProvider`
- [ ] Later, implement file-based persistent storage

### 4. Refactor the IPC communication protocol
- [ ] Deprecate the low-level `api-fetch` proxy
- [ ] Establish a high-level IPC interface based on the public methods of `ILLMService` in `main.js` and `preload.js`
- [ ] Implement method-level IPC calls (such as `testConnection`, `sendMessageStream`)

### 5. Create the renderer process proxy
- [ ] Create an `ElectronLLMProxy` class in the `core` package
- [ ] The class implements the `ILLMService` interface
- [ ] Its internal methods call the IPC interface via `window.electronAPI.llm.*`

### 6. Rework the service initialization logic
- [ ] Modify `useServiceInitializer.ts`
- [ ] Make it detect the current environment (Web or Electron)
- [ ] Provide the application with either a real `LLMService` instance or an `ElectronLLMProxy` proxy instance

## 🚨 Problem Analysis

### Problems with the current architecture
1. **Fragility of the low-level proxy**: 
   - The `fetch` proxy causes serialization and instance type mismatch problems for objects such as `AbortSignal` and `Headers` when they are transferred across IPC
   - This crashes the application and is hard to maintain

2. **Violation of separation of concerns**:
   - It tries to emulate a complex and unstable low-level Web API
   - This violates the separation of concerns principle

3. **Hard to maintain**:
   - The emulation of low-level objects is incomplete
   - Debugging and troubleshooting are difficult

### Advantages of the solution
1. **Stable interface**: Proxy the high-level, stable service interfaces we define ourselves
2. **Simple data structures**: Based on stable, simple, serializable data structures and interfaces
3. **Clear responsibilities**: The main process focuses on providing services and the renderer process focuses on the UI

## 🏗️ New Architecture Design

### Main process architecture
```javascript
// main.js
const { LLMService, StorageProvider } = require('@prompt-optimizer/core');

class MainProcessServices {
  constructor() {
    this.storageProvider = new NodeStorageProvider();
    this.llmService = new LLMService(this.storageProvider);
  }
  
  async testConnection(config) {
    return await this.llmService.testConnection(config);
  }
  
  async sendMessageStream(messages, config, onChunk) {
    return await this.llmService.sendMessageStream(messages, config, onChunk);
  }
}

const services = new MainProcessServices();

// IPC handlers
ipcMain.handle('llm:testConnection', async (event, config) => {
  return await services.testConnection(config);
});

ipcMain.handle('llm:sendMessageStream', async (event, messages, config) => {
  // Special logic for handling streaming responses
});
```

### Renderer process proxy
```typescript
// ElectronLLMProxy.ts
export class ElectronLLMProxy implements ILLMService {
  async testConnection(config: LLMConfig): Promise<boolean> {
    return await window.electronAPI.llm.testConnection(config);
  }
  
  async sendMessageStream(
    messages: Message[], 
    config: LLMConfig, 
    onChunk: (chunk: string) => void
  ): Promise<string> {
    return await window.electronAPI.llm.sendMessageStream(messages, config, onChunk);
  }
}
```

### Environment detection and initialization
```typescript
// useServiceInitializer.ts
export function useServiceInitializer() {
  const isElectron = typeof window !== 'undefined' && window.electronAPI;
  
  if (isElectron) {
    return {
      llmService: new ElectronLLMProxy(),
      storageProvider: new ElectronStorageProxy()
    };
  } else {
    return {
      llmService: new LLMService(new WebStorageProvider()),
      storageProvider: new WebStorageProvider()
    };
  }
}
```

## 📋 Milestones

- [ ] Finish the design and documentation sync
- [ ] Finish the code refactor
- [ ] The desktop application runs successfully on the new architecture
- [ ] Implement file-based persistent storage in the main process

## 💡 Key Lessons

1. **Inter-process communication principle**: Should be based on stable, simple, serializable data structures and interfaces
2. **Avoid proxying low-level objects**: Do not try to proxy complex low-level native objects
3. **Separation of concerns**: The main process focuses on services and the renderer process focuses on the UI
4. **Interface stability**: High-level interfaces are more stable than low-level APIs and better suited to inter-process communication

## 🔗 Related Documents

- [Current Desktop Architecture](./README.md)
- [Desktop Application Implementation Record](./desktop-implementation.md)
- [IPC Communication Best Practices](./ipc-best-practices.md)

---

**Task status**: 📋 Planning phase  
**Priority**: High  
**Last updated**: 2025-07-01
