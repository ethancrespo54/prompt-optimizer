# Naive UI Refactored Components Documentation

## Overview

This document describes all core components refactored with Naive UI, including the newly added accessibility features, performance optimizations, and responsive support. All components comply with the WCAG 2.1 AA/AAA standards and provide complete keyboard navigation and screen reader support.

## Component Architecture

### Design Principles
- **SOLID**: Single responsibility, open/closed, Liskov substitution, interface segregation, dependency inversion
- **KISS**: Keep it simple and avoid overly complex designs
- **DRY**: Avoid duplicated code and unify common logic
- **YAGNI**: Only implement the features that are currently needed

### Tech Stack
- **Vue 3**: Composition API + TypeScript
- **Naive UI**: Modern component library
- **Accessibility**: WCAG 2.1 AA/AAA standards
- **Responsive**: Mobile-first design
- **Performance**: Virtualization, debounce/throttle, lazy loading

## Core Components

### 1. ContextEditor (Context Editor)

**Description**: A fully refactored context editor that provides message management, variable handling, and tool configuration.

**File location**: `packages/ui/src/components/ContextEditor.vue`

#### Props

```typescript
interface ContextEditorProps {
  /** Modal visibility */
  visible: boolean
  /** Context state data */
  state: ContextState
  /** Read-only mode */
  readonly?: boolean
  /** Custom style class name */
  customClass?: string
  /** Size */
  size?: 'small' | 'medium' | 'large'
  /** Globally available variables (used for variable resolution and preview) */
  availableVariables?: Record<string, string>
}

interface ContextState {
  /** Message list */
  messages: ConversationMessage[]
  /** Variable mapping */
  variables: Record<string, string>
  /** Tool configuration */
  tools: ToolConfig[]
  /** Show variable preview */
  showVariablePreview: boolean
  /** Show tool manager */
  showToolManager: boolean
  /** Edit mode */
  mode: 'edit' | 'preview'
}
```

#### Events

```typescript
interface ContextEditorEmits {
  /** Save context */
  save: (context: ContextState) => void
  /** Cancel editing */
  cancel: () => void
  /** Update visibility */
  'update:visible': (visible: boolean) => void
  /** Context state update */
  'update:state': (state: ContextState) => void
  /** Context content change */
  contextChange: (context: ContextState) => void
}
```

#### Slots

```vue
<template>
  <ContextEditor>
    <!-- Custom toolbar -->
    <template #toolbar>
      <NButton>Custom button</NButton>
    </template>
    
    <!-- Custom footer -->
    <template #footer>
      <div class="custom-footer">Custom content</div>
    </template>
  </ContextEditor>
</template>
```

#### Features

- **Multi-tab interface**: Three tabs: message editing, variable management, and tool configuration
- **Variable management**: Context-level variable overrides that do not affect global variables
- **Predefined variable protection**: Prevents overriding system predefined variables
- **Variable preview and missing detection**: Shows variable replacement results and missing variables in real time
- **Direct persistence**: Edits are saved in real time with no manual save needed
- **Import/export support**: Supports bulk import/export of context collections

#### Variables tab

The Variables tab is dedicated to managing context-level variable overrides:

1. **Variable list**: Shows the variable name, current value, source (override/global/predefined), and status
2. **Add/Edit**: Supports adding or modifying context variables, with automatic format validation and predefined-variable conflict checks
3. **Delete override**: After an override is deleted, it falls back to the global or predefined value
4. **Missing variable handling**: Clicking the missing variable button jumps straight to editing the context variable

#### Accessibility Features

- **ARIA**: Complete support for `role`, `aria-label`, and `aria-describedby`
- **Keyboard navigation**: Tab, Enter, Escape, and arrow key navigation
- **Screen reader**: Live status announcements and context change hints
- **Focus management**: Automatic focus trap and restoration

#### Usage Example

```vue
<template>
  <div>
    <NButton @click="showEditor = true">
      Open editor
    </NButton>
    
    <ContextEditor
      v-model:visible="showEditor"
      :state="contextState"
      :available-variables="availableVariables"
      @save="handleSave"
      @cancel="handleCancel"
      @update:state="handleStateUpdate"
      @contextChange="handleContextChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ContextEditor, type ContextState } from '@prompt-optimizer/ui'

const showEditor = ref(false)

// Context state data
const contextState = ref<ContextState>({
  messages: [
    { role: 'user', content: 'Hello {{name}}' },
    { role: 'assistant', content: 'Hi there!' }
  ],
  variables: { name: 'World' }, // Context override variables
  tools: [],
  showVariablePreview: true,
  showToolManager: true,
  mode: 'edit'
})

// Globally available variables (including predefined and global variables)
const availableVariables = ref<Record<string, string>>({
  currentDate: new Date().toISOString(),
  userName: 'Default User',
  // Other global variables...
})

const handleSave = (context: ContextState) => {
  console.log('Context saved:', context)
  showEditor.value = false
}

const handleCancel = () => {
  showEditor.value = false
}

const handleStateUpdate = (state: ContextState) => {
  console.log('State updated:', state)
  // Real-time persistence logic
}

const handleContextChange = (context: ContextState) => {
  console.log('Context changed:', context)
  // Context change handling logic
}
</script>
```

