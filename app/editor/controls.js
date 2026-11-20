// Small form controls used by the inspector. Each one calls onChange(value, final)
// while the user edits; `final` is true when a gesture ends (slider released, field committed).
import { parseColor } from '../engine/color.js';

export function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'text') e.textContent = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
}

const decimals = step => { const s = String(step ?? 0.01); return s.includes('.') ? s.split('.')[1].length : 0; };
const roundTo = (v, step) => +(+v).toFixed(Math.min(6, decimals(step) + 1));

// A label you can drag sideways to scrub a number (hold Shift for 10× steps).
export function scrubLabel(text, schema, getValue, onChange, title) {
  const lab = h('span', { class: 'scrub-label', title: title || 'Drag sideways to change' }, text);
  if (!schema || schema.type !== 'number') { lab.classList.add('plain'); return lab; }
  lab.addEventListener('pointerdown', e => {
    e.preventDefault();
    lab.setPointerCapture(e.pointerId);
    const x0 = e.clientX, v0 = Number(getValue()) || 0, step = schema.step || 0.01;
    const move = ev => {
      const v = v0 + Math.round((ev.clientX - x0) / 2) * step * (ev.shiftKey ? 10 : 1);
      onChange(roundTo(v, step), false);
    };
    const up = () => { lab.removeEventListener('pointermove', move); lab.removeEventListener('pointerup', up); onChange(Number(getValue()), true); };
    lab.addEventListener('pointermove', move); lab.addEventListener('pointerup', up);
  });
  return lab;
}

export function numberControl(schema, value, onChange, { slider = true, placeholder } = {}) {
  const wrap = h('div', { class: 'ctl-number' });
  const step = schema.step ?? 0.01;
  const num = h('input', { type: 'number', step: 'any', value: value ?? '', placeholder });
  if (slider && schema.min !== undefined && schema.max !== undefined) {
    const range = h('input', { type: 'range', min: schema.min, max: schema.max, step, value: value ?? schema.default ?? 0 });
    range.addEventListener('input', () => { num.value = range.value; onChange(roundTo(range.value, step), false); });
    range.addEventListener('change', () => onChange(roundTo(range.value, step), true));
    num.addEventListener('input', () => { if (num.value !== '' && !isNaN(+num.value)) { range.value = num.value; onChange(+num.value, false); } });
    wrap.append(range);
    wrap.sync = v => { num.value = v; range.value = v; };
  } else {
    num.addEventListener('input', () => { if (num.value === '') onChange(undefined, false); else if (!isNaN(+num.value)) onChange(+num.value, false); });
    wrap.sync = v => { num.value = v ?? ''; };
  }
  num.addEventListener('change', () => onChange(num.value === '' ? undefined : +num.value, true));
  wrap.append(num);
  return wrap;
}

const hex2 = n => Math.round(n).toString(16).padStart(2, '0');
export function toHex(c) { const [r, g, b, a] = parseColor(c); return '#' + hex2(r) + hex2(g) + hex2(b) + (a < 1 ? hex2(a * 255) : ''); }

// Colour: picker for the hue, slider for transparency, text field for exact values.
export function colorControl(value, onChange) {
  const wrap = h('div', { class: 'ctl-color' });
  const [r, g, b, a] = parseColor(value ?? '#ffffff');
  const pick = h('input', { type: 'color', value: '#' + hex2(r) + hex2(g) + hex2(b), title: 'Colour' });
  const alpha = h('input', { type: 'range', min: 0, max: 1, step: 0.01, value: a, title: 'Opacity of the colour (alpha)', class: 'alpha' });
  const txt = h('input', { type: 'text', value: value ?? '', spellcheck: 'false' });
  const emit = final => {
    const al = +alpha.value;
    const v = pick.value + (al < 1 ? hex2(al * 255) : '');
    txt.value = v; onChange(v, final);
  };
  pick.addEventListener('input', () => emit(false)); pick.addEventListener('change', () => emit(true));
  alpha.addEventListener('input', () => emit(false)); alpha.addEventListener('change', () => emit(true));
  txt.addEventListener('change', () => onChange(txt.value.trim(), true));
  wrap.append(pick, alpha, txt);
  return wrap;
}

