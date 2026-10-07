# E2E Test Selector Strategy Optimization Plan

## Problem Analysis

### Current Problems
1. **Reliance on text content**: Affected by internationalization, requiring maintenance of multi-language regular expressions
2. **Ambiguous button location**: A page may have multiple buttons with the same name
3. **Fragile XPath**: Component structure changes cause failures
4. **Different UI per mode**: The Basic/Pro/Image modes have completely different interface structures

### Example: Current Locating Approach
```typescript
// ❌ Problem 1: relies on text
page.getByText(/Original Prompt/i)

// ❌ Problem 2: may match multiple buttons
page.getByRole('button', { name: /^Analyze$/i })

// ❌ Problem 3: fragile XPath
title.locator('xpath=ancestor::*[contains(@class,"n-card")][1]')
```

---

## Solution: Use the `data-testid` Attribute

### Overview
Add `data-testid` attributes to key UI elements to provide stable, language-independent locator identifiers.

### Implementation Steps

#### Step 1: Add `data-testid` to components

**Naming convention**:
```
data-testid="{mode}-{feature}-{element-type}"
```

**Examples**:
- `basic-system-input-panel` - Input panel of Basic System mode
- `basic-system-analyze-button` - Analyze button of Basic System mode
- `basic-user-analyze-button` - Analyze button of Basic User mode
- `pro-multi-message-list` - Message list of Pro Multi mode
- `evaluation-score-badge` - Evaluation score badge (shared)

---

#### Step 2: Modify component code

##### 2.1 InputPanel.vue

Add `data-testid` to the key buttons in `InputPanel.vue`:

```vue
<template>
  <NSpace vertical :size="16" :data-testid="testIdPrefix + '-input-panel'">
    <!-- Title area -->
    <NFlex justify="space-between" align="center" :wrap="false">
      <NText :data-testid="testIdPrefix + '-input-label'">{{ label }}</NText>

      <!-- AI variable extraction button -->
      <NButton
        v-if="enableVariableExtraction && showExtractButton"
        :data-testid="testIdPrefix + '-extract-variables-button'"
        @click="$emit('extract-variables')"
      >
        ...
      </NButton>

      <!-- Preview button -->
      <NButton
        v-if="showPreview"
        :data-testid="testIdPrefix + '-preview-button'"
        @click="$emit('open-preview')"
      >
        ...
      </NButton>
    </NFlex>

    <!-- Input box -->
    <VariableAwareInput
      v-if="enableVariableExtraction"
      :data-testid="testIdPrefix + '-input'"
      ...
    />
    <NInput
      v-else
      :data-testid="testIdPrefix + '-input'"
      ...
    />

    <!-- Action buttons area -->
    <NSpace>
      <!-- Analyze button -->
      <NButton
        v-if="showAnalyzeButton"
        :data-testid="testIdPrefix + '-analyze-button'"
        @click="$emit('analyze')"
        :loading="analyzeLoading"
      >
        {{ $t('promptOptimizer.analyze') }}
      </NButton>

      <!-- Optimize button -->
      <NButton
        :data-testid="testIdPrefix + '-optimize-button'"
        @click="$emit('optimize')"
        :loading="optimizeLoading"
      >
        {{ $t('promptOptimizer.optimize') }}
      </NButton>
    </NSpace>
  </NSpace>
</template>

<script setup lang="ts">
interface Props {
  // ... existing props
  /** 🆕 Test ID prefix (used to distinguish different modes) */
  testIdPrefix?: string
}

const props = withDefaults(defineProps<Props>(), {
  // ... existing defaults
  testIdPrefix: 'input-panel'
})
</script>
```

##### 2.2 BasicSystemWorkspace.vue

Pass `testIdPrefix` in the workspace:

```vue
<template>
  <div data-testid="basic-system-workspace">
    <InputPanelUI
      v-model="promptModel"
      test-id-prefix="basic-system"
      :show-analyze-button="true"
      @analyze="handleAnalyze"
    />

    <!-- Evaluation score badge -->
    <EvaluationScoreBadge
      data-testid="basic-system-score-badge"
      :score="evaluationScore"
    />
  </div>
</template>
```

##### 2.3 BasicUserWorkspace.vue

