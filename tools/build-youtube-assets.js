/*
 * YouTube 動画に入れる素材（QRコード入りの終了画面・重ねるQRコード・電話番号の帯）を作る
 *   npm run build:youtube-assets
 *   npm run build:youtube-assets -- --line=https://s.lmes.jp/landing-qr/...   ← LINE の経路を変えるとき
 * 出力：youtube-assets/*.png（使い方は youtube-assets/README.md）
 *
 * テレビで見ている人（このチャンネルの再生の23.5%）は説明欄のリンクを押せないため、
 * 動画の画面にQRコードと電話番号を出す。QRコードは tests/youtube-assets.test.js で読み取れるか確認する。
 */
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const QRCode = require('qrcode');
const { chromium } = require('playwright');

// 【要設定】L-Message で「栄院youtube動画内QR」の経路を作ったら、そのURLに変える（今は YouTube 説明欄と同じ経路）
const DEFAULT_LINE_URL = 'https://s.lmes.jp/landing-qr/2009474189-L4Gp5PRA?uLand=dvdWFh';
const arg = process.argv.find((a) => a.startsWith('--line='));
const LINE_URL = arg ? arg.slice('--line='.length) : DEFAULT_LINE_URL;
const TEL = '052-957-3357';
const OUT_DIR = path.join(__dirname, '..', 'youtube-assets');

// Google Fonts を curl 経由で取得してページに渡す（build-images.js と同じ理由）
const viaCurl = async (route) => {
  const req = route.request();
  try {
    const body = execFileSync('curl', ['-sSfL', '--max-time', '30', '-A', req.headers()['user-agent'] || 'Mozilla/5.0', req.url()], { maxBuffer: 64 * 1024 * 1024 });
    const type = /googleapis/.test(req.url()) ? 'text/css; charset=utf-8' : 'font/woff2';
    await route.fulfill({ status: 200, body, contentType: type, headers: { 'access-control-allow-origin': '*' } });
  } catch (e) {
    await route.continue();
  }
};

const FONT = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@500;700;900&display=block">';
const BASE_CSS = `*{box-sizing:border-box;margin:0;padding:0}
  body{font-family:"Noto Sans JP",sans-serif;letter-spacing:.02em;-webkit-font-smoothing:antialiased}
  .qr{background:#fff;border-radius:24px;display:grid;place-items:center}
  .qr svg{display:block;width:100%;height:auto}`;

const endscreenHtml = (qr) => `<!doctype html><html lang="ja"><head><meta charset="utf-8">${FONT}<style>${BASE_CSS}
  body{width:1920px;height:1080px;overflow:hidden;color:#fff;
    background:radial-gradient(900px 600px at 0% 100%,rgba(234,115,49,.20),transparent 60%),linear-gradient(135deg,#072f4a 0%,#0b5584 55%,#126da6 100%);
    display:grid;grid-template-columns:1080px 1fr;padding:84px 0 0 96px}
  .pre{display:inline-block;background:#fff;color:#0b5584;font-weight:900;font-size:40px;padding:10px 32px;border-radius:999px}
  h1{font-size:76px;line-height:1.3;font-weight:900;margin:24px 0 12px}
  .sub{font-size:34px;font-weight:700;line-height:1.55;opacity:.96}
  .row{display:flex;gap:44px;align-items:center;margin-top:36px}
  .qr{width:340px;height:340px;padding:24px;flex:none}
  .how{font-size:36px;font-weight:900;line-height:1.45}
  .how small{display:block;font-size:28px;font-weight:700;opacity:.9;margin-top:6px}
  .how .line{display:inline-block;background:#06833a;border-radius:12px;padding:0 18px;margin-bottom:8px}
  .tel{margin-top:26px;padding-top:22px;border-top:2px solid rgba(255,255,255,.35);font-size:30px;font-weight:700;line-height:1.3}
  .tel b{display:block;font-size:62px;font-weight:900;letter-spacing:.04em}
  .side{display:grid;align-content:start;gap:30px;padding:120px 96px 0 40px}
  .slot{border:4px dashed rgba(255,255,255,.45);border-radius:20px;height:300px;display:flex;align-items:flex-start;padding:14px 22px;font-size:28px;font-weight:700;opacity:.9}
  .foot{position:absolute;left:0;right:0;bottom:0;height:92px;background:#fff;color:#072f4a;display:flex;align-items:center;justify-content:space-between;padding:0 96px;font-weight:900;font-size:36px}
  .foot span{color:#cf5317}
</style></head><body>
  <div>
    <span class="pre">名古屋近郊の方へ</span>
    <h1>CT撮影込みの<br>無料相談をご利用ください</h1>
    <p class="sub">その日に契約をお願いすることはありません。<br>ご家族と一緒でも大丈夫です。</p>
    <div class="row">
      <div class="qr">${qr}</div>
      <div>
        <p class="how"><span class="line">LINE</span><br>スマホのカメラで読み取ってください<small>質問・ご予約を24時間受け付けています</small></p>
        <p class="tel">お電話でも（平日9:00〜19:00）<b>${TEL}</b></p>
      </div>
    </div>
  </div>
  <div class="side">
    <div class="slot">次の動画</div>
    <div class="slot">再生リスト</div>
  </div>
  <div class="foot"><div>「アルティメイト栄歯科」で検索</div><div><span>地下鉄「栄駅」徒歩3分</span>　アルティメイト栄歯科・矯正歯科</div></div>
</body></html>`;

