# CT画像のカラー化モーフィング・リール（REEL-004）

インプラント治療後のCT画面写真から、インスタ用リール（1080×1920・30fps・21.8秒）を作るスクリプトです。
パノラマのカラー化 → ザイゴマ／オールオン4の強調 → 3D画像へのモーフィング → 小冊子CTA、の流れで、ナレーション・字幕・BGM・効果音まで入ります。

**このリポジトリは public です。患者の画像・動画・音声はコミットしないでください**（`.gitignore` で除外済み）。完成動画は Google Drive の `【インプラント動画】完成動画・インスタリール/01_完成動画/2026-10-16_SIU_REEL-004_…` に置きます。

## 用意するもの（このフォルダに置く）

| パス | 中身 |
| --- | --- |
| `src.jpg` | CT画面を撮った写真（2000×1500。上段パノラマ・右下3D画像） |
| `fonts/NotoSansJP-var.ttf` | `https://raw.githubusercontent.com/google/fonts/main/ofl/notosansjp/NotoSansJP%5Bwght%5D.ttf` |
| `drive/cta_card.png` | Drive の `03_CTAカード_無料小冊子_詳細を見る_20260907.png`（小冊子の表紙を切り出して使う） |
| `voice/n1.mp3`〜`n6.mp3` | ナレーション（下記） |

Python: `pip install opencv-python-headless scipy numpy pillow faster-whisper`。ffmpeg も必要。

## 手順

```bash
python3 prep_pano.py        # パノラマの台形補正・モアレ除去 → pano_gray.png
python3 prep_skull.py       # 3D画像の操作線・カーソル除去 → skull_clean.png
python3 render.py preview 4.0 10.8 19.5   # 指定秒のフレームを prev_*.jpg に書き出して確認
python3 contact_sheet.py sheet.jpg prev_*.jpg
python3 render.py video video_silent.mp4  # 映像（無音）
python3 audio.py            # BGM・効果音を合成し、ナレーションと混ぜる → mix_raw.wav
# -14 LUFS に揃える（2パス）。1回目の測定値を 2 回目の measured_* に入れる
ffmpeg -i mix_raw.wav -af loudnorm=I=-14:TP=-1.0:LRA=11:print_format=json -f null -
ffmpeg -i mix_raw.wav -af "loudnorm=I=-14:TP=-1.0:LRA=11:measured_I=..:measured_TP=..:measured_LRA=..:measured_thresh=..:offset=..:linear=true" -ar 48000 mix.wav
ffmpeg -i video_silent.mp4 -i mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart REEL-004.mp4
python3 check_narration.py voice/n1.mp3   # 読み上げ内容を Whisper で確認
```

## ナレーション（Higgsfield `text2speech_v2` / variant `elevenlabs` / プリセット声 Hana）

読み間違いを防ぐため、読みにくい語はかなで渡しています。1行 0.15 クレジット。

| ファイル | 開始 | 読ませる文 |
| --- | --- | --- |
| n1 | 0.30 | うわあごの骨が少ない、と言われた方へ。 |
| n2 | 3.40 | ほおの骨を支えにする、ザイゴマインプラント。 |
| n3 | 7.55 | したあごは、よんほんのインプラントで支える、オールオンフォー。 |
| n4 | （未使用） | シーティーで骨の状態を確認し、治療方法をご提案します。 |
| n5 | 12.10 | 骨が少ないと言われた方も、まずはご相談ください。 |
| n6 | 16.85 | 詳しくは、インプラントの無料小冊子をご覧ください。 |

開始時刻は `audio.py` の `VO`、字幕は `render.py` の `SUBS`、文字が飛び込むタイミングは `SLAMS`、CTAの開始は `T_CTA` で変えられます。
声を差し替えるときは、同じ文で作り直して `voice/` を置き換え、`audio.py` 以降をやり直します（長さが変わったら `VO`・`SUBS` も調整）。
