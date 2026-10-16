import cv2, numpy as np
s = cv2.imread('src.jpg')[955:1490, 1205:1790].copy()
hsv = cv2.cvtColor(s, cv2.COLOR_BGR2HSV).astype(int)
H, S, V = hsv[...,0], hsv[...,1], hsv[...,2]
ov = ((S > 40) & (H > 40) & (H < 165) & (V > 50)).astype(np.uint8)*255
ex = np.zeros_like(ov)
for p, q in [((129,22),(111,515)), ((133,22),(123,515)), ((15,250),(545,261)), ((15,302),(545,313)), ((25,45),(550,52))]:
    cv2.line(ex, p, q, 255, 9)
cv2.rectangle(ex, (352,80), (378,118), 255, -1)   # mouse cursor
mask = cv2.dilate(cv2.bitwise_or(ov, ex), np.ones((3,3),np.uint8))
clean = cv2.inpaint(s, mask, 9, cv2.INPAINT_TELEA)
clean = cv2.inpaint(clean, mask, 9, cv2.INPAINT_NS)
L = cv2.cvtColor(clean, cv2.COLOR_BGR2GRAY)
fg = (L > 30).astype(np.uint8)
fg[:36] = 0; fg[462:] = 0; fg[:, :88] = 0; fg[:, 512:] = 0
fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(31,31)))
n, lab, st, _ = cv2.connectedComponentsWithStats(fg)
big = 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])
fg = (lab == big).astype(np.uint8)*255
ff = fg.copy(); h, w = fg.shape
cv2.floodFill(ff, np.zeros((h+2,w+2),np.uint8), (0,0), 255)
fg = fg | cv2.bitwise_not(ff)
fg = cv2.erode(fg, np.ones((5,5),np.uint8))
cv2.imwrite('skull_clean.png', clean)
cv2.imwrite('skull_fg.png', fg)
v = clean.copy(); v[fg==0] = (v[fg==0]*0.25).astype(np.uint8)
cv2.imwrite('v_skull_clean.png', cv2.resize(v, None, fx=1.5, fy=1.5))
