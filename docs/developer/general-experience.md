# General Project Experience Guide

This guide collects general lessons and best practices from project development, to quickly solve common problems and improve development efficiency.

> **Note**: Feature-specific lessons have been archived in the corresponding directories under `docs/archives/`.

## 📚 Archived Topic-Specific Lessons

- **Modal component lessons** → [106-template-management/modal-experience.md](../archives/106-template-management/modal-experience.md)
- **Layout system lessons** → [108-layout-system/experience.md](../archives/108-layout-system/experience.md)
- **Theme system lessons** → [109-theme-system/experience.md](../archives/109-theme-system/experience.md)
- **Composable architecture lessons** → [102-web-architecture-refactor/experience.md](../archives/102-web-architecture-refactor/experience.md)
- **Large-scale architecture refactoring lessons** → [117-import-export-architecture-refactor/experience.md](../archives/117-import-export-architecture-refactor/experience.md)
- **Version update system lessons** → [118-desktop-auto-update-system/experience.md](../archives/118-desktop-auto-update-system/experience.md)
- **MCP Server module development lessons** → [120-mcp-server-module/experience.md](../archives/120-mcp-server-module/experience.md)
- **Docker API proxy lessons** → [122-docker-api-proxy/experience.md](../archives/122-docker-api-proxy/experience.md)
- **Complete advanced feature implementation lessons** → [123-advanced-features-implementation/experience.md](../archives/123-advanced-features-implementation/experience.md)

## 🔧 General Development Conventions

### API Integration
```typescript
// Unified OpenAI-compatible format
const config = {
  baseURL: "https://api.provider.com/v1",
  models: ["model-name"],
  apiKey: import.meta.env.VITE_API_KEY // Must use Vite environment variables
};
```

**Core principles**:
- Separate business logic from API configuration
- Only pass parameters the user explicitly configured; set no default values
- Manage sensitive information through environment variables

### Error Handling
```typescript
try {
  await apiCall();
} catch (error) {
  console.error('[Service Error]', error); // Development log
  throw new Error('Operation failed, please try again later'); // User-friendly message
}
```

### Testing Conventions
```javascript
describe("Feature tests", () => {
  beforeEach(() => {
    testId = `test-${Date.now()}`; // Unique identifier to avoid conflicts
  });
  
  // LLM parameter tests: test each parameter independently
  it("should handle temperature parameter", async () => {
    await modelManager.updateModel(configKey, {
      llmParams: { temperature: 0.7 } // Test only one parameter
    });
  });
});
```

**Key points**:
- Use dynamic unique identifiers
- Create an independent test for each LLM parameter
- Cover exception scenarios
- Clean up test state correctly

### Vue Development Best Practices

#### Attribute Inheritance for Multi-Root Components
**Problem**: When a Vue component has multiple root nodes, it cannot automatically inherit non-prop attributes (such as `class`) passed from the parent, and a warning is produced.

**Solution**:
1. Use `defineOptions({ inheritAttrs: false })` in `<script setup>` to disable the default attribute inheritance behavior
2. In the template, manually bind `v-bind="$attrs"` to the **specific** root node you want to receive these attributes

**Example**:
```
<template>
  <!-- $attrs applies class, id, and other attributes to this component -->
  <OutputDisplayCore v-bind="$attrs" ... />
  <OutputDisplayFullscreen ... />
</template>

<script setup>
defineOptions({
  inheritAttrs: false,
});
</script>
```

#### Event Propagation Mechanism for Deeply Nested Components
**Problem**: When a global state change needs to notify components nested across multiple levels, event propagation may be interrupted, so deep components cannot update in time.

**Typical scenarios**:
- After switching languages, the main UI components update correctly, but components inside a Modal show the old state
- Component hierarchy difference: `App.vue → ComponentA` (direct reference) vs `App.vue → ComponentB → ComponentC` (indirect reference)

**Root causes**:
1. **v-if conditional rendering**: Once a component is destroyed, its ref becomes invalid and the component's methods cannot be called
2. **Event propagation breakpoints**: Events only propagate to direct child components and do not automatically propagate down to deep components
3. **Component lifecycle differences**: Components at different levels may be in different lifecycle stages

**Solutions**:
1. **Use v-show instead of v-if**: Ensure the component instance always exists so the ref stays valid
   ```vue
   <!-- ❌ Problematic approach: the component gets destroyed -->
   <Modal v-if="showModal">
     <TemplateSelect ref="templateRef" />
   </Modal>
   
   <!-- ✅ Recommended approach: the component is always rendered -->
   <Modal v-show="showModal">
     <TemplateSelect ref="templateRef" />
   </Modal>
   ```

