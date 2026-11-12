/** 页底蓄力导航。先停住，再主动继续滚动，避免惯性导致误跳。 */
import { clamp, damp, easeOut } from './math.js';
import { createNextDisc } from './next-disc.js';
export function createAdvanceState() {
  let reachedAt = null,
    lastInput = 0,
    lastMagnitude = 0,
    armed = false,
    progress = 0;
  return {
    get progress() {
      return progress;
    },
    boundary(atBottom, now) {
      if (!atBottom) {
        reachedAt = null;
        armed = false;
        progress = 0;
      } else if (reachedAt === null) reachedAt = now;
    },
    input(delta, now, kind = 'wheel') {
      const gap = now - lastInput,
        mag = Math.abs(delta),
        fresh = gap >= 140 || (mag > lastMagnitude * 1.6 && mag > 6);
      lastInput = now;
      lastMagnitude = mag;
      if (reachedAt === null || now - reachedAt < 350) return progress;
      if (!armed) {
        if (kind === 'wheel' && !fresh) return progress;
        armed = true;
      }
      progress = clamp(
        progress +
          (kind === 'key'
            ? delta
            : kind === 'touch'
              ? delta / 380
              : clamp(delta, -140, 140) / 620),
        0,
        1,
      );
      return progress;
    },
    decay(now, dt) {
      if (now - lastInput > 180) progress = Math.max(0, progress - dt * 0.9);
      return progress;
    },
  };
}
export function mountNextProduction(section, { onAdvance, reduced = false }) {
  const abort = new AbortController(),
    opts = { signal: abort.signal },
    state = createAdvanceState();
  const meter = section.querySelector('.next-progress'),
    disc = section.querySelector('.next-disc');
  const physical = disc ? createNextDisc(section, disc) : null;
  let frame,
    previous = performance.now(),
    touchY = null,
    triggered = false,
    exitAt = null,
    timer;
  let spin = 0,
    scrollSpeed = 0,
    lastScroll = scrollY,
    arrivedAt = null;
  const bottom = () =>
    window.scrollY + innerHeight >= document.documentElement.scrollHeight - 2;
  // Without onAdvance (no announced film follows) the section is a quiet ending.
  const allowed = () =>
    !!onAdvance && !document.querySelector('dialog[open]') && !triggered;
  function paint() {
    section.style.setProperty('--advance', state.progress.toFixed(4));
    meter?.setAttribute('aria-valuenow', Math.round(state.progress * 100));
  }
  function feed(delta, kind) {
    if (!allowed()) return;
    const now = performance.now();
    state.boundary(bottom(), now);
    state.input(delta, now, kind);
    paint();
    if (state.progress >= 1) {
      triggered = true;
      exitAt = now;
      section.classList.add('advancing');
      timer = setTimeout(onAdvance, reduced ? 0 : 480);
    }
  }
  addEventListener(
    'wheel',
    (e) => {
      if (!e.ctrlKey)
        feed(
          e.deltaY *
            (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1),
          'wheel',
        );
    },
    { ...opts, passive: true },
  );
  addEventListener(
    'keydown',
    (e) => {
      if (
        !allowed() ||
        !bottom() ||
        e.target.closest('button,a,input,textarea,select')
      )
        return;
      if (['ArrowDown', 'PageDown', ' '].includes(e.key)) {
        e.preventDefault();
        feed(0.34, 'key');
      }
    },
    opts,
  );
  addEventListener(
    'touchstart',
    (e) => {
      touchY = e.touches[0]?.clientY;
    },
    { ...opts, passive: true },
  );
  addEventListener(
    'touchmove',
    (e) => {
      const y = e.touches[0]?.clientY;
      if (touchY !== null && y !== undefined) feed(touchY - y, 'touch');
      touchY = y;
    },
    { ...opts, passive: true },
  );
  function tick(now) {
    const dt = Math.min((now - previous) / 1000, 0.05);
    previous = now;
    if (!triggered) {
      state.boundary(bottom(), now);
      state.decay(now, dt);
      paint();
    }
    const rect = section.getBoundingClientRect(),
      progress = clamp(
        (innerHeight - rect.top) / Math.max(1, rect.height),
        0,
        1,
      );
    if (progress >= 0.3 && arrivedAt === null) arrivedAt = now;
    const arrive = easeOut((progress - 0.3) / 0.67),
      pop = arrivedAt === null ? 0 : easeOut((now - arrivedAt) / 1050);
    const velocity = (scrollY - lastScroll) / Math.max(dt, 0.001);
    lastScroll = scrollY;
    scrollSpeed = damp(scrollSpeed, clamp(-velocity * 0.0032, -7, 7), 9, dt);
    const charge = state.progress;
    const scatter = reduced ? 1 : clamp(progress * 0.6 + charge * 0.4, 0, 1);
    section.style.setProperty('--scatter', scatter.toFixed(4));
    spin += (-0.14 + scrollSpeed - charge * 6 - (triggered ? 16 : 0)) * dt;
    if (disc) {
      const exit = exitAt === null ? 0 : clamp((now - exitAt) / 450, 0, 1);
      const scale =
        (0.35 + 0.65 * pop) * (1 + charge * 0.04) * (1 - exit * exit * 0.65);
      const rx = -52 + 22 * arrive + 14 * charge;
      const restY = innerWidth < 768 ? -14 : -30;
      const ry = 10 + (restY - 10) * arrive + (-10 - restY) * charge;
      const wobbleX = reduced ? 0 : Math.sin(now * 0.00157) * 0.022 * arrive;
      const wobbleY = reduced ? 0 : Math.cos(now * 0.0011) * 0.022 * arrive;
      const lift = (1 - arrive) * 90 - charge * 10 - exit * 35;
      physical?.paint({
        charge,
        rx: reduced ? -30 : rx,
        ry: reduced ? -14 : ry,
        wobbleX,
        wobbleY,
        rotation: reduced ? 0 : spin,
        scale: reduced ? 1 : scale,
        lift: reduced ? 0 : lift,
        visible: rect.top < innerHeight && rect.bottom > 0,
      });
      if (!reduced)
        disc.style.transform = `perspective(900px) translateY(${lift}%) rotateX(${rx + wobbleX * 57.3}deg) rotateY(${ry + wobbleY * 57.3}deg) rotateZ(${spin}rad) scale(${scale})`;
    }
    frame = requestAnimationFrame(tick);
  }
  frame = requestAnimationFrame(tick);
  return () => {
    physical?.destroy();
    abort.abort();
    cancelAnimationFrame(frame);
    clearTimeout(timer);
  };
}
