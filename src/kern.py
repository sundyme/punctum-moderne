"""Kerning for a dot lattice.

Every glyph sits on the same grid, so kerning is measured in whole pitches:
a kerned pair keeps the dots of both letters on one lattice (in the italic,
the sheared lattice). For each pair we find how far the right glyph could
slide left before any of its dots comes nearer than two pitches to a dot of
the left glyph on the same or an adjacent row (the closest approach of an
unkerned 'nn'), then take two thirds of that, so open pairs (To, AV, r.)
close up without collapsing into the counter-less clumps a pure distance
fit makes (rn -> m). Pairs that collide get opened just enough (swash flourishes hang into sidebearings).
"""
import math

import numpy as np

from glyphs import shear as _shear

ROWS = np.arange(-3, 13)
MIN_D = 2.0
DAMP = 2 / 3
MAX_KERN = 3


def profiles(glyphs, italic=False):
    shear = _shear if italic else (lambda y: 0.0)
    names = [ch for ch in glyphs if glyphs[ch]["dots"] and not ch.isspace()]
    n = len(names)
    lo = np.full((n, len(ROWS)), np.nan)
    hi = np.full((n, len(ROWS)), np.nan)
    adv = np.zeros(n)
    for i, ch in enumerate(names):
        g = glyphs[ch]
        adv[i] = g["width"] + 1
        for x, y, t in g["dots"]:
            if t == 0.0 and y == 1 and x > g["width"] - 1 + shear(y) + 1e-3:
                continue            # an italic flick tip reaching into the next letter: it may touch
            r = y - ROWS[0]
            lo[i, r] = x if np.isnan(lo[i, r]) else min(lo[i, r], x)
            hi[i, r] = x if np.isnan(hi[i, r]) else max(hi[i, r], x)
    return names, lo, hi, adv


def kerning(glyphs, italic=False):
    names, lo, hi, adv = profiles(glyphs, italic)
    # dx0[L, R, yl, yr]: horizontal centre distance from L's rightmost dot on yl
    # to R's leftmost dot on yr, unkerned
    need = np.full((len(names), len(names)), -np.inf)
    for dy, reach in ((0, MIN_D), (1, math.sqrt(MIN_D ** 2 - 1)), (-1, math.sqrt(MIN_D ** 2 - 1))):
        hl = hi[:, max(0, -dy):len(ROWS) - max(0, dy)]
        lr = lo[:, max(0, dy):len(ROWS) - max(0, -dy)]
        dx0 = adv[:, None, None] + lr[None, :, :] - hl[:, None, :]
        # the kern k must satisfy dx0 + k >= reach on every row pair
        k = np.nanmax(reach - dx0, axis=2)
        need = np.fmax(need, k)
    out = {}
    for i, a in enumerate(names):
        for j, b in enumerate(names):
            k = need[i, j]
            if not np.isfinite(k):
                continue
            room = -math.ceil(k - 1e-6)            # whole pitches R could slide left
            if room >= 2:
                v = -min(MAX_KERN, math.floor(room * DAMP))
            elif room < 0:
                v = -room
            else:
                continue
            if v:
                out[(a, b)] = v
    return out


if __name__ == "__main__":
    from glyphs import parse
    for it in (False, True):
        kp = kerning(parse(it), it)
        print("italic" if it else "roman", len(kp), "pairs",
              {p: kp.get(tuple(p)) for p in ("To", "AV", "LT", "rn", "Ty", "fo", "r.", "nn", "Va", "P.", "y.")})
