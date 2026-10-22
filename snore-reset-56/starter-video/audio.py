#!/usr/bin/env python3
"""56秒スターター動画の音を合成して WAV に書き出す（外部素材なし・著作権フリー）。

  python3 audio.py out.wav [duration]

- BGM：F → Dm → B♭ → C を7秒ずつ2周する、やわらかいパッド
- 合図：場面の頭・1回ごとの開始・キープの開始/終了・完了でベルを鳴らす
効果音の時刻は scene.html のタイミング（PHASES / S1_REP / S2_HOLDS / S3_REP）と合わせてある。
"""
import sys
import wave

import numpy as np

SR = 48000
OUT = sys.argv[1] if len(sys.argv) > 1 else 'audio.wav'
DUR = float(sys.argv[2]) if len(sys.argv) > 2 else 56.0
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
pad *= .22

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
    fx[0, i0:] += amp * sig * (1 - pan) / 1.0
    fx[1, i0:] += amp * sig * (1 + pan) / 1.0


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
for s in (5, 10, 24, 38):
    bell(s, C6, .24, 1.2, -.15)
    bell(s + .16, F6, .22, 1.6, .15)
# 準備：鼻呼吸
breath(5.1, 7.5, True)
breath(7.5, 9.9, False)
# STEP 1：舌スライド 5回（12〜24秒、2.4秒ごと）
for k in range(5):
    bell(12 + 2.4 * k, A5 if k < 4 else C6, .22, .9)
# STEP 2：吸いつけ 5秒キープ×2回
for h in (26, 32):
    bell(h, C6, .26, 1.4)
    for sec in range(1, 5):
        tick(h + sec, .07)
    bell(h + 5, F6, .22, .9, .1)
    bell(h + 5.14, C6, .2, 1.2, -.1)
# STEP 3：「アー」×3回（40〜50秒、3.33秒ごと）
for k in range(3):
    bell(40 + 10 / 3 * k, D6, .24, 1.1)
# 完了
for i, m in enumerate((F5, A5, C6, F6, A6)):
    bell(50.05 + .11 * i, m, .1, 2.6, (-.3 + .15 * i))

mix = pad + fx
mix *= 1 - smooth((T - (DUR - .25)) / .25)       # 最後の0.25秒で無音へ
peak = np.max(np.abs(mix))
mix *= .65 / peak                               # ピーク約 -4 dBFS（全体で約 -16 LUFS）
pcm = (np.clip(mix, -1, 1).T * 32767).astype('<i2')
with wave.open(OUT, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print(f'{OUT}: {DUR:.2f}s')
