# Complete Accessibility Guide

## Overview

This document describes in detail the accessibility features of the Prompt Optimizer UI component library. Our components fully comply with the WCAG 2.1 AA/AAA standards and provide an equal experience for all users, including users with disabilities.

## Core Features

### 🎯 WCAG 2.1 Compliance
- **Level A**: Basic accessibility requirements
- **Level AA**: Recommended accessibility standard
- **Level AAA**: Highest level of accessibility support

### ⌨️ Keyboard Navigation
- Tab key cycles through navigation
- Enter key activates elements
- Escape key closes modals
- Arrow keys navigate lists and menus
- Home/End keys jump to the start/end

### 🔊 Screen Reader Support
- Complete ARIA label system
- Live region status announcements
- Semantic HTML structure
- Context-sensitive descriptions

### 👀 Visual Aids
- High contrast mode
- Adjustable font size
- Focus indicators
- Reduced motion option

## Detailed Feature Descriptions

### 1. useAccessibility Composable

This is the core of our accessibility features and provides complete accessibility support:

```typescript
import { useAccessibility } from '@prompt-optimizer/ui'

const {
  keyboard,      // Keyboard navigation
  aria,         // ARIA label management
  announce,     // Screen reader announcements
  features,     // Accessibility feature detection
  enableFocusTrap,  // Enable focus trap
  disableFocusTrap  // Disable focus trap
} = useAccessibility('MyComponent')
```

#### Keyboard Navigation Support

```vue
<template>
  <div @keydown="keyboard.handleKeyPress">
    <button
      v-for="(item, index) in items"
      :key="item.id"
      :tabindex="index === currentFocusIndex ? 0 : -1"
      @focus="currentFocusIndex = index"
    >
      {{ item.name }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAccessibility } from '@prompt-optimizer/ui'

const items = ref([
  { id: 1, name: 'Option 1' },
  { id: 2, name: 'Option 2' },
  { id: 3, name: 'Option 3' }
])

const {
  keyboard,
  currentFocusIndex,
  focusableElements
} = useAccessibility('MenuComponent')

onMounted(() => {
  // Set the focusable elements
  const buttons = document.querySelectorAll('button')
  keyboard.setFocusableElements(Array.from(buttons))
})
</script>
```

#### ARIA Label Management

```vue
<template>
  <div>
    <button
      :aria-label="aria.getLabel('save', 'Save button')"
      :aria-describedby="aria.getDescription('save', 'Save the content currently being edited')"
      role="button"
    >
      Save
    </button>
    
    <div
      role="status"
      :aria-live="aria.getLiveRegionText('status')"
      class="sr-only"
    >
      {{ statusMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAccessibility } from '@prompt-optimizer/ui'

const { aria, announce } = useAccessibility('SaveButton')
const statusMessage = ref('')

const handleSave = () => {
  statusMessage.value = 'Saving...'
  announce('Saving content', 'polite')
  
  // Simulate the save operation
  setTimeout(() => {
    statusMessage.value = 'Save complete'
    announce('Content saved successfully', 'polite')
  }, 1000)
}
</script>
```

### 2. Focus Management System

#### useFocusManager Composable

Professional focus management with support for focus traps and automatic restoration:

```vue
<template>
  <div ref="containerRef" class="modal">
    <h2>Modal title</h2>
    <input v-model="inputValue" placeholder="Enter content" />
    <div class="button-group">
      <button @click="confirm">Confirm</button>
      <button @click="cancel">Cancel</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useFocusManager } from '@prompt-optimizer/ui'

const containerRef = ref<HTMLElement>()
const inputValue = ref('')

const {
  trapFocus,
  releaseFocus,
  moveFocusNext,
  moveFocusPrevious,
  isTrapped
} = useFocusManager({
  container: containerRef,
  restoreFocus: true
})

onMounted(() => {
  // Automatically enable the focus trap
  trapFocus()
  
  // Listen for keyboard events
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  releaseFocus()
  document.removeEventListener('keydown', handleKeydown)
})

const handleKeydown = (e: KeyboardEvent) => {
  if (!isTrapped.value) return
  
  switch (e.key) {
    case 'Tab':
      e.preventDefault()
      if (e.shiftKey) {
        moveFocusPrevious()
      } else {
        moveFocusNext()
      }
      break
    case 'Escape':
      cancel()
      break
  }
}

const confirm = () => {
  console.log('Confirm:', inputValue.value)
  releaseFocus()
}

const cancel = () => {
  releaseFocus()
}
</script>
```

