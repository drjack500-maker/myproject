/*
 * LP のブラウザテスト（Playwright + axe-core）
 * 実行：npm run test:e2e
 */
const test = require('node:test');
const { before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { createServer } = require('../tools/serve');

const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const ENDPOINT = 'https://form.example.test/submit';
let server;
let base;
let browser;

before(async () => {
  server = createServer();
  await new Promise((r) => server.listen(0, r));
  base = `http://localhost:${server.address().port}/`;
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  server?.close();
});

async function open(path = 'index.html', { width = 390, height = 844, config, init } = {}) {
  const mobile = width < 600;
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, locale: 'ja-JP', reducedMotion: 'reduce' });
  // 外部（フォント・地図）は読み込まない
  await ctx.route(/fonts\.(googleapis|gstatic)\.com|google\.com\/maps|maps\.google\.com/, (r) => r.abort());
  if (config) await ctx.addInitScript((c) => { window.LP_CONFIG = c; }, config);
  if (init) await init(ctx);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + path);
  page.errors = errors;
  return page;
}

async function fillForm(page, { name = '名駅 花子', tel = '090-1234-5678' } = {}) {
  await page.locator('#reserve-form').scrollIntoViewIfNeeded();
  await page.click('[data-step="1"] [data-next]');
  await page.locator('[data-picker="1"] [data-dates] .chip').nth(1).click();
  await page.locator('[data-picker="1"] [data-times] .chip').nth(0).click();
  await page.click('[data-step="2"] [data-next]');
  await page.fill('input[name="name"]', name);
  await page.fill('input[name="tel"]', tel);
}

