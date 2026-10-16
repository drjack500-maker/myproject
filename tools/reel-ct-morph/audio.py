"""BGM + SFX + narration mix for the 21.8 s reel (all sounds synthesised here)."""
import subprocess, numpy as np
from scipy import signal

SR = 48000; DUR = 21.8; N = int(DUR * SR)
rng = np.random.default_rng(5)
VO = [('voice/n1.mp3', 0.30), ('voice/n2.mp3', 3.40), ('voice/n3.mp3', 7.55), ('voice/n5.mp3', 12.10), ('voice/n6.mp3', 16.85)]
SLAMS = [5.38, 10.33, 14.15, 14.55]; T_CTA = 16.65; BEAT0, SPB = 5.38, 0.5

def tt(d): return np.arange(int(d * SR)) / SR
def place(buf, x, t0, g=1.0):
    i = int(t0 * SR)
    if x.ndim == 1: x = np.stack([x, x], 1)
    j = min(len(buf), i + len(x))
    if j > i: buf[i:j] += x[:j - i] * g
def sos(kind, f, order=2): return signal.butter(order, f, kind, fs=SR, output='sos')
def filt(x, kind, f, order=2): return signal.sosfilt(sos(kind, f, order), x, axis=0)
def note(m): return 440 * 2 ** ((m - 69) / 12)
def saw(f, d, det=0.):
    t = tt(d); ph = (f * (1 + det)) * t
    return 2 * (ph - np.floor(ph + .5))

IR = np.stack([rng.normal(0, 1, int(1.6 * SR)) * np.exp(-tt(1.6) / .38) for _ in range(2)], 1)
IR = filt(IR, 'lowpass', 6000) * .02
def verb(x, wet=.35):
    if x.ndim == 1: x = np.stack([x, x], 1)
    y = np.stack([signal.fftconvolve(x[:, c], IR[:, c])[:len(x) + len(IR) - 1] for c in range(2)], 1)
    out = np.zeros_like(y); out[:len(x)] += x * (1 - wet); out += y * wet
    return out

def sweep_noise(d, f0, f1, bw=.35, curve=1.):
    n = rng.normal(0, 1, int(d * SR))
    f, ts, Z = signal.stft(n, SR, nperseg=1024)
    k = (ts / d) ** curve
    fc = f0 * (f1 / f0) ** np.clip(k, 0, 1)
    Wt = np.exp(-(np.log(np.maximum(f[:, None], 1) / fc[None, :]) / bw) ** 2)
    _, y = signal.istft(Z * Wt, SR, nperseg=1024)
    return y[:int(d * SR)]

# ---------------- instruments
def kick(g=1.):
    t = tt(.5); f = 44 + 120 * np.exp(-t / .03)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .17)
    x[:150] += rng.normal(0, .5, 150) * np.linspace(1, 0, 150)
    return np.tanh(x * 1.6) * g
def clap():
    t = tt(.3); n = filt(rng.normal(0, 1, len(t)), 'bandpass', [900, 5000])
    e = np.exp(-t / .09)
    for d in (.0, .012, .024): e += .6 * np.exp(-np.maximum(t - d, 0) / .006) * (t >= d)
    return n * e * .5
def hat(open_=False):
    t = tt(.25 if open_ else .06); n = filt(rng.normal(0, 1, len(t)), 'highpass', 7500)
    return n * np.exp(-t / (.08 if open_ else .018)) * .35
def impact():
    t = tt(2.4); f = 32 + 60 * np.exp(-t / .12)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .9)
    nz = filt(rng.normal(0, 1, len(t)), 'lowpass', 2500) * np.exp(-t / .22) * .8
    metal = sum(np.sin(2 * np.pi * fr * t + rng.uniform(0, 6)) * np.exp(-t / dc) for fr, dc in
                [(310, .5), (517, .4), (741, .35), (1263, .25), (1987, .2)]) * .12
    crack = filt(rng.normal(0, 1, len(t)), 'highpass', 3000) * np.exp(-t / .03) * .7
    return verb(np.tanh((sub * 1.3 + nz + metal + crack) * 1.2), .3)
def whoosh(d, up=True, g=1.):
    x = sweep_noise(d, 300 if up else 4000, 4000 if up else 250, .45)
    t = tt(d)[:len(x)]; e = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.5
    return verb(x * e * .9 * g, .25)
