/**
 * Client-side gallery E2E flow:
 *   Open gallery via token link → View photos → Select images → Submit selection
 *
 * All API calls are intercepted with page.route() so no live backend is needed.
 * Image URLs are stubbed with a 1×1 transparent PNG so thumbnails render.
 */
import { test, expect, type Page } from '@playwright/test';

const API = 'http://localhost:5000';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const GALLERY_TOKEN = 'test-gallery-token-abc123';
const GALLERY_ID = 'gallery-1';

const GALLERY = {
  _id: GALLERY_ID,
  name: 'Jane Family Session',
  token: GALLERY_TOKEN,
  status: 'gallery_sent',
  isDelivery: false,
  selectionEnabled: true,
  maxSelections: 5,
  clientName: 'Jane Smith',
  headerMessage: 'Please select your favorite photos',
  previousSelectionIds: [],
  videos: [],
};

const IMAGES = [
  { _id: 'img-1', path: '/uploads/img1.jpg', thumbnailPath: '/uploads/thumb1.jpg', filename: 'img1.jpg', originalName: 'photo1.jpg', folderIds: [] },
  { _id: 'img-2', path: '/uploads/img2.jpg', thumbnailPath: '/uploads/thumb2.jpg', filename: 'img2.jpg', originalName: 'photo2.jpg', folderIds: [] },
  { _id: 'img-3', path: '/uploads/img3.jpg', thumbnailPath: '/uploads/thumb3.jpg', filename: 'img3.jpg', originalName: 'photo3.jpg', folderIds: [] },
];

// 1×1 transparent PNG (base64) used to stub image requests
const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Set up all API mocks for a successfully-loading selection gallery. */
async function setupSelectionGallery(page: Page, overrides: Partial<typeof GALLERY> = {}) {
  const gallery = { ...GALLERY, ...overrides };

  // Stub image files so thumbnails render (avoids noisy net::ERR_CONNECTION_REFUSED)
  await page.route(`${API}/uploads/**`, (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: TRANSPARENT_PNG })
  );

  await page.route(`${API}/api/galleries/token/${GALLERY_TOKEN}`, (route) =>
    route.fulfill({ status: 200, json: gallery })
  );
  await page.route(`${API}/api/galleries/${GALLERY_ID}/images`, (route) =>
    route.fulfill({ status: 200, json: IMAGES })
  );
  await page.route(`${API}/api/galleries/${GALLERY_ID}/folders`, (route) =>
    route.fulfill({ status: 200, json: [] })
  );
  await page.route(`${API}/api/store/products/${GALLERY_TOKEN}`, (route) =>
    route.fulfill({ status: 200, json: { products: [] } })
  );
}

// ---------------------------------------------------------------------------
// 1 — Gallery loading states
// ---------------------------------------------------------------------------

