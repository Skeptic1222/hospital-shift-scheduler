const { chromium } = require('playwright');

// Configuration
// ⚠️ CRITICAL: NO PORTS IN URLS - See NO-PORT-RULE.md
// IIS proxies /scheduler to internal port - NEVER use ports in URLs
const BASE_URL = 'http://localhost/scheduler';
const SCHEDULER_URL = 'http://localhost/scheduler';

// Test Results
const results = {
  totalTests: 0,
  passed: 0,
  failed: 0,
  errors: [],
  screenshots: []
};

async function logTest(name, passed, error = null) {
  results.totalTests++;
  if (passed) {
    results.passed++;
    console.log(`✅ ${name}`);
  } else {
    results.failed++;
    console.log(`❌ ${name}`);
    if (error) {
      results.errors.push({ test: name, error: error.message || error });
      console.log(`   Error: ${error.message || error}`);
    }
  }
}

async function runE2ETests() {
  let browser;
  let context;
  let page;
  
  try {
    console.log('\n🚀 Starting E2E Testing Suite for Hospital Shift Scheduler\n');
    console.log('=' .repeat(60));
    
    // Launch browser
    browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      ignoreHTTPSErrors: true
    });
    page = await context.newPage();
    
    // Test 1: Server Health Check
    console.log('\n📋 API Health Checks\n');
    try {
      const response = await page.goto(`${BASE_URL}/api/health`);
      await logTest('API Health Endpoint', response.status() === 200);
      const health = await response.json();
      await logTest('API Returns Valid JSON', !!health.status);
    } catch (error) {
      await logTest('API Health Endpoint', false, error);
    }
    
    // Test 2: Frontend Loading
    console.log('\n🖥️ Frontend Loading Tests\n');
    try {
      const response = await page.goto(BASE_URL, { waitUntil: 'networkidle' });
      await logTest('Frontend Loads Successfully', response.status() === 200);
      
      // Check if React app mounts
      const rootElement = await page.$('#root');
      await logTest('React Root Element Exists', !!rootElement);
      
      // Check for essential UI elements
      const hasContent = await page.evaluate(() => {
        const root = document.querySelector('#root');
        return root && root.children.length > 0;
      });
      await logTest('React App Renders Content', hasContent);
    } catch (error) {
      await logTest('Frontend Loading', false, error);
    }
    
    // Test 3: Navigation Tests
    console.log('\n🧭 Navigation Tests\n');
    const routes = [
      { path: '/', name: 'Dashboard' },
      { path: '/#/schedule', name: 'Schedule' },
      { path: '/#/admin', name: 'Admin' },
      { path: '/#/settings', name: 'Settings' }
    ];
    
    for (const route of routes) {
      try {
        await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
        const hasContent = await page.evaluate(() => {
          return document.body.innerText.length > 0;
        });
        await logTest(`${route.name} Page Loads`, hasContent);
      } catch (error) {
        await logTest(`${route.name} Page Loads`, false, error);
      }
    }
    
    // Test 4: Shift Creation Flow
    console.log('\n📅 Shift Management Tests\n');
    try {
      await page.goto(`${BASE_URL}/#/schedule`, { waitUntil: 'networkidle' });
      
      // Look for create shift button
      const createButton = await page.$('button:has-text("Create"), button:has-text("Add"), button:has-text("New")');
      await logTest('Create Shift Button Exists', !!createButton);
      
      if (createButton) {
        await createButton.click();
        await page.waitForTimeout(500);
        
        // Check if dialog or form appears
        const hasDialog = await page.evaluate(() => {
          return !!document.querySelector('[role="dialog"], .MuiDialog-root, form');
        });
        await logTest('Shift Creation Dialog Opens', hasDialog);
      }
    } catch (error) {
      await logTest('Shift Creation Flow', false, error);
    }
    
    // Test 5: Admin Panel Access
    console.log('\n🔐 Admin Panel Tests\n');
    try {
      await page.goto(`${BASE_URL}/#/admin`, { waitUntil: 'networkidle' });
      
      // Check for admin-specific elements
      const hasAdminContent = await page.evaluate(() => {
        const text = document.body.innerText;
        return text.includes('Admin') || text.includes('Settings') || text.includes('Database');
      });
      await logTest('Admin Panel Loads', hasAdminContent);
      
      // Check database status indicator
      const dbStatus = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('*'));
        return elements.some(el => el.innerText && (el.innerText.includes('Connected') || el.innerText.includes('Disconnected')));
      });
      await logTest('Database Status Displayed', dbStatus);
    } catch (error) {
      await logTest('Admin Panel Tests', false, error);
    }
    
    // Test 6: Mobile Responsiveness
    console.log('\n📱 Mobile Responsiveness Tests\n');
    try {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(`${BASE_URL}`, { waitUntil: 'networkidle' });
      
      const isMobileResponsive = await page.evaluate(() => {
        const root = document.querySelector('#root');
        return root && window.innerWidth <= 375;
      });
      await logTest('Mobile Viewport Renders', isMobileResponsive);
      
      // Check for hamburger menu or mobile navigation
      const hasMobileNav = await page.evaluate(() => {
        return !!document.querySelector('[aria-label*="menu"], .MuiIconButton-root, button[aria-label*="navigation"]');
      });
      await logTest('Mobile Navigation Available', hasMobileNav);
      
      // Reset viewport
      await page.setViewportSize({ width: 1280, height: 720 });
    } catch (error) {
      await logTest('Mobile Responsiveness', false, error);
    }
    
    // Test 7: API Error Handling
    console.log('\n⚠️ Error Handling Tests\n');
    try {
      // Test invalid API endpoint
      const response = await page.goto(`${BASE_URL}/api/invalid-endpoint`);
      await logTest('Invalid API Returns 404', response.status() === 404);
      
      // Test API with invalid data
      const postResponse = await page.evaluate(async () => {
        try {
          const res = await fetch('/api/shifts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ invalid: 'data' })
          });
          return { status: res.status };
        } catch (err) {
          return { error: err.message };
        }
      });
      await logTest('Invalid POST Data Handled', postResponse.status >= 400 || !!postResponse.error);
    } catch (error) {
      await logTest('Error Handling', false, error);
    }
    
    // Test 8: Performance Metrics
    console.log('\n⚡ Performance Tests\n');
    try {
      await page.goto(`${BASE_URL}`, { waitUntil: 'networkidle' });
      
      const metrics = await page.evaluate(() => {
        const perf = performance.getEntriesByType('navigation')[0];
        return {
          domContentLoaded: perf.domContentLoadedEventEnd - perf.domContentLoadedEventStart,
          loadComplete: perf.loadEventEnd - perf.loadEventStart,
          firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0
        };
      });
      
      await logTest('Page Load < 3 seconds', metrics.loadComplete < 3000);
      await logTest('DOM Content Loaded < 2 seconds', metrics.domContentLoaded < 2000);
    } catch (error) {
      await logTest('Performance Metrics', false, error);
    }
    
    // Test 9: Security Headers
    console.log('\n🔒 Security Tests\n');
    try {
      const response = await page.goto(`${BASE_URL}`);
      const headers = response.headers();
      
      await logTest('X-Content-Type-Options Header', headers['x-content-type-options'] === 'nosniff');
      await logTest('No X-Powered-By Header', !headers['x-powered-by']);
    } catch (error) {
      await logTest('Security Headers', false, error);
    }
    
    // Test 10: Accessibility Basics
    console.log('\n♿ Accessibility Tests\n');
    try {
      await page.goto(`${BASE_URL}`, { waitUntil: 'networkidle' });
      
      // Check for proper heading structure
      const hasH1 = await page.$('h1');
      await logTest('Page Has H1 Heading', !!hasH1);
      
      // Check for alt text on images
      const imagesWithoutAlt = await page.evaluate(() => {
        const images = document.querySelectorAll('img');
        return Array.from(images).filter(img => !img.alt).length;
      });
      await logTest('All Images Have Alt Text', imagesWithoutAlt === 0);
      
      // Check for form labels
      const inputsWithoutLabels = await page.evaluate(() => {
        const inputs = document.querySelectorAll('input:not([type="hidden"])');
        return Array.from(inputs).filter(input => {
          return !input.getAttribute('aria-label') && !input.labels?.length;
        }).length;
      });
      await logTest('Form Inputs Have Labels', inputsWithoutLabels === 0);
    } catch (error) {
      await logTest('Accessibility Tests', false, error);
    }
    
    // Take final screenshot
    await page.screenshot({ path: 'e2e-final-state.png', fullPage: true });
    results.screenshots.push('e2e-final-state.png');
    
  } catch (error) {
    console.error('\n❌ Fatal Error:', error);
    results.errors.push({ test: 'Test Suite', error: error.message });
  } finally {
    // Cleanup
    if (browser) {
      await browser.close();
    }
    
    // Print Summary
    console.log('\n' + '=' .repeat(60));
    console.log('\n📊 TEST RESULTS SUMMARY\n');
    console.log(`Total Tests: ${results.totalTests}`);
    console.log(`✅ Passed: ${results.passed} (${((results.passed/results.totalTests)*100).toFixed(1)}%)`);
    console.log(`❌ Failed: ${results.failed} (${((results.failed/results.totalTests)*100).toFixed(1)}%)`);
    
    if (results.errors.length > 0) {
      console.log('\n🐛 Error Details:');
      results.errors.forEach(err => {
        console.log(`  - ${err.test}: ${err.error}`);
      });
    }
    
    console.log('\n' + '=' .repeat(60));
    
    // Exit with appropriate code
    process.exit(results.failed > 0 ? 1 : 0);
  }
}

// Run the tests
runE2ETests();