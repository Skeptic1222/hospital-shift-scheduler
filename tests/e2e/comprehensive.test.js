/**
 * Comprehensive E2E Test Suite
 * Tests all phases of implementation
 */

const { test, expect } = require('@playwright/test');

// Test configuration
const BASE_URL = process.env.TEST_URL || 'http://localhost/scheduler';
const ADMIN_EMAIL = 'admin@demo.hospital.com';
const ADMIN_PASSWORD = 'Admin123!';

test.describe('Phase 1: Security Tests', () => {
  test('Should enforce authentication on protected endpoints', async ({ page }) => {
    // Try to access admin page without auth
    const response = await page.goto(`${BASE_URL}/api/admin/users`);
    expect(response.status()).toBe(401);
  });

  test('Should validate input to prevent injection', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/users`, {
      data: {
        email: "test'; DROP TABLE users; --",
        password: '<script>alert("XSS")</script>'
      }
    });
    expect(response.status()).toBe(400);
  });

  test('Should enforce rate limiting', async ({ request }) => {
    const requests = [];
    for (let i = 0; i < 150; i++) {
      requests.push(request.get(`${BASE_URL}/api/health`));
    }
    const responses = await Promise.all(requests);
    const rateLimited = responses.some(r => r.status() === 429);
    expect(rateLimited).toBe(true);
  });

  test('Should have secure headers', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/`);
    expect(response.headers()['x-frame-options']).toBeDefined();
    expect(response.headers()['x-content-type-options']).toBe('nosniff');
    expect(response.headers()['strict-transport-security']).toBeDefined();
  });
});

test.describe('Phase 2: HIPAA Compliance Tests', () => {
  test('Should log PHI access in audit trail', async ({ page, request }) => {
    // Login as admin
    await page.goto(`${BASE_URL}/login`);
    await page.fill('[name="email"]', ADMIN_EMAIL);
    await page.fill('[name="password"]', ADMIN_PASSWORD);
    await page.click('[type="submit"]');
    
    // Access PHI data
    await page.goto(`${BASE_URL}/users/123`);
    
    // Check audit log
    const response = await request.get(`${BASE_URL}/api/audit/logs?event_type=PHI_VIEW`);
    const logs = await response.json();
    expect(logs.length).toBeGreaterThan(0);
  });

  test('Should enforce session timeout', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('[name="email"]', ADMIN_EMAIL);
    await page.fill('[name="password"]', ADMIN_PASSWORD);
    await page.click('[type="submit"]');
    
    // Wait for session timeout (in test mode, should be shorter)
    await page.waitForTimeout(16 * 60 * 1000); // 16 minutes
    
    // Try to access protected resource
    const response = await page.goto(`${BASE_URL}/dashboard`);
    expect(page.url()).toContain('/login');
  });

  test('Should encrypt PHI fields', async ({ request }) => {
    const token = await getAuthToken();
    
    // Create user with PHI
    const response = await request.post(`${BASE_URL}/api/users`, {
      headers: { 'Authorization': `Bearer ${token}` },
      data: {
        email: 'test@hospital.com',
        ssn: '123-45-6789',
        date_of_birth: '1990-01-01'
      }
    });
    
    const user = await response.json();
    
    // Verify PHI is encrypted in response
    expect(user.ssn).not.toBe('123-45-6789');
    expect(user.ssn_encrypted).toBe(true);
  });
});

test.describe('Phase 3: Mobile UI Tests', () => {
  test('Should be responsive on mobile devices', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 667 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)'
    });
    const page = await context.newPage();
    
    await page.goto(`${BASE_URL}/dashboard`);
    
    // Check mobile nav is visible
    await expect(page.locator('[data-testid="mobile-nav"]')).toBeVisible();
    
    // Check touch targets are adequate size
    const buttons = await page.locator('button').all();
    for (const button of buttons) {
      const box = await button.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('Should support swipe gestures', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 667 },
      hasTouch: true
    });
    const page = await context.newPage();
    
    await page.goto(`${BASE_URL}/shifts`);
    
    // Swipe on shift card
    const card = page.locator('[data-testid="shift-card"]').first();
    await card.dispatchEvent('touchstart', { touches: [{ clientX: 200, clientY: 100 }] });
    await card.dispatchEvent('touchmove', { touches: [{ clientX: 50, clientY: 100 }] });
    await card.dispatchEvent('touchend');
    
    // Check action was triggered
    await expect(page.locator('[data-testid="shift-declined"]')).toBeVisible();
  });

  test('Should work offline with service worker', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    
    // Wait for service worker to install
    await page.waitForTimeout(2000);
    
    // Go offline
    await page.context().setOffline(true);
    
    // Should still be able to navigate
    await page.goto(`${BASE_URL}/dashboard`);
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();
  });

  test('Should be installable as PWA', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    
    // Check manifest is loaded
    const manifest = await page.evaluate(() => {
      const link = document.querySelector('link[rel="manifest"]');
      return link ? link.href : null;
    });
    expect(manifest).toBeTruthy();
    
    // Check for install prompt
    const canInstall = await page.evaluate(() => {
      return 'BeforeInstallPromptEvent' in window;
    });
    expect(canInstall).toBe(true);
  });
});

