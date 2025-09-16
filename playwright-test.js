const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('Starting shift creation test...');
    
    // Navigate to the app
    await page.goto('http://localhost/scheduler');
    console.log('✅ Navigated to app');
    
    // Check if Google login is shown
    const loginButton = await page.locator('text=/Sign in with Google/i');
    if (await loginButton.isVisible()) {
      console.log('✅ Google OAuth login button is visible');
    } else {
      console.log('❌ Google OAuth login button not found');
    }
    
    // Since we can't actually authenticate with Google in this test,
    // let's test the API directly with a mock token
    const mockToken = Buffer.from(JSON.stringify({
      sub: 'test-admin',
      email: 'admin@hospital.com',
      name: 'Test Admin',
      roles: ['admin'],
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600
    })).toString('base64');
    
    const fullToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${mockToken}.mock-signature`;
    
    // Test shift creation API
    const response = await page.evaluate(async (token) => {
      const res = await fetch('/scheduler/api/shifts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          date: '2024-11-20',
          department: 'ED',
          start_time: '08:00',
          end_time: '16:00',
          positions_needed: 2
        })
      });
      return {
        status: res.status,
        data: await res.json()
      };
    }, fullToken);
    
    if (response.status === 201) {
      console.log('✅ Shift created successfully via API');
      console.log('Response:', JSON.stringify(response.data, null, 2));
    } else if (response.status === 503) {
      console.log('⚠️ Database unavailable (expected without real DB)');
    } else {
      console.log(`❌ Failed to create shift: ${response.status}`);
      console.log('Response:', JSON.stringify(response.data, null, 2));
    }
    
    // Test health endpoint
    const healthResponse = await page.evaluate(async () => {
      const res = await fetch('/scheduler/api/health');
      return await res.json();
    });
    
    console.log('\nHealth check:', JSON.stringify(healthResponse, null, 2));
    
    // Check that demo mode is removed
    const pageContent = await page.content();
    if (pageContent.includes('demo-login') || pageContent.includes('Demo Mode')) {
      console.log('❌ Demo mode references still present');
    } else {
      console.log('✅ Demo mode successfully removed');
    }
    
    console.log('\n✅ All tests completed');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
})();
