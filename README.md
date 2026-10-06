# オールオン4 LP 改善プロジェクト（名駅歯科クリニック・矯正歯科）

オールオン4の広告LPの予約（コンバージョン）を増やすための、改善提案と改善版LPです。広告の種類ごとに2つのLPがあります。

| LP | 公開先 | 広告 | 特徴 |
|---|---|---|---|
| [`lp/`](lp/) | `all_on_4_004/` | Google 検索広告 | 料金・答えを最初に。検索キーワード別の見出し |
| [`lp-006/`](lp-006/) | `all_on_4_006/` | **Meta 広告（Instagram・Facebook）** | 広告と同じ「医師の写真＋実績」の最初の画面、30秒の適応チェック、動画、軽さ優先（最初の表示 約285KB）、Meta のコンバージョンAPI対応 |

| 資料 | 内容 |
|---|---|
| [`preview/lp-006-draft.html`](preview/lp-006-draft.html) | **改訂LP（006）の下書き**：1ファイルで開ける確認用。医院で記入が必要な空欄を黄色の枠で表示 |
| [`docs/lp-006-review.md`](docs/lp-006-review.md) | **Meta広告用LP（006）の診断と改善版の説明**（記入が必要な空欄の一覧は6章）（2026年10月6日確認。表示の重さ・予約導線・ガイドライン上のリスク・Meta 広告向けの設計） |
| [`docs/meta-ads.md`](docs/meta-ads.md) | **Meta 広告の広告文・クリエイティブ・配信設定**（見出しパターン別の広告文、守るべきルール、数字の見方） |
| [`current-lp-hotfix/006/`](current-lp-hotfix/006/) | **今の006の応急処置版**（説明のない術前術後写真・体験談の非表示、表現の修正、税込表示、リスクの追記、誤字修正。32か所） |
| [`current-lp-hotfix/`](current-lp-hotfix/) | **今の004の応急処置版**（体験談の非表示・表現の修正・税込表示・リスクの追記・誤字修正。新LPの公開まで差し替えて使える） |
| [`docs/current-lp-review.md`](docs/current-lp-review.md) | **検索広告用LP（004）の診断レポート**（2026年9月30日確認。問題点・ガイドライン上のリスク・誤字・予約システムの離脱ポイント・応急処置） |
| [`docs/improvement-proposal.md`](docs/improvement-proposal.md) | 改善提案書（優先施策・チェックリスト・医療広告ガイドライン・A/Bテスト・公開前の確認事項） |
| [`docs/ad-copy.md`](docs/ad-copy.md) | **Google 広告の広告文**（見出しパターン別の広告グループ・キーワード・アセット・除外キーワード。広告エディタ用CSVつき） |
| [`docs/measurement-setup.md`](docs/measurement-setup.md) | 計測設定の手順（GTM／GA4／Google 広告／**Meta ピクセル・コンバージョンAPI**、見出しの出し分け用URL） |
| [`server/gas/README.md`](server/gas/README.md) | 予約フォームの受信設定（Google スプレッドシートの予約台帳・通知メール・広告への成約データ連携・Meta コンバージョンAPI） |
| [`docs/reception-manual.md`](docs/reception-manual.md) | 予約リクエストの受付対応マニュアル（電話のタイミング・トーク例・台帳の更新・リマインド） |

## ファイル構成

```
lp/                       ← all_on_4_004/ に公開（検索広告用）。共通ファイルの元
├── index.html            LP本体
├── thanks.html           予約完了ページ（コンバージョン計測）
├── privacy.html          予約フォームの個人情報の取り扱い
└── assets/
    ├── css/style.css     両LP共通
    ├── js/main.js        両LP共通：見出し出し分け・フォーム・適応チェック・動画・シミュレーター・計測（設定は冒頭の CONFIG）
    └── img/              両LP共通の画像（医師・院内・症例・動画サムネイル・OGP など）
lp-006/                   ← all_on_4_006/ に公開（Meta 広告用）
├── index.html            Meta 広告用LP本体（このファイルだけが lp-006 専用）
└── （thanks.html・privacy.html・assets/ は lp/ からのコピー。npm run sync:006 で更新）
server/gas/               予約フォームの受信スクリプト（Google Apps Script。両LP共通）
current-lp-hotfix/        今のLP（004・006）の応急処置版
preview/lp-006-draft.html 改訂LP（006）の下書き（1ファイル版。空欄を表示）
docs/                     診断・提案書・計測手順・広告文
tests/                    自動テスト（受信スクリプト・ブラウザ操作・アクセシビリティ）
tools/                    ローカル確認用サーバー、lp-006 への同期、画像・プレビュー・応急処置版の生成
```

