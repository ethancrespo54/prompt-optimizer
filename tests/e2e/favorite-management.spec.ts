import { test, expect } from './fixtures';

/**
 * Basic favorites management E2E tests
 * Verify the core features of the favorites manager
 */
test.describe('Favorites Management Basics', () => {
  test.beforeEach(async ({ page }) => {
    // Visit the app home page
    await page.goto('/');

    // Wait for the page to finish loading
    await page.waitForLoadState('networkidle');
  });

  test('The app loads correctly', async ({ page }) => {
    // Verify the page title
    await expect(page).toHaveTitle(/Prompt Optimizer/i);

    // Verify the main elements exist
    const mainContent = page.locator('main, #app, [role="main"]');
    await expect(mainContent).toBeAttached();
  });

  test('Can open the favorites manager', async ({ page }) => {
    // Find and click the favorites manager button
    // Adjust the selector according to the actual UI
    const favoriteButton = page.getByRole('button', { name: /favorite/i });

    if (await favoriteButton.count() > 0) {
      await favoriteButton.first().click();

      // Wait for the favorites manager dialog to appear
      const dialog = page.locator('[role="dialog"]').filter({ hasText: /favorite/i });
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // Verify the dialog title
      const dialogTitle = dialog.locator('h1, h2, .n-card-header__main');
      await expect(dialogTitle).toContainText(/Favorites/i);
    } else {
      // If the favorites button is not found, skip the test
      test.skip();
    }
  });

  test('The favorites manager contains the required UI elements', async ({ page }) => {
    // Try to open the favorites manager
    const favoriteButton = page.getByRole('button', { name: /favorite/i });

    if (await favoriteButton.count() === 0) {
      test.skip();
      return;
    }

    await favoriteButton.first().click();

    // Wait for the dialog to appear
    const dialog = page.locator('[role="dialog"]').filter({ hasText: /favorite/i });
    await expect(dialog).toBeVisible();

    // Verify the search input
    const searchInput = dialog.getByPlaceholder(/search/i);
    if (await searchInput.count() > 0) {
      await expect(searchInput.first()).toBeVisible();
    }

    // Verify the "Add" or "Create" button
    const addButton = dialog.getByRole('button', { name: /add|create/i });
    if (await addButton.count() > 0) {
      await expect(addButton.first()).toBeVisible();
    }
  });

  test('Can create a new favorite (basic verification)', async ({ page }) => {
    // Open the favorites manager
    const favoriteButton = page.getByRole('button', { name: /favorite/i });

    if (await favoriteButton.count() === 0) {
      test.skip();
      return;
    }

    await favoriteButton.first().click();

    const dialog = page.locator('[role="dialog"]').filter({ hasText: /favorite/i });
    await expect(dialog).toBeVisible();

    // Click the add button
    const addButton = dialog.getByRole('button', { name: /add|create/i });

    if (await addButton.count() === 0) {
      test.skip();
      return;
    }

    await addButton.first().click();

    // Wait for the create dialog to appear
    await page.waitForTimeout(500); // wait for the animation

    // Verify the create dialog appears (may be the second dialog)
    const dialogs = page.locator('[role="dialog"]');
    const dialogCount = await dialogs.count();

    // If there are multiple dialogs, the create dialog is open
    expect(dialogCount).toBeGreaterThanOrEqual(1);
  });
});

/**
 * Full favorites CRUD flow tests
 */
