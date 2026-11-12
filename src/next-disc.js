import * as THREE from '../vendor/three.module.js';
/** Detail-only physical disc with studio optics, multi-ring hub, and organic rim ink charge arc. */
const ARC_SEGMENTS = 96;

function makeDiscTextures(own) {
  const fCanvas = document.createElement('canvas');
  fCanvas.width = fCanvas.height = 256;
  const fCtx = fCanvas.getContext?.('2d');
  if (fCtx) {
    const img = fCtx.createImageData(256, 256);
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const dx = x - 128,
          dy = y - 128,
          r = Math.hypot(dx, dy) / 128;
        const n1 = Math.sin(x * 12.7 + y * 31.1) * 43758.5453;
        const grain = (n1 - Math.floor(n1) - 0.5) * 0.16;
        const gloss = (Math.sin(r * 14) * 0.5 + 0.5) * 0.18;
        const val = Math.min(
          255,
          Math.max(12, Math.round((0.44 + grain - gloss) * 255)),
        );
        const i = (y * 256 + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = val;
        img.data[i + 3] = 255;
      }
    }
    fCtx.putImageData(img, 0, 0);
  }
  const bCanvas = document.createElement('canvas');
  bCanvas.width = bCanvas.height = 256;
  const bCtx = bCanvas.getContext?.('2d');
  if (bCtx) {
    bCtx.fillStyle = '#a8a8a8';
    bCtx.fillRect(0, 0, 256, 256);
    for (let r = 14; r < 128; r += 0.75) {
      bCtx.strokeStyle = r % 3 < 1 ? '#929292' : '#bcbcbc';
      bCtx.beginPath();
      bCtx.arc(128, 128, r, 0, Math.PI * 2);
      bCtx.stroke();
    }
  }
  const mCanvas = document.createElement('canvas');
  mCanvas.width = mCanvas.height = 256;
  const mCtx = mCanvas.getContext?.('2d');
  if (mCtx) {
    const g = mCtx.createRadialGradient(128, 128, 20, 128, 128, 128);
    g.addColorStop(0, '#d9dde4');
    g.addColorStop(0.45, '#f0f2f5');
    g.addColorStop(0.75, '#cfd4dc');
    g.addColorStop(1, '#b8bec8');
    mCtx.fillStyle = g;
    mCtx.fillRect(0, 0, 256, 256);
    [0.26, 0.29, 0.32, 0.35].forEach((f, idx) => {
      mCtx.strokeStyle = `rgba(255,255,255,${0.18 - idx * 0.025})`;
      mCtx.beginPath();
      mCtx.arc(128, 128, 256 * f, 0, Math.PI * 2);
      mCtx.stroke();
    });
  }
  const matrixMap = own(new THREE.CanvasTexture(mCanvas));
  matrixMap.colorSpace = THREE.SRGBColorSpace;
  return {
    frontRough: own(new THREE.CanvasTexture(fCanvas)),
    backRough: own(new THREE.CanvasTexture(bCanvas)),
    matrixMap,
  };
}

function updateInkRibbon(geometry, charge, slot = 0) {
  const pos = geometry.attributes.position;
  const startAngle = -Math.PI * 0.38;
  const totalSweep = Math.PI * 0.76;
  const activeSweep = Math.max(
    0.015,
    totalSweep * Math.min(1, Math.max(0, charge)),
  );
  const baseRadius = 1.084;
  const halfWidth = 0.011;
  for (let i = 0; i <= ARC_SEGMENTS; i++) {
    const u = i / ARC_SEGMENTS;
    const theta = Math.PI / 2 - (startAngle + u * activeSweep);
    const n1 = Math.sin(i * 19.7 + slot * 11.3) * 43758.5453;
    const n2 = Math.cos(i * 43.1 - slot * 7.9) * 29381.1973;
    const jitter =
      (n1 - Math.floor(n1) - 0.5) * 0.014 + (n2 - Math.floor(n2) - 0.5) * 0.008;
    const taper = Math.min(1, Math.min(u, 1 - u) * 13 + 0.16);
    const rCenter = baseRadius + jitter;
    const innerR = rCenter - halfWidth * taper;
    const outerR = rCenter + halfWidth * taper;
    const cx = Math.cos(theta),
      cy = Math.sin(theta);
    pos.setXYZ(i * 2, cx * innerR, cy * innerR, 0);
    pos.setXYZ(i * 2 + 1, cx * outerR, cy * outerR, 0);
  }
  pos.needsUpdate = true;
}

