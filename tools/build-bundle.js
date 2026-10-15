/*
 * いびき改善LPと小冊子を、共有しやすい形にまとめる
 *   npm run build:bundle → dist/ibiki-bundle/
 *     LP_静寂の夜メソッド.html        1ファイル版のLP（CSS・JS・画像を埋め込み。ダブルクリックで開ける）
 *     LP_静寂の夜メソッド.pdf         LPの全体（1ページ目：スマホ幅、2ページ目：PC幅）
 *     小冊子_私の眠りの記録.html      1ファイル版の小冊子（絵を埋め込み）
 *     小冊子_私の眠りの記録.pdf       配布用PDF（A5・20ページ）
 *     小冊子プレゼントページ.html/.pdf  広告の受け皿（free/）。PDFはスマホ幅・PC幅の2ページ
 *     12週間コース販売ページ.html/.pdf  30万円コースの販売ページと申込フォーム（program/）
 *     販売導線の設計書.html/.pdf      流れ・LINE配信文・セミナー台本・収支シミュレーター（funnel/。PDFはA4）
 * フォントは Google Fonts を使うため、ネットにつながる環境で実行してください。
 */
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { PDFDocument } = require('pdf-lib');
const { createServer } = require('./serve');

const ROOT = path.join(__dirname, '..', 'ibiki-lp');
const OUT = path.join(__dirname, '..', 'dist', 'ibiki-bundle');
const NAME_LP = 'LP_静寂の夜メソッド';
const NAME_BOOK = '小冊子_私の眠りの記録';
const TYPES = { '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const dataUri = (p) => `data:${TYPES[path.extname(p)]};base64,${fs.readFileSync(path.join(ROOT, p)).toString('base64')}`;
function replaceOnce(html, from, to) {
  if (!html.includes(from)) throw new Error(`not found: ${from}`);
  return html.replace(from, () => to);
}

// ---------- 1ファイル版のページ（LP・小冊子プレゼント・12週間コース・設計書） ----------
// まとめた中にあるページへのリンクは同じフォルダのファイルへ、ないページ（特商法の表記など）は
// リンクを外して「公開時の移動先」を title に残す
const PAGES = {
  'index.html': { name: NAME_LP, title: '静寂の夜メソッド LP（スマホ・PC）' },
  'free/index.html': { name: '小冊子プレゼントページ', title: '小冊子プレゼントページ（スマホ・PC）' },
  'program/index.html': { name: '12週間コース販売ページ', title: '12週間コース販売ページ（スマホ・PC）' },
  'funnel/index.html': { name: '販売導線の設計書', print: true },
};
const LINK_NAMES = { 'tokushoho.html': '特定商取引法に基づく表記', 'privacy.html': '個人情報の取り扱い' };

function pageHtml(rel) {
  const dir = path.posix.dirname(rel);
  const local = (p) => !/^(https?:|data:|mailto:|tel:|#)/.test(p);
  const res = (p) => path.posix.normalize(path.posix.join(dir, p));
  let html = read(rel);
  html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (m, p) => (local(p) ? `<style>\n${read(res(p))}\n</style>` : m));
  const scripts = [];
  html = html.replace(/<script src="([^"]+)" defer><\/script>\n?/g, (m, p) => {
    if (!local(p)) return m;
    scripts.push(read(res(p)));
    return '';
  });
  html = replaceOnce(html, '</body>', `${scripts.map((js) => `<script>\n${js}\n</script>\n`).join('')}</body>`);
  html = html.replace(/(src|srcset|href)="([^"]+\.(?:jpg|png|svg))"/g, (m, attr, p) => (local(p) ? `${attr}="${dataUri(res(p))}"` : m));
  html = html.replace(/<a href="([^"]+)"/g, (m, href) => {
    if (!local(href)) return m;
    const [p, hash] = href.split('#');
    let target = res(p || '.');
    if (target === '.' || target.endsWith('/')) target = path.posix.join(target, 'index.html');
    if (PAGES[target]) return `<a href="${PAGES[target].name}.html"`;
    const label = LINK_NAMES[target] || target;
    return `<a title="公開時は「${label}」のページ（${target}${hash ? `#${hash}` : ''}）へ移動します"`;
  });
  if (/(?:src|href)="(?:\.\.\/|assets\/|img\/|booklet\/)/.test(html)) throw new Error(`${rel}: 埋め込めていない参照があります`);
  return html;
}