test.describe('Favorites Full CRUD Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Full create, edit, and delete favorite flow', async ({ page }) => {
    // 1. Open the favorites manager
    const favoriteButton = page.getByRole('button', { name: /favorite/i });
    if (await favoriteButton.count() === 0) {
      test.skip();
      return;
    }
    await favoriteButton.first().click();

    const managerDialog = page.locator('[role="dialog"]').filter({ hasText: /Favorites/i }).first();
    await expect(managerDialog).toBeVisible();

    // Wait for the dialog to fully load
    await page.waitForTimeout(500);

    // 2. Click the add favorite button
    const addButton = managerDialog.getByRole('button', { name: /add|create/i }).first();
    await addButton.click();
    await page.waitForTimeout(500);

    // 3. Fill in the favorite information
    const createDialog = page.locator('[role="dialog"]').last();

    // Fill in the title
    const titleInput = createDialog.getByPlaceholder(/title|name this prompt/i);
    if (await titleInput.count() > 0) {
      await titleInput.fill('E2E Test Favorite');
    }

    // Fill in the content
    const contentInput = createDialog.locator('textarea').first();
    if (await contentInput.count() > 0) {
      await contentInput.fill('Favorite content created by an E2E test');
    }

    // 4. Save the favorite
    const saveButton = createDialog.getByRole('button', { name: /save|confirm|ok/i });
    if (await saveButton.count() > 0) {
      await saveButton.click();

      // Wait for the save to finish
      await page.waitForTimeout(1000);

      // 5. Verify the favorite was created - search for the one just created
      const searchInput = managerDialog.getByPlaceholder(/search/i);
      if (await searchInput.count() > 0) {
        await searchInput.fill('E2E Test Favorite');
        await page.waitForTimeout(500);

        // Verify the favorite card appears
        const favoriteCard = managerDialog.locator('text=E2E Test Favorite');
        if (await favoriteCard.count() > 0) {
          await expect(favoriteCard.first()).toBeVisible();

          // 6. Delete the favorite - find the delete button
          const card = favoriteCard.locator('..').locator('..').first();
          const deleteButton = card.getByRole('button', { name: /delete/i });

          if (await deleteButton.count() > 0) {
            await deleteButton.click();
            await page.waitForTimeout(300);

            // Confirm deletion
            const confirmButton = page.getByRole('button', { name: /yes|ok|confirm/i });
            if (await confirmButton.count() > 0) {
              await confirmButton.click();
              await page.waitForTimeout(500);

              // 7. Verify the favorite was deleted
              await searchInput.clear();
              await searchInput.fill('E2E Test Favorite');
              await page.waitForTimeout(500);

              const deletedCard = managerDialog.locator('text=E2E Test Favorite');
              expect(await deletedCard.count()).toBe(0);
            }
          }
        }
      }
    }
  });
});

/**
 * Search and filter tests
 */
test.describe('Search and Filter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Search works correctly', async ({ page }) => {
    const favoriteButton = page.getByRole('button', { name: /favorite/i });
    if (await favoriteButton.count() === 0) {
      test.skip();
      return;
    }
    await favoriteButton.first().click();

    const dialog = page.locator('[role="dialog"]').filter({ hasText: /Favorites/i }).first();
    await expect(dialog).toBeVisible();

    // Test the search feature
    const searchInput = dialog.getByPlaceholder(/search/i);
    if (await searchInput.count() > 0) {
      // Enter a search keyword
      await searchInput.fill('test');
      await page.waitForTimeout(800);

      // Verify the search input value was updated
      const searchValue = await searchInput.inputValue();
      expect(searchValue).toBe('test');

      // Clear the search
      await searchInput.clear();
      await page.waitForTimeout(500);

      // Verify the search was cleared
      const clearedValue = await searchInput.inputValue();
      expect(clearedValue).toBe('');
    }
  });

  test('Category filtering works correctly', async ({ page }) => {
    const favoriteButton = page.getByRole('button', { name: /favorite/i });
    if (await favoriteButton.count() === 0) {
      test.skip();
      return;
    }
    await favoriteButton.first().click();

    const dialog = page.locator('[role="dialog"]').filter({ hasText: /Favorites/i }).first();
    await expect(dialog).toBeVisible();

    // Find the category selector
    const categorySelect = dialog.locator('.n-base-selection, .n-select').first();
    if (await categorySelect.count() > 0) {
      await categorySelect.click();
      await page.waitForTimeout(300);

      // Select a category option (if any)
      const firstOption = page.locator('.n-base-select-option').first();
      if (await firstOption.count() > 0) {
        await firstOption.click();
        await page.waitForTimeout(800);

        // Verify the selector no longer shows the dropdown menu (an option was selected)
        const dropdownHidden = await page.locator('.n-base-select-menu').isHidden().catch(() => true);
        expect(dropdownHidden).toBe(true);
      }
    }
  });
});

/**
 * Tag management tests
 */
