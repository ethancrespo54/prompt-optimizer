# TestArea Component System

A modular component system produced by the test area refactor, providing a unified AI prompt testing interface. It is a complete solution covering input, controls, result display, and more.

## Overview

The TestArea component system uses a modular architecture composed of the following core components:
- **TestAreaPanel** - Main container component that manages layout and state in a unified way
- **TestInputSection** - Test content input component
- **TestControlBar** - Test control bar component  
- **TestResultSection** - Test result display component
- **ConversationSection** - Conversation management wrapper component

## Key Features

✅ **Unified design style** - Based on the Naive UI design system to ensure visual consistency  
✅ **Responsive layout** - Automatically adapts to different screen sizes and device types  
✅ **Theme compatibility** - Fully compatible with light/dark theme switching  
✅ **Mode switching** - Supports system prompt / user prompt modes  
✅ **Comparison testing** - Supports side-by-side comparison of original vs optimized prompts  
✅ **Type safety** - Complete TypeScript type definitions  

## Quick Start

### Basic Usage

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
      <ModelSelectUI v-model="selectedModel" />
    </template>
  </TestAreaPanel>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { TestAreaPanel, ModelSelectUI } from '@prompt-optimizer/ui'
import type { OptimizationMode } from '@prompt-optimizer/core'

const optimizationMode = ref<OptimizationMode>('system')
const isTestRunning = ref(false)
const testContent = ref('')
const isCompareMode = ref(true)
const selectedModel = ref('gpt-4')

const handleCompareToggle = () => {
  isCompareMode.value = !isCompareMode.value
}

const handleTest = async () => {
  isTestRunning.value = true
  try {
    // Run the test logic
  } finally {
    isTestRunning.value = false
  }
}
</script>
```

### Advanced Configuration

```vue
<template>
  <TestAreaPanel
    :optimization-mode="optimizationMode"
    :is-test-running="isTestRunning"
    :advanced-mode-enabled="advancedModeEnabled"
    :test-content="testContent"
    :is-compare-mode="isCompareMode"
    :enable-compare-mode="enableCompareMode"
    :enable-fullscreen="true"
    :input-mode="inputMode"
    :control-bar-layout="controlBarLayout"
    :button-size="buttonSize"
    @update:test-content="testContent = $event"
    @compare-toggle="handleCompareToggle"
    @test="handleTest"
  >
    <!-- Model selection slot -->
    <template #model-select>
      <ModelSelectUI 
        v-model="selectedModel" 
        :size="buttonSize"
      />
    </template>
    
    <!-- Original result slot -->
    <template #original-result>
      <OutputDisplay :content="originalResult" />
    </template>
    
    <!-- Optimized result slot -->
    <template #optimized-result>
      <OutputDisplay :content="optimizedResult" />
    </template>
    
    <!-- Single result slot -->
    <template #single-result>
      <OutputDisplay :content="singleResult" />
    </template>
  </TestAreaPanel>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { 
  TestAreaPanel, 
  ModelSelectUI, 
  OutputDisplay,
  useResponsiveTestLayout 
} from '@prompt-optimizer/ui'

// Responsive layout configuration
const { 
  inputMode, 
  controlBarLayout, 
  buttonSize,
  isMobile 
} = useResponsiveTestLayout()

// State management
const optimizationMode = ref<OptimizationMode>('system')
const isTestRunning = ref(false)
const advancedModeEnabled = ref(false)
const testContent = ref('')
const isCompareMode = ref(true)
const selectedModel = ref('gpt-4')

// Result data
const originalResult = ref('')
const optimizedResult = ref('')
const singleResult = computed(() => optimizedResult.value)

