import { mulberry, hashString } from '../random.js';
import { parseColor } from '../color.js';
// Procedural texture made from seeded value noise: film grain, paper fibre or stone pitting.
// Drawn once into a small offscreen canvas, then stretched over the frame.
// "animated" grain picks a new random offset 12 times a second, chosen from t, so it stays deterministic.
const cache = new Map();

function fbm(w, h, seed, freqX, freqY, octaves) {
  const rng = mulberry(seed);
  const G = 64, grid = new Float32Array(G * G).map(() => rng());
  const val = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const s = v => v * v * (3 - 2 * v);
    const at = (i, j) => grid[((j & (G - 1)) * G) + (i & (G - 1))];
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * s(fx) + (c - a) * s(fy) + (a - b - c + d) * s(fx) * s(fy);
  };
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = 0, amp = 0.5, f = 1;
    for (let o = 0; o < octaves; o++) { v += amp * val(x * freqX * f, y * freqY * f); amp *= 0.5; f *= 2; }
    out[y * w + x] = v;
  }
  return out;
}
function texture(kind, color, seed) {
  const key = `${kind}|${color}|${seed}`;
  if (cache.has(key)) return cache.get(key);
  const w = kind === 'grain' ? 512 : 384, h = Math.round(w * 9 / 16);
  const n = kind === 'grain' ? null : fbm(w, h, seed, kind === 'paper' ? 0.04 : 0.12, kind === 'paper' ? 0.16 : 0.12, 4);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d'), img = g.createImageData(w, h), rng = mulberry(seed);
  const [r, gg, b] = parseColor(color);
  for (let i = 0; i < w * h; i++) {
    let a;
    if (kind === 'grain') a = rng();                                   // independent speckle per pixel
    else a = Math.max(0, Math.min(1, (n[i] - 0.38) * 2.2));            // blotches above a threshold
    img.data[i * 4] = r; img.data[i * 4 + 1] = gg; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = a * 255;
  }
  g.putImageData(img, 0, 0);
  cache.set(key, cv);
  return cv;
}

export default {
  label: 'Noise',
  props: {
    kind:     { type: 'select', default: 'grain', options: ['grain', 'paper', 'stone'] },
    color:    { type: 'color', default: '#ffffff' },
    animated: { type: 'bool', default: true, help: 'grain changes 12× per second' },
    seed:     { type: 'number', default: 1, min: 0, max: 9999, step: 1 }
  },
  defaults: { opacity: 0.08, blend: 'overlay' },
  paint(ctx, P, env) {
    const { W, H, t } = env;
    const tex = texture(P.kind, P.color, (P.seed | 0) ^ env.comp.seed);
    if (P.kind === 'grain' && P.animated) {
      const r = mulberry(Math.floor(t * 12) + 1);
      const ox = r() * tex.width, oy = r() * tex.height;
      const pat = ctx.createPattern(tex, 'repeat');
      pat.setTransform(new DOMMatrix().translate(-ox, -oy).scale(W / tex.width / 1.5));
      ctx.fillStyle = pat; ctx.fillRect(0, 0, W, H);
    } else {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(tex, 0, 0, W, H);
    }
  }
};
