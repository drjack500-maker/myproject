/*
 * 確認用の1ファイル版LP（CSS・JS・画像を埋め込み）を作る
 *   npm run build:preview
 *   - dist/preview.html          … 検索広告用LP（lp/）の確認用（フォームは送信されません）
 *   - preview/lp-006-draft.html  … Meta広告用LP（lp-006/）の下書き。記入が必要な空欄を黄色の枠で表示
 * メールやチャットで共有して、スマホで見た目を確認する用途です。
 * lp-006 の下書きはリポジトリに含めているため、lp/ や lp-006/index.html を変えたら作り直してください
 * （npm run sync:006 で同期と一緒に作り直されます。作り直し漏れは npm test で検出します）。
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

function inline(dir, { config, banner }) {
  const read = (p) => fs.readFileSync(path.join(dir, p), 'utf8');
  const dataUri = (p) => `data:${TYPES[path.extname(p).toLowerCase()] || 'application/octet-stream'};base64,${fs.readFileSync(path.join(dir, p)).toString('base64')}`;
  let html = read('index.html');
  const replaceOnce = (from, to) => {
    if (!html.includes(from)) throw new Error(`not found: ${from}`);
    html = html.replace(from, () => to);
  };
  replaceOnce('<link rel="stylesheet" href="assets/css/style.css">', `<style>\n${read('assets/css/style.css')}\n</style>`);
  replaceOnce('<script src="assets/js/main.js" defer></script>',
    `<script>window.LP_CONFIG = ${JSON.stringify(config)};</script>\n<script>\n${read('assets/js/main.js')}\n</script>`);
  replaceOnce('<link rel="icon" href="assets/img/favicon.svg" type="image/svg+xml">',
    `<link rel="icon" href="${dataUri('assets/img/favicon.svg')}" type="image/svg+xml">`);
  // 先読みの指定は、埋め込み後は不要
  html = html.replace(/<link rel="preload" as="image" href="assets\/img\/[^"]+"[^>]*>\n/g, '');
  if (banner) replaceOnce('<body>', `<body>\n<div class="demo-banner">${banner}</div>`);
  // 写真も埋め込む（1ファイルで表示できるように）。説明コメント内の例など、まだ無いファイルはそのまま
  html = html.replace(/src="(assets\/img\/[^"]+)"/g, (m, p) => (fs.existsSync(path.join(dir, p)) ? `src="${dataUri(p)}"` : m));
  return html;
}

// Meta広告用LPの下書き（空欄を表示。フォームは送信せず、予約フォームに戻る）
function build006Draft() {
  return inline(path.join(ROOT, 'lp-006'), {
    config: { formEndpoint: '', demo: true, draft: true, thanksUrl: '#reserve' },
  });
}

module.exports = { build006Draft, DRAFT_006: path.join(ROOT, 'preview', 'lp-006-draft.html') };

if (require.main === module) {
  const lp = inline(path.join(ROOT, 'lp'), {
    config: { formEndpoint: '', demo: true, thanksUrl: '#reserve' },
    banner: '確認用プレビュー：予約フォームは送信されません',
  });
  fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'dist', 'preview.html'), lp);
  console.log(`wrote dist/preview.html (${Math.round(lp.length / 1024)} KB)`);

  const draft = build006Draft();
  fs.mkdirSync(path.dirname(module.exports.DRAFT_006), { recursive: true });
  fs.writeFileSync(module.exports.DRAFT_006, draft);
  console.log(`wrote preview/lp-006-draft.html (${Math.round(draft.length / 1024)} KB)`);
}
