/* =========================================================
   となりのいびき相談室 LP — main.js（依存ライブラリなし）
   ========================================================= */
(() => {
  'use strict';

  /* ---------------------------------------------------------
     設定（運用時はここを編集）
     --------------------------------------------------------- */
  const CONFIG = {
    // L Message で発行した「流入経路URL」【要設定】
    // ページのURLに ?src=tiktok のように付けると、その流入元のURLが使われる（utm_source でも可）
    // 該当がなければ default を使う。default も空なら、ボタンを止めて「準備中」を表示する
    lineUrls: {
      default: '',
      tiktok: '',
      instagram: '',
      youtube: '',
      standfm: '',
      threads: '',
    },
    // Google タグマネージャーのコンテナID（例：'GTM-XXXXXXX'）。空なら読み込まない【要設定】
    gtmId: '',
    // 計測するドメイン。ここに含まれないドメイン（手元の確認・プレビュー）では計測タグを読み込まない【要設定】
    prodHosts: [],
  };
  // HTML側で window.IBIKI_CONFIG = { lineUrls: { default: '...' } } のように上書きも可能
  if (window.IBIKI_CONFIG && typeof window.IBIKI_CONFIG === 'object') {
    const o = window.IBIKI_CONFIG;
    if (o.lineUrls) Object.assign(CONFIG.lineUrls, o.lineUrls);
    if (o.gtmId) CONFIG.gtmId = o.gtmId;
    if (Array.isArray(o.prodHosts)) CONFIG.prodHosts = o.prodHosts;
  }

  /* ---------------------------------------------------------
     流入元の判定（?src= または utm_source）
     --------------------------------------------------------- */
  const ALIASES = {
    tt: 'tiktok', tiktok: 'tiktok',
    ig: 'instagram', insta: 'instagram', instagram: 'instagram',
    yt: 'youtube', youtube: 'youtube',
    sf: 'standfm', standfm: 'standfm', 'stand.fm': 'standfm',
    th: 'threads', threads: 'threads',
  };
  const STORE_KEY = 'ibiki_src';

  function detectSource() {
    const params = new URLSearchParams(location.search);
    const raw = (params.get('src') || params.get('utm_source') || '').trim().toLowerCase();
    let src = ALIASES[raw] || '';
    // プライバシーポリシーなどを見て戻ってきても流入元を保つ
    try {
      if (src) sessionStorage.setItem(STORE_KEY, src);
      else src = sessionStorage.getItem(STORE_KEY) || '';
    } catch (e) { /* 保存できない環境では、その場の判定だけを使う */ }
    return src || 'default';
  }

  const source = detectSource();
  const lineUrl = CONFIG.lineUrls[source] || CONFIG.lineUrls.default || '';
  const isSafeUrl = /^https:\/\//.test(lineUrl);

  /* ---------------------------------------------------------
     計測（GTM）。本番ドメインでのみ読み込む
     --------------------------------------------------------- */
  window.dataLayer = window.dataLayer || [];
  if (CONFIG.gtmId && CONFIG.prodHosts.includes(location.hostname)) {
    window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(CONFIG.gtmId);
    document.head.appendChild(s);
  }

  /* ---------------------------------------------------------
     LINEボタン
     --------------------------------------------------------- */
  const notice = document.getElementById('line');
  const buttons = document.querySelectorAll('[data-line]');

  if (!isSafeUrl) {
    console.error('[LP] CONFIG.lineUrls が未設定のため、LINEボタンを止めています（assets/js/main.js の CONFIG を設定してください）');
  }

  buttons.forEach((btn) => {
    if (isSafeUrl) {
      btn.href = lineUrl;
      btn.rel = 'noopener';
    } else {
      btn.classList.add('is-disabled');
      btn.setAttribute('aria-disabled', 'true');
    }
    btn.addEventListener('click', (e) => {
      window.dataLayer.push({ event: 'line_click', cta: btn.dataset.cta || '', src: source, available: isSafeUrl });
      if (!isSafeUrl) {
        e.preventDefault();
        if (notice) {
          notice.hidden = false;
          notice.setAttribute('role', 'status');
          notice.scrollIntoView({ block: 'center' });
        }
      }
    });
  });

  /* ---------------------------------------------------------
     スマホ下部の追従ボタン：最初の画面と最後のCTAが見えている間は隠す
     --------------------------------------------------------- */
  const sticky = document.querySelector('[data-sticky]');
  const hero = document.querySelector('.hero');
  const closing = document.querySelector('.closing');
  if (sticky && hero && 'IntersectionObserver' in window) {
    const visible = new Map([[hero, true], [closing, false]]);
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => visible.set(en.target, en.isIntersecting));
      sticky.hidden = visible.get(hero) || visible.get(closing);
    });
    io.observe(hero);
    if (closing) io.observe(closing);
  }
})();
