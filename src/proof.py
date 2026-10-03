import sys
from PIL import Image, ImageDraw
from glyphs import parse
from radii import radius
G = parse()
GI = parse(True)

def line_img(text, w, c, P=12, ink=(17, 17, 17), bg=(246, 246, 243), italic=False, kern=None):
    G_ = GI if italic else G
    cols = sum(G_.get(ch, G_["?"])["width"] + 1 for ch in text) + 4
    img = Image.new("RGB", (cols * P, 17 * P), bg); d = ImageDraw.Draw(img)
    ox = 1
    prev = None
    for ch in text:
        g = G_.get(ch, G_["?"])
        if kern and prev:
            ox += kern.get((prev, ch), 0)
        prev = ch
        for x, y, t in g["dots"]:
            r = radius(t, w, c) * P / 100
            cx = (ox + x + .5) * P; cy = (12.5 - y + .5) * P
            if r > 0: d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=ink)
        ox += g["width"] + 1
    return img

def sheet(lines, path):
    ims = [line_img(*l) for l in lines]
    W = max(i.width for i in ims); H = sum(i.height for i in ims)
    out = Image.new("RGB", (W, H), (246, 246, 243)); y = 0
    for i in ims: out.paste(i, (0, y)); y += i.height
    out.save(path)

if __name__ == "__main__":
    sheet([
        ("ABCDEFGHIJKLM", 400, 100), ("NOPQRSTUVWXYZ", 400, 100),
        ("abcdefghijklm", 400, 100), ("nopqrstuvwxyz", 400, 100),
        ("0123456789 &@?!", 400, 100), ("(.,:;'\"-_/\\|*#$%)", 400, 100),
        ("{}[]<>=+^`~°·•…×→←‘’“”—", 400, 100),
    ], "proof_a.png")
    sheet([
        ("Hamburgefonstiv", 100, 100), ("Hamburgefonstiv", 400, 100), ("Hamburgefonstiv", 900, 100),
        ("Hamburgefonstiv", 400, 0), ("Hamburgefonstiv", 900, 0),
    ], "proof_b.png")
