import { test, expect } from '@playwright/test';

test.describe('Thorough Real-World Testing', () => {
  const testEmail = `thorough${Date.now()}@example.com`;
  const testPassword = 'Thorough123!';

  test('test all features with persistence', async ({ page }) => {
    page.on('console', msg => {
      const text = msg.text();
      if (!text.includes('DevTools') && !text.includes('Download')) {
        console.log('BROWSER:', text);
      }
    });
    page.on('pageerror', err => console.log('ERROR:', err.message));

    console.log('\n=== SIGNUP ===');
    await page.goto('http://localhost:8000');
    await page.fill('#signup-email', testEmail);
    await page.fill('#signup-password', testPassword);
    await page.click('#signup-form button[type="submit"]');
    await page.waitForSelector('#app-shell:not(.hidden)', { timeout: 15000 });
    await page.waitForTimeout(2000);
    console.log('✓ Signed up');

    console.log('\n=== ADD 3 HABITS ===');
    await page.click('#settings-button-top');
    await page.waitForSelector('#settings-modal[open]');

    const habits = ['Exercise', 'Reading', 'Meditation'];
    for (const habit of habits) {
      await page.fill('#habit-input', habit);
      await page.click('#habit-submit');
      await page.waitForTimeout(500);
    }

    let habitCount = await page.locator('#library-list .row').count();
    console.log(`✓ Added ${habitCount} habits`);
    expect(habitCount).toBe(3);

    console.log('\n=== ADD A GOAL ===');
    await page.fill('#goal-input', 'Complete 100 workouts this year');
    await page.click('#goal-form button[type="submit"]');
    await page.waitForTimeout(500);

    const goalCount = await page.locator('#goal-manage-list .row').count();
    console.log(`✓ Added ${goalCount} goal(s)`);
    expect(goalCount).toBe(1);

    await page.click('#close-settings');
    await page.waitForTimeout(1000);

    console.log('\n=== CHECK ALL HABITS ===');
    const checkboxes = await page.locator('#habit-list input[type="checkbox"]').all();
    console.log(`Found ${checkboxes.length} habit checkboxes`);

    for (const checkbox of checkboxes) {
      await checkbox.check();
    }
    await page.waitForTimeout(1000);

    const checkedCount = await page.locator('#habit-list input[type="checkbox"]:checked').count();
    console.log(`✓ Checked ${checkedCount} habits`);

    console.log('\n=== ADD QUICK WIN ===');
    await page.fill('#task-input', 'Completed my morning routine');
    await page.click('#task-form button[type="submit"]');
    await page.waitForTimeout(1000);

    const taskCount = await page.locator('#task-list .task').count();
    console.log(`✓ Added ${taskCount} quick win(s)`);

    console.log('\n=== CHECK LOCALSTORAGE BEFORE REFRESH ===');
    const beforeRefresh = await page.evaluate(() => {
      const stored = localStorage.getItem('habitFreshV1');
      const parsed = stored ? JSON.parse(stored) : null;
      const today = new Date().toISOString().split('T')[0];
      return {
        habits: parsed?.habits?.length || 0,
        goals: parsed?.goals?.length || 0,
        todayKey: today,
        todayData: parsed?.days?.[today] || null
      };
    });
    console.log('Before refresh:', JSON.stringify(beforeRefresh, null, 2));

    console.log('\n=== REFRESH PAGE ===');
    await page.reload();
    await page.waitForSelector('#app-shell:not(.hidden)', { timeout: 15000 });
    await page.waitForTimeout(3000);

    console.log('\n=== CHECK LOCALSTORAGE AFTER REFRESH ===');
    const afterRefresh = await page.evaluate(() => {
      const stored = localStorage.getItem('habitFreshV1');
      const parsed = stored ? JSON.parse(stored) : null;
      const today = new Date().toISOString().split('T')[0];
      return {
        habits: parsed?.habits?.length || 0,
        goals: parsed?.goals?.length || 0,
        todayKey: today,
        todayData: parsed?.days?.[today] || null
      };
    });
    console.log('After refresh:', JSON.stringify(afterRefresh, null, 2));

    console.log('\n=== VERIFY HABITS AFTER REFRESH ===');
    const habitsAfter = await page.locator('#habit-list .row').count();
    console.log(`Habits visible: ${habitsAfter}`);
    expect(habitsAfter).toBe(3);

    console.log('\n=== VERIFY HABIT COMPLETIONS AFTER REFRESH ===');
    const checkedAfter = await page.locator('#habit-list input[type="checkbox"]:checked').count();
    console.log(`Checked habits: ${checkedAfter}`);
    expect(checkedAfter).toBe(3);

    console.log('\n=== VERIFY QUICK WIN AFTER REFRESH ===');
    const tasksAfter = await page.locator('#task-list .task').count();
    console.log(`Quick wins visible: ${tasksAfter}`);
    expect(tasksAfter).toBe(1);

    console.log('\n=== VERIFY IN SETTINGS ===');
    await page.click('#settings-button-top');
    await page.waitForSelector('#settings-modal[open]');

    const libraryAfter = await page.locator('#library-list .row').count();
    console.log(`Habits in library: ${libraryAfter}`);
    expect(libraryAfter).toBe(3);

    const goalsAfter = await page.locator('#goal-manage-list .row').count();
    console.log(`Goals in settings: ${goalsAfter}`);
    expect(goalsAfter).toBe(1);

    console.log('\n✅ ALL TESTS PASSED!');
  });
});
