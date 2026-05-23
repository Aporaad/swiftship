import { test, expect } from '@playwright/test';

test('verify specific improvements', async ({ page }) => {
  await page.goto('http://localhost:5173/login');

  // Login
  await page.fill('input[type="text"], input[type="email"]', 'admin@swiftship.system');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');

  // Wait for dashboard
  await page.waitForURL('http://localhost:5173/');
  await expect(page.locator('text=ALX DELIVERY')).toBeVisible();

  // 1. Verify Orders and Manifest button
  // Click on "الطلبات" (Orders)
  await page.click('text=الطلبات');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'verify_orders.png', fullPage: true });
  // Look for "طباعة المانيفست" or "Print Manifest"
  const manifestBtn = page.locator('button:has-text("طباعة المانيفست"), button:has-text("Print Manifest")');
  console.log('Manifest button visible:', await manifestBtn.isVisible());

  // 2. Verify Expenses and Accounting Pivot
  // Click on "المصروفات" (Expenses)
  await page.click('text=المصروفات');
  await page.waitForTimeout(2000);
  // Look for "تسوية حسابات المناديب والمصانع" or "Pivot"
  const pivotTab = page.locator('text=تسوية حسابات المناديب والمصانع');
  console.log('Accounting Pivot tab visible:', await pivotTab.isVisible());
  await page.screenshot({ path: 'verify_expenses.png', fullPage: true });

  // 3. Verify Notifications/WhatsApp
  await page.click('text=الإشعارات');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'verify_notifications.png', fullPage: true });
});
