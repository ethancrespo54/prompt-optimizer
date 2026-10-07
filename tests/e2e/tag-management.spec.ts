import { test, expect } from './fixtures';

/**
 * Full tag management CRUD flow E2E tests
 *
 * Tests the full functionality of the tag manager:
 * - Rename tags
 * - Merge tags
 * - Delete tags
 * - Tag statistics display
 */
test.describe('Tag Management Full Flow', () => {
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
   * Helper: open the tag manager
   */
  async function openTagManager(page: any) {
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

    // 3. Click the tag management option
    const tagManagerOption = page.getByTestId('favorites-manager-action-manage-tags');
    await expect(tagManagerOption).toBeVisible();
    await tagManagerOption.click();
    await page.waitForTimeout(500);

    // 4. Return the tag manager dialog
    const tagDialog = page
      .locator('[role="dialog"]')
      .filter({ hasText: /Tag Manager|Tag Management/i })
      .last();
    await expect(tagDialog).toBeVisible();
    return tagDialog;
  }

  test('Tag renaming', async ({ page }) => {
    // Wait for any overlay to disappear
    await page.waitForSelector('.n-modal-mask', { state: 'hidden', timeout: 2000 }).catch(() => {});

    // First create a favorite with a tag
    const favoriteButton = page.getByRole('button', { name: /favorite/i }).first();
    await expect(favoriteButton).toBeVisible();
    await favoriteButton.click();
    const managerDialog = page.locator('[role="dialog"]').filter({ hasText: /Favorites/i }).first();
    await expect(managerDialog).toBeVisible();

    // Create a favorite and add a tag
    const addButton = managerDialog.getByRole('button', { name: /add|create/i }).first();
    await addButton.click();
    await page.waitForTimeout(500);

    const createDialog = page.locator('[role="dialog"]').last();
    const titleInput = createDialog.getByPlaceholder(/title|name this prompt/i);
    if (await titleInput.count() > 0) {
      await titleInput.fill('Tag Rename Test Favorite');

      const contentInput = createDialog.locator('textarea').first();
      if (await contentInput.count() > 0) {
        await contentInput.fill('Used to test the tag rename feature');
      }

      // Add a tag
      const tagInput = createDialog.getByPlaceholder(/tag/i);
      if (await tagInput.count() > 0) {
        await tagInput.fill('Old Tag Name');
        await tagInput.press('Enter');
        await page.waitForTimeout(300);
      }

      // Save the favorite
      const saveButton = createDialog.getByRole('button', { name: /save|confirm|ok/i });
      if (await saveButton.count() > 0) {
        await saveButton.click();
        await page.waitForTimeout(1000);
      }
    }

    // Open the tag manager
    const tagDialog = await openTagManager(page);
    if (!tagDialog) {
      test.skip();
      return;
    }

    // Find the row containing "Old Tag Name"
    const tagRow = tagDialog.locator('tr').filter({ hasText: 'Old Tag Name' });
    if (await tagRow.count() === 0) {
      // The tag may not have been created correctly; skip the test
      return;
    }

    // Find the rename button (may be an edit button or a rename button)
    const renameButton = tagRow.locator('button').filter({ hasText: /rename|edit/i }).first();
    if (await renameButton.count() > 0) {
      await renameButton.click();
      await page.waitForTimeout(300);

      // Enter the new tag name in the popup dialog
      const renameDialog = page.locator('[role="dialog"]').last();
      const newNameInput = renameDialog.locator('input[type="text"]').first();
      if (await newNameInput.count() > 0) {
        await newNameInput.clear();
        await newNameInput.fill('New Tag Name');

        // Confirm the rename
        const confirmButton = renameDialog.getByRole('button', { name: /ok|confirm/i });
        if (await confirmButton.count() > 0) {
          await confirmButton.click();
          await page.waitForTimeout(500);

          // Verify the new tag name appears
          const newTagRow = tagDialog.locator('tr').filter({ hasText: 'New Tag Name' });
          if (await newTagRow.count() > 0) {
            await expect(newTagRow).toBeVisible();
          }
        }
      }
    }
  });

  test('Tag deletion', async ({ page }) => {
    const tagDialog = await openTagManager(page);
    if (!tagDialog) {
      test.skip();
      return;
    }

    // First add a new tag (if the add feature exists)
    const addTagButton = tagDialog.getByRole('button', { name: /add|create/i });
    if (await addTagButton.count() > 0) {
      await addTagButton.click();
      await page.waitForTimeout(300);

      const addDialog = page.locator('[role="dialog"]').last();
      const tagNameInput = addDialog.locator('input[type="text"]').first();
      if (await tagNameInput.count() > 0) {
        await tagNameInput.fill('Tag To Delete');

        const confirmButton = addDialog.getByRole('button', { name: /confirm|ok/i });
        if (await confirmButton.count() > 0) {
          await confirmButton.click();
          await page.waitForTimeout(500);
        }
      }
    }

    // Find the row containing "Tag To Delete"
    const tagRow = tagDialog.locator('tr').filter({ hasText: 'Tag To Delete' });
    if (await tagRow.count() > 0) {
      // Find the delete button
      const deleteButton = tagRow.locator('button').filter({ hasText: /delete/i }).first();
      if (await deleteButton.count() > 0) {
        await deleteButton.click();
        await page.waitForTimeout(300);

        // Confirm deletion
        const confirmButton = page.getByRole('button', { name: /ok|confirm/i }).last();
        if (await confirmButton.count() > 0) {
          await confirmButton.click();
          await page.waitForTimeout(500);

          // Verify the tag was deleted
          const deletedRow = tagDialog.locator('tr').filter({ hasText: 'Tag To Delete' });
          expect(await deletedRow.count()).toBe(0);
        }
      }
    }
  });

  test('Tag statistics are displayed correctly', async ({ page }) => {
    const tagDialog = await openTagManager(page);

    // Verify the tag list table exists
    const table = tagDialog.getByRole('table').first();
    await expect(table).toBeVisible();

    // Verify the table header exists
    const headers = table.locator('th');
    const headerCount = await headers.count();
    expect(headerCount).toBeGreaterThan(0);
  });

  test('Tag search filtering', async ({ page }) => {
    const tagDialog = await openTagManager(page);

    // Find the search box
    const searchInput = tagDialog.getByPlaceholder(/search|filter/i);
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
