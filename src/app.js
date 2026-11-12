import { mountLiquidImages } from './liquid-image.js';
import {
  clubChapters,
  mountChapterRail,
  mountInkBleed,
  mountSettle,
} from './club-page.js';
import { mountTopicMenu } from './topic-menu.js';
import { mountPaperReveal } from './paper-reveal.js';
import { localPath, siteURL } from './routes.js';
/** 应用层：路由、页面与交互。原站使用的打包脚本没有复制到本项目。 */
import { catalogue, upcoming } from './data.js';
import { createDiscScene } from './scene.js';
import { clamp } from './math.js';
import { mountEntrance } from './entrance.js';
import { titleLines } from './title-lines.js';
import { mountIndexMotion } from './index-motion.js';
import { mountNavigationMotion } from './navigation-motion.js';
import { createTrailerPlayer } from './player.js';
import { mountHeroDissolve } from './hero-dissolve.js';
import { mountNextProduction } from './next-production.js';
const $ = (s) => document.querySelector(s);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
// The gallery shows announced films in release order, then the blank discs still to come.
const galleryItems = (name) => [
  ...catalogue.filter((f) => f.category === name),
  ...(name === 'films' ? upcoming : []),
];
let category = 'films',
  items = galleryItems(category),
  index = 0,
  scene = null;
let busy = false,
  routeRevision = 0,
  observer,
  scrollQueued = false,
  lastDialogFocus = null;
let cleanupStills = () => {},
  cleanupClub = () => {},
  cleanupPaper = () => {},
  cleanupNext = () => {},
  cleanupHero = () => {},
  cleanupCarry = () => {};
