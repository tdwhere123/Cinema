/**
 * Liquid ink reveal for film stills. Each image is drawn by its own WebGL2 canvas inside its
 * frame (so it scrolls with the page), masked by a domain-warped noise front that follows the
 * scroll position: the image soaks downward into the paper as it enters, its upper edge
 * dissolves as it leaves, and the pointer refracts it like a lens of water.
 * The DOM <img> stays the accessible source and is shown again whenever the canvas is idle.
 */
import { clamp } from './math.js';

const VERTEX = `#version 300 es
in vec2 aPos; out vec2 vUv;
void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 outColor;
uniform sampler2D uImage;
uniform vec2 uSize;      // CSS px of the frame
uniform float uFront;    // px from the top that the ink front has reached
uniform float uExit;     // px from the top already dissolved away on exit
uniform float uRise;     // px from the top above which a rising front still hides the image
uniform float uAmp;      // front irregularity in px
uniform float uTime, uSeed, uWobble;
uniform vec3 uMouse;     // xy in px from top-left, z strength
uniform vec3 uPaper;

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * noise(p); p = p * 2.07 + 17.1; a *= 0.45; }
  return v;
}
// Signed distance-like field in px: > 0 means ink (image) is present.
float field(vec2 px){
  vec2 p = px / 520.0 + uSeed;
  float t = uTime * 0.05;
  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, -t)));
  float n = (fbm(p + 2.4 * q + vec2(t * 0.6, 0.0)) - 0.45) * 1.6;
  // Rounded drips: narrow lobes that hang off the front like liquid about to fall.
  float lane = fbm(vec2(px.x / 150.0 + uSeed, t * 0.25));
  float drip = pow(smoothstep(0.42, 0.8, lane), 2.0);
  float centre = cos((px.x / uSize.x - 0.5) * 3.14159);
  float amp = uAmp * (1.0 + uWobble);
  float enter = uFront - px.y + n * amp + drip * amp * 0.7 + centre * uAmp * 0.2;
  float rise = px.y - uRise + n * amp + drip * amp * 0.5 - centre * uAmp * 0.15;
  vec2 pe = px / 420.0 - uSeed;
  float exitEdge = px.y - uExit + (fbm(pe + vec2(t, 3.1)) - 0.45) * uAmp * 1.2;
  float f = min(min(enter, rise), uExit > -uAmp ? exitEdge : 1e4);
  vec2 d = px - uMouse.xy;
  f += uMouse.z * 70.0 * exp(-dot(d, d) / 14000.0);
  return f;
}
void main(){
  vec2 px = vec2(vUv.x, 1.0 - vUv.y) * uSize;
  float f = field(px);
  float aa = max(fwidth(f), 0.75);
  float e = 2.5;
  vec2 g = vec2(field(px + vec2(e, 0.0)) - f, field(px + vec2(0.0, e)) - f) / e;
  vec2 n = g / max(length(g), 1e-4);
  float inside = smoothstep(-aa, aa, f);
  float meniscus = 1.0 - smoothstep(0.0, 34.0, f);
  // Water lens around the pointer and along the meniscus.
  vec2 d = px - uMouse.xy;
  float lens = uMouse.z * exp(-dot(d, d) / 9000.0);
  vec2 offset = -n * meniscus * meniscus * 12.0 + d * lens * 0.12;
  vec2 uv = clamp((px + offset) / uSize, 0.0, 1.0);
  vec3 col = texture(uImage, vec2(uv.x, uv.y)).rgb;
  col *= 1.0 - 0.32 * meniscus * meniscus;
  col = mix(col, col * col * 1.25, 0.35 * meniscus);
  float rim = smoothstep(0.0, 2.0, f) * (1.0 - smoothstep(2.0, 5.5, f));
  col += rim * max(dot(n, normalize(vec2(-0.5, -0.85))), 0.0) * 0.38;
  // A wet shadow bleeds a little way into the paper ahead of the front.
  float halo = (1.0 - smoothstep(0.0, 22.0, -f)) * (1.0 - inside) * 0.16;
  vec3 wet = uPaper * 0.72;
  float alpha = inside + halo;
  vec3 rgb = (col * inside + wet * halo) / max(alpha, 1e-4);
  outColor = vec4(rgb * alpha, alpha);
}`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(shader) || 'shader compile failed');
  return shader;
}

