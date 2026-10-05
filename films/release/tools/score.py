"""Score for PUNCTUM MODERNE · RELEASE 2.400 — 72 s, 120 bpm, D minor, cut to the picture.

    node tools/export_events.cjs && python3 tools/score.py   →  assets/score.wav

The arrangement follows the twelve chapters: a carrier tone and Morse, plucked dots,
a marquee groove, riso drums, weight slams, LED buzz and scan sweeps, a CRT section
heard through a closed filter, a stepper-motor grid, a midnight italic in half time,
split-flap clatter, an eight-cut montage, a tunnel riser, the drop, and one blinking dot.
Everything is synthesized here with numpy; deterministic (seeded).
"""
import json
import math
import os
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
FILM = os.path.dirname(HERE)
EV = json.load(open(os.path.join(FILM, "assets", "events.json")))
SR = 48000
DUR = 72.0
N = int(DUR * SR)
T = np.arange(N) / SR
BEAT, BAR = 0.5, 2.0
rng = np.random.default_rng(2400)

BUSES = ("kick", "drums", "bass", "pads", "keys", "fx")
bus = {k: np.zeros((2, N)) for k in BUSES}
send = np.zeros((2, N))


def E(type_):
    return [e for e in EV if e["type"] == type_]


def tt(d):
    return np.arange(int(d * SR)) / SR


