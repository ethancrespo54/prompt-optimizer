import { test } from '../fixtures'
import { navigateToMode } from '../helpers/common'
import {
  fillOriginalPrompt,
  clickOptimizeButton,
  expectOptimizedResultNotEmpty,
  expectOutputByTestIdNotEmpty,
} from '../helpers/optimize'

const MODE = 'basic-system' as const

test.describe('Basic System - Test (compare mode)', () => {
  test('Optimize first, then test in compare mode; original/optimized results are both non-empty', async ({ page }) => {
    test.setTimeout(240000)

    await navigateToMode(page, 'basic', 'system')

    // 1) Optimize on the left
    await fillOriginalPrompt(page, MODE, 'You are a poet')
    await clickOptimizeButton(page, MODE)
    await expectOptimizedResultNotEmpty(page, MODE)

    // 2) Test input on the right
    const testInput = page.getByTestId('basic-system-test-input').locator('textarea')
    await testInput.fill('Write a short poem expressing the confusion of the AI era')

    // 3) Ensure the column count is 2 (avoids extra requests from default column count changes, which would break VCR fixture matching)
    const workspace = page.locator('[data-testid="workspace"][data-mode="basic-system"]').first()
    // The truly clickable element of a Naive UI radio button is the label; if value=2 is already selected by default, click would retry on interception and time out.
    await workspace.getByRole('radio', { name: '2' }).check()

    // 4) Click Run All (triggers the two-column test: A=Original + B=Latest)
    await page.getByTestId('basic-system-test-run-all').click()

    // 5) Assert both outputs are non-empty
    await expectOutputByTestIdNotEmpty(page, 'basic-system-test-original-output')
    await expectOutputByTestIdNotEmpty(page, 'basic-system-test-optimized-output')
  })
})
