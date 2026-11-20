import { rgba } from '../color.js';
// Darkens the edges of the frame, pulling the eye to the centre.
export default {
  label: 'Vignette',
  props: {
    color: { type: 'color', default: '#000000' },
    inner: { type: 'number', default: 35, min: 0, max: 150, step: 0.5, help: 'clear radius, % of height' },
    outer: { type: 'number', default: 62, min: 0, max: 150, step: 0.5, help: 'full-dark radius, % of width' },
    strength: { type: 'number', default: 0.7, min: 0, max: 1, step: 0.01 }
  },
  paint(ctx, P, env) {
    const { W, H } = env;
    const g = ctx.createRadialGradient(W / 2, H / 2, P.inner / 100 * H, W / 2, H / 2, P.outer / 100 * W);
    g.addColorStop(0, rgba(P.color, 0));
    g.addColorStop(1, rgba(P.color, P.strength));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
};
