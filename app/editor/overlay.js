// Editor-only drawing on top of the stage (never exported): a handle on the selected layer.
// Drag the handle to move the layer; this edits its base x / y.
import { propSchema } from '../engine/timeline.js';
import { findLayer } from './store.js';

// Where the layer's anchor ends up on screen, following its own offset and every parent group's transform.
function anchorPoint(comp, node, t, W, H) {
  const U = W / 100;
  const P = comp.resolve(node, 0, t);
  let x = (P.x ?? 50) / 100 * W + (P.dx || 0) * U, y = (P.y ?? 50) / 100 * H + (P.dy || 0) * U;
  for (let g = node.parent; g; g = g.parent) {
    const G = comp.resolve(g, 0, t);
    const ax = (G.x ?? 50) / 100 * W, ay = (G.y ?? 50) / 100 * H;
    const r = (G.rotate || 0) * Math.PI / 180, s = G.scale ?? 1;
    const vx = (x - ax) * s, vy = (y - ay) * s;
    x = ax + vx * Math.cos(r) - vy * Math.sin(r) + (G.dx || 0) * U;
    y = ay + vx * Math.sin(r) + vy * Math.cos(r) + (G.dy || 0) * U;
  }
  return { x, y };
}

export function createOverlay(canvas, { store, player, getSelected, onInfo }) {
  const ctx = canvas.getContext('2d');
  let handle = null;

  function draw() {
    const W = canvas.width = player.canvas.width, H = canvas.height = player.canvas.height;
    canvas.style.width = player.canvas.style.width; canvas.style.height = player.canvas.style.height;
    ctx.clearRect(0, 0, W, H);
    handle = null;
    const sel = getSelected(), comp = store.state.comp;
    if (!sel?.layerId || !comp) return;
    const node = comp.byId(sel.layerId);
    if (!node || !('x' in propSchema(node.type)) || node.type === 'group') return;
    const { x, y } = anchorPoint(comp, node, player.t, W, H);
    const dpr = W / parseFloat(canvas.style.width || W);
    const r = 7 * dpr;
    ctx.lineWidth = 1.5 * dpr;
    ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.beginPath(); ctx.arc(x, y, r + 1.5 * dpr, 0, 7); ctx.stroke();
    ctx.strokeStyle = '#a78bfa';
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.moveTo(x - r * 2, y); ctx.lineTo(x + r * 2, y); ctx.moveTo(x, y - r * 2); ctx.lineTo(x, y + r * 2); ctx.stroke();
    handle = { x: x / dpr, y: y / dpr };
  }

  canvas.addEventListener('pointermove', e => {
    if (canvas.hasPointerCapture(e.pointerId)) return;
    const near = handle && Math.hypot(e.offsetX - handle.x, e.offsetY - handle.y) < 16;
    canvas.style.cursor = near ? 'move' : 'default';
  });
  canvas.addEventListener('pointerdown', e => {
    if (!handle || Math.hypot(e.offsetX - handle.x, e.offsetY - handle.y) > 16) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    const id = getSelected().layerId;
    const L0 = findLayer(store.state.spec, id).layer;
    const defaults = store.state.comp.byId(id).base;
    const x0 = L0.props?.x ?? defaults.x, y0 = L0.props?.y ?? defaults.y;
    const w = parseFloat(canvas.style.width), hgt = parseFloat(canvas.style.height);
    const sx = e.clientX, sy = e.clientY;
    const move = ev => {
      const fine = ev.altKey ? 0.01 : 0.1;
      const nx = Math.round((x0 + (ev.clientX - sx) / w * 100) / fine) * fine, ny = Math.round((y0 + (ev.clientY - sy) / hgt * 100) / fine) * fine;
      store.edit(s => { const L = findLayer(s, id).layer; L.props ||= {}; L.props.x = +nx.toFixed(2); L.props.y = +ny.toFixed(2); }, { key: `${id}.drag`, source: 'stage' });
      onInfo?.(`${id}: x ${nx.toFixed(1)} %, y ${ny.toFixed(1)} %`);
    };
    const up = () => { canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); store.endGesture(); onInfo?.(null, true); };
    canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up);
  });
  return { draw };
}