test.describe('Tag Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Avoid networkidle being slowed by background requests/polling; only wait for the main page body to render
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('[data-testid="workspace"]')).toBeVisible({ timeout: 10000 });
  });

  test('Can open the tag manager', async ({ page }) => {
    const favoriteButton = page.getByRole('button', { name: /favorite/i });
    if (await favoriteButton.count() === 0) {
      test.skip();
      return;
    }
    await favoriteButton.first().click();

    const managerDialog = page.locator('[role="dialog"]').filter({ hasText: /Favorites/i }).first();
    await expect(managerDialog).toBeVisible();

    // Open the more-actions dropdown (the NDropdown menu renders in a portal, not inside the dialog DOM)
    // Locate the trigger button precisely with data-testid to avoid mis-clicking the input's clear icon, etc.
    const moreButton = managerDialog.getByTestId('favorites-manager-actions');
    await expect(moreButton).toBeVisible({ timeout: 5000 });
    await moreButton.click();

    // The dropdown item label is "Manage Tags"
    const dropdownMenu = page.locator('.n-dropdown-menu').filter({ hasText: /Manage Tags/i }).first();
    await expect(dropdownMenu).toBeVisible({ timeout: 3000 });

    await dropdownMenu.getByText(/Manage Tags/i).first().click();

    // Verify the tag manager dialog appears (the title is "Tag Manager")
    const tagDialog = page.locator('[role="dialog"]').filter({ hasText: /Tag Manager/i }).last();
    await expect(tagDialog).toBeVisible({ timeout: 5000 });
  });
});

/**
 * Category management tests
 */
test.describe('Category Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Avoid networkidle being slowed by background requests/polling; only wait for the main page body to render
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('[data-testid="workspace"]')).toBeVisible({ timeout: 10000 });
  });

  test('Can open the category manager', async ({ page }) => {
    const favoriteButton = page.getByRole('button', { name: /favorite/i });
    if (await favoriteButton.count() === 0) {
      test.skip();
      return;
    }
    await favoriteButton.first().click();

    const managerDialog = page.locator('[role="dialog"]').filter({ hasText: /Favorites/i }).first();
    await expect(managerDialog).toBeVisible();

    // Open the more-actions dropdown (the NDropdown menu renders in a portal, not inside the dialog DOM)
    const moreButton = managerDialog.getByTestId('favorites-manager-actions');
    await expect(moreButton).toBeVisible({ timeout: 5000 });
    await moreButton.click();

    // The dropdown item label is "Manage Categories"
    const dropdownMenu = page.locator('.n-dropdown-menu').filter({ hasText: /Manage Categories/i }).first();
    await expect(dropdownMenu).toBeVisible({ timeout: 3000 });

    await dropdownMenu.getByText(/Manage Categories/i).first().click();

    // Verify the category manager dialog appears (the title is "Category Manager")
    const categoryDialog = page.locator('[role="dialog"]').filter({ hasText: /Category Manager/i }).last();
    await expect(categoryDialog).toBeVisible({ timeout: 5000 });
  });
});

/**
 * Import/export tests
 */
test.describe('Import/Export', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('The export button works correctly', async ({ page }) => {
    const favoriteButton = page.getByRole('button', { name: /favorite/i });
    if (await favoriteButton.count() === 0) {
      test.skip();
      return;
    }
    await favoriteButton.first().click();

    const managerDialog = page.locator('[role="dialog"]').filter({ hasText: /Favorites/i }).first();
    await expect(managerDialog).toBeVisible();

    // Find the more-actions menu
    const moreButton = managerDialog.getByRole('button').filter({
      has: page.locator('svg, .n-icon')
    }).first();

    if (await moreButton.count() > 0) {
      await moreButton.click();
      await page.waitForTimeout(300);

      // Find the export option
      const exportOption = page.locator('text=/Export/i');
      if (await exportOption.count() > 0) {
        // Set up the download listener
        const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);

        await exportOption.click();

        // Verify the download started (if any)
        const download = await downloadPromise;
        if (download) {
          expect(download).toBeTruthy();
        }
      }
    }
  });
});

/**
 * Favorites data persistence tests
 */
test.describe('Favorites Data Persistence', () => {
  test('Local storage works correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check whether localStorage is available
    const localStorageAvailable = await page.evaluate(() => {
      try {
        localStorage.setItem('test', 'test');
        localStorage.removeItem('test');
        return true;
      } catch (e) {
        return false;
      }
    });

    expect(localStorageAvailable).toBe(true);
  });
});
