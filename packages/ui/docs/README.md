# Naive UI Refactored Components Usage Guide

## Quick Start

### Installation

```bash
# Install with pnpm (recommended)
pnpm add @prompt-optimizer/ui

# Or install with npm
npm install @prompt-optimizer/ui
```

### Basic Usage

```vue
<template>
  <div>
    <!-- Context editor -->
    <ContextEditor
      v-model:visible="showEditor"
      :state="contextState"
      @save="handleSave"
    />
    
    <!-- Tool call display -->
    <ToolCallDisplay
      :tool-calls="toolCalls"
      :collapsed="false"
    />
    
    <!-- Accessibility support - using the composable approach -->
    <!-- The <ScreenReaderSupport> component has been removed, please use useAccessibility -->
    <!--
    <ScreenReaderSupport
      :enhanced="true" 
      :show-navigation-help="true"
    />
    -->
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
  ContextEditor,
  ToolCallDisplay,
  // ScreenReaderSupport, // Removed, use the useAccessibility composable
  useAccessibility,
  type ContextState,
  type ToolCall
} from '@prompt-optimizer/ui'

// Import styles
import '@prompt-optimizer/ui/dist/style.css'

// Context state
const showEditor = ref(false)
const contextState = ref<ContextState>({
  messages: [
    { role: 'user', content: 'Hello World' }
  ],
  variables: {},
  tools: [],
  showVariablePreview: true,
  showToolManager: true,
  mode: 'edit'
})

// Tool call data
const toolCalls = ref<ToolCall[]>([
  {
    id: 'call_1',
    name: 'get_weather',
    arguments: { location: 'Beijing' },
    result: { temperature: 25 },
    status: 'success',
    timestamp: Date.now()
  }
])

// Accessibility support
const { announce } = useAccessibility('MyApp')

const handleSave = (context: ContextState) => {
  console.log('Context saved:', context)
  announce('Context saved', 'polite')
  showEditor.value = false
}
</script>
```

## Key Features

### 🎯 Complete Accessibility Support
- WCAG 2.1 AA/AAA compliance
- Complete keyboard navigation
- Screen reader optimization
- High contrast mode support

### 📱 Responsive Design
- Mobile first
- Adaptive layout
- Touch-friendly interactions

### ⚡ Performance Optimization
- Virtual scrolling
- Lazy loading
- Debounce and throttle
- Code splitting

### 🌍 Internationalization Support
- Language switching
- Localized formats
- RTL language support

## Component Overview

| Component | Purpose | Key Features |
|--------|------|----------|
| `ContextEditor` | Context editing | Message management, variable handling, tool configuration |
| `ToolCallDisplay` | Tool call display | Collapsible panel, status display, error handling |
| `ScreenReaderSupport` | Screen reader support | Live announcements, keyboard shortcuts, navigation hints |

## Composables

| Function | Purpose | Returns |
|--------|------|--------|
| `useAccessibility` | Accessibility support | Keyboard navigation, ARIA management, message announcements |
| `useFocusManager` | Focus management | Focus trap, keyboard navigation, automatic restoration |
| `useAccessibilityTesting` | Accessibility testing | WCAG compliance checks, issue reports |

## Best Practices

### 1. Accessibility First

```vue
<template>
  <div>
    <!-- ✅ Correct: provide an ARIA label -->
    <button
      :aria-label="aria.getLabel('save', 'Save')"
      @click="handleSave"
    >
      Save
    </button>
    
    <!-- ❌ Wrong: missing semantic label -->
    <div @click="handleSave">Save</div>
  </div>
</template>

<script setup lang="ts">
import { useAccessibility } from '@prompt-optimizer/ui'

const { aria, announce } = useAccessibility('MyComponent')

const handleSave = () => {
  // Save logic
  announce('Content saved', 'polite')
}
</script>
```

### 2. Responsive Design

