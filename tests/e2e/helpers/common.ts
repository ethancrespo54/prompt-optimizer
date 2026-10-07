import { expect, type Page } from '@playwright/test'

/**
 * Wait for the app to finish loading
 */
export async function waitForAppReady(page: Page): Promise<void> {
  await expect(page.locator('.loading-container')).toHaveCount(0, { timeout: 15000 })
  await expect(page.locator('#app, [id="app"], main')).toBeAttached()
}

/**
 * Navigate to the given mode
 * @description Visit the root path first and wait for app initialization, then navigate to the target route
 */
export async function navigateToMode(
  page: Page,
  mode: 'basic' | 'pro' | 'image',
  subMode: string
): Promise<void> {
  // Simulate a real user: enter from /, where RootBootstrapRoute decides the initial workspace,
  // then switch to the target mode/sub-mode through the top CoreNav.
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await waitForAppReady(page)

  // RootBootstrapRoute redirects / to some workspace; just wait until the workspace appears.
  await expect(page.locator('[data-testid="workspace"]').first()).toBeVisible({ timeout: 20000 })

  await switchModeViaUI(page, mode, subMode)

  // ✅ Verify the URL is correct
  await expect(page).toHaveURL(new RegExp(`\\/#\\/${mode}\\/${subMode}$`), { timeout: 20000 })
}

export async function switchModeViaUI(
  page: Page,
  mode: 'basic' | 'pro' | 'image',
  subMode: string
): Promise<void> {
  // Feature mode (basic/pro/image)
  const functionModeSelector = page.getByTestId('function-mode-selector')
  await expect(functionModeSelector).toBeVisible({ timeout: 20000 })

  // Do not depend on button labels (i18n may change); click directly by data-testid
  await functionModeSelector.getByTestId(`function-mode-${mode}`).click()

  // Sub-mode (basic: system/user, pro: multi/variable, image: text2image/image2image)
  // The image sub-mode uses a button group rather than a radio-group; handle them separately.
  if (mode === 'image') {
    const coreNav = page.getByTestId('core-nav')
    const id = subMode === 'text2image' ? 'image-sub-mode-text2image' : 'image-sub-mode-image2image'
    await coreNav.getByTestId(id).click()
    return
  }

  const subModeSelector = page.getByTestId('optimization-mode-selector')
  await expect(subModeSelector).toBeVisible({ timeout: 20000 })

  // Do not depend on button labels (i18n may change); click directly by data-testid
  await subModeSelector.getByTestId(`sub-mode-${subMode}`).click()
}
