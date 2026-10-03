"""Score for the Punctum film, synthesized from the picture's event table.

    node tools/export-events.cjs && python3 tools/score.py   →  assets/score.wav

Every pluck, strike and tine is placed at the time the engine draws it
(assets/events.json). Nothing is sampled: additive tines and bells, filtered
noise, an FFT-convolved synthetic hall. Deterministic (seeded).
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
DUR = 60.0
N = int(DUR * SR)
rng = np.random.default_rng(20261003)

dry = np.zeros((2, N))
send = np.zeros((2, N))

D2 = 73.416
PENTA = [0, 2, 4, 7, 9]


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
    lowf = min(1.0, 330 / f)                       # low tines ring longer
    parts = [(1.0, 1.0, 2.4 + 1.6 * lowf), (2.76, 0.32, 0.8), (5.40, 0.11, 0.28), (8.93, 0.04, 0.1)]
    s = np.zeros_like(t)
    for r, a, dec in parts:
        if f * r > 18000:
            continue
        s += a * np.sin(2 * np.pi * f * r * t + r) * np.exp(-t / dec)
    if tone >= 0.99:                                # thick: warm lower octave
        s += 0.38 * np.sin(2 * np.pi * f / 2 * t) * np.exp(-t / 1.6)
    elif tone <= 0.01:                              # hairline: glassy upper octave
        s = 0.62 * s + 0.3 * np.sin(2 * np.pi * f * 2 * t) * np.exp(-t / 0.55)
    click = rng.standard_normal(len(t)) * np.exp(-t / 0.0012) * 0.08
    return (s + click) * env_attack(t) * amp


def bell(f, dur=7.0, amp=1.0, bright=1.0):
    t = tt(dur)
    parts = [(0.5, 0.35, 5.0), (1.0, 1.0, 4.2), (2.0, 0.45, 2.6), (2.76, 0.35 * bright, 1.8),
             (4.07, 0.18 * bright, 1.0), (5.40, 0.10 * bright, 0.6)]
    s = np.zeros_like(t)
    for r, a, dec in parts:
        for det in (-0.6, 0.6):                    # slow beating
            s += 0.5 * a * np.sin(2 * np.pi * (f * r + det * r) * t + r * 1.7) * np.exp(-t / dec)
    return s * env_attack(t, 0.003) * amp


def pluck(f, tone, dur=2.6, amp=1.0):
    """Harp-like pluck for the sampling of the pen stroke."""
    t = tt(dur)
    bright = 0.55 + 0.45 * (1 - min(tone, 1))
    s = np.zeros_like(t)
    for k in range(1, 9):
        a = (1 / k ** 1.4) * (bright ** (k - 1))
        s += a * np.sin(2 * np.pi * f * k * t + 0.3 * k) * np.exp(-t * (1.1 + 0.9 * k))
    if tone >= 0.99:
        s += 0.3 * np.sin(2 * np.pi * f / 2 * t) * np.exp(-t / 1.2)
    return s * env_attack(t, 0.0015) * amp


def tok(mass, k):
    """Dry print-head strike: resonant click + small body."""
    t = tt(0.12)
    jit = 1 + 0.04 * math.sin(k * 12.9898)
    s = (0.9 * np.sin(2 * np.pi * 1850 * jit * t) * np.exp(-t / 0.010)
         + 0.5 * np.sin(2 * np.pi * 3300 * jit * t) * np.exp(-t / 0.005)
         + 0.8 * np.sin(2 * np.pi * 165 * t) * np.exp(-t / 0.030)
         + 0.6 * rng.standard_normal(len(t)) * np.exp(-t / 0.0025))
    return s * env_attack(t, 0.0004) * (0.45 + 0.55 * math.sqrt(mass / 8))


def pad(freqs, dur, amps=None):
    t = tt(dur)
    s = np.zeros_like(t)
    for i, f in enumerate(freqs):
        a = 1.0 if amps is None else amps[i]
        for k in range(1, 10):
            if f * k > 9000:
                break
            roll = math.exp(-((k - 1) / 3.2) ** 2)
            for det in (-0.12, 0.13):
                s += a * roll / k * np.sin(2 * np.pi * (f + det * f / 100) * k * t + i + k)
    return s / max(1, len(freqs))


def band_noise(n, lo, hi, tilt=0.0):
    x = rng.standard_normal(n)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    m = ((f >= lo) & (f <= hi)).astype(float)
    # soft edges
    m = np.convolve(m, np.hanning(301) / np.hanning(301).sum(), mode="same")
    if tilt:
        m *= (np.maximum(f, 20) / 1000.0) ** tilt
    y = np.fft.irfft(X * m, n)
    return y / (np.std(y) + 1e-12)


# ------------------------------------------------------------------ beds
T = np.arange(N) / SR

# room tone: dark air, fades in from silence and back to silence (loop-friendly)
room = band_noise(N, 40, 2600, tilt=-0.5)
room_env = smooth(T / 2.5) * (1 - smooth((T - 57.5) / 2.4))
for g, sh in ((0, 0), (1, 1777)):
    dry[g] += np.roll(room, sh) * room_env * 0.0045

# low D drone that breathes with the dot
drone = np.zeros(N)
for k, a in ((1, 1.0), (2, 0.34), (3, 0.12), (4, 0.05)):
    drone += a * 0.5 * (np.sin(2 * np.pi * D2 * k * T) + np.sin(2 * np.pi * (D2 * k + 0.17) * T + 1.0))
fifth = 0.5 * (np.sin(2 * np.pi * D2 * 1.5 * T + 0.4) + np.sin(2 * np.pi * (D2 * 1.5 + 0.11) * T))
breath = 0.5 + 0.5 * np.sin(2 * np.pi * T / 4 - np.pi / 2)
lvl = np.interp(T, [0, 0.4, 3.5, 8, 13, 19, 26, 29, 43, 46, 50.9, 51.2, 55, 57.6, 59.0, 60],
                   [0, 0, 0.9, 0.75, 0.55, 0.45, 0.4, 0.55, 0.5, 0.65, 1.15, 1.25, 0.8, 0.7, 0.35, 0])
breath_mix = np.interp(T, [0, 7, 9, 56, 58, 60], [1, 1, 0.15, 0.15, 1, 1])
drone_env = lvl * (1 - breath_mix * 0.35 + breath_mix * 0.35 * breath)
fifth_env = np.interp(T, [0, 45, 50.9, 51.3, 55.5, 60], [0, 0, 0.6, 0.7, 0.2, 0])
d_sig = (drone * drone_env + fifth * fifth_env) * 0.05
dry[0] += d_sig
dry[1] += d_sig
send[0] += d_sig * 0.15
send[1] += d_sig * 0.15

# ------------------------------------------------------------------ II pen
for p in EV["pen"]:
    env = np.array(p["env"])                         # t, speed, pressure
    sp = env[:, 1] / max(env[:, 1].max(), 1e-6)
    amp = np.clip(sp, 0, 1) ** 0.7 * (0.35 + 0.65 * np.clip(env[:, 2], 0, 1.2))
    i0, i1 = int(p["t0"] * SR), int((p["t1"] + 0.05) * SR)
    seg = T[i0:i1]
    e = np.interp(seg, env[:, 0], amp)
    nz = band_noise(i1 - i0, 1800, 7500, tilt=-0.3)
    grain = band_noise(i1 - i0, 300, 900)
    s = (nz * 0.8 + grain * 0.25) * e * 0.012
    dry[0, i0:i1] += s * 0.95
    dry[1, i0:i1] += s * 1.05
    send[0, i0:i1] += s * 0.2
    send[1, i0:i1] += s * 0.2

D4 = D2 * 4
for i, sm in enumerate(EV["samples"]):
    f = note(D4, sm["row"])
    place(pluck(f, sm["tone"], amp=0.9 if sm["tone"] >= 0.99 else 0.7), sm["t"], 0.09,
          pan=-0.35 + 0.7 * (i % 6) / 5, rev=0.35)
# the first dot was the ball of 'a'
place(bell(D2 * 8, 8.0), 15.0, 0.07, pan=-0.1, rev=0.6)
place(bell(D2 * 12, 7.0, bright=0.7), 15.04, 0.035, pan=0.15, rev=0.6)

# ------------------------------------------------------------------ III punch
for k, s in enumerate(EV["strikes"]):
    place(tok(s["mass"], k), s["t"], 0.11, pan=0.55, rev=0.12)
c0, c1 = EV["contrast"]["t0"], EV["contrast"]["t1"]
chord = [D2 * 2, D2 * 3, D2 * 4, D2 * 4 * 2 ** (4 / 12), D2 * 8 * 2 ** (2 / 12)]
pd = pad(chord, 12.0)
pt = tt(12.0)
pe = smooth(pt / (c1 - c0 + 0.4)) * (1 - smooth((pt - 3.0) / 7.0) * 0.8) * (1 - smooth((pt - 9.0) / 3.0))
place(pd * pe, c0, 0.05, pan=0.0, rev=0.5)

# ------------------------------------------------------------------ IV music box
D4t = D2 * 4
for e in EV["comb"]:
    f = note(D4t, e["row"])
    pan = -0.55 + 1.1 * e["row"] / 9
    if e["tone"] > 1.1:
        place(bell(f * 2, 6.0, bright=0.8), e["t"], 0.03, pan=pan, rev=0.55)
        place(tine(f, 1.0, 3.0), e["t"], 0.022, pan=pan, rev=0.45)
    else:
        a = {1.0: 1.0, 0.5: 0.8, 0.0: 0.62}.get(e["tone"], 0.8)
        place(tine(f, e["tone"], 3.4), e["t"], 0.021 * a, pan=pan, rev=0.45)

# ------------------------------------------------------------------ V powers of one
vz = np.array(EV["vzoom"])
t_v0 = EV["marks"]["V_T0"]
grains = []
tcur = t_v0 + 0.6
while tcur < EV["resolve"] - 0.05:
    s = float(np.interp(tcur, vz[:, 0], vz[:, 1]))
    visible = min((60 / max(s, 0.25)) ** 1.15, 260)  # more text on screen → denser shimmer
    rate = 3 + visible * 0.5
    tcur += rng.exponential(1 / rate)
    grains.append((tcur, rate))
for tg, rate in grains:
    deg = int(rng.integers(5, 16))
    f = note(D4t, deg)
    a = (0.35 + 0.65 * rng.random()) / math.sqrt(rate / 3)
    place(tine(f, float(rng.choice([0.0, 0.5, 1.0])), 1.6), tg, 0.10 * a * (0.6 + 0.4 * smooth((tg - 45) / 5)),
          pan=float(rng.uniform(-0.8, 0.8)), rev=0.6)
# rising air (an upward-moving band of noise) into the resolve
air_t0, air_t1 = 45.5, EV["resolve"] + 0.02
i0, i1 = int(air_t0 * SR), int(air_t1 * SR)
nz = rng.standard_normal(i1 - i0)
hop, win = 1024, np.hanning(4096)
air = np.zeros(i1 - i0 + 4096)
F = np.fft.rfftfreq(4096, 1 / SR)
for j in range(0, i1 - i0 - 4096, hop):
    u = j / (i1 - i0)
    fc = 300 * (14 ** u)
    m = np.exp(-0.5 * (np.log(np.maximum(F, 20) / fc) / 0.45) ** 2)
    seg = np.fft.irfft(np.fft.rfft(nz[j:j + 4096] * win) * m, 4096)
    air[j:j + 4096] += seg
air = air[: i1 - i0]
air /= np.std(air) + 1e-9
ae = smooth((T[i0:i1] - air_t0) / (air_t1 - air_t0)) ** 2
dry[0, i0:i1] += air * ae * 0.010
dry[1, i0:i1] += np.roll(air, 311) * ae * 0.010
send[0, i0:i1] += air * ae * 0.02
send[1, i0:i1] += np.roll(air, 311) * ae * 0.02
# swelling pad into the resolve
crescendo = pad([D2, D2 * 1.5, D2 * 2, D2 * 3, D2 * 4 * 2 ** (4 / 12), D2 * 6], 9.0)
ct = tt(9.0)
ce = smooth((ct - 0.5) / 4.5) ** 1.5 * (1 - smooth((ct - 5.6) / 0.25) * 0.35)
place(crescendo * ce, 46.0, 0.085, rev=0.45)

# the resolve: sub, full chord, the violet bell, a rolled arpeggio
R0 = EV["resolve"]
sub_t = tt(6.0)
sub = np.sin(2 * np.pi * D2 / 2 * sub_t) * np.exp(-sub_t / 2.4) * smooth(sub_t / 0.02)
place(sub, R0, 0.32, rev=0.1)
res = pad([D2, D2 * 2, D2 * 3, D2 * 4, D2 * 4 * 2 ** (4 / 12), D2 * 6, D2 * 8 * 2 ** (2 / 12)], 9.0)
rt = tt(9.0)
place(res * smooth(rt / 0.05) * np.exp(-rt / 3.2), R0, 0.10, rev=0.6)
place(bell(D2 * 8, 9.0), R0, 0.14, pan=0.1, rev=0.7)
place(bell(D2 * 12, 8.0, bright=0.8), R0 + 0.03, 0.05, pan=-0.2, rev=0.7)
place(bell(D2 * 16 * 2 ** (4 / 12), 6.0, bright=0.6), R0 + 0.06, 0.025, pan=0.3, rev=0.7)
for j, deg in enumerate([5, 6, 7, 8, 9, 10, 11, 12, 13, 14]):
    place(tine(note(D4t, deg), 0.5, 3.0), R0 + 0.04 + j * 0.055, 0.03 * (1 - j / 14), pan=-0.6 + 1.2 * j / 9, rev=0.55)

# ------------------------------------------------------------------ VI back to the dot
# every dot is absorbed into the ball: a soft inward shimmer
absorb = sorted(EV.get("absorb", []))
for k, ta in enumerate(absorb):
    deg = 10 + (k * 7) % 8
    place(tine(note(D4t, deg), 0.0, 1.2), ta, 0.008 + 0.006 * math.sin(k), pan=float(rng.uniform(-0.6, 0.6)), rev=0.7)
place(tine(D2 * 8, 0.5, 4.0), 57.6, 0.05, rev=0.6)        # the dot is home

# ------------------------------------------------------------------ hall + master
def hall_ir(seconds=3.4, seed=7):
    r = np.random.default_rng(seed)
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = np.zeros((2, n))
    for ch in range(2):
        x = r.standard_normal(n) * np.exp(-t / 0.75)
        X = np.fft.rfft(x)
        f = np.fft.rfftfreq(n, 1 / SR)
        X *= 1 / (1 + (f / 5200) ** 2)
        ir[ch] = np.fft.irfft(X, n)
        pre = int(0.022 * SR)
        ir[ch] = np.concatenate([np.zeros(pre), ir[ch][:-pre]])
    return ir / np.abs(ir).max()


ir = hall_ir()
L = N + ir.shape[1]
nfft = 1 << (L - 1).bit_length()
wet = np.zeros((2, N))
for ch in range(2):
    y = np.fft.irfft(np.fft.rfft(send[ch], nfft) * np.fft.rfft(ir[ch], nfft), nfft)[:N]
    wet[ch] = y
wet *= 0.9 * np.std(dry) / (np.std(wet) + 1e-12) * 0.55

mix = dry + wet
mix -= mix.mean(axis=1, keepdims=True)
# fade the tail to true silence at 60.0 (frame 0 of a loop is silent too)
mix *= (1 - smooth((T - 59.2) / 0.8))[None, :]
peak = np.abs(mix).max()
mix = mix / peak * 0.89                              # ≈ −1 dBFS
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
print(out, f"peak≈-1 dBFS rms {rms:.1f} dBFS, {len(grains)} grains, {len(absorb)} absorbs")
