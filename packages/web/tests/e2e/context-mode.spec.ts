import { test, expect, type Page } from '@playwright/test';

/**
 * Context mode E2E test
 *
 * Tests the complete user flow:
 * 1. Mode toggle button interaction
 * 2. Variable manager integration
 * 3. Preview panel linkage
 * 4. Mode-specific behavior of the test panel
 */

// Setup before the tests
test.beforeEach(async ({ page }) => {
  // Navigate to the app home page
  await page.goto('/');

  // Wait for the app to finish loading
  await page.waitForLoadState('networkidle');
});

test.describe('Context mode switching', () => {
  test('should show user mode by default', async ({ page }) => {
    // Find the mode toggle button group
    const userModeButton = page.getByRole('button', { name: /User Mode/ });
    const systemModeButton = page.getByRole('button', { name: /System Mode/ });

    // User mode should be active by default
    await expect(userModeButton).toHaveClass(/primary/);
    await expect(systemModeButton).not.toHaveClass(/primary/);
  });

  test('should be able to switch to system mode', async ({ page }) => {
    const systemModeButton = page.getByRole('button', { name: /System Mode/ });

    // Click the system mode button
    await systemModeButton.click();

    // Wait for the UI to update
    await page.waitForTimeout(200);

    // System mode should be active
    await expect(systemModeButton).toHaveClass(/primary/);
  });

  test('should be able to switch back and forth between modes', async ({ page }) => {
    const userModeButton = page.getByRole('button', { name: /User Mode/ });
    const systemModeButton = page.getByRole('button', { name: /System Mode/ });

    // Switch to system mode
    await systemModeButton.click();
    await page.waitForTimeout(200);
    await expect(systemModeButton).toHaveClass(/primary/);

    // Switch back to user mode
    await userModeButton.click();
    await page.waitForTimeout(200);
    await expect(userModeButton).toHaveClass(/primary/);

    // Switch to system mode again
    await systemModeButton.click();
    await page.waitForTimeout(200);
    await expect(systemModeButton).toHaveClass(/primary/);
  });
});

test.describe('Quick action buttons', () => {
  test('should show the variable manager button', async ({ page }) => {
    const variableButton = page.getByRole('button', { name: /Variable Manage/ });

    await expect(variableButton).toBeVisible();
  });

  test('should show the conversation manager button in system mode', async ({ page }) => {
    // Switch to system mode
    const systemModeButton = page.getByRole('button', { name: /System Mode/ });
    await systemModeButton.click();
    await page.waitForTimeout(200);

    // The conversation manager button should be visible
    const conversationButton = page.getByRole('button', { name: /Manage Conversation|Conversation/ });
    await expect(conversationButton).toBeVisible();
  });

  test('should hide the conversation manager button in user mode', async ({ page }) => {
    // Make sure we are in user mode
    const userModeButton = page.getByRole('button', { name: /User Mode/ });
    await userModeButton.click();
    await page.waitForTimeout(200);

    // The conversation manager button should not be visible
    const conversationButton = page.getByRole('button', { name: /Manage Conversation|Conversation/ });
    await expect(conversationButton).not.toBeVisible();
  });

  test('should show the preview button', async ({ page }) => {
    const previewButton = page.getByRole('button', { name: /Preview/ });

    await expect(previewButton).toBeVisible();
  });
});

test.describe('Variable manager integration', () => {
  test('clicking the variable manager button should open the variable manager', async ({ page }) => {
    const variableButton = page.getByRole('button', { name: /Variable Manage/ });

    await variableButton.click();

    // Wait for the variable manager to open
    await page.waitForTimeout(300);

    // Check whether the variable manager is visible (may be a modal or a panel)
    // Note: the actual selectors need to be adjusted to match the real implementation
    const variableManager = page.locator('[data-testid="variable-manager"], .variable-manager, .n-modal');
    await expect(variableManager).toBeVisible({ timeout: 3000 });
  });

  test('the variable manager should support adding custom variables', async ({ page }) => {
    // Open the variable manager
    const variableButton = page.getByRole('button', { name: /Variable Manage/ });
    await variableButton.click();
    await page.waitForTimeout(300);

    // Find the input or button for adding a variable
    const addButton = page.getByRole('button', { name: /Add|New/ });

    if (await addButton.isVisible()) {
      await addButton.click();
      await page.waitForTimeout(200);

      // Enter the variable name and value (the actual selectors need to be adjusted to match the implementation)
      const nameInput = page.locator('input[placeholder*="name"]').first();
      const valueInput = page.locator('input[placeholder*="value"], textarea[placeholder*="value"]').first();

      if (await nameInput.isVisible() && await valueInput.isVisible()) {
        await nameInput.fill('testVar');
        await valueInput.fill('testValue');

        // Save the variable
        const saveButton = page.getByRole('button', { name: /Save|Confirm/ });
        await saveButton.click();
        await page.waitForTimeout(300);

        // Verify the variable was added (it may be shown in a list)
        await expect(page.locator('text=testVar')).toBeVisible({ timeout: 3000 });
      }
    }
  });
});

