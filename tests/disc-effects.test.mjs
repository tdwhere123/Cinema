import test from 'node:test';
import assert from 'node:assert/strict';
import {
  outlinePoints,
  sweepProgress,
  makeImpulse,
  pushImpulse,
  clickImpulse,
  tickImpulse,
} from '../src/disc-effects.js';
test('hand-drawn loop closes, varies each frame, and follows staged sweep', () => {
  const a = outlinePoints(0),
    b = outlinePoints(1);
  assert.deepEqual(a[0], a.at(-1));
  assert.notDeepEqual(a, b);
  for (const p of a)
    assert.ok(Math.hypot(p.x, p.y) > 1 && Math.hypot(p.x, p.y) < 1.15);
  assert.equal(sweepProgress(0), 0.3);
  assert.equal(sweepProgress(0.09), 0.5);
  assert.equal(sweepProgress(0.16), 0.72);
  assert.equal(sweepProgress(0.3), 1);
});
test('fast pointer and click impulses move then settle; reduced motion suppresses', () => {
  const s = makeImpulse();
  pushImpulse(s, 2, 1);
  assert.equal(s.vx, 0);
  pushImpulse(s, 30, 12);
  clickImpulse(s, 0.5, 0.2);
  tickImpulse(s, 1 / 60, false);
  assert.ok(s.x > 0);
  assert.ok(s.z < 0);
  for (let i = 0; i < 1800; i++) tickImpulse(s, 1 / 60, false);
  assert.ok(Math.abs(s.x) < 0.0001 && Math.abs(s.z) < 0.0001);
  pushImpulse(s, 30, 12);
  tickImpulse(s, 1 / 60, false, true);
  assert.ok(Object.values(s).every((v) => v === 0));
});
