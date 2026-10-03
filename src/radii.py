"""Dot radius model, shared by the font build and the proofs. Units: grid pitch = 100.

Three inputs:
  w  weight 100–900       size of the thick dots
  c  contrast 0–100       0: every dot equal (slab); 100: full Didone stress
  f  text fraction 0–1    optical size. 0 = display master (opsz 144),
                          1 = text master (opsz 12): fatter stems, hairlines
                          large enough to survive anti-aliasing.
"""
# per weight master: (thick radius, hairline radius at full contrast)
DISPLAY = {100: (20, 7), 400: (40, 11), 900: (62, 16)}
TEXT = {100: (30, 16), 400: (50, 30), 900: (66, 40)}
MONO = 0.86  # at contrast 0, every dot is this fraction of the thick radius
WEIGHT = DISPLAY  # backwards-compatible name

# user opsz (px) -> text fraction f. Browsers set opsz = font-size in CSS px.
OPSZ_CURVE = [(12, 1.0), (16, 0.98), (24, 0.85), (48, 0.55), (96, 0.2), (144, 0.0)]


def _lerp_table(table, w, idx):
    ks = sorted(table)
    if w <= ks[0]:
        return table[ks[0]][idx]
    for a, b in zip(ks, ks[1:]):
        if w <= b:
            t = (w - a) / (b - a)
            return table[a][idx] + (table[b][idx] - table[a][idx]) * t
    return table[ks[-1]][idx]


def _interp(w, idx):
    return _lerp_table(DISPLAY, w, idx)


def text_fraction(opsz):
    pts = OPSZ_CURVE
    if opsz <= pts[0][0]:
        return pts[0][1]
    for (a, fa), (b, fb) in zip(pts, pts[1:]):
        if opsz <= b:
            return fa + (fb - fa) * (opsz - a) / (b - a)
    return 0.0


def radius(tone, w, c, f=0.0):
    rT = _lerp_table(DISPLAY, w, 0) + (_lerp_table(TEXT, w, 0) - _lerp_table(DISPLAY, w, 0)) * f
    rH = _lerp_table(DISPLAY, w, 1) + (_lerp_table(TEXT, w, 1) - _lerp_table(DISPLAY, w, 1)) * f
    stressed = rH + (rT - rH) * tone
    mono = rT * MONO
    return mono + (stressed - mono) * (c / 100)
