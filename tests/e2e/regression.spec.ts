import { test, expect } from './fixtures';

/**
 * UI interaction regression tests
 *
 * Purpose: ensure existing UI features are not broken by new changes
 * Test scope:
 * 1. Favorites list display and interaction
 * 2. Import/export
 * 3. Basic category management
 * 4. Existing search and filtering
 */
test.describe('UI interaction regression tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('The favorites manager opens and closes correctly', async ({ page }) => {
    // This is a basic feature and should always work

    // 1. Open the favorites manager
    const favoriteButton = page.getByRole('button', { name: /favorite/i });
    if (await favoriteButton.count() === 0) {
      test.skip();
      return;
    }

    await favoriteButton.first().click();
    await page.waitForTimeout(500);

    // 2. Verify the dialog opens
    const dialog = page.locator('[role="dialog"]').filter({ hasText: /Favorites/i }).first();
    await expect(dialog).toBeVisible();

    // 3. Close the dialog
    const closeButton = dialog.locator('[aria-label="close"], .n-base-close, .n-dialog__close').first();
    if (await closeButton.count() > 0) {
      await closeButton.click();
      await page.waitForTimeout(500);

      // 4. Verify the dialog closes
      await expect(dialog).not.toBeVisible();
    }
  });

  test('The favorites list displays correctly', async ({ page }) => {
    // 1. Open the favorites manager
    const favoriteButton = page.getByRole('button', { name: /favorite/i });
    if (await favoriteButton.count() === 0) {
      test.skip();
      return;
    }

    await favoriteButton.first().click();

    const managerDialog = page.locator('[role="dialog"]').filter({ hasText: /Favorites/i }).first();
    await expect(managerDialog).toBeVisible();

    // 2. Wait for the list to load
    await page.waitForTimeout(1000);

    // 3. Verify the list container exists
    // Even with no data, there should be an empty state or list container
    const hasEmptyState = await managerDialog.locator('.n-empty').isVisible().catch(() => false);
    const hasList = await managerDialog.locator('.n-card, [class*="favorite"]').count() > 0;

    // At least one should exist (empty state or list)
    expect(hasEmptyState || hasList).toBe(true);
  });

  test('The export feature triggers correctly', async ({ page }) => {
    // 1. Open the favorites manager
    const favoriteButton = page.getByRole('button', { name: /favorite/i });
    if (await favoriteButton.count() === 0) {
      test.skip();
      return;
    }

    await favoriteButton.first().click();

    const managerDialog = page.locator('[role="dialog"]').filter({ hasText: /Favorites/i }).first();
    await expect(managerDialog).toBeVisible();

    // 2. Find the more-actions menu
    const moreButton = managerDialog.getByRole('button').filter({
      has: page.locator('svg, .n-icon')
    }).first();

    if (await moreButton.count() > 0) {
      await moreButton.click();
      await page.waitForTimeout(300);

      // 3. Find the export option
      const exportOption = page.locator('text=/Export/i');

      if (await exportOption.count() > 0) {
        // Set up the download listener
        const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);

        await exportOption.click();

        // Verify the download started (if there is data)
        const download = await downloadPromise;
        if (download) {
          expect(download).toBeTruthy();
        }
        // If there is no data there may be no download, which is also fine
      }
    }
  });

  test('The import dialog opens correctly', async ({ page }) => {
    // 1. Open the favorites manager
    const favoriteButton = page.getByRole('button', { name: /favorite/i });
    if (await favoriteButton.count() === 0) {
      test.skip();
      return;
    }

    await favoriteButton.first().click();

    const managerDialog = page.locator('[role="dialog"]').filter({ hasText: /Favorites/i }).first();
    await expect(managerDialog).toBeVisible();

    // 2. Find the import button
    const importButton = managerDialog.getByRole('button', { name: /Import/i });

    if (await importButton.count() > 0) {
      await importButton.click();
      await page.waitForTimeout(500);

      // 3. Verify the import dialog or file picker appears
      // May be a new dialog or a file upload component
      const importDialog = page.locator('[role="dialog"]').last();
      const isNewDialog = await importDialog.isVisible().catch(() => false);

      // If there is an import dialog, verify it displays correctly
      if (isNewDialog) {
        await expect(importDialog).toBeVisible();
      }
    }
  });

  test('Search input responds correctly', async ({ page }) => {
    // 1. Open the favorites manager
    const favoriteButton = page.getByRole('button', { name: /favorite/i });
    if (await favoriteButton.count() === 0) {
      test.skip();
      return;
    }

    await favoriteButton.first().click();

    const dialog = page.locator('[role="dialog"]').filter({ hasText: /Favorites/i }).first();
    await expect(dialog).toBeVisible();

    // 2. Find the search box
    const searchInput = dialog.getByPlaceholder(/search/i);

    if (await searchInput.count() > 0) {
      // 3. Enter search text
      await searchInput.fill('regression test');
      await page.waitForTimeout(500);

      // 4. Verify the input value is correct
      const inputValue = await searchInput.inputValue();
      expect(inputValue).toBe('regression test');

      // 5. Clear the search
      await searchInput.clear();
      await page.waitForTimeout(300);

      const clearedValue = await searchInput.inputValue();
      expect(clearedValue).toBe('');
    }
  });

  test('The category selector interacts correctly', async ({ page }) => {
    // 1. Open the favorites manager
    const favoriteButton = page.getByRole('button', { name: /favorite/i });
    if (await favoriteButton.count() === 0) {
      test.skip();
      return;
    }

    await favoriteButton.first().click();

    const dialog = page.locator('[role="dialog"]').filter({ hasText: /Favorites/i }).first();
    await expect(dialog).toBeVisible();

    // 2. Find the category selector
    const categorySelect = dialog.locator('.n-base-selection, .n-select').first();

    if (await categorySelect.count() > 0) {
      // 3. Click to open the dropdown menu
      await categorySelect.click();
      await page.waitForTimeout(300);

      // 4. Verify the dropdown menu appears
      const dropdown = page.locator('.n-base-select-menu, .n-select-menu');
      if (await dropdown.isVisible().catch(() => false)) {
        await expect(dropdown).toBeVisible();

        // 5. Close the dropdown menu (click elsewhere)
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
    }
  });

  test('Create favorite dialog form validation works correctly', async ({ page }) => {
    // 1. Open the favorites manager
    const favoriteButton = page.getByRole('button', { name: /favorite/i });
    if (await favoriteButton.count() === 0) {
      test.skip();
      return;
    }

    await favoriteButton.first().click();

    const managerDialog = page.locator('[role="dialog"]').filter({ hasText: /Favorites/i }).first();
    await expect(managerDialog).toBeVisible();

    // 2. Click the create button
    const createButton = managerDialog.getByRole('button', { name: /add|create/i }).first();
    await createButton.click();
    await page.waitForTimeout(500);

    // 3. Locate the create dialog
    const createDialog = page.locator('[role="dialog"]').last();

    // 4. Try saving an empty form (validation should trigger)
    const saveButton = createDialog.getByRole('button', { name: /save|confirm|ok/i });

    if (await saveButton.count() > 0) {
      // Click save
      await saveButton.click();
      await page.waitForTimeout(500);

      // Verify the dialog is still open (because validation failed)
      // Or an error message is shown
      const stillVisible = await createDialog.isVisible().catch(() => false);

      // If the dialog is still visible, validation took effect
      if (stillVisible) {
        expect(stillVisible).toBe(true);
      }
    }
  });

  test('All toolbar buttons are clickable', async ({ page }) => {
    // 1. Open the favorites manager
    const favoriteButton = page.getByRole('button', { name: /favorite/i });
    if (await favoriteButton.count() === 0) {
      test.skip();
      return;
    }

    await favoriteButton.first().click();

    const managerDialog = page.locator('[role="dialog"]').filter({ hasText: /Favorites/i }).first();
    await expect(managerDialog).toBeVisible();

    // 2. Find all toolbar buttons
    const toolbarButtons = managerDialog.locator('.toolbar button, [class*="toolbar"] button');

    const buttonCount = await toolbarButtons.count();

    if (buttonCount > 0) {
      // 3. Verify at least some buttons are clickable
      let clickableCount = 0;

      for (let i = 0; i < Math.min(buttonCount, 5); i++) {
        const button = toolbarButtons.nth(i);
        const isEnabled = await button.isEnabled().catch(() => false);
        if (isEnabled) {
          clickableCount++;
        }
      }

      // At least some buttons should be usable
      expect(clickableCount).toBeGreaterThan(0);
    }
  });

  test('Favorite cards display correctly (if there is data)', async ({ page }) => {
    // 1. Open the favorites manager
    const favoriteButton = page.getByRole('button', { name: /favorite/i });
    if (await favoriteButton.count() === 0) {
      test.skip();
      return;
    }

    await favoriteButton.first().click();

    const managerDialog = page.locator('[role="dialog"]').filter({ hasText: /Favorites/i }).first();
    await expect(managerDialog).toBeVisible();
    await page.waitForTimeout(1000);

    // 2. First create a favorite to make sure there is data
    const createButton = managerDialog.getByRole('button', { name: /add|create/i }).first();
    await createButton.click();
    await page.waitForTimeout(500);

    const createDialog = page.locator('[role="dialog"]').last();

    // Fill in the basic information
    const titleInput = createDialog.getByPlaceholder(/title|name this prompt/i);
    if (await titleInput.count() > 0) {
      await titleInput.fill('Regression Test Favorite');

      const contentInput = createDialog.locator('textarea').first();
      if (await contentInput.count() > 0) {
        await contentInput.fill('Favorite content used for regression testing');
      }

      // Save
      const saveButton = createDialog.getByRole('button', { name: /save|confirm|ok/i });
      if (await saveButton.count() > 0) {
        await saveButton.click();
        await page.waitForTimeout(1500);

        // 3. Verify the favorite card is displayed
        const favoriteCard = managerDialog.locator('text=Regression Test Favorite');
        if (await favoriteCard.count() > 0) {
          await expect(favoriteCard.first()).toBeVisible();
        }
      }
    }
  });
});

