/*
 * Obsidian に入れるノート一式を作る
 *   npm run build:obsidian → dist/obsidian/いびき改善プログラム/ と、同じ中身の zip（動画は大きいので zip には入れない）
 *     いびき改善プログラム.md      目次（全体の流れと各ノートへのリンク）
 *     LP・小冊子・プレゼントページ・12週間コース・販売導線の設計書・YouTube動画 のノート
 *     添付/                        PDF・サムネイル・動画（ノートに埋めこんで表示）
 * 先に npm run build:bundle と npm run build:video を実行しておくこと。
 * 使い方：フォルダごと（または zip を展開して）Obsidian の保管庫に入れる。動画は 添付/ に入れる。
 */
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'dist', 'obsidian');
const VAULT = path.join(OUT, 'いびき改善プログラム');
const ATT = path.join(VAULT, '添付');
const BUNDLE = path.join(ROOT, 'dist', 'ibiki-bundle');
const VIDEO = path.join(ROOT, 'dist', 'video');
const VIDEO_NAME = 'いびき改善5ステップ_ドクターK.mp4';
const today = new Date().toISOString().slice(0, 10);

const scenes = require('../video/scenes.js');
const timeline = JSON.parse(fs.readFileSync(path.join(VIDEO, 'timeline.json'), 'utf8'));
const youtube = fs.readFileSync(path.join(VIDEO, 'youtube.txt'), 'utf8');
const clock = (sec) => { const s = Math.floor(sec); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const total = timeline.reduce((a, s) => a + s.dur, 0);
const cta = timeline.find((s) => s.id === 's40');

const front = (tags) => `---\ntags: [${tags.join(', ')}]\ncreated: ${today}\n---\n\n`;
const notes = {
  'いびき改善プログラム': `${front(['いびき改善', '目次'])}# いびき改善プログラム（静寂の夜メソッド）

自宅でできるいびき改善のオンライン講座。無料の小冊子と動画を入口に、自習版と12週間の個別フィードバックコースを販売する。

## 全体の流れ

\`\`\`
広告 → [[小冊子プレゼントページ]] → 公式LINE 7日間の記録チャレンジ（小冊子を配布）
     → [[YouTube動画 いびき改善5ステップ]]（約14分）／無料動画セミナー
     → [[12週間コース販売ページ]]（30万円・仮）の申込 → 受講可否をLINEで連絡 → 決済 → 受講開始
     申し込まなかった方 → [[LP 静寂の夜メソッド]]（自習版）
     受診の目安に当てはまった方 → 医療機関を案内（販売の案内は送らない）
\`\`\`

## ノート

- [[LP 静寂の夜メソッド]] … 自習版の販売ページ
- [[小冊子 私の眠りの記録]] … 無料のマンガ小冊子（A5・20ページ）
- [[小冊子プレゼントページ]] … 広告の受け皿。LINEの友だち追加へ
- [[12週間コース販売ページ]] … 30万円（仮）のコースと申込フォーム
- [[販売導線の設計書]] … LINE配信文・セミナー台本・運用・収支シミュレーター・法令チェック
- [[YouTube動画 いびき改善5ステップ]] … 講師ドクターKの動画（台本・概要欄・チャプター）

## 公開前に決めること・確かめること

- 商品の中身（担当スタッフ・動画・返信の期限）と価格・定員
- 公式LINEの友だち追加URL、申込フォームの送信先、決済サービス
- 特定商取引法の表記と個人情報の取り扱いの記入、専門家の確認
- 講師プロフィールの数字・実績が事実であること（医療広告ガイドラインにも注意）
- 動画の合成音声について、尾崎隆理事長ご本人の了承
`,
  'LP 静寂の夜メソッド': `${front(['いびき改善', 'LP'])}# LP 静寂の夜メソッド（自習版）

広告用のランディングページ。見出しはタイトルコンセプト10パターンを広告キーワードで出し分ける。

- ファーストビュー（夜）→ セルフチェック → いびきのしくみ → グッズ・医療との比較 → 3つの習慣 → 最初の7日間 → ご家族へ → 受講者の声（掲載例）→ 講師 → 料金 → FAQ → 受診の目安 → 締め
- 40〜70代が中心なので、本文は大きめ、ボタンは押しやすい大きさ、「文字を大きく」ボタンつき
- 無呼吸を疑うサインに当てはまると、先に医療機関を案内する

![[LP_静寂の夜メソッド.pdf]]

関連：[[いびき改善プログラム]]
`,
  '小冊子 私の眠りの記録': `${front(['いびき改善', '小冊子'])}# 小冊子「私の眠りの記録」

無料のマンガ小冊子（A5・20ページ）。夫の誠さん（58）と妻の由美子さん（55）、案内役のフクロウ。
「もう、別の部屋で寝て」と言われた夫婦が、7日間の記録でいびきと向き合う物語。裏表紙は無料動画セミナー（公式LINE）の案内。

![[小冊子_私の眠りの記録.pdf]]

関連：[[小冊子プレゼントページ]]・[[いびき改善プログラム]]
`,
  '小冊子プレゼントページ': `${front(['いびき改善', 'LP'])}# 小冊子プレゼントページ

広告の受け皿。公式LINEの友だち追加で [[小冊子 私の眠りの記録]] を受け取る。
LINEのURLは \`assets/js/funnel.js\` の \`CONFIG.lineUrl\` に設定する。

![[小冊子プレゼントページ.pdf]]

関連：[[いびき改善プログラム]]
`,
  '12週間コース販売ページ': `${front(['いびき改善', 'LP', '高単価'])}# 12週間コース販売ページ（仮の商品案）

- 静寂の夜メソッド 12週間コース。面談・通話なし、オンラインで完結
- 毎週：月曜に動画2本 → 毎日の記録と体操 → 金曜に録音の結果と体操の動画を提出 → 48時間以内に個別フィードバック（文字と短い動画）。質問はチャットで平日24時間以内に返信
- 300,000円（税込・仮）、月20名まで、14日間の全額返金
- 申込フォームに受講前チェック（無呼吸・日中の強い眠気・朝の頭痛のどれかに当てはまると送信できず、医療機関を案内）。申込の時点ではお金はかからない

![[12週間コース販売ページ.pdf]]

関連：[[販売導線の設計書]]・[[いびき改善プログラム]]
`,
  '販売導線の設計書': `${front(['いびき改善', '設計書'])}# 販売導線の設計書

小冊子から30万円の12週間コースへ、オンラインだけで販売する流れ。
全体の流れ、商品（仮）、LINE配信の全文（0〜15日目）、動画セミナーの台本、申込から受講開始までの運用と返信の例文、収支シミュレーター、法令・表現のチェック表、公開までにやること。

![[販売導線の設計書.pdf]]

関連：[[12週間コース販売ページ]]・[[いびき改善プログラム]]
`,
};

// 動画のノート：チャプター・LPでLINEボタンを出す時刻・台本・概要欄
let script = '';
for (const sc of timeline) {
  const s = scenes.find((x) => x.id === sc.id);
  if (s.chapter) script += `\n### ${clock(sc.start)} ${s.chapter}\n\n`;
  script += s.lines.map((l) => l.t).join('') + '\n\n';
}
notes['YouTube動画 いびき改善5ステップ'] = `${front(['いびき改善', '動画', 'YouTube'])}# YouTube動画「いびき改善 5ステップ」

- 長さ：${clock(total)}／1920×1080・字幕入り（字幕ファイル captions.ja.srt もあり）
- 話し手：現役歯科医師 ドクターK（ナレーションは尾崎隆理事長の声の合成音声）
- **LPで公式LINEのボタンを出す時刻：${clock(cta.start)}**（個別相談の案内が始まるところ）

![[${VIDEO_NAME}]]

![[thumbnail.jpg]]

## 台本
${script}
## タイトル案・概要欄・タグ

\`\`\`
${youtube.trim()}
\`\`\`

## 公開前に確かめること

- 講師プロフィール（3,000名以上・テレビ出演など）が事実で、根拠があること
- 合成音声での公開について、尾崎隆理事長ご本人の了承。YouTube の「改変または合成されたコンテンツ」にチェック
- 概要欄の【要設定】（公式LINEのURL）

関連：[[いびき改善プログラム]]・[[小冊子 私の眠りの記録]]
`;

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(ATT, { recursive: true });
for (const [name, body] of Object.entries(notes)) fs.writeFileSync(path.join(VAULT, `${name}.md`), body);
for (const f of fs.readdirSync(BUNDLE).filter((f) => f.endsWith('.pdf'))) fs.copyFileSync(path.join(BUNDLE, f), path.join(ATT, f));
fs.copyFileSync(path.join(VIDEO, 'thumbnail.jpg'), path.join(ATT, 'thumbnail.jpg'));
fs.copyFileSync(path.join(VIDEO, 'captions.ja.srt'), path.join(ATT, 'captions.ja.srt'));
fs.copyFileSync(path.join(VIDEO, VIDEO_NAME), path.join(ATT, VIDEO_NAME));
// zip（動画は除く。送れる大きさに収めるため）
const zip = path.join(OUT, 'いびき改善プログラム_Obsidian.zip');
execFileSync('zip', ['-qr', zip, 'いびき改善プログラム', '-x', `いびき改善プログラム/添付/${VIDEO_NAME}`], { cwd: OUT });
console.log(`wrote ${path.relative(ROOT, VAULT)}/ (${Object.keys(notes).length} notes) and ${path.relative(ROOT, zip)} (${(fs.statSync(zip).size / 1024 / 1024).toFixed(1)} MB)`);