function createSurface(frame, image) {
  const canvas = document.createElement('canvas');
  canvas.className = 'liquid-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl2', {
    premultipliedAlpha: true,
    alpha: true,
    antialias: false,
  });
  if (!gl) return null;
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(program) || 'program link failed');
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const position = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  const uniforms = Object.fromEntries(
    [
      'uSize',
      'uFront',
      'uExit',
      'uRise',
      'uAmp',
      'uTime',
      'uSeed',
      'uWobble',
      'uMouse',
      'uPaper',
    ].map((n) => [n, gl.getUniformLocation(program, n)]),
  );
  frame.append(canvas);
  return {
    canvas,
    draw(state) {
      const w = frame.clientWidth,
        h = frame.clientHeight,
        ratio = Math.min(devicePixelRatio || 1, 1.75);
      if (canvas.width !== Math.round(w * ratio)) {
        canvas.width = Math.round(w * ratio);
        canvas.height = Math.round(h * ratio);
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uniforms.uSize, w, h);
      gl.uniform1f(uniforms.uFront, state.front);
      gl.uniform1f(uniforms.uExit, state.exit);
      gl.uniform1f(uniforms.uRise, state.rise);
      gl.uniform1f(uniforms.uAmp, state.amp);
      gl.uniform1f(uniforms.uTime, state.time);
      gl.uniform1f(uniforms.uSeed, state.seed);
      gl.uniform1f(uniforms.uWobble, state.wobble);
      gl.uniform3f(uniforms.uMouse, state.mx, state.my, state.mz);
      gl.uniform3f(uniforms.uPaper, 0.953, 0.945, 0.922);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    dispose() {
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      canvas.remove();
    },
  };
}

/**
 * The front sits `lead` of the viewport above its bottom edge and moves `gain` times faster
 * than the scroll, so an image is fully soaked before its lower edge reaches the reading line.
 */
export function frontFor(rect, viewport, { lead = 0.1, gain = 1.4 } = {}) {
  return (viewport - rect.top - lead * viewport) * gain;
}

/**
 * Rising mode (an image tucked under the hero): the edge lives in viewport space, starting
 * just above the fold and climbing past the top as the image travels from its resting
 * position to the top of the viewport. Returned in px from the image's top.
 */
export function riseFor(rect, viewport, origin, amp = viewport * 0.2) {
  // Clear once the image is centred in the viewport (or at its top, if taller than it).
  const end = Math.max(viewport * 0.05, (viewport - (rect.height || 0)) / 2),
    start = Math.max(origin, viewport * 0.6, end + 1),
    p = clamp((start - rect.top) / (start - end), 0, 1),
    eased = p * p * (3 - 2 * p),
    from = Math.min(viewport * 0.92, origin + (rect.height || 0) * 0.5),
    to = rect.top - amp * 1.8;
  return from + (to - from) * eased - rect.top;
}

