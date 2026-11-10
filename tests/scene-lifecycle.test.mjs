/** CSS lifecycle unit harness. This is not a WebGL rendering test. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const path = new URL('../src/scene.js', import.meta.url);
let source = await readFile(path, 'utf8');
source = source.replace(
  "from './entrance.js'",
  `from '${new URL('../src/entrance.js', import.meta.url)}'`,
);
source = source.replace(
  "from './disc-effects.js'",
  `from '${new URL('../src/disc-effects.js', import.meta.url)}'`,
);
source = source.replace(
  "from './math.js'",
  `from '${new URL('../src/math.js', import.meta.url)}'`,
);
source = source.replace(
  "import * as THREE from '../vendor/three.module.js';",
  `const THREE={Raycaster:class{},Vector3:class{},WebGLRenderer:class{constructor(){throw new Error('unit-test CSS path')}}};`,
);
const { createDiscScene } = await import(
  'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
);
class Element extends EventTarget {
  constructor() {
    super();
    this.style = { setProperty() {} };
    this.dataset = {};
    this.children = [];
    this.clientWidth = 1180;
    this.clientHeight = 757;
    this.classList = { toggle() {} };
  }
  append(...children) {
    this.children.push(...children);
  }
  replaceChildren(...children) {
    this.children = children;
  }
  remove() {}
  closest() {
    return null;
  }
  setPointerCapture() {}
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 1180, height: 757 };
  }
}
const images = [];
class TestImage {
  constructor() {
    images.push(this);
  }
  removeAttribute(name) {
    if (name === 'src') this.src = '';
  }
}
function install() {
  images.length = 0;
  globalThis.matchMedia = () => ({ matches: false });
  globalThis.innerWidth = 1180;
  globalThis.innerHeight = 757;
  globalThis.document = { createElement: () => new Element(), hidden: false };
  globalThis.window = new Element();
  globalThis.Image = TestImage;
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
}
const flush = () => new Promise((resolve) => setImmediate(resolve));
test('CSS readiness waits for all actual image load/error completions', async () => {
  install();
  const progress = [],
    host = new Element();
  let ready = 0;
  const scene = createDiscScene(
    host,
    [{ art: '/a.webp' }, { art: '/b.webp' }],
    {
      onSelect() {},
      onOpen() {},
      onProgress: (...args) => progress.push(args),
      onReady: () => ready++,
    },
  );
  await flush();
  assert.equal(ready, 0);
  assert.equal(images.length, 2);
  assert.deepEqual(progress[0], [0, 2, { failed: 0 }]);
  images[0].onload();
  await flush();
  assert.equal(ready, 0);
  assert.equal(progress.at(-1)[0], 1);
  images[1].onerror();
  await flush();
  assert.equal(ready, 1);
  assert.deepEqual(progress.at(-1), [2, 2, { failed: 1 }]);
  assert.equal(scene.rendererType, 'css');
  scene.destroy();
});
test('destroy cancels pending images and suppresses stale callbacks', async () => {
  install();
  const host = new Element();
  let ready = 0,
    progress = 0;
  const scene = createDiscScene(host, [{ art: '/a.webp' }], {
    onSelect() {},
    onOpen() {},
    onProgress: () => progress++,
    onReady: () => ready++,
  });
  const lateLoad = images[0].onload;
  scene.destroy();
  scene.destroy();
  lateLoad();
  await flush();
  assert.equal(ready, 0);
  assert.equal(progress, 0);
  assert.equal(images[0].onload, null);
  assert.equal(images[0].src, '');
  assert.equal(host.children.length, 0);
});
test('pending exit resolves on destroy, with no delayed readiness', async () => {
  install();
  const host = new Element();
  let ready = 0;
  const scene = createDiscScene(host, [{ art: '/a.webp' }], {
    onSelect() {},
    onOpen() {},
    onReady: () => ready++,
  });
  const exit = scene.exit();
  scene.destroy();
  await exit;
  assert.equal(ready, 0);
  assert.equal(host.children.length, 0);
});

test('desktop release continues into inertia and settles within catalogue bounds', async () => {
  install();
  let tick;
  globalThis.requestAnimationFrame = (fn) => ((tick = fn), 1);
  const host = new Element(),
    items = Array.from({ length: 4 }, (_, i) => ({ art: `/${i}.webp` }));
  let changed = [];
  const scene = createDiscScene(host, items, {
    onSelect: (i) => changed.push(i),
    onOpen() {},
  });
  for (const image of [...images]) image.onload();
  await flush();
  function pointer(type, x) {
    const event = new Event(type);
    Object.assign(event, {
      button: 0,
      pointerType: 'mouse',
      pointerId: 1,
      clientX: x,
      clientY: 350,
    });
    host.dispatchEvent(event);
  }
  pointer('pointerdown', 600);
  pointer('pointermove', 300);
  pointer('pointerup', 300);
  let now = performance.now();
  for (let i = 0; i < 600; i++) {
    now += 1000 / 60;
    tick(now);
  }
  assert.ok(changed.length > 0);
  assert.ok(scene.selected >= 1 && scene.selected <= 3);
  assert.equal(Number(host.dataset.activeIndex), scene.selected);
  scene.destroy();
});

test('stalled asset readiness has a bounded deadline and ignores late completion', async () => {
  install();
  let ready = 0;
  const scene = createDiscScene(new Element(), [{ art: '/stall.webp' }], {
    onSelect() {},
    onOpen() {},
    assetTimeout: 10,
    onReady: () => ready++,
  });
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(ready, 1);
  images[0].onload();
  await flush();
  assert.equal(ready, 1);
  scene.destroy();
});

test('held entrance does not restart while assets are pending', async () => {
  install();
  let tick;
  globalThis.requestAnimationFrame = (fn) => ((tick = fn), 1);
  const host = new Element();
  const scene = createDiscScene(
    host,
    [{ art: '/a.webp' }, { art: '/b.webp' }],
    { holdEntry: true, onSelect() {}, onOpen() {} },
  );
  scene.restartEntry();
  scene.setPreload(0.5);
  tick(performance.now() + 500);
  const discs = host.children[0].children[0].children;
  assert.equal(discs[1].style.visibility, 'hidden');
  for (const image of [...images]) image.onload();
  await flush();
  tick(performance.now() + 1000);
  assert.equal(discs[1].style.visibility, 'hidden');
  scene.releasePreload();
  tick(performance.now() + 1500);
  assert.equal(discs[1].style.visibility, 'visible');
  scene.destroy();
});

test('exit handover is rendered-frame driven, remains live, and resolves after the remaining flight', async () => {
  install();
  let tick;
  globalThis.requestAnimationFrame = (fn) => ((tick = fn), 1);
  let handovers = 0;
  const host = new Element(),
    scene = createDiscScene(host, [{ art: '/a.webp' }], {
      onSelect() {},
      onOpen() {},
    });
  images[0].onload();
  await flush();
  const exit = scene.exit({ duration: 800, onHandover: () => handovers++ });
  let now = performance.now();
  now += 3200;
  tick(now);
  assert.equal(handovers, 0);
  for (let i = 0; i < 6; i++) {
    now += 1000;
    tick(now);
  }
  assert.equal(handovers, 0);
  now += 1000;
  tick(now);
  assert.equal(handovers, 1);
  for (let i = 0; i < 5; i++) {
    now += 1000;
    tick(now);
  }
  await exit;
  assert.equal(handovers, 1);
  scene.destroy();
});
