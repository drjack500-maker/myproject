import sys, subprocess, numpy as np
from faster_whisper import WhisperModel
m = WhisperModel('small', device='cpu', compute_type='int8')
for f in sys.argv[1:]:
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-ac', '1', '-ar', '16000', '-f', 's16le', '-'], capture_output=True).stdout
    a = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
    segs, info = m.transcribe(a, language='ja', word_timestamps=True)
    segs = list(segs)
    words = [w for s in segs for w in s.words]
    print(f, '|', ''.join(s.text for s in segs), '| speech', round(words[0].start, 2) if words else None, '-', round(words[-1].end, 2) if words else None, '| dur', round(len(a)/16000, 2), flush=True)
