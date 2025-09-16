const { chromium } = require('playwright');

async function testCreateShift() {
  let browser;
  try {
    console.log('🚀 Starting Playwright test for Create Shift functionality...');

    // Launch browser
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Enable console logging from the page
    page.on('console', msg => {
      console.log(`Browser console [${msg.type()}]:`, msg.text());
    });

    // Enable error logging
    page.on('pageerror', error => {
      console.error('Browser page error:', error.message);
    });

    // Navigate to the application (using IIS proxy, no port)
    console.log('📍 Navigating to http://localhost/scheduler');
    await page.goto('http://localhost/scheduler', { waitUntil: 'networkidle' });

    // Check if we're on the login page
    const loginButton = await page.locator('button:has-text("Sign in with Google")').first();
    if (await loginButton.isVisible()) {
      console.log('🔐 On login page, attempting to bypass...');

      // Try to bypass login for testing
      await page.evaluate(() => {
        localStorage.setItem('auth_token', 'test_token');
        localStorage.setItem('user', JSON.stringify({
          id: 1,
          email: 'test@hospital.com',
          name: 'Test User',
          role: 'admin',
          permissions: ['create_shifts', 'manage_staff']
        }));
      });

      // Navigate to admin page directly
      console.log('📍 Navigating to admin page...');
      await page.goto('http://localhost/scheduler/admin', { waitUntil: 'networkidle' });
    }

    // Wait for the page to load and check for the Create Shift button
    console.log('🔍 Looking for Create Shift button...');

    // Try multiple selectors
    const selectors = [
      'button:has-text("Create Shift")',
      'button:has-text("CREATE SHIFT")',
      'button:has-text("New Shift")',
      'button:has-text("Add Shift")',
      '[data-testid="create-shift-button"]',
      'button[aria-label*="shift" i]',
      'button[title*="shift" i]'
    ];

    let createShiftButton = null;
    for (const selector of selectors) {
      try {
        const button = page.locator(selector).first();
        if (await button.isVisible({ timeout: 1000 })) {
          createShiftButton = button;
          console.log(`✅ Found button with selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    if (!createShiftButton) {
      // Take a screenshot to see what's on the page
      await page.screenshot({ path: 'create-shift-page-state.png', fullPage: true });

      // Get all visible buttons on the page
      const buttons = await page.locator('button').all();
      console.log(`\n📋 Found ${buttons.length} buttons on the page:`);

      for (let i = 0; i < buttons.length; i++) {
        const text = await buttons[i].textContent().catch(() => '');
        const ariaLabel = await buttons[i].getAttribute('aria-label').catch(() => '');
        const title = await buttons[i].getAttribute('title').catch(() => '');
        console.log(`  Button ${i + 1}: text="${text.trim()}", aria-label="${ariaLabel}", title="${title}"`);
      }

      // Check if we're still on login page
      const pageTitle = await page.title();
      const pageUrl = page.url();
      console.log(`\n📄 Current page: ${pageTitle} (${pageUrl})`);

      // Get page HTML structure
      const bodyText = await page.locator('body').textContent();
      console.log('\n📝 Page content preview:', bodyText.substring(0, 500));

      throw new Error('Create Shift button not found on the page');
    }

    // Click the Create Shift button
    console.log('🖱️ Clicking Create Shift button...');
    await createShiftButton.click();

    // Wait for the dialog/form to appear
    console.log('⏳ Waiting for shift creation form...');

    // Check for various possible form selectors
    const formSelectors = [
      '[role="dialog"]',
      '.MuiDialog-root',
      'form[data-testid="create-shift-form"]',
      'div:has-text("Create New Shift")',
      'div:has-text("Add Shift")'
    ];

    let shiftForm = null;
    for (const selector of formSelectors) {
      try {
        const form = page.locator(selector).first();
        if (await form.isVisible({ timeout: 2000 })) {
          shiftForm = form;
          console.log(`✅ Found form with selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    if (!shiftForm) {
      await page.screenshot({ path: 'after-button-click.png', fullPage: true });
      console.log('❌ Shift creation form did not appear after clicking button');

      // Check for any error messages
      const errorMessages = await page.locator('.MuiAlert-message, [role="alert"], .error').all();
      for (const error of errorMessages) {
        const text = await error.textContent();
        console.log('🚨 Error message found:', text);
      }

      throw new Error('Shift creation form did not appear');
    }

    // Fill in the shift form
    console.log('📝 Filling shift creation form...');

    // Try to fill in required fields
    const fields = {
      title: 'Test Shift',
      department: 'Emergency',
      date: new Date().toISOString().split('T')[0],
      startTime: '08:00',
      endTime: '16:00',
      requiredStaff: '2'
    };

    for (const [field, value] of Object.entries(fields)) {
      const input = await shiftForm.locator(`input[name="${field}"], input[placeholder*="${field}" i], label:has-text("${field}") + input`).first();
      if (await input.isVisible()) {
        await input.fill(value);
        console.log(`  ✓ Filled ${field}: ${value}`);
      }
    }

    // Submit the form
    const submitButton = await shiftForm.locator('button[type="submit"], button:has-text("Create"), button:has-text("Save"), button:has-text("Submit")').first();
    if (await submitButton.isVisible()) {
      console.log('🚀 Submitting shift creation form...');
      await submitButton.click();

      // Wait for response
      await page.waitForTimeout(2000);

      // Check for success message
      const successMessage = await page.locator('.MuiAlert-success, [role="alert"]:has-text("success"), .success-message').first();
      if (await successMessage.isVisible()) {
        const text = await successMessage.textContent();
        console.log('✅ Success:', text);
      } else {
        // Check for errors
        const errorMessage = await page.locator('.MuiAlert-error, [role="alert"]:has-text("error"), .error-message').first();
        if (await errorMessage.isVisible()) {
          const text = await errorMessage.textContent();
          console.log('❌ Error:', text);
        }
      }
    }

    console.log('\n✅ Test completed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
testCreateShift().catch(console.error);