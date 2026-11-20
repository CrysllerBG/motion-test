#!/usr/bin/env node
// Regenerate the property tables in docs/composition-format.md from the element registry,
// so the documentation can't drift from the code (the same idea as the timeline lanes).
//   node tools/gen-docs.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { ELEMENTS, COMMON_PROPS } from '../app/engine/elements/index.js';
import { EASE_NAMES } from '../app/engine/ease.js';
import { PRESETS } from '../app/engine/elements/particles.js';

const FILE = new URL('../docs/composition-format.md', import.meta.url);
const fmt = v => v === undefined ? '' : typeof v === 'string' ? `\`"${v}"\`` : `\`${JSON.stringify(v)}\``;
const kind = s => s.type === 'select' ? s.options.map(o => `\`${o}\``).join(' · ') : s.type === 'number' && s.min !== undefined ? `number ${s.min} … ${s.max}` : s.type;
const table = props => ['| prop | type | default | notes |', '|---|---|---|---|',
  ...Object.entries(props).map(([k, s]) => `| \`${k}\` | ${kind(s)} | ${fmt(s.default)} | ${s.help || ''} |`)].join('\n');

let out = `Number ranges are the editor's slider ranges, not limits: values outside them are fine.\n\n### Props every layer has\n\nText applies these per letter/word (around each piece's centre); other layers apply them around their own \`x\`, \`y\`.\n\n${table(COMMON_PROPS)}\n`;
for (const [type, el] of Object.entries(ELEMENTS)) {
  out += `\n### \`${type}\`\n\n`;
  const d = typeof el.defaults === 'function' ? null : el.defaults;
  if (d) out += `Overrides: ${Object.entries(d).map(([k, v]) => `\`${k}\` = ${fmt(v)}`).join(', ')}.\n\n`;
  out += table(el.props) + '\n';
  if (type === 'particles') out += `\nPresets fill in any prop you don't set:\n\n| preset | ${Object.keys(PRESETS.embers).join(' | ')} |\n|---|${Object.keys(PRESETS.embers).map(() => '---').join('|')}|\n` +
    Object.entries(PRESETS).map(([n, p]) => `| \`${n}\` | ${Object.values(p).map(v => `\`${v}\``).join(' | ')} |`).join('\n') + '\n';
}
out += `\n### Easings\n\n${EASE_NAMES.map(e => `\`${e}\``).join(' · ')}\n`;

const doc = readFileSync(FILE, 'utf8');
const a = '<!-- generated:start -->', b = '<!-- generated:end -->';
if (!doc.includes(a)) { console.error('markers not found in docs/composition-format.md'); process.exit(1); }
writeFileSync(FILE, doc.slice(0, doc.indexOf(a) + a.length) + '\n' + out + doc.slice(doc.indexOf(b)));
console.log('updated docs/composition-format.md');
