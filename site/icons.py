"""Nav switch icons for the site and the italic page: 7×7 dot matrices drawn with Punctum Moderne's own dots.

Dot size carries the state, as stress does in the face: thick (tone 1), transition (0.5), hairline (0) and
ball (1.3), sized by src/radii.py at wght 700, full contrast, halfway between the display and text masters
so the hairlines survive at 18 px. Every circle is drawn at the radius of its largest state and scaled down
in CSS: --d in the dark theme, --l in the light one, --s for the speaker's wave while sound is off.
--i staggers the change, column by column for the theme, inner to outer for the wave.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src"))
from radii import radius  # noqa: E402

W, F = 700, 0.5
R = {t: radius(t, W, 100, F) / 10 for t in (0, 0.5, 1, 1.3)}   # pitch 10

DISC = ["..###..", ".#####.", "#######", "#######", "#######", ".#####.", "..###.."]
SPEAKER = ["...#...", "..##.w.", "####..w", "####..w", "####..w", "..##.w.", "...#..."]


def _svg(circles):
    return f'<svg viewBox="0 0 70 70" aria-hidden="true">{"".join(circles)}</svg>'


def _c(c, r, rad, style, cls=""):
    k = f' class="{cls}"' if cls else ""
    return f'<circle{k} style="{style}" cx="{5 + 10 * c}" cy="{5 + 10 * r}" r="{rad:.2f}"/>'


def icon_theme():
    """A disc in contrast: thick dots on the left and hairlines on the right in the dark theme, mirrored in light."""
    tone = lambda c: 1 if c < 3 else 0.5 if c == 3 else 0  # noqa: E731
    return _svg(_c(c, r, R[1], f"--i:{c};--d:{R[tone(c)] / R[1]:.3f};--l:{R[tone(6 - c)] / R[1]:.3f}")
                for r, row in enumerate(DISC) for c, ch in enumerate(row) if ch == "#")


def icon_sound():
    """A speaker; its wave is hairlines while silent and swells to balls when sound is on."""
    out = []
    for r, row in enumerate(SPEAKER):
        for c, ch in enumerate(row):
            if ch == "w":
                out.append(_c(c, r, R[1.3], f"--i:{2 if c == 6 else 1};--s:{R[0] / R[1.3]:.3f}", "w"))
            elif ch == "#":
                out.append(_c(c, r, R[0.5] if c < 2 else R[1], "--i:0"))
    return _svg(out)
