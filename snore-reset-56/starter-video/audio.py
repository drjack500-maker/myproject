#!/usr/bin/env python3
"""56秒スターター動画の音（BGM・合図の音・ナレーション）を合成して WAV に書き出す。

  python3 audio.py out.wav [captions.srt]

- 時刻はすべて timeline.js から読む（画面の scene.html と同じファイル）
- BGM：F → Dm → B♭ → C を7秒ずつ繰り返す、やわらかいパッド（スクリプトで合成・素材なし）
- 合図：場面の頭・1回ごとの開始・キープの開始/終了・完了でベル
- ナレーション：narration/ の音声を timeline.js の時刻に置く（at＝声が出始める時刻）。
  声が出ている間は BGM と合図の音を自動で下げる
- 最後に全体を約 -16 LUFS にそろえる
- 2つめの引数を渡すと、ナレーションの字幕（SRT）も書き出す
"""
import json
import os
import re
import subprocess
import sys
import tempfile
import wave

import numpy as np

DIR = os.path.dirname(os.path.abspath(__file__))
SR = 48000
OUT = sys.argv[1] if len(sys.argv) > 1 else 'audio.wav'
SRT = sys.argv[2] if len(sys.argv) > 2 else None
TARGET_LUFS = -16.0

src = open(os.path.join(DIR, 'timeline.js'), encoding='utf-8').read()
TL = json.loads(src[src.index('{', src.index('window.TIMELINE')):src.rindex('}') + 1])
DUR = float(TL['duration'])
N = int(round(SR * DUR))
T = np.arange(N) / SR
rng = np.random.default_rng(56)


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def smooth(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


# ---------- BGM（パッド） ----------
CHORDS = [
    [41, 53, 57, 60, 64],   # F    (Fmaj7)
    [38, 53, 57, 60, 62],   # Dm   (Dm7)
    [34, 53, 57, 62, 65],   # B♭   (B♭maj7)
    [36, 55, 60, 62, 67],   # C    (Csus2)
]
CHORD_LEN = 7.0
pad = np.zeros((2, N))
for i in range(int(np.ceil(DUR / CHORD_LEN))):
    s, e = i * CHORD_LEN, (i + 1) * CHORD_LEN
    env = smooth((T - (s - .9)) / 1.8) * (1 - smooth((T - (e - .9)) / 1.8))
    if i == 0:
        env = smooth(T / 2.5) * (1 - smooth((T - (e - .9)) / 1.8))
    for j, m in enumerate(CHORDS[i % len(CHORDS)]):
        f = hz(m)
        amp = .5 if j == 0 else .28
        for ch, cents in enumerate((-5, 5)):
            ff = f * 2 ** (cents / 1200)
            ph = rng.uniform(0, 2 * np.pi)
            x = 2 * np.pi * ff * T + ph
            wave_ = np.sin(x) + .16 * np.sin(2 * x) + .05 * np.sin(3 * x)
            trem = 1 + .12 * np.sin(2 * np.pi * (.11 + .03 * j) * T + ph)
            pad[ch] += amp * env * wave_ * trem
pad *= smooth(T / 2.0) * (1 - smooth((T - (DUR - 2.6)) / 2.6))
pad /= np.max(np.abs(pad)) + 1e-9
pad *= .1

# ---------- 合図の音 ----------
fx = np.zeros((2, N))


def bell(t0, midi, amp=.3, decay=1.4, pan=0.0):
    f = hz(midi)
    i0 = int(t0 * SR)
    if i0 >= N:
        return
    tt = np.arange(N - i0) / SR
    sig = np.zeros_like(tt)
    for ratio, a, d in ((1, 1, 1), (2.0, .32, .55), (2.76, .2, .35), (5.4, .06, .18)):
        sig += a * np.sin(2 * np.pi * f * ratio * tt) * np.exp(-tt / (decay * d))
    sig *= np.minimum(tt / .004, 1)
    fx[0, i0:] += amp * sig * (1 - pan)
    fx[1, i0:] += amp * sig * (1 + pan)


def tick(t0, amp=.12):
    """カウント用の小さなウッドブロック風の音"""
    i0 = int(t0 * SR)
    tt = np.arange(min(int(.12 * SR), N - i0)) / SR
    sig = (np.sin(2 * np.pi * 1480 * tt) + .5 * np.sin(2 * np.pi * 2960 * tt)) * np.exp(-tt / .018)
    fx[:, i0:i0 + len(tt)] += amp * sig


def breath(t0, t1, rising, amp=.06):
    """鼻呼吸のガイド（やわらかい息の音）"""
    i0, i1 = int(t0 * SR), int(t1 * SR)
    m = i1 - i0
    noise = rng.standard_normal(m)
    spec = np.fft.rfft(noise)
    fr = np.fft.rfftfreq(m, 1 / SR)
    spec *= np.exp(-((np.log(fr + 1) - np.log(900)) ** 2) / .9)
    sig = np.fft.irfft(spec, m)
    sig /= np.max(np.abs(sig)) + 1e-9
    u = np.linspace(0, 1, m)
    env = np.sin(np.pi * u) ** 1.5 * (1 + .4 * (u if rising else 1 - u))
    fx[:, i0:i1] += amp * sig * env


F5, A5, C6, D6, F6, A6 = 77, 81, 84, 86, 89, 93

# イントロ
bell(.35, A5, .26, 1.8, -.2)
bell(.6, C6, .24, 1.8, .2)
bell(.85, F6, .2, 2.4)
# 場面の頭
for s in (TL['prep'], TL['s1'], TL['s2'], TL['s3']):
    bell(s, C6, .24, 1.2, -.15)
    bell(s + .16, F6, .22, 1.6, .15)
# 準備：鼻呼吸
breath(TL['inhale'][0] + .1, TL['inhale'][1], True)
breath(TL['exhale'][0], TL['exhale'][1] - .1, False)
# STEP 1：舌スライド（1回ごと）
for k, s in enumerate(TL['s1Reps']):
    bell(s, C6 if k == len(TL['s1Reps']) - 1 else A5, .22, .9)
# STEP 2：吸いつけ（キープの開始・毎秒のカウント・終了）
for h in TL['s2Holds']:
    bell(h, C6, .26, 1.4)
    for sec in range(1, int(TL['s2Hold'])):
        tick(h + sec, .07)
    bell(h + TL['s2Hold'], F6, .22, .9, .1)
    bell(h + TL['s2Hold'] + .14, C6, .2, 1.2, -.1)
# STEP 3：「アー」（1回ごと）
for s in TL['s3Ahs']:
    bell(s, D6, .2, 1.1)
# 完了
for i, m in enumerate((F5, A5, C6, F6, A6)):
    bell(TL['outro'] + .05 + .11 * i, m, .1, 2.6, (-.3 + .15 * i))
fx *= .5


# ---------- ナレーション ----------
def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)


