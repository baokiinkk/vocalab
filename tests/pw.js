/* Playwright helper for VocaLab browser tests (uses the installed Google Chrome).
   Usage in a test script:
     const { launch, open, DEVICES } = require('./pw');
     const browser = await launch();
     const page = await open(browser, 'iphone', '#/today', { seed: (VL) => { ... } });
     await page.screenshot({ path: 'out.png', fullPage: true });
   The app is served by a static server at BASE (default http://localhost:8765, started with
     cd /Users/baoho/development/english && python3 -m http.server 8765). */
const { chromium } = require('playwright-core');
const BASE = process.env.VL_BASE || 'http://localhost:8765';
const DEVICES = {
  laptop: { viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  ipad: { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
  iphone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
};
async function launch() {
  return chromium.launch({ channel: 'chrome', headless: true });
}
/** Open the app on a device. opts.seed: function(VL) run in the page after load (then the page re-renders).
    opts.clear (default true): start with empty localStorage. opts.network: allow external requests (default: blocked).
    Console errors are collected in page.errors. */
async function open(browser, device, hash, opts) {
  opts = opts || {};
  const ctx = await browser.newContext({ ...DEVICES[device], locale: 'vi-VN' });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/net::ERR_FAILED|Failed to load resource/.test(m.text())) page.errors.push(m.text()); });
  if (opts.clear !== false) await ctx.addInitScript(() => { if (!sessionStorage.getItem('__vl_init')) { localStorage.clear(); sessionStorage.setItem('__vl_init', '1'); } });
  if (!opts.network) { const origin = new URL(BASE).origin; await ctx.route((u) => u.origin !== origin && !/^(localhost|127\.0\.0\.1)$/.test(u.hostname), (r) => r.abort()); }
  await page.goto(BASE + '/index.html' + (hash || '#/today'));
  await page.waitForFunction(() => window.VL && window.VL.current && window.VL.current());
  if (opts.seed) {
    await page.evaluate(`(${opts.seed.toString()})(window.VL)`);
    await page.evaluate(() => window.VL.refresh());
  }
  return page;
}
module.exports = { launch, open, DEVICES, BASE };
