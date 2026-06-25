/**
 * Photographer-side E2E flow:
 *   Login → Dashboard → Billing/Plans → Add Client via wizard
 *
 * All API calls are intercepted with page.route() so no live backend is needed.
 * The Vite dev server must be running on port 8080 (handled by playwright.config.ts webServer).
 */
import { test, expect, type Page } from '@playwright/test';

const API = 'http://localhost:5000';

// ---------------------------------------------------------------------------
// Shared mock data
// ---------------------------------------------------------------------------

const ADMIN = {
  _id: 'admin-1',
  id: 'admin-1',
  name: 'Sara Cohen',
  email: 'sara@lightstudio.co.il',
  role: 'admin' as const,
  studioName: 'Light Studio',
  slug: 'light-studio',
  theme: 'soft',
  darkMode: false,
  storageUsedBytes: 524_288_000, // 500 MB
  storageQuotaBytes: 5_368_709_120, // 5 GB
  firstLogin: false,
};

const FREE_PLAN = {
  id: 'plan-free',
  name: 'Free',
  slug: 'free',
  priceMonthlyIls: 0,
  priceAnnualIls: 0,
  storageBytes: 5_368_709_120,
  maxClients: 10,
  features: [],
  isPopular: false,
};

const PRO_PLAN = {
  id: 'plan-pro',
  name: 'Pro',
  slug: 'pro',
  priceMonthlyIls: 9900,  // ₪99 in agorot
  priceAnnualIls: 95040,
  storageBytes: 53_687_091_200, // 50 GB
  maxClients: null,
  features: ['unlimited_clients', 'custom_domain'],
  isPopular: true,
};

const MY_PLAN_RESPONSE = {
  plan: FREE_PLAN,
  subscription: null,
};

const NEW_CLIENT = {
  _id: 'client-1',
  name: 'Jane Smith',
  email: 'jane@example.com',
  phone: '0501234567',
  sessionType: 'family',
  status: 'gallery_sent',
  createdAt: new Date().toISOString(),
  notes: '',
  eventDate: '',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Set up an authenticated admin session before navigating. */
async function setupAdminAuth(page: Page) {
  await page.addInitScript((admin) => {
    localStorage.setItem('koral_admin_user', JSON.stringify(admin));
    localStorage.removeItem('koral_admin_token');
  }, ADMIN);

  await page.route(`${API}/api/auth/me`, (route) =>
    route.fulfill({ status: 200, json: { admin: ADMIN } })
  );
}

/** Mock common admin-dashboard background queries so pages don't 500. */
async function mockAdminCommon(page: Page) {
  await page.route(`${API}/api/clients`, (route) =>
    route.fulfill({ status: 200, json: [] })
  );
  await page.route(`${API}/api/galleries`, (route) =>
    route.fulfill({ status: 200, json: [] })
  );
  await page.route(`${API}/api/storage/me`, (route) =>
    route.fulfill({ status: 200, json: { usedBytes: ADMIN.storageUsedBytes, quotaBytes: ADMIN.storageQuotaBytes } })
  );
  await page.route(`${API}/api/admin-products`, (route) =>
    route.fulfill({ status: 200, json: [] })
  );
}

// ---------------------------------------------------------------------------
// 1 — Photographer Login
// ---------------------------------------------------------------------------

test.describe('Photographer login (/login)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('koral_admin_user');
      localStorage.removeItem('koral_admin_token');
    });
  });

  test('renders email/password form with Google SSO and register link', async ({ page }) => {
    await page.goto('/login');

    await expect(page.locator('input[autocomplete="username"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    // Google SSO button
    await expect(page.locator('button[type="button"]').first()).toBeVisible();
    // Register link → /get-started
    await expect(page.locator('a[href="/get-started"]')).toBeVisible();
  });

  test('shows generic error on 401 wrong credentials', async ({ page }) => {
    await page.route(`${API}/api/auth/login`, (route) =>
      route.fulfill({ status: 401, json: { message: 'Invalid credentials' } })
    );

    await page.goto('/login');
    await page.locator('input[autocomplete="username"]').fill('wrong@example.com');
    await page.locator('input[type="password"]').fill('wrongpassword');
    await page.locator('button[type="submit"]').click();

    await expect(page.locator('p.text-red-500')).toBeVisible();
  });

  test('shows "use admin portal" error on 403', async ({ page }) => {
    await page.route(`${API}/api/auth/login`, (route) =>
      route.fulfill({ status: 403, json: { message: 'Forbidden' } })
    );

    await page.goto('/login');
    await page.locator('input[autocomplete="username"]').fill('superadmin@example.com');
    await page.locator('input[type="password"]').fill('password');
    await page.locator('button[type="submit"]').click();

    await expect(page.locator('p.text-red-500')).toBeVisible();
  });

  test('shows SSO error for ?sso=error&reason=use_admin_portal', async ({ page }) => {
    await page.goto('/login?sso=error&reason=use_admin_portal');
    await expect(page.locator('p.text-red-500')).toBeVisible();
  });

  test('shows SSO error for ?sso=error&reason=no_account', async ({ page }) => {
    await page.goto('/login?sso=error&reason=no_account');
    await expect(page.locator('p.text-red-500')).toBeVisible();
  });

  test('disables submit button while login request is in flight', async ({ page }) => {
    await page.route(`${API}/api/auth/login`, async (route) => {
      await new Promise((r) => setTimeout(r, 600));
      await route.fulfill({ status: 401, json: { message: 'Invalid' } });
    });

    await page.goto('/login');
    await page.locator('input[autocomplete="username"]').fill('user@test.com');
    await page.locator('input[type="password"]').fill('pass');

    const btn = page.locator('button[type="submit"]');
    await btn.click();
    await expect(btn).toBeDisabled();
  });

  test('redirects to /admin/dashboard after successful login', async ({ page }) => {
    await page.route(`${API}/api/auth/login`, (route) =>
      route.fulfill({ status: 200, json: { admin: ADMIN } })
    );
    await page.route(`${API}/api/auth/me`, (route) =>
      route.fulfill({ status: 200, json: { admin: ADMIN } })
    );
    await mockAdminCommon(page);

    await page.goto('/login');
    await page.locator('input[autocomplete="username"]').fill('sara@lightstudio.co.il');
    await page.locator('input[type="password"]').fill('correctpassword');
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL('/admin/dashboard');
  });
});

