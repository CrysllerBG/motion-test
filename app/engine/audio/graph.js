// Build the Tone.js node graph for a composition. Used both live (in the editor) and offline
// (for export), so what you hear while editing is what ends up in the video.
//
//   beds ─┐
//   cues ─┴→ reverb (stone-room echo) → master volume → speakers / offline buffer
import { BEDS, CUES } from './sounds.js';

export function buildGraph(Tone, comp) {
  const A = comp.audio;
  const master = new Tone.Gain(A.volume).toDestination();
  const reverb = new Tone.Reverb({ decay: A.decay, preDelay: 0.03, wet: A.reverb }).connect(master);
  const beds = comp.soundNodes.map(node => ({ node, inst: BEDS[node.type].create(Tone, reverb, node.base) }));
  const instruments = {};
  for (const c of comp.cues) if (!instruments[c.sound]) instruments[c.sound] = CUES[c.sound].create(Tone, reverb);
  return {
    master, reverb, beds, instruments, ready: reverb.ready,
    dispose() {
      // Disconnecting the master silences everything; Tone frees the nodes when they're collected.
      try { master.disconnect(); master.dispose(); } catch {}
    }
  };
}

// Which parts of the composition need a rebuilt graph (types, ids, instruments, room settings).
// Animated values don't: those are applied every frame.
export function graphKey(comp) {
  return JSON.stringify([comp.audio, comp.soundNodes.map(n => [n.src.id, n.type, n.base.noise, n.base.filter, n.base.wave]), [...new Set(comp.cues.map(c => c.sound))].sort()]);
}
export const hasSound = comp => comp.soundNodes.some(n => !n.src.hidden) || comp.cues.length > 0;
