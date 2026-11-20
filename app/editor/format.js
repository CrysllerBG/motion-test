// Saving: put keys in a fixed order and print compactly, so a saved file reads like a
// hand-written one and a git diff shows only what actually changed.
import { propSchema } from '../engine/timeline.js';

const TOP = ['name', 'notes', 'duration', 'fps', 'width', 'height', 'seed', 'background', 'fonts', 'audio', 'layers', 'sounds', 'cues'];
const CUE = ['at', 'sound', 'label', 'note', 'length', 'velocity'];
const LAYER = ['id', 'type', 'label', 'notes', 'hidden', 'text', 'split', 'stagger', 'staggerFrom', 'props', 'animate', 'children'];
const ANIM = ['prop', 'label', 'from', 'to', 'start', 'duration', 'ease', 'stagger', 'wave'];

function ordered(obj, order) {
  const out = {};
  for (const k of order) if (obj[k] !== undefined) out[k] = obj[k];
  for (const k of Object.keys(obj)) if (!(k in out) && obj[k] !== undefined) out[k] = obj[k];
  return out;
}
export function normalize(spec) {
  const layer = L => {
    const o = ordered(L, LAYER);
    if (o.props) {
      o.props = ordered(o.props, Object.keys(propSchema(L.type)));
      if (!Object.keys(o.props).length) delete o.props;
    }
    if (o.animate) { o.animate = o.animate.map(a => ordered(a, ANIM)); if (!o.animate.length) delete o.animate; }
    if (o.children) o.children = o.children.map(layer);
    if (o.hidden === false) delete o.hidden;
    return o;
  };
  const s = ordered(spec, TOP);
  if (s.layers) s.layers = s.layers.map(layer);
  if (s.sounds) { s.sounds = s.sounds.map(layer); if (!s.sounds.length) delete s.sounds; }
  if (s.cues) { s.cues = s.cues.map(c => ordered(c, CUE)).sort((a, b) => a.at - b.at); if (!s.cues.length) delete s.cues; }
  return s;
}

// Pretty-print: small things stay on one line; layers and lists of objects get a line each.
export function formatJSON(value, width = 110) {
  const prim = x => JSON.stringify(typeof x === 'number' ? +x.toFixed(6) : x);
  const one = v => {
    if (v === null || typeof v !== 'object') return prim(v);
    if (Array.isArray(v)) return '[' + v.map(one).join(', ') + ']';
    const e = Object.entries(v);
    return e.length ? '{ ' + e.map(([k, x]) => JSON.stringify(k) + ': ' + one(x)).join(', ') + ' }' : '{}';
  };
  const mustExpand = v => Array.isArray(v)
    ? v.length > 1 && v.some(x => x && typeof x === 'object' && !Array.isArray(x))
    : 'id' in v || 'layers' in v;
  function fmt(v, ind) {
    if (v === null || typeof v !== 'object') return prim(v);
    const flat = one(v);
    if (!mustExpand(v) && ind.length + flat.length <= width) return flat;
    const next = ind + '  ';
    if (Array.isArray(v)) return '[\n' + v.map(x => next + fmt(x, next)).join(',\n') + '\n' + ind + ']';
    return '{\n' + Object.entries(v).map(([k, x]) => `${next}${JSON.stringify(k)}: ${fmt(x, next)}`).join(',\n') + '\n' + ind + '}';
  }
  return fmt(value, '') + '\n';
}
