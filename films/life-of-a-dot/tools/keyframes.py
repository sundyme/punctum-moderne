"""Keyframe sketches for the Punctum film, drawn with the real glyph dots.

Writes film/storyboard.html: one static SVG per keyframe (1920x1080 viewBox),
geometry from src/glyphs.json and the radius model in src/radii.py. The same
scene maths is ported to the JS engine for the build.
"""
import base64
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
FILM = os.path.dirname(HERE)
V2 = os.path.dirname(FILM)
sys.path.insert(0, os.path.join(V2, "src"))
from radii import radius  # noqa: E402

G = json.load(open(os.path.join(V2, "src", "glyphs.json")))
W, H = 1920, 1080
BG, DOT, VIOLET = "#0C0B0E", "#EDEBE6", "#B9A4E8"
WGHT = 400


def rpx(tone, pitch, c=100, w=WGHT):
    return radius(tone, w, c, 0.0) / 100 * pitch


def lerp(a, b, t):
    return a + (b - a) * t


def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def smooth(x):
    x = clamp(x)
    return x * x * (3 - 2 * x)


def sine_io(x):
    x = clamp(x)
    return 0.5 - 0.5 * math.cos(math.pi * x)


def mix_hex(a, b, t):
    pa = [int(a[i:i + 2], 16) for i in (1, 3, 5)]
    pb = [int(b[i:i + 2], 16) for i in (1, 3, 5)]
    return "#" + "".join(f"{round(lerp(x, y, t)):02X}" for x, y in zip(pa, pb))


def layout(text):
    """[(col, row, tone, char_index)] in grid units; advance = width + 1."""
    out, x = [], 0
    for i, ch in enumerate(text):
        g = G[ch]
        for gx, gy, t in g["d"]:
            out.append((x + gx, gy, t, i))
        x += g["w"] + 1
    return out, x - 1


def text_width(text):
    return sum(G[c]["w"] + 1 for c in text) - 1


class Svg:
    def __init__(self, key):
        self.key = key
        self.el = []

    def circle(self, x, y, r, fill=DOT, op=1.0):
        if r <= 0.05 or op <= 0.003 or x < -r or x > W + r or y < -r or y > H + r:
            return
        o = f' opacity="{op:.3f}"' if op < 0.999 else ""
        self.el.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.2f}" fill="{fill}"{o}/>')

    def raw(self, s):
        self.el.append(s)

    def reg(self, pitch, ox, oy, op_fn=None, base=0.15, size=1.7):
        """Registration points at every cell centre of a lattice through (ox, oy)."""
        if pitch < 6:
            return
        i0, i1 = math.floor((0 - ox) / pitch) - 1, math.ceil((W - ox) / pitch) + 1
        j0, j1 = math.floor((0 - oy) / pitch) - 1, math.ceil((H - oy) / pitch) + 1
        for i in range(i0, i1 + 1):
            for j in range(j0, j1 + 1):
                x, y = ox + i * pitch, oy + j * pitch
                op = base * (op_fn(x, y) if op_fn else 1)
                self.circle(x, y, size, DOT, op)

    def render(self):
        k = self.key
        return (
            f'<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" role="img">'
            f'<defs><radialGradient id="vg{k}" cx="50%" cy="50%" r="75%">'
            f'<stop offset="55%" stop-color="#000" stop-opacity="0"/>'
            f'<stop offset="100%" stop-color="#000" stop-opacity="0.32"/></radialGradient>'
            f'<filter id="gr{k}" x="0" y="0" width="100%" height="100%">'
            f'<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="{k}"/>'
            f'<feColorMatrix values="0 0 0 0 0.93 0 0 0 0 0.92 0 0 0 0 0.90 0 0 0 0.9 0"/></filter></defs>'
            f'<rect width="{W}" height="{H}" fill="{BG}"/>'
            + "".join(self.el)
            + f'<rect width="{W}" height="{H}" filter="url(#gr{k})" opacity="0.045"/>'
            f'<rect width="{W}" height="{H}" fill="url(#vg{k})"/></svg>'
        )


# ---------------------------------------------------------------- I Breath
R_I = 54.0
CX, CY = 960.0, 540.0


def breath_r(t):
    return R_I + 8 * math.sin(2 * math.pi * t / 4)


def kf_breath(t, key):
    s = Svg(key)
    front = (t - 2.5) / 3.5 * 1250

    def op(x, y):
        d = math.hypot(x - CX, y - CY)
        return smooth((front - d) / 260)

    s.reg(110, CX, CY, op)
    s.circle(CX, CY, breath_r(t))
    return s


