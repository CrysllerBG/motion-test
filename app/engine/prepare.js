// Everything a composition needs before its frames can be painted exactly:
// its fonts (listed in "fonts", plus any a layer names) and, if it has 3D layers, Three.js.
// The editor, the frame renderer and the exporter all wait for this.
import { loadFonts } from './fonts.js';

export async function prepare(comp) {
  const fonts = [...(comp.spec.fonts || [])];
  const listed = new Set(fonts.map(f => f.split(':')[0]));
  for (const n of comp.nodes) {
    const f = n.base.font;
    if (typeof f === 'string' && f && !listed.has(f)) { fonts.push(`${f}:${n.base.weight ?? 400}${n.base.italic ? 'i' : ''}`); listed.add(f); }
  }
  const jobs = [loadFonts(fonts)];
  for (const el of new Set(comp.nodes.map(n => n.el))) if (el.prepare) jobs.push(el.prepare());
  await Promise.all(jobs);
}
