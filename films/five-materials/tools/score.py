"""Score for "Punctum Moderne — Five Materials", synthesized from the picture.

    node tools/export-events.cjs && python3 tools/score.py   →  assets/score.wav

Each material plays itself: ink drops plink, the music-box pins pluck their own
tines, the card reader clicks column by column, the piezo head ticks, and the
rack focus rings every dot as it lands sharp. Key of D, 90 bpm, cuts on bars.
Nothing is sampled; deterministic (seeded).
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
DUR = 48.0
N = int(DUR * SR)
rng = np.random.default_rng(20261004)
T = np.arange(N) / SR

dry = np.zeros((2, N))
send = np.zeros((2, N))

D1 = 36.708
D2 = D1 * 2
PENTA = [0, 2, 4, 7, 9]


def hz(semis_from_d2):
    return D2 * 2 ** (semis_from_d2 / 12)


def note(base, degree):
    o, k = divmod(degree, 5)
    return base * 2 ** ((12 * o + PENTA[k]) / 12)


def pan_gains(p):
    a = (p + 1) * math.pi / 4
    return math.cos(a), math.sin(a)


def place(sig, t, gain=1.0, pan=0.0, rev=0.25):
    i0 = int(round(t * SR))
    if i0 >= N:
        return
    if i0 < 0:
        sig = sig[-i0:]
        i0 = 0
    n = min(len(sig), N - i0)
    gl, gr = pan_gains(pan)
    s = sig[:n] * gain
    dry[0, i0:i0 + n] += s * gl
    dry[1, i0:i0 + n] += s * gr
    send[0, i0:i0 + n] += s * gl * rev
    send[1, i0:i0 + n] += s * gr * rev


def place_st(sig2, t, gain=1.0, rev=0.25):
    i0 = int(round(t * SR))
    n = min(sig2.shape[1], N - i0)
    dry[:, i0:i0 + n] += sig2[:, :n] * gain
    send[:, i0:i0 + n] += sig2[:, :n] * gain * rev


def tt(dur):
    return np.arange(int(dur * SR)) / SR


def smooth(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


def env_attack(t, a=0.002):
    return np.clip(t / a, 0, 1)


# ------------------------------------------------------------------ voices
def tine(f, tone=0.5, dur=3.0, amp=1.0):
    """Music-box tine: inharmonic partials 1 / 2.76 / 5.40 / 8.93."""
    t = tt(dur)
    lowf = min(1.0, 330 / f)
    parts = [(1.0, 1.0, 2.2 + 1.6 * lowf), (2.76, 0.30, 0.75), (5.40, 0.10, 0.26), (8.93, 0.035, 0.09)]
    s = np.zeros_like(t)
    for r, a, dec in parts:
        if f * r > 18000:
            continue
        s += a * np.sin(2 * np.pi * f * r * t + r) * np.exp(-t / dec)
    if tone >= 0.99:
        s += 0.34 * np.sin(2 * np.pi * f / 2 * t) * np.exp(-t / 1.5)
    elif tone <= 0.01:
        s = 0.62 * s + 0.3 * np.sin(2 * np.pi * f * 2 * t) * np.exp(-t / 0.5)
    click = rng.standard_normal(len(t)) * np.exp(-t / 0.0011) * 0.07
    return (s + click) * env_attack(t) * amp


def bell(f, dur=7.0, amp=1.0, bright=1.0):
    t = tt(dur)
    parts = [(0.5, 0.35, 5.0), (1.0, 1.0, 4.2), (2.0, 0.45, 2.6), (2.76, 0.35 * bright, 1.8),
             (4.07, 0.18 * bright, 1.0), (5.40, 0.10 * bright, 0.6)]
    s = np.zeros_like(t)
    for r, a, dec in parts:
        for det in (-0.6, 0.6):
            s += 0.5 * a * np.sin(2 * np.pi * (f * r + det * r) * t + r * 1.7) * np.exp(-t / dec)
    return s * env_attack(t, 0.003) * amp


def pad(freqs, dur, amps=None, bright=3.2):
    t = tt(dur)
    s = np.zeros_like(t)
    for i, f in enumerate(freqs):
        a = 1.0 if amps is None else amps[i]
        for k in range(1, 10):
            if f * k > 9000:
                break
            roll = math.exp(-((k - 1) / bright) ** 2)
            for det in (-0.12, 0.13):
                s += a * roll / k * np.sin(2 * np.pi * (f + det * f / 100) * k * t + i + k)
    return s / max(1, len(freqs))


def band_noise(n, lo, hi, tilt=0.0):
    x = rng.standard_normal(n)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    m = ((f >= lo) & (f <= hi)).astype(float)
    m = np.convolve(m, np.hanning(301) / np.hanning(301).sum(), mode="same")
    if tilt:
        m *= (np.maximum(f, 20) / 1000.0) ** tilt
    y = np.fft.irfft(X * m, n)
    return y / (np.std(y) + 1e-12)


def plop(f, size=1.0, dur=0.6):
    """A drop meeting paper: a short upward pitch glide over a soft body."""
    t = tt(dur)
    glide = f * (1 + 0.55 * (1 - np.exp(-t / 0.014)))
    ph = 2 * np.pi * np.cumsum(glide) / SR
    s = np.sin(ph) * np.exp(-t / (0.045 + 0.05 * size))
    s += 0.5 * np.sin(2 * np.pi * f * 2.01 * t) * np.exp(-t / 0.02)
    body = np.sin(2 * np.pi * (95 + 40 * (1 - size)) * t) * np.exp(-t / 0.05) * size
    nz = rng.standard_normal(len(t)) * np.exp(-t / 0.0016) * 0.25
    return (s + 0.7 * body + nz) * env_attack(t, 0.0006)


def relay(k, dur=0.14):
    """Card-reader brush: a tight mechanical click with a small metal ring."""
    t = tt(dur)
    j = 1 + 0.05 * math.sin(k * 7.13)
    s = (0.8 * np.sin(2 * np.pi * 2400 * j * t) * np.exp(-t / 0.004)
         + 0.45 * np.sin(2 * np.pi * 870 * j * t) * np.exp(-t / 0.018)
         + 0.6 * np.sin(2 * np.pi * 130 * t) * np.exp(-t / 0.02)
         + 0.9 * rng.standard_normal(len(t)) * np.exp(-t / 0.0015))
    return s * env_attack(t, 0.0003)


def piezo(k, dur=0.05):
    t = tt(dur)
    f = 6400 + 900 * math.sin(k * 3.7)
    s = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.0022) + 0.5 * rng.standard_normal(len(t)) * np.exp(-t / 0.0008)
    return s * env_attack(t, 0.0002)


def pizz(f, dur=0.9):
    t = tt(dur)
    s = np.zeros_like(t)
    for k, a in ((1, 1.0), (2, 0.35), (3, 0.15), (4.2, 0.06)):
        s += a * np.sin(2 * np.pi * f * k * t + k) * np.exp(-t / (0.22 / k))
    return s * env_attack(t, 0.0008)


def kick(dur=0.6):
    t = tt(dur)
    f = 48 + 60 * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t / 0.22) * env_attack(t, 0.001)


def sub(f=D1, dur=5.0, dec=2.2):
    t = tt(dur)
    return np.sin(2 * np.pi * f * t) * np.exp(-t / dec) * smooth(t / 0.015)


def sweep(t0, t1, f0, f1, gain, rev=0.3, curve=2.0, seed_shift=0, pan_w=311):
    """Band of noise travelling f0 → f1 with a swelling envelope (a whoosh / riser)."""
    i0, i1 = int(t0 * SR), int(t1 * SR)
    n = i1 - i0
    nz = rng.standard_normal(n + 4096)
    hop, win = 1024, np.hanning(4096)
    out = np.zeros(n + 4096)
    F = np.fft.rfftfreq(4096, 1 / SR)
    for j in range(0, n, hop):
        u = j / max(n, 1)
        fc = f0 * (f1 / f0) ** u
        m = np.exp(-0.5 * (np.log(np.maximum(F, 20) / fc) / 0.42) ** 2)
        out[j:j + 4096] += np.fft.irfft(np.fft.rfft(nz[j:j + 4096] * win) * m, 4096)
    out = out[:n]
    out /= np.std(out) + 1e-9
    e = smooth(np.linspace(0, 1, n)) ** curve
    dry[0, i0:i1] += out * e * gain
    dry[1, i0:i1] += np.roll(out, pan_w) * e * gain
    send[0, i0:i1] += out * e * gain * rev
    send[1, i0:i1] += np.roll(out, pan_w) * e * gain * rev


def pad_at(freqs, t0, t1, gain, attack=1.5, release=1.5, rev=0.5, bright=3.2):
    d = t1 - t0 + release
    p = pad(freqs, d, bright=bright)
    t = tt(d)
    e = smooth(t / attack) * (1 - smooth((t - (t1 - t0)) / release))
    place(p * e, t0, gain, rev=rev)


# ------------------------------------------------------------------ air
room = band_noise(N, 40, 2400, tilt=-0.6)
room_env = smooth(T / 1.5) * (1 - smooth((T - 46.5) / 1.4))
dry[0] += room * room_env * 0.0035
dry[1] += np.roll(room, 1777) * room_env * 0.0035

# ------------------------------------------------------------------ P  the object
pad_at([D2, D2 * 1.5, D2 * 2], 0.3, 4.2, 0.05, attack=2.6, release=0.6, rev=0.3, bright=1.8)
sweep(0.4, 2.9, 1800, 7000, 0.0045, rev=0.8, curve=1.2)          # the light finding the sphere
place(bell(hz(24 + 7), 5.0, bright=0.5), 1.25, 0.018, pan=0.25, rev=0.8)
sweep(3.0, 4.0, 2400, 500, 0.008, rev=0.3, curve=1.5)            # it lets go

# ------------------------------------------------------------------ I  ink
ink = EV["ink"]
order = sorted(ink, key=lambda d: d["t"])
first = order[0]
place(plop(330, 1.0, 1.0), first["t"], 0.15, pan=0.0, rev=0.45)
place(sub(D1, 4.0, 1.6), first["t"], 0.20, rev=0.05)
place(bell(hz(24), 7.0, bright=0.7), first["t"] + 0.01, 0.05, pan=-0.05, rev=0.7)
pad_at([D2 * 2, D2 * 3, hz(26), hz(28)], first["t"], 11.6, 0.045, attack=2.2, release=0.9, rev=0.55)
k = 0
for d in order[1:]:
    if d["sat"]:
        place(plop(1500 + 600 * rng.random(), 0.15, 0.25), d["t"], 0.03, pan=float(rng.uniform(-0.5, 0.5)), rev=0.4)
        continue
    deg = 7 + k
    f = note(D2 * 4, deg % 12) * (1 if deg < 12 else 1)
    size = min(1.0, d["R"] / 0.45)
    place(plop(f * 0.5, size, 0.7), d["t"], 0.055 + 0.035 * size, pan=-0.45 + 0.9 * (d["x"] / 5), rev=0.45)
    place(tine(f, 0.5, 1.8), d["t"] + 0.004, 0.012, pan=-0.45 + 0.9 * (d["x"] / 5), rev=0.6)
    k += 1
place(bell(hz(24 + 4), 5.0, bright=0.6), 8.0, 0.03, pan=0.2, rev=0.7)   # the 'a' is whole
sweep(10.6, 12.0, 300, 5200, 0.016, rev=0.25, curve=3.0)             # the push into the ball

# ------------------------------------------------------------------ II music box
place(sub(D1, 3.0, 1.2), 12.0, 0.22, rev=0.05)
pad_at([hz(-7), hz(0), hz(7), hz(9), hz(14)], 12.0, 19.9, 0.035, attack=1.2, release=0.4, rev=0.5)
D4 = D2 * 4
for e in EV["plucks"]:
    f = note(D4, e["row"])
    pan = -0.6 + 1.2 * e["row"] / 10
    strum = 0.009 * e["row"]
    if e["tone"] > 1.1:
        place(tine(f, 1.0, 3.2), e["t"] + strum, 0.030, pan=pan, rev=0.5)
        place(bell(f * 2, 4.0, bright=0.6), e["t"] + strum, 0.010, pan=pan, rev=0.6)
    else:
        a = {1.0: 1.0, 0.5: 0.78, 0.0: 0.58}.get(e["tone"], 0.8)
        place(tine(f, e["tone"], 3.0), e["t"] + strum, 0.024 * a, pan=pan, rev=0.45)

# ------------------------------------------------------------------ III punch card
for k, c in enumerate(EV["clicks"]):
    place(relay(k), c["t"], 0.075, pan=0.35, rev=0.15)
place(relay(99) * 1.0, EV["card"]["settle"], 0.11, pan=0.1, rev=0.2)
place(sub(D1 * 1.5, 2.0, 0.6), EV["card"]["settle"], 0.10, rev=0.05)
pad_at([hz(7 - 12), hz(7), hz(14), hz(16), hz(19)], 20.0, 23.3, 0.035, attack=1.6, release=0.35, rev=0.5)
m0 = EV["card"]["morph"]
pad_at([D2, D2 * 1.5, D2 * 2, hz(16), hz(21), hz(28)], m0, 26.5, 0.065, attack=0.7, release=0.2, rev=0.6, bright=4.5)
place(bell(hz(24 + 7), 6.0, bright=0.9), m0 + 0.02, 0.05, pan=0.2, rev=0.7)
place(bell(hz(36), 5.0, bright=0.6), m0 + 0.12, 0.022, pan=-0.3, rev=0.7)
sweep(m0, m0 + 0.9, 900, 9000, 0.006, rev=0.6, curve=0.7)
for b in range(4):
    place(kick(), 21.333 + b * (2 / 3) * 2, 0.10, rev=0.05)
dv0, dv1 = EV["card"]["dive"]
sweep(dv0, dv1, 260, 11000, 0.020, rev=0.3, curve=3.2)
# the strobe
place(sub(D1, 2.5, 0.9), dv1, 0.26, rev=0.05)
place(band_noise(int(0.5 * SR), 2000, 14000) * np.exp(-tt(0.5) / 0.06), dv1, 0.03, rev=0.6)

# ------------------------------------------------------------------ IV inkjet
jet = EV["jet"]
for k, d in enumerate(jet):
    slow = d["fire"] < 28.1
    if slow:
        # slow motion: everything stretched and lowered
        place(pizz(note(D2 * 2, d["row"] % 10), 1.4), d["land"], 0.025, pan=-0.3 + 0.6 * d["row"] / 10, rev=0.6)
    else:
        place(piezo(k), d["fire"], 0.016, pan=0.5, rev=0.1)
        place(pizz(note(D2 * 8, d["row"]), 0.6), d["land"], 0.020 * (0.6 + 0.4 * min(d["tone"], 1)),
              pan=-0.5 + 1.0 * d["row"] / 10, rev=0.35)
pad_at([hz(-3 - 12), hz(-3), hz(4), hz(7), hz(11)], 26.667, 33.3, 0.04, attack=1.0, release=0.5, rev=0.5)
for b in range(7):
    tb = 29.333 + b * (2 / 3)
    if tb < 33.0:
        place(kick(), tb, 0.12 if b % 2 == 0 else 0.07, rev=0.05)
sweep(31.9, 33.6, 7000, 900, 0.006, rev=0.7, curve=1.0)             # the rack into light

# ------------------------------------------------------------------ V light
pad_at([hz(-7), hz(0), hz(4), hz(7), hz(11), hz(18)], 33.2, 38.9, 0.075, attack=3.0, release=0.4, rev=0.6)
for k, f in enumerate(sorted(EV["light"]["focus"], key=lambda q: q["t"])):
    if k % 3:
        continue
    fr = note(D2 * 8, f["row"])
    place(tine(fr, 0.0 if f["tone"] < 0.3 else 0.5, 2.2), f["t"], 0.0085, pan=-0.8 + 1.6 * f["xn"], rev=0.7)
S0 = EV["light"]["sharp"]
place(sub(D1, 6.0, 2.6), S0, 0.32, rev=0.05)
pad_at([D2, D2 * 1.5, D2 * 2, hz(16), hz(19), hz(28), hz(31)], S0, 46.4, 0.09, attack=0.08, release=1.6, rev=0.65)
place(bell(hz(24), 9.0), S0, 0.10, pan=0.05, rev=0.7)
place(bell(hz(31), 8.0, bright=0.8), S0 + 0.03, 0.04, pan=-0.2, rev=0.7)
place(bell(hz(40), 6.0, bright=0.6), S0 + 0.06, 0.02, pan=0.3, rev=0.7)

# ------------------------------------------------------------------ finale
place(tine(hz(36), 0.5, 3.0), EV["fin"]["tagline"], 0.022, pan=0.1, rev=0.6)
place(tine(hz(43), 0.0, 3.0), EV["fin"]["zh"], 0.014, pan=-0.1, rev=0.6)
# the last dot
place(tine(hz(48), 1.0, 4.0), 46.9, 0.03, pan=0.25, rev=0.75)

# ------------------------------------------------------------------ hall + master
def hall_ir(seconds=3.6, seed=7):
    r = np.random.default_rng(seed)
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = np.zeros((2, n))
    for ch in range(2):
        x = r.standard_normal(n) * np.exp(-t / 0.8)
        X = np.fft.rfft(x)
        f = np.fft.rfftfreq(n, 1 / SR)
        X *= 1 / (1 + (f / 5000) ** 2)
        ir[ch] = np.fft.irfft(X, n)
        pre = int(0.024 * SR)
        ir[ch] = np.concatenate([np.zeros(pre), ir[ch][:-pre]])
    return ir / np.abs(ir).max()


ir = hall_ir()
L = N + ir.shape[1]
nfft = 1 << (L - 1).bit_length()
wet = np.zeros((2, N))
for ch in range(2):
    wet[ch] = np.fft.irfft(np.fft.rfft(send[ch], nfft) * np.fft.rfft(ir[ch], nfft), nfft)[:N]
wet *= 0.9 * np.std(dry) / (np.std(wet) + 1e-12) * 0.55

mix = dry + wet
mix -= mix.mean(axis=1, keepdims=True)
mix *= (smooth(T / 0.02) * (1 - smooth((T - 47.4) / 0.6)))[None, :]
peak = np.abs(mix).max()
mix = mix / peak * 0.89
mix = np.tanh(mix * 1.15) / np.tanh(1.15)
mix *= 0.89 / np.abs(mix).max()

out = os.path.join(FILM, "assets", "score.wav")
pcm = (np.clip(mix.T, -1, 1) * 32767).astype("<i2")
with wave.open(out, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
rms = 20 * np.log10(np.sqrt((mix ** 2).mean()) + 1e-12)
seg = lambda a, b: 20 * np.log10(np.sqrt((mix[:, int(a * SR):int(b * SR)] ** 2).mean()) + 1e-12)
print(out, f"rms {rms:.1f} dBFS |", " ".join(f"{a}-{b}:{seg(a, b):.1f}" for a, b in
      [(0, 4), (4, 12), (12, 20), (20, 26.7), (26.7, 33.3), (33.3, 38.7), (38.7, 42), (42, 48)]))
