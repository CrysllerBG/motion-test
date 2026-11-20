#!/usr/bin/env node
// Render chosen moments of a composition to PNG files, so they can be looked at.
//   node tools/render-frames.mjs <name> [times...] [--width 960] [--out renders/<name>]
// Times default to 8 evenly spaced moments. Needs the server running (npm start) and Playwright.
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const width = Number(opt('--width', 960));
const base = opt('--url', 'http://localhost:4321');
const name = args.shift();
if (!name) { console.error('usage: node tools/render-frames.mjs <name> [t1 t2 ...] [--width 960] [--out dir]'); process.exit(2); }
const out = opt('--out', join('renders', name));
let times = args.map(Number).filter(n => !isNaN(n));

import { createRequire } from 'node:module';
let chromium;
try { ({ chromium } = createRequire(import.meta.url)('playwright')); }
catch { console.error('Playwright is needed: npm install --no-save playwright && npx playwright install chromium'); process.exit(2); }
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height: Math.round(width * 9 / 16) }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.error('page error:', e.message));
await page.goto(`${base}/render.html?c=${encodeURIComponent(name)}&w=${width}`);
const info = await page.evaluate(() => window.studio.ready);
if (!times.length) times = Array.from({ length: 8 }, (_, i) => +(info.duration * (i + 0.5) / 8).toFixed(2));
await mkdir(out, { recursive: true });
for (const t of times) {
  await page.evaluate(t => window.studio.seek(t), t);
  const file = join(out, `t${t.toFixed(2).padStart(5, '0')}.png`);
  await page.locator('canvas').screenshot({ path: file });
  console.log(file);
}
await browser.close();