---

### 2. ToolCallDisplay (Tool Call Display)

**Description**: A collapsible panel component for displaying and managing tool call results.

**File location**: `packages/ui/src/components/ToolCallDisplay.vue`

#### Props

```typescript
interface ToolCallDisplayProps {
  /** Tool call list */
  toolCalls?: ToolCall[]
  /** Initial collapsed state */
  collapsed?: boolean
  /** Component size */
  size?: 'small' | 'medium' | 'large'
  /** Maximum display count */
  maxItems?: number
}

interface ToolCall {
  /** Call ID */
  id: string
  /** Tool name */
  name: string
  /** Call arguments */
  arguments?: Record<string, any>
  /** Call result */
  result?: any
  /** Error message */
  error?: string
  /** Call status */
  status: 'pending' | 'success' | 'error'
  /** Timestamp */
  timestamp: number
}
```

#### Features

- **Smart collapsing**: Automatically adjusts the display based on content length
- **Status indicators**: Visual distinction between success, failure, and pending states
- **JSON formatting**: Pretty-prints complex arguments and results
- **Error handling**: Gracefully handles circular references and invalid data
- **Performance optimization**: Virtual scrolling supports large amounts of data

#### Usage Example

```vue
<template>
  <ToolCallDisplay
    :tool-calls="toolCalls"
    :collapsed="false"
    size="medium"
    :max-items="50"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ToolCallDisplay, type ToolCall } from '@prompt-optimizer/ui'

const toolCalls = ref<ToolCall[]>([
  {
    id: 'call_1',
    name: 'get_weather',
    arguments: { location: 'Beijing', unit: 'celsius' },
    result: { temperature: 25, condition: 'sunny' },
    status: 'success',
    timestamp: Date.now()
  },
  {
    id: 'call_2',
    name: 'send_email',
    arguments: { to: 'user@example.com', subject: 'Test' },
    error: 'Network timeout',
    status: 'error',
    timestamp: Date.now()
  }
])
</script>
```

---

### 3. ScreenReaderSupport (Screen Reader Support)

**Description**: A component that provides enhanced support specifically for screen reader users.

**File location**: `packages/ui/src/components/ScreenReaderSupport.vue`

#### Props

```typescript
interface ScreenReaderSupportProps {
  /** Enhanced mode */
  enhanced?: boolean
  /** Show navigation help */
  showNavigationHelp?: boolean
  /** Show shortcut help */
  showShortcutHelp?: boolean
  /** Auto announcements */
  autoAnnounce?: boolean
}
```

#### Features

- **Live region**: `aria-live` region used for status update announcements
- **Shortcut support**: Global keyboard shortcut handling
- **Navigation hints**: Page structure and navigation help
- **Context awareness**: Provides relevant hints based on the current focus

#### Methods

```typescript
interface ScreenReaderSupportMethods {
  /** Send an announcement message */
  announce(message: string, priority: 'polite' | 'assertive'): void
  /** Show shortcut help */
  showShortcuts(): void
  /** Show navigation help */
  showNavigation(): void
}
```

#### Usage Example

```vue
<template>
  <div>
    <ScreenReaderSupport
      ref="screenReader"
      :enhanced="accessibilityMode"
      :show-navigation-help="showNav"
      :show-shortcut-help="showShortcuts"
      @shortcut="handleShortcut"
    />
    
    <NButton @click="notifyUser">
      Send announcement
    </NButton>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ScreenReaderSupport } from '@prompt-optimizer/ui'

const screenReader = ref<InstanceType<typeof ScreenReaderSupport>>()
const accessibilityMode = ref(false)
const showNav = ref(false)
const showShortcuts = ref(false)

const notifyUser = () => {
  screenReader.value?.announce('Operation complete', 'polite')
}

const handleShortcut = (key: string) => {
  console.log('Shortcut triggered:', key)
}
</script>
```

---

## Composables

