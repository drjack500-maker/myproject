/*
 * スライドを描く。build-video.js が window.renderSlide(...) を呼んで1枚ずつ撮影する。
 *   renderSlide({ v, show, sub, step, practice })
 *     v：scenes.js の画面の指定 / show：出す項目の数 / sub：字幕 / step：0=冒頭 1〜5=ステップ 6=まとめ
 *     practice：{ left, total }（トレーニングを一緒にやる時間のカウントダウン）
 *   renderThumb()：YouTube のサムネイル（1280×720）
 */
(function () {
  const D = window.DIAGRAMS;
  const STEP_NAMES = ['', 'いびきのメカニズム', 'いびきのタイプ', '口腔トレーニング', '寝る前の習慣', '健康リスク'];
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const src = (s) => (s.startsWith('video:') ? `img/${s.slice(6)}` : `../ibiki-lp/booklet/img/${s.slice(8)}`);
  const vis = (i, show) => (show === undefined || i < show ? '' : 'dim');
  const ic = (name, size = 40) => D.icon(name, 'currentColor', size);

  function bar(step, night) {
    let chip;
    if (step >= 1 && step <= 5) chip = `<b>STEP ${step}</b>${STEP_NAMES[step]}`;
    else if (step === 6) chip = '<b>まとめ</b>今日からできること';
    else chip = '歯科医師ドクターKの<b>いびき改善 5ステップ</b>';
    const dots = [1, 2, 3, 4, 5].map((n) => `<span class="${n === step ? 'now' : n < step ? 'done' : ''}">${n}</span>`).join('');
    return `<div class="bar"><span class="chip">${chip}</span><div class="dots">${dots}</div></div>`;
  }
  const subBand = (sub) => `<div class="sub"><p>${esc(sub)}</p></div>`;
  const list = (items, show, cls = 'check', icon = 'check', offset = 0) =>
    `<ul class="list ${cls}">${items.map((t, i) => `<li class="${vis(i + offset, show)}"><span class="ic">${ic(icon, 40)}</span><span>${esc(t)}</span></li>`).join('')}</ul>`;

  const L = {};

  L.hook = (v) => `<div class="hook-img" style="background-image:url('${src(v.img)}')"></div>
<div class="hook-text"><p class="t">${esc(v.title[0]).replace('「うるさい」', '<br><em>「うるさい」</em>')}<br>${esc(v.title[1])}</p><p class="s">${esc(v.sub)}</p><p class="n">${esc(v.note)}</p></div>`;

  L.profile = (v, show) => `<div class="content">
<div class="profile">
  <div class="who"><div class="mono">K</div><p class="r">${esc(v.role)}</p><p class="n">${esc(v.name)}</p><p class="g">「${esc(v.tagline)}」</p></div>
  <div class="col">${list(v.items, show, 'check', 'check')}</div>
</div></div>`;

  L.agenda = (v, show) => `<div class="content"><h2 class="h">${esc(v.title)}</h2>
<ol class="agenda ${v.small ? 'small' : ''}">${v.items.map(([t, d], i) => `<li class="${vis(i, show)}"><span class="n"><b>${i + 1}</b></span><div><p class="t">${esc(t)}</p>${d ? `<p class="d">${esc(d)}</p>` : ''}</div></li>`).join('')}</ol></div>`;

  L.chapter = (v) => `<div class="stars"></div><div class="moon"></div>
<div class="chapter"><p class="step">STEP ${v.step}</p><div class="line"></div><h2 class="t">${esc(v.title)}</h2></div>`;

  L.airway = (v) => `<div class="content"><div><h2 class="h">${esc(v.title)}</h2><p class="cap">${esc(v.caption)}</p></div><div class="fig">${D.airway(v.state)}</div></div>`;

  L.hose = (v) => `<div class="content"><h2 class="h">${esc(v.title)}</h2><div class="fig">${D.hose()}</div><p class="note">${esc(v.caption)}</p></div>`;

  L.cards = (v, show) => `<div class="content"><h2 class="h">${esc(v.title)}</h2>
<div class="cards">${v.items.map(([i, t, d], n) => `<div class="card ${vis(n, show)}"><span class="i">${ic(i, 84)}</span><p class="k">理由 ${n + 1}</p><p class="t">${esc(t)}</p><p class="d">${esc(d)}</p></div>`).join('')}</div></div>`;

  L.point = (v) => `<div class="content"><div class="row">
<div class="panel" style="width:820px;height:600px"><img src="${src(v.img)}" alt=""></div>
<div class="col grow"><p class="kicker">${esc(v.kicker)}</p><h2 class="h">${esc(v.title)}</h2><p class="note">${esc(v.text)}</p></div></div></div>`;

  L.types = (v) => `<div class="content"><h2 class="h">${esc(v.title)}</h2>
<div class="cards three">${v.items.map(([i, t], n) => `<div class="card" style="align-items:center;justify-content:center"><span class="i">${ic(i, 84)}</span><p class="k">タイプ ${n + 1}</p><p class="t">${esc(t)}</p></div>`).join('')}</div></div>`;

  L.check = (v, show) => `<div class="content">
<div class="ex-head"><span class="badge">タイプ ${v.no}</span><h2 class="h">${esc(v.title)}</h2></div>
<div class="row">
  <div class="panel" style="width:700px;height:560px;flex:none;${v.diagram ? 'background:#fff;display:grid;place-items:center' : ''}">${v.img ? `<img src="${src(v.img)}" alt="">` : D.airway(v.diagram, { labels: false })}</div>
  <div class="col grow">${list(v.items, show)}<p class="note ${vis(v.items.length, show)}">${esc(v.note)}</p></div>
</div></div>`;

  L.overlap = (v) => `<div class="content"><h2 class="h">${esc(v.title)}</h2><div class="row"><div class="fig" style="height:100%">${D.venn(v.items.map((x) => x[1]))}</div>
<div class="col" style="width:640px"><p class="note">${esc(v.note)}</p></div></div></div>`;

  L.illust = (v, show) => `<div class="content"><div class="row">
<div class="panel" style="width:760px;height:640px;flex:none"><img src="${src(v.img)}" alt=""></div>
<div class="col grow"><p class="kicker">${esc(v.kicker)}</p><h2 class="h">${esc(v.title)}</h2>${list(v.items, show, 'check', 'check')}</div></div></div>`;

  L.warn = (v, show) => `<div class="content"><h2 class="h" style="color:var(--warn-ink)">${esc(v.title)}</h2>
<div class="fig">${D.apnea()}</div><p class="note warn">${esc(v.note)}</p></div>`;

  L.stat = (v) => `<div class="content"><div class="row">
<div class="col grow"><p class="kicker">${esc(v.kicker)}</p><p class="big">${esc(v.big)}</p><p class="big-unit">${esc(v.unit)}</p><p class="cap">${esc(v.text)}</p></div>
<div class="panel" style="width:820px;height:352px;flex:none"><img src="${src(v.img)}" alt=""></div></div></div>`;

  function exVisual(v) {
    if (v.img) return `<div class="panel" style="width:640px;height:640px;flex:none"><img src="${src(v.img)}" alt=""></div>`;
    if (v.diagram === 'spot') return `<div class="panel" style="width:760px;height:500px;flex:none;display:grid;place-items:center">${D.airway('spot', { crop: true })}</div>`;
    if (v.diagram === 'palate') return `<div class="panel" style="width:820px;height:380px;flex:none;padding:10px">${D.palate()}</div>`;
    if (v.vowels) return `<div class="col" style="width:820px;flex:none;gap:18px"><div class="panel" style="height:300px"><img src="${src('booklet:p11-2.jpg')}" alt="" style="object-position:center 30%"></div><div class="panel" style="height:250px;padding:0 10px">${D.vowels()}</div></div>`;
    return '';
  }
  L.exercise = (v, show) => `<div class="content">
<div class="ex-head"><span class="badge">トレーニング ${v.no}</span><h2 class="h">${esc(v.title)}</h2></div>
<div class="row">${exVisual(v)}
<div class="col grow"><ol class="steps">${v.steps.map((t, i) => `<li class="${vis(i, show)}"><span class="num">${i + 1}</span><span>${esc(t)}</span></li>`).join('')}</ol>
<p class="count ${vis(v.steps.length, show)}">${esc(v.count)}</p></div></div></div>`;

  L.routine = (v, show) => `<div class="content"><h2 class="h">${esc(v.title)}</h2><div class="routine">
<ol class="rt">${v.items.map(([t, c], i) => `<li><span class="num">${i + 1}</span><span>${esc(t)}</span><span class="c">${esc(c)}</span></li>`).join('')}</ol>
<ul class="tips">${v.tips.map((t, i) => `<li class="${vis(i, show)}"><span style="color:var(--indigo)">${ic(['clock', 'check', 'heart'][i], 48)}</span>${esc(t)}</li>`).join('')}</ul></div></div>`;

  L.pillow = (v, show) => `<div class="content"><div class="ex-head"><span class="badge">ポイント ${v.no}</span><h2 class="h">${esc(v.title)}</h2></div>
<div class="fig">${D.pillow(Math.max(show, 0))}</div><p class="note ${vis(2, show)}">${esc(v.note)}</p></div>`;

  L.habit = (v, show) => `<div class="content"><div class="ex-head"><span class="badge">ポイント ${v.no}</span><h2 class="h">${esc(v.title)}</h2></div>
<div class="row"><div class="panel" style="width:760px;height:560px;flex:none"><img src="${src(v.img)}" alt=""></div>
<div class="col grow">${list(v.items, show, 'check', 'check')}</div></div></div>`;

  L.humid = (v, show) => `<div class="content"><div class="ex-head"><span class="badge">ポイント ${v.no}</span><h2 class="h">${esc(v.title)}</h2></div>
<div class="row"><div class="drop">${D.icon('drop', '#c8d7f3', 440).replace('stroke-width="4.5"', 'stroke-width="2.5"').replace('fill="#c8d7f3"', 'fill="#e6eefb"')}<span class="v">${esc(v.big)}</span><span class="u">${esc(v.unit)}</span></div>
<div class="col grow">${list(v.items, show, 'check', 'check')}</div></div></div>`;

  L.apnea = (v) => `<div class="content"><div class="row">
<div class="panel" style="width:760px;height:640px;flex:none;display:grid;place-items:center">${D.airway('narrow', { labels: false })}</div>
<div class="col grow"><p class="kicker" style="color:var(--warn-ink);background:var(--warn-bg)">いびきの陰に隠れていることがある病気</p><h2 class="h" style="font-size:84px">${esc(v.title)}</h2><p class="note warn">${esc(v.text)}</p></div></div></div>`;

  L.risks = (v, show) => `<div class="content"><h2 class="h">${esc(v.title)}</h2>
<div class="cards">${v.items.map(([i, t], n) => `<div class="card warn ${vis(n, show)}" style="align-items:center;justify-content:center"><span class="i">${ic(i, 84)}</span><p class="t">${esc(t)}</p></div>`).join('')}</div>
<p class="cap" style="font-size:30px">※睡眠時無呼吸症候群と関係が指摘されているもの。いびきのある人すべてに起きるわけではありません。</p></div>`;

  L.signs = (v, show) => `<div class="content"><h2 class="h" style="color:var(--warn-ink)">${esc(v.title)}</h2>
<div class="row" style="align-items:flex-start">${list(v.items, show, 'warn', 'check')}</div></div>`;

  L.summary = (v, show) => `<div class="content"><h2 class="h">${esc(v.title)}</h2>
<ul class="list">${v.items.map((t, i) => `<li class="${vis(i, show)}"><span class="num">${i + 1}</span><span>${esc(t)}</span></li>`).join('')}</ul></div>`;

  L.cta = (v) => `<div class="stars"></div>
<div class="cta"><p class="k">動画を見てくださった方へ</p><h2 class="t">${esc(v.title)}</h2><p class="x">${esc(v.text)}</p>
<span class="btn">${D.icon('line', '#fff', 64)}${esc(v.button)}</span><p class="w">▼ ${esc(v.where)}</p></div>`;

  L.ending = (v) => `<div class="stars"></div>
<div class="ending"><div class="panel"><img src="${src(v.img)}" alt=""></div>
<div><p class="t">${esc(v.title)}</p><p class="n">${esc(v.name)}</p><p class="d">※この動画は一般的な情報です。診断や治療は医療機関で受けてください。<br>※トレーニングや習慣の効果には個人差があります。<br>※イラストはイメージです。</p></div></div>`;

  function practiceBox(p) {
    const r = 50, c = 2 * Math.PI * r, frac = p.left / p.total;
    return `<div class="practice"><svg class="ring" viewBox="0 0 120 120"><circle cx="60" cy="60" r="${r}" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="10"/><circle cx="60" cy="60" r="${r}" fill="none" stroke="#f2d59b" stroke-width="10" stroke-linecap="round" stroke-dasharray="${(c * frac).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 60 60)"/><text x="60" y="76" font-size="46" font-weight="700" fill="#fff" text-anchor="middle">${p.left}</text></svg><span class="l">一緒にやってみましょう</span></div>`;
  }

  const NIGHT = new Set(['hook', 'chapter', 'cta', 'ending']);
  window.renderSlide = function ({ v, show, sub, step, practice }) {
    const stage = document.getElementById('stage');
    const night = NIGHT.has(v.layout);
    stage.className = `stage ${night ? 'night' : ''}`;
    const body = (L[v.layout] || (() => `<div class="content"><h2 class="h">未対応：${esc(v.layout)}</h2></div>`))(v, show);
    const head = v.layout === 'hook' || v.layout === 'chapter' || v.layout === 'cta' || v.layout === 'ending' ? '' : bar(step, night);
    stage.innerHTML = head + body + (practice ? practiceBox(practice) : '') + (sub ? subBand(sub) : '');
    return Promise.all([...stage.querySelectorAll('img')].map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; }))));
  };

  window.renderThumb = function (v) {
    document.documentElement.style.width = document.body.style.width = '1280px';
    document.documentElement.style.height = document.body.style.height = '720px';
    const stage = document.getElementById('stage');
    stage.className = 'stage night';
    stage.style.width = '1280px'; stage.style.height = '720px';
    stage.innerHTML = `<div class="thumb"><div class="hook-img" style="background-image:url('${src(v.img)}')"></div>
<div class="tt"><p class="a">${esc(v.badge)}</p><p class="b">${v.title}</p><p class="c">${esc(v.sub)}</p></div></div>`;
    return Promise.all([...stage.querySelectorAll('img')].map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; }))));
  };
})();
