/** Optional real-browser regression: npm start, then PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/restoration.browser.mjs */
import assert from 'node:assert/strict';
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || 'playwright'
);
const browser = await chromium.launch({ chromiumSandbox: true });
const base = process.env.CINEMA_URL || 'http://localhost:4173';
const errors = [],
  consoleErrors = [];
async function page(options = {}) {
  const p = await browser.newPage(options);
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('Failed to load resource'))
      consoleErrors.push(m.text());
  });
  return p;
}
async function settled(p) {
  await p.waitForFunction(
    () =>
      !document.body.classList.contains('loading') &&
      !document.body.classList.contains('route-changing'),
  );
}
try {
  const p = await page({ viewport: { width: 1440, height: 900 } });
  await p.goto(base);
  await settled(p);
  assert.equal(
    await p.locator('#scene').getAttribute('data-renderer'),
    'webgl',
  );
  assert.equal(
    await p.locator('#scene canvas').evaluate((c) => {
      const gl = c.getContext('webgl2');
      return !!gl && !gl.isContextLost();
    }),
    true,
  );
  await p.locator('#scene').focus();
  await p.keyboard.press('ArrowRight');
  await p.keyboard.press('Enter');
  await settled(p);
  assert.match(new URL(p.url()).pathname, /production/);
  assert.equal(await p.locator('#detail').isVisible(), true);
  await p.goBack();
  await settled(p);
  assert.equal(
    await p.locator('#scene').getAttribute('data-active-index'),
    '1',
  );
  // Fast superseding navigation, including history, must not leave flight locks.
  await p.evaluate(() => {
    const reference = document.createElement('a');
    reference.href = document.baseURI + 'production/poetry';
    document.body.append(reference);
    reference.click();
    reference.remove();
    document.querySelector('#films-link').click();
  });
  await settled(p);
  assert.equal(await p.locator('#gallery').isVisible(), true);
  assert.equal(await p.locator('#scene canvas').count(), 1);
  await p.goto(base + '/production/poetry');
  await settled(p);
  assert.equal(await p.locator('#detail').isVisible(), true);
  await p.locator('#topic-toggle').press('ArrowDown');
  await p.locator('#films-link').click();
  await settled(p);
  // Actual context loss must switch to the compatible renderer, not hang.
  await p
    .locator('#scene canvas')
    .evaluate((c) =>
      c.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext(),
    );
  await p.waitForFunction(
    () => document.querySelector('#scene').dataset.renderer === 'css',
  );
  assert.equal(await p.locator('#scene .css-stage').count(), 1);
  await p.close();
  const reduced = await page({
    reducedMotion: 'reduce',
    viewport: { width: 390, height: 844 },
  });
  await reduced.goto(base);
  await settled(reduced);
  assert.equal(
    await reduced
      .locator('#preloader')
      .evaluate((e) => e.classList.contains('done')),
    true,
  );
  await reduced.locator('#scene').focus();
  await reduced.keyboard.press('Enter');
  await settled(reduced);
  await reduced.goBack();
  await settled(reduced);
  assert.equal(await reduced.locator('#gallery').isVisible(), true);
  await reduced.close();
  const failed = await page();
  await failed.route('**/assets/**', (r) =>
    /\.webp(?:\?|$)/.test(r.request().url()) ? r.abort() : r.continue(),
  );
  await failed.goto(base);
  await settled(failed);
  assert.equal(
    await failed.locator('#gallery').evaluate((e) => e.inert),
    false,
  );
  await failed.close();
  const stalled = await page();
  await stalled.route('**/disc.webp', () => {});
  await stalled.goto(base, { waitUntil: 'domcontentloaded' });
  await settled(stalled);
  assert.equal(
    await stalled.locator('#gallery').evaluate((e) => e.inert),
    false,
  );
  await stalled.close();
  assert.deepEqual(errors, []);
  assert.deepEqual(consoleErrors, []);
  console.log(
    'PASS: real WebGL, gallery/detail/back, rapid categories, deep link, context loss, mobile reduced motion, failed/stalled assets; no JS or non-network console errors.',
  );
} finally {
  await browser.close();
}
