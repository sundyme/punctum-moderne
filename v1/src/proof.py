import os
from PIL import Image, ImageDraw, ImageFont
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VF = os.path.join(ROOT, "fonts", "Punctum[ROND,wght].ttf")
W, H = 2000, 1500
img = Image.new("RGB", (W, H), (14, 14, 12))
d = ImageDraw.Draw(img)
lines = [
    ("ABCDEFGHIJKLMNOPQRSTUVWXYZ", 400, 100, 60),
    ("abcdefghijklmnopqrstuvwxyz", 400, 100, 60),
    ("0123456789 !\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~", 400, 100, 40),
    ("°·•…×—←↑→↓♥■ Quickly jumping zebras vex", 400, 100, 40),
    ("Thin Hamburgefonstiv", 100, 100, 70),
    ("Black Hamburgefonstiv", 900, 100, 70),
    ("Pixel Black glyphy jq", 900, 0, 70),
    ("Pixel Light 12:45:09", 300, 0, 70),
]
y = 30
for text, w, r, size in lines:
    f = ImageFont.truetype(VF, size)
    f.set_variation_by_axes([r, w] if [a["name"] for a in f.get_variation_axes()][0] in (b"Roundness", "Roundness") else [w, r])
    d.text((40, y), text, font=f, fill=(255, 176, 64))
    y += int(size * 1.0) + 50
img.save(os.path.join(ROOT, "src", "proof.png"))
f = ImageFont.truetype(VF, 40); print([a for a in f.get_variation_axes()])
