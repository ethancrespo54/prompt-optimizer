# Prompt Optimizer Desktop Application Developer Guide

## 1. Project Background and Goals

The goal is to turn the existing Prompt Optimizer Web application into a desktop application. The core objective is to **use the Electron main process to proxy API requests, thereby completely solving the browser's CORS cross-origin problem**.

### Technology Choice: Why Electron?

-   **Unified tech stack**: Electron lets us reuse the existing JavaScript/TypeScript and Vue stack without introducing new technologies such as Rust (the Tauri approach), lowering the team's learning cost and entry barrier.
-   **Minimal code intrusion**: Through Electron's inter-process communication (IPC) mechanism, we can implement a seamless API request proxy. We only need to inject a custom network request function when the SDK is initialized, with minimal intrusion into the core business logic (`packages/core`).
-   **Mature ecosystem**: Electron has a large, mature community and ecosystem, giving strong support for future feature extensions (such as auto-update and system notifications).

## 2. Architecture Design

The application uses a **high-level service proxy** architecture with clear responsibilities and strong maintainability. The main process acts as the backend service provider, and the renderer process acts as the frontend consumer.

### Overall Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                  Electron Desktop Application               │
├─────────────────────────────────────────────────────────────┤
│              Main Process (main.js) - Server side           │
│  - Window management                                        │
│  - **Consumes the @prompt-optimizer/core package directly** │
│  - **Instantiates and holds core services (LLMService,      │
│    ModelManager)**                                          │
│  - **Acts as the backend, providing high-level service      │
│    interfaces over IPC (e.g. testConnection)**              │
├─────────────────────────────────────────────────────────────┤
│           Preload Script (preload.js) - Secure Bridge       │
│  - Takes the main process's high-level service interfaces   │
│    (`llm.testConnection`)                                   │
│  - And safely exposes them to the renderer process          │
│    (`window.electronAPI.llm.*`)                             │
├─────────────────────────────────────────────────────────────┤
│       Renderer Process (Vue app) - Pure frontend consumer   │
│  - UI and user interaction                                  │
│  - **Via the proxy object in the `core` package             │
│    (`ElectronLLMProxy`)**                                   │
│  - **Calls `window.electronAPI.llm.testConnection()`**      │
│  - **Does not handle network requests directly; only calls  │
│    the defined service interfaces**                         │
└─────────────────────────────────────────────────────────────┘
```

### Service Call Data Flow

```
1. The user acts in the UI, triggering a method in a Vue component
2. The Vue component calls the Electron-facing proxy service in the `core` package (`ElectronLLMProxy`)
3. The proxy service calls `window.electronAPI.llm.testConnection()` exposed by the preload script (IPC call)
4. The preload script sends the request to the main process via `ipcRenderer`
5. The main process's `ipcMain` listener captures the request and directly calls the **real LLMService instance held in the main process**
6. The LLMService instance, running in the Node.js environment, uses `node-fetch` to make the real API request
7. The final result (JSON data, not a Response object) returns along the same path: main process → preload script → proxy service → Vue component → UI update
```

### Core Architecture Explained: Proxy Pattern and Inter-Process Communication (IPC)

To truly understand the robustness of the new architecture, you must understand the core idea behind it: **the main process is the "brain," and the renderer process is the "limbs."** All memory, thinking, and decision-making (core services) must be done centrally by the "brain," while the "limbs" (UI) only perceive and act.

#### 1. Why can't the UI layer call the `core` module directly?

In a pure Web application, the UI and Core live in the same world (a single process) and can communicate directly. In Electron, however, the main process and the renderer process are two **completely isolated operating system processes**, each with its own independent memory space.

What happens if the UI layer (renderer process) calls `createModelManager()` directly?
- **Data silos**: A **brand-new, empty** `ModelManager` instance is created in the renderer process. It is **disconnected** from the instance in the main process that holds the real data, so the data can never be synchronized.
- **Missing capabilities**: Some features of the `core` module (such as file reading and writing to be implemented in the future) depend on the Node.js environment. The renderer process (based on Chromium) lacks these capabilities, and calling those features will directly cause the **application to crash**.

#### 2. `ipcRenderer` and `ipcMain`: A Telephone Between Two Worlds

Inter-process communication (IPC) is the only bridge connecting these two isolated worlds.
- **`ipcRenderer`**: The "telephone" installed in the **renderer process**, used specifically to "call" the main process (make requests).
- **`ipcMain`**: The "switchboard" installed in the **main process**, used specifically to "answer calls" (handle requests).

We mainly use the **two-way communication** pattern of `invoke`/`handle`, which perfectly models an asynchronous "request-response" flow.

#### 3. `ElectronModelManagerProxy`: An Elegant "Full Proxy"

Having the UI layer operate on low-level "telephone commands" like `ipcRenderer.invoke('channel-name', ...)` directly is messy and unsafe. For this reason, we introduced the **Proxy Pattern**.

The core role of a proxy class such as `ElectronModelManagerProxy` is to **"pretend"** to be the real `ModelManager`, so that code in the UI layer can call it seamlessly as before without caring about the complex cross-process communication behind it.

Its workflow is a precise "intercept-forward-return":
1. **UI call**: The UI calls `modelManager.getModels()`.
2. **Proxy intercepts**: What is actually called is the same-named method of the `ElectronModelManagerProxy` instance.
3. **Proxy forwards**: This method contains no business logic; it only calls `ipcRenderer.invoke('model-getModels')` through the `electronAPI` exposed by `preload.js`.
4. **Main process handles**: `ipcMain.handle` captures the request, calls the **single, real `ModelManager` instance in the main process**, and processes and returns the data.
5. **Data returns**: The result returns along the same path and is finally delivered to the UI component.

Although this pattern requires adding "boilerplate code" in several files (`main.js`, `preload.js`, `proxy.ts`) whenever a method is added, this is not meaningless duplication but a highly cost-effective price paid in exchange for a **single source of data, secure boundaries, and an elegant type-safe abstraction**.

## 3. Quick Start (Development Mode)

### System Requirements

-   Windows 10/11, macOS, or Linux
-   Node.js 18+
-   pnpm 8+

### Startup Steps

```bash
# 1. (First time) Install all dependencies in the project root
pnpm install

