import { test } from '../fixtures'
import { navigateToMode } from '../helpers/common'
import {
  fillOriginalPrompt,
  clickOptimizeButton,
  expectOptimizedResultNotEmpty,
  verifyOptimizeButtonDisabledWhenEmpty
} from '../helpers/optimize'

const MODE = 'basic-system' as const

test.describe('Basic System - Prompt Optimization', () => {
  test('Optimize the prompt and generate an optimized result', async ({ page }) => {
    test.setTimeout(180000)

    await navigateToMode(page, 'basic', 'system')

    await fillOriginalPrompt(page, MODE, 'Write a sorting algorithm')
    await clickOptimizeButton(page, MODE)

    await expectOptimizedResultNotEmpty(page, MODE)
  })

  test('Verify the optimize button is disabled when there is no prompt', async ({ page }) => {
    await navigateToMode(page, 'basic', 'system')
    await verifyOptimizeButtonDisabledWhenEmpty(page, MODE)
  })
})
