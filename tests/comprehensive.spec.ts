import { test, expect } from '@playwright/test';

test.describe('Comprehensive Real-World Test', () => {
  const testEmail = `realworld${Date.now()}@example.com`;
  const testPassword = 'RealWorld123!';

  test('complete user workflow with multiple refreshes', async ({ page }) => {
    console.log('\n=== STEP 1: Initial signup and setup ===');
    await page.goto('http://localhost:8000');

    // Sign up
    await page.fill('#signup-email', testEmail);
    await page.fill('#signup-password', testPassword);
    await page.click('#signup-form button[type="submit"]');
    await page.waitForSelector('#app-shell:not(.hidden)', { timeout: 15000 });
    console.log('✓ Signed up and logged in');

    // Open settings
    await page.click('#settings-button-top');
    await page.waitForSelector('#settings-modal[open]');

    // Add multiple habits
    const habits = [
      { name: 'Morning Exercise', icon: '💪', color: '#ff5555' },
      { name: 'Meditation', icon: '🧘', color: '#55ff55' },
      { name: 'Reading', icon: '📚', color: '#5555ff' }
    ];

    for (const habit of habits) {
      await page.fill('#habit-input', habit.name);
      if (habit.icon) {
        await page.selectOption('#habit-icon', habit.icon);
      }
      await page.fill('#habit-color', habit.color);
      await page.click('#habit-submit');
      await page.waitForTimeout(500);
    }
    console.log(`✓ Added ${habits.length} habits`);

    // Add a goal
    await page.fill('#goal-input', 'Complete 100 workouts');
    await page.click('#goal-form button[type="submit"]');
    await page.waitForTimeout(500);
    console.log('✓ Added goal');

    // Close settings
    await page.click('#close-settings');
    await page.waitForTimeout(500);

    // Check all habits
    const checkboxes = page.locator('#habit-list input[type="checkbox"]');
    const count = await checkboxes.count();
    console.log(`Found ${count} habits in checklist`);

    for (let i = 0; i < count; i++) {
      await checkboxes.nth(i).check();
    }
    console.log('✓ Checked all habits');

    // Add a quick win
    await page.fill('#task-input', 'Completed first day!');
    await page.click('#task-form button[type="submit"]');
    await page.waitForTimeout(500);
    console.log('✓ Added quick win');

    console.log('\n=== STEP 2: First refresh ===');
    await page.reload();
    await page.waitForSelector('#app-shell:not(.hidden)', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Verify habits are still there
    let habitCount = await page.locator('#habit-list .row').count();
    console.log(`Habits after first refresh: ${habitCount}`);
    expect(habitCount).toBe(habits.length);

    // Verify habits are still checked
    let checkedCount = await page.locator('#habit-list input[type="checkbox"]:checked').count();
    console.log(`Checked habits after first refresh: ${checkedCount}`);
    expect(checkedCount).toBe(habits.length);

    // Verify quick win is still there
    let quickWinCount = await page.locator('#task-list .task').count();
    console.log(`Quick wins after first refresh: ${quickWinCount}`);
    expect(quickWinCount).toBe(1);

    console.log('\n=== STEP 3: Modify data and refresh again ===');

    // Uncheck one habit
    await page.locator('#habit-list input[type="checkbox"]').first().uncheck();
    await page.waitForTimeout(500);
    console.log('✓ Unchecked first habit');

    // Add another quick win
    await page.fill('#task-input', 'Made progress on reading');
    await page.click('#task-form button[type="submit"]');
    await page.waitForTimeout(500);
    console.log('✓ Added second quick win');

    console.log('\n=== STEP 4: Second refresh ===');
    await page.reload();
    await page.waitForSelector('#app-shell:not(.hidden)', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Verify habit count
    habitCount = await page.locator('#habit-list .row').count();
    console.log(`Habits after second refresh: ${habitCount}`);
    expect(habitCount).toBe(habits.length);

    // Verify only 2 habits are checked (we unchecked one)
    checkedCount = await page.locator('#habit-list input[type="checkbox"]:checked').count();
    console.log(`Checked habits after second refresh: ${checkedCount}`);
    expect(checkedCount).toBe(habits.length - 1);

    // Verify we have 2 quick wins
    quickWinCount = await page.locator('#task-list .task').count();
    console.log(`Quick wins after second refresh: ${quickWinCount}`);
    expect(quickWinCount).toBe(2);

    console.log('\n=== STEP 5: Verify in settings ===');
    await page.click('#settings-button-top');
    await page.waitForSelector('#settings-modal[open]');

    const libraryCount = await page.locator('#library-list .row').count();
    console.log(`Habits in library: ${libraryCount}`);
    expect(libraryCount).toBe(habits.length);

    const goalCount = await page.locator('#goal-manage-list .row').count();
    console.log(`Goals in settings: ${goalCount}`);
    expect(goalCount).toBe(1);

    console.log('\n✅ ALL TESTS PASSED - Data persists correctly!');
  });
});
