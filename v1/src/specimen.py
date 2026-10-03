import base64, json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
t = open(os.path.join(ROOT, "src", "specimen.template.html"), encoding="utf-8").read()
w = base64.b64encode(open(os.path.join(ROOT, "fonts", "Punctum-VF.woff2"), "rb").read()).decode()
b = open(os.path.join(ROOT, "src", "bitmaps.json"), encoding="utf-8").read()
out = t.replace("__WOFF2__", w).replace("__BITMAPS__", b)
open(os.path.join(ROOT, "Punctum-specimen.html"), "w", encoding="utf-8").write(out)
print(len(out))