```vue
<template>
  <div data-testid="basic-user-workspace">
    <InputPanelUI
      v-model="promptModel"
      test-id-prefix="basic-user"
      :show-analyze-button="true"
      @analyze="handleAnalyze"
    />

    <EvaluationScoreBadge
      data-testid="basic-user-score-badge"
      :score="evaluationScore"
    />
  </div>
</template>
```

##### 2.4 EvaluationScoreBadge.vue

```vue
<template>
  <div
    class="evaluation-score-badge"
    :class="[sizeClass, levelClass, { clickable: !loading, loading }]"
    data-testid="evaluation-score-badge"
  >
    <template v-if="loading">
      <NSpin :size="spinSize" data-testid="score-loading" />
    </template>
    <template v-else-if="score !== null && score !== undefined">
      <span
        class="score-value"
        data-testid="score-value"
      >{{ score }}</span>
    </template>
  </div>
</template>
```

---

#### Step 3: Update test helper functions

##### 3.1 helpers/analysis.ts

```typescript
import { expect, type Page } from '@playwright/test'

/**
 * Fill in the original prompt (using data-testid)
 * @param page Playwright Page object
 * @param mode Mode prefix (e.g. 'basic-system', 'basic-user')
 * @param value Prompt content
 */
export async function fillOriginalPrompt(
  page: Page,
  mode: string,
  value: string
): Promise<void> {
  const input = page.locator(`[data-testid="${mode}-input"]`)
  await expect(input).toBeVisible({ timeout: 15000 })

  // Check whether it is CodeMirror
  const cmContent = input.locator('.cm-content')
  if ((await cmContent.count()) > 0) {
    await cmContent.click()
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
    await page.keyboard.type(value)
  } else {
    await input.fill(value)
  }

  // Wait for the button to be enabled
  const analyzeButton = page.locator(`[data-testid="${mode}-analyze-button"]`)
  await expect(analyzeButton).toBeEnabled({ timeout: 15000 })
}

/**
 * Click the analyze button (using data-testid)
 * @param page Playwright Page object
 * @param mode Mode prefix
 */
export async function clickAnalyzeButton(page: Page, mode: string): Promise<void> {
  const analyzeButton = page.locator(`[data-testid="${mode}-analyze-button"]`)
  await expect(analyzeButton).toBeVisible({ timeout: 15000 })
  await expect(analyzeButton).toBeEnabled({ timeout: 15000 })
  await analyzeButton.click()
}

/**
 * Get the evaluation score (using data-testid)
 * @param page Playwright Page object
 * @param mode Mode prefix (optional, for more precise locating)
 * @returns Score (0-100)
 */
export async function getEvaluationScore(
  page: Page,
  mode?: string
): Promise<number> {
  const badgeSelector = mode
    ? `[data-testid="${mode}-score-badge"]`
    : '[data-testid="evaluation-score-badge"]'

  const scoreBadge = page.locator(badgeSelector)
  await expect(scoreBadge).toBeVisible({ timeout: 90000 })
  await expect(scoreBadge).not.toHaveClass(/loading/, { timeout: 60000 })

  const scoreValue = scoreBadge.locator('[data-testid="score-value"]')
  await expect(scoreValue).toBeVisible({ timeout: 10000 })

  const scoreText = await scoreValue.textContent()
  const score = parseInt(scoreText?.trim() || '0')

  expect(score).toBeGreaterThan(0)
  expect(score).toBeLessThanOrEqual(100)

  return score
}

/**
 * Verify that the analyze button is disabled when the input is empty
 * @param page Playwright Page object
 * @param mode Mode prefix
 */
export async function verifyAnalyzeButtonDisabledWhenEmpty(
  page: Page,
  mode: string
): Promise<void> {
  const analyzeButton = page.locator(`[data-testid="${mode}-analyze-button"]`)
  await expect(analyzeButton).toBeVisible({ timeout: 15000 })
  await expect(analyzeButton).toBeDisabled()
}
```

---

#### Step 4: Update test cases

##### 4.1 analysis/basic-system.spec.ts