### 3. Screen Reader Support Components

#### ScreenReaderSupport Component

Provides enhanced support specifically for screen reader users:

```vue
<template>
  <div>
    <!-- Your app content -->
    <main role="main">
      <h1>App title</h1>
      <p>App content...</p>
    </main>
    
    <!-- Screen reader support component -->
    <ScreenReaderSupport
      ref="screenReader"
      :enhanced="true"
      :show-navigation-help="showNavHelp"
      :show-shortcut-help="showShortcutHelp"
      @shortcut="handleShortcut"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ScreenReaderSupport } from '@prompt-optimizer/ui'

const screenReader = ref<InstanceType<typeof ScreenReaderSupport>>()
const showNavHelp = ref(false)
const showShortcutHelp = ref(false)

const handleShortcut = (shortcut: string) => {
  switch (shortcut) {
    case 'Ctrl+/':
      showShortcutHelp.value = !showShortcutHelp.value
      break
    case 'Alt+H':
      showNavHelp.value = !showNavHelp.value
      break
    case 'Alt+S':
      // Jump to the search box
      document.querySelector('input[type="search"]')?.focus()
      break
  }
}

// Send an announcement to the screen reader
const notifyUser = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
  screenReader.value?.announce(message, priority)
}

// Send an announcement after the operation completes
const handleSave = () => {
  // Save logic
  notifyUser('Content saved')
}

const handleError = () => {
  // Error handling
  notifyUser('Save failed, please try again', 'assertive')
}
</script>
```

### 4. Accessibility Testing Tools

#### useAccessibilityTesting Composable

Automated accessibility compliance checks:

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useAccessibilityTesting } from '@prompt-optimizer/ui'

const testResults = ref<any>(null)
const isLoading = ref(false)

const { runTest, runSingleRule, getAvailableRules } = useAccessibilityTesting()

onMounted(async () => {
  await runAccessibilityTests()
})

const runAccessibilityTests = async () => {
  isLoading.value = true
  
  try {
    // Run the full accessibility test
    const result = await runTest({
      scope: document.body,
      wcagLevel: 'AA',
      includeWarnings: true
    })
    
    testResults.value = result
    
    // Report the results
    console.log('Accessibility test results:')
    console.log(`Overall score: ${result.score}`)
    console.log(`Passed rules: ${result.passedRules.length}`)
    console.log(`Issues found: ${result.issues.length}`)
    console.log(`Warnings: ${result.warnings.length}`)
    
    // Handle critical issues
    const criticalIssues = result.issues.filter(
      issue => issue.severity === 'critical'
    )
    
    if (criticalIssues.length > 0) {
      console.error('Critical accessibility issues found:')
      criticalIssues.forEach(issue => {
        console.error(`- ${issue.rule}: ${issue.message}`)
      })
    }
    
  } catch (error) {
    console.error('Accessibility test failed:', error)
  } finally {
    isLoading.value = false
  }
}

// Test a specific rule
const testImageAlt = () => {
  const result = runSingleRule('img-alt')
  if (result.issues.length > 0) {
    console.warn('Found images missing the alt attribute:')
    result.issues.forEach(issue => {
      console.warn(`- ${issue.message}`)
    })
  }
}

// Get all available test rules
const logAvailableRules = () => {
  const rules = getAvailableRules()
  console.log('Available test rules:')
  rules.forEach(rule => {
    console.log(`- ${rule.name} (${rule.wcagLevel}): ${rule.description}`)
  })
}
</script>
```

## Accessibility Best Practices

### 1. Semantic HTML

```vue
<template>
  <!-- ✅ Correct: use semantic tags -->
  <main role="main">
    <article>
      <header>
        <h1>Article title</h1>
        <p>Published: <time datetime="2024-01-01">January 1, 2024</time></p>
      </header>
      <section>
        <h2>Section title</h2>
        <p>Section content...</p>
      </section>
    </article>
  </main>
  
  <!-- ❌ Wrong: missing semantic tags -->
  <div>
    <div>Article title</div>
    <div>Article content</div>
  </div>
