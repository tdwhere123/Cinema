/** Small, renderer-independent hover physics and hand-drawn outline sampling. */
import { clamp } from './math.js';
export const EFFECTS = {
  points: 24,
  jitter: 0.028,
  padding: 0.06,
  width: 0.012,
  fps: 10,
};
export function outlinePoints(seed = 0, ring = 0) {
  const points = [];
  for (let i = 0; i <= EFFECTS.points; i++) {
    const j = i % EFFECTS.points,
      a = (j / EFFECTS.points) * Math.PI * 2;
    const noise = Math.sin(j * 127.1 + seed * 17.7 + ring * 83.3) * 43758.5453;
    const r =
      1 +
      EFFECTS.padding +
      ring * 0.045 +
      ((noise - Math.floor(noise)) * 2 - 1) * EFFECTS.jitter;
    points.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
  }
  return points;
}
export function sweepProgress(age) {
  return age < 0.06 ? 0.3 : age < 0.12 ? 0.5 : age < 0.2 ? 0.72 : 1;
}
export function makeImpulse() {
  return {
    x: 0,
    y: 0,
    z: 0,
    rx: 0,
    ry: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    vrx: 0,
    vry: 0,
    press: 0,
  };
}
export function pushImpulse(s, dx, dy) {
  if (Math.hypot(dx, dy) < 9) return;
  s.vx += clamp(dx * 0.012, -0.5, 0.5);
  s.vy -= clamp(dy * 0.012, -0.5, 0.5);
  s.vrx += clamp(dy * 0.009, -0.4, 0.4);
  s.vry += clamp(dx * 0.009, -0.4, 0.4);
}
export function clickImpulse(s, x, y) {
  s.vz -= 0.55;
  s.vry += x * 1.5;
  s.vrx -= y * 1.5;
}
export function tickImpulse(s, dt, pressed, reduced = false) {
  if (reduced) {
    for (const key of Object.keys(s)) s[key] = 0;
    return;
  }
  for (const [p, v] of [
    ['x', 'vx'],
    ['y', 'vy'],
    ['z', 'vz'],
    ['rx', 'vrx'],
    ['ry', 'vry'],
  ]) {
    s[v] = (s[v] - s[p] * 3.4 * dt) * Math.exp(-4.5 * dt);
    s[p] += s[v] * dt;
  }
  s.press += (Number(pressed) - s.press) * (1 - Math.exp(-22 * dt));
}
