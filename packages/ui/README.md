# @prompt-optimizer/ui

Vue 3 user interface component library for Prompt Optimizer, a modern collection of UI components built on the Naive UI design system.

## Features

✅ **Vue 3 + TypeScript** - Full type-safety support  
✅ **Built on Naive UI** - Based on a mature design system  
✅ **Theme system** - Seamless switching between light and dark themes  
✅ **Responsive design** - Automatically adapts to different screen sizes  
✅ **Internationalization support** - i18n-ready interface  
✅ **Modular architecture** - Components that can be used independently  

## Installation

```bash
pnpm add @prompt-optimizer/ui @prompt-optimizer/core naive-ui
```

## Quick Start

### Basic Setup

```typescript
import { createApp } from 'vue'
import { installI18n } from '@prompt-optimizer/ui'
import App from './App.vue'

const app = createApp(App)

// Install internationalization
installI18n(app)

app.mount('#app')
```

### Theme Configuration

```vue
<template>
  <NConfigProvider :theme="naiveTheme" :theme-overrides="themeOverrides">
    <NMessageProvider>
      <YourApp />
    </NMessageProvider>
  </NConfigProvider>
</template>

<script setup>
import { NConfigProvider, NMessageProvider } from 'naive-ui'
import { useNaiveTheme } from '@prompt-optimizer/ui'

const { naiveTheme, themeOverrides } = useNaiveTheme()
</script>
```

## Core Components

### TestArea Component System

A modern AI prompt testing interface that supports system/user prompt modes and comparison testing.

```vue
<template>
  <TestAreaPanel
    :optimization-mode="optimizationMode"
    :is-test-running="isTestRunning"
    :test-content="testContent"
    :is-compare-mode="isCompareMode"
    @update:test-content="testContent = $event"
    @compare-toggle="handleCompareToggle"
    @test="handleTest"
  >
    <template #model-select>
      <SelectWithConfig
        v-model="selectedModel"
        :options="modelOptions"
        :getPrimary="(o) => o.label"
        :getValue="(o) => o.value"
      />
    </template>
  </TestAreaPanel>
</template>
```

**Included components:**
- `TestAreaPanel` - Main container component
- `TestInputSection` - Test content input
- `TestControlBar` - Test control bar
- `TestResultSection` - Test result display
- `ConversationSection` - Conversation management wrapper

### Model Management

```vue
<template>
  <!-- Model selector -->
  <SelectWithConfig
    v-model="selectedModel"
    :options="modelOptions"
    :getPrimary="(o) => o.label"
    :getValue="(o) => o.value"
  />
  
  <!-- Model manager -->
  <ModelManagerUI @model-updated="handleModelUpdate" />
</template>
```

### Template System

```vue
<template>
  <!-- Template selector -->
  <TemplateSelectUI v-model="selectedTemplate" />
  
  <!-- Template manager -->
  <TemplateManagerUI @template-saved="handleTemplateSave" />
</template>
```

### Input and Output

```vue
<template>
  <!-- Input panel -->
  <InputPanelUI 
    v-model="inputContent"
    :placeholder="placeholder"
  />
  
  <!-- Output display -->
  <OutputDisplay 
    :content="outputContent"
    :enable-fullscreen="true"
  />
  
  <!-- Fullscreen output display -->
  <OutputDisplayFullscreen 
    v-model:visible="showFullscreen"
    :content="content"
  />
</template>
```

### Layout Components

```vue
<template>
  <!-- Main layout -->
  <MainLayoutUI>
    <template #header>
      <YourHeader />
    </template>
    <template #sidebar>
      <YourSidebar />
    </template>
    <YourContent />
  </MainLayoutUI>
  
  <!-- Content card -->
  <ContentCardUI :title="cardTitle">
    <YourContent />
  </ContentCardUI>
</template>
```

### Data Management