2. **Establish a complete event propagation chain**: From the event source to all consuming components
   ```javascript
   // Parent component: establish event propagation
   const handleGlobalStateChange = (newState) => {
     // Refresh the direct child component
     if (directChildRef.value?.refresh) {
       directChildRef.value.refresh()
     }
     
     // Refresh the deep component (through a method exposed by the intermediate component)
     if (intermediateRef.value?.refreshDeepChild) {
       intermediateRef.value.refreshDeepChild()
     }
   }
   
   // Intermediate component: expose the refresh method of the deep component
   const deepChildRef = ref()
   
   const refreshDeepChild = () => {
     if (deepChildRef.value?.refresh) {
       deepChildRef.value.refresh()
     }
   }
   
   defineExpose({
     refreshDeepChild
   })
   ```

3. **Unified refresh interface**: All related components expose the same refresh method
   ```javascript
   // Every component that needs to respond to global state changes implements a refresh method
   const refresh = () => {
     // Reload data or update state
   }
   
   defineExpose({
     refresh
   })
   ```

**Best practices**:
- **Architecture design**: Consider the complete path of event propagation during the design phase
- **Interface consistency**: Define a standard component refresh interface (such as a `refresh()` method)
- **Documentation**: Create a clear architecture diagram for complex event propagation chains
- **Test verification**: Ensure events propagate correctly in all usage scenarios

**Applicable scenarios**:
- Global theme switching
- Language switching
- User permission changes
- Template/configuration updates

> **Detailed case**: See [106-template-management/event-propagation-fix.md](../archives/106-template-management/event-propagation-fix.md)

## ⚡ Quick Troubleshooting

### Layout Issues
1. Check whether the Flex constraint chain is complete
2. Confirm that `min-h-0` has been added
3. Verify that the parent container is `display: flex`

### Scrolling Issues
1. Check for an incorrect `overflow` property on an intermediate layer
2. Confirm that the height constraint is passed down correctly from the top level
3. Verify that the scroll container has the correct `overflow-y: auto`

### Component State Synchronization Issues
1. **Deep component not updating**:
   - Check whether `v-if` is destroying the component
   - Confirm that the event propagation chain is complete (parent → intermediate → target component)
   - Verify that the target component exposes a refresh method

2. **Abnormal component state inside a Modal**:
   - Check whether the Modal uses `v-show` rather than `v-if`
   - Confirm that the component ref is still valid when the Modal is closed
   - Verify that global state change events propagate into the Modal

3. **Component ref call fails**:
   - Confirm that the component has finished mounting (`nextTick`)
   - Check whether conditional rendering causes the component not to exist
   - Verify that the component bound to the ref exposes the corresponding method

### API Call Issues
1. Check that environment variables are set correctly (`VITE_` prefix)
2. Confirm that default values are not being over-applied to parameters
3. Verify that error handling is user-friendly

### Test Failures
1. Check that test IDs are unique
2. Confirm that state is cleaned up correctly after tests
3. Verify that LLM parameter tests are independent

## 🔄 Version Management

### Version Sync
```json
// package.json
{
  "scripts": {
    "version": "pnpm run version:sync && git add -A"
  }
}
```
**Key point**: Use the `version` hook rather than `postversion`, to ensure synced files are included in the version commit.

### Template Management
- **Built-in templates**: Cannot be modified or exported
- **User templates**: Can be modified; a new ID is generated on import
- **Import rule**: Skip templates whose ID duplicates that of a built-in template

## 🚨 Key Bug-Fix Patterns

### Parameter Transparency
```typescript
// ❌ Wrong: automatically setting default values
if (!config.temperature) config.temperature = 0.7;

// ✅ Correct: only use parameters configured by the user
const requestConfig = {
  model: modelConfig.defaultModel,
  messages: formattedMessages,
  ...userLlmParams // Only pass parameters the user explicitly configured
};
```

### Safe Validation of Imported Data
```
// Whitelist validation + type checking
for (const [key, value] of Object.entries(importData)) {
  if (!ALLOWED_KEYS.includes(key)) {
    console.warn(`Skipping unknown configuration: ${key}`);
    continue;
  }
  if (typeof value !== 'string') {
    console.warn(`Skipping invalid type ${key}: ${typeof value}`);
    continue;
  }
  await storage.setItem(key, value);
}
```

### Internationalization (i18n) Key Synchronization
**Problem**: The `[intlify] Not found 'key' in 'locale' messages` error, usually caused by keys being out of sync between the language packs.

**Solution**: Create an automated script that compares the two language files and lists the differences.

## 📝 Documentation Update Conventions

When you encounter a new problem or find a better solution, update this document promptly:
1. Add the new lesson in the corresponding section
2. Update code examples
3. Record the fix date and the problem background
4. Keep the document concise and avoid overly detailed process descriptions

---

**Remember**: A good lessons-learned document should let team members quickly find a solution rather than stepping into the same pit again.

## 🎯 Vue Composables Design Lessons

### The Importance of the Singleton Pattern
**Problem scenario**: When multiple components use the same composable, if each call creates a new instance, state will go out of sync.

**Wrong implementation**:
```typescript
export function useUpdater() {
  const state = reactive({...})  // Creates a new instance on every call
  return { state, ... }
}
```

