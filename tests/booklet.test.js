/*
 * マンガ小冊子（ibiki-lp/booklet/）のブラウザテスト
 * 実行：npm run test:e2e
 * ※ 文字の大きさで判定するため、Google Fonts を読み込める環境で実行してください
 */
const test = require('node:test');
const { before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const { createServer } = require('../tools/serve');

let server;
let browser;
let page;
const errors = [];

before(async () => {
  server = createServer(path.join(__dirname, '..', 'ibiki-lp'));
  await new Promise((r) => server.listen(0, r));
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://localhost:${server.address().port}/booklet/index.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => window.BOOKLET_READY);
  await page.emulateMedia({ media: 'print' }); // PDFと同じ原寸で測る
});
after(async () => {
  await browser?.close();
  server?.close();
});

test('20ページあり、すべてA5（148×210mm）', async () => {
  const sizes = await page.$$eval('.page', (els) => els.map((e) => [e.offsetWidth, e.offsetHeight]));
  assert.equal(sizes.length, 20);
  for (const [w, h] of sizes) {
    assert.ok(Math.abs(w - 559.37) < 1 && Math.abs(h - 793.7) < 1, `${w}×${h}`);
  }
  assert.deepEqual(errors, []);
});

test('絵がすべて読み込まれている', async () => {
  const broken = await page.$$eval('img', (els) => els.filter((e) => !e.complete || e.naturalWidth === 0).map((e) => e.getAttribute('src')));
  assert.deepEqual(broken, []);
});

test('ふきだしと効果音がコマからはみ出さない', async () => {
  const out = await page.$$eval('.panel', (panels) => panels.flatMap((p) => {
    const pr = p.getBoundingClientRect();
    return [...p.querySelectorAll('.bb, .sfx')].map((b) => {
      const r = b.getBoundingClientRect();
      const bad = r.left < pr.left - 1 || r.right > pr.right + 1 || r.top < pr.top - 1 || r.bottom > pr.bottom + 1;
      return bad ? `${p.dataset.panel}: ${b.textContent}` : null;
    }).filter(Boolean);
  }));
  assert.deepEqual(out, []);
});

test('ホワイトボードなど、絵の中の枠に書く文字が枠からはみ出さない', async () => {
  const out = await page.$$eval('[data-box]', (els) => els.map((b) => {
    const pr = b.closest('.panel').getBoundingClientRect();
    const [x0, y0, x1, y1] = b.dataset.box.split(',').map(Number);
    const box = { left: pr.left + x0 * pr.width, top: pr.top + y0 * pr.height, right: pr.left + x1 * pr.width, bottom: pr.top + y1 * pr.height };
    const r = b.getBoundingClientRect();
    const m = 3; // 枠の線にかからない余白
    const bad = r.left < box.left + m || r.right > box.right - m || r.top < box.top + m || r.bottom > box.bottom - m;
    return bad ? `${b.closest('.panel').dataset.panel}: ${b.textContent}` : null;
  }).filter(Boolean));
  assert.ok((await page.$$('[data-box]')).length > 0);
  assert.deepEqual(out, []);
});

test('同じコマのふきだし同士が重ならない', async () => {
  const out = await page.$$eval('.panel', (panels) => panels.flatMap((p) => {
    const rs = [...p.querySelectorAll('.bb')].map((b) => ({ t: b.textContent, r: b.getBoundingClientRect() }));
    const hits = [];
    for (let i = 0; i < rs.length; i++) {
      for (let j = i + 1; j < rs.length; j++) {
        const a = rs[i].r; const b = rs[j].r;
        if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) hits.push(`${p.dataset.panel}: ${rs[i].t} / ${rs[j].t}`);
      }
    }
    return hits;
  }));
  assert.deepEqual(out, []);
});

test('文字のページで、本文が紙面からはみ出さない', async () => {
  const out = await page.$$eval('.tp', (els) => els.map((e) => {
    const pageEl = e.closest('.page');
    const last = [...e.children].pop().getBoundingClientRect();
    const pr = pageEl.getBoundingClientRect();
    return last.bottom > pr.bottom - 8 ? `${pageEl.id}: ${Math.round(last.bottom - pr.bottom)}px` : null;
  }).filter(Boolean));
  assert.deepEqual(out, []);
});
