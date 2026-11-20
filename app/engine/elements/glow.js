import { rgba } from '../color.js';
// A soft blob of light: an ellipse that fades from `color` at its centre to transparent at its edge.
// Usually blended with "screen" so it brightens what's below.
export default {
  label: 'Glow',
  props: {
    x:      { type: 'number', default: 50, min: -50, max: 150, step: 0.1, help: 'centre, % of width' },
    y:      { type: 'number', default: 50, min: -50, max: 150, step: 0.1, help: 'centre, % of height' },
    width:  { type: 'number', default: 60, min: 0, max: 200, step: 0.1, help: '% of width' },
    height: { type: 'number', default: 40, min: 0, max: 200, step: 0.1, help: '% of width' },
    color:  { type: 'color', default: '#5fe3b48c' },
    softness: { type: 'number', default: 4, min: 0, max: 20, step: 0.1, help: 'extra blur, % of width' }
  },
  defaults: { blend: 'screen' },
  paint(ctx, P, env) {
    const { W, H, U } = env;
    const cx = P.x / 100 * W, cy = P.y / 100 * H, rx = P.width / 2 * U, ry = P.height / 2 * U;
    if (rx <= 0 || ry <= 0) return;
    if (P.softness > 0) ctx.filter = `blur(${(P.softness * U).toFixed(2)}px)`;
    ctx.translate(cx, cy);
    ctx.scale(rx, ry);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, rgba(P.color));
    g.addColorStop(1, rgba(P.color, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.fill();
  }
};