test('スマホ（375×667）の最初の画面に予約ボタンが入る', async () => {
  const page = await open('index.html', { width: 375, height: 667 });
  const box = await page.locator('.fv-card .btn--primary').boundingBox();
  assert.ok(box.y + box.height <= 667, `CTA bottom ${box.y + box.height}px`);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('フォームの全ステップで横スクロールが発生しない（幅360px）', async () => {
  const page = await open('index.html', { width: 360, height: 740 });
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.equal(await overflow(), 0);
  await page.locator('#reserve-form').scrollIntoViewIfNeeded();
  await page.click('[data-step="1"] [data-next]');
  assert.equal(await overflow(), 0, 'step 2');
  await page.locator('[data-picker="1"] [data-dates] .chip').nth(0).click();
  await page.locator('[data-picker="1"] [data-times] .chip').nth(0).click();
  await page.click('[data-step="2"] [data-next]');
  assert.equal(await overflow(), 0, 'step 3');
  await page.context().close();
});

test('見出しの出し分け（?v= と utm_term）', async () => {
  let page = await open('index.html?v=bone');
  assert.match(await page.textContent('#fv-title'), /骨が少なくても/);
  await page.context().close();
  page = await open(`index.html?utm_term=${encodeURIComponent('オールオン4 費用 名古屋')}`);
  assert.equal(await page.evaluate(() => document.documentElement.dataset.variant), 'price');
  await page.context().close();
  page = await open('index.html?v=unknown');
  assert.match(await page.textContent('#fv-title'), /手術したその日に/);
  await page.context().close();
});

test('お悩みチェックの選択がフォームに引き継がれる', async () => {
  const page = await open();
  await page.locator('.worry').nth(0).click();
  await page.locator('.worry').nth(6).click();
  assert.equal(await page.textContent('[data-worry-count]'), '2');
  const checked = await page.$$eval('input[name="concerns"]:checked', (els) => els.map((e) => e.dataset.concern));
  assert.deepEqual(checked.sort(), ['bone', 'denture']);
  await page.locator('.worry').nth(0).click(); // 解除
  const after = await page.$$eval('input[name="concerns"]:checked', (els) => els.map((e) => e.dataset.concern));
  assert.deepEqual(after, ['bone']);
  await page.context().close();
});

test('医療費控除シミュレーターの計算', async () => {
  const page = await open();
  assert.equal(await page.textContent('[data-sim="total"]'), '368,832');
  await page.fill('#sim-cost', '');
  await page.type('#sim-cost', '2500000');
  await page.selectOption('#sim-rate', '0.05');
  assert.equal(await page.inputValue('#sim-cost'), '2,500,000');
  assert.equal(await page.textContent('[data-sim="deduction"]'), '2,000,000');
  assert.equal(await page.textContent('[data-sim="total"]'), '302,100');
  await page.context().close();
});

test('入力チェックとデモ送信 → 完了ページに希望日時を表示', async () => {
  const page = await open();
  await page.locator('#reserve-form').scrollIntoViewIfNeeded();
  await page.click('[data-step="1"] [data-next]');
  await page.click('[data-step="2"] [data-next]');
  assert.ok(await page.isVisible('[data-error="date1"]'), '日付未選択エラー');
  await page.locator('[data-picker="1"] [data-dates] .chip').nth(1).click();
  await page.locator('[data-picker="1"] [data-times] .chip').nth(0).click();
  await page.click('[data-step="2"] [data-next]');
  await page.fill('input[name="tel"]', '1234');
  await page.click('[data-submit]');
  assert.ok(await page.isVisible('[data-error="name"]'));
  assert.ok(await page.isVisible('[data-error="tel"]'));
  await page.fill('input[name="name"]', '名駅 花子');
  await page.fill('input[name="tel"]', '090-1234-5678');
  await Promise.all([page.waitForURL(/thanks\.html\?demo=1/), page.click('[data-submit]')]);
  assert.ok(await page.isVisible('#demo-banner'));
  assert.match(await page.textContent('#booking-list'), /第1希望：\d+月\d+日（.） 午前/);
  await page.context().close();
});

test('送信先設定時：流入元つきでPOSTし、完了ページへ', async () => {
  let posted = null;
  const page = await open(`index.html?utm_source=google&utm_term=${encodeURIComponent('入れ歯 合わない')}&gclid=TESTGCLID`, {
    config: { formEndpoint: ENDPOINT },
    init: (ctx) => ctx.route(ENDPOINT, async (route) => {
      posted = { body: route.request().postData(), type: route.request().headers()['content-type'] };
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}', headers: { 'access-control-allow-origin': '*' } });
    }),
  });
  await page.locator('.worry').nth(0).click();
  await page.locator('.worry').nth(4).click();
  await fillForm(page);
  await Promise.all([page.waitForURL(/thanks\.html$/), page.click('[data-submit]')]);
  assert.match(posted.type, /application\/x-www-form-urlencoded/);
  const p = new URLSearchParams(posted.body);
  assert.deepEqual(p.getAll('concerns').sort(), ['入れ歯が合わない・外れる', '歯がグラグラする・歯周病'].sort());
  assert.equal(p.get('name'), '名駅 花子');
  assert.equal(p.get('tel'), '090-1234-5678');
  assert.match(p.get('date1'), /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(p.get('time1'));
  assert.equal(p.get('gclid'), 'TESTGCLID');
  assert.equal(p.get('utm_source'), 'google');
  assert.equal(p.get('lp_variant'), 'denture');
  assert.ok(Number(p.get('elapsed')) >= 0);
  assert.equal(p.get('website'), '');
  await page.context().close();
});

test('送信エラー時：電話案内を表示し、再送信できる', async () => {
  const page = await open('index.html', {
    config: { formEndpoint: ENDPOINT },
    init: (ctx) => ctx.route(ENDPOINT, (route) => route.fulfill({ status: 500, body: 'error', headers: { 'access-control-allow-origin': '*' } })),
  });
  await fillForm(page);
  await page.click('[data-submit]');
  await page.waitForSelector('[data-error="submit"]:not([hidden])');
  assert.equal(await page.isDisabled('[data-submit]'), false);
  assert.match(await page.textContent('[data-submit]'), /予約リクエストを送信/);
  await page.context().close();
});

test('スパム対策：見えない項目に入力があると送信しない', async () => {
  let requests = 0;
  const page = await open('index.html', {
    config: { formEndpoint: ENDPOINT },
    init: (ctx) => ctx.route(ENDPOINT, (route) => { requests += 1; return route.fulfill({ status: 200, body: '{"ok":true}' }); }),
  });
  await fillForm(page);
  await page.evaluate(() => { document.querySelector('input[name="website"]').value = 'http://spam.example'; });
  await Promise.all([page.waitForURL(/thanks\.html/), page.click('[data-submit]')]);
  assert.equal(requests, 0);
  await page.context().close();
});

test('追従ボタン：最初は非表示、スクロールで表示、フォーム付近で非表示', async () => {
  const page = await open();
  const visible = () => page.evaluate(() => document.querySelector('[data-sticky]').classList.contains('is-visible'));
  assert.equal(await visible(), false);
  await page.evaluate(() => window.scrollTo(0, document.querySelector('#about').offsetTop));
  await page.waitForFunction(() => document.querySelector('[data-sticky]').classList.contains('is-visible'));
  await page.evaluate(() => document.querySelector('#reserve-form').scrollIntoView());
  await page.waitForFunction(() => !document.querySelector('[data-sticky]').classList.contains('is-visible'));
  assert.equal(await visible(), false);
  await page.context().close();
});

test('院長写真が未設置でも崩れない／文字拡大が保存される', async () => {
  const page = await open();
  await page.waitForFunction(() => document.querySelector('.doctor').classList.contains('is-noimg'));
  await page.click('[data-fs-toggle]');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.fs), 'lg');
  await page.reload();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.fs), 'lg');
  await page.context().close();
});

for (const path of ['index.html', 'thanks.html', 'privacy.html']) {
  test(`アクセシビリティ（axe）：重大な問題がない - ${path}`, async () => {
    const page = await open(path);
    await page.addScriptTag({ content: AXE });
    const result = await page.evaluate(() => window.axe.run(document, { resultTypes: ['violations'] }));
    const serious = result.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
    assert.deepEqual(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`), []);
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });
}