### 1. useAccessibility (Accessibility Support)

**Description**: Provides comprehensive accessibility features, including keyboard navigation, ARIA management, and screen reader support.

**File location**: `packages/ui/src/composables/useAccessibility.ts`

#### API

```typescript
function useAccessibility(componentName?: string): {
  // Keyboard navigation
  keyboard: {
    handleKeyPress: (event: KeyboardEvent) => boolean
    setFocusableElements: (elements: HTMLElement[]) => void
    focusNext: () => void
    focusPrevious: () => void
    focusFirst: () => void
    focusLast: () => void
  }
  
  // ARIA label management
  aria: {
    getLabel: (key: string, fallback?: string) => string
    getDescription: (key: string, fallback?: string) => string
    getRole: (elementType: string) => string
    getLiveRegionText: (key: string) => string
  }
  
  // Message announcements
  announce: (message: string, priority?: 'polite' | 'assertive') => void
  
  // Focus management
  enableFocusTrap: () => void
  disableFocusTrap: () => void
  
  // Reactive state
  focusableElements: Ref<HTMLElement[]>
  currentFocusIndex: Ref<number>
  trapFocus: Ref<boolean>
  isAccessibilityMode: Ref<boolean>
  accessibilityClasses: Ref<Record<string, boolean>>
  liveRegionMessage: Ref<string>
  announcements: Ref<string[]>
  features: Ref<AccessibilityFeatures>
}

interface AccessibilityFeatures {
  reduceMotion: boolean
  highContrast: boolean
  screenReaderMode: boolean
  keyboardOnly: boolean
}
```

#### Usage Example

```vue
<template>
  <div :class="accessibilityClasses">
    <button
      v-for="(item, index) in items"
      :key="item.id"
      :aria-label="aria.getLabel('item', item.name)"
      @keydown="keyboard.handleKeyPress"
    >
      {{ item.name }}
    </button>
    
    <div
      role="status"
      aria-live="polite"
      class="sr-only"
    >
      {{ liveRegionMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useAccessibility } from '@prompt-optimizer/ui'

const items = ref([
  { id: 1, name: 'Item 1' },
  { id: 2, name: 'Item 2' },
  { id: 3, name: 'Item 3' }
])

const {
  keyboard,
  aria,
  announce,
  enableFocusTrap,
  disableFocusTrap,
  accessibilityClasses,
  liveRegionMessage
} = useAccessibility('MyComponent')

onMounted(() => {
  const buttons = document.querySelectorAll('button')
  keyboard.setFocusableElements(Array.from(buttons) as HTMLElement[])
  enableFocusTrap()
  
  announce('Component loaded', 'polite')
})
</script>
```

---

### 2. useFocusManager (Focus Management)

**Description**: A professional focus management system with support for focus traps, keyboard navigation, and automatic focus restoration.

**File location**: `packages/ui/src/composables/useFocusManager.ts`

#### API

```typescript
function useFocusManager(options: FocusManagerOptions = {}): {
  // Core methods
  trapFocus: () => Promise<void>
  releaseFocus: () => void
  moveFocusNext: () => boolean
  moveFocusPrevious: () => boolean
  focusFirstElement: () => boolean
  focusLastElement: () => boolean
  
  // Utility methods
  updateFocusableElements: () => HTMLElement[]
  isFocusable: (element: HTMLElement) => boolean
  
  // Reactive state
  focusableElements: Ref<HTMLElement[]>
  currentFocusIndex: Ref<number>
  isTrapped: Ref<boolean>
  lastFocusedElement: Ref<HTMLElement | null>
}

interface FocusManagerOptions {
  container?: string | HTMLElement
  autoTrap?: boolean
  restoreFocus?: boolean
  skipHidden?: boolean
}
```

#### Usage Example

```vue
<template>
  <div ref="containerRef" class="focus-container">
    <h2>Focus Management Example</h2>
    <NButton @click="trapFocus">Enable Focus Trap</NButton>
    <NButton @click="releaseFocus">Release Focus Trap</NButton>
    <NInput placeholder="Input 1" />
    <NInput placeholder="Input 2" />
    <NButton>Confirm</NButton>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useFocusManager } from '@prompt-optimizer/ui'

const containerRef = ref<HTMLElement>()

const {
  trapFocus,
  releaseFocus,
  moveFocusNext,
  moveFocusPrevious,
  focusableElements,
  currentFocusIndex,
  isTrapped
} = useFocusManager({
  container: containerRef,
  restoreFocus: true
})

onMounted(() => {
  // Listen for keyboard events
  document.addEventListener('keydown', (e) => {
    if (!isTrapped.value) return
    
    if (e.key === 'Tab') {
      e.preventDefault()
      if (e.shiftKey) {
        moveFocusPrevious()
      } else {
        moveFocusNext()
      }
    }
  })
})
</script>
```

