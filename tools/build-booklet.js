/*
 * マンガ小冊子「私の眠りの記録」の配布用PDF（A5・20ページ）を作る
 *   npm run build:booklet            → ibiki-lp/booklet/nemuri-kiroku.pdf
 *   npm run build:booklet -- --png   → あわせて dist/booklet/p01.png〜（ページごとの確認用画像）
 * フォントは Google Fonts から読み込むため、ネットにつながる環境で実行してください。
 */
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { createServer } = require('./serve');

const ROOT = path.join(__dirname, '..', 'ibiki-lp');
const OUT_PDF = path.join(ROOT, 'booklet', 'nemuri-kiroku.pdf');
const OUT_PNG = path.join(__dirname, '..', 'dist', 'booklet');

(async () => {
  const server = createServer(ROOT);
  await new Promise((r) => server.listen(0, r));
  const url = `http://localhost:${server.address().port}/booklet/index.html`;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(() => window.BOOKLET_READY);
    if (errors.length) throw new Error(errors.join('\n'));
    const fonts = await page.evaluate(() => [...new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family))]);
    for (const f of ['Zen Maru Gothic', 'Klee One', 'Dela Gothic One', 'Shippori Mincho B1', 'BIZ UDPGothic']) {
      if (!fonts.some((x) => x.replace(/"/g, '') === f)) throw new Error(`フォントが読み込めていません: ${f}（ネット接続を確認）`);
    }
    await page.emulateMedia({ media: 'print' });
    await page.pdf({ path: OUT_PDF, preferCSSPageSize: true, printBackground: true });
    console.log(`wrote ${path.relative(process.cwd(), OUT_PDF)} (${(fs.statSync(OUT_PDF).size / 1024 / 1024).toFixed(1)} MB)`);

    if (process.argv.includes('--png')) {
      fs.mkdirSync(OUT_PNG, { recursive: true });
      await page.emulateMedia({ media: 'screen' });
      await page.evaluate(() => document.documentElement.style.setProperty('--z', '1'));
      const n = await page.locator('.page').count();
      for (let i = 0; i < n; i++) {
        await page.locator('.page').nth(i).screenshot({ path: path.join(OUT_PNG, `p${String(i + 1).padStart(2, '0')}.png`) });
      }
      console.log(`wrote ${n} pages to ${path.relative(process.cwd(), OUT_PNG)}/`);
    }
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