LPはビルド不要の静的ファイルです（外部ライブラリなし。004 のフォントのみ Google Fonts、006 は表示速度を優先して端末のフォント）。**`lp/` は `all_on_4_004/` に、`lp-006/` は `all_on_4_006/` に、フォルダの中身をそのままアップロードすれば動きます。**

> **`lp/` の CSS・JS・画像・完了ページを編集したら、必ず `npm run sync:006` を実行**して `lp-006/` に反映してください（コピー漏れは `npm test` が検出します）。画像を追加するときも `lp/assets/img/` に置きます。

## 公開までの手順

1. **内容の確認**：料金・保証・医師情報などは現LP（2026年9月時点）に合わせてあります。残りの確認事項は [提案書「8. 公開前に医院で確認が必要な事項」](docs/improvement-proposal.md#8-公開前に医院で確認が必要な事項) を参照。HTML・JS内の `【要確認】` `【要更新】` `【要設定】` コメントも確認
2. **予約フォームの受け皿を設置**：予約はLP内の3ステップフォームで受け付けます。[`server/gas/README.md`](server/gas/README.md) の手順でスプレッドシート（予約台帳）を作り、発行されたURLを `lp/assets/js/main.js` の `CONFIG.formEndpoint` に設定（→ `npm run sync:006`。両LPの予約が同じ台帳に入り、「流入ページ」で区別できます）
   - 未設定のまま公開すると、**フォームの代わりに「お電話でご予約ください」という案内を表示**します（予約が失われるのを防ぐため。手元の確認用サーバー以外はすべてこの動作）。手元の確認（localhost・ファイルを直接開いたとき）では、送信せずに完了ページへ進むデモ動作になります
   - 受付スタッフの対応手順は [`docs/reception-manual.md`](docs/reception-manual.md)
3. **LINE**：現LPと同じ L-Message の小冊子プレゼントURLを設定済み（`CONFIG.lineUrl`）。新LPの効果を分けて測る場合は新しい流入経路URLに差し替え
4. **休診日・予約枠**：`CONFIG.closedWeekdays` `CONFIG.holidays` `CONFIG.timeSlots` を実際の診療体制に合わせる（年末年始の休診日も追加）
5. **写真**：医師3名と院内の写真は現LPのものを使用しています。症例は `#cases` に写真と情報を入れてから `hidden` を外す
6. **計測**：現LPと同じ GTM（`GTM-TKQ2RFV`）を設定済みで、`meieki-dental.net` / `meieki-dental.com` でのみ読み込みます。予約完了の計測は [`docs/measurement-setup.md`](docs/measurement-setup.md) の手順で追加（Meta 広告は7章：ピクセルの Lead に event_id、コンバージョンAPI）
7. **公開URL**：`index.html` の `og:url` `og:image` を実際の公開URLに合わせる（`lp-006/` は `all_on_4_006/` に設定済み）
8. **006 の追加作業**：空欄（症例・費用の内訳・分割回数・治療期間・理事長メッセージ・所要時間）を記入。空欄が残っている項目は公開しても表示されません（一覧は [`docs/lp-006-review.md` の6章](docs/lp-006-review.md#6-医院で記入する空欄)）。広告の文言は [`docs/meta-ads.md`](docs/meta-ads.md)。詳しくは [`docs/lp-006-review.md`](docs/lp-006-review.md#5-公開までの手順006)
9. **公開後**：スマホでテスト予約を1件送り、台帳への記録・通知メール・完了ページ・GTMのタグ発火を確認（006 は Instagram アプリから開いて確認）

### 設定を main.js を触らずに変えたい場合

`index.html` の `main.js` 読み込みより前に、次のように書くと上書きできます。

```html
<script>window.LP_CONFIG = { formEndpoint: 'https://script.google.com/macros/s/XXXX/exec', lineUrl: 'https://lin.ee/XXXX' };</script>
<script src="assets/js/main.js" defer></script>
```

### 価格を変更するとき

価格はFV・特長・費用・FAQ・見出しパターン（`main.js` の `HEADLINES.price`）、006 では適応チェックの結果にも書かれています。`grep -rn "1,925,000\|1,750,000\|19,000" lp/ lp-006/index.html` で一括確認してください。

## 見出しの出し分け（広告のキーワード別）

| URL | 見出し |
|---|---|
| `index.html` | 手術したその日に、固定式の歯で食事ができる。（標準） |
| `index.html?v=denture` | もう、入れ歯を外さない毎日へ。 |
| `index.html?v=price` | オールオン4（片あご）1,925,000円（税込） |
| `index.html?v=bone` | 骨が少なくても、治療できる可能性があります。 |
| `index.html?v=fear` | うとうとした状態で、手術を受けられます。 |
| `index.html?v=family` | 親の「噛める喜び」を、もう一度。（フォームの「どなたのご相談か」も「ご家族」に） |

006 の標準の見出しは「オールオン4で、噛める喜びを取り戻す。」（今の006・Meta 広告と同じ）で、`?v=` は共通です。
`v` がない場合は `utm_term`・`utm_content`（または `kw`）の語句から自動判定します（「家族」「ご両親」→ family、「費用」→ price、「入れ歯」→ denture、「骨」「断られた」→ bone、「痛い」「怖い」→ fear）。Google 広告での設定方法は [`docs/measurement-setup.md`](docs/measurement-setup.md#4-広告の最終ページurlと見出しの出し分け)、Meta 広告は [`docs/meta-ads.md`](docs/meta-ads.md#2-広告の組み合わせ見出しパターン) を参照。

## 開発者向け

```bash
npm install            # 初回のみ（Playwright のブラウザが無い場合は npx playwright install chromium）
npm run serve          # http://localhost:8000/（004）、http://localhost:8000/006/（006）で確認
npm run sync:006       # lp/ の共通ファイルを lp-006/ にコピーし、下書き（preview/lp-006-draft.html）も作り直す
                       # 手元では http://localhost:8000/006/?draft=1 でも空欄つきで表示できます
npm test               # HTML検証 + 受信スクリプトのテスト + ブラウザテスト（アクセシビリティ検査を含む）
npm run build:images   # OGP画像・ホーム画面アイコンを再生成
npm run build:preview  # 1ファイル版の確認用プレビュー（dist/preview.html）
npm run build:hotfix   # 今のLP（004・006）の応急処置版を作り直す
```

### 品質チェックの結果（2026年10月時点）

- HTML検証（html-validate）：両LPともエラーなし
- 自動テスト：受信スクリプト 16件、ブラウザ操作 35件すべて合格
  - 共通：375×667 の画面で予約ボタンが最初に見える／幅360pxで横スクロールなし／フォームの入力チェック・送信・送信失敗・スパム対策／見出しの出し分け／送信先が未設定のときの電話案内／送信の時間切れ／第2希望の入力チェック／医療費控除の計算 など
  - 006：最初の画面に医師の写真・実績・予約ボタン／適応チェックの結果表示とフォームへの引き継ぎ（キーボード操作を含む）／動画はタップまで読み込まない／fbclid・fbc・fbp・event_id の送信と完了ページでの1回だけの計上／空欄が残った項目は公開版で表示しない（記入した症例・行だけ表示）／下書き表示／`lp/` との共通ファイルの同期・下書きの作り直し漏れ
  - 受信スクリプト：Meta コンバージョンAPI（送らない条件・送る内容・ハッシュ化・エラーの記録）
- アクセシビリティ（axe-core）：両LPとも重大・深刻な問題なし
- Lighthouse（モバイル、3回計測）
  - 006（2026年10月）：パフォーマンス 95〜97（LCP 2.3〜2.4秒、CLS 0）／アクセシビリティ 100／ベストプラクティス 100／SEO 63
  - 004（2026年9月）：パフォーマンス 84〜97／アクセシビリティ 100／ベストプラクティス 96／SEO 63
  - SEO 63 は、広告専用LPとして `noindex` にしているため。自然検索でも集客する場合は `<meta name="robots">` を削除

公開サーバーでは、HTML・CSS・JS の gzip／brotli 圧縮と、`assets/` のブラウザキャッシュを有効にしてください。

## フォームの送信内容

`application/x-www-form-urlencoded` で `CONFIG.formEndpoint` に POST します（同梱の Google Apps Script 以外のフォーム受信サービスでも利用可）。

| 項目 | name |
|---|---|
| ご相談内容（複数。006 は適応チェックの回答を引き継ぐ） | `concerns` |
| どなたのご相談か | `who` |
| 第1希望（必須）／第2希望 | `date1` `time1` / `date2` `time2` |
| お名前（必須）／電話番号（必須）／電話の希望時間帯／メール／年代／備考 | `name` `tel` `contact_time` `email` `age` `note` |
| 流入元（自動） | `utm_source` `utm_medium` `utm_campaign` `utm_term` `utm_content` `gclid` `gbraid` `wbraid` `yclid` `fbclid` `lp_variant` `landing_url` `referrer` |
| Meta 計測（自動） | `fbc`（広告クリックID。ピクセルのCookie、なければ fbclid から作成）`fbp`（ピクセルのブラウザID）`event_id`（ピクセルとコンバージョンAPIの重複防止用。完了ページの `reservation_complete` にも同じ値）`client_ua`（ブラウザの種類。コンバージョンAPI用で台帳には保存しない） |
| スパム対策（自動） | `elapsed`（ページを開いてから送信までの秒数）、`hp_extra`（人には見えない項目）。疑わしい送信は受信側で「スパム疑い」として台帳に残し、通知メールは送らず、成約としても数えません |
