"""Assemble the proposal page: src.html + Punctum Moderne (inlined woff2) + Latin dot data + draft 0.2 CJK dots
(data/dots-0.2.json, made by data.py) → punctum-song.html
python3 cjk/proposal/build.py
"""
import base64
import json
import os
from html import escape

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
src = open(os.path.join(HERE, "src.html"), encoding="utf-8").read()

BASE = ROOT if os.path.exists(os.path.join(ROOT, "src", "glyphs.json")) else os.path.join(ROOT, "v2")   # repository / working folder
woff2 = base64.b64encode(open(os.path.join(BASE, "fonts", "PunctumModerne-VF.woff2"), "rb").read()).decode()
glyphs = json.load(open(os.path.join(BASE, "src", "glyphs.json"), encoding="utf-8"))
latin = {ch: [g["w"], [v for d in g["d"] for v in d]] for ch, g in glyphs.items()
         if len(ch) == 1 and (32 <= ord(ch) < 127 or ch in "–—‘’“”·…")}

cjk = open(os.path.join(HERE, "data", "dots-0.2.json"), encoding="utf-8").read()

license_text = open(os.path.join(HERE, "data", "OFL.txt"), encoding="utf-8").read()
credits = '<details class="body"><summary>字体版权与许可 · SIL OFL 1.1</summary><pre style="white-space:pre-wrap">' + escape(license_text) + '</pre></details>'
src = src.replace('<footer class="foot">', credits + '\n<footer class="foot">')

out = (src.replace("__PM_WOFF2__", woff2)
          .replace("__LATIN__", json.dumps(latin, ensure_ascii=False, separators=(",", ":")))
          .replace("__CJK__", cjk))
dst = os.path.join(HERE, "punctum-song.html")
open(dst, "w", encoding="utf-8").write(out)
open(os.path.join(HERE, "preview.html"), "w", encoding="utf-8").write(
    '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
    '<style>:root{color-scheme:light}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style></head><body>' + out + '</body></html>')
print(dst, f"{len(out.encode()) / 1024:.0f} KB, {len(latin)} Latin glyphs")