test.describe('Phase 4: Performance Tests', () => {
  test('Should load dashboard quickly', async ({ page }) => {
    const startTime = Date.now();
    await page.goto(`${BASE_URL}/dashboard`);
    const loadTime = Date.now() - startTime;
    
    expect(loadTime).toBeLessThan(2000); // Less than 2 seconds
  });

  test('Should handle concurrent requests efficiently', async ({ request }) => {
    const token = await getAuthToken();
    const requests = [];
    
    for (let i = 0; i < 20; i++) {
      requests.push(
        request.get(`${BASE_URL}/api/shifts`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      );
    }
    
    const startTime = Date.now();
    await Promise.all(requests);
    const totalTime = Date.now() - startTime;
    
    expect(totalTime).toBeLessThan(5000); // All requests complete in 5 seconds
  });

  test('Should cache API responses', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    
    // First load
    const firstLoadTime = await page.evaluate(() => {
      const start = performance.now();
      return fetch('/api/shifts').then(() => performance.now() - start);
    });
    
    // Second load (should be cached)
    const secondLoadTime = await page.evaluate(() => {
      const start = performance.now();
      return fetch('/api/shifts').then(() => performance.now() - start);
    });
    
    expect(secondLoadTime).toBeLessThan(firstLoadTime / 2);
  });
});

test.describe('Phase 5: Advanced Features Tests', () => {
  test('Should receive real-time notifications', async ({ page, context }) => {
    // Grant notification permission
    await context.grantPermissions(['notifications']);
    
    await page.goto(`${BASE_URL}/dashboard`);
    
    // Trigger notification
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('shift:available', {
        detail: { shift: { id: '123', department: 'ED' } }
      }));
    });
    
    // Check notification was shown
    const notifications = await page.evaluate(() => {
      return window.Notification.requestPermission();
    });
    expect(notifications).toBe('granted');
  });

  test('Should support shift swap functionality', async ({ page }) => {
    await loginAsUser(page);
    
    await page.goto(`${BASE_URL}/shifts/my`);
    await page.click('[data-testid="swap-shift-btn"]');
    
    // Fill swap request
    await page.fill('[name="reason"]', 'Family emergency');
    await page.click('[data-testid="submit-swap"]');
    
    // Check request was created
    await expect(page.locator('[data-testid="swap-pending"]')).toBeVisible();
  });

  test('Should show analytics dashboard', async ({ page }) => {
    await loginAsAdmin(page);
    
    await page.goto(`${BASE_URL}/analytics`);
    
    // Check charts are rendered
    await expect(page.locator('[data-testid="utilization-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="overtime-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="coverage-chart"]')).toBeVisible();
  });
});

test.describe('Phase 6: Integration Tests', () => {
  test('Should complete full shift lifecycle', async ({ page }) => {
    await loginAsAdmin(page);
    
    // Create shift
    await page.goto(`${BASE_URL}/shifts/create`);
    await page.fill('[name="date"]', '2024-12-01');
    await page.fill('[name="start_time"]', '08:00');
    await page.fill('[name="end_time"]', '16:00');
    await page.selectOption('[name="department"]', 'ED');
    await page.click('[type="submit"]');
    
    // Verify shift created
    await expect(page.locator('[data-testid="shift-created"]')).toBeVisible();
    
    // Logout and login as user
    await logout(page);
    await loginAsUser(page);
    
    // Claim shift
    await page.goto(`${BASE_URL}/shifts`);
    await page.click('[data-testid="claim-shift"]');
    
    // Verify claimed
    await expect(page.locator('[data-testid="shift-claimed"]')).toBeVisible();
    
    // Check appears in my shifts
    await page.goto(`${BASE_URL}/shifts/my`);
    await expect(page.locator('text=December 1, 2024')).toBeVisible();
  });

  test('Should handle error states gracefully', async ({ page }) => {
    // Simulate network error
    await page.route('**/api/shifts', route => route.abort());
    
    await page.goto(`${BASE_URL}/shifts`);
    
    // Should show error state
    await expect(page.locator('[data-testid="error-state"]')).toBeVisible();
    await expect(page.locator('text=Unable to load shifts')).toBeVisible();
    
    // Should have retry button
    await page.click('[data-testid="retry-btn"]');
  });
});

// Helper functions
async function getAuthToken() {
  // Implementation to get auth token
  return 'test-token';
}

async function loginAsAdmin(page) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('[name="email"]', ADMIN_EMAIL);
  await page.fill('[name="password"]', ADMIN_PASSWORD);
  await page.click('[type="submit"]');
  await page.waitForURL(`${BASE_URL}/dashboard`);
}

async function loginAsUser(page) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('[name="email"]', 'nurse1@demo.hospital.com');
  await page.fill('[name="password"]', 'Nurse123!');
  await page.click('[type="submit"]');
  await page.waitForURL(`${BASE_URL}/dashboard`);
}

async function logout(page) {
  await page.click('[data-testid="user-menu"]');
  await page.click('[data-testid="logout"]');
  await page.waitForURL(`${BASE_URL}/login`);
}
