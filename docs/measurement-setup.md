# 計測設定の手順（GTM／GA4／Google 広告／Meta 広告）

LPは、ユーザーの行動を `dataLayer` にイベントとして送っています。Google タグマネージャー（GTM）でそれを受け取り、GA4 と Google 広告に渡す設定です。

## 0. 準備

- 現LPで使っている GTM コンテナ **`GTM-TKQ2RFV`** を、`lp/`（検索広告用）と `lp-006/`（Meta広告用）の `index.html`・`thanks.html` に設定済みです（どちらも同じイベント名を送ります。LPの区別は GTM の変数 `Page Path` で `/all_on_4_004/`・`/all_on_4_006/` を見分けます）
- 誤計測を防ぐため、**`meieki-dental.net` / `meieki-dental.com` のドメインでのみ読み込みます**（ローカル確認・プレビュー・テストでは送信されません）。別のドメインで公開する場合は、スニペット内の正規表現を変更してください
- コンテナには現LP用のタグ（予約システムへのリンククリック、Meta（Facebook）の計測タグなど）が入っています。新LPのイベントを追加する際、現LP用のタグが二重に発火しないか GTM のプレビューで確認してください

## 1. 変数（GTM →［変数］→ ユーザー定義変数 →「データレイヤーの変数」）

| 変数名 | データレイヤーの変数名 |
|---|---|
| DLV - lp_variant | `lp_variant` |
| DLV - cta | `cta` |
| DLV - step | `step` |
| DLV - section | `section` |
| DLV - concerns | `concerns` |
| DLV - who | `who` |
| DLV - age | `age` |
| DLV - question | `question` |
| DLV - event_id | `event_id` |
| DLV - answers | `answers` |

## 2. トリガー（［トリガー］→「カスタム イベント」）

| トリガー名 | イベント名 | 用途 |
|---|---|---|
| CE - reservation_complete | `reservation_complete` | **予約完了（主要コンバージョン）**。サンクスページで発火 |
| CE - tel_click | `tel_click` | 電話タップ |
| CE - line_click | `line_click` | LINEタップ（小冊子プレゼント） |
| CE - form_start | `form_start` | フォーム入力開始 |
| CE - form_step | `form_step` | フォームのステップ到達 |
| CE - form_error | `form_error` | 入力エラー |
| CE - quiz_complete | `quiz_complete` | 30秒の適応チェックを最後まで回答（006）。Meta の最適化にも使える |
| CE - lp_events | 正規表現 `^(lp_view\|cta_click\|section_view\|worry_check\|quiz_start\|quiz_answer\|video_play\|tax_sim_use\|faq_open\|font_size)$` | 行動分析用（まとめて1つ） |

> `form_submit` は送信直後にページが移動するため、送信できないことがあります。**コンバージョンには必ず `reservation_complete`（サンクスページ）を使ってください。** `?demo=1`（手元の確認）と `?nc=1`（受信側でスパム疑いと判定）では発火しません。完了ページの再読み込みや「戻る」では、同じ予約を二度送りません。

## 3. タグ

### GA4
| タグ | 種類 | トリガー | 設定 |
|---|---|---|---|
| GA4 - 設定 | Google タグ | All Pages | 測定ID `G-XXXXXXXXXX` |
| GA4 - 予約完了 | GA4 イベント | CE - reservation_complete | イベント名 `generate_lead`、パラメータ `lp_variant` |
| GA4 - 電話タップ | GA4 イベント | CE - tel_click | イベント名 `tel_click`、パラメータ `cta` |
| GA4 - フォーム | GA4 イベント | CE - form_start / form_step / form_error | イベント名 `{{Event}}`、パラメータ `step` `lp_variant` |
| GA4 - 行動 | GA4 イベント | CE - lp_events | イベント名 `{{Event}}`、パラメータ `cta` `section` `question` `lp_variant` |

