// Frame-exact video export.
// Because every frame is a pure function of t, exporting is a plain loop:
//   for frame i: paint the picture for t = i / fps → hand the pixels to the video encoder.
// Nothing plays in real time, so a slow frame can't cause a dropped or duplicated frame.
// WebCodecs (VideoEncoder) compresses the frames to H.264; mp4-muxer wraps them in an .mp4 file.
import { compile } from '../engine/timeline.js';
import { paintFrame } from '../engine/render.js';
import { loadFonts } from '../engine/fonts.js';
import { Muxer, ArrayBufferTarget } from '../vendor/mp4-muxer-5.2.2.mjs';

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

export async function exportVideo(spec, { width, fps, quality = 'high', onProgress = () => {}, signal } = {}) {
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

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: muxCodec, width, height, frameRate: fps },
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
    muxer.finalize();
  } finally {
    if (encoder.state !== 'closed') encoder.close();
  }
  const blob = new Blob([muxer.target.buffer], { type: 'video/mp4' });
  return { blob, width, height, fps, frames, codec: config.codec, seconds: (performance.now() - started) / 1000 };
}
