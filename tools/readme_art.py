"""Draw the README plates straight from the glyph data.

Every plate is a pure SVG of circles: the same dots, tones, radius model and
lattice kerning the font is built from, so the pictures cannot drift from the
fonts. Each plate is written twice, for GitHub's light and dark themes.

    python3 tools/readme_art.py  ->  assets/readme/<plate>-{light,dark}.svg
"""
import math
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "src"))

from glyphs import parse, shear  # noqa: E402
from kern import kerning  # noqa: E402
from radii import radius, text_fraction  # noqa: E402

OUT = os.path.join(ROOT, "assets", "readme")
R, I = parse(False), parse(True)
KR, KI = kerning(R, False), kerning(I, True)

THEMES = {
    "light": dict(bg="#F3F2EE", ink="#111111", ink2="#77756F", rule="#D6D4CD", lat="#DCD9D1", violet="#5A3D8E"),
    "dark": dict(bg="#101012", ink="#EDEDE9", ink2="#8E8C87", rule="#2C2B2F", lat="#29272F", violet="#B9A4E8"),
}
MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
W = 1600  # every plate is 1600 wide; GitHub scales it to the column


def layout(text, italic=False, swash=False, kern=True):
    """Dots of a line in pitch units: (x, y, tone, glyph name). Kerning is in whole pitches."""
    G, K = (I, KI) if italic else (R, KR)
    x, prev, dots = 0, None, []
    for ch in text:
        name = ch + ".swsh" if swash and ch + ".swsh" in G else ch
        g = G.get(name)
        if g is None:
            continue
        if kern and prev:
            x += K.get((prev, name), 0)
        for dx, dy, t in g["dots"]:
            dots.append((x + dx, dy, t, name))
        x += g["width"] + 1
        prev = None if ch == " " else name
    return dots, x - 1


class Plate:
    def __init__(self, h):
        self.h, self.items = h, []

    def dots(self, dots, ox, base, P, w=700, c=100, f=0.0, col="ink", pick=None):
        for x, y, t, name in dots:
            r = radius(t, w, c, f) / 100 * P
            k = pick(x, y, t, name) if pick else col
            self.items.append(("c", ox + (x + .5) * P, base - (y + .5) * P, r, k))

    def lattice(self, x0, x1, base, P, rows, italic=False, ox=None):
        """Faint grid dots, sheared like the italic when asked; aligned to the text origin ox."""
        ox = x0 if ox is None else ox
        for y in rows:
            sx = shear(y) if italic else 0.0
            k0 = math.ceil((x0 - ox) / P - sx)
            k1 = math.floor((x1 - ox) / P - sx)
            for k in range(k0, k1 + 1):
                self.items.append(("c", ox + (k + sx + .5) * P, base - (y + .5) * P, max(1.1, P * .055), "lat"))

    def rule(self, x0, x1, y, col="rule", dash=False):
        self.items.append(("l", x0, y, x1, y, col, dash))

    def text(self, x, y, s, col="ink2", size=17, anchor="start", spacing=2.2):
        self.items.append(("t", x, y, s, col, size, anchor, spacing))

    def svg(self, theme, title):
        T = THEMES[theme]
        out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {self.h}" width="{W}" height="{self.h}" role="img">',
               f"<title>{title}</title>", f'<rect width="{W}" height="{self.h}" fill="{T["bg"]}"/>']
        for it in self.items:
            if it[0] == "l":
                _, x0, y, x1, _, col, dash = it
                d = ' stroke-dasharray="3 5"' if dash else ""
                out.append(f'<line x1="{x0:.1f}" y1="{y:.1f}" x2="{x1:.1f}" y2="{y:.1f}" stroke="{T[col]}" stroke-width="1"{d}/>')
        groups = {}
        for it in self.items:
            if it[0] == "c" and it[3] > .05:
                groups.setdefault(it[4], []).append(f'<circle cx="{it[1]:.1f}" cy="{it[2]:.1f}" r="{it[3]:.2f}"/>')
        for col in ("lat", "ink2", "ink", "violet"):
            if col in groups:
                out.append(f'<g fill="{T[col]}">' + "".join(groups[col]) + "</g>")
        for it in self.items:
            if it[0] == "t":
                _, x, y, s, col, size, anchor, sp = it
                out.append(f'<text x="{x:.1f}" y="{y:.1f}" fill="{T[col]}" font-family="{MONO}" font-size="{size}" '
                           f'letter-spacing="{sp}" text-anchor="{anchor}">{s}</text>')
        out.append("</svg>")
        return "".join(out)


