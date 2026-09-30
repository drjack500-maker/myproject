/*
 * OGP画像（SNS共有用）とホーム画面アイコンを生成する
 *   npm run build:images
 * 出力：lp/assets/img/ogp.png（1200×630）, lp/assets/img/apple-touch-icon.png（180×180）
 * 文言を変えたい場合は下の OGP_HTML を編集して再実行してください。
 */
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');

// Google Fonts を curl 経由で取得してページに渡す
// （ブラウザがプロキシ等の証明書を信頼しない環境でも、正しいフォントで描画するため）
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

const IMG_DIR = path.join(__dirname, '..', 'lp', 'assets', 'img');
const FONT = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@500;700;900&display=block">';

const DIAGRAM = `
<svg viewBox="0 0 520 300" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="ti" x1="0" x2="1"><stop offset="0" stop-color="#8b97a2"/><stop offset=".45" stop-color="#eef1f4"/><stop offset="1" stop-color="#7b8793"/></linearGradient>
    <g id="imp"><rect x="-8" y="-12" width="16" height="17" rx="3" fill="#aeb8c1" stroke="#76828d"/><path d="M-9 6H9L7 100Q0 112-7 100Z" fill="url(#ti)" stroke="#6f7b86"/><path d="M-9 18L9 23M-8.8 30L8.8 35M-8.5 42L8.5 47M-8.2 54L8.2 59M-8 66L8 71M-7.7 78L7.7 83M-7.4 90L7.4 95" stroke="#6f7b86" stroke-width="1.4" fill="none"/></g>
  </defs>
  <path d="M24 150C24 141 32 136 44 136H476C488 136 496 141 496 150V224C496 262 440 288 260 288C80 288 24 262 24 224Z" fill="#f5ebda" stroke="#dcc6a2" stroke-width="2"/>
  <g fill="#fff" stroke="#cdd5db" stroke-width="1.6">
    <rect x="44" y="68" width="32" height="60" rx="10"/><rect x="80" y="64" width="32" height="64" rx="10"/><rect x="116" y="60" width="32" height="68" rx="10"/><rect x="152" y="54" width="32" height="74" rx="10"/><rect x="188" y="48" width="32" height="80" rx="10"/><rect x="224" y="42" width="32" height="86" rx="10"/><rect x="260" y="42" width="32" height="86" rx="10"/><rect x="296" y="48" width="32" height="80" rx="10"/><rect x="332" y="54" width="32" height="74" rx="10"/><rect x="368" y="60" width="32" height="68" rx="10"/><rect x="404" y="64" width="32" height="64" rx="10"/><rect x="440" y="68" width="32" height="60" rx="10"/>
  </g>
  <path d="M36 110H484Q494 110 494 120V138Q494 146 486 146H34Q26 146 26 138V120Q26 110 36 110Z" fill="#f5b5c0" stroke="#e999a7" stroke-width="1.6"/>
  <use href="#imp" transform="translate(112 152) rotate(-32)"/><use href="#imp" transform="translate(208 152)"/><use href="#imp" transform="translate(312 152)"/><use href="#imp" transform="translate(408 152) rotate(32)"/>
</svg>`;

const OGP_HTML = `<!doctype html><html lang="ja"><head><meta charset="utf-8">${FONT}<style>
  *{box-sizing:border-box;margin:0}
  body{width:1200px;height:630px;font-family:"Noto Sans JP",sans-serif;color:#fff;letter-spacing:.02em;
    background:radial-gradient(700px 420px at 100% 0%,rgba(234,115,49,.28),transparent 60%),linear-gradient(135deg,#0a3c42 0%,#0e5a63 55%,#137682 100%);
    display:grid;grid-template-columns:640px 1fr;align-items:center;padding:0 56px 0 64px;overflow:hidden}
  .pre{display:inline-block;background:#fff;color:#0e5a63;font-weight:700;font-size:26px;padding:8px 22px;border-radius:999px}
  h1{font-size:62px;line-height:1.32;font-weight:900;margin:22px 0 18px}
  h1 em{font-style:normal;color:#ffc58f}
  .product{font-size:34px;font-weight:900;display:flex;align-items:center;gap:14px}
  .product::before{content:"";width:8px;height:40px;border-radius:4px;background:#ea7331}
  .product small{font-size:22px;opacity:.8;font-weight:700}
  .foot{position:absolute;left:0;right:0;bottom:0;height:76px;background:#fff;color:#0a3c42;display:flex;align-items:center;justify-content:space-between;padding:0 64px;font-weight:900;font-size:28px;white-space:nowrap}
  .foot span{color:#cf5317}
  .card{background:#fff;border-radius:28px;padding:28px 22px 18px;box-shadow:0 20px 50px rgba(0,0,0,.25);margin-bottom:60px}
  .card svg{display:block;width:100%}
  .card p{color:#0a3c42;font-weight:900;font-size:24px;text-align:center;margin-top:6px;white-space:nowrap}
  .card p b{color:#cf5317}
</style></head><body>
  <div style="margin-bottom:60px">
    <span class="pre">入れ歯・グラグラの歯でお悩みの方へ</span>
    <h1>手術したその日に、<br><em>固定式の歯</em>で<br>食事ができる。</h1>
    <p class="product">オールオン4<small>（All-on-4）</small></p>
  </div>
  <div class="card">${DIAGRAM}<p><b>4本</b>のインプラントで全体を支える</p></div>
  <div class="foot"><div><span>JR名古屋駅 徒歩2分</span></div><div>名駅歯科クリニック・矯正歯科</div></div>
</body></html>`;

const ICON_HTML = `<!doctype html><html><head><meta charset="utf-8"><style>*{margin:0}body{width:180px;height:180px;background:#0e5a63}img{width:180px;height:180px;display:block}</style></head>
<body><img src="data:image/svg+xml;base64,${Buffer.from(fs.readFileSync(path.join(IMG_DIR, 'favicon.svg'))).toString('base64')}"></body></html>`;

(async () => {
  const browser = await chromium.launch();
  const render = async (html, w, h, file) => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await page.route(/fonts\.(googleapis|gstatic)\.com/, viaCurl);
    await page.setContent(html, { waitUntil: 'networkidle' });
    // 使用している太さのフォントを明示的に読み込んでから撮影
    await page.evaluate(async () => {
      await Promise.all(['500', '700', '900'].map((w) => document.fonts.load(`${w} 32px "Noto Sans JP"`, '手術固定式の歯オールオン4名駅')));
      await document.fonts.ready;
    });
    const ok = await page.evaluate(() => [...document.fonts].some((f) => f.family.includes('Noto Sans JP') && f.status === 'loaded'));
    if (!ok && html.includes('Noto+Sans+JP')) console.warn('warning: Noto Sans JP が読み込めませんでした（代替フォントで出力）');
    await page.screenshot({ path: path.join(IMG_DIR, file) });
    await page.close();
    console.log('wrote', path.join('lp/assets/img', file));
  };
  await render(OGP_HTML, 1200, 630, 'ogp.png');
  await render(ICON_HTML, 180, 180, 'apple-touch-icon.png');
  await browser.close();
})();
