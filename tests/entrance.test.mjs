import test from 'node:test';
import assert from 'node:assert/strict';
import { flightPose, mountEntrance } from '../src/entrance.js';
test('gallery flight compresses/rebounds, then shrinks and turns to edge', () => {
  assert.equal(flightPose(0, 0, { exit: true }).scale, 1);
  assert.equal(flightPose(120, 0, { exit: true }).scale, 0.94);
  assert.ok(flightPose(280, 0, { exit: true }).scale > 1);
  assert.equal(flightPose(830, 0, { exit: true }).scale, 0);
  assert.equal(flightPose(830, 0, { exit: true }).turn, Math.PI / 2);
  assert.ok(flightPose(450, 2, { exit: true }).depth < 0);
  assert.ok(flightPose(400, 0).scale > flightPose(400, 2).scale);
  assert.equal(flightPose(1000, 0).scale, 1);
  assert.equal(flightPose(0, 0, { reduced: true }).scale, 1);
});
function harness(options = {}) {
  let tick,
    released = 0;
  const classes = new Set(),
    gallery = { inert: false };
  const element = () => ({
    dataset: {},
    style: { setProperty() {} },
    classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c) },
    append() {},
    replaceChildren() {},
  });
  const root = element();
  root.querySelector = () => element();
  globalThis.document = {
    hidden: false,
    body: element(),
    querySelector: () => gallery,
    createElement: element,
  };
  globalThis.requestAnimationFrame = (fn) => ((tick = fn), 1);
  globalThis.cancelAnimationFrame = () => {};
  const start = performance.now();
  const controller = mountEntrance(root, {
    ...options,
    onRelease: () => released++,
  });
  let elapsed = 0;
  const advance = (ms) => {
    elapsed = ms;
    tick(start + ms + 1);
  };
  return {
    root,
    controller,
    classes,
    gallery,
    advance,
    run: (ms) => {
      const end = elapsed + ms;
      while (elapsed < end) advance(elapsed + 50);
    },
    released: () => released,
  };
}
test('loader waits for readiness and minimum beat duration, then releases once', () => {
  const h = harness();
  h.controller.progress(1, 1);
  h.controller.ready();
  h.advance(1000);
  assert.equal(h.released(), 0);
  assert.equal(h.gallery.inert, true);
  h.run(4500);
  assert.equal(h.released(), 1);
  assert.equal(h.gallery.inert, false);
  h.controller.cancel();
  assert.equal(h.released(), 1);
});
test('loader times out stalled assets and cancellation clears interaction lock', () => {
  const h = harness();
  h.advance(9100);
  h.run(4500);
  assert.equal(h.released(), 1);
  assert.equal(h.gallery.inert, false);
  const next = harness();
  next.controller.cancel();
  assert.equal(next.gallery.inert, false);
  assert.equal(next.released(), 1);
});
test('reduced motion and direct detail entry bypass loader', () => {
  for (const options of [{ reduced: true }, { enabled: false }]) {
    const h = harness(options);
    assert.equal(h.released(), 1);
    assert.equal(h.gallery.inert, false);
  }
});

test('counter is constrained around the projected disc and clears bottom navigation', async () => {
  const { counterPosition } = await import('../src/entrance.js');
  const anchor = { x: 195, y: 417, r: 104 };
  const nav = { top: 785, bottom: 831, height: 46 };
  const lower = counterPosition(anchor, 0, 90, 47, 390, 844, nav),
    left = counterPosition(anchor, Math.PI / 2, 90, 47, 390, 844, nav),
    upper = counterPosition(anchor, Math.PI, 90, 47, 390, 844, nav);
  assert.ok(lower.y > anchor.y && lower.y + 23.5 < nav.top);
  assert.ok(left.x < anchor.x && left.x >= 51);
  assert.ok(upper.y < anchor.y);
});

test('long main-thread gaps cannot skip visible loading beats or release the final arc early', () => {
  const h = harness();
  h.controller.ready();
  h.advance(3200);
  assert.equal(h.root.dataset.loadBeat, '000');
  h.advance(6400);
  assert.equal(h.root.dataset.loadBeat, '000');
  assert.equal(h.released(), 0);
  const seen = new Set();
  for (let i = 0; i < 90; i++) {
    h.run(50);
    seen.add(h.root.dataset.loadBeat);
  }
  assert.deepEqual([...seen], ['000', 'CD', '048', '074', '100']);
  assert.equal(h.released(), 1);
});
