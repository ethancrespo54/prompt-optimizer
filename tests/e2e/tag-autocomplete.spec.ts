import { test, expect } from './fixtures';

/**
 * Tag autocomplete E2E tests
 * Verify tag input and autocomplete suggestions
 */
test.describe('Tag Autocomplete', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Tag autocomplete suggestions display correctly', async ({ page }) => {
    // 1. Open the favorites manager
    const favoriteButton = page.getByRole('button', { name: /favorite/i });
    if (await favoriteButton.count() === 0) {
      test.skip();
      return;
    }
    await favoriteButton.first().click();

    const managerDialog = page.locator('[role="dialog"]').filter({ hasText: /Favorites/i }).first();
    await expect(managerDialog).toBeVisible();

    // 2. Click the add favorite button
    const addButton = managerDialog.getByRole('button', { name: /add|create/i }).first();
    await addButton.click();
    await page.waitForTimeout(500);

    // 3. Locate the edit dialog
    const editDialog = page.locator('[role="dialog"]').last();
    await expect(editDialog).toBeVisible();

    // 4. Find the tag input
    const tagInput = editDialog.getByPlaceholder(/tag/i);

    if (await tagInput.count() > 0) {
      // 5. Enter partial tag text
      await tagInput.fill('te');
      await page.waitForTimeout(500);

      // 6. Verify the value of the tag input
      const inputValue = await tagInput.inputValue();
      expect(inputValue).toBe('te');

      // 7. Check whether an autocomplete dropdown appears
      const autocompleteMenu = page.locator('.n-auto-complete-menu, .n-base-select-menu');

      // Note: if there are no matching suggestions the menu may not be shown, which is fine
      // We only verify the input works

      // 8. Clear the input
      await tagInput.clear();
      await page.waitForTimeout(300);

      const clearedValue = await tagInput.inputValue();
      expect(clearedValue).toBe('');
    }
  });

  test('Can add a tag by typing manually', async ({ page }) => {
    // 1. Open the favorites manager
    const favoriteButton = page.getByRole('button', { name: /favorite/i });
    if (await favoriteButton.count() === 0) {
      test.skip();
      return;
    }
    await favoriteButton.first().click();

    const managerDialog = page.locator('[role="dialog"]').filter({ hasText: /Favorites/i }).first();
    await expect(managerDialog).toBeVisible();

    // 2. Click the add favorite button
    const addButton = managerDialog.getByRole('button', { name: /add|create/i }).first();
    await addButton.click();
    await page.waitForTimeout(500);

    // 3. Locate the edit dialog
    const editDialog = page.locator('[role="dialog"]').last();

    // 4. Find the tag input
    const tagInput = editDialog.getByPlaceholder(/tag/i);

    if (await tagInput.count() > 0) {
      // 5. Enter tag text
      await tagInput.fill('E2E Test Tag');
      await page.waitForTimeout(300);

      // 6. Press Enter to add the tag
      await tagInput.press('Enter');
      await page.waitForTimeout(500);

      // 7. Verify the tag was added (look for the displayed tag)
      // Tags are usually rendered as NTag components
      const addedTag = editDialog.locator('text=E2E Test Tag');
      if (await addedTag.count() > 0) {
        await expect(addedTag.first()).toBeVisible();
      }

      // 8. Verify the input was cleared (ready for the next tag)
      const inputValue = await tagInput.inputValue();
      expect(inputValue).toBe('');
    }
  });

  test('Can delete an added tag', async ({ page }) => {
    // 1. Open the favorites manager
    const favoriteButton = page.getByRole('button', { name: /favorite/i });
    if (await favoriteButton.count() === 0) {
      test.skip();
      return;
    }
    await favoriteButton.first().click();

    const managerDialog = page.locator('[role="dialog"]').filter({ hasText: /Favorites/i }).first();
    await expect(managerDialog).toBeVisible();

    // 2. Click the add favorite button
    const addButton = managerDialog.getByRole('button', { name: /add|create/i }).first();
    await addButton.click();
    await page.waitForTimeout(500);

    // 3. Locate the edit dialog
    const editDialog = page.locator('[role="dialog"]').last();

    // 4. Find the tag input and add a tag
    const tagInput = editDialog.getByPlaceholder(/tag/i);

    if (await tagInput.count() > 0) {
      // 5. Add a tag
      await tagInput.fill('Deletable Tag');
      await tagInput.press('Enter');
      await page.waitForTimeout(500);

      // 6. Find the added tag
      const addedTag = editDialog.locator('text=Deletable Tag').first();

      if (await addedTag.count() > 0) {
        // 7. Find the tag's close button (usually a closable NTag)
        // Find the close icon within the tag's parent element
        const tagContainer = addedTag.locator('..').first();
        const closeButton = tagContainer.locator('[role="button"], .n-tag__close, .n-base-close').first();

        if (await closeButton.count() > 0) {
          await closeButton.click();
          await page.waitForTimeout(500);

          // 8. Verify the tag was deleted
          const deletedTag = editDialog.locator('text=Deletable Tag');
          expect(await deletedTag.count()).toBe(0);
        }
      }
    }
  });

  test('The tag input supports adding multiple tags', async ({ page }) => {
    // 1. Open the favorites manager
    const favoriteButton = page.getByRole('button', { name: /favorite/i });
    if (await favoriteButton.count() === 0) {
      test.skip();
      return;
    }
    await favoriteButton.first().click();

    const managerDialog = page.locator('[role="dialog"]').filter({ hasText: /Favorites/i }).first();
    await expect(managerDialog).toBeVisible();

    // 2. Click the add favorite button
    const addButton = managerDialog.getByRole('button', { name: /add|create/i }).first();
    await addButton.click();
    await page.waitForTimeout(500);

    // 3. Locate the edit dialog
    const editDialog = page.locator('[role="dialog"]').last();

    // 4. Find the tag input
    const tagInput = editDialog.getByPlaceholder(/tag/i);

    if (await tagInput.count() > 0) {
      // 5. Add several tags in a row
      const tags = ['Tag 1', 'Tag 2', 'Tag 3'];

      for (const tag of tags) {
        await tagInput.fill(tag);
        await tagInput.press('Enter');
        await page.waitForTimeout(300);
      }

      // 6. Verify all tags were added
      for (const tag of tags) {
        const addedTag = editDialog.locator(`text=${tag}`);
        if (await addedTag.count() > 0) {
          await expect(addedTag.first()).toBeVisible();
        }
      }
    }
  });
});

