# Development Experience Log

Record important lessons and best practices from the development process.

## 🔧 Build and Dependency Management (Monorepo & Vite)

**Lesson**: In a pnpm workspace (monorepo), when one package (such as `@core`) needs to serve both the frontend (the Vite-built `@ui` package) and the backend (Node.js/Electron), exports and dependencies must be handled carefully to avoid build conflicts.

**Scenario**:
- A `@core` package, where some of the code (such as tRPC routers) is backend-only and the rest is shared code.
- A `@ui` package (built with Vite) that depends on the `@core` package.
- A `@desktop` package (using Electron) that also depends on the `@core` package and needs to use its backend-only code.

**Problems**:
1. If the `@core` package exports backend-only code from its main entry (`index.ts`), the frontend app ends up bundling unnecessary server dependencies (such as `@trpc/server`).
2. If, to solve problem 1, a separate entry for the backend code is created via the `exports` map in `package.json`, it may break Vite's dependency resolution and cause the `@ui` package build to fail.
3. If the `@core` package is marked `external` in `@ui`'s Vite config, it adds configuration complexity to the final application and prevents it from working "out of the box".

**Best practice / solution**:
1.  **Self-contained component library (Batteries Included)**: In the `vite.config.ts` of the `@ui` package, **remove** the `external` configuration for internal dependencies (such as `@core`). Make the UI library a complete, self-contained product that bundles all necessary dependencies.
2.  **Multi-entry build for the core package**: In the `@core` package, use a tool such as `tsup` to configure a **multi-entry** build. One entry is the public API for the frontend and most of the backend (`index.ts`), and the other is a dedicated file used only by specific backends (such as `router.ts`).
3.  **Separate exports from implementation (public API vs internal paths)**:
    - **Do not** create a complicated `exports` map in `package.json` for backend-only code. Keep the main `exports` clean and simple, pointing only to the public API.
    - Where backend-only code is needed (such as `desktop/main.js`), `require` the compiled file directly from the `dist` directory through a **relative file path**.

**Code examples**:
- `packages/core/package.json` (scripts):
  `"build": "tsup src/index.ts src/services/trpc/router.ts --format cjs,esm --dts"`
- `packages/desktop/main.js` (import):
  `const { createAppRouter } = require('@prompt-optimizer/core/dist/services/trpc/router.cjs');`

**Conclusion**: This "public API + internal path" strategy elegantly addresses the different needs of the frontend and backend for the same package, keeps the Vite build running smoothly, and keeps the backend functionality available.

**Core principle**: The module resolution rules of both modern frontend build tools (such as Vite) and the backend environment (Node.js) must be satisfied at the same time. The key is to respect Node.js `exports` encapsulation and build on that to solve Vite compatibility issues.

**How the problems evolved**:
1.  **Frontend loading backend code**: The `index.ts` of the `@core` package exported server-only code, causing errors in the browser.
2.  **Vite build failure**: To solve problem 1, a separate entry for the backend code was created with `exports`, but this multi-entry configuration prevented Vite from resolving dependencies.
3.  **Node.js path not exported (ERR_PACKAGE_PATH_NOT_EXPORTED)**: To solve problem 2, the backend was made to reference the internal file path directly, but this violates Node.js module encapsulation rules, because when the `exports` field exists, all access must go through what it allows.

**The final best practice (The Standard Way)**:
1.  **Self-contained component library (Batteries Included)**:
    - In the `vite.config.ts` of the `@ui` package, **remove** the `external` configuration for internal dependencies (such as `@core`). Make the UI library a complete, self-contained product that bundles all necessary dependencies. This is the starting point for solving the problem.
2.  **Explicitly declare all exports in the core package**:
    - In the `package.json` of the `@core` package, use the `exports` field to **explicitly declare all** paths that need to be accessed externally, whether for the frontend or the backend.
    - Use a tool such as `tsup` to perform a multi-entry build, ensuring that every path declared in `exports` has a corresponding build artifact.
3.  **All consumers use standard paths**:
    - Both the frontend and the backend should import modules through the standard paths declared in `exports` (e.g., `'@prompt-optimizer/core'` or `'@prompt-optimizer/core/trpc-router'`).
    - **Forbid** any package from importing from another package's internal file paths (such as `dist/...`).

