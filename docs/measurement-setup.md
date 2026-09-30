# 計測設定の手順（GTM／GA4／Google 広告）

LPは、ユーザーの行動を `dataLayer` にイベントとして送っています。Google タグマネージャー（GTM）でそれを受け取り、GA4 と Google 広告に渡す設定です。

## 0. 準備

- GTM のコンテナを作成し、コンテナID（`GTM-XXXXXXX`）を控える
- `lp/index.html` と `lp/thanks.html` の `<head>` にある GTM スニペットのコメント（`<!--` と `-->`）を外し、`GTM-XXXXXXX` を置き換える
- 可能であれば `<body>` 直後に GTM の `<noscript>` スニペットも追加

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

## 2. トリガー（［トリガー］→「カスタム イベント」）

| トリガー名 | イベント名 | 用途 |
|---|---|---|
| CE - reservation_complete | `reservation_complete` | **予約完了（主要コンバージョン）**。サンクスページで発火 |
| CE - tel_click | `tel_click` | 電話タップ |
| CE - line_click | `line_click` | LINEタップ（LINE設定時） |
| CE - form_start | `form_start` | フォーム入力開始 |
| CE - form_step | `form_step` | フォームのステップ到達 |
| CE - form_error | `form_error` | 入力エラー |
| CE - lp_events | 正規表現 `^(lp_view\|cta_click\|section_view\|worry_check\|tax_sim_use\|faq_open\|font_size)$` | 行動分析用（まとめて1つ） |

> `form_submit` は送信直後にページが移動するため、送信できないことがあります。**コンバージョンには必ず `reservation_complete`（サンクスページ）を使ってください。** `?demo=1`（送信先未設定のテスト）では発火しません。

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

LPは `?v=` パラメータ、または `utm_term` の語句で見出しを切り替えます。

| 広告グループ（例） | 最終ページURLの末尾 |
|---|---|
| オールオン4 名古屋 | （なし＝標準） |
| 入れ歯 合わない／総入れ歯 インプラント | `?v=denture` |
| オールオン4 費用／値段 | `?v=price` |
| 骨が少ない インプラント／断られた | `?v=bone` |
| インプラント 怖い／静脈内鎮静 | `?v=fear` |

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
