// Sound registry. Two kinds of sound, matching the two kinds of motion (principle 6):
//
//   BEDS   continuous sounds whose props (volume, cutoff…) animate with tracks, exactly like a
//          visual layer's props. Every frame, resolve(t) gives their values.
//   CUES   one-shots (a boom, a chime) that fire when the playhead crosses their time while
//          playing forward. Scrubbing stays silent.
//
// This file only describes sounds and builds Tone.js nodes on request, so it can be imported
// in Node (for validation) where Tone isn't loaded. Settings are ported from dungeon-roller-v2.
import { mulberry, hashString } from '../random.js';

const vol = { type: 'number', default: 0.5, min: 0, max: 1, step: 0.01, help: 'loudness, 0..1' };
export const NOTE_RE = /^[A-G](#|b)?-?\d$/;

// ---- Beds -------------------------------------------------------------------------------
// create(Tone, out, P) returns { set(P, time | null) }. time = null means "live": glide there
// over a few milliseconds. A number means "offline": automate to this value at that time.
const glide = (param, v, time) => time === null ? param.rampTo(v, 0.05) : param.linearRampToValueAtTime(v, time);

export const BEDS = {
  drone: {
    label: 'Drone',
    props: {
      volume: vol,
      note:     { type: 'note', default: 'D1', help: 'root note, e.g. D1, A#2' },
      interval: { type: 'number', default: 7, min: 0, max: 24, step: 1, help: 'second voice, semitones above (7 = a fifth, 0 = none)' },
      cutoff:   { type: 'number', default: 240, min: 40, max: 4000, step: 1, help: 'low-pass filter, Hz: lower = darker' },
      spread:   { type: 'number', default: 25, min: 0, max: 80, step: 1, help: 'detune between the stacked oscillators, cents' },
      wave:     { type: 'select', default: 'sawtooth', options: ['sawtooth', 'square', 'triangle', 'sine'] }
    },
    create(Tone, out, P) {
      const gain = new Tone.Gain(0).connect(out);
      const filter = new Tone.Filter(P.cutoff, 'lowpass').connect(gain);
      const a = new Tone.FatOscillator(P.note, P.wave, P.spread).connect(filter);
      const b = new Tone.FatOscillator(Tone.Frequency(P.note).transpose(P.interval).toFrequency(), P.wave, P.spread * 0.7).connect(filter);
      a.volume.value = -10; b.volume.value = P.interval ? -14 : -Infinity;
      a.start(0); b.start(0);
      let note = P.note, interval = P.interval;
      return {
        set(P, time) {
          glide(gain.gain, P.volume, time);
          glide(filter.frequency, Math.max(20, P.cutoff), time);
          if (P.note !== note || P.interval !== interval) {      // notes are not animated: they jump
            note = P.note; interval = P.interval;
            a.frequency.setValueAtTime(Tone.Frequency(note).toFrequency(), time ?? Tone.now());
            b.frequency.setValueAtTime(Tone.Frequency(note).transpose(interval).toFrequency(), time ?? Tone.now());
            b.volume.value = interval ? -14 : -Infinity;
          }
        }
      };
    }
  },
  hiss: {
    label: 'Noise bed',
    props: {
      volume: vol,
      noise:  { type: 'select', default: 'pink', options: ['white', 'pink', 'brown'], help: 'brown = rumble, pink = wind/air, white = hiss' },
      filter: { type: 'select', default: 'bandpass', options: ['lowpass', 'bandpass', 'highpass'] },
      cutoff: { type: 'number', default: 700, min: 40, max: 12000, step: 1, help: 'filter frequency, Hz' },
      q:      { type: 'number', default: 1, min: 0.1, max: 20, step: 0.1, help: 'filter sharpness: higher = more whistly' }
    },
    create(Tone, out, P) {
      const gain = new Tone.Gain(0).connect(out);
      const filter = new Tone.Filter({ frequency: P.cutoff, type: P.filter, Q: P.q }).connect(gain);
      const noise = new Tone.Noise(P.noise).connect(filter).start(0);
      return {
        set(P, time) {
          glide(gain.gain, P.volume, time);
          glide(filter.frequency, Math.max(20, P.cutoff), time);
          glide(filter.Q, P.q, time);
          if (noise.type !== P.noise) noise.type = P.noise;
          if (filter.type !== P.filter) filter.type = P.filter;
        }
      };
    }
  },
  crackle: {
    label: 'Crackle',
    props: {
      volume: vol,
      rate:   { type: 'number', default: 8, min: 0, max: 40, step: 0.5, help: 'pops per second (on average)' },
      cutoff: { type: 'number', default: 2200, min: 200, max: 12000, step: 10, help: 'high-pass, Hz: higher = thinner, drier pops' },
      seed:   { type: 'number', default: 1, min: 0, max: 9999, step: 1 }
    },
    create(Tone, out, P) {
      const filter = new Tone.Filter(P.cutoff, 'highpass').connect(out);
      const pop = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.025, sustain: 0 } }).connect(filter);
      pop.volume.value = -6;
      return {
        set(P, time) { glide(filter.frequency, P.cutoff, time); },
        pop(time, velocity) { pop.triggerAttackRelease(0.02, time, velocity); }
      };
    }
  }
};