# ---------------------------------------------------------------- II Pen
P2 = 110.0
A_STROKES = [
    [(0, 5), (1, 6), (2, 6), (3, 6), (4, 5), (4, 4), (4, 3), (4, 2), (4, 1), (4, 0), (5, 0)],
    [(3, 3), (2, 3), (1, 3), (0, 2), (0, 1), (1, 0), (2, 0), (3, 0)],
]
A_TONE = {(x, y): t for x, y, t in G["a"]["d"]}
# 'a' grid (0,5) sits on the lone dot; camera pans the glyph centre (2.5, 3) to frame centre


def a_world(gx, gy):
    return CX + gx * P2, CY - (gy - 5) * P2


A_CENTER = a_world(2.5, 3)
PAN_END = (CX - A_CENTER[0], CY - A_CENTER[1])


def pan2(t):
    u = sine_io((t - 8.0) / 5.0)
    return PAN_END[0] * u, PAN_END[1] * u


def catmull(pts, steps=48):
    out = []
    n = len(pts)
    for i in range(n - 1):
        p0 = pts[max(i - 1, 0)]
        p1, p2 = pts[i], pts[i + 1]
        p3 = pts[min(i + 2, n - 1)]
        for k in range(steps):
            u = k / steps
            u2, u3 = u * u, u * u * u
            out.append(tuple(
                0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * u + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * u2
                       + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * u3) for j in range(3)))
    out.append(pts[-1])
    return out


def ink_path(stroke):
    pts = []
    for gx, gy in stroke:
        x, y = a_world(gx, gy)
        pts.append((x, y, rpx(A_TONE[(gx, gy)], P2) * 0.9))
    return catmull(pts)


INK = [ink_path(st) for st in A_STROKES]
# pen timing: stroke 1 8.0–11.2, stroke 2 11.5–13.0
PEN_T = [(8.0, 11.2), (11.5, 13.0)]
SAMPLE_T0, SAMPLE_DT = 13.0, 2.0 / 19


def draw_ink(s, t, ox, oy, op=1.0, skip_before=None):
    if op <= 0.003:
        return
    s.raw(f'<g opacity="{op:.3f}">')
    for (t0, t1), path in zip(PEN_T, INK):
        frac = clamp((t - t0) / (t1 - t0))
        n = int(len(path) * sine_io(frac) if frac < 1 else len(path))
        for k in range(0, n, 2):
            x, y, r = path[k]
            s.circle(x + ox, y + oy, r, DOT)
    s.raw('</g>')


def a_order():
    return [p for st in A_STROKES for p in st]


def kf_pen(t, key):
    s = Svg(key)
    ox, oy = pan2(t)
    s.reg(P2, CX + ox, CY + oy)
    order = a_order()
    if t < SAMPLE_T0:
        draw_ink(s, t, ox, oy)
        return s
    k = int((t - SAMPLE_T0) / SAMPLE_DT)
    ink_op = 0.16 + 0.84 * (1 - smooth((t - SAMPLE_T0) / 0.45)) - 0.16 * smooth((t - 14.6) / 0.8)
    draw_ink(s, t, ox, oy, ink_op)
    # sampling lattice: hairline cell borders over the glyph, fading after 15.0
    g_op = 0.28 * clamp(1 - (t - 15.0) / 1.2) + 0.06
    for i in range(-1, 8):
        x = CX + ox + (i - 0.5) * P2
        s.raw(f'<line x1="{x:.1f}" y1="{CY + oy - 2.5 * P2:.1f}" x2="{x:.1f}" y2="{CY + oy + 6.5 * P2:.1f}" '
              f'stroke="{DOT}" stroke-width="1.2" opacity="{g_op:.3f}"/>')
    for j in range(-2, 8):
        y = CY + oy + (j - 0.5) * P2
        s.raw(f'<line x1="{CX + ox - 1.5 * P2:.1f}" y1="{y:.1f}" x2="{CX + ox + 6.5 * P2:.1f}" y2="{y:.1f}" '
              f'stroke="{DOT}" stroke-width="1.2" opacity="{g_op:.3f}"/>')
    violet = smooth((t - 15.0) / 0.5) * (1 - smooth((t - 17.6) / 1.2))
    for i, (gx, gy) in enumerate(order[:k + 1]):
        x, y = a_world(gx, gy)
        age = t - (SAMPLE_T0 + i * SAMPLE_DT)
        pop = 1 + 0.22 * math.exp(-age * 7) * (age >= 0)
        col = mix_hex(DOT, VIOLET, violet) if (gx, gy) == (0, 5) else DOT
        s.circle(x + ox, y + oy, rpx(A_TONE[(gx, gy)], P2) * pop, col)
        if 0 <= age < 0.5:
            rr = rpx(A_TONE[(gx, gy)], P2) + age * 160
            s.raw(f'<circle cx="{x + ox:.1f}" cy="{y + oy:.1f}" r="{rr:.1f}" fill="none" stroke="{DOT}" '
                  f'stroke-width="1.5" opacity="{0.5 * (1 - age / 0.5):.3f}"/>')
    return s


