const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture console messages
  page.on('console', msg => {
    console.log(`[Browser Console ${msg.type()}]:`, msg.text());
  });

  // Capture page errors
  page.on('pageerror', error => {
    console.error('[Page Error]:', error.message);
    console.error('[Stack]:', error.stack);
  });

  // Capture network failures
  page.on('requestfailed', request => {
    console.error('[Request Failed]:', request.url(), request.failure().errorText);
  });

  try {
    // ⚠️ CRITICAL: NEVER USE PORTS IN URLs - See NO-PORT-ABSOLUTE-RULE.md
    console.log('Navigating to http://localhost/scheduler...');
    await page.goto('http://localhost/scheduler', { waitUntil: 'networkidle' });
    
    // Take screenshot of initial page
    await page.screenshot({ path: 'initial-page.png' });
    console.log('Initial page screenshot saved');

    // Wait for the page to load
    await page.waitForTimeout(2000);

    // Look for Create Shift button
    console.log('Looking for Create Shift button...');
    
    // Try multiple selectors
    const selectors = [
      'button:has-text("Create Shift")',
      'text=Create Shift',
      '[aria-label*="Create Shift"]',
      'button >> text=Create Shift'
    ];

    let button = null;
    for (const selector of selectors) {
      try {
        button = await page.locator(selector).first();
        if (await button.isVisible({ timeout: 1000 })) {
          console.log(`Found button with selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    if (!button || !(await button.isVisible())) {
      console.log('Create Shift button not found. Checking page content...');
      const pageContent = await page.content();
      const hasCreateShift = pageContent.includes('Create Shift');
      console.log('Page contains "Create Shift" text:', hasCreateShift);
      
      // Get all buttons on page
      const buttons = await page.locator('button').all();
      console.log(`Found ${buttons.length} buttons on page`);
      for (let i = 0; i < buttons.length; i++) {
        const text = await buttons[i].textContent();
        console.log(`Button ${i}: "${text}"`);
      }
      
      throw new Error('Create Shift button not found on page');
    }

    // Click the button
    console.log('Clicking Create Shift button...');
    await button.click();
    
    // Wait for any errors or dialog
    await page.waitForTimeout(2000);
    
    // Take screenshot after click
    await page.screenshot({ path: 'after-click.png' });
    console.log('After-click screenshot saved');

    // Check if dialog opened
    const dialog = await page.locator('[role="dialog"], .MuiDialog-root').first();
    if (await dialog.isVisible()) {
      console.log('Dialog opened successfully');
      const dialogContent = await dialog.textContent();
      console.log('Dialog content:', dialogContent.substring(0, 200));
    } else {
      console.log('No dialog appeared after clicking');
      
      // Check for error messages
      const errorElements = await page.locator('.error, [class*="error"], [class*="Error"]').all();
      for (const elem of errorElements) {
        const text = await elem.textContent();
        console.log('Error element found:', text);
      }
    }

  } catch (error) {
    console.error('Test failed:', error);
    await page.screenshot({ path: 'error-state.png' });
  } finally {
    await browser.close();
  }
})();