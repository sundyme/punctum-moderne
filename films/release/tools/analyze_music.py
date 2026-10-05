"""Analyse candidate music beds against the film's grid (120 bpm, chapters, drop at 64 s).
python3 tools/analyze_music.py a.mp3 b.mp3 …   → tempo, beat phase, key, energy per chapter, biggest rise."""
import subprocess
import sys

import numpy as np

SR = 22050
CHAP = [0, 6, 10, 16, 20, 24, 28, 36, 46, 54, 62, 64, 68, 72]
KS_MAJ = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
KS_MIN = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
NAMES = "C C# D D# E F F# G G# A A# B".split()


def load(p):
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", p, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)


def analyse(p):
    x = load(p)
    dur = len(x) / SR
    hop, nfft = 512, 2048
    win = np.hanning(nfft)
    frames = np.lib.stride_tricks.sliding_window_view(np.pad(x, (0, nfft)), nfft)[::hop]
    S = np.abs(np.fft.rfft(frames * win, axis=1))
    f = np.fft.rfftfreq(nfft, 1 / SR)
    fps = SR / hop
    # onset envelope (log spectral flux)
    L = np.log1p(S * 10)
    flux = np.maximum(np.diff(L, axis=0), 0).sum(1)
    flux = np.concatenate([[0], flux])
    flux -= np.convolve(flux, np.ones(16) / 16, mode="same")
    flux = np.maximum(flux, 0)
    # tempo by autocorrelation
    ac = np.correlate(flux, flux, mode="full")[len(flux) - 1:]
    lags = np.arange(len(ac)) / fps
    bpms = 60 / np.maximum(lags, 1e-9)
    m = (bpms > 70) & (bpms < 180)
    best = bpms[m][np.argmax(ac[m])]
    # beat phase against a 120-bpm grid starting at 0 (offset in seconds, 0..0.5)
    t = np.arange(len(flux)) / fps
    offs = np.linspace(0, 0.5, 101)[:-1]
    sc = []
    for o in offs:
        idx = np.round((np.arange(o, dur, 0.5)) * fps).astype(int)
        idx = idx[idx < len(flux)]
        sc.append(flux[idx].mean())
    sc = np.array(sc)
    phase = offs[np.argmax(sc)]
    grid_strength = sc.max() / (flux.mean() + 1e-9)
    # key
    pc = np.zeros(12)
    band = (f > 60) & (f < 2000)
    midi = 69 + 12 * np.log2(f[band] / 440)
    w = S[:, band].sum(0)
    for mm, ww in zip(midi, w):
        pc[int(round(mm)) % 12] += ww
    keys = []
    for k in range(12):
        keys.append((np.corrcoef(np.roll(KS_MAJ, k), pc)[0, 1], NAMES[k] + " maj"))
        keys.append((np.corrcoef(np.roll(KS_MIN, k), pc)[0, 1], NAMES[k] + " min"))
    keys.sort(reverse=True)
    # loudness per chapter
    rms = np.sqrt((frames[:, :hop] ** 2).mean(1) + 1e-12)
    db = lambda a, b: 20 * np.log10(rms[(t >= a) & (t < b)].mean() + 1e-12)
    ch = [f"{a:g}:{db(a, b):.0f}" for a, b in zip(CHAP[:-1], CHAP[1:]) if a < dur]
    # biggest 1-s energy rise (a drop)
    e = np.convolve(rms, np.ones(int(fps)) / fps, mode="same")
    rise = e[int(fps):] - e[:-int(fps)]
    tr = (np.argmax(rise) + int(fps)) / fps
    # quiet tail
    tail = db(dur - 2, dur)
    print(f"{p.split('/')[-1]}: dur {dur:.1f}s  tempo {best:.1f}  phase {phase:.3f}s grid {grid_strength:.2f}  key {keys[0][1]} ({keys[0][0]:.2f}) / {keys[1][1]}  drop≈{tr:.1f}s  tail {tail:.0f}dB")
    print("   ", " ".join(ch))


for p in sys.argv[1:]:
    analyse(p)
