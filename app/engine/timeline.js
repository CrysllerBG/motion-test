// The timeline engine: the same idea as the reference pieces, driven by JSON instead of code.
//
//   compile(spec)  reads the composition file and builds the `tracks` array:
//                  one track per animation (per letter/word on split text).
//   evaluate(t)    writes each track's eased 0..1 progress into `scene` (tracks only produce numbers).
//   resolve(node)  combines a layer's base props with its tracks' progress into final values
//                  (painting reads these; it never looks at the clock directly).
//
// Nothing is carried between frames, so any t can be computed directly.

import { ease } from './ease.js';
import { ELEMENTS, COMMON_PROPS } from './elements/index.js';
import { countUnits } from './elements/text.js';
import { isColor, lerpColor } from './color.js';

const clamp01 = x => Math.min(Math.max(x, 0), 1);
const TOP_KEYS = ['name', 'duration', 'fps', 'width', 'height', 'seed', 'background', 'fonts', 'layers', 'notes'];
const LAYER_KEYS = ['id', 'type', 'label', 'props', 'animate', 'children', 'text', 'split', 'stagger', 'staggerFrom', 'hidden', 'notes'];
const ANIM_KEYS = ['prop', 'from', 'to', 'start', 'duration', 'ease', 'stagger', 'wave', 'label'];

export function propSchema(type) {
  const el = ELEMENTS[type];
  return el ? { ...COMMON_PROPS, ...el.props } : COMMON_PROPS;
}
export function layerDefaults(L) {
  const el = ELEMENTS[L.type];
  const out = {};
  for (const [k, s] of Object.entries(propSchema(L.type))) if (s.default !== undefined) out[k] = s.default;
  const extra = typeof el?.defaults === 'function' ? el.defaults(L.props || {}) : el?.defaults;
  return Object.assign(out, extra);
}

