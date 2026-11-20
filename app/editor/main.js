// Motion Studio editor: loads a composition, plays it, and (from milestone 2) edits it.
import { compile } from '../engine/timeline.js';
import { loadFonts } from '../engine/fonts.js';
import { Player } from './player.js';
import { buildTimeline } from './timeline-ui.js';

const $ = id => document.getElementById(id);
const state = { name: null, spec: null, comp: null, timeline: null, selected: null };

const player = new Player($('stage'), { onTick: updateUI });

function updateUI(t) {
  const comp = state.comp; if (!comp) return;
  $('readout').textContent = `${t.toFixed(2)} s`;
  $('scrub').value = Math.round(t / comp.duration * 1000);
  $('playBtn').textContent = player.playing ? 'Pause' : 'Play';
  state.timeline?.update(t);
}

function status(msg, kind = '') { $('status').textContent = msg; $('status').className = 'status ' + kind; }

// Turn the JSON into something playable. Errors are shown, and the last good version keeps playing.
function applySpec(spec) {
  const comp = compile(spec);
  const box = $('errors');
  if (comp.errors.length) {
    box.hidden = false;
    box.textContent = `This composition has ${comp.errors.length} problem${comp.errors.length > 1 ? 's' : ''}:\n` + comp.errors.join('\n');
    if (state.comp) return false;
  } else box.hidden = true;
  state.spec = spec;
  state.comp = comp;
  player.setComp(comp);
  rebuildTimeline();
  loadFonts(spec.fonts).then(() => player.invalidate());
  return true;
}

function rebuildTimeline() {
  state.timeline = buildTimeline($('timeline'), state.comp, {
    selected: state.selected,
    onScrub: t => { player.pause(); player.seek(t); },
    onSelect: sel => { state.selected = sel; rebuildTimeline(); player.invalidate(); }
  });
  state.timeline.update(player.t);
}

async function load(name) {
  const res = await fetch('/api/compositions/' + encodeURIComponent(name));
  if (!res.ok) { status(`Couldn't load "${name}"`, 'warn'); return; }
  let spec;
  try { spec = await res.json(); }
  catch (e) { $('errors').hidden = false; $('errors').textContent = `${name}.json is not valid JSON: ${e.message}`; return; }
  if (state.name !== name) { state.selected = null; player.seek(0); }
  state.name = name;
  try { localStorage.setItem('ms.last', name); } catch {}
  const url = new URL(location.href); url.searchParams.set('c', name); history.replaceState(null, '', url);
  $('compSelect').value = name;
  if (applySpec(spec)) status(`${spec.name || name} · ${state.comp.duration} s · ${state.comp.tracks.length} tracks`);
}

async function init() {
  const names = await (await fetch('/api/compositions')).json();
  $('compSelect').innerHTML = names.map(n => `<option value="${n}">${n}</option>`).join('');
  let saved = null; try { saved = localStorage.getItem('ms.last'); } catch {}
  const want = new URLSearchParams(location.search).get('c') || saved;
  const first = names.includes(want) ? want : names[0];
  if (first) { await load(first); if (!matchMedia('(prefers-reduced-motion: reduce)').matches) player.play(); }
  else status('No compositions yet: ask Claude Code to make one in compositions/', 'warn');

  // Live reload: the server tells us when a composition file changed on disk.
  const ev = new EventSource('/api/events');
  ev.addEventListener('changed', e => {
    const { name } = JSON.parse(e.data);
    if (name === state.name) { load(name).then(() => status(`Reloaded: ${name}.json changed on disk`)); }
    else if (![...$('compSelect').options].some(o => o.value === name)) refreshList();
  });
}
async function refreshList() {
  const names = await (await fetch('/api/compositions')).json();
  $('compSelect').innerHTML = names.map(n => `<option value="${n}">${n}</option>`).join('');
  $('compSelect').value = state.name;
}

// Controls
$('compSelect').onchange = e => load(e.target.value);
$('playBtn').onclick = () => player.toggle();
$('replayBtn').onclick = () => player.replay();
const frameStep = dir => { player.pause(); const f = 1 / state.comp.fps; player.seek(Math.round(player.t / f + dir) * f); };
$('prevFrame').onclick = () => frameStep(-1);
$('nextFrame').onclick = () => frameStep(1);
$('scrub').oninput = e => { player.pause(); player.seek(e.target.value / 1000 * state.comp.duration); };
$('loop').onchange = e => { player.loop = e.target.checked; };
addEventListener('keydown', e => {
  if (e.target.closest('input, textarea, select, [contenteditable]')) return;
  if (e.code === 'Space') { e.preventDefault(); player.toggle(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); frameStep(-1); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); frameStep(1); }
  else if (e.key === 'Home') player.seek(0);
});

window.studio = { player, state, load };   // handy from the browser console
init();
