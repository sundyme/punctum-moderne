"""Build PUNCTUM MODERNE, a variable dot-matrix Didone.

Axes
  wght  100–900  size of the thick dots (Black: stems fuse into scalloped bars)
  CNTR  0–100    stroke contrast (0 = every dot equal, a slab dot matrix;
                 100 = hairlines shrink to pin-pricks, a Didone)

An Italic ships as a second VF with the same axes (STAT links the two on ital):
a sheared dot lattice with redrawn cursive lowercase, see glyphs.ITALIC_SRC.
Kerning is fitted on the lattice in whole pitches, see kern.py.

Every glyph has the same dots in every master; only radii change, so the
axes interpolate freely. Radii come from radii.py, shared with the proofs.
"""
import math
import os
import sys

from fontTools import varLib
from fontTools.feaLib.builder import addOpenTypeFeaturesFromString
from fontTools.designspaceLib import (AxisDescriptor, DesignSpaceDocument,
                                      InstanceDescriptor, SourceDescriptor)
from fontTools.fontBuilder import FontBuilder
from fontTools.misc.timeTools import timestampNow
from fontTools.otlLib.builder import buildStatTable
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

sys.path.insert(0, os.path.dirname(__file__))
from glyphs import ITALIC_ANGLE, parse  # noqa: E402
from kern import kerning  # noqa: E402
from radii import OPSZ_CURVE, radius  # noqa: E402

FAMILY = "Punctum Moderne"
PS = "PunctumModerne"
VERSION = "2.500"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "fonts")

UPM, CELL = 1600, 100
ASC, DESC = 1200, -400          # 16 rows per line: the grid continues across lines
CAP, XH = 1000, 700
WGHTS, CNTRS = (100, 400, 900), (0, 100)
K = 1 / math.cos(math.radians(22.5))


def circle(cx, cy, r):
    pts = []
    for i in range(16):
        a = -math.radians(i * 22.5)               # clockwise
        rr = r if i % 2 == 0 else r * K
        pts.append((round(cx + rr * math.cos(a)), round(cy + rr * math.sin(a))))
    return pts


def draw(dots, w, c, f):
    pen = TTGlyphPen(None)
    for x, y, tone in dots:
        p = circle(x * CELL + CELL / 2, y * CELL + CELL / 2, radius(tone, w, c, f))
        pen.moveTo(p[0])
        for k in range(1, 16, 2):
            pen.qCurveTo(p[k], p[(k + 1) % 16])
        pen.closePath()
    g = pen.glyph()
    if g.numberOfContours > 0:
        g.flags[0] |= 0x40                         # OVERLAP_SIMPLE: Black dots fuse
    return g


def gname(ch):
    from fontTools.agl import UV2AGL
    if len(ch) > 1:
        base, suffix = ch.split(".", 1)
        return f"{gname(base)}.{suffix}"
    return "space" if ch == " " else UV2AGL.get(ord(ch), f"uni{ord(ch):04X}")


NOTDEF = {"width": 6, "dots": [(x, y, 0.5) for x in range(6) for y in range(10)
                               if x in (0, 5) or y in (0, 9)]}