def save(name, plate, title):
    os.makedirs(OUT, exist_ok=True)
    for theme in THEMES:
        with open(os.path.join(OUT, f"{name}-{theme}.svg"), "w", encoding="utf-8") as fh:
            fh.write(plate.svg(theme, title))


M = 88  # outer margin


def hero():
    l1, w1 = layout("Punctum")
    l2, w2 = layout("Moderne")
    P = (W - 2 * M) / max(w1, w2)
    h = round(P * 33 + 2 * M + 40)
    p = Plate(h)
    b1, b2 = M + 40 + P * 12.5, M + 40 + P * 28.5
    for b in (b1, b2):
        p.lattice(M, W - M, b, P, range(-3, 13), ox=M)
    p.dots(l1, M, b1, P)
    # the one violet dot: the ball of the r, where the first film ends its zoom
    p.dots(l2, M, b2, P, pick=lambda x, y, t, n: "violet" if n == "r" and t == 1.3 else "ink")
    p.text(M, 64, "PUNCTUM MODERNE 2.400")
    p.text(W - M, 64, "A DOT-MATRIX DIDONE · ROMAN &amp; ITALIC", anchor="end")
    p.text(M, h - 40, "WGHT 700 · CNTR 100 · OPSZ 144")
    p.text(W - M, h - 40, "SIL OFL 1.1", anchor="end")
    save("hero", p, "Punctum Moderne")


def tones():
    a, aw = layout("a")
    P = 58
    h = M * 2 + P * 13
    p = Plate(h)
    base = M + P * 10.5
    ox = M + P * 1
    p.lattice(M, M + P * (aw + 3), base, P, range(-2, 10), ox=ox)
    p.rule(M, M + P * (aw + 3), base, "rule")
    p.dots(a, ox, base, P, w=700, c=100)
    # legend: the four tones, one dot each, at the same pitch
    x0 = M + P * (aw + 6)
    rows = [(1.0, "#", "THICK", "stems and verticals"), (0.5, "+", "TRANSITION", "where a curve turns"),
            (0.0, "-", "HAIRLINE", "thins, serifs, flicks"), (1.3, "O", "BALL", "the terminal drop")]
    gap = (h - 2 * M) / 4
    for i, (t, sym, name, note) in enumerate(rows):
        cy = M + gap * (i + .5)
        r = radius(t, 700, 100) / 100 * P
        p.items.append(("c", x0 + P * .6, cy, r, "violet" if t == 1.3 else "ink"))
        p.text(x0 + P * 2, cy - 8, f"0{i + 1}  {name}", col="ink", size=22)
        p.text(x0 + P * 2, cy + 24, f"tone {t:g}   {sym}   {note}", size=17)
        if i:
            p.rule(x0, W - M, M + gap * i)
    save("tones", p, "Four tones per dot")


def axes():
    word = "Parma"
    d, ww = layout(word)
    cols, rows = (0, 50, 100), (100, 400, 900)
    cw = (W - 2 * M - 120) / 3
    P = (cw - 40) / ww
    rh = P * 15
    h = round(M + 50 + rh * 3 + M)
    p = Plate(h)
    for j, c in enumerate(cols):
        x = M + 120 + cw * j
        p.text(x, M + 10, f"CNTR {c}", col="ink", size=18)
    for i, w in enumerate(rows):
        base = M + 50 + rh * i + P * 11.5
        p.text(M, base - P * 3, f"wght {w}", col="ink", size=18)
        p.rule(M, W - M, M + 50 + rh * i + P * .5)
        for j, c in enumerate(cols):
            p.dots(d, M + 120 + cw * j, base, P, w=w, c=c, pick=lambda *_: "violet" if (w, c) == (400, 100) else "ink")
    save("axes", p, "Weight × contrast")