</template>
```

### 2. Using ARIA Labels

```vue
<template>
  <!-- ✅ Correct: complete ARIA labels -->
  <button
    role="button"
    aria-label="Save document"
    aria-describedby="save-help"
    :aria-pressed="isSaving"
    :disabled="isDisabled"
    @click="handleSave"
  >
    {{ isSaving ? 'Saving...' : 'Save' }}
  </button>
  <div id="save-help" class="sr-only">
    Save the document currently being edited to local storage
  </div>
  
  <!-- ❌ Wrong: missing ARIA labels -->
  <div @click="handleSave">Save</div>
</template>
```

### 3. Keyboard Navigation Support

```vue
<template>
  <!-- ✅ Correct: complete keyboard support -->
  <div
    role="tablist"
    @keydown="handleTabKeydown"
  >
    <button
      v-for="(tab, index) in tabs"
      :key="tab.id"
      role="tab"
      :aria-selected="activeTab === index"
      :tabindex="activeTab === index ? 0 : -1"
      @click="selectTab(index)"
      @focus="selectTab(index)"
    >
      {{ tab.title }}
    </button>
  </div>
  
  <div
    role="tabpanel"
    :aria-labelledby="`tab-${activeTab}`"
  >
    {{ tabs[activeTab]?.content }}
  </div>
</template>

