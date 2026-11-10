/**
 * Bare-wordmark navigation whose actions are drawn out of both sides of CINEMA as liquid ink.
 * Timing follows the UI-Vault liquid "Create" study: the press sinks and the spread starts
 * while the sink is still running. As in that study, the goo threshold only ever touches an
 * opaque blob layer; the type sits above it and only receives a non-thresholding ripple.
 */
import { springEasing } from './spring.js';

const SPREAD = springEasing({ stiffness: 220, damping: 14, mass: 0.5 });
const RETRACT = springEasing({ stiffness: 420, damping: 30, mass: 0.5 });
const SINK = 120,
  HANDOFF = 60;

export function mountTopicMenu(nav, { reduced = false } = {}) {
  const trigger = nav.querySelector('#topic-toggle'),
    panel = nav.querySelector('#topic-menu'),
    blobs = panel.querySelector('.liquid-blobs'),
    ripple = nav.querySelector('#nav-ripple feDisplacementMap');
  let open = false,
    pointerFocus = false,
    closeTimer,
    revision = 0,
    running = [],
    rippleFrame = 0;

  const actions = () =>
    [...panel.querySelectorAll('.dial-action')].filter((e) => !e.hidden);

  function stop() {
    running.forEach((a) => a.cancel());
    running = [];
    cancelAnimationFrame(rippleFrame);
    ripple?.setAttribute('scale', '0');
    nav.classList.remove('liquid-moving');
    blobs.replaceChildren();
  }
  function rippleOut(duration, peak) {
    if (!ripple) return;
    const start = performance.now();
    nav.classList.add('liquid-moving');
    const step = (now) => {
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      ripple.setAttribute('scale', (peak * (1 - t) ** 2).toFixed(2));
      if (t < 1) rippleFrame = requestAnimationFrame(step);
      else {
        ripple.setAttribute('scale', '0');
        nav.classList.remove('liquid-moving');
      }
    };
    rippleFrame = requestAnimationFrame(step);
  }
  function chars(action) {
    const label = action.querySelector('.dial-label');
    if (!label.dataset.split) {
      action.setAttribute('aria-label', label.textContent);
      label.innerHTML = [...label.textContent]
        .map((c) => `<span class="liquid-char" aria-hidden="true">${c}</span>`)
        .join('');
      label.dataset.split = '1';
    }
    return [...label.querySelectorAll('.liquid-char')];
  }
  // One ink drop per glyph, measured in the panel's box from the wordmark's edge.
  function drops(action) {
    const box = panel.getBoundingClientRect(),
      mark = trigger.getBoundingClientRect(),
      left = action.dataset.side === 'left',
      edge = (left ? mark.left - 4 : mark.right + 4) - box.left,
      y = mark.top + mark.height / 2 - box.top;
    return chars(action).map((letter, i, all) => {
      const r = letter.getBoundingClientRect(),
        size = Math.max(7, r.height * 0.32),
        blob = document.createElement('span');
      blob.className = 'liquid-blob';
      blob.style.cssText = `width:${size}px;height:${size}px;left:${edge - size / 2}px;top:${y - size / 2}px`;
      blobs.append(blob);
      const order = left ? all.length - 1 - i : i;
      return {
        letter,
        blob,
        order,
        dx: r.left + r.width / 2 - box.left - edge,
      };
    });
  }
  function animateOpen() {
    stop();
    if (reduced) return;
    running.push(
      trigger.animate(
        [
          { transform: 'scale(1)' },
          { transform: 'scale(0.94, 0.9)', offset: 0.3 },
          { transform: 'scale(1)' },
        ],
        { duration: SINK + SPREAD.duration, easing: SPREAD.easing },
      ),
    );
    rippleOut(HANDOFF + SPREAD.duration + 260, 8);
    const flights = [];
    for (const action of actions()) {
      for (const { letter, blob, order, dx } of drops(action)) {
        const delay = HANDOFF + order * 34;
        const flight = blob.animate(
          [
            { transform: 'translateX(0) scale(0.2)' },
            {
              transform: `translateX(${dx * 0.12}px) scale(1.6, 0.85)`,
              offset: 0.18,
            },
            {
              transform: `translateX(${dx * 0.7}px) scale(1.25, 0.9)`,
              offset: 0.45,
            },
            { transform: `translateX(${dx}px) scale(1)`, offset: 0.75 },
            { transform: `translateX(${dx}px) scale(0)` },
          ],
          {
            duration: SPREAD.duration + 120,
            delay,
            easing: 'cubic-bezier(.3,.7,.2,1)',
            fill: 'both',
          },
        );
        flights.push(flight);
        running.push(
          flight,
          letter.animate(
            [
              { opacity: 0, transform: 'scale(0.2) translateY(0.15em)' },
              { opacity: 1, transform: 'none' },
            ],
            {
              duration: SPREAD.duration,
              delay: delay + SPREAD.duration * 0.45,
              easing: SPREAD.easing,
              fill: 'backwards',
            },
          ),
        );
      }
    }
    const token = revision;
    void Promise.all(flights.map((a) => a.finished.catch(() => {}))).then(
      () => {
        if (token === revision) blobs.replaceChildren();
      },
    );
  }
  async function animateClose(token) {
    stop();
    if (reduced) return;
    rippleOut(RETRACT.duration + 200, 7);
    const all = [];
    for (const action of actions()) {
      for (const { letter, blob, order, dx } of drops(action)) {
        const delay = (3 - Math.min(3, order)) * 18;
        all.push(
          letter.animate(
            [
              { opacity: 1, transform: 'none' },
              { opacity: 0, transform: 'scale(0.3)' },
            ],
            {
              duration: 160,
              delay,
              easing: 'cubic-bezier(.5,0,.75,0)',
              fill: 'forwards',
            },
          ),
          blob.animate(
            [
              { transform: `translateX(${dx}px) scale(0)` },
              { transform: `translateX(${dx}px) scale(1)`, offset: 0.3 },
              { transform: 'translateX(0) scale(0.2)' },
            ],
            {
              duration: RETRACT.duration + 140,
              delay,
              easing: RETRACT.easing,
              fill: 'both',
            },
          ),
        );
      }
    }
    running.push(...all);
    await Promise.all(all.map((a) => a.finished.catch(() => {})));
    if (token !== revision) return;
    stop();
  }
  function set(value, { animate = true } = {}) {
    clearTimeout(closeTimer);
    if (value === open) return;
    open = value;
    const token = ++revision;
    trigger.setAttribute('aria-expanded', String(value));
    trigger.setAttribute(
      'aria-label',
      value ? 'CINEMA · 收起导航' : 'CINEMA · 展开导航',
    );
    nav.classList.toggle('topic-open', value);
    if (value) {
      panel.hidden = false;
      if (animate) animateOpen();
    } else if (animate && !reduced) {
      void animateClose(token).then(() => {
        if (token === revision && !open) panel.hidden = true;
      });
    } else {
      stop();
      panel.hidden = true;
    }
  }
  trigger.addEventListener('pointerdown', () => {
    pointerFocus = true;
  });
  trigger.addEventListener('click', () => {
    set(!open);
    pointerFocus = false;
  });
  trigger.addEventListener('focus', () => {
    if (!pointerFocus) set(true);
  });
  nav.addEventListener('pointerenter', (e) => {
    if (
      e.pointerType === 'mouse' &&
      !['loading', 'revealing'].includes(nav.dataset.motion)
    )
      set(true);
  });
  nav.addEventListener('pointerleave', () => {
    closeTimer = setTimeout(() => {
      if (!nav.contains(document.activeElement)) set(false);
    }, 220);
  });
  nav.addEventListener('focusout', (e) => {
    if (!nav.contains(e.relatedTarget)) set(false);
  });
  nav.addEventListener('keydown', (e) => {
    const list = actions();
    if (e.key === 'Escape') {
      e.preventDefault();
      trigger.focus();
      set(false);
      return;
    }
    if (
      [
        'ArrowDown',
        'ArrowRight',
        'ArrowUp',
        'ArrowLeft',
        'Home',
        'End',
      ].includes(e.key)
    ) {
      e.preventDefault();
      set(true);
      const ordered = [
        ...list.filter((a) => a.dataset.side === 'left'),
        trigger,
        ...list.filter((a) => a.dataset.side === 'right'),
      ];
      const i = ordered.indexOf(document.activeElement);
      const next =
        e.key === 'Home'
          ? 0
          : e.key === 'End'
            ? ordered.length - 1
            : (i +
                (e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 1) +
                ordered.length) %
              ordered.length;
      ordered[next]?.focus();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) {
      trigger.focus();
      set(false);
    }
  });
  document.addEventListener('pointerdown', (e) => {
    if (!nav.contains(e.target)) set(false);
  });
  panel.addEventListener('click', (e) => {
    if (e.target.closest('a,button')) set(false, { animate: false });
  });
  new MutationObserver(() => {
    if (nav.dataset.motion !== 'idle') set(false, { animate: false });
  }).observe(nav, { attributes: true, attributeFilter: ['data-motion'] });
  let lastY = scrollY;
  addEventListener(
    'scroll',
    () => {
      const y = scrollY,
        down = y > lastY + 4,
        up = y < lastY - 4;
      if (down && y > innerHeight * 0.6 && !open)
        nav.classList.add('nav-tucked');
      else if (up || y < innerHeight * 0.6) nav.classList.remove('nav-tucked');
      if (down || up) lastY = y;
    },
    { passive: true },
  );
  addEventListener(
    'pointermove',
    (e) => {
      if (e.clientY < 96) nav.classList.remove('nav-tucked');
    },
    { passive: true },
  );
  return { close: () => set(false, { animate: false }) };
}
