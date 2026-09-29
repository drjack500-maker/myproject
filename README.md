# オールオン4 LP 改善プロジェクト（名駅歯科クリニック・矯正歯科）

https://www.meieki-dental.net/all_on_4_004/ の予約（コンバージョン）を増やすための、改善提案と改善版LPです。

- **改善提案書**：[`docs/improvement-proposal.md`](docs/improvement-proposal.md)
- **改善版LP**：[`lp/index.html`](lp/index.html)（サンクスページ：[`lp/thanks.html`](lp/thanks.html)）

## ファイル構成

```
lp/
├── index.html           LP本体（HTML・インラインSVGの図とアイコン）
├── thanks.html          予約完了ページ（CV計測用）
└── assets/
    ├── css/style.css    スタイル（スマホ優先・シニア向けの文字サイズ）
    └── js/main.js       動き（見出し出し分け、フォーム、シミュレーター、計測）
docs/
└── improvement-proposal.md  改善提案書
```

ビルド不要の静的ファイルです。外部ライブラリは使っていません（フォントのみGoogle Fonts）。

## ローカルで確認する

```bash
cd lp
python3 -m http.server 8000
# → http://localhost:8000/ を開く
```

見出しの出し分けは URL で確認できます。

| URL | 見出し |
|---|---|
| `index.html` | 手術したその日に、固定式の歯で食事ができる。（標準） |
| `index.html?v=denture` | もう、入れ歯を外さない毎日へ。 |
| `index.html?v=price` | オールオン4（片あご）1,925,000円（税込） |
| `index.html?v=bone` | 骨が少なくても、治療できる可能性があります。 |
| `index.html?v=fear` | うとうとした状態で、手術を受けられます。 |

`v` がない場合は `utm_term`（または `kw`）の語句から自動で判定します（例：「費用」→ price、「入れ歯」→ denture、「骨」「断られた」→ bone、「痛い」「怖い」→ fear）。
Google広告では、広告グループごとの最終ページURLに `?v=...` を付けるか、トラッキングテンプレートで `utm_term={keyword}` を渡してください。

## 公開前にやること

1. **`docs/improvement-proposal.md` の「8. 公開前に医院で確認が必要な事項」を確認**（価格・診療時間・院長メッセージなど）。HTML・JS内の `【要確認】` コメントも確認してください
2. **`lp/assets/js/main.js` 冒頭の `CONFIG` を設定**
   - `formEndpoint`：フォームの送信先。**空のままだと送信せずにサンクスページへ進むデモモードです**
   - `lineUrl`：LINE公式アカウントのURL（空ならLINEボタンは表示されません）
   - `closedWeekdays` / `holidays` / `timeSlots`：休診日と予約の時間帯
3. **写真を差し替え**：院長写真（`#doctor`）、症例写真と情報（`#cases`）。症例が用意できるまでは `#cases` セクションに `hidden` 属性を付けて非表示にしてください
4. **計測**：`index.html` と `thanks.html` のGTMスニペットのコメントを外し、コンテナIDを設定。CVは `reservation_complete`（サンクスページ）
5. **検索エンジンの扱い**：広告専用LPとして `noindex` にしています。自然検索でも集客する場合は `<meta name="robots">` を削除

## フォームの送信内容

`multipart/form-data` で `formEndpoint` に POST します。

| 項目 | name |
|---|---|
| ご相談内容（複数） | `concerns` |
| どなたのご相談か | `who` |
| 第1希望（必須）／第2希望 | `date1` `time1` / `date2` `time2` |
| お名前（必須）／電話番号（必須）／メール／年代／備考 | `name` `tel` `email` `age` `note` |
| 流入元（自動） | `utm_source` `utm_medium` `utm_campaign` `utm_term` `utm_content` `gclid` `gbraid` `wbraid` `yclid` `lp_variant` `landing_url` `referrer` |

`gclid` を予約台帳に残しておくと、来院・成約をGoogle広告にオフラインコンバージョンとして戻せます。
