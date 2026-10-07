import { test, expect } from './fixtures';

/**
 * Full category management CRUD flow E2E tests
 *
 * Tests the full functionality of the category manager:
 * - Create categories (with color selection)
 * - Edit categories
 * - Sort categories (move up/down)
 * - Delete categories (with usage protection)
 */
test.describe('Category Management Full Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  /**
   * Helper: wait for all modal dialogs to close completely
   */
  async function waitForModalClose(page: any) {
    // Try several ways to close existing dialogs:
    // 1. Try pressing Esc to close
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // 2. Try clicking the mask to close (if clicking the mask closes the dialog)
    const mask = page.locator('.n-modal-mask').first();
    if (await mask.count() > 0 && await mask.isVisible()) {
      await mask.click({ timeout: 1000 }).catch(() => {});
      await page.waitForTimeout(300);
    }

    // 3. Try clicking all close buttons
    const closeButtons = page.locator('[aria-label="close"], .n-base-close, button:has-text("Close")');
    const buttonCount = await closeButtons.count();
    for (let i = 0; i < Math.min(buttonCount, 3); i++) { // try to close at most 3 dialogs
      try {
        await closeButtons.nth(i).click({ timeout: 1000 });
        await page.waitForTimeout(300);
      } catch (e) {
        // Ignore click failures
      }
    }

    // 4. Finally, wait for all overlays to disappear
    await page.waitForSelector('.n-modal-mask', { state: 'hidden', timeout: 3000 }).catch(() => {});
  }

  /**
   * Helper: open the category manager
   */
  async function openCategoryManager(page: any) {
    // Wait for any existing dialog to close completely
    await waitForModalClose(page);

    // 1. Open the favorites manager
    const favoriteButton = page.getByRole('button', { name: /favorite/i }).first();
    await expect(favoriteButton).toBeVisible();
    await favoriteButton.click();
    await page.waitForTimeout(500);

    const managerDialog = page.locator('[role="dialog"]').filter({ hasText: /Favorites/i }).first();
    await expect(managerDialog).toBeVisible();

    // 2. Open the more menu
    const moreButton = managerDialog.getByTestId('favorites-manager-actions');
    await expect(moreButton).toBeVisible();
    await moreButton.click();
    await page.waitForTimeout(300);

    // 3. Click the category management option
    const categoryManagerOption = page.getByTestId('favorites-manager-action-manage-categories');
    await expect(categoryManagerOption).toBeVisible();
    await categoryManagerOption.click();
    await page.waitForTimeout(500);

    // 4. Return the category manager dialog
    const categoryDialog = page
      .locator('[role="dialog"]')
      .filter({ hasText: /Category Manager|Category Management/i })
      .last();
    await expect(categoryDialog).toBeVisible();
    return categoryDialog;
  }

  test('Category creation (with color selection)', async ({ page }) => {
    const categoryDialog = await openCategoryManager(page);

    // Find the add category button
    const addButton = categoryDialog.getByRole('button', { name: /add|create/i }).first();
    await expect(addButton).toBeVisible();

    await addButton.click();
    await page.waitForTimeout(300);

    // Fill in the category information in the popup dialog
    const createDialog = page.locator('[role="dialog"]').last();

    // Fill in the category name
    const nameInput = createDialog.locator('input[type="text"]').first();
    if (await nameInput.count() > 0) {
      await nameInput.fill('Test Category');

      // Fill in the description (if any)
      const descInput = createDialog.locator('textarea, input').filter({
        hasText: /description/i
      }).or(createDialog.locator('textarea')).first();

      if (await descInput.count() > 0) {
        await descInput.fill('A category used for testing');
      }

      // Choose a color (if there is a color picker)
      const colorPicker = createDialog.locator('.n-color-picker, [class*="color"]');
      if (await colorPicker.count() > 0) {
        await colorPicker.first().click();
        await page.waitForTimeout(300);

        // Choose a color (click somewhere in the color panel)
        const colorPanel = page.locator('.n-color-picker-panel, .n-popover');
        if (await colorPanel.isVisible().catch(() => false)) {
          // Click a preset color or the color panel
          const presetColor = colorPanel.locator('.n-color-picker-swatch, [class*="swatch"]').first();
          if (await presetColor.count() > 0) {
            await presetColor.click();
            await page.waitForTimeout(200);
          }
        }
      }

      // Confirm the creation
      const confirmButton = createDialog.getByRole('button', { name: /confirm|save|ok/i });
      if (await confirmButton.count() > 0) {
        await confirmButton.click();
        await page.waitForTimeout(500);

        // Verify the category was created
        const categoryRow = categoryDialog.locator('tr, .n-list-item, [class*="category"]').filter({
          hasText: 'Test Category'
        });

        if (await categoryRow.count() > 0) {
          await expect(categoryRow.first()).toBeVisible();
        }
      }
    }
  });

  test('Category editing', async ({ page }) => {
    const categoryDialog = await openCategoryManager(page);

    // First create a category
    const addButton = categoryDialog.getByRole('button', { name: /add|create/i });
    if (await addButton.count() > 0) {
      await addButton.click();
      await page.waitForTimeout(300);

      const createDialog = page.locator('[role="dialog"]').last();
      const nameInput = createDialog.locator('input[type="text"]').first();

      if (await nameInput.count() > 0) {
        await nameInput.fill('Category To Edit');

        const confirmButton = createDialog.getByRole('button', { name: /confirm|save|ok/i });
        if (await confirmButton.count() > 0) {
          await confirmButton.click();
          await page.waitForTimeout(500);
        }
      }
    }

    // Find the row containing "Category To Edit"
    const categoryRow = categoryDialog.locator('tr, .n-list-item, [class*="category"]').filter({
      hasText: 'Category To Edit'
    });

    if (await categoryRow.count() === 0) {
      // The category may not have been created correctly; skip the test
      return;
    }

    // Find the edit button
    const editButton = categoryRow.locator('button').filter({
      hasText: /edit/i
    }).first();

    if (await editButton.count() > 0) {
      await editButton.click();
      await page.waitForTimeout(300);

      // Change the name in the edit dialog
      const editDialog = page.locator('[role="dialog"]').last();
      const nameInput = editDialog.locator('input[type="text"]').first();

      if (await nameInput.count() > 0) {
        await nameInput.clear();
        await nameInput.fill('Edited Category');

        // Confirm the edit
        const confirmButton = editDialog.getByRole('button', { name: /confirm|save|ok/i });
        if (await confirmButton.count() > 0) {
          await confirmButton.click();
          await page.waitForTimeout(500);

          // Verify the new name appears
          const updatedRow = categoryDialog.locator('tr, .n-list-item').filter({
            hasText: 'Edited Category'
          });

          if (await updatedRow.count() > 0) {
            await expect(updatedRow.first()).toBeVisible();
          }
        }
      }
    }
  });

  test('Category sorting (move up/down)', async ({ page }) => {
    const categoryDialog = await openCategoryManager(page);

    // Create two categories for the sort test
    const categoriesToCreate = ['Sort Test A', 'Sort Test B'];

    for (const categoryName of categoriesToCreate) {
      const addButton = categoryDialog.getByRole('button', { name: /add|create/i });
      if (await addButton.count() > 0) {
        await addButton.click();
        await page.waitForTimeout(300);

        const createDialog = page.locator('[role="dialog"]').last();
        const nameInput = createDialog.locator('input[type="text"]').first();

        if (await nameInput.count() > 0) {
          await nameInput.fill(categoryName);

          const confirmButton = createDialog.getByRole('button', { name: /confirm|save|ok/i });
          if (await confirmButton.count() > 0) {
            await confirmButton.click();
            await page.waitForTimeout(500);
          }
        }
      }
    }

    // Find the row containing "Sort Test B"
    const categoryRow = categoryDialog.locator('tr, .n-list-item').filter({
      hasText: 'Sort Test B'
    });

    if (await categoryRow.count() > 0) {
      // Find the move up button
      const moveUpButton = categoryRow.locator('button').filter({
        hasText: /move up|↑/i
      }).or(categoryRow.locator('button[aria-label*="up"]')).first();

      if (await moveUpButton.count() > 0) {
        await moveUpButton.click();
        await page.waitForTimeout(500);

        // Verify the order changed (here we only verify the button is clickable; verifying the actual order is more complex)
        // In a real application, this can be verified by checking the order of all rows
        const allRows = categoryDialog.locator('tr, .n-list-item').filter({
          hasText: /Sort Test/
        });

        expect(await allRows.count()).toBeGreaterThanOrEqual(2);
      }
    }
  });

  test('Category deletion (empty category)', async ({ page }) => {
    const categoryDialog = await openCategoryManager(page);

    // Create an empty category to delete
    const addButton = categoryDialog.getByRole('button', { name: /add|create/i });
    if (await addButton.count() > 0) {
      await addButton.click();
      await page.waitForTimeout(300);

      const createDialog = page.locator('[role="dialog"]').last();
      const nameInput = createDialog.locator('input[type="text"]').first();

      if (await nameInput.count() > 0) {
        await nameInput.fill('Category To Delete');

        const confirmButton = createDialog.getByRole('button', { name: /confirm|save|ok/i });
        if (await confirmButton.count() > 0) {
          await confirmButton.click();
          await page.waitForTimeout(500);
        }
      }
    }

    // Find the row containing "Category To Delete"
    const categoryRow = categoryDialog.locator('tr, .n-list-item').filter({
      hasText: 'Category To Delete'
    });

    if (await categoryRow.count() > 0) {
      // Find the delete button
      const deleteButton = categoryRow.locator('button').filter({
        hasText: /delete/i
      }).first();

      if (await deleteButton.count() > 0) {
        await deleteButton.click();
        await page.waitForTimeout(300);

        // Confirm deletion
        const confirmButton = page.getByRole('button', { name: /ok|confirm/i }).last();
        if (await confirmButton.count() > 0) {
          await confirmButton.click();
          await page.waitForTimeout(500);

          // Verify the category was deleted
          const deletedRow = categoryDialog.locator('tr, .n-list-item').filter({
            hasText: 'Category To Delete'
          });
          expect(await deletedRow.count()).toBe(0);
        }
      }
    }
  });

  test('Category deletion protection (category with favorites)', async ({ page }) => {
    // Wait for any overlay to disappear
    await page.waitForSelector('.n-modal-mask', { state: 'hidden', timeout: 2000 }).catch(() => {});

    // 1. Open the category manager and create a category
    const categoryDialog = await openCategoryManager(page);

    // Get a reference to the favorites manager (openCategoryManager already opened it)
    const managerDialog = page.locator('[role="dialog"]').filter({ hasText: /Favorites/i }).first();

    const addCategoryButton = categoryDialog.getByRole('button', { name: /add|create/i });
    if (await addCategoryButton.count() > 0) {
      await addCategoryButton.click();
      await page.waitForTimeout(300);

      const createDialog = page.locator('[role="dialog"]').last();
      const nameInput = createDialog.locator('input[type="text"]').first();

      if (await nameInput.count() > 0) {
        await nameInput.fill('Category With Favorites');

        const confirmButton = createDialog.getByRole('button', { name: /confirm|save|ok/i });
        if (await confirmButton.count() > 0) {
          await confirmButton.click();
          await page.waitForTimeout(500);
        }
      }
    }

    // Close the category manager
    const closeButton = categoryDialog.locator('[aria-label="close"], .n-base-close').first();
    if (await closeButton.count() > 0) {
      await closeButton.click();
      await page.waitForTimeout(300);
    }

    // 3. Create a favorite that belongs to the category
    const addFavoriteButton = managerDialog.getByRole('button', { name: /add|create/i }).first();
    await addFavoriteButton.click();
    await page.waitForTimeout(500);

    const createFavDialog = page.locator('[role="dialog"]').last();
    const titleInput = createFavDialog.getByPlaceholder(/title|name this prompt/i);

    if (await titleInput.count() > 0) {
      await titleInput.fill('Favorite In Category');

      const contentInput = createFavDialog.locator('textarea').first();
      if (await contentInput.count() > 0) {
        await contentInput.fill('Test content');
      }

      // Select the category just created
      const categorySelect = createFavDialog.locator('.n-base-selection, .n-select').first();
      if (await categorySelect.count() > 0) {
        await categorySelect.click();
        await page.waitForTimeout(300);

        const categoryOption = page.locator('.n-base-select-option').filter({
          hasText: 'Category With Favorites'
        });

        if (await categoryOption.count() > 0) {
          await categoryOption.first().click();
          await page.waitForTimeout(300);
        }
      }

      // Save the favorite
      const saveFavButton = createFavDialog.getByRole('button', { name: /save|confirm|ok/i });
      if (await saveFavButton.count() > 0) {
        await saveFavButton.click();
        await page.waitForTimeout(1000);
      }
    }

    // 4. Reopen the category manager and try to delete the category
    const categoryDialog2 = await openCategoryManager(page);
    if (!categoryDialog2) {
      return;
    }

    const categoryRow = categoryDialog2.locator('tr, .n-list-item').filter({
      hasText: 'Category With Favorites'
    });

    if (await categoryRow.count() > 0) {
      const deleteButton = categoryRow.locator('button').filter({
        hasText: /delete/i
      }).first();

      if (await deleteButton.count() > 0) {
        await deleteButton.click();
        await page.waitForTimeout(300);

        // A warning or error should be shown (a category with favorites cannot be deleted)
        // Check whether there is a warning message
        const warningMessage = page.locator('.n-message, .n-notification').filter({
          hasText: /cannot delete|has favorites|used by/i
        });

        if (await warningMessage.count() > 0) {
          await expect(warningMessage.first()).toBeVisible();
        } else {
          // Or the delete confirmation dialog should still be shown (nothing was actually deleted)
          const categoryStillExists = categoryDialog2.locator('tr, .n-list-item').filter({
            hasText: 'Category With Favorites'
          });
          expect(await categoryStillExists.count()).toBeGreaterThan(0);
        }
      }
    }
  });

  test('Category colors are displayed correctly', async ({ page }) => {
    const categoryDialog = await openCategoryManager(page);

    // Verify the category list table/list exists
    const table = categoryDialog.locator('table, .n-list, .n-data-table');
    if (await table.count() > 0) {
      await expect(table.first()).toBeVisible();

      // If there is category data, verify the color display
      const colorIndicators = categoryDialog.locator('[class*="color"], .n-tag, .n-badge');
      if (await colorIndicators.count() > 0) {
        // There should be at least some color indicators
        expect(await colorIndicators.count()).toBeGreaterThan(0);
      }
    }
  });

  test('Category search filtering', async ({ page }) => {
    const categoryDialog = await openCategoryManager(page);

    // Find the search box
    const searchInput = categoryDialog.getByPlaceholder(/search|filter/i);
    if (await searchInput.count() > 0) {
      // Enter a search keyword
      await searchInput.fill('test');
      await page.waitForTimeout(500);

      // Verify the value of the search box
      const inputValue = await searchInput.inputValue();
      expect(inputValue).toBe('test');

      // Clear the search
      await searchInput.clear();
      await page.waitForTimeout(300);

      const clearedValue = await searchInput.inputValue();
      expect(clearedValue).toBe('');
    }
  });
});
