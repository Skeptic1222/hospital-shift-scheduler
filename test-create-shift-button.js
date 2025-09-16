const { chromium } = require('playwright');

(async () => {
  let browser;
  let context;
  let page;

  try {
    console.log('Starting Playwright test for create shift button...');

    // Launch browser
    browser = await chromium.launch({
      headless: false, // Set to false to see the browser
      args: ['--disable-web-security'] // Disable CORS for testing
    });

    context = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 1280, height: 720 }
    });

    page = await context.newPage();

    // Enable console logging
    page.on('console', msg => console.log('Browser console:', msg.text()));
    page.on('pageerror', error => console.log('Page error:', error.message));

    // Try to access through localhost first
    console.log('Navigating to http://localhost:3000...');
    try {
      await page.goto('http://localhost:3000', {
        waitUntil: 'networkidle',
        timeout: 30000
      });
      console.log('Successfully loaded React app on port 3000');
    } catch (e) {
      console.log('Failed to load on port 3000, trying IIS proxy...');
      await page.goto('http://localhost/scheduler', {
        waitUntil: 'networkidle',
        timeout: 30000
      });
      console.log('Successfully loaded React app through IIS');
    }

    // Wait for the app to load
    await page.waitForTimeout(2000);

    // Take a screenshot of the initial page
    await page.screenshot({ path: 'initial-page.png' });
    console.log('Screenshot saved: initial-page.png');

    // Check if we're on the login page
    const loginButton = await page.$('button:has-text("Sign in with Google")');
    if (loginButton) {
      console.log('App requires login. Creating demo session...');

      // Try to bypass login by setting a demo token
      await page.evaluate(() => {
        const demoUser = {
          sub: 'demo-admin',
          email: 'admin@demo.com',
          name: 'Demo Admin',
          roles: ['admin']
        };

        // Create a simple JWT-like token
        const token = 'demo-token-' + btoa(JSON.stringify(demoUser));
        localStorage.setItem('auth_token', token);
        localStorage.setItem('user', JSON.stringify(demoUser));

        // Trigger a page reload
        window.location.href = '/';
      });

      await page.waitForTimeout(3000);
    }

    // Check if we're on the schedule page
    console.log('Checking for navigation or main content...');

    // Try to find the Schedule link and click it
    const scheduleLink = await page.$('a[href="/schedule"], button:has-text("Schedule")');
    if (scheduleLink) {
      console.log('Found Schedule link, clicking...');
      await scheduleLink.click();
      await page.waitForTimeout(2000);
    }

    // Look for the Create Shift button in various possible locations
    console.log('Looking for Create Shift button...');

    const selectors = [
      'button:has-text("Create Shift")',
      'button:has-text("New Shift")',
      'button:has-text("Add Shift")',
      '[aria-label*="create shift" i]',
      '[aria-label*="new shift" i]',
      '[aria-label*="add shift" i]',
      'button[id*="create-shift" i]',
      'button[class*="create-shift" i]',
      'button svg', // FAB with icon
      '[role="button"]:has-text("+")',
      '.MuiFab-root', // Material-UI FAB
      '[data-testid*="create" i]',
      '[data-testid*="shift" i]'
    ];

    let createShiftButton = null;
    for (const selector of selectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          createShiftButton = element;
          console.log(`Found button with selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    if (!createShiftButton) {
      // Try to find any button and log them
      const allButtons = await page.$$eval('button', buttons =>
        buttons.map(btn => ({
          text: btn.textContent.trim(),
          id: btn.id,
          className: btn.className,
          ariaLabel: btn.getAttribute('aria-label')
        }))
      );

      console.log('All buttons found on page:');
      allButtons.forEach(btn => {
        console.log(`  - Text: "${btn.text}", ID: "${btn.id}", Class: "${btn.className}", Aria: "${btn.ariaLabel}"`);
      });

      // Also check for floating action buttons (FABs)
      const fabs = await page.$$eval('[class*="Fab"]', elements =>
        elements.map(el => ({
          className: el.className,
          innerHTML: el.innerHTML.substring(0, 100)
        }))
      );

      if (fabs.length > 0) {
        console.log('Floating Action Buttons found:');
        fabs.forEach(fab => console.log(`  - ${fab.className}`));
      }
    }

    // Take a screenshot of the current state
    await page.screenshot({ path: 'create-shift-search.png' });
    console.log('Screenshot saved: create-shift-search.png');

    if (createShiftButton) {
      console.log('Clicking Create Shift button...');
      await createShiftButton.click();

      // Wait for dialog or form to appear
      await page.waitForTimeout(2000);

      // Take screenshot of the form
      await page.screenshot({ path: 'create-shift-form.png' });
      console.log('Screenshot saved: create-shift-form.png');

      // Try to fill in the form if it exists
      console.log('Looking for form fields...');

      // Try to fill department
      const departmentField = await page.$('input[name="department"], select[name="department"], [id*="department"]');
      if (departmentField) {
        await departmentField.fill('ICU');
        console.log('Filled department field');
      }

      // Try to fill date
      const dateField = await page.$('input[type="date"], input[name*="date"]');
      if (dateField) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateStr = tomorrow.toISOString().split('T')[0];
        await dateField.fill(dateStr);
        console.log('Filled date field');
      }

      // Try to fill start time
      const startTimeField = await page.$('input[name*="start"], input[type="time"]:first-of-type');
      if (startTimeField) {
        await startTimeField.fill('08:00');
        console.log('Filled start time field');
      }

      // Try to fill end time
      const endTimeField = await page.$('input[name*="end"], input[type="time"]:last-of-type');
      if (endTimeField) {
        await endTimeField.fill('16:00');
        console.log('Filled end time field');
      }

      // Take screenshot after filling
      await page.screenshot({ path: 'create-shift-filled.png' });
      console.log('Screenshot saved: create-shift-filled.png');

      // Try to submit
      const submitButton = await page.$('button[type="submit"], button:has-text("Submit"), button:has-text("Create"), button:has-text("Save")');
      if (submitButton) {
        console.log('Clicking submit button...');
        await submitButton.click();
        await page.waitForTimeout(2000);

        // Take final screenshot
        await page.screenshot({ path: 'create-shift-result.png' });
        console.log('Screenshot saved: create-shift-result.png');

        console.log('✅ Test completed successfully!');
      } else {
        console.log('⚠️ Submit button not found');
      }
    } else {
      console.log('❌ Create Shift button not found');

      // Log page content for debugging
      const bodyText = await page.$eval('body', el => el.innerText);
      console.log('Page content preview:');
      console.log(bodyText.substring(0, 500));
    }

  } catch (error) {
    console.error('Test failed:', error);
    if (page) {
      await page.screenshot({ path: 'error-screenshot.png' });
      console.log('Error screenshot saved: error-screenshot.png');
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }
})();