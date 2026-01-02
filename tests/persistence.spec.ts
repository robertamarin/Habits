import { test, expect } from '@playwright/test';

test.describe('Data Persistence Tests', () => {
  const testEmail = `test${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8000');
  });

  test('should persist habits after refresh', async ({ page }) => {
    // Sign up
    await page.fill('#signup-email', testEmail);
    await page.fill('#signup-password', testPassword);
    await page.click('#signup-form button[type="submit"]');

    // Wait for auth to complete and app to load
    await page.waitForSelector('#app-shell:not(.hidden)', { timeout: 10000 });

    // Open settings
    await page.click('#settings-button-top');
    await page.waitForSelector('#settings-modal[open]');

    // Add a habit
    const habitName = `Test Habit ${Date.now()}`;
    await page.fill('#habit-input', habitName);
    await page.click('#habit-submit');

    // Wait for habit to be added to library
    await page.waitForSelector(`#library-list :text("${habitName}")`, { timeout: 5000 });

    // Close settings
    await page.click('#close-settings');

    // Verify habit appears in today's habits
    await page.waitForSelector(`#habit-list :text("${habitName}")`, { timeout: 5000 });

    // Refresh the page
    await page.reload();

    // Wait for app to load again
    await page.waitForSelector('#app-shell:not(.hidden)', { timeout: 10000 });

    // Open settings to check if habit persisted
    await page.click('#settings-button-top');
    await page.waitForSelector('#settings-modal[open]');

    // Verify habit is still there
    const habitExists = await page.locator(`#library-list :text("${habitName}")`).count();
    expect(habitExists).toBeGreaterThan(0);

    console.log('✓ Habit persisted after refresh');
  });

  test('should persist goal after refresh', async ({ page }) => {
    // Sign in with the same account
    await page.fill('#signin-email', testEmail);
    await page.fill('#signin-password', testPassword);
    await page.click('#signin-form button[type="submit"]');

    // Wait for auth
    await page.waitForSelector('#app-shell:not(.hidden)', { timeout: 10000 });

    // Open settings
    await page.click('#settings-button-top');
    await page.waitForSelector('#settings-modal[open]');

    // Add a goal
    const goalText = `Test Goal ${Date.now()}`;
    await page.fill('#goal-input', goalText);
    await page.click('#goal-form button[type="submit"]');

    // Wait for goal to appear
    await page.waitForSelector(`#goal-manage-list :text("${goalText}")`, { timeout: 5000 });

    // Refresh the page
    await page.reload();

    // Wait for app to load
    await page.waitForSelector('#app-shell:not(.hidden)', { timeout: 10000 });

    // Open settings
    await page.click('#settings-button-top');
    await page.waitForSelector('#settings-modal[open]');

    // Verify goal persisted
    const goalExists = await page.locator(`#goal-manage-list :text("${goalText}")`).count();
    expect(goalExists).toBeGreaterThan(0);

    console.log('✓ Goal persisted after refresh');
  });

  test('should persist habit completion after refresh', async ({ page }) => {
    // Sign in
    await page.fill('#signin-email', testEmail);
    await page.fill('#signin-password', testPassword);
    await page.click('#signin-form button[type="submit"]');

    // Wait for auth
    await page.waitForSelector('#app-shell:not(.hidden)', { timeout: 10000 });

    // Wait for habits to load
    await page.waitForTimeout(2000);

    // Find first habit checkbox
    const habitCheckbox = page.locator('#habit-list input[type="checkbox"]').first();
    const habitExists = await habitCheckbox.count() > 0;

    if (habitExists) {
      // Check the checkbox
      await habitCheckbox.check();

      // Wait a bit for the save to complete
      await page.waitForTimeout(2000);

      // Refresh the page
      await page.reload();

      // Wait for app to load
      await page.waitForSelector('#app-shell:not(.hidden)', { timeout: 10000 });
      await page.waitForTimeout(2000);

      // Verify checkbox is still checked
      const isChecked = await page.locator('#habit-list input[type="checkbox"]').first().isChecked();
      expect(isChecked).toBe(true);

      console.log('✓ Habit completion persisted after refresh');
    } else {
      console.log('⚠ No habits to test completion');
    }
  });
});
