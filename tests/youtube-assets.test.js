/*
 * YouTube 動画用の素材（youtube-assets/）の確認
 *   - QRコードが読み取れて、LINE の友だち追加URL（qr-target.txt）になっているか
 *   - 画像の大きさと、重ねる素材の背景が透明になっているか
 * 実行：npm run test:e2e（素材を作り直すときは npm run build:youtube-assets）
 */
const test = require('node:test');
const { before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const DIR = path.join(__dirname, '..', 'youtube-assets');
const JSQR = fs.readFileSync(require.resolve('jsqr/dist/jsQR.js'), 'utf8');
const TARGET = fs.readFileSync(path.join(DIR, 'qr-target.txt'), 'utf8').trim();
let browser;
let page;

before(async () => {
  browser = await chromium.launch();
  page = await browser.newPage();
  await page.setContent('<!doctype html><canvas></canvas>');
  await page.addScriptTag({ content: JSQR });
});
after(async () => { await browser?.close(); });

// 画像をブラウザで読み込み、大きさ・四隅の透明度・QRコードの中身を返す
const inspect = (file, scale = 1) => page.evaluate(async ({ src, scale: s }) => {
  const img = new Image();
  img.src = src;
  await img.decode();
  const c = document.querySelector('canvas');
  c.width = Math.round(img.width * s);
  c.height = Math.round(img.height * s);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const alpha = (x, y) => data.data[(y * c.width + x) * 4 + 3];
  const corners = [alpha(0, 0), alpha(c.width - 1, 0), alpha(0, c.height - 1), alpha(c.width - 1, c.height - 1)];
  // 透明部分は白として読み取る（動画に重ねたときと同じく、背景がある状態を想定）
  const rgba = new Uint8ClampedArray(data.data);
  for (let i = 0; i < rgba.length; i += 4) {
    const a = rgba[i + 3] / 255;
    rgba[i] = rgba[i] * a + 255 * (1 - a); rgba[i + 1] = rgba[i + 1] * a + 255 * (1 - a); rgba[i + 2] = rgba[i + 2] * a + 255 * (1 - a); rgba[i + 3] = 255;
  }
  const qr = window.jsQR(rgba, c.width, c.height);
  return { width: img.width, height: img.height, corners, qr: qr ? qr.data : null };
}, { src: `data:image/png;base64,${fs.readFileSync(path.join(DIR, file)).toString('base64')}`, scale });

test('QRコードの読み取り先は LINE の友だち追加URL', () => {
  assert.match(TARGET, /^https:\/\/s\.lmes\.jp\/landing-qr\/[\w-]+\?uLand=\w+$/);
});

test('終了画面（1920×1080）：QRコードが読み取れる', async () => {
  const r = await inspect('endscreen-1920x1080.png');
  assert.deepEqual([r.width, r.height], [1920, 1080]);
  assert.equal(r.qr, TARGET);
});

test('終了画面：テレビの画面を縮小して撮った状態（1/3）でも読み取れる', async () => {
  const r = await inspect('endscreen-1920x1080.png', 1 / 3);
  assert.equal(r.qr, TARGET);
});

test('重ねるQRコード（520×660）：背景が透明で、QRコードが読み取れる', async () => {
  const r = await inspect('qr-overlay-520x660.png');
  assert.deepEqual([r.width, r.height], [520, 660]);
  assert.deepEqual(r.corners, [0, 0, 0, 0], '四隅は透明');
  assert.equal(r.qr, TARGET);
});

test('電話番号の帯（1920×220）：背景が透明', async () => {
  const r = await inspect('lower-third-1920x220.png');
  assert.deepEqual([r.width, r.height], [1920, 220]);
  assert.deepEqual(r.corners, [0, 0, 0, 0]);
});
