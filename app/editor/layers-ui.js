// The layer list: the composition's layer tree, back to front reading downwards
// (the first layer is painted first, so it sits at the back).
import { ELEMENTS } from '../engine/elements/index.js';
import { findLayer, uniqueId } from './store.js';
import { h } from './controls.js';

// Starting props for a new layer, so it shows up somewhere sensible
const STARTERS = {
  background: { props: { fill: '#14161c' } },
  group: { children: [] },
  glow: { props: { color: '#6ee7b780', width: 50, height: 30 } },
  text: { text: 'New text', props: { size: 6, font: 'Inter', color: '#ffffff' } },
  line: { props: { length: 30, color: '#ffffff' } },
  shape: { props: { shape: 'rect', width: 20, height: 12, fill: '#6ee7b7' } },
  particles: { props: { preset: 'embers', y: 85 } },
  noise: {},
  vignette: {}
};

export function renderLayers(root, { store, selected, select }) {
  root.innerHTML = '';
  const spec = store.state.spec;
  if (!spec) return;
  const selId = selected?.layerId;

  const addMenu = h('select', { class: 'add-layer', title: 'Add a layer', onchange: e => {
    const type = e.target.value; e.target.value = '';
    if (!type) return;
    const newId = uniqueId(spec, type);
    store.edit(s => {
      const L = { id: newId, type, ...JSON.parse(JSON.stringify(STARTERS[type] || {})) };
      if (type === 'text') L.props.y = 50;
      const f = selId && findLayer(s, selId);
      if (f && f.layer.type === 'group') (f.layer.children ||= []).push(L);         // into the selected group
      else if (f) f.list.splice(f.index + 1, 0, L);                                // just in front of the selection
      else (s.layers ||= []).push(L);
      if (type === 'text') { const fonts = new Set(s.fonts || []); if (![...fonts].some(x => x.split(':')[0] === 'Inter')) s.fonts = [...fonts, 'Inter']; }
    }, { structure: true });
    select({ layerId: newId });
  } }, h('option', { value: '' }, '+ Add layer'), Object.entries(ELEMENTS).map(([k, el]) => h('option', { value: k }, el.label)));

  const act = (label, title, fn, disabled) => h('button', { class: 'small', title, disabled: disabled || undefined, onclick: fn }, label);
  const f = selId && findLayer(spec, selId);
  const bar = h('div', { class: 'layers-actions' }, addMenu,
    act('⧉', 'Duplicate layer', () => {
      const copyId = uniqueId(spec, selId + '-copy');
      store.edit(s => {
        const x = findLayer(s, selId), L = JSON.parse(JSON.stringify(x.layer));
        const renumber = l => { l.id = l === L ? copyId : uniqueId(s, l.id + '-copy'); (l.children || []).forEach(renumber); };
        renumber(L);
        x.list.splice(x.index + 1, 0, L);
      }, { structure: true });
      select({ layerId: copyId });
    }, !f),
    act('↑', 'Move back (paint earlier)', () => store.edit(s => { const x = findLayer(s, selId); if (x.index > 0) x.list.splice(x.index - 1, 0, ...x.list.splice(x.index, 1)); }, { structure: true }), !f || f.index === 0),
    act('↓', 'Move forward (paint later)', () => store.edit(s => { const x = findLayer(s, selId); if (x.index < x.list.length - 1) x.list.splice(x.index + 1, 0, ...x.list.splice(x.index, 1)); }, { structure: true }), !f || f.index === f.list.length - 1),
    act('🗑', 'Delete layer (undo with Ctrl/Cmd+Z)', () => { store.edit(s => { const x = findLayer(s, selId); x.list.splice(x.index, 1); }, { structure: true }); select(null); }, !f)
  );
  root.append(bar);

  const list = h('div', { class: 'layer-list', role: 'tree' });
  const walk = (layers, depth) => (layers || []).forEach(L => {
    const item = h('div', { class: 'layer-item' + (L.id === selId ? ' sel' : '') + (L.hidden ? ' off' : ''), role: 'treeitem', 'aria-selected': String(L.id === selId) },
      h('button', { class: 'eye', title: L.hidden ? 'Show (also in export)' : 'Hide (also in export)', 'aria-label': L.hidden ? 'Show layer' : 'Hide layer',
        onclick: e => { e.stopPropagation(); store.edit(s => { const x = findLayer(s, L.id).layer; if (x.hidden) delete x.hidden; else x.hidden = true; }, { structure: true }); } }, L.hidden ? '◌' : '●'),
      h('button', { class: 'layer-name', style: `padding-left:${6 + depth * 14}px`, onclick: () => select(L.id === selId ? null : { layerId: L.id }) },
        h('span', {}, L.label || L.id), h('span', { class: 'type' }, L.type + (L.animate?.length ? ` · ${L.animate.length}` : ''))));
    list.append(item);
    walk(L.children, depth + 1);
  });
  walk(spec.layers, 0);
  root.append(list);
}
