# 📚 Comprehensive Index of Archived Documents

This index categorizes all archived documents by feature to help you quickly locate relevant content.

## 🏗️ Architecture Refactor Series

### Core architecture evolution
- **[101-singleton-refactor](./101-singleton-refactor/)** - Singleton pattern refactor
  - Remove the singleton pattern from the project and switch to a dependency injection architecture
  - Improve code testability and maintainability
  - Lay the foundation for subsequent architecture refactors

- **[102-web-architecture-refactor](./102-web-architecture-refactor/)** - Web architecture refactor
  - Building on the singleton refactor, a comprehensive refactor of the web app and browser extension architecture
  - Adopt a unified Composable architecture
  - Fix the application startup failure

- **[103-desktop-architecture](./103-desktop-architecture/)** - Desktop architecture
  - Design and refactor of the desktop (Electron) architecture
  - Ensure consistency with the web architecture
  - Inter-process communication optimization

### Architecture fixes and optimizations
- **[111-electron-preference-architecture](./111-electron-preference-architecture/)** - Electron preference architecture
  - Electron PreferenceService architecture refactor
  - Race condition fixes
  - Cross-process state management optimization

- **[121-context-editor-refactor](./121-context-editor-refactor/)** - Context editor refactor 🆕
  - Clean up and optimize the component structure related to the context editor
  - Remove deprecated components (ConversationMessageEditor, ConversationSection)
  - API cleanup: remove unused props passing to improve code maintainability
  - A maintainability refactor with zero functional impact

## 🚀 Feature Development Series

### Core feature modules
- **[106-template-management](./106-template-management/)** - Template management feature
  - Template CRUD functionality
  - Async operation optimization
  - User experience improvements

- **[107-component-standardization](./107-component-standardization/)** - Component standardization refactor
  - Unify the behavior and API of all modal/dialog-type components
  - Establish a unified component API specification
  - Improve code consistency and maintainability

### Interface feature optimization
- **[104-test-panel-refactor](./104-test-panel-refactor/)** - Test panel refactor 📋
  - Test panel feature refactor and optimization
  - User experience improvements

- **[105-output-display-v2](./105-output-display-v2/)** - Output display v2 📋
  - Second-generation design of the output display feature
  - Performance and user experience optimization

## 🎨 System Optimization Series

### UI/UX systems
- **[108-layout-system](./108-layout-system/)** - Layout system lessons
  - Lessons from implementing dynamic Flex layout
  - Responsive design best practices
  - Layout system architecture summary

- **[109-theme-system](./109-theme-system/)** - Theme system development
  - Design and implementation of the theme system
  - Dynamic theme switching
  - Style management best practices

- **[122-naive-ui-migration](./122-naive-ui-migration/)** - Naive UI migration project 🎨
  - Full framework migration from Element Plus to Naive UI
  - Major theme system upgrade: 1 theme → 5 themes (light, dark, blue, green, purple)
  - Systematic evaluation of 26 tasks, successfully migrated over 8 months
  - Cross-platform compatibility maintained: Web (100%) + Desktop (95%) + Extension (95%)
  - Performance optimization: smaller build size, improved rendering performance
  - Established a complete methodology and best practices for UI framework migration

### State management systems
- **[117-pinia-refactoring](./117-pinia-refactoring/)** - Pinia state management refactor 🔄
  - Introduce the Pinia state management library and build a 6+1 session store architecture
  - Resolve session storage race conditions
  - Remove the deprecated `$services` plugin mechanism and unify service access
  - Joint review by Claude Code + Codex AI to ensure code quality

- **[129-session-store-single-source-refactor](./129-session-store-single-source-refactor/)** - Session Store single source of truth architecture refactor ⭐
  - Implement the Single Source of Truth principle
  - Resolve cross-mode state pollution and fix a P0 bug (test results not displayed)
  - Add an image storage service (ImageStorageService) using a separate IndexedDB
  - Optimize code splitting, reducing the main bundle by 57KB
  - Split monolithic components into fine-grained workspaces (Basic/Image modes)

- **[126-submode-persistence](./126-submode-persistence/)** - Submode persistence feature 💾
  - Implement independent submode state persistence for the three feature modes (basic/context/image)
  - Resolve state isolation, cross-page sync, and two-layer state consistency problems
  - Fix the bug where the file upload button was not displayed after refreshing in image mode
  - Establish complete state management best practices and design patterns

### Context mode (Pro)
- **[127-multi-turn-dialogue-mode-optimization](./127-multi-turn-dialogue-mode-optimization/)** - Multi-turn dialogue mode optimization 💬
  - Stable selection and mapping based on message IDs (avoiding index drift)
  - messageChainMap (message → work chain) reuse strategy and automatic application
  - Multi-turn dialogue (Pro-System / Conversation) experience and implementation record

### Context mode (UI/variables)
- **[128-context-ui-and-variable-system-refactor](./128-context-ui-and-variable-system-refactor/)** - Context UI rework and variable system refactor 🧩
  - Layout adjustments to the submode selector / quick action bar
  - Variable system simplification: remove session variables and introduce temporary variables in the test area
  - Archive of the task plan, design, and implementation records

## 🔧 Bug Fix Series

### Storage and data
- **[110-desktop-indexeddb-fix](./110-desktop-indexeddb-fix/)** - Desktop IndexedDB fix
  - Fix desktop IndexedDB compatibility problems
  - Improve data storage stability
  - Optimize the cross-platform storage solution

