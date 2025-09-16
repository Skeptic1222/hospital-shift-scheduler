const { test, expect } = require('@playwright/test');

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost/scheduler';
const ADMIN_EMAIL = 'admin@demo.hospital.com';
const ADMIN_PASSWORD = 'Admin123!';

test.describe('Admin User Management', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto(`${BASE_URL}/login`);
    
    // Login as admin
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    
    // Wait for navigation to dashboard
    await page.waitForURL(/dashboard/);
    
    // Navigate to admin panel
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForSelector('text=Admin Panel');
  });

  // Demo mode removed; related tests omitted

  test('should add a new user', async ({ page }) => {
    // Click Add User button
    await page.click('button:has-text("Add User")');
    
    // Wait for form to appear
    await expect(page.locator('text=Add New User')).toBeVisible();
    
    // Fill in user details
    const timestamp = Date.now();
    const testEmail = `test${timestamp}@hospital.com`;
    
    await page.fill('input[label="First Name"]', 'Test');
    await page.fill('input[label="Last Name"]', 'User');
    await page.fill('input[label="Email"]', testEmail);
    
    // Select role
    await page.click('[label="Role"]');
    await page.click('li[data-value="user"]');
    
    // Add department
    await page.fill('input[label*="Department"]', 'ICU');
    
    // Submit form
    await page.click('button:has-text("Add User"):not(:has-text("Add New"))');
    
    // Wait for success message
    await expect(page.locator('text=User added successfully')).toBeVisible();
    
    // Verify user appears in list
    await expect(page.locator(`text=${testEmail}`)).toBeVisible();
  });

  test('should validate email format when adding user', async ({ page }) => {
    // Click Add User button
    await page.click('button:has-text("Add User")');
    
    // Fill in invalid email
    await page.fill('input[label="First Name"]', 'Test');
    await page.fill('input[label="Last Name"]', 'User');
    await page.fill('input[label="Email"]', 'invalid-email');
    
    // Tab out to trigger validation
    await page.keyboard.press('Tab');
    
    // Check for error message
    await expect(page.locator('text=Please enter a valid email address')).toBeVisible();
  });

  test('should change user role', async ({ page }) => {
    // Find a user in the list (not the admin user)
    const userItem = page.locator('[class*="MuiListItem"]').filter({ hasText: 'supervisor@demo.hospital.com' }).first();
    
    if (await userItem.isVisible()) {
      // Find the role selector in this user's row
      const roleSelect = userItem.locator('[class*="MuiSelect"]');
      const currentRole = await roleSelect.inputValue();
      
      // Change the role
      await roleSelect.click();
      const newRole = currentRole === 'supervisor' ? 'user' : 'supervisor';
      await page.click(`li[data-value="${newRole}"]`);
      
      // Check that Save button appears
      const saveButton = page.locator('button').filter({ hasText: 'Save' }).first();
      await expect(saveButton).toBeVisible();
      
      // Save changes
      await saveButton.click();
      
      // Wait for success message
      await expect(page.locator('text=/Successfully updated/')).toBeVisible();
    }
  });

  test('should delete a user', async ({ page }) => {
    // First add a user to delete
    await page.click('button:has-text("Add User")');
    
    const timestamp = Date.now();
    const testEmail = `delete${timestamp}@hospital.com`;
    
    await page.fill('input[label="First Name"]', 'Delete');
    await page.fill('input[label="Last Name"]', 'Me');
    await page.fill('input[label="Email"]', testEmail);
    await page.click('button:has-text("Add User"):not(:has-text("Add New"))');
    
    // Wait for user to be added
    await expect(page.locator(`text=${testEmail}`)).toBeVisible();
    
    // Find delete button for this user
    const userItem = page.locator('[class*="MuiListItem"]').filter({ hasText: testEmail });
    const deleteButton = userItem.locator('[class*="MuiIconButton"][color="error"]');
    
    await deleteButton.click();
    
    // Confirm deletion in dialog
    await expect(page.locator('text=Confirm Delete User')).toBeVisible();
    await page.click('button:has-text("Delete"):not(:has-text("Deleting"))');
    
    // Wait for success message
    await expect(page.locator('text=User deleted successfully')).toBeVisible();
    
    // Verify user is removed from list
    await expect(page.locator(`text=${testEmail}`)).not.toBeVisible();
  });

  test('should search for users', async ({ page }) => {
    // Type in search box
    await page.fill('input[placeholder="Search users..."]', 'admin');
    
    // Check that admin user is visible
    await expect(page.locator('text=admin@demo.hospital.com')).toBeVisible();
    
    // Check that non-matching users are not visible
    const supervisorVisible = await page.locator('text=supervisor@demo.hospital.com').isVisible();
    expect(supervisorVisible).toBeFalsy();
    
    // Clear search
    await page.click('[class*="MuiIconButton"]:has([data-testid="ClearIcon"])');
    
    // All users should be visible again
    await expect(page.locator('text=supervisor@demo.hospital.com')).toBeVisible();
  });

  test('should show external services status', async ({ page }) => {
    // Expand services section if needed
    const servicesSection = page.locator('text=External Services');
    await servicesSection.click();
    
    // Check for service indicators
    await expect(page.locator('text=Database')).toBeVisible();
    await expect(page.locator('text=Redis Cache')).toBeVisible();
    await expect(page.locator('text=Email Service')).toBeVisible();
    await expect(page.locator('text=SMS Service')).toBeVisible();
    
    // Each should have a status chip
    const statusChips = page.locator('[class*="MuiChip"]').filter({ 
      hasText: /Connected|Disconnected|Available|Not Available|Configured|Not Configured/ 
    });
    
    const chipCount = await statusChips.count();
    expect(chipCount).toBeGreaterThanOrEqual(4);
  });

  test('Request Time Off button should not overflow', async ({ page }) => {
    // Navigate to dashboard
    await page.goto(`${BASE_URL}/dashboard`);
    
    // Find the Time Off button
    const timeOffButton = page.locator('button').filter({ hasText: /Time Off/ });
    
    if (await timeOffButton.isVisible()) {
      // Get button dimensions
      const box = await timeOffButton.boundingBox();
      
      // Check that text fits within button
      const buttonText = await timeOffButton.innerText();
      expect(buttonText).not.toContain('...');
      
      // Check button has reasonable width
      expect(box.width).toBeGreaterThan(50);
      expect(box.width).toBeLessThan(300);
    }
  });
});

test.describe('Button Text Overflow Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard/);
  });

  test('should check all buttons for text overflow', async ({ page }) => {
    // Test on different pages
    const pages = ['/dashboard', '/schedule', '/queue', '/staff', '/admin', '/settings', '/profile'];
    
    for (const pagePath of pages) {
      await page.goto(`${BASE_URL}${pagePath}`);
      await page.waitForLoadState('networkidle');
      
      // Get all buttons
      const buttons = page.locator('button');
      const buttonCount = await buttons.count();
      
      for (let i = 0; i < buttonCount; i++) {
        const button = buttons.nth(i);
        
        if (await button.isVisible()) {
          const text = await button.innerText();
          
          // Skip icon-only buttons
          if (text && text.trim().length > 0) {
            // Check for ellipsis in computed style
            const overflow = await button.evaluate(el => {
              const style = window.getComputedStyle(el);
              return style.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth;
            });
            
            // Log if overflow detected
            if (overflow) {
              console.warn(`Button overflow detected on ${pagePath}: "${text}"`);
            }
            
            // Ensure no unwanted ellipsis
            expect(text).not.toMatch(/\.\.\./);
          }
        }
      }
    }
  });
});
