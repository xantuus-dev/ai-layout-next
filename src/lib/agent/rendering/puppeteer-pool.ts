/**
 * Shared Puppeteer Instance for Document Rendering
 *
 * Chart screenshots and HTML-to-PDF rendering both need headless Chromium.
 * Launching a fresh browser per call is slow (~1-2s) and memory-heavy, so both
 * paths share one lazily-launched, process-lifetime browser instance instead.
 *
 * Launch args mirror lib/browser-control.ts's hardened set — this is a
 * private rendering surface (no user-controlled navigation), so the
 * prompt-injection/XSS scanning that file does for scraped content doesn't
 * apply, but the sandboxing flags still matter for serverless stability.
 */

import puppeteer, { Browser, Page } from 'puppeteer';

const LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--no-first-run',
  '--no-zygote',
  '--disable-extensions',
  '--disable-background-networking',
  '--disable-default-apps',
  '--disable-sync',
  '--disable-translate',
  '--hide-scrollbars',
  '--metrics-recording-only',
  '--mute-audio',
  '--no-default-browser-check',
  '--safebrowsing-disable-auto-update',
];

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: true,
      args: LAUNCH_ARGS,
      timeout: 30000,
    });

    // If launch fails, clear the cached promise so the next call retries
    // instead of permanently caching a rejection.
    browserPromise.catch(() => {
      browserPromise = null;
    });
  }
  return browserPromise;
}

/**
 * Run `fn` with a fresh Page against the shared Browser, guaranteeing the
 * page is closed afterward even on error. Callers should not close the
 * browser itself — it's reused across calls for the life of the process.
 */
export async function withRenderPage<T>(
  fn: (page: Page) => Promise<T>
): Promise<T> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    return await fn(page);
  } finally {
    await page.close().catch(() => {});
  }
}
