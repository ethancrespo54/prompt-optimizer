# Development Scratchpad

Record the progress and thoughts of the current development tasks.

---
## New Task: Fix Monorepo Build and Dependency Resolution Issues - [2024-07-28]
**Goal**: Resolve the loading of `@trpc/server` in the browser environment introduced by the tRPC refactor, and the series of Vite build failures and dependency resolution problems it triggered afterwards.
**Status**: Completed ✅

#### Resolution Steps
[x] 1. **Analyze the browser-side tRPC server error**: Confirmed the error was caused by the main entry of `@prompt-optimizer/core` exporting the server-only `createAppRouter` function.
[x] 2. **Separate client and server code**: Removed the `createAppRouter` export from `index.ts` of the `core` package, which initially fixed the frontend bundling issue but broke the Electron backend import.
[x] 3. **Fix the Vite build failure**: Tried using the `exports` map in `package.json` to fix the backend import, but this conflicted with Vite's build logic and caused the `ui` package build to fail. The resulting approach was:
    - **`ui` package**: Remove `@prompt-optimizer/core` from `externals` in `vite.config.ts`, making it a self-contained library with its dependencies bundled in.
    - **`core` package**: Use a `tsup` multi-entry build to compile both the public API (`index.ts`) and the server router (`router.ts`), but do not create an `exports` map for the latter.
    - **`desktop` package**: Modify `main.js` to import the server router through a direct file path (`require('@prompt-optimizer/core/dist/services/trpc/router.cjs')`), bypassing the `exports` map.
[x] 4. **Fix the Node.js module export error (ERR_PACKAGE_PATH_NOT_EXPORTED)**: Found that the direct path import from the previous step violates Node.js module encapsulation rules. The final, correct approach is:
    - In the `package.json` of the `core` package, use the `exports` field to explicitly export the `./trpc-router` path.
    - In `main.js` of the `desktop` package, import using the standard path `require('@prompt-optimizer/core/trpc-router')`.
[x] 5. **Verify the fix**: Rebuild the `core` package, make sure the Node.js environment (Electron) starts correctly, and verify the Vite build (if it fails, handle that in the next step)

#### Completion Summary
- **What was achieved**: Completely resolved the loading of server code in the browser environment, and worked out the best build and export strategy for a package in a monorepo that serves both the frontend (Vite) and the backend (Node.js).
- **Core problems encountered**:
    1. Coupling of frontend and backend code caused the server module to be bundled into the frontend.
    2. Differences in how the `package.json` `exports` map behaves under Vite and Node.js caused build conflicts.
    3. The `external` configuration left the library itself incomplete, increasing the configuration burden on consumers.
    4. **Node.js module encapsulation rules**: As long as the `exports` field exists in `package.json`, direct access by file path to any internal module not declared in `exports` is forbidden.
- **Solution**: Adopt a "**standard exports, consume as needed**" strategy.
    1. **Treat internal and external alike**: All paths that need to be accessed from outside the package (whether used by the frontend or the backend) must be explicitly declared in the `exports` field of `package.json`.
    2. **Self-contained component library**: A Vite-built UI library should bundle its internal dependencies and drop the `external` configuration, making it an independent and complete unit.
    3. **Consumers use standard paths**: All consumers (whether Vite or Node.js) should import modules through the standard paths declared in `exports` instead of relying on the internal file structure.
---
## New Task: Fix Style Loss Caused by the Dev Command - [2024-07-28]
**Goal**: Resolve the issue where the `pnpm run dev:desktop` command causes the web app to lose its styles.
**Status**: Completed ✅

#### Problem Analysis
- **Symptom**: After running the `dev:desktop` command, the web content in the desktop app has no CSS styles. Running `dev:fresh` works normally.
- **Root cause**: This is a classic "race condition". The `dev:desktop` command starts two processes **in parallel**:
    1. `watch:ui` (`vite build --watch`): watches and rebuilds the UI library, and operates on the `packages/ui/dist` directory.
    2. `dev:web` (`vite dev`): starts the Vite dev server, which needs to read `style.css` from the `packages/ui/dist` directory.
- **Conflict point**: At the moment `dev:web` tries to read `style.css`, `watch:ui` may be cleaning or rebuilding the `dist` directory, so the file temporarily does not exist and fails to load. The success of `dev:fresh` is accidental: it includes extra steps such as `pnpm install`, which change the startup timing of the two processes and happen to avoid the conflict.

#### Solution
- **Core idea**: In the development environment, fully trust the Vite dev server's ability to handle dependencies instead of prebuilding the dependency library.
- **Specific actions**:
    1. Create a new parallel command `dev:desktop:parallel:fixed` in `package.json`, optimized specifically for desktop development.
    2. In this new command, remove the `watch:ui` task that caused the problem.
    3. Keep only the parallel `dev:web` and `pnpm -F @prompt-optimizer/desktop dev`.
    4. Modify the `dev:desktop` command so that it calls this new, fixed parallel command.
- **Result**: The single Vite instance `dev:web` is fully responsible for live compilation and serving of all frontend dependencies (including the source files of `@prompt-optimizer/ui`), completely eliminating the "race condition".

