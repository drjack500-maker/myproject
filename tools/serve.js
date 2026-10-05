/*
 * lp/・youtube-lp/・meta-lp/ を配信するだけの小さな静的サーバー（依存なし）
 *   npm run serve          → http://localhost:8000/（名駅歯科 オールオン4 LP）
 *   npm run serve:youtube  → http://localhost:8001/（栄院 YouTube をご覧の方向けページ）
 *   npm run serve:meta     → http://localhost:8002/（栄院 Meta 広告用ページ）
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', 'lp');
const YOUTUBE_ROOT = path.join(__dirname, '..', 'youtube-lp');
const META_ROOT = path.join(__dirname, '..', 'meta-lp');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.avif': 'image/avif', '.ico': 'image/x-icon', '.json': 'application/json',
};

function createServer(root = ROOT) {
  return http.createServer((req, res) => {
    let url;
    try {
      url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch (e) {
      res.writeHead(400).end('Bad Request'); // 不正な % エスケープでもサーバーを落とさない
      return;
    }
    let file = path.join(root, url);
    const rel = path.relative(root, file);
    if (rel.startsWith('..') || path.isAbsolute(rel)) { res.writeHead(403).end(); return; } // 配信フォルダの外は返さない
    if (url.endsWith('/')) file = path.join(file, 'index.html');
    fs.readFile(file, (err, body) => {
      if (err) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not Found'); return; }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(body);
    });
  });
}

module.exports = { createServer, ROOT, YOUTUBE_ROOT, META_ROOT };

if (require.main === module) {
  const [name, root, defaultPort] = process.argv.includes('--youtube') ? ['YouTube LP', YOUTUBE_ROOT, 8001]
    : process.argv.includes('--meta') ? ['Meta LP', META_ROOT, 8002] : ['LP', ROOT, 8000];
  const port = Number(process.env.PORT || defaultPort);
  createServer(root).listen(port, () => console.log(`${name}: http://localhost:${port}/`));
}
