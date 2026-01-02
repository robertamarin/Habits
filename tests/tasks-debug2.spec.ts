import { test, expect } from '@playwright/test';

test.describe('Debug Tasks Submission', () => {
  const testEmail = `tasks2${Date.now()}@example.com`;
  const testPassword = 'Tasks123!';

  test('debug task form submission', async ({ page }) => {
    // Enable console logging
    page.on('console', msg => {
      const text = msg.text();
      if (!text.includes('Download the React DevTools')) {
        console.log('BROWSER:', text);
      }
    });

    await page.goto('http://localhost:8000');

    // Sign up
    console.log('Signing up...');
    await page.fill('#signup-email', testEmail);
    await page.fill('#signup-password', testPassword);
    await page.click('#signup-form button[type="submit"]');
    await page.waitForSelector('#app-shell:not(.hidden)', { timeout: 15000 });
    await page.waitForTimeout(2000);
    console.log('✓ Signed up');

    // Check if task input exists
    const taskInputExists = await page.locator('#task-input').count() > 0;
    console.log('Task input exists:', taskInputExists);

    const taskFormExists = await page.locator('#task-form').count() > 0;
    console.log('Task form exists:', taskFormExists);

    // Check what's in the quick wins section
    const quickWinsSection = await page.locator('#task-list').count() > 0;
    console.log('Task list exists:', quickWinsSection);

    // Try to see if the section is visible
    const taskInputVisible = await page.locator('#task-input').isVisible();
    console.log('Task input visible:', taskInputVisible);

    // Scroll to the quick wins section
    await page.locator('#task-input').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    console.log('Filling task input...');
    await page.fill('#task-input', 'Test Quick Win');

    console.log('Clicking submit...');
    await page.click('#task-form button[type="submit"]');
    await page.waitForTimeout(2000);

    // Check if task was added (using correct selector)
    const taskCount = await page.locator('#task-list .task').count();
    console.log('Tasks in list:', taskCount);
    expect(taskCount).toBe(1);

    // Check the actual content of task-list
    const taskListHTML = await page.locator('#task-list').innerHTML();
    console.log('Task list HTML:', taskListHTML);

    // Check localStorage
    const localStorage = await page.evaluate(() => {
      const stored = window.localStorage.getItem('habitFreshV1');
      const parsed = stored ? JSON.parse(stored) : null;
      return {
        allDays: Object.keys(parsed?.days || {}),
        daysData: parsed?.days || {}
      };
    });
    console.log('LocalStorage days:', localStorage.allDays);
    console.log('LocalStorage days data:', JSON.stringify(localStorage.daysData, null, 2));

    console.log('\n--- REFRESHING ---\n');
    await page.reload();
    await page.waitForSelector('#app-shell:not(.hidden)', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Check if task persisted
    const taskCountAfterRefresh = await page.locator('#task-list .task').count();
    console.log('Tasks after refresh:', taskCountAfterRefresh);

    const localStorageAfter = await page.evaluate(() => {
      const stored = window.localStorage.getItem('habitFreshV1');
      const parsed = stored ? JSON.parse(stored) : null;
      return {
        allDays: Object.keys(parsed?.days || {}),
        daysData: parsed?.days || {}
      };
    });
    console.log('LocalStorage days after refresh:', localStorageAfter.allDays);
    console.log('LocalStorage days data after refresh:', JSON.stringify(localStorageAfter.daysData, null, 2));

    expect(taskCountAfterRefresh).toBe(1);
  });
});
