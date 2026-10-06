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
// 外部（フォント・地図・計測タグ・LINE・YouTube）は読み込まない
const EXTERNAL = /fonts\.(googleapis|gstatic)\.com|google\.com\/maps|maps\.google\.com|googletagmanager|lmes\.jp|stransa\.co\.jp|youtube|ytimg/;
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
  await ctx.route(EXTERNAL, (r) => r.abort());
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
  assert.equal(p.get('hp_extra'), '');
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

test('スパム対策：見えない項目に入力があっても予約は送り、受信側がスパム疑いと判定したら成約として数えない', async () => {
  let posted = null;
  const page = await open('index.html', {
    config: { formEndpoint: ENDPOINT },
    init: (ctx) => ctx.route(ENDPOINT, async (route) => {
      posted = new URLSearchParams(route.request().postData());
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"flagged":true}', headers: { 'access-control-allow-origin': '*' } });
    }),
  });
  await fillForm(page);
  await page.evaluate(() => { document.querySelector('input[name="hp_extra"]').value = 'http://spam.example'; });
  await Promise.all([page.waitForURL(/thanks\.html\?nc=1$/), page.click('[data-submit]')]);
  assert.equal(posted.get('hp_extra'), 'http://spam.example', '予約データは送られる（受信側で「スパム疑い」として保存）');
  const events = await page.evaluate(() => window.dataLayer.map((d) => d.event));
  assert.ok(!events.includes('reservation_complete'), '成約（予約完了）として数えない');
  await page.context().close();
});

test('送信の時間切れ：届いている可能性があるので、再送信より電話での確認を案内する', async () => {
  const page = await open('index.html', {
    config: { formEndpoint: ENDPOINT, submitTimeoutMs: 500 },
    init: (ctx) => ctx.route(ENDPOINT, () => { /* 応答しない */ }),
  });
  await fillForm(page);
  await page.click('[data-submit]');
  await page.waitForSelector('[data-error="timeout"]:not([hidden])');
  assert.equal(await page.isVisible('[data-error="submit"]'), false);
  await page.context().close();
});

test('第2希望は日付と時間帯の両方が必要。解除すれば進める', async () => {
  const page = await open();
  await page.locator('#reserve-form').scrollIntoViewIfNeeded();
  await page.click('[data-step="1"] [data-next]');
  await page.locator('[data-picker="1"] [data-dates] .chip').nth(1).click();
  await page.locator('[data-picker="1"] [data-times] .chip').nth(0).click();
  await page.click('[data-picker="2"] summary');
  await page.locator('[data-picker="2"] [data-dates] .chip').nth(3).click();
  await page.click('[data-step="2"] [data-next]');
  assert.ok(await page.isVisible('[data-error="date2"]'), '日付だけではエラー');
  await page.click('[data-clear-picker="2"]');
  await page.click('[data-step="2"] [data-next]');
  assert.ok(await page.isVisible('[data-step="3"]'), '解除すれば次へ進める');
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

test('医師・院内の写真が表示される／文字拡大が保存される', async () => {
  const page = await open();
  for (const sel of ['.rooms', '#doctor .doctor', '#doctor .team']) {
    await page.locator(sel).scrollIntoViewIfNeeded();
    await page.waitForFunction((q) => [...document.querySelectorAll(`${q} img`)].every((i) => i.complete && i.naturalWidth > 0), sel);
  }
  await page.click('[data-fs-toggle]');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.fs), 'lg');
  await page.reload();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.fs), 'lg');
  await page.context().close();
});

for (const [host, local] of [['https://www.meieki-dental.net/all_on_4_004/', ''], ['https://www.meieki-dental.net/all_on_4_006/', '006/'], ['https://staging.example.test/', '']]) {
  test(`送信先が未設定のサーバーでは、最初からフォームを止めて電話を案内する（${host}）`, async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    await ctx.route(EXTERNAL, (r) => r.abort());
    // 公開サーバーへのアクセスを、ローカルの lp/・lp-006/ に振り向けて再現する
    await ctx.route((url) => url.href.startsWith(host), async (route) => {
      const rel = route.request().url().slice(host.length);
      const res = await fetch(base + local + rel);
      await route.fulfill({ status: res.status, body: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get('content-type') || undefined });
    });
    const p = await ctx.newPage();
    await p.goto(`${host}index.html`);
    await p.locator('#reserve').scrollIntoViewIfNeeded();
    assert.equal(await p.isVisible('#reserve-form'), false, 'フォームは表示しない');
    assert.equal(await p.isVisible('[data-form-unavailable]'), true, '電話の案内を表示');
    assert.equal(await p.getAttribute('[data-form-unavailable] a', 'href'), 'tel:0525713345');
    await ctx.close();
  });
}

