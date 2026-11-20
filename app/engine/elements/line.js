// A straight line that can draw itself: `draw` goes 0 → 1.
// origin "center" grows outward in both directions; "start"/"end" grow from one end.
export default {
  label: 'Line',
  props: {
    x:         { type: 'number', default: 50, min: -50, max: 150, step: 0.1, help: 'centre, % of width' },
    y:         { type: 'number', default: 50, min: -50, max: 150, step: 0.1, help: 'centre, % of height' },
    length:    { type: 'number', default: 40, min: 0, max: 200, step: 0.1, help: '% of width' },
    angle:     { type: 'number', default: 0, min: -180, max: 180, step: 0.5, help: 'degrees' },
    thickness: { type: 'number', default: 0.15, min: 0, max: 5, step: 0.01, help: '% of width' },
    color:     { type: 'color', default: '#ffffff' },
    draw:      { type: 'number', default: 1, min: 0, max: 1, step: 0.001, help: 'how much is drawn, 0..1' },
    origin:    { type: 'select', default: 'center', options: ['center', 'start', 'end'] },
    cap:       { type: 'select', default: 'butt', options: ['butt', 'round', 'square'] }
  },
  paint(ctx, P, env) {
    const { W, H, U } = env;
    const d = Math.max(0, Math.min(1, P.draw));
    if (d <= 0 || P.thickness <= 0) return;
    const L = P.length * U, a = P.angle * Math.PI / 180;
    ctx.translate(P.x / 100 * W, P.y / 100 * H);
    ctx.rotate(a);
    let x0 = -L / 2, x1 = L / 2;
    if (P.origin === 'center') { x0 = -L / 2 * d; x1 = L / 2 * d; }
    else if (P.origin === 'start') x1 = x0 + L * d;
    else x0 = x1 - L * d;
    ctx.strokeStyle = P.color;
    ctx.lineWidth = P.thickness * U;
    ctx.lineCap = P.cap;
    ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x1, 0); ctx.stroke();
  }
};