```vue
<template>
  <!-- Data manager -->
  <DataManagerUI 
    @data-imported="handleImport"
    @data-exported="handleExport"
  />
  
  <!-- Variable management -->
  <VariableManager 
    v-model="variables"
    @variable-updated="handleVariableUpdate"
  />
</template>
```

## Composables

### Theme Management

```typescript
import { useNaiveTheme } from '@prompt-optimizer/ui'

const {
  naiveTheme,       // Naive UI theme object
  themeOverrides,   // Theme override configuration
  currentTheme,     // Current theme ID
  switchTheme,      // Switch theme
  initTheme         // Initialize theme
} = useNaiveTheme()
```

### Responsive Layout

```typescript
import { useResponsiveTestLayout } from '@prompt-optimizer/ui'

const {
  isMobile,           // Whether it is a mobile device
  isTablet,           // Whether it is a tablet
  currentBreakpoint,  // Current breakpoint
  inputMode,          // Recommended input mode
  controlBarLayout,   // Recommended control bar layout
  buttonSize,         // Recommended button size
  responsiveHeights   // Responsive height configuration
} = useResponsiveTestLayout()
```

### Test Mode Configuration

```typescript
import { useTestModeConfig } from '@prompt-optimizer/ui'

const {
  showTestInput,          // Whether to show the test input
  requiresTestContent,    // Whether test content is required
  canStartTest,           // Whether the test can be started
  enableCompareMode,      // Whether to enable compare mode
  getDynamicButtonText,   // Get the dynamic button text
  validateTestSetup       // Validate the test setup
} = useTestModeConfig(optimizationMode)
```

## Component Exports

### UI Components

```typescript
// Core components
export { default as ToastUI } from './components/Toast.vue'
export { default as ModalUI } from './components/Modal.vue'
export { default as PanelUI } from './components/Panel.vue'

// Layout components
export { default as MainLayoutUI } from './components/MainLayout.vue'
export { default as ContentCardUI } from './components/ContentCard.vue'

// TestArea component system
export { default as TestAreaPanel } from './components/TestAreaPanel.vue'
export { default as TestInputSection } from './components/TestInputSection.vue'
export { default as TestControlBar } from './components/TestControlBar.vue'
export { default as TestResultSection } from './components/TestResultSection.vue'
export { default as ConversationSection } from './components/ConversationSection.vue'

// Input/output components
export { default as InputPanelUI } from './components/InputPanel.vue'
export { default as OutputDisplay } from './components/OutputDisplay.vue'
export { default as OutputDisplayFullscreen } from './components/OutputDisplayFullscreen.vue'
export { default as OutputDisplayCore } from './components/OutputDisplayCore.vue'

// Management components
export { default as ModelManagerUI } from './components/ModelManager.vue'
export { default as TemplateManagerUI } from './components/TemplateManager.vue'
export { default as TemplateSelectUI } from './components/TemplateSelect.vue'
export { default as DataManagerUI } from './components/DataManager.vue'
export { default as VariableManager } from './components/VariableManager.vue'
export { default as FunctionModelManagerUI } from './components/FunctionModelManager.vue'

// Feature components
export { default as ActionButtonUI } from './components/ActionButton.vue'
export { default as ThemeToggleUI } from './components/ThemeToggleUI.vue'
export { default as LanguageSwitchDropdown } from './components/LanguageSwitchDropdown.vue'
export { default as OptimizationModeSelectorUI } from './components/OptimizationModeSelector.vue'
export { default as TextDiffUI } from './components/TextDiff.vue'
export { default as MarkdownRenderer } from './components/MarkdownRenderer.vue'

// Advanced components
export { default as AdvancedTestPanel } from './components/AdvancedTestPanel.vue'
export { default as ConversationManager } from './components/ConversationManager.vue'
export { default as VariableEditor } from './components/VariableEditor.vue'
export { default as HistoryDrawerUI } from './components/HistoryDrawer.vue'
```

### Composables

