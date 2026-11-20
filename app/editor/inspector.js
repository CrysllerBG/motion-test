// The inspector: every number in the selected layer as a control.
// Edits go through store.edit(), which records undo and recompiles; the stage repaints itself.
import { propSchema, layerDefaults } from '../engine/timeline.js';
import { COMMON_PROPS } from '../engine/elements/index.js';
import { ELEMENTS } from '../engine/elements/index.js';
import { BEDS, CUES, cueWithDefaults } from '../engine/audio/sounds.js';
import { ease, EASE_NAMES } from '../engine/ease.js';
import { parseFonts } from '../engine/fonts.js';
import { findLayer } from './store.js';
import { h, scrubLabel, numberControl, colorControl, selectControl, boolControl, textControl, fontControl, fillControl, easeCurve } from './controls.js';

export function renderInspector(root, ctx) {
  const { store, selected, select, player } = ctx;
  root.innerHTML = '';
  const spec = store.state.spec;
  if (!spec) return;
  if (selected?.cue !== undefined && spec.cues?.[selected.cue]) return renderCue(root, ctx);
  const found = selected?.layerId && findLayer(spec, selected.layerId);
  if (!found) return renderComposition(root, store, player);

  const L = found.layer, id = L.id;
  const schema = propSchema(L.type);
  const defaults = layerDefaults(L);
  // Always look the layer up again inside an edit: undo replaces the spec object.
  const editLayer = (fn, opts = {}) => store.edit(s => { const f = findLayer(s, id); if (f) fn(f.layer, s); }, { source: 'inspector', ...opts });

  // ---- Header: identity ----
  const head = h('section', { class: 'insp-sec' },
    h('div', { class: 'insp-title' }, h('strong', {}, L.label || L.id), h('span', { class: 'badge' }, L.type)),
    row('id', textControl(L.id, (v, final) => {
      if (!final) return;
      v = v.trim();
      if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(v) || (v !== id && findLayer(spec, v))) { alert('An id must be unique and start with a letter (letters, digits, - and _).'); return renderInspector(root, ctx); }
      store.edit(s => { findLayer(s, id).layer.id = v; }, { source: 'inspector', structure: true });
      select({ layerId: v });
    })),
    row('label', textControl(L.label, (v, final) => editLayer(l => { if (v) l.label = v; else delete l.label; }, { key: `${id}.label`, structure: final }), { placeholder: 'name shown in the timeline' }))
  );
  if (L.type === 'text') {
    head.append(
      row('text', textControl(L.text, (v, final) => editLayer(l => { l.text = v; }, { key: `${id}.text`, structure: final }), { multiline: true })),
      row('split', selectControl(['none', 'letters', 'words'], L.split || 'none', v => editLayer(l => { if (v === 'none') delete l.split; else l.split = v; }, { structure: true })),
        'Split into pieces that animate one after another'),
    );
    if (L.split && L.split !== 'none') head.append(
      row(scrubLabel('stagger', { type: 'number', step: 0.01 }, () => L.stagger ?? 0, (v, final) => editLayer(l => { l.stagger = Math.max(0, v); }, { key: `${id}.stagger`, structure: final })),
        numberControl({ type: 'number', min: 0, max: 0.5, step: 0.005 }, L.stagger ?? 0, (v, final) => editLayer(l => { l.stagger = Math.max(0, v ?? 0); }, { key: `${id}.stagger`, structure: final })),
        'Seconds between one piece starting and the next'),
      row('order', selectControl(['start', 'end', 'center'], L.staggerFrom || 'start', v => editLayer(l => { if (v === 'start') delete l.staggerFrom; else l.staggerFrom = v; }, { structure: true })))
    );
  }
  root.append(head);

  // ---- Properties ----
  const isSound = !!found.sound;
  const own = Object.keys((ELEMENTS[L.type] || BEDS[L.type]).props);
  const common = isSound ? [] : Object.keys(COMMON_PROPS).filter(k => !own.includes(k));
  const animated = new Set((L.animate || []).map(a => a.prop));
  const propRow = k => {
    const s = schema[k];
    const isSet = L.props && k in L.props;
    const val = isSet ? L.props[k] : defaults[k];
    const setProp = (v, final) => editLayer(l => {
      l.props ||= {};
      if (v === undefined || v === '') delete l.props[k]; else l.props[k] = v;
      if (k === 'font' || k === 'weight' || k === 'italic') ensureFont(store.state.spec, l);
    }, { key: `${id}.props.${k}`, structure: final && (k === 'preset' || s.type === 'fill' || k === 'shape') });
    let ctl;
    if (s.type === 'number') ctl = numberControl(s, val, setProp);
    else if (s.type === 'color') ctl = colorControl(val, setProp);
    else if (s.type === 'select') ctl = selectControl(s.options, val, setProp);
    else if (s.type === 'bool') ctl = boolControl(val, setProp);
    else if (s.type === 'font') ctl = fontControl(val, setProp);
    else if (s.type === 'fill') ctl = fillControl(val, setProp);
    else if (s.type === 'note') ctl = textControl(val, (v, final) => { if (final) setProp(v.trim(), true); }, { placeholder: 'e.g. D1' });
    const label = scrubLabel(k, s, () => findLayer(store.state.spec, id)?.layer.props?.[k] ?? defaults[k] ?? 0, (v, final) => { setProp(v, final); ctl.sync?.(v); }, s.help);
    const r = row(label, ctl, s.help);
    if (!isSet) r.classList.add('is-default');
    if (animated.has(k)) r.classList.add('is-animated');
    if (isSet) r.append(h('button', { class: 'reset', title: 'Back to default', onclick: () => editLayer(l => { delete l.props[k]; }, { structure: true }) }, '↺'));
    return r;
  };
  const props = h('section', { class: 'insp-sec' }, h('h3', {}, 'Properties'));
  own.forEach(k => props.append(propRow(k)));
  if (common.length) {
    const look = h('details', { class: 'insp-more', open: common.some(k => (L.props && k in L.props) || animated.has(k)) || undefined },
      h('summary', {}, 'Opacity, offset, scale, rotation, blur, blend'));
    common.forEach(k => look.append(propRow(k)));
    props.append(look);
  }
  if (isSound) props.append(h('p', { class: 'hint' }, 'Turn Sound on (under the stage) to hear changes while playing. Animate volume or cutoff like any visual property.'));
  root.append(props);

  // ---- Animations ----
  const animSec = h('section', { class: 'insp-sec' }, h('h3', {}, 'Animations'));
  const animatable = Object.keys(schema).filter(k => ['number', 'color'].includes(schema[k].type));
  (L.animate || []).forEach((a, k) => animSec.append(animCard(a, k)));
  if (!(L.animate || []).length) animSec.append(h('p', { class: 'hint' }, 'No animations yet. Add one to make a property change over time.'));
  animSec.append(h('div', { class: 'btn-row' },
    h('button', { class: 'small', onclick: () => {
      const t = +player.t.toFixed(2);
      editLayer(l => { (l.animate ||= []).push(isSound ? { prop: 'volume', from: 0, to: 0.5, start: t, duration: 1, ease: 'inOutQuad' } : { prop: 'opacity', from: 0, to: 1, start: t, duration: 0.6, ease: 'outCubic' }); }, { structure: true });
      select({ layerId: id, anim: (findLayer(store.state.spec, id).layer.animate.length - 1) });
    } }, '+ Animation at playhead'),
    h('button', { class: 'small', onclick: () => {
      editLayer(l => { (l.animate ||= []).push(isSound ? { prop: 'volume', wave: { amp: 0.1, period: 3 } } : { prop: 'dy', wave: { amp: 1, period: 4 } }); }, { structure: true });
      select({ layerId: id, anim: findLayer(store.state.spec, id).layer.animate.length - 1 });
    } }, '+ Wave (ambient drift)')));
  root.append(animSec);

  function animCard(a, k) {
    const s = schema[a.prop] || { type: 'number' };
    const sel = selected.anim === k;
    const editAnim = (fn, opts = {}) => editLayer(l => fn(l.animate[k]), { key: `${id}.anim${k}.${opts.field || ''}`, ...opts });
    const card = h('div', { class: 'anim-card' + (sel ? ' sel' : ''), onclick: e => { if (!sel && e.target === card) select({ layerId: id, anim: k }); } });
    card.append(h('div', { class: 'anim-head' },
      selectControl(animatable, a.prop, v => editAnim(x => {
        x.prop = v;
        // from/to keep their meaning only within the same kind of value
        if (schema[v].type !== s.type) { delete x.from; x.to = schema[v].type === 'color' ? '#ffffff' : 1; }
      }, { structure: true })),
      h('span', { class: 'mini' }, a.wave ? 'wave' : ''),
      h('button', { class: 'x', title: 'Delete this animation', onclick: () => { editLayer(l => { l.animate.splice(k, 1); if (!l.animate.length) delete l.animate; }, { structure: true }); select({ layerId: id }); } }, '✕')));
    if (a.wave) {
      const w = a.wave;
      for (const [f, sch, help] of [['amp', { type: 'number', step: 0.05 }, 'how far it moves either way'], ['period', { type: 'number', step: 0.1 }, 'seconds for one full cycle'], ['phase', { type: 'number', step: 0.05 }, 'where in the cycle it starts, 0..1']]) {
        card.append(row(scrubLabel(f, sch, () => findLayer(store.state.spec, id).layer.animate[k].wave[f] ?? 0, (v, final) => editAnim(x => { x.wave[f] = f === 'period' ? Math.max(0.05, v) : v; }, { field: f, structure: final })),
          numberControl(sch, w[f], (v, final) => editAnim(x => { if (v === undefined && f === 'phase') delete x.wave.phase; else x.wave[f] = f === 'period' ? Math.max(0.05, v ?? 1) : v ?? 0; }, { field: f, structure: final }), { slider: false }), help));
      }
      return card;
    }
    const valueCtl = (field) => {
      const v = a[field];
      const set = (nv, final) => editAnim(x => { if (nv === undefined || nv === '') delete x[field]; else x[field] = nv; }, { field, structure: final });
      if (s.type === 'color') {
        const c = colorControl(v ?? '#ffffff', set);
        if (field === 'from') c.prepend(h('button', { class: 'small', title: 'Start from wherever the property currently is', onclick: () => set(undefined, true) }, 'current'));
        return c;
      }
      return numberControl(s, v, set, { slider: false, placeholder: field === 'from' ? 'current' : '' });
    };
    const timeCtl = field => numberControl({ step: 0.01 }, a[field], (v, final) => editAnim(x => { x[field] = Math.max(0, v ?? 0); }, { field, structure: final }), { slider: false });
    card.append(
      row(scrubLabel('from', s, () => findLayer(store.state.spec, id).layer.animate[k].from ?? 0, (v, final) => editAnim(x => { x.from = v; }, { field: 'from', structure: final })), valueCtl('from'), 'Empty = start from the current value'),
      row(scrubLabel('to', s, () => findLayer(store.state.spec, id).layer.animate[k].to ?? 0, (v, final) => editAnim(x => { x.to = v; }, { field: 'to', structure: final })), valueCtl('to')),
      row(scrubLabel('start', { type: 'number', step: 0.01 }, () => findLayer(store.state.spec, id).layer.animate[k].start, (v, final) => editAnim(x => { x.start = Math.max(0, v); }, { field: 'start', structure: final })), timeCtl('start'), 'seconds'),
      row(scrubLabel('duration', { type: 'number', step: 0.01 }, () => findLayer(store.state.spec, id).layer.animate[k].duration, (v, final) => editAnim(x => { x.duration = Math.max(0, v); }, { field: 'duration', structure: final })), timeCtl('duration'), 'seconds'),
      row('ease', h('div', { class: 'ease-pick' }, selectControl(EASE_NAMES, a.ease || 'linear', v => editAnim(x => { x.ease = v; }, { structure: true })), easeCurve(ease[a.ease || 'linear'])))
    );
    if (L.type === 'text' && L.split && L.split !== 'none') {
      card.append(row('stagger', numberControl({ step: 0.005 }, a.stagger, (v, final) => editAnim(x => { if (v === undefined) delete x.stagger; else x.stagger = Math.max(0, v); }, { field: 'stagger', structure: final }), { slider: false, placeholder: `layer: ${L.stagger ?? 0}` }), 'Override the layer\'s stagger for this animation'));
    }
    return card;
  }
  if (selected.anim !== undefined) requestAnimationFrame(() => root.querySelector('.anim-card.sel')?.scrollIntoView({ block: 'nearest' }));
}

