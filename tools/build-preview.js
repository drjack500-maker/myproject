/*
 * 確認用の1ファイル版LP（CSS・JS・画像を埋め込み）を作る
 *   npm run build:preview → dist/preview.html
 * メールやチャットで共有して、スマホで見た目を確認する用途です（フォームは送信されません）。
 */
const fs = require('node:fs');
const path = require('node:path');

const LP = path.join(__dirname, '..', 'lp');
const OUT = path.join(__dirname, '..', 'dist');
const read = (p) => fs.readFileSync(path.join(LP, p), 'utf8');
const dataUri = (p, type) => `data:${type};base64,${fs.readFileSync(path.join(LP, p)).toString('base64')}`;

let html = read('index.html');
const replaceOnce = (from, to) => {
  if (!html.includes(from)) throw new Error(`not found: ${from}`);
  html = html.replace(from, () => to);
};

replaceOnce('<link rel="stylesheet" href="assets/css/style.css">', `<style>\n${read('assets/css/style.css')}\n</style>`);
replaceOnce('<script src="assets/js/main.js" defer></script>',
  `<script>window.LP_CONFIG = { formEndpoint: '', thanksUrl: '#reserve' };</script>\n<script>\n${read('assets/js/main.js')}\n</script>`);
replaceOnce('<link rel="icon" href="assets/img/favicon.svg" type="image/svg+xml">',
  `<link rel="icon" href="${dataUri('assets/img/favicon.svg', 'image/svg+xml')}" type="image/svg+xml">`);
replaceOnce('<body>', '<body>\n<div class="demo-banner">確認用プレビュー：予約フォームは送信されません</div>');

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'preview.html'), html);
console.log(`wrote dist/preview.html (${Math.round(html.length / 1024)} KB)`);
