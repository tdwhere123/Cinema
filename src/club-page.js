/**
 * Film-club detail chapters and their reading aids:
 * - a right-hand chapter rail (after Kokonut UI's Scroll Index, MIT: ticks sit at their
 *   section's scroll position, the current one is set apart, the name flashes on entry);
 * - hand-drawn marker strokes (after Kokonut UI's Marker Text, MIT: variable-width ink
 *   uncovered along the pen's path);
 * - a scroll-led character reveal for the synopsis (after Magic UI's Text Reveal, MIT).
 * All three are independent vanilla implementations; see NOTICE.md.
 */
import { clamp } from './math.js';

export function clubChapters(f, esc) {
  const source = `<a href="${esc(f.source)}" target="_blank" rel="noopener">资料来源 ↗</a>`;
  const still = (src, index, caption, extra = '') =>
    `<figure class="film-image ${index === 1 ? 'opening-image' : 'interlude-image'}" ${index === 2 ? 'data-chapter="剧照"' : ''}><div class="still-frame"><img class="film-still" ${extra} src="${src}" alt="《${esc(f.title)}》官方影片剧照${index === 2 ? '（二）' : ''}"${index === 2 ? ' loading="lazy"' : ''}></div><figcaption><span class="caption-index">Still 0${index}</span><span class="caption-title">${esc(caption || '')}</span><span class="caption-meta">${esc(f.stillCredit)}</span></figcaption></figure>`;
  return `${still(f.still, 1, f.stillCaption1, 'data-liquid="rise"')}
<section class="chapter chapter-story description-section" data-chapter="故事"><header class="chapter-head"><span class="chapter-num">01</span><span class="chapter-name">故事</span></header><div class="chapter-body"><p class="story-copy description-copy" data-reveal-text>${esc(f.summary)}</p><p class="fine-print synopsis-credit">独立撰写的影片简介 · ${source}</p></div><aside class="chapter-aside honors awards"><h3 class="aside-title">荣誉</h3><ol>${f.awards.map((a) => `<li class="award-item"><span class="award-label" data-mark="underline">${esc(a.award)}</span><span class="award-event">${esc(a.event)}</span></li>`).join('')}</ol></aside></section>
<section class="chapter chapter-context reading-section" data-chapter="背景"><header class="chapter-head"><span class="chapter-num">02</span><span class="chapter-name">背景</span></header><div class="chapter-body reading-body"><h2><span data-mark="highlight">${esc(f.contextTitle)}</span></h2><p>${esc(f.context)}</p><p class="fine-print reading-source">事实资料 · ${f.id === 'poetry' ? 'Festival de Cannes' : 'Netflix Tudum'} · ${source}</p></div></section>
${still(f.secondStill, 2, f.stillCaption2)}
<section class="chapter poster-section" data-chapter="海报" aria-label="完整海报"><header class="chapter-head"><span class="chapter-num">03</span><span class="chapter-name">海报</span></header><div class="chapter-body"><p class="poster-note">一张折起来的纸。把指针放上去，它会自己打开。</p><a href="${f.poster}" target="_blank" rel="noopener"><img class="full-poster" src="${f.poster}" alt="《${esc(f.title)}》自制海报（完整画幅）"></a><p class="fine-print poster-caption">自制海报 · <a href="${f.poster}" target="_blank" rel="noopener">查看原图 ↗</a></p></div></section>`;
}

const hashOf = (text) =>
  [...text].reduce((h, c) => (h * 31 + c.codePointAt(0)) % 1000003, 7);
