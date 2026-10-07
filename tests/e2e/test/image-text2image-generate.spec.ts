import { test, expect } from '../fixtures'
import { navigateToMode } from '../helpers/common'
import { fillOriginalPrompt, clickOptimizeButton, expectOptimizedResultNotEmpty } from '../helpers/optimize'
import * as fs from 'fs/promises'
import * as path from 'path'

const MODE = 'image-text2image' as const

function isBase64DataUrl(src: string) {
  return /^data:image\/(png|jpeg);base64,/.test(src)
}

async function saveBase64DataUrlAsPng(dataUrl: string, outPath: string) {
  const base64 = dataUrl.split(',')[1] || ''
  const buf = Buffer.from(base64, 'base64')
  await fs.mkdir(path.dirname(outPath), { recursive: true })
  await fs.writeFile(outPath, buf)
}

async function openSelectAndWaitForVisibleOptions(page: any, select: any) {
  const visibleOptions = page.locator('.n-base-select-option:visible')

  const ensureOpen = async () => {
    await select.click()
    await expect.poll(async () => await visibleOptions.count(), { timeout: 20000 }).toBeGreaterThan(0)
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
  const options = await openSelectAndWaitForVisibleOptions(page, select)

  if (!matcher) {
    await options.first().click()
    return
  }

  const target = options.filter({ hasText: matcher }).first()
  if ((await target.count()) > 0) {
    await target.click()
    return
  }

  // Fallback: pick the first visible option.
  await options.first().click()
}

test.describe('Image Text2Image - Generation (SiliconFlow)', () => {
  test('Switch to the SiliconFlow image model and generate images (compare mode)', async ({ page }) => {
    // Record mode may be slow (two image generations); keep replay fast.
    test.setTimeout(900000)

    await navigateToMode(page, 'image', 'text2image')

    // 1) Enter the prompt and optimize (left side)
    // Keep the prompt short so the generated optimized prompt is not too long, which could make the image model fail/time out.
    await fillOriginalPrompt(page, MODE, 'corgi, studio photo')
    await clickOptimizeButton(page, MODE)
    await expectOptimizedResultNotEmpty(page, MODE)

    // 2) Ensure the column count is 2 (avoids extra requests from default column count changes, which would break VCR fixture matching)
    const workspace = page.locator('[data-testid="workspace"][data-mode="image-text2image"]').first()
    // The truly clickable element of a Naive UI radio button is the label; if value=2 is already selected by default, click would retry on interception and time out.
    await workspace.getByRole('radio', { name: '2' }).check()

    // 3) Select the image model (set both A/B columns to SiliconFlow so requests match the fixture)
    const originalModelSelect = page.getByTestId('image-text2image-test-original-model-select')
    const optimizedModelSelect = page.getByTestId('image-text2image-test-optimized-model-select')
    await expect(originalModelSelect).toBeVisible({ timeout: 20000 })
    await expect(optimizedModelSelect).toBeVisible({ timeout: 20000 })
    await selectOption(page, originalModelSelect, /siliconflow/i)
    await selectOption(page, optimizedModelSelect, /siliconflow/i)

    // 4) Run generation for both columns (original + optimized)
    await page.getByTestId('image-text2image-test-run-all').click()

    // 5) Assert both generated results are non-empty (at least img src has a value)
    const originalImg = page.getByTestId('image-text2image-original-image').locator('img')
    const optimizedImg = page.getByTestId('image-text2image-optimized-image').locator('img')

    let originalSrc = ''
    await expect
      .poll(async () => {
        originalSrc = (await originalImg.getAttribute('src')) || ''
        return originalSrc
      }, { timeout: 240000 })
      .toMatch(/^data:image\/(png|jpeg);base64,|^https?:\/\//)

    let optimizedSrc = ''
    await expect
      .poll(async () => {
        optimizedSrc = (await optimizedImg.getAttribute('src')) || ''
        return optimizedSrc
      }, { timeout: 240000 })
      .toMatch(/^data:image\/(png|jpeg);base64,|^https?:\/\//)

    // In record mode, save a sample image for the image2image upload to reuse.
    // If it is base64, write it to disk directly; if it is a URL (siliconflow returns a url by default), download it via Playwright and write it to disk.
    if (process.env.E2E_VCR_MODE === 'record') {
      const outPath = path.join(process.cwd(), 'tests/e2e/fixtures/images/text2image-output.png')

      if (isBase64DataUrl(optimizedSrc)) {
        await saveBase64DataUrlAsPng(optimizedSrc, outPath)
      } else if (optimizedSrc.startsWith('http')) {
        const res = await page.request.get(optimizedSrc)
        if (res.ok()) {
          const buf = await res.body()
          await fs.mkdir(path.dirname(outPath), { recursive: true })
          await fs.writeFile(outPath, buf)
        }
      }

      // If still missing, keep a url marker for debugging.
      try {
        await fs.access(outPath)
      } catch {
        if (optimizedSrc) {
          await fs.mkdir(path.dirname(outPath), { recursive: true })
          await fs.writeFile(outPath + '.url.txt', optimizedSrc, 'utf-8')
        }
      }
    }
  })
})
