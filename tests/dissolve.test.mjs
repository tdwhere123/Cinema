import test from 'node:test';
import assert from 'node:assert/strict';
import { noise2 } from '../src/hero-dissolve.js';
test('continuous mask noise is bounded, deterministic and smooth at cell boundaries', () => {
  for (let x = 0; x < 8; x += 0.13)
    for (let y = 0; y < 8; y += 0.19) {
      const n = noise2(x, y);
      assert.ok(n >= 0 && n <= 1);
      assert.equal(n, noise2(x, y));
    }
  assert.ok(Math.abs(noise2(2 - 1e-6, 3.4) - noise2(2 + 1e-6, 3.4)) < 1e-5);
});