function random(seed) {
  let n = seed;
  return () => {
    n += 1;
    const x = Math.sin(n * 12.9898 + seed * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
}

/** A pen line drawn as a filled outline whose width swells and thins like ink. */
function inkPath(points, widths) {
  const left = [],
    right = [];
  points.forEach((p, i) => {
    const a = points[Math.max(0, i - 1)],
      b = points[Math.min(points.length - 1, i + 1)],
      dx = b[0] - a[0],
      dy = b[1] - a[1],
      len = Math.hypot(dx, dy) || 1,
      h = widths[i] / 2;
    left.push([p[0] - (dy / len) * h, p[1] + (dx / len) * h]);
    right.push([p[0] + (dy / len) * h, p[1] - (dx / len) * h]);
  });
  const f = (n) => n.toFixed(1);
  return `M${left.map((p) => `${f(p[0])} ${f(p[1])}`).join('L')}L${right
    .reverse()
    .map((p) => `${f(p[0])} ${f(p[1])}`)
    .join('L')}Z`;
}

function markShape(type, w, h, seed) {
  const rand = random(seed),
    steps = Math.max(8, Math.round(w / 14)),
    points = [],
    widths = [];
  const highlight = type === 'highlight';
  const y = highlight ? h * 0.62 : h + 3,
    tilt = (rand() - 0.5) * (highlight ? 4 : 3);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    points.push([
      -4 + t * (w + 8),
      y +
        tilt * (t - 0.5) +
        Math.sin(t * Math.PI * (1.5 + rand())) * (highlight ? 1.6 : 1.1),
    ]);
    const taper = Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.04));
    widths.push(
      (highlight ? h * 0.46 : 2.4) *
        (0.55 + 0.45 * taper) *
        (0.9 + rand() * 0.2),
    );
  }
  return {
    ink: inkPath(points, widths),
    pen: `M${points.map((p) => p.map((n) => n.toFixed(1)).join(' ')).join('L')}`,
    width: Math.max(...widths) + 2,
  };
}

export function mountMarkers(root, { reduced = false } = {}) {
  const marks = [...root.querySelectorAll('[data-mark]')];
  const draw = () => {
    for (const el of marks) {
      el.querySelector(':scope > .ink-mark')?.remove();
      const w = el.offsetWidth,
        h = el.offsetHeight;
      if (!w || !h) continue;
      const type = el.dataset.mark,
        shape = markShape(type, w, h, hashOf(el.textContent));
      const id = `mark-${hashOf(el.textContent + type)}`;
      el.insertAdjacentHTML(
        'beforeend',
        `<svg class="ink-mark" data-type="${type}" aria-hidden="true" width="${w}" height="${h + 8}" viewBox="0 0 ${w} ${h + 8}"><mask id="${id}" maskUnits="userSpaceOnUse" x="-20" y="-20" width="${w + 40}" height="${h + 48}"><path d="${shape.pen}" fill="none" stroke="#fff" stroke-width="${shape.width}" stroke-linecap="round" pathLength="1"/></mask><path d="${shape.ink}" mask="url(#${id})"/></svg>`,
      );
      if (el.classList.contains('marked') || reduced)
        el.querySelector('mask path').style.strokeDashoffset = '0';
    }
  };
  draw();
  const seen = new IntersectionObserver(
    (entries) =>
      entries.forEach((e, i) => {
        if (!e.isIntersecting) return;
        e.target.style.setProperty('--mark-delay', `${i * 140}ms`);
        e.target.classList.add('marked');
        seen.unobserve(e.target);
      }),
    { threshold: 0.9 },
  );
  marks.forEach((m) => seen.observe(m));
  let resizeTimer;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(draw, 150);
  };
  addEventListener('resize', onResize);
  document.fonts?.ready.then(() => !reduced && draw());
  return () => {
    seen.disconnect();
    removeEventListener('resize', onResize);
    clearTimeout(resizeTimer);
  };
}

