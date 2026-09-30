/*
 * 現LP（https://www.meieki-dental.net/all_on_4_004/）への応急処置版を作る
 *   npm run build:hotfix
 * 入力：current-lp-hotfix/index.original.html（2026年9月30日に取得した現LPのHTML）
 * 出力：current-lp-hotfix/index.html（そのまま差し替えられるHTML）
 *
 * 修正は下の FIXES に書いた箇所だけ。見つからない／複数見つかる場合は停止する
 * （現LPが更新されていたら、index.original.html を取り直してから実行してください）。
 */
const fs = require('node:fs');
const path = require('node:path');

const DIR = path.join(__dirname, '..', 'current-lp-hotfix');
let html = fs.readFileSync(path.join(DIR, 'index.original.html'), 'utf8');

const RISKS = `
						<div class="note" style="margin-top:1.5em;line-height:1.8;">
							<p><strong>【治療に伴う主なリスク・副作用】</strong></p>
							<p>・外科手術を伴うため、術後に痛み・腫れ・内出血などが生じることがあります。<br>・骨の量や全身の状態によっては治療を受けられない場合や、追加の処置が必要になる場合があります。<br>・骨の状態などにより、手術当日に仮歯を装着できない場合があります。<br>・糖尿病などの全身疾患や喫煙は、治療の経過に影響する可能性があります。<br>・インプラント周囲炎を防ぐため、毎日のセルフケアと定期的なメンテナンスが必要です。<br>・静脈内鎮静法・全身麻酔では、まれに血圧の変動や呼吸抑制などが起こる可能性があります。</p>
						</div>`;

