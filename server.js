// Motion Studio server: no dependencies, just Node's built-ins.
//   npm start  →  http://localhost:4321
// It serves the editor (app/), reads and writes compositions/*.json, and tells open
// editors when a composition file changes on disk (for example when Claude Code edits it).
import { createServer } from 'node:http';
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { watch, existsSync } from 'node:fs';
import { join, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const APP = join(ROOT, 'app');
const COMPS = join(ROOT, 'compositions');
const PORT = Number(process.env.PORT) || 4321;
const HOST = process.env.HOST || '127.0.0.1';   // only reachable from this computer
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

// A composition name may only be letters, digits, - and _, so a request can't reach outside compositions/
const validName = n => /^[a-z0-9][a-z0-9_-]{0,80}$/i.test(n);
const compPath = n => join(COMPS, n + '.json');

const clients = new Set();     // open editors listening for changes (Server-Sent Events)
const lastWritten = new Map();  // what we last saved per file, so our own saves aren't echoed back as "changed"

function send(res, code, body, type = 'application/json; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

async function api(req, res, path) {
  if (path === '/api/compositions' && req.method === 'GET') {
    await mkdir(COMPS, { recursive: true });
    const names = (await readdir(COMPS)).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort();
    return send(res, 200, names);
  }
  if (path === '/api/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    res.write(': connected\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  const m = path.match(/^\/api\/compositions\/([^/]+)$/);
  if (m) {
    const name = decodeURIComponent(m[1]);
    if (!validName(name)) return send(res, 400, { error: 'bad composition name' });
    if (req.method === 'GET') {
      if (!existsSync(compPath(name))) return send(res, 404, { error: 'not found' });
      return send(res, 200, await readFile(compPath(name), 'utf8'));
    }
    if (req.method === 'PUT') {
      let body = '';
      for await (const chunk of req) { body += chunk; if (body.length > 5e6) return send(res, 413, { error: 'too large' }); }
      try { JSON.parse(body); } catch { return send(res, 400, { error: 'not valid JSON' }); }
      await mkdir(COMPS, { recursive: true });
      const text = body.endsWith('\n') ? body : body + '\n';
      lastWritten.set(name, text);
      await writeFile(compPath(name), text);
      return send(res, 200, { ok: true });
    }
  }
  send(res, 404, { error: 'unknown endpoint' });
}

async function serveStatic(res, path) {
  if (path === '/') path = '/index.html';
  const file = resolve(APP, '.' + path);
  if (!file.startsWith(APP + sep)) return send(res, 403, 'forbidden', 'text/plain');
  try { send(res, 200, await readFile(file), TYPES[extname(file)] || 'application/octet-stream'); }
  catch { send(res, 404, 'not found', 'text/plain'); }
}

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  try { path.startsWith('/api/') ? await api(req, res, path) : await serveStatic(res, path); }
  catch (e) { console.error(e); send(res, 500, { error: String(e.message || e) }); }
}).listen(PORT, HOST, () => console.log(`Motion Studio → http://localhost:${PORT}`));

// Watch compositions/ and push a "changed" event to every open editor.
await mkdir(COMPS, { recursive: true });
const debounce = new Map();
watch(COMPS, (_, filename) => {
  if (!filename || !filename.endsWith('.json')) return;
  const name = filename.slice(0, -5);
  clearTimeout(debounce.get(name));
  debounce.set(name, setTimeout(async () => {
    // Compare contents rather than timing: if the file holds exactly what an editor just saved,
    // it's our own write; anything else (Claude Code, a text editor, git) is a real change.
    const now = await readFile(compPath(name), 'utf8').catch(() => null);
    if (now !== null && now === lastWritten.get(name)) return;
    lastWritten.delete(name);
    for (const c of clients) c.write(`event: changed\ndata: ${JSON.stringify({ name })}\n\n`);
  }, 120));
});