GA4 の［管理］→［イベント］で `generate_lead` と `tel_click` を「キーイベント」に設定します。
Meta（Facebook・Instagram）のタグは [7章](#7-meta広告instagramfacebookの計測) を参照してください。
［カスタム定義］で `lp_variant` `cta` `section` をイベントスコープのディメンションとして登録すると、見出しパターン別・ボタン別に比較できます。

### Google 広告
| タグ | 種類 | トリガー | 備考 |
|---|---|---|---|
| Ads - コンバージョン リンカー | コンバージョン リンカー | All Pages | **必須**（広告クリック情報を保持） |
| Ads - 予約完了 | Google 広告のコンバージョン トラッキング | CE - reservation_complete | コンバージョンアクション「LP予約完了」。**メイン** |
| Ads - 電話タップ | Google 広告のコンバージョン トラッキング | CE - tel_click | アクション「LP電話タップ」。実際に通話したかは分からないため**サブ**（入札に使わない）を推奨 |

Google 広告側では次のようにコンバージョンアクションを分けると、最適化の精度が上がります。

| アクション | 種類 | 目標としての扱い |
|---|---|---|
| LP予約完了 | ウェブサイト | メイン |
| LP電話タップ | ウェブサイト | サブ |
| 広告からの通話（60秒以上） | 電話（広告の電話番号表示オプション） | メイン |
| オールオン4 来院 | インポート（クリック） | メイン（件数がたまったら） |
| オールオン4 成約 | インポート（クリック） | メイン（件数がたまったら、金額つき） |

来院・成約の取り込み方は [`server/gas/README.md`](../server/gas/README.md) を参照してください。十分な件数（目安として月数十件）が取り込めるようになったら、入札を「来院」「成約」重視に切り替えると、成約につながるキーワードに予算が集まります。

## 4. 広告の最終ページURLと見出しの出し分け

LPは `?v=` パラメータ、または `utm_term`（Meta 広告では `utm_content` の広告名も）の語句で見出しを切り替えます。Meta 広告のURLは [`meta-ads.md`](meta-ads.md#5-広告のurlとパラメータ) を参照してください。

| 広告グループ（例） | 最終ページURLの末尾 |
|---|---|
| オールオン4 名古屋 | （なし＝標準） |
| 入れ歯 合わない／総入れ歯 インプラント | `?v=denture` |
| オールオン4 費用／値段 | `?v=price` |
| 骨が少ない インプラント／断られた | `?v=bone` |
| インプラント 怖い／静脈内鎮静 | `?v=fear` |
| 親 入れ歯 インプラント（ご家族向け） | `?v=family` |

アカウント（またはキャンペーン）の **［最終ページURLのサフィックス］** に次を設定すると、キーワードでの自動判定と、フォームへの流入元記録ができます。

```
utm_source=google&utm_medium=cpc&utm_campaign={campaignid}&utm_term={keyword}&utm_content={creative}
```

（サフィックスは、最終ページURLに `?v=` がある場合は `&`、ない場合は `?` で自動的につながります）

## 5. 確認方法

1. GTM の［プレビュー］でLPを開き、各ボタン・フォーム・サンクスページでタグが発火するか確認
2. GA4 の［リアルタイム］でイベントが届くか確認
3. Google 広告の［コンバージョン］で、ステータスが「記録中」になるか確認（数時間かかります）

## 6. 任意：拡張コンバージョン

フォームに入力されたメールアドレス・電話番号をハッシュ化して Google 広告に送ると、Cookie が使えない環境でもコンバージョンを計測しやすくなります。個人情報の取り扱い（プライバシーポリシーへの記載）を医院で判断したうえで、必要なら設定してください。現在のLPでは送信していません。

## 7. Meta広告（Instagram・Facebook）の計測

Meta 広告は「予約完了」の数で、配信先（予約しそうな人）を学習します。**予約完了が正しく Meta に届いていること**が、広告の成果に直結します。

### 7-1. ピクセル（GTM）

GTM には現LP用の Meta ピクセルのタグが入っています（`connect.facebook.net` の読み込みを確認済み）。次の2つを確認・追加してください。

| タグ | トリガー | 設定 |
|---|---|---|
| Meta - ベースコード（PageView） | All Pages | 既存のタグを利用（新LPでも動くことを GTM のプレビューで確認） |
| **Meta - Lead** | CE - reservation_complete | 標準イベント **Lead**。**イベントID（eventID）に `{{DLV - event_id}}`** を設定 |
| Meta - Contact（任意） | CE - tel_click / CE - line_click | 標準イベント Contact |
| Meta - チェック完了（任意） | CE - quiz_complete | カスタムイベント `QuizComplete`。予約が少ないうちの最適化候補（[`meta-ads.md`](meta-ads.md#予約leadが少ないうちは)） |

カスタムHTMLタグで書く場合の例：
```html
<script>
  fbq('track', 'Lead', {}, { eventID: {{DLV - event_id}} });
</script>
```

> 現LPで「予約システムへのリンクのクリック」を Lead やコンバージョンとして送っているタグがある場合、新LPでは予約システムへのリンクがないため発火しません。新LPの予約完了は `reservation_complete` だけで数えてください。

### 7-2. コンバージョンAPI（受信スクリプトから送る。推奨）

アプリ内ブラウザや iPhone のプライバシー機能、広告ブロックなどで、ピクセルだけでは予約完了が届かないことがあります。予約フォームの受信スクリプト（Google Apps Script）から、**同じ予約を Meta に直接送る**と取りこぼしを補えます。ブラウザ（ピクセル）とサーバー（コンバージョンAPI）は **同じ event_id** で送るので、両方届いても1件として数えられます。

1. Meta のイベントマネージャ → 対象のピクセル →［設定］→［コンバージョンAPI］→［アクセストークンを生成］
2. 受信スクリプトの Apps Script →［プロジェクトの設定］→［スクリプト プロパティ］に `META_ACCESS_TOKEN` として保存（コードには書かない）
3. `Code.gs` の `SETTINGS.meta.pixelId` にピクセルIDを入れ、新しいバージョンでデプロイ
4. 確認：イベントマネージャ →［テストイベント］のコード（例：`TEST12345`）を `SETTINGS.meta.testEventCode` に入れてテスト予約 → 「サーバー」「ブラウザ」の両方で Lead が届き、「重複排除済み」と表示されることを確認 → `testEventCode` を空に戻してデプロイ

予約台帳の「Meta送信」列に、送信結果（送信済み／エラー内容）が記録されます。

**送る内容**：初期設定では、広告クリックID（`fbc`）・ブラウザID（`fbp`）・ブラウザの種類・event_id・ページのURL だけを送り、**お名前・電話番号・メールアドレスは送りません**。
`SETTINGS.meta.sendHashedContact` を `true` にすると、電話番号とメールアドレスをハッシュ化（SHA-256）して送り、広告との照合率が上がります。ただし個人情報の第三者提供にあたるため、**個人情報の取り扱い（`privacy.html`）への明記と、フォームでの同意の取得** を医院で判断してから有効にしてください。

### 7-3. 来院・成約を Meta に戻すこと

Google 広告と同じように、来院・成約をコンバージョンAPIで Meta に戻すこともできます（予約台帳の fbc を使用）。ただし治療に関する情報を広告事業者に送ることになるため、今回は実装していません。行う場合は、個人情報の取り扱いを見直したうえで追加してください。
