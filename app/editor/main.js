// Motion Studio editor: wires the store (spec + undo), the player, the panels and the server.
import { loadFonts } from '../engine/fonts.js';
import { Player } from './player.js';
import { buildTimeline } from './timeline-ui.js';
import { createStore, findLayer } from './store.js';
import { renderInspector } from './inspector.js';
import { renderLayers } from './layers-ui.js';
import { createOverlay } from './overlay.js';
import { openExportDialog } from './export-ui.js';
import { LiveAudio } from '../engine/audio/live.js';
import { hasSound } from '../engine/audio/graph.js';

const $ = id => document.getElementById(id);
let selected = null;           // { layerId, anim? }
let timeline = null;
let fontsKey = '';
let infoTimer = null;

const store = createStore({ onChange });
const audio = new LiveAudio();
const player = new Player($('stage'), { container: $('stageBox'), onTick });
const overlay = createOverlay($('overlay'), { store, player, getSelected: () => selected, onInfo: info });
player.onResize = () => overlay.draw();

function onTick(t) {
  const comp = store.state.comp; if (!comp) return;
  $('readout').textContent = `${t.toFixed(2)} s`;
  $('scrub').value = Math.round(t / comp.duration * 1000);
  $('playBtn').textContent = player.playing ? 'Pause' : 'Play';
  timeline?.update(t);
  overlay.draw();
  audio.update(comp, t, player.playing);   // sound follows the same t as the picture
}

// Called after every change to the spec. `source` says who made it, so the panel that
// made a change isn't rebuilt under the user's pointer while they're still dragging.
function onChange({ source, structure }) {
  const s = store.state;
  if (!s.comp) return;
  player.setComp(s.comp);
  if (selected?.layerId && !findLayer(s.spec, selected.layerId)) selected = null;
  if (selected?.cue !== undefined && !s.spec.cues?.[selected.cue]) selected = null;

  const box = $('errors');
  box.hidden = !s.errors.length;
  if (s.errors.length) box.textContent = `${s.errors.length} problem${s.errors.length > 1 ? 's' : ''} (the last working version keeps playing):\n` + s.errors.join('\n');

  if (source !== 'timeline' || structure) rebuildTimeline();
  if (source !== 'inspector' || structure) rebuildInspector();
  if (structure || ['load', 'undo', 'redo', 'disk'].includes(source)) renderLayers($('layers'), { store, selected, select });

  const key = JSON.stringify(s.spec.fonts || []);
  if (key !== fontsKey) { fontsKey = key; loadFonts(s.spec.fonts).then(() => player.invalidate()); }
  $('scrub').max = 1000;
  updateSaveState();
  player.invalidate();
}

function rebuildTimeline() {
  timeline = buildTimeline($('timeline'), store.state.comp, {
    selected,
    onScrub: t => { player.pause(); player.seek(t); },
    onSelect: (sel, opts) => select(sel, opts),
    onRetime: (layerId, k, { start, duration }, final) => {
      store.edit(spec => { const a = findLayer(spec, layerId).layer.animate[k]; a.start = start; a.duration = duration; },
        { key: `${layerId}.anim${k}.time`, source: 'timeline', structure: final });
      if (final) { store.endGesture(); info(null, true); }
    },
    onInfo: info,
    onCueMove: (i, at, final) => {
      store.edit(spec => { spec.cues[i].at = at; }, { key: `cue${i}.at`, source: 'timeline', structure: final });
      if (final) { store.endGesture(); info(null, true); }
    },
    onAddCue: () => {
      const at = +player.t.toFixed(2);
      store.edit(spec => { (spec.cues ||= []).push({ at, sound: 'boom' }); }, { structure: true });
      select({ cue: store.state.spec.cues.length - 1 });
    }
  });
  timeline.update(player.t);
}
function rebuildInspector() {
  renderInspector($('inspector'), { store, selected, select, player, audio });
}

function select(sel, { quiet = false } = {}) {
  selected = sel;
  rebuildInspector();
  overlay.draw();
  if (quiet) return;             // mid-drag in the timeline: don't rebuild it under the pointer
  rebuildTimeline();
  renderLayers($('layers'), { store, selected, select });
}

function info(msg, done) {
  clearTimeout(infoTimer);
  if (msg) { $('status').textContent = msg; $('status').className = 'status'; }
  if (done) infoTimer = setTimeout(updateSaveState, 1200);
}
function updateSaveState() {
  const s = store.state;
  const dirty = store.dirty;
  $('saveBtn').classList.toggle('dirty', dirty);
  $('saveBtn').textContent = dirty ? 'Save •' : 'Saved';
  $('undoBtn').disabled = !s.undo.length;
  $('redoBtn').disabled = !s.redo.length;
  $('status').className = 'status' + (s.errors.length ? ' warn' : '');
  $('status').textContent = `${s.spec.name || s.name} · ${s.comp.duration} s · ${s.comp.tracks.length} tracks` + (s.errors.length ? ' · has problems' : '');
  document.title = (dirty ? '• ' : '') + (s.spec.name || s.name) + ' · Motion Studio';
}

async function save() {
  try {
    await store.save();
    info(`Saved compositions/${store.state.name}.json`, true);
  } catch (e) { info(`Save failed: ${e.message}`); $('status').className = 'status warn'; }
}

