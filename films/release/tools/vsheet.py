"""Contact sheet from a rendered video: python3 tools/vsheet.py video.mp4 start end step [cols] → frames/vsheet.jpg"""
import os, subprocess, sys
from PIL import Image, ImageDraw
v, a, b, st = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4])
cols = int(sys.argv[5]) if len(sys.argv) > 5 else 6
ts = []; t = a
while t <= b + 1e-6: ts.append(round(t, 3)); t += st
tw, th = 320, 180
rows = (len(ts) + cols - 1) // cols
sheet = Image.new("RGB", (cols * tw, rows * th)); d = ImageDraw.Draw(sheet)
for i, t in enumerate(ts):
    p = subprocess.run(["ffmpeg", "-loglevel", "error", "-ss", str(t), "-i", v, "-frames:v", "1", "-vf", f"scale={tw}:{th}", "-f", "image2pipe", "-c:v", "png", "-"], capture_output=True)
    from io import BytesIO
    im = Image.open(BytesIO(p.stdout)).convert("RGB")
    x, y = (i % cols) * tw, (i // cols) * th
    sheet.paste(im, (x, y)); d.text((x + 4, y + 3), f"{t:.2f}", fill=(255, 0, 255))
out = os.path.join(os.path.dirname(__file__), "..", "frames", "vsheet.jpg"); sheet.save(out, quality=86); print(out, len(ts))
