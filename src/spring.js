/** Damped spring sampled into a CSS linear() easing, with a cubic-bezier fallback. */
export function springEasing({ stiffness, damping, mass = 1 }, samples = 48) {
  const w0 = Math.sqrt(stiffness / mass),
    zeta = damping / (2 * Math.sqrt(stiffness * mass));
  const position = (t) => {
    if (zeta < 1) {
      const wd = w0 * Math.sqrt(1 - zeta * zeta);
      return (
        1 -
        Math.exp(-zeta * w0 * t) *
          (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t))
      );
    }
    return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  };
  let duration = 0.05;
  for (let t = 0.05; t < 3; t += 0.01) {
    duration = t;
    if (
      [0, 0.03, 0.06, 0.09].every((d) => Math.abs(1 - position(t + d)) < 0.002)
    )
      break;
  }
  const points = Array.from({ length: samples + 1 }, (_, i) =>
    position((i / samples) * duration).toFixed(4),
  );
  points[samples] = '1';
  const linear = `linear(${points.join(', ')})`;
  const supported =
    typeof CSS !== 'undefined' &&
    CSS.supports?.('transition-timing-function', linear);
  return {
    easing: supported ? linear : 'cubic-bezier(0.3, 1.25, 0.4, 1)',
    duration: Math.round(duration * 1000),
  };
}