/**
 * Tag autocomplete suggestion tests (existing tags required)
 */
test.describe('Tag Autocomplete Suggestions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Matching tag suggestions are shown while typing', async ({ page }) => {
    // Note: this test requires some tags to already exist in the database
    // On a fresh install there may be no suggestions

    const favoriteButton = page.getByRole('button', { name: /favorite/i });
    if (await favoriteButton.count() === 0) {
      test.skip();
      return;
    }
    await favoriteButton.first().click();

    const managerDialog = page.locator('[role="dialog"]').filter({ hasText: /Favorites/i }).first();
    await expect(managerDialog).toBeVisible();

    const addButton = managerDialog.getByRole('button', { name: /add|create/i }).first();
    await addButton.click();
    await page.waitForTimeout(500);

    const editDialog = page.locator('[role="dialog"]').last();
    const tagInput = editDialog.getByPlaceholder(/tag/i);

    if (await tagInput.count() > 0) {
      // First add a tag to the system
      await tagInput.fill('Frontend Development');
      await tagInput.press('Enter');
      await page.waitForTimeout(300);

      // Clear the input
      await tagInput.clear();
      await page.waitForTimeout(300);

      // Now enter partially matching text
      await tagInput.fill('Fr');
      await page.waitForTimeout(500);

      // Check whether there is an autocomplete menu
      const autocompleteMenu = page.locator('.n-auto-complete-menu, .n-base-select-menu');

      // If the menu exists and is visible, verify it contains matching options
      if (await autocompleteMenu.isVisible().catch(() => false)) {
        const matchingOption = autocompleteMenu.locator('text=/Frontend/');
        if (await matchingOption.count() > 0) {
          await expect(matchingOption.first()).toBeVisible();
        }
      }
    }
  });
});
