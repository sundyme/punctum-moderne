"""Measure the file size of a Punctum Song variable font, two ways, on the 300 most common characters.

  composite  every dot is a component reference to one of five dot glyphs (thin, transition, thick, ball,
             ornament); only those five glyphs carry variations, so the CJK glyphs need no gvar at all
  outline    every dot is its own circle contour, varied point by point (how the Latin is built today)

UPM 2400, pitch 100 (24/em); masters wght 100/400/900 × CNTR 0/100 × opsz 144/12.
Local measurement only (dots drafted from Songti SC); writes cjk/out/size_*.ttf/.woff2 and prints sizes.
python3 cjk/sizetest.py
"""
import math
import os
import sys

from fontTools.designspaceLib import AxisDescriptor, DesignSpaceDocument, SourceDescriptor
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont
from fontTools import varLib

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import proto  # noqa: E402
from radii import text_fraction  # noqa: E402

OUT = proto.OUT
N, P, UPM, BOT = 24, 100, 2400, -300
TONES = [0.0, 0.5, 1.0, 1.3, proto.ORN]
DOTN = ["dot.hair", "dot.trans", "dot.thick", "dot.ball", "dot.orn"]
CHARS = ("的一是不了人我在有他这中大来上个国到说们为子和你地出会也时要就可以对生能而那得于着下自之年过发后作里用道行所然家种事成方多经"
         "么去法学如都同现当没动面起看定天分还进好小部其些主样理心她本前开但因只从想实日军者意无力它与长把机十民第公此已工使情明性知全三"
         "又关点正业外将两高间由问很最重并物手应战向头文体政美相见被利什二等产或新己制身果加西斯月话合回特代内信表化老给世位次度门任常先"
         "海通教儿原东声提立及比员解水名真论处走义各入几口认条平系气题活尔更别打女变四神总何电数安少报才结反受目太量再感建务做接必场件计"
         "管期市直德资命山金指克许统区保至队形社便空决治展马科司五基眼书非则听白却界达光放强即像难且权思王象完设式色路记南品住告类求据程")
CHARS = CHARS[:300]


def circle(pen, cx, cy, r, n=8):
    # n off-curve points on a circle of radius r/cos(pi/n): the implied on-curves land on the circle
    r = max(r, 2.0)   # keep a degenerate (vanished) dot a tiny circle so every master stays point-compatible
    R = r / math.cos(math.pi / n)
    pts = [(round(cx + R * math.cos(2 * math.pi * (k + .5) / n)), round(cy + R * math.sin(2 * math.pi * (k + .5) / n))) for k in range(n)]
    pen.qCurveTo(*pts, None)
    pen.closePath()


def master(w, c, f, data, mode):
    names = [".notdef"] + DOTN + [f"uni{ord(ch):04X}" for ch in CHARS]
    fb = FontBuilder(UPM, isTTF=True)
    fb.setupGlyphOrder(names)
    fb.setupCharacterMap({ord(ch): f"uni{ord(ch):04X}" for ch in CHARS})
    glyphs, metrics = {}, {}
    pen = TTGlyphPen(None)
    glyphs[".notdef"] = pen.glyph()
    metrics[".notdef"] = (UPM, 0)
    for t, nm in zip(TONES, DOTN):
        pen = TTGlyphPen(None)
        circle(pen, 0, 0, proto.rad(t, w, c, f) / 100 * P)
        glyphs[nm] = pen.glyph()
        metrics[nm] = (0, 0)
    for ch in CHARS:
        nm = f"uni{ord(ch):04X}"
        pen = TTGlyphPen(glyphs)
        for i, j, t in data[ch]:
            x, y = i * P + P // 2, BOT + j * P + P // 2
            if mode == "composite":
                pen.addComponent(DOTN[TONES.index(t)], (1, 0, 0, 1, x, y))
            else:
                circle(pen, x, y, proto.rad(t, w, c, f) / 100 * P)
        glyphs[nm] = pen.glyph()
        metrics[nm] = (UPM, 0)
    fb.setupGlyf(glyphs)
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=2100, descent=-300)
    fb.setupNameTable({"familyName": "Punctum Song Test", "styleName": "Regular"})
    fb.setupOS2(sTypoAscender=2100, sTypoDescender=-300, usWinAscent=2100, usWinDescent=300)
    fb.setupPost()
    return fb.font


def build(mode, data):
    ds = DesignSpaceDocument()
    for tag, lo, df, hi in (("wght", 100, 400, 900), ("CNTR", 0, 100, 100), ("opsz", 12, 144, 144)):
        a = AxisDescriptor()
        a.tag, a.name, a.minimum, a.default, a.maximum = tag, tag, lo, df, hi
        ds.addAxis(a)
    for w in (100, 400, 900):
        for c in (0, 100):
            for op in (12, 144):
                s = SourceDescriptor()
                s.font = master(w, c, text_fraction(op), data, mode)
                s.location = {"wght": w, "CNTR": c, "opsz": op}
                s.name = f"{mode}-{w}-{c}-{op}"
                ds.addSource(s)
    vf, _, _ = varLib.build(ds)
    p = os.path.join(OUT, f"size_{mode}.ttf")
    vf.save(p)
    f = TTFont(p)
    f.flavor = "woff2"
    f.save(p.replace(".ttf", ".woff2"))
    t, w2 = os.path.getsize(p), os.path.getsize(p.replace(".ttf", ".woff2"))
    return t, w2, {k: len(f.reader[k]) if k in f.reader.tables else 0 for k in ("glyf", "gvar")}


if __name__ == "__main__":
    data = {ch: proto.dots(ch, N) for ch in CHARS}
    nd = sum(len(v) for v in data.values())
    print(f"{len(CHARS)} chars, {nd} dots ({nd / len(CHARS):.0f}/char)")
    for mode in ("composite", "outline"):
        t, w2, _ = build(mode, data)
        print(f"{mode:9s}  ttf {t / 1e6:6.2f} MB  woff2 {w2 / 1e6:5.2f} MB   per char: ttf {t / len(CHARS) / 1e3:5.2f} KB  woff2 {w2 / len(CHARS) / 1e3:5.2f} KB"
              f"   → 3500 chars ≈ ttf {t / len(CHARS) * 3500 / 1e6:6.1f} MB, woff2 {w2 / len(CHARS) * 3500 / 1e6:5.1f} MB")
