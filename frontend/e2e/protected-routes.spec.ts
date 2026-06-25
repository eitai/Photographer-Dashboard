import { test, expect } from '@playwright/test';

const API = 'http://localhost:5000';

/**
 * Mock the auth/me endpoint to return 401, simulating an unauthenticated session.
 * The ProtectedRoute component waits for this check before deciding to redirect.
 */
async function mockUnauthenticated(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.removeItem('koral_admin_user');
    localStorage.removeItem('koral_admin_token');
  });
  await page.route(`${API}/api/auth/me`, (route) =>
    route.fulfill({ status: 401, json: { message: 'Unauthorized' } })
  );
}

async function mockAuthenticated(page: import('@playwright/test').Page) {
  const fakeAdmin = {
    id: '1',
    name: 'Test Admin',
    email: 'admin@test.com',
    role: 'admin',
    studioName: 'Studio',
    slug: 'studio',
    theme: 'soft',
    darkMode: false,
  };
  await page.addInitScript((admin) => {
    localStorage.setItem('koral_admin_user', JSON.stringify(admin));
  }, fakeAdmin);
  await page.route(`${API}/api/auth/me`, (route) =>
    route.fulfill({ status: 200, json: { admin: fakeAdmin } })
  );
  return fakeAdmin;
}

test.describe('Protected admin routes (no auth)', () => {
  test('/admin/dashboard redirects unauthenticated user to /login', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL('/login');
  });

  test('/admin/clients redirects unauthenticated user to /login', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/admin/clients');
    await expect(page).toHaveURL('/login');
  });

  test('/admin/settings redirects unauthenticated user to /login', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/admin/settings');
    await expect(page).toHaveURL('/login');
  });

  test('/admin/selections redirects unauthenticated user to /login', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/admin/selections');
    await expect(page).toHaveURL('/login');
  });
});

test.describe('Superadmin-only routes (no auth)', () => {
  test('/admin/users redirects unauthenticated user to /admin', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/admin/users');
    await expect(page).toHaveURL('/admin');
  });

  test('/admin/plans redirects unauthenticated user to /admin', async ({ page }) => {
    await mockUnauthenticated(page);
    await page.goto('/admin/plans');
    await expect(page).toHaveURL('/admin');
  });
});

test.describe('Superadmin-only routes (non-superadmin role)', () => {
  test('/admin/users redirects regular admin to /admin/dashboard', async ({ page }) => {
    await mockAuthenticated(page); // role: 'admin', not 'superadmin'
    await page.goto('/admin/users');
    await expect(page).toHaveURL('/admin/dashboard');
  });
});

test.describe('Supplier protected routes', () => {
  test('/supplier/products redirects to /supplier/login when not authenticated', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('koral_supplier');
    });
    await page.route(`${API}/api/supplier/auth/me`, (route) =>
      route.fulfill({ status: 401, json: { message: 'Unauthorized' } })
    );

    await page.goto('/supplier/products');
    await expect(page).toHaveURL('/supplier/login');
  });

  test('/supplier/orders redirects to /supplier/login when not authenticated', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('koral_supplier');
    });
    await page.route(`${API}/api/supplier/auth/me`, (route) =>
      route.fulfill({ status: 401, json: { message: 'Unauthorized' } })
    );

    await page.goto('/supplier/orders');
    await expect(page).toHaveURL('/supplier/login');
  });
});