---

### 3. useAccessibilityTesting (Accessibility Testing)

**Description**: A WCAG compliance automated testing tool for detecting and verifying accessibility issues.

**File location**: `packages/ui/src/composables/useAccessibilityTesting.ts`

#### API

```typescript
function useAccessibilityTesting(): {
  runTest: (options: TestOptions) => Promise<TestResult>
  runSingleRule: (rule: string, scope?: Element) => TestResult
  getAvailableRules: () => TestRule[]
}

interface TestOptions {
  scope?: Element
  wcagLevel?: 'A' | 'AA' | 'AAA'
  rules?: string[]
  includeWarnings?: boolean
}

interface TestResult {
  score: number
  issues: AccessibilityIssue[]
  warnings: AccessibilityIssue[]
  passedRules: string[]
  timestamp: number
}

interface AccessibilityIssue {
  rule: string
  severity: 'critical' | 'major' | 'minor'
  message: string
  element?: HTMLElement
  wcagLevel: 'A' | 'AA' | 'AAA'
}
```

#### Usage Example

```vue
<script setup lang="ts">
import { onMounted } from 'vue'
import { useAccessibilityTesting } from '@prompt-optimizer/ui'

const { runTest, runSingleRule } = useAccessibilityTesting()

onMounted(async () => {
  // Run the full test
  const result = await runTest({
    scope: document.body,
    wcagLevel: 'AA',
    includeWarnings: true
  })
  
  console.log('Accessibility test results:', result)
  
  if (result.score < 80) {
    console.warn('Accessibility score is low:', result.score)
    result.issues.forEach(issue => {
      console.error(`${issue.rule}: ${issue.message}`)
    })
  }
  
  // Test a single rule
  const imgAltResult = runSingleRule('img-alt')
  if (imgAltResult.issues.length > 0) {
    console.warn('Image is missing the alt attribute')
  }
})
</script>
```

---

## Style System

### CSS Class Naming Conventions

All components follow a unified CSS class naming convention:

```scss
// Base component class
.component-name {
  // Base styles
}

// State class
.component-name--state {
  // State styles
}

// Modifier class
.component-name__element {
  // Element styles
}

// Accessibility-related classes
.sr-only {
  // Visible to screen readers only
}

.keyboard-focus {
  // Keyboard focus styles
}

.accessibility-mode {
  // Accessibility mode styles
}
```

### Responsive Breakpoints

```scss
// Mobile
@media (max-width: 767px) {
  .responsive-mobile { /* styles */ }
}

// Tablet
@media (min-width: 768px) and (max-width: 1023px) {
  .responsive-tablet { /* styles */ }
}

// Desktop
@media (min-width: 1024px) {
  .responsive-desktop { /* styles */ }
}
```

---

## Performance Optimization

### 1. Lazy Loading and Code Splitting

```typescript
// Lazy-load components
const ContextEditor = defineAsyncComponent(
  () => import('./components/ContextEditor.vue')
)

// Route-level code splitting
const routes = [
  {
    path: '/editor',
    component: () => import('./pages/EditorPage.vue')
  }
]
```

### 2. Virtualization Support

```vue
<template>
  <!-- Virtual list for large amounts of data -->
  <VirtualList
    :items="largeDataset"
    :item-height="50"
    :visible-count="10"
  >
    <template #item="{ item }">
      <div class="virtual-item">{{ item.name }}</div>
    </template>
  </VirtualList>
</template>
```

### 3. Debouncing and Throttling

```typescript
import { useDebounceThrottle } from '@prompt-optimizer/ui'

const { debounce, throttle } = useDebounceThrottle()

// Debounce search input
const handleSearch = debounce((query: string) => {
  // Perform the search logic
}, 300)

// Throttle scroll events
const handleScroll = throttle(() => {
  // Handle the scroll logic
}, 16)
```

---

## Internationalization Support

### Language Configuration

```typescript
import { createI18n } from 'vue-i18n'
// Additional locales can be imported here
import enUS from './locales/en-US'

const i18n = createI18n({
  locale: 'en-US',
  fallbackLocale: 'en-US',
  messages: {
    'en-US': enUS
    // Additional locales can be registered here
  }
})
```

### Accessibility Text

