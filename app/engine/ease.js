// Easing functions: each takes linear progress p (0 → 1) and returns shaped progress.
// The first five are the same ones the reference pieces use.
export const ease = {
  linear:     p => p,
  inQuad:     p => p * p,                                                   // slow start (exits)
  outCubic:   p => 1 - Math.pow(1 - p, 3),                                  // fast start, gentle landing
  inOutQuad:  p => p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2,   // slow, fast, slow
  outBounce:  p => {
    const n = 7.5625, d = 2.75;
    if (p < 1 / d) return n * p * p;
    if (p < 2 / d) return n * (p -= 1.5 / d) * p + 0.75;
    if (p < 2.5 / d) return n * (p -= 2.25 / d) * p + 0.9375;
    return n * (p -= 2.625 / d) * p + 0.984375;
  },
  inCubic:    p => p * p * p,
  inOutCubic: p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2,
  outExpo:    p => p >= 1 ? 1 : 1 - Math.pow(2, -10 * p),                   // very fast start, long settle
  outBack:    p => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); }, // overshoots, then settles
  step:       p => p > 0 ? 1 : 0                                            // jump: an instant cut
};
export const EASE_NAMES = Object.keys(ease);