def sm(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


def pan_g(p):
    a = (np.clip(p, -1, 1) + 1) * math.pi / 4
    return math.cos(a), math.sin(a)


ONLY = set(filter(None, os.environ.get("SCORE_ONLY", "").split(",")))   # e.g. SCORE_ONLY=fx → render a stem
FOLEY = bool(os.environ.get("SCORE_FOLEY"))  # skip the musical parts (arps, stabs, chords) for a picture-locked foley layer


def put(b, sig, t, g=1.0, pan=0.0, rev=0.0, width=0.0):
    """Mix a mono (or stereo) signal into bus b at time t. width: Haas offset in ms for a little stereo."""
    if ONLY and b not in ONLY:
        return
    i0 = int(round(t * SR))
    if sig.ndim == 1:
        l, r = pan_g(pan)
        st = np.stack([sig * l, sig * r])
        if width:
            d = int(width * SR / 1000)
            st[1] = np.concatenate([np.zeros(d), st[1][:-d]]) if d else st[1]
    else:
        st = sig
    if i0 < 0:
        st = st[:, -i0:]
        i0 = 0
    if i0 >= N:
        return
    n = min(st.shape[1], N - i0)
    bus[b][:, i0:i0 + n] += st[:, :n] * g
    if rev:
        send[:, i0:i0 + n] += st[:, :n] * g * rev


def bandnoise(n, lo, hi, seed=None):
    r = np.random.default_rng(seed) if seed is not None else rng
    x = r.standard_normal(n)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    X *= ((f >= lo) & (f <= hi))
    y = np.fft.irfft(X, n)
    return y / (np.std(y) + 1e-12)


NZ_HI = bandnoise(4 * SR, 6500, 17000, 1)
NZ_MID = bandnoise(4 * SR, 900, 6000, 2)
NZ_LO = bandnoise(4 * SR, 50, 900, 3)
NZ_WIDE = bandnoise(4 * SR, 150, 14000, 4)
NZ_SNR = bandnoise(4 * SR, 1500, 9000, 5)


def grain(src, dur, dec, att=0.0005):
    n = int(dur * SR)
    o = int(rng.integers(0, len(src) - n))
    t = tt(dur)
    return src[o:o + n] * np.exp(-t / dec) * np.clip(t / att, 0, 1)


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def stft_filter(x, cutoff, q=0.0, kind="lp", hop=512, nfft=2048):
    """Time-varying filter by overlap-add. cutoff: array of Hz per sample (or scalar)."""
    x = np.asarray(x)
    n = len(x)
    win = np.hanning(nfft)
    f = np.fft.rfftfreq(nfft, 1 / SR)
    out = np.zeros(n + nfft)
    norm = np.zeros(n + nfft)
    xp = np.concatenate([x, np.zeros(nfft)])
    cut = np.broadcast_to(np.asarray(cutoff, dtype=float), (n,)) if np.ndim(cutoff) else np.full(n, float(cutoff))
    for j in range(0, n, hop):
        fc = cut[min(j + nfft // 2, n - 1)]
        if kind == "lp":
            m = 1 / np.sqrt(1 + (f / fc) ** 4)
            if q:
                m *= 1 + q * np.exp(-0.5 * (np.log(np.maximum(f, 1) / fc) / 0.18) ** 2)
        elif kind == "hp":
            m = 1 / np.sqrt(1 + (fc / np.maximum(f, 1)) ** 4)
        else:  # band
            m = np.exp(-0.5 * (np.log(np.maximum(f, 1) / fc) / 0.35) ** 2)
        seg_ = xp[j:j + nfft] * win
        out[j:j + nfft] += np.fft.irfft(np.fft.rfft(seg_) * m, nfft) * win
        norm[j:j + nfft] += win ** 2
    return out[:n] / np.maximum(norm[:n], 1e-6)


# ------------------------------------------------------------------ voices
def kick(dur=0.5, punch=1.0, f1=48):
    t = tt(dur)
    f = f1 + 150 * np.exp(-t / 0.028) + 40 * np.exp(-t / 0.006)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (0.17 + 0.12 * punch))
    click = grain(NZ_MID, dur, 0.0018) * 0.35
    return np.tanh((s + click) * 1.8) * 0.9


def snare(dur=0.32, body=190):
    t = tt(dur)
    tone = np.sin(2 * np.pi * body * t) * np.exp(-t / 0.05) * 0.6 + np.sin(2 * np.pi * body * 1.6 * t) * np.exp(-t / 0.03) * 0.3
    nz = grain(NZ_SNR, dur, 0.09) * 0.9
    e = np.zeros_like(t)
    for d in (0.0, 0.009, 0.019):
        e += (t >= d) * np.exp(-np.maximum(t - d, 0) / 0.012)
    clap = grain(NZ_MID, dur, 0.11) * np.minimum(e + np.exp(-t / 0.1) * 0.6, 1.2)
    return np.tanh(tone + nz * 0.6 + clap * 0.7)


def hat(open_=False, bright=1.0):
    d = 0.32 if open_ else 0.07
    s = grain(NZ_HI, d, 0.11 if open_ else 0.016)
    # metallic partials
    t = tt(d)
    m = sum(np.sign(np.sin(2 * np.pi * f * t)) for f in (3310, 4970, 6140, 7530)) * 0.08
    return (s + m * np.exp(-t / (0.08 if open_ else 0.012))) * bright


def shaker():
    return grain(NZ_HI, 0.09, 0.03, att=0.012) * 0.8


def saw(f, dur, harm=10, dec=None, att=0.004, rel=0.01, detune=0.0):
    t = tt(dur)
    s = np.zeros_like(t)
    for dd in ((0.0,) if not detune else (-detune, 0.0, detune)):
        ff = f * 2 ** (dd / 12)
        for k in range(1, harm + 1):
            if ff * k > 16000:
                break
            s += np.sin(2 * np.pi * ff * k * t + k * 1.3 + dd * 9) / k
    env = np.clip(t / att, 0, 1) * np.clip((dur - t) / rel, 0, 1)
    if dec:
        env *= np.exp(-t / dec)
    return s * env / (3 if detune else 1)


def sq(f, dur, dec=0.1, duty_harm=9):
    t = tt(dur)
    s = np.zeros_like(t)
    for k in range(1, duty_harm + 1, 2):
        if f * k > 15000:
            break
        s += np.sin(2 * np.pi * f * k * t) / k
    return s * np.exp(-t / dec) * np.clip(t / 0.002, 0, 1)


def bell(f, dur=1.2, idx=2.2, dec=0.5, ratio=3.5):
    t = tt(dur)
    mod = idx * np.exp(-t / (dec * 0.35)) * np.sin(2 * np.pi * f * ratio * t)
    return np.sin(2 * np.pi * f * t + mod) * np.exp(-t / dec) * np.clip(t / 0.002, 0, 1)


def sine(f, dur, dec=0.3, att=0.003):
    t = tt(dur)
    return np.sin(2 * np.pi * f * t) * np.exp(-t / dec) * np.clip(t / att, 0, 1)


def boom(dur=1.6, f0=58, f1=30):
    t = tt(dur)
    f = f1 + (f0 - f1) * np.exp(-t / 0.25)
    return np.tanh(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.55) * 1.6) * 0.6


def crash(dur=2.5, dec=0.9):
    return grain(NZ_HI, dur, dec, att=0.002) * 0.7 + grain(NZ_MID, dur, dec * 0.5, att=0.002) * 0.3


def sweep(t0, t1, f0, f1, g, b="fx", rev=0.3, curve=2.0, src=None, bw=0.45, fade_out=False, pan=0.0):
    n = int((t1 - t0) * SR)
    if n <= 0:
        return
    src = NZ_WIDE if src is None else src
    nz = np.tile(src, 1 + (n + 4096) // len(src))[: n + 4096]
    hop, win = 512, np.hanning(4096)
    F = np.fft.rfftfreq(4096, 1 / SR)
    out = np.zeros(n + 4096)
    for j in range(0, n, hop):
        fc = f0 * (f1 / f0) ** (j / max(n, 1))
        m = np.exp(-0.5 * (np.log(np.maximum(F, 20) / fc) / bw) ** 2)
        out[j:j + 4096] += np.fft.irfft(np.fft.rfft(nz[j:j + 4096] * win) * m, 4096)
    out = out[:n] / (np.std(out[:n]) + 1e-9)
    u = np.linspace(0, 1, n)
    e = sm(u) ** curve if not fade_out else (1 - u) ** curve * np.clip(u / 0.05, 0, 1)
    put(b, out * e, t0, g, rev=rev, pan=pan, width=0.6)


def gliss(t0, dur, m0, m1, g, b="keys", harm=6, rev=0.3):
    t = tt(dur)
    f = hz(m0) * 2 ** ((m1 - m0) / 12 * (t / dur))
    s = np.zeros_like(t)
    for k in range(1, harm + 1):
        s += np.sin(2 * np.pi * np.cumsum(f * k) / SR) / k
    put(b, s * sm(t / 0.08) * sm((dur - t) / 0.15), t0, g, rev=rev)


# ------------------------------------------------------------------ harmony (D minor)
# one chord per bar (36 bars). Voicings as MIDI notes; roots for the bass.
CH = {
    "Dm": ([50, 53, 57, 60, 64], 38), "Bb": ([46, 50, 53, 57, 62], 34), "F": ([45, 48, 53, 57, 60], 41),
    "C": ([48, 52, 55, 60, 62], 36), "Gm": ([43, 50, 53, 58, 62], 31), "A": ([45, 49, 52, 57, 64], 33),
    "Asus": ([45, 50, 52, 57, 64], 33), "Bbmaj7": ([46, 50, 53, 57, 60], 34), "Gm9": ([43, 46, 50, 53, 57], 31),
    "Dm9": ([50, 53, 57, 60, 64], 38), "Dadd9": ([50, 54, 57, 62, 64], 38),
}
BARS = (["Dm"] * 3 + ["Dm", "Bb"] + ["F", "C", "Dm"] + ["Bb", "C"] + ["Dm", "Bb"] + ["Gm", "A"] + ["Dm", "Bb", "F", "C"]
        + ["Bbmaj7", "Gm9", "Dm9", "Asus", "A"] + ["Dm", "Bb", "F", "C"] + ["Dm", "Bb", "F", "C"] + ["Asus", "Dm", "Bb", "Dm9", "Dm9"])
assert len(BARS) == 36, len(BARS)


def chord_at(t):
    return CH[BARS[min(35, int(t // BAR))]]


def in_(t, *ranges):
    return any(a <= t < b for a, b in ranges)


# sections where the groove runs
FULL = ((6.0, 9.45), (16.0, 24.0), (28.0, 35.5), (46.0, 62.0), (64.0, 68.0))
CRT = ((24.0, 27.55),)
HALF = ((36.0, 45.5),)
RISO = ((10.0, 16.0),)

# ------------------------------------------------------------------ drums
kicks = []
for b in range(int(DUR / BEAT)):
    t = b * BEAT
    if in_(t, (4.0, 6.0)) or in_(t, *FULL) or in_(t, *CRT) or in_(t, *RISO) and (b % 2 == 0 or t >= 12.0):
        if in_(t, (15.5, 16.0)):
            continue
        kicks.append(t)
    elif in_(t, *HALF) and b % 4 in (0, 3) and not in_(t, (40.0, 42.0)):
        kicks.append(t)
    elif in_(t, (40.0, 42.0)) and b % 4 == 0:
        kicks.append(t)
for t in kicks:
    big = any(abs(t - x) < 1e-6 for x in (4.0, 6.0, 8.0, 16.0, 28.0, 36.0, 46.0, 54.0, 64.0))
    put("kick", kick(punch=1.4 if big else 1.0), t, 0.95)
# backbeat
for b in range(int(DUR / BEAT)):
    t = b * BEAT
    if b % 2 == 1 and (in_(t, *FULL) or in_(t, (12.0, 15.5))):
        put("drums", snare(), t, 0.42, pan=0.04, rev=0.22)
    elif in_(t, *HALF) and b % 4 == 2:
        put("drums", snare(dur=0.5, body=170), t, 0.5, rev=0.45)
# hats
for k in range(int(DUR / 0.125)):
    t = k * 0.125
    acc = (1.0, 0.45, 0.75, 0.45)[k % 4]
    if in_(t, *FULL):
        put("drums", hat(open_=(k % 4 == 2)), t, 0.075 * acc, pan=0.35, rev=0.05)
    elif in_(t, (4.0, 6.0)) and k % 2 == 1:
        put("drums", hat(), t, 0.05, pan=0.35)
    elif in_(t, *RISO):
        put("drums", shaker(), t, 0.05 * acc, pan=-0.3)
    elif in_(t, *HALF) and k % 2 == 1:
        put("drums", hat(bright=0.7), t, 0.045 * acc, pan=0.4, rev=0.15)
    elif in_(t, *CRT):
        put("drums", hat(), t, 0.05 * acc, pan=0.3)
# build: snare roll into the drop
for k in range(64):
    t = 62.0 + 2.0 * (k / 64) ** 0.85
    put("drums", snare(dur=0.12), t, 0.05 + 0.3 * (k / 64) ** 2, pan=(-0.2 if k % 2 else 0.2), rev=0.2)
for k in range(16):
    put("drums", hat(), 62.0 + k * 0.125, 0.04 + 0.05 * k / 16, pan=0.3)

# sidechain
duck = np.ones(N)
for kt in kicks:
    i0 = int(kt * SR)
    d = np.arange(min(int(0.45 * SR), N - i0)) / SR
    duck[i0:i0 + len(d)] = np.minimum(duck[i0:i0 + len(d)], 1 - 0.7 * np.exp(-d / 0.12))

# ------------------------------------------------------------------ bass
for k in range(int(DUR / 0.125)):
    t = k * 0.125
    ch, root = chord_at(t)
    eighth = k % 2 == 0
    if in_(t, *FULL) or in_(t, (4.0, 6.0)):
        if not eighth and not in_(t, (16.0, 20.0), (54.0, 62.0), (64.0, 68.0)):
            continue
        pat = [0, 0, 12, 0, 0, 12, 7, 0][(k // (1 if not eighth else 2)) % 8]
        if in_(t, (4.0, 6.0)) and k % 4:
            continue
        put("bass", saw(hz(root + pat), 0.2, harm=7, dec=0.11, att=0.003), t, 0.17)
        put("bass", sine(hz(root + (pat if pat < 12 else 0)), 0.24, dec=0.13), t, 0.32)
    elif in_(t, *RISO) and k % 4 == 0 and t >= 12.0:
        put("bass", sine(hz(root), 0.4, dec=0.25), t, 0.34)
        put("bass", saw(hz(root + 12), 0.3, harm=5, dec=0.12), t, 0.06)
    elif in_(t, *HALF) and k % 8 == 0:
        put("bass", sine(hz(root), 1.0, dec=0.6, att=0.01), t, 0.36)
        put("bass", saw(hz(root), 0.9, harm=4, dec=0.35, att=0.01), t, 0.08)
    elif in_(t, *CRT) and k % 2 == 0:
        put("bass", saw(hz(root), 0.2, harm=5, dec=0.1), t, 0.14)
        put("bass", sine(hz(root), 0.22, dec=0.12), t, 0.26)

# ------------------------------------------------------------------ pads
for b in range(36):
    t = b * BAR
    ch, root = CH[BARS[b]]
    fr = [hz(m) for m in ch]
    if t < 2.0 or in_(t, (68.0, 72.0)):
        continue
    gain = 0.075
    if in_(t, *HALF):
        gain = 0.11
    if in_(t, (2.0, 4.0)):
        gain = 0.05
    pad = saw(fr[0], 2.05, harm=8, att=0.35 if in_(t, *HALF) else 0.06, rel=0.25, detune=0.11)
    for f in fr[1:]:
        pad = pad + saw(f, 2.05, harm=8, att=0.35 if in_(t, *HALF) else 0.06, rel=0.25, detune=0.11)
    pad = stft_filter(pad / len(fr), 2600 if in_(t, *HALF) else 1800)
    put("pads", pad, t, gain * 3, rev=0.45, width=9)

# ------------------------------------------------------------------ keys: arps and stabs
SCALE = [62, 65, 67, 69, 72, 74, 77, 79, 81, 84]  # D minor pentatonic
for k in range(int(DUR / 0.125)):
    t = k * 0.125
    ch, root = chord_at(t)
    if FOLEY:
        break
    if in_(t, (28.0, 35.5), (46.0, 54.0)):
        m = ch[[0, 2, 4, 3, 1, 2, 4, 3][k % 8]] + 12
        put("keys", sq(hz(m), 0.16, dec=0.07), t, 0.05, pan=(-0.45 if k % 2 else 0.45), rev=0.3)
    if in_(t, (6.0, 9.45)) and k % 4 == 3:
        put("keys", saw(hz(ch[2] + 12), 0.12, harm=10, dec=0.05, detune=0.08), t, 0.06, pan=0.3, rev=0.25)
# stabs on chapter downbeats and montage cuts
for e in E("cut"):
    ch, _ = chord_at(e["t"])
    if not FOLEY:
        put("keys", saw(hz(ch[0] + 12), 0.28, harm=12, dec=0.12, detune=0.1) + saw(hz(ch[2] + 12), 0.28, harm=12, dec=0.12, detune=0.1)
            + saw(hz(ch[4] + 12), 0.28, harm=12, dec=0.12, detune=0.1), e["t"], 0.07, rev=0.35, width=6)
    put("fx", grain(NZ_WIDE, 0.18, 0.04), e["t"], 0.07, pan=float(rng.uniform(-0.4, 0.4)))
    put("fx", sine(1200 + 300 * (e["i"] % 3), 0.05, dec=0.01), e["t"] + 0.25, 0.04)

# ------------------------------------------------------------------ 01 CARRIER
put("fx", sine(hz(26), 6.0, dec=3.5, att=0.6) * 0.8 + sine(hz(38), 6.0, dec=2.5, att=0.8) * 0.3, 0.0, 0.35)
sweep(0.0, 4.0, 300, 2400, 0.012, rev=0.6, curve=1.2)
for e in E("morse"):
    dd = e["d"] + 0.01
    put("fx", sine(880, dd, dec=5, att=0.002) * np.clip((e["d"] - tt(dd)) / 0.004 + 1, 0, 1), e["t"], 0.09, rev=0.3, pan=0.15)
for e in E("pop"):
    if e["k"] == 0:
        put("fx", boom(1.0, 70, 40), e["t"], 0.35)
        put("keys", bell(hz(74), 2.5, idx=1.5, dec=1.0), e["t"], 0.06, rev=0.5)
        continue
    m = SCALE[(e["k"] * 3) % len(SCALE)]
    g = 0.05 if e["tone"] < 0.25 else 0.07
    put("keys", bell(hz(m), 1.0, idx=1.8 + e["tone"], dec=0.35), e["t"], g, pan=float(np.sin(e["k"] * 1.7)) * 0.6, rev=0.35)
sweep(3.3, 4.0, 400, 9000, 0.05, curve=3)
for e in E("label"):
    put("keys", bell(hz([86, 81, 79, 74][e["i"]]), 0.8, idx=1.2, dec=0.3, ratio=2.0), e["t"], 0.05, rev=0.4, pan=[0.4, -0.4, 0.4, -0.4][e["i"]])
put("fx", boom(1.4), 4.0, 0.4)
put("fx", crash(2.0, 0.8), 4.0, 0.05, rev=0.4)

# ------------------------------------------------------------------ whooshes, impacts, glitches (shared)
for e in E("whoosh"):
    sweep(e["t"], e["t"] + e["d"], 300, 9000, 0.09, curve=2.5)
for e in E("impact"):
    put("fx", boom(1.6 if e.get("big") else 1.2), e["t"], 0.5 if e.get("big") else 0.4)
    put("fx", crash(2.6 if e.get("big") else 1.6, 0.9 if e.get("big") else 0.5), e["t"], 0.07 if e.get("big") else 0.045, rev=0.45, width=8)
for e in E("glitch"):
    src = sq(hz(86), 0.06, dec=0.03)
    n = int(e["d"] / 0.03125)
    for k in range(n):
        if k % 3 != 2:
            put("fx", src, e["t"] + k * 0.03125, 0.035, pan=(0.6 if k % 2 else -0.6))
    put("fx", grain(NZ_WIDE, e["d"], e["d"] * 0.6), e["t"], 0.04)

# ------------------------------------------------------------------ 02 TITLE: bulbs, relays, switch-off
hum = (np.sin(2 * np.pi * 100 * T) + 0.35 * np.sin(2 * np.pi * 200 * T) + 0.15 * np.sign(np.sin(2 * np.pi * 100 * T)))
bus["fx"] += (hum * ((T >= 6.0) & (T < 9.95)) * 0.007)[None, :]
for k in range(32):
    t = 6.0 + k * 0.125
    if t >= 9.45:
        break
    put("fx", grain(NZ_MID, 0.03, 0.003) + 0.3 * sine(2600, 0.03, dec=0.004), t + 0.06, 0.06, pan=(0.55 if k % 2 else -0.55))
for e in E("switchoff"):
    for k in range(8):
        put("fx", grain(NZ_LO, 0.08, 0.02) * 0.8 + grain(NZ_MID, 0.08, 0.006) * 0.4, e["t"] + k * e["d"] / 8, 0.12, pan=-0.7 + 1.4 * k / 7)
    gliss(e["t"], 0.5, 74, 50, 0.04)

# ------------------------------------------------------------------ 03 PRESSURE: riso drums
for e in E("drum"):
    d = e["d"]
    t = tt(d)
    rumble = grain(NZ_LO, d, 10, att=0.03) * (0.6 + 0.4 * np.sign(np.sin(2 * np.pi * 22 * t)))
    put("fx", rumble * sm(t / 0.08) * sm((d - t) / 0.1), e["t"], 0.09, pan=-0.2, rev=0.1)
    put("fx", grain(NZ_MID, d, 10, att=0.05) * (0.5 + 0.5 * np.sin(2 * np.pi * 9 * t)) * sm(t / 0.1) * sm((d - t) / 0.1), e["t"], 0.025, pan=0.3)
for e in E("shatter"):
    for k in range(18):
        put("keys", bell(hz(SCALE[int(rng.integers(3, 10))] + 12), 0.6, idx=3, dec=0.15), e["t"] + rng.uniform(0, 0.35), 0.03, pan=float(rng.uniform(-0.8, 0.8)), rev=0.4)
    put("fx", grain(NZ_HI, 0.5, 0.12), e["t"], 0.08, rev=0.3)
    put("fx", boom(1.0, 80, 45), e["t"], 0.3)
for k in range(12, 32):     # paper ticks
    t = 10.0 + k * 0.25
    if t < 15.4:
        put("drums", grain(NZ_MID, 0.02, 0.003), t + 0.125, 0.05, pan=0.5)

# ------------------------------------------------------------------ 04 WEIGHT: slams + pumps
for e in E("slam"):
    put("fx", boom(0.6, 90, 50), e["t"], 0.32)
    put("fx", grain(NZ_WIDE, 0.12, 0.03), e["t"], 0.12, pan=-0.6 + 0.4 * e["i"])
for e in E("pump"):
    gliss(e["t"], 0.22, 38, 50 if e["i"] % 2 == 0 else 45, 0.05, b="bass", harm=8, rev=0.0)

# ------------------------------------------------------------------ 05 CONTRAST: LED buzz, scans
led = np.sign(np.sin(2 * np.pi * 120 * T)) * 0.5 + np.sin(2 * np.pi * 240 * T) * 0.3
bus["fx"] += (led * ((T >= 20.0) & (T < 23.75)) * 0.006)[None, :]
for e in E("ledon"):
    put("fx", grain(NZ_WIDE, 0.25, 0.05) + sq(120, 0.25, dec=0.1) * 0.5, e["t"], 0.12)
for e in E("scan"):
    f0, f1 = (5000, 300) if e.get("rev") else (300, 5000)
    sweep(e["t"], e["t"] + e["d"], f0, f1, 0.05, bw=0.25, curve=0.6, src=NZ_WIDE, pan=(0.5 if e.get("rev") else -0.5))
    gliss(e["t"], e["d"], 62 if not e.get("rev") else 74, 74 if not e.get("rev") else 62, 0.025, harm=4)

# ------------------------------------------------------------------ 06 OPTICAL SIZE: CRT
for e in E("crton"):
    put("fx", boom(0.8, 70, 35) + grain(NZ_WIDE, 0.8, 0.05) * 0.6, e["t"], 0.32, rev=0.2)
bus["fx"] += (np.sin(2 * np.pi * 7600 * T) * ((T >= 24.0) & (T < 27.75)) * 0.0025)[None, :]
for e in E("line"):
    put("keys", sq(hz(SCALE[e["i"] + 2] + 12), 0.12, dec=0.05), e["t"], 0.045, pan=0.3 - e["i"] * 0.1, rev=0.3)
for e in E("zoom"):
    sweep(e["t"], e["t"] + e["d"], 200, 6000, 0.05, curve=2)
for e in E("crtoff"):
    t = tt(0.45)
    f = 2400 * np.exp(-t * 14) + 40
    put("fx", np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.15), e["t"], 0.13)
    put("fx", grain(NZ_HI, 0.04, 0.006), e["t"] + 0.38, 0.1)

# ------------------------------------------------------------------ 07 ONE GRID: ripple, kern snaps, stepper
for e in E("ripple"):
    for k in range(12):
        put("keys", bell(hz(SCALE[k % 10]), 0.5, idx=0.8, dec=0.2), e["t"] + k * 0.1, 0.03, pan=float(np.sin(k)), rev=0.4)
for e in E("snap"):
    s = sine(1500 + 120 * e["k"], 0.06, dec=0.012) + grain(NZ_MID, 0.06, 0.006) * 0.6
    put("fx", s, e["t"], 0.14, pan=0.1, rev=0.15)
    put("fx", boom(0.35, 120, 60), e["t"], 0.12)
for e in E("stepper"):
    for k in range(int(e["d"] / 0.0625)):
        t = e["t"] + k * 0.0625
        put("fx", grain(NZ_MID, 0.025, 0.004) + 0.4 * sine(900 + 200 * (k % 4), 0.025, dec=0.005), t, 0.03 + 0.02 * (k % 4 == 0), pan=(0.4 if k % 2 else -0.4))

# ------------------------------------------------------------------ 08 ITALIC: shear, morph, ticks, draw, sparkles
for e in E("shear"):
    sweep(e["t"], e["t"] + e["d"], 1200, 250, 0.06, curve=0.7, bw=0.3)
    gliss(e["t"], e["d"], 69, 74, 0.03, harm=3, rev=0.6)
for e in E("morph"):
    for k, m in enumerate([74, 77, 81, 84, 86]):
        put("keys", bell(hz(m), 1.4, idx=1.0, dec=0.6), e["t"] + k * 0.06, 0.03, pan=-0.5 + k * 0.25, rev=0.6)
for e in E("tick"):
    put("keys", bell(hz(SCALE[e["j"] % 10] + 12), 0.4, idx=0.9, dec=0.12), e["t"], 0.035, pan=-0.6 + 1.2 * e["j"] / 15, rev=0.45)
for e in E("draw"):
    d = e["d"]
    t = tt(d)
    f = hz(62) * 2 ** (2 * t / d)
    s = (np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.3 * np.sin(2 * np.pi * np.cumsum(f * 2.01) / SR)) * sm(t / 0.2) * sm((d - t) / 0.1)
    put("keys", s, e["t"], 0.04, rev=0.7, width=10)
    sweep(e["t"], e["t"] + d, 2000, 9000, 0.02, curve=1.5, src=NZ_HI)
for e in E("sparkle"):
    put("keys", bell(hz(SCALE[e["j"] % 10] + 12), 0.5, idx=1.2, dec=0.15), e["t"], 0.028, pan=float(np.sin(e["j"] * 2.3)) * 0.8, rev=0.5)
for e in E("fall"):
    sweep(e["t"], e["t"] + e["d"], 5000, 200, 0.06, curve=0.8, fade_out=False)

# ------------------------------------------------------------------ 09 CHARACTER SET: split-flap clatter
for e in E("flap"):
    last = e.get("last", 0)
    s = grain(NZ_MID, 0.035, 0.004 if not last else 0.007) + 0.35 * sine(2200 + rng.uniform(-300, 300), 0.035, dec=0.004)
    if last:
        s = s + 0.25 * grain(NZ_LO, 0.035, 0.008)
    put("fx", s, e["t"], 0.016 if not last else 0.03, pan=float(e["pan"]) * 0.8)

# ------------------------------------------------------------------ 10 IN USE: per-shot foley
for e in E("printpass"):
    # nine pins striking through the ribbon: a hard buzz gated by the column rhythm, plus the carriage motor
    d = e["d"]
    t = tt(d)
    strikes = np.zeros_like(t)
    per = 1 / 520
    for k in range(int(d / per)):
        if rng.random() < 0.72:
            i0 = int(k * per * SR)
            n = min(int(0.0016 * SR), len(t) - i0)
            strikes[i0:i0 + n] += np.exp(-np.arange(n) / (0.00035 * SR)) * rng.uniform(0.6, 1.0)
    buzz = stft_filter(np.convolve(strikes, NZ_MID[:96] * np.hanning(96), mode="same"), 3200, kind="band")
    motor = (np.sin(2 * np.pi * 180 * t) + 0.5 * np.sign(np.sin(2 * np.pi * 90 * t))) * 0.12
    env = sm(t / 0.02) * sm((d - t) / 0.03)
    put("fx", (buzz / (np.abs(buzz).max() + 1e-9) + motor) * env, e["t"], 0.09, pan=-0.5 * e["dir"], width=3)
    put("fx", grain(NZ_LO, 0.05, 0.012) + 0.4 * sine(220, 0.05, dec=0.01), e["t"] + d, 0.12, pan=0.5 * e["dir"])   # carriage stop
for e in E("feed"):
    for k in range(3):
        put("fx", grain(NZ_MID, 0.03, 0.004) * 0.7 + grain(NZ_LO, 0.03, 0.008), e["t"] + k * 0.025, 0.1, pan=0.1)
for k in range(8):       # the watch
    put("fx", sine(3200, 0.02, dec=0.003) + grain(NZ_HI, 0.02, 0.002), 56.0 + k * 0.125, 0.05, pan=0.3)
put("keys", bell(hz(76), 1.0, idx=0.6, dec=0.5, ratio=2.0), 58.05, 0.06, rev=0.4)   # station chime
put("keys", bell(hz(72), 1.2, idx=0.6, dec=0.6, ratio=2.0), 58.3, 0.06, rev=0.4)
put("fx", grain(NZ_WIDE, 0.3, 0.08) * 0.5, 59.0, 0.08, pan=-0.3)                     # menu paper
sweep(61.3, 61.8, 600, 4000, 0.05, curve=1.0)                                         # card flip

# ------------------------------------------------------------------ 11 SIGNAL: riser, drop
for e in E("riser"):
    sweep(e["t"], e["t"] + e["d"], 200, 12000, 0.11, curve=3, bw=0.5)
    if not FOLEY:
        gliss(e["t"], e["d"], 45, 69, 0.045, harm=9, rev=0.3)
for e in E("drop"):
    put("fx", boom(2.4, 62, 28), e["t"], 0.6)
    put("fx", crash(3.5, 1.3), e["t"], 0.09, rev=0.5, width=10)
    ch, root = CH["Dm9"]
    for m in ch * (not FOLEY):
        put("keys", saw(hz(m + 12), 1.4, harm=10, dec=0.5, detune=0.12), e["t"], 0.025, rev=0.5, width=8)
for e in E("fold"):
    d = e["d"]
    sweep(e["t"], e["t"] + d, 9000, 600, 0.06, curve=0.6, bw=0.35)
    for k in range(10):
        put("keys", bell(hz(SCALE[9 - k] + 12), 0.5, idx=1.0, dec=0.18), e["t"] + d * k / 10, 0.03, pan=float(np.sin(k * 1.9)) * 0.8, rev=0.5)
for e in E("shock"):
    sweep(e["t"], e["t"] + 1.2, 6000, 300, 0.05, curve=1.0, fade_out=True)
for e in E("type"):
    for k in range(40):
        put("fx", grain(NZ_HI, 0.02, 0.003) + 0.3 * grain(NZ_MID, 0.02, 0.003), e["t"] + k * e["d"] / 40, 0.05, pan=-0.4 + 0.8 * k / 40)

# ------------------------------------------------------------------ 12 RELEASE: the last chord, the last dot
ch, root = CH["Dm9"]
pad = sum(saw(hz(m), 4.2, harm=7, att=0.02, rel=1.6, detune=0.1) for m in ch + [62, 69]) / 7
pad = stft_filter(pad, np.interp(np.arange(len(pad)) / SR, [0, 0.3, 4.2], [6000, 2500, 700]))
put("pads", pad * np.exp(-tt(4.2) / 2.6), 68.0, 0.5, rev=0.6, width=10)
put("bass", sine(hz(26), 4.0, dec=1.8, att=0.005), 68.0, 0.45)
for e in E("fall"):
    if e["t"] > 70:
        for k in range(14):
            put("keys", bell(hz(SCALE[9 - k % 10]), 0.5, idx=0.8, dec=0.2), e["t"] + k * 0.08, 0.025, pan=float(np.sin(k * 1.3)) * 0.7, rev=0.5)
for e in E("blink"):
    if e["on"]:
        put("fx", sine(1760, 0.06, dec=0.03), e["t"], 0.05, rev=0.5)

# ------------------------------------------------------------------ section filters (the CRT is heard through glass)
lp = np.interp(T, [0, 23.95, 24.05, 27.5, 27.7, 72], [20000, 20000, 1100, 1700, 20000, 20000])
lp = np.minimum(lp, np.interp(T, [0, 2.0, 4.0, 72], [700, 900, 20000, 20000]))
lp = np.minimum(lp, np.interp(T, [0, 61.9, 62.0, 63.9, 64.0, 72], [20000, 20000, 600, 12000, 20000, 20000]))
for b in ("drums", "bass", "pads", "keys"):
    for ch_ in range(2):
        bus[b][ch_] = stft_filter(bus[b][ch_], lp)
for ch_ in range(2):
    bus["kick"][ch_] = stft_filter(bus["kick"][ch_], np.maximum(lp, 3000))

# ------------------------------------------------------------------ mix
for b in ("bass", "pads", "keys"):
    bus[b] *= duck[None, :]
bus["pads"] *= (0.85 + 0.15 * duck)[None, :]
mix = bus["kick"] * 0.48 + bus["drums"] * 1.25 + bus["bass"] * 0.52 + bus["pads"] * 1.45 + bus["keys"] * 1.35 + bus["fx"] * 1.0


def room_ir(seconds=2.6, seed=7):
    r = np.random.default_rng(seed)
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = np.zeros((2, n))
    for c in range(2):
        x = r.standard_normal(n) * np.exp(-t / 0.55)
        X = np.fft.rfft(x)
        f = np.fft.rfftfreq(n, 1 / SR)
        X *= 1 / (1 + (f / 5500) ** 2) * (1 - np.exp(-f / 180))
        ir[c] = np.fft.irfft(X, n)
        ir[c, : int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
    return ir / np.abs(ir).max()


ir = room_ir()
L_ = N + ir.shape[1]
nfft = 1 << (L_ - 1).bit_length()
wet = np.zeros((2, N))
for c in range(2):
    wet[c] = np.fft.irfft(np.fft.rfft(send[c], nfft) * np.fft.rfft(ir[c], nfft), nfft)[:N]
wet *= 0.32 * np.std(mix) / (np.std(wet) + 1e-12)
mix = mix + wet
mix -= mix.mean(axis=1, keepdims=True)
# master: high-pass rumble, gentle glue, peak ceiling, fade
for c in range(2):
    mix[c] = stft_filter(mix[c], 28, kind="hp")
mix *= np.clip((DUR - T) / 0.25, 0, 1)[None, :]
mix /= np.abs(mix).max()
mix = np.tanh(mix * 1.5) / np.tanh(1.5)
mix *= 0.93 / np.abs(mix).max()

out = os.environ.get("SCORE_OUT") or os.path.join(FILM, "assets", "score.wav")
with wave.open(out, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((np.clip(mix.T, -1, 1) * 32767).astype("<i2").tobytes())


def db(a, b):
    return 20 * np.log10(np.sqrt((mix[:, int(a * SR):int(b * SR)] ** 2).mean()) + 1e-12)


print(out)
print(" ".join(f"{a:g}-{b:g}:{db(a, b):.1f}" for a, b in [(0, 4), (4, 10), (10, 16), (16, 24), (24, 28), (28, 36), (36, 46), (46, 54), (54, 62), (62, 64), (64, 68), (68, 72)]))
