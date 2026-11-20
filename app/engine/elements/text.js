import { BLEND_OP } from './common.js';
// Text, optionally split into letters or words so each piece animates on its own (a stagger).
// Every animation on a split layer runs once per piece, offset by `stagger` seconds.
// Common props (opacity, dx, dy, scale, rotate, blur) apply to each piece around its own centre.

export function splitUnits(L) {
  const text = String(L.text ?? '');
  const mode = L.split || 'none';
  // returns lines → units, where each unit is { s: string, index }
  let index = 0;
  return text.split('\n').map(line => {
    if (mode === 'letters') return [...line].map(s => ({ s, index: index++ }));
    if (mode === 'words') return line.split(' ').filter(w => w.length).map(s => ({ s, index: index++ }));
    return [{ s: line, index: index++ }];
  });
}
export const countUnits = L => splitUnits(L).reduce((n, line) => n + line.length, 0);

const FALLBACK = 'Georgia, "Times New Roman", serif';

export default {
  label: 'Text',
  perUnit: true,          // the text element applies the common props itself, piece by piece
  props: {
    x:             { type: 'number', default: 50, min: -50, max: 150, step: 0.1, help: '% of width' },
    y:             { type: 'number', default: 50, min: -50, max: 150, step: 0.1, help: 'centre of the line, % of height' },
    size:          { type: 'number', default: 6, min: 0.2, max: 40, step: 0.05, help: 'font size, % of width' },
    font:          { type: 'font', default: 'Georgia' },
    weight:        { type: 'number', default: 400, min: 100, max: 900, step: 100 },
    italic:        { type: 'bool', default: false },
    color:         { type: 'color', default: '#ffffff' },
    letterSpacing: { type: 'number', default: 0, min: -0.2, max: 1.5, step: 0.005, help: 'em' },
    lineHeight:    { type: 'number', default: 1.2, min: 0.6, max: 3, step: 0.05, help: 'multiple of size' },
    align:         { type: 'select', default: 'center', options: ['left', 'center', 'right'] },
    shadowColor:   { type: 'color', default: '#00000000' },
    shadowBlur:    { type: 'number', default: 0, min: 0, max: 10, step: 0.05, help: '% of width' }
  },
  paint(ctx, P, env, node) {
    const { W, H, U } = env;
    const lines = splitUnits(node.src);
    const px = P.size * U, ls = P.letterSpacing * px;
    const font = `${P.italic ? 'italic ' : ''}${P.weight} ${px}px "${P.font}", ${FALLBACK}`;
    ctx.font = font;
    const hasLS = 'letterSpacing' in ctx;
    if (hasLS) ctx.letterSpacing = `${ls}px`;
    // Measure each piece. With letter-spacing on, each glyph carries spacing after it, including
    // the last, so we trim one `ls` to centre the visible ink (the reference's padding-left trick).
    const measure = s => ctx.measureText(s).width + (hasLS ? 0 : ls * [...s].length);
    const spaceW = node.src.split === 'words' ? measure(' ') : 0;
    const m = ctx.measureText('Hg');
    const asc = m.fontBoundingBoxAscent ?? px * 0.8, desc = m.fontBoundingBoxDescent ?? px * 0.2;
    // CSS centres the font's ascent+descent box inside the line; doing the same keeps
    // vertical placement identical to an HTML version of the same text.
    const baselineOffset = (asc - desc) / 2;
    const lh = P.lineHeight * px;
    const y0 = P.y / 100 * H - (lines.length - 1) * lh / 2;

    lines.forEach((line, li) => {
      const widths = line.map(u => measure(u.s));
      const total = widths.reduce((a, b) => a + b, 0) + spaceW * Math.max(0, line.length - 1) - ls;
      let x = P.x / 100 * W - (P.align === 'center' ? total / 2 : P.align === 'right' ? total : 0);
      const y = y0 + li * lh;
      line.forEach((u, k) => {
        const w = widths[k];
        const Q = env.resolve(node, u.index);   // this piece's own animated values
        if (Q.opacity > 0 && u.s.trim()) {
          ctx.save();
          ctx.globalAlpha *= Math.min(1, Q.opacity);
          ctx.globalCompositeOperation = BLEND_OP[Q.blend] || 'source-over';
          if (Q.blur > 0) ctx.filter = `blur(${(Q.blur * U).toFixed(2)}px)`;
          const cx = x + (w - ls) / 2;
          ctx.translate(cx + Q.dx * U, y + Q.dy * U);
          if (Q.rotate) ctx.rotate(Q.rotate * Math.PI / 180);
          if (Q.scale !== 1) ctx.scale(Q.scale, Q.scale);
          if (Q.shadowBlur > 0) { ctx.shadowColor = Q.shadowColor; ctx.shadowBlur = Q.shadowBlur * U; }
          ctx.fillStyle = Q.color;
          ctx.textBaseline = 'alphabetic';
          ctx.textAlign = 'left';
          if (hasLS) ctx.fillText(u.s, -(w - ls) / 2, baselineOffset);
          else { let gx = -(w - ls) / 2; for (const ch of u.s) { ctx.fillText(ch, gx, baselineOffset); gx += ctx.measureText(ch).width + ls; } }
          ctx.restore();
        }
        x += w + spaceW;
      });
    });
    if (hasLS) ctx.letterSpacing = '0px';
  }
};