test.describe('Gallery loading', () => {
  test('shows spinner while fetching gallery data', async ({ page }) => {
    // Delay the gallery response so we can observe the loading state
    await page.route(`${API}/api/galleries/token/${GALLERY_TOKEN}`, async (route) => {
      await new Promise((r) => setTimeout(r, 600));
      await route.fulfill({ status: 200, json: GALLERY });
    });
    await page.route(`${API}/api/galleries/${GALLERY_ID}/images`, (route) =>
      route.fulfill({ status: 200, json: [] })
    );
    await page.route(`${API}/api/galleries/${GALLERY_ID}/folders`, (route) =>
      route.fulfill({ status: 200, json: [] })
    );
    await page.route(`${API}/api/store/products/${GALLERY_TOKEN}`, (route) =>
      route.fulfill({ status: 200, json: { products: [] } })
    );

    await page.goto(`/gallery/${GALLERY_TOKEN}`);

    // Loading spinner: div with animate-spin class
    await expect(page.locator('.animate-spin').first()).toBeVisible();
  });

  test('shows error state for invalid / expired token (404)', async ({ page }) => {
    await page.route(`${API}/api/galleries/token/bad-token-xyz`, (route) =>
      route.fulfill({ status: 404, json: { message: 'Not found' } })
    );
    await page.route(`${API}/api/store/products/bad-token-xyz`, (route) =>
      route.fulfill({ status: 404, json: {} })
    );

    await page.goto('/gallery/bad-token-xyz');

    // The error state renders t('gallery.not_found') and t('gallery.link_expired')
    // We check for the container that holds these two paragraphs
    await expect(page.locator('.text-center.px-6')).toBeVisible();
    // At least one paragraph should be visible in the error block
    await expect(page.locator('.text-center.px-6 p').first()).toBeVisible();
  });

  test('shows error state when gallery API returns 500', async ({ page }) => {
    await page.route(`${API}/api/galleries/token/${GALLERY_TOKEN}`, (route) =>
      route.fulfill({ status: 500, json: { message: 'Server error' } })
    );
    await page.route(`${API}/api/store/products/${GALLERY_TOKEN}`, (route) =>
      route.fulfill({ status: 200, json: { products: [] } })
    );

    await page.goto(`/gallery/${GALLERY_TOKEN}`);

    await expect(page.locator('.text-center.px-6')).toBeVisible();
  });

  test('renders gallery header logo', async ({ page }) => {
    await setupSelectionGallery(page);
    await page.goto(`/gallery/${GALLERY_TOKEN}`);

    // Header with the Light Studio logo is always rendered
    await expect(page.locator('header img[alt="LIGHT STUDIO"]')).toBeVisible();
  });

  test('renders client name and header message', async ({ page }) => {
    await setupSelectionGallery(page);
    await page.goto(`/gallery/${GALLERY_TOKEN}`);

    await expect(page.locator('text=Jane Smith')).toBeVisible();
    await expect(page.locator('text=Please select your favorite photos')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 2 — Photo selection
// ---------------------------------------------------------------------------

test.describe('Photo selection', () => {
  test('renders image grid with correct number of images', async ({ page }) => {
    await setupSelectionGallery(page);
    await page.goto(`/gallery/${GALLERY_TOKEN}`);

    // Wait for images to appear (rendered as <img> tags)
    await expect(page.locator('img[src*="/uploads/"]').first()).toBeVisible();
    const allImages = page.locator('img[src*="/uploads/"]');
    await expect(allImages).toHaveCount(IMAGES.length);
  });

  test('submit button is disabled when no photos are selected', async ({ page }) => {
    await setupSelectionGallery(page);
    await page.goto(`/gallery/${GALLERY_TOKEN}`);

    await expect(page.locator('img[src*="/uploads/"]').first()).toBeVisible();

    // The send/submit button is disabled initially (no selections)
    const submitBtn = page.locator('button').filter({ has: page.locator('svg') }).filter({ hasText: /send|שלח/i });
    await expect(submitBtn).toBeDisabled();
  });

  test('selection counter starts at 0', async ({ page }) => {
    await setupSelectionGallery(page);
    await page.goto(`/gallery/${GALLERY_TOKEN}`);

    await expect(page.locator('img[src*="/uploads/"]').first()).toBeVisible();

    // Counter shows "0 / 5" (when maxSelections is 5) or just "0"
    const actionBar = page.locator('.sticky.top-14');
    await expect(actionBar).toContainText('0');
  });

  test('clicking an image selects it and increments the counter', async ({ page }) => {
    await setupSelectionGallery(page);
    await page.goto(`/gallery/${GALLERY_TOKEN}`);

    const firstImg = page.locator('img[src*="/uploads/"]').first();
    await expect(firstImg).toBeVisible();

    // Click the image card (parent div handles the toggle)
    await firstImg.click();

    // Counter should now show 1
    const actionBar = page.locator('.sticky.top-14');
    await expect(actionBar).toContainText('1');
  });

  test('clicking a selected image deselects it', async ({ page }) => {
    await setupSelectionGallery(page);
    await page.goto(`/gallery/${GALLERY_TOKEN}`);

    const firstImg = page.locator('img[src*="/uploads/"]').first();
    await expect(firstImg).toBeVisible();

    // Select
    await firstImg.click();
    await expect(page.locator('.sticky.top-14')).toContainText('1');

    // Deselect
    await firstImg.click();
    await expect(page.locator('.sticky.top-14')).toContainText('0');
  });

  test('submit button becomes enabled after selecting a photo', async ({ page }) => {
    await setupSelectionGallery(page);
    await page.goto(`/gallery/${GALLERY_TOKEN}`);

    const firstImg = page.locator('img[src*="/uploads/"]').first();
    await expect(firstImg).toBeVisible();

    // Select one image
    await firstImg.click();

    // Submit button should now be enabled
    const submitBtn = page.locator('button').filter({ has: page.locator('svg') }).filter({ hasText: /send|שלח/i });
    await expect(submitBtn).toBeEnabled();
  });

  test('cannot select more images than maxSelections limit', async ({ page }) => {
    // Gallery with maxSelections = 1
    await setupSelectionGallery(page, { maxSelections: 1 });
    await page.goto(`/gallery/${GALLERY_TOKEN}`);

    const images = page.locator('img[src*="/uploads/"]');
    await expect(images.first()).toBeVisible();

    // Select first image
    await images.nth(0).click();
    await expect(page.locator('.sticky.top-14')).toContainText('1');

    // Try to select second image — should be blocked (opacity-50 / cursor-not-allowed)
    await images.nth(1).click();

    // Counter should still be 1 (max reached)
    await expect(page.locator('.sticky.top-14')).toContainText('1');
  });
});

// ---------------------------------------------------------------------------
// 3 — Submission flow
// ---------------------------------------------------------------------------

test.describe('Selection submission', () => {
  test('submits selection and shows thank-you screen', async ({ page }) => {
    await setupSelectionGallery(page);
    await page.route(`${API}/api/galleries/${GALLERY_ID}/submit`, (route) =>
      route.fulfill({ status: 200, json: { ok: true } })
    );

    await page.goto(`/gallery/${GALLERY_TOKEN}`);
    await expect(page.locator('img[src*="/uploads/"]').first()).toBeVisible();

    // Select an image
    await page.locator('img[src*="/uploads/"]').first().click();

    // Click the send/submit button
    const submitBtn = page.locator('button').filter({ has: page.locator('svg') }).filter({ hasText: /send|שלח/i });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Thank-you screen: t('gallery.thank_you') is rendered in <p>
    await expect(page.locator('main.flex-1')).toBeVisible();
    // The submitted state shows a "close window" button
    await expect(page.locator('button').filter({ hasText: /close|סגור/i })).toBeVisible();
  });

  test('thank-you screen has a close window button', async ({ page }) => {
    await setupSelectionGallery(page);
    await page.route(`${API}/api/galleries/${GALLERY_ID}/submit`, (route) =>
      route.fulfill({ status: 200, json: { ok: true } })
    );

    await page.goto(`/gallery/${GALLERY_TOKEN}`);
    await expect(page.locator('img[src*="/uploads/"]').first()).toBeVisible();

    await page.locator('img[src*="/uploads/"]').first().click();
    const submitBtn = page.locator('button').filter({ has: page.locator('svg') }).filter({ hasText: /send|שלח/i });
    await submitBtn.click();

    // After submission, a single "close window" button is shown
    const closeBtn = page.locator('button').filter({ hasText: /close|סגור/i });
    await expect(closeBtn).toBeVisible();
    await expect(closeBtn).toBeEnabled();
  });

  test('already-submitted gallery shows thank-you state immediately', async ({ page }) => {
    // Gallery whose status is already selection_submitted
    await setupSelectionGallery(page, { status: 'selection_submitted' });
    await page.goto(`/gallery/${GALLERY_TOKEN}`);

    // SelectionGallery seeds submitted=true when status===selection_submitted
    await expect(page.locator('button').filter({ hasText: /close|סגור/i })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 4 — Store tab (conditional)
// ---------------------------------------------------------------------------

test.describe('Store tab', () => {
  test('store tab is NOT shown when products list is empty', async ({ page }) => {
    await setupSelectionGallery(page); // products: [] by default
    await page.goto(`/gallery/${GALLERY_TOKEN}`);

    await expect(page.locator('img[src*="/uploads/"]').first()).toBeVisible();

    // No tab bar should appear when hasStore is false
    await expect(page.locator('button').filter({ hasText: /store|חנות/i })).toHaveCount(0);
  });

  test('store tab IS shown when products exist', async ({ page }) => {
    // Override the store products route with actual products
    await page.route(`${API}/uploads/**`, (route) =>
      route.fulfill({ status: 200, contentType: 'image/png', body: TRANSPARENT_PNG })
    );
    await page.route(`${API}/api/galleries/token/${GALLERY_TOKEN}`, (route) =>
      route.fulfill({ status: 200, json: GALLERY })
    );
    await page.route(`${API}/api/galleries/${GALLERY_ID}/images`, (route) =>
      route.fulfill({ status: 200, json: IMAGES })
    );
    await page.route(`${API}/api/galleries/${GALLERY_ID}/folders`, (route) =>
      route.fulfill({ status: 200, json: [] })
    );
    await page.route(`${API}/api/store/products/${GALLERY_TOKEN}`, (route) =>
      route.fulfill({
        status: 200,
        json: {
          products: [
            { _id: 'prod-1', name: 'Print 10×15', type: 'print', priceIls: 3000, description: '', imageUrl: '' },
          ],
        },
      })
    );

    await page.goto(`/gallery/${GALLERY_TOKEN}`);
    await expect(page.locator('img[src*="/uploads/"]').first()).toBeVisible();

    // Tab bar appears: Gallery tab + Store tab
    await expect(page.locator('button').filter({ hasText: /store|חנות/i }).first()).toBeVisible();
  });

  test('switching to store tab hides gallery grid', async ({ page }) => {
    await page.route(`${API}/uploads/**`, (route) =>
      route.fulfill({ status: 200, contentType: 'image/png', body: TRANSPARENT_PNG })
    );
    await page.route(`${API}/api/galleries/token/${GALLERY_TOKEN}`, (route) =>
      route.fulfill({ status: 200, json: GALLERY })
    );
    await page.route(`${API}/api/galleries/${GALLERY_ID}/images`, (route) =>
      route.fulfill({ status: 200, json: IMAGES })
    );
    await page.route(`${API}/api/galleries/${GALLERY_ID}/folders`, (route) =>
      route.fulfill({ status: 200, json: [] })
    );
    await page.route(`${API}/api/store/products/${GALLERY_TOKEN}`, (route) =>
      route.fulfill({
        status: 200,
        json: { products: [{ _id: 'prod-1', name: 'Print', type: 'print', priceIls: 3000 }] },
      })
    );

    await page.goto(`/gallery/${GALLERY_TOKEN}`);
    await expect(page.locator('img[src*="/uploads/"]').first()).toBeVisible();

    // Click the Store tab
    const storeTab = page.locator('button').filter({ hasText: /store|חנות/i }).first();
    await expect(storeTab).toBeVisible();
    await storeTab.click();

    // Gallery images should no longer be the active view
    await expect(page.locator('img[src*="/uploads/"]')).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// 5 — Delivery gallery (read-only, no selection)
// ---------------------------------------------------------------------------

test.describe('Delivery gallery (isDelivery: true)', () => {
  test('renders DeliveryGallery component (no submit/selection UI)', async ({ page }) => {
    const deliveryGallery = { ...GALLERY, isDelivery: true, selectionEnabled: false };

    await page.route(`${API}/uploads/**`, (route) =>
      route.fulfill({ status: 200, contentType: 'image/png', body: TRANSPARENT_PNG })
    );
    await page.route(`${API}/api/galleries/token/${GALLERY_TOKEN}`, (route) =>
      route.fulfill({ status: 200, json: deliveryGallery })
    );
    await page.route(`${API}/api/galleries/${GALLERY_ID}/images`, (route) =>
      route.fulfill({ status: 200, json: IMAGES })
    );
    await page.route(`${API}/api/galleries/${GALLERY_ID}/folders`, (route) =>
      route.fulfill({ status: 200, json: [] })
    );
    await page.route(`${API}/api/store/products/${GALLERY_TOKEN}`, (route) =>
      route.fulfill({ status: 200, json: { products: [] } })
    );

    await page.goto(`/gallery/${GALLERY_TOKEN}`);

    // Delivery gallery has images but NO send/submit button
    await expect(page.locator('img[src*="/uploads/"]').first()).toBeVisible();
    const submitBtn = page.locator('button').filter({ hasText: /send|שלח/i });
    await expect(submitBtn).toHaveCount(0);
  });
});
