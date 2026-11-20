// Painting: read the resolved values and draw them. One canvas, layers in order (first = back).
import { BLEND_OP } from './elements/index.js';

export function paintFrame(ctx, comp, t, W, H, opts = {}) {
  comp.evaluate(t);                               // 1. tracks → scene numbers
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
  ctx.fillStyle = comp.spec.background || '#000';
  ctx.fillRect(0, 0, W, H);
  const env = { W, H, U: W / 100, t, comp, hidden: opts.hidden, resolve: (node, unit) => comp.resolve(node, unit, t) };
  for (const node of comp.roots) paintNode(ctx, node, env);   // 2. scene numbers → pixels
}

function paintNode(ctx, node, env) {
  if (node.src.hidden || env.hidden?.has(node.src.id)) return;
  const { W, H, U } = env;
  const P = env.resolve(node, 0);
  if (node.el.perUnit) {                          // text applies the common props per letter/word
    ctx.save(); node.el.paint(ctx, P, env, node); ctx.restore();
    return;
  }
  if (!(P.opacity > 0)) return;
  ctx.save();
  ctx.globalAlpha *= Math.min(1, P.opacity);
  if (P.blend && P.blend !== 'normal') ctx.globalCompositeOperation = BLEND_OP[P.blend];
  if (P.blur > 0) ctx.filter = `blur(${(P.blur * U).toFixed(2)}px)`;
  ctx.translate(P.dx * U, P.dy * U);
  if (P.scale !== 1 || P.rotate) {
    // scale and rotate around the layer's own position (its anchor), or the frame centre
    const ax = (P.x ?? 50) / 100 * W, ay = (P.y ?? 50) / 100 * H;
    ctx.translate(ax, ay);
    ctx.rotate(P.rotate * Math.PI / 180);
    ctx.scale(P.scale, P.scale);
    ctx.translate(-ax, -ay);
  }
  if (node.el.container) for (const child of node.children) paintNode(ctx, child, env);
  else node.el.paint(ctx, P, env, node);
  ctx.restore();
}
