import { chromium } from '@playwright/test';

const BASE = 'http://localhost:8080';
const email = `uiflow_${Date.now()}@example.com`;
const password = 'UiFlow123';
const shot = (page, name) => page.screenshot({ path: `_flow_${name}.png`, fullPage: true });
const log = (...a) => console.log('  ', ...a);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'he-IL' });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('   [PAGE ERROR]', e.message));

try {
  // 1. SIGNUP
  await page.goto(`${BASE}/get-started?plan=free`, { waitUntil: 'networkidle' });
  await shot(page, '1_signup');
  log('1. signup page loaded:', await page.title());
  await page.fill('input[type=email]', email);
  await page.fill('input[type=password]', password);
  await Promise.all([
    page.waitForURL('**/onboarding', { timeout: 15000 }).catch(() => {}),
    page.click('button[type=submit]'),
  ]);
  await page.waitForTimeout(1500);
  log('2. after signup, url =', page.url());
  await shot(page, '2_after_signup');

  // 3. Confirm session via /me
  const me1 = await page.evaluate(async () => (await fetch('/api/auth/me', { credentials: 'include' })).status).catch(() => 'n/a');
  // fallback: api is on :5000
  const me1b = await page.evaluate(async () => (await fetch('http://localhost:5000/api/auth/me', { credentials: 'include' })).status).catch(() => 'n/a');
  log('3. /me after signup status =', me1, '/', me1b);

  // 4. LOGOUT then go to login
  await page.evaluate(async () => { await fetch('http://localhost:5000/api/auth/logout', { method: 'POST', credentials: 'include' }); });
  await ctx.clearCookies();
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await shot(page, '3_login');
  log('4. login page loaded:', page.url());

  // 5. LOGIN (identifier field is type=text — email or username)
  await page.fill('input[type=text]', email);
  await page.fill('input[type=password]', password);
  await Promise.all([
    page.waitForURL('**/admin/dashboard', { timeout: 15000 }).catch(() => {}),
    page.click('button[type=submit]'),
  ]);
  await page.waitForTimeout(2000);
  log('5. after login, url =', page.url());
  await shot(page, '4_dashboard');

  const me2 = await page.evaluate(async () => (await fetch('http://localhost:5000/api/auth/me', { credentials: 'include' })).status).catch(() => 'n/a');
  log('6. /me after login status =', me2);
  log('   dashboard heading visible =', await page.locator('h1, h2').first().textContent().catch(() => '?'));
} catch (e) {
  console.error('FLOW ERROR:', e.message);
} finally {
  await browser.close();
}
