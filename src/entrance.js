/** Independently implemented loading/flight choreography; no reference runtime. */
import { clamp, easeOut } from './math.js';
export function flightPose(
  age,
  distance,
  { exit = false, reduced = false, exitDuration = 550 } = {},
) {
  if (reduced) return { scale: exit ? 0 : 1, depth: 0, turn: 0 };
  const active = Math.abs(distance) < 0.5;
  if (exit) {
    const t = clamp((age - 280) / exitDuration, 0, 1);
    const scale = active
      ? age < 120
        ? 1 - 0.06 * clamp(age / 120, 0, 1)
        : age < 280
          ? 0.94 + 0.075 * easeOut((age - 120) / 160)
          : 1.015 * (1 - t * t)
      : 1 - easeOut((age - 120 - Math.min(Math.abs(distance), 4) * 35) / 550);
    return {
      scale: Math.max(0, scale),
      depth: active ? 0 : -(1 - scale),
      turn: active ? (t * t * Math.PI) / 2 : 0,
    };
  }
  const scale = easeOut(
    (age - (active ? 0 : 100 + Math.min(Math.abs(distance), 4) * 65)) / 850,
  );
  return { scale, depth: active ? 0 : -(1 - scale), turn: 0 };
}
export function mountEntrance(
  root,
  {
    reduced = false,
    enabled = true,
    onProgress = () => {},
    onRelease = () => {},
    onLogo = () => {},
    getAnchor = () => null,
    getNavBounds = () => null,
    onFloor = () => {},
  } = {},
) {
  const beats = [
    { label: '000', duration: 450, travel: 0 },
    { label: 'CD', duration: 850, travel: 650 },
    { label: '048', duration: 700, travel: 550 },
    { label: '074', duration: 700, travel: 550 },
    { label: '100', duration: 900, travel: 700 },
  ];
  let frame = 0,
    finished = false,
    ready = false,
    loaded = 0,
    start = performance.now(),
    lastFrame = null,
    clock = 0,
    beat = 0,
    beatTime = 0,
    releasing = false,
    releaseTime = 0,
    lastLabel = '',
    angle = 0,
    logoShown = false;

  const count = root.querySelector('.load-count');
  const year = root.querySelector('#load-year');
  let lastYear = '';
  function finish() {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(frame);
    root.classList.add('done');
    document.body.classList.remove('loading');
    document.querySelector('#gallery').inert = false;
    onProgress(1);
    onRelease();
  }
  if (!enabled || reduced) {
    finish();
    return { ready() {}, progress() {}, cancel: finish };
  }
  document.body.classList.add('loading');
  document.querySelector('#gallery').inert = true;
  function roll(target, value) {
    target.replaceChildren(
      ...[...value].map((char) => {
        const cell = document.createElement('span');
        cell.className = 'load-cell';
        const strip = document.createElement('span');
        strip.className = 'load-strip';
        strip.textContent =
          char === 'A'
            ? 'A'
            : Array.from({ length: 11 }, (_, i) => i % 10).join('\n');
        strip.style.setProperty('--digit', char === 'A' ? 0 : Number(char));
        cell.append(strip);
        return cell;
      }),
    );
  }
  function label(value) {
    if (lastLabel === value) return;
    lastLabel = value;
    roll(count, value);
    root.dataset.loadBeat = value;
  }
  function tick(now) {
    if (finished) return;
    // Visual time starts on the first rendered frame. A long task cannot jump beats.
    const dt =
      lastFrame === null || document.hidden
        ? 0
        : clamp(now - lastFrame, 0, 100);
    lastFrame = now;
    if (now - start >= 9000) ready = true;
    if (!document.hidden) {
      clock += dt;
      beatTime += dt;
    }
    const active = beats[beat];
    label(active.label);
    const progress = Math.min(0.96, clock / 2850, 0.18 + loaded * 0.82);
    const nextYear = String(
      Math.round(2012 + (new Date().getFullYear() - 2012) * easeOut(progress)),
    );
    if (nextYear !== lastYear) {
      lastYear = nextYear;
      if (year) roll(year, nextYear);
    }
    onProgress(progress);
    root.style.setProperty('--load-rise', String(easeOut(progress)));
    if (beat >= 1 && !logoShown) {
      logoShown = true;
      onLogo();
    }
    const travel = active.travel ? clamp(beatTime / active.travel, 0, 1) : 1;
    angle =
      beat === 0
        ? 0
        : ((beat - 1 + travel * travel * (3 - 2 * travel)) * Math.PI) / 4;
    const bounds = count.getBoundingClientRect?.(),
      nav = getNavBounds();
    if (bounds)
      onFloor(
        counterBounds(bounds.height, innerHeight, nav).bottom -
          bounds.height * 1.35,
      );
    const anchor = getAnchor();
    if (anchor && bounds) {
      const position = counterPosition(
        anchor,
        angle,
        bounds.width,
        bounds.height,
        innerWidth,
        innerHeight,
        nav,
      );
      root.style.setProperty('--counter-x', `${position.x}px`);
      root.style.setProperty('--counter-y', `${position.y}px`);
      for (const key of ['x', 'y', 'r'])
        root.style.setProperty(`--disc-${key}`, String(anchor[key]));
    }
    root.dataset.loadClock = String(Math.round(clock));
    if (releasing) {
      releaseTime += dt;
      if (releaseTime >= 500) {
        finish();
        return;
      }
    } else if (beatTime >= active.duration) {
      if (beat < beats.length - 1) {
        if (beat !== 3 || ready) {
          beat++;
          beatTime = 0;
        }
      } else {
        releasing = true;
        root.classList.add('releasing');
        onProgress(1);
      }
    }
    frame = requestAnimationFrame(tick);
  }

  frame = requestAnimationFrame(tick);
  return {
    ready() {
      ready = true;
      loaded = 1;
    },
    progress(done, total) {
      loaded = total ? done / total : 1;
    },
    cancel: finish,
  };
}

/** Keep the rolling label outside the projected lead disc and clear of navigation. */
export function counterBounds(height, viewportHeight, nav = null) {
  const margin = height / 2,
    gap = height * 0.35;
  let top = margin,
    bottom = viewportHeight - margin;
  if (nav && nav.height) {
    if (nav.top < viewportHeight / 2) top = Math.max(top, nav.bottom + gap);
    else bottom = Math.min(bottom, nav.top - gap);
  }
  return { margin, gap, top, bottom };
}
export function counterPosition(
  anchor,
  angle,
  width,
  height,
  viewportWidth,
  viewportHeight,
  nav = null,
) {
  const { margin, gap, top, bottom } = counterBounds(
    height,
    viewportHeight,
    nav,
  );
  const x = anchor.x - Math.sin(angle) * (anchor.r + width / 2 + gap);
  const y = anchor.y + Math.cos(angle) * (anchor.r + height / 2 + gap);
  return {
    x: clamp(
      x,
      margin + width / 2,
      Math.max(margin + width / 2, viewportWidth - margin - width / 2),
    ),
    y: clamp(
      y,
      top + height / 2,
      Math.max(top + height / 2, bottom - height / 2),
    ),
  };
}
