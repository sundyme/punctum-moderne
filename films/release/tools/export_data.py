"""Glyph dots (roman, italic incl. swash), kerning and the radius model → assets/data.js"""
import json, os, sys, math, warnings
warnings.filterwarnings("ignore")
HERE = os.path.dirname(os.path.abspath(__file__)); FILM = os.path.dirname(HERE)
SRC = os.path.join(FILM, "..", "..", "src")   # this repository's font sources
sys.path.insert(0, SRC)
from glyphs import parse
from kern import kerning
R, I = parse(), parse(True)
TAN = math.tan(math.radians(12)); PIV = 3
def pack(G, italic):
    out = {}
    for c, g in G.items():
        # store italic dots unsheared (lattice x) so the film can animate the shear
        out[c] = {"w": g["width"], "d": [[round(x - (y - PIV) * TAN, 3) if italic else x, y, t] for x, y, t in g["dots"]]}
    return out
KR = {a + "\u0001" + b: v for (a, b), v in kerning(R, False).items()}
KI = {a + "\u0001" + b: v for (a, b), v in kerning(I, True).items()}
data = {"R": pack(R, False), "I": pack(I, True), "KR": KR, "KI": KI, "TAN": TAN, "PIV": PIV}
open(os.path.join(FILM, "assets", "data.js"), "w").write("window.PMD=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")
print(len(R), len(I), len(KR), len(KI))
