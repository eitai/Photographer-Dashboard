import { test, expect } from '@playwright/test';

const API = 'http://localhost:5000';

test.beforeEach(async ({ page }) => {
  // Clear any cached auth so tests start unauthenticated
  await page.addInitScript(() => {
    localStorage.removeItem('koral_admin_user');
    localStorage.removeItem('koral_admin_token');
  });
});

test.describe('Admin login page', () => {
  test('renders email, password fields and sign-in button', async ({ page }) => {
    await page.route(`${API}/api/auth/me`, (route) =>
      route.fulfill({ status: 401, json: { message: 'Unauthorized' } })
    );

    await page.goto('/admin');

    await expect(page.locator('input[autocomplete="username"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('shows Google SSO button', async ({ page }) => {
    await page.route(`${API}/api/auth/me`, (route) =>
      route.fulfill({ status: 401, json: { message: 'Unauthorized' } })
    );

    await page.goto('/admin');

    // Google SSO button contains the Google SVG and is a regular button (not submit)
    const googleBtn = page.locator('button[type="button"]');
    await expect(googleBtn).toBeVisible();
  });

  test('shows error message on invalid credentials (401)', async ({ page }) => {
    await page.route(`${API}/api/auth/me`, (route) =>
      route.fulfill({ status: 401, json: { message: 'Unauthorized' } })
    );
    await page.route(`${API}/api/auth/superadmin-login`, (route) =>
      route.fulfill({ status: 401, json: { message: 'Invalid credentials' } })
    );

    await page.goto('/admin');

    await page.locator('input[autocomplete="username"]').fill('wrong@example.com');
    await page.locator('input[type="password"]').fill('wrongpassword');
    await page.locator('button[type="submit"]').click();

    // Error paragraph should appear
    await expect(page.locator('p.text-red-500')).toBeVisible();
  });

  test('shows "not superadmin" error on 403 response', async ({ page }) => {
    await page.route(`${API}/api/auth/me`, (route) =>
      route.fulfill({ status: 401, json: { message: 'Unauthorized' } })
    );
    await page.route(`${API}/api/auth/superadmin-login`, (route) =>
      route.fulfill({ status: 403, json: { message: 'Forbidden' } })
    );

    await page.goto('/admin');

    await page.locator('input[autocomplete="username"]').fill('user@example.com');
    await page.locator('input[type="password"]').fill('password');
    await page.locator('button[type="submit"]').click();

    await expect(page.locator('p.text-red-500')).toBeVisible();
  });

  test('redirects to /admin/users after successful login', async ({ page }) => {
    const fakeAdmin = {
      id: '1',
      name: 'Test Admin',
      email: 'admin@test.com',
      role: 'superadmin',
      studioName: 'Test Studio',
      slug: 'test-studio',
      theme: 'soft',
      darkMode: false,
    };

    await page.route(`${API}/api/auth/me`, (route) =>
      route.fulfill({ status: 401, json: { message: 'Unauthorized' } })
    );
    await page.route(`${API}/api/auth/superadmin-login`, (route) =>
      route.fulfill({ status: 200, json: { admin: fakeAdmin } })
    );
    // Mock subsequent auth check after login
    await page.route(`${API}/api/auth/me`, (route) =>
      route.fulfill({ status: 200, json: { admin: fakeAdmin } })
    );

    await page.goto('/admin');

    await page.locator('input[autocomplete="username"]').fill('admin@test.com');
    await page.locator('input[type="password"]').fill('correctpassword');
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL('/admin/users');
  });

  test('shows SSO error when redirected back with ?sso=error', async ({ page }) => {
    await page.route(`${API}/api/auth/me`, (route) =>
      route.fulfill({ status: 401, json: { message: 'Unauthorized' } })
    );

    await page.goto('/admin?sso=error&reason=no_account');

    // The error is shown via toast and set in state — the error <p> should appear
    await expect(page.locator('p.text-red-500')).toBeVisible();
  });
});
