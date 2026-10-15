/* =========================================================
   販売導線のページ（小冊子プレゼント・12週間コース）— funnel.js（依存ライブラリなし）
   ========================================================= */
(() => {
  'use strict';

  /* ---------------------------------------------------------
     設定（運用時はここを編集）
     --------------------------------------------------------- */
  const CONFIG = {
    // LINE公式アカウントの友だち追加URL【要設定】。広告ごとに流入経路を分けられる配信ツール（Lステップ・エルメ等）の流入経路URLがおすすめ
    lineUrl: '',
    // 12週間コースの申込フォームの送信先【要設定】（application/x-www-form-urlencoded で POST。Google Apps Script・フォーム受信サービス等）
    applyEndpoint: '',
    // 送信の待ち時間（ミリ秒）
    submitTimeoutMs: 30000,
    // 確認用の表示（未設定の注意書き）。未指定なら手元の確認（localhost・ファイルを直接開いたとき）だけ表示。true で常に表示、false で常に非表示
    preview: undefined,
  };
  if (window.LP_CONFIG && typeof window.LP_CONFIG === 'object') Object.assign(CONFIG, window.LP_CONFIG);

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  const params = new URLSearchParams(location.search);
  const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]', ''];
  const isLocal = LOCAL_HOSTS.includes(location.hostname);
  const showTodo = CONFIG.preview === true || (CONFIG.preview !== false && isLocal);
  window.dataLayer = window.dataLayer || [];

  const todoNote = (el, text) => {
    if (!showTodo) return;
    const note = document.createElement('p');
    note.className = 'todo-note';
    note.textContent = text;
    el.after(note);
  };

  /* 文字サイズ（標準／大）— LPと同じ設定を使う */
  const fsToggle = $('#fs-toggle');
  if (fsToggle) {
    const sync = () => fsToggle.setAttribute('aria-pressed', String(document.documentElement.dataset.fs === 'lg'));
    sync();
    fsToggle.addEventListener('click', () => {
      const large = document.documentElement.dataset.fs !== 'lg';
      if (large) document.documentElement.dataset.fs = 'lg';
      else delete document.documentElement.dataset.fs;
      try { localStorage.setItem('ibiki_fs', large ? 'lg' : 'md'); } catch (e) { /* 保存できなくても切り替えは効く */ }
      sync();
    });
  }

  /* LINE の友だち追加ボタン */
  const lineButtons = $$('[data-line]');
  if (lineButtons.length) {
    if (CONFIG.lineUrl) {
      lineButtons.forEach((a) => { a.href = CONFIG.lineUrl; a.target = '_blank'; a.rel = 'noopener'; });
    } else {
      console.error('[funnel] CONFIG.lineUrl が未設定です（LINE の友だち追加URL）');
      todoNote(lineButtons[0], 'LINEの友だち追加URL（CONFIG.lineUrl）が未設定です');
    }
    lineButtons.forEach((a) => a.addEventListener('click', () => window.dataLayer.push({ event: 'line_add_click', cta: a.dataset.line })));
  }

  /* ---------------------------------------------------------
     12週間コースの申込フォーム
     受講前チェックで医療機関への相談が先の方は、送信できないようにして受診を案内する
     --------------------------------------------------------- */
  const form = $('#apply-form');
  if (!form) return;
  const stop = $('#apply-stop');
  const cpapNote = $('#apply-cpap');
  const submit = $('#apply-submit');
  const error = $('#apply-error');
  const done = $('#apply-done');
  const RED_FLAGS = ['q_apnea', 'q_drowsy', 'q_headache'];
  const demoAllowed = isLocal || CONFIG.preview === true;
  const unavailable = !CONFIG.applyEndpoint && !demoAllowed;

  // 流入元を引き継ぐ
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'].forEach((k) => {
    const v = params.get(k);
    if (v) { const i = document.createElement('input'); i.type = 'hidden'; i.name = k; i.value = v; form.append(i); }
  });
  form.elements.landing_url.value = location.href.split('#')[0];
  const opened = Date.now();

  if (unavailable) {
    console.error('[funnel] CONFIG.applyEndpoint が未設定のため、申込フォームを止めています');
    submit.disabled = true;
    error.textContent = 'ただいま申込の受付を準備しています。LINEのトークでお問い合わせください。';
    error.hidden = false;
  } else if (!CONFIG.applyEndpoint) {
    todoNote(submit, '申込フォームの送信先（CONFIG.applyEndpoint）が未設定です（手元の確認では送信せずに完了表示）');
  }

  function screening() {
    const flagged = RED_FLAGS.some((n) => form.elements[n].value === 'yes');
    const cpap = form.elements.q_cpap.value === 'yes';
    stop.hidden = !flagged;
    cpapNote.hidden = !cpap;
    form.elements.cpap_ok.required = cpap;
    if (!unavailable) submit.disabled = flagged;
    return { flagged, cpap };
  }
  form.addEventListener('change', screening);
  screening();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    error.hidden = true;
    const { flagged } = screening();
    if (flagged || unavailable) return;
    if (!form.reportValidity()) return;
    const body = new URLSearchParams(new FormData(form));
    body.set('elapsed', String(Math.round((Date.now() - opened) / 1000)));
    submit.disabled = true;
    submit.textContent = '送信しています…';
    try {
      if (CONFIG.applyEndpoint) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), CONFIG.submitTimeoutMs);
        const res = await fetch(CONFIG.applyEndpoint, { method: 'POST', body, signal: ctrl.signal });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      }
      window.dataLayer.push({ event: 'course_apply', lp: 'course' });
      form.hidden = true;
      done.hidden = false;
      done.focus();
    } catch (err) {
      console.error('[funnel] 申込の送信に失敗しました', err);
      error.textContent = err.name === 'AbortError'
        ? '送信に時間がかかっています。届いている可能性があるため、もう一度送る前にLINEのトークでご確認ください。'
        : '送信できませんでした。通信状況をご確認のうえ、もう一度お試しください。続く場合はLINEのトークでお知らせください。';
      error.hidden = false;
      submit.disabled = false;
      submit.textContent = '申し込む（お支払いはまだ発生しません）';
    }
  });
})();
