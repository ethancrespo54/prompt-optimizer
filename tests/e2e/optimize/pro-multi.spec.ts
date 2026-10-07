import { test, expect } from '../fixtures'
import { navigateToMode } from '../helpers/common'
import {
  addProMultiUserMessage,
  selectProMultiMessageForOptimization,
  clickProMultiOptimizeButton,
  expectOptimizedResultNotEmpty
} from '../helpers/optimize'

const MODE = 'pro-multi' as const

test.describe('Pro Multi - Prompt Optimization', () => {
  test('Auto-select the latest message, optimize, and generate an optimized result', async ({ page }) => {
    test.setTimeout(180000)

    await navigateToMode(page, 'pro', 'multi')

    // Initial state: with no message selected, the empty hint should be shown (we gave it a stable testid)
    await expect(page.getByTestId('pro-multi-empty-select-message')).toBeVisible({ timeout: 20000 })

    // 1) Add a user message
    await addProMultiUserMessage(page, 'Please help me write a weekly project report covering progress, risks, and next week\'s plan')

    // 2) Pro Multi automatically selects the latest message for optimization
    await selectProMultiMessageForOptimization(page, 0)

    // 3) Click the Pro Multi optimize button
    await clickProMultiOptimizeButton(page)

    // 4) Verify the optimized result appears in the right-hand PromptPanel (without relying on text)
    await expectOptimizedResultNotEmpty(page, MODE)
  })
})