### Inter-process communication
- **[112-desktop-ipc-fixes](./112-desktop-ipc-fixes/)** - Collection of desktop IPC fixes
  - Fix the language switch button displaying "Object Promise"
  - Fix IPC serialization problems of Vue reactive objects
  - IPC architecture analysis and fixes
  - Unify cross-environment async interfaces
  - Standardize the preload.js architecture

- **[115-ipc-serialization-fixes](./115-ipc-serialization-fixes/)** - IPC serialization fixes and data consistency 🔄
  - Unified handling of IPC serialization of Vue reactive objects
  - Implementation of the safeSerialize function
  - Data consistency fixes in the business logic layer
  - Resolution of model data loss
  - Establishment of a dual protection mechanism

## ⚙️ Service Refactor Series

### Comprehensive refactor
- **[113-full-service-refactoring](./113-full-service-refactoring/)** - Full service refactor
  - Comprehensive refactor of the service layer architecture
  - Dependency injection optimization
  - Service interface standardization

- **[114-desktop-file-storage](./114-desktop-file-storage/)** - Desktop file storage implementation 💾
  - Implement FileStorageProvider to replace in-memory storage
  - Complete data persistence solution
  - High-performance file I/O and error recovery mechanisms
  - Enhanced data safety: smart recovery mechanism, backup protection, atomic operations

- **[116-desktop-packaging-optimization](./116-desktop-packaging-optimization/)** - Desktop application packaging optimization 📦
  - Change from portable mode to ZIP archive mode
  - Resolve the storage path detection problem
  - Simplify the code architecture and improve user experience

- **[119-csp-safe-template-processing](./119-csp-safe-template-processing/)** - CSP-safe template processing 🔒
  - Resolve template compilation failures caused by browser extension CSP restrictions
  - Implement an environment-adaptive template processing mechanism
  - Maintain cross-platform functional completeness and backward compatibility

## 🔍 Quick Lookup Guide

### Look up by problem type
- **Startup problems** → 102-web-architecture-refactor
- **Display anomalies** → 112-desktop-ipc-fixes
- **Storage problems** → 110-desktop-indexeddb-fix, 114-desktop-file-storage, 116-desktop-packaging-optimization
- **Data consistency problems** → 114-desktop-file-storage, 115-ipc-serialization-fixes
- **Serialization errors** → 112-desktop-ipc-fixes, 115-ipc-serialization-fixes
- **Application exit problems** → 114-desktop-file-storage
- **Language setting problems** → 112-desktop-ipc-fixes
- **Layout problems** → 108-layout-system
- **Theme problems** → 109-theme-system, 122-naive-ui-migration
- **UI library migration problems** → 122-naive-ui-migration
- **Template problems** → 106-template-management, 119-csp-safe-template-processing
- **Component problems** → 107-component-standardization, 121-context-editor-refactor
- **CSP security problems** → 119-csp-safe-template-processing
- **Browser extension problems** → 119-csp-safe-template-processing
- **Code cleanup and refactoring** → 121-context-editor-refactor
- **Cross-platform compatibility problems** → 122-naive-ui-migration
- **Performance optimization problems** → 122-naive-ui-migration
- **State persistence problems** → 126-submode-persistence
- **State synchronization problems** → 126-submode-persistence
- **State lost after refresh** → 126-submode-persistence

### Look up by technology stack
- **Electron-related** → 103, 110, 111, 112, 114
- **Vue/frontend-related** → 102, 104, 105, 107, 108, 109, 121, 122, 126
- **UI library-related** → 109, 122
- **Browser extension-related** → 119, 122
- **Architecture design-related** → 101, 102, 103, 111, 113, 121, 126
- **Service layer-related** → 101, 106, 113, 119
- **IPC communication-related** → 103, 111, 112
- **Template system-related** → 106, 119
- **Component refactor-related** → 107, 121
- **Theme system-related** → 109, 122
- **Performance optimization-related** → 122
- **State management-related** → 126

### Look up by development phase
- **Early project architecture** → 101, 102, 103
- **Feature development phase** → 104, 105, 106, 107, 126
- **Optimization and improvement phase** → 108, 109, 121, 122
- **Bug fixing phase** → 110, 111, 112, 114, 119, 126
- **Refactor and polish phase** → 113, 121, 122

### Look up by type of lessons
- **Architecture design lessons** → 101, 102, 103, 111, 121, 126
- **Feature development lessons** → 106, 107, 126
- **UI/UX design lessons** → 108, 109, 122
- **UI framework migration lessons** → 122
- **Troubleshooting lessons** → 110, 112, 114, 119, 126
- **Refactoring practice lessons** → 101, 113, 121, 122
- **Performance optimization lessons** → 122
- **State management lessons** → 126

## 📖 Usage Suggestions

### Learning path for newcomers
1. **Understand the architecture** → 101 → 102 → 103
2. **Learn feature development** → 106 → 107
3. **Master system optimization** → 108 → 109 → 122
4. **Learn troubleshooting** → 110 → 112 → 114
5. **UI framework migration** → 122 (complete methodology and best practices)

### Problem-solving path
1. **Determine the problem type** → See "Look up by problem type"
2. **Find the related documents** → Read the README for an overview
3. **Dive into technical details** → See experience.md and troubleshooting.md
4. **Apply the solution** → Refer to implementation.md

### Learning-from-experience path
1. **Pick an area of interest** → See "Look up by technology stack"
2. **Read in chronological order** → Understand the evolution
3. **Extract the key lessons** → Focus on experience.md
4. **Build a knowledge system** → Integrate the related lessons

---

**💡 Tip**: Each document contains complete background, implementation, and lessons learned; it is recommended to read selectively according to your actual needs.
