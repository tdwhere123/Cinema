/**
 * DISC SCENE / 光盘展架
 * 独立实现：全局倾斜展架 → 每张光盘位置组 → 可独立旋转的光盘组。
 * Three.js 与 CSS 两条显示路径消费同一份位置与交互状态。
 * CSS 是兼容路径，不代表 WebGL 材质验证通过。
 */
import {
  clamp,
  damp,
  easeOut,
  layout,
  untilt,
  fittedGalleryScale,
  projectGalleryPoint,
} from './math.js';
import { flightPose } from './entrance.js';
import {
  EFFECTS,
  outlinePoints,
  sweepProgress,
  makeImpulse,
  pushImpulse,
  clickImpulse,
  tickImpulse,
} from './disc-effects.js';
import * as THREE from '../vendor/three.module.js';

export function createDiscScene(
  host,
  items,
  {
    onSelect,
    onOpen,
    onReady = () => {},
    onProgress = () => {},
    onRendererChange = () => {},
    holdEntry = false,
    assetTimeout = 8000,
  },
) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer:fine)').matches;
  const abort = new AbortController();
  const signal = abort.signal;
  let selected = 0,
    target = 0,
    current = 0,
    previousPosition = 0,
    visible = true,
    destroyed = false;
  let start = null,
    dragged = false,
    spinIndex = -1,
    lastMove = null,
    hoverIndex = -1;
  let glide = 0,
    gliding = false,
    springing = false,
    springVelocity = 0,
    exitStarted = null,
    exitTimer = null,
    exitResolve = null,
    exitHandover = null,
    exitElapsed = 0,
    exitLastFrame = null,
    exitDuration = 550;
  let pointerPrevious = null;
  const effects = items.map(() => ({
    impulse: makeImpulse(),
    hovered: false,
    changedAt: 0,
    lastDraw: -1,
    canvas: null,
    context: null,
    texture: null,
  }));
  let mouse = { x: 0, y: 0 },
    smoothMouse = { x: 0, y: 0 };
  let renderer = null,
    world = null,
    camera = null,
    scene = null,
    discs = [];
  let fallback = null,
    cssWorld = null,
    cssDiscs = [];
  let frame = 0,
    lastTime = 0,
    birth = performance.now(),
    entryStarted = false,
    assetsReady = false,
    entryFloor = 0,
    preload = holdEntry ? 0 : null;
  let readyTimer = null,
    preloadRiseFrom = 3,
    preloadFloor = null;
  let mobile = innerWidth < 768,
    width = innerWidth,
    height = innerHeight;
  const galleryScale = () =>
    mobile ? fittedGalleryScale(width, height) : 1.08;
  const spins = items.map(() => ({ x: 0, y: 0, toX: 0, toY: 0, held: false }));
  const raycaster = new THREE.Raycaster();
  const resources = new Set();
  const own = (x) => (resources.add(x), x);
  let leadPose = { x: 0, y: 0.06, z: 0, scale: 0 };
  function anchor() {
    const scale = galleryScale(),
      rect = host.getBoundingClientRect();
    let pose = leadPose;
    if (preload !== null) {
      const rise = 1 - easeOut(preload),
        lift = untilt({
          x: 0,
          y: (-rise * preloadRiseFrom) / scale,
          z: (-rise * 0.7) / scale,
        });
      pose = { x: lift.x, y: 0.06 + lift.y, z: lift.z };
    }
    const center = projectGalleryPoint(pose, scale, width, height),
      radius = (mobile ? 1.5 : 1) * 0.8;
    const rim = projectGalleryPoint(
      { ...pose, x: pose.x + radius },
      scale,
      width,
      height,
    );
    return {
      x: center.x + rect.left,
      y: center.y + rect.top,
      r: Math.hypot(rim.x - center.x, rim.y - center.y),
      scale: leadPose.scale,
    };
  }

  function setPreloadFloor(bottom) {
    if (preload === null || preloadFloor === bottom) return;
    preloadFloor = bottom;
    const scale = galleryScale(),
      limit = bottom - host.getBoundingClientRect().top,
      radius = (mobile ? 1.5 : 1) * 0.8;
    let low = 0,
      high = 3;
    for (let i = 0; i < 14; i++) {
      const rise = (low + high) / 2,
        lift = untilt({ x: 0, y: -rise / scale, z: -0.7 / scale }),
        pose = { x: lift.x, y: 0.06 + lift.y, z: lift.z },
        center = projectGalleryPoint(pose, scale, width, height),
        rim = projectGalleryPoint(
          { ...pose, x: pose.x + radius },
          scale,
          width,
          height,
        );
      if (center.y + Math.hypot(rim.x - center.x, rim.y - center.y) > limit)
        high = rise;
      else low = rise;
    }
    preloadRiseFrom = low;
  }

  const add = (el, type, fn, options = {}) =>
    el.addEventListener(type, fn, { ...options, signal });
  let textureReady = Promise.resolve(),
    loadGeneration = 0;
  const loaded = new Set(),
    failed = new Set(),
    pendingImages = new Set();
  function reportAsset(index, ok = true) {
    if (destroyed || loaded.has(index)) return;
    loaded.add(index);
    if (!ok) failed.add(index);
    onProgress(loaded.size, items.length, { failed: failed.size });
  }
  function releaseGPU() {
    const old = renderer;
    renderer = null;
    resources.forEach((resource) => resource.dispose?.());
    resources.clear();
    effects.forEach((fx) => {
      fx.texture = null;
    });
    old?.dispose();
    old?.domElement.remove();
    discs = [];
    world = null;
    camera = null;
    scene = null;
  }
  function watchReady(promise) {
    const generation = ++loadGeneration;
    clearTimeout(readyTimer);
    let settled = false;
    const finish = () => {
      if (settled || destroyed || generation !== loadGeneration) return;
      settled = true;
      clearTimeout(readyTimer);
      assetsReady = true;
      if (preload === null) {
        birth = performance.now();
        entryStarted = true;
      }
      onReady();
    };
    readyTimer = setTimeout(finish, assetTimeout);
    promise.then(finish, finish);
  }
  function switchToFallback(reason) {
    if (destroyed || fallback) return;
    releaseGPU();
    buildFallback();
    resize();
    watchReady(textureReady);
    onRendererChange('css', reason);
  }

  function makeOutline(i) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    let ctx;
    try {
      ctx = canvas.getContext?.('2d');
    } catch {}
    if (!ctx) return null;
    canvas.className = 'disc-scribble';
    canvas.setAttribute('aria-hidden', 'true');
    effects[i].canvas = canvas;
    effects[i].context = ctx;
    return canvas;
  }
  function drawOutline(i, now, on) {
    const fx = effects[i];
    if (on !== fx.hovered) {
      fx.hovered = on;
      fx.changedAt = now;
    }
    if (!fx.context) return;
    const age = (now - fx.changedAt) / 1000,
      slot = Math.floor(now / 100);
    if (
      slot === fx.lastDraw ||
      (!on && age > 0.3 && fx.lastDraw > fx.changedAt / 100 + 3)
    )
      return;
    fx.lastDraw = slot;
    const ctx = fx.context;
    ctx.clearRect(0, 0, 512, 512);
    const amount = on
      ? reduced
        ? 1
        : sweepProgress(age)
      : reduced
        ? 0
        : age < 0.06
          ? 0.72
          : age < 0.12
            ? 0.5
            : age < 0.2
              ? 0.3
              : 0;
    if (amount) {
      ctx.strokeStyle = '#171717';
      ctx.lineWidth = EFFECTS.width * 220;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let ring = 0; ring < 2; ring++) {
        const points = outlinePoints(reduced ? 0 : slot, ring);
        ctx.beginPath();
        const end = Math.floor(EFFECTS.points * amount);
        for (let j = 0; j <= end; j++) {
          const p = points[j],
            x = 256 + p.x * 220,
            y = 256 + p.y * 220;
          j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
    }
    if (fx.texture) fx.texture.needsUpdate = true;
  }
  function buildFallback() {
    fallback = document.createElement('div');
    fallback.className = 'css-stage';
    cssWorld = document.createElement('div');
    cssWorld.className = 'css-world';
    fallback.append(cssWorld);
    items.forEach((film, i) => {
      const disc = document.createElement('div');
      disc.className = 'css-disc';
      disc.dataset.index = i;
      const spin = document.createElement('div');
      spin.className = 'css-spin';
      const face = document.createElement('div');
      face.className = 'css-face front';
      face.style.backgroundImage = `url('${film.art}')`;
      const back = document.createElement('div');
      back.className = 'css-face back';
      spin.append(face, back);
      disc.append(spin);
      const outline = makeOutline(i);
      if (outline) disc.append(outline);
      cssWorld.append(disc);
      cssDiscs.push({ disc, spin });
    });
    host.append(fallback);
    host.dataset.renderer = 'css';
    // CSS background-image has no load event. Preload the same URL explicitly, so
    // readiness represents real completed requests rather than a decorative timer.
    textureReady = Promise.all(
      items.map(
        (film, index) =>
          new Promise((resolve) => {
            const image = new Image();
            pendingImages.add(image);
            let settled = false;
            const finish = (ok) => {
              if (settled) return;
              settled = true;
              pendingImages.delete(image);
              image.onload = image.onerror = null;
              reportAsset(index, ok);
              resolve();
            };
            image.onload = () => finish(true);
            image.onerror = () => finish(false);
            image.src = film.art;
          }),
      ),
    );
  }
  function makeEnvironment() {
    // 自制摄影棚环境：深色上下边缘、宽亮条与冷色反射条。
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 512;
    const ctx = c.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, '#292c32');
    gradient.addColorStop(0.25, '#eeeae1');
    gradient.addColorStop(0.5, '#fefefe');
    gradient.addColorStop(0.7, '#b6c8d5');
    gradient.addColorStop(1, '#343941');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1024, 512);
    ctx.fillStyle = '#fff';
    ctx.fillRect(170, 60, 80, 330);
    ctx.fillRect(630, 90, 230, 230);
    const map = own(new THREE.CanvasTexture(c));
    map.mapping = THREE.EquirectangularReflectionMapping;
    map.colorSpace = THREE.SRGBColorSpace;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = own(pmrem.fromEquirectangular(map));
    scene.environment = env.texture;
    pmrem.dispose();
  }
  function discGeometry(inner, outer) {
    const g = own(new THREE.RingGeometry(inner, outer, 180));
    const uv = g.attributes.uv,
      p = g.attributes.position;
    for (let i = 0; i < uv.count; i++)
      uv.setXY(i, (p.getX(i) + 1) / 2, (p.getY(i) + 1) / 2);
    return g;
  }
  function backTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#aaa';
    ctx.fillRect(0, 0, 256, 256);
    for (let r = 12; r < 128; r += 0.75) {
      ctx.strokeStyle = r % 3 < 1 ? '#999' : '#bbb';
      ctx.beginPath();
      ctx.arc(128, 128, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    return own(new THREE.CanvasTexture(c));
  }

  try {
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.86;
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xffffff, 7, 14);
    camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 0, 4.4);
    world = new THREE.Group();
    world.rotation.set(-Math.PI / 6, -Math.PI / 6, 0);
    scene.add(world);
    scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    const key = new THREE.DirectionalLight(0xfff9e8, 0.75);
    key.position.set(3.5, -8, 5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.3);
    fill.position.set(-4, 3, 5);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0x499ff5, 0.75);
    rim.position.set(-3, 4, -2);
    scene.add(rim);
    makeEnvironment();
    const faceGeometry = discGeometry(0.24, 0.975),
      hubGeometry = discGeometry(0.075, 0.24),
      laser = backTexture();
    const pickGeometry = own(new THREE.CircleGeometry(1, 48));
    const pickMaterial = own(
      new THREE.MeshBasicMaterial({
        visible: false,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    const edgeGeometry = own(new THREE.TorusGeometry(0.99, 0.011, 8, 180));
    const edgeMaterial = own(
      new THREE.MeshPhysicalMaterial({
        color: 0xf0f4f6,
        metalness: 0.55,
        roughness: 0.04,
        clearcoat: 1,
      }),
    );
    const hubMaterial = own(
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transmission: 0.68,
        transparent: true,
        opacity: 0.85,
        roughness: 0.38,
        metalness: 0,
        ior: 2,
        side: THREE.DoubleSide,
      }),
    );
    const backMaterial = own(
      new THREE.MeshPhysicalMaterial({
        color: 0x1a1e2a,
        roughnessMap: laser,
        metalness: 1,
        roughness: 0.23,
        clearcoat: 0.34,
        clearcoatRoughness: 0.06,
        iridescence: 1,
        iridescenceIOR: 1.86,
        iridescenceThicknessRange: [140, 900],
      }),
    );
    const loading = [];
    const loader = new THREE.TextureLoader();
    discs = items.map((film, i) => {
      const group = new THREE.Group(),
        spin = new THREE.Group();
      group.add(spin);
      world.add(group);
      const frontMaterial = own(
        new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          metalness: 0.48,
          roughness: 0.42,
          clearcoat: 0.8,
          clearcoatRoughness: 0.2,
        }),
      );
      const requestRenderer = renderer;
      loading.push(
        new Promise((resolve) => {
          const texture = loader.load(
            film.art,
            (map) => {
              // A texture can finish after category navigation or context loss. Never
              // attach it to disposed materials or dereference the replacement renderer.
              if (destroyed || renderer !== requestRenderer) {
                map.dispose();
                resolve();
                return;
              }
              map.colorSpace = THREE.SRGBColorSpace;
              map.anisotropy = Math.min(
                8,
                requestRenderer.capabilities.getMaxAnisotropy(),
              );
              frontMaterial.map = map;
              frontMaterial.needsUpdate = true;
              reportAsset(i);
              resolve();
            },
            undefined,
            () => {
              if (renderer === requestRenderer) reportAsset(i, false);
              resolve();
            },
          );
          own(texture);
        }),
      );
      const front = new THREE.Mesh(faceGeometry, frontMaterial);
      front.position.z = 0.008;
      front.userData.index = i;
      const back = new THREE.Mesh(faceGeometry, backMaterial);
      back.position.z = -0.008;
      back.rotation.y = Math.PI;
      back.userData.index = i;
      const hub = new THREE.Mesh(hubGeometry, hubMaterial);
      hub.position.z = 0.01;
      const edge = new THREE.Mesh(edgeGeometry, edgeMaterial);
      spin.add(front, back, hub, edge);
      const inner = new THREE.Mesh(
        own(new THREE.TorusGeometry(0.075, 0.004, 5, 80)),
        edgeMaterial,
      );
      spin.add(inner);
      const outline = makeOutline(i);
      if (outline) {
        const texture = own(new THREE.CanvasTexture(outline));
        effects[i].texture = texture;
        const ink = own(
          new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
        );
        const plane = new THREE.Mesh(
          own(new THREE.PlaneGeometry(512 / 220, 512 / 220)),
          ink,
        );
        plane.position.z = 0.025;
        plane.renderOrder = 3;
        group.add(plane);
      }
      const pick = new THREE.Mesh(pickGeometry, pickMaterial);
      pick.userData.index = i;
      group.add(pick);
      return { group, spin, front, back, pick };
    });
    textureReady = Promise.all(loading);
    host.append(renderer.domElement);
    host.dataset.renderer = 'webgl';
    add(renderer.domElement, 'webglcontextlost', (event) => {
      event.preventDefault();
      switchToFallback('context-lost');
    });
  } catch (error) {
    releaseGPU();
    console.warn(
      'WebGL unavailable: using CSS compatibility renderer.',
      error.message,
    );
    buildFallback();
  }

  function resize() {
    preloadFloor = null;
    width = host.clientWidth || innerWidth;
    height = host.clientHeight || innerHeight;
    mobile = width < 768;
    if (renderer) {
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      world.scale.setScalar(galleryScale());
    }
    if (fallback) {
      const focal = height / (2 * Math.tan(Math.PI / 9));
      fallback.style.perspective = `${focal}px`;
      cssWorld.style.setProperty(
        '--diameter',
        `${(height / (Math.tan(Math.PI / 9) * 4.4)) * galleryScale()}px`,
      );
    }
  }
  function point(event) {
    const rect = host.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
      y: (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    };
  }
  function hit(event) {
    if (!renderer) {
      const el = event.target.closest?.('.css-disc');
      return el ? Number(el.dataset.index) : -1;
    }
    const p = point(event);
    raycaster.setFromCamera(p, camera);
    const h = raycaster.intersectObjects(
      discs.filter((d) => d.group.visible).map((d) => d.pick),
      false,
    )[0];
    return h?.object.userData.index ?? -1;
  }
  function setIndex(value, immediate = false) {
    target = clamp(value, 0, items.length - 1);
    selected = Math.round(target);
    if (immediate) current = target;
    spins.forEach((s, i) => {
      if (i !== selected) {
        s.toX = 0;
        s.toY = 0;
      }
    });
    host.dataset.activeIndex = selected;
  }
  function stepTo(value) {
    gliding = false;
    springing = false;
    glide = 0;
    setIndex(value);
    onSelect(selected);
  }
  function flip() {
    const s = spins[selected];
    s.toY = Math.abs(s.toY) > Math.PI / 2 ? 0 : Math.PI;
    s.toX = 0;
  }
  add(host, 'pointerdown', (event) => {
    if (
      exitStarted !== null ||
      preload !== null ||
      event.button !== 0 ||
      event.target.closest('a,button')
    )
      return;
    const h = hit(event);
    gliding = false;
    springing = false;
    glide = 0;
    start = {
      x: event.clientX,
      y: event.clientY,
      target,
      time: performance.now(),
      hit: h,
      touch: event.pointerType !== 'mouse',
    };
    lastMove = { x: event.clientX, y: event.clientY, time: performance.now() };
    dragged = false;
    spinIndex = event.pointerType === 'mouse' && h === selected ? h : -1;
    if (spinIndex >= 0) spins[spinIndex].held = true;
    host.setPointerCapture(event.pointerId);
  });
  add(host, 'pointermove', (event) => {
    mouse = point(event);
    const previousHover = hoverIndex;
    hoverIndex = hit(event);
    const pointerNow = performance.now();
    if (
      finePointer &&
      !start &&
      !reduced &&
      hoverIndex >= 0 &&
      hoverIndex !== previousHover &&
      pointerPrevious
    ) {
      const elapsed = Math.max(8, pointerNow - pointerPrevious.time);
      pushImpulse(
        effects[hoverIndex].impulse,
        ((event.clientX - pointerPrevious.x) * 16.667) / elapsed,
        ((event.clientY - pointerPrevious.y) * 16.667) / elapsed,
      );
    }
    pointerPrevious = { x: event.clientX, y: event.clientY, time: pointerNow };
    host.style.cursor = start
      ? 'grabbing'
      : hoverIndex >= 0
        ? 'pointer'
        : 'grab';
    if (!start) return;
    const dx = event.clientX - start.x,
      dy = event.clientY - start.y;
    if (!dragged && Math.hypot(dx, dy) > 5) {
      dragged = true;
      if (start.touch) {
        start.x = event.clientX;
        start.target = target;
        lastMove = {
          x: event.clientX,
          y: event.clientY,
          time: performance.now(),
        };
      }
    }
    if (dragged) {
      if (spinIndex >= 0) {
        const s = spins[spinIndex];
        s.toY = clamp(
          s.toY + (event.clientX - lastMove.x) * 0.004275,
          -Math.PI,
          Math.PI,
        );
        s.toX = clamp(
          s.toX + (event.clientY - lastMove.y) * 0.004275,
          -Math.PI,
          Math.PI,
        );
      } else {
        const now = performance.now(),
          elapsed = Math.max(1, now - lastMove.time),
          sensitivity = mobile ? 2 : 5.7;
        const velocity = clamp(
          ((-(event.clientX - lastMove.x) / width) * sensitivity * 16.667) /
            elapsed,
          -0.5,
          0.5,
        );
        glide += (velocity - glide) * 0.32;
        target = clamp(
          start.target - ((event.clientX - start.x) / width) * sensitivity,
          0,
          items.length - 1,
        );
      }
    }
    lastMove = { x: event.clientX, y: event.clientY, time: performance.now() };
  });
  function release(event, cancel = false) {
    if (!start) return;
    const wasDragged = dragged,
      wasSpin = spinIndex >= 0;
    const startedOn = start.hit,
      touch = start.touch;
    start = null;
    if (wasSpin) {
      const s = spins[spinIndex];
      s.held = false;
      s.toX = 0;
      s.toY = 0;
      spinIndex = -1;
    } else if (wasDragged) {
      if (cancel) stepTo(Math.round(target));
      else if (touch) {
        const next =
          Math.abs(glide) >= 0.035
            ? glide > 0
              ? Math.floor(target) + 1
              : Math.ceil(target) - 1
            : Math.round(target);
        stepTo(next);
      } else {
        gliding = true;
        springing = false;
      }
    }
    if (!cancel && !wasDragged) {
      const h = hit(event);
      if (h === selected && h === startedOn) {
        clickImpulse(effects[selected].impulse, mouse.x, mouse.y);
        onOpen();
      } else if (h >= 0) stepTo(h);
    }
    host.style.cursor = 'grab';
  }
  add(host, 'pointerup', (e) => release(e));
  add(host, 'pointercancel', (e) => release(e, true));
  add(host, 'lostpointercapture', (e) => {
    if (start) release(e, true);
  });
  add(host, 'pointerleave', () => {
    hoverIndex = -1;
    pointerPrevious = null;
    mouse = { x: 0, y: 0 };
  });
  let wheelLast = 0,
    wheelMagnitude = 0,
    wheelTime = 0,
    wheelAccum = 0;
  add(
    host,
    'wheel',
    (e) => {
      if (
        exitStarted !== null ||
        preload !== null ||
        !visible ||
        document.querySelector('dialog[open]') ||
        document.documentElement.dataset.indexOpen === 'true'
      )
        return;
      if (e.ctrlKey) return;
      e.preventDefault();
      const delta =
        (Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX) *
        (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? height : 1);
      const now = performance.now(),
        gap = now - wheelTime;
      wheelTime = now;
      if (gap > 140) wheelAccum = 0;
      wheelAccum += Math.abs(delta);
      const fresh = gap > 140;
      const surge = Math.abs(delta) > wheelMagnitude * 1.25;
      wheelMagnitude = Math.max(
        Math.abs(delta),
        wheelMagnitude * Math.exp(-gap / 300),
      );
      if (
        wheelAccum > 6 &&
        (fresh || now - wheelLast > 420 || (surge && now - wheelLast > 190))
      ) {
        wheelLast = now;
        wheelAccum = 0;
        stepTo(selected + Math.sign(delta));
      }
    },
    { passive: false },
  );
  add(host, 'keydown', (e) => {
    if (exitStarted !== null || preload !== null) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      stepTo(selected + (e.key === 'ArrowRight' ? 1 : -1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      stepTo(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      stepTo(items.length - 1);
    } else if (e.key === ' ') {
      e.preventDefault();
      flip();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      clickImpulse(effects[selected].impulse, 0, 0);
      onOpen();
    }
  });
  function animate(now) {
    frame = requestAnimationFrame(animate);
    const dt = Math.min(0.05, (now - lastTime) / 1000 || 0.016);
    lastTime = now;
    if (destroyed || !visible || document.hidden) return;
    if (exitStarted !== null && exitResolve) {
      exitElapsed +=
        exitLastFrame === null ? 0 : clamp(now - exitLastFrame, 0, 100);
      exitLastFrame = now;
      if (exitHandover && exitElapsed >= Math.min(670, 280 + exitDuration)) {
        const handover = exitHandover;
        exitHandover = null;
        handover();
      }
      if (exitElapsed >= 280 + exitDuration) finishExit();
    }
    if (gliding && !start) {
      if (!springing) {
        target = clamp(target + glide * dt * 60, 0, items.length - 1);
        glide *= Math.pow(0.89, dt * 60);
        if (
          Math.abs(glide) < 0.0004 ||
          target === 0 ||
          target === items.length - 1
        ) {
          springing = true;
          springVelocity = 0;
        }
      } else {
        const nearest = Math.round(target);
        springVelocity += (nearest - target) * 9.5 ** 2 * dt;
        springVelocity *= Math.exp(-12 * dt);
        target = clamp(target + springVelocity * dt, 0, items.length - 1);
        if (
          Math.abs(nearest - target) < 0.0001 &&
          Math.abs(springVelocity) < 0.001
        ) {
          target = nearest;
          gliding = false;
          springing = false;
        }
      }
      const nearest = Math.round(target);
      if (nearest !== selected) {
        selected = nearest;
        host.dataset.activeIndex = selected;
        onSelect(selected);
      }
    }
    current = reduced ? target : damp(current, target, start ? 15 : 10, dt);
    smoothMouse.x = damp(smoothMouse.x, mouse.x, 9, dt);
    smoothMouse.y = damp(smoothMouse.y, mouse.y, 9, dt);
    const motion = (current - previousPosition) / Math.max(dt, 0.001);
    previousPosition = current;
    const flow = clamp(motion * 0.025, -0.2, 0.2);
    const age = entryStarted ? now - birth : 0;
    const base = (height / (2 * Math.tan(Math.PI / 9) * 4.4)) * galleryScale();
    items.forEach((film, i) => {
      const d = i - current,
        p = layout(d, mobile),
        active = i === selected;
      if (mobile && active) p.y += 0.06;
      const pose = flightPose(age, d, { reduced });
      const reveal =
        preload !== null
          ? active
            ? Math.max(0.001, easeOut(preload / 0.3)) * 0.8
            : 0
          : active
            ? entryFloor + (1 - entryFloor) * pose.scale
            : pose.scale;
      const spin = spins[i];
      spin.x = damp(spin.x, spin.toX, spin.held ? 25 : 4.5, dt);
      spin.y = damp(spin.y, spin.toY, spin.held ? 25 : 4.5, dt);
      const fx = effects[i];
      tickImpulse(fx.impulse, dt, start?.hit === i, reduced);
      const force = fx.impulse;
      drawOutline(
        i,
        now,
        active &&
          exitStarted === null &&
          (hoverIndex === i || document.activeElement === host),
      );
      const outgoing = flightPose(exitElapsed, d, {
        exit: true,
        reduced,
        exitDuration,
      });
      const exit =
        exitStarted === null ? { scale: 1, depth: 0, turn: 0 } : outgoing;
      const rise = preload !== null && active ? 1 - easeOut(preload) : 0;
      const lift = untilt({
        x: 0,
        y: (-rise * preloadRiseFrom) / galleryScale(),
        z: (-rise * 0.7) / galleryScale(),
      });
      const scale = p.scale * reveal * exit.scale;
      const x = p.x + force.x + lift.x,
        y = p.y + force.y + lift.y,
        z =
          p.z +
          force.z -
          force.press * 0.018 +
          (preload !== null ? 0 : pose.depth) +
          exit.depth +
          lift.z;
      const rx = force.rx + (hoverIndex === i ? smoothMouse.y * 0.21 : 0);
      const ry =
        p.ry + flow + force.ry + (hoverIndex === i ? smoothMouse.x * 0.21 : 0);
      const rz = -flow * 0.3;
      if (active) leadPose = { x, y, z, scale };
      if (renderer) {
        const disc = discs[i];
        disc.group.visible = Math.abs(d) < 5 && reveal > 0.002;
        disc.group.position.set(x, y, z);
        disc.group.scale.setScalar(scale);
        disc.group.rotation.set(rx, ry, rz);
        disc.spin.rotation.set(
          spin.x,
          spin.y +
            (preload !== null && active ? (-(1 - preload) * Math.PI) / 2 : 0) +
            exit.turn,
          rise * 0.7,
        );
      } else {
        const { disc, spin: node } = cssDiscs[i];
        disc.style.visibility =
          Math.abs(d) < 4 && reveal > 0.002 ? 'visible' : 'hidden';
        disc.style.transform = `translate3d(${x * base}px,${-y * base}px,${z * base}px) rotateX(${-rx}rad) rotateY(${ry}rad) rotateZ(${-rz}rad) scale(${scale})`;
        node.style.transform = `rotateX(${-spin.x}rad) rotateY(${spin.y + (preload !== null && active ? (-(1 - preload) * Math.PI) / 2 : 0) + exit.turn}rad)`;
        disc.classList.toggle('active', active);
      }
    });
    // Between a lost context and its event, a first draw would compile shaders against a dead
    // context, and Three.js throws reading their (null) info log.
    if (renderer && !renderer.getContext().isContextLost())
      renderer.render(scene, camera);
  }
  queueMicrotask(() => {
    if (!destroyed)
      onProgress(loaded.size, items.length, { failed: failed.size });
  });
  watchReady(textureReady);
  resize();
  add(window, 'resize', resize);
  frame = requestAnimationFrame(animate);
  function finishExit() {
    clearTimeout(exitTimer);
    exitTimer = null;
    exitHandover = null;
    const resolve = exitResolve;
    exitResolve = null;
    resolve?.();
  }
  function cancelExit() {
    finishExit();
    exitStarted = null;
    exitElapsed = 0;
    exitLastFrame = null;
  }

  return {
    anchor,
    setPreloadFloor,
    setIndex,
    flip,
    resize,
    stepTo,
    setVisible(value) {
      visible = value;
      if (value) resize();
    },
    cancelExit,
    exit({ duration = 550, onHandover } = {}) {
      cancelExit();
      gliding = false;
      exitDuration = duration;
      exitStarted = performance.now();
      exitHandover = onHandover;
      return new Promise((resolve) => {
        exitResolve = resolve;
        exitTimer = setTimeout(
          () => {
            const handover = exitHandover;
            exitHandover = null;
            if (!destroyed) handover?.();
            finishExit();
          },
          reduced ? 0 : 6000,
        );
      });
    },
    setPreload(value) {
      if (preload !== null) preload = value;
    },
    releasePreload() {
      if (preload === null) return;
      preload = null;
      entryFloor = 0.8;
      birth = performance.now();
      entryStarted = true;
    },
    restartEntry() {
      exitStarted = null;
      entryFloor = 0;
      if (assetsReady && preload === null) {
        birth = performance.now();
        entryStarted = true;
      }
    },
    get rendererType() {
      return renderer ? 'webgl' : 'css';
    },
    get selected() {
      return selected;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      clearTimeout(readyTimer);
      cancelExit();
      loadGeneration++;
      abort.abort();
      cancelAnimationFrame(frame);
      pendingImages.forEach((image) => {
        image.onload = image.onerror = null;
        image.removeAttribute('src');
      });
      pendingImages.clear();
      releaseGPU();
      host.replaceChildren();
    },
  };
}
