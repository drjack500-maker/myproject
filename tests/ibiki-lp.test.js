/*
 * いびきLP（ibiki/lp）のブラウザテスト（Playwright + axe-core）
 * 実行：npm run test:e2e
 */
const test = require('node:test');
const { before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { createServer } = require('../tools/serve');

const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const URLS = {
  default: 'https://line.example.test/default',
  tiktok: 'https://line.example.test/tiktok',
  instagram: 'https://line.example.test/instagram',
};
let server;
let base;
let browser;

before(async () => {
  server = createServer(path.join(__dirname, '..', 'ibiki', 'lp'));
  await new Promise((r) => server.listen(0, r));
  base = `http://localhost:${server.address().port}/`;
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  server?.close();
});

async function open(page = 'index.html', { width = 390, height = 844, config } = {}) {
  const mobile = width < 600;
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, locale: 'ja-JP', reducedMotion: 'reduce' });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com|googletagmanager|line\.example\.test/, (r) => r.abort());
  if (config) await ctx.addInitScript((c) => { window.IBIKI_CONFIG = c; }, config);
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(base + page);
  p.errors = errors;
  return p;
}

const lineHrefs = (page) => page.$$eval('[data-line]', (els) => els.map((a) => a.getAttribute('href')));

test('LINEのURLが未設定のときは、ボタンを止めて準備中を表示する', async () => {
  const page = await open();
  assert.equal(await page.locator('[data-line].is-disabled').count(), await page.locator('[data-line]').count());
  assert.equal(await page.isVisible('#line'), false);
  // aria-disabled のボタンも実際にはタップできる（押したら準備中の案内を出す）
  await page.click('.hero [data-line]', { force: true });
  assert.equal(await page.isVisible('#line'), true);
  assert.equal(page.url(), base + 'index.html'); // 移動せず、その場で案内する
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('流入元（?src= / utm_source）ごとにLINEのURLを切り替える', async () => {
  let page = await open('index.html', { config: { lineUrls: URLS } });
  (await lineHrefs(page)).forEach((h) => assert.equal(h, URLS.default));
  await page.context().close();

  page = await open('index.html?src=tt', { config: { lineUrls: URLS } });
  (await lineHrefs(page)).forEach((h) => assert.equal(h, URLS.tiktok));
  await page.context().close();

  page = await open('index.html?utm_source=Instagram', { config: { lineUrls: URLS } });
  (await lineHrefs(page)).forEach((h) => assert.equal(h, URLS.instagram));
  await page.context().close();

  // 流入元のURLが未設定なら default を使う
  page = await open('index.html?src=youtube', { config: { lineUrls: URLS } });
  (await lineHrefs(page)).forEach((h) => assert.equal(h, URLS.default));
  await page.context().close();
});

test('プライバシーポリシーを見て戻っても流入元を保つ', async () => {
  const page = await open('index.html?src=tiktok', { config: { lineUrls: URLS } });
  await page.click('a[href="privacy.html"]');
  await page.click('a[href="index.html"] >> nth=0');
  assert.equal(new URL(page.url()).search, '');
  (await lineHrefs(page)).forEach((h) => assert.equal(h, URLS.tiktok));
  await page.context().close();
});

test('https 以外のURLは使わない', async () => {
  const page = await open('index.html', { config: { lineUrls: { default: 'javascript:alert(1)' } } });
  assert.equal(await page.locator('[data-line].is-disabled').count(), await page.locator('[data-line]').count());
  await page.context().close();
});

test('LINEボタンのクリックを計測する（dataLayer）', async () => {
  const page = await open('index.html?src=tiktok', { config: { lineUrls: URLS } });
  // テストではLINEへ移動しないよう、ボタンの処理のあとで止める
  await page.evaluate(() => document.addEventListener('click', (e) => { if (e.target.closest('[data-line]')) e.preventDefault(); }));
  await page.click('.hero [data-line]');
  const ev = await page.evaluate(() => window.dataLayer.find((d) => d.event === 'line_click'));
  assert.deepEqual(ev, { event: 'line_click', cta: 'hero', src: 'tiktok', available: true });
  await page.context().close();
});

test('計測タグは本番ドメイン以外では読み込まない', async () => {
  const page = await open('index.html', { config: { gtmId: 'GTM-TEST', prodHosts: ['example.com'] } });
  assert.equal(await page.evaluate(() => !!document.querySelector('script[src*="googletagmanager"]')), false);
  await page.context().close();
});

test('スマホ（375×667）の最初の画面にLINEボタンが入る', async () => {
  const page = await open('index.html', { width: 375, height: 667 });
  const box = await page.locator('.hero [data-line]').boundingBox();
  assert.ok(box.y + box.height <= 667, `CTA bottom ${box.y + box.height}px`);
  await page.context().close();
});

test('追従ボタンは最初の画面と最後のCTAでは隠れ、途中では出る', async () => {
  const page = await open('index.html', { width: 390, height: 844 });
  assert.equal(await page.isVisible('[data-sticky]'), false);
  await page.locator('#gifts').scrollIntoViewIfNeeded();
  await page.waitForSelector('[data-sticky]', { state: 'visible' });
  await page.locator('.closing').scrollIntoViewIfNeeded();
  await page.waitForSelector('[data-sticky]', { state: 'hidden' });
  await page.context().close();
});

test('横スクロールが発生しない（幅360px）', async () => {
  const page = await open('index.html', { width: 360, height: 740 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), 0);
  await page.context().close();
});

for (const p of ['index.html', 'privacy.html']) {
  test(`アクセシビリティ（axe）：重大な問題がない - ibiki/lp/${p}`, async () => {
    const page = await open(p, { config: { lineUrls: URLS } });
    await page.addScriptTag({ content: AXE });
    const result = await page.evaluate(() => window.axe.run(document, { resultTypes: ['violations'] }));
    const serious = result.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
    assert.deepEqual(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`), []);
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });
}
