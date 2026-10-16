"""Instagram Reel (1080x1920, 30fps): colourised CT panorama -> zygoma / All-on-4 highlights -> morph into 3D skull."""
import sys, subprocess, math
import cv2, numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.interpolate import RBFInterpolator

cv2.setNumThreads(4)
W, H, FPS, DUR = 1080, 1920, 30, 21.8
NF = int(round(DUR * FPS))
JP = 'fonts/NotoSansJP-var.ttf'
EN = '/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf'

# ---------------------------------------------------------------- helpers
def hexrgb(h):
    h = h.lstrip('#'); return np.array([int(h[i:i+2], 16) for i in (0, 2, 4)], np.float32) / 255

def lut(stops):
    xs = np.array([s[0] for s in stops]); cs = np.array([hexrgb(s[1]) for s in stops])
    v = np.linspace(0, 1, 256)
    return np.stack([np.interp(v, xs, cs[:, c]) for c in range(3)], -1).astype(np.float32)

def apply(g, L): return L[np.clip(g * 255, 0, 255).astype(np.uint8)]
def clamp(x, a=0., b=1.): return max(a, min(b, x))
def seg(t, a, b): return clamp((t - a) / (b - a))
def smooth(x): return x * x * (3 - 2 * x)
def ease_io(x): return 4*x*x*x if x < .5 else 1 - (-2*x + 2)**3 / 2
def ease_out(x): return 1 - (1 - x)**3
def ease_back(x, s=2.2): x -= 1; return 1 + (s + 1) * x**3 + s * x**2
def lerp(a, b, k): return a + (b - a) * k
def bump(t, a, peak, b):
    if t <= a or t >= b: return 0.
    return smooth(seg(t, a, peak)) if t < peak else 1 - smooth(seg(t, peak, b))

BONE = lut([(0, '#010509'), (.22, '#03161d'), (.40, '#08424d'), (.55, '#0e6f7b'), (.70, '#1fb0c0'),
            (.82, '#6fe0ec'), (.93, '#d6f9ff'), (1, '#ffffff')])
NEON = lut([(0, '#05010d'), (.30, '#1d0a52'), (.50, '#4a10a8'), (.66, '#b0179f'), (.82, '#ff3d8b'),
            (.94, '#ffc2e2'), (1, '#ffffff')])
GOLD = lut([(0, '#2a1000'), (.38, '#8a4306'), (.62, '#ff8f24'), (.80, '#ffcf63'), (.93, '#fff4d6'), (1, '#ffffff')])
GOLD_C = hexrgb('#ffae2e'); CYAN_C = hexrgb('#35e6ff'); MAG_C = hexrgb('#ff2bd6')

# ---------------------------------------------------------------- panorama assets
P = cv2.imread('pano_gray.png', 0).astype(np.float32) / 255
P = cv2.bilateralFilter(P, 7, 0.08, 5)
ph, pw = P.shape
PB, PN, PG3 = apply(P, BONE), apply(P, NEON), np.repeat((P * .92)[..., None], 3, 2)
PGOLD = apply(np.clip((P - .5) / .5, 0, 1) ** 1.6, GOLD)
yy, xx = np.mgrid[0:ph, 0:pw].astype(np.float32)
PA = np.clip(np.minimum.reduce([xx, pw - 1 - xx, yy, ph - 1 - yy]) / 46, 0, 1).astype(np.float32)
PA = PA * PA * (3 - 2 * PA)

# implant centre-lines (pano crop coords), first point = apex, last point = platform
IMPL = [('zR', [(388,104), (540,292), (546,402)]), ('aR', [(710,208), (708,418)]),
        ('aL', [(850,206), (852,396)]), ('zL', [(1160,74), (1035,288), (1071,401)]),
        ('l1', [(585,608), (531,520), (529,466)]), ('l2', [(691,626), (692,470)]),
        ('l3', [(840,630), (836,474)]), ('l4', [(951,604), (1012,520), (1015,468)])]
