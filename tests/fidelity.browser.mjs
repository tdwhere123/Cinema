/** Slice-two integration: real browser effects, geometry and normal-motion touch.
 * npm start; PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tests/fidelity.browser.mjs
 */
import assert from 'node:assert/strict';
import {
  installEvidence,
  assertVisibleArc,
  saveBrowserEvidence,
} from './browser-evidence.mjs';
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || 'playwright'
);
const browser = await chromium.launch({ chromiumSandbox: true });
const base = process.env.CINEMA_URL || 'http://localhost:4173';
const errors = [],
  checkpoints = [];
async function make(options) {
  const p = await browser.newPage(options);
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('Failed to load resource'))
      errors.push(m.text());
  });
  return p;
}
async function idle(p) {
  await p.waitForFunction(
    () =>
      !document.body.classList.contains('loading') &&
      !document.body.classList.contains('route-changing') &&
      document.querySelector('#nav').dataset.motion !== 'loading' &&
      document.querySelector('#nav').dataset.motion !== 'revealing',
  );
}
try {
  const p = await make({ viewport: { width: 1440, height: 900 } });
  await installEvidence(p);
  await p.goto(base);
  await idle(p);
  assertVisibleArc(assert, await p.evaluate(() => window.__cinemaEvidence));
  await p.evaluate(
    () => (window.__galleryCanvas = document.querySelector('#scene canvas')),
  );
  assert.equal(
    await p.locator('#scene').getAttribute('data-renderer'),
    'webgl',
  );
  await p.evaluate(() => document.querySelector('#index-button').click());
  await p.waitForFunction(
    () => document.querySelector('#index-panel').getAnimations().length === 0,
  );
  const opened = await p
    .locator('#index-panel')
    .evaluate((e) => e.getBoundingClientRect().height);
  const indexFrames = await p.evaluate(() => window.__cinemaEvidence.index);
  assert.ok(
    indexFrames.some((s) => s.height > 0 && s.height < opened - 1),
    'index paints intermediate expanding height',
  );
  await p.keyboard.press('Escape');
  assert.equal(
    await p.locator('#index-button').getAttribute('aria-expanded'),
    'false',
  );
  await p.waitForFunction(() => document.querySelector('#index-panel').hidden);
  await p.evaluate(() => {
    const b = document.querySelector('#index-button');
    b.click();
    setTimeout(() => b.click(), 60);
    setTimeout(() => b.click(), 120);
  });
  await p.waitForTimeout(900);
  assert.equal(
    await p.locator('#index-button').getAttribute('aria-expanded'),
    'true',
  );
  await p.locator('#index-list button').first().click();
  await p.waitForTimeout(450);

  await p.locator('#scene').focus();
  await p.keyboard.press('Enter');
  await p.waitForFunction(
    () =>
      document
        .querySelector('.nav-status')
        ?.textContent.includes('Developing') &&
      !document.querySelector('.nav-status').hidden,
  );
  await idle(p);
  await p.waitForTimeout(800);
  const overlap = await p.evaluate(() => window.__cinemaEvidence.overlap);
  assert.ok(
    overlap.length >= 2 &&
      overlap.every((s) => s.sameCanvas && s.renderer === 'webgl'),
    'same live gallery canvas carried above detail',
  );
  assert.ok(
    overlap.some((s) => s.detailOpacity > 0) &&
      overlap.at(-1).draws > overlap[0].draws,
    'outgoing WebGL continues rendering while detail fades in',
  );
  assert.equal(await p.locator('.scene-carry').count(), 0);
  assert.equal(
    await p.locator('#scene').evaluate((e) => e.parentElement.id),
    'gallery',
  );
  // Club heroes no longer clip themselves: the opening still rises through them as liquid.
  assert.equal(
    await p
      .locator('.detail-info')
      .evaluate((e) => getComputedStyle(e).clipPath),
    'none',
  );
  await p.waitForSelector('.opening-image .liquid-canvas');
  assert.equal(
    await p.locator('.opening-image .film-still').getAttribute('data-reveal'),
    'dissolving',
    'opening still starts behind a liquid edge',
  );
  const live = await p
    .locator('.opening-image .liquid-canvas')
    .evaluate((c) => ({ w: c.width, h: c.height }));
  assert.ok(live.w > 0 && live.h > 0);
  await p.mouse.move(600, 830);
  await p.mouse.move(850, 850, { steps: 12 });
  await p.evaluate(() =>
    document
      .querySelector('.opening-image .film-still')
      .scrollIntoView({ block: 'start' }),
  );
  await p.waitForFunction(
    () =>
      document.querySelector('.opening-image .film-still').dataset.reveal ===
      'complete',
  );
  await p.goBack();
  await idle(p);
  assert.equal(await p.locator('.dissolve-active').count(), 0);
  assert.equal(await p.locator('#scene canvas').count(), 1);

  await p.locator('#scene').focus();
  await p.keyboard.press('Enter');
  await p.waitForSelector('#scene.scene-carry');
  await p.goBack();
  await idle(p);
  assert.equal(await p.locator('#gallery').isVisible(), true);
  assert.equal(await p.locator('.scene-carry').count(), 0);
  assert.equal(await p.locator('#scene canvas').count(), 1);
  checkpoints.push({
    label: 'cold-entry-carry-index',
    evidence: await p.evaluate(() => window.__cinemaEvidence),
  });
  await p.goto(base + '/production/possible-love');
  await idle(p);
  await p.locator('#topic-toggle').press('ArrowDown');
  await p.locator('#films-link').click();
  await idle(p);
  // New loading words replace old ones even when transitions supersede each other.
  await p.evaluate(() => {
    const reference = document.createElement('a');
    reference.href = document.baseURI + 'production/poetry';
    document.body.append(reference);
    reference.click();
    reference.remove();
    setTimeout(() => document.querySelector('#films-link').click(), 50);
  });
  await idle(p);
  assert.equal(await p.locator('.nav-status').isVisible(), false);
  checkpoints.push({
    label: 'desktop-routes',
    evidence: await p.evaluate(() => window.__cinemaEvidence),
  });
  await p.close();
  const m = await make({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await m.goto(base);
  await idle(m);
  const geometry = await m.evaluate(() => {
    const box = (s) => {
      const r = document.querySelector(s).getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    return {
      nav: box('#nav'),
      info: box('#film-info'),
      reviews: getComputedStyle(document.querySelector('#reviews')).display,
    };
  });
  assert.ok(
    geometry.nav.y >= 10 && geometry.nav.y < 60,
    'CINEMA remains the top navigation affordance',
  );
  assert.ok(
    geometry.info.y > geometry.nav.y + geometry.nav.height &&
      geometry.info.width > 340,
    'mobile metadata clears the top trigger',
  );
  assert.equal(geometry.reviews, 'none');

  await m.locator('#topic-toggle').press('ArrowDown');
  await m.locator('#index-button').click();
  await m.waitForFunction(
    () => document.querySelector('#index-panel').getAnimations().length === 0,
  );
  const dock = await m.evaluate(() => {
    const a = document.querySelector('#index-panel').getBoundingClientRect(),
      b = document.querySelector('#nav').getBoundingClientRect();
    return { gap: a.top - b.bottom, width: a.width, left: a.left };
  });
  assert.ok(
    dock.gap >= 0 && dock.gap < 24 && dock.width <= 390 && dock.left >= 0,
    'mobile index unfolds beneath the top trigger without overflow',
  );
  await m.keyboard.press('Escape');
  await m.waitForFunction(() => document.querySelector('#index-panel').hidden);
  const c = await m.context().newCDPSession(m);
  await c.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: 300, y: 430 }],
  });
  for (const x of [260, 220, 180, 140, 100]) {
    await m.waitForTimeout(50);
    await c.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: 430 }],
    });
  }
  await c.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await m.waitForTimeout(1200);
  assert.equal(
    await m.locator('#scene').getAttribute('data-active-index'),
    '1',
    'same one-disc flick as observed reference',
  );
  await m.touchscreen.tap(195, 417);
  await idle(m);
  assert.ok(m.url().endsWith('/production/poetry'));
  assert.ok(
    (await m.locator('.detail-info').evaluate((e) => e.offsetHeight)) < 800,
    'mobile hero stays shorter than the viewport plus apron',
  );
  assert.equal(await m.locator('.description-section .detail-cta').count(), 1);
  await m.setViewportSize({ width: 1000, height: 800 });
  await m.waitForTimeout(200);
  assert.equal(await m.locator('.detail-info .detail-cta').count(), 1);
  await m.goBack();
  await idle(m);
  assert.equal(
    await m.locator('#scene').getAttribute('data-active-index'),
    '1',
  );
  await m.close();
  const slow = await make({ viewport: { width: 1440, height: 900 } });
  await installEvidence(slow, { startupStall: 3200 });
  await slow.goto(base);
  await idle(slow);
  assertVisibleArc(assert, await slow.evaluate(() => window.__cinemaEvidence));
  assert.deepEqual(errors, []);
  await saveBrowserEvidence(browser, { checkpoints });
  console.log(
    'PASS: visible counter beats/arc under cold startup and 3.2s stall; live canvas/detail overlap and interrupted back; index height/reversal/dock; dissolve, normal touch and responsive actions; no JS/shader errors.',
  );
} catch (error) {
  await saveBrowserEvidence(browser, { error, checkpoints });
  throw error;
} finally {
  await browser.close();
}