const trailerPlayer = createTrailerPlayer($('#trailer-dialog'), {
  reduced: reduce,
});
let remembered = { films: 0 };
let entranceActive = !reduce && localPath() === '/';
const topicMenu = mountTopicMenu($('#nav'), { reduced: reduce });
const navMotion = mountNavigationMotion($('#nav'), { reduced: reduce });
const indexMotion = mountIndexMotion(
  $('#index-panel'),
  $('#index-backdrop'),
  $('#index-button'),
  { reduced: reduce },
);
if (entranceActive) navMotion.show({ initial: true });
const entrance = mountEntrance($('#preloader'), {
  reduced: reduce,
  enabled: entranceActive,
  onLogo: () => navMotion.revealLogo(),
  getAnchor: () => scene?.anchor(),
  onFloor: (y) => scene?.setPreloadFloor(y),
  getNavBounds: () => $('#nav').getBoundingClientRect(),
  onProgress: (p) => scene?.setPreload(p),
  onRelease: () => {
    entranceActive = false;
    scene?.releasePreload();
    navMotion.hide({ immediate: true });
  },
});
$('#load-year').textContent = new Date().getFullYear();
function esc(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  );
}
function current() {
  return items[index];
}
function nextTitleParts(title) {
  const clean = String(title).trim();
  if (clean.includes(' ')) return titleLines(clean);
  return [clean];
}
function updateInfo() {
  const f = current();
  if (!f) return;
  const info = $('#film-info');
  const isClub = f.tba || f.category === 'films';
  info.classList.remove('fresh');
  info.classList.toggle('tba', !!f.tba);
  info.innerHTML = f.tba
    ? `<h2>？</h2><dl><div><dt>片名</dt><dd>待揭晓</dd></div></dl>`
    : `<h2>${esc(f.title)}</h2><dl><div><dt>${isClub ? '导演' : 'DIRECTED BY'}</dt><dd>${f.directors.map(esc).join('<br>')}</dd></div><div><dt>${isClub ? '年份' : 'YEAR'}</dt><dd>${esc(f.year)}</dd></div><div><dt>${isClub ? '主演' : 'STARRING'}</dt><dd>${f.cast.slice(0, 5).map(esc).join('<br>')}</dd></div></dl>`;
  info.querySelectorAll('h2,dt,dd').forEach((el, i) => {
    el.style.setProperty('--line-delay', `${i * 0.035}s`);
    el.innerHTML = el.innerHTML
      .split('<br>')
      .map(
        (line, j) =>
          `<span class="text-line-mask"><span class="text-line-rise" style="--row-delay:${j * 0.05}s">${line}</span></span>`,
      )
      .join('');
  });
  void info.offsetWidth;
  info.classList.add('fresh');
  $('#reviews').innerHTML = (f.reviews || [])
    .map(
      (r) =>
        `<article class="review"><div class="review-stars" aria-label="${esc(r.stars)} out of 5">${Array.from({ length: 5 }, (_, i) => `<span class="rating-star" style="--fill:${clamp(Number(r.stars) - i, 0, 1) * 100}%" aria-hidden="true"></span>`).join('')}</div><p class="eyebrow">${esc(r.publication)}</p><h3>${esc(r.text)}</h3></article>`,
    )
    .join('');
  $('#counter').textContent = `${index + 1} / ${items.length}`;
  $('#prev').disabled = index === 0;
  $('#next').disabled = index === items.length - 1;
  $('#open-current').disabled = !!f.tba;
  $('#open-current').textContent = f.tba ? '尚未揭晓' : '影片介绍 ↗';
  $('#open-current').setAttribute(
    'aria-label',
    f.tba ? '这一部尚未揭晓' : `打开《${f.title}》`,
  );
  document
    .querySelectorAll('#index-list button')
    .forEach((b, i) => b.classList.toggle('active', i === index));
  remembered[category] = index;
}
function choose(i) {
  index = clamp(Math.round(i), 0, items.length - 1);
  scene?.setIndex(index);
  updateInfo();
}
function setCategory(next) {
  if (scene && category === next) return;
  scene?.destroy();
  category = next;
  $('#gallery h1').textContent =
    next === 'films' ? '观影会 · 李沧东' : '参考模板 · 非活动选片';
  items = galleryItems(next);
  index = remembered[next] || 0;
  scene = createDiscScene($('#scene'), items, {
    onSelect: (i) => {
      index = i;
      updateInfo();
    },
    onOpen: () => {
      if (!current().tba) navigate(`/production/${current().id}`);
    },
    onRendererChange: () => {
      $('#renderer-status').textContent =
        'WebGL 上下文已丢失，已切换 CSS 兼容路径。';
    },
    holdEntry: entranceActive,
    onProgress: (done, total) => entrance.progress(done, total),
    onReady: () => {
      entrance.ready();
      $('#renderer-status').textContent =
        scene?.rendererType === 'webgl'
          ? '当前使用 WebGL 真实三维渲染。'
          : '当前浏览器没有 WebGL，正在显示 CSS 兼容路径。材质效果与 WebGL 不同。';
    },
  });
  $('#index-list').innerHTML = items
    .map((f, i) =>
      f.tba
        ? `<button data-index="${i}" class="tba"><span>？</span><small>待揭晓</small></button>`
        : `<button data-index="${i}"><span>${esc(f.title)}</span><small>${esc(f.year)}</small></button>`,
    )
    .join('');
  scene.setIndex(index, true);
  updateInfo();
}
function toggleIndex(open, options) {
  indexMotion.set(open, options);
}
$('#index-button').onclick = () =>
  toggleIndex($('#index-button').getAttribute('aria-expanded') !== 'true');
