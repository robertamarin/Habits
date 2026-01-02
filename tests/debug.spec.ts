import { test, expect } from '@playwright/test';

test.describe('Debug Data Flow', () => {
  const testEmail = `debug${Date.now()}@example.com`;
  const testPassword = 'DebugPassword123!';

  test('debug habit save and load', async ({ page }) => {
    // Enable console logging
    page.on('console', msg => console.log('BROWSER:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err));

    await page.goto('http://localhost:8000');

    // Sign up
    console.log('Signing up with:', testEmail);
    await page.fill('#signup-email', testEmail);
    await page.fill('#signup-password', testPassword);
    await page.click('#signup-form button[type="submit"]');

    // Wait for auth and app to load
    await page.waitForSelector('#app-shell:not(.hidden)', { timeout: 15000 });
    console.log('✓ App loaded after signup');

    // Wait a bit for Firebase to be ready
    await page.waitForTimeout(2000);

    // Open settings
    await page.click('#settings-button-top');
    await page.waitForSelector('#settings-modal[open]');
    console.log('✓ Settings opened');

    // Add a habit
    const habitName = `Debug Habit ${Date.now()}`;
    console.log('Adding habit:', habitName);
    await page.fill('#habit-input', habitName);

    // Click submit and wait for the habit to appear in library
    await page.click('#habit-submit');
    await page.waitForTimeout(2000);

    // Check if habit is in the library
    const libraryCount = await page.locator('#library-list .row').count();
    console.log('Habits in library after add:', libraryCount);

    // Check localStorage
    const localStorage = await page.evaluate(() => {
      const stored = window.localStorage.getItem('habitFreshV1');
      return stored ? JSON.parse(stored) : null;
    });
    console.log('LocalStorage habits count:', localStorage?.habits?.length || 0);
    console.log('LocalStorage habits:', JSON.stringify(localStorage?.habits, null, 2));

    // Close settings
    await page.click('#close-settings');

    // Check if habit appears in checklist
    await page.waitForTimeout(1000);
    const checklistCount = await page.locator('#habit-list .row').count();
    console.log('Habits in checklist:', checklistCount);

    console.log('\n--- REFRESHING PAGE ---\n');

    // Refresh the page
    await page.reload();

    // Wait for app to load - this should auto-sign in
    try {
      await page.waitForSelector('#app-shell:not(.hidden)', { timeout: 15000 });
      console.log('✓ App loaded after refresh');
    } catch (e) {
      console.log('✗ App did not load after refresh - auth may have failed');
      const authPanelVisible = await page.locator('#auth-panel').isVisible();
      console.log('Auth panel visible:', authPanelVisible);
      throw e;
    }

    // Wait for data to load
    await page.waitForTimeout(3000);

    // Check localStorage after refresh
    const localStorageAfter = await page.evaluate(() => {
      const stored = window.localStorage.getItem('habitFreshV1');
      return stored ? JSON.parse(stored) : null;
    });
    console.log('LocalStorage habits count after refresh:', localStorageAfter?.habits?.length || 0);
    console.log('LocalStorage habits after refresh:', JSON.stringify(localStorageAfter?.habits, null, 2));

    // Open settings to check library
    await page.click('#settings-button-top');
    await page.waitForSelector('#settings-modal[open]');

    const libraryCountAfter = await page.locator('#library-list .row').count();
    console.log('Habits in library after refresh:', libraryCountAfter);

    // Get the actual text of library items
    const libraryItems = await page.locator('#library-list .row').allTextContents();
    console.log('Library items after refresh:', libraryItems);

    expect(libraryCountAfter).toBeGreaterThan(0);
  });
});
