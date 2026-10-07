import { expect, type Page } from '@playwright/test'

/**
 * Workspace mode type
 */
export type WorkspaceMode =
  | 'basic-system'
  | 'basic-user'
  | 'image-text2image'
  | 'image-image2image'
  | 'pro-multi'
  | 'pro-variable'

/**
 * Evaluation type
 * - 'prompt-only': prompt-only evaluation (analysis feature)
 * - 'original': evaluation of the original prompt
 * - 'optimized': evaluation of the optimized prompt
 */
export type EvaluationType = 'prompt-only' | 'original' | 'optimized'

/**
 * Get the workspace container for the given mode
 * Locate precisely using data-testid and data-mode
 *
 * @param page Playwright Page object
 * @param mode Workspace mode ('basic-system' | 'basic-user')
 * @returns Workspace locator
 *
 * @example
 * ```typescript
 * const workspace = getWorkspace(page, 'basic-system')
 * ```
 */
export function getWorkspace(page: Page, mode: WorkspaceMode) {
  return page.locator(`[data-testid="workspace"][data-mode="${mode}"]`)
}

/**
 * Fill in the original prompt
 * Locate the input precisely via data-testid, without relying on text content
 *
 * @param page Playwright Page object
 * @param mode Workspace mode
 * @param value Prompt content
 *
 * @example
 * ```typescript
 * await fillOriginalPrompt(page, 'basic-system', 'Write a sorting algorithm')
 * ```
 */
export async function fillOriginalPrompt(
  page: Page,
  mode: WorkspaceMode,
  value: string
): Promise<void> {
  const workspace = getWorkspace(page, mode)

  // Locate precisely via the data-testid generated dynamically from testIdPrefix
  const input = workspace.locator(`[data-testid="${mode}-input"]`)
  await expect(input).toBeVisible({ timeout: 15000 })

  // Two input methods are supported: CodeMirror and NInput
  const cmContent = input.locator('.cm-content')
  if ((await cmContent.count()) > 0) {
    // CodeMirror input
    await cmContent.click()
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
    await page.keyboard.type(value)
  } else {
    // Naive UI NInput textarea
    const textarea = input.locator('textarea')
    await textarea.fill(value)
  }

  // Wait for the v-model update: the analyze button goes from disabled to enabled
  const analyzeButton = workspace.locator(`[data-testid="${mode}-analyze-button"]`)
  await expect(analyzeButton).toBeEnabled({ timeout: 15000 })
}

/**
 * Click the analyze button
 * Locate precisely via data-testid, without relying on button text
 *
 * @param page Playwright Page object
 * @param mode Workspace mode
 *
 * @example
 * ```typescript
 * await clickAnalyzeButton(page, 'basic-system')
 * ```
 */
export async function clickAnalyzeButton(
  page: Page,
  mode: WorkspaceMode
): Promise<void> {
  const workspace = getWorkspace(page, mode)

  // Locate precisely via the data-testid generated dynamically from testIdPrefix
  const button = workspace.locator(`[data-testid="${mode}-analyze-button"]`)
  await expect(button).toBeVisible({ timeout: 15000 })
  await expect(button).toBeEnabled({ timeout: 15000 })

  await button.click()
}

/**
 * Get the evaluation score
 * Locate precisely via the combined data-testid (score-badge-{type})
 *
 * @param page Playwright Page object
 * @param mode Workspace mode
 * @param evalType Evaluation type (defaults to 'prompt-only', i.e. the analysis feature)
 * @returns Score (0-100)
 *
 * @example
 * ```typescript
 * // Analysis feature (default)
 * const score = await getEvaluationScore(page, 'basic-system')
 * // Optimization feature
 * const score = await getEvaluationScore(page, 'basic-system', 'optimized')
 * ```
 */
export async function getEvaluationScore(
  page: Page,
  mode: WorkspaceMode,
  evalType: EvaluationType = 'prompt-only'
): Promise<number> {
  const workspace = getWorkspace(page, mode)

  // Locate precisely via the combined testid: score-badge-analysis, score-badge-original
  const scoreBadge = workspace.locator(`[data-testid="score-badge-${evalType}"]`)
  await expect(scoreBadge).toBeVisible({ timeout: 90000 })

  // Wait for loading to finish
  await expect(scoreBadge).not.toHaveClass(/loading/, { timeout: 60000 })

  // Get the score value
  const scoreValue = scoreBadge.locator('[data-testid="score-value"]')
  await expect(scoreValue).toBeVisible({ timeout: 10000 })

  const scoreText = await scoreValue.textContent()
  const score = parseInt(scoreText?.trim() || '0')

  // Validate the score range
  expect(score).toBeGreaterThan(0)
  expect(score).toBeLessThanOrEqual(100)

  return score
}

/**
 * Verify the analyze button is disabled when the input is empty
 *
 * @param page Playwright Page object
 * @param mode Workspace mode
 */
export async function verifyAnalyzeButtonDisabledWhenEmpty(
  page: Page,
  mode: WorkspaceMode
): Promise<void> {
  const workspace = getWorkspace(page, mode)
  const button = workspace.locator(`[data-testid="${mode}-analyze-button"]`)

  await expect(button).toBeVisible({ timeout: 15000 })
  await expect(button).toBeDisabled()
}
