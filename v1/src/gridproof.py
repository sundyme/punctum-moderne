import json, os
from PIL import Image, ImageDraw
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = json.load(open(os.path.join(ROOT, "src", "bitmaps.json")))
chars = [c for c in B if c not in (" ", " ")]
P = 14; cols = 18
cw, ch = 6 * P, 10 * P
rows = -(-len(chars) // cols)
img = Image.new("RGB", (cols * cw + 40, rows * ch + 40), (14, 14, 12))
d = ImageDraw.Draw(img)
for i, c in enumerate(chars):
    ox = 20 + (i % cols) * cw; oy = 20 + (i // cols) * ch
    for r in range(9):
        for k in range(5):
            x = ox + k * P + P; y = oy + r * P + P // 2
            on = B[c][r][k] == "#"
            rad = 5 if on else 2
            col = (255, 176, 64) if on else ((60, 52, 40) if r < 7 else (40, 36, 30))
            d.ellipse([x - rad, y - rad, x + rad, y + rad], fill=col)
img.save(os.path.join(ROOT, "src", "gridproof.png"))
