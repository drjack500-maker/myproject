/* =========================================================
   All-on-4 LP — main.js（依存ライブラリなし）
   ========================================================= */
(() => {
  'use strict';

  /* ---------------------------------------------------------
     設定（運用時はここを編集）
     --------------------------------------------------------- */
  const CONFIG = {
    // フォーム送信先（空ならデモモード：送信せずサンクスページへ遷移）
    // 例：自社のフォーム受信API、formrun / Googleフォーム連携のエンドポイントなど
    formEndpoint: '',
    thanksUrl: 'thanks.html',
    // LINE公式アカウントの友だち追加URL（空ならLINEボタンを表示しない）
    lineUrl: '',
    // 予約候補として表示する日数（休診日を除く）
    bookingDays: 21,
    // 休診曜日（0=日, 6=土）【要確認】
    closedWeekdays: [0, 6],
    // 休診日（祝日・年末年始など）YYYY-MM-DD【要確認：医院の年末年始休診日を追加】
    holidays: [
      '2026-10-12', '2026-11-03', '2026-11-23',
      '2027-01-01', '2027-01-11', '2027-02-11', '2027-02-23', '2027-03-22',
      '2027-04-29', '2027-05-03', '2027-05-04', '2027-05-05', '2027-07-19',
      '2027-08-11', '2027-09-20', '2027-09-23', '2027-10-11', '2027-11-03', '2027-11-23',
    ],
    // 予約時間帯【要確認】
    timeSlots: ['午前（9:30〜12:30）', '午後（14:30〜17:00）', '夕方（17:00〜19:00）'],
  };

  /* ---------------------------------------------------------
     広告キーワード別のファーストビュー出し分け（メッセージマッチ）
     ?v=denture などで明示指定、または utm_term / kw から自動判定
     --------------------------------------------------------- */
  const HEADLINES = {
    denture: {
      pre: '入れ歯が合わない・痛い・外れる方へ',
      title: 'もう、入れ歯を<br><mark>外さない毎日</mark>へ。',
      lead: 'オールオン4は、4本のインプラントで片あごすべての歯を支える“固定式の歯”。毎晩の取り外しや、食事中のずれ・痛みのストレスを軽減できます。手術当日に仮歯が入るため、歯のない期間もありません。',
    },
    price: {
      pre: 'オールオン4の費用が気になる方へ',
      title: 'オールオン4（片あご）<br><mark>1,925,000円</mark><small>（税込）</small>',
      lead: '最大120回の分割払い（月々39,000円〜）に対応。医療費控除の対象にもなります。精密検査の後、治療を始める前に総額のお見積りをご説明します。',
    },
    bone: {
      pre: '「骨が足りない」と言われた方へ',
      title: '骨が少なくても、<br><mark>治療できる</mark><br class="u-sp">可能性があります。',
      lead: 'オールオン4は、奥のインプラントを斜めに埋め込み、骨の少ない部分や神経を避けて治療できる場合があります。上あごの骨が少ない方には「ザイゴマインプラント」という選択肢も。まずはCTで骨の状態を確認しましょう。',
    },
    fear: {
      pre: '手術が怖い・痛みが不安な方へ',
      title: 'うとうとした状態で、<br><mark>手術を受けられます。</mark>',
      lead: '静脈内鎮静法・全身麻酔に対応。緊張や恐怖心が強い方も、リラックスした状態でオールオン4の手術を受けていただけます。手術当日には固定式の仮歯が入ります。',
    },
  };
  const VARIANT_RULES = [
    ['bone', /骨|断られ|ザイゴマ|zygoma/i],
    ['fear', /痛|怖|こわ|麻酔|鎮静/],
    ['price', /費用|値段|料金|価格|相場|安い|いくら|ローン|分割|price|cost/i],
    ['denture', /入れ歯|いれば|義歯|総入れ歯|部分入れ歯|denture/i],
  ];

  /* ---------------------------------------------------------
     Utilities
     --------------------------------------------------------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const store = {
    get(k, s = sessionStorage) { try { return s.getItem(k); } catch (e) { return null; } },
    set(k, v, s = sessionStorage) { try { s.setItem(k, v); } catch (e) { /* private mode etc. */ } },
  };
  window.dataLayer = window.dataLayer || [];
  const track = (event, params = {}) => { window.dataLayer.push({ event, ...params }); };
  const fmt = (n) => Math.round(n).toLocaleString('ja-JP');
  const pad = (n) => String(n).padStart(2, '0');
  const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const WEEK = ['日', '月', '火', '水', '木', '金', '土'];

  /* ---------------------------------------------------------
     1. 流入元パラメータの保持（フォームの隠し項目へ）
     --------------------------------------------------------- */
  const params = new URLSearchParams(location.search);
  const ATTR_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'gbraid', 'wbraid', 'yclid'];
  let attribution = {};
  try { attribution = JSON.parse(store.get('lp_attr') || '{}'); } catch (e) { attribution = {}; }
  ATTR_KEYS.forEach((k) => { const v = params.get(k); if (v) attribution[k] = v; });
  if (!attribution.landing_url) attribution.landing_url = location.href;
  if (!attribution.referrer && document.referrer) attribution.referrer = document.referrer;
  store.set('lp_attr', JSON.stringify(attribution));

  /* ---------------------------------------------------------
     2. ファーストビューの出し分け
     --------------------------------------------------------- */
  const detectVariant = () => {
    const v = params.get('v');
    if (v && HEADLINES[v]) return v;
    const term = `${attribution.utm_term || ''} ${params.get('kw') || ''}`;
    for (const [key, re] of VARIANT_RULES) if (re.test(term)) return key;
    return 'default';
  };
  const variant = detectVariant();
  if (variant !== 'default') {
    const h = HEADLINES[variant];
    $$('[data-hl]').forEach((el) => { const k = el.dataset.hl; if (h[k]) el.innerHTML = h[k]; });
  }
  document.documentElement.dataset.variant = variant;
  track('lp_view', { lp_variant: variant });

  /* ---------------------------------------------------------
     3. 文字サイズ切り替え
     --------------------------------------------------------- */
  const fsButtons = $$('[data-fs-toggle]');
  const syncFs = () => {
    const on = document.documentElement.dataset.fs === 'lg';
    fsButtons.forEach((b) => {
      b.setAttribute('aria-pressed', String(on));
      b.setAttribute('aria-label', on ? '文字サイズを標準に戻す' : '文字サイズを大きくする');
    });
  };
  fsButtons.forEach((b) => b.addEventListener('click', () => {
    const next = document.documentElement.dataset.fs === 'lg' ? '' : 'lg';
    if (next) document.documentElement.dataset.fs = next; else delete document.documentElement.dataset.fs;
    store.set('lp_fs', next, localStorage);
    syncFs();
    track('font_size', { size: next || 'normal' });
  }));
  syncFs();

  /* ---------------------------------------------------------
     4. LINEボタン（URL設定時のみ表示）
     --------------------------------------------------------- */
  if (CONFIG.lineUrl) {
    $$('[data-line-link]').forEach((a) => {
      a.href = CONFIG.lineUrl; a.target = '_blank'; a.rel = 'noopener'; a.hidden = false;
    });
  }

  /* ---------------------------------------------------------
     5. クリック計測（data-track / tel:）
     --------------------------------------------------------- */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('a, button');
    if (!el) return;
    const href = el.getAttribute('href') || '';
    if (href.startsWith('tel:')) track('tel_click', { cta: el.dataset.track || 'inline' });
    else if (el.hasAttribute('data-line-link')) track('line_click', { cta: el.dataset.track || 'inline' });
    else if (el.dataset.track) track('cta_click', { cta: el.dataset.track });
  });

  /* ---------------------------------------------------------
     6. 追従CTA：ファーストビューを過ぎたら表示、予約フォーム付近では隠す
     --------------------------------------------------------- */
  const sticky = $('[data-sticky]');
  const fv = $('#fv');
  const reserve = $('#reserve');
  if (sticky && fv && reserve && 'IntersectionObserver' in window) {
    let pastFv = false;
    let atReserve = false;
    const mq = window.matchMedia('(max-width: 899px)');
    const update = () => {
      const show = pastFv && !atReserve;
      sticky.classList.toggle('is-visible', show);
      document.body.style.setProperty('--sticky-h', show && mq.matches ? `${sticky.offsetHeight}px` : '0px');
    };
    new IntersectionObserver(([en]) => { pastFv = !en.isIntersecting; update(); }).observe(fv);
    new IntersectionObserver(([en]) => { atReserve = en.isIntersecting; update(); }, { rootMargin: '0px 0px -25% 0px' }).observe(reserve);
    mq.addEventListener?.('change', update);
  } else if (sticky) {
    sticky.classList.add('is-visible');
  }

  /* ---------------------------------------------------------
     7. お悩みチェック（選んだ内容をフォームに引き継ぐ）
     --------------------------------------------------------- */
  const worries = $$('.worry');
  const worryCount = $('[data-worry-count]');
  const worryMsg = $('[data-worry-msg]');
  const worryBox = $('.worry-result');
  const WORRY_MSG = [
    '当てはまるお悩みをタップしてください。',
    'そのお悩み、オールオン4が解決の選択肢になるかもしれません。まずはお気軽にご相談ください。',
    'いくつものお悩みを抱えている方こそ、一度CTで骨の状態を確かめてみませんか？ オールオン4ができるかどうかがわかります。',
  ];
  const syncConcern = (key, on) => {
    $$(`input[name="concerns"][data-concern="${key}"]`).forEach((cb) => {
      if (on) cb.checked = true;
      else if (!worries.some((w) => w.dataset.concern === key && w.getAttribute('aria-pressed') === 'true')) cb.checked = false;
    });
  };
  worries.forEach((btn) => btn.addEventListener('click', () => {
    const on = btn.getAttribute('aria-pressed') !== 'true';
    btn.setAttribute('aria-pressed', String(on));
    syncConcern(btn.dataset.concern, on);
    const n = worries.filter((w) => w.getAttribute('aria-pressed') === 'true').length;
    const level = n === 0 ? 0 : n < 3 ? 1 : 2;
    worryCount.textContent = n;
    worryMsg.textContent = WORRY_MSG[level];
    worryBox.dataset.level = level;
    if (on) track('worry_check', { worry: btn.textContent.trim(), count: n });
  }));

  /* ---------------------------------------------------------
     8. 医療費控除シミュレーター
     --------------------------------------------------------- */
  const simCost = $('#sim-cost');
  const simRate = $('#sim-rate');
  const simOut = (k) => $(`[data-sim="${k}"]`);
  const calcTax = () => {
    const cost = Number(String(simCost.value).replace(/[^\d]/g, '')) || 0;
    const rate = Number(simRate.value);
    const deduction = Math.min(Math.max(cost - 100000, 0), 2000000);
    // 所得税（復興特別所得税2.1%を含む）。小数誤差を避けるため整数で計算
    const income = Math.floor((deduction * Math.round(rate * 100) * 1021) / 100000);
    const resident = Math.floor(deduction * 0.10);
    simOut('deduction').textContent = fmt(deduction);
    simOut('income').textContent = fmt(income);
    simOut('resident').textContent = fmt(resident);
    simOut('total').textContent = fmt(income + resident);
  };
  if (simCost && simRate) {
    simCost.addEventListener('input', () => {
      const digits = simCost.value.replace(/[^\d]/g, '').slice(0, 9);
      simCost.value = digits ? Number(digits).toLocaleString('ja-JP') : '';
      calcTax();
    });
    simRate.addEventListener('change', calcTax);
    let simTracked = false;
    [simCost, simRate].forEach((el) => el.addEventListener('change', () => {
      if (!simTracked) { simTracked = true; track('tax_sim_use'); }
    }));
    calcTax();
  }

  /* ---------------------------------------------------------
     9. 予約フォーム（3ステップ）
     --------------------------------------------------------- */
  const form = $('#reserve-form');
  if (form) {
    const steps = $$('.rform__step', form);
    const progressItems = $$('.rform__progress li', form);
    const bar = $('[data-progress-bar]', form);
    const announcer = $('[data-step-announcer]', form);
    const STEP_NAMES = ['ご相談内容', 'ご希望日時', 'ご連絡先'];
    let current = 0;
    let started = false;

    // 予約候補日を生成
    const buildDates = () => {
      const out = [];
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + 1); // 最短翌日
      let guard = 0;
      while (out.length < CONFIG.bookingDays && guard < 120) {
        if (!CONFIG.closedWeekdays.includes(d.getDay()) && !CONFIG.holidays.includes(toISO(d))) out.push(new Date(d));
        d.setDate(d.getDate() + 1);
        guard += 1;
      }
      return out;
    };
    const dates = buildDates();
    const makeChip = (name, value, html, ariaLabel) => {
      const label = document.createElement('label');
      label.className = 'chip';
      const input = document.createElement('input');
      input.type = 'radio'; input.name = name; input.value = value;
      if (ariaLabel) input.setAttribute('aria-label', ariaLabel);
      const span = document.createElement('span');
      span.innerHTML = html;
      label.append(input, span);
      return label;
    };
    $$('[data-picker]', form).forEach((picker) => {
      const n = picker.dataset.picker;
      const dateBox = $('[data-dates]', picker);
      const timeBox = $('[data-times]', picker);
      dates.forEach((d) => {
        const w = d.getDay();
        const cls = w === 6 ? ' class="is-sat"' : w === 0 ? ' class="is-sun"' : '';
        dateBox.append(makeChip(`date${n}`, toISO(d), `${d.getMonth() + 1}/${d.getDate()}<small${cls}>（${WEEK[w]}）</small>`,
          `${d.getMonth() + 1}月${d.getDate()}日 ${WEEK[w]}曜日`));
      });
      CONFIG.timeSlots.forEach((t) => timeBox.append(makeChip(`time${n}`, t, t)));
    });

    const showError = (key, show) => {
      const el = $(`[data-error="${key}"]`, form);
      if (el) el.hidden = !show;
      const input = form.elements[key];
      if (input && input.setAttribute) input.setAttribute('aria-invalid', String(show));
    };
    const val = (name) => {
      const el = form.elements[name];
      return el ? String(el.value || '').trim() : '';
    };
    const validateStep = (i) => {
      let ok = true;
      let firstBad = null;
      if (i === 1) {
        const good = !!val('date1') && !!val('time1');
        showError('date1', !good);
        if (!good) { ok = false; firstBad = $('[data-picker="1"]', form); }
      }
      if (i === 2) {
        const nameOk = val('name').length > 0;
        showError('name', !nameOk);
        const telDigits = val('tel').replace(/[^\d]/g, '');
        const telOk = /^0\d{9,10}$/.test(telDigits);
        showError('tel', !telOk);
        const email = val('email');
        const emailOk = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        showError('email', !emailOk);
        ok = nameOk && telOk && emailOk;
        if (!nameOk) firstBad = form.elements.name;
        else if (!telOk) firstBad = form.elements.tel;
        else if (!emailOk) firstBad = form.elements.email;
      }
      if (!ok) {
        track('form_error', { step: i + 1 });
        if (firstBad) {
          firstBad.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (firstBad.focus) firstBad.focus({ preventScroll: true });
        }
      }
      return ok;
    };

    const go = (i) => {
      steps.forEach((s, idx) => { s.hidden = idx !== i; });
      progressItems.forEach((li, idx) => {
        li.classList.toggle('is-current', idx === i);
        li.classList.toggle('is-done', idx < i);
      });
      bar.style.width = `${((i + 1) / steps.length) * 100}%`;
      current = i;
      announcer.textContent = `ステップ${i + 1}／${steps.length}：${STEP_NAMES[i]}`;
      const top = form.getBoundingClientRect().top;
      if (top < 0 || top > window.innerHeight * 0.5) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const legend = $('.rform__legend', steps[i]);
      if (legend) legend.focus({ preventScroll: true });
      track('form_step', { step: i + 1 });
    };

    form.addEventListener('focusin', () => {
      if (!started) { started = true; track('form_start', { lp_variant: variant }); }
    });
    form.addEventListener('change', (e) => {
      if (!started) { started = true; track('form_start', { lp_variant: variant }); }
      const n = e.target.name;
      if (/^(date1|time1)$/.test(n) && val('date1') && val('time1')) showError('date1', false);
      if (n === 'tel' || n === 'name' || n === 'email') showError(n, false);
    });
    $$('[data-next]', form).forEach((b) => b.addEventListener('click', () => {
      if (validateStep(current)) go(current + 1);
    }));
    $$('[data-prev]', form).forEach((b) => b.addEventListener('click', () => go(current - 1)));

    // Enterキーで意図せず送信されないように（textarea以外）
    form.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT' && current < steps.length - 1) {
        e.preventDefault();
        if (validateStep(current)) go(current + 1);
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (current !== steps.length - 1) return;
      if (!validateStep(current)) return;

      Object.entries(attribution).forEach(([k, v]) => { if (form.elements[k]) form.elements[k].value = v; });
      form.elements.lp_variant.value = variant;

      const submitBtn = $('[data-submit]', form);
      const errBox = $('[data-error="submit"]', form);
      errBox.hidden = true;
      const concerns = $$('input[name="concerns"]:checked', form).map((c) => c.value);
      const eventParams = { lp_variant: variant, who: val('who'), concerns: concerns.join(','), age: val('age') };

      if (!CONFIG.formEndpoint) {
        // デモモード：送信先が未設定のため、送信せずにサンクスページへ
        console.info('[LP] formEndpoint が未設定のため、送信せずにサンクスページへ遷移します（デモモード）');
        track('form_submit', { ...eventParams, demo: true });
        location.href = `${CONFIG.thanksUrl}?demo=1`;
        return;
      }

      submitBtn.disabled = true;
      submitBtn.setAttribute('aria-busy', 'true');
      try {
        const res = await fetch(CONFIG.formEndpoint, {
          method: 'POST',
          body: new FormData(form),
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        track('form_submit', eventParams);
        location.href = CONFIG.thanksUrl;
      } catch (err) {
        errBox.hidden = false;
        submitBtn.disabled = false;
        submitBtn.removeAttribute('aria-busy');
        track('form_submit_error', { message: String(err && err.message) });
      }
    });
  }

  /* ---------------------------------------------------------
     10. スクロール表示アニメーション
     --------------------------------------------------------- */
  const reveals = $$('.reveal');
  if ('IntersectionObserver' in window && reveals.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-in'));
  }

  /* ---------------------------------------------------------
     11. スクロール到達・FAQ開閉の計測
     --------------------------------------------------------- */
  const sectionsSeen = new Set();
  if ('IntersectionObserver' in window) {
    const so = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        const id = en.target.id;
        if (en.isIntersecting && !sectionsSeen.has(id)) { sectionsSeen.add(id); track('section_view', { section: id }); }
      });
    }, { threshold: 0.3 });
    $$('main section[id]').forEach((s) => so.observe(s));
  }
  $$('.faq__item').forEach((d) => d.addEventListener('toggle', () => {
    if (d.open) track('faq_open', { question: $('summary', d).textContent.replace(/^Q/, '').trim() });
  }));
})();
