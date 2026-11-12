import * as THREE from '../vendor/three.module.js';
/**
 * Folded-poster reveal (origami logic), independently implemented.
 * At rest the poster is a letter-folded packet showing its blank back: top third folded
 * down, bottom third folded up, then folded in half. Hovering (or focusing / tapping) opens
 * the folds last-first; leaving folds it back up. Each fold rigidly rotates one side of its
 * crease about the crease's current position, with a little paper thickness so layers stack.
 * The camera maps z = 0 onto CSS pixels 1:1, so the open sheet lands exactly on the DOM
 * poster, which is shown only while the paper is fully open and still.
 */
const MARGIN = 0.18;

/** Letter fold in sheet px (origin at centre, y up). Valley folds towards the viewer. */
export function foldPlan(h) {
  return [
    {
      x: 0,
      y: h / 6,
      dx: 1,
      dy: 0,
      angle: Math.PI * 0.99,
      lift: 1.6,
      open: [0.52, 1],
    },
    {
      x: 0,
      y: -h / 6,
      dx: -1,
      dy: 0,
      angle: Math.PI * 0.985,
      lift: 3,
      open: [0.3, 0.82],
    },
    {
      x: 0,
      y: 0,
      dx: 0,
      dy: -1,
      angle: Math.PI * 0.975,
      lift: 7,
      open: [0, 0.55],
    },
  ];
}

const side = (f, x, y) => f.dx * (y - f.y) - f.dy * (x - f.x) > 0;

function rotateAbout(out, p, a, axis, angle) {
  const vx = p[0] - a[0],
    vy = p[1] - a[1],
    vz = p[2] - a[2];
  const c = Math.cos(angle),
    s = Math.sin(angle),
    [kx, ky, kz] = axis,
    dot = kx * vx + ky * vy + kz * vz;
  out[0] = a[0] + vx * c + (ky * vz - kz * vy) * s + kx * dot * (1 - c);
  out[1] = a[1] + vy * c + (kz * vx - kx * vz) * s + ky * dot * (1 - c);
  out[2] = a[2] + vz * c + (kx * vy - ky * vx) * s + kz * dot * (1 - c);
}

/** Positions of every rest point (sheet px) for the given per-fold amounts in [0, 1]. */
export function foldPositions(rest, folds, amounts, out) {
  const axes = folds.map(() => ({ a: [0, 0, 0], b: [0, 0, 0], k: [0, 0, 1] }));
  const tmp = [0, 0, 0];
  const carry = (x, y, upto, target) => {
    target[0] = x;
    target[1] = y;
    target[2] = 0;
    for (let j = 0; j < upto; j++) {
      if (!amounts[j] || !side(folds[j], x, y)) continue;
      rotateAbout(
        tmp,
        target,
        axes[j].a,
        axes[j].k,
        folds[j].angle * amounts[j],
      );
      target[0] = tmp[0];
      target[1] = tmp[1];
      target[2] = tmp[2] + folds[j].lift * amounts[j];
    }
  };
  folds.forEach((f, k) => {
    carry(f.x - f.dx * 0.5, f.y - f.dy * 0.5, k, axes[k].a);
    carry(f.x + f.dx * 0.5, f.y + f.dy * 0.5, k, axes[k].b);
    const ax = axes[k].b[0] - axes[k].a[0],
      ay = axes[k].b[1] - axes[k].a[1],
      az = axes[k].b[2] - axes[k].a[2],
      len = Math.hypot(ax, ay, az) || 1;
    axes[k].k = [ax / len, ay / len, az / len];
  });
  const p = [0, 0, 0];
  for (let i = 0; i < rest.length; i++) {
    carry(rest[i][0], rest[i][1], folds.length, p);
    out[i * 3] = p[0];
    out[i * 3 + 1] = p[1];
    out[i * 3 + 2] = p[2];
  }
  return out;
}

/** Fold amounts for overall openness u in [0, 1]: the half fold opens first, the top third last. */
export function amountsFor(folds, u) {
  return folds.map(({ open: [a, b] }) => {
    const t = Math.max(0, Math.min(1, (u - a) / (b - a)));
    return 1 - t * t * (3 - 2 * t);
  });
}

// Creases fall exactly on grid lines (x = 0, y = ±h/6) so every fold edge stays sharp.
function buildSheet(w, h) {
  const nx = 24,
    ny = 36,
    rest = [],
    index = [];
  for (let j = 0; j <= ny; j++)
    for (let i = 0; i <= nx; i++)
      rest.push([(i / nx - 0.5) * w, (j / ny - 0.5) * h]);
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i,
        b = a + 1,
        c = a + nx + 1,
        d = c + 1;
      index.push(a, b, d, a, d, c);
    }
  return { rest, index };
}

