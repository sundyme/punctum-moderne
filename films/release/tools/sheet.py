"""Contact sheet of frames/t_*.png → frames/sheet.jpg"""
import glob, os, sys
from PIL import Image, ImageDraw
fs = sorted(glob.glob(os.path.join(os.path.dirname(__file__), "..", "frames", "t_*.png")), key=lambda f: float(os.path.basename(f)[2:-4]))
cols = int(sys.argv[1]) if len(sys.argv) > 1 else 4
tw, th = 480, 270
if fs and Image.open(fs[0]).height > Image.open(fs[0]).width: tw, th = 300, 533
rows = (len(fs) + cols - 1) // cols
sheet = Image.new("RGB", (cols * tw, rows * th), (0, 0, 0))
d = ImageDraw.Draw(sheet)
for i, f in enumerate(fs):
    im = Image.open(f).convert("RGB").resize((tw, th), Image.LANCZOS)
    x, y = (i % cols) * tw, (i // cols) * th
    sheet.paste(im, (x, y)); d.text((x + 6, y + 4), os.path.basename(f)[2:-4], fill=(255, 0, 255))
out = os.path.join(os.path.dirname(__file__), "..", "frames", "sheet.jpg")
sheet.save(out, quality=88); print(out, len(fs))
