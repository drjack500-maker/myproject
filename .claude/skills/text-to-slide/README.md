# /text-to-slide

YouTube の台本テキストを渡すと、意味のまとまりごとに区切って、Google Gemini API でスライド画像（16:9 PNG）を生成する Claude Code スキルです。
生成したスライドは `~/Downloads/スライド/<日時>_<名前>/` に保存されます。

## 使い方

Claude Code で次のように呼び出します。

```
/text-to-slide ~/Desktop/台本.txt
/text-to-slide ~/Desktop/台本.txt 黒背景でかっこいい感じに。少し細かめに区切って
/text-to-slide （台本の本文をそのまま貼り付け）
```

Claude が台本を読んで区切り方とスライドの文言を決め、Gemini で画像を生成し、仕上がりを確認して報告します。

## 出力されるもの

```
~/Downloads/スライド/20261003-1530_サムネ講座/
├── slide_01.png …           スライド画像（台本の順番どおり）
├── index.html               台本とスライドを並べたプレビュー（ブラウザで開く）
├── 台本対応表.md             何枚目が台本のどこに対応するか・推定尺
├── plan.json                区切り方とスライドの文言（編集して作り直せる）
└── _work/                   元の台本・文の番号・プロンプト・生成状態
```

## 初回セットアップ

1. **API キーを発行**: <https://aistudio.google.com/apikey>
2. **課金を有効にする**: Gemini の画像生成モデルには無料枠がありません。Google AI Studio でプロジェクトの Billing を設定してください。
3. **キーを設定**（どちらか）
   - ターミナルの設定に追加: `echo "export GEMINI_API_KEY='発行したキー'" >> ~/.zshrc` → ターミナルと Claude Code を開き直す
   - このフォルダに `.env` を作って `GEMINI_API_KEY=発行したキー` と書く（`.gitignore` 済み）
4. **確認**: `python3 .claude/skills/text-to-slide/scripts/text_to_slide.py check` で `OK` が出れば準備完了

Python 3.9 以上が必要です（macOS 標準の `python3` で動きます）。追加のインストールは不要です。
macOS で初回だけ「ターミナルがダウンロードフォルダにアクセスしようとしています」と出たら「許可」を押してください。

### どのプロジェクトからでも使いたい場合

このフォルダを個人用スキルの場所にコピーします。

```bash
cp -R .claude/skills/text-to-slide ~/.claude/skills/
```

## 費用の目安（2026 年 10 月時点）

| モデル | 1 枚あたり | 20 枚 |
|---|---|---|
| `gemini-3-pro-image`（既定・日本語の文字が最も正確） | 約 $0.134（2K） | 約 $2.7 |
| `gemini-3.1-flash-image`（安く速い） | 約 $0.101（2K） | 約 $2.0 |

最新の料金は <https://ai.google.dev/gemini-api/docs/pricing> を確認してください。

## 手動で動かす場合

```bash
S=.claude/skills/text-to-slide/scripts/text_to_slide.py
python3 $S prepare 台本.txt --name サムネ講座       # 文に番号を振り、出力フォルダを作る
# 出力フォルダの plan.json を書く（形式は SKILL.md を参照）
python3 $S render ~/Downloads/スライド/<フォルダ> --dry-run   # 検証だけ
python3 $S render ~/Downloads/スライド/<フォルダ>             # 生成
python3 $S render ~/Downloads/スライド/<フォルダ> --only 3     # 3 枚目だけ作り直す
```

主なオプション: `--model` / `--size 1K|2K|4K` / `--aspect 9:16` / `--style "デザインの指示"` / `--style-image 見本.png` / `--workers 4` / `--force`

## テスト

```bash
python3 -m unittest discover -s .claude/skills/text-to-slide/tests -v
```

Gemini API はモックサーバーで置き換えるので、API キーなしで実行できます。
