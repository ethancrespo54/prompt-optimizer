import { test, expect } from '../fixtures'
import { navigateToMode } from '../helpers/common'
import {
  fillOriginalPrompt,
  clickAnalyzeButton,
  getEvaluationScore,
  verifyAnalyzeButtonDisabledWhenEmpty
} from '../helpers/analysis'

/**
 * Image Image2Image mode - prompt analysis tests
 *
 * ✨ Best-practice example:
 * - Locate precisely with data-testid, without relying on text content
 * - Container isolation: distinguish workspaces via data-mode
 * - Type safety: use TypeScript type definitions
 *
 * Feature: analyze the image-to-image prompt and display the evaluation score
 *
 * Prerequisites:
 * - API keys are configured in .env.local
 * - Real LLM API calls are made (this incurs costs)
 *
 * Test flow:
 * 1. Navigate to image-image2image workspace
 * 2. Fill in the image-to-image prompt
 * 3. Click the "Analyze" button
 * 4. Wait for the LLM response
 * 5. Verify the evaluation result and score display
 *
 * Note: this test only covers the prompt analysis feature and does not involve image upload
 */

const MODE = 'image-image2image' as const

test.describe('Image Image2Image - Prompt Analysis', () => {
  test('Analyze the prompt and display the evaluation result', async ({ page }) => {
    test.setTimeout(180000) // 3-minute timeout

    // 1. Navigate to image-image2image workspace
    await navigateToMode(page, 'image', 'image2image')

    // 2. Wait for services and components to fully initialize

    // 3. Fill in the image-to-image prompt (located via data-testid)
    const testPrompt = 'Convert to watercolor painting style, soft colors, artistic brush strokes'
    await fillOriginalPrompt(page, MODE, testPrompt)

    // 4. Click the analyze button (located via data-testid)
    await clickAnalyzeButton(page, MODE)

    // 5. Verify the evaluation score (located via data-testid)
    const score = await getEvaluationScore(page, MODE)
  })

  test('Verify the analyze button is disabled when there is no prompt', async ({ page }) => {
    await navigateToMode(page, 'image', 'image2image')

    // The analyze button should be disabled when there is no input
    await verifyAnalyzeButtonDisabledWhenEmpty(page, MODE)
  })
})