```typescript
// Export all composables
export * from './composables'

// Main composables
export { useNaiveTheme } from './composables/useNaiveTheme'
export { useResponsiveTestLayout } from './composables/useResponsiveTestLayout'
export { useTestModeConfig } from './composables/useTestModeConfig'
```

### Theme System

```typescript
// Theme configuration
export { 
  currentNaiveTheme as naiveTheme,
  currentThemeOverrides as themeOverrides, 
  currentThemeId, 
  currentThemeConfig,
  naiveThemeConfigs,
  switchTheme,
  initializeNaiveTheme
} from './config/naive-theme'
```

### Internationalization

```typescript
// I18n system
export { 
  installI18n, 
  installI18nOnly, 
  initializeI18nWithStorage, 
  setI18nServices, 
  i18n 
} from './plugins/i18n'
```

## Type System

### Core Types

```typescript
import type { 
  OptimizationMode,
  ConversationMessage,
  Template,
  IModelManager,
  ITemplateManager,
  ILLMService,
  IPromptService
} from '@prompt-optimizer/core'

// TestArea component types
export interface TestAreaConfig {
  optimizationMode: OptimizationMode
  inputMode: 'default' | 'compact'
  controlBarLayout: 'default' | 'compact'
  buttonSize: 'small' | 'medium' | 'large'
}

export interface TestControlLayout {
  showCompareToggle: boolean
  primaryActionText: string
  buttonSize: string
}
```

## Style Guidelines

UI components follow strict design guidelines:

- **No hard-coded pixel values** - Use Naive UI's size system
- **No Tailwind CSS classes** - Implemented purely with Naive UI components
- **Unified spacing system** - Spacing guidelines based on a 16px baseline
- **Responsive design** - Supports the xs/sm/md/lg/xl/xxl breakpoints
- **Theme compatibility** - Fully compatible with light/dark themes

See: [Test Area Component Style Guide](../docs/components/test-area-style-guide.md)

## Development

### Local Development

```bash
# Install dependencies
pnpm install

# Development mode
pnpm dev

# Build the UI package
pnpm -F @prompt-optimizer/ui build

# Run tests
pnpm -F @prompt-optimizer/ui test

# Type check
pnpm -F @prompt-optimizer/ui exec tsc --noEmit
```

### Testing

```bash
# Run all tests
pnpm -F @prompt-optimizer/ui test

# Run tests for a specific component
pnpm -F @prompt-optimizer/ui test -- TestAreaPanel

# Run integration tests
pnpm -F @prompt-optimizer/ui test -- test-area-integration

# Run end-to-end tests  
pnpm -F @prompt-optimizer/ui test -- test-area-e2e
```

### Component Development Guide

1. **Use Naive UI components** - Based on NButton, NInput, NFlex, etc.
2. **Follow TypeScript conventions** - Complete type definitions
3. **Support theme switching** - Use theme variables instead of hard-coded colors
4. **Responsive design** - Adapt to different screen sizes
5. **Internationalization support** - Use i18n for all text
6. **Unit tests** - Write test cases for every component

## Dependencies

### Core Dependencies

- **Vue 3.x** - Progressive JavaScript framework
- **Naive UI 2.x** - Vue 3 design system component library
- **@prompt-optimizer/core** - Core business logic
- **Vue I18n** - Vue internationalization plugin

### Development Dependencies

- **TypeScript 5.x** - Type system
- **Vitest** - Unit testing framework
- **@vue/test-utils** - Vue component testing utilities
- **Vite** - Modern build tool

## Compatibility

- **Vue**: 3.0+
- **Node.js**: 18.0+
- **Browsers**: Chrome 88+, Firefox 85+, Safari 14+
- **Naive UI**: 2.34+

## License

GNU Affero General Public License v3.0 (AGPL-3.0-only)

## Documentation

- [Complete Component Documentation](../docs/components/test-area.md)
- [Style Guide](../docs/components/test-area-style-guide.md)
- [Developer Guide](../docs/developer/technical-development-guide.md)

---

**Last updated:** 2025-01-20  
**Version:** 1.4.4
