/**
 * Watercolour reveal for film stills. Each image is drawn by its own WebGL2 canvas inside its
 * frame (so it scrolls with the page). A slow domain-warped front follows the scroll position;
 * around it a feathered band, broken up by fixed paper-fibre noise, lets the image soak in
 * pale and desaturated before its colour arrives, with only a faint pigment pool at the edge.
 * The upper edge dissolves the same way as it leaves; the pointer is a lens of water.
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
uniform float uFeather;  // width of the soaking band in px
uniform float uTime, uSeed, uWobble;
uniform vec3 uMouse;     // xy in px from top-left, z strength

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return v;
}
// Large-scale front in px (> 0: the image has soaked in). Slow domain warp, gentle lobes.
float field(vec2 px){
  vec2 p = px / 640.0 + uSeed;
  float t = uTime * 0.035;
  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, -t)));
  float n = (fbm(p + 1.8 * q) - 0.5) * 1.5;
  float lobe = smoothstep(0.45, 0.85, fbm(vec2(px.x / 210.0 + uSeed, t * 0.3)));
  float amp = uAmp * (1.0 + uWobble);
  float enter = uFront - px.y + n * amp + lobe * amp * 0.35;
  float rise = px.y - uRise + n * amp + lobe * amp * 0.25;
  float exitEdge = px.y - uExit + (fbm(px / 520.0 - uSeed + vec2(t, 3.1)) - 0.5) * uAmp * 1.2;
  float f = min(min(enter, rise), uExit > -uAmp - uFeather ? exitEdge : 1e4);
  vec2 d = px - uMouse.xy;
  return f + uMouse.z * 60.0 * exp(-dot(d, d) / 16000.0);
}
void main(){
  vec2 px = vec2(vUv.x, 1.0 - vUv.y) * uSize;
  float f = field(px);
  // Paper grain fixed in place: pigment creeps along the fibres instead of a clean cut.
  float fibre = fbm(px / 64.0 + uSeed * 3.0) - 0.5;
  float grain = noise(px / 11.0 + uSeed * 5.0) - 0.5;
  float fe = f + fibre * uFeather * 0.7 + grain * uFeather * 0.07;
  // A slight wet drift near the edge and a lens of water under the pointer.
  vec2 d = px - uMouse.xy;
  float lens = uMouse.z * exp(-dot(d, d) / 9000.0);
  float wetness = 1.0 - smoothstep(-uFeather * 0.5, uFeather * 0.5, fe);
  vec2 drift = vec2(fibre, grain) * wetness * 10.0 + d * lens * 0.1;
  vec3 col = texture(uImage, clamp((px + drift) / uSize, 0.0, 1.0)).rgb;
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  // Like pigment (or a print in the developer), dark tones soak in first, highlights last,
  // so the edge spreads as ink instead of fading through grey mist.
  fe += (0.5 - lum) * uFeather * 0.9;
  float ink = smoothstep(-uFeather * 0.5, uFeather * 0.5, fe);
  ink = ink * ink * (3.0 - 2.0 * ink);
  // Watercolour bloom: pigment pools faintly where the wash is drying, never a hard rim.
  float pool = smoothstep(0.2, 0.6, ink) * (1.0 - smoothstep(0.6, 0.95, ink));
  // Colour arrives last: the thin wash at the edge is desaturated, full once soaked.
  // (Transparency alone lets the paper show through; no paper tint, which reads as froth.)
  col = mix(vec3(lum), col, 0.35 + 0.65 * smoothstep(0.2, 1.0, ink));
  col *= 1.0 - 0.07 * pool;
  float alpha = ink;
  outColor = vec4(col * alpha, alpha);
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
      'uFeather',
      'uTime',
      'uSeed',
      'uWobble',
      'uMouse',
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
      gl.uniform1f(uniforms.uFeather, state.feather);
      gl.uniform1f(uniforms.uTime, state.time);
      gl.uniform1f(uniforms.uSeed, state.seed);
      gl.uniform1f(uniforms.uWobble, state.wobble);
      gl.uniform3f(uniforms.uMouse, state.mx, state.my, state.mz);
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
      const amp = vh * (innerWidth < 768 ? 0.1 : 0.13),
        feather = innerWidth < 768 ? 70 : 110;
      item.origin ??= r.top + scrollY;
      const targetFront = item.rising
        ? r.height + amp * 3 + feather
        : frontFor(r, vh, { lead: item.lead });
      const targetRise = item.rising
        ? riseFor(r, vh, item.origin, amp + feather)
        : -1e5;
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
        item.front > r.height + amp * 1.2 + feather &&
        item.rise < -(amp * 1.6 + feather);
      const intact = item.exit < -(amp * 1.2 + feather);
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
        feather,
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