# ---------------------------------------------------------------- III Punch
P3 = 30.0
WORD = "Moderne"
WD, WD_W = layout(WORD)
N_STRIKES = WD_W                      # 48 columns
HEAD_X = 960 + (WD_W - 1) / 2 * P3    # last column lands so the word is centred
BASE3 = 540 + 5 * P3                  # baseline: rows 0..9 centred


def strike_times():
    d0, d1 = 0.26, 0.04
    r = (d1 / d0) ** (1 / (N_STRIKES - 1))
    ts, t = [], 19.6
    for i in range(N_STRIKES):
        ts.append(t)
        t += d0 * r ** i
    return ts


STRIKES = strike_times()


def cntr3(t):
    return 100 * sine_io((t - 26.0) / 1.6)


def kf_punch(t, key):
    s = Svg(key)
    k = sum(1 for x in STRIKES if x <= t)          # columns struck
    c = cntr3(t)
    shift = (k - 1)
    s.reg(P3, HEAD_X, BASE3 - 0.5 * P3, base=0.12, size=1.3)
    for col, row, tone, _ in WD:
        if col >= k:
            continue
        x = HEAD_X - (shift - col) * P3
        y = BASE3 - (row + 0.5) * P3
        age = t - STRIKES[col]
        flash = math.exp(-age * 18) if age >= 0 else 0
        s.circle(x, y, rpx(tone, P3, c) * (1 + 0.35 * flash), DOT)
    # head: axis + 10 pins
    hx = HEAD_X + 0.9 * P3
    s.raw(f'<line x1="{hx:.1f}" y1="{BASE3 - 11 * P3:.1f}" x2="{hx:.1f}" y2="{BASE3 + 1 * P3:.1f}" '
          f'stroke="{DOT}" stroke-width="1.5" opacity="0.45"/>')
    last = STRIKES[k - 1] if k else -9
    fire = math.exp(-(t - last) * 14) if k < N_STRIKES or t - last < 0.5 else 0
    live = {row for col, row, _, _ in WD if col == k - 1}
    for row in range(10):
        y = BASE3 - (row + 0.5) * P3
        hot = row in live
        op = 0.35 + 0.6 * fire * hot
        s.raw(f'<line x1="{hx + 6:.1f}" y1="{y:.1f}" x2="{hx + 1.6 * P3:.1f}" y2="{y:.1f}" stroke="{DOT}" '
              f'stroke-width="{2.2 if hot else 1.4}" opacity="{op:.3f}"/>')
    return s


# ---------------------------------------------------------------- IV Music box
P4 = 60.0
COLDT = 0.27
T_FIRST = 29.6
V4 = P4 / COLDT
BASE4 = 540 + 5 * P4
TILT = math.tan(math.radians(4))


def comb_x(row):
    return 960 + TILT * (row - 4.5) * P4


def word_left4(t):
    return 960 - 0.5 * P4 - V4 * (t - T_FIRST)


