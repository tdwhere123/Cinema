import test from 'node:test';
import assert from 'node:assert/strict';
import {
  tilt,
  untilt,
  fittedGalleryScale,
  projectGalleryPoint,
} from '../src/math.js';
import { contourPath } from '../src/dissolve-contour.js';
import { dissolveField } from '../src/hero-dissolve.js';
test('gallery projection reproduces measured reference lead anchors at desktop and mobile sizes', () => {
  for (const [width, height, radius, targetY, targetRadius] of [
    [1440, 900, 0.8, 434.346, 237.667],
    [390, 844, 1.2, 417.223, 103.779],
  ]) {
    const scale = width < 768 ? fittedGalleryScale(width, height) : 1.08,
      c = projectGalleryPoint({ x: 0, y: 0.06, z: 0 }, scale, width, height),
      rim = projectGalleryPoint(
        { x: radius, y: 0.06, z: 0 },
        scale,
        width,
        height,
      );
    assert.ok(Math.abs(c.y - targetY) < 0.1);
    assert.ok(
      Math.abs(Math.hypot(rim.x - c.x, rim.y - c.y) - targetRadius) < 0.1,
    );
  }
  const point = { x: 2.2, y: -1, z: -0.5 },
    roundtrip = tilt(untilt(point));
  for (const axis of ['x', 'y', 'z'])
    assert.ok(Math.abs(roundtrip[axis] - point[axis]) < 1e-10);
});
test('contour tracing closes aperture loops and tolerates flat and saddle fields', () => {
  for (const field of [
    (x, y) => y - 70,
    () => -1,
    (x, y) => (x - 50) * (y - 50),
    (x, y) => 900 - (x - 50) ** 2 - (y - 50) ** 2,
  ]) {
    const path = contourPath(100, 100, field, 10);
    assert.ok(path.startsWith('M'));
    assert.ok(path.endsWith('Z'));
    assert.ok(!/NaN|Infinity|undefined/.test(path));
  }
  const path = contourPath(
    100,
    100,
    (x, y) => 900 - (x - 50) ** 2 - (y - 50) ** 2,
    10,
  );
  assert.equal((path.match(/M/g) || []).length, 2);
});
test('dissolve preserves upper credits, opens near the floor, and advances with scroll', () => {
  const options = { width: 1440, base: 900, time: 2 };
  assert.ok(dissolveField(720, 300, options) < 0);
  assert.ok(dissolveField(720, 1100, options) > 0);
  const rest = dissolveField(720, 800, options),
    advanced = dissolveField(720, 800, { ...options, progress: 0.6 });
  assert.ok(advanced > rest);
  assert.notEqual(rest, dissolveField(720, 800, { ...options, time: 8 }));
});

test('production titles balance two semantic groups without truncating long or one-word titles', async () => {
  const { titleLines } = await import('../src/title-lines.js');
  assert.deepEqual(titleLines('Everything Everywhere All at Once'), [
    'Everything Everywhere',
    'All at Once',
  ]);
  assert.deepEqual(titleLines('Backrooms'), ['Backrooms']);
  assert.deepEqual(titleLines('The Smashing Machine'), [
    'The Smashing',
    'Machine',
  ]);
});
