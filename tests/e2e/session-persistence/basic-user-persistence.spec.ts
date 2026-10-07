import { test, expect } from '../fixtures'

/**
 * Basic User mode - session persistence tests
 *
 * Test scenarios:
 * 1. After switching the optimization model and refreshing, verify the selection is kept (verified through the UI)
 * 2. After switching the template and refreshing, verify the selection is kept (verified through the UI)
 *
 * Note: the tests verify the UI state the user sees, not the underlying storage implementation
 */
test.describe('Basic User - Session Persistence', () => {
  test('after switching the optimization model and refreshing the page, the selection should be kept', async ({ page }) => {
    // 1. Navigate to basic/user
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.goto('/#/basic/user')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000) // wait for data to load

    // 2. Find the optimization model dropdown and record its initial value
    const modelLabel = page.getByText(/Optimization Model/i).first()
    await expect(modelLabel).toBeVisible({ timeout: 15000 })

    const container = modelLabel.locator('xpath=ancestor::*[.//div[contains(@class,"n-base-selection")]][1]')
    const select = container.locator('.n-base-selection').first()

    // Get the initially selected model
    const getSelectedModel = async () => {
      return await select.textContent()
    }

    const initialModel = await getSelectedModel()
    console.log(`Initial optimization model: ${initialModel || '(not set)'}`)

    // 3. Click the dropdown and switch
    await select.click()
    await page.waitForTimeout(500)

    // Get all options
    const options = await page.locator('.n-base-select-option').allTextContents()
    console.log(`Available model options: ${options.length}`)
    expect(options.length).toBeGreaterThan(0)

    // Record the model to switch to (the second option, if it exists)
    const targetModelIndex = options.length > 1 ? 1 : 0
    const targetModel = options[targetModelIndex]

    if (targetModelIndex === 0) {
      console.log('⚠️ Only one model option, skipping the switch test')
      return
    }

    // Click the second option
    await page.locator('.n-base-select-option').nth(targetModelIndex).click()
    console.log(`Switched to model: ${targetModel}`)

    // 4. Verify the value is updated after switching
    await page.waitForTimeout(500) // wait for the UI to update
    const afterSwitch = await getSelectedModel()
    console.log(`After switch: ${afterSwitch}`)

    // 5. Reload the page
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000) // wait for restoration to finish

    // 6. Verify the dropdown shows the previously selected value after reload (this is the point of persistence)
    const afterRefresh = await getSelectedModel()
    console.log(`After reload: ${afterRefresh}`)

    // Key assertion: the value after reload should equal the value after switching
    if (afterRefresh === targetModel) {
      console.log('✅ Persistence succeeded: model selection was kept')
    } else {
      console.log(`❌ Persistence failed: expected "${targetModel}", got "${afterRefresh}"`)
    }

    // This assertion verifies whether persistence succeeded
    expect(afterRefresh).toBe(targetModel)
  })

  test('after switching the template and refreshing the page, the selection should be kept', async ({ page }) => {
    // 1. Navigate to basic/user
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.goto('/#/basic/user')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // 2. Find the template dropdown and record its initial value
    const templateLabel = page.getByText(/Optimization Template/i).first()
    await expect(templateLabel).toBeVisible({ timeout: 15000 })

    const container = templateLabel.locator('xpath=ancestor::*[.//div[contains(@class,"n-base-selection")]][1]')
    const select = container.locator('.n-base-selection').first()

    const getSelectedTemplate = async () => {
      return await select.textContent()
    }

    const initialTemplate = await getSelectedTemplate()
    console.log(`Initial template: ${initialTemplate || '(not set)'}`)

    // 3. Click the dropdown and switch
    await select.click()
    await page.waitForTimeout(500)

    // Get all options
    const options = await page.locator('.n-base-select-option').allTextContents()
    console.log(`Available template options: ${options.length}`)
    expect(options.length).toBeGreaterThan(0)

    // Record the template to switch to (the second option, if it exists)
    const targetIndex = options.length > 1 ? 1 : 0
    const targetTemplate = options[targetIndex]

    if (targetIndex === 0) {
      console.log('⚠️ Only one template option, skipping the switch test')
      return
    }

    // Click the second option
    await page.locator('.n-base-select-option').nth(targetIndex).click()
    console.log(`Switched to template: ${targetTemplate}`)

    // 4. Verify the value is updated after switching
    await page.waitForTimeout(500)
    const afterSwitch = await getSelectedTemplate()
    console.log(`After switch: ${afterSwitch}`)

    // 5. Reload the page
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // 6. Verify the dropdown shows the previously selected value after reload
    const afterRefresh = await getSelectedTemplate()
    console.log(`After reload: ${afterRefresh}`)

    // Key assertion: the value after reload should equal the value after switching
    if (afterRefresh === targetTemplate) {
      console.log('✅ Persistence succeeded: template selection was kept')
    } else {
      console.log(`❌ Persistence failed: expected "${targetTemplate}", got "${afterRefresh}"`)
    }

    // This assertion verifies whether persistence succeeded
    expect(afterRefresh).toBe(targetTemplate)
  })
})