def master(data, w, c, f, italic=False):
    order = [".notdef"] + [gname(ch) for ch in data]
    glyf = {".notdef": draw(NOTDEF["dots"], w, c, f)}
    adv = {".notdef": (NOTDEF["width"] + 1) * CELL}
    for ch, g in data.items():
        glyf[gname(ch)] = draw(g["dots"], w, c, f)
        adv[gname(ch)] = (g["width"] + 1) * CELL
    fb = FontBuilder(UPM, isTTF=True)
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap({ord(ch): gname(ch) for ch in data if len(ch) == 1})
    fb.setupGlyf(glyf)
    fb.setupHorizontalMetrics({n: (adv[n], getattr(glyf[n], "xMin", 0)) for n in order})
    slope = math.tan(math.radians(ITALIC_ANGLE)) if italic else 0
    fb.setupHorizontalHeader(ascent=ASC, descent=DESC, lineGap=0,
                             caretSlopeRise=1000 if italic else 1, caretSlopeRun=round(1000 * slope))
    style = "Italic" if italic else "Regular"
    fb.setupNameTable({
        "familyName": FAMILY, "styleName": style,
        "uniqueFontIdentifier": f"{PS}-{style}-{VERSION}", "fullName": f"{FAMILY} {style}",
        "psName": f"{PS}-Italic" if italic else PS,
        "version": f"Version {VERSION}", "designer": "Claude, for sundyme",
        "description": "A dot-matrix Didone: thick verticals as large dots, hairlines as pin-pricks.",
        "copyright": "Copyright 2026 The Punctum Moderne Project Authors (https://github.com/sundyme/punctum-moderne)",
        "licenseDescription": "This Font Software is licensed under the SIL Open Font License, Version 1.1. This license is available with a FAQ at: https://openfontlicense.org",
        "licenseInfoURL": "https://openfontlicense.org",
        "vendorURL": "https://github.com/sundyme/punctum-moderne",
    })
    fb.setupOS2(
        version=4, sTypoAscender=ASC, sTypoDescender=DESC, sTypoLineGap=0,
        usWinAscent=1350, usWinDescent=450, sxHeight=XH, sCapHeight=CAP,
        usWeightClass=w, fsType=0, achVendID="NONE", fsSelection=(0x01 if italic else 0x40) | 0x80,
        panose=dict(bFamilyType=2, bSerifStyle=0, bWeight=0, bProportion=0, bContrast=0,
                    bStrokeVariation=0, bArmStyle=0, bLetterForm=0, bMidline=0, bXHeight=0),
        ulUnicodeRange1=0b11,
    )
    fb.setupPost(underlinePosition=-250, underlineThickness=60,
                 italicAngle=-ITALIC_ANGLE if italic else 0)
    fb.setupHead(unitsPerEm=UPM, fontRevision=float(VERSION),
                 created=timestampNow(), modified=timestampNow())
    fb.font["head"].flags |= 1 << 3
    if italic:
        fb.font["head"].macStyle |= 2
    return fb.font


def kern_fea(data, italic):
    lines = [f"    pos {gname(a)} {gname(b)} {v * CELL};" for (a, b), v in sorted(kerning(data, italic).items())]
    fea = "languagesystem DFLT dflt;\nlanguagesystem latn dflt;\nfeature kern {\n" + "\n".join(lines) + "\n} kern;\n"
    subs = "\n".join(f"    sub {gname(ch[0])} by {gname(ch)};" for ch in data if ch.endswith(".swsh"))
    if subs:
        fea += "feature swsh {\n" + subs + "\n} swsh;\n"
        fea += "feature ss01 {\n    featureNames { name \"Swash capitals\"; };\n" + subs + "\n} ss01;\n"
    return fea


WN = {100: "Thin", 200: "ExtraLight", 300: "Light", 400: "Regular", 500: "Medium",
      600: "SemiBold", 700: "Bold", 800: "ExtraBold", 900: "Black"}


