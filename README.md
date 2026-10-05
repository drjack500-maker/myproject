# オールオン4 LP 改善プロジェクト（名駅歯科クリニック・矯正歯科）

https://www.meieki-dental.net/all_on_4_004/ の予約（コンバージョン）を増やすための、改善提案と改善版LPです。

| 資料 | 内容 |
|---|---|
| [`current-lp-hotfix/`](current-lp-hotfix/) | **現LPの応急処置版**（体験談の非表示・表現の修正・税込表示・リスクの追記・誤字修正。新LPの公開まで差し替えて使える） |
| [`docs/current-lp-review.md`](docs/current-lp-review.md) | **現LPの診断レポート**（2026年9月30日確認。問題点・ガイドライン上のリスク・誤字・予約システムの離脱ポイント・応急処置） |
| [`docs/improvement-proposal.md`](docs/improvement-proposal.md) | 改善提案書（優先施策・チェックリスト・医療広告ガイドライン・A/Bテスト・公開前の確認事項） |
| [`docs/ad-copy.md`](docs/ad-copy.md) | **Google 広告の広告文**（見出しパターン別の広告グループ・キーワード・アセット・除外キーワード。広告エディタ用CSVつき） |
| [`docs/measurement-setup.md`](docs/measurement-setup.md) | 計測設定の手順（GTM／GA4／Google 広告、見出しの出し分け用URL） |
| [`server/gas/README.md`](server/gas/README.md) | 予約フォームの受信設定（Google スプレッドシートの予約台帳・通知メール・広告への成約データ連携） |
| [`docs/reception-manual.md`](docs/reception-manual.md) | 予約リクエストの受付対応マニュアル（電話のタイミング・トーク例・台帳の更新・リマインド） |
| [`docs/youtube-acquisition-plan.md`](docs/youtube-acquisition-plan.md) | **グループ院（アルティメイト栄歯科）の YouTube チャンネルからの集客プラン**（2026年10月5日時点の数字・問い合わせが少ない原因・優先順の施策・KPI・ガイドライン上の注意） |
| [`docs/youtube-templates.md`](docs/youtube-templates.md) | 上のプランの貼り付け用文面（固定コメント・説明欄・UTMつきURL・動画内の台本・LINE配信・新企画・YouTube 広告の設定・受付での聞き取り） |
| [`docs/youtube-video-texts.md`](docs/youtube-video-texts.md) | **動画11本それぞれの固定コメント・説明欄・終了画面の設定**（そのまま貼り付けられる完成版。`python3 tools/youtube-texts.py` で生成）と、直したいタイトル・サムネイル |
| [`docs/youtube-ads-plan.md`](docs/youtube-ads-plan.md) | **栄院の YouTube 広告の設定**（今の広告の実績と見直し、名古屋近郊に絞る2つのキャンペーン、広告文、院長の案内動画の台本、判断の基準） |
| [`youtube-assets/`](youtube-assets/) | **動画に入れる素材**：QRコード入りの終了画面・重ねるQRコード・電話番号の帯（テレビで見ている人向け。`npm run build:youtube-assets` で生成、QRコードの読み取りはテストで確認） |
| [`youtube-lp/`](youtube-lp/) | **栄院の「YouTube をご覧の方へ」ページ**（説明欄・固定コメント・YouTube 広告のリンク先。院長の北村が最初の画面に出て、動画・無料相談の流れ・費用・3ステップの予約フォームまでを1ページに。→ [下の説明](#youtube-をご覧の方向けページ栄院youtube-lp)） |

## ファイル構成

```
lp/                       ← 公開するのはこのフォルダの中身だけ
├── index.html            LP本体
├── thanks.html           予約完了ページ（コンバージョン計測）
├── privacy.html          予約フォームの個人情報の取り扱い
└── assets/
    ├── css/style.css
    ├── js/main.js        見出し出し分け・フォーム・シミュレーター・計測（設定は冒頭の CONFIG）
    └── img/              favicon.svg / apple-touch-icon.png / ogp.png
server/gas/               予約フォームの受信スクリプト（Google Apps Script）
docs/                     提案書・計測手順
tests/                    自動テスト（受信スクリプト・ブラウザ操作・アクセシビリティ）
tools/                    ローカル確認用サーバー、画像・プレビュー生成
```

LPはビルド不要の静的ファイルです（外部ライブラリなし。フォントのみ Google Fonts）。**`lp/` フォルダをそのままサーバーにアップロードすれば動きます。**

## 公開までの手順

1. **内容の確認**：料金・保証・医師情報などは現LP（2026年9月時点）に合わせてあります。残りの確認事項は [提案書「8. 公開前に医院で確認が必要な事項」](docs/improvement-proposal.md#8-公開前に医院で確認が必要な事項) を参照。HTML・JS内の `【要確認】` `【要更新】` `【要設定】` コメントも確認
2. **予約フォームの受け皿を設置**：予約はLP内の3ステップフォームで受け付けます。[`server/gas/README.md`](server/gas/README.md) の手順でスプレッドシート（予約台帳）を作り、発行されたURLを `lp/assets/js/main.js` の `CONFIG.formEndpoint` に設定
   - 未設定のまま公開すると、**フォームの代わりに「お電話でご予約ください」という案内を表示**します（予約が失われるのを防ぐため。手元の確認用サーバー以外はすべてこの動作）。手元の確認（localhost・ファイルを直接開いたとき）では、送信せずに完了ページへ進むデモ動作になります
   - 受付スタッフの対応手順は [`docs/reception-manual.md`](docs/reception-manual.md)
3. **LINE**：現LPと同じ L-Message の小冊子プレゼントURLを設定済み（`CONFIG.lineUrl`）。新LPの効果を分けて測る場合は新しい流入経路URLに差し替え
4. **休診日・予約枠**：`CONFIG.closedWeekdays` `CONFIG.holidays` `CONFIG.timeSlots` を実際の診療体制に合わせる（年末年始の休診日も追加）
5. **写真**：医師3名と院内の写真は現LPのものを使用しています。症例は `#cases` に写真と情報を入れてから `hidden` を外す
6. **計測**：現LPと同じ GTM（`GTM-TKQ2RFV`）を設定済みで、`meieki-dental.net` / `meieki-dental.com` でのみ読み込みます。予約完了の計測は [`docs/measurement-setup.md`](docs/measurement-setup.md) の手順で追加
7. **公開URL**：`index.html` の `og:url` `og:image` を実際の公開URLに合わせる
8. **公開後**：スマホでテスト予約を1件送り、台帳への記録・通知メール・完了ページ・GTMのタグ発火を確認

### 設定を main.js を触らずに変えたい場合

`index.html` の `main.js` 読み込みより前に、次のように書くと上書きできます。

```html
<script>window.LP_CONFIG = { formEndpoint: 'https://script.google.com/macros/s/XXXX/exec', lineUrl: 'https://lin.ee/XXXX' };</script>
<script src="assets/js/main.js" defer></script>
```

### 価格を変更するとき

価格はFV・特長・費用・FAQ・見出しパターン（`main.js` の `HEADLINES.price`）に書かれています。`grep -rn "1,925,000\|1,750,000\|19,000" lp/` で一括確認してください。

## 見出しの出し分け（広告のキーワード別）

| URL | 見出し |
|---|---|
| `index.html` | 手術したその日に、固定式の歯で食事ができる。（標準） |
| `index.html?v=denture` | もう、入れ歯を外さない毎日へ。 |
| `index.html?v=price` | オールオン4（片あご）1,925,000円（税込） |
| `index.html?v=bone` | 骨が少なくても、治療できる可能性があります。 |
| `index.html?v=fear` | うとうとした状態で、手術を受けられます。 |

`v` がない場合は `utm_term`（または `kw`）の語句から自動判定します（「費用」→ price、「入れ歯」→ denture、「骨」「断られた」→ bone、「痛い」「怖い」→ fear）。Google 広告での設定方法は [`docs/measurement-setup.md`](docs/measurement-setup.md#4-広告の最終ページurlと見出しの出し分け) を参照。

## YouTube をご覧の方向けページ（栄院・`youtube-lp/`）

[YouTube 集客プラン](docs/youtube-acquisition-plan.md)の「B-1」で作った、アルティメイト栄歯科・矯正歯科のページです。動画を見た人が説明欄のリンクを押したときに、**動画の続きとして受け止められる**ことを目的にしています。

- 最初の画面に、動画で解説している**院長 北村**の写真と名前、「当日の契約なし・ご家族の同席歓迎・相談だけでもOK」、予約・LINE・電話のボタン（スマホ 375×667 の最初の画面に収まる）
- 無料相談で行うこと（4ステップ）→ 動画9本（押したときだけ YouTube を読み込む）→ 医師（院長・理事長・麻酔医）・院内 → 費用 → よくある質問 → LINE → 予約フォーム → アクセス → リスク・副作用
- 予約フォームに「**ご覧になった動画**」の欄。説明欄のURLに `utm_content=動画ID` を付けておくと自動で選ばれ、台帳に「どの動画から予約が入ったか」が残る
- `main.js`・`style.css` は名駅歯科LPと共通。色や専用の部品は `youtube.css`・`youtube.js`。共通ファイルを `lp/` で直したら `npm run sync:shared` で反映（テストで一致を確認）
- スマホでの長さは約14,400px（広告用LP `implant03` の約半分）

### 公開までの手順

1. **予約フォームの受け皿**：[`server/gas/README.md`](server/gas/README.md#栄院youtube-をご覧の方向けページ-youtube-lpで使う場合) の手順で、栄院用のスプレッドシートを作り、発行されたURLを `youtube-lp/index.html` の最後にある `window.LP_CONFIG` の `formEndpoint` に設定（未設定のままだと、公開サーバーではフォームの代わりに電話の案内を表示）
2. **LINE**：L-Message で「栄院YouTubeページ用」の流入経路を作り、同じ場所の `lineUrl` を差し替え（今は説明欄と同じ経路 `dvdWFh`）
3. **内容の確認**（`index.html` 内の `【要確認】`）
   - 無料相談の流れ、院長が説明を担当できるか（フォームに「院長（北村）の説明を希望」の選択肢あり）
   - 費用：「手術費用のみ」の内訳（麻酔・最終的な歯などの別途費用）
   - 栄駅からの徒歩分数（広告用LPは3分、YouTube のチャンネル説明は2分）
   - 院長の資格表記：認定医・各種ライセンスは、広告できる資格が限られるため載せていない
   - 院長メッセージの2段落目と、動画カードの見出し・説明文は、このページ用に書いた下書き（院長・動画の内容と合っているか）
   - 土曜の相談枠をつくる場合は、よくある質問の回答を変更
   - `privacy.html` は予約フォーム用のひな形
4. **公開URL**：`youtube-lp/` の中身を、例えば `https://www.ultimate-dental.com/youtube/` にアップロードし、`index.html` の `og:url`・`og:image` を合わせる
5. **計測**：栄院の広告用LPと同じ GTM（`GTM-TKQ2RFV`）を `ultimate-dental.com`・`ultimatesakae-dental.com` でのみ読み込みます。完了ページは `reservation_complete`（`lp_name: sakae_youtube`）、動画の再生は `video_play` を送ります
6. **YouTube 側**：説明欄・固定コメント・チャンネルのリンク欄の「Webで予約」をこのページのURLに差し替え（UTM つきURLの一覧：[`docs/youtube-templates.md`](docs/youtube-templates.md#webで予約するリンク動画ごとの-utm-つきurl)）
7. **公開後**：スマホでテスト予約を1件送り、台帳の「ご覧になった動画」「utm_content」・通知メール・完了ページを確認

医院の方に見てもらうときは、`npm run build:preview:youtube` で作る1ファイル版（`dist/youtube-preview.html`、フォームは送信されません）を共有できます。

## 開発者向け

```bash
npm install            # 初回のみ（Playwright のブラウザが無い場合は npx playwright install chromium）
npm run serve          # http://localhost:8000/ で確認
npm run serve:youtube  # 栄院 YouTube をご覧の方向けページを http://localhost:8001/ で確認
npm test               # HTML検証 + 受信スクリプトのテスト + ブラウザテスト（アクセシビリティ検査を含む）
npm run build:images   # OGP画像・ホーム画面アイコンを再生成（youtube-lp/ は build:images:youtube）
npm run sync:shared    # lp/ の main.js・style.css などを youtube-lp/ にコピー
npm run build:youtube-assets  # YouTube 動画用のQRコード素材を youtube-assets/ に作る
npm run build:preview  # 1ファイル版の確認用プレビュー（dist/preview.html。youtube-lp/ は build:preview:youtube）
```

### 品質チェックの結果（2026年9月時点）

- HTML検証（html-validate）：エラーなし
- 自動テスト：受信スクリプト 12件、ブラウザ操作 44件（名駅歯科LP 20件・栄院 YouTube ページ 19件・動画用QR素材 5件）すべて合格（375×667 の画面で予約ボタンが最初に見える／幅360pxで横スクロールなし／フォームの入力チェック・送信・送信失敗・スパム対策／見出しの出し分け／送信先が未設定のときの電話案内／送信の時間切れ／第2希望の入力チェック／医療費控除の計算 など）
- アクセシビリティ（axe-core）：重大・深刻な問題なし
- Lighthouse（モバイル、3回計測）：パフォーマンス 84〜97（計測ごとのばらつきあり。3回中2回は97）／アクセシビリティ 100／ベストプラクティス 96／SEO 63（広告専用LPとして `noindex` にしているため。自然検索でも集客する場合は `<meta name="robots">` を削除）

公開サーバーでは、HTML・CSS・JS の gzip／brotli 圧縮と、`assets/` のブラウザキャッシュを有効にしてください。

## フォームの送信内容

`application/x-www-form-urlencoded` で `CONFIG.formEndpoint` に POST します（同梱の Google Apps Script 以外のフォーム受信サービスでも利用可）。

| 項目 | name |
|---|---|
| ご相談内容（複数） | `concerns` |
| どなたのご相談か | `who` |
| 第1希望（必須）／第2希望 | `date1` `time1` / `date2` `time2` |
| お名前（必須）／電話番号（必須）／電話の希望時間帯／メール／年代／備考 | `name` `tel` `contact_time` `email` `age` `note` |
| 流入元（自動） | `utm_source` `utm_medium` `utm_campaign` `utm_term` `utm_content` `gclid` `gbraid` `wbraid` `yclid` `lp_variant` `landing_url` `referrer` |
| スパム対策（自動） | `elapsed`（ページを開いてから送信までの秒数）、`hp_extra`（人には見えない項目）。疑わしい送信は受信側で「スパム疑い」として台帳に残し、通知メールは送らず、成約としても数えません |
