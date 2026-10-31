"""Dot data for the proposal page, drafted by cjk/proto2.py (draft 0.2) from Noto Serif CJK SC.

  dots   the 3,500 level-1 characters of 通用规范汉字表 (data/tongyong-l1.txt), the page's few extra characters
         and full-width punctuation, at 24/em. Packed as one byte per lattice cell (23 columns × 24 rows,
         0 = empty, 1–5 = hairline, transition, thick, ball, ornament), deflate-raw, base64.
  grid   永 国 囊 鬱 at 16 and 32/em for the grid comparison, as JSON dot lists.

python3 cjk/proposal/data.py <NotoSerifCJKsc-Regular.otf>   → cjk/proposal/data/dots-0.2.json (about 6 min)
"""
import base64
import hashlib
import json
import os
import sys
import zlib
from multiprocessing import Pool

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import proto2  # noqa: E402

EXTRA = "鬱"                     # page characters outside the level-1 list
GRID = "永国囊鬱"
TONE = {0.0: 1, 0.5: 2, 1.0: 3, 1.3: 4, proto2.ORN: 5}
B = 3                            # baseline row: the em box runs −0.125 … 0.875, so rows 0–2 are below it
# Full-width punctuation is set by hand: drafted from the outline, a 。 or ， is only a few loose dots.
PUNCT = {
    "，": [(4, B + 2, 1.3), (5, B + 1, .5), (4, B, 0.0)],
    "。": [(4, B + 3, 0.0), (5, B + 3, 0.0), (3, B + 2, 0.0), (6, B + 2, 0.0),
          (3, B + 1, 0.0), (6, B + 1, 0.0), (4, B, 0.0), (5, B, 0.0)],
    "、": [(4, B + 3, .5), (5, B + 2, 1.0), (6, B + 1, 1.3)],
    "：": [(12, 15, 1.3), (12, 8, 1.3)],
    "；": [(12, 15, 1.3), (12, 8, 1.3), (11, 7, .5)],
    "！": [(12, j, 1.0) for j in range(10, 19)] + [(12, 6, 1.3)],
    "？": [(9, 17, .5), (10, 18, 0.0), (11, 18, 0.0), (12, 18, 0.0), (13, 18, 0.0), (14, 17, 1.0), (14, 16, 1.0),
          (13, 14, .5), (12, 13, 1.0), (12, 12, 1.0), (12, 6, 1.3)],
    "（": [(17, 21, 0.0), (16, 20, .5)] + [(15, j, 1.0) for j in range(9, 19)] + [(16, 7, .5), (17, 6, 0.0)],
    "）": [(7, 21, 0.0), (8, 20, .5)] + [(9, j, 1.0) for j in range(9, 19)] + [(8, 7, .5), (7, 6, 0.0)],
    "“": [(17, 20, 1.3), (17, 19, .5), (21, 20, 1.3), (21, 19, .5)],
    "”": [(3, 20, 1.3), (3, 19, .5), (7, 20, 1.3), (7, 19, .5)],
    "—": [(i, 11, 0.0) for i in range(1, 24)],
    "·": [(12, 12, 1.3)],
}
DRAFTED_PUNCT = "「」《》"         # these draft cleanly from the outline


def init(font, n):
    proto2.setup(font, n=n)


def draft(ch):
    return ch, proto2.dots(ch)


def run(font, chars, n):
    with Pool(min(os.cpu_count() or 4, 10), initializer=init, initargs=(font, n)) as p:
        return dict(p.map(draft, chars, chunksize=20))


if __name__ == "__main__":
    font = sys.argv[1]
    L1 = open(os.path.join(HERE, "data", "tongyong-l1.txt"), encoding="utf-8").read().strip()
    assert len(L1) == 3500
    dots = run(font, L1 + EXTRA + DRAFTED_PUNCT, 24)
    dots.update(PUNCT)
    chars = "".join(dots)
    packed = bytearray()
    for ch in chars:
        cell = bytearray(23 * 24)
        for i, j, t in dots[ch]:
            cell[j * 23 + i - 1] = TONE[t]
        packed += cell
    z = zlib.compressobj(9, zlib.DEFLATED, -15)
    blob = z.compress(bytes(packed)) + z.flush()
    grid = {str(n): run(font, GRID, n) for n in (16, 32)}
    from fontTools.ttLib import TTFont
    with TTFont(font) as face:
        source = {"family": face["name"].getDebugName(1), "version": face["name"].getDebugName(5),
                  "copyright": face["name"].getDebugName(0), "license": face["name"].getDebugName(13),
                  "sha256": hashlib.sha256(open(font, "rb").read()).hexdigest()}
    out = {"chars": chars, "dots": base64.b64encode(blob).decode(), "grid": grid, "source": source}
    dst = os.path.join(HERE, "data", "dots-0.2.json")
    json.dump(out, open(dst, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(dst, f"{len(chars)} chars, {sum(len(v) for v in dots.values())} dots, {os.path.getsize(dst) / 1024:.0f} KB")
