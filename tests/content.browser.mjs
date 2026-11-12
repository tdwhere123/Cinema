/** Run against dev or true static hosting using CINEMA_URL (including project base). */
import assert from 'node:assert/strict';
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || 'playwright'
);
const browser = await chromium.launch({ chromiumSandbox: true });
const base = (process.env.CINEMA_URL || 'http://localhost:4173').replace(
  /\/$/,
  '',
);
const errors = [];
async function idle(p) {
  await p.waitForFunction(
    () =>
      !document.body.classList.contains('loading') &&
      !document.body.classList.contains('route-changing'),
  );
}
try {
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const p = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      reducedMotion,
    });
    p.on('pageerror', (e) => errors.push(e.message));
    p.on('requestfailed', (r) =>
      errors.push(r.url() + ': ' + r.failure()?.errorText),
    );
    p.on('response', (r) => {
      if (r.status() >= 400 && !r.url().endsWith('/favicon.ico'))
        errors.push(`${r.status()} ${r.url()}`);
    });
    for (const [id, title] of [
      ['possible-love', '可能的爱'],
      ['poetry', '诗'],
    ]) {
      await p.goto(`${base}/production/${id}/`);
      await idle(p);
      await p.reload();
      await idle(p);
      assert.equal((await p.locator('#detail h1').textContent()).trim(), title);
      assert.equal(await p.locator('#watch-trailer').count(), 0);
      assert.equal(await p.locator('iframe').count(), 0);
      // Chapters are story, context, interview and poster; no placeholders or viewing prompts.
      assert.deepEqual(
        await p
          .locator('.chapter .chapter-name')
          .evaluateAll((n) => n.map((e) => e.textContent)),
        ['故事', '背景', '访谈', '海报'],
      );
      assert.ok((await p.locator('.chapter-interview .qa').count()) >= 4);
      assert.equal(
        await p.locator('.chapter-interview .pull-quote').count(),
        1,
      );
      assert.match(
        await p.locator('.interview-source a').getAttribute('href'),
        /^https:\/\/(thefilmstage\.com|www\.electricsheepmagazine\.co\.uk)\//,
      );
      assert.equal(await p.locator('.detail-cta').count(), 0);
      assert.equal(await p.locator('.club-reviews, .observation').count(), 0);
      assert.ok(
        (await p.locator('.chapter-rail .rail-tick').count()) >= 5,
        'chapter rail lists the page',
      );
      const poster = await p.locator('.full-poster').evaluate((img) => ({
        loaded: img.complete && img.naturalWidth > 0,
        natural: img.naturalWidth / img.naturalHeight,
        drawn: img.width / img.height,
        fit: getComputedStyle(img).objectFit,
      }));
      assert.ok(poster.loaded);
      assert.ok(Math.abs(poster.natural - poster.drawn) < 0.01);
      assert.notEqual(poster.fit, 'cover');
      assert.ok(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        'no mobile overflow',
      );
      assert.equal(
        await p.locator('.poster-section a').first().getAttribute('target'),
        '_blank',
      );
      for (const link of await p
        .locator('a[href]')
        .evaluateAll((as) => as.map((a) => a.href))) {
        if (new URL(link).origin === new URL(base).origin) {
          const response = await p.request.get(link);
          assert.equal(response.status(), 200, link);
        }
      }
    }
    await p.locator('#topic-toggle').press('ArrowDown');
    await p.locator('#films-link').click();
    await idle(p);
    assert.equal(
      await p.locator('#scene').getAttribute('data-renderer'),
      'webgl',
    );
    // 诗 (2010) was opened last; it leads the release-ordered gallery, before the blank disc.
    assert.equal(await p.locator('#counter').textContent(), '1 / 3');
    assert.equal(await p.locator('#tv-link').count(), 0);
    await p.locator('#open-current').click();
    await idle(p);
    assert.equal(await p.locator('#watch-trailer').count(), 0);
    await p.goBack();
    await idle(p);
    await p.goForward();
    await idle(p);
    assert.equal(await p.locator('.scene-carry').count(), 0);
    await p.goto(
      `${base}/${process.env.STATIC_HOST ? '404.html' : 'production/not-a-film'}`,
    );
    await idle(p);
    assert.match(await p.locator('#detail h1').textContent(), /页面未找到/);
    await p.locator('.missing-page a').click();
    await idle(p);
    assert.equal(await p.locator('#gallery').isVisible(), true);
    await p.close();
  }
  assert.deepEqual(errors, []);
  console.log(
    'PASS: both film deep links/reloads, full uncropped poster geometry, no trailer, chapter set and rail, 390px overflow, internal links, WebGL, motion/reduced, history cleanup; no network/JS errors.',
  );
} finally {
  await browser.close();
}
