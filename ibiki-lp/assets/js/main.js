/* =========================================================
   静寂の夜メソッド LP — main.js（依存ライブラリなし）
   ========================================================= */
(() => {
  'use strict';

  /* ---------------------------------------------------------
     設定（運用時はここを編集）
     --------------------------------------------------------- */
  const CONFIG = {
    // 決済ページ（申込フォーム）のURL【要設定】
    // 未設定のときは「お申し込みへ進む」ボタンが料金欄（#offer）を指したままになる
    checkoutUrl: '',
    // 決済ページへ引き継ぐ流入元のパラメータ（広告の成果計測用）。あわせて lp_variant（表示した見出し）も付ける
    passParams: ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'gbraid', 'wbraid', 'yclid', 'fbclid'],
    // 確認用の表示（未設定の項目の注意書き・見出しパターンの切り替え）。
    // 未指定なら手元の確認（localhost・ファイルを直接開いたとき）だけ表示。true で常に表示、false で常に非表示
    preview: undefined,
  };
  // HTML側で window.LP_CONFIG = { checkoutUrl: '...' } のように上書きも可能（main.js を編集せずに設定したい場合）
  if (window.LP_CONFIG && typeof window.LP_CONFIG === 'object') Object.assign(CONFIG, window.LP_CONFIG);

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  const params = new URLSearchParams(location.search);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]', ''];
  const showTodo = CONFIG.preview === true || (CONFIG.preview !== false && LOCAL_HOSTS.includes(location.hostname));

  /* ---------------------------------------------------------
     広告キーワード別のファーストビュー出し分け（タイトルコンセプト10パターン）
     ?v=goods などで明示指定、または utm_term / kw から自動判定。指定がなければ room（訴求力92点）
     title は改行位置の候補ごとに区切った配列（スマホで1行に収まる長さにする）
     --------------------------------------------------------- */
  const LEAD = '手術や器具に頼らず、自宅の寝室で今夜から。寝る姿勢・のどと舌の筋肉・鼻呼吸を整える、1日10分のいびき改善プログラムです。';
  const HEADLINES = {
    // 3. 訴求力92点（HTMLに書いてある標準の見出し）
    room: {
      no: 3,
      score: 92,
      pre: 'いびきに悩むご本人と、隣で眠るご家族へ',
      title: ['妻に<em>「もう別の部屋で寝て」</em>と', '言われたあの夜から', '卒業する方法'],
      lead: LEAD,
    },
    // 8. 訴求力91点
    partner: {
      no: 8,
      score: 91,
      pre: 'いびきに悩むご本人と、隣で眠るご家族へ',
      title: ['隣で眠る人に', '<em>「静かになったね」</em>と', '言われる日は、', '意外と近い'],
      lead: '寝る姿勢・のどと舌の筋肉・鼻呼吸。いびきの原因になる習慣を、自宅で1日10分ずつ整えるプログラムです。手術や器具は使いません。',
    },
    // 5. 訴求力90点
    goods: {
      no: 5,
      score: 90,
      pre: 'いびき対策グッズを試してきた方へ',
      title: ['グッズもサプリも', '効かなかったあなたへ。', 'いびき改善', '<em>「最後の処方箋」</em>'],
      lead: '口テープや枕で音をおさえても、外せば元どおり。のどが狭くなる原因の寝姿勢・筋肉のゆるみ・口呼吸・夜の習慣から、自宅で見直すプログラムです。',
    },
    // 1. 訴求力88点（効果の表現に根拠が必要。README 参照）
    week: {
      no: 1,
      score: 88,
      pre: '自宅でできる、いびき改善プログラム',
      title: ['たった1週間で', '家族が驚いた。', '<em>「地獄のいびき」</em>を', '自宅で静める', '快眠プログラム'],
      lead: '最初の7日間で、寝る姿勢・のどと舌の筋肉・鼻呼吸を順番に整えます。1日目と7日目にいびきを録音して、聞き比べてください。',
    },
    // 10. 訴求力87点
    long: {
      no: 10,
      score: 87,
      pre: 'いびきとの付き合いが長い方へ',
      title: ['いびき歴30年でも', '遅くない。', '今夜から始める', '<em>「快眠革命」</em>', '完全ガイド'],
      lead: '何年続いたいびきでも、今日から見直せる習慣があります。寝る姿勢・のどと舌の筋肉・鼻呼吸を、自宅で1日10分ずつ整えます。',
    },
    // 6. 訴求力86点
    deep: {
      no: 6,
      score: 86,
      pre: '夜中に目が覚める、朝から疲れている方へ',
      title: ['朝まで一度も起きない。', '人生が変わる', '<em>「深睡眠」</em>の', '手に入れ方'],
      lead: 'いびきで浅くなりがちな眠りを、寝る姿勢・のどと舌の筋肉・鼻呼吸から見直します。自宅で1日10分、手術や器具は使いません。',
    },
    // 2. 訴求力85点（受診を遠ざける表現・効果の断定・「睡眠専門家」の根拠に注意。README 参照）
    clinic: {
      no: 2,
      score: 85,
      pre: '手術や通院の前に、自宅でできること',
      title: ['病院に行かずに、', 'いびきが止まった。', '睡眠専門家が教える', '<em>「静寂の夜」</em>メソッド'],
      lead: LEAD,
    },
    // 7. 訴求力84点
    habit: {
      no: 7,
      score: 84,
      pre: 'いびきは体質だと、あきらめていた方へ',
      title: ['いびきは<em>「体質」</em>じゃない。', 'ゼロから始める', '静かな夜の取り戻し方'],
      lead: 'いびきの原因は、寝る姿勢、ゆるんだ筋肉、口呼吸、寝る前の習慣。どれも自分で見直せます。自宅で1日10分のプログラムです。',
    },
    // 4. 訴求力82点
    age: {
      no: 4,
      score: 82,
      pre: '年齢とともに、いびきが大きくなってきた方へ',
      title: ['20代でも70代でも', '関係ない。', 'いびきの根本原因を断つ', '<em>「呼吸リセット」</em>', 'プログラム'],
      lead: '年齢とともにゆるむ、のどと舌の筋肉。座ったままできるトレーニングと、寝る姿勢・鼻呼吸の見直しで、のどの通り道を整えます。',
    },
    // 9. 訴求力79点（健康効果の表現に根拠が必要。README 参照）
    health: {
      no: 9,
      score: 79,
      pre: '睡眠の質を見直したい方へ',
      title: ['睡眠の質が変われば、', '血圧も体重も', '日中の集中力も', 'すべて変わる'],
      lead: LEAD,
    },
  };
  // 検索語句からの自動判定（上から順に判定）。表現に注意が必要な week / clinic / health は ?v= の明示指定のときだけ使う
  const KEYWORD_RULES = [
    [/グッズ|テープ|マウスピース|枕|まくら|サプリ|スプレー|効かな|効果なし/, 'goods'],
    [/別室|別の部屋|寝室を分け|妻|嫁|奥さん/, 'room'],
    [/夫|旦那|主人|家族|パートナー|彼氏|彼女|うるさ/, 'partner'],
    [/熟睡|快眠|深い眠り|眠りが浅|目が覚め|中途覚醒|寝不足|疲れ|だるい/, 'deep'],
    [/何年|何十年|長年|ずっと|昔から|歴/, 'long'],
    [/高齢|年齢|年寄|老化|シニア|[2-9]0代|歳/, 'age'],
    [/体質|原因|治らな|治し方|治す/, 'habit'],
  ];
  const DEFAULT_VARIANT = 'room';

  function pickVariant() {
    const v = (params.get('v') || '').toLowerCase();
    if (Object.prototype.hasOwnProperty.call(HEADLINES, v)) return v;
    const term = params.get('utm_term') || params.get('kw') || '';
    for (const [re, key] of KEYWORD_RULES) if (re.test(term)) return key;
    return DEFAULT_VARIANT;
  }
  let variant = pickVariant();
  const toPhrases = (list) => list.map((p) => `<span class="ph">${p}</span>`).join('');
  const dawnTitle = $('#dawn-title');
  const dawnDefault = dawnTitle.innerHTML;

  function applyVariant(key) {
    variant = key;
    document.documentElement.dataset.variant = key;
    const h = HEADLINES[key];
    $('#hero-pre').textContent = h.pre;
    $('#hero-title').innerHTML = toPhrases(h.title);
    $('#hero-lead').textContent = h.lead;
    // 締めの見出しは「静かになったね」（8）。ファーストビューと重なるときは別の言葉にする
    dawnTitle.innerHTML = key === 'partner'
      ? toPhrases(['いびき歴が長くても、', '遅くはありません。', '今夜から、', '静かな夜へ。'])
      : dawnDefault;
  }
  if (variant !== DEFAULT_VARIANT) applyVariant(variant); // 標準の見出しは HTML に書いてある
  document.documentElement.dataset.variant = variant;

  /* ---------------------------------------------------------
     決済ページへのリンク（流入元と見出しパターンを引き継ぐ）
     --------------------------------------------------------- */
  function checkoutHref() {
    let url;
    try {
      url = new URL(CONFIG.checkoutUrl, location.href);
    } catch (e) {
      return '';
    }
    CONFIG.passParams.forEach((key) => {
      const value = params.get(key);
      if (value && !url.searchParams.has(key)) url.searchParams.set(key, value);
    });
    url.searchParams.set('lp_variant', variant);
    return url.href;
  }
  const checkoutButtons = $$('[data-checkout]');
  function setCheckoutLinks() {
    const href = CONFIG.checkoutUrl && checkoutHref();
    if (href) checkoutButtons.forEach((a) => { a.href = href; });
  }
  setCheckoutLinks();
  if (!CONFIG.checkoutUrl) {
    console.error('[LP] CONFIG.checkoutUrl が未設定です。「お申し込みへ進む」ボタンの移動先を設定してください（ibiki-lp/README.md 参照）');
    if (showTodo) {
      checkoutButtons.forEach((a) => {
        const note = document.createElement('p');
        note.className = 'todo-note';
        note.textContent = '決済ページのURL（CONFIG.checkoutUrl）が未設定です';
        a.after(note);
      });
    }
  }

  /* 確認用：見出しパターンの切り替え（手元の確認とプレビューのときだけ表示） */
  if (showTodo) {
    const bar = document.createElement('div');
    bar.className = 'variant-bar';
    const label = document.createElement('label');
    label.htmlFor = 'variant-select';
    label.textContent = '確認用：見出しパターン';
    const select = document.createElement('select');
    select.id = 'variant-select';
    Object.keys(HEADLINES)
      .sort((a, b) => HEADLINES[b].score - HEADLINES[a].score)
      .forEach((key) => {
        const h = HEADLINES[key];
        const option = document.createElement('option');
        option.value = key;
        option.textContent = `${h.score}点（${h.no}）${h.title.join('').replace(/<[^>]+>/g, '')}`;
        option.selected = key === variant;
        select.append(option);
      });
    select.addEventListener('change', () => {
      applyVariant(select.value);
      setCheckoutLinks();
    });
    bar.append(label, select);
    document.body.prepend(bar);
  }

  // ボタンのクリックを計測（Googleタグマネージャーを入れたときに使える）
  window.dataLayer = window.dataLayer || [];
  $$('[data-cta]').forEach((a) => {
    a.addEventListener('click', () => {
      window.dataLayer.push({ event: 'cta_click', cta: a.dataset.cta, lp_variant: variant, checkout: a.hasAttribute('data-checkout') });
    });
  });

  /* ---------------------------------------------------------
     文字サイズ（標準／大）
     --------------------------------------------------------- */
  const fsToggle = $('#fs-toggle');
  const syncFs = () => fsToggle.setAttribute('aria-pressed', String(document.documentElement.dataset.fs === 'lg'));
  syncFs();
  fsToggle.addEventListener('click', () => {
    const large = document.documentElement.dataset.fs !== 'lg';
    if (large) document.documentElement.dataset.fs = 'lg';
    else delete document.documentElement.dataset.fs;
    try { localStorage.setItem('ibiki_fs', large ? 'lg' : 'md'); } catch (e) { /* 保存できなくても表示は切り替わる */ }
    syncFs();
  });

  /* ---------------------------------------------------------
     一晩の音の記録（イメージ）
     23:00〜7:00 を3分ごとに160本の棒で描く。50dB以上をいびきとして色分け
     --------------------------------------------------------- */
  const NIGHT = { bars: 160, minutesPerBar: 3, minDb: 20, maxDb: 90, snoreDb: 50 };
  const LIKE = [[75, '電車の車内'], [65, 'にぎやかな事務所'], [55, 'ふつうの会話'], [47, '静かな事務所'], [35, '図書館'], [0, 'ささやき声']];
  const EPISODES = {
    // [開始の棒, 終わりの棒, いちばん大きいときのdB]
    snore: [[12, 40, 76], [58, 72, 66], [88, 120, 81], [134, 150, 70]],
    quiet: [[38, 42, 44], [95, 98, 41], [139, 142, 45]],
  };

  function seeded(seed) {
    let s = seed >>> 0;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }
  function makeNight(kind) {
    const rand = seeded(kind === 'snore' ? 7 : 11);
    const values = [];
    for (let i = 0; i < NIGHT.bars; i++) {
      let db = 27 + rand() * 6; // 静かな寝室の物音
      for (const [a, b, peak] of EPISODES[kind]) {
        if (i < a || i > b) continue;
        const t = (i - a) / (b - a);
        const swell = Math.pow(Math.sin(Math.PI * t), 0.9); // ふくらんで、しぼむ
        db = Math.max(db, 34 + (peak - 34) * swell * (0.8 + rand() * 0.2));
      }
      values.push(db);
    }
    return values;
  }
  const DATA = { snore: makeNight('snore'), quiet: makeNight('quiet') };

  function summarize(values) {
    const snoreMin = values.filter((v) => v >= NIGHT.snoreDb).length * NIGHT.minutesPerBar;
    const peak = Math.round(Math.max(...values));
    const like = LIKE.find(([db]) => peak >= db)[1];
    const rounded = Math.round(snoreMin / 10) * 10;
    let duration;
    if (snoreMin === 0) duration = 'ほぼなし';
    else if (rounded < 60) duration = `約${Math.max(rounded, 10)}分`;
    else duration = `約${Math.floor(rounded / 60)}時間${rounded % 60 ? `${rounded % 60}分` : ''}`;
    return { duration, peak: `約${peak}dB`, like: `${like}くらい` };
  }

  const canvas = $('#night-canvas');
  const card = canvas.closest('.night-card');
  let current = DATA.snore.slice();
  let shown = 'snore';
  let anim = 0;

  function draw(values) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const css = getComputedStyle(card);
    const color = (name) => css.getPropertyValue(name).trim();
    const pad = { l: 38, r: 4, t: 8, b: 22 };
    const pw = rect.width - pad.l - pad.r;
    const ph = rect.height - pad.t - pad.b;
    const y = (db) => pad.t + ph * (1 - (db - NIGHT.minDb) / (NIGHT.maxDb - NIGHT.minDb));
    const font = '11px "BIZ UDPGothic", "Hiragino Sans", "Yu Gothic", sans-serif';
    ctx.font = font;

    // 目盛り（30・50・70dB）。50dB はいびきの目安として点線
    [30, 50, 70].forEach((db) => {
      ctx.strokeStyle = color('--night-3');
      ctx.lineWidth = 1;
      ctx.setLineDash(db === NIGHT.snoreDb ? [4, 4] : []);
      ctx.beginPath();
      ctx.moveTo(pad.l, Math.round(y(db)) + 0.5);
      ctx.lineTo(rect.width - pad.r, Math.round(y(db)) + 0.5);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = color('--night-muted');
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${db}dB`, pad.l - 6, y(db));
    });

    // 棒
    const bw = pw / values.length;
    const gap = bw > 2.6 ? 1 : 0;
    values.forEach((db, i) => {
      const top = y(db);
      ctx.fillStyle = db >= NIGHT.snoreDb ? color('--snore') : color('--quiet');
      ctx.globalAlpha = db >= NIGHT.snoreDb ? 1 : 0.55;
      ctx.fillRect(pad.l + i * bw, top, Math.max(bw - gap, 0.8), y(NIGHT.minDb) - top);
    });
    ctx.globalAlpha = 1;

    // 時刻（23:00〜7:00）
    ctx.fillStyle = color('--night-muted');
    ctx.textBaseline = 'alphabetic';
    const total = NIGHT.bars * NIGHT.minutesPerBar;
    ['23:00', '1:00', '3:00', '5:00', '7:00'].forEach((label, k, all) => {
      const x = pad.l + (pw * (k * 120)) / total;
      ctx.textAlign = k === 0 ? 'left' : k === all.length - 1 ? 'right' : 'center';
      ctx.fillText(label, x, rect.height - 5);
    });
  }

  function showNight(kind) {
    if (kind === shown && !anim) return;
    shown = kind;
    $$('[data-night]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.night === kind)));
    const s = summarize(DATA[kind]);
    $('#night-snore').textContent = s.duration;
    $('#night-peak').textContent = s.peak;
    $('#night-like').textContent = s.like;
    canvas.setAttribute('aria-label', kind === 'snore'
      ? `いびきの夜の記録。一晩に何度も、50デシベルを超える大きな音が続いています。いびきの時間は${s.duration}、いちばん大きな音は${s.peak}です。`
      : `静かな夜の記録。一晩を通して、ほとんどが30デシベル前後の静かな音です。いちばん大きな音は${s.peak}です。`);

    cancelAnimationFrame(anim);
    const from = current.slice();
    const to = DATA[kind];
    if (reduceMotion) {
      current = to.slice();
      anim = 0;
      draw(current);
      return;
    }
    const start = performance.now();
    const duration = 900;
    const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    const step = (now) => {
      const p = Math.min((now - start) / duration, 1);
      current = from.map((v, i) => {
        const local = Math.min(Math.max((p - (i / to.length) * 0.35) / 0.65, 0), 1); // 左（23時）から順に変わる
        return v + (to[i] - v) * ease(local);
      });
      draw(current);
      anim = p < 1 ? requestAnimationFrame(step) : 0;
    };
    anim = requestAnimationFrame(step);
  }

  $$('[data-night]').forEach((b) => b.addEventListener('click', () => showNight(b.dataset.night)));
  const firstSummary = summarize(DATA.snore);
  $('#night-snore').textContent = firstSummary.duration;
  $('#night-peak').textContent = firstSummary.peak;
  $('#night-like').textContent = firstSummary.like;
  draw(current);
  if ('ResizeObserver' in window) new ResizeObserver(() => draw(current)).observe(canvas);
  else window.addEventListener('resize', () => draw(current));
  // Webフォントの読み込み後に目盛りの文字を描き直す
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => draw(current));

  /* ---------------------------------------------------------
     セルフチェック
     --------------------------------------------------------- */
  const checkForm = $('#check-form');
  const checkResult = $('#check-result');
  const checkMessage = $('#check-message');
  const MESSAGES = {
    none: '<p>当てはまる項目を選ぶと、ここに結果が表示されます。</p>',
    few: (n) => `<p><b>当てはまったのは${n}項目です。</b>いびきは、寝る姿勢・のどの筋肉・鼻呼吸・夜の習慣が重なって起こります。気になりはじめた今のうちに見直すと、習慣を変えるのも楽です。</p><a class="check-result__link" href="#method">3つの習慣を見る</a>`,
    some: (n) => `<p><b>当てはまったのは${n}項目です。</b>いびきが、眠りや家族との時間に影響しはじめています。原因になっている習慣を、ひとつずつ整えていきましょう。</p><a class="check-result__link" href="#program">最初の7日間を見る</a>`,
    many: (n) => `<p><b>当てはまったのは${n}項目です。</b>いびきが、毎日の眠りと暮らしに大きく影響しています。ひとりで抱え込まず、今夜から原因を見直していきましょう。</p><a class="check-result__link" href="#offer">プログラムの内容を見る</a>`,
    medical: '<p><b>睡眠時無呼吸症候群などの病気が、隠れているかもしれません。</b>このプログラムより先に、睡眠外来・耳鼻咽喉科・呼吸器内科などの医療機関で相談してください。医師の了承があれば、生活習慣の見直しとして並行して取り組めます。</p><a class="check-result__link" href="#medical">受診の目安を見る</a>',
  };
  function updateCheck() {
    const n = $$('input[name="c"]:checked', checkForm).length;
    const medical = $$('input[name="m"]:checked', checkForm).length > 0;
    $('#check-count').textContent = String(n);
    checkResult.classList.toggle('is-med', medical);
    if (medical) checkMessage.innerHTML = MESSAGES.medical;
    else if (n === 0) checkMessage.innerHTML = MESSAGES.none;
    else if (n <= 2) checkMessage.innerHTML = MESSAGES.few(n);
    else if (n <= 5) checkMessage.innerHTML = MESSAGES.some(n);
    else checkMessage.innerHTML = MESSAGES.many(n);
  }
  checkForm.addEventListener('change', updateCheck);
  updateCheck(); // 戻るボタンで選択が復元されたときにも結果を合わせる

  /* ---------------------------------------------------------
     追従ボタン：ファーストビューのボタンが見えなくなったら表示、料金欄と締めでは隠す
     --------------------------------------------------------- */
  const sticky = $('#sticky-cta');
  const stickyLink = $('a', sticky);
  if ('IntersectionObserver' in window) {
    const watched = [$('#hero-cta'), $('#offer'), $('.dawn')];
    const visible = new Map();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => visible.set(e.target, e.isIntersecting));
      const heroCtaVisible = visible.get(watched[0]) !== false;
      const show = !heroCtaVisible && !visible.get(watched[1]) && !visible.get(watched[2]);
      sticky.classList.toggle('is-visible', show);
      sticky.setAttribute('aria-hidden', String(!show));
      stickyLink.tabIndex = show ? 0 : -1;
    });
    watched.forEach((el) => io.observe(el));
  }
})();