// ---------- 1ファイル版の小冊子 ----------
function bookletHtml() {
  let html = read('booklet/index.html');
  html = replaceOnce(html, '<link rel="stylesheet" href="booklet.css">', `<style>\n${read('booklet/booklet.css')}\n</style>`);
  html = replaceOnce(html, '<link rel="icon" href="../assets/img/favicon.svg" type="image/svg+xml">', `<link rel="icon" href="${dataUri('assets/img/favicon.svg')}" type="image/svg+xml">`);
  html = replaceOnce(html, '配布用のPDFは <code>npm run build:booklet</code> で作ります。', '印刷・配布には同じ内容のPDFをお使いください。');
  // 絵は台本（pages.js）の画像名から読みこむので、名前→data URI の表を先に渡す
  const imgs = {};
  for (const f of fs.readdirSync(path.join(ROOT, 'booklet', 'img'))) {
    if (f !== 'charsheet.jpg') imgs[f] = dataUri(`booklet/img/${f}`);
  }
  const pages = read('booklet/pages.js');
  const render = read('booklet/render.js')
    .replace("const IMG = (window.BOOKLET && window.BOOKLET.imgBase) || 'img/';", "const IMG = '';")
    .replace(/\$\{IMG\}\$\{panel\.img\}\.jpg/, '${window.BOOKLET_IMG[panel.img + \'.jpg\']}')
    .replace('(typeof p.html === \'function\' ? p.html(IMG) : p.html)', '(typeof p.html === \'function\' ? p.html(\'\').replace(/src="([^"]+\\.(?:jpg|png))"/g, (m, f) => `src="${window.BOOKLET_IMG[f]}"`) : p.html)');
  if (!render.includes('window.BOOKLET_IMG[panel.img')) throw new Error('render.js の画像の読みこみ部分が見つかりません');
  html = replaceOnce(html, '<script src="pages.js"></script>', `<script>window.BOOKLET_IMG = ${JSON.stringify(imgs)};</script>\n<script>\n${pages}\n</script>`);
  html = replaceOnce(html, '<script src="render.js"></script>', `<script>\n${render}\n</script>`);
  return html;
}

// 長いページのPDF（1ページ目：スマホ幅、2ページ目：PC幅）
async function longPdf(browser, url, title) {
  const parts = [];
  for (const [label, width, mobile] of [['スマホ', 390, true], ['PC', 1280, false]]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 2, locale: 'ja-JP', reducedMotion: 'reduce' });
    await ctx.addInitScript(() => { window.LP_CONFIG = { preview: false }; }); // 確認用の表示は出さない（公開時と同じ見た目）
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.emulateMedia({ media: 'screen' });
    const height = await page.evaluate(() => Math.ceil(document.documentElement.scrollHeight));
    parts.push(await page.pdf({ width: `${width}px`, height: `${height + 2}px`, printBackground: true, pageRanges: '1' }));
    console.log(`  ${title} ${label}: ${width}×${height}px`);
    await ctx.close();
  }
  const merged = await PDFDocument.create();
  merged.setTitle(title);
  for (const bytes of parts) {
    const src = await PDFDocument.load(bytes);
    const [p] = await merged.copyPages(src, [0]);
    merged.addPage(p);
  }
  return merged.save();
}

// 1ファイル版のHTMLを開いて、エラーと読みこめない画像がないことを確かめる
async function check(browser, file) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('requestfailed', (r) => { if (r.url().startsWith('file:')) errors.push(`読みこめない: ${r.url()}`); });
  await page.goto(`file://${file}`, { waitUntil: 'networkidle' });
  const broken = await page.$$eval('img', (els) => els.filter((e) => e.complete && !e.naturalWidth).length);
  if (errors.length || broken) throw new Error(`${path.basename(file)} に問題があります: ${errors.join(' / ')} 読みこめない画像 ${broken}`);
  return page;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const [rel, { name }] of Object.entries(PAGES)) fs.writeFileSync(path.join(OUT, `${name}.html`), pageHtml(rel));
  fs.writeFileSync(path.join(OUT, `${NAME_BOOK}.html`), bookletHtml());

  const server = createServer(ROOT);
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch();
  try {
    for (const [rel, { name, title, print }] of Object.entries(PAGES)) {
      const file = path.join(OUT, `${name}.html`);
      const page = await check(browser, file);
      if (print) {
        // 設計書はA4で印刷する前提のレイアウト（doc.css の @media print）
        await page.emulateMedia({ media: 'print' });
        await page.evaluate(() => document.fonts.ready);
        await page.pdf({ path: path.join(OUT, `${name}.pdf`), preferCSSPageSize: true, printBackground: true });
      } else {
        fs.writeFileSync(path.join(OUT, `${name}.pdf`), await longPdf(browser, base + rel, title));
      }
      await page.close();
    }

    // 小冊子のPDF（1ファイル版のHTMLから作り、HTMLが正しく組めていることも確かめる）
    const page = await check(browser, path.join(OUT, `${NAME_BOOK}.html`));
    await page.evaluate(() => window.BOOKLET_READY);
    await page.emulateMedia({ media: 'print' });
    await page.pdf({ path: path.join(OUT, `${NAME_BOOK}.pdf`), preferCSSPageSize: true, printBackground: true });
  } finally {
    await browser.close();
    server.close();
  }
  for (const f of fs.readdirSync(OUT)) {
    console.log(`wrote dist/ibiki-bundle/${f} (${(fs.statSync(path.join(OUT, f)).size / 1024 / 1024).toFixed(1)} MB)`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