export function selectControl(options, value, onChange) {
  const s = h('select', {}, options.map(o => h('option', { value: o, selected: o === value }, o)));
  s.addEventListener('change', () => onChange(s.value, true));
  return s;
}
export function boolControl(value, onChange) {
  const c = h('input', { type: 'checkbox' }); c.checked = !!value;
  c.addEventListener('change', () => onChange(c.checked, true));
  return c;
}
export function textControl(value, onChange, { multiline = false, placeholder } = {}) {
  const t = multiline ? h('textarea', { rows: 2, placeholder, spellcheck: 'false' }) : h('input', { type: 'text', placeholder, spellcheck: 'false' });
  t.value = value ?? '';
  t.addEventListener('input', () => onChange(t.value, false));
  t.addEventListener('change', () => onChange(t.value, true));
  return t;
}

export const FONT_SUGGESTIONS = ['Inter', 'Jost', 'Italiana', 'Playfair Display', 'Cormorant Garamond', 'DM Serif Display', 'Bebas Neue', 'Oswald',
  'Montserrat', 'Space Grotesk', 'Syne', 'Archivo Black', 'Anton', 'Cinzel', 'Uncial Antiqua', 'IM Fell English', 'IM Fell English SC',
  'Abril Fatface', 'Fraunces', 'Instrument Serif', 'Unbounded', 'Major Mono Display', 'JetBrains Mono', 'Caveat', 'Permanent Marker'];
export function fontControl(value, onChange) {
  const id = 'fonts-list';
  if (!document.getElementById(id)) document.body.append(h('datalist', { id }, FONT_SUGGESTIONS.map(f => h('option', { value: f }))));
  const t = h('input', { type: 'text', list: id, value: value ?? '', spellcheck: 'false', title: 'Any Google Fonts family name' });
  t.addEventListener('change', () => onChange(t.value.trim(), true));
  return t;
}

// Background fill: a flat colour, or a linear / radial gradient with editable stops.
export function fillControl(value, onChange) {
  const wrap = h('div', { class: 'ctl-fill' });
  const isObj = value && typeof value === 'object';
  const mode = isObj ? value.type : 'color';
  const set = (v, final = true) => onChange(v, final);
  wrap.append(selectControl(['color', 'linear', 'radial'], mode, m => {
    const first = isObj ? value.stops?.[0]?.[0] : value;
    const last = isObj ? value.stops?.at(-1)?.[0] : '#000000';
    if (m === 'color') set(first || '#101018');
    else if (m === 'linear') set({ type: 'linear', angle: 180, stops: isObj ? value.stops : [[first || '#202030', 0], [last || '#000000', 1]] });
    else set({ type: 'radial', x: 50, y: 50, rx: 70, ry: 70, stops: isObj ? value.stops : [[first || '#202030', 0], [last || '#000000', 1]] });
  }));
  if (!isObj) { wrap.append(colorControl(value || '#101018', set)); return wrap; }
  const copy = () => JSON.parse(JSON.stringify(value));
  const fields = value.type === 'linear' ? [['angle', 'angle °', { step: 1 }]] : [['x', 'centre x %', {}], ['y', 'centre y %', {}], ['rx', 'radius x %', {}], ['ry', 'radius y %', {}]];
  for (const [k, lab, sch] of fields) {
    wrap.append(h('div', { class: 'fill-row' }, h('span', { class: 'mini' }, lab),
      numberControl({ step: 1, ...sch }, value[k], (v, final) => { const c = copy(); c[k] = v; set(c, final); }, { slider: false })));
  }
  value.stops.forEach(([col, pos], i) => {
    wrap.append(h('div', { class: 'fill-row stop' },
      colorControl(col, (v, final) => { const c = copy(); c.stops[i][0] = v; set(c, final); }),
      numberControl({ step: 0.01 }, pos, (v, final) => { const c = copy(); c.stops[i][1] = v ?? 0; set(c, final); }, { slider: false }),
      h('button', { class: 'x', title: 'Remove stop', onclick: () => { const c = copy(); if (c.stops.length > 2) c.stops.splice(i, 1); set(c); } }, '✕')));
  });
  wrap.append(h('button', { class: 'small', onclick: () => { const c = copy(); c.stops.push([c.stops.at(-1)[0], 1]); set(c); } }, '+ stop'));
  return wrap;
}

// A tiny drawing of an easing curve, so the names mean something.
export function easeCurve(fn) {
  const pts = [];
  for (let i = 0; i <= 40; i++) { const p = i / 40; pts.push(`${(2 + p * 36).toFixed(1)},${(30 - fn(p) * 24).toFixed(1)}`); }
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 40 34'); svg.setAttribute('class', 'ease-curve');
  svg.innerHTML = `<line x1="2" y1="30" x2="38" y2="30" class="axis"/><line x1="2" y1="6" x2="38" y2="6" class="axis"/><polyline points="${pts.join(' ')}"/>`;
  return svg;
}
