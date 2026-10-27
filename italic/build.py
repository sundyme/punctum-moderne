"""Build the Punctum Moderne Italic release page: inline both VFs, the hero glyph data and the stats."""
import base64
import json
import os
import re
import sys
import warnings

warnings.filterwarnings("ignore")
HERE = os.path.dirname(os.path.abspath(__file__))
V2 = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(V2, "src"))
from glyphs import parse  # noqa: E402
from kern import kerning  # noqa: E402
sys.path.insert(0, os.path.join(V2, "site"))
from icons import icon_sound, icon_theme  # noqa: E402

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
missing = [k for k in ("__I18N_JS__", "__ICON_THEME__", "__ICON_SOUND__", "__CHROME_JS__") if k not in t]
if missing:
    raise SystemExit(f"template is missing {missing}")
t = t.replace("__I18N_JS__", open(os.path.join(V2, "site", "i18n.js"), encoding="utf-8").read())
t = t.replace("__ICON_THEME__", icon_theme()).replace("__ICON_SOUND__", icon_sound())
t = t.replace("__CHROME_JS__", open(os.path.join(V2, "site", "chrome.js"), encoding="utf-8").read())
I18N = json.load(open(os.path.join(HERE, "i18n.en.json"), encoding="utf-8"))
t = t.replace("__I18N__", json.dumps(I18N, ensure_ascii=False).replace("</", "<\\/"))
for k, v in {"__ROMAN__": b64("PunctumModerne-VF.woff2"), "__ITALIC__": b64("PunctumModerne-Italic-VF.woff2"),
             "__GR__": json.dumps(sub(R)), "__GI__": json.dumps(sub(I)), "__FILES__": json.dumps(files, ensure_ascii=False),
             "__KR__": f"{len(kerning(R, False)):,}",
             "__KI__": f"{sum(1 for p in KI if 'swsh' not in p[0] + p[1]):,}",
             "__KS__": f"{sum(1 for p, v in KI.items() if 'swsh' in p[0] + p[1] and v > 0):,}",
             "__N__": str(len([c for c in R if c not in " \u00a0"]))}.items():
    t = t.replace(k, v)
assert "__" not in "".join(re.findall(r"__[A-Z_]+__", t)), re.findall(r"__[A-Z_]+__", t)
# dark by default; a visitor's own choice (pm-theme, shared with the main site) wins. Runs before the first paint.
THEME_BOOT = ('<meta name="theme-color" content="#0F1014">'
              "<script>(function(){var t='dark';try{t=localStorage.getItem('pm-theme')||'dark'}catch(e){}"
              "t=t==='light'?'light':'dark';document.documentElement.setAttribute('data-theme',t);"
              "if(t==='light')document.querySelector('meta[name=theme-color]').content='#f4f5f7'})()</script>")
HEAD = ('<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
        '<meta name="description" content="Punctum Moderne Italic: a sheared dot lattice, sixteen cursive lowercase and twenty-six swash capitals.">'
        '<meta property="og:title" content="Punctum Moderne Italic"><meta property="og:description" content="Punctum Moderne Italic: a sheared dot lattice, sixteen cursive lowercase and twenty-six swash capitals.">'
        '<meta property="og:image" content="https://sundyme.github.io/punctum-moderne/media/social.png">'
        '<meta property="og:type" content="website"><meta property="og:url" content="https://sundyme.github.io/punctum-moderne/italic.html">'
        '<meta property="og:image:alt" content="Punctum Moderne Italic">'
        '<meta name="twitter:card" content="summary_large_image">'
        + THEME_BOOT +
        '<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22%3E%3Cstyle%3Ecircle%7Bfill:%23111%7D@media (prefers-color-scheme:dark)%7Bcircle%7Bfill:%23EDEDE9%7D%7D%3C/style%3E%3Ccircle cx=%228%22 cy=%228%22 r=%226%22/%3E%3C/svg%3E">')
out = os.path.join(V2, "docs", "italic.html")
# the template opens with <title>, font links and the page CSS: they belong in <head>; the body starts after the first </style>
head_part, sep, body_part = t.partition("</style>")
assert sep, "template has no </style>"
open(out, "w", encoding="utf-8").write(HEAD + head_part + sep + '</head><body style="margin:0">' + body_part + "</body></html>")
print(out, f"{len(t) / 1024:.0f} KB")
