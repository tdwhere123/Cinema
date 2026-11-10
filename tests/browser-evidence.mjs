import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
export async function installEvidence(page, { startupStall = 0 } = {}) {
  await page.addInitScript((startupStall) => {
    const evidence = (window.__cinemaEvidence = {
      startupStall,
      samples: [],
      longTasks: [],
      overlap: [],
      index: [],
      errors: [],
    });
    addEventListener('error', (e) => evidence.errors.push(e.message));
    new PerformanceObserver((list) => {
      for (const e of list.getEntries())
        evidence.longTasks.push({ start: e.startTime, duration: e.duration });
    }).observe({ type: 'longtask', buffered: true });
    // Only the test inserts this long task; production code has no artificial delay.
    if (startupStall) {
      const raf = requestAnimationFrame;
      let blocked = false;
      window.requestAnimationFrame = (callback) =>
        raf.call(window, () => {
          if (!blocked && document.querySelector('#scene canvas')) {
            blocked = true;
            const start = performance.now();
            while (performance.now() - start < startupStall) {}
          }
          callback(performance.now());
        });
    }
    const draw = WebGL2RenderingContext.prototype.drawElements;
    WebGL2RenderingContext.prototype.drawElements = function (...args) {
      this.canvas.__draws = (this.canvas.__draws || 0) + 1;
      return draw.apply(this, args);
    };
    function sample() {
      const root = document.querySelector('#preloader'),
        counter = root?.querySelector('.load-count');
      if (counter && document.body.classList.contains('loading')) {
        const r = counter.getBoundingClientRect(),
          s = getComputedStyle(root);
        evidence.samples.push({
          t: performance.now(),
          beat: root.dataset.loadBeat,
          clock: root.dataset.loadClock,
          x: r.x + r.width / 2,
          y: r.y + r.height / 2,
          width: r.width,
          height: r.height,
          viewport: [innerWidth, innerHeight],
          anchor: {
            x: parseFloat(s.getPropertyValue('--disc-x')),
            y: parseFloat(s.getPropertyValue('--disc-y')),
            r: parseFloat(s.getPropertyValue('--disc-r')),
          },
          releasing: root.classList.contains('releasing'),
          visible: s.visibility !== 'hidden',
          opacity: [...counter.children].map((e) =>
            Number(getComputedStyle(e).opacity),
          ),
        });
      }
      const panel = document.querySelector('#index-panel');
      if (panel && !panel.hidden)
        evidence.index.push({
          t: performance.now(),
          height: panel.getBoundingClientRect().height,
          opacity: Number(getComputedStyle(panel).opacity),
          expanded: document
            .querySelector('#index-button')
            .getAttribute('aria-expanded'),
          animations: panel
            .getAnimations()
            .map((a) => ({ time: a.currentTime, state: a.playState })),
        });
      const host = document.querySelector('#scene.scene-carry'),
        canvas = host?.querySelector('canvas'),
        detail = document.querySelector('#detail');
      if (host && detail && !detail.hidden)
        evidence.overlap.push({
          t: performance.now(),
          sameCanvas: canvas === window.__galleryCanvas,
          draws: canvas?.__draws || 0,
          detailOpacity: Number(getComputedStyle(detail).opacity),
          renderer: host.dataset.renderer,
        });
      requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  }, startupStall);
}
export function assertVisibleArc(assert, evidence) {
  const samples = evidence.samples.filter(
    (s) =>
      s.visible &&
      !s.releasing &&
      s.opacity.length &&
      s.opacity.every((n) => n >= 0.9) &&
      Number.isFinite(s.anchor.y),
  );
  for (const beat of ['000', 'CD', '048', '074', '100'])
    assert.ok(
      samples.some((s) => s.beat === beat),
      `visible beat ${beat} is painted`,
    );
  assert.ok(
    samples.some((s) => s.beat === '000' && s.y > s.anchor.y),
    'counter begins below the projected lead disc',
  );
  assert.ok(
    samples.some((s) => s.beat === '048' && s.x < s.anchor.x - s.anchor.r),
    'counter passes left of projected disc',
  );
  const above = samples.filter(
    (s) =>
      s.beat === '100' &&
      s.y + s.height / 2 < s.anchor.y - s.anchor.r &&
      Math.abs(s.x - s.anchor.x) < s.width * 0.05,
  );
  assert.ok(
    above.length >= 2 && above.at(-1).t - above[0].t >= 100,
    'opaque final counter dwells above the disc before release',
  );
  for (const s of above)
    assert.ok(
      s.y - s.height / 2 >= 0 && s.x - s.width / 2 >= 0,
      'final counter remains within viewport',
    );
}
export async function saveBrowserEvidence(
  browser,
  { error = null, label = 'fidelity', checkpoints = [] } = {},
) {
  const pages = [];
  for (const context of browser.contexts())
    for (const page of context.pages()) {
      try {
        pages.push({
          url: page.url(),
          evidence: await page.evaluate(() => window.__cinemaEvidence || null),
          body: await page.locator('body').getAttribute('class'),
        });
      } catch (e) {
        pages.push({ url: page.url(), error: String(e) });
      }
    }
  const directory =
    process.env.CINEMA_ARTIFACT_DIR || '.do-it/docs/browser-verification';
  await mkdir(directory, { recursive: true });
  const filename = path.join(
    directory,
    `${label}-${error ? 'failure' : 'pass'}-${Date.now()}.json`,
  );
  await writeFile(
    filename,
    JSON.stringify(
      { error: error?.stack || null, checkpoints, pages },
      null,
      2,
    ),
  );
  console.log(`Browser evidence: ${filename}`);
  return filename;
}
