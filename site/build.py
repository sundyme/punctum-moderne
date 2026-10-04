"""Build the Punctum Moderne site (v4): v1 foundry page + concept chapter + italic + live specimen boards.

    python3 site/build.py  ->  docs/index.html  (GitHub Pages; serve docs/ to view locally)
"""
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

F = lambda n: os.path.join(V2, "fonts", n)
b64 = lambda n: base64.b64encode(open(F(n), "rb").read()).decode()
kb = lambda n: f"{os.path.getsize(F(n)) / 1024:.0f} KB"
R = parse()

# ── specimen boards: the in-use artboards, inlined as live HTML
BOARDS = json.load(open(os.path.join(V2, "inuse", "project", "canvas.json"), encoding="utf-8"))["boards"]
CAPTIONS = {  # file: (Chinese title, piece, setting)
    "Main.dc.html": ("展览海报", "Punto per punto", "Black 900"),
    "Contrasto.dc.html": ("对比度图版", "Contrasto", "Black · CNTR 0 / 100"),
    "Copertina.dc.html": ("书籍封面", "Le ore piccole", "Black · SemiBold"),
    "Rivista.dc.html": ("杂志封面", "Moderne N° 07", "Black · Thin"),
    "Spread.dc.html": ("杂志跨页", "The machine learned the pen", "Black · SemiBold"),
    "Profumo.dc.html": ("香水包装", "Violetta", "Black · SemiBold"),
    "Menu.dc.html": ("餐厅菜单", "Osteria del Punto", "SemiBold · Bold"),
    "Segnaletica.dc.html": ("导视系统", "Segnaletica", "Black · Slab Bold"),
    "Biglietti.dc.html": ("名片", "Studio Punto", "Black · Medium"),
    "Orologio.dc.html": ("腕表表盘", "Orologio", "Slab Black"),
}
ROWS = [("海报与封面 · Posters & covers", ["Main.dc.html", "Contrasto.dc.html", "Copertina.dc.html", "Rivista.dc.html"]),
        ("编辑、包装与菜单 · Editorial, packaging, menu", ["Spread.dc.html", "Profumo.dc.html", "Menu.dc.html"]),
        ("空间、身份与屏幕 · Space, identity, screen", ["Segnaletica.dc.html", "Biglietti.dc.html", "Orologio.dc.html"])]


def board_body(name):
    h = open(os.path.join(V2, "inuse", "project", name), encoding="utf-8").read()
    body = h[h.index("</helmet>") + len("</helmet>"):h.index("</x-dc>")].strip()
    body = body.replace("{{bg}}", "#4E347D").replace("{{cntr}}", "100")
    assert "{{" not in body, name
    return body


rows_html = []
for label, names in ROWS:
    figs = []
    for n in names:
        b = BOARDS[n]; w, h = b["w"], b["h"]
        zh, piece, setting = CAPTIONS[n]
        figs.append(
            f'<figure class="board-fig" style="--ar:{w / h:.4f}">'
            f'<div class="board-frame" role="button" tabindex="0" style="--w:{w};--h:{h}" data-w="{w}" data-h="{h}" aria-label="放大查看：{zh}">'
            f'<div class="board" style="width:{w}px;height:{h}px" aria-hidden="true">{board_body(n)}</div></div>'
            f'<figcaption><span><b>{zh}</b> · {piece}</span><span>{setting} · {w}×{h}</span></figcaption></figure>')
    cols = " ".join(f"minmax(0, {BOARDS[n]['w'] / BOARDS[n]['h']:.4f}fr)" for n in names)   # equal heights per row
    rows_html.append(f'<div class="gal-row"><div class="eyebrow">{label}</div><div class="gal-items" style="--cols:{cols}">{"".join(figs)}</div></div>')
gallery = '<div class="gal">' + "".join(rows_html) + "</div>"

t = open(os.path.join(HERE, "template.html"), encoding="utf-8").read()
glyphs = json.dumps({c: {"w": g["width"], "d": [list(d) for d in g["dots"]]} for c, g in R.items()}, ensure_ascii=False, separators=(",", ":"))
glyphs_i = open(os.path.join(V2, "src", "glyphs-italic.json"), encoding="utf-8").read()
I18N = json.load(open(os.path.join(HERE, "i18n.en.json"), encoding="utf-8"))
t = t.replace("__I18N_JS__", open(os.path.join(HERE, "i18n.js"), encoding="utf-8").read())
t = t.replace("__I18N__", json.dumps(I18N, ensure_ascii=False).replace("</", "<\\/"))
for k, v in {"__BOARDS__": gallery, "__WOFF2_I__": b64("PunctumModerne-Italic-VF.woff2"), "__WOFF2__": b64("PunctumModerne-VF.woff2"),
             "__GLYPHS_I__": glyphs_i, "__GLYPHS__": glyphs,
             "__N__": str(len([c for c in R if c not in "  "])), "__KR__": f"{len(kerning(R, False)):,}",
             "__SR__": kb("PunctumModerne-VF.woff2"), "__SI__": kb("PunctumModerne-Italic-VF.woff2")}.items():
    t = t.replace(k, v)
left = re.findall(r"__[A-Z_]+__", t)
assert not left, left
HEAD = ('<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
        '<meta name="description" content="A dot-matrix Didone in roman and italic, three axes and one grid. 点阵上的 Didone。">'
        '<meta property="og:title" content="Punctum Moderne"><meta property="og:description" content="A dot-matrix Didone in roman and italic, three axes and one grid. 点阵上的 Didone。">'
        '<meta property="og:image" content="https://sundyme.github.io/punctum-moderne/media/social.png">'
        '<meta name="twitter:card" content="summary_large_image">'
        '<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22%3E%3Ccircle cx=%228%22 cy=%228%22 r=%226%22 fill=%22%23111%22/%3E%3C/svg%3E">'
        '</head><body style="margin:0">')
out = os.path.join(V2, "docs", "index.html")
open(out, "w", encoding="utf-8").write(HEAD + t + "</body></html>")
print(out, f"{len(t) / 1024:.0f} KB")
