"""Build PUNCTUM: a variable dot-matrix font.

Axes
  wght  100–900  dot size (Thin = pin-prick LEDs, Black = dots touch)
  ROND  0–100    dot shape (0 = square pixel, 100 = round dot)

Every dot is the same 16-point quadratic contour in every master, so the
two axes interpolate freely: the circle is projected radially onto a square
to make the pixel masters.
"""
import json
import math
import os
import sys

from fontTools.designspaceLib import (AxisDescriptor, DesignSpaceDocument,
                                      InstanceDescriptor, SourceDescriptor)
from fontTools.fontBuilder import FontBuilder
from fontTools.otlLib.builder import buildStatTable
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools import varLib
from fontTools.varLib import instancer

sys.path.insert(0, os.path.dirname(__file__))
from glyphs import COLS, ROWS, normalized  # noqa: E402

FAMILY = "Punctum"
VERSION = "1.000"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "fonts")

UPM = 1000
CELL = 100                 # dot pitch, same horizontally, vertically, and across glyphs/lines
ADVANCE = CELL * (COLS + 1)  # 600: 5 dots + 1 dot of spacing
ASC, DESC = 800, -200      # line = 10 cells, so the dot grid continues between lines
CAP, XH = 700, 500

# dot "radius" per master (half-size for squares)
RADIUS = {
    (100, 100): 12, (400, 100): 30, (900, 100): 50,   # round
    (100, 0): 11,   (400, 0): 27,   (900, 0): 50,     # square, area-matched until Black
}
WGHTS = (100, 400, 900)
RONDS = (0, 100)


def dot_center(col, row):
    # row 0..8 top→bottom; row 6 sits on the baseline
    x = CELL + col * CELL
    y = (6 - row) * CELL + CELL // 2
    return x, y


def dot_points(cx, cy, r, rond):
    """16 points, clockwise, alternating on/off; returns [(on), (off, on), ...]."""
    pts = []
    for i in range(16):
        theta = -math.radians(i * 22.5)          # clockwise in y-up space
        ux, uy = math.cos(theta), math.sin(theta)
        if rond:
            rad = r if i % 2 == 0 else r / math.cos(math.radians(22.5))
            px, py = ux * rad, uy * rad
        else:
            m = max(abs(ux), abs(uy))
            px, py = ux * r / m, uy * r / m
        pts.append((round(cx + px), round(cy + py)))
    return pts


def draw_glyph(rows, r, rond):
    pen = TTGlyphPen(None)
    for row in range(ROWS):
        for col in range(COLS):
            if rows[row][col] != "#":
                continue
            p = dot_points(*dot_center(col, row), r, rond)
            pen.moveTo(p[0])
            for k in range(1, 16, 2):
                pen.qCurveTo(p[k], p[(k + 1) % 16])
            pen.closePath()
    return pen.glyph()


def notdef_rows():
    return ["#####", "#...#", "#...#", "#...#", "#...#", "#...#", "#####", ".....", "....."]


def glyph_name(ch):
    cp = ord(ch)
    from fontTools.agl import UV2AGL
    if ch == " ":
        return "space"
    return UV2AGL.get(cp, f"uni{cp:04X}")


def build_master(data, wght, rond):
    r = RADIUS[(wght, rond)]
    names = [".notdef"] + [glyph_name(ch) for ch in data]
    cmap = {ord(ch): glyph_name(ch) for ch in data}
    glyf = {".notdef": draw_glyph(notdef_rows(), r, rond)}
    for ch, rows in data.items():
        glyf[glyph_name(ch)] = draw_glyph(rows, r, rond)

    fb = FontBuilder(UPM, isTTF=True)
    fb.setupGlyphOrder(names)
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(glyf)
    metrics = {}
    for n in names:
        g = glyf[n]
        g.recalcBounds(fb.font["glyf"])
        metrics[n] = (ADVANCE, getattr(g, "xMin", 0))
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=ASC, descent=DESC, lineGap=0)
    fb.setupNameTable({
        "familyName": FAMILY,
        "styleName": "Regular",
        "uniqueFontIdentifier": f"{FAMILY}-{VERSION}",
        "fullName": FAMILY,
        "psName": FAMILY,
        "version": f"Version {VERSION}",
        "designer": "Claude, for sundyme",
        "description": "A variable dot-matrix typeface on a 5×7 grid with true descenders.",
        "licenseDescription": "SIL Open Font License 1.1",
    })
    fb.setupOS2(
        sTypoAscender=ASC, sTypoDescender=DESC, sTypoLineGap=0,
        usWinAscent=ASC, usWinDescent=-DESC,
        sxHeight=XH, sCapHeight=CAP,
        version=4, usWeightClass=wght, fsType=0, achVendID="NONE",
        fsSelection=0x40 | 0x80,  # REGULAR | USE_TYPO_METRICS
        panose=dict(bFamilyType=2, bSerifStyle=0, bWeight=0, bProportion=9,  # monospaced
                    bContrast=0, bStrokeVariation=0, bArmStyle=0, bLetterForm=0,
                    bMidline=0, bXHeight=0),
        ulUnicodeRange1=0b11,
    )
    fb.setupPost(isFixedPitch=1, underlinePosition=-150, underlineThickness=50)
    from fontTools.misc.timeTools import timestampNow
    fb.setupHead(unitsPerEm=UPM, fontRevision=float(VERSION),
                 created=timestampNow(), modified=timestampNow())
    fb.font["head"].flags |= 1 << 3
    return fb.font