export function createNextDisc(section, image) {
  let lastPaint = '';
  let renderer,
    scene,
    camera,
    disc,
    tiltGroup,
    spin,
    chargeArc,
    disposed = false,
    ready = false;
  const owned = [];
  const own = (x) => (owned.push(x), x);
  const host = document.createElement('div');
  host.className = 'next-canvas';
  host.setAttribute('aria-hidden', 'true');
  section.append(host);
  function ring(inner, outer) {
    const g = own(new THREE.RingGeometry(inner, outer, 160));
    const p = g.attributes.position,
      uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++)
      uv.setXY(i, (p.getX(i) + 1) / 2, (p.getY(i) + 1) / 2);
    return g;
  }
  function createRibbonGeometry() {
    const g = own(new THREE.BufferGeometry());
    const vertices = new Float32Array((ARC_SEGMENTS + 1) * 2 * 3);
    g.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    const indices = [];
    for (let i = 0; i < ARC_SEGMENTS; i++) {
      const b = i * 2;
      indices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }
    g.setIndex(indices);
    return g;
  }
  async function init() {
    if (renderer || disposed) return;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'low-power',
      });
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.88;
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
      camera.position.z = 4.4;
      disc = new THREE.Group();
      tiltGroup = new THREE.Group();
      spin = new THREE.Group();
      disc.add(tiltGroup);
      tiltGroup.add(spin);
      scene.add(disc);
      scene.add(new THREE.AmbientLight(0xffffff, 0.32));
      for (const [color, intensity, x, y, z] of [
        [0xfff9e8, 0.82, 3.5, -8, 6],
        [0xffffff, 0.35, -5, -2, 4],
        [0x499ff5, 0.78, 0, 3, -6],
      ]) {
        const light = new THREE.DirectionalLight(color, intensity);
        light.position.set(x, y, z);
        scene.add(light);
      }
      // Studio softbox environment matched to reference disc reflections.
      const envCanvas = document.createElement('canvas');
      envCanvas.width = 1024;
      envCanvas.height = 512;
      const ctx = envCanvas.getContext('2d');
      const grad = ctx.createLinearGradient(0, 0, 0, 512);
      grad.addColorStop(0, '#292c32');
      grad.addColorStop(0.25, '#eeeae1');
      grad.addColorStop(0.5, '#fefefe');
      grad.addColorStop(0.7, '#b6c8d5');
      grad.addColorStop(1, '#20242b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1024, 512);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(160, 55, 85, 340);
      ctx.fillRect(620, 85, 240, 220);
      const environment = own(new THREE.CanvasTexture(envCanvas));
      environment.mapping = THREE.EquirectangularReflectionMapping;
      environment.colorSpace = THREE.SRGBColorSpace;
      const pmrem = new THREE.PMREMGenerator(renderer);
      const env = own(pmrem.fromEquirectangular(environment));
      scene.environment = env.texture;
      pmrem.dispose();

      const { frontRough, backRough, matrixMap } = makeDiscTextures(own);
      const front = own(
        new THREE.MeshPhysicalMaterial({
          color: 0xd8d3c8,
          roughness: 0.42,
          roughnessMap: frontRough,
          metalness: 0.48,
          clearcoat: 0.82,
          clearcoatRoughness: 0.16,
        }),
      );
      const face = new THREE.Mesh(ring(0.24, 0.974), front);
      face.position.z = 0.008;
      spin.add(face);
      const back = new THREE.Mesh(
        ring(0.24, 0.974),
        own(
          new THREE.MeshPhysicalMaterial({
            color: 0x1a1e2a,
            roughnessMap: backRough,
            metalness: 1,
            roughness: 0.23,
            clearcoat: 0.34,
            clearcoatRoughness: 0.06,
            iridescence: 1,
            iridescenceIOR: 1.86,
            iridescenceThicknessRange: [140, 900],
          }),
        ),
      );
      back.rotation.y = Math.PI;
      back.position.z = -0.008;
      spin.add(back);
      const outerHub = new THREE.Mesh(
        ring(0.195, 0.24),
        own(
          new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            transmission: 0.68,
            transparent: true,
            opacity: 0.85,
            roughness: 0.34,
            metalness: 0,
            ior: 2,
            clearcoat: 1,
            side: THREE.DoubleSide,
          }),
        ),
      );
      outerHub.position.z = 0.009;
      spin.add(outerHub);
      const matrixRing = new THREE.Mesh(
        ring(0.125, 0.195),
        own(
          new THREE.MeshPhysicalMaterial({
            color: 0xdfe3ea,
            map: matrixMap,
            roughness: 0.28,
            metalness: 0.82,
            clearcoat: 0.7,
            side: THREE.DoubleSide,
          }),
        ),
      );
      matrixRing.position.z = 0.009;
      spin.add(matrixRing);
      const frostHub = new THREE.Mesh(
        ring(0.075, 0.125),
        own(
          new THREE.MeshPhysicalMaterial({
            color: 0xedeff2,
            transparent: true,
            opacity: 0.72,
            roughness: 0.5,
            metalness: 0.05,
            side: THREE.DoubleSide,
          }),
        ),
      );
      frostHub.position.z = 0.009;
      spin.add(frostHub);
      const rimMaterial = own(
        new THREE.MeshPhysicalMaterial({
          color: 0xf0f4f6,
          metalness: 0.58,
          roughness: 0.05,
          clearcoat: 1,
        }),
      );
      for (const [radius, tube] of [
        [0.99, 0.011],
        [0.075, 0.005],
      ])
        spin.add(
          new THREE.Mesh(
            own(new THREE.TorusGeometry(radius, tube, 8, 160)),
            rimMaterial,
          ),
        );

      const inkGeometry = createRibbonGeometry();
      updateInkRibbon(inkGeometry, 0, 0);
      chargeArc = new THREE.Mesh(
        inkGeometry,
        own(
          new THREE.MeshBasicMaterial({
            color: 0x11100e,
            side: THREE.DoubleSide,
            depthTest: false,
            depthWrite: false,
            toneMapped: false,
          }),
        ),
      );
      chargeArc.position.z = 0.032;
      chargeArc.renderOrder = 10;
      chargeArc.visible = false;
      tiltGroup.add(chargeArc);

      host.append(renderer.domElement);
      renderer.domElement.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        ready = false;
        section.dataset.nextRenderer = 'fallback';
        image.style.removeProperty('visibility');
        host.hidden = true;
      });
      section.dataset.nextRenderer = 'webgl';
      ready = true;
      image.style.visibility = 'hidden';
      section.dataset.nextAsset = 'loading';
      new THREE.TextureLoader().load(
        image.currentSrc || image.src,
        (map) => {
          if (disposed) {
            map.dispose();
            return;
          }
          own(map);
          map.colorSpace = THREE.SRGBColorSpace;
          map.anisotropy = Math.min(
            8,
            renderer.capabilities.getMaxAnisotropy(),
          );
          front.map = map;
          front.color.set(0xffffff);
          front.needsUpdate = true;
          section.dataset.nextAsset = 'ready';
          lastPaint = '';
        },
        undefined,
        () => {
          section.dataset.nextAsset = 'fallback';
        },
      );
    } catch {
      section.dataset.nextRenderer = 'fallback';
      renderer?.dispose();
      renderer = null;
      host.hidden = true;
    }
  }
  function paint({
    rx,
    ry,
    wobbleX = 0,
    wobbleY = 0,
    rotation,
    scale,
    lift,
    visible,
    charge = 0,
  }) {
    if (!visible || disposed) return;
    if (!renderer) init();
    if (!ready) return;
    const slot = charge > 0.002 ? Math.floor(performance.now() / 100) : 0;
    const poseKey = JSON.stringify([
      charge,
      slot,
      rx,
      ry,
      wobbleX,
      wobbleY,
      rotation,
      scale,
      lift,
      host.clientWidth,
      host.clientHeight,
    ]);
    if (poseKey === lastPaint && section.dataset.nextAsset !== 'loading')
      return;
    lastPaint = poseKey;
    const w = Math.max(1, host.clientWidth),
      h = Math.max(1, host.clientHeight);
    if (
      renderer.domElement.width !== Math.round(w * renderer.getPixelRatio()) ||
      renderer.domElement.height !== Math.round(h * renderer.getPixelRatio())
    )
      renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // Reference is viewport-scale and cropped by the section, with only the upper arc entering the viewport.
    const diameter = Math.min(
      innerHeight * 1.2,
      innerWidth * (innerWidth < 768 ? 1.08 : 1.3),
    );
    const worldHeight = 2 * Math.tan(THREE.MathUtils.degToRad(20)) * 4.4;
    const radius = ((diameter / h) * worldHeight) / 2;
    disc.scale.setScalar(radius * scale);
    disc.rotation.set((rx * Math.PI) / 180, (ry * Math.PI) / 180, 0);
    tiltGroup.rotation.set(wobbleX, wobbleY, 0);
    disc.position.set(0, -radius * 1.036 - (lift / 100) * radius, 0);
    spin.rotation.z = rotation;
    chargeArc.visible = charge > 0.002;
    if (chargeArc.visible) updateInkRibbon(chargeArc.geometry, charge, slot);
    if (!renderer.getContext().isContextLost()) renderer.render(scene, camera);
  }
  return {
    paint,
    destroy() {
      disposed = true;
      ready = false;
      renderer?.dispose();
      owned.forEach((x) => x.dispose());
      host.remove();
      image.style.removeProperty('visibility');
    },
  };
}
