import assert from 'node:assert/strict';
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || 'playwright'
);
const browser = await chromium.launch({ chromiumSandbox: true });
const base = (process.env.CINEMA_URL || 'http://localhost:4173').replace(
  /\/$/,
  '',
);
const idle = (p) =>
  p.waitForFunction(
    () =>
      !document.body.classList.contains('loading') &&
      !document.body.classList.contains('route-changing'),
  );
const errors = [];
try {
  for (const mobile of [false, true]) {
    const p = await browser.newPage({
      viewport: mobile
        ? { width: 390, height: 844 }
        : { width: 1280, height: 900 },
      isMobile: mobile,
      hasTouch: mobile,
    });
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(base + '/production/poetry/');
    await idle(p);
    const toggle = p.locator('#topic-toggle');
    assert.equal(
      await p.locator('#topic-menu').isVisible(),
      false,
      'idle navigation contains CINEMA only',
    );
    assert.equal(await p.locator('#films-link').isVisible(), false);
    assert.equal(await p.locator('.film-still').count(), 2);
    // The opening still's liquid edge clears as it is read up to the top of the viewport.
    await p
      .locator('.film-still')
      .first()
      .evaluate((i) => i.scrollIntoView({ block: 'start' }));
    await p.waitForFunction(
      () => document.querySelector('.film-still').dataset.reveal === 'complete',
    );
    assert.ok(
      await p
        .locator('.film-still')
        .first()
        .evaluate((i) => i.complete && i.naturalWidth > 0),
    );
    const cdp = await p.context().newCDPSession(p);
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    const { root } = await cdp.send('DOM.getDocument');
    for (const [selector, expectedFamily] of [
      ['.title-line', 'Ma Shan Zheng'],
      ['.reading-body h2', 'Ma Shan Zheng'],
      ['.reading-body > p', 'LXGW WenKai TC'],
      ['.detail-metadata .eyebrow', 'Noto Sans SC'],
      ['.chapter-name', 'Ma Shan Zheng'],
      ['.award-event', 'Noto Sans SC'],
      ['.wordmark', 'Rock Salt'],
    ]) {
      const { nodeId } = await cdp.send('DOM.querySelector', {
        nodeId: root.nodeId,
        selector,
      });
      const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', {
        nodeId,
      });
      assert.ok(
        fonts.some(
          (f) =>
            f.isCustomFont &&
            f.familyName === expectedFamily &&
            f.glyphCount > 0,
        ),
        `${selector} renders with bundled ${expectedFamily}`,
      );
    }
    await cdp.detach();
    // Reading scrolled the page down, which tucks the wordmark; scrolling back up returns it.
    await p.evaluate(() => scrollTo(0, 0));
    await p.waitForFunction(
      () => !document.querySelector('#nav').classList.contains('nav-tucked'),
    );
    if (mobile) await toggle.tap();
    else await p.locator('#topic-toggle').hover();
    await p.waitForFunction(
      () => !document.querySelector('#topic-menu').hidden,
    );
    assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
    await p.keyboard.press('Escape');
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    await p.locator('#topic-toggle').press('ArrowDown');
    assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
    await p.locator('.topic-link').click();
    await idle(p);
    assert.equal(await p.locator('#gallery').isVisible(), true);
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    // Films run in release order: 诗 (2010) leads to 可能的爱 (2026), then the blank disc.
    await p.goto(base + '/production/poetry/');
    await idle(p);
    await p.locator('.full-poster').scrollIntoViewIfNeeded();
    // At rest the poster is a folded packet drawn by WebGL; the flat image stays hidden.
    await p.waitForFunction(
      () =>
        document.querySelector('.paper-canvas') &&
        document.querySelector('.poster-section').dataset.paper === 'folded',
    );
    assert.equal(
      await p.locator('.full-poster').evaluate((i) => i.style.visibility),
      'hidden',
      'flat poster is not shown over the folding paper',
    );
    if (mobile) await p.locator('.paper-stage').tap();
    else await p.locator('.paper-stage').hover();
    await p.waitForFunction(
      () =>
        document.querySelector('.poster-section').dataset.paper === 'complete',
    );
    assert.equal(
      await p.locator('.paper-canvas').evaluate((c) => c.style.visibility),
      'hidden',
      'open sheet hands over to the DOM poster',
    );
    assert.equal(
      await p.locator('.paper-stage .paper-finish').count(),
      1,
      'persistent crease finish layer retained',
    );
    const poster = await p.locator('.full-poster').evaluate((i) => ({
      visible: getComputedStyle(i).visibility,
      loaded: i.naturalWidth > 0,
      ratio: i.width / i.height,
      natural: i.naturalWidth / i.naturalHeight,
    }));
    assert.equal(poster.visible, 'visible');
    assert.ok(poster.loaded);
    assert.ok(Math.abs(poster.ratio - poster.natural) < 0.01);
    if (!mobile) {
      await p.mouse.move(5, 5);
      await p.waitForFunction(
        () =>
          document.querySelector('.poster-section').dataset.paper === 'folded',
      );
    }
    await p.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await p.waitForFunction(
      () =>
        document.querySelector('.next-section').dataset.nextRenderer ===
        'webgl',
    );
    assert.equal(await p.locator('.next-canvas canvas').count(), 1);
    assert.ok(
      Number(
        await p
          .locator('.next-section')
          .evaluate((e) => e.style.getPropertyValue('--scatter')),
      ) > 0.5,
      'next title scatters around the rising physical disc arc',
    );
    const before = await p.locator('.next-disc').getAttribute('style');
    await p.waitForTimeout(500);
    assert.notEqual(
      await p.locator('.next-disc').getAttribute('style'),
      before,
      'live scroll/idle pose',
    );
    await p.locator('.next-target').click({ position: { x: 50, y: 20 } });
    await idle(p);
    assert.ok(p.url().includes('/production/possible-love'));
    await p.goBack();
    await idle(p);
    assert.ok(p.url().includes('/production/poetry'));
    assert.equal(await p.locator('.scene-carry').count(), 0);
    await p.evaluate(() => {
      document.activeElement?.blur();
      scrollTo(0, document.documentElement.scrollHeight);
    });
    await p.waitForTimeout(500);
    assert.ok(
      p.url().includes('/production/poetry'),
      'arrival alone never advances',
    );
    await p.keyboard.press('ArrowDown');
    await p.keyboard.press('ArrowDown');
    await p.keyboard.press('ArrowDown');
    await p.waitForSelector('.next-section.advancing');
    await p.waitForURL('**/production/possible-love');
    await idle(p);
    // After the last announced film the blank disc is a quiet ending: nothing to advance to.
    assert.equal(await p.locator('.next-section.next-tba').count(), 1);
    assert.equal(await p.locator('.next-section a.next-target').count(), 0);
    await p.evaluate(() => {
      document.activeElement?.blur();
      scrollTo(0, document.documentElement.scrollHeight);
    });
    await p.waitForTimeout(500);
    for (let i = 0; i < 4; i++) await p.keyboard.press('ArrowDown');
    await p.waitForTimeout(700);
    assert.ok(p.url().includes('/production/possible-love'));
    assert.equal(await p.locator('.next-section.advancing').count(), 0);
    await p.goBack();
    await idle(p);
    await p.evaluate(() => {
      document.activeElement?.blur();
      scrollTo(0, document.documentElement.scrollHeight);
    });
    await p.waitForTimeout(500);
    await p.keyboard.press('ArrowDown');
    await p.keyboard.press('ArrowDown');
    await p.keyboard.press('ArrowDown');
    await p.waitForSelector('.next-section.advancing');

    await p.locator('#topic-toggle').press('ArrowDown');
    await p.keyboard.press('Enter');
    await idle(p);
    await p.waitForTimeout(700);
    assert.equal(
      await p.locator('#gallery').isVisible(),
      true,
      'interrupted bottom timer cannot navigate after departure',
    );
    assert.equal(await p.locator('.next-canvas').count(), 0);
    await p.close();
  }
  const reduced = await browser.newPage({
    reducedMotion: 'reduce',
    viewport: { width: 390, height: 844 },
  });
  await reduced.goto(base + '/production/poetry/');
  await idle(reduced);
  assert.equal(
    await reduced.locator('.poster-section').getAttribute('data-paper'),
    'complete',
  );
  assert.equal(await reduced.locator('.paper-canvas').count(), 0);
  await reduced.close();
  const failed = await browser.newPage({ reducedMotion: 'reduce' });
  await failed.route('**/possible-love/disc.webp', (r) => r.abort());
  await failed.goto(base + '/production/poetry/');
  await idle(failed);
  await failed.evaluate(() =>
    scrollTo(0, document.documentElement.scrollHeight),
  );
  await failed.waitForFunction(
    () =>
      document.querySelector('.next-section').dataset.nextAsset === 'fallback',
  );
  await failed.locator('.next-target').click({ position: { x: 50, y: 20 } });
  await idle(failed);
  assert.ok(failed.url().includes('/production/possible-love'));
  await failed.close();
  assert.deepEqual(errors, []);
  console.log(
    'PASS: topic hover/focus/touch/Escape/route cleanup; folded poster opens on hover/tap and refolds, full image, reduced motion; physical next disc, history, missing art recovery. Geometry/lifecycle checks are not aesthetic acceptance.',
  );
} finally {
  await browser.close();
}