def build(italic):
    data = parse(italic)
    sfx = " Italic" if italic else ""
    ds = DesignSpaceDocument()
    # opsz: user value = CSS px. Design coordinate = 144 - 132 * f, where f is the
    # text fraction from radii.OPSZ_CURVE, so the masters sit at design 12 and 144.
    opsz_map = [(u, round(144 - 132 * f, 2)) for u, f in OPSZ_CURVE]
    for tag, name, lo, df, hi, mp in (("wght", "Weight", 100, 400, 900, None),
                                      ("CNTR", "Contrast", 0, 100, 100, None),
                                      ("opsz", "Optical size", 12, 144, 144, opsz_map)):
        a = AxisDescriptor()
        a.tag, a.name, a.minimum, a.default, a.maximum = tag, name, lo, df, hi
        a.labelNames = {"en": name}
        if mp:
            a.map = mp
        ds.addAxis(a)
    for w in WGHTS:
        for c in CNTRS:
            for f, d in ((0.0, 144), (1.0, 12)):
                s = SourceDescriptor()
                s.font, s.name = master(data, w, c, f, italic), f"m{w}-{c}-{d}"
                s.location = {"Weight": w, "Contrast": c, "Optical size": d}
                ds.addSource(s)
    for c, opsz, prefix in ((100, 144, ""), (0, 144, "Slab "), (100, 12, "Text ")):
        for w, wn in WN.items():
            i = InstanceDescriptor()
            style = f"{prefix}{wn}{sfx}".strip()
            if italic and wn == "Regular":
                style = f"{prefix}Italic".strip()
            i.familyName, i.styleName = FAMILY, style
            i.userLocation = {"Weight": w, "Contrast": c, "Optical size": opsz}
            i.postScriptFontName = f"{PS}-{style.replace(' ', '')}"
            ds.addInstance(i)

    vf, _, _ = varLib.build(ds, exclude=["MVAR"])
    addOpenTypeFeaturesFromString(vf, kern_fea(data, italic))
    vf["OS/2"].recalcUnicodeRanges(vf)               # from the cmap, so the ranges follow the character set
    vf["OS/2"].recalcCodePageRanges(vf)
    buildStatTable(vf, [
        {"tag": "wght", "name": "Weight", "values": [
            {"value": w, "name": n, **({"flags": 2, "linkedValue": 700} if w == 400 else {})}
            for w, n in WN.items()]},
        {"tag": "CNTR", "name": "Contrast", "values": [
            {"value": 0, "name": "Slab"}, {"value": 100, "name": "Didone", "flags": 2}]},
        {"tag": "opsz", "name": "Optical size", "values": [
            {"value": 12, "name": "Text"}, {"value": 144, "name": "Display", "flags": 2}]},
        {"tag": "ital", "name": "Italic", "values": [
            {"value": 1, "name": "Italic"} if italic else
            {"value": 0, "name": "Roman", "flags": 2, "linkedValue": 1}]},
    ])
    tagname = "-Italic" if italic else ""
    vf_path = os.path.join(OUT, f"{PS}{tagname}[CNTR,opsz,wght].ttf")
    vf.save(vf_path)
    vf.flavor = "woff2"
    vf.save(os.path.join(OUT, f"{PS}{tagname}-VF.woff2"))

    sdir = os.path.join(OUT, "static")
    os.makedirs(sdir, exist_ok=True)
    for c, opsz, label, ws in ((100, 144, "", (100, 300, 400, 700, 900)), (0, 144, "Slab", (400, 700)),
                                (100, 12, "Text", (400, 700))):
        for w in ws:
            f = instancer.instantiateVariableFont(TTFont(vf_path), {"wght": w, "CNTR": c, "opsz": opsz})
            fam = f"{FAMILY} {label}".strip()
            ribbi = WN[w] in ("Regular", "Bold")
            if italic:
                sub = "Italic" if w == 400 else f"{WN[w]} Italic"
                style = f"{label}{sub.replace(' ', '')}"
                rib_sub = "Bold Italic" if w == 700 else "Italic"
            else:
                sub = WN[w]
                style = f"{label}{sub}"
                rib_sub = sub if ribbi else "Regular"
            nm = f["name"]
            for rec in list(nm.names):
                if rec.nameID in (1, 2, 3, 4, 6, 16, 17, 25):
                    nm.removeNames(nameID=rec.nameID)
            nm.setName(fam if ribbi else f"{fam} {WN[w]}", 1, 3, 1, 0x409)
            nm.setName(rib_sub, 2, 3, 1, 0x409)
            nm.setName(f"{PS}-{style};{VERSION}", 3, 3, 1, 0x409)
            nm.setName(f"{fam} {sub}", 4, 3, 1, 0x409)
            nm.setName(f"{PS}-{style}", 6, 3, 1, 0x409)
            nm.setName(fam, 16, 3, 1, 0x409)
            nm.setName(sub, 17, 3, 1, 0x409)
            f["OS/2"].usWeightClass = w
            sel = f["OS/2"].fsSelection & ~0x61
            if italic:
                sel |= 0x01
            if w == 700:
                sel |= 0x20
                f["head"].macStyle |= 1
            elif not italic:
                sel |= 0x40
            f["OS/2"].fsSelection = sel
            if "STAT" in f:
                del f["STAT"]
            f.save(os.path.join(sdir, f"{PS}-{style}.ttf"))
    print("VF", vf_path)


def main():
    import glyphs
    glyphs.dump()
    os.makedirs(OUT, exist_ok=True)
    build(False)
    build(True)
    print("static", sorted(os.listdir(os.path.join(OUT, "static"))))


if __name__ == "__main__":
    main()
