import { test } from '../fixtures'
import { navigateToMode } from '../helpers/common'
import {
  fillOriginalPrompt,
  clickOptimizeButton,
  expectOptimizedResultNotEmpty,
  verifyOptimizeButtonDisabledWhenEmpty
} from '../helpers/optimize'

const MODE = 'pro-variable' as const

test.describe('Pro Variable - Prompt Optimization', () => {
  test('Optimize a prompt with variables and generate an optimized result', async ({ page }) => {
    test.setTimeout(180000)

    await navigateToMode(page, 'pro', 'variable')

    const prompt = 'Based on {{taskDescription}}, write a {{documentType}} for {{targetUser}}, meeting {{qualityRequirements}}'
    await fillOriginalPrompt(page, MODE, prompt)
    await clickOptimizeButton(page, MODE)

    await expectOptimizedResultNotEmpty(page, MODE)
  })

  test('Verify the optimize button is disabled when there is no prompt', async ({ page }) => {
    await navigateToMode(page, 'pro', 'variable')
    await verifyOptimizeButtonDisabledWhenEmpty(page, MODE)
  })
})
