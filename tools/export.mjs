#!/usr/bin/env node
// Export a composition to MP4 without opening the editor (uses the same in-browser exporter).
//   node tools/export.mjs <name> [--width 1920] [--fps 30] [--quality high]
// Writes exports/<name>.mp4. Needs the server running (npm start) and Playwright.
import { createRequire } from 'node:module';
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const width = opt('--width'), fps = opt('--fps'), quality = opt('--quality', 'high');
const base = opt('--url', 'http://localhost:4321');
const name = args.shift();
if (!name) { console.error('usage: node tools/export.mjs <name> [--width 1920] [--fps 30] [--quality standard|high|max]'); process.exit(2); }
let chromium;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); }
catch { console.error('Playwright is needed: npm install --no-save playwright && npx playwright install chromium'); process.exit(2); }

const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', e => console.error('page error:', e.message));
await page.goto(`${base}/render.html?c=${encodeURIComponent(name)}`);
await page.evaluate(() => window.studio.ready);
let lastPct = -1;
await page.exposeFunction('__progress', p => { const pct = Math.floor(p.frame / p.frames * 10) * 10; if (pct !== lastPct) { lastPct = pct; process.stdout.write(`${pct}% `); } });
const result = await page.evaluate(async ({ name, width, fps, quality }) => {
  const { exportVideo } = await import('/editor/exporter.js');
  const spec = await (await fetch('/api/compositions/' + encodeURIComponent(name))).json();
  const r = await exportVideo(spec, { width: width ? +width : undefined, fps: fps ? +fps : undefined, quality, onProgress: p => window.__progress(p) });
  const file = `${name}.mp4`;
  const res = await fetch('/api/exports/' + file, { method: 'PUT', body: r.blob });
  if (!res.ok) throw new Error('saving failed: ' + (await res.text()));
  return { file: 'exports/' + file, mb: +(r.blob.size / 1e6).toFixed(2), width: r.width, height: r.height, fps: r.fps, frames: r.frames, codec: r.codec, seconds: +r.seconds.toFixed(1) };
}, { name, width, fps, quality });
console.log('\n' + JSON.stringify(result));
await browser.close();