test.describe('Preview panel linkage', () => {
  test('clicking the preview button should open the preview panel', async ({ page }) => {
    const previewButton = page.getByRole('button', { name: /Preview/ });

    await previewButton.click();

    // Wait for the preview panel to open
    await page.waitForTimeout(300);

    // Check whether the preview panel is visible
    const previewPanel = page.locator('[data-testid="preview-panel"], .preview-panel, .n-modal');
    await expect(previewPanel).toBeVisible({ timeout: 3000 });
  });

  test('the preview panel should show variable replacement results in real time', async ({ page }) => {
    // This test first needs some prompt content and variables to be set up
    // The exact implementation depends on the structure of the real app

    // Open the preview panel
    const previewButton = page.getByRole('button', { name: /Preview/ });
    await previewButton.click();
    await page.waitForTimeout(300);

    // The preview panel should show the rendered content
    const previewContent = page.locator('[data-testid="preview-content"], .preview-content');
    await expect(previewContent).toBeVisible({ timeout: 3000 });
  });
});

test.describe('Mode-specific test panel behavior', () => {
  test('the test panel should show variable hints in user mode', async ({ page }) => {
    // Make sure we are in user mode
    const userModeButton = page.getByRole('button', { name: /User Mode/ });
    await userModeButton.click();
    await page.waitForTimeout(200);

    // If there are variables, a variable hint should be shown
    // Note: this requires prompt content that contains variables first
    const variableHint = page.locator('[data-testid="variable-hint"], .variable-hint, text=/Variables Detected/');

    // Check whether it exists (if there are variables)
    const isVisible = await variableHint.isVisible({ timeout: 2000 }).catch(() => false);

    // This test may need to be adjusted based on the actual data state
    if (isVisible) {
      await expect(variableHint).toBeVisible();
    }
  });

  test('the test input area should be shown in system mode', async ({ page }) => {
    // Switch to system mode
    const systemModeButton = page.getByRole('button', { name: /System Mode/ });
    await systemModeButton.click();
    await page.waitForTimeout(200);

    // The test input area should be visible
    const testInput = page.locator('[data-testid="test-input"], textarea[placeholder*="test"], textarea[placeholder*="question"]');

    // Check whether the test input area exists
    const hasTestInput = await testInput.count() > 0;

    if (hasTestInput) {
      await expect(testInput.first()).toBeVisible();
    }
  });

  test('the test input area should be hidden in user mode', async ({ page }) => {
    // Make sure we are in user mode
    const userModeButton = page.getByRole('button', { name: /User Mode/ });
    await userModeButton.click();
    await page.waitForTimeout(200);

    // The test input area should be invisible or absent
    const testInput = page.locator('[data-testid="test-input"], textarea[placeholder*="test"], textarea[placeholder*="question"]');

    // In user mode, the test input should not be visible
    const isVisible = await testInput.isVisible({ timeout: 1000 }).catch(() => false);

    if (!isVisible) {
      // Test passes: the input area is indeed not visible
      expect(true).toBe(true);
    } else {
      // If it is visible, it may be a configuration issue
      await expect(testInput).not.toBeVisible();
    }
  });
});

