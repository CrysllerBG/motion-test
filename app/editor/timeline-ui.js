// Timeline lanes, generated from the compiled `tracks` array (so the diagram can't drift from
// what actually plays). One lane per layer, one row per animation. Waves show as a dashed line
// across the whole piece, since they never stop.

export function buildTimeline(root, comp, { onScrub, onSelect, selected, onRetime, onInfo, onCueMove, onAddCue } = {}) {
  root.innerHTML = '';
  const D = comp.duration;
  const pct = s => (s / D * 100) + '%';

  const body = el('div', 'tl-body');
  const playhead = el('div', 'tl-playhead');
  root.append(body);

  // Group tracks into bars: one bar per (layer, animation), spanning all its staggered units.
  const bars = new Map();
  for (const tr of comp.tracks) {
    const id = `${tr.layerId}/${tr.anim}`;
    const b = bars.get(id) || { layerId: tr.layerId, anim: tr.anim, prop: tr.prop, label: tr.label, start: Infinity, end: -Infinity, units: [] };
    b.start = Math.min(b.start, tr.start);
    b.end = Math.max(b.end, tr.start + tr.duration);
    b.units.push(tr);
    bars.set(id, b);
  }

  const rows = [];
  const depthOf = n => { let d = 0; while (n.parent) { d++; n = n.parent; } return d; };
  for (const node of comp.nodes) {
    const L = node.src;
    const lane = el('div', 'tl-lane' + (selected?.layerId === L.id ? ' sel' : ''));
    const name = el('button', 'tl-name');
    name.style.paddingLeft = (8 + depthOf(node) * 12) + 'px';
    name.textContent = (node.sound ? '♪ ' : '') + (L.label || L.id);
    name.title = `${L.id} · ${L.type}`;
    name.onclick = () => onSelect?.({ layerId: L.id });
    lane.append(name);
    const rowsEl = el('div', 'tl-rows');
    const anims = L.animate || [];
    if (!anims.length) rowsEl.append(el('div', 'tl-row empty'));
    anims.forEach((a, k) => {
      const row = el('div', 'tl-row');
      if (a.wave) {
        const w = el('div', 'tl-wave');
        w.title = `${a.prop}: wave, every ${a.wave.period} s, ±${a.wave.amp}`;
        w.textContent = a.prop + ' ∿';
        w.onclick = e => { e.stopPropagation(); onSelect?.({ layerId: L.id, anim: k }); };
        row.append(w);
      } else {
        const b = bars.get(`${L.id}/${k}`);
        if (b) {
          const bar = el('div', 'tl-bar');
          bar.style.left = pct(b.start);
          bar.style.width = `max(4px, ${pct(b.end - b.start)})`;
          bar.textContent = a.label || a.prop;
          bar.title = `${a.prop}: ${fmt(a.from)} → ${fmt(a.to)} · ${b.start.toFixed(2)}–${b.end.toFixed(2)} s · ${a.ease || 'linear'}` + (b.units.length > 1 ? ` · ${b.units.length} pieces staggered` : '');
          if (b.units.length > 1) bar.classList.add('staggered');
          if (selected?.layerId === L.id && selected?.anim === k) bar.classList.add('sel');
          bar.onclick = e => e.stopPropagation();
          bar.addEventListener('pointerdown', e => startDrag(e, bar, b, a, L.id, k));
          bar.addEventListener('pointermove', e => { if (!dragging) bar.style.cursor = edgeAt(e, bar) ? 'ew-resize' : 'grab'; });
          b.el = bar;
          row.append(bar);
        }
      }
      rowsEl.append(row);
    });
    lane.append(rowsEl);
    body.append(lane);
    rows.push(lane);
  }

  // ---- Cues lane: one-shot sounds as markers. Drag to retime, click to select. ----
  const cueLane = el('div', 'tl-lane tl-cues' + (selected?.cue !== undefined ? ' sel' : ''));
  const cueName = el('div', 'tl-name tl-cue-name');
  cueName.append(Object.assign(el('span'), { textContent: '♪ Cues' }));
  const addCue = el('button', 'tl-add'); addCue.textContent = '+'; addCue.title = 'Add a sound cue at the playhead';
  addCue.onclick = e => { e.stopPropagation(); onAddCue?.(); };
  cueName.append(addCue);
  cueLane.append(cueName);
  const cueRow = el('div', 'tl-rows'); cueLane.append(cueRow);
  const cueEls = [];
  // Markers that would overlap go on the next row down (like stacked clips in a video editor).
  const trackPx = Math.max(200, (root.clientWidth || 1000) - 160);
  const rowEnds = [];
  const cueTrackFor = c => {
    const txt = c.label || c.sound, start = c.at / D * trackPx, end = start + txt.length * 6.2 + 24;
    let r = rowEnds.findIndex(e => e <= start);
    if (r < 0) { r = rowEnds.length; const tr = el('div', 'tl-row tl-cue-row'); cueRow.append(tr); }
    rowEnds[r] = end;
    return cueRow.children[r];
  };
  if (!comp.cues.length) cueRow.append(el('div', 'tl-row tl-cue-row'));
  for (const c of comp.cues) {
    const cueTrack = cueTrackFor(c);
    const m = el('div', 'tl-cue' + (selected?.cue === c.i ? ' sel' : ''));
    m.style.left = pct(c.at);
    m.textContent = c.label || c.sound;
    m.title = `${c.label ? c.label + ' · ' : ''}${c.sound} at ${c.at.toFixed(2)} s · drag to retime`;
    m.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      const r = cueTrack.getBoundingClientRect(), x0 = e.clientX; let moved = false, last = c.at;
      m.setPointerCapture(e.pointerId);
      onSelect?.({ cue: c.i }, { quiet: true });
      const move = ev => {
        if (!moved && Math.abs(ev.clientX - x0) < 3) return;
        moved = true;
        let at = c.at + (ev.clientX - x0) / r.width * D;
        at = Math.max(0, Math.min(D, ev.altKey ? +at.toFixed(3) : Math.round(at / 0.05) * 0.05));
        at = +at.toFixed(3);
        if (at === last) return;
        last = at; m.style.left = pct(at);
        onCueMove?.(c.i, at, false);
        onInfo?.(`${c.label || c.sound}: ${at.toFixed(2)} s` + (ev.altKey ? '' : '  (hold Alt to move freely)'));
      };
      const up = () => {
        m.removeEventListener('pointermove', move); m.removeEventListener('pointerup', up);
        if (moved) onCueMove?.(c.i, last, true); else onSelect?.({ cue: c.i });
      };
      m.addEventListener('pointermove', move); m.addEventListener('pointerup', up);
    });
    cueTrack.append(m); cueEls.push([c, m]);
  }
  body.append(cueLane);

  // Time ruler with a tick every second (or every 2/5 s on long pieces)
  const ruler = el('div', 'tl-ruler');
  ruler.append(el('span', 'tl-name-spacer'));
  const ticks = el('div', 'tl-ticks');
  const step = D <= 12 ? 1 : D <= 30 ? 2 : 5;
  for (let s = 0; s <= D + 1e-9; s += step) {
    const tk = el('span'); tk.textContent = s + 's'; tk.style.left = pct(s); ticks.append(tk);
  }
  ruler.append(ticks);
  root.append(ruler);
  body.append(playhead);

  // Click or drag anywhere in the lanes' time area to scrub
  const timeAt = e => {
    const r = body.querySelector('.tl-rows')?.getBoundingClientRect() || ticks.getBoundingClientRect();
    return Math.max(0, Math.min(D, (e.clientX - r.left) / r.width * D));
  };
  const scrubArea = [body, ruler];
  for (const area of scrubArea) area.addEventListener('pointerdown', e => {
    if (e.target.closest('.tl-name, .tl-bar, .tl-wave, .tl-cue')) return;
    onScrub?.(timeAt(e));
    const move = ev => onScrub?.(timeAt(ev));
    const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); };
    addEventListener('pointermove', move); addEventListener('pointerup', up);
  });

  // ---- Dragging bars: move (middle), change start (left edge) or duration (right edge) ----
  let dragging = false;
  function edgeAt(e, bar) {
    const r = bar.getBoundingClientRect();
    if (r.width < 18) return e.clientX > r.right - 5 ? 'right' : null;
    if (e.clientX - r.left < 6) return 'left';
    if (r.right - e.clientX < 6) return 'right';
    return null;
  }
  function startDrag(e, bar, b, a, layerId, k) {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    onSelect?.({ layerId, anim: k }, { quiet: true });
    const mode = edgeAt(e, bar) || 'move';
    const track = bar.parentElement.getBoundingClientRect();
    const x0 = e.clientX, s0 = a.start, d0 = a.duration, offset = b.start - a.start, span = b.end - b.start - a.duration;
    let moved = false, last = null;
    bar.setPointerCapture(e.pointerId);
    dragging = true;
    const move = ev => {
      let dt = (ev.clientX - x0) / track.width * D;
      if (!moved && Math.abs(ev.clientX - x0) < 3) return;
      moved = true;
      const snap = v => ev.altKey ? +v.toFixed(3) : Math.round(v / 0.05) * 0.05;
      let start = s0, dur = d0;
      if (mode === 'move') start = Math.max(0, snap(s0 + dt));
      else if (mode === 'right') dur = Math.max(0, snap(s0 + d0 + dt) - s0);
      else { start = Math.min(s0 + d0, Math.max(0, snap(s0 + dt))); dur = s0 + d0 - start; }
      start = +start.toFixed(3); dur = +dur.toFixed(3);
      if (last && last.start === start && last.dur === dur) return;
      last = { start, dur };
      bar.style.left = pct(start + offset);
      bar.style.width = `max(4px, ${pct(dur + span)})`;
      onRetime?.(layerId, k, { start, duration: dur }, false);
      onInfo?.(`${a.prop}: start ${start.toFixed(2)} s · duration ${dur.toFixed(2)} s · ends ${(start + dur + span).toFixed(2)} s` + (ev.altKey ? '' : '  (hold Alt to move freely)'));
    };
    const up = () => {
      bar.removeEventListener('pointermove', move); bar.removeEventListener('pointerup', up); bar.removeEventListener('pointercancel', up);
      dragging = false;
      if (moved && last) onRetime?.(layerId, k, { start: last.start, duration: last.dur }, true);
      else onSelect?.({ layerId, anim: k });
    };
    bar.addEventListener('pointermove', move); bar.addEventListener('pointerup', up); bar.addEventListener('pointercancel', up);
  }

  return {
    update(t) {
      root.style.setProperty('--f', t / D);
      for (const b of bars.values()) b.el?.classList.toggle('on', t >= b.start && t <= b.end);
      for (const [c, m] of cueEls) m.classList.toggle('on', t >= c.at && t <= c.at + 0.25);
    }
  };
}

function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function fmt(v) { return v === undefined ? '(current)' : typeof v === 'number' ? +v.toFixed(3) : v; }