async function load(name, { keepTime = false } = {}) {
  const res = await fetch('/api/compositions/' + encodeURIComponent(name));
  if (!res.ok) { info(`Couldn't load "${name}"`); return; }
  let spec;
  try { spec = await res.json(); }
  catch (e) { $('errors').hidden = false; $('errors').textContent = `${name}.json is not valid JSON: ${e.message}`; return; }
  selected = null;
  if (!keepTime) player.seek(0);
  store.load(name, spec);
  try { localStorage.setItem('ms.last', name); } catch {}
  const url = new URL(location.href); url.searchParams.set('c', name); history.replaceState(null, '', url);
  $('compSelect').value = name;
}

async function refreshList(selectName) {
  const names = await (await fetch('/api/compositions')).json();
  $('compSelect').innerHTML = names.map(n => `<option value="${n}">${n}</option>`).join('');
  if (selectName) $('compSelect').value = selectName;
  return names;
}

async function init() {
  const names = await refreshList();
  let saved = null; try { saved = localStorage.getItem('ms.last'); } catch {}
  const want = new URLSearchParams(location.search).get('c') || saved;
  const first = names.includes(want) ? want : names[0];
  if (first) { await load(first); if (!matchMedia('(prefers-reduced-motion: reduce)').matches) player.play(); }
  else info('No compositions yet: click New, or ask Claude Code to make one');

  // Live reload: the server tells us when a composition file changed on disk (e.g. Claude Code edited it).
  const ev = new EventSource('/api/events');
  ev.addEventListener('changed', async e => {
    const { name } = JSON.parse(e.data);
    if (name !== store.state.name) { refreshList(store.state.name); return; }
    const res = await fetch('/api/compositions/' + encodeURIComponent(name));
    let spec; try { spec = await res.json(); } catch { info(`${name}.json changed on disk but isn't valid JSON yet`); return; }
    if (store.dirty && !confirm(`${name}.json was changed on disk (maybe by Claude Code).\n\nLoad the new version? Your unsaved edits stay reachable with Undo.\nCancel keeps your version; saving will overwrite the file.`)) return;
    store.replaceFromDisk(spec);
    info(`Reloaded: ${name}.json changed on disk`, true);
  });
}

// ---- Controls ----
$('compSelect').onchange = e => {
  if (store.dirty && !confirm('You have unsaved changes. Switch anyway? (They will be lost.)')) { e.target.value = store.state.name; return; }
  load(e.target.value);
};
$('newBtn').onclick = async () => {
  if (store.dirty && !confirm('You have unsaved changes. Start a new composition anyway?')) return;
  let name = prompt('Name for the new composition (letters, digits, - and _):', 'untitled');
  if (!name) return;
  name = name.trim().toLowerCase().replace(/\s+/g, '-');
  if (!/^[a-z0-9][a-z0-9_-]{0,80}$/.test(name)) { alert('Use letters, digits, - and _ only.'); return; }
  const names = await refreshList();
  if (names.includes(name)) { alert(`"${name}" already exists.`); return; }
  const spec = { name, duration: 5, fps: 30, width: 1920, height: 1080, seed: 1, background: '#0e0f12', fonts: ['Inter:600'],
    layers: [{ id: 'title', type: 'text', text: name.replace(/-/g, ' '), props: { y: 50, size: 7, font: 'Inter', weight: 600, color: '#ffffff' },
      animate: [{ prop: 'opacity', from: 0, to: 1, start: 0.3, duration: 0.8, ease: 'outCubic' }] }] };
  await fetch('/api/compositions/' + name, { method: 'PUT', body: JSON.stringify(spec, null, 2) });
  await refreshList(name);
  await load(name);
};
$('undoBtn').onclick = () => store.undo();
$('redoBtn').onclick = () => store.redo();
$('saveBtn').onclick = save;
$('exportBtn').onclick = () => openExportDialog($('exportDialog'), { comp: store.state.comp, spec: store.state.spec, name: store.state.name, errors: store.state.errors });
$('playBtn').onclick = () => player.toggle();
$('replayBtn').onclick = () => player.replay();
const frameStep = dir => { player.pause(); const f = 1 / store.state.comp.fps; player.seek(Math.round(player.t / f + dir) * f); };
$('prevFrame').onclick = () => frameStep(-1);
$('nextFrame').onclick = () => frameStep(1);
$('scrub').oninput = e => { player.pause(); player.seek(e.target.value / 1000 * store.state.comp.duration); };
$('loop').onchange = e => { player.loop = e.target.checked; };
$('soundBtn').onclick = async () => {
  const btn = $('soundBtn');
  if (!audio.available) { info('Sound unavailable: Tone.js did not load'); return; }
  if (audio.on) audio.disable(); else await audio.enable(store.state.comp);
  player.setClock(audio.on ? () => audio.clock() : null);   // sound on: the audio clock drives time
  btn.textContent = audio.on ? 'Sound on' : 'Sound off';
  btn.setAttribute('aria-pressed', String(audio.on));
  if (audio.on && !hasSound(store.state.comp)) info('This composition has no sound yet: add a sound bed (Layers panel) or a cue (+ in the Cues lane)', true);
  if (selected?.cue !== undefined) rebuildInspector();   // enables the Preview button
};

addEventListener('keydown', e => {
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); save(); return; }
  if (e.target.closest('input, textarea, select, [contenteditable]')) return;
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? store.redo() : store.undo(); }
  else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); store.redo(); }
  else if (e.code === 'Space') { e.preventDefault(); player.toggle(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); frameStep(-1); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); frameStep(1); }
  else if (e.key === 'Home') player.seek(0);
  else if (e.key === 'Escape') select(null);
});
addEventListener('beforeunload', e => { if (store.dirty) { e.preventDefault(); e.returnValue = ''; } });

window.studio = { player, store, audio, load, select, get selected() { return selected; } };   // handy from the console (and for tests)
init();
