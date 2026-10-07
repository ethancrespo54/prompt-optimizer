/**
 * Route initialization tests - verify all dropdowns have values
 *
 * Features:
 * - Verify that after each route initializes, both the model select and the prompt template select have options
 * - Ensure data loads correctly and avoid empty states
 *
 * Test scope:
 * - Basic 模式：basic-system, basic-user
 * - Pro 模式：pro-multi, pro-variable
 * - Image 模式：text2image, image2image
 */
import { test, expect } from '../fixtures'
import { navigateToMode } from '../helpers/common'

type RouteCase = {
  name: string
  mode: 'basic' | 'pro' | 'image'
  subMode: string
  hashPath: string
  modelLabel: RegExp
  templateLabel: RegExp
}

const ROUTES: RouteCase[] = [
  {
    name: 'basic-system',
    mode: 'basic' as const,
    subMode: 'system' as const,
    hashPath: '/#/basic/system',
    modelLabel: /Optimization Model/i,
    templateLabel: /Optimization Template/i,
  },
  {
    name: 'basic-user',
    mode: 'basic' as const,
    subMode: 'user' as const,
    hashPath: '/#/basic/user',
    modelLabel: /Optimization Model/i,
    templateLabel: /Optimization Template/i,
  },
  {
    name: 'pro-multi',
    mode: 'pro' as const,
    subMode: 'multi' as const,
    hashPath: '/#/pro/multi',
    modelLabel: /Optimization Model/i,
    templateLabel: /Optimization Template/i,
  },
  {
    name: 'pro-variable',
    mode: 'pro' as const,
    subMode: 'variable' as const,
    hashPath: '/#/pro/variable',
    modelLabel: /Optimization Model/i,
    templateLabel: /Optimization Template/i,
  },
  {
    name: 'image-text2image',
    mode: 'image' as const,
    subMode: 'text2image' as const,
    hashPath: '/#/image/text2image',
    modelLabel: /Text Model|Optimization Model/i,
    templateLabel: /Optimization Template/i,
  },
  {
    name: 'image-image2image',
    mode: 'image' as const,
    subMode: 'image2image' as const,
    hashPath: '/#/image/image2image',
    modelLabel: /Text Model|Optimization Model/i,
    templateLabel: /Optimization Template/i,
  },
]

/**
 * Verify the dropdown has options
 * @description Check whether the Naive UI Select component rendered its options
 */
async function expectSelectHasOptions(page: Parameters<typeof test>[0]['page'], label: RegExp): Promise<void> {
  const labelNode = page.getByText(label).first()
  await expect(labelNode).toBeVisible({ timeout: 15000 })

  // Find the nearest selector container that contains the label (Naive UI NSelect renders .n-base-selection)
  const container = labelNode.locator(
    'xpath=ancestor::*[.//div[contains(@class,"n-base-selection")]][1]'
  )
  const select = container.locator('.n-base-selection').first()

  await expect(select).toBeVisible({ timeout: 15000 })
  await select.click()

  // With options it renders .n-base-select-option; the empty state renders the empty slot
  const firstOption = page.locator('.n-base-select-option').first()
  await expect(firstOption).toBeVisible({ timeout: 15000 })

  const optionCount = await page.locator('.n-base-select-option').count()
  expect(optionCount).toBeGreaterThan(0)

  await page.keyboard.press('Escape')
}

test.describe('Route Initialization: model/template dropdowns have values', () => {
  for (const route of ROUTES) {
    test(route.name, async ({ page }) => {
      // ✅ Navigate with navigateToMode (enter from /, then switch to the target workspace via the UI)
      await navigateToMode(page, route.mode, route.subMode)

      // ✅ Verify both the model and template dropdowns loaded options
      await expectSelectHasOptions(page, route.modelLabel)
      await expectSelectHasOptions(page, route.templateLabel)
    })
  }
})
