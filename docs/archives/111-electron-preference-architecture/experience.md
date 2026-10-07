# Development Lessons Learned

## 🎯 Core Lessons

### 1. Managing Electron API Initialization Timing
**Lesson**: In the Electron environment, there is a timing race between the preload script exposing its API and the renderer process initializing its components

**Best practice**:
```typescript
// ❌ Wrong: access the API directly
window.electronAPI.preference.get(key, defaultValue)

// ✅ Correct: check first, then access
if (isElectronApiReady()) {
  await window.electronAPI.preference.get(key, defaultValue)
} else {
  await waitForElectronApi()
  // then access it
}
```

**Applies to**: service initialization in every Electron app

### 2. Vue Component Initialization and Service Dependencies
**Lesson**: Vue's onMounted hook may fire before services are fully ready, causing race conditions

**Solutions**:
- Use an asynchronous initialization pattern
- Implement lazy loading in the service layer
- Add service readiness checks

**What to avoid**: do not immediately call services that may not be ready when a component mounts

### 3. API Path Standardization
**Lesson**: The API path exposed by preload.js must match the path the code uses exactly

**Standard pattern**:
```typescript
// preload.js
contextBridge.exposeInMainWorld('electronAPI', {
  preference: { /* API methods */ }
})

// Code access
window.electronAPI.preference.get()
```

**Common mistakes**: 
- preload exposes under `electronAPI`, but the code accesses `api`
- Inconsistent API structure leads to undefined access

## 🛠️ Technical Implementation Lessons

### 1. Environment Detection Best Practices
```typescript
// Multi-layer detection ensures the API is fully available
export function isElectronApiReady(): boolean {
  const window_any = window as any;
  const hasElectronAPI = typeof window_any.electronAPI !== 'undefined';
  const hasPreferenceApi = hasElectronAPI && 
    typeof window_any.electronAPI.preference !== 'undefined';
  return hasElectronAPI && hasPreferenceApi;
}
```

**Key points**:
- Detect not only the environment but also the availability of the specific API
- Use type-safe detection
- Provide detailed debug logs

### 2. Asynchronous Waiting Pattern
```typescript
export function waitForElectronApi(timeout = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    // Check immediately to avoid unnecessary waiting
    if (isElectronApiReady()) {
      resolve(true);
      return;
    }
    
    // Polling check + timeout protection
    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      if (isElectronApiReady()) {
        clearInterval(checkInterval);
        resolve(true);
      } else if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        resolve(false);
      }
    }, 50);
  });
}
```

**Design points**:
- Fast path: return immediately when already ready
- Reasonable interval: 50ms balances performance and responsiveness
- Timeout protection: prevents infinite waiting
- Resource cleanup: clear the timer promptly

### 3. Proxy Service Protection Pattern
```typescript
class ElectronPreferenceServiceProxy {
  private ensureApiAvailable() {
    if (!window?.electronAPI?.preference) {
      throw new Error('Electron API not available');
    }
  }

  async get<T>(key: string, defaultValue: T): Promise<T> {
    this.ensureApiAvailable(); // Check before every call
    return window.electronAPI.preference.get(key, defaultValue);
  }
}
```

**Design principles**:
- Defensive programming: check before every call
- Clear error messages: easier troubleshooting
- Unified check logic: avoids duplicated code

## 🚫 Pitfall Guide

### 1. Common Error Patterns

#### Mistake 1: Assuming the API is available immediately
```typescript
// ❌ Dangerous: assumes the API is ready
export function useTemplateManager() {
  const services = inject('services')
  // This may be called before the API is ready
  services.preferenceService.get('template-selection', null)
}
```

#### Mistake 2: Inconsistent API paths
```typescript
// ❌ Wrong: paths do not match
// preload.js: window.electronAPI.preference
// Code access: window.api.preference
```

#### Mistake 3: Missing timeout protection
```typescript
// ❌ Dangerous: may wait forever
while (!isApiReady()) {
  await sleep(100) // No timeout mechanism
}
```

### 2. Debugging Tips

#### Add detailed logs
```typescript
console.log('[isElectronApiReady] API readiness check:', {
  hasElectronAPI,
  hasPreferenceApi,
});
```

#### Use breakpoint debugging
- Set breakpoints in the API detection function
- Inspect the actual structure of the window object
- Verify the exposed API is complete

#### Timing analysis
- Record a timestamp for each initialization step
- Analyze the timing relationship between component mounting and API readiness

## 🔄 Architecture Design Lessons

### 1. Service Layer Abstraction
**Lesson**: With a service layer abstraction, UI components do not need to know the underlying storage implementation

**Benefits**:
- Environment independence: the same UI code runs in both Web and Electron
- Easy to test: the service layer can be mocked easily
- Separation of concerns: the UI focuses on presentation, the service layer handles data

### 2. Applying the Proxy Pattern
**Lesson**: In the Electron environment, use the proxy pattern to encapsulate IPC communication

**Advantages**:
- Unified interface: the proxy service implements the same interface
- Error isolation: the proxy layer handles communication errors
- Transparent switching: upper-level code does not need to be aware of environment differences

### 3. Dependency Injection Pattern
**Lesson**: Use dependency injection to manage service instances

**Implementation**:
```typescript
// Environment-aware service creation
if (isRunningInElectron()) {
  preferenceService = new ElectronPreferenceServiceProxy()
} else {
  preferenceService = createPreferenceService(storageProvider)
}

// Unified injection
provide('services', { preferenceService, ... })
```

## 📊 Performance Optimization Lessons

### 1. Initialization Performance
- **Lazy loading**: initialize services only when needed
- **Parallel initialization**: services without dependencies can be initialized in parallel
- **Cache detection results**: avoid repeated environment detection

### 2. Runtime Performance
- **Batch operations**: combine multiple configuration reads and writes
- **Async processing**: use Promises to avoid blocking the UI
- **Error recovery**: handle API call failures gracefully

## 🧪 Testing Strategy Lessons

### 1. Environment Simulation
```typescript
// Mock the Electron environment
Object.defineProperty(window, 'electronAPI', {
  value: {
    preference: {
      get: jest.fn(),
      set: jest.fn(),
    }
  }
})
```

### 2. Timing Tests
- Test access behavior before the API is ready
- Test handling of timeout scenarios
- Test the safety of concurrent initialization

### 3. Integration Tests
- End-to-end test the full initialization flow
- Verify behavior consistency across environments
- Test the error recovery mechanism

## 🔗 Related Resources

### Documentation Links
- [Electron Context Bridge documentation](https://www.electronjs.org/docs/api/context-bridge)
- [Vue 3 Composition API](https://vuejs.org/guide/extras/composition-api-faq.html)

### Code Examples
- Full implementation: `packages/core/src/services/preference/`
- Test cases: `packages/core/tests/`

---

**Summary date**: 2025-01-01  
**Applicable versions**: Electron 37.x, Vue 3.x  
**Experience level**: Verified in production
