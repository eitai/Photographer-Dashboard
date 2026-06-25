import { test, expect } from '@playwright/test';

const API = 'http://localhost:5000';

test.beforeEach(async ({ page }) => {
  // Ensure no supplier session is cached
  await page.addInitScript(() => {
    localStorage.removeItem('koral_supplier');
  });
});

test.describe('Supplier login page', () => {
  test('renders email and password fields with correct IDs', async ({ page }) => {
    await page.goto('/supplier/login');

    await expect(page.locator('#supplier-email')).toBeVisible();
    await expect(page.locator('#supplier-password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('email field has correct autocomplete and type', async ({ page }) => {
    await page.goto('/supplier/login');

    const emailInput = page.locator('#supplier-email');
    await expect(emailInput).toHaveAttribute('type', 'email');
    await expect(emailInput).toHaveAttribute('autocomplete', 'email');
  });

  test('shows inline error on failed login (401)', async ({ page }) => {
    await page.route(`${API}/api/supplier/auth/login`, (route) =>
      route.fulfill({ status: 401, json: { message: 'Invalid credentials' } })
    );

    await page.goto('/supplier/login');

    await page.locator('#supplier-email').fill('bad@example.com');
    await page.locator('#supplier-password').fill('wrongpassword');
    await page.locator('button[type="submit"]').click();

    // Error message with role="alert"
    await expect(page.locator('[role="alert"]')).toBeVisible();
  });

  test('disables submit button while request is in flight', async ({ page }) => {
    // Delay the response so we can observe the loading state
    await page.route(`${API}/api/supplier/auth/login`, async (route) => {
      await new Promise((r) => setTimeout(r, 500));
      await route.fulfill({ status: 401, json: { message: 'Invalid credentials' } });
    });

    await page.goto('/supplier/login');

    await page.locator('#supplier-email').fill('test@example.com');
    await page.locator('#supplier-password').fill('password');

    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    // Button should be disabled during the in-flight request
    await expect(submitBtn).toBeDisabled();
  });

  test('redirects to /supplier/products after successful login', async ({ page }) => {
    const fakeSupplier = {
      id: '1',
      name: 'Test Supplier',
      email: 'supplier@test.com',
      businessName: 'Test Business',
    };

    await page.route(`${API}/api/supplier/auth/login`, (route) =>
      route.fulfill({ status: 200, json: { supplier: fakeSupplier } })
    );
    // Mock subsequent me check for the SupplierProtectedRoute
    await page.route(`${API}/api/supplier/auth/me`, (route) =>
      route.fulfill({ status: 200, json: { supplier: fakeSupplier } })
    );

    await page.goto('/supplier/login');

    await page.locator('#supplier-email').fill('supplier@test.com');
    await page.locator('#supplier-password').fill('correctpassword');
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL('/supplier/products');
  });

  test('split-panel layout — left panel hidden on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/supplier/login');

    // The left panel uses hidden md:flex, so on mobile it should not be visible
    const leftPanel = page.locator('.hidden.md\\:flex');
    await expect(leftPanel).toBeHidden();

    // Mobile logo above form should be visible instead
    const mobileLogo = page.locator('.md\\:hidden');
    await expect(mobileLogo).toBeVisible();
  });
});
