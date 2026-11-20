// Render a composition's sound to an AudioBuffer, faster than real time, for export.
// The same graph as live playback; the difference is that every change is *scheduled*:
//   • bed values are sampled every 10 ms and written as automation ramps,
//   • each cue is scheduled at exactly its `at`,
//   • crackle pops at their seeded times.
import { buildGraph } from './graph.js';
import { popCandidates, popHappens } from './sounds.js';

export async function renderAudio(comp, { sampleRate = 48000 } = {}) {
  const Tone = window.Tone;
  if (!Tone) throw new Error('Tone.js is not loaded');
  const STEP = 0.01;
  const buffer = await Tone.Offline(async () => {
    const g = buildGraph(Tone, comp);
    await g.ready;                                   // the reverb builds its echo first
    for (let i = 0; i * STEP <= comp.duration + 1e-9; i++) {
      const t = i * STEP;
      comp.evaluate(t);
      for (const { node, inst } of g.beds) {
        const P = comp.resolve(node, 0, t);
        inst.set({ ...P, volume: node.src.hidden ? 0 : P.volume }, t);
      }
    }
    for (const { node, inst } of g.beds) {
      if (!inst.pop || node.src.hidden) continue;
      for (const c of popCandidates(node.src.id, node.base.seed, comp.duration)) {
        comp.evaluate(c.t);
        const P = comp.resolve(node, 0, c.t);
        if (popHappens(c, P.rate) && P.volume > 0) inst.pop(c.t, c.v * P.volume);
      }
    }
    for (const c of comp.cues) if (c.at < comp.duration) g.instruments[c.sound].play(c, c.at);
  }, comp.duration, 2, sampleRate);
  return buffer.get();
}