# 2. Run the desktop application in development mode
pnpm dev:desktop
```

This command starts both the Vite development server (for the frontend UI) and the Electron application instance, with hot reload enabled.

## 4. Core Technical Implementation

The current architecture abandons the fragile low-level `fetch` proxy in favor of a more stable and more maintainable **high-level service proxy model**.

### Service Consumption Model

The main process (`main.js`) now acts as a backend service, directly consuming the capabilities of `packages/core` and fully reusing its business logic, avoiding code redundancy.

```javascript
// main.js - the main process imports and uses the core package directly
const { 
    createLLMService, 
    createModelManager,
    // ... other services
} = require('@prompt-optimizer/core');

// Instantiate services when the main process starts
let llmService;
app.whenReady().then(() => {
    // A storage solution suitable for Node.js is needed here (see below)
    const modelManager = createModelManager(/* ... */);
    
    // Create a real LLMService instance that runs in the Node.js environment
    llmService = createLLMService(modelManager);
    
    // Pass the service instance to the IPC setup function
    setupIPC(llmService);
});
```

### High-Level IPC Interface

The communication "contract" between the renderer process and the main process is upgraded from the unstable `fetch` API to our own stable, self-defined `ILLMService` interface.

```javascript
// main.js - provide the service interface
function setupIPC(llmService) {
    ipcMain.handle('llm-testConnection', async (event, provider) => {
        try {
            await llmService.testConnection(provider);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
    // ... implementation of other interfaces
}

// preload.js - expose the service interface
contextBridge.exposeInMainWorld('electronAPI', {
    llm: {
        testConnection: (provider) => ipcRenderer.invoke('llm-testConnection', provider),
        // ... exposure of other interfaces
    }
});
```

### Storage Strategy

Because the renderer process's `IndexedDB` is unavailable in the main process (Node.js), we designed a phased storage plan for the desktop app:

-   **Phase 1 (current implementation):** Use a temporary **in-memory storage** solution. This lets the new architecture run quickly, but data is lost when the application is closed.
-   **Phase 2 (future plan):** Implement a **file storage (`FileStorageProvider`)** that persists models, templates, and other data as JSON files on the user's local disk, taking full advantage of the desktop environment.

## 5. Build and Deployment

### Development Scripts

-   `pnpm dev:desktop`: Starts the frontend development server and the Electron application together, for day-to-day development.
-   `pnpm build:web`: Builds only the frontend Web application, with output going to `packages/desktop/web-dist`.
-   `pnpm build:desktop`: Builds the final distributable desktop application (such as `.exe` or `.dmg`).

### Production Build Process

```bash
# Full build process; the web content is built first automatically
pnpm build:desktop

# After the build completes, the executables are located in the following directory
# packages/desktop/dist/
```

### Electron Builder Configuration

The packaging configuration is in the `build` field of `packages/desktop/package.json`.

```json
{
  "build": {
    "appId": "com.promptoptimizer.desktop",
    "productName": "Prompt Optimizer",
    "directories": { "output": "dist" },
    "files": [
      "main.js", 
      "preload.js", 
      "web-dist/**/*", // Package the built frontend application
      "node_modules/**/*"
    ],
    "win": {
      "target": "nsis", // Windows installer format
      "icon": "icon.ico" // Application icon
    }
  }
}
```

## 6. Troubleshooting

**1. The application fails to start or the UI is blank**
-   Make sure `pnpm install` ran successfully.
-   Confirm that `pnpm build:web` ran successfully and that the `packages/desktop/web-dist` directory has been generated and is not empty.
-   Try cleaning and reinstalling: `pnpm store prune && pnpm install`.

**2. Electron installation is incomplete**
-   This is usually a network problem. Try configuring the `electron_mirror` environment variable or installing manually.
-   Manual install command:
    ```bash
    # (The path may vary depending on the pnpm version)
    cd node_modules/.pnpm/electron@<version>/node_modules/electron
    node install.js
    ```

**3. API calls fail**
-   Check that the API key is correctly configured on the desktop app's "Model Management" page.
-   Open the developer tools (`Ctrl+Shift+I`) and check the renderer process `Console`.
-   **Important:** Because the core API call logic has moved to the main process, be sure to **check the log output in the terminal (command-line window) that launched the desktop app**, which contains the most direct `node-fetch` error messages.
-   Confirm that the network connection is working.

## 7. Future Architecture Improvement Directions

Currently, manually maintaining IPC "boilerplate code" across several files is clear and robust, but as features grow, development efficiency and consistency will become challenges. In the future, we can adopt a **code generation** approach to solve this problem completely.

### Core Idea

The only file we need to maintain by hand should be the service's **interface definition** (for example `IModelManager`). We treat this interface as the **"Single Source of Truth."**

### Automated Workflow

1.  **Define the blueprint**: Maintain interfaces such as `IModelManager` in the `core` package's `types.ts` file.
2.  **Write a generator script**: Use a library such as `ts-morph` to write a Node.js script that can read and parse the structure of the TypeScript interface (method names, parameters, return values, etc.).
3.  **Auto-generate boilerplate code**: The script iterates over each method in the interface and, based on preset templates, automatically generates `ipcMain.handle` in `main.js`, the `ipcRenderer` call in `preload.js`, and the proxy method in `electron-proxy.ts`.
4.  **One-command update**: Integrate this script into `package.json`. In the future, when an interface method is added, modified, or deleted, the developer only needs to modify the interface definition and then run one command (such as `pnpm generate:ipc`), and all related IPC code will be updated automatically and without error.

### Alternative

The mature `tRPC` framework in the community offers a similar idea, whose core is a type-safe API layer with "zero code generation." We can borrow its ideas and may even try integrating it into Electron's IPC mechanism.

After adopting this approach, our development process will become extremely efficient and safe, completely eliminating all the potential errors that manually maintaining IPC calls can bring.
