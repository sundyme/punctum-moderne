"""Score for PUNCTUM // SIGNAL — 120 bpm, D minor, cut to the picture.

    node tools/export-events.cjs && python3 tools/score.py   →  assets/score.wav

Drums, bass, pads and a chip arpeggio carry the beat; every medium adds its own
machine noise on the frames it happens: telegraph beeps for the Morse, relay
clicks for the bulbs, a press for the riso, flap clacks, a 9-pin printer, a CRT
power-on, glitch stutters, a drop on every media cut. Deterministic (seeded).
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
DUR = 30.0
N = int(DUR * SR)
T = np.arange(N) / SR
BEAT = 0.5
rng = np.random.default_rng(1203)

bus = {k: np.zeros((2, N)) for k in ("drums", "bass", "music", "fx")}
send = np.zeros((2, N))


def tt(d):
    return np.arange(int(d * SR)) / SR


def smooth(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


def pan_g(p):
    a = (p + 1) * math.pi / 4
    return math.cos(a), math.sin(a)


def put(b, sig, t, g=1.0, pan=0.0, rev=0.0):
    i0 = int(round(t * SR))
    if i0 >= N or i0 + len(sig) <= 0:
        return
    if i0 < 0:
        sig = sig[-i0:]
        i0 = 0
    n = min(len(sig), N - i0)
    l, r = pan_g(pan)
    s = sig[:n] * g
    bus[b][0, i0:i0 + n] += s * l
    bus[b][1, i0:i0 + n] += s * r
    if rev:
        send[0, i0:i0 + n] += s * l * rev
        send[1, i0:i0 + n] += s * r * rev


def bandnoise(n, lo, hi):
    x = rng.standard_normal(n)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    X *= ((f >= lo) & (f <= hi))
    y = np.fft.irfft(X, n)
    return y / (np.std(y) + 1e-12)


NZ_HI = bandnoise(4 * SR, 6000, 16000)
NZ_MID = bandnoise(4 * SR, 900, 5000)
NZ_LO = bandnoise(4 * SR, 60, 900)
NZ_WIDE = bandnoise(4 * SR, 200, 12000)


def grain(src, dur, dec, off=None):
    n = int(dur * SR)
    o = int(rng.integers(0, len(src) - n)) if off is None else off
    t = tt(dur)
    return src[o:o + n] * np.exp(-t / dec)


def note_hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


# ------------------------------------------------------------------ voices
def kick(dur=0.45, punch=1.0):
    t = tt(dur)
    f = 46 + 110 * np.exp(-t / 0.03)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (0.16 + 0.1 * punch))
    s += grain(NZ_MID, dur, 0.002) * 0.25
    return np.tanh(s * 1.6)


def clap():
    t = tt(0.3)
    e = np.zeros_like(t)
    for d in (0.0, 0.011, 0.022):
        e += (t >= d) * np.exp(-np.maximum(t - d, 0) / (0.006 if d < 0.02 else 0.09))
    return grain(NZ_MID, 0.3, 10.0) * e


def hat(open_=False):
    return grain(NZ_HI, 0.25 if open_ else 0.06, 0.09 if open_ else 0.014)


def saw(f, dur, bright=12, dec=None, att=0.004):
    t = tt(dur)
    s = np.zeros_like(t)
    for k in range(1, bright + 1):
        if f * k > 15000:
            break
        s += np.sin(2 * np.pi * f * k * t + k * 0.7) / k
    env = np.clip(t / att, 0, 1)
    if dec:
        env = env * np.exp(-t / dec)
    return s * env


def pulse(f, dur, dec=0.12):
    t = tt(dur)
    s = np.zeros_like(t)
    for k in range(1, 16, 2):
        if f * k > 14000:
            break
        s += np.sin(2 * np.pi * f * k * t) / k
    return s * np.exp(-t / dec) * np.clip(t / 0.002, 0, 1)


def supersaw(freqs, dur, bright=10, att=0.01, rel=0.2):
    t = tt(dur)
    s = np.zeros_like(t)
    for f in freqs:
        for det in (-0.12, 0.0, 0.11):
            ff = f * 2 ** (det / 12)
            for k in range(1, bright + 1):
                if ff * k > 12000:
                    break
                s += np.sin(2 * np.pi * ff * k * t + k + det * 5) / k
    env = np.clip(t / att, 0, 1) * np.clip((dur - t) / rel, 0, 1)
    return s * env / max(1, len(freqs))


def beep(f, dur):
    t = tt(dur + 0.01)
    e = np.clip(t / 0.002, 0, 1) * np.clip((dur - t) / 0.003 + 1, 0, 1) * (t < dur + 0.003)
    return (np.sin(2 * np.pi * f * t) + 0.12 * np.sin(2 * np.pi * f * 3 * t)) * e


def riser(t0, t1, f0, f1, g, src=NZ_WIDE, b="fx", rev=0.3, curve=2.0):
    n = int((t1 - t0) * SR)
    hop, win = 1024, np.hanning(4096)
    F = np.fft.rfftfreq(4096, 1 / SR)
    nz = np.tile(src, 1 + (n + 4096) // len(src))[: n + 4096]
    out = np.zeros(n + 4096)
    for j in range(0, n, hop):
        fc = f0 * (f1 / f0) ** (j / max(n, 1))
        m = np.exp(-0.5 * (np.log(np.maximum(F, 20) / fc) / 0.4) ** 2)
        out[j:j + 4096] += np.fft.irfft(np.fft.rfft(nz[j:j + 4096] * win) * m, 4096)
    out = out[:n] / (np.std(out[:n]) + 1e-9)
    e = smooth(np.linspace(0, 1, n)) ** curve
    put(b, out * e, t0, g, rev=rev)


def sub(f, dur, dec):
    t = tt(dur)
    return np.sin(2 * np.pi * f * t) * np.exp(-t / dec) * np.clip(t / 0.004, 0, 1)


# ------------------------------------------------------------------ harmony (D minor)
# one chord per bar: Dm9 | Bbmaj7 | Gm9 | Asus4→A
PROG = [
    [50, 53, 57, 60, 64],      # D F A C E
    [46, 50, 53, 57, 62],      # Bb D F A D
    [43, 46, 50, 53, 57],      # G Bb D F A
    [45, 50, 52, 55, 57],      # A D E G A
]
ROOT = [38, 34, 31, 33]       # bass roots (D2 Bb1 G1 A1)


def chord(bar):
    return PROG[bar % 4]


def energy(t):
    """0 = intro, 1 = groove, 2 = full."""
    return np.interp(t, [0, 3.99, 4, 21.5, 21.51, 22, 24, 26, 30], [0.3, 0.3, 1, 1, 0, 2, 2, 0.4, 0.2])


# ------------------------------------------------------------------ drums
kicks = []
for b in range(60):
    t = b * BEAT
    if t >= 30:
        break
    if 21.5 <= t < 22.0:
        continue                       # the break
    if t >= 26.0 and b % 4 != 0:
        continue                       # outro: only the downbeat
    if t >= 28.0:
        continue
    if 20.0 <= t < 21.5 and b % 2 == 1:
        continue                       # half-time under the pixel sort
    kicks.append(t)
    put("drums", kick(punch=1.3 if t in (0.0, 4.0, 22.0, 24.0) else 1.0), t, 0.9)
for b in range(60):
    t = b * BEAT
    if b % 2 == 1 and 4.0 <= t < 21.5 or (22.0 <= t < 24.0 and b % 2 == 1):
        put("drums", clap(), t, 0.32, pan=0.05, rev=0.25)
for k in range(240):
    t = k * 0.125
    if t < 2.0 or 21.5 <= t < 22.0 or t >= 26.0:
        continue
    acc = 1.0 if k % 2 == 1 else 0.55
    put("drums", hat(open_=(k % 4 == 2 and t >= 4)), t, 0.09 * acc, pan=0.3, rev=0.05)
# 32nd hats + snare roll in the tunnel
for k in range(64):
    t = 16.0 + k / 32 * 2
    put("drums", hat(), t, 0.05 + 0.05 * k / 64, pan=-0.3)
for k in range(32):
    t = 17.0 + k * (1 / 32) * (2 - k / 40)
    if t < 17.98:
        put("drums", clap(), t, 0.04 + 0.16 * (k / 32) ** 2, rev=0.2)

# sidechain: everything melodic ducks under the kick
duck = np.ones(N)
for kt in kicks:
    i0 = int(kt * SR)
    d = np.arange(min(int(0.4 * SR), N - i0)) / SR
    duck[i0:i0 + len(d)] = np.minimum(duck[i0:i0 + len(d)], 1 - 0.75 * np.exp(-d / 0.11))

# ------------------------------------------------------------------ bass + pads + arp
for k in range(240):
    t = k * 0.125
    bar = int(t // 2)
    if t < 4.0 or 21.5 <= t < 22.0 or t >= 26.0:
        continue
    if k % 2 == 1 and not (14.0 <= t < 16.0 or 22.0 <= t < 24.0):
        continue                        # 8ths normally, 16ths when it pumps
    r = ROOT[bar % 4] + (12 if (k // 2) % 4 == 3 else 0)
    put("bass", saw(note_hz(r), 0.2, bright=8, dec=0.12), t, 0.22)
    put("bass", sub(note_hz(r), 0.22, 0.12), t, 0.35)
for bar in range(15):
    t = bar * 2
    if t < 4 or t >= 26:
        continue
    if 20 <= t < 22:
        continue
    fr = [note_hz(m) for m in chord(bar)]
    put("music", supersaw(fr, 2.0, bright=7, att=0.05, rel=0.3), t, 0.10, rev=0.35)
# chip arpeggio from the riso snap until the pixel sort
for k in range(240):
    t = k * 0.125
    if not (8.0 <= t < 20.0):
        continue
    bar = int(t // 2)
    ch = chord(bar)
    m = ch[[0, 2, 4, 3, 1, 2, 4, 3][k % 8]] + 12
    put("music", pulse(note_hz(m), 0.14, 0.07), t, 0.05, pan=(-0.4 if k % 2 else 0.4), rev=0.3)

# ------------------------------------------------------------------ SC 01–02 signal + morse
put("fx", sub(note_hz(26), 1.5, 0.5), 0.0, 0.5)
for b in range(4):
    put("fx", beep(1760, 0.03), b * BEAT, 0.05, rev=0.4)
for e in EV["morse"]:
    put("fx", beep(880, e["dur"] * 0.92), e["t"], 0.09, pan=0.3, rev=0.15)
riser(1.45, 1.78, 600, 5000, 0.035)
riser(3.55, 4.0, 300, 9000, 0.06, curve=3)
put("fx", sub(note_hz(38), 1.0, 0.35), 4.0, 0.5)

# ------------------------------------------------------------------ SC 03 marquee
hum_t = (T >= 4.0) & (T < 6.0)
hum = (np.sin(2 * np.pi * 120 * T) + 0.4 * np.sin(2 * np.pi * 240 * T) + 0.2 * np.sign(np.sin(2 * np.pi * 120 * T))) * hum_t * 0.012
bus["fx"] += hum[None, :]
for k in range(16):
    t = 4.0 + k * 0.125
    put("fx", grain(NZ_MID, 0.04, 0.004), t, 0.14, pan=0.6 if k % 2 else -0.6)
riser(5.35, 6.0, 200, 8000, 0.07, curve=3)

# ------------------------------------------------------------------ SC 04–05 iris + riso
put("fx", sub(note_hz(26), 1.2, 0.4), 6.0, 0.45)
put("fx", grain(NZ_WIDE, 1.2, 0.3), 6.0, 0.05, rev=0.6)
for k in range(32):                           # the press: a mechanical chunk on 8ths
    t = 6.0 + k * 0.125
    if t >= 10.0:
        break
    s = grain(NZ_LO, 0.12, 0.025) * 0.8 + grain(NZ_MID, 0.12, 0.008) * 0.3
    put("fx", s, t, 0.10 if k % 2 == 0 else 0.06, pan=-0.2)
riser(7.6, 8.0, 2000, 12000, 0.03, curve=4)
snap = grain(NZ_HI, 0.2, 0.01) + 0.6 * np.sin(2 * np.pi * 2300 * tt(0.2)) * np.exp(-tt(0.2) / 0.02)
put("fx", snap, 8.0, 0.25, rev=0.3)
riser(9.4, 10.0, 400, 6000, 0.03)

# ------------------------------------------------------------------ SC 06 split-flap
for i, t in enumerate(EV["flaps"]):
    s = grain(NZ_MID, 0.05, 0.005) + 0.4 * np.sin(2 * np.pi * (1800 + 300 * (i % 5)) * tt(0.05)) * np.exp(-tt(0.05) / 0.006)
    put("fx", s, t, 0.035, pan=float(rng.uniform(-0.7, 0.7)))
riser(11.6, 12.0, 6000, 400, 0.04, curve=1.2)     # the paper feed

# ------------------------------------------------------------------ SC 07 printer
for ln in EV["printLines"]:
    d = ln["dur"]
    t = tt(d)
    pins = (np.sign(np.sin(2 * np.pi * 2100 * t)) * 0.4 + np.sin(2 * np.pi * 3170 * t) * 0.3)
    rattle = 0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 96 * t))
    put("fx", pins * rattle * np.clip(t / 0.005, 0, 1) * np.clip((d - t) / 0.01, 0, 1), ln["t"], 0.05, pan=0.2)
    put("fx", grain(NZ_WIDE, 0.06, 0.02), ln["feed"], 0.08, pan=-0.2)
put("fx", kick(0.3, 0.5) + grain(NZ_MID, int(0.3 * SR) / SR, 0.05), 13.72, 0.35, rev=0.2)

# ------------------------------------------------------------------ SC 08–09 pump + tunnel
riser(15.4, 16.0, 150, 3000, 0.07, curve=2.5)
put("fx", sub(note_hz(26), 1.0, 0.4), 16.0, 0.4)
# a saw glissando climbing through the tunnel
tn = tt(1.6)
f = 110 * 2 ** (tn / 1.6 * 3)
gl = np.zeros_like(tn)
for k in range(1, 10):
    gl += np.sin(2 * np.pi * np.cumsum(f * k) / SR) / k
put("music", gl * smooth(tn / 0.3) * (0.4 + 0.6 * tn / 1.6), 16.0, 0.035, rev=0.4)
riser(17.5, 18.0, 9000, 120, 0.06, curve=1.0)     # the collapse

# ------------------------------------------------------------------ SC 10 CRT
put("fx", np.concatenate([sub(note_hz(30), 0.8, 0.25)[:int(0.4 * SR)] + grain(NZ_WIDE, 0.4, 0.04), sub(note_hz(30), 0.8, 0.25)[int(0.4 * SR):]]), 18.0, 0.4, rev=0.3)
whine = np.sin(2 * np.pi * 7800 * T) * ((T > 18.0) & (T < 19.9)) * 0.004
bus["fx"] += whine[None, :]
for k in range(16):
    t = 18.0 + k * 0.125
    if rng.random() < 0.45:
        put("fx", grain(NZ_HI, 0.03, 0.004), t + 0.06, 0.06, pan=float(rng.uniform(-0.8, 0.8)))
# tape stop on the melt
ts = tt(0.45)
f = note_hz(62) * np.exp(-ts * 4)
put("music", np.sin(2 * np.pi * np.cumsum(f) / SR) * (1 - ts / 0.45), 19.55, 0.06)

# ------------------------------------------------------------------ SC 11 pixel sort + break
stutter_src = pulse(note_hz(74), 0.08, 0.04)
for k in range(48):
    t = 20.0 + k / 32 * 2
    if t >= 21.5:
        break
    if (k // 4) % 3 != 2:
        put("music", stutter_src, t, 0.05, pan=(0.5 if k % 2 else -0.5))
for k in range(8):
    t = 21.5 + k * 0.0625
    put("fx", beep(2600 if k % 2 else 1300, 0.02), t, 0.06)
riser(21.5, 22.0, 250, 12000, 0.08, curve=3)

# ------------------------------------------------------------------ SC 12 the drop
for i, t in enumerate(EV["dropCuts"]):
    bar = int(t // 2)
    fr = [note_hz(m + 12) for m in chord(bar)]
    put("music", supersaw(fr, 0.22, bright=12, att=0.003, rel=0.08), t, 0.14, rev=0.3)
    put("fx", grain(NZ_WIDE, 0.12, 0.03), t, 0.06)
put("fx", sub(note_hz(26), 1.4, 0.6), 22.0, 0.55)
riser(23.4, 24.0, 300, 14000, 0.09, curve=3.5)

# ------------------------------------------------------------------ SC 13 lock
put("fx", sub(note_hz(26), 3.0, 1.2), 24.0, 0.65)
put("fx", grain(NZ_WIDE, 2.5, 0.6), 24.0, 0.07, rev=0.8)
put("music", supersaw([note_hz(m) for m in [38, 50, 57, 60, 64, 69]], 4.0, bright=9, att=0.002, rel=1.8) * np.exp(-tt(4.0) / 1.8), 24.0, 0.2, rev=0.6)
put("music", pulse(note_hz(81), 1.5, 0.5), 24.0, 0.04, rev=0.7)

# ------------------------------------------------------------------ SC 14 end
pad_t = tt(4.2)
put("music", supersaw([note_hz(m) for m in [50, 57, 62, 64, 69]], 4.2, bright=5, att=0.6, rel=1.4) * 0.6, 25.8, 0.10, rev=0.6)
for i, t in enumerate(EV["type"]):
    put("fx", grain(NZ_HI, 0.025, 0.003)[:1200] + 0.3 * grain(NZ_MID, 0.025, 0.004)[:1200], t, 0.07, pan=-0.3 + 0.6 * i / len(EV["type"]))
for b in range(56, 60):
    t = b * BEAT
    if t < EV["cursorOff"]:
        put("fx", beep(1760, 0.03), t, 0.03, rev=0.4)
put("fx", beep(880, 0.06), EV["cursorOff"], 0.09, rev=0.6)        # the last dit

# ------------------------------------------------------------------ mix
for b in ("bass", "music"):
    bus[b] *= duck[None, :]
mix = bus["drums"] * 1.0 + bus["bass"] * 0.9 + bus["music"] * 0.9 + bus["fx"] * 1.0


def room_ir(seconds=2.2, seed=3):
    r = np.random.default_rng(seed)
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = np.zeros((2, n))
    for ch in range(2):
        x = r.standard_normal(n) * np.exp(-t / 0.45)
        X = np.fft.rfft(x)
        f = np.fft.rfftfreq(n, 1 / SR)
        X *= 1 / (1 + (f / 6500) ** 2)
        ir[ch] = np.fft.irfft(X, n)
    return ir / np.abs(ir).max()


ir = room_ir()
L = N + ir.shape[1]
nfft = 1 << (L - 1).bit_length()
wet = np.zeros((2, N))
for ch in range(2):
    wet[ch] = np.fft.irfft(np.fft.rfft(send[ch], nfft) * np.fft.rfft(ir[ch], nfft), nfft)[:N]
wet *= 0.35 * np.std(mix) / (np.std(wet) + 1e-12)
mix = mix + wet
mix -= mix.mean(axis=1, keepdims=True)
mix *= (1 - smooth((T - 29.6) / 0.4))[None, :]
mix /= np.abs(mix).max()
mix = np.tanh(mix * 1.6) / np.tanh(1.6)            # glue
mix *= 0.89 / np.abs(mix).max()

out = os.path.join(FILM, "assets", "score.wav")
with wave.open(out, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((np.clip(mix.T, -1, 1) * 32767).astype("<i2").tobytes())
seg = lambda a, b: 20 * np.log10(np.sqrt((mix[:, int(a * SR):int(b * SR)] ** 2).mean()) + 1e-12)
print(out, " ".join(f"{a}-{b}:{seg(a, b):.1f}" for a, b in [(0, 2), (2, 4), (4, 6), (6, 10), (10, 14), (14, 18), (18, 22), (22, 24), (24, 26), (26, 30)]))