def kf_music(t, key):
    s = Svg(key)
    xl = word_left4(t)
    s.reg(P4, xl + 0.5 * P4, BASE4 - 0.5 * P4, base=0.10, size=1.5)
    # tines: staff-like hairlines to the right of the comb, length by pitch
    plucked = {}
    for col, row, tone, _ in WD:
        x = xl + (col + 0.5) * P4
        cross = T_FIRST + (col * P4 - (comb_x(row) - comb_x(4.5))) / V4
        age = t - cross
        if 0 <= age < 1.2:
            plucked[row] = min(plucked.get(row, 9), age)
    for row in range(10):
        y = BASE4 - (row + 0.5) * P4
        x0 = comb_x(row)
        L = 760 - row * 46
        age = plucked.get(row)
        if age is not None:
            amp = 7 * math.exp(-age * 4)
            pts = " ".join(f"{x0 + u * L:.1f},{y + amp * math.sin(math.pi * u) * math.cos(age * 60):.1f}"
                           for u in [i / 24 for i in range(25)])
            s.raw(f'<polyline points="{pts}" fill="none" stroke="{DOT}" stroke-width="2" '
                  f'opacity="{0.25 + 0.5 * math.exp(-age * 3):.3f}"/>')
        else:
            s.raw(f'<line x1="{x0:.1f}" y1="{y:.1f}" x2="{x0 + L:.1f}" y2="{y:.1f}" stroke="{DOT}" '
                  f'stroke-width="1.4" opacity="0.2"/>')
    top, bot = BASE4 - 10.4 * P4, BASE4 + 0.4 * P4
    s.raw(f'<line x1="{960 + TILT * 5.9 * P4:.1f}" y1="{top:.1f}" x2="{960 - TILT * 4.9 * P4:.1f}" y2="{bot:.1f}" '
          f'stroke="{DOT}" stroke-width="2" opacity="0.55"/>')
    for col, row, tone, _ in WD:
        x = xl + (col + 0.5) * P4
        y = BASE4 - (row + 0.5) * P4
        cross = T_FIRST + (col * P4 - (comb_x(row) - comb_x(4.5))) / V4
        age = t - cross
        r = rpx(tone, P4)
        if age < 0:
            s.circle(x, y, r, DOT, 0.42)
        else:
            pulse = math.exp(-age * 6)
            s.circle(x, y, r * (1 + 0.28 * pulse), DOT, 0.86 + 0.14 * pulse)
            if age < 0.7:
                s.raw(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r + age * 120:.1f}" fill="none" stroke="{DOT}" '
                      f'stroke-width="1.3" opacity="{0.45 * (1 - age / 0.7):.3f}"/>')
    return s


# ---------------------------------------------------------------- V Powers of One
WM = ["Punctum", "Moderne"]
P5 = 28.0
W_WM = 600
WM_LEFT = (W - text_width(WM[0]) * P5) / 2
WM_BASE = [400.0, 400.0 + 14 * P5]
DISC_R_CELLS = 72.0
BALL_TONE = 1.3
CELLS_PER_WM = DISC_R_CELLS / (radius(BALL_TONE, W_WM, 100, 0) / 100)   # text cells per wordmark pitch
S_END = P5 / CELLS_PER_WM


def wordmark_dots():
    out = []
    for li, line in enumerate(WM):
        dots, _ = layout(line)
        for col, row, tone, ci in dots:
            x = WM_LEFT + (col + 0.5) * P5
            y = WM_BASE[li] - (row + 0.5) * P5
            out.append((x, y, tone, li, ci, col, row))
    return out


WMD = wordmark_dots()
# target: the ball terminal of 'r' in "Moderne"
TARGET = next(d for d in WMD if d[3] == 1 and WM[1][d[4]] == "r" and d[2] > 1.1)
LINE_TXT = "Punctum Moderne · A dot-matrix Didone · "


_DISC_CACHE = {}


def disc_lines_cached(R, phase):
    key = (round(R, 1), phase)
    if key not in _DISC_CACHE:
        _DISC_CACHE[key] = disc_lines(R, phase)
    return _DISC_CACHE[key]


def disc_lines(R, phase=0):
    """Text dots inside a disc of radius R (cells), centred at 0; 'Moderne' centred on line 0."""
    period, pw = layout(LINE_TXT)
    pw += 1
    m_col = next(c for c, r, t, ci in period if LINE_TXT[ci] == "M" and ci > 5)
    m_off = text_width("Punctum ")
    start0 = -(m_off + WD_W / 2)            # line 0: word "Moderne" centred at x=0
    out = []
    for li in range(-5, 6):
        base = -5 + 16 * li
        start = start0 + li * 37 + phase * 23
        if abs(base + 5) > R + 6:
            continue
        k0 = math.floor((-R - start) / pw) - 1
        k1 = math.ceil((R - start) / pw) + 1
        for k in range(k0, k1 + 1):
            for col, row, tone, ci in period:
                x = start + k * pw + col + 0.5
                y = base + row + 0.5
                if x * x + y * y <= R * R:
                    out.append((x, y, tone))
    return out


DISC_TARGET = disc_lines(DISC_R_CELLS)


def zoom5(t):
    u = smooth((t - 43.0) / 8.0)
    return P4 * (S_END / P4) ** u, u


def tagline_svg(op):
    y = WM_BASE[1] + 4.2 * P5
    return (f'<text x="{WM_LEFT + 0.25 * P5:.1f}" y="{y:.1f}" class="tag" opacity="{op:.3f}">'
            'A dot-matrix Didone</text>')


