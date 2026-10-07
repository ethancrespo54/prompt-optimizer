import { test, expect } from '../fixtures'
import { navigateToMode } from '../helpers/common'
import {
  fillOriginalPrompt,
  clickAnalyzeButton,
  getEvaluationScore,
  verifyAnalyzeButtonDisabledWhenEmpty
} from '../helpers/analysis'

/**
 * Pro Variable mode - prompt analysis tests
 *
 * ✨ Best-practice example:
 * - Locate precisely with data-testid, without relying on text content
 * - Container isolation: distinguish workspaces via data-mode
 * - Type safety: use TypeScript type definitions
 *
 * Feature: analyze a user prompt with variables and display the evaluation score
 *
 * Prerequisites:
 * - API keys are configured in .env.local
 * - Real LLM API calls are made (this incurs costs)
 *
 * Test flow:
 * 1. Navigate to pro-variable workspace
 * 2. Fill in a user prompt with variables
 * 3. Click the "Analyze" button
 * 4. Wait for the LLM response
 * 5. Verify the evaluation result and score display
 *
 * Note: this test covers the "analyze" feature (prompt-only evaluation) and does not involve optimization
 */

const MODE = 'pro-variable' as const

test.describe('Pro Variable - Prompt Analysis', () => {
  test('Analyze a prompt with variables and display the evaluation result', async ({ page }) => {
    test.setTimeout(180000) // 3-minute timeout

    // 1. Navigate to pro-variable workspace
    await navigateToMode(page, 'pro', 'variable')

    // 2. Wait for services and components to fully initialize

    // 3. Fill in a user prompt with variables (located via data-testid)
    const testPrompt = 'Based on {{taskDescription}}, write a {{documentType}} for {{targetUser}}, meeting {{qualityRequirements}}'
    await fillOriginalPrompt(page, MODE, testPrompt)

    // 4. Click the analyze button (located via data-testid)
    await clickAnalyzeButton(page, MODE)

    // 5. Verify the evaluation score (located via data-testid)
    const score = await getEvaluationScore(page, MODE)
  })

  test('Verify the analyze button is disabled when there is no prompt', async ({ page }) => {
    await navigateToMode(page, 'pro', 'variable')

    // The analyze button should be disabled when there is no input
    await verifyAnalyzeButtonDisabledWhenEmpty(page, MODE)
  })
})