```vue
<template>
  <div class="responsive-container">
    <!-- Use responsive component props -->
    <ContextEditor
      v-model:visible="showEditor"
      :size="isMobile ? 'small' : 'large'"
      :state="contextState"
    />
  </div>
</template>

<script setup lang="ts">
import { useResponsive } from '@prompt-optimizer/ui'

const { isMobile, isTablet, modalWidth } = useResponsive()
</script>

<style scoped>
.responsive-container {
  /* Mobile */
  @media (max-width: 767px) {
    padding: 8px;
  }
  
  /* Desktop */
  @media (min-width: 1024px) {
    padding: 24px;
  }
}
</style>
```

### 3. Performance Optimization

```vue
<template>
  <div>
    <!-- Use virtual scrolling for large amounts of data -->
    <ToolCallDisplay
      :tool-calls="largeDataset"
      :max-items="100"
      virtual-scroll
    />
    
    <!-- Use debounced search -->
    <NInput
      :value="searchQuery"
      @input="debouncedSearch"
      placeholder="Search..."
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useDebounceThrottle } from '@prompt-optimizer/ui'

const { debounce } = useDebounceThrottle()
const searchQuery = ref('')
const largeDataset = ref([]) // Assume a large amount of data

const handleSearch = (query: string) => {
  // Perform the search logic
  console.log('Search:', query)
}

const debouncedSearch = debounce((value: string) => {
  searchQuery.value = value
  handleSearch(value)
}, 300)
</script>
```

## FAQ

### Q: How do I enable accessibility mode?

A: Use the `useAccessibility` composable:

```typescript
const { isAccessibilityMode } = useAccessibility()

// Detect automatically or enable manually
isAccessibilityMode.value = true
```

### Q: How do I handle performance problems with large amounts of data?

A: Use virtualization and pagination:

```vue
<template>
  <ToolCallDisplay
    :tool-calls="paginatedData"
    virtual-scroll
    :max-items="50"
  />
</template>
```

### Q: How do I customize the theme?

A: Override the default theme with CSS variables:

```css
:root {
  --primary-color: #1890ff;
  --border-radius: 4px;
  --font-size: 14px;
}
```

### Q: How do I add internationalization support?

A: Configure the i18n instance:

```typescript
import { createI18n } from 'vue-i18n'

const i18n = createI18n({
  locale: 'en-US',
  messages: {
    'en-US': { /* English messages */ }
    // Add more locales here
  }
})
```

## Upgrade Guide

### Upgrading from the legacy components to the Naive UI version

1. **Update import statements**:
```typescript
// Old version
import ContextEditor from './components/ContextEditor.vue'

// New version
import { ContextEditor } from '@prompt-optimizer/ui'
```

2. **Update Props**:
```vue
<!-- Old version -->
<ContextEditor :dialogVisible="visible" />

<!-- New version -->
<ContextEditor v-model:visible="visible" />
```

3. **Add accessibility support**:
```vue
<template>
  <div>
    <ContextEditor v-model:visible="visible" />
    <ScreenReaderSupport enhanced />
  </div>
</template>
```

## Developer Tools

### TypeScript Support

Complete TypeScript type definitions:

```typescript
import type {
  ContextState,
  ToolCall,
  AccessibilityFeatures,
  FocusManagerOptions
} from '@prompt-optimizer/ui'
```

### Debugging During Development

Enable debug mode:

```typescript
import { setDebugMode } from '@prompt-optimizer/ui'

// Enable in the development environment
if (process.env.NODE_ENV === 'development') {
  setDebugMode(true)
}
```

### Testing Tools

Use the built-in testing tools:

```typescript
import { useAccessibilityTesting } from '@prompt-optimizer/ui'

const { runTest } = useAccessibilityTesting()

// Run accessibility tests
const result = await runTest({
  wcagLevel: 'AA',
  scope: document.body
})
```

## Contributing

Contributions and suggestions for improvement are welcome!

1. Fork the project repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Create a Pull Request

## Support

- 📖 [Complete API Documentation](./COMPONENT_API.md)
- 🐛 [Issue Tracker](https://github.com/your-repo/issues)
- 💬 [Discussions](https://github.com/your-repo/discussions)

---

*Last updated: XX/XX/2024*