def kf_powers(t, key, tagline=None):
    s = Svg(key)
    sc, u = zoom5(t)
    p0 = (960, 540)
    p1 = (TARGET[0], TARGET[1])
    pu = sine_io((t - 43.0) / 7.0)
    px, py = lerp(p0[0], p1[0], pu), lerp(p0[1], p1[1], pu)
    fuse = smooth((t - 50.4) / 1.0)
    violet = smooth((t - 51.0) / 0.6)
    # every wordmark dot is a disc of text; positions relative to the target disc
    k = CELLS_PER_WM * sc / P5           # screen px per wordmark px
    for x, y, tone, li, ci, col, row in WMD:
        cx = px + (x - TARGET[0]) * k
        cy = py + (y - TARGET[1]) * k
        R = radius(tone, W_WM, 100, 0) / 100 * CELLS_PER_WM * sc
        if cx < -R or cx > W + R or cy < -R or cy > H + R:
            continue
        is_t = (x, y) == (TARGET[0], TARGET[1])
        col_fill = mix_hex(DOT, VIOLET, violet) if is_t else DOT
        if sc >= 2.5 and is_t:
            ctx_op = smooth((t - 43.2) / 1.8)
            for dx, dy, tn in DISC_TARGET:
                X, Y = cx + dx * sc, cy - dy * sc
                on_line0 = abs(dy - 0) < 11 and abs(dx) < WD_W / 2 + 1
                s.circle(X, Y, rpx(tn, sc), DOT, 1.0 if on_line0 else ctx_op)
            continue
        if R < 1.2:
            s.circle(cx, cy, R, col_fill, lerp(0.38, 1, fuse))
            continue
        if sc >= 0.5 and fuse < 1:
            Rc = R / sc
            s.raw(f'<g opacity="{1 - fuse:.3f}">')
            for dx, dy, tn in disc_lines_cached(Rc, (col * 7 + row * 3 + li) % 5):
                s.circle(cx + dx * sc, cy - dy * sc, max(rpx(tn, sc), 0.45), DOT)
            s.raw('</g>')
            s.circle(cx, cy, R, col_fill, fuse)
            continue
        # texture: one strip per text line, clipped by the disc
        if fuse < 1:
            cid = f"c{key}_{li}_{col}_{row}"
            s.raw(f'<clipPath id="{cid}"><circle cx="{cx:.1f}" cy="{cy:.1f}" r="{R:.2f}"/></clipPath><g clip-path="url(#{cid})" opacity="{1 - fuse:.3f}">')
            for li2 in range(-5, 6):
                yb = cy - (-5 + 16 * li2 + 5) * sc
                h = 10 * sc
                s.raw(f'<rect x="{cx - R:.1f}" y="{yb - h / 2:.1f}" width="{2 * R:.1f}" height="{h:.2f}" fill="{DOT}" opacity="0.42"/>')
            s.raw('</g>')
        s.circle(cx, cy, R, col_fill, fuse)
    if tagline is not None and tagline > 0:
        s.raw(tagline_svg(tagline))
    return s


# ---------------------------------------------------------------- VI Back to the dot
def kf_return(t, key):
    s = Svg(key)
    ball_px = rpx(BALL_TONE, P5, w=W_WM)
    zu = sine_io((t - 55.3) / 2.3)
    k = lerp(1, R_I / ball_px, zu)
    px, py = lerp(TARGET[0], CX, zu), lerp(TARGET[1], CY, zu)
    maxd = max(math.hypot(x - TARGET[0], y - TARGET[1]) for x, y, *_ in WMD)
    violet = 1 - smooth((t - 56.2) / 1.8)
    for x, y, tone, *_ in WMD:
        if (x, y) == (TARGET[0], TARGET[1]):
            continue
        d = math.hypot(x - TARGET[0], y - TARGET[1])
        start = 55.2 + 1.3 * d / maxd
        u = clamp((t - start) / 0.95)
        pull = u ** 3                       # power3.in: accelerate into the ball
        wx, wy = lerp(x, TARGET[0], pull), lerp(y, TARGET[1], pull)
        r = rpx(tone, P5, w=W_WM) * (1 - smooth(u)) * k
        s.circle(px + (wx - TARGET[0]) * k, py + (wy - TARGET[1]) * k, r, DOT)
    r_ball = ball_px * k if t < 57.6 else breath_r(t)
    s.circle(px, py, r_ball, mix_hex(DOT, VIOLET, violet))
    tag = 1 - smooth((t - 55.0) / 0.6)
    if tag > 0:
        s.raw(tagline_svg(tag))
    return s


# ---------------------------------------------------------------- Loop dive-in
def kf_dive(t, key):
    s = Svg(key)
    u = smooth((t - 2.0) / 3.5)
    R0 = R_I
    R = R0 * (40 ** u)
    sc = R / DISC_R_CELLS
    dissolve = smooth((t - 2.6) / 1.6)
    s.circle(CX, CY, R, DOT, 1 - dissolve * 0.92)
    if sc > 0.5:
        for dx, dy, tn in DISC_TARGET:
            s.circle(CX + dx * sc, CY - dy * sc, rpx(tn, sc), DOT, dissolve)
    return s


