// The editor's single source of truth: the composition spec (plain JSON) plus undo history.
// Every change goes through edit(), which snapshots the spec first, applies the change and
// recompiles. Because compile → evaluate → paint is a pure function of (spec, t), the
// picture after an edit is correct immediately, with nothing to reset.
import { compile } from '../engine/timeline.js';
import { formatJSON, normalize } from './format.js';

export function createStore({ onChange }) {
  const s = {
    name: null, spec: null, comp: null, errors: [],
    savedText: null,                 // the file as last loaded/saved, to know if we're "dirty"
    undo: [], redo: [], lastKey: null, lastTime: 0
  };
  const text = () => formatJSON(normalize(s.spec));

  function recompile() {
    const comp = compile(s.spec);
    s.errors = comp.errors;
    if (!comp.errors.length || !s.comp) s.comp = comp;   // keep playing the last good version
  }

  return {
    get state() { return s; },
    get dirty() { return s.spec && text() !== s.savedText; },
    text,
    load(name, spec) {
      s.name = name; s.spec = spec; s.savedText = formatJSON(normalize(spec));
      s.undo = []; s.redo = []; s.lastKey = null; s.comp = null;
      recompile();
      onChange({ source: 'load', structure: true });
    },
    // Replace the spec with a version from disk but keep it undoable
    replaceFromDisk(spec) {
      s.undo.push(JSON.stringify(s.spec)); s.redo = [];
      s.spec = spec; s.savedText = formatJSON(normalize(spec)); s.lastKey = null;
      recompile();
      onChange({ source: 'disk', structure: true });
    },
    // fn mutates the spec in place. `key` lets a burst of changes to the same field
    // (dragging a slider) collapse into one undo step.
    edit(fn, { key = null, source = null, structure = false } = {}) {
      const now = performance.now();
      if (!(key && key === s.lastKey && now - s.lastTime < 800)) { s.undo.push(JSON.stringify(s.spec)); s.redo = []; if (s.undo.length > 200) s.undo.shift(); }
      s.lastKey = key; s.lastTime = now;
      fn(s.spec);
      recompile();
      onChange({ source, structure });
    },
    endGesture() { s.lastKey = null; },
    undo() {
      if (!s.undo.length) return false;
      s.redo.push(JSON.stringify(s.spec)); s.spec = JSON.parse(s.undo.pop()); s.lastKey = null;
      recompile(); onChange({ source: 'undo', structure: true }); return true;
    },
    redo() {
      if (!s.redo.length) return false;
      s.undo.push(JSON.stringify(s.spec)); s.spec = JSON.parse(s.redo.pop()); s.lastKey = null;
      recompile(); onChange({ source: 'redo', structure: true }); return true;
    },
    async save() {
      const body = text();
      const res = await fetch('/api/compositions/' + encodeURIComponent(s.name), { method: 'PUT', body, headers: { 'Content-Type': 'application/json' } });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
      s.savedText = body;
      onChange({ source: 'save' });
    }
  };
}

// Helpers to find things inside the spec by layer id
export function findLayer(spec, id, list = spec.layers, parent = null) {
  for (let i = 0; i < (list || []).length; i++) {
    const L = list[i];
    if (L.id === id) return { layer: L, list, index: i, parent };
    if (L.children) { const r = findLayer(spec, id, L.children, L); if (r) return r; }
  }
  return null;
}
export function allIds(spec) {
  const ids = new Set();
  const walk = list => (list || []).forEach(L => { ids.add(L.id); walk(L.children); });
  walk(spec.layers);
  return ids;
}
export function uniqueId(spec, base) {
  const ids = allIds(spec);
  base = String(base).replace(/[^a-zA-Z0-9_-]/g, '') || 'layer';
  if (!ids.has(base)) return base;
  let n = 2; while (ids.has(base + n)) n++;
  return base + n;
}