**Correct implementation**:
```
let globalUpdaterInstance: any = null

export function useUpdater() {
  if (globalUpdaterInstance) {
    return globalUpdaterInstance  // Return the existing instance
  }

  const state = reactive({...})
  const instance = { state, ... }
  globalUpdaterInstance = instance  // Cache the instance
  return instance
}
```

**Criterion**: If multiple components need to access the same state, use the singleton pattern.

**Common scenarios that need a singleton**:
- Global state management (such as update status, user settings)
- Modal state
- Notification system

### Debugging Strategy
- **Log-driven debugging**: Confirm the state at each step through detailed logs
- **Layered verification**: Verify the data layer first, then the UI layer
- **Avoid over-engineering**: Don't add complex patches just to solve a problem

## 🏗️ General Lessons from Architecture Refactoring

### Large-Scale Refactoring Strategy
**Principles of incremental refactoring**:
1. **Interface first** - Design the interface first, then implement the functionality
2. **Phased execution** - Maintain functional continuity and avoid breaking changes
3. **Test protection** - Every phase must have test coverage
4. **Documentation in sync** - Update documentation while refactoring

### Distributed Architecture Design
**Core principles**:
- Single responsibility: each service is only responsible for its own data
- Unified interface: all services implement the same interface
- Loose coupling: services interact through interfaces
- Extensible: a new service only needs to implement the interface

### Storage Abstraction Design
**Avoid abstraction leaks**:
- Encapsulate storage details in the service layer
- Expose logical key names externally
- Establish clear abstraction boundaries
- Document the dual purpose of storage keys

### AI Automated Testing
**Applying MCP tools**:
- Use browser automation to verify real user scenarios
- Establish repeatable test cases
- Verify architectural consistency and data integrity
- Improve test coverage and reliability

> For detailed lessons, see: [117-import-export-architecture-refactor](../archives/117-import-export-architecture-refactor/)

## Node.js Application Development Lessons

### Environment Variable Management
- **Load timing is critical**: Environment variables must be loaded into `process.env` before any module is imported
- **Node.js `-r` flag**: The most reliable way to preload a script before the module system initializes
- **Path resolution**: Consider different working directories and deployment scenarios, and support multi-path lookup

### Using Build Tools
- **Separate the entry file**: The entry file should only export and not execute any code with side effects
- **Independent startup file**: Use a separate startup file responsible for running the main logic
- **Avoid build side effects**: Ensure the build process does not execute any code with side effects

### Windows Compatibility
- **Avoid complex process management**: Don't use complex process management tools like concurrently
- **Separate build and start**: Use separate build and start flows
- **Simple npm scripts**: Use simple npm scripts instead of complex command combinations

## Architecture Design Lessons

### Adapter Pattern
- **Decoupling**: Use the adapter pattern to decouple different systems
- **Extensibility**: The adapter pattern makes it easy to add new adapters to support more features
- **Maintainability**: Each adapter has a single responsibility, making it easy to maintain

### Stateless Design
- **Simplified deployment**: Stateless design simplifies the deployment process
- **Improved reliability**: Avoids state inconsistency problems
- **Easy to test**: Each test runs in a fresh environment

Related archives:
- [120-mcp-server-module](../archives/120-mcp-server-module/) - MCP Server module development

## 🖥️ Node.js Environment Development Lessons

### Environment Variable Load Timing
**Problem**: Node.js environment variables must be loaded before modules are imported, otherwise they can't be read when modules initialize
```bash
# ✅ Correct: preload using the -r flag
node -r ./preload-env.js dist/index.js

# ❌ Wrong: loading environment variables after modules are imported
node dist/index.js  # Environment variables may not be loaded at this point
```

**Solutions**:
1. Create a preload script that supports multi-path lookup
2. Handle environment variable loading uniformly in the startup script
3. Support silent loading to avoid errors when the configuration file is not found

### Controlling Build-Time Side Effects
**Problem**: When a build tool (such as tsup) executes module-level code, it can cause the server to start unexpectedly
```typescript
// ❌ Wrong: the entry file executes directly
import { startServer } from './server'
startServer() // Gets executed at build time

// ✅ Correct: separate exporting from execution
export { startServer } from './server'
// Use a separate startup file to run the main logic
```

### Windows Process Management
**Problem**: On Windows, process management tools such as concurrently have signal handling problems
```json
// ❌ Avoid: complex process management
"scripts": {
  "dev": "concurrently \"npm run build:watch\" \"npm run start\""
}

// ✅ Recommended: simple separate scripts
"scripts": {
  "build": "tsup",
  "start": "node dist/index.js",
  "dev": "npm run build && npm run start"
}
```

## 📝 Usage Instructions

1. **Finding lessons**: First check the archived topic-specific lessons, then the general conventions
2. **Applying practices**: Choose the appropriate solution for the specific scenario
3. **Continuous updates**: Add new general lessons to this document as you discover them
4. **Avoid duplication**: Feature-specific lessons should be archived in the corresponding archives directory
