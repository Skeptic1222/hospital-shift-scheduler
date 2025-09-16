const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('1. Navigating to scheduler through IIS...');
    await page.goto('http://localhost/scheduler');
    await page.waitForLoadState('networkidle');

    console.log('2. Logging in as admin...');
    // Check if we need to login
    const loginButton = await page.$('button:has-text("Login with Demo Account")');
    if (loginButton) {
      await loginButton.click();
      await page.waitForSelector('text=Welcome, Admin', { timeout: 5000 });
      console.log('   ✓ Logged in successfully');
    } else {
      console.log('   ✓ Already logged in');
    }

    console.log('3. Navigating to Schedule page...');
    await page.click('a[href="/scheduler/schedule"], button:has-text("Schedule")');
    await page.waitForLoadState('networkidle');

    console.log('4. Opening Create Shift dialog...');
    await page.click('button:has-text("Create Shift")');
    await page.waitForSelector('text=Create New Shift', { timeout: 5000 });

    console.log('5. Filling shift form...');
    // Department
    const deptSelect = await page.$('[name="department_code"], #department');
    if (deptSelect) {
      await deptSelect.selectOption({ index: 1 }); // Select first department
    }

    // Date
    await page.fill('input[type="date"], input[name="shift_date"]', '2025-09-15');

    // Times
    await page.fill('input[name="start_time"], input[placeholder*="start"]', '08:00');
    await page.fill('input[name="end_time"], input[placeholder*="end"]', '16:00');

    // Required staff
    await page.fill('input[name="required_staff"], input[type="number"]', '3');

    // Skills
    await page.fill('input[name="required_skills"], textarea[name="required_skills"]', 'ICU, ACLS');

    // Notes
    const notesField = await page.$('textarea[name="notes"], textarea[placeholder*="notes"]');
    if (notesField) {
      await notesField.fill('Test shift created via Playwright');
    }

    console.log('6. Submitting shift creation...');

    // Capture network activity
    const responsePromise = page.waitForResponse(
      response => response.url().includes('/api/shifts') && response.request().method() === 'POST',
      { timeout: 10000 }
    );

    // Click create button
    await page.click('button:has-text("Create"):not(:has-text("Create Shift"))');

    // Wait for response
    const response = await responsePromise;
    const status = response.status();
    const responseBody = await response.json().catch(() => null);

    console.log(`   API Response Status: ${status}`);
    if (responseBody) {
      console.log('   Response:', JSON.stringify(responseBody, null, 2));
    }

    if (status === 200 || status === 201) {
      console.log('✅ Shift created successfully!');

      // Check for success message
      const successMsg = await page.$('text=/success|created/i');
      if (successMsg) {
        console.log('   ✓ Success message displayed');
      }
    } else {
      console.log(`❌ Failed to create shift - Status: ${status}`);

      // Check for error messages
      const errorMsg = await page.$('text=/error|failed/i');
      if (errorMsg) {
        const errorText = await errorMsg.textContent();
        console.log(`   Error message: ${errorText}`);
      }
    }

    // Take screenshot
    await page.screenshot({ path: 'test-result.png', fullPage: true });
    console.log('Screenshot saved as test-result.png');

  } catch (error) {
    console.error('Test failed:', error);
    await page.screenshot({ path: 'test-error.png', fullPage: true });
    console.log('Error screenshot saved as test-error.png');
  } finally {
    await browser.close();
  }
})();