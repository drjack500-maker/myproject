/*
 * スライドを描く。build-video-allon4.js が window.renderSlide(...) を呼んで1枚ずつ撮影する。
 *   renderSlide({ v, show, sub, step })
 *     v：scenes.js の画面の指定 / show：出す項目の数 / sub：字幕 / step：0=冒頭 1〜5=ステップ 6=まとめ
 *   renderThumb()：YouTube のサムネイル（1280×720）
 */
(function () {
  const D = window.DIAGRAMS;
  const STEP_NAMES = ['', 'オールオンフォーとは', '入れ歯との違い', '当日に仮の歯が入るしくみ', '痛み・年齢・持病', '費用・期間・リスク'];
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const src = (s) => (s.startsWith('lp:') ? `../lp/assets/img/${s.slice(3)}` : `img/${s}`);
  const vis = (i, show) => (show === undefined || i < show ? '' : 'dim');
  const ic = (name, size = 40) => D.icon(name, 'currentColor', size);
  const LEGAL = '<div class="legal"><span>※自由診療（保険適用外）</span><span>※治療の適応・効果には個人差があります</span><span>※イラストはイメージです</span></div>';

  function bar(step) {
    let chip;
    if (step >= 1 && step <= 5) chip = `<b>STEP ${step}</b>${STEP_NAMES[step]}`;
    else if (step === 6) chip = '<b>まとめ</b>今日のポイント';
    else chip = '名駅歯科クリニックの<b>オールオンフォー講座</b>';
    const dots = [1, 2, 3, 4, 5].map((n) => `<span class="${n === step ? 'now' : n < step ? 'done' : ''}">${n}</span>`).join('');
    return `<div class="bar"><span class="chip">${chip}</span><div class="dots">${dots}</div></div>`;
  }
  const subBand = (sub) => `<div class="sub"><p>${esc(sub)}</p></div>`;
  const list = (items, show, cls = '', icon = 'check') =>
    `<ul class="list ${cls}">${items.map((t, i) => `<li class="${vis(i, show)}"><span class="ic">${ic(icon, 36)}</span><span>${esc(t)}</span></li>`).join('')}</ul>`;

  const L = {};

  L.hook = (v) => `<div class="hook-img" style="background-image:url('${src(v.img)}')"></div>
<div class="hook-text"><p class="t">${esc(v.title[0])}<br><em>${esc(v.title[1])}</em></p><p class="s">${esc(v.sub)}</p><p class="n">${esc(v.note)}</p></div>`;

  L.profile = (v, show) => `<div class="content">
<div class="profile">
  <div class="who"><div class="photo"><img src="${src(v.photo)}" alt=""></div><p class="r">${esc(v.role)}</p><p class="n">${esc(v.name)}</p><p class="g">${esc(v.clinic)}</p></div>
  <div class="col">${list(v.items, show)}</div>
</div></div>`;

  L.intro = (v, show) => `<div class="deep"></div>
<div class="intro"><p class="k">${esc(v.kicker)}</p><h2 class="t ${vis(0, show)}">${esc(v.title)}</h2><p class="e ${vis(0, show)}">${esc(v.en)}</p><p class="x ${vis(0, show)}">${esc(v.text)}</p></div>`;

  L.agenda = (v, show) => `<div class="content"><h2 class="h">${esc(v.title)}</h2>
<ol class="agenda">${v.items.map(([t, d], i) => `<li class="${vis(i, show)}"><span class="n">${i + 1}</span><div><p class="t">${esc(t)}</p>${d ? `<p class="d">${esc(d)}</p>` : ''}</div></li>`).join('')}</ol></div>`;

  L.chapter = (v) => `<div class="deep"></div>
<div class="chapter"><p class="step">STEP ${v.step}</p><div class="line"></div><h2 class="t">${esc(v.title)}</h2></div>`;

  L.named = (v, show) => `<div class="content"><div class="named">
<div class="col"><p class="en">${esc(v.en)}</p><p class="ja">${esc(v.ja)}</p><p class="note ${vis(2, show)}" style="margin-top:20px;display:flex;gap:18px;align-items:center"><span style="flex:none">${ic('implant', 64)}</span><span>${esc(v.caption)}</span></p></div>
<div class="diagram ${vis(1, show)}">${D.jaw({ implants: D.FOUR('#0e5a63', '#0e5a63') })}</div>
</div></div>`;

  L.count = (v, show) => `<div class="content"><h2 class="h">${esc(v.title)}</h2><div class="count">
<div class="box ${vis(0, show)}"><p class="k">${esc(v.left[0])}</p><p class="v">${esc(v.left[1])}</p><div class="diagram" style="padding:14px;border:0;box-shadow:none">${D.jaw({ implants: D.MANY() })}</div></div>
<div class="box hi ${vis(1, show)}"><p class="k">${esc(v.right[0])}</p><p class="v">${esc(v.right[1])}</p><div class="diagram" style="padding:14px;border:0;box-shadow:none">${D.jaw({ implants: D.FOUR('#0e5a63', '#0e5a63') })}</div></div>
</div></div>`;

  L.jaw = (v, show) => {
    const angle = v.mode === 'angle';
    const items = angle
      ? ['前の2本：まっすぐに', '奥の2本：斜めに傾けて', '骨の少ない部分・神経を避け、奥歯まで支える']
      : ['片あご分の歯を、橋のように一体にして固定', '噛む力を、4本に分散', '本数が少ないぶん、手術の負担や費用をおさえやすい'];
    const svg = angle
      ? D.jaw({ implants: D.FOUR(show >= 2 ? '#b83d0b' : null, show === 1 ? '#0e5a63' : null), nerve: true, nerveHl: show >= 3 })
      : D.jaw({ implants: D.FOUR(), bridge: show >= 1, force: show >= 2 });
    return `<div class="content"><div class="ex-head"><span class="badge">${esc(v.badge)}</span><h2 class="h">${esc(v.title)}</h2></div>
<div class="row"><div class="diagram" style="width:1000px;flex:none">${svg}${angle ? '<p class="cap" style="font-size:28px;margin-top:6px">黄色の点線＝神経</p>' : ''}</div>
<div class="col grow">${list(items, show, 'small')}</div></div></div>`;
  };

  L.point = (v) => `<div class="content"><div class="row">
<div class="panel" style="width:800px;height:600px"><img src="${src(v.img)}" alt=""></div>
<div class="col grow"><p class="kicker warn">${esc(v.kicker)}</p><h2 class="h" style="font-size:64px">${esc(v.title)}</h2><p class="note">${esc(v.text)}</p></div></div></div>`;

  const CMP = {
    head: ['総入れ歯（保険）', '1本ずつのインプラント', 'オールオンフォー'],
    rows: [
      ['歯の固定', '取り外し式（歯ぐきに乗せる）', '固定式', '固定式'],
      ['噛み心地', 'ずれやすく、硬いものは噛みにくい', 'しっかり噛める', 'しっかり噛める'],
      ['本数（片あご）', 'なし', '8〜12本程度', '4本（状態により6本）'],
      ['費用', '保険適用で安価', '本数が多く、高額になりやすい', '本数が少ないぶん、おさえやすい'],
      ['注意点', '調整や作り直しが必要になることがある', '手術の回数・期間が長くなることがある', '外科手術が必要。精密検査で適応を診断'],
    ],
  };
  L.compare = (v) => {
    const c = (i) => (i === v.focus ? 'on' : 'off');
    return `<div class="content" style="gap:18px"><h2 class="h" style="font-size:60px">入れ歯・インプラントとの違い</h2>
<table class="cmp"><thead><tr><th></th>${CMP.head.map((h, i) => `<th class="${c(i)}">${esc(h)}</th>`).join('')}</tr></thead>
<tbody>${CMP.rows.map((r) => `<tr><th>${esc(r[0])}</th>${r.slice(1).map((d, i) => `<td class="${c(i)}">${esc(d)}</td>`).join('')}</tr>`).join('')}</tbody></table>
<p class="cap" style="font-size:26px">※いずれの治療法にもメリット・デメリットがあります。お口の状態に合った方法をご提案します。</p></div>`;
  };

  L.illust = (v, show) => `<div class="content"><div class="row">
<div class="panel" style="width:780px;height:582px"><img src="${src(v.img)}" alt=""></div>
<div class="col grow"><p class="kicker">${esc(v.kicker)}</p><h2 class="h" style="font-size:64px">${esc(v.title)}</h2>${list(v.items, show)}</div></div></div>`;

  L.cards = (v, show) => `<div class="content"><h2 class="h">${esc(v.title)}</h2>
<div class="cards">${v.items.map(([i, t, d], n) => `<div class="card ${vis(n, show)}"><span class="i">${ic(i, 84)}</span><p class="t">${esc(t)}</p><p class="d">${esc(d)}</p></div>`).join('')}</div></div>`;

  L.voices = (v, show) => `<div class="content" style="gap:56px"><h2 class="h">${esc(v.title)}</h2>
<ul class="voices">${v.items.map((t, i) => `<li class="${vis(i, show)}">「${esc(t)}」</li>`).join('')}</ul>
<p class="note ${vis(3, show)}" style="margin-top:30px;font-size:44px;text-align:center">${esc(v.note)}</p></div>`;

  L.truth = (v, show) => `<div class="content" style="gap:34px">
<div class="course"><span class="kicker">講座のタイトル</span><p class="q">${esc(v.course)}</p></div>
<p class="h" style="font-size:56px">正確に言うと…</p>
${list(v.items, show)}
<p class="answer ${vis(2, show)}">＝ ${esc(v.answer)}</p></div>`;

  L.timeline = (v, show) => `<div class="content"><h2 class="h">手術の日から、固定式の歯で過ごせる理由</h2>
<div class="tl">
  <div class="r ${vis(0, show)}"><p class="l">一般的な<br>インプラント</p><div class="seq"><div class="s">埋めこむ</div><div class="ar">▶</div><div class="s gap">骨とくっつくまで<br>数か月待つ</div><div class="ar">▶</div><div class="s fin">歯が入る</div></div></div>
  <div class="r"><p class="l ${vis(1, show)}" style="color:var(--primary)">オールオンフォー</p><div class="seq"><div class="s tmp ${vis(1, show)}">埋めこむ＋<br>当日に仮の歯</div><div class="ar ${vis(2, show)}">▶</div><div class="s tmp ${vis(2, show)}">治癒の期間も<br>固定式の仮の歯で</div><div class="ar ${vis(2, show)}">▶</div><div class="s fin ${vis(2, show)}">最終的な歯</div></div></div>
</div>
<p class="note warn ${vis(3, show)}" style="font-size:32px">※骨の状態などにより、手術当日に仮の歯を装着できない場合があります</p></div>`;

  const FLOW = [
    ['chat', '無料カウンセリング\nCT撮影', '骨の量や質、神経・血管の位置を確認'],
    ['doc', '治療計画\n総額のご説明', 'ご納得いただいてから手術日を決定'],
    ['implant', '手術\n当日に仮の歯', '抜歯・埋めこみ・仮の歯を同じ日に'],
    ['soup', '治癒期間', '固定式の仮の歯で過ごす。やわらかい食事から'],
    ['tooth', '最終的な歯', '型取りから約2週間で装着'],
    ['shield', '定期\nメンテナンス', '半年に1度の検診で10年保証'],
  ];
  L.flow = (v, show) => `<div class="content"><h2 class="h">${esc(v.title)}</h2>
<ol class="flow">${FLOW.map(([i, t, d], n) => `<li class="${n + 1 === show ? 'now' : n + 1 > show ? 'later' : ''}"><span class="n">${n + 1}</span><span class="i">${ic(i, 70)}</span><p class="t">${esc(t)}</p><p class="d">${esc(d)}</p></li>`).join('')}</ol>
${v.soft ? `<p class="note" style="font-size:34px;${show === 3 ? '' : 'visibility:hidden'}">${esc(v.soft)}</p>` : ''}</div>`;

  L.surgery = (v, show) => `<div class="content"><h2 class="h">${esc(v.title)}</h2><div class="row" style="align-items:flex-start">
<div class="col" style="width:600px;flex:none;gap:12px"><div class="panel" style="width:600px;height:450px"><img src="${src(v.img)}" alt=""></div><p class="cap" style="font-size:28px">当院のインプラント専用オペ室</p></div>
<div class="col grow">${list(v.items, show, 'small')}</div></div></div>`;

  L.sedation = (v, show) => `<div class="content"><h2 class="h">${esc(v.title)}</h2><div class="row" style="align-items:flex-start">
<div class="panel" style="width:680px;height:508px"><img src="${src(v.img)}" alt=""></div>
<div class="col grow">${list(v.items, show, 'small')}</div></div></div>`;

  L.age = (v, show) => `<div class="content" style="gap:44px"><h2 class="h ${vis(0, show)}" style="font-size:64px">${esc(v.title)}</h2>
<ul class="ages">${v.ages.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
<p class="note ${vis(1, show)}" style="font-size:44px">${esc(v.note)}</p>
<p class="cap ${vis(2, show)}">まずは、お口と全身の状態を確かめるところから始めます。ご家族と一緒のご相談も歓迎です。</p></div>`;

  L.zygoma = (v, show) => `<div class="content"><h2 class="h">${esc(v.title)}</h2><div class="row" style="align-items:flex-start">
<div class="diagram" style="width:900px;flex:none;padding:10px 20px">${D.zygoma(Math.max(0, Math.min(show, 2)))}</div>
<div class="col grow">${list(v.items, show, 'small')}<p class="note warn ${vis(2, show)}" style="font-size:30px">${esc(v.note)}</p></div></div></div>`;

  L.price = (v, show) => `<div class="content"><h2 class="h">費用について</h2><div class="price">
<div class="pricebox"><p class="l">${esc(v.label)}</p><p class="v">${esc(v.price)}<small>${esc(v.tax)}</small></p><p class="x">${esc(v.ex)}</p><p class="f">自由診療（公的医療保険の適用外）</p></div>
<div class="col">${list(v.items, show, 'small')}</div></div></div>`;

  L.risks = (v, show) => `<div class="content" style="gap:22px"><h2 class="h" style="font-size:60px;color:var(--warn-ink)">${esc(v.title)}</h2>
<ul class="list warn small" style="gap:16px">${v.items.map((t, i) => `<li class="${vis(i, show)}" style="font-size:36px"><span class="ic">${ic('check', 32)}</span><span>${esc(t)}</span></li>`).join('')}</ul></div>`;

  L.warranty = (v) => `<div class="content"><div class="warranty">
<div class="seal"><span style="color:var(--moon)">${ic('shield', 110)}</span><p class="b">${esc(v.big)}</p><p class="u">${esc(v.unit)}</p></div>
<div class="col"><h2 class="h" style="font-size:64px">治療後も安心の\n10年保証</h2><p class="note" style="font-size:42px">${esc(v.text)}</p><p class="cap">${esc(v.note)}</p></div></div></div>`;

  L.summary = (v, show) => `<div class="content"><h2 class="h">${esc(v.title)}</h2>
<ul class="list">${v.items.map((t, i) => `<li class="${vis(i, show)}"><span class="num">${i + 1}</span><span>${esc(t)}</span></li>`).join('')}</ul></div>`;

  L.cta = (v) => `<div class="deep"></div>
<div class="cta"><p class="k">動画を見てくださった方へ</p><h2 class="t">${esc(v.title)}</h2><p class="x">${esc(v.text)}</p>
<div class="tags">${v.tags.map((t) => `<span>${esc(t)}</span>`).join('')}</div>
<span class="btn">${D.icon('line', '#fff', 64)}${esc(v.button)}</span><p class="w">▼ ${esc(v.where)}</p></div>`;

  L.ending = (v) => `<div class="deep plain"></div>
<div class="ending"><div class="panel"><img src="${src(v.img)}" alt=""></div>
<div><p class="t">${esc(v.title)}</p><p class="n">${esc(v.name)}</p><p class="d">※この動画は一般的な情報です。治療の適応は精密検査のうえで判断します。<br>※ナレーションは合成音声です。</p></div></div>`;

  const NIGHT = new Set(['hook', 'chapter', 'intro', 'cta', 'ending']);
  window.renderSlide = function ({ v, show, sub, step }) {
    const stage = document.getElementById('stage');
    const night = NIGHT.has(v.layout);
    stage.className = `stage ${night ? 'night' : ''}`;
    const body = (L[v.layout] || (() => `<div class="content"><h2 class="h">未対応：${esc(v.layout)}</h2></div>`))(v, show);
    const head = night ? '' : bar(step);
    stage.innerHTML = head + body + LEGAL + (sub ? subBand(sub) : '');
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
