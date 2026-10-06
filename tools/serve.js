/*
 * LPを配信するだけの小さな静的サーバー（依存なし）
 *   npm run serve  → http://localhost:8000/      … lp/（検索広告用 all_on_4_004）
 *                    http://localhost:8000/006/  … lp-006/（SNS広告用 all_on_4_006）
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOTS = { '/006/': path.join(__dirname, '..', 'lp-006'), '/': path.join(__dirname, '..', 'lp') };
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.avif': 'image/avif', '.ico': 'image/x-icon', '.json': 'application/json',
};

function createServer() {
  return http.createServer((req, res) => {
    let url;
    try {
      url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch (e) {
      res.writeHead(400).end('Bad Request'); // 不正な % エスケープでもサーバーを落とさない
      return;
    }
    if (url === '/006') { res.writeHead(301, { location: '/006/' }).end(); return; }
    const prefix = Object.keys(ROOTS).find((p) => url.startsWith(p));
    const root = ROOTS[prefix];
    let file = path.join(root, url.slice(prefix.length - 1));
    const rel = path.relative(root, file);
    if (rel.startsWith('..') || path.isAbsolute(rel)) { res.writeHead(403).end(); return; } // LPのフォルダの外は返さない
    if (url.endsWith('/')) file = path.join(file, 'index.html');
    fs.readFile(file, (err, body) => {
      if (err) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not Found'); return; }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(body);
    });
  });
}

module.exports = { createServer };

if (require.main === module) {
  const port = Number(process.env.PORT || 8000);
  createServer().listen(port, () => console.log(`LP: http://localhost:${port}/ （SNS広告用: http://localhost:${port}/006/）`));
}