```typescript
import { test, expect } from '../fixtures'
import { navigateToMode } from '../helpers/common'
import {
  fillOriginalPrompt,
  clickAnalyzeButton,
  getEvaluationScore,
  verifyAnalyzeButtonDisabledWhenEmpty
} from '../helpers/analysis'

const MODE = 'basic-system'

test.describe('Basic System - Prompt Analysis', () => {
  test('analyzes the prompt and shows evaluation results', async ({ page }) => {
    test.setTimeout(180000)

    // 1. Navigate to the basic-system workspace
    await navigateToMode(page, 'basic', 'system')
    await page.waitForTimeout(3000)

    // 2. Fill in the prompt (using data-testid)
    const testPrompt = 'Write a sorting algorithm'
    await fillOriginalPrompt(page, MODE, testPrompt)

    // 3. Click the analyze button (using data-testid)
    await clickAnalyzeButton(page, MODE)
    await page.waitForTimeout(500)

    // 4. Verify the evaluation score (using data-testid)
    const score = await getEvaluationScore(page, MODE)
    console.log(`✓ ${MODE} evaluation score: ${score}/100`)
  })

  test('verifies the analyze button is disabled when there is no prompt', async ({ page }) => {
    await navigateToMode(page, 'basic', 'system')
    await page.waitForTimeout(1000)

    // Verify the button state using data-testid
    await verifyAnalyzeButtonDisabledWhenEmpty(page, MODE)
  })
})
```

---

## Before/After Comparison

### Before ❌
```typescript
// Relies on text, easily affected by internationalization
const card = page.getByText(/Original Prompt/i)
// May match multiple buttons
const button = card.getByRole('button', { name: /Analyze/i })
// Fragile XPath
const ancestor = card.locator('xpath=ancestor::*[contains(@class,"n-card")]')
```

### After ✅
```typescript
// Stable and language-independent
await fillOriginalPrompt(page, 'basic-system', 'Test content')
await clickAnalyzeButton(page, 'basic-system')
const score = await getEvaluationScore(page, 'basic-system')
```

### Key Advantages
1. ✅ **Language-independent**: Not affected by internationalization
2. ✅ **Precise locating**: Different modes are distinguished through testIdPrefix
3. ✅ **High stability**: Does not depend on DOM structure or style classes
4. ✅ **Easy to maintain**: Selector semantics are clear
5. ✅ **Follows best practices**: The approach recommended by Playwright/Testing Library

---

## Implementation Plan

### Phase 1: Core Components (High Priority)
- [x] ~~Create the optimization plan document~~
- [ ] `InputPanel.vue` - Add the `testIdPrefix` prop and data-testid
- [ ] `BasicSystemWorkspace.vue` - Pass testIdPrefix="basic-system"
- [ ] `BasicUserWorkspace.vue` - Pass testIdPrefix="basic-user"
- [ ] `EvaluationScoreBadge.vue` - Add data-testid="evaluation-score-badge"
- [ ] Update `helpers/analysis.ts` to use the new selectors
- [ ] Update `analysis/basic-system.spec.ts` and `basic-user.spec.ts`
- [ ] Run tests to verify

### Phase 2: Pro Mode (Medium Priority)
- [ ] `ContextSystemWorkspace.vue` - Add data-testid
- [ ] `ContextUserWorkspace.vue` - Add data-testid
- [ ] Design and implement Pro mode tests

### Phase 3: Image Mode (Low Priority)
- [ ] `ImageText2ImageWorkspace.vue` - Add data-testid
- [ ] `ImageImage2ImageWorkspace.vue` - Add data-testid
- [ ] Implement tests after creating the evaluation templates

---

## Notes

1. **Backward compatible**: Adding `data-testid` does not affect existing functionality
2. **Production environment**: `data-testid` is kept in production (the file size increase is negligible)
3. **Naming consistency**: Strictly follow the naming convention for easy lookup and maintenance
4. **Incremental migration**: Migrate Basic mode first, then extend to other modes

---

## References

- [Playwright Best Practices - Use Test IDs](https://playwright.dev/docs/best-practices#use-test-ids)
- [Testing Library - Priority](https://testing-library.com/docs/queries/about/#priority)
- [Vue Test Utils - Finding Elements](https://test-utils.vuejs.org/guide/essentials/a-crash-course.html#finding-elements)
