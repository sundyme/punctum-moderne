"""Score the film with an ElevenLabs music bed, edited to the picture, plus the picture-locked foley layer.

    SCORE_ONLY=fx,keys SCORE_FOLEY=1 SCORE_OUT=assets/el/stem_foley.wav python3 tools/score.py
    python3 tools/mix_el.py            → assets/score_el.wav (mastered, -14 LUFS, -1 dBTP)

The bed (assets/el/v4.mp3) is 120 bpm with its bars on even seconds; the edit list maps film time F to
bed time A = F + off, cutting only on downbeats with a short crossfade just before the beat.
"""
import json
import os
import subprocess
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
FILM = os.path.dirname(HERE)
EL = os.path.join(FILM, "assets", "el")
SR = 48000
DUR = 72.0
N = int(DUR * SR)
T = np.arange(N) / SR

# film [f0, f1) ← bed f + off   (the bed's kicks sit 20 ms late: mp3 priming + attack)
EDL = [(0.0, 62.0, 0.02),     # intro pulses → groove on the 8 s hit; its own break lands on the printer (54–56)
       (62.0, 68.0, 8.02),    # the bed's two-bar break = the riser; its re-entry = the 64 s drop
       (68.0, 72.0, 17.95)]   # the bed's final hit and decay = the signature card
XF, PRE = 0.012, 0.015        # crossfade half-width, and how far before the downbeat it sits


def load(p, sr=SR):
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", p, "-ac", "2", "-ar", str(sr), "-f", "f32le", "-"], capture_output=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64).reshape(-1, 2).T.copy()


def stft_filter(x, cutoff, hop=512, nfft=4096):
    n = len(x)
    win = np.hanning(nfft)
    f = np.fft.rfftfreq(nfft, 1 / SR)
    out = np.zeros(n + nfft)
    norm = np.zeros(n + nfft)
    xp = np.concatenate([x, np.zeros(nfft)])
    for j in range(0, n, hop):
        fc = cutoff[min(j + nfft // 2, n - 1)]
        m = 1 / np.sqrt(1 + (f / fc) ** 4)
        out[j:j + nfft] += np.fft.irfft(np.fft.rfft(xp[j:j + nfft] * win) * m, nfft) * win
        norm[j:j + nfft] += win ** 2
    return out[:n] / np.maximum(norm[:n], 1e-6)


bed = load(os.path.join(EL, "v4.mp3"))
music = np.zeros((2, N))
for k, (f0, f1, off) in enumerate(EDL):
    a = f0 - PRE - XF if k else 0.0
    b = f1 - PRE + XF if k < len(EDL) - 1 else DUR
    i0, i1 = int(round(a * SR)), int(round(b * SR))
    src0 = int(round((a + off) * SR))
    seg = np.zeros((2, i1 - i0))
    s = bed[:, max(0, src0):max(0, src0) + (i1 - i0)]
    seg[:, : s.shape[1]] = s
    t = (np.arange(i1 - i0) + i0) / SR
    g = np.ones_like(t)
    if k:
        g *= np.sin(np.pi / 2 * np.clip((t - (f0 - PRE - XF)) / (2 * XF), 0, 1))
    if k < len(EDL) - 1:
        g *= np.cos(np.pi / 2 * np.clip((t - (f1 - PRE - XF)) / (2 * XF), 0, 1))
    music[:, i0:i1] += seg * g

# the last hit rings out under the signature card: a long, dark tail from its own reverb
def tail_ir(sec=3.2, seed=11):
    r = np.random.default_rng(seed)
    n = int(sec * SR)
    t = np.arange(n) / SR
    ir = np.zeros((2, n))
    for c in range(2):
        X = np.fft.rfft(r.standard_normal(n) * np.exp(-t / 0.9))
        f = np.fft.rfftfreq(n, 1 / SR)
        X *= 1 / (1 + (f / 3500) ** 2)
        ir[c] = np.fft.irfft(X, n)
    return ir / np.abs(ir).max()


i68 = int(67.9 * SR)
ir = tail_ir()
for c in range(2):
    src = music[c, i68:]
    L_ = len(src) + ir.shape[1]
    nf = 1 << (L_ - 1).bit_length()
    wet = np.fft.irfft(np.fft.rfft(src, nf) * np.fft.rfft(ir[c], nf), nf)[: len(src)]
    wet *= 0.35 * np.std(src[: int(1.5 * SR)]) / (np.std(wet[: int(1.5 * SR)]) + 1e-12)
    music[c, i68:] += wet

# picture moments the bed cannot know: the opening carrier, the CRT heard through glass, the midnight italic
lp = np.interp(T, [0, 1.9, 3.5, 23.95, 24.1, 27.5, 27.75, 35.9, 36.3, 41.8, 42.0, 72],
               [1400, 1400, 20000, 20000, 1300, 1900, 20000, 20000, 3600, 4200, 20000, 20000])
for c in range(2):
    music[c] = stft_filter(music[c], lp)
mg = np.interp(T, [0, 35.9, 36.3, 41.8, 42.0, 72], [1, 1, 0.8, 0.8, 1, 1])
music *= mg[None, :]

# picture-locked foley (morse, pops, labels, drums, relays, flaps, printer, blinks …), louder where the bed is busy
fol = load(os.path.join(EL, "stem_foley.wav"))[:, :N]
fol = np.pad(fol, ((0, 0), (0, N - fol.shape[1])))
for c in range(2):  # keep the sub for the bed's kick
    F = np.fft.rfft(fol[c]); f = np.fft.rfftfreq(N, 1 / SR); F *= 1 / np.sqrt(1 + (70 / np.maximum(f, 1)) ** 4); fol[c] = np.fft.irfft(F, N)
fg = np.interp(T, [0, 6, 6.5, 46, 46.3, 53.9, 54.0, 56.0, 56.2, 62, 72], [0.62, 0.62, 0.42, 0.42, 0.85, 0.85, 0.7, 0.7, 0.5, 0.45, 0.5])
mix = music + fol * fg[None, :]

# master: rumble cut, gentle limiter, then two-pass EBU R128 loudness to -14 LUFS / -1 dBTP
mix -= mix.mean(axis=1, keepdims=True)
mix *= np.clip((DUR - T) / 0.08, 0, 1)[None, :] * np.clip(T / 0.003, 0, 1)[None, :]
pk = np.abs(mix).max()
mix = np.tanh(mix / pk * 1.25) / np.tanh(1.25) * 0.9
tmp = os.path.join(EL, "premaster.wav")
with wave.open(tmp, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(mix.T, -1, 1) * 32767).astype("<i2").tobytes())
out = os.path.join(FILM, "assets", "score_el.wav")
m = subprocess.run(["ffmpeg", "-hide_banner", "-i", tmp, "-af", "loudnorm=I=-14:TP=-1:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True).stderr
js = json.loads(m[m.rindex("{"): m.rindex("}") + 1])
af = (f"loudnorm=I=-14:TP=-1:LRA=11:measured_I={js['input_i']}:measured_TP={js['input_tp']}:measured_LRA={js['input_lra']}"
      f":measured_thresh={js['input_thresh']}:offset={js['target_offset']}:linear=true")
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp, "-af", af, "-ar", str(SR), out], check=True)
print(out, "input", js["input_i"], "LUFS", js["input_tp"], "dBTP")