implants = []
for name, pts in IMPL:
    band = np.zeros((ph, pw), np.uint8)
    cv2.polylines(band, [np.int32(pts)], False, 255, 46)
    v8 = (P[band > 0] * 255).astype(np.uint8)
    thr, _ = cv2.threshold(v8.reshape(-1, 1), 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    m = ((P * 255 > thr) & (band > 0)).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    n_, lab, st, _ = cv2.connectedComponentsWithStats(m)
    keep = np.zeros_like(m)
    for i in range(1, n_):
        if st[i, cv2.CC_STAT_AREA] > 120: keep[lab == i] = 1
    ys_, xs_ = np.nonzero(band)
    y0, y1, x0, x1 = ys_.min(), ys_.max() + 1, xs_.min(), xs_.max() + 1
    sl = (slice(y0, y1), slice(x0, x1))
    mm = cv2.GaussianBlur(keep.astype(np.float32), (0, 0), 1.0)[sl]
    # arc-length parameter u: 0 at platform (mouth side), 1 at apex
    pp = np.array(pts, np.float32); segs = pp[1:] - pp[:-1]; ln = np.linalg.norm(segs, axis=1)
    cum = np.concatenate([[0], np.cumsum(ln)])
    gy, gx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
    best_d = np.full(gy.shape, 1e9, np.float32); arc = np.zeros(gy.shape, np.float32)
    for k in range(len(segs)):
        a = pp[k]; d = segs[k]
        tt = np.clip(((gx - a[0]) * d[0] + (gy - a[1]) * d[1]) / (ln[k] ** 2), 0, 1)
        dist = np.hypot(gx - (a[0] + tt * d[0]), gy - (a[1] + tt * d[1]))
        upd = dist < best_d; best_d[upd] = dist[upd]; arc[upd] = cum[k] + tt[upd] * ln[k]
    u = 1 - arc / cum[-1]
    implants.append(dict(name=name, sl=sl, m=mm, u=u.astype(np.float32), pts=pts))
IMP = {d['name']: d for d in implants}

# ---------------------------------------------------------------- skull assets
sk = cv2.imread('skull_clean.png')[..., ::-1].astype(np.float32) / 255
SKS = 2.4                                                  # pre-upscale factor
sk = cv2.resize(sk, None, fx=SKS, fy=SKS, interpolation=cv2.INTER_LANCZOS4)
SL = cv2.cvtColor(np.clip(sk, 0, 1), cv2.COLOR_RGB2GRAY)
SL = cv2.bilateralFilter(SL, 9, 0.06, 6)
bl = cv2.GaussianBlur(SL, (0, 0), 2.0); SL = np.clip(SL + (SL - bl) * 0.9, 0, 1)
sh, sw = SL.shape
syy, sxx = np.mgrid[0:sh, 0:sw].astype(np.float32) / SKS
SA = np.clip((SL - 0.16) / 0.20, 0, 1)
rect = (np.clip((sxx - 100) / 34, 0, 1) * np.clip((508 - sxx) / 34, 0, 1) *
        np.clip((syy - 38) / 30, 0, 1) * np.clip((462 - syy) / 22, 0, 1))
SA = (SA * SA * (3 - 2 * SA) * rect).astype(np.float32)
SLs = np.clip((SL - 0.12) / 0.78, 0, 1) ** 0.9
SB, SN, SGOLD = apply(SLs, BONE), apply(SLs, NEON), apply(np.clip(SL * 1.1, 0, 1), GOLD)
SK_UP = [(211,334), (252,337), (294,332), (330,341)]
SK_LO = [(212,370), (247,372), (290,376), (332,374)]
SM = np.zeros((sh, sw), np.float32)
for (x, y) in SK_UP + SK_LO:
    d2 = ((sxx - x) ** 2 + (syy - y) ** 2)
    SM = np.maximum(SM, np.exp(-d2 / (2 * 6.5 ** 2)))
SM = SM * np.clip((SL - 0.45) / 0.25, 0, 1)
SM = cv2.GaussianBlur(SM, (0, 0), 1.2)
small = cv2.resize(SM[..., None] * GOLD_C, (sw // 2, sh // 2))
SGLOW = cv2.resize(cv2.GaussianBlur(small, (0, 0), 5) * 1.2 + cv2.GaussianBlur(small, (0, 0), 16) * 1.1, (sw, sh))

# ---------------------------------------------------------------- text sprites
def font(path, size, weight=None):
    f = ImageFont.truetype(path, size)
    if weight: f.set_variation_by_axes([weight])
    return f

def text_sprite(runs, stroke=7, stroke_col='#03121a', glow_col='#22d8ff', glow_r=16, glow_k=1.0, tracking=0):
    """runs: [(text, font, top_hex, bottom_hex)] laid out on a shared baseline."""
    d = ImageDraw.Draw(Image.new('L', (8, 8)))
    items, x = [], 0.
    for ri, (txt, f, c1, c2) in enumerate(runs):
        for ch in txt:
            items.append((ri, ch, f, x)); x += f.getlength(ch) + tracking
    bbs = [d.textbbox((x, 0), ch, font=f, anchor='ls', stroke_width=stroke) for _, ch, f, x in items]
    mnx, mny = min(b[0] for b in bbs), min(b[1] for b in bbs)
    mxx, mxy = max(b[2] for b in bbs), max(b[3] for b in bbs)
    pad = glow_r * 3 + 4
    w, h = int(mxx - mnx + 2 * pad), int(mxy - mny + 2 * pad)
    ox, oy = pad - mnx, pad - mny
    st_img = Image.new('L', (w, h)); sd = ImageDraw.Draw(st_img)
    fill = np.zeros((h, w, 3), np.float32); fm = np.zeros((h, w), np.float32)
    for ri, (txt, f, c1, c2) in enumerate(runs):
        mi = Image.new('L', (w, h)); md = ImageDraw.Draw(mi)
        for (rj, ch, ff, xx_) in items:
            if rj != ri: continue
            md.text((xx_ + ox, oy), ch, font=ff, anchor='ls', fill=255)
            sd.text((xx_ + ox, oy), ch, font=ff, anchor='ls', fill=255, stroke_width=stroke, stroke_fill=255)
        mk = np.asarray(mi, np.float32) / 255
        rows = np.nonzero(mk.max(1) > 0)[0]
        g = np.clip((np.arange(h) - rows.min()) / max(1, rows.max() - rows.min()), 0, 1)[:, None, None]
        col = hexrgb(c1) * (1 - g) + hexrgb(c2) * g
        fill = fill * (1 - mk[..., None]) + col * mk[..., None]; fm = np.maximum(fm, mk)
    sm = np.asarray(st_img, np.float32) / 255
    ga = np.clip(cv2.GaussianBlur(sm, (0, 0), glow_r) * 1.6 * glow_k, 0, 1)
    rgbp = hexrgb(glow_col) * ga[..., None] * 0.9; a = ga * 0.85
    sc = hexrgb(stroke_col)
    rgbp = rgbp * (1 - sm[..., None]) + sc * sm[..., None]; a = a * (1 - sm) + sm
    rgbp = rgbp * (1 - fm[..., None]) + fill * fm[..., None]; a = a * (1 - fm) + fm
    return dict(rgbp=rgbp.astype(np.float32), a=a.astype(np.float32), fm=fm.astype(np.float32))

T_ZYG = text_sprite([('ザイゴマインプラント', font(JP, 92, 900), '#ffffff', '#8ef1ff')], glow_col='#18d2ff')
T_AO4 = text_sprite([('オールオン', font(JP, 134, 900), '#ffffff', '#9ff3ff'),
                     ('4', font(JP, 250, 900), '#fff4c8', '#ff8a1f')], stroke=8, glow_col='#ff9a2a', glow_r=20)
E_ZYG = text_sprite([('ZYGOMATIC IMPLANT', font(EN, 34), '#bff7ff', '#5fe3f5')], stroke=0, glow_r=8, glow_k=.6, tracking=7)
E_AO4 = text_sprite([('ALL-ON-4', font(EN, 34), '#ffe2b0', '#ffae2e')], stroke=0, glow_col='#ff9a2a', glow_r=8, glow_k=.6, tracking=9)
NUMS = [text_sprite([(str(i), font(EN, 54), '#ffffff', '#ffd27a')], stroke=4, glow_col='#ff9a2a', glow_r=10) for i in range(1, 5)]

def blit(canvas, spr, cx, cy, scale=1., alpha=1., split=0., shine=None):
    rgbp, a, fm = spr['rgbp'], spr['a'], spr['fm']
    if alpha <= 0.003 or scale <= 0.01: return
    if abs(scale - 1) > 1e-3:
        sz = (max(1, int(a.shape[1] * scale)), max(1, int(a.shape[0] * scale)))
        rgbp, a, fm = cv2.resize(rgbp, sz), cv2.resize(a, sz), cv2.resize(fm, sz)
    if shine is not None:
        hh, ww = a.shape
        xs = np.arange(ww, dtype=np.float32)[None, :] - np.arange(hh, dtype=np.float32)[:, None] * 0.45
        band = np.exp(-((xs - shine * (ww + hh * .45 + 200) + 100) / 38) ** 2) * fm
        rgbp = rgbp + band[..., None] * 0.85
    hh, ww = a.shape
    offs = [(-split, 0), (0, 0), (split, 0)] if split else [(0, 0)] * 3
    for c in range(3):
        x0 = int(round(cx - ww / 2 + offs[c][0])); y0 = int(round(cy - hh / 2 + offs[c][1]))
        X0, Y0, X1, Y1 = max(0, x0), max(0, y0), min(W, x0 + ww), min(H, y0 + hh)
        if X1 <= X0 or Y1 <= Y0: continue
        aa = a[Y0 - y0:Y1 - y0, X0 - x0:X1 - x0] * alpha
        canvas[Y0:Y1, X0:X1, c] = canvas[Y0:Y1, X0:X1, c] * (1 - aa) + rgbp[Y0 - y0:Y1 - y0, X0 - x0:X1 - x0, c] * alpha

# ---------------------------------------------------------------- background
gy_, gx_ = np.mgrid[0:H, 0:W].astype(np.float32)
r = np.hypot((gx_ - W / 2) / W, (gy_ - H * .47) / H)
BG = (hexrgb('#02070b') + hexrgb('#0a3640') * np.clip(1 - r * 1.9, 0, 1)[..., None] ** 2).astype(np.float32)
VIG = np.clip(1.15 - r ** 1.6 * 1.35, 0.35, 1).astype(np.float32)[..., None]
GRID = np.zeros((H + 72, W), np.float32)
GRID[::72, :] = 1; GRID[:, ::72] = 1
GRID = cv2.GaussianBlur(GRID, (0, 0), 0.7) * 0.05
rng = np.random.default_rng(11)
NP = 150
PX, PY = rng.uniform(0, W, NP), rng.uniform(0, H, NP)
PV, PS, PPH = rng.uniform(25, 120, NP), rng.uniform(1.2, 3.6, NP), rng.uniform(0, 6.28, NP)
PC = np.where(rng.uniform(0, 1, NP)[:, None] < .72, CYAN_C, GOLD_C)
lgy, lgx = np.mgrid[0:240, 0:135].astype(np.float32)

def background(t, fill_src):
    bg = BG.copy()
    off = int(t * 18) % 72
    bg += GRID[off:off + H, :, None] * CYAN_C
    # light leaks (computed small, upsampled)
    lk = np.zeros((240, 135, 3), np.float32)
    for (cx, cy, rad, col, sp, ph_) in [(30, 40, 60, MAG_C, .35, 0), (110, 200, 70, GOLD_C, .27, 2), (120, 30, 50, CYAN_C, .4, 4)]:
        x = cx + 25 * math.sin(t * sp * 2 + ph_); y = cy + 30 * math.cos(t * sp * 1.6 + ph_)
        lk += np.exp(-((lgx - x) ** 2 + (lgy - y) ** 2) / (2 * rad ** 2))[..., None] * col * .10
    bg += cv2.resize(lk, (W, H))
    if fill_src is not None:   # big blurred colour fill from the main layer
        sm = cv2.resize(fill_src, (135, 240), interpolation=cv2.INTER_AREA)
        M = cv2.getRotationMatrix2D((67.5, 120), 0, 1.75)
        sm = cv2.GaussianBlur(cv2.warpAffine(sm, M, (135, 240)), (0, 0), 7)
        bg += cv2.resize(sm, (W, H)) * 0.42
    return bg

def particles(canvas, t, k=1.):
    lay = np.zeros((H, W, 3), np.float32)
    for i in range(NP):
        y = (PY[i] - PV[i] * t) % (H + 40) - 20
        x = PX[i] + 18 * math.sin(t * .8 + PPH[i])
        tw = .55 + .45 * math.sin(t * 3 + PPH[i] * 3)
        cv2.circle(lay, (int(x * 4), int(y * 4)), int(PS[i] * 4), (PC[i] * tw * .9).tolist(), -1, cv2.LINE_AA, 2)
    canvas += lay * k

def hud(canvas, t, k=1.):
    c = (CYAN_C * .75 * k).tolist(); m, L_ = 56, 86
    for (x, y, dx, dy) in [(m, m + 60, 1, 1), (W - m, m + 60, -1, 1), (m, H - m - 120, 1, -1), (W - m, H - m - 120, -1, -1)]:
        cv2.line(canvas, (x, y), (x + dx * L_, y), c, 3, cv2.LINE_AA)
        cv2.line(canvas, (x, y), (x, y + dy * L_), c, 3, cv2.LINE_AA)

# ---------------------------------------------------------------- effects
def bloom(img, k=1., streak=0.):
    s = cv2.resize(img, (W // 4, H // 4), interpolation=cv2.INTER_AREA)
    b = np.clip(s - 0.62, 0, None)
    g = cv2.GaussianBlur(b, (0, 0), 4) * 0.9 + cv2.GaussianBlur(b, (0, 0), 14) * 0.7
    if streak > 0:
        g += cv2.blur(b, (121, 1)) * streak * 6 * CYAN_C
    return img + cv2.resize(g, (W, H)) * k

def glitch(img, strength, seed):
    if strength <= 0.01: return img
    r_ = np.random.default_rng(seed); out = img.copy()
    for _ in range(int(4 + 10 * strength)):
        y0 = r_.integers(0, H - 20); hh = r_.integers(8, int(30 + 140 * strength))
        dx = int(r_.normal(0, 70 * strength)); y1 = min(H, y0 + hh)
        out[y0:y1] = np.roll(img[y0:y1], dx, axis=1)
        if r_.uniform() < .35 * strength:
            out[y0:y1] = out[y0:y1][..., r_.permutation(3)]
    sp = int(16 * strength)
    if sp:
        out[..., 0] = np.roll(out[..., 0], sp, 1); out[..., 2] = np.roll(out[..., 2], -sp, 1)
    return out

wy, wx = np.mgrid[0:H:8, 0:W:8].astype(np.float32)

def liquid_maps(t, amp):
    dx = amp * (np.sin(wy / 97 + t * 7.0) * np.cos(wx / 131 - t * 4.3) + .5 * np.sin((wx + wy) / 53 + t * 9))
    dy = amp * (np.cos(wx / 89 - t * 6.1) * np.sin(wy / 143 + t * 3.7) + .5 * np.cos((wx - wy) / 61 - t * 8))
    mx = cv2.resize(wx + dx, (W, H)); my = cv2.resize(wy + dy, (W, H))
    return mx.astype(np.float32), my.astype(np.float32)

def remap(img, mx, my): return cv2.remap(img, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)

# ---------------------------------------------------------------- timeline
# camera keys for the panorama: (time, scale, cx_pano, cy_pano, canvas_cy, easing-into-this-key)
CAM = [(0.0, 1.10, 784, 401, 900, 'lin'), (2.95, 1.21, 784, 401, 900, 'lin'),
       (3.35, 1.17, 774, 262, 980, 'io'), (6.95, 1.27, 774, 268, 980, 'lin'),
       (7.75, 1.42, 775, 545, 930, 'io'), (11.8, 1.53, 775, 548, 930, 'lin'),
       (12.4, 0.70, 784, 405, 830, 'io'), (99, 0.70, 784, 405, 830, 'lin')]

def cam(t):
    for (t0, *a), (t1, *b) in zip(CAM, CAM[1:]):
        if t0 <= t <= t1:
            k = seg(t, t0, t1); k = ease_io(k) if b[-1] == 'io' else k
            return [lerp(a[i], b[i], k) for i in range(4)]
    return CAM[-1][1:5]

def pano_M(t):
    s, cx, cy, ccy = cam(t)
    return np.float32([[s, 0, W / 2 - s * cx], [0, s, ccy - s * cy]])

SK_C = (272, 250)
def skull_M(t, theta=0.):
    s = (2.15 + 0.14 * smooth(seg(t, 14.0, 16.4))) * (1 + .9 * seg(t, T_CTA - .5, T_CTA) ** 2) / SKS
    ccy = 830
    A = np.float64([[s, 0, W / 2 - s * SK_C[0] * SKS], [0, s, ccy - s * SK_C[1] * SKS], [0, 0, 1]])
    if abs(theta) < 1e-4: return A
    f = 1700.; cth, sth = math.cos(theta), math.sin(theta)
    src = np.float32([[0, 0], [W, 0], [W, H], [0, H]])
    dst = []
    for (x, y) in src:
        X = (x - W / 2) * cth; Z = (x - W / 2) * sth
        dst.append([W / 2 + f * X / (f + Z), ccy + f * (y - ccy) / (f + Z)])
    Hr = cv2.getPerspectiveTransform(src, np.float32(dst)).astype(np.float64)
    return Hr @ A

T_SCAN = (0.45, 2.6)
LIGHT = {'zR': (3.55, .8), 'zL': (3.55, .8), 'aR': (6.0, .4), 'aL': (6.0, .4),
         'l1': (8.25, .28), 'l2': (8.55, .28), 'l3': (8.85, .28), 'l4': (9.15, .28)}

def neon_k(t): return .85 * bump(t, 6.95, 7.4, 7.9) + .75 * bump(t, 12.45, 13.25, 14.15)

def pano_layer(t):
    k = neon_k(t)
    base = PB if k < 1e-3 else PB * (1 - k) + PN * k
    if t < T_SCAN[1] + .05:
        yl = lerp(-60, ph + 60, ease_io(seg(t, *T_SCAN)))
        wr = np.clip((yl - np.arange(ph, dtype=np.float32)) / 50, 0, 1)[:, None, None]
        base = PG3 * (1 - wr) + base * wr
        line = np.exp(-((np.arange(ph, dtype=np.float32) - yl) / 5) ** 2)[:, None, None]
        halo = np.exp(-((np.arange(ph, dtype=np.float32) - yl) / 40) ** 2)[:, None, None]
        base = base + line * 1.3 * CYAN_C + halo * .25 * CYAN_C
    else:
        base = base.copy()
    gsrc = np.zeros_like(base)
    pulse = .85 + .15 * math.sin(t * 6)
    for d in implants:
        t0, dur = LIGHT[d['name']]
        prog = seg(t, t0, t0 + dur) * 1.15
        if prog <= 0: continue
        sl, m, u = d['sl'], d['m'], d['u']
        lit = m * np.clip((prog - u) / .07, 0, 1) * (pulse if prog >= 1.1 else 1)
        spark = m * np.exp(-((u - prog) / .05) ** 2) * (1 if prog < 1.12 else 0)
        b = base[sl]
        base[sl] = b * (1 - lit[..., None]) + PGOLD[sl] * lit[..., None] + spark[..., None] * 1.2
        gsrc[sl] += lit[..., None] * GOLD_C + spark[..., None] * hexrgb('#fff3d0') * 1.6
    if gsrc.any():
        s_ = cv2.resize(gsrc, (pw // 2, ph // 2), interpolation=cv2.INTER_AREA)
        g = cv2.GaussianBlur(s_, (0, 0), 4) * .5 + cv2.GaussianBlur(s_, (0, 0), 14) * .55
        base += cv2.resize(g, (pw, ph))
    return base

def pano_canvas(t):
    M = pano_M(t)
    rgb = pano_layer(t)
    rgbp = cv2.warpAffine(rgb * PA[..., None], M, (W, H), flags=cv2.INTER_LINEAR)
    a = cv2.warpAffine(PA, M, (W, H), flags=cv2.INTER_LINEAR)
    return rgbp, a

def skull_canvas(t, theta=0.):
    k = neon_k(t)
    pulse = .8 + .2 * math.sin(t * 6)
    e = smooth(seg(t, 12.9, 13.9))
    base = SB * (1 - k) + SN * k
    base = base * (1 - SM[..., None] * e) + SGOLD * SM[..., None] * e + SGLOW * e * pulse
    Mh = skull_M(t, theta)
    rgbp = cv2.warpPerspective(base * SA[..., None], Mh, (W, H), flags=cv2.INTER_LINEAR)
    a = cv2.warpPerspective(SA, Mh, (W, H), flags=cv2.INTER_LINEAR)
    return rgbp, a

# morph correspondences: pano crop coords <-> skull source coords
MP_P = [(546,402), (708,418), (852,396), (1071,401), (529,466), (692,470), (836,474), (1015,468),
        (388,104), (1160,74), (780,40), (780,770), (130,575), (1440,575), (0,0), (pw,0), (0,ph), (pw,ph)]
MP_S = SK_UP + SK_LO + [(150,222), (422,222), (276,150), (272,452), (150,388), (400,378),
        (95,40), (505,40), (130,462), (420,462)]
ANCH = [(0,0), (W,0), (0,H), (W,H), (W/2,0), (W/2,H), (0,H/2), (W,H/2)]
gpts = np.stack([wx.ravel(), wy.ravel()], 1)

def tf(pts, M):
    pts = np.float64(pts)
    q = np.c_[pts, np.ones(len(pts))] @ np.float64(M).T
    return q[:, :2] / q[:, 2:3] if q.shape[1] == 3 else q

def morph_maps(Pt, Psrc):
    rbf = RBFInterpolator(Pt, Psrc, kernel='thin_plate_spline')
    v = rbf(gpts).astype(np.float32)
    mx = cv2.resize(v[:, 0].reshape(wx.shape), (W, H)); my = cv2.resize(v[:, 1].reshape(wx.shape), (W, H))
    return mx, my

T_MORPH = (12.4, 14.0)

def text_anim(t, t_in, t_out=None, slam=True):
    """returns (scale, alpha, split) for a slam-in title."""
    if t < t_in: return 0, 0, 0
    x = seg(t, t_in, t_in + .38)
    sc = lerp(2.3, 1., ease_back(x, 1.6)) if slam else lerp(.6, 1, ease_back(x))
    al = smooth(seg(t, t_in, t_in + .12)); sp = 22 * (1 - ease_out(seg(t, t_in, t_in + .45)))
    if t_out is not None and t > t_out:
        y = seg(t, t_out, t_out + .3); sc *= 1 + .35 * ease_out(y); al *= 1 - y; sp += 30 * y
    return sc, al, sp

T_CTA = 16.65
SUBS = [(0.30, 3.30, '上あごの骨が少ない、と言われた方へ'),
        (3.40, 6.90, '頬の骨を支えにする、ザイゴマインプラント'),
        (7.55, 9.88, '下あごは、4本のインプラントで'),
        (9.88, 11.75, '支える、オールオン4'),
        (12.10, 13.98, '骨が少ないと言われた方も'),
        (13.98, 15.85, 'まずはご相談ください')]

def plain_sprite(text, size, weight=700, color='#ffffff', box=None, path=JP, tracking=0, padx=28, pady=14):
    f = font(path, size, weight if path == JP else None)
    d = ImageDraw.Draw(Image.new('L', (8, 8)))
    xs, x = [], 0.
    for ch in text:
        xs.append(x); x += f.getlength(ch) + tracking
    bbs = [d.textbbox((xx, 0), ch, font=f, anchor='ls') for xx, ch in zip(xs, text)]
    mnx, mny, mxx, mxy = min(b[0] for b in bbs), min(b[1] for b in bbs), max(b[2] for b in bbs), max(b[3] for b in bbs)
    asc, desc = f.getmetrics()
    w, h = int(mxx - mnx + 2 * padx), int(asc * .92 + desc * .45 + 2 * pady)
    tm = Image.new('L', (w, h)); td = ImageDraw.Draw(tm)
    for xx, ch in zip(xs, text):
        td.text((xx - mnx + padx, pady + asc * .92), ch, font=f, anchor='ls', fill=255)
    ta = np.asarray(tm, np.float32) / 255
    if box:
        bm = Image.new('L', (w, h)); ImageDraw.Draw(bm).rounded_rectangle((0, 0, w - 1, h - 1), radius=min(22, h // 2), fill=255)
        ba = np.asarray(bm, np.float32) / 255 * box[1]
    else:
        ba = np.zeros_like(ta)
    rgbp = hexrgb(box[0] if box else '#000000') * ba[..., None] * (1 - ta[..., None]) + hexrgb(color) * ta[..., None]
    a = ba * (1 - ta) + ta
    return dict(rgbp=rgbp.astype(np.float32), a=a.astype(np.float32), fm=ta.astype(np.float32))

SUB_SPR = [plain_sprite(s, 42, 700, box=('#02090d', .62)) for _, _, s in SUBS]
NOTE_SPR = plain_sprite('※治療の適応・効果には個人差があります', 24, 500, color='#d9e6ea', padx=8, pady=4)

def subtitle(img, t):
    for (a_, b_, _), spr in zip(SUBS, SUB_SPR):
        if a_ - .01 <= t < b_ + .12:
            al = smooth(seg(t, a_, a_ + .12)) * (1 - smooth(seg(t, b_, b_ + .12)))
            blit(img, spr, W / 2, 1585 + 6 * (1 - smooth(seg(t, a_, a_ + .15))), 1, al)

def note(img, t):
    blit(img, NOTE_SPR, W / 2, 1630, 1, .8 * smooth(seg(t, .4, 1.0)))

# ---------------------------------------------------------------- CTA page (booklet from the usual Meta ad card)
CARD = cv2.imread('drive/cta_card.png')[..., ::-1].astype(np.float32) / 255
COV = CARD[330:922, 285:794].copy()
def make_cover():
    ch, cw = COV.shape[:2]; pad = 70
    a = np.zeros((ch + 2 * pad, cw + 2 * pad), np.float32); a[pad:pad + ch, pad:pad + cw] = 1
    sh = np.roll(cv2.GaussianBlur(a, (0, 0), 22), 22, 0) * .75
    rgbp = np.zeros(a.shape + (3,), np.float32); rgbp[pad:pad + ch, pad:pad + cw] = COV
    al = np.maximum(a, sh)
    fm = a.copy()
    return dict(rgbp=rgbp, a=al, fm=fm)
COVER = make_cover()
NAVY = hexrgb('#111d38'); GOLDB = hexrgb('#c8a45c')
cty, ctx = np.mgrid[0:H, 0:W].astype(np.float32)
rr = np.hypot((ctx - W / 2) / W, (cty - 800) / H)
CTA_BG = (NAVY * .85 + hexrgb('#24467e') * np.clip(1 - rr * 2.1, 0, 1)[..., None] ** 1.6).astype(np.float32)
ry, rx = np.mgrid[-800:800, -800:800].astype(np.float32)
ang = np.arctan2(ry, rx); rad = np.hypot(rx, ry)
RAYS = ((np.cos(ang * 14) * .5 + .5) ** 6 * np.exp(-rad / 520) * np.clip(rad / 160, 0, 1)).astype(np.float32)
T_TITLE = text_sprite([('インプラントの無料小冊子', font(JP, 76, 900), '#ffffff', '#d9f1ff')], stroke=6, stroke_col='#0a1430', glow_col='#3cc8ff', glow_r=14, glow_k=.7)
TAG = text_sprite([('不安なまま、悩まなくていい。', font(JP, 54, 700), '#9ed6ff', '#6db8ee')], stroke=0, glow_col='#3a8fd8', glow_r=8, glow_k=.5)
FOOT = plain_sprite('医療法人スマイル ／ S.I.U.', 46, 700, padx=10, pady=6)
FOOT_EN = plain_sprite('SMILE IMPLANT UNIVERSE', 28, color='#c8a45c', path='/usr/share/fonts/opentype/inter/Inter-Bold.otf', tracking=2, padx=6, pady=4)

def make_button():
    bw, bh, pad = 860, 128, 40
    im = Image.new('L', (bw + 2 * pad, bh + 2 * pad)); fillm = Image.new('L', im.size); txt = Image.new('L', im.size)
    ImageDraw.Draw(im).rounded_rectangle((pad, pad, pad + bw, pad + bh), radius=26, fill=255)
    ImageDraw.Draw(fillm).rounded_rectangle((pad + 6, pad + 6, pad + bw - 6, pad + bh - 6), radius=21, fill=255)
    f = font(JP, 64, 900)
    ImageDraw.Draw(txt).text((pad + bw / 2, pad + bh / 2 + 2), '詳細を見る ▶', font=f, anchor='mm', fill=255)
    outer = np.asarray(im, np.float32) / 255; inner = np.asarray(fillm, np.float32) / 255; tm = np.asarray(txt, np.float32) / 255
    glow = cv2.GaussianBlur(outer, (0, 0), 14) * .55
    rgbp = GOLDB * glow[..., None]; a = glow * .8
    rgbp = rgbp * (1 - outer[..., None]) + GOLDB * outer[..., None]; a = a * (1 - outer) + outer
    rgbp = rgbp * (1 - inner[..., None]) + hexrgb('#16284e') * inner[..., None]
    rgbp = rgbp * (1 - tm[..., None]) + tm[..., None]
    return dict(rgbp=rgbp.astype(np.float32), a=a.astype(np.float32), fm=inner.astype(np.float32))
BUTTON = make_button()

def blit_persp(canvas, spr, cx, cy, scale, theta, alpha=1., shine=None):
    rgbp, a = spr['rgbp'], spr['a']
    if shine is not None:
        hh, ww = a.shape
        xs = np.arange(ww, dtype=np.float32)[None, :] - np.arange(hh, dtype=np.float32)[:, None] * .5
        band = np.exp(-((xs - shine * (ww + hh * .5 + 300) + 150) / 45) ** 2) * spr['fm']
        rgbp = rgbp + band[..., None] * .55
    h, w = a.shape; f = 1500.; c_, s_ = math.cos(theta), math.sin(theta)
    dst = []
    for (x, y) in [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)]:
        X, Z, Y = x * c_ * scale, x * s_ * scale, y * scale
        dst.append([cx + f * X / (f + Z), cy + f * Y / (f + Z)])
    dst = np.float32(dst); x0, y0 = np.floor(dst.min(0)).astype(int); x1, y1 = np.ceil(dst.max(0)).astype(int)
    X0, Y0, X1, Y1 = max(0, x0), max(0, y0), min(W, x1), min(H, y1)
    if X1 <= X0 or Y1 <= Y0: return
    M = cv2.getPerspectiveTransform(np.float32([[0, 0], [w, 0], [w, h], [0, h]]), dst - np.float32([X0, Y0]))
    rw = cv2.warpPerspective(rgbp, M, (X1 - X0, Y1 - Y0)); aw = cv2.warpPerspective(a, M, (X1 - X0, Y1 - Y0)) * alpha
    canvas[Y0:Y1, X0:X1] = canvas[Y0:Y1, X0:X1] * (1 - aw[..., None]) + rw * alpha

def cta_frame(t):
    tc = t - T_CTA
    img = CTA_BG.copy()
    lk = np.zeros((240, 135, 3), np.float32)
    for (cx, cy, rad_, col, sp, ph_) in [(25, 60, 55, CYAN_C, .4, 0), (115, 170, 60, GOLD_C, .3, 2)]:
        x = cx + 20 * math.sin(t * sp * 2 + ph_); y = cy + 25 * math.cos(t * sp * 1.6 + ph_)
        lk += np.exp(-((lgx - x) ** 2 + (lgy - y) ** 2) / (2 * rad_ ** 2))[..., None] * col * .09
    img += cv2.resize(lk, (W, H))
    # rotating light rays behind the booklet
    rk = smooth(seg(tc, .1, .8)) * (.85 + .15 * math.sin(t * 3))
    M = cv2.getRotationMatrix2D((800, 800), tc * 9, 1.0); M[0, 2] += W / 2 - 800; M[1, 2] += 790 - 800
    rays = cv2.warpAffine(RAYS, M, (W, H))
    img += rays[..., None] * (GOLD_C * .55 + CYAN_C * .25) * .5 * rk
    halo = np.exp(-(((ctx - W / 2) / 360) ** 2 + ((cty - 790) / 420) ** 2))
    img += halo[..., None] * hexrgb('#3b6fb8') * .35 * rk
    particles(img, t, k=.6)
    # title
    sc, al, sp = text_anim(t, T_CTA + .05)
    blit(img, T_TITLE, W / 2, 300, sc, al, sp)
    # booklet flips in, then floats
    x = seg(tc, .15, .85)
    if x > 0:
        th = math.radians(78) * (1 - ease_back(x, 1.3)) + math.radians(3.5) * math.sin(tc * 1.7) * smooth(seg(tc, .85, 1.4))
        scl = lerp(.55, 1.12, ease_out(x)) * (1 + .012 * math.sin(tc * 2.3))
        shn = None
        for s0 in (1.05, 2.9):
            if s0 < tc < s0 + .8: shn = seg(tc, s0, s0 + .8)
        blit_persp(img, COVER, W / 2, 790 + 8 * math.sin(tc * 2.1), scl, th, smooth(seg(tc, .15, .35)), shine=shn)
    # tagline, button, footer
    blit(img, TAG, W / 2, 1200 + 20 * (1 - ease_out(seg(tc, .8, 1.15))), 1, smooth(seg(tc, .8, 1.1)))
    y = seg(tc, 1.1, 1.45)
    if y > 0:
        pulse = 1 + .028 * math.sin((tc - 1.5) * 2 * math.pi * 1.2) * smooth(seg(tc, 1.5, 1.9))
        shn = ((tc - 1.7) % 1.6) / 1.0 if tc > 1.7 and ((tc - 1.7) % 1.6) < 1.0 else None
        blit(img, BUTTON, W / 2, 1352, lerp(.4, 1, ease_back(y, 2)) * pulse, smooth(seg(tc, 1.1, 1.25)), shine=shn)
    fa = smooth(seg(tc, 1.35, 1.7))
    if fa > 0:
        L_ = int(240 * fa)
        cv2.line(img, (W // 2 - L_, 1468), (W // 2 + L_, 1468), GOLDB.tolist(), 2, cv2.LINE_AA)
        blit(img, FOOT, W / 2, 1520, 1, fa)
        blit(img, FOOT_EN, W / 2, 1572, 1, fa)
    note(img, t)
    return img

SLAMS = [5.38, 10.33, 14.15, 14.55, T_CTA + .05]

def frame(t):
    img = cta_frame(t) if t >= T_CTA else main_frame(t)
    return post(img, t)

def main_frame(t):
    # ---- main layer
    if t < T_MORPH[0]:
        rgbp, a = pano_canvas(t)
    elif t < T_MORPH[1]:
        w = ease_io(seg(t, *T_MORPH)); cx = smooth(seg(w, .3, .72))
        M0 = pano_M(T_MORPH[0]); M1 = skull_M(T_MORPH[1])
        P0 = np.r_[tf(MP_P, M0), ANCH]; P1 = np.r_[tf(np.float64(MP_S) * SKS, M1), ANCH]
        Pt = (1 - w) * P0 + w * P1
        r0, a0 = pano_canvas(t); r1, a1 = skull_canvas(t)
        mx0, my0 = morph_maps(Pt, P0); mx1, my1 = morph_maps(Pt, P1)
        r0, a0 = remap(r0, mx0, my0), remap(a0, mx0, my0)
        r1, a1 = remap(r1, mx1, my1), remap(a1, mx1, my1)
        rgbp = r0 * (1 - cx) + r1 * cx; a = a0 * (1 - cx) + a1 * cx
        rgbp = rgbp * (1 + 0.35 * bump(t, T_MORPH[0], 13.2, T_MORPH[1]))
    else:
        theta = math.radians(9) * math.sin((t - T_MORPH[1]) * 1.4) * smooth(seg(t, T_MORPH[1], T_MORPH[1] + .8))
        rgbp, a = skull_canvas(t, theta)
    # liquid warp transitions
    amp = (46 * bump(t, 6.95, 7.4, 7.9) + 18 * bump(t, 12.4, 13.15, 14.0) + 10 * bump(t, 0, .05, .5)
           + 60 * bump(t, T_CTA - .5, T_CTA, T_CTA + .01))
    if amp > .5:
        mx, my = liquid_maps(t, amp); rgbp, a = remap(rgbp, mx, my), remap(a, mx, my)
    # intro flicker
    if t < .5:
        fl = [0, .7, 0, 1, .2, .9, 1, .4, 1, 1, .8, 1, 1, 1, 1][min(14, int(t * 30))]
        rgbp, a = rgbp * fl, a * fl
    # ---- background + composite
    img = background(t, rgbp)
    hud(img, t, k=smooth(seg(t, .3, 1.0)))
    img = img * (1 - a[..., None]) + rgbp
    particles(img, t, k=.9)
    # ring pulses on implants
    rings = [('zR', 3.65), ('zL', 3.65), ('zR', 4.2), ('zL', 4.2), ('l1', 8.3), ('l2', 8.6), ('l3', 8.9), ('l4', 9.2)]
    if t < T_MORPH[0]:
        M = pano_M(t)
        rl = None
        for nm, t0 in rings:
            x = seg(t, t0, t0 + .7)
            if 0 < x < 1:
                ap = IMP[nm]['pts'][0] if nm[0] == 'z' else np.mean(IMP[nm]['pts'], 0)
                q = tf([ap], M)[0]
                col = (GOLD_C * (1 - x) * 1.4).tolist()
                if rl is None: rl = np.zeros((H, W, 3), np.float32)
                cv2.circle(rl, (int(q[0] * 4), int(q[1] * 4)), int((14 + 120 * ease_out(x)) * 4), col, 5, cv2.LINE_AA, 2)
        if rl is not None: img += rl
        # implant counter 1-4 for All-on-4
        for i, nm in enumerate(['l1', 'l2', 'l3', 'l4']):
            t0 = LIGHT[nm][0]
            if t >= t0 and t < 12.1:
                q = tf([IMP[nm]['pts'][0]], M)[0]
                sc = lerp(.2, 1, ease_back(seg(t, t0, t0 + .3))); al = 1 - seg(t, 11.75, 12.05)
                blit(img, NUMS[i], q[0], q[1] + 70, sc, al)
    # ---- titles
    sc, al, sp = text_anim(t, 5.38, 6.95)
    blit(img, E_ZYG, W / 2, 330, 1, al * smooth(seg(t, 5.68, 6.03)))
    blit(img, T_ZYG, W / 2, 430, sc, al, sp, shine=seg(t, 6.0, 6.8) if 6.0 < t < 6.8 else None)
    sc, al, sp = text_anim(t, 10.33, 11.8)
    blit(img, E_AO4, W / 2, 1280, 1, al * smooth(seg(t, 10.6, 10.9)))
    blit(img, T_AO4, W / 2, 1405, sc, al, sp, shine=seg(t, 10.9, 11.5) if 10.9 < t < 11.5 else None)
    # finale
    sh_ = None
    for s0 in (15.05, 15.75):
        if s0 < t < s0 + .6: sh_ = seg(t, s0, s0 + .6)
    sc, al, sp = text_anim(t, 14.15, T_CTA - .45)
    blit(img, E_ZYG, W / 2, 222, 1, al * smooth(seg(t, 14.4, 14.7)))
    blit(img, T_ZYG, W / 2, 306, sc, al, sp, shine=sh_)
    sc, al, sp = text_anim(t, 14.55, T_CTA - .45)
    blit(img, E_AO4, W / 2, 1296, 1, al * smooth(seg(t, 14.8, 15.1)))
    blit(img, T_AO4, W / 2, 1415, sc, al, sp, shine=sh_)
    subtitle(img, t)
    note(img, t)
    return img

def post(img, t):
    # ---- flashes, shake, glitch, bloom
    flash = sum(.55 * (1 - ease_out(seg(t, s, s + .28))) for s in SLAMS if s <= t < s + .28)
    flash += .3 * bump(t, 12.95, 13.15, 13.5) + .5 * bump(t, 7.25, 7.4, 7.6) + .7 * bump(t, T_CTA - .12, T_CTA, T_CTA + .35)
    streak = sum(1 - seg(t, s, s + .5) for s in SLAMS if s <= t < s + .5)
    img = bloom(img, (1.0 + .6 * flash) * (1 - .55 * smooth(seg(t, T_CTA + .2, T_CTA + .8))), streak=streak * .6)
    img = img * VIG + flash * .8
    shake = sum(16 * (1 - seg(t, s, s + .35)) for s in SLAMS if s <= t < s + .35)
    if shake > .5:
        r_ = np.random.default_rng(int(t * 1000))
        M = np.float32([[1, 0, r_.normal(0, shake)], [0, 1, r_.normal(0, shake)]])
        img = cv2.warpAffine(img, M, (W, H), borderMode=cv2.BORDER_REFLECT)
    gl = (.9 * (1 - seg(t, 0, .55)) + sum(.6 * (1 - seg(t, s, s + .2)) for s in SLAMS if s <= t < s + .2)
          + .5 * bump(t, 6.95, 7.25, 7.55) + .4 * bump(t, 12.55, 13.05, 13.45) + .3 * bump(t, 11.8, 11.95, 12.2)
          + .7 * bump(t, T_CTA - .4, T_CTA - .05, T_CTA + .25))
    img = glitch(img, gl, int(t * 30) + 3)
    return (np.clip(img, 0, 1) * 255 + .5).astype(np.uint8)

if __name__ == '__main__':
    if sys.argv[1] == 'preview':
        for ts in sys.argv[2:]:
            t = float(ts)
            cv2.imwrite(f'prev_{t:05.2f}.jpg', frame(t)[..., ::-1], [cv2.IMWRITE_JPEG_QUALITY, 88])
            print('ok', t, flush=True)
    else:
        out = sys.argv[2]
        ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24',
                               '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-', '-c:v', 'libx264', '-preset', 'slow',
                               '-crf', '17', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out],
                              stdin=subprocess.PIPE)
        for i in range(NF):
            ff.stdin.write(frame(i / FPS).tobytes())
            if i % 30 == 0: print('frame', i, flush=True)
        ff.stdin.close(); ff.wait()
