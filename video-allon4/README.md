# YouTube動画「オールオンフォー 15分講座」（約15分）

ステップメール講座「1日でインプラントによって歯が入る方法 オールオンフォー」の「▼動画はこちら」で見せる動画です。
名駅歯科クリニック 理事長 尾崎隆の一人称で、オールオンフォーのしくみ・入れ歯との違い・治療の流れ・不安への答え・費用とリスクを5つのステップで話します。
「いびき改善5ステップ」動画（ブランチ `claude/determined-hamilton-lnodkk` の `video/`）と同じ組み立て方です。原稿は [`docs/video/allon4-15min-narration.md`](../docs/video/allon4-15min-narration.md)。

```bash
npm run build:video:allon4   # → dist/video-allon4/
```

| できあがるファイル | 内容 |
|---|---|
| `オールオンフォー15分講座_尾崎隆.mp4` | 1920×1080・30fps・字幕入り |
| `captions.ja.srt` | 字幕ファイル（YouTube・Vimeo の字幕として登録できる） |
| `thumbnail.jpg` | サムネイル（1280×720） |
| `youtube.txt` | タイトル案・概要欄（チャプター・費用・リスク入り）・タグ。LPで公式LINEのボタンを出す時刻の目安も書いてある |
| `timeline.json` | 場面と字幕の時刻（確認用） |

## ファイル

```
video-allon4/
├── scenes.js       台本（ナレーション＝字幕）と画面の指定。36場面
├── readings.js     読み上げの読み（字幕はそのまま、音声だけ読みを直す）
├── narration.json  ナレーション音声（Higgsfield で生成した wav のURLと job ID）
├── align.json      字幕の切れ目（各場面の音声の何秒で次の行に切り替えるか）
├── slide.html      スライドの見た目（1920×1080。色はオールオン4のLPに合わせる）
├── slide.js        場面ごとの描き分け
├── diagrams.js     図（下あごの4本のインプラント・斜めの埋めこみと神経・噛む力の分散・上あごとザイゴマインプラント）
└── img/            この動画のために描いた絵（冒頭・カウンセリング・入れ歯・静脈内鎮静法・締め）
tools/build-video-allon4.js
tools/align-narration-allon4.py   字幕の切れ目を音声認識で合わせて align.json を作る
```

- 講師の写真と院内の写真は LP（`lp/assets/img/`）のものを使っています
- ナレーションは Higgsfield に登録された声（表示名「尾崎裕院長」＝尾崎隆理事長の声）で合成しました（いびき動画と同じ声）。音声認識で全場面の読みを確かめています
- 費用は LP と同じく「手術費用（片あご）1,925,000円（税込）」だけを表示しています

## 直すとき

- **台本を直す**：`scenes.js` の該当場面を直し、その場面だけ Higgsfield（seed_audio・同じ声・wav 48kHz）で音声を作り直して、`narration.json` の URL を差し替える。`dist/video-allon4-cache/` の同じ名前の wav を消してから `npm run build:video:allon4`。続けて `python3 tools/align-narration-allon4.py s05`（場面ID）で字幕の切れ目を合わせ直し、もう一度ビルド（`pip install faster-whisper pykakasi` が必要。align.json にない場面は無音の位置で合わせます）
- **読み違い**：`readings.js` に「字幕の表記 → 読み」を足して、その場面の音声を作り直す
- **見た目**：`slide.html` / `slide.js` / `diagrams.js` を直してビルド（音声はそのまま）

## 公開前に確認すること

- **合成音声であること**：尾崎隆理事長ご本人の了承のうえで公開してください（経歴の言い方「歯科医師になって30年以上、1990年代からはアメリカでも研修を重ね」を含む）。概要欄と最後の画面に「ナレーションは合成音声です」と入れています
- **個別相談**：LINEで申し込む「個別相談」が、院内の無料カウンセリング（CT撮影つき）と同じものか。オンラインで行う場合は、場面 s35 の「初回のご相談とCT撮影は、無料です。」を差し替える
- **公式LINEのURL**：`youtube.txt` の【要設定】に入れる
- **医療広告ガイドライン**：体験談・ビフォーアフター写真・最上級表現は使っていません。費用（税込）・治療期間・リスク・副作用を動画の中と概要欄で説明しています