**Code examples (final correct configuration)**:
- `packages/core/package.json`:
  ```json
  "exports": {
    ".": { "import": "./dist/index.js", "require": "./dist/index.cjs" },
    "./trpc-router": { "import": "./dist/services/trpc/router.js", "require": "./dist/services/trpc/router.cjs" }
  },
  "scripts": {
    "build": "tsup src/index.ts src/services/trpc/router.ts --format cjs,esm --dts"
  }
  ```
- `packages/desktop/main.js`:
  `const { createAppRouter } = require('@prompt-optimizer/core/trpc-router');`

**Conclusion**: This standardized solution guarantees the strong encapsulation of the `@core` package while giving consumers in different environments a clear, stable, and unique access interface. If the Vite build still fails on this basis, the next step should be to adjust Vite's own configuration (such as `resolve.alias` or `optimizeDeps.exclude`) rather than breaking the package's encapsulation rules.

## 🔧 Technical Lessons

### Architecture Design
- [Lesson description] - [Applicable scenario] - [Date recorded]

### Error Handling
- [Error type] - [Solution] - [Prevention measures] - [Date recorded]

### Performance Optimization
- [Optimization point] - [Optimization method] - [Effect] - [Date recorded]

### Testing Practices
- [Test type] - [Best practice] - [Recommended tools] - [Date recorded]

## 🛠️ Tool Configuration

### Development Tools
- [Tool name] - [Configuration highlights] - [Usage tips] - [Date recorded]

### Debugging Tips
- [Problem type] - [Debugging method] - [Tool usage] - [Date recorded]

## 📚 Learning Resources

### Useful Documents
- [Document title] - [Link] - [Key points summary] - [Date recorded]

### Code Examples
- [Feature description] - [Code snippet or file location] - [Usage scenario] - [Date recorded]

## 🚫 Pitfall Guide

### Common Mistakes
- [Mistake description] - [Cause analysis] - [How to avoid] - [Date recorded]

### Design Traps
- [Design problem] - [Consequence] - [Correct approach] - [Date recorded]

## 🔄 Process Improvements

### Workflow Optimization
- **Lesson**: When designing development commands in a monorepo, avoid "race conditions" caused by parallel processes operating on the same directory.
- **Scenario**: Using `concurrently` to run multiple tasks in parallel, where one task is the Vite dev server (`vite dev`) and another is the watch build task of its dependency library (`vite build --watch`).
- **Problem**: At startup, `vite dev` needs to read the build artifacts of the dependency library (such as `@ui`), e.g. `dist/style.css`, while `vite build --watch` may be cleaning or rewriting that `dist` directory at the same time, causing file read failures and problems such as missing styles.
- **Best practice**:
    1.  **Trust the Vite dev server**: In development, make maximum use of the Vite dev server's built-in capabilities. It can directly handle dependencies on other workspace-local packages and compile and hot-update them live from their **source files** (`src`).
    2.  **Avoid prebuilding and watching**: Therefore, when starting the main app's dev server, **do not** also run the `build --watch` task of its dependency libraries.
    3.  **Simplify parallel commands**: The dev command should only include the main app's dev server (such as `vite dev`) and other necessary backend services (such as `electron .`). Let a single Vite instance be fully responsible for compiling all frontend code.
- **Example (package.json)**:
  - **Bad example**: `concurrently "pnpm -F @ui watch" "pnpm -F @web dev"`
  - **Good example**: `concurrently "pnpm -F @web dev" "pnpm -F @desktop dev"` (assuming web is responsible for all UI and desktop is the backend)
- **Date recorded**: 2024-07-28

### Documentation Management
- [Management lesson] - [Tool usage] - [Efficiency gain] - [Date recorded]

---

## 📝 Usage Instructions

1. **Record promptly** - Record important lessons as soon as you encounter them
2. **Organize by category** - Organize content according to the categories above
3. **Review regularly** - Review once a week and extract reusable lessons
4. **Archive** - Archive related lessons to archives when a task is completed