def riser(d, g=1.):
    x = sweep_noise(d, 200, 7000, .5, 1.6)
    t = tt(d)[:len(x)]; k = t / d
    tone = sum(np.sin(2 * np.pi * np.cumsum(f0 * (1 + 3 * k ** 2)) / SR) for f0 in (180, 271, 362)) / 3
    trem = .6 + .4 * np.sin(2 * np.pi * np.cumsum(4 + 20 * k) / SR)
    return verb((x * .7 + tone * .35 * trem) * k ** 2.2 * g, .3)
def shimmer(d, base=1320, g=1.):
    t = tt(d); x = np.zeros(len(t))
    for i, r in enumerate([1, 1.25, 1.5, 2, 2.5, 3]):
        x += np.sin(2 * np.pi * base * r * (1 + .15 * t / d) * t + rng.uniform(0, 6)) * (.5 + .5 * np.sin(2 * np.pi * (7 + i) * t)) / (1 + i * .4)
    e = np.minimum(t / (d * .7), 1) * np.exp(-np.maximum(t - d * .7, 0) / .12)
    return verb(x * e * .12 * g, .5)
def ping(f, g=1.):
    t = tt(1.2)
    x = (np.sin(2 * np.pi * f * t) + .35 * np.sin(2 * np.pi * 2 * f * t) + .15 * np.sin(2 * np.pi * 3.01 * f * t)) * np.exp(-t / .28)
    return verb(x * .28 * g, .45)
