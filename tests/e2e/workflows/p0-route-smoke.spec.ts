import { test, expect } from '../fixtures'

const ROUTES: Array<{ name: string; hashPath: string }> = [
  { name: 'basic-system', hashPath: '/#/basic/system' },
  { name: 'basic-user', hashPath: '/#/basic/user' },
  { name: 'pro-multi', hashPath: '/#/pro/multi' },
  { name: 'pro-variable', hashPath: '/#/pro/variable' },
  { name: 'image-text2image', hashPath: '/#/image/text2image' },
  { name: 'image-image2image', hashPath: '/#/image/image2image' }
]

test.describe('P0 route smoke', () => {
  for (const route of ROUTES) {
    test(route.name, async ({ page }) => {
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      // Jump to the target route only after app initialization completes, avoiding a race with RootBootstrapRoute/globalSettings initialization
      // It is more stable to trigger one "default route redirect" first and then enter the target route
      await expect(page.locator('.loading-container')).toHaveCount(0, { timeout: 15000 })

      await page.goto(route.hashPath)
      await page.waitForLoadState('networkidle')

      // Wait for the app to reach isReady (loading-container renders while not ready)
      await expect(page.locator('.loading-container')).toHaveCount(0, { timeout: 15000 })

      await expect(page).toHaveURL(new RegExp(`#${route.hashPath.replace('/#', '')}$`))
      await expect(page.locator('#app, [id="app"], main')).toBeAttached()

      // The page should render some DOM (avoids a blank screen)
      const appDescendants = await page.locator('#app *').count()
      expect(appDescendants).toBeGreaterThan(0)
    })
  }
})
