import { test, expect } from '../fixtures'
import { navigateToMode } from '../helpers/common'
import {
  fillOriginalPrompt,
  clickAnalyzeButton,
  getEvaluationScore,
  verifyAnalyzeButtonDisabledWhenEmpty
} from '../helpers/analysis'

/**
 * Basic User mode - prompt analysis tests
 *
 * ✨ Best-practice example:
 * - Locate precisely with data-testid, without relying on text content
 * - Container isolation: distinguish workspaces via data-mode
 * - Type safety: use TypeScript type definitions
 * - Code reuse: use the same helper functions as basic-system
 *
 * Feature: analyze the user prompt and display the evaluation score
 *
 * Prerequisites:
 * - API keys are configured in .env.local
 * - Real LLM API calls are made (this incurs costs)
 *
 * Test flow:
 * 1. Navigate to basic-user workspace
 * 2. Fill in the prompt
 * 3. Click the "Analyze" button
 * 4. Wait for the LLM response
 * 5. Verify the evaluation result and score display
 */

const MODE = 'basic-user' as const

test.describe('Basic User - Prompt Analysis', () => {
  test('Analyze the prompt and display the evaluation result', async ({ page }) => {
    test.setTimeout(180000) // 3-minute timeout

    // 1. Navigate to basic-user workspace
    await navigateToMode(page, 'basic', 'user')

    // 2. Fill in the prompt (located via data-testid)
    const testPrompt = 'Help me write an email reporting on project progress'
    await fillOriginalPrompt(page, MODE, testPrompt)

    // 3. Click the analyze button (located via data-testid)
    await clickAnalyzeButton(page, MODE)

    // 4. Verify the evaluation score (located via data-testid)
    const score = await getEvaluationScore(page, MODE)
  })

  test('Verify the analyze button is disabled when there is no prompt', async ({ page }) => {
    await navigateToMode(page, 'basic', 'user')

    // The analyze button should be disabled when there is no input
    await verifyAnalyzeButtonDisabledWhenEmpty(page, MODE)
  })
})
