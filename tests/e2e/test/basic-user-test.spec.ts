import { test } from '../fixtures'
import { navigateToMode } from '../helpers/common'
import {
  fillOriginalPrompt,
  clickOptimizeButton,
  expectOptimizedResultNotEmpty,
  expectOutputByTestIdNotEmpty,
} from '../helpers/optimize'

const MODE = 'basic-user' as const

test.describe('Basic User - Test (no test input required)', () => {
  test('Test directly after optimizing; original/optimized results are both non-empty', async ({ page }) => {
    test.setTimeout(240000)

    await navigateToMode(page, 'basic', 'user')

    // 1) Optimize on the left
    await fillOriginalPrompt(page, MODE, 'You are a poet')
    await clickOptimizeButton(page, MODE)
    await expectOptimizedResultNotEmpty(page, MODE)

    // 2) Ensure the column count is 2 (avoids extra requests from default column count changes, which would break VCR fixture matching)
    const workspace = page.locator('[data-testid="workspace"][data-mode="basic-user"]').first()
    // The truly clickable element of a Naive UI radio button is the label; if value=2 is already selected by default, click would retry on interception and time out.
    await workspace.getByRole('radio', { name: '2' }).check()

    // 3) Click Run All directly (without filling in test input)
    await page.getByTestId('basic-user-test-run-all').click()

    // 4) Assert both outputs are non-empty
    await expectOutputByTestIdNotEmpty(page, 'basic-user-test-original-output')
    await expectOutputByTestIdNotEmpty(page, 'basic-user-test-optimized-output')
  })
})