def opsz():
    word = "Hamburgefonstiv"
    d, ww = layout(word)
    P = (W - 2 * M - 220) / ww
    h = round(M * 2 + P * 30)
    p = Plate(h)
    for i, (o, lab) in enumerate(((144, "opsz 144  display"), (12, "opsz 12  text"))):
        base = M + P * (11 + i * 15)
        p.lattice(M + 220, W - M, base, P, range(-3, 11), ox=M + 220)
        p.dots(d, M + 220, base, P, w=500, c=100, f=text_fraction(o))
        p.text(M, base - P * 3.2, lab.split("  ")[0], col="ink", size=18)
        p.text(M, base - P * 3.2 + 26, lab.split("  ")[1], size=16)
    save("opsz", p, "Optical size")


def grid():
    lines = ("Hamburg", "fjords")
    L = [layout(s) for s in lines]
    G = 230  # left gutter for the metric labels
    P = min((W - 2 * M - G) / max(w for _, w in L), 26)
    h = round(M * 2 + P * 31)
    p = Plate(h)
    x0 = M + G
    for i, (d, _) in enumerate(L):
        base = M + P * (11.5 + 16 * i)
        p.lattice(x0 - P * 2, W - M, base, P, range(-3, 12), ox=x0)
        if i == 0:
            for y, lab, solid in ((10, "cap 1000", False), (7, "x-height 700", False), (0, "baseline 0", True), (-3, "descender −300", False)):
                yy = base - y * P
                p.rule(M, W - M, yy, "ink2" if solid else "rule", dash=not solid)
                p.text(M, yy - 8, lab, size=16)
        p.dots(d, x0, base, P, w=700, c=100)
    p.text(M, h - 34, "1 pitch = 1/16 em · every advance a whole number of dots")
    save("grid", p, "One grid")


def kern():
    s = "LAVA · Toyota · P.T. Wafer"
    a, wa = layout(s, kern=False)
    b, wb = layout(s)
    P = (W - 2 * M - 200) / wa
    h = round(M * 2 + P * 30)
    p = Plate(h)
    for i, (d, lab, col) in enumerate(((a, "UNKERNED", "ink2"), (b, "KERNED", "ink"))):
        base = M + P * (11 + 15 * i)
        p.text(M, base - P * 3, lab, col=col, size=17)
        p.dots(d, M + 200, base, P, w=500, c=100, col=col)
    p.text(W - M, h - 34, "every pair moves by whole dots · the lattice never breaks", anchor="end", size=16)
    save("kern", p, "Kerning in whole pitches")


def italic():
    l1, w1 = layout("Rendezvous at Midnight", italic=True, swash=True)
    l2, w2 = layout("The Quiet Printhead, Vol. II", italic=True, swash=True)
    P = (W - 2 * M) / max(w1, w2) * .96
    h = round(M * 2 + P * 32)
    p = Plate(h)
    for i, (d, col) in enumerate(((l1, "ink"), (l2, "ink"))):
        base = M + P * (13 + 16 * i)
        p.lattice(M, W - M, base, P, range(-3, 13), italic=True, ox=M + P * 2)
        p.dots(d, M + P * 2, base, P, w=600 if i == 0 else 300, c=100,
               pick=lambda x, y, t, n: "violet" if n.endswith(".swsh") and t == 1.3 else "ink")
    p.text(M, h - 34, "ITALIC · 12° SHEARED LATTICE · SWASH CAPITALS (swsh / ss01)")
    save("italic", p, "Italic and swash capitals")


def charset():
    rows = ["ABCDEFGHIJKLM", "NOPQRSTUVWXYZ", "abcdefghijklm", "nopqrstuvwxyz",
            "0123456789 &?!", "ÀÄÅÆÇÉÑÖØŒŠÜŽ", "àäåæçéñöøœšßüž"]
    L = [layout(s) for s in rows]
    LH = 15
    P = (W - 2 * M) / max(w for _, w in L)
    h = round(M * 2 + P * LH * len(rows))
    p = Plate(h)
    for i, (d, _) in enumerate(L):
        base = M + P * (12 + LH * i)
        if i:
            p.rule(M, W - M, base - P * 12.6)
        p.dots(d, M, base, P, w=600, c=100, pick=lambda x, y, t, n: "violet" if t == 1.3 else "ink")
    save("charset", p, "Character set")


if __name__ == "__main__":
    for fn in (hero, tones, axes, opsz, grid, kern, italic, charset):
        fn()
    print("plates →", OUT, sorted(os.listdir(OUT)))
