const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    // Navigate to the app
    const base = process.env.BASE_URL || 'http://localhost/scheduler';
    console.log(`Navigating to ${base}...`);
    await page.goto(base, { waitUntil: 'networkidle' });
    
    // Check if we're on the login page or main page
    const title = await page.title();
    console.log('Page title:', title);
    
    // Try to navigate to admin page directly
    console.log('Navigating to admin page...');
    await page.goto(`${base.replace(/\/$/,'')}/admin`, { waitUntil: 'networkidle' });
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'admin-page.png' });
    console.log('Screenshot saved to admin-page.png');
    
    // Check if database status is visible
    const databaseStatus = await page.locator('text=/Database/i').first().isVisible().catch(() => false);
    console.log('Database text visible:', databaseStatus);
    
    // Look for the actual status - check for both Connected and Disconnected
    const connectedChip = await page.locator('text=/Connected/i').first().isVisible().catch(() => false);
    const disconnectedChip = await page.locator('text=/Disconnected/i').first().isVisible().catch(() => false);
    
    console.log('Connected chip visible:', connectedChip);
    console.log('Disconnected chip visible:', disconnectedChip);
    
    // More specific check for the MUI Chip with "Connected" text
    const connectedChipExists = await page.locator('.MuiChip-root:has-text("Connected")').count() > 0;
    console.log('MUI Connected chip exists:', connectedChipExists);
    
    // Check what the API returns
    const response = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/admin/status');
        return await res.json();
      } catch (e) {
        return { error: e.message };
      }
    });
    
    console.log('API /api/admin/status response:', JSON.stringify(response, null, 2));
    
    // Try to get the settings endpoint with cookies
    const settingsResponse = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/admin/settings', {
          credentials: 'include'
        });
        if (!res.ok) {
          return { status: res.status, statusText: res.statusText };
        }
        return await res.json();
      } catch (e) {
        return { error: e.message };
      }
    });
    
    console.log('API /api/admin/settings response:', JSON.stringify(settingsResponse, null, 2));
    
    // Get the page HTML for debugging
    const pageContent = await page.content();
    const hasDatabase = pageContent.includes('Database');
    const hasConnected = pageContent.includes('Connected');
    const hasDisconnected = pageContent.includes('Disconnected');
    
    console.log('Page contains "Database":', hasDatabase);
    console.log('Page contains "Connected":', hasConnected);
    console.log('Page contains "Disconnected":', hasDisconnected);
    
    // Final verdict
    console.log('\n=== FINAL STATUS ===');
    if (connectedChipExists || connectedChip) {
      console.log('✅ SUCCESS: Database shows as CONNECTED in the admin panel');
    } else if (disconnectedChip) {
      console.log('❌ FAILURE: Database still shows as DISCONNECTED in the admin panel');
    } else {
      console.log('⚠️ WARNING: Could not determine database status from UI');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
})();
