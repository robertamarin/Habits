import { test, expect } from '@playwright/test';

test.describe('Fresh Branch Testing', () => {
  const testEmail = `fresh${Date.now()}@example.com`;
  const testPassword = 'Fresh123!';

  test('test data persistence on current branch', async ({ page }) => {
    // Enable detailed logging
    page.on('console', msg => {
      const text = msg.text();
      if (!text.includes('DevTools')) {
        console.log('BROWSER:', text);
      }
    });
    page.on('pageerror', err => console.log('PAGE ERROR:', err));

    console.log('\n=== STEP 1: Navigate and Sign Up ===');
    await page.goto('http://localhost:8000');

    await page.fill('#signup-email', testEmail);
    await page.fill('#signup-password', testPassword);
    await page.click('#signup-form button[type="submit"]');

    await page.waitForSelector('#app-shell:not(.hidden)', { timeout: 15000 });
    await page.waitForTimeout(2000);
    console.log('✓ Signed up successfully');

    console.log('\n=== STEP 2: Add a Habit ===');
    await page.click('#settings-button-top');
    await page.waitForSelector('#settings-modal[open]');

    const habitName = `Test Habit ${Date.now()}`;
    await page.fill('#habit-input', habitName);
    await page.click('#habit-submit');
    await page.waitForTimeout(1000);

    const libraryCount = await page.locator('#library-list').locator('*').count();
    console.log(`Items in library: ${libraryCount}`);

    // Check localStorage before closing settings
    const beforeClose = await page.evaluate(() => {
      const stored = localStorage.getItem('habitFreshV1');
      return stored ? JSON.parse(stored) : null;
    });
    console.log('LocalStorage before closing settings:', {
      habitCount: beforeClose?.habits?.length || 0,
      habits: beforeClose?.habits || []
    });

    await page.click('#close-settings');
    await page.waitForTimeout(500);

    // Check localStorage after closing settings
    const afterClose = await page.evaluate(() => {
      const stored = localStorage.getItem('habitFreshV1');
      return stored ? JSON.parse(stored) : null;
    });
    console.log('LocalStorage after closing settings:', {
      habitCount: afterClose?.habits?.length || 0
    });

    console.log('\n=== STEP 3: Refresh Page ===');
    await page.reload();
    await page.waitForSelector('#app-shell:not(.hidden)', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Check localStorage after refresh
    const afterRefresh = await page.evaluate(() => {
      const stored = localStorage.getItem('habitFreshV1');
      return stored ? JSON.parse(stored) : null;
    });
    console.log('LocalStorage after refresh:', {
      habitCount: afterRefresh?.habits?.length || 0,
      habits: afterRefresh?.habits || []
    });

    // Open settings to check library
    await page.click('#settings-button-top');
    await page.waitForSelector('#settings-modal[open]');

    const libraryCountAfter = await page.locator('#library-list').locator('*').count();
    console.log(`Items in library after refresh: ${libraryCountAfter}`);

    // Get habit list
    const habitElements = await page.locator('#library-list .row').count();
    console.log(`Habit rows after refresh: ${habitElements}`);

    if (habitElements === 0) {
      console.log('❌ FAILED: No habits found after refresh');
      const libraryHTML = await page.locator('#library-list').innerHTML();
      console.log('Library HTML:', libraryHTML);
    } else {
      console.log('✅ PASSED: Habits found after refresh');
    }

    expect(habitElements).toBeGreaterThan(0);
  });
});