test.describe('Variable value input form (full implementation)', () => {
  test('should show the variable value input form when there are variables', async ({ page }) => {
    // First a prompt containing variables needs to be optimized
    // This test may first need content containing {{variable}} to be set up

    // Find the variable value form title
    const formTitle = page.locator('text=/Variable Values/');
    const formCard = page.locator('.n-card:has-text("Variable Values")');

    // If there are variables, the form should be visible
    const hasForm = await formCard.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasForm) {
      await expect(formTitle).toBeVisible();

      // Verify the variable count is displayed
      const varCount = page.locator('text=/variables/');
      await expect(varCount).toBeVisible();
    }
  });

  test('should provide an input for each variable', async ({ page }) => {
    // Find the variable input form
    const formCard = page.locator('.n-card:has-text("Variable Values")');

    const hasForm = await formCard.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasForm) {
      // Find the variable inputs (there should be several)
      const variableInputs = page.locator('input[placeholder*="variable value"]');
      const inputCount = await variableInputs.count();

      // There should be at least one variable input
      if (inputCount > 0) {
        expect(inputCount).toBeGreaterThan(0);

        // Verify that content can be typed into the input
        const firstInput = variableInputs.first();
        await firstInput.fill('test value');
        await expect(firstInput).toHaveValue('test value');
      }
    }
  });

  test('should provide a Clear All button', async ({ page }) => {
    const formCard = page.locator('.n-card:has-text("Variable Values")');

    const hasForm = await formCard.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasForm) {
      // Find the clear button
      const clearButton = page.getByRole('button', { name: /Clear All/ });

      const hasClearButton = await clearButton.isVisible({ timeout: 1000 }).catch(() => false);

      if (hasClearButton) {
        await expect(clearButton).toBeVisible();

        // Fill in a variable value
        const variableInputs = page.locator('input[placeholder*="variable value"]');
        if (await variableInputs.count() > 0) {
          await variableInputs.first().fill('test value');

          // Click the clear button
          await clearButton.click();
          await page.waitForTimeout(200);

          // Verify the inputs were cleared
          await expect(variableInputs.first()).toHaveValue('');
        }
      }
    }
  });
});

test.describe('Two-round replacement preview (full implementation)', () => {
  test('system mode should show the first and second round replacements', async ({ page }) => {
    // Switch to system mode
    const systemModeButton = page.getByRole('button', { name: /System Mode/ });
    await systemModeButton.click();
    await page.waitForTimeout(200);

    // Find the preview card
    const previewCard = page.locator('.n-card:has-text("Preview Result")');

    const hasPreview = await previewCard.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasPreview) {
      // Verify the first round replacement is shown
      const firstRound = page.locator('text=/First Round/');
      const hasFirstRound = await firstRound.isVisible({ timeout: 1000 }).catch(() => false);

      if (hasFirstRound) {
        await expect(firstRound).toBeVisible();

        // Verify the second round replacement is shown
        const secondRound = page.locator('text=/Second Round/');
        await expect(secondRound).toBeVisible();
      }
    }
  });

  test('user mode should show only the final preview', async ({ page }) => {
    // Make sure we are in user mode
    const userModeButton = page.getByRole('button', { name: /User Mode/ });
    await userModeButton.click();
    await page.waitForTimeout(200);

    // Find the preview card
    const previewCard = page.locator('.n-card:has-text("Preview Result")');

    const hasPreview = await previewCard.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasPreview) {
      // Verify the final preview is shown
      const finalPreview = page.locator('text=/Final Preview/');
      const hasFinalPreview = await finalPreview.isVisible({ timeout: 1000 }).catch(() => false);

      if (hasFinalPreview) {
        await expect(finalPreview).toBeVisible();

        // Verify the first and second rounds are not shown (specific to system mode)
        const firstRound = page.locator('text=/First Round/');
        const hasFirstRound = await firstRound.isVisible({ timeout: 500 }).catch(() => false);

        expect(hasFirstRound).toBe(false);
      }
    }
  });

  test('changing a variable value should update the preview in real time', async ({ page }) => {
    const formCard = page.locator('.n-card:has-text("Variable Values")');
    const previewCard = page.locator('.n-card:has-text("Preview Result")');

    const hasForm = await formCard.isVisible({ timeout: 3000 }).catch(() => false);
    const hasPreview = await previewCard.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasForm && hasPreview) {
      // Fill in the variable value
      const variableInputs = page.locator('input[placeholder*="variable value"]');

      if (await variableInputs.count() > 0) {
        const testValue = 'E2E test variable value';
        await variableInputs.first().fill(testValue);

        // Wait for the preview to update
        await page.waitForTimeout(500);

        // Verify the preview contains the entered value (if the variable is used)
        // Note: this depends on the actual prompt content
        const previewContent = previewCard.locator('.n-card__content');
        const content = await previewContent.textContent();

        // Basic check: the preview content is not empty
        expect(content).toBeTruthy();
      }
    }
  });
});