# ---------------------------------------------------------------- sheet
CELLS = [
    # act, id, name, time label, svg, note, seam
    ("I Breath · 0–8s", "frame-01", "BREATH", 0.0, lambda k: kf_breath(0.0, k),
     "<b>Frame 0.</b> One dot at rest, r = 54px — identical to the very last frame and to the loop's first frame.", "cut in"),
    (None, "frame-01b", "BREATH", 5.5, lambda k: kf_breath(5.5, k),
     "<b>The grid arrives.</b> Registration points spread outward from the dot at a 110px pitch while the dot breathes (46–62px).", "continuous"),
    ("II Pen · 8–19s", "frame-02", "PEN", 10.5, lambda k: kf_pen(10.5, k),
     "<b>The pen leaves the dot.</b> Ink is drawn in stroke order: the hairline arch, then the thick stem. Width follows pressure, and the camera slowly pans the 'a' toward centre.", "continuous"),
    (None, "frame-02b", "PEN", 14.2, lambda k: kf_pen(14.2, k),
     "<b>Grid sampling.</b> Grid hairlines sweep across, and each cell the ink passes through snaps into a dot in pen order, each plucking one note. The ink fades.", "continuous"),
    (None, "frame-02c", "PEN", 16.2, lambda k: kf_pen(16.2, k),
     "<b>Held frame.</b> The first dot is the ball of 'a' and turns Parma violet. Only the bell decays.", "paper feeds left"),
    ("III Punch · 19–29s", "frame-03", "PUNCH", 23.0, lambda k: kf_punch(23.0, k),
     "<b>Column strikes.</b> The print head is fixed on the right with 10 pins; the paper feeds left one cell per strike, with all dots equal (CNTR 0). Strikes accelerate from 0.26s to 0.04s.", "continuous"),
    (None, "frame-03b", "PUNCH", 27.8, lambda k: kf_punch(27.8, k),
     "<b>The contrast breathes.</b> CNTR 0→100: stems swell, hairlines shrink to pin-pricks, and the ball of 'r' grows to 1.3×. The machine becomes a Didone.", "push in"),
    ("IV Music box · 29–43s", "frame-04", "MUSIC BOX", 32.0, lambda k: kf_music(32.0, k),
     "<b>The comb plucks.</b> The comb is tilted 4°, so each column rolls like an arpeggio. Tines extend to the right; length encodes pitch. Played dots light up; unplayed dots wait at 42%.", "continuous"),
    (None, "frame-04b", "MUSIC BOX", 38.6, lambda k: kf_music(38.6, k),
     "<b>The ball of 'r' rings a bell.</b> The text keeps feeding left at a constant 0.27s per column; the played part stays lit.", "pull back"),
    ("V Powers of One · 43–55s", "frame-05", "POWERS", 46.0, lambda k: kf_powers(46.0, k),
     "<b>Logarithmic pull-back.</b> “Moderne” is just one line of a round paragraph: “Punctum Moderne · A dot-matrix Didone” repeats; the edge of the disc enters the frame.", "continuous"),
    (None, "frame-05b", "POWERS", 47.7, lambda k: kf_powers(47.7, k),
     "<b>The paragraph is one dot.</b> Neighbouring discs appear, each one a paragraph clipped to its own dot size, together forming the matrix of the giant wordmark.", "continuous"),
    (None, "frame-05c", "POWERS", 53.5, lambda k: kf_powers(53.5, k, tagline=1.0),
     "<b>Peak and held frame.</b> The text fuses into ink, the 'r' ball we came out of turns violet, and “A dot-matrix Didone” is set in the real font file.", "continuous"),
    ("VI Back to the dot · 55–60s", "frame-06", "RETURN", 56.0, lambda k: kf_return(56.0, k),
     "<b>Back into the dot.</b> From nearest to farthest, every dot accelerates along its own line into the violet ball and is absorbed. The camera pushes in on the ball, returning it to centre and to r = 54px.", "continuous"),
    (None, "frame-06b", "RETURN", 60.0, lambda k: kf_return(60.0, k),
     "<b>Last frame = first frame.</b> White again, breathing, pixel-identical to 0.0s. Silence.", "loop"),
    ("Hero loop · 15s, silent", "frame-07", "LOOP", 4.6, lambda k: kf_dive(4.6, k),
     "<b>Dive into the dot.</b> The solid dot dissolves into its round paragraph (≈40× push-in), then the V pull-back follows and the wordmark resolves.", "pull back"),
    (None, "frame-07b", "LOOP", 11.5, lambda k: kf_powers(53.5, k, tagline=1.0),
     "<b>Loop hold, 10.5–13.2s.</b> The wordmark and tagline are the site's first screen, then the shot returns to the dot (13.2–15s); the first and last frames match.", "loop"),
]