def main():
    data = normalized()
    os.makedirs(OUT, exist_ok=True)

    ds = DesignSpaceDocument()
    for tag, name, lo, df, hi in (("wght", "Weight", 100, 400, 900),
                                  ("ROND", "Roundness", 0, 100, 100)):
        a = AxisDescriptor()
        a.tag, a.name, a.minimum, a.default, a.maximum = tag, name, lo, df, hi
        a.labelNames = {"en": name}
        ds.addAxis(a)

    for w in WGHTS:
        for rd in RONDS:
            s = SourceDescriptor()
            s.font = build_master(data, w, rd)
            s.name = f"master-{w}-{rd}"
            s.location = {"Weight": w, "Roundness": rd}
            ds.addSource(s)

    weight_names = {100: "Thin", 200: "ExtraLight", 300: "Light", 400: "Regular",
                    500: "Medium", 600: "SemiBold", 700: "Bold", 800: "ExtraBold", 900: "Black"}
    for rd, prefix in ((100, ""), (0, "Pixel ")):
        for w, wn in weight_names.items():
            inst = InstanceDescriptor()
            inst.familyName = FAMILY
            style = (prefix + wn).strip() if not (prefix and wn == "Regular") else "Pixel"
            inst.styleName = style
            inst.location = {"Weight": w, "Roundness": rd}
            inst.postScriptFontName = f"{FAMILY}-{style.replace(' ', '')}"
            ds.addInstance(inst)

    vf, _, _ = varLib.build(ds, exclude=["MVAR"])
    buildStatTable(vf, [
        {"tag": "wght", "name": "Weight", "values": [
            {"value": w, "name": n, **({"flags": 2, "linkedValue": 700} if w == 400 else {})}
            for w, n in weight_names.items()]},
        {"tag": "ROND", "name": "Roundness", "values": [
            {"value": 0, "name": "Pixel"},
            {"value": 100, "name": "Round", "flags": 2}]},
    ])
    vf_path = os.path.join(OUT, f"{FAMILY}[ROND,wght].ttf")
    vf.save(vf_path)
    vf.flavor = "woff2"
    vf.save(os.path.join(OUT, f"{FAMILY}-VF.woff2"))
    print("VF  ", vf_path)

    # Static cuts for apps without variable-font support
    static_dir = os.path.join(OUT, "static")
    os.makedirs(static_dir, exist_ok=True)
    for rd, label in ((100, ""), (0, "Pixel")):
        for w in (100, 300, 400, 700, 900):
            from fontTools.ttLib import TTFont
            f = TTFont(vf_path)
            inst = instancer.instantiateVariableFont(
                f, {"wght": w, "ROND": rd}, updateFontNames=False)
            style = f"{label}{weight_names[w]}" if label else weight_names[w]
            fam = f"{FAMILY} {label}".strip()
            sub = weight_names[w]
            nm = inst["name"]
            for rec in list(nm.names):
                if rec.nameID in (1, 2, 3, 4, 6, 16, 17):
                    nm.removeNames(nameID=rec.nameID)
            nm.setName(f"{fam} {sub}" if sub not in ("Regular", "Bold") else fam, 1, 3, 1, 0x409)
            nm.setName("Bold" if sub == "Bold" else "Regular", 2, 3, 1, 0x409)
            nm.setName(f"{FAMILY}-{style};{VERSION}", 3, 3, 1, 0x409)
            nm.setName(f"{fam} {sub}", 4, 3, 1, 0x409)
            nm.setName(f"{FAMILY}-{style}", 6, 3, 1, 0x409)
            nm.setName(fam, 16, 3, 1, 0x409)
            nm.setName(sub, 17, 3, 1, 0x409)
            inst["OS/2"].usWeightClass = w
            if sub == "Bold":
                inst["OS/2"].fsSelection = (inst["OS/2"].fsSelection & ~0x40) | 0x20
                inst["head"].macStyle |= 1
            inst.save(os.path.join(static_dir, f"{FAMILY}-{style}.ttf"))
    print("static", sorted(os.listdir(static_dir)))

    # Bitmap map for the specimen's LED board
    with open(os.path.join(ROOT, "src", "bitmaps.json"), "w") as fh:
        json.dump({ch: rows for ch, rows in data.items()}, fh, ensure_ascii=False)


if __name__ == "__main__":
    main()
