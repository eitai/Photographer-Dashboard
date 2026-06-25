import { test, expect } from '@playwright/test';

const API = 'http://localhost:5000';

test.describe('Public pages smoke tests', () => {
  test('landing page (/) loads without error', async ({ page }) => {
    // Mock any API calls the landing page may make
    await page.route(`${API}/api/**`, (route) => route.fulfill({ status: 200, json: {} }));

    await page.goto('/');

    // The page should not show a blank screen or uncaught error
    await expect(page.locator('body')).toBeVisible();
    await expect(page).not.toHaveTitle('');
  });

  test('404 page renders for unknown route', async ({ page }) => {
    await page.goto('/this-route-absolutely-does-not-exist-xyz-987');

    // The NotFound component is rendered for unmatched routes
    await expect(page.locator('body')).toBeVisible();
    // Verify we did NOT get a server 404 — React Router handles it client-side
    expect(page.url()).toContain('this-route-absolutely-does-not-exist');
  });

  test('/404 route renders the not-found page', async ({ page }) => {
    await page.goto('/404');

    await expect(page.locator('body')).toBeVisible();
  });

  test('pricing page (/) loads without error', async ({ page }) => {
    await page.route(`${API}/api/**`, (route) => route.fulfill({ status: 200, json: {} }));

    await page.goto('/pricing');

    await expect(page.locator('body')).toBeVisible();
  });

  test('photographer login page (/login) renders a form', async ({ page }) => {
    await page.goto('/login');

    // PhotographerLogin also has an email+password form
    await expect(page.locator('input[type="email"], input[autocomplete="email"], input[autocomplete="username"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('supplier login page (/supplier/login) renders without redirecting', async ({ page }) => {
    await page.goto('/supplier/login');

    // This is a public route — should stay on /supplier/login
    await expect(page).toHaveURL('/supplier/login');
    await expect(page.locator('#supplier-email')).toBeVisible();
  });

  test('admin login page (/admin) renders without redirecting', async ({ page }) => {
    // Mock auth/me so ProtectedRoute (if any wraps this) gets a clean 401
    await page.route(`${API}/api/auth/me`, (route) =>
      route.fulfill({ status: 401, json: { message: 'Unauthorized' } })
    );

    await page.goto('/admin');

    await expect(page).toHaveURL('/admin');
    await expect(page.locator('input[autocomplete="username"]')).toBeVisible();
  });
});

test.describe('Responsive behaviour', () => {
  test('supplier login shows desktop split layout on wide viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/supplier/login');

    // Left panel is visible on md+ breakpoints (w-1/2 bg-zinc-900)
    const leftPanel = page.locator('.bg-zinc-900').first();
    await expect(leftPanel).toBeVisible();
  });

  test('supplier login hides left panel on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/supplier/login');

    // The hidden md:flex left panel should not be visible at mobile width
    const leftPanel = page.locator('.hidden.md\\:flex');
    await expect(leftPanel).toBeHidden();
  });
});