---

## Current Task

### Electron Streaming API tRPC Refactor - [2024-07-27]
**Goal**: Use `electron-trpc` to refactor the streaming methods of `PromptService` (`optimizePromptStream`, `iteratePromptStream`, `testPromptStream`), achieving end-to-end type-safe streaming communication between the main process and the renderer process, and fully resolving the current missing functionality.
**Status**: In progress

#### Planned Steps
[x] 1. **Environment setup and dependency installation**
    - [x] Install `electron-trpc` in `packages/desktop`.
    - [x] Install `@trpc/server` in `packages/core`.
    - [x] Install `@trpc/client` in `packages/ui`.
    - [x] Verify that `pnpm install` runs successfully and the dependencies are correct.
    - Expected result: All dependencies are correctly added to their respective `package.json` files and the project compiles normally.
    - Risk assessment: Low. Mainly version compatibility issues.

[x] 2. **tRPC backend (main process) implementation**
    - [x] Create a `trpc/` directory in `packages/core/src/services`.
    - [x] Create `router.ts` in `trpc/` to define the tRPC root router (`appRouter`), including a `prompt` router.
    - [x] In the `prompt` router, use a `subscription` to implement `optimizePromptStream`.
    - [x] The `subscription` internally calls the real `PromptService` instance and sends data from callbacks such as `onToken` via `observer.next()`.
    - [x] In `packages/desktop/main.js`, create the tRPC IPC link and attach `appRouter` to it.
    - Expected result: The main process can handle tRPC requests and subscriptions from the renderer.
    - Risk assessment: Medium. The conversion between `Observable` and callbacks must be handled correctly, ensuring the stream lifecycle (start, data, end, error) is managed properly.

[x] 3. **tRPC frontend (renderer process) implementation**
    - [x] In `packages/desktop/preload.js`, use `exposeIPCHandler` to expose the tRPC handler to the renderer.
    - [x] In `packages/ui/src/composables/useAppInitializer.ts`, modify `initElectronServices` to create a tRPC client instance and use it to build the new `PromptService` proxy.
    - [x] The new `TRPCPromptServiceProxy` uses the tRPC client to call backend methods. `optimizePromptStream` will call `client.prompt.optimizePromptStream.subscribe(...)`.
    - Expected result: The renderer can communicate with the main process through a type-safe client, with more concise code.
    - Risk assessment: Medium. The client `links` must be configured correctly, and the service replacement logic in `useAppInitializer` must be error-free.

[x] 4. **Code refactoring and cleanup**
    - [x] Remove the old `console.warn`-based implementation in `ElectronPromptServiceProxy` and replace it with tRPC calls.
    - [x] Verify that `usePromptOptimizer.ts` works with the new proxy without any modification.
    - [ ] Refactor `iteratePromptStream` and `testPromptStream` in the same way.
    - Expected result: The old IPC code is completely removed and all streaming calls go through tRPC.
    - Risk assessment: Low. Mainly replacing and deleting code.

[ ] 5. **Functional testing and verification**
    - [ ] Start the desktop app (`pnpm --filter @prompt-optimizer/desktop dev`).
    - [ ] Perform one "Optimize Prompt" operation and verify that the typewriter effect appears.
    - [ ] Check the console to confirm there are no `not implemented` warnings and no history record creation errors.
    - [ ] Perform one "Iterative Optimization" and verify it works normally.
    - [ ] Run `npm run test` to make sure all existing test cases still pass.
    - Expected result: The desktop app's functionality is identical to the web version, with no errors.
    - Risk assessment: Medium. Some edge cases not anticipated during the refactor may be discovered.

[ ] 6. **Documentation updates**
    - [ ] Create a `trpc-ipc.md` document in the `docs/developer/architecture` directory to record the architectural decisions and implementation details of this refactor.
    - [ ] Update `docs/developer/project-structure.md` to reflect the new `trpc`-related files.
    - [ ] Record the key lessons from this refactor in `docs/workspace/experience.md`.

#### Progress Log
- [Date] [Description of specific progress]
- [Date] [Problems encountered and solutions]

#### Important Findings
- [Record important technical findings or lessons]

---

## Historical Tasks

### [Completed task name] - [Completion date] ✅
**Summary**: [Brief summary]
**Lessons**: [Key lessons extracted]

---

## To-Do Items

### Urgent
- [ ] [Urgent task 1]
- [ ] [Urgent task 2]

### Important
- [ ] [Important task 1]
- [ ] [Important task 2]

### General
- [ ] [General task 1]
- [ ] [General task 2]

---

## Issue Log

### Unresolved
- [Issue description] - [Date discovered]

### Resolved
- [Issue description] - [Solution] - [Date resolved]

---

## Notes
[Other information to record]

### Milestones
- [ ] Complete dependency installation and environment configuration.
- [ ] Complete the tRPC backend implementation.
- [ ] Complete the tRPC frontend implementation and communicate successfully.
- [ ] Complete the refactor of all streaming methods.
- [ ] All features pass testing on the desktop.
- [ ] Complete the writing and updating of related documentation.
