/*
 * 栄院 YouTube をご覧の方向けページ（youtube-lp/）のブラウザテスト（Playwright + axe-core）
 * 実行：npm run test:e2e
 */
const test = require('node:test');
const { before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { createServer, YOUTUBE_ROOT } = require('../tools/serve');
const { SHARED } = require('../tools/sync-shared');

const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const ENDPOINT = 'https://form.example.test/sakae';
const EXTERNAL = /fonts\.(googleapis|gstatic)\.com|google\.com\/maps|maps\.google\.com|googletagmanager|lmes\.jp|youtube(-nocookie)?\.com/;
let server;
let base;
let browser;

before(async () => {
  server = createServer(YOUTUBE_ROOT);
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
  // 外部（フォント・地図・YouTube・LINE）は読み込まない
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

test('名駅歯科LPと共通のファイル（main.js・style.css など）が同じ内容になっている（npm run sync:shared）', () => {
  const root = path.join(__dirname, '..');
  SHARED.forEach((p) => {
    assert.ok(fs.readFileSync(path.join(root, 'lp', p)).equals(fs.readFileSync(path.join(root, 'youtube-lp', p))), `${p} が lp/ と異なります。npm run sync:shared を実行してください`);
  });
});

test('スマホ（375×667）の最初の画面に、院長の写真と予約ボタンが入る', async () => {
  const page = await open('index.html', { width: 375, height: 667 });
  const cta = await page.locator('.yfv__cta .btn--primary').boundingBox();
  assert.ok(cta.y + cta.height <= 667, `CTA bottom ${cta.y + cta.height}px`);
  const photo = page.locator('.yfv__doctor-photo');
  assert.equal(await photo.isVisible(), true);
  await page.waitForFunction(() => { const i = document.querySelector('.yfv__doctor-photo'); return i.complete && i.naturalWidth > 0; });
  assert.match(await page.textContent('.yfv__doctor'), /北村 隆典/);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('PC では大きな院長の写真を表示する', async () => {
  const page = await open('index.html', { width: 1280, height: 800 });
  assert.equal(await page.isVisible('.yfv__photo'), true);
  assert.equal(await page.isVisible('.yfv__doctor'), false);
  await page.waitForFunction(() => { const i = document.querySelector('.yfv__photo img'); return i.complete && i.naturalWidth > 0; });
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

test('動画：押すと YouTube（プライバシー強化モード）の再生画面に置き換わり、再生を計測する', async () => {
  const page = await open();
  const card = page.locator('a[data-yt-id="_1oVBw7qt2Q"]');
  assert.equal(await card.getAttribute('href'), 'https://www.youtube.com/watch?v=_1oVBw7qt2Q', 'JavaScript が無効でも YouTube を開ける');
  await card.click();
  const frame = page.locator('iframe.yvideo__frame');
  await frame.waitFor();
  assert.equal(await frame.getAttribute('src'), 'https://www.youtube-nocookie.com/embed/_1oVBw7qt2Q?autoplay=1&rel=0&playsinline=1');
  assert.match(await frame.getAttribute('title'), /オールオン4の費用/);
  assert.equal(await page.locator('a[data-yt-id="_1oVBw7qt2Q"]').count(), 0);
  const plays = await page.evaluate(() => window.dataLayer.filter((d) => d.event === 'video_play').map((d) => d.video_id));
  assert.deepEqual(plays, ['_1oVBw7qt2Q']);
  // サムネイル画像などの YouTube の読み込みは、押すまで発生しない
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('img')].some((i) => /ytimg|youtube/.test(i.src))), false);
  await page.context().close();
});

test('すべての動画カードに正しい形式の動画IDが入っている', async () => {
  const page = await open();
  const ids = await page.$$eval('a[data-yt-id]', (els) => els.map((a) => [a.dataset.ytId, a.href]));
  assert.ok(ids.length >= 9);
  ids.forEach(([id, href]) => {
    assert.match(id, /^[\w-]{11}$/);
    assert.equal(href, `https://www.youtube.com/watch?v=${id}`);
  });
  // フォームの「ご覧になった動画」にも、ページの動画がすべて並んでいる
  const options = await page.$$eval('select[name="video"] option[data-video-id]', (els) => els.map((o) => o.dataset.videoId));
  assert.deepEqual([...options].sort(), ids.map(([id]) => id).sort());
  await page.context().close();
});

test('説明欄のURL（utm_content=動画ID）から、ご覧になった動画を選び、流入元つきでPOSTする', async () => {
  let posted = null;
  const page = await open('index.html?utm_source=youtube&utm_medium=video&utm_campaign=organic&utm_content=aXv3-aiTJxQ', {
    config: { formEndpoint: ENDPOINT },
    init: (ctx) => ctx.route(ENDPOINT, async (route) => {
      posted = new URLSearchParams(route.request().postData());
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}', headers: { 'access-control-allow-origin': '*' } });
    }),
  });
  assert.equal(await page.inputValue('select[name="video"]'), 'インプラント治療をおすすめしない方');
  await page.locator('#reserve-form').scrollIntoViewIfNeeded();
  await page.locator('label.chip:has(input[value="オールオン4"])').click();
  await page.locator('label.chip:has(input[value="院長（北村）の説明を希望"])').click();
  await fillForm(page);
  await Promise.all([page.waitForURL(/thanks\.html$/), page.click('[data-submit]')]);
  assert.equal(posted.get('video'), 'インプラント治療をおすすめしない方');
  assert.equal(posted.get('utm_source'), 'youtube');
  assert.equal(posted.get('utm_content'), 'aXv3-aiTJxQ');
  assert.deepEqual(posted.getAll('concerns').sort(), ['オールオン4', '院長（北村）の説明を希望'].sort());
  assert.equal(posted.get('name'), '栄 花子');
  // 完了ページ：栄院として予約完了を計測し、栄院の電話番号を案内する
  const done = await page.evaluate(() => window.dataLayer.find((d) => d.event === 'reservation_complete'));
  assert.equal(done.lp_name, 'sakae_youtube');
  assert.equal(await page.getAttribute('.thanks .btn--tel', 'href'), 'tel:0529573357');
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
  await page.fill('input[name="name"]', '栄 花子');
  await page.fill('input[name="tel"]', '090-1234-5678');
  await Promise.all([page.waitForURL(/thanks\.html\?demo=1/), page.click('[data-submit]')]);
  assert.ok(await page.isVisible('#demo-banner'));
  assert.match(await page.textContent('#booking-list'), /第1希望：\d+月\d+日（.） 午前/);
  await page.context().close();
});

test('送信エラー時：栄院の電話番号を案内し、再送信できる', async () => {
  const page = await open('index.html', {
    config: { formEndpoint: ENDPOINT },
    init: (ctx) => ctx.route(ENDPOINT, (route) => route.fulfill({ status: 500, body: 'error', headers: { 'access-control-allow-origin': '*' } })),
  });
  await fillForm(page);
  await page.click('[data-submit]');
  await page.waitForSelector('[data-error="submit"]:not([hidden])');
  assert.match(await page.textContent('[data-error="submit"]'), /052-957-3357/);
  assert.equal(await page.isDisabled('[data-submit]'), false);
  await page.context().close();
});

test('LINEボタンはページ内の設定（YouTube 用の流入経路）を使い、計測タグは本番以外で読み込まない', async () => {
  const page = await open();
  await page.locator('.booklet').scrollIntoViewIfNeeded();
  assert.equal(await page.isVisible('.booklet'), true);
  const lineHrefs = await page.$$eval('[data-line-link]:not([hidden])', (els) => els.map((a) => a.href));
  assert.ok(lineHrefs.length >= 4, 'FV・小冊子・予約欄・追従ボタン');
  lineHrefs.forEach((h) => assert.equal(h, 'https://s.lmes.jp/landing-qr/2009474189-L4Gp5PRA?uLand=dvdWFh'));
  assert.equal(await page.evaluate(() => !!document.querySelector('script[src*="googletagmanager"]')), false);
  await page.context().close();
});

test('追従ボタン：最初は非表示、スクロールで表示、フォーム付近で非表示', async () => {
  const page = await open();
  const visible = () => page.evaluate(() => document.querySelector('[data-sticky]').classList.contains('is-visible'));
  assert.equal(await visible(), false);
  await page.evaluate(() => window.scrollTo(0, document.querySelector('#videos').offsetTop));
  await page.waitForFunction(() => document.querySelector('[data-sticky]').classList.contains('is-visible'));
  await page.evaluate(() => document.querySelector('#reserve-form').scrollIntoView());
  await page.waitForFunction(() => !document.querySelector('[data-sticky]').classList.contains('is-visible'));
  assert.equal(await visible(), false);
  await page.context().close();
});

test('医師（院長・理事長・麻酔医）と院内の写真が表示される', async () => {
  const page = await open();
  for (const sel of ['#doctor .doctor', '#doctor .team', '.rooms']) {
    await page.locator(sel).scrollIntoViewIfNeeded();
    await page.waitForFunction((q) => [...document.querySelectorAll(`${q} img`)].every((i) => i.complete && i.naturalWidth > 0), sel);
  }
  assert.match(await page.textContent('#doctor .doctor'), /院長北村 隆典/);
  const team = await page.$$eval('#doctor .member', (els) => els.map((e) => `${e.querySelector('.member__role').textContent} ${e.querySelector('.member__name').textContent}`));
  assert.deepEqual(team, ['医療法人スマイル 理事長 尾崎 隆', '麻酔医（医療法人スマイル） 河合 温子']);
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
  const host = 'https://www.ultimate-dental.com/youtube/';
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await ctx.route(EXTERNAL, (r) => r.abort());
  // 公開サーバーへのアクセスを、ローカルの youtube-lp/ に振り向けて再現する（GTM は上で止めている）
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
  // 本番のドメインでは計測タグ（GTM）を読み込む
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
