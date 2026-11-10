/** 与 DOM / Three.js 解耦的动画数学。 */
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const mix = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, k, dt) => mix(a, b, 1 - Math.exp(-k * dt));
export const easeOut = (t) => 1 - (1 - clamp(t, 0, 1)) ** 3;
export function layout(d, mobile) {
  const angle = d * 0.35;
  return mobile
    ? {
        ...untilt({
          x: d * 2.2,
          y: -Math.min(Math.abs(d), 2.5),
          z: -Math.min(Math.abs(d), 2.5) * 0.5,
        }),
        ry: (clamp(-d, 0, 1) * Math.PI) / 3,
        scale: Math.abs(d) < 0.5 ? 1.5 : Math.max(0.6, 1 - Math.abs(d) * 0.4),
      }
    : {
        x: Math.sin(angle) * 5.52,
        y: Math.abs(d) < 0.5 ? 0.06 : 0,
        z: (1 - Math.cos(angle)) * 2.4,
        ry: -angle,
        scale: Math.max(0.8, 1 - Math.abs(d) * 0.12),
      };
}

/** Gallery frame is tilted -30° on both axes; mobile positions stay screen-aligned. */
export function tilt({ x, y, z }) {
  const c = Math.cos(Math.PI / 6),
    s = -0.5;
  const xx = c * x + s * z,
    zz = -s * x + c * z;
  return { x: xx, y: c * y - s * zz, z: s * y + c * zz };
}
export function untilt({ x, y, z }) {
  const c = Math.cos(Math.PI / 6),
    s = -0.5;
  const yy = c * y + s * z,
    zz = -s * y + c * z;
  return { x: c * x - s * zz, y: yy, z: s * x + c * zz };
}
export function fittedGalleryScale(width, height) {
  const a = (width / height) * Math.tan(Math.PI / 9);
  return Math.min(
    clamp((4.4 * a) / (2.2 - 0.5 * a), 0.324, 3.24),
    (0.6 * 4.4 * Math.tan(Math.PI / 9)) / 1.5,
  );
}
export function projectGalleryPoint(point, scale, width, height) {
  const p = tilt(point),
    f = height / (2 * Math.tan(Math.PI / 9)),
    depth = Math.max(0.1, 4.4 - p.z * scale);
  return {
    x: width / 2 + (p.x * scale * f) / depth,
    y: height / 2 - (p.y * scale * f) / depth,
  };
}
