/*
 * 栄院 Meta（Facebook・Instagram）広告用ページ（meta-lp/）のブラウザテスト（Playwright + axe-core）
 * 実行：npm run test:e2e
 */
const test = require('node:test');
const { before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { createServer, META_ROOT } = require('../tools/serve');
const { GROUPS } = require('../tools/sync-shared');

const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const ENDPOINT = 'https://form.example.test/sakae';
const EXTERNAL = /fonts\.(googleapis|gstatic)\.com|google\.com\/maps|maps\.google\.com|googletagmanager|lmes\.jp|youtube(-nocookie)?\.com/;
let server;
let base;
let browser;

before(async () => {
  server = createServer(META_ROOT);
  await new Promise((r) => server.listen(0, r));
  base = `http://localhost:${server.address().port}/`;
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  server?.close();
});

async function open(pagePath = 'index.html', { width = 390, height = 844, config, init } = {}) {
  const mobile = width < 600;
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, locale: 'ja-JP', reducedMotion: 'reduce' });
  // 外部（フォント・地図・YouTube・LINE・計測タグ）は読み込まない
  await ctx.route(EXTERNAL, (r) => r.abort());
  if (config) await ctx.addInitScript((c) => { window.LP_CONFIG = c; }, config);
  if (init) await init(ctx);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + pagePath);
  page.errors = errors;
  return page;
}

async function fillForm(page, { name = '栄 花子', tel = '090-1234-5678' } = {}) {
  await page.locator('#reserve-form').scrollIntoViewIfNeeded();
  await page.click('[data-step="1"] [data-next]');
  await page.locator('[data-picker="1"] [data-dates] .chip').nth(1).click();
  await page.locator('[data-picker="1"] [data-times] .chip').nth(0).click();
  await page.click('[data-step="2"] [data-next]');
  await page.fill('input[name="name"]', name);
  await page.fill('input[name="tel"]', tel);
}

test('ほかのページと共通のファイル（main.js・style.css・youtube.css など）が同じ内容になっている（npm run sync:shared）', () => {
  const root = path.join(__dirname, '..');
  GROUPS.filter((g) => g.to.includes('meta-lp')).forEach(({ from, files }) => {
    files.forEach((p) => {
      assert.ok(fs.readFileSync(path.join(root, from, p)).equals(fs.readFileSync(path.join(root, 'meta-lp', p))), `meta-lp/${p} が ${from}/ と異なります。npm run sync:shared を実行してください`);
    });
  });
});

