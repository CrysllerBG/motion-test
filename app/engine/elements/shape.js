// A rectangle, circle or regular polygon, filled and/or stroked.
// `draw` (0..1) reveals the outline progressively, like a pen tracing it.
export default {
  label: 'Shape',
  props: {
    shape:       { type: 'select', default: 'rect', options: ['rect', 'circle', 'polygon'] },
    x:           { type: 'number', default: 50, min: -50, max: 150, step: 0.1, help: 'centre, % of width' },
    y:           { type: 'number', default: 50, min: -50, max: 150, step: 0.1, help: 'centre, % of height' },
    width:       { type: 'number', default: 20, min: 0, max: 200, step: 0.1, help: '% of width (circle/polygon: diameter)' },
    height:      { type: 'number', default: 10, min: 0, max: 200, step: 0.1, help: '% of width (rect only)' },
    radius:      { type: 'number', default: 0, min: 0, max: 50, step: 0.1, help: 'corner radius, % of width' },
    sides:       { type: 'number', default: 6, min: 3, max: 24, step: 1 },
    fill:        { type: 'color', default: '#ffffff' },
    stroke:      { type: 'color', default: '#00000000' },
    strokeWidth: { type: 'number', default: 0, min: 0, max: 5, step: 0.01, help: '% of width' },
    draw:        { type: 'number', default: 1, min: 0, max: 1, step: 0.001, help: 'outline reveal, 0..1' }
  },
  paint(ctx, P, env) {
    const { W, H, U } = env;
    const w = P.width * U, h = P.height * U;
    ctx.translate(P.x / 100 * W, P.y / 100 * H);
    const path = new Path2D();
    let perimeter;
    if (P.shape === 'circle') {
      path.arc(0, 0, w / 2, -Math.PI / 2, Math.PI * 1.5);
      perimeter = Math.PI * w;
    } else if (P.shape === 'polygon') {
      const n = Math.max(3, Math.round(P.sides));
      for (let i = 0; i <= n; i++) {
        const a = -Math.PI / 2 + i / n * Math.PI * 2;
        i ? path.lineTo(Math.cos(a) * w / 2, Math.sin(a) * w / 2) : path.moveTo(Math.cos(a) * w / 2, Math.sin(a) * w / 2);
      }
      perimeter = n * w * Math.sin(Math.PI / n);
    } else {
      const r = Math.min(P.radius * U, w / 2, h / 2);
      path.roundRect ? path.roundRect(-w / 2, -h / 2, w, h, r) : path.rect(-w / 2, -h / 2, w, h);
      perimeter = 2 * (w + h) - (8 - 2 * Math.PI) * r;
    }
    const d = Math.max(0, Math.min(1, P.draw));
    // the fill appears only once the outline is complete, so a "draw" reveal reads as tracing
    if (d >= 1) { ctx.fillStyle = P.fill; ctx.fill(path); }
    if (P.strokeWidth > 0 && d > 0) {
      ctx.strokeStyle = P.stroke;
      ctx.lineWidth = P.strokeWidth * U;
      if (d < 1) ctx.setLineDash([perimeter * d, perimeter]);
      ctx.stroke(path);
    }
  }
};
