// Timeline lanes, generated from the compiled `tracks` array (so the diagram can't drift from
// what actually plays). One lane per layer, one row per animation. Waves show as a dashed line
// across the whole piece, since they never stop.

export function buildTimeline(root, comp, { onScrub, onSelect, selected } = {}) {
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
    name.textContent = L.label || L.id;
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
          bar.onclick = e => { e.stopPropagation(); onSelect?.({ layerId: L.id, anim: k }); };
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
    if (e.target.closest('.tl-name, .tl-bar, .tl-wave')) return;
    onScrub?.(timeAt(e));
    const move = ev => onScrub?.(timeAt(ev));
    const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); };
    addEventListener('pointermove', move); addEventListener('pointerup', up);
  });

  return {
    update(t) {
      root.style.setProperty('--f', t / D);
      for (const b of bars.values()) b.el?.classList.toggle('on', t >= b.start && t <= b.end);
    }
  };
}

function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function fmt(v) { return v === undefined ? '(current)' : typeof v === 'number' ? +v.toFixed(3) : v; }
