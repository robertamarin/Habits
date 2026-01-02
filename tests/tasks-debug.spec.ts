import { test, expect } from '@playwright/test';

test.describe('Debug Tasks Persistence', () => {
  const testEmail = `tasks${Date.now()}@example.com`;
  const testPassword = 'Tasks123!';

  test('debug task persistence', async ({ page }) => {
    // Enable console logging
    page.on('console', msg => console.log('BROWSER:', msg.text()));

    await page.goto('http://localhost:8000');

    // Sign up
    console.log('Signing up with:', testEmail);
    await page.fill('#signup-email', testEmail);
    await page.fill('#signup-password', testPassword);
    await page.click('#signup-form button[type="submit"]');
    await page.waitForSelector('#app-shell:not(.hidden)', { timeout: 15000 });
    await page.waitForTimeout(2000);
    console.log('✓ Signed up');

    // Add a quick win
    console.log('Adding quick win...');
    await page.fill('#task-input', 'Test Task');
    await page.click('#task-form button[type="submit"]');
    await page.waitForTimeout(2000);

    // Check localStorage before refresh
    const beforeRefresh = await page.evaluate(() => {
      const stored = window.localStorage.getItem('habitFreshV1');
      const parsed = stored ? JSON.parse(stored) : null;
      const todayKey = new Date().toISOString().split('T')[0];
      return {
        todayKey,
        dayExists: parsed?.days?.[todayKey] !== undefined,
        tasks: parsed?.days?.[todayKey]?.tasks || [],
        taskCount: parsed?.days?.[todayKey]?.tasks?.length || 0
      };
    });
    console.log('Before refresh:', JSON.stringify(beforeRefresh, null, 2));

    const taskCount = await page.locator('#task-list .row').count();
    console.log('Tasks visible:', taskCount);

    console.log('\n--- REFRESHING ---\n');
    await page.reload();
    await page.waitForSelector('#app-shell:not(.hidden)', { timeout: 15000 });
    await page.waitForTimeout(3000);

    // Check localStorage after refresh
    const afterRefresh = await page.evaluate(() => {
      const stored = window.localStorage.getItem('habitFreshV1');
      const parsed = stored ? JSON.parse(stored) : null;
      const todayKey = new Date().toISOString().split('T')[0];
      return {
        todayKey,
        dayExists: parsed?.days?.[todayKey] !== undefined,
        tasks: parsed?.days?.[todayKey]?.tasks || [],
        taskCount: parsed?.days?.[todayKey]?.tasks?.length || 0
      };
    });
    console.log('After refresh:', JSON.stringify(afterRefresh, null, 2));

    const taskCountAfter = await page.locator('#task-list .row').count();
    console.log('Tasks visible after refresh:', taskCountAfter);

    expect(taskCountAfter).toBe(1);
  });
});
