"""Build the Punctum Moderne Italic release page: inline both VFs, the hero glyph data and the stats."""
import base64
import json
import os
import sys
import warnings

warnings.filterwarnings("ignore")
HERE = os.path.dirname(os.path.abspath(__file__))
V2 = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(V2, "src"))
from glyphs import parse  # noqa: E402
from kern import kerning  # noqa: E402

b64 = lambda p: base64.b64encode(open(os.path.join(V2, "fonts", p), "rb").read()).decode()
R, I = parse(), parse(True)
KI = kerning(I, True)
sub = lambda G: {ch: {"w": G[ch]["width"], "d": [list(d) for d in G[ch]["dots"]]} for ch in set("Italique")}
fonts = os.path.join(V2, "fonts")
files = []
for n in sorted(os.listdir(fonts)):
    if n.endswith((".ttf", ".woff2")):
        files.append([f"fonts/{n}", f"{os.path.getsize(os.path.join(fonts, n)) / 1024:,.0f} KB"])
statics = sorted(os.listdir(os.path.join(fonts, "static")))
files.append([f"fonts/static/ · {len(statics)} 个静态字体", "Thin → Black, Slab, Text, 各含 Italic"])
t = open(os.path.join(HERE, "template.html"), encoding="utf-8").read()
for k, v in {"__ROMAN__": b64("PunctumModerne-VF.woff2"), "__ITALIC__": b64("PunctumModerne-Italic-VF.woff2"),
             "__GR__": json.dumps(sub(R)), "__GI__": json.dumps(sub(I)), "__FILES__": json.dumps(files, ensure_ascii=False),
             "__KR__": f"{len(kerning(R, False)):,}",
             "__KI__": f"{sum(1 for p in KI if 'swsh' not in p[0] + p[1]):,}",
             "__KS__": f"{sum(1 for p, v in KI.items() if 'swsh' in p[0] + p[1] and v > 0):,}",
             "__N__": str(len([c for c in R if c not in "  "]))}.items():
    t = t.replace(k, v)
HEAD = ('<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
        '<meta name="description" content="Punctum Moderne Italic: a sheared dot lattice, sixteen cursive lowercase and twenty-six swash capitals.">'
        '<meta property="og:title" content="Punctum Moderne Italic"><meta property="og:description" content="Punctum Moderne Italic: a sheared dot lattice, sixteen cursive lowercase and twenty-six swash capitals.">'
        '<meta property="og:image" content="https://sundyme.github.io/punctum-moderne/media/social.png">'
        '<meta name="twitter:card" content="summary_large_image">'
        '<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22%3E%3Ccircle cx=%228%22 cy=%228%22 r=%226%22 fill=%22%23111%22/%3E%3C/svg%3E">'
        '</head><body style="margin:0">')
out = os.path.join(V2, "docs", "italic.html")
open(out, "w", encoding="utf-8").write(HEAD + t + "</body></html>")
print(out, f"{len(t) / 1024:.0f} KB")
