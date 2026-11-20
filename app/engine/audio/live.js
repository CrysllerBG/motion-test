// Live sound in the editor. Called once per painted frame with the current time.
//   • Beds: their resolved props (volume, cutoff…) glide to the new values.
//   • Cues and crackle pops: scheduled slightly ahead (LOOKAHEAD) at their exact moment,
//     instead of "on the next frame", so they're sample-accurate rather than up to a frame late.
//   • Paused or scrubbing: beds fade to silence and nothing fires (principle 6).
import { buildGraph, graphKey } from './graph.js';
import { popCandidates, popHappens } from './sounds.js';

const LOOKAHEAD = 0.12;   // seconds of upcoming events handed to the audio clock each frame

export class LiveAudio {
  constructor() { this.on = false; this.graph = null; this.key = null; this.lastT = null; this.until = 0; this.wasPlaying = false; this.fired = []; this.last = {}; }
  // The audio clock, in seconds: the player follows it while sound is on
  clock() { return Tone.getContext().rawContext.currentTime; }
  // Tone's synths refuse events earlier than ones already scheduled on them. Small clock jitter
  // could produce that, so each instrument's event times are kept increasing.
  when(key, time) { const t = Math.max(time, (this.last[key] ?? 0) + 0.002); this.last[key] = t; return t; }
  get available() { return typeof window.Tone === 'object'; }

  async enable(comp) {
    await Tone.start();                        // browsers only allow audio after a click
    this.on = true;
    this.rebuild(comp);
  }
  disable() {
    this.on = false;
    if (this.graph) { this.graph.dispose(); this.graph = null; this.key = null; }
  }
  rebuild(comp) {
    if (this.graph) this.graph.dispose();
    this.graph = buildGraph(Tone, comp);
    this.key = graphKey(comp);
    this.last = {};
    this.lastT = null;
  }

  update(comp, t, playing) {
    if (!this.on || !comp) return;
    if (graphKey(comp) !== this.key) this.rebuild(comp);
    const g = this.graph;
    const now = Tone.now();
    // A jump (seek, loop, replay, or just started playing): don't fire what we skipped over
    const jumped = this.lastT === null || !this.wasPlaying || t < this.lastT - 1e-6 || t - this.lastT > 0.25;
    if (jumped) this.until = t;

    for (const { node, inst } of g.beds) {
      const P = comp.resolve(node, 0, t);
      const audible = playing && !node.src.hidden;
      inst.set({ ...P, volume: audible ? P.volume : 0 }, null);
      if (audible && inst.pop) {
        for (const c of popCandidates(node.src.id, P.seed, comp.duration)) {
          if (c.t <= this.until) continue;
          if (c.t > t + LOOKAHEAD) break;
          if (popHappens(c, P.rate) && P.volume > 0) { try { inst.pop(this.when(node.src.id, now + Math.max(0, c.t - t)), c.v * P.volume); } catch {} }
        }
      }
    }
    if (playing) {
      const horizon = Math.min(t + LOOKAHEAD, comp.duration);
      for (const c of comp.cues) {
        if (c.at > this.until && c.at <= horizon) {
          try { g.instruments[c.sound].play(c, this.when(c.sound, now + Math.max(0, c.at - t))); this.fired.push({ at: c.at, i: c.i, t }); }
          catch (e) { /* a dropped note is not worth stopping playback */ }
        }
      }
      this.until = horizon;
    }
    this.lastT = t; this.wasPlaying = playing;
  }

  // Play one cue right now (the inspector's preview button)
  preview(comp, cue) {
    if (!this.on) return;
    if (graphKey(comp) !== this.key || !this.graph.instruments[cue.sound]) this.rebuild(comp);
    this.graph.instruments[cue.sound]?.play(cue, this.when(cue.sound, Tone.now() + 0.02));
  }
}