test('スマホ（375×667）の最初の画面に、見出し・院長の写真・予約ボタンが入る', async () => {
  const page = await open('index.html', { width: 375, height: 667 });
  const cta = await page.locator('.yfv__cta .btn--primary').boundingBox();
  assert.ok(cta.y + cta.height <= 667, `CTA bottom ${cta.y + cta.height}px`);
  assert.match(await page.textContent('h1'), /CT撮影込みの無料相談/);
  await page.waitForFunction(() => { const i = document.querySelector('.yfv__doctor-photo'); return i.complete && i.naturalWidth > 0; });
  assert.match(await page.textContent('.yfv__doctor'), /北村 隆典/);
  // 広告から初めて来る人向けのため、YouTube の赤い帯ではなく医院の色にする
  const pre = await page.$eval('.yfv__pre', (el) => getComputedStyle(el).backgroundColor);
  assert.equal(pre, 'rgb(11, 85, 132)');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('コンパクト：スマホでのページの長さが、YouTube をご覧の方向けページの6割以下', async () => {
  const page = await open();
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const yt = createServer(path.join(__dirname, '..', 'youtube-lp'));
  await new Promise((r) => yt.listen(0, r));
  const ytPage = await page.context().newPage();
  await ytPage.goto(`http://localhost:${yt.address().port}/index.html`);
  const ytHeight = await ytPage.evaluate(() => document.documentElement.scrollHeight);
  yt.close();
  assert.ok(height <= ytHeight * 0.6, `meta ${height}px / youtube ${ytHeight}px`);
  // 必要な情報（相談の流れ・医師・費用・リスク・アクセス・予約）は残っている
  for (const id of ['consult', 'doctor', 'price', 'faq', 'reserve', 'access', 'risk']) assert.equal(await page.locator(`#${id}`).count(), 1, id);
  await page.context().close();
});

test('PC では大きな院長の写真を表示する', async () => {
  const page = await open('index.html', { width: 1280, height: 800 });
  assert.equal(await page.isVisible('.yfv__photo'), true);
  assert.equal(await page.isVisible('.yfv__doctor'), false);
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

test('医師（院長・理事長・麻酔医）の写真と、費用・リスクの表示がある', async () => {
  const page = await open();
  for (const sel of ['.mdoctor', '.mteam']) {
    await page.locator(sel).scrollIntoViewIfNeeded();
    await page.waitForFunction((q) => [...document.querySelectorAll(`${q} img`)].every((i) => i.complete && i.naturalWidth > 0), sel);
  }
  assert.match(await page.textContent('.mdoctor'), /院長北村 隆典/);
  const team = await page.$$eval('.mteam li', (els) => els.map((e) => `${e.querySelector('span').textContent} ${e.querySelector('b').textContent}`));
  assert.deepEqual(team, ['医療法人スマイル 理事長 尾崎 隆', '麻酔医 河合 温子']);
  // 医療広告ガイドライン：自由診療であること・費用・リスクを、同じページに表示する
  const price = await page.textContent('#price');
  assert.match(price, /自由診療（公的医療保険の適用外）/);
  assert.match(price, /319,000/);
  assert.match(price, /1,925,000/);
  assert.ok((await page.locator('#risk li').count()) >= 6);
  await page.context().close();
});

test('Meta 広告のURL（fbclid・utm）を記録し、予約リクエストと一緒にPOSTする → 完了ページで栄院 Meta として計測', async () => {
  let posted = null;
  const page = await open('index.html?utm_source=instagram&utm_medium=paid_social&utm_campaign=sakae_implant&utm_content=reel_a&fbclid=IwAR0abc_DEF-123', {
    config: { formEndpoint: ENDPOINT },
    init: (ctx) => ctx.route(ENDPOINT, async (route) => {
      posted = new URLSearchParams(route.request().postData());
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}', headers: { 'access-control-allow-origin': '*' } });
    }),
  });
  // ページ内を移動してから予約しても、最初のURLの情報が残る
  await page.click('.yfv__cta .btn--primary');
  await page.locator('label.chip:has(input[value="入れ歯が合わない・外れる"])').click();
  await fillForm(page);
  await Promise.all([page.waitForURL(/thanks\.html$/), page.click('[data-submit]')]);
  assert.equal(posted.get('fbclid'), 'IwAR0abc_DEF-123');
  assert.equal(posted.get('utm_source'), 'instagram');
  assert.equal(posted.get('utm_medium'), 'paid_social');
  assert.equal(posted.get('utm_content'), 'reel_a');
  assert.deepEqual(posted.getAll('concerns'), ['入れ歯が合わない・外れる']);
  assert.equal(posted.get('name'), '栄 花子');
  assert.equal(posted.get('video'), null, 'このページには「ご覧になった動画」の項目はない');
  const done = await page.evaluate(() => window.dataLayer.filter((d) => d.event === 'reservation_complete'));
  assert.deepEqual(done.map((d) => d.lp_name), ['sakae_meta']);
  assert.equal(await page.getAttribute('.thanks .btn--tel', 'href'), 'tel:0529573357');
  await page.context().close();
});

test('入力チェックとデモ送信 → 完了ページに希望日時を表示（デモでは予約完了を計測しない）', async () => {
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
  await page.fill('input[name="name"]', '栄 花子');
  await page.fill('input[name="tel"]', '090-1234-5678');
  await Promise.all([page.waitForURL(/thanks\.html\?demo=1/), page.click('[data-submit]')]);
  assert.ok(await page.isVisible('#demo-banner'));
  assert.match(await page.textContent('#booking-list'), /第1希望：\d+月\d+日（.） 午前/);
  assert.equal(await page.evaluate(() => (window.dataLayer || []).some((d) => d.event === 'reservation_complete')), false);
  await page.context().close();
});

test('LINEボタンは Meta 広告用の流入経路を使い、押したときに計測する。計測タグは本番以外で読み込まない', async () => {
  const page = await open();
  await page.locator('.mline').scrollIntoViewIfNeeded();
  assert.equal(await page.isVisible('.mline'), true);
  const lineHrefs = await page.$$eval('[data-line-link]:not([hidden])', (els) => els.map((a) => a.href));
  assert.ok(lineHrefs.length >= 4, 'FV・LINE欄・予約欄・追従ボタン');
  lineHrefs.forEach((h) => assert.equal(h, 'https://s.lmes.jp/landing-qr/2009474189-L4Gp5PRA?uLand=dPTarC'));
  await page.click('.mline [data-line-link]');
  const clicks = await page.evaluate(() => window.dataLayer.filter((d) => d.event === 'line_click').length);
  assert.equal(clicks, 1);
  assert.equal(await page.evaluate(() => !!document.querySelector('script[src*="googletagmanager"]')), false);
  await page.context().close();
});

test('動画：押したときだけ YouTube（プライバシー強化モード）を読み込む', async () => {
  const page = await open();
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('img, iframe')].some((e) => /ytimg|youtube/.test(e.src))), false);
  const card = page.locator('a[data-yt-id="zrfoEAU_z-E"]');
  assert.equal(await card.getAttribute('href'), 'https://www.youtube.com/watch?v=zrfoEAU_z-E');
  await card.click();
  const frame = page.locator('iframe.yvideo__frame');
  await frame.waitFor();
  assert.equal(await frame.getAttribute('src'), 'https://www.youtube-nocookie.com/embed/zrfoEAU_z-E?autoplay=1&rel=0&playsinline=1');
  await page.context().close();
});

