// Properties every layer has. Units used across the whole format:
//   x, y      → position in % of the frame (x of its width, y of its height)
//   lengths   → % of the frame WIDTH (like CSS cqw: 1 = 1% of the width),
//               so a composition looks the same at any export resolution
//   angles    → degrees
export const COMMON_PROPS = {
  opacity: { type: 'number', default: 1, min: 0, max: 1, step: 0.01 },
  dx:      { type: 'number', default: 0, min: -100, max: 100, step: 0.1, help: 'offset right, % of width' },
  dy:      { type: 'number', default: 0, min: -100, max: 100, step: 0.1, help: 'offset down, % of width' },
  scale:   { type: 'number', default: 1, min: 0, max: 5, step: 0.001 },
  rotate:  { type: 'number', default: 0, min: -360, max: 360, step: 0.5, help: 'degrees' },
  blur:    { type: 'number', default: 0, min: 0, max: 10, step: 0.01, help: '% of width' },
  blend:   { type: 'select', default: 'normal', options: ['normal', 'screen', 'lighter', 'multiply', 'overlay', 'soft-light'] }
};
export const BLEND_OP = { normal: 'source-over', screen: 'screen', lighter: 'lighter', multiply: 'multiply', overlay: 'overlay', 'soft-light': 'soft-light' };

// Gradient stops are [colour, position 0..1] pairs.
export function makeFill(ctx, fill, W, H) {
  if (!fill || typeof fill === 'string') return fill || '#000';
  const stops = fill.stops || [];
  let g;
  if (fill.type === 'linear') {
    // angle like CSS: 180 = top → bottom, 90 = left → right
    const a = ((fill.angle ?? 180) - 90) * Math.PI / 180;
    const half = (Math.abs(W * Math.cos(a)) + Math.abs(H * Math.sin(a))) / 2;
    g = ctx.createLinearGradient(W / 2 - Math.cos(a) * half, H / 2 - Math.sin(a) * half, W / 2 + Math.cos(a) * half, H / 2 + Math.sin(a) * half);
    for (const [c, p] of stops) g.addColorStop(p, c);
    return g;
  }
  // radial: centre (x,y) and radii (rx of width, ry of height), all in % of the frame
  return null; // radial gradients are painted by paintRadial, since an ellipse needs a transform
}
export function paintRadial(ctx, fill, W, H) {
  const cx = (fill.x ?? 50) / 100 * W, cy = (fill.y ?? 50) / 100 * H;
  const rx = (fill.rx ?? 70) / 100 * W, ry = (fill.ry ?? 70) / 100 * H;
  ctx.save();
  // the last stop's colour fills everything outside the ellipse
  const stops = fill.stops || [];
  ctx.fillStyle = stops.length ? stops[stops.length - 1][0] : '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.translate(cx, cy);
  ctx.scale(rx, ry);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  for (const [c, p] of stops) g.addColorStop(p, c);
  ctx.fillStyle = g;
  // cover the whole frame in the scaled space
  const ex = Math.max(cx, W - cx) / rx + 1, ey = Math.max(cy, H - cy) / ry + 1;
  ctx.fillRect(-ex, -ey, 2 * ex, 2 * ey);
  ctx.restore();
}
