/*
 * いびき改善LP（ibiki-lp/）のブラウザテスト（Playwright + axe-core）
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

async function open(file = 'index.html', { width = 390, height = 844, config, colorScheme = 'light', reducedMotion = 'reduce' } = {}) {
  const mobile = width < 600;
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, locale: 'ja-JP', reducedMotion, colorScheme });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort()); // 外部フォントは読み込まない
  if (config) await ctx.addInitScript((c) => { window.LP_CONFIG = c; }, config);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + file);
  page.errors = errors;
  return page;
}

test('スマホ（375×667）の最初の画面に申し込みボタンが入る', async () => {
  const page = await open('index.html', { width: 375, height: 667, config: { preview: false } }); // 公開時と同じ（確認用の表示なし）
  assert.equal(await page.locator('.variant-bar').count(), 0);
  const box = await page.locator('#hero-cta').boundingBox();
  assert.ok(box.y + box.height <= 667, `CTA bottom ${box.y + box.height}px`);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

for (const width of [320, 360, 768, 1280]) {
  test(`横スクロールが発生しない（幅${width}px・全見出しパターン）`, async () => {
    for (const v of ['room', 'partner', 'goods', 'week', 'long', 'deep', 'clinic', 'habit', 'age', 'health']) {
      const page = await open(`index.html?v=${v}`, { width, height: 800 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.equal(overflow, 0, `v=${v}`);
      assert.deepEqual(page.errors, []);
      await page.context().close();
    }
  });
}

test('見出しの出し分け（?v= と utm_term）', async () => {
  let page = await open('index.html');
  assert.match(await page.textContent('#hero-title'), /もう別の部屋で寝て/);
  await page.context().close();

  page = await open('index.html?v=goods');
  assert.match(await page.textContent('#hero-title'), /グッズもサプリも/);
  await page.context().close();

  page = await open(`index.html?utm_term=${encodeURIComponent('夫 いびき うるさい')}`);
  assert.match(await page.textContent('#hero-title'), /静かになったね/);
  assert.doesNotMatch(await page.textContent('#dawn-title'), /静かになったね/, '締めの見出しがファーストビューと重ならない');
  await page.context().close();

  page = await open(`index.html?utm_term=${encodeURIComponent('いびき 70代 治らない')}`);
  assert.match(await page.textContent('#hero-title'), /20代でも70代でも/);
  await page.context().close();

  // 表現に注意が必要なパターンは、検索語句からは自動で選ばない
  page = await open(`index.html?utm_term=${encodeURIComponent('いびき 1週間 病院')}`);
  assert.match(await page.textContent('#hero-title'), /もう別の部屋で寝て/);
  await page.context().close();

  // 未知の v は標準の見出し
  page = await open('index.html?v=__proto__');
  assert.match(await page.textContent('#hero-title'), /もう別の部屋で寝て/);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('確認用の見出し切り替え：手元では表示され、選ぶと見出しと決済URLの lp_variant が変わる', async () => {
  const page = await open('index.html', { config: { checkoutUrl: 'https://pay.example.test/checkout' } });
  assert.equal(await page.locator('#variant-select option').count(), 10);
  assert.equal(await page.inputValue('#variant-select'), 'room');
  await page.selectOption('#variant-select', 'partner');
  assert.match(await page.textContent('#hero-title'), /静かになったね/);
  assert.doesNotMatch(await page.textContent('#dawn-title'), /静かになったね/);
  assert.equal(new URL(await page.getAttribute('[data-checkout]', 'href')).searchParams.get('lp_variant'), 'partner');
  await page.selectOption('#variant-select', 'room');
  assert.match(await page.textContent('#dawn-title'), /静かになったね/);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('一晩の記録：切り替えでボタンの状態と数値が変わる', async () => {
  const page = await open('index.html');
  assert.equal(await page.getAttribute('[data-night="snore"]', 'aria-pressed'), 'true');
  assert.match(await page.textContent('#night-snore'), /時間/);
  const peakSnore = Number((await page.textContent('#night-peak')).match(/\d+/)[0]);
  assert.ok(peakSnore >= 70, `snore peak ${peakSnore}`);
  await page.click('[data-night="quiet"]');
  assert.equal(await page.getAttribute('[data-night="quiet"]', 'aria-pressed'), 'true');
  assert.equal(await page.getAttribute('[data-night="snore"]', 'aria-pressed'), 'false');
  assert.equal(await page.textContent('#night-snore'), 'ほぼなし');
  const peakQuiet = Number((await page.textContent('#night-peak')).match(/\d+/)[0]);
  assert.ok(peakQuiet < 50, `quiet peak ${peakQuiet}`);
  assert.match(await page.getAttribute('#night-canvas', 'aria-label'), /静かな夜/);
  // 棒グラフが実際に描かれている（透明でないピクセルがある）
  const painted = await page.evaluate(() => {
    const c = document.getElementById('night-canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
    return n;
  });
  assert.ok(painted > 1000, `painted ${painted}`);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('セルフチェック：数と結果が変わり、受診の目安に当てはまると医療機関を案内する', async () => {
  const page = await open('index.html');
  await page.locator('#check').scrollIntoViewIfNeeded();
  for (const v of ['told', 'room', 'wake']) await page.check(`input[value="${v}"]`);
  assert.equal(await page.textContent('#check-count'), '3');
  assert.match(await page.textContent('#check-message'), /3項目/);
  assert.equal(await page.evaluate(() => document.getElementById('check-result').classList.contains('is-med')), false);
  await page.check('input[value="apnea"]');
  assert.match(await page.textContent('#check-message'), /医療機関/);
  assert.equal(await page.evaluate(() => document.getElementById('check-result').classList.contains('is-med')), true);
  await page.uncheck('input[value="apnea"]');
  assert.doesNotMatch(await page.textContent('#check-message'), /医療機関/);
  await page.context().close();
});

test('決済ページのURL：設定すると流入元と見出しパターンを引き継ぐ。未設定なら料金欄のまま', async () => {
  let page = await open('index.html?v=goods&utm_source=google&utm_term=%E3%81%84%E3%81%B3%E3%81%8D&gclid=abc', { config: { checkoutUrl: 'https://pay.example.test/checkout?item=1' } });
  const href = new URL(await page.getAttribute('[data-checkout]', 'href'));
  assert.equal(href.origin + href.pathname, 'https://pay.example.test/checkout');
  assert.equal(href.searchParams.get('item'), '1');
  assert.equal(href.searchParams.get('utm_source'), 'google');
  assert.equal(href.searchParams.get('utm_term'), 'いびき');
  assert.equal(href.searchParams.get('gclid'), 'abc');
  assert.equal(href.searchParams.get('lp_variant'), 'goods');
  await page.context().close();

  page = await open('index.html');
  assert.equal(await page.getAttribute('[data-checkout]', 'href'), '#offer');
  assert.equal(await page.locator('#offer .todo-note', { hasText: 'CONFIG.checkoutUrl' }).count(), 1, '手元の確認では未設定を表示');
  await page.context().close();
});

test('追従ボタン：最初は非表示、スクロールで表示、料金欄で非表示', async () => {
  const page = await open('index.html', { width: 375, height: 667 });
  const visible = () => page.evaluate(() => document.getElementById('sticky-cta').classList.contains('is-visible'));
  assert.equal(await visible(), false);
  await page.locator('#cause').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.getElementById('sticky-cta').classList.contains('is-visible'));
  assert.equal(await page.getAttribute('#sticky-cta', 'aria-hidden'), 'false');
  await page.locator('#offer .price').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => !document.getElementById('sticky-cta').classList.contains('is-visible'));
  assert.equal(await page.getAttribute('#sticky-cta', 'aria-hidden'), 'true');
  await page.context().close();
});

test('文字を大きくする設定が保存される', async () => {
  const page = await open('index.html');
  const size = () => page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
  const before = await size();
  await page.click('#fs-toggle');
  assert.equal(await page.getAttribute('#fs-toggle', 'aria-pressed'), 'true');
  assert.ok((await size()) > before);
  await page.reload();
  assert.equal(await page.getAttribute('#fs-toggle', 'aria-pressed'), 'true');
  assert.ok((await size()) > before);
  await page.context().close();
});

for (const [file, colorScheme] of [['index.html', 'light'], ['index.html', 'dark'], ['tokushoho.html', 'light']]) {
  test(`アクセシビリティ（axe）：重大な問題がない - ${file}（${colorScheme}）`, async () => {
    const page = await open(file, { colorScheme });
    await page.addScriptTag({ content: AXE });
    const result = await page.evaluate(() => window.axe.run(document, { resultTypes: ['violations'] }));
    const serious = result.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
    assert.deepEqual(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`), []);
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });
}