$('#index-backdrop').onclick = () => toggleIndex(false);
$('#index-list').onclick = (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  choose(Number(b.dataset.index));
  toggleIndex(false);
  if (current().tba) navigate('/');
  else if (!$('#detail').hidden) navigate(`/production/${current().id}`);
  else $('#scene').focus();
};
$('#prev').onclick = () => choose(index - 1);
$('#next').onclick = () => choose(index + 1);
$('#open-current').onclick = () => {
  if (!current().tba) navigate(`/production/${current().id}`);
};
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('#index-panel').hidden) {
    toggleIndex(false);
    $('#topic-toggle').focus();
    topicMenu.close();
  }
});
function openTrailer(f) {
  trailerPlayer.open(f);
}
const detailFooter = `<footer class="detail-footer">CINEMA 观影会 · 影像与生活</footer>`;
function nextFilm(next, parts, isClub) {
  const sub = parts.length === 1 ? ` data-sub="${esc(next.year)}"` : '';
  return `<section class="next-section"${isClub ? ' data-chapter="下一部"' : ''}><div class="next-meta"><p class="next-kicker">${isClub ? '下一部' : 'NEXT PRODUCTION'}</p><div class="next-progress" role="progressbar" aria-label="继续向下滚动，前往下一部" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"></div><p class="next-hint">${isClub ? '继续向下滚动' : 'KEEP SCROLLING TO CONTINUE'}</p></div><a href="${siteURL(`/production/${next.id}`)}" class="next-target"><h2 class="reveal" aria-label="${esc(next.title)}"${sub}>${parts.map((part, i) => `<span class="next-line-mask" data-line="${i}"><span class="next-line">${esc(part)}${i === 0 && next.title.includes(' ') && parts.length > 1 ? ' ' : ''}</span></span>`).join('')}</h2></a><img class="next-disc" src="${next.art}" alt="${esc(next.title)} 碟片">${detailFooter}</section>`;
}
/** After the last announced film: the blank disc, without a way forward yet. */
function quietEnding(next) {
  return `<section class="next-section next-tba" data-chapter="下一部"><div class="next-meta"><p class="next-kicker">下一部</p><p class="next-hint">尚未揭晓</p></div><div class="next-target"><h2 class="reveal" aria-label="下一部尚未揭晓" data-sub="待揭晓"><span class="next-line-mask" data-line="0"><span class="next-line">？</span></span></h2></div><img class="next-disc" src="${next.art}" alt="尚未揭晓的碟片">${detailFooter}</section>`;
}
function renderDetail(f) {
  const next = items[(index + 1) % items.length];
  const isClub = f.category === 'films';
  const joiner = isClub ? '、' : ', ';
  const nextParts = next.tba ? ['？'] : nextTitleParts(next.title);
  $('#detail').innerHTML = `
 <header class="detail-info"${isClub ? ' data-chapter="片名"' : ''}><h1 class="detail-title" tabindex="-1">${titleLines(
   f.title,
 )
   .map(
     (line, i) =>
       `<span class="title-line-mask"><span class="title-line" style="--title-delay:${i * 0.08}s">${esc(line)}${i === 0 && f.title.includes(' ') ? ' ' : ''}</span></span>`,
   )
   .join(
     '',
   )}</h1><div class="credits"><span class="credit-group"><small class="eyebrow">${isClub ? '导演' : 'DIRECTED BY'}</small> ${f.directors.map(esc).join(joiner)}</span>${f.writers.length ? `<span class="credit-group"><small class="eyebrow">${isClub ? '编剧' : 'WRITTEN BY'}</small> ${f.writers.map(esc).join(joiner)}</span>` : ''}<span class="credit-group cast"><small class="eyebrow">${isClub ? '主演' : 'STARRING'}</small> ${f.cast.map(esc).join(joiner)}</span></div><div class="detail-metadata">${[
   'year',
   'country',
   'genre',
   'languages',
   'runtime',
 ]
   .filter((key) => f[key])
   .map(
     (key) =>
       `<div><span class="eyebrow">${{ year: '年份', country: '国家 / 地区', genre: '类型', languages: '语言', runtime: '片长' }[key]}</span><span>${esc(f[key])}</span></div>`,
   )
   .join(
     '',
   )}</div>${isClub ? '' : `<div class="detail-cta"><span class="corner tl">+</span><span class="corner tr">+</span><span class="corner bl">+</span><span class="corner br">+</span>${f.actions.map((a) => `<a class="rule-link" href="${esc(a.url)}" target="_blank" rel="noopener"><span>${esc(a.label)}</span></a>`).join('')}</div>`}</header>
 ${isClub ? clubChapters(f, esc) : ''}
 ${f.trailer ? `<section class="trailer-section"><div class="trailer-sticky"><img class="trailer-picture" src="${f.still}" alt="${esc(f.title)} 预告静帧"><div class="trailer-copy"><h2 class="reveal">${esc(f.tagline)}</h2><button class="rule-link" id="watch-trailer"><span>WATCH TRAILER</span></button></div></div></section>` : ''}
 ${isClub ? '' : `<section class="description-section"><div class="description-lead"><span class="section-kicker reveal">${isClub ? 'SYNOPSIS / 故事梗概' : 'SYNOPSIS'}</span><p class="description-copy reveal">${esc(f.summary)}</p><p class="synopsis-credit">独立撰写的影片简介 · <a href="${esc(f.source)}" target="_blank" rel="noopener">资料来源 ↗</a></p></div><div class="awards reveal">${f.awards.map((a) => `<div class="award-item"><span class="award-label">${esc(a.award)}</span><span class="award-event">${esc(a.event)}</span></div>`).join('')}${f.moreAwards ? `<span class="award-label">${esc(f.moreAwards)}</span>` : ''}</div>${f.vector ? `<div class="description-vector"><img src="${f.vector}" alt="" loading="lazy"></div>` : ''}</section>`}
 ${next.tba ? quietEnding(next) : nextFilm(next, nextParts, isClub)}`;
  cleanupStills();
  cleanupStills = mountLiquidImages($('#detail'), { reduced: reduce });
  cleanupClub();
  $('#detail').classList.toggle('club', isClub);
  if (isClub) {
    const parts = [mountChapterRail, mountSettle, mountInkBleed].map((mount) =>
      mount($('#detail'), { reduced: reduce }),
    );
    cleanupClub = () => parts.forEach((stop) => stop());
  } else cleanupClub = () => {};
  cleanupPaper();
  cleanupPaper = mountPaperReveal($('.poster-section'), { reduced: reduce });
  syncDetailLayout();
  cleanupHero();
  // Club pages: the opening still's liquid front is the hero's dissolving edge.
  if (!isClub)
    cleanupHero = mountHeroDissolve($('.detail-info'), { reduced: reduce });
  cleanupNext();
  cleanupNext = mountNextProduction($('.next-section'), {
    onAdvance: next.tba ? null : () => navigate(`/production/${next.id}`),
    reduced: reduce,
  });
  if (f.trailer) $('#watch-trailer').onclick = () => openTrailer(f);
  observer?.disconnect();
  observer = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (e.isIntersecting) e.target.classList.add('visible');
      }),
    { threshold: 0.12 },
  );
  $('#detail')
    .querySelectorAll('.reveal, .reveal-rule')
    .forEach((e) => observer.observe(e));
}
function syncDetailLayout() {
  const cta = $('#detail .detail-cta'),
    hero = $('#detail .detail-info'),
    copy = $('#detail .description-section>div');
  if (!cta || !hero || !copy) return;
  const destination = innerWidth < 768 ? copy : hero;
  if (cta.parentElement !== destination) destination.append(cta);
}
function renderRoute({ carriedScene = null } = {}) {
  topicMenu.close();
  cleanupStills();
  cleanupClub();
  cleanupClub = () => {};
  cleanupPaper();
  cleanupNext();
  cleanupHero();
  const match = (localPath() || '').match(/^\/production\/([^/]+)\/?$/);
  const film = match ? catalogue.find((f) => f.id === match[1]) : null;
  if (!film && localPath() !== '/') {
    scene?.setVisible(false);
    $('#index-button').hidden = true;
    $('#gallery').hidden = true;
    $('#detail').hidden = false;
    $('#detail').innerHTML =
      `<section class="missing-page"><h1>页面未找到</h1><a href="${siteURL('/')}">返回选片 ↗</a></section>`;
    document.title = 'CINEMA — 页面未找到';
    return;
  }
  setCategory(film?.category || 'films');
  if (film) index = items.findIndex((f) => f.id === film.id);
  scene.setIndex(index, true);
  updateInfo();
  const detail = !!film;
  $('#gallery').hidden = detail;
  $('#detail').hidden = !detail;
  scene.setVisible(!detail || scene === carriedScene);
  $('#index-button').hidden = detail;
  $('#films-link').classList.toggle('current', !detail && category === 'films');
  $('#nav').classList.remove('light');
  toggleIndex(false, { immediate: true });
  if (detail) {
    renderDetail(film);
    document.title = `CINEMA — ${film.title}`;
    $('#detail h1').focus({ preventScroll: true });
  } else {
    $('#detail').replaceChildren();
    observer?.disconnect();
    document.title = `CINEMA — ${category === 'films' ? '选片' : '参考模板'}`;
    scene.restartEntry();
    $('#gallery').classList.remove('gallery-entering');
    void $('#gallery').offsetWidth;
    $('#gallery').classList.add('gallery-entering');
    if (!entranceActive) $('#scene').focus({ preventScroll: true });
  }
  window.scrollTo(0, 0);
  requestAnimationFrame(scrollFrame);
}
function carryScene(outgoing) {
  const host = $('#scene'),
    parent = host.parentElement,
    next = host.nextSibling;
  host.classList.add('scene-carry');
  host.inert = true;
  host.setAttribute('aria-hidden', 'true');
  document.body.append(host);
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    outgoing.cancelExit();
    outgoing.setVisible(false);
    host.classList.remove('scene-carry');
    host.inert = false;
    host.removeAttribute('aria-hidden');
    parent.insertBefore(host, next);
  };
}
async function performRoute() {
  entrance.cancel();
  const revision = ++routeRevision;
  cleanupCarry();
  cleanupCarry = () => {};
  topicMenu.close();
  cleanupStills();
  cleanupClub();
  cleanupClub = () => {};
  cleanupPaper();
  navMotion.show();
  busy = true;
  cleanupNext();
  trailerPlayer.close({ immediate: true });
  toggleIndex(false, { immediate: true });
  const leavingGallery = !$('#gallery').hidden;
  const targetFilm = catalogue.find(
    (f) => localPath() === `/production/${f.id}`,
  );
  const enteringDetail = !!targetFilm;
  let rendered = false,
    entryDone = Promise.resolve();
  function mount(carriedScene = null) {
    renderRoute({ carriedScene });
    rendered = true;
    $('#gallery').classList.remove('gallery-exiting');
    $('#detail').classList.remove('detail-exiting');
    if (enteringDetail) {
      $('#detail').classList.add('detail-entering');
      entryDone = new Promise((r) => setTimeout(r, reduce ? 0 : 350));
    }
  }
  document.body.classList.add('route-changing');
  if (leavingGallery) {
    $('#gallery').classList.add('gallery-exiting');
    const outgoing = scene,
      overlap = !reduce && enteringDetail && targetFilm.category === category;
    await outgoing.exit({
      duration: overlap ? 800 : 550,
      onHandover: overlap
        ? () => {
            if (revision !== routeRevision) return;
            cleanupCarry = carryScene(outgoing);
            mount(outgoing);
          }
        : undefined,
    });
  } else {
    $('#detail').classList.add('detail-exiting');
    await new Promise((r) => setTimeout(r, reduce ? 0 : 350));
  }
  if (revision !== routeRevision) return;
  if (!rendered) mount();
  await entryDone;
  if (revision !== routeRevision) return;
  cleanupCarry();
  cleanupCarry = () => {};
  $('#detail').classList.remove('detail-entering');
  document.body.classList.remove('route-changing');
  busy = false;
  navMotion.hide();
}