function drawCreases(canvas, w, h, folds) {
  const ratio = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(w * ratio);
  canvas.height = Math.round(h * ratio);
  const ctx = canvas.getContext?.('2d');
  if (!ctx) return;
  ctx.scale(ratio, ratio);
  for (const f of folds) {
    const vertical = f.dx === 0,
      at = vertical ? w / 2 + f.x : h / 2 - f.y,
      length = vertical ? h : w;
    for (const [offset, colour, width] of [
      [-1.2, 'rgba(255,255,250,0.55)', 1.6],
      [0.6, 'rgba(20,16,10,0.42)', 1],
      [4, 'rgba(20,16,10,0.08)', 7],
    ]) {
      ctx.strokeStyle = colour;
      ctx.lineWidth = width;
      ctx.beginPath();
      if (vertical) {
        ctx.moveTo(at + offset, 0);
        ctx.lineTo(at + offset, length);
      } else {
        ctx.moveTo(0, at + offset);
        ctx.lineTo(length, at + offset);
      }
      ctx.stroke();
    }
  }
}

export function mountPaperReveal(section, { reduced = false } = {}) {
  if (!section) return () => {};
  const image = section.querySelector('.full-poster');
  if (!image) return () => {};
  const link = image.parentElement;
  link.classList.add('paper-stage');
  const finish = document.createElement('span');
  finish.className = 'paper-finish';
  finish.setAttribute('aria-hidden', 'true');
  const creaseCanvas = document.createElement('canvas');
  finish.append(creaseCanvas);
  link.append(finish);
  const shadow = document.createElement('span');
  shadow.className = 'paper-shadow';
  shadow.setAttribute('aria-hidden', 'true');
  link.prepend(shadow);
  const abort = new AbortController(),
    signal = abort.signal;
  let disposed = false,
    stage = null,
    preparing = null,
    frame = 0,
    last = 0,
    open = 0,
    velocity = 0,
    target = 0;
  const setState = (s) => (section.dataset.paper = s);
  setState(reduced ? 'complete' : 'folded');

  function paintFinish() {
    const w = image.clientWidth,
      h = image.clientHeight;
    if (w && h) drawCreases(creaseCanvas, w, h, foldPlan(h));
  }
  function release() {
    cancelAnimationFrame(frame);
    frame = 0;
    if (!stage) return;
    stage.renderer.dispose();
    stage.renderer.domElement.remove();
    stage.geometry.dispose();
    stage.materials.forEach((m) => m.dispose());
    stage.texture.dispose();
    stage = null;
    image.style.removeProperty('visibility');
    shadow.style.cssText = '';
  }
  function prepare() {
    preparing ??= build().finally(() => (preparing = null));
    return preparing;
  }
  async function build() {
    if (stage || disposed) return;
    try {
      await image.decode();
    } catch {
      return;
    }
    const w = image.clientWidth,
      h = image.clientHeight;
    if (disposed || stage || !w || !h) return;
    paintFinish();
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'low-power',
      });
    } catch {
      return;
    }
    const cw = Math.round(w * (1 + 2 * MARGIN)),
      ch = Math.round(h * (1 + 2 * MARGIN));
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
    renderer.setSize(cw, ch, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const canvas = renderer.domElement;
    canvas.className = 'paper-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = `left:${-MARGIN * 100}%;top:${-MARGIN * 100}%;width:${(1 + 2 * MARGIN) * 100}%;height:${(1 + 2 * MARGIN) * 100}%`;
    link.append(canvas);
    const distance = h * 2.6;
    const camera = new THREE.PerspectiveCamera(
      THREE.MathUtils.radToDeg(2 * Math.atan(ch / 2 / distance)),
      cw / ch,
      1,
      distance * 3,
    );
    camera.position.set(0, 0, distance);
    const scene = new THREE.Scene();
    const { rest, index } = buildSheet(w, h);
    const positions = new Float32Array(rest.length * 3),
      flat = new Float32Array(index.length * 3),
      uv = new Float32Array(index.length * 2);
    index.forEach((v, i) => {
      uv[i * 2] = rest[v][0] / w + 0.5;
      uv[i * 2 + 1] = rest[v][1] / h + 0.5;
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(flat, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    // Uploading the <img> directly yields a black texture in some WebGL paths; a canvas copy is reliable.
    const scale = Math.min(
        1,
        1536 / Math.max(image.naturalWidth, image.naturalHeight),
      ),
      print = document.createElement('canvas');
    print.width = Math.round(image.naturalWidth * scale);
    print.height = Math.round(image.naturalHeight * scale);
    print.getContext('2d').drawImage(image, 0, 0, print.width, print.height);
    const texture = new THREE.CanvasTexture(print);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const front = new THREE.MeshStandardMaterial({
      map: texture,
      flatShading: true,
      roughness: 0.85,
      metalness: 0,
      side: THREE.FrontSide,
    });
    const back = new THREE.MeshStandardMaterial({
      color: 0xf1ece2,
      flatShading: true,
      roughness: 0.92,
      metalness: 0,
      side: THREE.BackSide,
    });
    const sheet = new THREE.Group();
    sheet.add(new THREE.Mesh(geometry, front), new THREE.Mesh(geometry, back));
    scene.add(sheet);
    scene.add(new THREE.HemisphereLight(0xfffaf0, 0xc9c1b2, 2.2));
    const key = new THREE.DirectionalLight(0xfff3e2, 1.1);
    key.position.set(-0.6, 0.9, 1).multiplyScalar(distance);
    scene.add(key);
    stage = {
      renderer,
      geometry,
      materials: [front, back],
      texture,
      scene,
      camera,
      sheet,
      rest,
      index,
      positions,
      flat,
      folds: foldPlan(h),
      w,
      h,
    };
    wake();
  }
  function draw(now) {
    const s = stage;
    const amounts = amountsFor(s.folds, Math.max(0, Math.min(1, open)));
    foldPositions(s.rest, s.folds, amounts, s.positions);
    s.index.forEach((v, i) => {
      s.flat[i * 3] = s.positions[v * 3];
      s.flat[i * 3 + 1] = s.positions[v * 3 + 1];
      s.flat[i * 3 + 2] = s.positions[v * 3 + 2];
    });
    s.geometry.attributes.position.needsUpdate = true;
    s.geometry.computeBoundingBox();
    const box = s.geometry.boundingBox,
      closed = 1 - Math.max(0, Math.min(1, open)),
      hover = target ? 1 : 0,
      lift =
        closed * (18 + hover * 10) +
        Math.sin(Math.PI * Math.min(1, open)) * s.h * 0.05,
      idle = now / 1000;
    // The folded packet is centred on the poster's slot; the open sheet sits exactly on it.
    s.sheet.position.set(
      -(box.min.x + box.max.x) * 0.5 * closed,
      -(box.min.y + box.max.y) * 0.5 * closed,
      lift,
    );
    s.sheet.rotation.set(
      closed * (0.16 + Math.sin(idle * 0.8) * 0.02),
      closed * (-0.22 + Math.cos(idle * 0.6) * 0.025),
      closed * -0.05,
    );
    const footW = (box.max.x - box.min.x) * 0.94,
      footH = (box.max.y - box.min.y) * 0.94;
    shadow.style.cssText = `width:${footW}px;height:${footH}px;transform:translate(-50%,-50%) translate(${lift * 0.4}px,${lift * 0.7}px);filter:blur(${5 + lift * 0.35}px);opacity:${0.34 - Math.min(0.14, lift / 300)}`;
    if (!s.renderer.getContext().isContextLost())
      s.renderer.render(s.scene, s.camera);
  }
  function tick(now) {
    frame = 0;
    if (disposed || !stage) return;
    const dt = Math.min(0.05, (now - (last || now)) / 1000) || 1 / 60;
    last = now;
    // Slightly underdamped spring: interruptible, with a small settle at the end.
    const stiffness = 26,
      damping = 9;
    velocity += ((target - open) * stiffness - velocity * damping) * dt;
    open += velocity * dt;
    const settled =
      Math.abs(target - open) < 0.002 && Math.abs(velocity) < 0.002;
    if (settled) {
      open = target;
      velocity = 0;
    }
    const flatOpen = settled && target === 1;
    stage.renderer.domElement.style.visibility = flatOpen ? 'hidden' : '';
    image.style.visibility = flatOpen ? '' : 'hidden';
    setState(
      flatOpen
        ? 'complete'
        : target === 1
          ? 'unfolding'
          : open > 0.002
            ? 'folding'
            : 'folded',
    );
    if (!flatOpen) draw(now);
    else shadow.style.cssText = '';
    if (!flatOpen) frame = requestAnimationFrame(tick);
  }
  function wake() {
    if (!frame && stage && !disposed) {
      last = 0;
      frame = requestAnimationFrame(tick);
    }
  }
  function setOpen(value) {
    target = value ? 1 : 0;
    if (!stage) void prepare().then(wake);
    else wake();
  }

  if (reduced) {
    requestAnimationFrame(paintFinish);
    return () => {
      disposed = true;
      finish.remove();
      shadow.remove();
    };
  }
  link.addEventListener(
    'pointerenter',
    (e) => {
      if (e.pointerType === 'mouse') setOpen(true);
    },
    { signal },
  );
  link.addEventListener(
    'pointerleave',
    (e) => {
      if (e.pointerType === 'mouse') setOpen(false);
    },
    { signal },
  );
  link.addEventListener('focus', () => setOpen(true), { signal });
  link.addEventListener('blur', () => setOpen(false), { signal });
  // Touch: the first tap opens the poster; a tap on the open poster follows the link.
  link.addEventListener(
    'click',
    (e) => {
      if (section.dataset.paper === 'complete') return;
      e.preventDefault();
      setOpen(true);
    },
    { signal },
  );
  link.addEventListener(
    'pointermove',
    (e) => {
      const r = link.getBoundingClientRect();
      if (!r.width) return;
      link.style.setProperty(
        '--paper-lx',
        `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`,
      );
      link.style.setProperty(
        '--paper-ly',
        `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`,
      );
    },
    { signal, passive: true },
  );
  const near = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          if (!stage) {
            image.style.visibility = 'hidden';
            void prepare();
          }
        } else if (stage) {
          release();
          open = target = velocity = 0;
          setState('folded');
        }
      }
    },
    { rootMargin: '80% 0px' },
  );
  near.observe(link);
  return () => {
    disposed = true;
    abort.abort();
    near.disconnect();
    release();
    finish.remove();
    shadow.remove();
  };
}
