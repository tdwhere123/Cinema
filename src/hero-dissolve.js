/** Independent warped-field paper dissolve. SVG contours, not the reference runtime. */
import { clamp, damp } from './math.js';
import { contourPath } from './dissolve-contour.js';
const fract = (n) => n - Math.floor(n),
  hash = (x, y) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
const smooth = (t) => t * t * (3 - 2 * t);
export function noise2(x, y) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    fx = smooth(x - ix),
    fy = smooth(y - iy);
  const a = hash(ix, iy),
    b = hash(ix + 1, iy),
    c = hash(ix, iy + 1),
    d = hash(ix + 1, iy + 1);
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
}
export function dissolveField(
  x,
  y,
  {
    width,
    base,
    progress = 0,
    intro = 1,
    time = 0,
    velocity = 0,
    mobile = false,
  },
) {
  const center = Math.max(0, Math.cos(Math.PI * (x / width - 0.5))),
    scale = mobile ? 160 : 230;
  const nx = x / scale,
    ny = y / scale;
  const warpX = noise2(nx * 0.7 + 4, ny * 0.7 + time * 0.04),
    warpY = noise2(nx * 0.7 - 3, ny * 0.7 - time * 0.03);
  const grain = noise2(nx + warpX * 1.25, ny + warpY * 1.25);
  const detail = noise2(nx * 4.1 + warpY, ny * 4.1 + warpX);
  const live = noise2(nx + time * 0.12 + 12, ny - time * 0.08);
  const noise = Math.tanh(
    (grain * 0.68 + detail * 0.16 + live * 0.16 - 0.48) / 0.26,
  );
  const variation =
    (noise >= 0 ? noise : noise * 0.4) * base * 0.13 * (0.5 + 0.5 * center);
  const dent = base * 0.13 * center * center;
  const threshold =
    base * (1 + 0.26 * intro - 0.19 * intro - 0.21 * progress * intro) -
    velocity * base * 0.13 * 0.55;
  return y + intro * (dent + variation) - threshold;
}
export function mountHeroDissolve(hero, { reduced = false } = {}) {
  if (reduced || !CSS.supports('clip-path', 'path("M0 0H1V1Z")'))
    return () => {};
  const abort = new AbortController(),
    signal = abort.signal;
  let frame,
    last = 0,
    previousY = scrollY,
    velocity = 0,
    birth = performance.now(),
    drops = [],
    lastPointer = null;
  hero.classList.add('dissolve-active');
  addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      const now = performance.now(),
        r = hero.getBoundingClientRect();
      if (
        lastPointer &&
        Math.hypot(e.clientX - lastPointer.x, e.clientY - lastPointer.y) < 8
      )
        return;
      lastPointer = { x: e.clientX, y: e.clientY };
      // Cursor erosion is confined to the contour, away from actionable text.
      if (e.target.closest?.('a,button,[role="button"]')) return;
      drops.push({ x: e.clientX - r.left, y: e.clientY - r.top, time: now });
      if (drops.length > 28) drops.shift();
    },
    { signal, passive: true },
  );
  function tick(now) {
    frame = requestAnimationFrame(tick);
    if (document.hidden || now - last < 1000 / 30) return;
    const dt = Math.min((now - last) / 1000, 0.1) || 0.033;
    last = now;
    const rect = hero.getBoundingClientRect();
    if (rect.bottom < -30 || rect.top > innerHeight) return;
    const mobile = innerWidth < 768,
      apron = parseFloat(getComputedStyle(hero).paddingBottom) || 0,
      base = Math.max(1, rect.height - apron);
    const v = (scrollY - previousY) / dt;
    previousY = scrollY;
    velocity = damp(velocity, clamp(v / 2600, -1, 1), 8, dt);
    const intro = smooth(clamp((now - birth) / 1500, 0, 1)),
      progress = clamp(-rect.top / (base * 1.1), 0, 1);
    const options = {
      width: rect.width,
      base,
      intro,
      progress,
      time: (now - birth) / 1000,
      velocity,
      mobile,
    };
    drops = drops.filter((p) => now - p.time < 1100);
    const guards = [...hero.querySelectorAll('a,button')].map((e) => {
      const r = e.getBoundingClientRect();
      return {
        left: r.left - rect.left - 35,
        right: r.right - rect.left + 35,
        top: r.top - rect.top - 35,
        bottom: r.bottom - rect.top + 35,
      };
    });
    const path = contourPath(
      rect.width,
      rect.height,
      (x, y) => {
        let field = dissolveField(x, y, options);
        if (
          Math.abs(field) < 120 &&
          !guards.some(
            (r) => x > r.left && x < r.right && y > r.top && y < r.bottom,
          )
        ) {
          for (const p of drops) {
            const life = 1 - (now - p.time) / 1100,
              dx = (x - p.x) / 65,
              dy = (y - p.y - 25 * (1 - life)) / 45;
            field += Math.exp(-dx * dx - dy * dy) * base * 0.065 * life;
          }
        }
        return field;
      },
      mobile ? 20 : 16,
    );
    hero.style.clipPath = `path(evenodd, "${path}")`;
  }
  frame = requestAnimationFrame(tick);
  return () => {
    abort.abort();
    cancelAnimationFrame(frame);
    hero.style.clipPath = '';
    hero.style.maskImage = '';
    hero.style.webkitMaskImage = '';
    hero.classList.remove('dissolve-active');
  };
}
