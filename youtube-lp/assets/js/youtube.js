/* =========================================================
   YouTube をご覧の方向けページ専用の動き（main.js は名駅歯科LPと共通）
   1. 動画：押したときだけ YouTube の再生画面を読み込む（最初はサムネイルも読み込まない）
   2. 予約フォーム：説明欄のURL（utm_content=動画ID）から「ご覧になった動画」を選んでおく
   ========================================================= */
(() => {
  'use strict';

  const track = (event, params = {}) => { (window.dataLayer = window.dataLayer || []).push({ event, ...params }); };

  /* ---------------------------------------------------------
     1. 動画の埋め込み（プライバシー強化モード：youtube-nocookie.com）
     JavaScript が無効なときや、新しいタブで開く操作のときは、通常のリンクとして YouTube を開く
     --------------------------------------------------------- */
  document.querySelectorAll('a[data-yt-id]').forEach((a) => {
    a.addEventListener('click', (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const id = a.dataset.ytId || '';
      if (!/^[\w-]{11}$/.test(id)) return;
      e.preventDefault();
      const label = a.querySelector('.yvideo__label');
      const iframe = document.createElement('iframe');
      iframe.className = 'yvideo__frame';
      iframe.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`;
      iframe.title = `動画：${label ? label.textContent.trim() : 'YouTube'}`;
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      iframe.allowFullscreen = true;
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      a.replaceWith(iframe);
      iframe.focus();
      track('video_play', { video_id: id });
    });
  });

  /* ---------------------------------------------------------
     2. 「ご覧になった動画」の自動選択
     main.js が保存した流入元（sessionStorage の lp_attr）を優先し、なければ今のURLを見る
     --------------------------------------------------------- */
  const select = document.querySelector('[data-video-select]');
  if (select && !select.value) {
    let id = '';
    try { id = JSON.parse(sessionStorage.getItem('lp_attr') || '{}').utm_content || ''; } catch (e) { id = ''; }
    if (!id) id = new URLSearchParams(location.search).get('utm_content') || '';
    const opt = id ? Array.from(select.options).find((o) => o.dataset.videoId === id) : null;
    if (opt) select.value = opt.value;
  }
})();
