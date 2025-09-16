const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('Testing Create Shift functionality...\n');

    // Navigate to the app
    console.log('1. Navigating to http://localhost/scheduler');
    await page.goto('http://localhost/scheduler', { waitUntil: 'networkidle' });

    // Login with demo account
    console.log('2. Clicking Login with Demo Account');
    const loginButton = await page.$('button:has-text("Login with Demo Account")');
    if (loginButton) {
      await loginButton.click();
      await page.waitForTimeout(1000);
    }

    // Get auth token from localStorage
    const token = await page.evaluate(() => localStorage.getItem('google_credential'));
    console.log('3. Auth token retrieved:', token ? 'Yes' : 'No');

    // Navigate to Schedule page
    console.log('4. Navigating to Schedule page');
    await page.goto('http://localhost/scheduler/schedule', { waitUntil: 'networkidle' });

    // Click Create Shift button
    console.log('5. Clicking Create Shift button');
    const createBtn = await page.$('button:has-text("Create Shift")');
    if (!createBtn) {
      console.log('   ERROR: Create Shift button not found');
      return;
    }
    await createBtn.click();
    await page.waitForTimeout(500);

    // Fill the form
    console.log('6. Filling shift creation form');

    // Try different selectors for department
    const deptSelect = await page.$('select[name="department_code"], select#department, select[aria-label*="department"]');
    if (deptSelect) {
      const options = await page.$$eval('select[name="department_code"] option, select#department option', opts =>
        opts.map(o => ({ value: o.value, text: o.textContent }))
      );
      console.log('   Available departments:', options.slice(0, 5).map(o => o.text).join(', '));
      if (options.length > 1) {
        await deptSelect.selectOption({ index: 1 });
      }
    }

    // Fill dates and times
    await page.fill('input[type="date"], input[name="shift_date"], input[name="date"]', '2025-09-16');
    await page.fill('input[name="start_time"], input[placeholder*="start"], input[aria-label*="start"]', '08:00');
    await page.fill('input[name="end_time"], input[placeholder*="end"], input[aria-label*="end"]', '16:00');

    // Required staff
    await page.fill('input[name="required_staff"], input[type="number"], input[aria-label*="staff"]', '3');

    // Required skills
    const skillsField = await page.$('input[name="required_skills"], textarea[name="required_skills"], input[placeholder*="skill"]');
    if (skillsField) {
      await skillsField.fill('ICU, ACLS');
    }

    // Notes
    const notesField = await page.$('textarea[name="notes"], textarea[placeholder*="note"]');
    if (notesField) {
      await notesField.fill('Test shift created via headless Playwright');
    }

    console.log('7. Submitting shift creation');

    // Listen for API response
    const responsePromise = page.waitForResponse(
      res => res.url().includes('/api/shifts') && res.request().method() === 'POST',
      { timeout: 5000 }
    ).catch(() => null);

    // Click submit button
    const submitBtn = await page.$('button[type="submit"]:has-text("Create"), button:has-text("Create"):not(:has-text("Create Shift"))');
    if (submitBtn) {
      await submitBtn.click();
    } else {
      console.log('   ERROR: Submit button not found');
    }

    // Wait for response
    const response = await responsePromise;
    if (response) {
      const status = response.status();
      const body = await response.text();
      console.log(`\n8. API Response:`);
      console.log(`   Status: ${status}`);
      console.log(`   Body: ${body.substring(0, 200)}`);

      if (status === 200 || status === 201) {
        console.log('\n✅ SUCCESS: Shift created successfully!');
      } else {
        console.log('\n❌ FAILED: Shift creation failed');
      }
    } else {
      console.log('\n⚠️  No API response detected');

      // Check for any error messages on the page
      const errorText = await page.textContent('body');
      if (errorText.includes('error') || errorText.includes('Error')) {
        console.log('   Page contains error messages');
      }
    }

    // Get console logs
    const logs = [];
    page.on('console', msg => logs.push({ type: msg.type(), text: msg.text() }));
    await page.waitForTimeout(1000);

    if (logs.length > 0) {
      console.log('\n9. Browser console logs:');
      logs.slice(-5).forEach(log => console.log(`   [${log.type}] ${log.text}`));
    }

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
  } finally {
    await browser.close();
    console.log('\nTest completed.');
  }
})();