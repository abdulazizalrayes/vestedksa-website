const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const results = [];
  try {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      // Exercise analytics locally without sending synthetic conversions to GA4.
      await context.route(/google-analytics\.com\/.*collect/, route => route.fulfill({ status: 204 }));
      const page = await context.newPage();
      await page.addInitScript(() => {
        window.__csp = [];
        document.addEventListener('securitypolicyviolation', event => window.__csp.push({ directive: event.violatedDirective, blocked: event.blockedURI }));
      });
      for (const route of ['/', '/contact', '/ar', '/zh']) {
        await page.goto(`https://vestedksa.com${route}`, { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        const state = await page.evaluate(() => ({
          violations: window.__csp,
          brokenImages: [...document.images].filter(image => image.currentSrc && (!image.complete || !image.naturalWidth)).map(image => image.currentSrc),
          overflow: document.documentElement.scrollWidth > innerWidth,
          whatsapp: [...document.querySelectorAll('a[href*="wa.me"]')].map(link => link.href),
        }));
        assert.deepEqual(state.violations, [], `${route} CSP violations`);
        assert.deepEqual(state.brokenImages, [], `${route} broken images`);
        assert.equal(state.overflow, false, `${route} overflow`);
        assert.ok(state.whatsapp.every(url => new URL(url).searchParams.get('text').includes('Vested KSA')));
        await page.screenshot({ path: `/tmp/vested-csp-${width}-${route.replaceAll('/', '') || 'home'}.png`, fullPage: true });
        results.push({ route, width, ...state });
      }
      await page.goto('https://vestedksa.com/contact', { waitUntil: 'networkidle' });
      assert.equal(await page.locator('script[src*="googletagmanager.com"]').count(), 0);
      await page.getByRole('button', { name: 'Accept', exact: true }).click();
      await page.waitForTimeout(1500);
      assert.ok(await page.locator('script[src*="googletagmanager.com"]').count() > 0);
      assert.deepEqual(await page.evaluate(() => window.__csp), []);
      let posted = 0;
      await page.route('**/api/contact', async route => {
        posted++;
        await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'Synthetic delivery failure' }) });
      });
      await page.locator('#name').fill('Synthetic validation');
      await page.locator('#email').fill('test@example.com');
      await page.locator('#company').fill('Synthetic QA');
      await page.locator('#country').fill('Saudi Arabia');
      await page.locator('#service').selectOption('formation');
      await page.locator('#message').fill('Synthetic validation only');
      await page.getByRole('button', { name: 'Send message', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('#successMessage').textContent.includes('Synthetic delivery failure'));
      assert.equal(posted, 1);
      assert.equal(await page.locator('.submit-button').isEnabled(), true);
      results.push({ width, consent: 'passed', contactErrorFlow: 'passed', actualContactSubmitted: false });
      await context.close();
    }
    console.log(JSON.stringify(results, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
