# オールオン4 LP 改善プロジェクト（名駅歯科クリニック・矯正歯科）

https://www.meieki-dental.net/all_on_4_004/ の予約（コンバージョン）を増やすための、改善提案と改善版LPです。

| 資料 | 内容 |
|---|---|
| [`docs/improvement-proposal.md`](docs/improvement-proposal.md) | 改善提案書（優先施策・チェックリスト・医療広告ガイドライン・A/Bテスト・公開前の確認事項） |
| [`docs/measurement-setup.md`](docs/measurement-setup.md) | 計測設定の手順（GTM／GA4／Google 広告、見出しの出し分け用URL） |
| [`server/gas/README.md`](server/gas/README.md) | 予約フォームの受信設定（Google スプレッドシートの予約台帳・通知メール・広告への成約データ連携） |

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

1. **内容の確認**：[提案書「8. 公開前に医院で確認が必要な事項」](docs/improvement-proposal.md#8-公開前に医院で確認が必要な事項)をチェック（価格・診療時間・院長メッセージなど）。HTML・JS内の `【要確認】` `【要設定】` コメントも確認
2. **予約フォームの受け皿を用意**：[`server/gas/README.md`](server/gas/README.md) の手順でスプレッドシートを作り、発行されたURLを `lp/assets/js/main.js` の `CONFIG.formEndpoint` に設定
   - 未設定のままだと、フォームは送信されずに完了ページへ進む「デモモード」になります
3. **LINE（任意）**：`CONFIG.lineUrl` に公式アカウントのURLを入れると、LINEボタンが表示されます
4. **休診日・予約枠**：`CONFIG.closedWeekdays` `CONFIG.holidays` `CONFIG.timeSlots` を実際の診療体制に合わせる（年末年始の休診日も追加）
5. **写真（任意だが推奨）**：院長写真は `index.html` の `#doctor` のコメントに沿って追加。症例は `#cases` に写真と情報を入れてから `hidden` を外す
6. **計測**：[`docs/measurement-setup.md`](docs/measurement-setup.md) の手順で GTM を設定
7. **公開URL**：`index.html` の `og:url` `og:image` を実際の公開URLに合わせる
8. **公開後**：スマホでテスト予約を1件送り、台帳への記録・通知メール・完了ページ・GTMのタグ発火を確認

### 設定を main.js を触らずに変えたい場合

`index.html` の `main.js` 読み込みより前に、次のように書くと上書きできます。

```html
<script>window.LP_CONFIG = { formEndpoint: 'https://script.google.com/macros/s/XXXX/exec', lineUrl: 'https://lin.ee/XXXX' };</script>
<script src="assets/js/main.js" defer></script>
```

### 価格を変更するとき

価格はFV・特長・費用・FAQ・見出しパターン（`main.js` の `HEADLINES.price`）に書かれています。`grep -rn "1,925,000\|39,000" lp/` で一括確認してください。

## 見出しの出し分け（広告のキーワード別）

| URL | 見出し |
|---|---|
| `index.html` | 手術したその日に、固定式の歯で食事ができる。（標準） |
| `index.html?v=denture` | もう、入れ歯を外さない毎日へ。 |
| `index.html?v=price` | オールオン4（片あご）1,925,000円（税込） |
| `index.html?v=bone` | 骨が少なくても、治療できる可能性があります。 |
| `index.html?v=fear` | うとうとした状態で、手術を受けられます。 |

`v` がない場合は `utm_term`（または `kw`）の語句から自動判定します（「費用」→ price、「入れ歯」→ denture、「骨」「断られた」→ bone、「痛い」「怖い」→ fear）。Google 広告での設定方法は [`docs/measurement-setup.md`](docs/measurement-setup.md#4-広告の最終ページurlと見出しの出し分け) を参照。

## 開発者向け

```bash
npm install            # 初回のみ（Playwright のブラウザが無い場合は npx playwright install chromium）
npm run serve          # http://localhost:8000/ で確認
npm test               # HTML検証 + 受信スクリプトのテスト + ブラウザテスト（アクセシビリティ検査を含む）
npm run build:images   # OGP画像・ホーム画面アイコンを再生成
npm run build:preview  # 1ファイル版の確認用プレビュー（dist/preview.html）
```

### 品質チェックの結果（2026年9月時点）

- HTML検証（html-validate）：エラーなし
- 自動テスト：受信スクリプト 8件、ブラウザ操作 14件すべて合格（375×667 の画面で予約ボタンが最初に見える／幅360pxで横スクロールなし／フォームの入力チェック・送信・送信失敗・スパム対策／見出しの出し分け／医療費控除の計算 など）
- アクセシビリティ（axe-core）：重大・深刻な問題なし
- Lighthouse（モバイル）：パフォーマンス 93〜94／アクセシビリティ 100／ベストプラクティス 96／SEO 60（広告専用LPとして `noindex` にしているため。自然検索でも集客する場合は `<meta name="robots">` を削除）

公開サーバーでは、HTML・CSS・JS の gzip／brotli 圧縮と、`assets/` のブラウザキャッシュを有効にしてください。

## フォームの送信内容

`application/x-www-form-urlencoded` で `CONFIG.formEndpoint` に POST します（同梱の Google Apps Script 以外のフォーム受信サービスでも利用可）。

| 項目 | name |
|---|---|
| ご相談内容（複数） | `concerns` |
| どなたのご相談か | `who` |
| 第1希望（必須）／第2希望 | `date1` `time1` / `date2` `time2` |
| お名前（必須）／電話番号（必須）／メール／年代／備考 | `name` `tel` `email` `age` `note` |
| 流入元（自動） | `utm_source` `utm_medium` `utm_campaign` `utm_term` `utm_content` `gclid` `gbraid` `wbraid` `yclid` `lp_variant` `landing_url` `referrer` |
| スパム対策（自動） | `elapsed`（ページを開いてから送信までの秒数）、`website`（人には見えない項目。入力があれば送信しない） |