const overlayHtml = (qr) => `<!doctype html><html lang="ja"><head><meta charset="utf-8">${FONT}<style>${BASE_CSS}
  html,body{background:transparent}
  body{width:520px;height:660px;display:grid;place-items:center}
  .card{width:480px;background:#fff;border-radius:32px;padding:26px 26px 22px;box-shadow:0 6px 16px rgba(0,0,0,.35);text-align:center;color:#072f4a;border:6px solid #06833a}
  .head{display:inline-block;background:#06833a;color:#fff;font-weight:900;font-size:34px;border-radius:999px;padding:4px 28px;margin-bottom:14px}
  .qr{width:100%;padding:10px}
  .cap{font-size:28px;font-weight:900;line-height:1.45;margin-top:10px}
  .cap small{display:block;font-size:22px;font-weight:700;color:#45545e}
</style></head><body>
  <div class="card">
    <span class="head">LINEで質問・予約</span>
    <div class="qr">${qr}</div>
    <p class="cap">スマホのカメラで読み取り<small>アルティメイト栄歯科（名古屋・栄）</small></p>
  </div>
</body></html>`;

const lowerThirdHtml = () => `<!doctype html><html lang="ja"><head><meta charset="utf-8">${FONT}<style>${BASE_CSS}
  html,body{background:transparent}
  body{width:1920px;height:220px;display:flex;align-items:flex-end;padding:0 0 36px 72px}
  .bar{display:flex;align-items:stretch;border-radius:20px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.35)}
  .name{background:#0b5584;color:#fff;font-weight:900;font-size:40px;padding:22px 34px;display:flex;align-items:center}
  .name small{font-size:28px;font-weight:700;margin-right:16px;opacity:.9}
  .tel{background:#fff;color:#072f4a;font-weight:900;font-size:40px;padding:22px 34px;display:flex;align-items:center;gap:16px}
  .tel small{font-size:26px;font-weight:700;color:#45545e}
  .tel em{font-style:normal;background:#cf5317;color:#fff;font-size:26px;border-radius:10px;padding:4px 14px}
</style></head><body>
  <div class="bar">
    <div class="name"><small>名古屋・栄</small>アルティメイト栄歯科</div>
    <div class="tel"><em>無料相談</em>${TEL}<small>平日9:00〜19:00</small></div>
  </div>
</body></html>`;

(async () => {
  const qr = await QRCode.toString(LINE_URL, { type: 'svg', errorCorrectionLevel: 'Q', margin: 2, color: { dark: '#000000', light: '#ffffff' } });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const render = async (html, w, h, file, transparent = false) => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await page.route(/fonts\.(googleapis|gstatic)\.com/, viaCurl);
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.evaluate(async () => { await document.fonts.ready; });
    const ok = await page.evaluate(() => [...document.fonts].some((f) => f.family.includes('Noto Sans JP') && f.status === 'loaded'));
    if (!ok) console.warn('warning: Noto Sans JP が読み込めませんでした（代替フォントで出力）');
    await page.screenshot({ path: path.join(OUT_DIR, file), omitBackground: transparent });
    await page.close();
    console.log('wrote', path.join('youtube-assets', file));
  };
  await render(endscreenHtml(qr), 1920, 1080, 'endscreen-1920x1080.png');
  await render(overlayHtml(qr), 520, 660, 'qr-overlay-520x660.png', true);
  await render(lowerThirdHtml(), 1920, 220, 'lower-third-1920x220.png', true);
  fs.writeFileSync(path.join(OUT_DIR, 'qr-target.txt'), `${LINE_URL}\n`);
  await browser.close();
})();
