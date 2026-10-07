import { test } from '../fixtures'
import { navigateToMode } from '../helpers/common'

/**
 * Pro Multi-Message mode - prompt analysis tests
 *
 * Feature: analyze the optimization result of a multi-message conversation
 *
 * Status: ⏸️ pending design
 * Reason: the UI structure is completely different from Basic mode
 * - Uses the conversation manager UI
 * - Messages must be added first
 * - Optimize after selecting a message
 * - The evaluation flow is different
 *
 * TODO:
 * 1. Design helper functions for conversation manager interaction
 * 2. Implement the flow of adding a message, selecting a message, and optimizing
 * 3. Implement the evaluation verification logic
 */

test.describe.skip('Pro Multi-Message - Prompt Analysis', () => {
  test('Analyze the conversation optimization result and display the evaluation score', async ({ page }) => {
    test.setTimeout(180000)

    await navigateToMode(page, 'pro', 'multi')

    // TODO: implement the test logic
    // 1. Add a conversation message
    // 2. Select a message to optimize
    // 3. Verify the optimization result
    // 4. Verify the evaluation score
  })
})
