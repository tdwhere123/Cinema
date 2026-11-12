/**
 * Film-club detail chapters and their reading aids:
 * - a right-hand chapter rail (after Kokonut UI's Scroll Index, MIT: ticks sit at their
 *   section's scroll position and the current one is set apart);
 * - ink bleed: display quotes appear the way ink spreads into wet paper, then settle sharp;
 * - paragraphs settle into place once, as they first enter the page.
 * All are independent vanilla implementations; see NOTICE.md.
 */
import { clamp, easeOut } from './math.js';

const NUMERALS = ['01', '02', '03', '04', '05', '06'];

function interviewChapter(f, esc) {
  const v = f.interview;
  const qa = v.qa
    .map(
      (item, i) =>
        `<div class="qa settle"><div class="qa-q">${item.q.map((p) => `<p>${esc(p)}</p>`).join('')}</div><div class="qa-a">${item.a.map((p) => `<p>${esc(p)}</p>`).join('')}</div></div>${v.pull && v.pull.after === i ? `<blockquote class="pull-quote" data-ink><p>${esc(v.pull.text)}</p><cite>李沧东</cite></blockquote>` : ''}`,
    )
    .join('');
  return `<div class="chapter-body interview-body"><p class="interview-lede settle">${esc(v.lede)}</p>${qa}<p class="fine-print interview-source">原文 · ${esc(v.outlet)} · ${esc(v.author)} · ${esc(v.date)} · <a href="${esc(v.url)}" target="_blank" rel="noopener">${esc(v.title)} ↗</a><br>${esc(v.translation)}</p></div>`;
}

export function clubChapters(f, esc) {
  const source = `<a href="${esc(f.source)}" target="_blank" rel="noopener">资料来源 ↗</a>`;
  const still = (src, index, caption, extra = '') =>
    `<figure class="film-image ${index === 1 ? 'opening-image' : 'interlude-image'}" ${index === 2 ? 'data-chapter="剧照"' : ''}><div class="still-frame"><img class="film-still" ${extra} src="${src}" alt="《${esc(f.title)}》官方影片剧照${index === 2 ? '（二）' : ''}"${index === 2 ? ' loading="lazy"' : ''}></div><figcaption><span class="caption-index">剧照 0${index}</span><span class="caption-title">${esc(caption || '')}</span><span class="caption-meta">${esc(f.stillCredit)}</span></figcaption></figure>`;
  let n = 0;
  const head = (name) =>
    `<header class="chapter-head"><span class="chapter-num">${NUMERALS[n++]}</span><span class="chapter-name">${name}</span></header>`;
  const story = `<section class="chapter chapter-story description-section" data-chapter="故事">${head('故事')}<div class="chapter-body"><p class="story-copy description-copy settle">${esc(f.summary)}</p><p class="fine-print synopsis-credit">独立撰写的影片简介 · ${source}</p></div><aside class="chapter-aside honors awards"><h3 class="aside-title">荣誉</h3><ol>${f.awards.map((a) => `<li class="award-item settle"><span class="award-label">${esc(a.award)}</span><span class="award-event">${esc(a.event)}</span></li>`).join('')}</ol></aside></section>`;
  const context = `<section class="chapter chapter-context reading-section" data-chapter="背景">${head('背景')}<div class="chapter-body reading-body"><h2 data-ink>${esc(f.contextTitle)}</h2><p class="settle">${esc(f.context)}</p><p class="fine-print reading-source">事实资料 · ${f.id === 'poetry' ? 'Festival de Cannes' : 'Netflix Tudum'} · ${source}</p></div></section>`;
  const interview = f.interview
    ? `<section class="chapter chapter-interview" data-chapter="访谈">${head('访谈')}${interviewChapter(f, esc)}</section>`
    : '';
  const poster = `<section class="chapter poster-section" data-chapter="海报" aria-label="完整海报">${head('海报')}<div class="chapter-body"><p class="poster-note">一张折起来的纸，指向它，或轻点，它会自己展开。</p><a href="${f.poster}" target="_blank" rel="noopener"><img class="full-poster" src="${f.poster}" alt="《${esc(f.title)}》自制海报（完整画幅）"></a><p class="fine-print poster-caption">自制海报 · <a href="${f.poster}" target="_blank" rel="noopener">查看原图 ↗</a></p></div></section>`;
  return `${still(f.still, 1, f.stillCaption1, 'data-liquid="rise"')}
${story}
${context}
${still(f.secondStill, 2, f.stillCaption2)}
${interview}
${poster}`;
}

