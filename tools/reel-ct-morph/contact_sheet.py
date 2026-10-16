import sys, cv2, numpy as np
fs = sys.argv[2:]; ims = [cv2.resize(cv2.imread(f), (432, 768)) for f in fs]
for im, f in zip(ims, fs): cv2.putText(im, f[5:-4], (10, 30), 0, .9, (0, 255, 0), 2)
cv2.imwrite(sys.argv[1], np.hstack(ims))