test('電話の希望時間帯（任意）が送信される', async () => {
  let posted = null;
  const page = await open('index.html', {
    config: { formEndpoint: ENDPOINT },
    init: (ctx) => ctx.route(ENDPOINT, async (route) => {
      posted = route.request().postData();
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}', headers: { 'access-control-allow-origin': '*' } });
    }),
  });
  await fillForm(page);
  await page.locator('label.chip:has(input[name="contact_time"][value^="夕方"])').click();
  await Promise.all([page.waitForURL(/thanks\.html$/), page.click('[data-submit]')]);
  assert.match(new URLSearchParams(posted).get('contact_time'), /^夕方/);
  await page.context().close();
});

test('LINE小冊子ブロックと追従LINEボタンが表示され、計測タグは本番以外で読み込まない', async () => {
  const page = await open();
  await page.locator('.booklet').scrollIntoViewIfNeeded();
  assert.equal(await page.isVisible('.booklet'), true);
  const lineHrefs = await page.$$eval('[data-line-link]:not([hidden])', (els) => els.map((a) => a.href));
  assert.ok(lineHrefs.length >= 3);
  lineHrefs.forEach((h) => assert.match(h, /^https:\/\/s\.lmes\.jp\//));
  assert.equal(await page.evaluate(() => !!document.querySelector('script[src*="googletagmanager"]')), false);
  await page.context().close();
});

for (const path of ['index.html', 'thanks.html', 'privacy.html', '006/index.html']) {
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

/* =========================================================
   SNS広告用LP（lp-006 → all_on_4_006）
   ========================================================= */
const { diff: diff006 } = require('../tools/sync-006');

test('006：共通ファイル（CSS・JS・画像・完了ページ）が lp/ と同じ（npm run sync:006 の実行漏れ検出）', () => {
  const { changed, stale } = diff006();
  assert.deepEqual({ changed, stale }, { changed: [], stale: [] }, 'npm run sync:006 を実行してください');
});

test('006：スマホ（375×667）の最初の画面に、医師の写真・実績・予約ボタンが入る', async () => {
  const page = await open('006/index.html?utm_source=meta&utm_content=implant', { width: 375, height: 667 });
  assert.match(await page.textContent('#fv-title'), /噛める喜び/);
  assert.equal(await page.evaluate(() => document.documentElement.dataset.variant), 'default', 'utm_content=implant は標準の見出し');
  const cta = await page.locator('.fvp__cta .btn--primary').boundingBox();
  assert.ok(cta.y + cta.height <= 667, `CTA bottom ${cta.y + cta.height}px`);
  await page.waitForFunction(() => { const i = document.querySelector('.fvp__photo img'); return i.complete && i.naturalWidth > 0; });
  const stats = await page.locator('.fvp__stats').boundingBox();
  assert.ok(stats.y + stats.height <= 667, '実績も最初の画面に入る');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('006：幅360pxで、適応チェック・フォームを含めて横スクロールが発生しない', async () => {
  const page = await open('006/index.html', { width: 360, height: 740 });
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.equal(await overflow(), 0);
  for (let i = 0; i < 4; i++) {
    await page.locator('[data-quiz-q].is-current .quiz__opt').first().click();
    await page.waitForTimeout(350);
    assert.equal(await overflow(), 0, `quiz ${i + 1}`);
  }
  await page.locator('#reserve-form').scrollIntoViewIfNeeded();
  await page.click('[data-step="1"] [data-next]');
  assert.equal(await overflow(), 0, 'form step 2');
  await page.context().close();
});

test('006：適応チェックの回答に合わせて結果を表示し、予約フォームに引き継ぐ', async () => {
  const page = await open('006/index.html');
  const pick = async (text) => {
    await page.locator('[data-quiz-q].is-current .quiz__opt', { hasText: text }).click();
    await page.waitForTimeout(350);
  };
  assert.equal(await page.isDisabled('[data-quiz-back]'), true);
  await pick('他院でインプラントを断られた');
  await pick('入れ歯がずれる・外れる');
  await pick('費用・支払い方法');
  await pick('家族');
  await page.waitForSelector('[data-quiz-result]:not([hidden])');
  const tips = await page.$$eval('[data-tip-for]:not([hidden]) b', (els) => els.map((e) => e.textContent));
  assert.deepEqual(tips, ['治療できるかは、CTで確かめられます', '他院で断られた方へ', '費用が心配な方へ', 'ご家族のご相談も歓迎です']);
  assert.equal(await page.$$eval('[data-quiz-answers] li', (els) => els.length), 4);
  const concerns = await page.$$eval('input[name="concerns"]:checked', (els) => els.map((e) => e.dataset.concern).sort());
  assert.deepEqual(concerns, ['bone', 'denture', 'price']);
  assert.equal(await page.$eval('input[name="who"]:checked', (e) => e.value), '家族');
  const events = await page.evaluate(() => window.dataLayer.map((d) => d.event));
  assert.ok(events.includes('quiz_start') && events.includes('quiz_complete'));
  // やり直し
  await page.click('[data-quiz-restart]');
  assert.equal(await page.isVisible('[data-quiz-q].is-current legend'), true);
  assert.equal(await page.textContent('[data-quiz-now]'), '1');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('006：適応チェックはキーボードでも操作できる（矢印キーでは進まず「次へ」で進む）', async () => {
  const page = await open('006/index.html', { width: 1280, height: 900 });
  await page.focus('[data-quiz-q].is-current input');
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(400);
  assert.equal(await page.textContent('[data-quiz-now]'), '1', '矢印キーでは進まない');
  assert.equal(await page.isDisabled('[data-quiz-next]'), false);
  await page.click('[data-quiz-next]');
  assert.equal(await page.textContent('[data-quiz-now]'), '2');
  assert.equal(await page.evaluate(() => document.activeElement.tagName), 'LEGEND', '次の質問へフォーカス移動');
  await page.click('[data-quiz-back]');
  assert.equal(await page.textContent('[data-quiz-now]'), '1');
  assert.equal(await page.isDisabled('[data-quiz-next]'), false, '回答済みの質問は「次へ」で進める');
  await page.context().close();
});

test('006：動画はタップするまで YouTube を読み込まない', async () => {
  const requests = [];
  const page = await open('006/index.html', { init: (ctx) => ctx.on('request', (r) => { if (/youtube/.test(r.url())) requests.push(r.url()); }) });
  await page.locator('#movie').scrollIntoViewIfNeeded();
  assert.equal(await page.$('#movie iframe'), null);
  assert.deepEqual(requests, []);
  await page.click('.video__play');
  const src = await page.getAttribute('#movie iframe', 'src');
  assert.match(src, /^https:\/\/www\.youtube-nocookie\.com\/embed\/G_TMBFT2qCQ\?autoplay=1/);
  assert.ok(await page.evaluate(() => window.dataLayer.some((d) => d.event === 'video_play')));
  await page.context().close();
});

test('006：Meta 広告のクリックID（fbclid）・event_id を送信し、完了ページで同じ event_id を1回だけ計上', async () => {
  let posted = null;
  const page = await open('006/index.html?utm_source=meta&utm_medium=display&utm_content=implant&utm_term=F03177&fbclid=IwAR_TEST', {
    config: { formEndpoint: ENDPOINT },
    init: (ctx) => ctx.route(ENDPOINT, async (route) => {
      posted = new URLSearchParams(route.request().postData());
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}', headers: { 'access-control-allow-origin': '*' } });
    }),
  });
  await page.context().addCookies([{ name: '_fbp', value: 'fb.1.1759999999999.42', url: base }]);
  await fillForm(page);
  await Promise.all([page.waitForURL(/thanks\.html$/), page.click('[data-submit]')]);
  assert.equal(posted.get('fbclid'), 'IwAR_TEST');
  assert.match(posted.get('fbc'), /^fb\.1\.\d{13}\.IwAR_TEST$/);
  assert.equal(posted.get('fbp'), 'fb.1.1759999999999.42');
  assert.match(posted.get('event_id'), /^[\w-]{10,}$/);
  assert.match(posted.get('client_ua'), /Mozilla/);
  assert.equal(posted.get('utm_content'), 'implant');
  assert.match(posted.get('landing_url'), /\/006\/index\.html\?utm_source=meta/);
  const cv = await page.evaluate(() => window.dataLayer.filter((d) => d.event === 'reservation_complete'));
  assert.deepEqual(cv.map((d) => d.event_id), [posted.get('event_id')]);
  await page.reload();
  const again = await page.evaluate(() => window.dataLayer.filter((d) => d.event === 'reservation_complete'));
  assert.equal(again.length, 0, '再読み込みでは計上しない');
  await page.context().close();
});

test('006：見出しの出し分け（?v=fear）と、症例は【要記入】が残る間は表示しない', async () => {
  const page = await open('006/index.html?v=fear');
  assert.match(await page.textContent('#fv-title'), /うとうとした状態で/);
  const cases = await page.evaluate(() => {
    const sec = document.querySelector('#cases');
    return { hidden: sec.hidden, placeholder: sec.textContent.includes('【要記入】') };
  });
  assert.ok(cases.hidden || !cases.placeholder, '術前・術後写真は治療内容・費用・期間・リスクを記入してから表示する');
  await page.context().close();
});

test('ご家族向けの見出し（?v=family）：フォームの「どなたのご相談か」もご家族に。「親知らず」では切り替えない', async () => {
  let page = await open('006/index.html?v=family');
  assert.match(await page.textContent('#fv-title'), /親の「噛める喜び」を/);
  assert.equal(await page.$eval('input[name="who"]:checked', (e) => e.value), '家族');
  await page.context().close();
  page = await open(`006/index.html?utm_source=meta&utm_content=${encodeURIComponent('家族向け_動画A')}`);
  assert.equal(await page.evaluate(() => document.documentElement.dataset.variant), 'family', '広告名（utm_content）から判定');
  await page.context().close();
  page = await open(`index.html?utm_term=${encodeURIComponent('親知らず 抜歯')}`);
  assert.equal(await page.evaluate(() => document.documentElement.dataset.variant), 'default');
  assert.equal(await page.$eval('input[name="who"]:checked', (e) => e.value), '本人');
  await page.context().close();
});
