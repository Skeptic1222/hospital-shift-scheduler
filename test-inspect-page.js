const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to the app
    console.log('Navigating to http://localhost/scheduler');
    await page.goto('http://localhost/scheduler', { waitUntil: 'networkidle' });

    // Take screenshot
    await page.screenshot({ path: 'page-state.png', fullPage: true });
    console.log('Screenshot saved as page-state.png');

    // Get page content
    const title = await page.title();
    console.log('Page title:', title);

    // Check for login button
    const loginBtn = await page.$('button:has-text("Login")');
    if (loginBtn) {
      console.log('Login button found, clicking...');
      await loginBtn.click();
      await page.waitForTimeout(2000);

      // Check authentication state
      const token = await page.evaluate(() => localStorage.getItem('google_credential'));
      console.log('Auth token after login:', token ? 'Present' : 'Not present');

      // Navigate to schedule
      await page.goto('http://localhost/scheduler/schedule', { waitUntil: 'networkidle' });
      await page.screenshot({ path: 'schedule-page.png', fullPage: true });
      console.log('Schedule page screenshot saved');

      // List all buttons
      const buttons = await page.$$eval('button', btns =>
        btns.map(b => b.textContent.trim()).filter(t => t)
      );
      console.log('\nButtons found on schedule page:');
      buttons.forEach(b => console.log('  -', b));
    } else {
      // Check if already logged in
      const userInfo = await page.$('text=/Welcome|admin/i');
      if (userInfo) {
        console.log('Already logged in');

        // Navigate to schedule
        await page.goto('http://localhost/scheduler/schedule', { waitUntil: 'networkidle' });

        // List all buttons
        const buttons = await page.$$eval('button', btns =>
          btns.map(b => b.textContent.trim()).filter(t => t)
        );
        console.log('\nButtons found on schedule page:');
        buttons.forEach(b => console.log('  -', b));
      }
    }

    // Get any error messages
    const errors = await page.$$eval('.error, [class*="error"], [role="alert"]', els =>
      els.map(e => e.textContent.trim()).filter(t => t)
    );
    if (errors.length > 0) {
      console.log('\nError messages found:');
      errors.forEach(e => console.log('  -', e));
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();