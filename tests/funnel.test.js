/*
 * 販売導線（小冊子プレゼント・12週間コース・設計書）のブラウザテスト
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
let server;
let base;
let browser;

before(async () => {
  server = createServer(path.join(__dirname, '..', 'ibiki-lp'));
  await new Promise((r) => server.listen(0, r));
  base = `http://localhost:${server.address().port}/`;
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  server?.close();
});

async function open(file, { width = 390, height = 844, config, colorScheme = 'light' } = {}) {
  const mobile = width < 600;
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, locale: 'ja-JP', reducedMotion: 'reduce', colorScheme });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  if (config) await ctx.addInitScript((c) => { window.LP_CONFIG = c; }, config);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + file);
  page.errors = errors;
  return page;
}
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test('小冊子プレゼント：最初の画面にLINEのボタンがあり、横スクロールしない', async () => {
  const page = await open('free/index.html', { width: 375, height: 667, config: { preview: false } });
  const box = await page.locator('[data-line="hero"]').boundingBox();
  assert.ok(box.y + box.height <= 667, `CTA bottom ${box.y + box.height}`);
  assert.equal(await overflow(page), 0);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('小冊子プレゼント：LINEのURLを設定すると、すべてのボタンがそこへ向く', async () => {
  let page = await open('free/index.html', { config: { lineUrl: 'https://lin.ee/example' } });
  const hrefs = await page.$$eval('[data-line]', (els) => els.map((e) => e.getAttribute('href')));
  assert.equal(hrefs.length, 3);
  assert.ok(hrefs.every((h) => h === 'https://lin.ee/example'));
  await page.context().close();
  page = await open('free/index.html');
  assert.equal(await page.locator('.todo-note', { hasText: 'CONFIG.lineUrl' }).count(), 1, '手元の確認では未設定を表示');
  await page.context().close();
});

for (const width of [320, 390, 1280]) {
  test(`12週間コース・設計書：横スクロールしない（幅${width}px）`, async () => {
    for (const file of ['program/index.html', 'funnel/index.html']) {
      const page = await open(file, { width, height: 900 });
      assert.equal(await overflow(page), 0, file);
      assert.deepEqual(page.errors, []);
      await page.context().close();
    }
  });
}

async function fillApplication(page, { red = false, cpap = false } = {}) {
  await page.fill('input[name="name"]', '田中 誠');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.selectOption('select[name="age"]', '50代');
  await page.check('input[name="who"][value="self"]');
  await page.check(`input[name="q_apnea"][value="${red ? 'yes' : 'no'}"]`);
  await page.check('input[name="q_drowsy"][value="no"]');
  await page.check('input[name="q_headache"][value="no"]');
  await page.check(`input[name="q_cpap"][value="${cpap ? 'yes' : 'no'}"]`);
  await page.selectOption('select[name="start"]', '来月から');
  await page.check('input[name="device"][value="ok"]');
  for (const n of ['agree_medical', 'agree_price', 'agree_privacy', 'agree_family']) await page.check(`input[name="${n}"]`);
}

test('申込フォーム：受診の目安に当てはまると、受診を案内して送信できない', async () => {
  const page = await open('program/index.html');
  await fillApplication(page, { red: true });
  assert.equal(await page.isVisible('#apply-stop'), true);
  assert.equal(await page.isDisabled('#apply-submit'), true);
  await page.check('input[name="q_apnea"][value="no"]');
  assert.equal(await page.isVisible('#apply-stop'), false);
  assert.equal(await page.isDisabled('#apply-submit'), false);
  await page.context().close();
});

test('申込フォーム：治療中の方は「主治医に確認した」が必要。送信すると流入元つきでPOSTし、完了を表示', async () => {
  const page = await open('program/index.html?utm_source=line&utm_campaign=seminar', { config: { applyEndpoint: 'https://form.example.test/apply' } });
  let posted = null;
  await page.route('https://form.example.test/apply', (r) => { posted = new URLSearchParams(r.request().postData()); r.fulfill({ status: 200, body: 'ok' }); });
  await fillApplication(page, { cpap: true });
  await page.click('#apply-submit');
  assert.equal(posted, null, '主治医の確認がないと送らない');
  assert.equal(await page.isVisible('#apply-done'), false);
  await page.check('input[name="cpap_ok"]');
  await page.click('#apply-submit');
  await page.waitForSelector('#apply-done:not([hidden])');
  assert.equal(posted.get('name'), '田中 誠');
  assert.equal(posted.get('q_cpap'), 'yes');
  assert.equal(posted.get('cpap_ok'), 'yes');
  assert.equal(posted.get('utm_source'), 'line');
  assert.equal(posted.get('utm_campaign'), 'seminar');
  assert.ok(Number(posted.get('elapsed')) >= 0);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('申込フォーム：送信先が未設定でも、手元の確認では送らずに完了を表示する', async () => {
  const page = await open('program/index.html');
  await fillApplication(page);
  await page.click('#apply-submit');
  await page.waitForSelector('#apply-done:not([hidden])');
  await page.context().close();
});

test('設計書：収支シミュレーターが計算し、入力に合わせて変わる', async () => {
  const page = await open('funnel/index.html', { width: 1280, height: 900 });
  // 1000人 × 90% × 25% × 5% × 85% × 85% ≒ 8.1人
  assert.equal(await page.textContent('#o-students'), '8.1人');
  assert.equal(await page.locator('#o-funnel .bar').count(), 6);
  const fills = await page.$$eval('#o-funnel .bar__fill', (els) => els.map((e) => e.getBoundingClientRect().width));
  assert.ok(fills[0] > 300 && fills[5] >= 2 && fills[5] < fills[0], `棒の長さ ${fills.join(', ')}`);
  await page.fill('#s-ad', '5000000');
  assert.equal(await page.textContent('#o-students'), '20人', '受付上限で止まる');
  assert.match(await page.textContent('#o-cap'), /受付上限で打ち止め/);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

for (const [file, colorScheme] of [['free/index.html', 'light'], ['program/index.html', 'light'], ['program/index.html', 'dark'], ['funnel/index.html', 'light'], ['privacy.html', 'light']]) {
  test(`アクセシビリティ（axe）：重大な問題がない - ${file}（${colorScheme}）`, async () => {
    const page = await open(file, { colorScheme });
    await page.addScriptTag({ content: AXE });
    const result = await page.evaluate(() => window.axe.run(document, { resultTypes: ['violations'] }));
    const serious = result.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
    assert.deepEqual(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`), []);
    await page.context().close();
  });
}