export function mountLiquidImages(root, { reduced = false } = {}) {
  const images = [...root.querySelectorAll('.film-still')];
  const complete = (img) => (img.dataset.reveal = 'complete');
  const canvasOK =
    !reduced &&
    typeof WebGL2RenderingContext !== 'undefined' &&
    !!document.createElement('canvas').getContext('webgl2');
  if (!canvasOK) {
    images.forEach(complete);
    return () => {};
  }
  let frame = 0,
    disposed = false,
    last = performance.now(),
    lastScroll = scrollY,
    velocity = 0;
  const birth = performance.now();
  const items = images.map((img, i) => ({
    img,
    frame: img.closest('.still-frame') || img.parentElement,
    surface: null,
    failed: false,
    front: -Infinity,
    exit: -Infinity,
    mouse: { x: 0, y: 0, z: 0, target: 0 },
    seed: 3.1 + i * 7.7,
    lead: parseFloat(img.dataset.liquidLead ?? '0.1'),
    rising: img.dataset.liquid === 'rise',
    rise: Infinity,
    origin: null,
  }));
  function onPointer(e) {
    for (const item of items) {
      const r = item.frame.getBoundingClientRect(),
        x = e.clientX - r.left,
        y = e.clientY - r.top,
        inside = x >= 0 && y >= 0 && x <= r.width && y <= r.height;
      item.mouse.target = inside && e.pointerType === 'mouse' ? 1 : 0;
      if (inside) {
        item.mouse.x = x;
        item.mouse.y = y;
      }
    }
    schedule();
  }
  function release(item) {
    item.surface?.dispose();
    item.surface = null;
    item.img.style.visibility = '';
    item.frame.classList.remove('liquid-live');
  }
  function tick(now) {
    frame = 0;
    if (disposed) return;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    const v = (scrollY - lastScroll) / Math.max(dt, 1e-3);
    lastScroll = scrollY;
    velocity +=
      (clamp(Math.abs(v) / 2400, 0, 1) - velocity) * Math.min(1, dt * 6);
    let animating = false;
    for (const item of items) {
      const r = item.frame.getBoundingClientRect(),
        vh = innerHeight;
      const near = r.bottom > -vh * 0.5 && r.top < vh * 1.5;
      if (!near || !r.width || !item.img.complete || !item.img.naturalWidth) {
        if (item.surface) release(item);
        continue;
      }
      const amp = vh * (innerWidth < 768 ? 0.16 : 0.22);
      item.origin ??= r.top + scrollY;
      const targetFront = item.rising
        ? r.height + amp * 3
        : frontFor(r, vh, { lead: item.lead });
      const targetRise = item.rising ? riseFor(r, vh, item.origin, amp) : -1e5;
      const targetExit = -r.top - vh * 0.06;
      // Liquid lag: the front eases toward the scroll target instead of snapping to it.
      const k = Math.min(1, dt * 5.5);
      item.front =
        item.front === -Infinity
          ? Math.min(targetFront, 0)
          : item.front + (targetFront - item.front) * k;
      item.exit =
        item.exit === -Infinity
          ? targetExit
          : item.exit + (targetExit - item.exit) * k;
      item.rise =
        item.rise === Infinity
          ? Math.max(targetRise, r.height * 0.5)
          : item.rise + (targetRise - item.rise) * k;
      item.mouse.z += (item.mouse.target - item.mouse.z) * Math.min(1, dt * 7);
      const soaked =
        item.front > r.height + amp * 1.2 && item.rise < -amp * 1.6;
      const intact = item.exit < -amp * 1.2;
      if (soaked) complete(item.img);
      else item.img.dataset.reveal = 'dissolving';
      const settled =
        soaked &&
        intact &&
        item.mouse.z < 0.01 &&
        Math.abs(targetFront - item.front) < 2 &&
        Math.abs(targetRise - item.rise) < 2 &&
        velocity < 0.02;
      const visible = r.bottom > 0 && r.top < vh;
      if (settled || !visible) {
        if (item.surface && settled) release(item);
        continue;
      }
      if (!item.surface && !item.failed) {
        try {
          item.surface = createSurface(item.frame, item.img);
        } catch {
          item.failed = true;
        }
        if (!item.surface) {
          item.failed = true;
          complete(item.img);
          continue;
        }
        item.frame.classList.add('liquid-live');
        item.img.style.visibility = 'hidden';
      }
      if (!item.surface) continue;
      item.surface.draw({
        front: item.front,
        exit: item.exit,
        rise: item.rise,
        amp,
        time: (now - birth) / 1000,
        seed: item.seed,
        wobble: velocity * 0.6,
        mx: item.mouse.x,
        my: item.mouse.y,
        mz: item.mouse.z,
      });
      animating = true;
    }
    if (animating) schedule();
  }
  function schedule() {
    if (!frame && !disposed) frame = requestAnimationFrame(tick);
  }
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  addEventListener('pointermove', onPointer, { passive: true });
  images.forEach((i) => i.addEventListener('load', schedule));
  schedule();
  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    removeEventListener('scroll', schedule);
    removeEventListener('resize', schedule);
    removeEventListener('pointermove', onPointer);
    images.forEach((i) => i.removeEventListener('load', schedule));
    items.forEach(release);
  };
}
