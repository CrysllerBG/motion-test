// Frame-exact video export.
// Because every frame is a pure function of t, exporting is a plain loop:
//   for frame i: paint the picture for t = i / fps → hand the pixels to the video encoder.
// Nothing plays in real time, so a slow frame can't cause a dropped or duplicated frame.
// WebCodecs (VideoEncoder) compresses the frames to H.264; mp4-muxer wraps them in an .mp4 file.
import { compile } from '../engine/timeline.js';
import { paintFrame } from '../engine/render.js';
import { loadFonts } from '../engine/fonts.js';
import { Muxer, ArrayBufferTarget } from '../vendor/mp4-muxer-5.2.2.mjs';
import { renderAudio } from '../engine/audio/offline.js';
import { hasSound } from '../engine/audio/graph.js';

const SAMPLE_RATE = 48000;
// AAC plays everywhere (QuickTime included); Opus is the fallback where the browser has no AAC encoder.
async function pickAudioCodec() {
  if (typeof window.AudioEncoder !== 'function') return null;
  for (const [codec, mux] of [['mp4a.40.2', 'aac'], ['opus', 'opus']]) {
    const config = { codec, sampleRate: SAMPLE_RATE, numberOfChannels: 2, bitrate: 192000 };
    try { if ((await AudioEncoder.isConfigSupported(config)).supported) return { config, mux }; } catch {}
  }
  return null;
}

export const QUALITY = { standard: 0.08, high: 0.15, max: 0.3 };   // bits per pixel per frame

export function exportSupported() { return typeof window.VideoEncoder === 'function' && typeof window.VideoFrame === 'function'; }

// Pick the first codec this browser can encode at this size. H.264 first (plays everywhere),
// then VP9 / AV1 in MP4 as fallbacks (play in browsers and VLC, not in older QuickTime).
async function pickCodec(width, height, fps, bitrate) {
  const big = width * height > 1920 * 1088;
  const candidates = [
    ...(big ? [['avc1.640033', 'avc']] : [['avc1.640028', 'avc'], ['avc1.4d0028', 'avc']]),
    ['avc1.640033', 'avc'],
    ['vp09.00.40.08', 'vp9'],
    ['av01.0.08M.08', 'av1']
  ];
  for (const [codec, muxCodec] of candidates) {
    const config = { codec, width, height, bitrate, framerate: fps, latencyMode: 'quality', bitrateMode: 'variable', ...(muxCodec === 'avc' ? { avc: { format: 'avc' } } : {}) };
    try { if ((await VideoEncoder.isConfigSupported(config)).supported) return { config, muxCodec }; } catch {}
  }
  throw new Error('This browser cannot encode video. Use a recent Chrome, Edge or Safari.');
}

export async function exportVideo(spec, { width, fps, quality = 'high', audio = true, onProgress = () => {}, signal } = {}) {
  if (!exportSupported()) throw new Error('This browser has no WebCodecs video encoder. Use a recent Chrome, Edge or Safari.');
  const comp = compile(spec);
  if (comp.errors.length) throw new Error('Fix the composition first:\n' + comp.errors.join('\n'));
  fps = fps || comp.fps;
  width = Math.round((width || comp.width) / 2) * 2;                       // H.264 needs even sizes
  const height = Math.round(width * comp.height / comp.width / 2) * 2;
  const frames = Math.max(1, Math.round(comp.duration * fps));
  const bitrate = Math.round(width * height * fps * (QUALITY[quality] ?? QUALITY.high));

  await loadFonts(spec.fonts);
  const { config, muxCodec } = await pickCodec(width, height, fps, bitrate);

  // Sound first: render it offline (much faster than real time), then it's ready to encode.
  let audioBuffer = null, audioCodec = null, audioNote = null;
  if (audio && hasSound(comp)) {
    audioCodec = await pickAudioCodec();
    if (!audioCodec) audioNote = 'this browser cannot encode audio, so the video is silent';
    else if (!window.Tone) { audioCodec = null; audioNote = 'Tone.js did not load, so the video is silent'; }
    else { onProgress({ stage: 'sound', frame: 0, frames, elapsed: 0, eta: 0 }); audioBuffer = await renderAudio(comp, { sampleRate: SAMPLE_RATE }); }
  }

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: muxCodec, width, height, frameRate: fps },
    ...(audioBuffer ? { audio: { codec: audioCodec.mux, numberOfChannels: 2, sampleRate: SAMPLE_RATE } } : {}),
    fastStart: 'in-memory',              // put the index at the front so the file starts playing immediately
    firstTimestampBehavior: 'offset'
  });
  let failure = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: e => { failure = e; }
  });
  encoder.configure(config);

  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: false });
  const frameUs = 1e6 / fps;
  const started = performance.now();

  try {
    for (let i = 0; i < frames; i++) {
      if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
      if (failure) throw failure;
      paintFrame(ctx, comp, i / fps, width, height);                       // the same paint the editor uses
      const frame = new VideoFrame(canvas, { timestamp: Math.round(i * frameUs), duration: Math.round(frameUs) });
      encoder.encode(frame, { keyFrame: i % Math.round(fps * 2) === 0 }); // a keyframe every 2 s keeps seeking fast
      frame.close();
      // Don't let the encoder's queue grow without bound (keeps memory flat on long pieces)
      while (encoder.encodeQueueSize > 8) await new Promise(r => setTimeout(r, 1));
      if (i % 3 === 0 || i === frames - 1) {
        const el = (performance.now() - started) / 1000;
        onProgress({ frame: i + 1, frames, elapsed: el, eta: el / (i + 1) * (frames - i - 1) });
        await new Promise(r => setTimeout(r, 0));                         // let the progress bar repaint
      }
    }
    await encoder.flush();
    if (failure) throw failure;
    if (audioBuffer) await encodeAudio(audioBuffer, audioCodec.config, muxer);
    muxer.finalize();
  } finally {
    if (encoder.state !== 'closed') encoder.close();
  }
  const blob = new Blob([muxer.target.buffer], { type: 'video/mp4' });
  return { blob, width, height, fps, frames, codec: config.codec, audio: audioBuffer ? audioCodec.config.codec : null, audioNote, seconds: (performance.now() - started) / 1000 };
}

// Hand the rendered sound to the audio encoder in 0.1 s slices ("planar" = all of the left
// channel, then all of the right), each stamped with its time so it lines up with the frames.
async function encodeAudio(buffer, config, muxer) {
  let failure = null;
  const enc = new AudioEncoder({ output: (chunk, meta) => muxer.addAudioChunk(chunk, meta), error: e => { failure = e; } });
  enc.configure(config);
  const L = buffer.getChannelData(0), R = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : L;
  const sr = buffer.sampleRate, slice = Math.round(sr / 10);
  for (let off = 0; off < L.length; off += slice) {
    const n = Math.min(slice, L.length - off);
    const data = new Float32Array(n * 2);
    data.set(L.subarray(off, off + n), 0); data.set(R.subarray(off, off + n), n);
    const ad = new AudioData({ format: 'f32-planar', sampleRate: sr, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(off / sr * 1e6), data });
    enc.encode(ad); ad.close();
    if (failure) throw failure;
  }
  await enc.flush();
  enc.close();
  if (failure) throw failure;
}