test('追従ボタン：最初は非表示、スクロールで表示、フォーム付近で非表示', async () => {
  const page = await open();
  const visible = () => page.evaluate(() => document.querySelector('[data-sticky]').classList.contains('is-visible'));
  assert.equal(await visible(), false);
  await page.evaluate(() => window.scrollTo(0, document.querySelector('#doctor').offsetTop));
  await page.waitForFunction(() => document.querySelector('[data-sticky]').classList.contains('is-visible'));
  await page.evaluate(() => document.querySelector('#reserve-form').scrollIntoView());
  await page.waitForFunction(() => !document.querySelector('[data-sticky]').classList.contains('is-visible'));
  assert.equal(await visible(), false);
  await page.context().close();
});

for (const pagePath of ['index.html', 'thanks.html', 'privacy.html']) {
  test(`名駅歯科の情報が混ざっていない - ${pagePath}`, async () => {
    const page = await open(pagePath);
    // 画面に出る文字・リンク先・ページ名（HTMLのコメントは対象外）
    const shown = await page.evaluate(() => [document.title, document.body.innerText, ...[...document.querySelectorAll('[href],[src]')].map((e) => e.getAttribute('href') || e.getAttribute('src'))].join('\n'));
    assert.doesNotMatch(shown, /名駅|052-571|0525713345|meieki/i);
    assert.match(shown, /052-957-3357/);
    await page.context().close();
  });
}

test('送信先が未設定の公開サーバーでは、最初からフォームを止めて栄院の電話を案内する', async () => {
  const host = 'https://www.ultimate-dental.com/meta/';
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await ctx.route(EXTERNAL, (r) => r.abort());
  // 公開サーバーへのアクセスを、ローカルの meta-lp/ に振り向けて再現する（GTM は上で止めている）
  await ctx.route((url) => url.href.startsWith(host), async (route) => {
    const rel = route.request().url().slice(host.length);
    const res = await fetch(base + rel);
    await route.fulfill({ status: res.status, body: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get('content-type') || undefined });
  });
  const p = await ctx.newPage();
  await p.goto(`${host}index.html`);
  await p.locator('#reserve').scrollIntoViewIfNeeded();
  assert.equal(await p.isVisible('#reserve-form'), false, 'フォームは表示しない');
  assert.equal(await p.isVisible('[data-form-unavailable]'), true, '電話の案内を表示');
  assert.equal(await p.getAttribute('[data-form-unavailable] a', 'href'), 'tel:0529573357');
  // 本番のドメインでは計測タグ（GTM。Meta のピクセルもここから）を読み込む
  assert.equal(await p.evaluate(() => !!document.querySelector('script[src*="googletagmanager.com/gtm.js?id=GTM-TKQ2RFV"]')), true);
  await ctx.close();
});

for (const pagePath of ['index.html', 'thanks.html', 'privacy.html']) {
  test(`アクセシビリティ（axe）：重大な問題がない - ${pagePath}`, async () => {
    const page = await open(pagePath);
    await page.addScriptTag({ content: AXE });
    const result = await page.evaluate(() => window.axe.run(document, { resultTypes: ['violations'] }));
    const serious = result.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
    assert.deepEqual(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`), []);
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });
}
