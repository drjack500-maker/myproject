/*
 * いびきLPのOGP画像（SNS共有用）とホーム画面アイコンを生成する
 *   npm run build:ibiki-images
 * 出力：ibiki/lp/assets/img/ogp.png（1200×630）, ibiki/lp/assets/img/apple-touch-icon.png（180×180）
 * イラストは ibiki/lp/index.html のファーストビューの SVG をそのまま使う。
 */
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');

// Google Fonts を curl 経由で取得してページに渡す（ブラウザがプロキシの証明書を信頼しない環境でも正しく描画するため）
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

const LP_DIR = path.join(__dirname, '..', 'ibiki', 'lp');
const IMG_DIR = path.join(LP_DIR, 'assets', 'img');
const indexHtml = fs.readFileSync(path.join(LP_DIR, 'index.html'), 'utf8');
const ART = (indexHtml.match(/<figure class="hero__art">\s*(<svg[\s\S]*?<\/svg>)/) || [])[1];
if (!ART) throw new Error('index.html からイラストの SVG が見つかりません');

const FONT = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@700&family=Zen+Maru+Gothic:wght@700;900&display=block">';

const OGP_HTML = `<!doctype html><html lang="ja"><head><meta charset="utf-8">${FONT}<style>
  *{box-sizing:border-box;margin:0}
  body{width:1200px;height:630px;font-family:"Noto Sans JP",sans-serif;color:#fff;letter-spacing:.03em;overflow:hidden;
    background:radial-gradient(640px 400px at 100% 0%,rgba(244,207,116,.18),transparent 60%),#1f2b4d;
    display:grid;grid-template-columns:600px 1fr;align-items:center;gap:40px;padding:0 60px 76px 68px}
  .pre{display:inline-block;font-size:26px;font-weight:700;padding:6px 22px;border-radius:999px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.3)}
  h1{font-family:"Zen Maru Gothic",sans-serif;font-weight:900;font-size:68px;line-height:1.35;margin:22px 0 18px}
  h1 em{font-style:normal;color:#f4cf74}
  p.lead{font-size:28px;font-weight:700;color:rgba(255,255,255,.92)}
  .art svg{display:block;width:100%;border-radius:28px;box-shadow:0 18px 44px rgba(0,0,0,.35)}
  .foot{position:absolute;left:0;right:0;bottom:0;height:76px;background:#fbf7ef;color:#1f2b4d;display:flex;align-items:center;justify-content:space-between;padding:0 68px;font-family:"Zen Maru Gothic",sans-serif;font-weight:900;font-size:30px;white-space:nowrap}
  .foot span{color:#00843a}
</style></head><body>
  <div>
    <span class="pre">となりのいびきで、眠れないあなたへ</span>
    <h1>別々に寝る前に、<br><em>まず7日間</em>だけ。</h1>
    <p class="lead">歯科医師がLINEで毎晩3分お届け</p>
  </div>
  <div class="art">${ART}</div>
  <div class="foot"><div>となりのいびき相談室</div><div><span>LINEで無料</span>　7日間の音声講座</div></div>
</body></html>`;

const ICON_HTML = `<!doctype html><html><head><meta charset="utf-8"><style>*{margin:0}body{width:180px;height:180px;background:#1f2b4d}img{width:180px;height:180px;display:block}</style></head>
<body><img src="data:image/svg+xml;base64,${Buffer.from(fs.readFileSync(path.join(IMG_DIR, 'favicon.svg'))).toString('base64')}"></body></html>`;

(async () => {
  const browser = await chromium.launch();
  const render = async (html, w, h, file) => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await page.route(/fonts\.(googleapis|gstatic)\.com/, viaCurl);
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
      await Promise.all([
        document.fonts.load('700 32px "Noto Sans JP"', '歯科医師がLINEで毎晩3分お届け'),
        document.fonts.load('900 32px "Zen Maru Gothic"', '別々に寝る前にまず7日間だけとなりのいびき相談室グーゴォ'),
        document.fonts.load('700 32px "Zen Maru Gothic"', 'ねむれない'),
      ]);
    });
    await page.screenshot({ path: path.join(IMG_DIR, file), type: 'png' });
    await page.close();
    console.log('wrote', path.relative(process.cwd(), path.join(IMG_DIR, file)));
  };
  await render(OGP_HTML, 1200, 630, 'ogp.png');
  await render(ICON_HTML, 180, 180, 'apple-touch-icon.png');
  await browser.close();
})();
