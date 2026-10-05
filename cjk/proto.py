"""Punctum Song (点宋) — prototype: turn a Song typeface into Punctum dots.

Each stroke becomes ONE line of dots on the lattice (never a filled halftone): a dot sits wherever the
stroke's centre line (the ridge of its distance field) crosses a lattice cell, and its size comes from the
stroke's local width — the same rule Punctum's Latin follows by hand:
    hairline (Song horizontals)  → tone 0
    transition (tapers)          → tone 0.5
    thick (Song verticals)       → tone 1
    ball (a small heavy blob: a 点 drop)          → tone 1.3
    ornament (a blob at the end of a hairline: the beak) → ORN, a ball at CNTR 100 that vanishes at CNTR 0
python3 cjk/proto.py → cjk/out/*.png, cjk/out/data_<N>.json
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
for _src in (os.path.join(HERE, "..", "src"), os.path.join(HERE, "..", "v2", "src")):   # repository / working folder
    if os.path.exists(os.path.join(_src, "radii.py")):
        sys.path.insert(0, _src)
        break
from radii import radius  # noqa: E402  (tone, wght, CNTR, opsz-f) → radius in 1/100 pitch

OUT = os.path.join(HERE, "out")
os.makedirs(OUT, exist_ok=True)
S = 768                      # raster px per em
SONG = ("/System/Library/Fonts/Supplemental/Songti.ttc", 6)   # Songti SC Regular (prototype source only)
FONT = ImageFont.truetype(SONG[0], S, index=SONG[1])
ASC = 0.88                   # ideographic box: top 0.88 em above the baseline


def bitmap(ch):
    img = Image.new("L", (S, S), 0)
    ImageDraw.Draw(img).text((0, ASC * S), ch, font=FONT, fill=255, anchor="ls")
    return np.asarray(img) > 127


def dist(B):
    """Octagonal distance to the background (alternating 4/8-neighbour erosion), in px."""
    D = np.zeros(B.shape, np.int32)
    cur = B.copy()
    k = 0
    while cur.any():
        k += 1
        D[cur] = k
        n = cur.copy()
        n[1:] &= cur[:-1]; n[:-1] &= cur[1:]; n[:, 1:] &= cur[:, :-1]; n[:, :-1] &= cur[:, 1:]
        if k % 2 == 0:
            n[1:, 1:] &= cur[:-1, :-1]; n[:-1, :-1] &= cur[1:, 1:]; n[1:, :-1] &= cur[:-1, 1:]; n[:-1, 1:] &= cur[1:, :-1]
        cur = n
    return D


def ridge(D):
    """Centre line: a pixel that peaks across the stroke in at least one of four directions (≥ both
    neighbours, > at least one), so the flat run along a stroke does not count."""
    P = np.pad(D, 1)
    c = P[1:-1, 1:-1]

    def peak(a, b):
        return (c >= a) & (c >= b) & ((c > a) | (c > b))
    m = peak(P[1:-1, :-2], P[1:-1, 2:]) | peak(P[:-2, 1:-1], P[2:, 1:-1]) | peak(P[:-2, :-2], P[2:, 2:]) | peak(P[:-2, 2:], P[2:, :-2])
    return (D >= 2) & m


# stroke-width thresholds (full width, em) — calibrated on Songti SC Regular (see calib()); the proposal page
# uses 0.038 / 0.058 for Noto Serif SC (Source Han Serif), whose strokes are heavier
HAIR, THICK = 0.032, 0.05


def dots(ch, N):
    """→ list of (col, row, tone) on an N/em lattice; row 0 = bottom of the em box."""
    B = bitmap(ch)
    D = dist(B)
    R = ridge(D)
    c = S / N
    on = {}
    for j in range(N):
        for i in range(N):
            y0, y1, x0, x1 = int(j * c), int((j + 1) * c), int(i * c), int((i + 1) * c)
            r = R[y0:y1, x0:x1]
            cnt = r.sum()
            if cnt < 0.35 * c:
                continue
            w = 2 * D[y0:y1, x0:x1][r].max() / S
            on[(i, N - 1 - j)] = w
    # tones by stroke width; then every small heavy blob (≤ 2 × 2 cells: a Song dot or a beak) collapses to one
    # ball. A blob at the right end of a horizontal run is a beak → ornament dot; any other blob is a 点 → ball.
    tone = {k: (1.0 if w >= THICK else 0.5 if w >= HAIR else 0.0) for k, w in on.items()}
    light = lambda i, j: (i, j) in on and on[(i, j)] < THICK  # noqa: E731
    seen = set()
    for k, w in on.items():
        if k in seen or w < THICK:
            continue
        comp, st = [], [k]
        seen.add(k)
        while st:
            q = st.pop()
            comp.append(q)
            for a in (-1, 0, 1):
                for b in (-1, 0, 1):
                    n = (q[0] + a, q[1] + b)
                    if n not in seen and on.get(n, 0) >= THICK:
                        seen.add(n)
                        st.append(n)
        xs, ys = [q[0] for q in comp], [q[1] for q in comp]
        if max(xs) - min(xs) > 1 or max(ys) - min(ys) > 1:
            continue                                   # a real stroke, not a blob
        best = max(comp, key=lambda q: on[q])
        i0 = min(xs)
        beak = any(light(i0 - 1, r) and light(i0 - 2, r) and light(i0 - 3, r) for r in range(min(ys) - 1, max(ys) + 1))
        for q in comp:
            if q != best:
                del tone[q]
        tone[best] = ORN if beak else 1.3
    return [(i, j, t) for (i, j), t in tone.items()]


ORN = 1.31   # ornament class (beak / shoulder): a ball at CNTR 100, nothing at CNTR 0


def rad(t, w, c, f=0.0):
    if t == ORN:
        return radius(1.3, w, c, f) * (c / 100) ** 1.5
    return radius(t, w, c, f)


def calib(chars):
    ws = []
    for ch in chars:
        D = dist(bitmap(ch))
        ws += list(2 * D[ridge(D)] / S)
    ws = np.array(ws)
    print("ridge width percentiles (em):", {p: round(float(np.percentile(ws, p)), 4) for p in (10, 25, 50, 75, 90, 97)})


def plate(ch, N, px=300, w=480, c=100, f=0.0, ink=(20, 18, 24), bg=(244, 242, 236), ball=(90, 61, 142), lattice=True):
    k = 3
    P = px * k / N
    img = Image.new("RGB", (px * k, px * k), bg)
    d = ImageDraw.Draw(img)
    if lattice:
        for j in range(N):
            for i in range(N):
                x, y = (i + 0.5) * P, (N - 1 - j + 0.5) * P
                rr = max(1.2, P * 0.05)
                d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=(214, 210, 222))
    for i, j, t in dots(ch, N):
        x, y = (i + 0.5) * P, (N - 1 - j + 0.5) * P
        rr = rad(t, w, c, f) / 100 * P
        d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=(ball if t == ORN else (200, 80, 60)) if (t > 1.1 and c > 50) else ink)
    return img.resize((px, px), Image.LANCZOS)


def ref(ch, px=300, bg=(244, 242, 236)):
    img = Image.new("L", (S, S), 0)
    ImageDraw.Draw(img).text((0, ASC * S), ch, font=FONT, fill=255, anchor="ls")
    a = np.asarray(img.resize((px, px), Image.LANCZOS)).astype(float) / 255
    rgb = np.array(bg, float)[None, None] * (1 - a[..., None]) + np.array((20, 18, 24), float)[None, None] * a[..., None]
    return Image.fromarray(rgb.astype(np.uint8))


if __name__ == "__main__":
    SAMPLE = "永点宋王川心之国书鬱"
    if "calib" in sys.argv:
        calib(SAMPLE)
        sys.exit()
    grids = [16, 24, 32]
    cols = ["Song"] + [f"{n}/em" for n in grids] + ["24 · CNTR 0"]
    px = 240
    sheet = Image.new("RGB", (px * len(cols), px * len(SAMPLE)), (244, 242, 236))
    for r, ch in enumerate(SAMPLE):
        tiles = [ref(ch, px)] + [plate(ch, n, px) for n in grids] + [plate(ch, 24, px, c=0)]
        for k, im in enumerate(tiles):
            sheet.paste(im, (k * px, r * px))
    sheet.save(os.path.join(OUT, "grids.png"))
    print("cjk/out/grids.png", sheet.size)
