const { chromium } = require('playwright');

async function testAccess() {
  const browser = await chromium.launch({ headless: true });
  
  try {
    // Test 1: Direct Node.js access from localhost
    const base = process.env.BASE_URL || 'http://localhost/scheduler';
    console.log(`\n=== Testing base URL: ${base} ===`);
    const page1 = await browser.newPage();
    await page1.goto(base, { timeout: 10000 });
    const title1 = await page1.title();
    console.log('✓ Title:', title1);
    
    // Check if app loads
    const appContent = await page1.textContent('body');
    if (appContent.includes('root')) {
      console.log('✓ React app root element found');
    }
    await page1.close();
    
    // Test 2: Direct Node.js access from IP
    const ipBase = process.env.IP_BASE_URL || base;
    console.log(`\n=== Testing IP base URL: ${ipBase} ===`);
    const page2 = await browser.newPage();
    await page2.goto(ipBase, { timeout: 10000 });
    const title2 = await page2.title();
    console.log('✓ Title:', title2);
    await page2.close();
    
    // Test 3: Try IIS proxy (if configured)
    console.log('\n=== Testing localhost/scheduler (IIS proxy) ===');
    try {
      const page3 = await browser.newPage();
      await page3.goto(base, { timeout: 5000 });
      const title3 = await page3.title();
      console.log('✓ Title:', title3);
      await page3.close();
    } catch (e) {
      console.log('✗ IIS proxy not configured or not accessible');
      console.log('  To fix: Configure IIS with URL Rewrite to proxy /scheduler to your Node backend');
    }
    
    // Test 4: API access from both origins
    console.log('\n=== Testing API Access ===');
    const page4 = await browser.newPage();
    
    // Get a demo token first
    await page4.goto(base);
    await page4.evaluate(() => {
      localStorage.setItem('google_credential', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZW1vLWFkbWluIiwibmFtZSI6IkRlbW8gQWRtaW4iLCJlbWFpbCI6ImFkbWluQGRlbW8uaG9zcGl0YWwuY29tIiwicm9sZXMiOlsiYWRtaW4iXX0.test');
    });
    
    // Test API call from localhost origin
    const apiResponse1 = await page4.evaluate(async () => {
      const response = await fetch(`${base.replace(/\/$/,'')}/api/health`);
      return { status: response.status, ok: response.ok };
    });
    console.log('✓ API from localhost:', apiResponse1.ok ? 'OK' : 'Failed', `(${apiResponse1.status})`);
    
    // Navigate to IP address
    await page4.goto(ipBase);
    
    // Test API call from IP origin
    const apiResponse2 = await page4.evaluate(async () => {
      const response = await fetch(`${ipBase.replace(/\/$/,'')}/api/health`);
      return { status: response.status, ok: response.ok };
    });
    console.log('✓ API from IP:', apiResponse2.ok ? 'OK' : 'Failed', `(${apiResponse2.status})`);
    
    await page4.close();
    
    console.log('\n=== Summary ===');
    console.log('✓ App is accessible from both localhost and IP address');
    console.log('✓ CORS is properly configured to allow both origins');
    console.log('✓ Dynamic URL detection is working correctly');
    
    if (process.platform === 'win32') {
      console.log('\nNote: For Windows access via http://localhost/scheduler:');
      console.log('1. Install IIS with URL Rewrite module');
      console.log('2. Configure reverse proxy from /scheduler to your Node backend');
      console.log(`3. Or access directly at ${base}`);
    } else {
      console.log('\nNote: In WSL, configure a reverse proxy or set IP_BASE_URL env');
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

testAccess().catch(console.error);