// Crackle pops as a pure function of time: candidate pops at a fixed maximum density are drawn
// from a seeded sequence; a candidate becomes a pop if its random number is under rate / MAX at
// that moment. So the same composition always crackles the same way, and animating `rate` works.
const MAX_RATE = 40;
const popCache = new Map();
export function popCandidates(id, seed, duration) {
  const key = `${id}|${seed}|${duration}`;
  if (popCache.has(key)) return popCache.get(key);
  const rng = mulberry(hashString(id) ^ (seed * 7919));
  const list = [];
  for (let t = 0; t < duration;) { t += -Math.log(1 - rng()) / MAX_RATE; list.push({ t, r: rng(), v: 0.3 + 0.7 * rng() }); }
  popCache.set(key, list);
  return list;
}
export const popHappens = (cand, rate) => cand.r < rate / MAX_RATE;

// ---- Cue instruments ------------------------------------------------------------------------
// create(Tone, out) returns { play(cue, time) }. One instance per instrument serves all its cues.
const notes = n => String(n).trim().split(/\s+/);
export const CUES = {
  boom: {
    label: 'Boom (impact)', note: 'C1', length: 1.2,
    create(Tone, out) {
      const s = new Tone.MembraneSynth({ pitchDecay: 0.08, octaves: 6, envelope: { attack: 0.001, decay: 1.2, sustain: 0, release: 0.4 } }).connect(out);
      s.volume.value = -2;
      return { play: (c, t) => s.triggerAttackRelease(c.note, c.length, t, c.velocity) };
    }
  },
  clank: {
    label: 'Clank (metal)', note: 'C2', length: 0.2,
    create(Tone, out) {
      const s = new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 0.35, release: 0.2 }, harmonicity: 5.1, modulationIndex: 24, resonance: 900, octaves: 1.5 }).connect(out);
      s.volume.value = -20;
      return { play: (c, t) => s.triggerAttackRelease(c.note, c.length, t, c.velocity) };
    }
  },
  whoomp: {
    label: 'Whoomp (fire catching)', length: 0.6,
    create(Tone, out) {
      const f = new Tone.Filter(500, 'lowpass').connect(out);
      const s = new Tone.NoiseSynth({ noise: { type: 'brown' }, envelope: { attack: 0.06, decay: 0.6, sustain: 0 } }).connect(f);
      s.volume.value = -4;
      return { play: (c, t) => s.triggerAttackRelease(c.length, t, c.velocity) };
    }
  },
  paper: {
    label: 'Paper (swish)', length: 0.5,
    create(Tone, out) {
      const f = new Tone.Filter({ frequency: 3200, type: 'bandpass', Q: 0.8 }).connect(out);
      const s = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.04, decay: 0.45, sustain: 0 } }).connect(f);
      s.volume.value = -16;
      return { play: (c, t) => s.triggerAttackRelease(c.length, t, c.velocity) };
    }
  },
  crash: {
    label: 'Crash (rubble)', length: 0.7,
    create(Tone, out) {
      const f = new Tone.Filter(1800, 'lowpass').connect(out);
      const s = new Tone.NoiseSynth({ noise: { type: 'brown' }, envelope: { attack: 0.001, decay: 0.7, sustain: 0 } }).connect(f);
      s.volume.value = -4;
      return { play: (c, t) => s.triggerAttackRelease(c.length, t, c.velocity) };
    }
  },
  chord: {
    label: 'Chord (pad)', note: 'D3 F#3 A3 D4', length: 2.2,
    create(Tone, out) {
      const f = new Tone.Filter(1600, 'lowpass').connect(out);
      const s = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'fatsawtooth', count: 3, spread: 20 }, envelope: { attack: 0.25, decay: 0.6, sustain: 0.5, release: 2.5 } }).connect(f);
      s.volume.value = -18;
      return { play: (c, t) => s.triggerAttackRelease(notes(c.note), c.length, t, c.velocity) };
    }
  },
  bell: {
    label: 'Bell (deep)', note: 'D2', length: 3,
    create(Tone, out) {
      const s = new Tone.FMSynth({ harmonicity: 3.01, modulationIndex: 12, envelope: { attack: 0.001, decay: 3, sustain: 0, release: 2 }, modulationEnvelope: { attack: 0.001, decay: 2, sustain: 0, release: 1 } }).connect(out);
      s.volume.value = -12;
      return { play: (c, t) => s.triggerAttackRelease(c.note, c.length, t, c.velocity) };
    }
  },
  chime: {
    label: 'Chime (bright)', note: 'A5', length: 1.5,
    create(Tone, out) {
      const s = new Tone.PolySynth(Tone.FMSynth, { harmonicity: 2, modulationIndex: 3, envelope: { attack: 0.002, decay: 1.4, sustain: 0, release: 1 } }).connect(out);
      s.volume.value = -16;
      return { play: (c, t) => s.triggerAttackRelease(notes(c.note), c.length, t, c.velocity) };
    }
  }
};

// Fill in a cue's defaults from its instrument
export function cueWithDefaults(c) {
  const inst = CUES[c.sound] || {};
  return { ...c, note: c.note ?? inst.note ?? 'C2', length: c.length ?? inst.length ?? 0.5, velocity: c.velocity ?? 1 };
}
