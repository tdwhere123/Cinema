/**
 * 自定义预告播放器。独立实现，不包含参考站播放器源码。
 * YouTube 官方 IFrame API 仅在首次点击预告后加载。
 * API / 视频初始化失败时销毁自定义控制，降级原生 YouTube 控件。
 */
let apiPromise;
function loadYouTubeAPI() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    let finished = false;
    const finish = (error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      clearInterval(poll);
      if (error) reject(error);
      else resolve(window.YT);
    };
    // 轮询命名空间，不覆盖其他模块的 onYouTubeIframeAPIReady 回调。
    const poll = setInterval(() => {
      if (window.YT?.Player) finish();
    }, 100);
    const timer = setTimeout(
      () => finish(new Error('YouTube API timeout')),
      8000,
    );
    let script = document.querySelector('script[data-trailer-youtube-api]');
    if (!script) {
      script = document.createElement('script');
      script.dataset.trailerYoutubeApi = 'true';
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.addEventListener(
        'error',
        () => finish(new Error('YouTube API unavailable')),
        { once: true },
      );
      document.head.append(script);
    }
  }).catch((error) => {
    apiPromise = undefined;
    throw error;
  });
  return apiPromise;
}

function videoId(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    if (!['youtube.com', 'youtube-nocookie.com', 'youtu.be'].includes(host))
      return null;
    const id =
      host === 'youtu.be'
        ? parsed.pathname.split('/')[1]
        : parsed.searchParams.get('v') || parsed.pathname.split('/').pop();
    return /^[\w-]{11}$/.test(id || '') ? id : null;
  } catch {
    return null;
  }
}
const clock = (seconds) => {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

export function createTrailerPlayer(
  dialog,
  { reduced = matchMedia('(prefers-reduced-motion: reduce)').matches } = {},
) {
  const host = dialog.querySelector('#trailer-player');
  const closeButton = dialog.querySelector('.close-dialog');
  const abort = new AbortController();
  const signal = abort.signal;
  let player = null,
    generation = 0,
    opened = false,
    ready = false,
    destroyed = false;
  let previousFocus, closeTimer, initTimer, tickTimer, idleTimer;
  let revealTimer,
    revealFrame = 0,
    openingAnimation = null;
  let seekHeld = false,
    lastVolume = 55,
    nativeFallback = false,
    bufferingTimer = null;
  const status = document.createElement('p');
  status.className = 'trailer-status';
  status.setAttribute('role', 'status');
  const controls = document.createElement('div');
  controls.className = 'trailer-controls';
  controls.hidden = true;
  controls.innerHTML = `<button type="button" data-action="play" aria-label="Play">PLAY</button>
    <span class="trailer-time"><span data-time="current">0:00</span> / <span data-time="duration">0:00</span></span>
    <label class="trailer-seek"><span class="player-sr-only">Seek video</span><input type="range" min="0" max="1000" value="0" step="1" data-control="seek" aria-label="Seek video"><span class="trailer-buffer" aria-hidden="true"></span></label>
    <button type="button" data-action="mute" aria-label="Mute">SOUND ON</button>
    <label class="trailer-volume"><span class="player-sr-only">Volume</span><input type="range" min="0" max="100" value="55" data-control="volume" aria-label="Volume"></label>
    <button type="button" data-action="fullscreen" aria-label="Enter fullscreen">FULLSCREEN</button>`;
  const launchFrame = document.createElement('div');
  launchFrame.className = 'trailer-launch-frame';
  launchFrame.setAttribute('aria-hidden', 'true');
  launchFrame.innerHTML = '<i></i><i></i>';
  dialog.append(status, controls, launchFrame);

  function clearTransition() {
    clearTimeout(revealTimer);
    cancelAnimationFrame(revealFrame);
    openingAnimation?.cancel();
    openingAnimation = null;
    dialog.style.clipPath = '';
    dialog.style.maskImage = '';
    dialog.style.webkitMaskImage = '';
    dialog.classList.remove('player-launching');
  }
  function openFromButton(trigger) {
    clearTransition();
    // 记录真实触发按钮的视口矩形，而不是从任意屏幕中点放大。
    const bounds = trigger?.getBoundingClientRect();
    const w = innerWidth,
      h = innerHeight;
    const r =
      bounds && bounds.width > 0 && bounds.height > 0
        ? bounds
        : {
            left: w / 2 - 80,
            top: h / 2 - 20,
            width: 160,
            height: 40,
            right: w / 2 + 80,
            bottom: h / 2 + 20,
          };
    const top = Math.max(0, r.top),
      left = Math.max(0, r.left);
    const bottom = Math.max(0, h - r.bottom),
      right = Math.max(0, w - r.right);
    const from = `inset(${top}px ${right}px ${bottom}px ${left}px)`;
    dialog.dataset.launchBounds = JSON.stringify({
      left: r.left,
      top: r.top,
      width: r.width,
      height: r.height,
    });
    launchFrame.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
    launchFrame.style.color = trigger
      ? getComputedStyle(trigger).color
      : '#fff';
    if (reduced) {
      dialog.classList.remove('player-opening');
      return;
    }
    dialog.classList.add('player-launching');
    dialog.style.clipPath = from;
    // 第一步 450ms：上下边线向按钮中心增厚、合拢。
    // 第二步 1050ms：从同一按钮矩形扩张成全屏舞台。
    revealTimer = setTimeout(() => {
      if (!opened) return;
      dialog.classList.remove('player-launching');
      openingAnimation = dialog.animate(
        [{ clipPath: from }, { clipPath: 'inset(0px 0px 0px 0px)' }],
        {
          duration: 1050,
          easing: 'cubic-bezier(.16,1,.3,1)',
          fill: 'forwards',
        },
      );
      const animation = openingAnimation;
      animation.finished
        .then(() => {
          if (opened && openingAnimation === animation) {
            dialog.style.clipPath = '';
            animation.cancel();
            openingAnimation = null;
          }
        })
        .catch(() => {});
    }, 450);
  }
  function noiseDissolve() {
    clearTransition();
    // 独立二维连续 value-noise 遮罩：低频有机轮廓，不用离散随机小格。
    // smoothstep 双线性插值 + 两层噪声；并非参考站的原始 shader。
    const width = 240,
      height = 150;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      dialog.style.opacity = '0';
      return;
    }
    const smooth = (t) => t * t * (3 - 2 * t);
    const hash = (x, y) => {
      const n = Math.sin(x * 127.1 + y * 311.7 + 17.3) * 43758.5453;
      return n - Math.floor(n);
    };
    function noise(x, y) {
      const ix = Math.floor(x),
        iy = Math.floor(y),
        u = smooth(x - ix),
        v = smooth(y - iy);
      const a = hash(ix, iy),
        b = hash(ix + 1, iy),
        c = hash(ix, iy + 1),
        d = hash(ix + 1, iy + 1);
      return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
    }
    // 阈值只预计算一次。每帧更新 alpha，颜色始终为白色。
    const thresholds = new Float32Array(width * height),
      pixels = ctx.createImageData(width, height);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const i = y * width + x,
          nx = x / (width - 1),
          ny = y / (height - 1);
        const organic =
          noise(nx * 4, ny * 3) * 0.8 + noise(nx * 8 + 13, ny * 6 + 7) * 0.2;
        thresholds[i] = ny * 0.72 + organic * 0.28;
        pixels.data[i * 4] =
          pixels.data[i * 4 + 1] =
          pixels.data[i * 4 + 2] =
            255;
      }
    const began = performance.now();
    let lastDraw = -Infinity;
    function draw(now) {
      const p = Math.min(1, (now - began) / 850);
      // 保留 RAF 生命周期，但遮罩只编码 24fps，避免高刷屏额外编码开销。
      if (now - lastDraw >= 1000 / 24 || p >= 1) {
        lastDraw = now;
        const front = p * 1.06 - 0.03,
          soft = 0.014;
        for (let i = 0; i < thresholds.length; i++) {
          const t = Math.max(
            0,
            Math.min(1, (thresholds[i] - front + soft) / (soft * 2)),
          );
          pixels.data[i * 4 + 3] = p >= 1 ? 0 : Math.round(smooth(t) * 255);
        }
        ctx.putImageData(pixels, 0, 0);
        const mask = `url("${canvas.toDataURL()}")`;
        dialog.style.maskImage = mask;
        dialog.style.webkitMaskImage = mask;
      }
      if (p < 1) revealFrame = requestAnimationFrame(draw);
    }
    draw(began);
  }

  const playButton = controls.querySelector('[data-action="play"]');
  const muteButton = controls.querySelector('[data-action="mute"]');
  const seek = controls.querySelector('[data-control="seek"]');
  const volume = controls.querySelector('[data-control="volume"]');
  const fullscreen = controls.querySelector('[data-action="fullscreen"]');
  fullscreen.hidden = !dialog.requestFullscreen;
  function alive(token) {
    return !destroyed && opened && generation === token;
  }
  function disposePlayer() {
    ready = false;
    clearTimeout(bufferingTimer);
    bufferingTimer = null;
    clearTimeout(initTimer);
    clearInterval(tickTimer);
    try {
      player?.destroy();
    } catch {
      /* 断网或已移除 iframe */
    }
    player = null;
    host.replaceChildren();
    controls.hidden = true;
  }
  function wake() {
    clearTimeout(idleTimer);
    dialog.classList.remove('player-idle');
    if (opened && ready && player?.getPlayerState() === 1)
      idleTimer = setTimeout(
        () => dialog.classList.add('player-idle'),
        matchMedia('(pointer:coarse)').matches ? 1800 : 2600,
      );
  }
  function update() {
    if (!ready || !player) return;
    try {
      const duration = player.getDuration() || 0,
        current = player.getCurrentTime() || 0;
      controls.querySelector('[data-time="current"]').textContent =
        clock(current);
      controls.querySelector('[data-time="duration"]').textContent =
        clock(duration);
      if (!seekHeld) seek.value = duration ? (current / duration) * 1000 : 0;
      seek.setAttribute(
        'aria-valuetext',
        `${clock(current)} of ${clock(duration)}`,
      );
      controls.style.setProperty(
        '--buffer',
        player.getVideoLoadedFraction() || 0,
      );
      const state = player.getPlayerState(),
        playing = state === 1,
        buffering = state === 3;
      playButton.textContent = buffering
        ? 'BUFFERING…'
        : playing
          ? 'PAUSE'
          : 'PLAY';
      playButton.setAttribute(
        'aria-label',
        buffering ? 'Buffering. Pause video' : playing ? 'Pause' : 'Play',
      );
      playButton.setAttribute('aria-busy', String(buffering));
      const muted = player.isMuted();
      muteButton.textContent = muted ? 'SOUND OFF' : 'SOUND ON';
      muteButton.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
      muteButton.setAttribute('aria-pressed', String(muted));
      volume.value = muted ? 0 : player.getVolume();
    } catch {
      /* iframe 的异步销毁期间不更新界面 */
    }
  }
  function fallback(id, token, message) {
    if (!alive(token)) return;
    nativeFallback = true;
    disposePlayer();
    dialog.classList.remove('player-idle');
    const iframe = document.createElement('iframe');
    iframe.title = 'Official trailer · YouTube native controls';
    iframe.src = `https://www.youtube-nocookie.com/embed/${id}?controls=1&autoplay=1&playsinline=1&rel=0`;
    iframe.allow = 'autoplay; fullscreen; picture-in-picture';
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    host.append(iframe);
    status.textContent =
      message ||
      'Custom controls unavailable. Use YouTube controls, or open on YouTube.';
  }
  async function open(film) {
    if (destroyed) return;
    const id = videoId(film.trailer);
    if (!opened) previousFocus = document.activeElement;
    const trigger =
      previousFocus?.closest?.('#watch-trailer') ||
      document.querySelector('#watch-trailer');
    clearTimeout(closeTimer);
    disposePlayer();
    const token = ++generation;
    opened = true;
    nativeFallback = false;
    dialog.classList.remove('player-closing', 'player-idle');
    dialog.classList.add('player-opening');
    dialog.querySelector('#trailer-name').textContent = film.title;
    dialog.querySelector('#trailer-external').href = id
      ? film.trailer
      : 'https://www.youtube.com/';
    if (!dialog.open) dialog.showModal();
    openFromButton(trigger);
    status.textContent = id
      ? 'Loading official trailer…'
      : 'This trailer link is unavailable.';
    closeButton.focus();
    if (!id) return;
    try {
      const YT = await loadYouTubeAPI();
      if (!alive(token)) return;
      const mount = document.createElement('div');
      host.append(mount);
      initTimer = setTimeout(() => fallback(id, token), 8000);
      player = new YT.Player(mount, {
        host: 'https://www.youtube-nocookie.com',
        videoId: id,
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          enablejsapi: 1,
          playsinline: 1,
          rel: 0,
          origin: location.origin,
        },
        events: {
          onReady(event) {
            if (!alive(token) || nativeFallback) {
              try {
                event.target.destroy();
              } catch {}
              return;
            }
            clearTimeout(initTimer);
            player = event.target;
            ready = true;
            controls.hidden = false;
            status.textContent = '';
            player.setVolume(lastVolume);
            player.playVideo();
            update();
            wake();
            tickTimer = setInterval(update, 200);
          },
          onStateChange(event) {
            if (!alive(token) || !ready || nativeFallback) return;
            const buffering = event.data === 3;
            dialog.classList.toggle('player-buffering', buffering);
            if (buffering) {
              if (!bufferingTimer)
                status.textContent = 'Buffering official trailer…';
              if (!bufferingTimer)
                bufferingTimer = setTimeout(() => {
                  if (alive(token) && ready && player?.getPlayerState() === 3) {
                    status.textContent =
                      'The trailer is taking longer to load. You can keep waiting, pause, or use OPEN ON YOUTUBE below.';
                    dialog.classList.remove('player-idle');
                  }
                }, 15000);
            } else {
              clearTimeout(bufferingTimer);
              bufferingTimer = null;
              status.textContent = '';
            }
            wake();
            update();
          },
          onError() {
            if (nativeFallback) return;
            fallback(
              id,
              token,
              'The custom player could not load this video. Try YouTube controls or the external link.',
            );
          },
        },
      });
    } catch {
      fallback(id, token);
    }
  }
  function finishClose() {
    clearTimeout(closeTimer);
    clearTransition();
    dialog.style.opacity = '';
    disposePlayer();
    dialog.classList.remove(
      'player-opening',
      'player-closing',
      'player-idle',
      'player-buffering',
    );
    if (dialog.open) dialog.close();
    if (previousFocus?.isConnected)
      previousFocus.focus({ preventScroll: true });
    previousFocus = null;
  }
  function close({ immediate = false } = {}) {
    if (!opened && !dialog.open) return;
    opened = false;
    ++generation;
    clearTimeout(initTimer);
    clearTimeout(idleTimer);
    clearTimeout(bufferingTimer);
    bufferingTimer = null;
    clearInterval(tickTimer);
    try {
      player?.pauseVideo();
    } catch {}
    // 原生降级无 API 时立即移除，保证关闭动画期间也不会继续发声。
    if (!ready) host.replaceChildren();
    if (document.fullscreenElement === dialog)
      document.exitFullscreen?.().catch(() => {});
    dialog.classList.add('player-closing');
    if (reduced || immediate) finishClose();
    else {
      noiseDissolve();
      closeTimer = setTimeout(finishClose, 850);
    }
  }
  function togglePlay() {
    if (ready) {
      [1, 3].includes(player.getPlayerState())
        ? player.pauseVideo()
        : player.playVideo();
      wake();
      update();
    }
  }
  function toggleMute() {
    if (ready) {
      player.isMuted() ? player.unMute() : player.mute();
      wake();
      update();
    }
  }
  function setVolume(value) {
    if (!ready) return;
    lastVolume = Math.max(0, Math.min(100, value));
    player.setVolume(lastVolume);
    if (lastVolume > 0) player.unMute();
    else player.mute();
    wake();
    update();
  }
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement === dialog)
        await document.exitFullscreen();
      else await dialog.requestFullscreen?.();
    } catch {
      status.textContent = 'Fullscreen is unavailable in this browser.';
    }
  }
  closeButton.addEventListener('click', () => close(), { signal });
  dialog.addEventListener(
    'cancel',
    (event) => {
      event.preventDefault();
      close();
    },
    { signal },
  );
  dialog.addEventListener(
    'close',
    () => {
      if (opened) close({ immediate: true });
    },
    { signal },
  );
  dialog.addEventListener('pointermove', wake, { signal, passive: true });
  dialog.addEventListener('pointerdown', wake, { signal, passive: true });
  dialog.addEventListener('focusin', wake, { signal });
  playButton.addEventListener('click', togglePlay, { signal });
  muteButton.addEventListener('click', toggleMute, { signal });
  fullscreen.addEventListener('click', toggleFullscreen, { signal });
  volume.addEventListener('input', () => setVolume(Number(volume.value)), {
    signal,
  });
  seek.addEventListener(
    'input',
    () => {
      seekHeld = true;
      wake();
    },
    { signal },
  );
  seek.addEventListener(
    'change',
    () => {
      if (ready)
        player.seekTo((Number(seek.value) / 1000) * player.getDuration(), true);
      seekHeld = false;
      update();
    },
    { signal },
  );
  dialog.addEventListener(
    'keydown',
    (event) => {
      if (!opened || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (!ready || event.target.matches('input, textarea, select')) return;
      if (event.key === ' ' && event.target.matches('button, a')) return;
      const key = event.key.toLowerCase();
      if (
        [
          ' ',
          'k',
          'm',
          'f',
          'arrowleft',
          'arrowright',
          'arrowup',
          'arrowdown',
        ].includes(key)
      )
        event.preventDefault();
      if (key === ' ' || key === 'k') togglePlay();
      else if (key === 'm') toggleMute();
      else if (key === 'f') toggleFullscreen();
      else if (key === 'arrowleft' || key === 'arrowright')
        player.seekTo(
          Math.max(
            0,
            Math.min(
              player.getDuration(),
              player.getCurrentTime() + (key === 'arrowleft' ? -5 : 5),
            ),
          ),
          true,
        );
      else if (key === 'arrowup' || key === 'arrowdown')
        setVolume(player.getVolume() + (key === 'arrowup' ? 10 : -10));
      wake();
    },
    { signal },
  );
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden && ready)
        try {
          player.pauseVideo();
        } catch {}
    },
    { signal },
  );
  return {
    open,
    close,
    destroy() {
      close({ immediate: true });
      destroyed = true;
      abort.abort();
      status.remove();
      controls.remove();
      launchFrame.remove();
    },
  };
}