```typescript
// en-US.ts
export default {
  accessibility: {
    labels: {
      contextEditor: 'Context editor',
      closeButton: 'Close button',
      saveButton: 'Save button'
    },
    descriptions: {
      contextEditor: 'Edit messages, variables, and tool configuration',
      navigationHelp: 'Use the Tab key to navigate between elements'
    },
    announcements: {
      saved: 'Content saved',
      loading: 'Loading',
      error: 'An error occurred, please try again'
    }
  }
}
```

---

## Testing Strategy

### 1. Unit Tests

```typescript
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ContextEditor from '../ContextEditor.vue'

describe('ContextEditor', () => {
  it('should render the basic structure correctly', () => {
    const wrapper = mount(ContextEditor, {
      props: {
        visible: true,
        state: {
          messages: [],
          variables: {},
          tools: []
        }
      }
    })
    
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
  })
})
```

### 2. Accessibility Tests

```typescript
import { useAccessibilityTesting } from '@prompt-optimizer/ui'

describe('Accessibility Tests', () => {
  it('should pass the WCAG AA standard', async () => {
    const { runTest } = useAccessibilityTesting()
    const result = await runTest({ wcagLevel: 'AA' })
    
    expect(result.score).toBeGreaterThan(80)
    expect(result.issues.filter(i => i.severity === 'critical')).toHaveLength(0)
  })
})
```

### 3. E2E Tests

```typescript
describe('End-to-end tests', () => {
  it('should support the complete user flow', async () => {
    // Test the complete user interaction flow
    await page.goto('/')
    await page.click('[data-testid="open-editor"]')
    await page.fill('[aria-label="Message input"]', 'Test content')
    await page.click('[aria-label="Save button"]')
    
    expect(await page.textContent('[role="status"]')).toContain('Saved successfully')
  })
})
```

---

## Deployment and Build

### 1. Build Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'PromptOptimizerUI',
      formats: ['es', 'cjs']
    },
    rollupOptions: {
      external: ['vue', 'naive-ui'],
      output: {
        globals: {
          vue: 'Vue',
          'naive-ui': 'NaiveUI'
        }
      }
    }
  }
})
```

### 2. Package Management

```json
{
  "name": "@prompt-optimizer/ui",
  "version": "1.0.0",
  "main": "dist/index.cjs",
  "module": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    },
    "./style": "./dist/style.css"
  }
}
```

---

## Best Practices

### 1. Component Development Guidelines

1. **Always use TypeScript**: Provides type safety and a better development experience
2. **Follow accessibility standards**: Make sure all components comply with WCAG 2.1 AA
3. **Write tests**: Unit tests, integration tests, and E2E test coverage
4. **Performance optimization**: Use virtualization, lazy loading, and debounce/throttle
5. **Responsive design**: Mobile first, adapting to different screen sizes

### 2. Code Style

```typescript
// Recommended component structure
<template>
  <div class="component-name" :class="componentClasses">
    <!-- Content -->
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAccessibility } from '../composables/useAccessibility'

// Props definition
interface Props {
  visible: boolean
  readonly?: boolean
}
const props = withDefaults(defineProps<Props>(), {
  readonly: false
})

// Emits definition
interface Emits {
  'update:visible': [visible: boolean]
}
const emit = defineEmits<Emits>()

// Accessibility support
const { accessibility } = useAccessibility('ComponentName')

// Reactive state
const localVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
})

// Computed properties
const componentClasses = computed(() => ({
  'component-name--readonly': props.readonly,
  ...accessibility.classes.value
}))
</script>

<style scoped>
.component-name {
  /* Base styles */
}

.component-name--readonly {
  /* Read-only state styles */
}
</style>
```

### 3. Accessibility Checklist

- [ ] All interactive elements have appropriate ARIA labels
- [ ] Keyboard navigation is complete
- [ ] Color contrast meets WCAG standards
- [ ] Screen reader compatibility tests pass
- [ ] Focus management is implemented correctly
- [ ] State changes have appropriate announcements

---

## Changelog

### v1.0.0 (2024-XX-XX)
- ✨ Completed the Naive UI refactor
- ✨ Added complete accessibility support
- ✨ Implemented responsive layout
- ✨ Added performance optimization features
- ✨ Complete TypeScript type support
- ✨ Internationalization support
- ✨ Complete test suite

---

## Feedback and Support

If you have questions or suggestions, please get in touch through the following:

- **GitHub Issues**: [Project repository](https://github.com/your-repo/prompt-optimizer)
- **Documentation updates**: Pull requests to improve the documentation are welcome
- **Feature requests**: Label them as Feature Request in Issues

---

*Last updated: XX/XX/2024*