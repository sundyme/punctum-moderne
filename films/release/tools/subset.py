"""Subset Songti SC to the Chinese characters used in film.js / social.part.js
→ assets/fonts/song-sub.woff2 (Regular) and songb-sub.woff2 (Bold, for the social cut)"""
import os, re, subprocess
FILM = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = "".join(open(os.path.join(FILM, "assets", f), encoding="utf-8").read() for f in ("film.js", "social.part.js"))
chars = sorted(set(re.findall(r"[　-〿一-鿿＀-￯]", src)) | set("·："))
txt = "".join(chars)
for idx, name in ((6, "song-sub.woff2"), (1, "songb-sub.woff2")):
    subprocess.run(["pyftsubset", "/System/Library/Fonts/Supplemental/Songti.ttc", f"--font-number={idx}", f"--text={txt}",
                    "--flavor=woff2", "--output-file=" + os.path.join(FILM, "assets", "fonts", name)], check=True)
print(len(chars), "chars")
