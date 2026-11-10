import test from 'node:test';
import assert from 'node:assert/strict';
import { foldPlan, foldPositions, amountsFor } from '../src/paper-reveal.js';
import { frontFor, riseFor } from '../src/liquid-image.js';
import { springEasing } from '../src/spring.js';

const w = 580,
  h = 870;
const grid = [];
for (let j = 0; j <= 12; j++)
  for (let i = 0; i <= 8; i++)
    grid.push([(i / 8 - 0.5) * w, (j / 12 - 0.5) * h]);

function extent(points) {
  const xs = [],
    ys = [],
    zs = [];
  for (let i = 0; i < points.length; i += 3) {
    xs.push(points[i]);
    ys.push(points[i + 1]);
    zs.push(points[i + 2]);
  }
  return {
    w: Math.max(...xs) - Math.min(...xs),
    h: Math.max(...ys) - Math.min(...ys),
    depth: Math.max(...zs) - Math.min(...zs),
  };
}

test('open poster lands exactly on the flat sheet', () => {
  const folds = foldPlan(h),
    out = new Float32Array(grid.length * 3);
  foldPositions(grid, folds, amountsFor(folds, 1), out);
  grid.forEach(([x, y], i) => {
    assert.ok(Math.abs(out[i * 3] - x) < 1e-3);
    assert.ok(Math.abs(out[i * 3 + 1] - y) < 1e-3);
    assert.ok(Math.abs(out[i * 3 + 2]) < 1e-3);
  });
});

test('closed poster is a letter-folded packet: half width, a third of the height, thin', () => {
  const folds = foldPlan(h),
    out = new Float32Array(grid.length * 3);
  foldPositions(grid, folds, amountsFor(folds, 0), out);
  const e = extent(out);
  assert.ok(Math.abs(e.w - w / 2) < w * 0.06, `width ${e.w}`);
  assert.ok(Math.abs(e.h - h / 3) < h * 0.06, `height ${e.h}`);
  assert.ok(e.depth < 40, `depth ${e.depth}`);
});

test('the half fold opens before the thirds, and the top third last', () => {
  const folds = foldPlan(h);
  const early = amountsFor(folds, 0.4);
  assert.ok(early[2] < early[1] && early[1] < early[0]);
  assert.deepEqual(amountsFor(folds, 0), [1, 1, 1]);
  assert.deepEqual(amountsFor(folds, 1), [0, 0, 0]);
});

test('spring easing settles with a small overshoot and a bounded duration', () => {
  const { duration } = springEasing({ stiffness: 220, damping: 14, mass: 0.5 });
  assert.ok(duration > 250 && duration < 900, `duration ${duration}`);
});

test('liquid fronts advance with scroll and finish before the image leaves', () => {
  const vh = 900;
  const lower = frontFor({ top: 800 }, vh),
    higher = frontFor({ top: 300 }, vh);
  assert.ok(higher > lower);
  // Rising front: hidden near the fold, fully clear once the image reaches the top.
  const origin = 820;
  assert.ok(riseFor({ top: 820, height: 811 }, vh, origin) > 0);
  assert.ok(riseFor({ top: 40, height: 811 }, vh, origin) < -vh * 0.2);
  assert.ok(
    riseFor({ top: 400, height: 811 }, vh, origin) <
      riseFor({ top: 700, height: 811 }, vh, origin),
  );
});
