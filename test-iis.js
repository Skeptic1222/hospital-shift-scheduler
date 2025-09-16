const { chromium } = require('playwright');

(async () => {
  let browser;
  let context;
  let page;

  try {
    console.log('Starting Playwright test for create shift button via IIS...');

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

    // Navigate to IIS URL
    console.log('Navigating to http://localhost/scheduler...');
    await page.goto('http://localhost/scheduler', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    console.log('Successfully loaded React app through IIS');

    // Wait for the app to load
    await page.waitForTimeout(3000);

    // Take a screenshot of the initial page
    await page.screenshot({ path: 'iis-initial-page.png' });
    console.log('Screenshot saved: iis-initial-page.png');

    // Check current URL
    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);

    // Check if we're on login page or main app
    const pageTitle = await page.title();
    console.log('Page title:', pageTitle);

    // Log all visible text
    const bodyText = await page.$eval('body', el => el.innerText);
    console.log('Page content (first 500 chars):');
    console.log(bodyText.substring(0, 500));

    // Check if login page
    const loginElements = await page.$$('button, input[type="email"], input[type="password"], [class*="login"], [class*="Login"], [id*="login"], [id*="Login"]');
    console.log(`Found ${loginElements.length} login-related elements`);

    if (loginElements.length > 0) {
      console.log('Appears to be on login page. Looking for Google sign-in...');

      // Find Google sign-in button
      const googleButton = await page.$('button:has-text("Google"), button:has-text("Sign in"), button:has-text("Login")');
      if (googleButton) {
        const buttonText = await googleButton.textContent();
        console.log(`Found login button with text: "${buttonText}"`);
        await page.screenshot({ path: 'iis-login-page.png' });
      }
    }

    // Try to navigate to schedule directly
    console.log('Attempting to navigate to schedule page...');
    await page.goto('http://localhost/scheduler/schedule', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    await page.waitForTimeout(2000);

    // Take screenshot
    await page.screenshot({ path: 'iis-schedule-page.png' });
    console.log('Screenshot saved: iis-schedule-page.png');

    // Look for any buttons or FABs
    const allButtons = await page.$$eval('button, [role="button"], .MuiFab-root, [class*="Fab"]', elements =>
      elements.map(el => ({
        text: el.textContent?.trim(),
        className: el.className,
        id: el.id,
        ariaLabel: el.getAttribute('aria-label'),
        title: el.getAttribute('title'),
        innerHTML: el.innerHTML.substring(0, 100)
      }))
    );

    console.log(`Found ${allButtons.length} button elements:`);
    allButtons.forEach((btn, i) => {
      console.log(`  ${i + 1}. Text: "${btn.text}", Class: "${btn.className}", Aria: "${btn.ariaLabel}", Title: "${btn.title}"`);
    });

    // Look specifically for FAB or Add button
    const addButton = await page.$('.MuiFab-root, button[aria-label*="add" i], button[aria-label*="create" i], button[title*="create" i], button:has-text("+")');

    if (addButton) {
      console.log('Found Add/Create button!');
      const buttonInfo = await addButton.evaluate(el => ({
        className: el.className,
        ariaLabel: el.getAttribute('aria-label'),
        title: el.getAttribute('title'),
        text: el.textContent
      }));
      console.log('Button info:', buttonInfo);

      // Click it
      console.log('Clicking the button...');
      await addButton.click();
      await page.waitForTimeout(2000);

      // Take screenshot after click
      await page.screenshot({ path: 'iis-after-click.png' });
      console.log('Screenshot saved: iis-after-click.png');

      // Check if a dialog opened
      const dialog = await page.$('[role="dialog"], .MuiDialog-root, [class*="Dialog"]');
      if (dialog) {
        console.log('Dialog opened!');

        // Look for form fields
        const formFields = await page.$$eval('input, select, textarea', fields =>
          fields.map(f => ({
            name: f.name,
            id: f.id,
            type: f.type,
            placeholder: f.placeholder,
            label: f.getAttribute('aria-label')
          }))
        );

        console.log('Form fields found:');
        formFields.forEach(field => {
          console.log(`  - ${field.type}: name="${field.name}", id="${field.id}", placeholder="${field.placeholder}"`);
        });

        console.log('✅ Test completed successfully - Create Shift dialog opened!');
      } else {
        console.log('⚠️ Button clicked but no dialog opened');
      }
    } else {
      console.log('❌ No Add/Create button found');

      // Log page structure for debugging
      const pageStructure = await page.evaluate(() => {
        const elements = [];
        document.querySelectorAll('main, section, div[class*="Container"], div[class*="content"]').forEach(el => {
          elements.push({
            tag: el.tagName,
            className: el.className,
            id: el.id,
            childCount: el.children.length
          });
        });
        return elements;
      });

      console.log('Page structure:');
      pageStructure.forEach(el => {
        console.log(`  <${el.tag} class="${el.className}" id="${el.id}"> (${el.childCount} children)`);
      });
    }

  } catch (error) {
    console.error('Test failed:', error);
    if (page) {
      await page.screenshot({ path: 'iis-error-screenshot.png' });
      console.log('Error screenshot saved: iis-error-screenshot.png');
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }
})();