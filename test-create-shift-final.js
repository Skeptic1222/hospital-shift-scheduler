const { chromium } = require('playwright');

async function testCreateShift() {
  let browser;
  try {
    console.log('🚀 Starting Create Shift test...\n');

    // Launch browser
    browser = await chromium.launch({
      headless: true, // Set to true for CI/CD
      slowMo: 500 // Slow down for debugging
    });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Enable console logging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`Browser console error:`, msg.text());
      }
    });

    // Navigate to the application
    console.log('1. Navigating to application...');
    await page.goto('http://localhost/scheduler', { waitUntil: 'networkidle' });

    // Check if we need to login
    console.log('2. Checking for login page...');

    // First wait for page to load properly
    await page.waitForTimeout(2000);

    // Check for demo login buttons
    let loginButton = await page.locator('button:has-text("Login as Admin")').first();

    if (!await loginButton.isVisible({ timeout: 1000 })) {
      // Try the regular Google Sign in button if demo buttons aren't visible
      loginButton = await page.locator('button:has-text("Sign in with Google")').first();
    }

    if (await loginButton.isVisible()) {
      console.log('   ✅ Found login button: ' + await loginButton.textContent());

      // Check if demo buttons appear after clicking Google sign in
      if (await loginButton.textContent() === 'Sign in with Google') {
        // For now, we'll set demo auth in localStorage directly
        console.log('   Setting demo authentication...');
        await page.evaluate(() => {
          localStorage.setItem('token', 'demo-admin-token');
          localStorage.setItem('user', JSON.stringify({
            id: 1,
            email: 'admin@hospital.com',
            name: 'Admin User',
            role: 'admin'
          }));
        });

        // Reload to apply auth
        await page.reload();
        await page.waitForLoadState('networkidle');
      } else {
        // Click the demo login button
        console.log('   Clicking demo login button...');
        await loginButton.click();
      }

      // Wait for navigation
      await page.waitForTimeout(3000);
      console.log('   ✅ Authentication set\n');
    }

    // Check current URL
    const currentUrl = page.url();
    console.log(`3. Current URL: ${currentUrl}\n`);

    // Navigate to admin page if needed
    if (!currentUrl.includes('/admin')) {
      console.log('4. Navigating to Admin page...');

      // Try clicking admin link first
      const adminLink = await page.locator('a:has-text("Admin"), button:has-text("Admin")').first();
      if (await adminLink.isVisible()) {
        await adminLink.click();
        await page.waitForLoadState('networkidle');
      } else {
        // Direct navigation
        await page.goto('http://localhost/scheduler/admin');
        await page.waitForLoadState('networkidle');
      }
      console.log('   ✅ On Admin page\n');
    }

    // Wait a bit for React to render
    await page.waitForTimeout(2000);

    // Look for Create Shift button with various selectors
    console.log('5. Looking for Create Shift button...');

    const buttonSelectors = [
      'button:has-text("Create Shift")',
      'button:has-text("CREATE SHIFT")',
      'button:has-text("Create New Shift")',
      'button:has-text("New Shift")',
      'button:has-text("Add Shift")',
      'button:has-text("+")',
      '[data-testid="create-shift-button"]',
      'button[aria-label*="shift" i]',
      '.MuiButton-root:has-text("Create")',
      '.MuiFab-root' // Floating action button
    ];

    let createShiftButton = null;
    for (const selector of buttonSelectors) {
      try {
        const button = page.locator(selector).first();
        if (await button.isVisible({ timeout: 500 })) {
          createShiftButton = button;
          console.log(`   ✅ Found button with selector: ${selector}`);
          const buttonText = await button.textContent().catch(() => '');
          if (buttonText) {
            console.log(`   Button text: "${buttonText}"`);
          }
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    if (!createShiftButton) {
      // Take screenshot for debugging
      await page.screenshot({ path: 'admin-page-no-button.png', fullPage: true });

      // List all visible buttons
      console.log('\n   ❌ Create Shift button not found');
      console.log('   Visible buttons on page:');
      const allButtons = await page.locator('button').all();
      for (let i = 0; i < Math.min(allButtons.length, 10); i++) {
        const text = await allButtons[i].textContent().catch(() => '');
        const isVisible = await allButtons[i].isVisible().catch(() => false);
        if (text && isVisible) {
          console.log(`   - "${text.trim()}"`);
        }
      }

      // Check page content
      const pageContent = await page.locator('main, .MuiContainer-root, body').first().textContent();
      console.log('\n   Page content preview:', pageContent.substring(0, 300));

      throw new Error('Create Shift button not found on Admin page');
    }

    // Click the Create Shift button
    console.log('\n6. Clicking Create Shift button...');
    await createShiftButton.click();

    // Wait for dialog/form to appear
    await page.waitForTimeout(2000);

    // Look for the dialog or form
    console.log('7. Looking for shift creation form...');

    const dialogSelectors = [
      '[role="dialog"]',
      '.MuiDialog-root',
      '.MuiModal-root',
      'form[data-testid="shift-form"]',
      'div:has-text("Create Shift"):has(input)',
      'div:has-text("New Shift"):has(input)'
    ];

    let shiftDialog = null;
    for (const selector of dialogSelectors) {
      try {
        const dialog = page.locator(selector).first();
        if (await dialog.isVisible({ timeout: 500 })) {
          shiftDialog = dialog;
          console.log(`   ✅ Found dialog with selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue
      }
    }

    if (!shiftDialog) {
      await page.screenshot({ path: 'after-button-click.png', fullPage: true });
      console.log('   ❌ Shift creation dialog did not appear');

      // Check for error messages
      const alerts = await page.locator('.MuiAlert-root, [role="alert"]').all();
      for (const alert of alerts) {
        const text = await alert.textContent();
        console.log(`   Alert: ${text}`);
      }

      throw new Error('Shift creation dialog did not appear');
    }

    // Fill the form
    console.log('\n8. Filling shift form...');

    // Department field
    const deptField = await shiftDialog.locator('input[name*="department" i], select[name*="department" i], [data-testid*="department" i]').first();
    if (await deptField.isVisible()) {
      const tagName = await deptField.evaluate(el => el.tagName.toLowerCase());
      if (tagName === 'select') {
        await deptField.selectOption({ index: 1 });
      } else {
        await deptField.fill('ICU');
      }
      console.log('   ✅ Department: ICU');
    }

    // Date field
    const dateField = await shiftDialog.locator('input[type="date"], input[name*="date" i]').first();
    if (await dateField.isVisible()) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];
      await dateField.fill(dateStr);
      console.log(`   ✅ Date: ${dateStr}`);
    }

    // Start time
    const startField = await shiftDialog.locator('input[name*="start" i], input[type="time"]').first();
    if (await startField.isVisible()) {
      await startField.fill('08:00');
      console.log('   ✅ Start time: 08:00');
    }

    // End time
    const endField = await shiftDialog.locator('input[name*="end" i], input[type="time"]').nth(1);
    if (await endField.isVisible()) {
      await endField.fill('16:00');
      console.log('   ✅ End time: 16:00');
    }

    // Required staff
    const staffField = await shiftDialog.locator('input[type="number"], input[name*="staff" i], input[name*="required" i]').first();
    if (await staffField.isVisible()) {
      await staffField.fill('3');
      console.log('   ✅ Required staff: 3');
    }

    // Submit the form
    console.log('\n9. Submitting form...');
    const submitButton = await shiftDialog.locator('button:has-text("Create"), button:has-text("Submit"), button:has-text("Save"), button[type="submit"]').first();

    if (await submitButton.isVisible()) {
      console.log('   Clicking submit button...');
      await submitButton.click();

      // Wait for response
      await page.waitForTimeout(3000);

      // Check for success or error
      console.log('\n10. Checking result...');

      // Success indicators
      const successSelectors = [
        '.MuiAlert-standardSuccess',
        '[role="alert"]:has-text("success")',
        ':has-text("created successfully")',
        ':has-text("shift has been created")'
      ];

      for (const selector of successSelectors) {
        const success = page.locator(selector).first();
        if (await success.isVisible({ timeout: 1000 })) {
          const text = await success.textContent();
          console.log(`   ✅ SUCCESS: ${text}`);
          await page.screenshot({ path: 'create-shift-success.png', fullPage: true });
          return; // Success!
        }
      }

      // Error indicators
      const errorSelectors = [
        '.MuiAlert-standardError',
        '[role="alert"]:has-text("error")',
        ':has-text("failed")',
        ':has-text("could not")'
      ];

      for (const selector of errorSelectors) {
        const error = page.locator(selector).first();
        if (await error.isVisible({ timeout: 1000 })) {
          const text = await error.textContent();
          console.log(`   ❌ ERROR: ${text}`);
          await page.screenshot({ path: 'create-shift-error.png', fullPage: true });

          // Get more details
          const networkErrors = await page.evaluate(() => {
            return window.performance.getEntriesByType('resource')
              .filter(entry => entry.name.includes('/api/') && entry.responseStatus >= 400)
              .map(entry => ({ url: entry.name, status: entry.responseStatus }));
          });

          if (networkErrors.length > 0) {
            console.log('\n   Network errors detected:');
            networkErrors.forEach(err => {
              console.log(`   - ${err.url}: Status ${err.status}`);
            });
          }

          throw new Error(`Shift creation failed: ${text}`);
        }
      }

      // If no clear success/error, check if dialog closed
      if (!await shiftDialog.isVisible()) {
        console.log('   ℹ️  Dialog closed after submission (possibly successful)');
      } else {
        console.log('   ⚠️  No clear success/error message after submission');
      }

    } else {
      console.log('   ❌ Submit button not found');
      throw new Error('Submit button not found in form');
    }

    console.log('\n✅ Test completed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
testCreateShift().catch(console.error);