/** Paragraphs settle once: a short rise out of a faint blur, staggered within a batch. */
export function mountSettle(root, { reduced = false } = {}) {
  const blocks = [...root.querySelectorAll('.settle')];
  if (reduced || !('IntersectionObserver' in window)) {
    blocks.forEach((b) => b.classList.add('settled'));
    return () => {};
  }
  const seen = new IntersectionObserver(
    (entries) => {
      let k = 0;
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.style.setProperty('--settle-delay', `${k++ * 90}ms`);
        e.target.classList.add('settled');
        seen.unobserve(e.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.15 },
  );
  blocks.forEach((b) => seen.observe(b));
  return () => seen.disconnect();
}

const SVG = 'http://www.w3.org/2000/svg';
/**
 * Ink bleed: an SVG turbulence displacement and blur that relax to zero, so the words
 * spread like ink on damp paper and then dry crisp. The filter is removed afterwards.
 */
export function mountInkBleed(root, { reduced = false } = {}) {
  const marks = [...root.querySelectorAll('[data-ink]')];
  if (!marks.length) return () => {};
  if (reduced || !('IntersectionObserver' in window)) {
    marks.forEach((m) => m.classList.add('inked'));
    return () => {};
  }
  const defs = document.createElementNS(SVG, 'svg');
  defs.setAttribute('class', 'ink-defs');
  defs.setAttribute('aria-hidden', 'true');
  defs.setAttribute('width', '0');
  defs.setAttribute('height', '0');
  const frames = new Set();
  const setups = marks.map((el, i) => {
    const id = `ink-bleed-${i}-${Math.random().toString(36).slice(2, 7)}`;
    defs.insertAdjacentHTML(
      'beforeend',
      `<filter id="${id}" x="-15%" y="-40%" width="130%" height="180%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.022 0.05" numOctaves="2" seed="${i + 3}" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="0" xChannelSelector="R" yChannelSelector="G" result="spread"/><feGaussianBlur in="spread" stdDeviation="0"/></filter>`,
    );
    el.style.filter = `url(#${id})`;
    el.classList.add('ink-wet');
    return { el, id };
  });
  document.body.append(defs);
  const play = ({ el, id }) => {
    const filter = defs.querySelector(`#${id}`),
      map = filter.querySelector('feDisplacementMap'),
      blur = filter.querySelector('feGaussianBlur'),
      start = performance.now(),
      duration = 1800;
    el.classList.add('inked');
    const step = (now) => {
      frames.delete(raf);
      const t = clamp((now - start) / duration, 0, 1),
        e = easeOut(t),
        rest = 1 - e;
      map.setAttribute('scale', (34 * rest).toFixed(2));
      blur.setAttribute('stdDeviation', (3.2 * rest * rest).toFixed(2));
      if (t < 1) {
        raf = requestAnimationFrame(step);
        frames.add(raf);
      } else {
        el.style.filter = '';
        el.classList.remove('ink-wet');
      }
    };
    let raf = requestAnimationFrame(step);
    frames.add(raf);
  };
  const seen = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        seen.unobserve(e.target);
        play(setups.find((s) => s.el === e.target));
      }),
    { rootMargin: '0px 0px -18% 0px', threshold: 0.6 },
  );
  marks.forEach((m) => seen.observe(m));
  return () => {
    seen.disconnect();
    frames.forEach((f) => cancelAnimationFrame(f));
    defs.remove();
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
    frame = 0;
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
    clearTimeout(late);
    removeEventListener('scroll', schedule);
    removeEventListener('resize', remeasure);
    nav.remove();
  };
}
