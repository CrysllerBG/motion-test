import { makeFill, paintRadial } from './common.js';
// Fills the whole frame: a colour, or a linear / radial gradient.
export default {
  label: 'Background',
  props: {
    fill: { type: 'fill', default: '#101018' }
  },
  paint(ctx, P, env) {
    const { W, H } = env;
    if (P.fill && typeof P.fill === 'object' && P.fill.type === 'radial') return paintRadial(ctx, P.fill, W, H);
    ctx.fillStyle = makeFill(ctx, P.fill, W, H);
    ctx.fillRect(0, 0, W, H);
  }
};
