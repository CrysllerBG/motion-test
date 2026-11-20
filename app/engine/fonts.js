// Fonts come from Google Fonts. A canvas can only draw a font once it has loaded,
// so we wait for every font the composition names before painting frames that matter.
// "Jost:300" means family Jost, weight 300. "IM Fell English:400i" adds the italic.
export function parseFonts(list = []) {
  const fam = new Map();
  for (const f of list) {
    const [name, w = '400'] = String(f).split(':');
    if (!fam.has(name)) fam.set(name, new Set());
    for (const x of w.split(',')) fam.get(name).add(x.trim());
  }
  return fam;
}
export function googleFontsUrl(list) {
  const fam = parseFonts(list);
  if (!fam.size) return null;
  const parts = [...fam].map(([name, ws]) => {
    const v = [...ws];
    const anyItal = v.some(x => x.endsWith('i'));
    const q = anyItal
      ? 'ital,wght@' + v.map(x => `${x.endsWith('i') ? 1 : 0},${parseInt(x)}`).sort().join(';')
      : 'wght@' + v.map(x => parseInt(x)).sort((a, b) => a - b).join(';');
    return 'family=' + encodeURIComponent(name).replace(/%20/g, '+') + ':' + q;
  });
  return `https://fonts.googleapis.com/css2?${parts.join('&')}&display=block`;
}
const loaded = new Set();
export async function loadFonts(list = []) {
  const url = googleFontsUrl(list);
  if (!url) return;
  if (!loaded.has(url)) {
    loaded.add(url);
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = url;
    const done = new Promise(r => { link.onload = r; link.onerror = r; });
    document.head.append(link);
    await done;
  }
  const jobs = [];
  for (const [name, ws] of parseFonts(list)) for (const w of ws)
    jobs.push(document.fonts.load(`${w.endsWith('i') ? 'italic ' : ''}${parseInt(w)} 32px "${name}"`).catch(() => {}));
  await Promise.race([Promise.all(jobs), new Promise(r => setTimeout(r, 8000))]);
}