<script setup lang="ts">
const handleTabKeydown = (e: KeyboardEvent) => {
  switch (e.key) {
    case 'ArrowRight':
      e.preventDefault()
      selectTab((activeTab.value + 1) % tabs.length)
      break
    case 'ArrowLeft':
      e.preventDefault()
      selectTab((activeTab.value - 1 + tabs.length) % tabs.length)
      break
    case 'Home':
      e.preventDefault()
      selectTab(0)
      break
    case 'End':
      e.preventDefault()
      selectTab(tabs.length - 1)
      break
  }
}
</script>
```

### 4. Live Status Announcements

```vue
<template>
  <div>
    <form @submit.prevent="handleSubmit">
      <input
        v-model="formData.name"
        :aria-invalid="errors.name ? 'true' : 'false'"
        aria-describedby="name-error"
        placeholder="Enter your name"
      />
      <div
        id="name-error"
        role="alert"
        class="error-message"
        v-show="errors.name"
      >
        {{ errors.name }}
      </div>
      
      <button type="submit" :disabled="isSubmitting">
        {{ isSubmitting ? 'Submitting...' : 'Submit' }}
      </button>
    </form>
    
    <!-- Live status region -->
    <div
      role="status"
      aria-live="polite"
      class="sr-only"
    >
      {{ statusMessage }}
    </div>
    
    <!-- Error announcement region -->
    <div
      role="alert"
      aria-live="assertive"
      class="sr-only"
    >
      {{ errorMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useAccessibility } from '@prompt-optimizer/ui'

const { announce } = useAccessibility('ContactForm')

const isSubmitting = ref(false)
const statusMessage = ref('')
const errorMessage = ref('')

const formData = reactive({
  name: ''
})

const errors = reactive({
  name: ''
})

const validateForm = () => {
  errors.name = formData.name ? '' : 'Name is required'
  return !errors.name
}

const handleSubmit = async () => {
  if (!validateForm()) {
    errorMessage.value = 'Please fix the form errors'
    announce('Form validation failed, please check your input', 'assertive')
    return
  }
  
  isSubmitting.value = true
  statusMessage.value = 'Submitting form...'
  announce('Submitting form', 'polite')
  
  try {
    // Simulate submission
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    statusMessage.value = 'Form submitted successfully'
    announce('Form submitted successfully', 'polite')
  } catch (error) {
    errorMessage.value = 'Submission failed, please try again'
    announce('Submission failed, please try again', 'assertive')
  } finally {
    isSubmitting.value = false
  }
}
</script>
```

## Styles and Visual Aids

### 1. Focus Indicators

```scss
// Highly visible focus indicator
.focus-visible {
  outline: 3px solid #005fcc;
  outline-offset: 2px;
  border-radius: 3px;
}

// Keyboard focus styles
*:focus-visible {
  @extend .focus-visible;
}

// Remove focus styles on mouse click
*:focus:not(:focus-visible) {
  outline: none;
}
```

### 2. High Contrast Support

```scss
// High contrast mode styles
@media (prefers-contrast: high) {
  :root {
    --text-color: #000000;
    --background-color: #ffffff;
    --border-color: #000000;
    --focus-color: #0000ff;
  }
  
  .button {
    border: 2px solid var(--border-color);
    background: var(--background-color);
    color: var(--text-color);
  }
  
  .button:focus {
    outline: 3px solid var(--focus-color);
  }
}
```

### 3. Reduced Motion Options

```scss
// Respect the user's motion preference
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

// Provide a smooth experience for users who want animation
@media (prefers-reduced-motion: no-preference) {
  .animated-element {
    transition: all 0.3s ease;
  }
}
```

## Testing Guide

### 1. Keyboard Navigation Tests

```typescript
// E2E test example
describe('Keyboard Navigation Tests', () => {
  it('should support Tab key navigation', async () => {
    const page = await browser.newPage()
    await page.goto('http://localhost:3000')
    
    // Simulate Tab key navigation
    await page.keyboard.press('Tab')
    const activeElement = await page.evaluate(() => document.activeElement?.tagName)
    expect(activeElement).toBe('BUTTON')
    
    // Simulate Enter key activation
    await page.keyboard.press('Enter')
    // Verify the result of the operation
  })
  
  it('should support arrow key navigation', async () => {
    await page.focus('[role="tablist"] [role="tab"]:first-child')
    await page.keyboard.press('ArrowRight')
    
    const activeTab = await page.evaluate(() => 
      document.activeElement?.getAttribute('aria-selected')
    )
    expect(activeTab).toBe('true')
  })
})
```

### 2. Screen Reader Tests

```typescript
describe('Screen reader support tests', () => {
  it('should include correct ARIA labels', async () => {
    const button = await page.$('button')
    const ariaLabel = await button?.getAttribute('aria-label')
    const role = await button?.getAttribute('role')
    
    expect(ariaLabel).toBeTruthy()
    expect(role).toBe('button')
  })
  
  it('should update the live region', async () => {
    await page.click('[data-testid="save-button"]')
    
    const liveRegion = await page.$('[role="status"]')
    const content = await liveRegion?.textContent()
    
    expect(content).toContain('Saved')
  })
})
```

## Common Problems and Solutions

### Q: How do I handle accessibility for dynamic content?

A: Use live regions and appropriate ARIA labels:

```vue
<template>
  <div>
    <button @click="loadData">Load data</button>
    
    <!-- Loading state -->
    <div
      v-if="isLoading"
      role="status"
      aria-live="polite"
    >
      Loading data...
    </div>
    
    <!-- Dynamic content -->
    <div
      v-if="data"
      role="region"
      :aria-label="`Search results, ${data.length} items`"
    >
      <div
        v-for="item in data"
        :key="item.id"
        role="listitem"
      >
        {{ item.name }}
      </div>
    </div>
  </div>
</template>
```

### Q: How do I handle accessibility for complex forms?

A: Use fieldsets, label associations, and error handling:

```vue
<template>
  <form @submit.prevent="handleSubmit">
    <fieldset>
      <legend>Basic information</legend>
      
      <div class="field">
        <label for="name">Name (required)</label>
        <input
          id="name"
          v-model="form.name"
          :aria-invalid="errors.name ? 'true' : 'false'"
          aria-describedby="name-help name-error"
          required
        />
        <div id="name-help" class="field-help">
          Please enter your real name
        </div>
        <div
          v-if="errors.name"
          id="name-error"
          role="alert"
          class="field-error"
        >
          {{ errors.name }}
        </div>
      </div>
    </fieldset>
  </form>
</template>
```

### Q: How do I ensure accessibility of third-party components?

A: Wrap the third-party component and add accessibility support:

```vue
<template>
  <div class="accessible-wrapper">
    <!-- Add ARIA labels to the third-party component -->
    <div
      role="application"
      :aria-label="aria.getLabel('chart', 'Data chart')"
      aria-describedby="chart-description"
    >
      <ThirdPartyChart v-bind="chartProps" />
    </div>
    
    <div id="chart-description" class="sr-only">
      {{ chartDescription }}
    </div>
    
    <!-- Provide a data table alternative for charts that screen readers cannot read -->
    <details class="chart-alternative">
      <summary>View chart data table</summary>
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in chartData" :key="item.id">
            <td>{{ item.category }}</td>
            <td>{{ item.value }}</td>
          </tr>
        </tbody>
      </table>
    </details>
  </div>
</template>
```

---

*This document will be continuously updated to cover the latest accessibility best practices and features.*