function renderComposition(root, store, player) {
  const spec = store.state.spec;
  const editSpec = (fn, opts = {}) => store.edit(fn, { source: 'inspector', ...opts });
  const sec = h('section', { class: 'insp-sec' }, h('div', { class: 'insp-title' }, h('strong', {}, 'Composition'), h('span', { class: 'badge' }, 'select a layer to edit it')));
  const num = (k, sch, help, structure = false) => row(k, numberControl(sch, spec[k], (v, final) => editSpec(s => { if (v === undefined) delete s[k]; else s[k] = v; }, { key: 'spec.' + k, structure: final && structure }), { slider: false }), help);
  sec.append(
    row('name', textControl(spec.name, v => editSpec(s => { s.name = v; }, { key: 'spec.name' }))),
    row('notes', textControl(spec.notes, v => editSpec(s => { if (v) s.notes = v; else delete s.notes; }, { key: 'spec.notes' }), { multiline: true, placeholder: 'what this piece is, for you and for Claude' })),
    num('duration', { step: 0.1 }, 'seconds', true),
    num('fps', { step: 1 }, 'frames per second for export and frame-stepping'),
    num('width', { step: 1 }, 'export width in pixels'),
    num('height', { step: 1 }, 'export height in pixels'),
    num('seed', { step: 1 }, 'changes every random pattern (particles, textures)'),
    row('background', colorControl(spec.background || '#000000', (v, final) => editSpec(s => { s.background = v; }, { key: 'spec.bg' }))),
    row('sound volume', numberControl({ type: 'number', min: 0, max: 1.5, step: 0.01 }, spec.audio?.volume ?? 0.85, (v, final) => editSpec(s => { (s.audio ||= {}).volume = v ?? 0.85; }, { key: 'spec.audio.volume' })), 'master volume of all sound'),
    row('reverb', numberControl({ type: 'number', min: 0, max: 1, step: 0.01 }, spec.audio?.reverb ?? 0.35, (v, final) => editSpec(s => { (s.audio ||= {}).reverb = v ?? 0.35; }, { key: 'spec.audio.reverb' })), 'how much room echo (0 = dry)'),
    row('reverb decay', numberControl({ type: 'number', min: 0.2, max: 12, step: 0.1 }, spec.audio?.decay ?? 5, (v, final) => editSpec(s => { (s.audio ||= {}).decay = v ?? 5; }, { key: 'spec.audio.decay' })), 'seconds the echo lasts: bigger = bigger room'),
    row('fonts', textControl((spec.fonts || []).join(', '), (v, final) => { if (final) editSpec(s => { s.fonts = v.split(',').map(x => x.trim()).filter(Boolean); }, { structure: true }); }, { placeholder: 'Inter, Jost:300' }), 'Google Fonts, "Family" or "Family:weight"')
  );
  root.append(sec);
}

