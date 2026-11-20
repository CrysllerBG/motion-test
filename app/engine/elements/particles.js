import { mulberry, hashString } from '../random.js';
import { rgba } from '../color.js';
// Seeded particles. Each particle's starting values are drawn once from a seeded random
// sequence; its position at time t is then a formula of t (no simulation step by step),
// so scrubbing to any moment shows exactly what playback shows.
//
// Presets set sensible motion; any prop you set overrides the preset.
export const PRESETS = {
  embers:   { color: '#ff9a3c', size: 0.25, speedY: -9,  speedX: 0,  spreadX: 2,   sway: 0.8, life: 2.6, gravity: 0,  twinkle: 0,   blend: 'lighter' },
  dust:     { color: '#c8b49a', size: 0.35, speedY: -0.6, speedX: 0.4, spreadX: 1, sway: 0.6, life: 6,   gravity: 0,  twinkle: 0,   blend: 'screen' },
  snow:     { color: '#ffffff', size: 0.22, speedY: 6,   speedX: 0.5, spreadX: 1,  sway: 1.2, life: 9,   gravity: 0,  twinkle: 0,   blend: 'normal' },
  sparkles: { color: '#fff2c4', size: 0.3,  speedY: 0,   speedX: 0,  spreadX: 0,   sway: 0,   life: 1.6, gravity: 0,  twinkle: 1,   blend: 'lighter' }
};
const cache = new WeakMap();

export default {
  label: 'Particles',
  props: {
    preset:  { type: 'select', default: 'embers', options: Object.keys(PRESETS) },
    count:   { type: 'number', default: 60, min: 0, max: 600, step: 1 },
    x:       { type: 'number', default: 50, min: -50, max: 150, step: 0.1, help: 'emitter centre, % of width' },
    y:       { type: 'number', default: 80, min: -50, max: 150, step: 0.1, help: 'emitter centre, % of height' },
    width:   { type: 'number', default: 10, min: 0, max: 200, step: 0.1, help: 'emitter width, % of width' },
    height:  { type: 'number', default: 0, min: 0, max: 200, step: 0.1, help: 'emitter height, % of width' },
    color:   { type: 'color' },
    size:    { type: 'number', min: 0, max: 5, step: 0.01, help: 'radius, % of width' },
    speedX:  { type: 'number', min: -50, max: 50, step: 0.1, help: '% of width per second' },
    speedY:  { type: 'number', min: -50, max: 50, step: 0.1, help: '% of width per second (negative rises)' },
    spreadX: { type: 'number', min: 0, max: 20, step: 0.1, help: 'random sideways speed' },
    sway:    { type: 'number', min: 0, max: 10, step: 0.05, help: 'side-to-side wobble, % of width' },
    gravity: { type: 'number', min: -20, max: 20, step: 0.1 },
    life:    { type: 'number', min: 0.1, max: 30, step: 0.1, help: 'seconds each particle lives' },
    twinkle: { type: 'number', min: 0, max: 1, step: 0.01 },
    seed:    { type: 'number', default: 1, min: 0, max: 9999, step: 1 }
  },
  defaults: P => ({ blend: PRESETS[P.preset || 'embers']?.blend || 'normal' }),
  paint(ctx, P0, env, node) {
    const { W, H, U, t } = env;
    const P = { ...(PRESETS[P0.preset] || PRESETS.embers) };
    for (const k in P0) if (P0[k] !== undefined) P[k] = P0[k];
    // Draw each particle's random constants once. Extra particles extend the same sequence,
    // so raising `count` adds particles without reshuffling the existing ones.
    let c = cache.get(node);
    const key = `${P.seed}|${env.comp.seed}`;
    if (!c || c.key !== key) { c = { key, list: [], rng: mulberry(hashString(node.src.id) ^ P.seed ^ env.comp.seed) }; cache.set(node, c); }
    while (c.list.length < P.count) {
      const r = c.rng;
      c.list.push({ ox: r() - 0.5, oy: r() - 0.5, ph: r(), vx: r() * 2 - 1, life: 0.6 + r() * 0.8, size: 0.4 + r() * 1.2, swayPh: r() * 6.283, swayF: 0.5 + r() * 1.5, tw: r() * 6.283 });
    }
    const ex = P.x / 100 * W, ey = P.y / 100 * H;
    for (let i = 0; i < P.count; i++) {
      const p = c.list[i];
      const T = P.life * p.life;                       // this particle's lifetime
      const age01 = ((t / T + p.ph) % 1 + 1) % 1;      // 0..1 through its life, looping
      const age = age01 * T;
      const x = ex + p.ox * P.width * U + (P.speedX + p.vx * P.spreadX) * U * age + Math.sin(age * p.swayF * 2 + p.swayPh) * P.sway * U;
      const y = ey + p.oy * P.height * U + P.speedY * U * age + 0.5 * P.gravity * U * age * age;
      let a = Math.sin(age01 * Math.PI);               // fade in and out over its life
      if (P.twinkle) a *= 1 - P.twinkle + P.twinkle * (0.5 + 0.5 * Math.sin(t * 9 + p.tw));
      const r = P.size * p.size * U * (1 - age01 * 0.4);
      if (a <= 0.003 || r <= 0) continue;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(P.color, a));
      g.addColorStop(1, rgba(P.color, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  }
};
