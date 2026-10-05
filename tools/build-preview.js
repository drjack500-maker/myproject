/*
 * 確認用の1ファイル版LP（CSS・JS・画像を埋め込み）を作る
 *   npm run build:preview          → dist/preview.html（名駅歯科 オールオン4 LP）
 *   npm run build:preview:youtube  → dist/youtube-preview.html（栄院 YouTube をご覧の方向けページ）
 *   npm run build:preview:meta     → dist/meta-preview.html（栄院 Meta 広告用ページ）
 * メールやチャットで共有して、スマホで見た目を確認する用途です（フォームは送信されません）。
 */
const fs = require('node:fs');
const path = require('node:path');

const META = process.argv.includes('--meta');
const YOUTUBE = META || process.argv.includes('--youtube'); // Meta 版も栄院の見た目（youtube.css・youtube.js）を使う
const LP = path.join(__dirname, '..', META ? 'meta-lp' : YOUTUBE ? 'youtube-lp' : 'lp');
const OUT_FILE = META ? 'meta-preview.html' : YOUTUBE ? 'youtube-preview.html' : 'preview.html';
const OUT = path.join(__dirname, '..', 'dist');
const read = (p) => fs.readFileSync(path.join(LP, p), 'utf8');
const dataUri = (p, type) => `data:${type};base64,${fs.readFileSync(path.join(LP, p)).toString('base64')}`;

let html = read('index.html');
const replaceOnce = (from, to) => {
  if (!html.includes(from)) throw new Error(`not found: ${from}`);
  html = html.replace(from, () => to);
};

replaceOnce('<link rel="stylesheet" href="assets/css/style.css">', `<style>\n${read('assets/css/style.css')}\n</style>`);
// ページ内で設定している値（LINEのURLなど）は残し、送信だけをデモ動作にする
replaceOnce('<script src="assets/js/main.js" defer></script>',
  `<script>window.LP_CONFIG = Object.assign(window.LP_CONFIG || {}, { formEndpoint: '', demo: true, thanksUrl: '#reserve' });</script>\n<script>\n${read('assets/js/main.js')}\n</script>`);
if (YOUTUBE) {
  replaceOnce('<link rel="stylesheet" href="assets/css/youtube.css">', `<style>\n${read('assets/css/youtube.css')}\n</style>`);
  replaceOnce('<script src="assets/js/youtube.js" defer></script>', `<script>\n${read('assets/js/youtube.js')}\n</script>`);
}
if (META) replaceOnce('<link rel="stylesheet" href="assets/css/meta.css">', `<style>\n${read('assets/css/meta.css')}\n</style>`);
replaceOnce('<link rel="icon" href="assets/img/favicon.svg" type="image/svg+xml">',
  `<link rel="icon" href="${dataUri('assets/img/favicon.svg', 'image/svg+xml')}" type="image/svg+xml">`);
if (!/<body[^>]*>/.test(html)) throw new Error('not found: <body>');
html = html.replace(/<body[^>]*>/, (m) => `${m}\n<div class="demo-banner">確認用プレビュー：予約フォームは送信されません</div>`);
// 写真も埋め込む（1ファイルで表示できるように）
const TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
html = html.replace(/src="(assets\/img\/[^"]+)"/g, (m, p) => `src="${dataUri(p, TYPES[path.extname(p).toLowerCase()] || 'application/octet-stream')}"`);

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, OUT_FILE), html);
console.log(`wrote dist/${OUT_FILE} (${Math.round(html.length / 1024)} KB)`);