// ---------------------------------------------------------------------------
// 2 — Dashboard smoke (post-login)
// ---------------------------------------------------------------------------

test.describe('Admin dashboard', () => {
  test('loads and renders the empty state with "New Client" button', async ({ page }) => {
    await setupAdminAuth(page);
    await mockAdminCommon(page);

    await page.goto('/admin/dashboard');

    // The page should show a button to create a new client
    await expect(page.locator('button').filter({ hasText: /client|לקוח/i }).first()).toBeVisible();
  });

  test('search input is visible', async ({ page }) => {
    await setupAdminAuth(page);
    await mockAdminCommon(page);

    await page.goto('/admin/dashboard');

    await expect(page.locator('input[type="search"], input[placeholder]').first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 3 — Billing & Plans
// ---------------------------------------------------------------------------

test.describe('Billing page (/admin/billing)', () => {
  test.beforeEach(async ({ page }) => {
    await setupAdminAuth(page);
    await mockAdminCommon(page);
    await page.route(`${API}/api/plans/me`, (route) =>
      route.fulfill({ status: 200, json: MY_PLAN_RESPONSE })
    );
    await page.route(`${API}/api/plans`, (route) =>
      route.fulfill({ status: 200, json: [FREE_PLAN, PRO_PLAN] })
    );
    await page.route(`${API}/api/plans/invoices*`, (route) =>
      route.fulfill({ status: 200, json: { invoices: [], total: 0, page: 1 } })
    );
  });

  test('renders without crashing', async ({ page }) => {
    await page.goto('/admin/billing');
    await expect(page.locator('body')).toBeVisible();
  });

  test('shows the Pro plan as an upgrade option', async ({ page }) => {
    await page.goto('/admin/billing');
    // Pro plan name should appear somewhere on the billing page
    await expect(page.locator('body')).toContainText('Pro');
  });

  test('storage usage section is present', async ({ page }) => {
    await page.goto('/admin/billing');
    // The StorageBar / HardDrive icon or GB label should render
    await expect(page.locator('body')).toContainText('GB');
  });
});

// ---------------------------------------------------------------------------
// 4 — Add Client via Wizard
// ---------------------------------------------------------------------------

test.describe('Create client wizard (/admin/clients)', () => {
  test.beforeEach(async ({ page }) => {
    await setupAdminAuth(page);
    await mockAdminCommon(page);
  });

  test('renders client list page with New Client button', async ({ page }) => {
    await page.goto('/admin/clients');

    // Search bar present
    await expect(page.locator('input[placeholder]').first()).toBeVisible();
    // New client trigger button
    await expect(page.locator('button').filter({ hasText: /new|חדש/i }).first()).toBeVisible();
  });

  test('opens wizard modal when New Client is clicked', async ({ page }) => {
    await page.goto('/admin/clients');

    await page.locator('button').filter({ hasText: /new|חדש/i }).first().click();

    // Wizard modal should open — the name field (step 1) becomes visible
    await expect(page.locator('input[name="name"]')).toBeVisible();
  });

  test('wizard step 1 → fill client details → advance to step 2', async ({ page }) => {
    await page.goto('/admin/clients');

    // Open wizard
    await page.locator('button').filter({ hasText: /new|חדש/i }).first().click();
    await expect(page.locator('input[name="name"]')).toBeVisible();

    // Fill Step 1 fields
    await page.locator('input[name="name"]').fill('Jane Smith');
    await page.locator('input[name="email"]').fill('jane@example.com');
    await page.locator('input[name="phone"]').fill('0501234567');

    // Click Next (first primary button in the modal)
    await page.locator('button').filter({ hasText: /next|הבא/i }).click();

    // Step 2 heading should appear (products / catalog)
    // The step indicator dot or heading text changes
    await expect(page.locator('input[name="name"]')).not.toBeVisible();
  });

  test('wizard step 2 → finish creates the client', async ({ page }) => {
    // Mock POST /clients to return the new client
    await page.route(`${API}/api/clients`, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 201, json: NEW_CLIENT });
      } else {
        await route.fulfill({ status: 200, json: [] });
      }
    });

    await page.goto('/admin/clients');

    // Open wizard
    await page.locator('button').filter({ hasText: /new|חדש/i }).first().click();

    // Step 1: fill name (required) and advance
    await page.locator('input[name="name"]').fill('Jane Smith');
    await page.locator('button').filter({ hasText: /next|הבא/i }).click();

    // Step 2: no catalog products → click Finish directly
    await page.locator('button').filter({ hasText: /finish|סיים/i }).click();

    // Wizard should close — name input no longer visible
    await expect(page.locator('input[name="name"]')).not.toBeVisible();
  });

  test('wizard step 1 shows validation error when name is empty', async ({ page }) => {
    await page.goto('/admin/clients');
    await page.locator('button').filter({ hasText: /new|חדש/i }).first().click();

    // Click Next without filling the name
    await page.locator('button').filter({ hasText: /next|הבא/i }).click();

    // Validation error should appear for the name field
    await expect(page.locator('p.text-rose-500, p.text-red-500')).toBeVisible();
    // Should still be on step 1 (name input still visible)
    await expect(page.locator('input[name="name"]')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 5 — Photographer registration
// ---------------------------------------------------------------------------

test.describe('Photographer registration (/get-started)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('koral_admin_user');
    });
    await page.route(`${API}/api/plans`, (route) =>
      route.fulfill({ status: 200, json: [FREE_PLAN, PRO_PLAN] })
    );
  });

  test('renders email + password form', async ({ page }) => {
    await page.goto('/get-started');

    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('shows error on duplicate email (409)', async ({ page }) => {
    await page.route(`${API}/api/auth/register`, (route) =>
      route.fulfill({ status: 409, json: { message: 'Email already in use' } })
    );

    await page.goto('/get-started');
    await page.locator('input[type="email"]').fill('existing@example.com');
    await page.locator('input[type="password"]').fill('Password123!');
    await page.locator('button[type="submit"]').click();

    await expect(page.locator('p').filter({ hasText: /taken|exist|already|קיים/i })).toBeVisible();
  });

  test('redirects to /onboarding after successful free-plan registration', async ({ page }) => {
    const newAdmin = { ...ADMIN, firstLogin: true };

    await page.route(`${API}/api/auth/register`, (route) =>
      route.fulfill({ status: 201, json: { admin: newAdmin } })
    );
    // After registration the cookie is set server-side; mock /auth/me to return the new admin
    // so ProtectedRoute on /onboarding doesn't redirect away
    await page.route(`${API}/api/auth/me`, (route) =>
      route.fulfill({ status: 200, json: { admin: newAdmin } })
    );
    await mockAdminCommon(page);

    await page.goto('/get-started');
    await page.locator('input[type="email"]').fill('newsara@studio.com');
    await page.locator('input[type="password"]').fill('StrongPass99!');
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL('/onboarding');
  });

  test('password visibility toggle works', async ({ page }) => {
    await page.goto('/get-started');

    const pwInput = page.locator('input[type="password"]');
    await pwInput.fill('secret');
    await expect(pwInput).toHaveAttribute('type', 'password');

    // Toggle button (Eye icon) sits next to the password field
    await page.locator('button[type="button"]').filter({ has: page.locator('svg') }).first().click();

    // Input type should change to "text" after toggle
    await expect(page.locator('input[type="text"]').first()).toBeVisible();
  });
});
