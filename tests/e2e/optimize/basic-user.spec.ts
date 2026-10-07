import { test } from '../fixtures'
import { navigateToMode } from '../helpers/common'
import {
  fillOriginalPrompt,
  clickOptimizeButton,
  expectOptimizedResultNotEmpty,
  verifyOptimizeButtonDisabledWhenEmpty
} from '../helpers/optimize'

const MODE = 'basic-user' as const

test.describe('Basic User - Prompt Optimization', () => {
  test('Optimize the prompt and generate an optimized result', async ({ page }) => {
    test.setTimeout(180000)

    await navigateToMode(page, 'basic', 'user')

    await fillOriginalPrompt(page, MODE, 'Help me write an email reporting on project progress')
    await clickOptimizeButton(page, MODE)

    await expectOptimizedResultNotEmpty(page, MODE)
  })

  test('Verify the optimize button is disabled when there is no prompt', async ({ page }) => {
    await navigateToMode(page, 'basic', 'user')
    await verifyOptimizeButtonDisabledWhenEmpty(page, MODE)
  })
})