function navigate(path) {
  if (localPath() === path) {
    toggleIndex(false);
    return;
  }
  history.pushState({}, '', siteURL(path));
  performRoute();
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('a');
  if (
    !a ||
    a.target === '_blank' ||
    e.metaKey ||
    e.ctrlKey ||
    e.shiftKey ||
    e.button !== 0
  )
    return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return;
  const path = localPath(url.pathname);
  if (path === '/' || path?.startsWith('/production/')) {
    e.preventDefault();
    navigate(path);
  }
});
addEventListener('popstate', performRoute);
function scrollFrame() {
  scrollQueued = false;
  if ($('#detail').hidden) return;
  const section = $('.trailer-section');
  if (!section) return;
  const r = section.getBoundingClientRect();
  const progress = clamp((innerHeight - r.top) / (innerHeight * 1.05), 0, 1);
  const img = $('.trailer-picture');
  img.style.transform = reduce ? 'none' : `scale(${1.04 - progress * 0.04})`;
  const light = r.top < innerHeight * 0.2 && r.bottom > innerHeight * 0.7;
  $('#nav').classList.toggle('light', light);
  const vector = $('.description-vector img');
  if (vector && !reduce) {
    const vr = vector.getBoundingClientRect();
    vector.style.transform = `translateY(${clamp(vr.top * 0.03, -20, 25)}px)`;
  }
}
addEventListener(
  'scroll',
  () => {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(scrollFrame);
  },
  { passive: true },
);
addEventListener('resize', () => {
  syncDetailLayout();
  requestAnimationFrame(scrollFrame);
});
if (matchMedia('(pointer:fine)').matches) {
  addEventListener(
    'pointermove',
    (e) => {
      const c = $('#cursor');
      c.style.left = e.clientX + 'px';
      c.style.top = e.clientY + 'px';
      c.style.opacity = '1';
    },
    { passive: true },
  );
  addEventListener('pointerout', (e) => {
    if (!e.relatedTarget) $('#cursor').style.opacity = '0';
  });
}
renderRoute();
