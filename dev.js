// Yerel geliştirme sunucusu: Vercel fonksiyonlarını ve public/ statik dosyalarını
// taklit eder. Kullanım: MONGODB_URI=<...> npm run dev
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT) || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon',
};

async function apiHandler(pathname) {
  const m = pathname.match(/^\/api\/(.+)$/);
  if (!m) return null;
  const seg = m[1].split('/').filter(Boolean);
  try {
    if (seg[0] === 'games') {
      if (seg.length === 1) return { handler: (await import('./api/games/index.js')).default, params: {} };
      if (seg.length === 2) return { handler: (await import('./api/games/[id].js')).default, params: { id: decodeURIComponent(seg[1]) } };
    } else if (seg[0] === 'images') {
      if (seg.length === 1) return { handler: (await import('./api/images/index.js')).default, params: {} };
      if (seg.length === 2) return { handler: (await import('./api/images/[id].js')).default, params: { id: decodeURIComponent(seg[1]) } };
    } else if (seg[0] === 'room') {
      if (seg.length === 2) return { handler: (await import('./api/room/[code].js')).default, params: { code: decodeURIComponent(seg[1]) } };
    }
  } catch (e) {
    console.error('[dev] import hatası', e);
  }
  return null;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 6e6) req.destroy(); });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function makeRes(nativeRes) {
  let statusCode = 200;
  const res = {
    status(c) { statusCode = c; return res; },
    setHeader(k, v) { nativeRes.setHeader(k, v); return res; },
    json(obj) { nativeRes.statusCode = statusCode; nativeRes.setHeader('Content-Type', 'application/json'); nativeRes.end(JSON.stringify(obj)); },
    end(buf) { nativeRes.statusCode = statusCode; nativeRes.end(buf); },
  };
  return res;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = decodeURIComponent(url.pathname);

  if (pathname.startsWith('/api/')) {
    const route = await apiHandler(pathname);
    if (!route) { res.statusCode = 404; return res.end('not found'); }
    req.query = route.params;
    if (req.method === 'POST' || req.method === 'PUT') {
      try { req.body = JSON.parse(await readBody(req) || '{}'); } catch { req.body = {}; }
    }
    return route.handler(req, makeRes(res));
  }

  // statik — Vercel rewrites ile birebir
  let file = pathname === '/' ? '/index.html' : pathname;
  const dyn = file.match(/^\/(board|moderate)\/[^/]+$/);
  if (dyn) file = dyn[1] === 'board' ? '/board.html' : '/moderator.html';
  else if (file === '/admin') file = '/admin.html';

  const full = path.join(PUBLIC, path.normalize(file).replace(/^([/\\])/, ''));
  if (!full.startsWith(PUBLIC)) { res.statusCode = 403; return res.end(); }
  fs.readFile(full, (err, data) => {
    if (err) { res.statusCode = 404; return res.end('not found'); }
    res.setHeader('Content-Type', MIME[path.extname(full)] || 'application/octet-stream');
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`🌪️  Envelope Storm (dev) → http://localhost:${PORT}`);
  console.log(`    MONGODB_URI ${process.env.MONGODB_URI ? 'tanımlı ✓' : 'TANIMLI DEĞİL ✗ (Atlas dizesini .env ile ver)'}`);
});
