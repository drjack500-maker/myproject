"""
ナレーションと字幕の切れ目を、音声認識で合わせる → video/align.json

  python3 tools/align-narration.py            # 全場面
  python3 tools/align-narration.py s03 s25    # 指定した場面だけ作り直す

字幕1行＝台本1行。音声認識（faster-whisper）で単語ごとの時刻を取り、台本と認識結果を
ひらがなにそろえて突き合わせ、次の行の最初の言葉が始まる直前の無音を「切れ目」にする。
声が文と文を続けて読んで無音が短いときも、言葉の位置で正しく切り替えられる。
必要なもの：pip install faster-whisper pykakasi（初回は Whisper medium のモデルをダウンロード）、ffmpeg、node
音声は dist/video-cache/（npm run build:video が作る）を使う。
"""
import difflib
import json
import os
import re
import subprocess
import sys

import numpy as np
import pykakasi
from faster_whisper import WhisperModel

ROOT = os.path.join(os.path.dirname(__file__), "..")
CACHE = os.path.join(ROOT, "dist", "video-cache")
OUT = os.path.join(ROOT, "video", "align.json")

kks = pykakasi.kakasi()


def kana(text):
    s = "".join(x["hira"] for x in kks.convert(text))
    s = "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in s)
    return re.sub(r"[\s、。「」！？!?,.・（）()]", "", s).lower()


def load(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


def pauses(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", path, "-af", "silencedetect=noise=-38dB:d=0.08", "-f", "null", "-"], capture_output=True, text=True).stderr
    out, start = [], None
    for line in r.split("\n"):
        a = re.search(r"silence_start: ([\d.]+)", line)
        b = re.search(r"silence_end: ([\d.]+)", line)
        if a:
            start = float(a.group(1))
        if b and start is not None:
            out.append((start, float(b.group(1))))
            start = None
    return out


def main():
    scenes = json.loads(subprocess.run(["node", "-e", """
const scenes = require('./video/scenes.js'); const R = require('./video/readings.js');
const say = (t) => R.reduce((s, [a, b]) => s.split(a).join(b), t);
console.log(JSON.stringify(scenes.map((s) => ({ id: s.id, lines: s.lines.map((l) => say(l.t)) }))));
"""], cwd=ROOT, capture_output=True, text=True, check=True).stdout)
    only = set(sys.argv[1:])
    result = json.load(open(OUT)) if os.path.exists(OUT) else {}
    model = WhisperModel("medium", device="cpu", compute_type="int8", download_root=os.environ.get("WHISPER_DIR"))
    for sc in scenes:
        if only and sc["id"] not in only:
            continue
        if len(sc["lines"]) < 2:
            result[sc["id"]] = []
            continue
        wav = os.path.join(CACHE, f"{sc['id']}.wav")
        segs, _ = model.transcribe(load(wav), language="ja", beam_size=5, word_timestamps=True, condition_on_previous_text=False)
        chars, times = [], []
        for seg in segs:
            for w in seg.words:
                k = kana(w.word)
                chars.append(k)
                times += [w.start] * len(k)
        asr = "".join(chars)
        script, owner = "", []
        for i, line in enumerate(sc["lines"]):
            k = kana(line)
            script += k
            owner += [i] * len(k)
        sm = difflib.SequenceMatcher(None, script, asr, autojunk=False)
        mapping = {}
        for a, b, n in sm.get_matching_blocks():
            for j in range(n):
                mapping[a + j] = b + j
        ratio = sum(n for _, _, n in sm.get_matching_blocks()) / max(1, len(script))
        ps = pauses(wav)
        bounds = []
        for k in range(1, len(sc["lines"])):
            first = owner.index(k)
            # 次の行の最初のほうで、認識結果と一致した文字の時刻（ずれた文字数ぶん少し戻す）
            hit = next(((i, mapping[i]) for i in range(first, min(first + 8, len(script))) if i in mapping), None)
            if hit is None:
                raise SystemExit(f"{sc['id']} {k + 1}行目の始まりが音声認識と合いません")
            t_next = times[hit[1]] - 0.11 * (hit[0] - first)
            near = [p for p in ps if t_next - 0.7 <= p[1] <= t_next + 0.25 and (not bounds or p[0] > bounds[-1])]
            if near:
                p = max(near, key=lambda p: p[1] - p[0])
                b = (p[0] + p[1]) / 2
            else:
                b = t_next - 0.08
            bounds.append(round(float(b), 3))
        if any(b2 <= b1 for b1, b2 in zip(bounds, bounds[1:])):
            raise SystemExit(f"{sc['id']} の切れ目が順番になりません: {bounds}")
        result[sc["id"]] = bounds
        print(f"{sc['id']} 一致 {ratio:.0%} 切れ目 {bounds}", flush=True)
    json.dump(dict(sorted(result.items())), open(OUT, "w"), ensure_ascii=False, indent=1)
    print(f"wrote {os.path.relpath(OUT, ROOT)}")


if __name__ == "__main__":
    main()
