"""Subset Songti SC to the Chinese characters used in index.html / film.js
→ assets/fonts/SongtiSC-Light-sub.woff2 and SongtiSC-Regular-sub.woff2 (macOS only; system font, not redistributable)"""
import os, re, subprocess
FILM = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = "".join(open(os.path.join(FILM, f), encoding="utf-8").read() for f in ("index.html", "assets/film.js"))
chars = sorted(set(re.findall(r"[　-〿一-鿿＀-￯]", src)) | set("·"))
txt = "".join(chars)
for idx, name in ((3, "SongtiSC-Light-sub.woff2"), (6, "SongtiSC-Regular-sub.woff2")):
    subprocess.run(["pyftsubset", "/System/Library/Fonts/Supplemental/Songti.ttc", f"--font-number={idx}", f"--text={txt}",
                    "--flavor=woff2", "--output-file=" + os.path.join(FILM, "assets", "fonts", name)], check=True)
print(len(chars), "chars")
