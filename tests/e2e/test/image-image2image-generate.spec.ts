import { test, expect } from '../fixtures'
import { navigateToMode } from '../helpers/common'
import { fillOriginalPrompt, clickOptimizeButton, expectOptimizedResultNotEmpty } from '../helpers/optimize'
import * as path from 'path'

const MODE = 'image-image2image' as const

async function openSelectAndWaitForVisibleOptions(page: any, select: any) {
  const visibleOptions = page.locator('.n-base-select-option:visible')

  const ensureOpen = async () => {
    await select.click()
    await expect
      .poll(async () => await visibleOptions.count(), { timeout: 20000 })
      .toBeGreaterThan(0)
  }

  try {
    await ensureOpen()
  } catch {
    await page.keyboard.press('Escape').catch(() => {})
    await page.waitForTimeout(200)
    await ensureOpen()
  }

  return visibleOptions
}

async function selectOption(page: any, select: any, matcher?: RegExp) {
  // Naive UI dropdown options animate/re-render, so a direct click may get stuck retrying on "not stable / not visible" until the test times out.
  // Make two attempts here: on failure, collapse the dropdown and reopen it; the second attempt uses a force click.
  for (let attempt = 0; attempt < 2; attempt++) {
    const options = await openSelectAndWaitForVisibleOptions(page, select)

    if (!matcher) {
      await options.first().click({ timeout: 20000, force: attempt > 0 })
      return
    }

    const target = options.filter({ hasText: matcher }).first()
    if ((await target.count()) === 0) {
      // Fail explicitly: the image model must hit SiliconFlow, otherwise the VCR requestHash will not match.
      await page.keyboard.press('Escape').catch(() => {})
      throw new Error(`[E2E] selectOption: option not found for matcher: ${String(matcher)}`)
    }

    try {
      await target.click({ timeout: 20000, force: attempt > 0 })
      return
    } catch {
      await page.keyboard.press('Escape').catch(() => {})
      await page.waitForTimeout(200)
    }
  }
}

test.describe('Image Image2Image - Generation (SiliconFlow)', () => {
  test('Upload an input image and generate original+optimized images in compare mode', async ({ page }) => {
    test.setTimeout(900000)

    await navigateToMode(page, 'image', 'image2image')

    // 1) Open the upload dialog and upload the input image
    await page.getByTestId('image-image2image-open-upload').click()

    const upload = page.getByTestId('image-image2image-upload')
    const fileInput = upload.locator('input[type="file"]')

    const seedPath = path.join(process.cwd(), 'tests/e2e/fixtures/images/text2image-output.png')
    await fileInput.setInputFiles(seedPath)

    // Wait for the thumbnail to appear, which means the session has injected inputImage
    await expect(page.getByTestId('image-image2image-input-preview')).toBeVisible({ timeout: 30000 })

    // Close the modal: do not rely strongly on the exact DOM structure; just get back to the main UI and continue
    await page.keyboard.press('Escape').catch(() => {})

    // Wait for the upload dialog to close completely so leftover overlays/animations do not intercept later clicks
    await expect(page.getByTestId('image-image2image-upload-modal')).toBeHidden({ timeout: 20000 })

    // 2) Select the text model (used for optimization)
    const textModelSelect = page.getByTestId('image-image2image-text-model-select')
    await expect(textModelSelect).toBeVisible({ timeout: 20000 })
    await selectOption(page, textModelSelect)

    // 3) Select the optimization template (skipped)
    // We do not rely on a specific template here (the template list may change, and focus triggers a refresh that makes the dropdown jitter),
    // and only verify the main flow: upload -> optimize -> generate two images in compare mode.

    // 4) Fill in the prompt (reuses the helper: supports textarea/CodeMirror and waits for optimize-button to be enabled after input)
    await fillOriginalPrompt(page, MODE, 'make it watercolor style')

    // 5) Click optimize and wait for the optimized output to be non-empty
    await clickOptimizeButton(page, MODE)
    await expectOptimizedResultNotEmpty(page, MODE)

    // 6) Ensure the column count is 2 (avoids extra requests from default column count changes, which would break VCR fixture matching)
    const workspace = page.locator('[data-testid="workspace"][data-mode="image-image2image"]').first()
    // The truly clickable element of a Naive UI radio button is the label; if value=2 is already selected by default, click would retry on interception and time out.
    await workspace.getByRole('radio', { name: '2' }).check()

    // 7) Select the image model: set both A/B columns to SiliconFlow so requests match the fixture
    const originalModelSelect = page.getByTestId('image-image2image-test-original-model-select')
    const optimizedModelSelect = page.getByTestId('image-image2image-test-optimized-model-select')
    await expect(originalModelSelect).toBeVisible({ timeout: 20000 })
    await expect(optimizedModelSelect).toBeVisible({ timeout: 20000 })
    await selectOption(page, originalModelSelect, /siliconflow/i)
    await selectOption(page, optimizedModelSelect, /siliconflow/i)

    // 8) Run generation for both columns (original + optimized)
    await page.getByTestId('image-image2image-test-run-all').click()

    // 9) Assert both result images are non-empty
    const originalImg = page.getByTestId('image-image2image-original-image').locator('img')
    const optimizedImg = page.getByTestId('image-image2image-optimized-image').locator('img')

    await expect
      .poll(async () => (await originalImg.getAttribute('src')) || '', { timeout: 240000 })
      .toMatch(/^data:image\/(png|jpeg);base64,|^https?:\/\//)

    await expect
      .poll(async () => (await optimizedImg.getAttribute('src')) || '', { timeout: 240000 })
      .toMatch(/^data:image\/(png|jpeg);base64,|^https?:\/\//)
  })
})