// A cue: a one-shot sound at a moment. Drag its marker in the timeline to retime it.
function renderCue(root, { store, selected, select, player, audio }) {
  const i = selected.cue;
  const c = store.state.spec.cues[i];
  const full = cueWithDefaults(c);
  const editCue = (fn, opts = {}) => store.edit(s => fn(s.cues[i]), { source: 'inspector', ...opts });
  const sec = h('section', { class: 'insp-sec' },
    h('div', { class: 'insp-title' }, h('strong', {}, c.label || CUES[c.sound]?.label || c.sound), h('span', { class: 'badge' }, 'cue')),
    row('sound', selectControl(Object.keys(CUES), c.sound, v => editCue(x => { x.sound = v; delete x.note; delete x.length; }, { structure: true })), 'which instrument plays'),
    row('label', textControl(c.label, (v, final) => editCue(x => { if (v) x.label = v; else delete x.label; }, { key: `cue${i}.label`, structure: final }), { placeholder: 'e.g. Die lands' })),
    row(scrubLabel('at', { type: 'number', step: 0.01 }, () => store.state.spec.cues[i].at, (v, final) => editCue(x => { x.at = Math.max(0, +v.toFixed(3)); }, { key: `cue${i}.at`, structure: final })),
      numberControl({ step: 0.01 }, c.at, (v, final) => editCue(x => { x.at = Math.max(0, v ?? 0); }, { key: `cue${i}.at`, structure: final }), { slider: false }), 'seconds: when it plays'),
    CUES[c.sound]?.note ? row('note', textControl(c.note ?? '', (v, final) => { if (final) editCue(x => { if (v.trim()) x.note = v.trim(); else delete x.note; }, { structure: true }); }, { placeholder: CUES[c.sound].note }), 'pitch, e.g. C1; several notes separated by spaces make a chord') : null,
    row(scrubLabel('length', { type: 'number', step: 0.01 }, () => full.length, (v, final) => editCue(x => { x.length = Math.max(0.01, +v.toFixed(3)); }, { key: `cue${i}.length`, structure: final })),
      numberControl({ step: 0.01 }, c.length, (v, final) => editCue(x => { if (v === undefined) delete x.length; else x.length = Math.max(0.01, v); }, { key: `cue${i}.length`, structure: final }), { slider: false, placeholder: String(CUES[c.sound]?.length ?? '') }), 'seconds the note is held'),
    row('velocity', numberControl({ type: 'number', min: 0, max: 1, step: 0.01 }, full.velocity, (v, final) => editCue(x => { x.velocity = v ?? 1; }, { key: `cue${i}.velocity`, structure: final })), 'how hard it is struck, 0..1'),
    h('div', { class: 'btn-row' },
      h('button', { class: 'small', disabled: !audio?.on || undefined, title: audio?.on ? 'Play this cue now' : 'Turn Sound on first (under the stage)', onclick: () => audio.preview(store.state.comp, cueWithDefaults(store.state.spec.cues[i])) }, '▶ Preview'),
      h('button', { class: 'small', onclick: () => editCue(x => { x.at = +player.t.toFixed(2); }, { structure: true }) }, 'Move to playhead'),
      h('button', { class: 'small', onclick: () => { store.edit(s => { s.cues.splice(i, 1); if (!s.cues.length) delete s.cues; }, { source: 'inspector', structure: true }); select(null); } }, 'Delete cue'))
  );
  root.append(sec);
}

function row(label, control, help) {
  return h('div', { class: 'insp-row', title: help }, typeof label === 'string' ? h('span', { class: 'scrub-label plain' }, label) : label, control);
}

// Make sure the composition loads the font family + weight a text layer uses.
export function ensureFont(spec, layer) {
  const fam = layer.props?.font;
  if (!fam) return;
  const w = String(layer.props?.weight ?? 400) + (layer.props?.italic ? 'i' : '');
  const map = parseFonts(spec.fonts || []);
  const have = map.get(fam);
  if (have && (have.has(w) || (w === '400' && have.size === 0))) return;
  if (!have) map.set(fam, new Set([w]));
  else have.add(w);
  spec.fonts = [...map].map(([f, ws]) => (ws.size === 1 && ws.has('400')) ? f : `${f}:${[...ws].join(',')}`);
}