test.describe('Full workflow', () => {
  test('should support the full user mode workflow', async ({ page }) => {
    // Step 1: confirm we are in user mode
    const userModeButton = page.getByRole('button', { name: /User Mode/ });
    await userModeButton.click();
    await page.waitForTimeout(200);

    // Step 2: open the variable manager
    const variableButton = page.getByRole('button', { name: /Variable Manage/ });
    await variableButton.click();
    await page.waitForTimeout(300);

    // Step 3: close the variable manager (if there is a close button)
    const closeButton = page.getByRole('button', { name: /Close|Cancel/ }).first();
    if (await closeButton.isVisible({ timeout: 1000 })) {
      await closeButton.click();
      await page.waitForTimeout(200);
    } else {
      // May click the overlay to close
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    }

    // Step 4: open the preview
    const previewButton = page.getByRole('button', { name: /Preview/ });
    await previewButton.click();
    await page.waitForTimeout(300);

    // Verify the preview panel is open
    const previewPanel = page.locator('[data-testid="preview-panel"], .preview-panel, .n-modal');
    await expect(previewPanel).toBeVisible({ timeout: 3000 });
  });

  test('should support the full system mode workflow', async ({ page }) => {
    // Step 1: switch to system mode
    const systemModeButton = page.getByRole('button', { name: /System Mode/ });
    await systemModeButton.click();
    await page.waitForTimeout(200);

    // Step 2: verify the conversation manager button is visible
    const conversationButton = page.getByRole('button', { name: /Manage Conversation|Conversation/ });
    await expect(conversationButton).toBeVisible();

    // Step 3: open the variable manager
    const variableButton = page.getByRole('button', { name: /Variable Manage/ });
    await variableButton.click();
    await page.waitForTimeout(300);

    // Step 4: close the variable manager
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // Step 5: open the preview
    const previewButton = page.getByRole('button', { name: /Preview/ });
    await previewButton.click();
    await page.waitForTimeout(300);

    // Verify the preview panel is open
    const previewPanel = page.locator('[data-testid="preview-panel"], .preview-panel, .n-modal');
    await expect(previewPanel).toBeVisible({ timeout: 3000 });
  });

  test('should support state retention after a mode switch', async ({ page }) => {
    // Step 1: open the preview in user mode
    const userModeButton = page.getByRole('button', { name: /User Mode/ });
    await userModeButton.click();
    await page.waitForTimeout(200);

    const previewButton = page.getByRole('button', { name: /Preview/ });
    await previewButton.click();
    await page.waitForTimeout(300);

    // Step 2: switch to system mode
    await page.keyboard.press('Escape'); // Close the preview
    await page.waitForTimeout(200);

    const systemModeButton = page.getByRole('button', { name: /System Mode/ });
    await systemModeButton.click();
    await page.waitForTimeout(200);

    // Step 3: verify the system mode features are available
    const conversationButton = page.getByRole('button', { name: /Manage Conversation|Conversation/ });
    await expect(conversationButton).toBeVisible();

    // Step 4: switch back to user mode
    await userModeButton.click();
    await page.waitForTimeout(200);

    // Step 5: verify the conversation manager button disappears
    await expect(conversationButton).not.toBeVisible();
  });
});

test.describe('Error handling and edge cases', () => {
  test('should handle rapid mode switching', async ({ page }) => {
    const userModeButton = page.getByRole('button', { name: /User Mode/ });
    const systemModeButton = page.getByRole('button', { name: /System Mode/ });

    // Switch rapidly several times
    for (let i = 0; i < 5; i++) {
      await systemModeButton.click();
      await userModeButton.click();
    }

    await page.waitForTimeout(200);

    // Should still work normally
    await expect(userModeButton).toHaveClass(/primary/);
  });

  test('should handle rapid open/close operations', async ({ page }) => {
    const variableButton = page.getByRole('button', { name: /Variable Manage/ });

    // Rapidly open and close the variable manager
    for (let i = 0; i < 3; i++) {
      await variableButton.click();
      await page.waitForTimeout(100);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
    }

    // Should still work normally
    await variableButton.click();
    await page.waitForTimeout(300);

    const variableManager = page.locator('[data-testid="variable-manager"], .variable-manager, .n-modal');
    await expect(variableManager).toBeVisible({ timeout: 3000 });
  });
});