// [説明, 置き換え前, 置き換え後, 出現回数（既定1）]
const FIXES = [
  // --- 誤認のおそれがある表現（医療広告ガイドライン） ---
  ['説明文：1日で完了', '1日で完了するオールオンフォー(インプラント)治療', '手術当日に仮歯が入るオールオンフォー(インプラント)治療', 2],
  ['メニュー：解決', '<li><a href="#sec_intro">インプラント治療でお悩みを解決！</a></li>', '<li><a href="#sec_intro">インプラント治療でお悩みを改善</a></li>'],
  ['特長：寝ている間に治療完了', '<p class="txt">麻酔で寝ている間に治療完了！</p>', '<p class="txt">麻酔医の立ち会いで安心の手術</p>'],
  ['特長：キレイな歯を1日で', '<p class="txt">キレイな歯を1日でセット可能！</p>', '<p class="txt">当日に固定式の仮歯をセット</p>'],
  ['特長：他院より', '<p class="txt">他院より難症例のご紹介多数！</p>', '<p class="txt">他院で断られた方もぜひご相談</p>'],
  ['見出し：全て解決', 'これら全てのお悩みを<br><span class="bg">解決</span>できます！', 'これらのお悩みの<br><span class="bg">改善</span>を目指せます！'],
  ['一覧：治療可能', '<li>歯が残ってなくても<span class="blue">治療可能！</span></li>', '<li>歯が少なくても<span class="blue">ご相談OK！</span></li>'],
  ['一覧：寝ている間に完了', '<li><span class="blue">麻酔で寝ている間</span>に完了できる！</li>', '<li><span class="blue">麻酔医</span>の立ち会いで安心！</li>'],
  ['本文：大丈夫です', 'どのようなご状況であっても大丈夫です！', 'どのようなご状況でも、まずはご相談ください！'],
  ['プラン：たった1日', '<p class="lead tac">たった１日ですべて綺麗な歯に！</p>', '<p class="lead tac">手術当日に固定式の仮歯が入る！</p>'],
  ['見出し：たった一日で全ての歯', '<span class="yellow">たった一日</span>で<br>全ての歯を新しく<span class="yellow">治療</span>する', '<span class="yellow">手術当日</span>に<br>固定式の<span class="yellow">仮歯</span>が入る'],
  ['本文：骨造成が必要ない', '骨造成などの手術も必要ないため', '骨造成などの手術が不要な場合も多いため'],
  ['本文：治療費を最小限', '1回の手術で歯の状態を改善することができため、総合治療に比べて治療費を最小限にまで削減できます。', '1回の手術で歯の状態を改善できるため、総合治療に比べて治療費を抑えられます。'],
  ['本文：世界TOP・一番質が高い', 'ノーベルバイオケア社は<span class="blue">世界TOPブランド</span>でありインプラント治療のパイオニア企業です。当院では一番質が高い<span class="blue">「N1インプラント」</span>を導入しています。', 'ノーベルバイオケア社はインプラント治療のパイオニア企業です。当院では<span class="blue">「N1インプラント」</span>を導入しています。'],
  ['特長：眠っている間に終了', '<h3 class="ttl min tac">麻酔で眠っている間に終了</h3>', '<h3 class="ttl min tac">麻酔医の立ち会いで安心の手術</h3>'],
  ['見出し：激安インプラント', '<h3 class="ttl min tac">激安インプラントは大丈夫？</h3>', '<h3 class="ttl min tac">インプラントの医院選びで大切なこと</h3>'],
  ['麻酔医メッセージ：間違いなく素晴らしい（ご本人の了承を得てから公開）', '毎日インプラント手術があることにより当院のDr・スタッフの経験豊富な知識・技術力は間違いなく素晴らしいです。', ''],
  ['治療の流れ：いつも通りの食事', '仮歯装着後、いつも通りの食事や会話を楽しむことができます。', '仮歯装着後は、やわらかいお食事から始めていただけます。'],
  ['FAQ：生涯にわたって', '定期的にメンテナンスを受けていれば、生涯にわたってインプラントを使っていくことはできます。', '定期的にメンテナンスを受けていただくことで、長くお使いいただけます。'],
  ['医療費控除：実質1割', '（実質的に1割近く税金が控除されます。）', '（戻る金額は、所得や医療費の額によって異なります。）'],

  // --- 体験談・説明のない術前術後写真を非表示 ---
  ['患者さまの声を非表示', '<!-- sec_voice -->\n\t\t\t\t<section id="sec_voice">', '<!-- sec_voice 【応急処置】体験談は医療広告ガイドライン上掲載できないため非表示 -->\n\t\t\t\t<section id="sec_voice" hidden style="display:none">'],
  ['術前術後写真を非表示', '<div class="img _01">\n\t\t\t\t\t\t\t\t<img src="./assets/img/plan01_img01.png" alt="">\n\t\t\t\t\t\t\t</div>',
    '<!-- 【応急処置】術前術後写真は、治療内容・費用・期間・リスクを併記するまで非表示\n\t\t\t\t\t\t\t<div class="img _01">\n\t\t\t\t\t\t\t\t<img src="./assets/img/plan01_img01.png" alt="">\n\t\t\t\t\t\t\t</div> -->'],

  // --- 料金の税込表示・リスクの記載 ---
  ['税込表示：オールオンフォー', '<p class="price tac"><img src="./assets/img/price_txt01.svg" alt="1,750,000円(税別)"></p>', '<p class="price tac"><img src="./assets/img/price_txt01.svg" alt="1,750,000円(税別)"></p>\n\t\t\t\t\t\t\t\t<p class="txt tac" style="font-weight:bold;">税込 1,925,000円</p>'],
  ['税込表示：インプラント1本', '<p class="price tac"><img src="./assets/img/price_txt02.svg" alt="290,000円(税別)"></p>', '<p class="price tac"><img src="./assets/img/price_txt02.svg" alt="290,000円(税別)"></p>\n\t\t\t\t\t\t\t\t<p class="txt tac" style="font-weight:bold;">税込 319,000円</p>'],
  ['リスク・副作用を追記', '治療前に事前にご説明させていただいております。</p>', '治療前に事前にご説明させていただいております。</p>' + RISKS],

  // --- 誤字・文字化け ---
  ['文字化け：$301C', '約30分$301C3時間', '約30分〜3時間'],
  ['誤字：生入', 'インプラント生入', 'インプラント埋入'],
  ['誤字：会わせて', 'ご都合に会わせて', 'ご都合に合わせて'],
  ['誤字：縮小', '治療期間を大幅に縮小できる', '治療期間を大幅に短縮できる'],
];

const report = [];
for (const [label, from, to, times = 1] of FIXES) {
  const count = html.split(from).length - 1;
  if (count !== times) {
    console.error(`停止：「${label}」の置き換え前の文字列が ${count} 件見つかりました（想定 ${times} 件）`);
    process.exit(1);
  }
  html = html.split(from).join(to);
  report.push(`- ${label}`);
}
fs.writeFileSync(path.join(DIR, 'index.html'), html);
console.log(`wrote current-lp-hotfix/index.html（${FIXES.length}か所を修正）`);
console.log(report.join('\n'));
