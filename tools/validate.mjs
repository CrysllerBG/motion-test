#!/usr/bin/env node
// Check composition files without opening a browser: runs the same compile() the app uses
// and prints every problem with its location in the JSON.
//   node tools/validate.mjs compositions/*.json
import { readFileSync } from 'node:fs';
import { compile } from '../app/engine/timeline.js';

const files = process.argv.slice(2);
if (!files.length) { console.error('usage: node tools/validate.mjs <composition.json> [...]'); process.exit(2); }
let bad = 0;
for (const f of files) {
  let spec;
  try { spec = JSON.parse(readFileSync(f, 'utf8')); }
  catch (e) { console.log(`✗ ${f}\n    not valid JSON: ${e.message}`); bad++; continue; }
  const c = compile(spec);
  if (c.errors.length) {
    bad++;
    console.log(`✗ ${f}`);
    for (const e of c.errors) console.log(`    ${e}`);
  } else {
    const end = Math.max(0, ...c.tracks.map(t => t.start + t.duration));
    const warn = end > c.duration + 1e-9 ? `  ⚠ animations run until ${end.toFixed(2)} s, past the ${c.duration} s duration` : '';
    console.log(`✓ ${f}  (${c.nodes.length} layers, ${c.tracks.length} tracks, ${c.duration} s)${warn}`);
  }
}
process.exit(bad ? 1 : 0);