export function compile(spec) {
  const errors = [];
  const err = (path, msg) => errors.push(`${path}: ${msg}`);
  if (!spec || typeof spec !== 'object') return { errors: ['composition is not a JSON object'], tracks: [], roots: [], nodes: [] };

  for (const k of Object.keys(spec)) if (!TOP_KEYS.includes(k)) err(k, `unknown top-level key (allowed: ${TOP_KEYS.join(', ')})`);
  const duration = num(spec.duration, 6), fps = num(spec.fps, 30);
  if (!(duration > 0)) err('duration', 'must be a positive number of seconds');

  const tracks = [], nodes = [], ids = new Set();
  const scene = {};

  function walk(list, path, parent) {
    if (!Array.isArray(list)) { err(path, 'must be an array of layers'); return []; }
    const out = [];
    list.forEach((L, i) => {
      const p = `${path}[${i}]`;
      if (!L || typeof L !== 'object') return err(p, 'layer must be an object');
      const el = ELEMENTS[L.type];
      if (!el) return err(`${p}.type`, `unknown type "${L.type}" (known: ${Object.keys(ELEMENTS).join(', ')})`);
      if (typeof L.id !== 'string' || !L.id) err(`${p}.id`, 'every layer needs a unique string id');
      else if (ids.has(L.id)) err(`${p}.id`, `duplicate id "${L.id}"`);
      ids.add(L.id);
      for (const k of Object.keys(L)) if (!LAYER_KEYS.includes(k)) err(`${p}.${k}`, `unknown layer key`);
      if (L.children && !el.container) err(`${p}.children`, `only groups can have children`);

      const schema = propSchema(L.type);
      for (const [k, v] of Object.entries(L.props || {})) {
        const s = schema[k];
        if (!s) { err(`${p}.props.${k}`, `"${L.type}" has no prop "${k}" (has: ${Object.keys(schema).join(', ')})`); continue; }
        checkValue(s, v, `${p}.props.${k}`, err);
      }

      const units = L.type === 'text' ? Math.max(1, countUnits(L)) : 1;
      const node = { src: L, path: p, type: L.type, el, parent, units, base: { ...layerDefaults(L), ...(L.props || {}) }, anims: {}, waves: [], children: [] };

      (L.animate || []).forEach((a, k) => {
        const ap = `${p}.animate[${k}]`;
        for (const key of Object.keys(a)) if (!ANIM_KEYS.includes(key)) err(`${ap}.${key}`, 'unknown animation key');
        const s = schema[a.prop];
        if (!s) return err(`${ap}.prop`, `"${L.type}" has no prop "${a.prop}"`);
        if (s.type !== 'number' && s.type !== 'color') return err(`${ap}.prop`, `"${a.prop}" is a ${s.type} and can't be animated (only numbers and colours)`);
        if (a.wave) {
          // ambient motion: a sine wave added on top, running for the whole piece
          const w = a.wave;
          if (s.type !== 'number') return err(`${ap}.wave`, 'waves only work on number props');
          if (!(num(w.period, 0) > 0)) return err(`${ap}.wave.period`, 'needs a positive period in seconds');
          node.waves.push({ prop: a.prop, amp: num(w.amp, 1), period: w.period, phase: num(w.phase, 0), k });
          return;
        }
        if (a.to === undefined) err(`${ap}.to`, 'every animation needs a "to" value');
        if (typeof a.start !== 'number') err(`${ap}.start`, 'needs a start time in seconds');
        if (!(typeof a.duration === 'number' && a.duration >= 0)) err(`${ap}.duration`, 'needs a duration ≥ 0 in seconds');
        if (a.ease && !ease[a.ease]) err(`${ap}.ease`, `unknown easing "${a.ease}" (known: ${Object.keys(ease).join(', ')})`);
        if (a.from !== undefined) checkValue(s, a.from, `${ap}.from`, err);
        if (a.to !== undefined) checkValue(s, a.to, `${ap}.to`, err);
        const stagger = num(a.stagger ?? L.stagger, 0);
        const keys = [];
        for (let u = 0; u < units; u++) {
          const order = staggerOrder(u, units, L.staggerFrom);
          const key = `${L.id}/${k}/${u}`;
          tracks.push({ group: L.label || L.id, layerId: L.id, anim: k, unit: u, key, prop: a.prop, label: a.label,
                        start: num(a.start, 0) + order * stagger, duration: num(a.duration, 0), easing: a.ease || 'linear' });
          scene[key] = 0;
          keys.push(tracks[tracks.length - 1]);
        }
        (node.anims[a.prop] ||= []).push({ a, k, keys, isColor: s.type === 'color' });
      });
      for (const list of Object.values(node.anims)) list.sort((x, y) => num(x.a.start, 0) - num(y.a.start, 0));

      nodes.push(node);
      if (L.children) node.children = walk(L.children, `${p}.children`, node);
      out.push(node);
    });
    return out;
  }
  const roots = walk(spec.layers || [], 'layers', null);

  // evaluate(t): every track recomputes its own progress from t. Before start = 0, after end = 1.
  function evaluate(t) {
    for (const tr of tracks) {
      const f = ease[tr.easing] || ease.linear;
      scene[tr.key] = tr.duration > 0 ? f(clamp01((t - tr.start) / tr.duration)) : (t >= tr.start ? 1 : 0);
    }
  }

  // resolve(node, unit, t): the layer's final values at time t.
  // How several animations on one property combine (the "paint combines them" rule):
  //   • start from the base value in "props"
  //   • before the first animation starts, hold its "from" value (so a fade-in starts invisible)
  //   • each animation, in start order, moves the value from its "from" (or wherever the
  //     previous one left it) to its "to"
  //   • waves are added on top
  function resolve(node, unit, t) {
    const P = { ...node.base };
    for (const prop in node.anims) {
      const list = node.anims[prop];
      let v = P[prop];
      for (let j = 0; j < list.length; j++) {
        const { a, keys, isColor: col } = list[j];
        const tr = keys[unit] || keys[0];
        if (t < tr.start) { if (j === 0 && a.from !== undefined) v = a.from; break; }
        const from = a.from !== undefined ? a.from : v;
        const p = scene[tr.key];
        v = col ? lerpColor(from ?? a.to, a.to, p) : num(from, a.to) + (a.to - num(from, a.to)) * p;
      }
      P[prop] = v;
    }
    for (const w of node.waves) P[w.prop] = num(P[w.prop], 0) + w.amp * Math.sin(2 * Math.PI * (t / w.period + w.phase));
    return P;
  }

  return {
    spec, errors, tracks, scene, roots, nodes, evaluate, resolve,
    duration, fps, seed: num(spec.seed, 1) | 0,
    width: num(spec.width, 1920), height: num(spec.height, 1080),
    byId: id => nodes.find(n => n.src.id === id)
  };
}

function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }

function staggerOrder(u, n, from) {
  if (from === 'end') return n - 1 - u;
  if (from === 'center') return Math.abs(u - (n - 1) / 2);
  return u;
}

function checkValue(s, v, path, err) {
  if (s.type === 'number' && typeof v !== 'number') err(path, `must be a number`);
  else if (s.type === 'color' && !isColor(v)) err(path, `must be a colour like "#ffcc00", "#ffcc0080" or "rgba(255,204,0,.5)"`);
  else if (s.type === 'select' && !s.options.includes(v)) err(path, `must be one of: ${s.options.join(', ')}`);
  else if (s.type === 'bool' && typeof v !== 'boolean') err(path, 'must be true or false');
  else if (s.type === 'fill' && !(isColor(v) || (v && typeof v === 'object' && ['linear', 'radial'].includes(v.type) && Array.isArray(v.stops))))
    err(path, 'must be a colour or { "type": "linear"|"radial", "stops": [["#color", 0], ...] }');
}