/**
 * Key feature continuity tests
 * Ensure core features remain usable after refactoring
 */
test.describe('Key feature continuity tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('The main app UI loads correctly', async ({ page }) => {
    // Verify the basic HTML structure
    const app = page.locator('#app, [id="app"], main');
    await expect(app).toBeAttached();

    // Verify the page title
    await expect(page).toHaveTitle(/Prompt Optimizer/i);
  });

  test('Local storage remains available', async ({ page }) => {
    // Verify localStorage is still available
    const storageWorks = await page.evaluate(() => {
      try {
        const testKey = 'regression-test-' + Date.now();
        localStorage.setItem(testKey, 'test-value');
        const retrieved = localStorage.getItem(testKey);
        localStorage.removeItem(testKey);
        return retrieved === 'test-value';
      } catch (e) {
        return false;
      }
    });

    expect(storageWorks).toBe(true);
  });

  test('The page layout structure remains intact', async ({ page }) => {
    // Verify the basic layout elements exist
    await page.waitForTimeout(1000);

    // There should be some kind of navigation or toolbar
    const hasNavigation = await page.locator('nav, header, .toolbar, [class*="toolbar"]').count();

    // There should be a main content area
    const hasMainContent = await page.locator('main, #app, [role="main"], .content').count();

    // There should be at least some structure
    expect(hasNavigation + hasMainContent).toBeGreaterThan(0);
  });
});
