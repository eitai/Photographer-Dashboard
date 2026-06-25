// Marketing analytics — GA4 + Meta Pixel.
//
// PLACEHOLDERS: replace [GA4_ID] / [PIXEL_ID] with real IDs to activate.
// While the placeholders remain, nothing is injected and no network calls
// are made. After filling in real IDs you must also extend the CSP in
// index.html (see the comment above the CSP meta tag there).

const GA4_ID = '[GA4_ID]';
const PIXEL_ID = '[PIXEL_ID]';

function isPlaceholder(id: string): boolean {
  return !id || id.startsWith('[');
}

let initialized = false;

export function initAnalytics(): void {
  if (initialized) return;
  initialized = true;

  if (!isPlaceholder(GA4_ID)) {
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
    document.head.appendChild(s);
    const w = window as unknown as { dataLayer: unknown[]; gtag: (...args: unknown[]) => void };
    w.dataLayer = w.dataLayer || [];
    w.gtag = function gtag(...args: unknown[]) { w.dataLayer.push(args); };
    w.gtag('js', new Date());
    w.gtag('config', GA4_ID);
  }

  if (!isPlaceholder(PIXEL_ID)) {
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(s);
    const w = window as unknown as { fbq?: { (...args: unknown[]): void; queue?: unknown[]; loaded?: boolean; version?: string } };
    if (!w.fbq) {
      const fbq = ((...args: unknown[]) => { (fbq.queue as unknown[]).push(args); }) as NonNullable<typeof w.fbq>;
      fbq.queue = [];
      fbq.loaded = true;
      fbq.version = '2.0';
      w.fbq = fbq;
    }
    w.fbq('init', PIXEL_ID);
    w.fbq('track', 'PageView');
  }
}