def frame_db(x, w=SR // 100):
    n = len(x) // w
    return 20 * np.log10(np.sqrt((x[:n * w].reshape(n, w) ** 2).mean(1)) + 1e-12), w


def prepare(path):
    """前後の無音を切り、声の大きさをそろえる。戻り値：(音声, 音声の頭から声が出始めるまでの秒, 声の長さ)"""
    x = decode(path)
    db, w = frame_db(x)
    on = np.where(db > -40)[0]
    a = max(0, on[0] * w - int(.02 * SR))
    b = min(len(x), (on[-1] + 1) * w + int(.12 * SR))
    y = x[a:b].copy()
    act = db[on[0]:on[-1] + 1]
    act = act[act > -40]
    y *= 10 ** ((-20 - 10 * np.log10(np.mean(10 ** (act / 10)))) / 20)      # 声の部分の平均を -20 dBFS に
    y *= min(1, .9 / (np.max(np.abs(y)) + 1e-9))
    fi, fo = int(.01 * SR), int(.08 * SR)
    y[:fi] *= np.linspace(0, 1, fi)
    y[-fo:] *= np.linspace(1, 0, fo)
    lead = (on[0] * w - a) / SR
    return y, lead, (on[-1] + 1 - on[0]) * w / SR


voice = np.zeros(N)
cues = []
cache = {}
for c in TL['narration']:
    if c['file'] not in cache:
        cache[c['file']] = prepare(os.path.join(DIR, 'narration', c['file']))
    y, lead, length = cache[c['file']]
    i0 = int(round((c['at'] - lead) * SR))
    i1 = min(N, i0 + len(y))
    voice[i0:i1] += y[:i1 - i0]
    cues.append((c['at'], c['at'] + length, c['text']))
for (s0, e0, t0), (s1, _, t1) in zip(cues, cues[1:]):
    if e0 > s1:
        sys.exit(f'ナレーションが重なっています：「{t0}」の終わり {e0:.2f}s ＞「{t1}」の始まり {s1:.2f}s')
if cues[-1][1] > DUR - .2:
    sys.exit(f'最後のナレーションが動画の終わりに近すぎます（{cues[-1][1]:.2f}s）')

# 声が出ている間だけ BGM・合図を下げる（ダッキング）
db, w = frame_db(voice)
target = (db > -45).astype(float)
env = np.zeros_like(target)
lvl = 0.0
for i, v in enumerate(target):
    lvl += (v - lvl) * (.35 if v > lvl else .04)    # 10ms ごと：すばやく下げて、ゆっくり戻す
    env[i] = lvl
env = np.interp(T, (np.arange(len(env)) + .5) * w / SR, env)
mix = pad * (1 - .6 * env) + fx * (1 - .45 * env) + voice

mix *= 1 - smooth((T - (DUR - .25)) / .25)       # 最後の0.25秒で無音へ


def write(path, x):
    pcm = (np.clip(x, -1, 1).T * 32767).astype('<i2')
    with wave.open(path, 'wb') as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes(pcm.tobytes())


def lufs(x):
    with tempfile.NamedTemporaryFile(suffix='.wav') as tmp:
        write(tmp.name, x)
        log = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', tmp.name, '-af', 'ebur128', '-f', 'null', '-'],
                             capture_output=True, text=True).stderr
    return float(re.findall(r'I:\s+(-?[\d.]+) LUFS', log)[-1])


mix *= .5 / np.max(np.abs(mix))
mix *= 10 ** ((TARGET_LUFS - lufs(mix)) / 20)
if np.max(np.abs(mix)) > .89:                     # ピークが -1 dBFS を超える分だけやわらかく抑える
    over = np.abs(mix) > .8
    mix[over] = np.sign(mix[over]) * (.8 + .09 * np.tanh((np.abs(mix[over]) - .8) / .09))
write(OUT, mix)
print(f'{OUT}: {DUR:.2f}s, {lufs(mix):.1f} LUFS, peak {20 * np.log10(np.max(np.abs(mix))):.1f} dBFS')

if SRT:
    def ts(t):
        ms = int(round(t * 1000))
        return f'{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}'
    with open(SRT, 'w', encoding='utf-8') as f:
        for i, (s, e, text) in enumerate(cues):
            nxt = cues[i + 1][0] if i + 1 < len(cues) else DUR
            f.write(f'{i + 1}\n{ts(s)} --> {ts(min(max(e + .3, s + 1.0), nxt - .05))}\n{text}\n\n')
    print(SRT)
