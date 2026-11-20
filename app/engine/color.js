// Colours: parse "#rgb", "#rrggbb", "#rrggbbaa", "rgb()/rgba()" into [r,g,b,a] so they can be blended.
const cache = new Map();
export function parseColor(c) {
  if (Array.isArray(c)) return c;
  if (cache.has(c)) return cache.get(c);
  let out = [0, 0, 0, 1];
  const s = String(c).trim();
  if (s[0] === '#') {
    let h = s.slice(1);
    if (h.length === 3 || h.length === 4) h = [...h].map(x => x + x).join('');
    const n = parseInt(h.slice(0, 6), 16);
    out = [(n >> 16) & 255, (n >> 8) & 255, n & 255, h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1];
  } else {
    const m = s.match(/rgba?\(([^)]+)\)/i);
    if (m) {
      const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      out = [p[0], p[1], p[2], p[3] ?? 1];
    } else if (s === 'transparent') out = [0, 0, 0, 0];
  }
  cache.set(c, out);
  return out;
}
export const isColor = c => typeof c === 'string' && (/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(c.trim()) || /^rgba?\(/i.test(c.trim()) || c === 'transparent');
export function rgba(c, alphaMul = 1) {
  const [r, g, b, a] = parseColor(c);
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${+(a * alphaMul).toFixed(4)})`;
}
export function lerpColor(a, b, p) {
  const A = parseColor(a), B = parseColor(b);
  return `rgba(${A.map((v, i) => i < 3 ? Math.round(v + (B[i] - v) * p) : +(v + (B[i] - v) * p).toFixed(4)).join(',')})`;
}