// Dynamic configuration based on screen size
const enableCompareMode = computed(() => !isMobile.value)
</script>
```

## API Reference

### TestAreaPanel Props

| Prop | Type | Default | Description |
|--------|------|--------|------|
| `optimizationMode` | `OptimizationMode` | `'system'` | Optimization mode: 'system' or 'user' |
| `isTestRunning` | `boolean` | `false` | Whether a test is currently running |
| `advancedModeEnabled` | `boolean` | `false` | Whether advanced mode is enabled |
| `testContent` | `string` | `''` | Test content (v-model supported) |
| `isCompareMode` | `boolean` | `false` | Whether it is in compare mode |
| `enableCompareMode` | `boolean` | `true` | Whether switching to compare mode is allowed |
| `enableFullscreen` | `boolean` | `true` | Whether fullscreen editing is enabled |
| `inputMode` | `'default' \| 'compact'` | `'default'` | Input box display mode |
| `controlBarLayout` | `'default' \| 'compact'` | `'default'` | Control bar layout mode |
| `buttonSize` | `'small' \| 'medium' \| 'large'` | `'medium'` | Button size |

### TestAreaPanel Events

| Event | Parameters | Description |
|--------|------|------|
| `update:testContent` | `(value: string)` | Test content changed |
| `compare-toggle` | `()` | Compare mode toggled |
| `test` | `()` | Start the test |

### TestAreaPanel Slots

| Slot | Description | Example |
|--------|------|------|
| `model-select` | Model selection component | `<ModelSelectUI v-model="model" />` |
| `original-result` | Original test result display | `<OutputDisplay :content="result" />` |
| `optimized-result` | Optimized test result display | `<OutputDisplay :content="result" />` |
| `single-result` | Single mode result display | `<OutputDisplay :content="result" />` |

## Sub-component Reference

### TestInputSection

Test content input component with smart height adjustment and fullscreen editing.

```vue
<TestInputSection
  v-model="content"
  :label="inputLabel"
  :placeholder="placeholder"
  :disabled="disabled"
  :mode="inputMode"
  :enable-fullscreen="true"
/>
```

**Props:**
- `modelValue: string` - Input content
- `label: string` - Input box label
- `placeholder: string` - Placeholder text
- `helpText: string` - Help text
- `disabled: boolean` - Whether disabled
- `mode: 'default' | 'compact'` - Display mode
- `enableFullscreen: boolean` - Whether fullscreen is enabled

### TestControlBar

Test control bar component providing model selection and test control features.

```vue
<TestControlBar
  :model-label="t('test.model')"
  :show-compare-toggle="enableCompareMode"
  :is-compare-mode="isCompareMode"
  :primary-action-text="buttonText"
  :primary-action-disabled="!canTest"
  :primary-action-loading="isTestRunning"
  :layout="controlBarLayout"
  :button-size="buttonSize"
  @compare-toggle="$emit('compare-toggle')"
  @primary-action="$emit('primary-action')"
>
  <template #model-select>
    <slot name="model-select" />
  </template>
</TestControlBar>
```

### TestResultSection

Test result display component supporting compare mode and single mode layouts.

```vue
<TestResultSection
  :is-compare-mode="isCompareMode"
  :vertical-layout="verticalLayout"
  :show-original="showOriginal"
  :original-title="originalTitle"
  :optimized-title="optimizedTitle"
  :single-result-title="singleTitle"
>
  <template #original-result>
    <slot name="original-result" />
  </template>
  <template #optimized-result>
    <slot name="optimized-result" />
  </template>
  <template #single-result>
    <slot name="single-result" />
  </template>
</TestResultSection>
```

### ConversationSection

Conversation management wrapper component that controls the display of the conversation management panel in advanced mode.

```vue
<ConversationSection
  :visible="showConversation"
  :collapsible="true"
  :title="conversationTitle"
  :max-height="maxHeight"
>
  <ConversationManager v-model="conversations" />
</ConversationSection>
```

## Composables

### useResponsiveTestLayout

Responsive layout management hook that automatically adjusts component configuration based on screen size.

```ts
import { useResponsiveTestLayout } from '@prompt-optimizer/ui'

const {
  isMobile,           // Whether it is mobile
  isTablet,           // Whether it is a tablet
  currentBreakpoint,  // Current breakpoint
  inputMode,          // Recommended input mode
  controlBarLayout,   // Recommended control bar layout
  buttonSize,         // Recommended button size
  responsiveHeights   // Responsive height configuration
} = useResponsiveTestLayout()
```

### useTestModeConfig

Test mode configuration management hook that handles display logic under different optimization modes.

```ts
import { useTestModeConfig } from '@prompt-optimizer/ui'

const {
  currentModeConfig,      // Current mode configuration
  showTestInput,          // Whether to show the test input
  requiresTestContent,    // Whether test content is required
  inputLabel,             // Input box label
  canStartTest,           // Whether the test can start
  enableCompareMode,      // Whether compare mode is enabled
  showConversationManager, // Whether to show conversation management
  getDynamicButtonText,   // Get the dynamic button text
  validateTestSetup       // Validate the test setup
} = useTestModeConfig(optimizationMode)
```

## Style Guidelines

All TestArea components follow the [Test Area Component Style Guide](./test-area-style-guide.md):

- Use Naive UI design system components
- Hard-coded pixel values and Tailwind CSS classes are prohibited
- Unified spacing and text style system
- Complete responsive layout support
- Theme compatibility requirements

## Best Practices

### 1. Responsive Design

```vue
<script setup>
// Use the responsive layout hook
const { inputMode, controlBarLayout, buttonSize, isMobile } = useResponsiveTestLayout()

