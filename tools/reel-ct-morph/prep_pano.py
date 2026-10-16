import cv2, numpy as np
im = cv2.imread('src.jpg')

# --- panoramic: rectify keystone, crop out serial number / patient header / "R" marker
src = np.float32([[232,32],[1890,28],[262,868],[1845,880]])
W, H = 1640, 860
M = cv2.getPerspectiveTransform(src, np.float32([[0,0],[W,0],[0,H],[W,H]]))
r = cv2.warpPerspective(im, M, (W, H), flags=cv2.INTER_CUBIC)
r = r[40:842, 36:1604]
g = cv2.cvtColor(r, cv2.COLOR_BGR2GRAY).astype(np.float32)
# suppress monitor moire (vertical stripes): notch the horizontal-frequency peaks
F = np.fft.fftshift(np.fft.fft2(g))
h, w = g.shape; cy, cx = h//2, w//2
mag = np.log1p(np.abs(F))
band = np.zeros_like(g, bool); band[cy-3:cy+4, :] = True
band[:, cx-25:cx+26] = False
loc = mag * band
thr = np.percentile(loc[band], 99.3)
notch = (loc > thr)
notch = cv2.dilate(notch.astype(np.uint8), np.ones((5,9),np.uint8)) > 0
F[notch] = 0
g2 = np.real(np.fft.ifft2(np.fft.ifftshift(F)))
g2 = cv2.GaussianBlur(g2, (0,0), sigmaX=1.2, sigmaY=0.6)
g2 = np.clip(g2, 0, 255).astype(np.uint8)
# flatten illumination + local contrast
bg = cv2.GaussianBlur(g2.astype(np.float32), (0,0), 120)
flat = g2.astype(np.float32) / (bg + 1) * bg.mean()
flat = np.clip(flat, 0, 255).astype(np.uint8)
clahe = cv2.createCLAHE(clipLimit=2.2, tileGridSize=(8,8))
eq = clahe.apply(flat)
cv2.imwrite('pano_gray.png', eq)
# implant mask: brightest structures relative to local background
th = cv2.morphologyEx(g2, cv2.MORPH_TOPHAT, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (61,61)))
m = (th > 38).astype(np.uint8)*255
m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3,3),np.uint8))
n, lab, st, _ = cv2.connectedComponentsWithStats(m)
keep = np.zeros_like(m)
for i in range(1, n):
    if st[i, cv2.CC_STAT_AREA] > 400: keep[lab==i] = 255
keep = cv2.morphologyEx(keep, cv2.MORPH_CLOSE, np.ones((5,5),np.uint8))
cv2.imwrite('pano_mask.png', keep)
print('pano', eq.shape)

# --- 3D skull render: crop, remove UI overlay lines and cursor
s = im[955:1490, 1205:1790].copy()
hsv = cv2.cvtColor(s, cv2.COLOR_BGR2HSV)
H_, S_, V_ = hsv[...,0].astype(int), hsv[...,1].astype(int), hsv[...,2].astype(int)
overlay = ((S_ > 70) & ((H_ > 40) & (H_ < 165)) & (V_ > 60))
overlay = cv2.dilate(overlay.astype(np.uint8)*255, np.ones((5,5),np.uint8))
cv2.imwrite('skull_overlay_mask.png', overlay)
s_in = cv2.inpaint(s, overlay, 7, cv2.INPAINT_TELEA)
cv2.imwrite('skull_raw.png', s_in)