def page(cells_html):
    font = "data:font/woff2;base64," + base64.b64encode(
        open(os.path.join(V2, "fonts", "PunctumModerne-VF.woff2"), "rb").read()).decode()
    return f"""<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Punctum Storyboard</title>
<style>
@font-face {{ font-family: "Punctum Moderne"; src: url("{font}") format("woff2"); font-weight: 100 900; }}
:root {{ --bg:#0A090C; --panel:#121116; --fg:#EDEBE6; --mute:#8E8A97; --rule:#26232C; --violet:#B9A4E8; color-scheme: dark; }}
* {{ box-sizing: border-box; }}
body {{ margin:0; background:var(--bg); color:var(--fg); font:15px/1.55 -apple-system, "PingFang SC", "Helvetica Neue", sans-serif; padding: 56px 48px 96px; }}
header {{ display:grid; grid-template-columns: 1fr auto; align-items:end; gap: 24px; border-bottom:1px solid var(--rule); padding-bottom: 28px; margin-bottom: 8px; }}
h1 {{ font-family:"Punctum Moderne"; font-weight:400; font-size: 96px; line-height: 1; margin:0; letter-spacing:0; font-variation-settings:"opsz" 96; }}
.dek {{ color: var(--mute); max-width: 62ch; margin: 18px 0 0; }}
.tag {{ font-family:"Punctum Moderne"; font-size:56px; fill: var(--fg); font-variation-settings:"opsz" 56, "wght" 400, "CNTR" 100; }}
.meta {{ font: 12px/1.6 ui-monospace, "SF Mono", Menlo, monospace; color: var(--mute); text-align:right; letter-spacing: .06em; text-transform: uppercase; }}
.meta b {{ color: var(--violet); font-weight: 500; }}
.act {{ display:flex; align-items:baseline; gap:16px; margin: 44px 0 14px; font: 12px/1 ui-monospace, "SF Mono", Menlo, monospace; letter-spacing:.12em; text-transform:uppercase; color: var(--fg); }}
.act::after {{ content:""; flex:1; height:1px; background: var(--rule); }}
.grid {{ display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 28px 22px; }}
figure {{ margin:0; min-width:0; }}
.shot {{ aspect-ratio:16/9; width:100%; border-radius: 3px; overflow:hidden; outline:1px solid var(--rule); background:#0C0B0E; }}
.shot svg {{ display:block; width:100%; height:100%; }}
figcaption {{ padding-top: 12px; }}
.lab {{ display:flex; justify-content:space-between; font: 11.5px/1.4 ui-monospace, "SF Mono", Menlo, monospace; letter-spacing:.08em; color: var(--mute); }}
.lab span:first-child {{ color: var(--fg); }}
figcaption p {{ margin: 8px 0 10px; color: #C9C5CF; font-size: 14px; }}
figcaption p b {{ color: var(--fg); font-weight: 600; }}
.chip {{ display:inline-block; font: 10.5px/1 ui-monospace, Menlo, monospace; letter-spacing:.1em; text-transform:uppercase; color: var(--mute); border:1px solid var(--rule); border-radius: 99px; padding: 5px 9px; }}
.closing {{ display:grid; grid-template-columns: 2fr 1fr; gap: 22px; margin-top: 52px; }}
.box {{ background: var(--panel); border:1px solid var(--rule); border-radius: 4px; padding: 26px 28px; min-width:0; }}
.box h3 {{ margin:0 0 18px; font: 12px/1 ui-monospace, Menlo, monospace; letter-spacing:.12em; text-transform:uppercase; color: var(--mute); font-weight: 400; }}
.seams {{ display:grid; grid-template-columns: repeat(6, 1fr); gap: 0; position:relative; }}
.seams div {{ border-left: 1px solid var(--rule); padding: 0 12px 4px; font-size: 13px; color:#C9C5CF; }}
.seams div b {{ display:block; font-family:"Punctum Moderne"; font-size: 30px; font-weight: 400; color: var(--fg); margin-bottom: 6px; font-variation-settings:"opsz" 30; }}
.bar {{ height: 6px; display:flex; margin: 0 0 18px; border-radius: 3px; overflow:hidden; }}
.bar i {{ display:block; height:100%; }}
.sw {{ display:flex; gap: 10px; margin-bottom: 18px; }}
.sw span {{ flex:1; font: 11px/1.4 ui-monospace, Menlo, monospace; color: var(--mute); }}
.sw span::before {{ content:""; display:block; height: 46px; border-radius: 3px; margin-bottom: 8px; background: var(--c); outline: 1px solid var(--rule); }}
.box ul {{ margin: 0; padding-left: 18px; color:#C9C5CF; font-size: 13.5px; }}
@media (max-width: 1100px) {{ .grid {{ grid-template-columns: repeat(2, minmax(0,1fr)); }} .closing {{ grid-template-columns: 1fr; }} }}
@media (max-width: 680px) {{ body {{ padding: 32px 16px 64px; }} .grid {{ grid-template-columns: 1fr; }} h1 {{ font-size: 56px; }} header {{ grid-template-columns: 1fr; }} .meta {{ text-align:left; }} .seams {{ grid-template-columns: repeat(3,1fr); row-gap: 16px; }} }}
</style></head><body>
<header>
  <div><h1>Punctum</h1>
  <p class="dek">The life of one dot. A single take with no cuts: the dot is the pen's ball terminal, a print-head strike, a music-box pin, and a dot in the wordmark, then it returns to being one dot. Every dot below is drawn from the real data in <code>glyphs.json</code> and the radius model.</p></div>
  <div class="meta">Storyboard <b>v1</b> · keyframes<br>1920×1080 · 60fps<br>Master 60.0s · loop 15.0s<br>6 chapters · 16 keyframes</div>
</header>
{cells_html}
<section class="closing">
  <div class="box"><h3>Seam map — one continuous take</h3>
    <div class="bar"><i style="width:13.3%;background:#3A3640"></i><i style="width:18.3%;background:#6F6A78"></i><i style="width:16.7%;background:#4D4856"></i><i style="width:23.3%;background:#8E8A97"></i><i style="width:20%;background:#B9A4E8"></i><i style="width:8.3%;background:#3A3640"></i></div>
    <div class="seams">
      <div><b>I</b>0–8s · breath<br>→ the pen starts on the dot</div>
      <div><b>II</b>8–19s · pen<br>→ paper feeds left, pull back</div>
      <div><b>III</b>19–29s · punch<br>→ step becomes constant feed, push in</div>
      <div><b>IV</b>29–43s · music box<br>→ comb fades, pull back</div>
      <div><b>V</b>43–55s · powers<br>→ wave goes out</div>
      <div><b>VI</b>55–60s · back to the dot<br>→ = 0.0s</div>
    </div>
  </div>
  <div class="box"><h3>Tokens</h3>
    <div class="sw"><span style="--c:#0C0B0E">ground<br>#0C0B0E</span><span style="--c:#EDEBE6">dot<br>#EDEBE6</span><span style="--c:#B9A4E8">Parma violet ×2<br>#B9A4E8</span></div>
    <ul><li>Typeface: only Punctum Moderne (dot data + the real woff2)</li>
    <li>On-screen text: only “Punctum Moderne” and “A dot-matrix Didone”</li>
    <li>Banned: cuts, shake, glitch, neon, flares, confetti</li>
    <li>Sound: synthesized in code, sharing one event table with the picture</li></ul>
  </div>
</section>
</body></html>"""


