import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdvanceState } from '../src/next-production.js';
test('bottom advance waits, charges, decays and resets', () => {
  const s = createAdvanceState();
  s.boundary(true, 1000);
  assert.equal(s.input(140, 1200), 0);
  for (let i = 0; i < 5; i++) s.input(140, 1500 + i * 30);
  assert.equal(s.progress, 1);
  s.decay(2500, 0.5);
  assert.equal(s.progress, 0.55);
  s.boundary(false, 2600);
  assert.equal(s.progress, 0);
});
test('keyboard and touch inputs need deliberate bottom intent', () => {
  const s = createAdvanceState();
  assert.equal(s.input(0.34, 500, 'key'), 0);
  s.boundary(true, 600);
  s.input(0.34, 1000, 'key');
  s.input(0.34, 1050, 'key');
  assert.equal(s.progress, 0.68);
  s.input(140, 1100, 'touch');
  assert.equal(s.progress, 1);
});