// Dynamically adjust features based on screen size
const enableAdvancedFeatures = computed(() => !isMobile.value)
</script>
```

### 2. State Management

```vue
<script setup>
// Manage test-related state centrally
const testState = reactive({
  mode: 'system' as OptimizationMode,
  content: '',
  isRunning: false,
  isCompareMode: true,
  results: {
    original: '',
    optimized: ''
  }
})

// Use computed properties for complex logic
const canStartTest = computed(() => {
  if (testState.mode === 'system') {
    return testState.content.length > 0
  }
  return true // User mode needs no extra input
})
</script>
```

### 3. Error Handling

```vue
<script setup>
const handleTest = async () => {
  testState.isRunning = true
  
  try {
    await promptService.testPromptStream(
      systemPrompt,
      userPrompt,
      selectedModel.value,
      {
        onToken: (token) => {
          // Handle streaming tokens
        },
        onComplete: () => {
          // Test complete
        },
        onError: (error) => {
          console.error('Test failed:', error)
          // Show an error message
        }
      }
    )
  } catch (error) {
    console.error('Test request failed:', error)
  } finally {
    testState.isRunning = false
  }
}
</script>
```

### 4. Internationalization Support

```vue
<template>
  <TestAreaPanel
    :optimization-mode="optimizationMode"
    <!-- Other props -->
  >
    <template #model-select>
      <ModelSelectUI 
        v-model="selectedModel"
        :placeholder="$t('common.selectModel')"
      />
    </template>
  </TestAreaPanel>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

// Dynamically compute the label text
const inputLabel = computed(() => {
  return optimizationMode.value === 'system' 
    ? t('test.content')
    : t('test.userPromptTest')
})
</script>
```

## Testing

### Unit Tests

The TestArea components have complete test coverage:

```bash
# Run component unit tests
pnpm -F @prompt-optimizer/ui test -- tests/unit/components/TestAreaPanel.spec.ts

# Run integration tests
pnpm -F @prompt-optimizer/ui test -- tests/unit/components/test-area-integration.spec.ts

# Run end-to-end tests
pnpm -F @prompt-optimizer/ui test -- tests/unit/components/test-area-e2e.spec.ts
```

### Test Cases

```ts
import { mount } from '@vue/test-utils'
import { TestAreaPanel } from '@prompt-optimizer/ui'

describe('TestAreaPanel', () => {
  it('should handle mode switching correctly', async () => {
    const wrapper = mount(TestAreaPanel, {
      props: {
        optimizationMode: 'system',
        testContent: 'Test content',
        isCompareMode: true
      }
    })

    // Verify the initial state
    expect(wrapper.find('[data-testid="test-input-section"]').exists()).toBe(true)
    
    // Switch to user mode
    await wrapper.setProps({ optimizationMode: 'user' })
    
    // Verify the state update
    expect(wrapper.find('[data-testid="test-input-section"]').exists()).toBe(false)
  })
})
```

## Troubleshooting

### Common Issues

**Q: The component styles look wrong?**  
A: Check that Naive UI's NConfigProvider is imported correctly and that the theme system is working.

**Q: The responsive layout does not take effect?**  
A: Confirm that the useResponsiveTestLayout hook is used and the layout configuration props are passed correctly.

**Q: The test feature does not work correctly?**  
A: Check that the services are injected correctly through the provide/inject mechanism and that promptService is available.

**Q: TypeScript type errors?**  
A: Confirm that the correct type definitions are imported, and check the version compatibility of @prompt-optimizer/core and @prompt-optimizer/ui.

### Debugging Tools

```vue
<script setup>
// Enable debugging in development mode
if (import.meta.env.DEV) {
  // Watch state changes
  watch(() => testState, (newState) => {
    console.log('TestArea state changed:', newState)
  }, { deep: true })
  
  // Expose the component state globally
  window.__testAreaDebug = {
    state: testState,
    config: useTestModeConfig(optimizationMode),
    layout: useResponsiveTestLayout()
  }
}
</script>
```

## Changelog

### v1.0.0 (2025-01-20)
- ✨ Initial release of the TestArea component system
- ✨ Supports system/user prompt modes
- ✨ Complete responsive layout system
- ✨ Comparison testing feature
- ✨ Theme compatibility
- ✨ Complete TypeScript type support

---

**Document last updated:** 2025-01-20  
**Component version:** v1.0.0  
**Compatibility:** Vue 3.x, Naive UI 2.x