def main():
    parts, grid_open = [], False
    for i, (act, fid, name, t, fn, note, seam) in enumerate(CELLS):
        if act:
            if grid_open:
                parts.append("</div>")
            parts.append(f'<div class="act">{act}</div><div class="grid">')
            grid_open = True
        svg = fn(i + 1).render()
        stamp = f"{t:.1f}s"
        parts.append(
            f'<figure id="{fid}"><div class="shot">{svg}</div><figcaption>'
            f'<div class="lab"><span>{fid[6:].upper()} · {name}</span><span>{stamp}</span></div>'
            f'<p>{note}</p><span class="chip">seam · {seam}</span></figcaption></figure>')
    parts.append("</div>")
    html = page("\n".join(parts))
    out = os.path.join(FILM, "storyboard.html")
    open(out, "w").write(html)
    head = html.split("<head>", 1)[1].split("</head>", 1)[0]
    body = html.split("<body>", 1)[1].split("</body>", 1)[0]
    head = head.replace('<meta charset="utf-8">', "").replace(
        '<meta name="viewport" content="width=device-width, initial-scale=1">', "")
    open(os.path.join(FILM, "storyboard.artifact.html"), "w").write(head + body)
    print(out, f"{len(html) / 1e6:.2f} MB", "target", TARGET[:3], "S_END", round(S_END, 4))


if __name__ == "__main__":
    main()