def glitch(d, g=1.):
    out = np.zeros(int(d * SR)); i = 0
    while i < len(out):
        L = int(rng.uniform(.015, .06) * SR); seg_ = np.arange(min(L, len(out) - i))
        kind = rng.integers(3)
        if kind == 0: s = np.sign(np.sin(2 * np.pi * rng.choice([220, 440, 880, 1760]) * seg_ / SR))
        elif kind == 1: s = np.repeat(rng.uniform(-1, 1, len(seg_) // 40 + 1), 40)[:len(seg_)]
        else: s = np.zeros(len(seg_))
        out[i:i + len(seg_)] = s * rng.uniform(.2, .6); i += L
    return filt(out, 'bandpass', [300, 9000]) * .35 * g
def pop():
    t = tt(.18); f = 500 + 700 * (1 - np.exp(-t / .03))
    return verb(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .05) * .4, .3)

# ---------------- music bus
mus = np.zeros((N, 2)); drums = np.zeros((N, 2)); sfx = np.zeros((N, 2))
def pad(chord, t0, d, g=.06, cutoff=1400):
    t = tt(d); x = np.zeros((len(t), 2))
    for m in chord:
        for c, det in enumerate((-.004, .004)):
            x[:, c] += saw(note(m), d, det) + .5 * saw(note(m), d, -det * 1.7)
    e = np.minimum(t / .35, 1) * np.minimum((d - t) / .4, 1)
    x = filt(x * e[:, None], 'lowpass', cutoff, 4)
    place(mus, x, t0, g)
def bass(m, t0, d, g=.22):
    t = tt(d); x = saw(note(m), d) + .6 * np.sin(2 * np.pi * note(m) * t)
    pump = np.minimum((((t) % (SPB / 2)) / .06), 1)  # pumping on 8ths
    x = filt(x * np.minimum((d - t) / .05, 1) * (.35 + .65 * pump), 'lowpass', 380, 4)
    place(mus, x, t0, g)

AM, FM, CM, GM = [57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]
# intro / build: dark drone + heartbeat
pad([45, 57, 60, 64], 0.0, 5.5, .05, 900)
for k in range(5): place(drums, kick(.55), .35 + k * 1.0); place(drums, kick(.35), .6 + k * 1.0)
# main groove from first slam to morph
prog = [(AM, 45), (FM, 41), (CM, 48), (GM, 43)]
t0 = BEAT0; i = 0
while t0 < 12.4 - 1e-6:
    ch, bm = prog[i % 4]; d = min(2.0, 12.4 - t0)
    pad(ch, t0, d + .3, .045, 1800); bass(bm, t0, d)
    t0 += 2.0; i += 1
b = 0
while BEAT0 + b * SPB < 12.3:
    tb = BEAT0 + b * SPB
    place(drums, kick(), tb)
    if b % 2 == 1: place(drums, clap(), tb, .8)
    place(drums, hat(), tb + SPB / 2); place(drums, hat(), tb, .5)
    if b % 4 == 3: place(drums, hat(True), tb + SPB / 2, .6)
    b += 1
# morph section: filtered pad + riser, drums back on the double slam
pad([45, 57, 64, 69], 12.3, 2.0, .05, 900)
b = 0
while 14.15 + b * SPB < T_CTA - .5:
    tb = 14.15 + b * SPB
    place(drums, kick(), tb); place(drums, hat(), tb + SPB / 2)
    if b % 2 == 1: place(drums, clap(), tb, .8)
    b += 1
pad(FM, 14.15, 2.5, .05, 2000); bass(41, 14.15, 2.4)
# CTA: warm major resolution + arpeggio
for ch, bm, s in [([60, 64, 67], 48, 0), ([57, 60, 65], 41, 2), ([59, 62, 67], 43, 3.2)]:
    d = 2.0 if s < 3 else DUR - T_CTA - s
    pad(ch, T_CTA + s, d + .2, .05, 2200); bass(bm, T_CTA + s, d, .16)
arp = [72, 76, 79, 84, 79, 76]
k = 0
while T_CTA + .2 + k * .25 < DUR - .6:
    tb = T_CTA + .2 + k * .25; m = arp[k % len(arp)]
    t = tt(.4); x = signal.sawtooth(2 * np.pi * note(m) * t, .5) * np.exp(-t / .12)
    place(mus, verb(filt(x, 'lowpass', 3500) * .06, .4), tb)
    if k % 2 == 0: place(drums, kick(.45), tb)
    k += 1

# ---------------- SFX
place(sfx, glitch(.5, 1.2), 0.0)
place(sfx, verb(sweep_noise(2.2, 400, 6000, .25) * .25 * np.sin(np.pi * np.clip(tt(2.2)[:int(2.2 * SR)] / 2.2, 0, 1)), .3), .45)
place(sfx, whoosh(.55), 2.85)
place(sfx, shimmer(.85, 1175), 3.5)
for tp in (3.65, 4.2): place(sfx, ping(1760, .5), tp)
for s in SLAMS: place(sfx, impact(), s - .01, 1.0 if s != 14.55 else .8); place(sfx, glitch(.18, .8), s)
place(sfx, shimmer(.5, 1480, .7), 5.95)
place(sfx, whoosh(.9, True, 1.1), 6.85); place(sfx, glitch(.5), 7.1)
for tp, f in zip((8.25, 8.55, 8.85, 9.15), (880, 988, 1175, 1319)): place(sfx, ping(f), tp)
place(sfx, whoosh(.6, False), 11.75)
place(sfx, riser(1.7), 12.45)
place(sfx, riser(.55, 1.2), T_CTA - .55); place(sfx, glitch(.45), T_CTA - .4)
place(sfx, impact(), T_CTA - .01, .9); place(sfx, shimmer(1.0, 1568, .6), T_CTA)
place(sfx, whoosh(.35, True, .6), T_CTA + .15)
place(sfx, pop(), T_CTA + 1.1)

# ---------------- narration + ducking
vo = np.zeros(N)
for f, t0 in VO:
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
    x = np.frombuffer(raw, np.float32).astype(np.float64)
    x = filt(x, 'highpass', 90)
    x = x / (np.sqrt(np.mean(x[np.abs(x) > .02] ** 2)) + 1e-9) * .16
    i = int(t0 * SR); j = min(N, i + len(x)); vo[i:j] += x[:j - i]
env = np.abs(vo); env = signal.lfilter([1 - np.exp(-1 / (.08 * SR))], [1, -np.exp(-1 / (.08 * SR))], env)
env = np.maximum.accumulate(np.r_[env[::-1]][::1])[::-1] * 0 + env
active = np.clip(env / .03, 0, 1)
active = signal.lfilter([1 - np.exp(-1 / (.25 * SR))], [1, -np.exp(-1 / (.25 * SR))], active)
duck = 10 ** (-11 * np.clip(active * 1.4, 0, 1) / 20)

mix = (mus * .9 + drums * .55) * duck[:, None] + sfx * (.4 + .6 * duck[:, None]) + vo[:, None] * 1.0
fade = np.minimum(1, (DUR - np.arange(N) / SR) / .5); mix *= fade[:, None]
mix = np.tanh(mix * 1.1) / 1.1
mix = mix / np.max(np.abs(mix)) * .9
import wave
with wave.open('mix_raw.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(mix, -1, 1) * 32767).astype(np.int16).tobytes())
print('ok', mix.shape)
