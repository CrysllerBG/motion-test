// The playback loop. It owns only two pieces of state, `t` and `playing`; the picture is
// recomputed from t whenever something changes (time moved, file edited, window resized).
import { paintFrame } from '../engine/render.js';

export class Player {
  constructor(canvas, { onTick, container } = {}) {
    this.container = container || canvas.parentElement;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onTick = onTick || (() => {});
    this.comp = null;
    this.t = 0;
    this.playing = false;
    this.loop = false;
    this.hidden = new Set();      // layers hidden in the editor (not saved)
    this.dirty = true;
    this.last = null;
    new ResizeObserver(() => this.resize()).observe(this.container);
    requestAnimationFrame(now => this.frame(now));
  }
  setComp(comp) {
    const prev = this.comp;
    this.comp = comp;
    this.t = Math.min(this.t, comp.duration);
    if (!prev || prev.width / prev.height !== comp.width / comp.height) this.resize();
    this.dirty = true;
  }
  resize() {
    if (!this.comp) return;
    const box = this.container.getBoundingClientRect();
    const aspect = this.comp.width / this.comp.height;
    // fit the frame inside the available box, keeping the composition's aspect ratio
    let w = box.width, h = w / aspect;
    if (h > box.height) { h = box.height; w = h * aspect; }
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.canvas.width = Math.max(2, Math.round(w * dpr));
    this.canvas.height = Math.max(2, Math.round(h * dpr));
    this.dirty = true;
    this.onResize?.(w, h);
  }
  seek(t) { this.t = Math.max(0, Math.min(this.comp ? this.comp.duration : 0, t)); this.dirty = true; }
  play() { if (this.comp && this.t >= this.comp.duration) this.t = 0; this.playing = true; this.dirty = true; }
  pause() { this.playing = false; this.dirty = true; }
  toggle() { this.playing ? this.pause() : this.play(); }
  replay() { this.t = 0; this.playing = true; }
  invalidate() { this.dirty = true; }
  setClock(fn) { this.clock = fn; this.last = null; }   // switch clocks without a jump
  // Time advances by real elapsed time. Normally that's the screen's clock (requestAnimationFrame);
  // when sound is on, `clock` is the audio hardware's clock instead. Two clocks always drift a
  // little, so we pick one master and let both picture and sound follow it.
  frame(now) {
    const clockNow = this.clock ? this.clock() * 1000 : now;
    if (this.comp && this.playing && this.last !== null) {
      this.t += Math.min(0.1, Math.max(0, clockNow - this.last) / 1000);   // capped after a stall
      if (this.t >= this.comp.duration) {
        if (this.loop) this.t = this.t % this.comp.duration;
        else { this.t = this.comp.duration; this.playing = false; }
      }
      this.dirty = true;
    }
    this.last = clockNow;
    requestAnimationFrame(n => this.frame(n));   // ask for the next frame first, so an error below can't stop playback
    if (this.comp && this.dirty) {
      this.dirty = false;
      try {
        paintFrame(this.ctx, this.comp, this.t, this.canvas.width, this.canvas.height, { hidden: this.hidden });
        this.onTick(this.t);
      } catch (e) { console.error(e); }
    }
  }
}