export function mountTextReveal(root, { reduced = false } = {}) {
  const blocks = [...root.querySelectorAll('[data-reveal-text]')];
  if (reduced) return () => {};
  const chars = blocks.map((block) => {
    const text = block.textContent;
    block.setAttribute('aria-label', text);
    block.innerHTML = [...text]
      .map((c) => `<span class="reveal-char" aria-hidden="true">${c}</span>`)
      .join('');
    return [...block.querySelectorAll('.reveal-char')];
  });
  let frame = 0;
  const paint = () => {
    frame = 0;
    blocks.forEach((block, b) => {
      const r = block.getBoundingClientRect(),
        vh = innerHeight;
      // Fully inked once the paragraph's last line passes 55% of the viewport.
      const p = clamp(
        (vh * 0.88 - r.top) / Math.max(1, r.height + vh * 0.33),
        0,
        1,
      );
      const list = chars[b],
        lit = p * (list.length + 12);
      list.forEach((c, i) => {
        const o = clamp((lit - i) / 12, 0, 1);
        c.style.opacity = (0.16 + 0.84 * o).toFixed(3);
      });
    });
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(paint);
  };
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  schedule();
  return () => {
    cancelAnimationFrame(frame);
    removeEventListener('scroll', schedule);
    removeEventListener('resize', schedule);
  };
}

const RAIL = 300;
export function mountChapterRail(root, { reduced = false } = {}) {
  const chapters = [...root.querySelectorAll('[data-chapter]')];
  if (chapters.length < 2) return () => {};
  const nav = document.createElement('nav');
  nav.className = 'chapter-rail';
  nav.setAttribute('aria-label', '本页章节');
  nav.innerHTML = `<span class="rail-line" aria-hidden="true"></span><span class="rail-head" aria-hidden="true"></span>${chapters
    .map(
      (c, i) =>
        `<button class="rail-tick" type="button" data-index="${i}"><span class="rail-name">${c.dataset.chapter}</span></button>`,
    )
    .join('')}`;
  document.body.append(nav);
  const ticks = [...nav.querySelectorAll('.rail-tick')],
    head = nav.querySelector('.rail-head');
  let tops = [],
    start = 0,
    end = 1,
    active = -1,
    frame = 0,
    flash = 0;
  const measure = () => {
    tops = chapters.map((c) => c.getBoundingClientRect().top + scrollY);
    start = Math.max(0, tops[0] - innerHeight * 0.3);
    end = Math.max(
      start + 1,
      document.documentElement.scrollHeight - innerHeight,
    );
    ticks.forEach((t, i) => {
      const at = clamp(
        (tops[i] - innerHeight * 0.3 - start) / (end - start),
        0,
        1,
      );
      t.style.top = `${(at * RAIL).toFixed(1)}px`;
    });
  };
  const paint = () => {
    frame = 0;
    const y = scrollY,
      p = clamp((y - start) / (end - start), 0, 1);
    head.style.transform = `translateY(${(p * RAIL).toFixed(1)}px)`;
    let now = 0;
    tops.forEach((t, i) => {
      if (y + innerHeight * 0.45 >= t) now = i;
    });
    nav.classList.toggle('rail-visible', y > innerHeight * 0.35);
    if (now === active) return;
    active = now;
    ticks.forEach((t, i) => {
      t.dataset.state = i === now ? 'current' : i < now ? 'passed' : 'ahead';
      if (i === now) t.setAttribute('aria-current', 'location');
      else t.removeAttribute('aria-current');
    });
    nav.classList.add('rail-flash');
    clearTimeout(flash);
    flash = setTimeout(() => nav.classList.remove('rail-flash'), 1100);
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(paint);
  };
  const remeasure = () => {
    measure();
    schedule();
  };
  nav.addEventListener('click', (e) => {
    const tick = e.target.closest('.rail-tick');
    if (!tick) return;
    const i = Number(tick.dataset.index);
    scrollTo({
      top: tops[i] - innerHeight * 0.12,
      behavior: reduced ? 'auto' : 'smooth',
    });
  });
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', remeasure);
  const late = setTimeout(remeasure, 900);
  document.fonts?.ready.then(remeasure);
  measure();
  schedule();
  return () => {
    cancelAnimationFrame(frame);
    clearTimeout(flash);
    clearTimeout(late);
    removeEventListener('scroll', schedule);
    removeEventListener('resize', remeasure);
    nav.remove();
  };
}
