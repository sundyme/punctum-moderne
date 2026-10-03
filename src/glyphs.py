"""PUNCTUM MODERNE — a dot-matrix Didone.

Grid (one cell = 100 units, UPM 1600):
  y10       ascender (b d f h k l)
  y9 … y0   cap height 10 dots, baseline row is y0
  y6        x-height top (7 dots)
  y-1 … y-3 descender

Tones (dot size is the stroke, as in a broad-nib / Song-style stress):
  #  thick    vertical strokes, stems
  +  medium   transitions on curves
  -  hairline horizontals, serifs, thin diagonals
  O  ball     ball terminals (a c f g j r y 2 3 5 6 9)
  .  empty

Block format:  "== <char> <top-y>" followed by rows going down.
"""

TONE = {"-": 0.0, "+": 0.5, "#": 1.0, "O": 1.3}

SRC = r"""
== A 9
....+....
....#....
...-.#...
...-.#...
...-.#...
..-...#..
..----#..
..-...#..
.-.....#.
---...-#-
== B 9
-#---..
.#...+.
.#...#.
.#...+.
.#----.
.#....+
.#....#
.#....#
.#...+.
-#---..
== C 9
..----.
.+....#
#.....+
#......
#......
#......
#......
#......
.+....-
..----.
== D 9
-#----..
.#....+.
.#.....#
.#.....#
.#.....#
.#.....#
.#.....#
.#.....#
.#....+.
-#----..
== E 9
-#-----
.#....-
.#.....
.#..-..
.#---..
.#..-..
.#.....
.#.....
.#....-
-#-----
== F 9
-#-----
.#....-
.#.....
.#..-..
.#---..
.#..-..
.#.....
.#.....
.#.....
-#-....
== G 9
..----.
.+....#
#.....+
#......
#......
#......
#..--#-
#....#.
.+...#.
..---..
== H 9
-#-..-#-
.#....#.
.#....#.
.#....#.
.#----#.
.#....#.
.#....#.
.#....#.
.#....#.
-#-..-#-
== I 9
-#-
.#.
.#.
.#.
.#.
.#.
.#.
.#.
.#.
-#-
== J 9
..-#-
...#.
...#.
...#.
...#.
...#.
...#.
...#.
O..+.
.--..
== K 9
-#-..---
.#...-..
.#..-...
.#.-....
.#-.....
.#.#....
.#..#...
.#...#..
.#....#.
-#-..-#-
== L 9
-#-....
.#.....
.#.....
.#.....
.#.....
.#.....
.#.....
.#.....
.#....-
-#-----
== M 9
-#.....#-
.-#...-#.
.-#...-#.
.-#...-#.
.-.#.-.#.
.-.#.-.#.
.-.#.-.#.
.-..#..#.
.-..#..#.
---.#.-#-
== N 9
-#...---
.-#...-.
.-#...-.
.-.#..-.
.-.#..-.
.-..#.-.
.-..#.-.
.-...#-.
.-...#-.
---...#.
== O 9
..----..
.+....+.
#......#
#......#
#......#
#......#
#......#
#......#
.+....+.
..----..
== P 9
-#---..
.#...+.
.#....#
.#....#
.#...+.
.#---..
.#.....
.#.....
.#.....
-#-....
== Q 9
..----..
.+....+.
#......#
#......#
#......#
#......#
#......#
#......#
.+....+.
..----..
....+#-.
== R 9
-#---...
.#...+..
.#....#.
.#....#.
.#...+..
.#---...
.#..#...
.#...#..
.#...#..
-#-...#-
== S 9
..---+
.+...-
#.....
#.....
.+#...
...#+.
.....#
.....#
-...+.
+---..
== T 9
---#---
-..#..-
...#...
...#...
...#...
...#...
...#...
...#...
...#...
..-#-..
== U 9
-#-..---
.#....-.
.#....-.
.#....-.
.#....-.
.#....-.
.#....-.
.#....-.
.+....-.
..----..
== V 9
-#-...---
.#.....-.
..#...-..
..#...-..
..#...-..
...#.-...
...#.-...
...#.-...
....#....
....#....
== W 9
-#-..-#-..---
.#....#....-.
..#...-#..-..
..#..-.#..-..
..#..-.#..-..
...#.-..#.-..
...#.-..#-...
...#-...#-...
....#....#...
....#....#...
== X 9
-#-...---
..#...-..
..#...-..
...#.-...
....#....
....#....
...-.#...
..-...#..
..-...#..
---...-#-
== Y 9
-#-...---
..#...-..
..#...-..
...#.-...
....#....
....#....
....#....
....#....
....#....
...-#-...
== Z 9
-------
-....#.
.....#.
....#..
...#...
...#...
..#....
.#.....
.#....-
-------

== a 6
.---..
O...+.
....#.
.---#.
#...#.
#...#.
.--+#-
== b 10
-#....
.#....
.#....
.#....
.#---.
.#...+
.#...#
.#...#
.#...#
.#...+
.#---.
== c 6
.---.
+...O
#....
#....
#....
+...-
.---.
== d 10
...-#.
....#.
....#.
....#.
.---#.
+...#.
#...#.
#...#.
#...#.
+...#.
.---#-
== e 6
.---.
+...+
#...#
#----
#....
+...-
.---.
== f 10
..--.
.+..O
.#...
.#...
-#--.
.#...
.#...
.#...
.#...
.#...
-#-..
== g 6
.---#-
+...#.
#...#.
#...#.
#...#.
+...#.
.---#.
....#.
O...+.
.---..
== h 10
-#.....
.#.....
.#.....
.#.....
.#.++..
.#-..#.
.#...#.
.#...#.
.#...#.
.#...#.
-#-.-#-
== i 8
.#.
...
-#.
.#.
.#.
.#.
.#.
.#.
-#-
== j 8
..#.
....
.-#.
..#.
..#.
..#.
..#.
..#.
..#.
..#.
O.+.
.-..
== k 10
-#.....
.#.....
.#.....
.#.....
.#..---
.#..-..
.#.-...
.##....
.#.#...
.#..#..
-#-.-#-
== l 10
-#.
.#.
.#.
.#.
.#.
.#.
.#.
.#.
.#.
.#.
-#-
== m 6
-#.++..++..
.#-..#-..#.
.#...#...#.
.#...#...#.
.#...#...#.
.#...#...#.
-#-.-#-.-#-
== n 6
-#.++..
.#-..#.
.#...#.
.#...#.
.#...#.
.#...#.
-#-.-#-
== o 6
.---.
+...+
#...#
#...#
#...#
+...+
.---.
== p 6
-#---.
.#...+
.#...#
.#...#
.#...#
.#...+
.#---.
.#....
.#....
-#-...
== q 6
.---#.
+...#.
#...#.
#...#.
#...#.
+...#.
.---#.
....#.
....#.
...-#-
== r 6
-#.-.
.#-.O
.#...
.#...
.#...
.#...
-#-..
== s 6
.---+
#...-
+....
.+#+.
....+
-...#
+---.
== t 8
.-..
.#..
-#--
.#..
.#..
.#..
.#..
.+.-
..-.
== u 6
-#..-#.
.#...#.
.#...#.
.#...#.
.#...#.
.#..-#.
..++.#-
== v 6
-#-.---
.#...-.
..#.-..
..#.-..
..#.-..
...#...
...#...
== w 6
-#-..#..---
.#...#...-.
..#.-.#.-..
..#.-.#.-..
..#.-.#.-..
...#...#...
...#...#...
== x 6
-#-.---
..#.-..
..#.-..
...#...
..-.#..
..-.#..
---.-#-
== y 6
-#-.---
.#...-.
..#.-..
..#.-..
..#.-..
...#...
...#...
..-....
.-.....
O......
== z 6
-----
-..#.
...#.
..#..
.#...
.#..-
-----

== 0 9
..--..
.+..+.
#....#
#....#
#....#
#....#
#....#
#....#
.+..+.
..--..
== 1 9
...#..
..+#..
.+.#..
...#..
...#..
...#..
...#..
...#..
...#..
.--#--
== 2 9
..--..
.-..+.
O....#
.....#
....+.
...#..
..#...
.#....
+....-
------
== 3 9
..--..
.-..+.
O....#
.....+
..---.
.....+
.....#
O....#
.-..+.
..--..
== 4 9
....#.
...-#.
..-.#.
..-.#.
.-..#.
.-..#.
----#-
....#.
....#.
...-#-
== 5 9
.#----
.#....
.#....
.#--..
.#..+.
.....#
.....#
O....#
.-..+.
..--..
== 6 9
..---.
.+...O
#.....
#.--..
#+..+.
#....#
#....#
#....#
.+..+.
..--..
== 7 9
------
-...#.
....#.
...#..
...#..
..#...
..#...
..#...
..#...
..#...
== 8 9
..--..
.+..+.
#....#
.+..+.
..--..
.+..+.
#....#
#....#
.+..+.
..--..
== 9 9
..--..
.+..+.
#....#
#....#
#....#
.+..+#
..--.#
.....#
O...+.
.---..

== . 0
O
== , 0
.O
.+
-.
== : 5
O
.
.
.
.
O
== ; 5
.O
..
..
..
..
.O
.+
-.
== ! 9
#
#
#
#
+
+
-
.
.
O
== ? 9
.---.
O...+
....#
...+.
..+..
..-..
..-..
.....
.....
..O..
== ' 9
#
+
-
== " 9
#.#
+.+
-.-
== ‘ 9
.-
+.
O.
== ’ 9
.O
.+
-.
== “ 9
.-..-
+..+.
O..O.
== ” 9
.O..O
.+..+
-..-.
== - 3
+++
== – 3
+++++
== — 3
+++++++++
== _ -2
++++++
== ( 10
..-
.+.
#..
#..
#..
#..
#..
#..
#..
#..
#..
.+.
..-
== ) 10
-..
.+.
..#
..#
..#
..#
..#
..#
..#
..#
..#
.+.
-..
== [ 10
#--
#..
#..
#..
#..
#..
#..
#..
#..
#..
#..
#..
#--
== ] 10
--#
..#
..#
..#
..#
..#
..#
..#
..#
..#
..#
..#
--#
== { 10
...-
..+.
..#.
..#.
..#.
.+..
-...
.+..
..#.
..#.
..#.
..+.
...-
== } 10
-...
.+..
.#..
.#..
.#..
..+.
...-
..+.
.#..
.#..
.#..
.+..
-...
== / 10
....+
....+
....+
...+.
...+.
...+.
..+..
..+..
..+..
.+...
.+...
.+...
+....
== \ 10
+....
+....
+....
.+...
.+...
.+...
..+..
..+..
..+..
...+.
...+.
...+.
....+
== | 10
#
#
#
#
#
#
#
#
#
#
#
#
#
== + 5
..#..
..#..
--#--
..#..
..#..
== = 4
+++++
.....
+++++
== < 6
....+
..++.
++...
..++.
....+
== > 6
+....
.++..
...++
.++..
+....
== * 9
..O..
O-+-O
..+..
.-.-.
O...O
== # 8
.+..+.
.+..+.
------
.+..+.
.+..+.
------
.+..+.
.+..+.
== $ 10
..-..
..-..
.-+-+
#.-.-
#.-..
.+#..
..-#.
..-.#
-.-.#
+-+-.
..-..
..-..
== % 9
.-....+
+.+..+.
.-..+..
....+..
...+...
..+....
..+..-.
.+..+.+
.+...-.
+......
== & 9
..--...
.+..+..
.+..+..
..+-...
.+.#.-+
#...#-.
#....#.
#...-.#
.+.-..#
..-...-
== @ 8
..-----..
.+.....+.
#..---..#
#.+..#..#
#.#..#..#
#.+..#..#
#..--#-+.
.+.......
..-----..
== ^ 9
..+..
.+.+.
+...+
== ` 9
#.
.-
== ~ 4
.+#..-
-..#+.
== ° 9
.-.
+.+
.-.
== · 3
O
== • 4
.+.
+#+
.+.
== … 0
O.O.O
== × 5
+...+
.+.+.
..#..
.+.+.
+...+
== → 5
...+..
....+.
-----#
....+.
...+..
== ← 5
..+...
.+....
#-----
.+....
..+...
== ß 10
.--..
+..+.
#...#
#..+.
#.--.
#...+
#...#
#...#
#...#
#..+.
#.-..
== æ 6
.---.---.
O...+...+
....#...#
.---#----
#...#....
#...#...-
.--+#---.
== Æ 9
.....#-----
....-#....-
....-#.....
...-.#..-..
...-.#---..
..-..#..-..
..---#.....
.-...#.....
.-...#....-
---.-#-----
== œ 6
.---.---.
+...+...+
#...#...#
#...#----
#...#....
+...+...-
.---.---.
== Œ 9
..----#----
.+....#...-
#.....#....
#.....#.-..
#.....#--..
#.....#.-..
#.....#....
#.....#....
.+....#...-
..----#----
== ¡ 6
O
.
-
+
+
#
#
#
#
== ¿ 6
..O..
.....
.....
..-..
..-..
..+..
.+...
#....
+...O
.---.
== « 4
.+.+
+.+.
.+.+
== » 4
+.+.
.+.+
+.+.
== £ 9
..---.
.+...O
.#....
.#....
----..
.#....
.#....
.#....
+....-
------
== € 9
...---.
..+...#
.#....+
-#---..
.#.....
-#---..
.#.....
.#.....
..+...-
...---.
== ‚ 0
.O
.+
-.
== „ 0
.O..O
.+..+
-..-.
== ‹ 4
.+
+.
.+
== › 4
+.
.+
+.
== ± 7
..#..
..#..
--#--
..#..
..#..
.....
-----
== ÷ 5
..O..
.....
+++++
.....
..O..
== ¢ 7
..-..
.---.
+.-.O
#.-..
#.-..
#.-..
+.-.-
.---.
..-..
== ¥ 9
-#-...---
..#...-..
..#...-..
...#.-...
....#....
..--#--..
....#....
..--#--..
....#....
...-#-...
== § 9
.---+
#...-
+....
.+#..
#..+.
.+..#
..#+.
....+
-...#
+---.
== ¶ 9
.+##-#-
+###.#.
+###.#.
.+##.#.
...#.#.
...#.#.
...#.#.
...#.#.
...#.#.
..-#-#-
== © 9
..-----..
.+.....+.
+..---..+
-.+...O.-
-.#.....-
-.#.....-
-.+...-.-
+..---..+
.+.....+.
..-----..
== ™ 9
---.#...#
.#..##.##
.#..#.#.#
.#..#...#
"""

# ---------------------------------------------------------------------------
# ITALIC. The italic is a sheared lattice: every row of dots slides right by
# tan(ITALIC_ANGLE) of a pitch per row, the way a dot-matrix head printed
# italics by delaying each pin. The dots themselves stay perfectly round.
# On top of the shear the lowercase is redrawn as a true italic: single-storey
# a, a descending f, bare feet, and hairline exit flicks that curl up into the
# next letter. Glyphs not listed here are the roman shapes, sheared.
# ---------------------------------------------------------------------------
ITALIC_ANGLE = 12.0
ITALIC_PIVOT = 3          # the row that does not move (middle of the x-height)

ITALIC_SRC = r"""
== a 6
.--+#..
+...#..
#...#..
#...#..
#...#..
+...#.-
.---.-.
== d 10
...-#..
....#..
....#..
....#..
.--+#..
+...#..
#...#..
#...#..
#...#..
+...#.-
.---.-.
== f 10
...--.
..+..O
..#...
..#...
.-#--.
..#...
..#...
..#...
..#...
..#...
..#...
..+...
.-....
O.....
== h 10
-#......
.#......
.#......
.#......
.#.++...
.#-..#..
.#...#..
.#...#..
.#...#..
.#...#.-
.#....-.
== i 8
.#..
....
-#..
.#..
.#..
.#..
.#..
.#.-
..-.
== k 10
-#.....
.#.....
.#.....
.#.....
.#..+-.
.#.+...
.#+....
.##....
.#.#...
.#..#..
.#...#-
== l 10
-#..
.#..
.#..
.#..
.#..
.#..
.#..
.#..
.#..
.#.-
..-.
== m 6
-#.++..++...
.#-..#-..#..
.#...#...#..
.#...#...#..
.#...#...#..
.#...#...#.-
.#...#....-.
== n 6
-#.++...
.#-..#..
.#...#..
.#...#..
.#...#..
.#...#.-
.#....-.
== p 6
-#---.
.#...+
.#...#
.#...#
.#...#
.#...+
.#---.
.#....
.#....
.#....
== q 6
.--+#.
+...#.
#...#.
#...#.
#...#.
+..+#.
.--.#.
....#.
....#.
....#.
== r 6
-#.-.
.#-.O
.#...
.#...
.#...
.#...
.#...
== u 6
-#...#..
.#...#..
.#...#..
.#...#..
.#...#..
.+..+#.-
..--..-.
== v 6
-#...+
.#...#
.#...#
.#...+
..#.+.
..#.-.
...#..
== w 6
-#...#...+
.#...#...#
.#...#...#
.#...#...+
..#.+.#.+.
..#.-.#.-.
...#...#..
== y 6
-#...#.
.#...#.
.#...#.
.#...#.
.#...#.
.+..+#.
..--.#.
.....#.
O...+..
.---...
"""

# Accents, top row first. Two variants: odd-width and even-width, chosen so the
# mark sits exactly on the base glyph's centre column(s).
ACCENT = {
    "acute":         (["..#", ".+."],          ["...#", "..+."]),
    "grave":         (["#..", ".+."],          ["#...", ".+.."]),
    "circumflex":    ([".#.", "+.+"],          [".##.", "+..+"]),
    "caron":         (["+.+", ".#."],          ["+..+", ".##."]),
    "dieresis":      (["#.#"],                 ["#..#"]),
    "tilde":         ([".#.+", "+.#."],        [".#.+", "+.#."]),
    "ring":          ([".+.", "+.+"],          [".++.", "+..+"]),
    "macron":        (["+++"],                 ["++++"]),
    "breve":         (["+.+", ".-."],          ["+..+", ".--."]),
    "dotaccent":     (["#"],                   ["#"]),
    "hungarumlaut":  ([".#.#", "+.+."],        [".#.#", "+.+."]),
}
UNAME = {"dieresis": "DIAERESIS", "ring": "RING ABOVE", "dotaccent": "DOT ABOVE",
         "hungarumlaut": "DOUBLE ACUTE"}
# optical centre (in columns) where it differs from (width - 1) / 2
CENTRE = {"a": 2, "u": 3, "n": 3, "y": 3, "Y": 4, "A": 4, "U": 3.5, "E": 3, "e": 2, "c": 2,
          "o": 2, "g": 2, "s": 2, "z": 2, "r": 2, "L": 2, "G": 3.5}
TALL = {"l"}              # lowercase with an ascender: marks go up at capital height

ACCENTED = (
    ("a", "A", "grave acute circumflex tilde dieresis ring macron breve"),
    ("c", "C", "acute caron dotaccent"),
    ("e", "E", "grave acute circumflex dieresis caron macron dotaccent"),
    ("g", "G", "breve dotaccent"),
    ("i", "I", "grave acute circumflex dieresis macron dotaccent"),
    ("l", "L", "acute"),
    ("n", "N", "tilde acute caron"),
    ("o", "O", "grave acute circumflex tilde dieresis macron hungarumlaut"),
    ("r", "R", "acute caron"),
    ("s", "S", "acute caron"),
    ("u", "U", "grave acute circumflex dieresis macron ring hungarumlaut"),
    ("y", "Y", "acute dieresis"),
    ("z", "Z", "acute caron dotaccent"),
    ("D", "D", "caron"),
    ("T", "T", "caron"),
)
COMPOSE = {}
for base_l, base_u, marks in ACCENTED:
    import unicodedata
    for mark in marks.split():
        for base in dict.fromkeys((base_l, base_u)):
            if base == "Y" and mark == "dieresis":
                COMPOSE["Ÿ"] = (base, mark)
                continue
            name = (f"LATIN {'SMALL' if base.islower() else 'CAPITAL'} LETTER {base.upper()} "
                    f"WITH {UNAME.get(mark, mark.upper())}")
            try:
                COMPOSE[unicodedata.lookup(name)] = (base, mark)
            except KeyError:
                pass

# Marks that hang below or cut through. (base, column) per character; the
# italic overrides columns where its letters end in a flick instead of a foot.
OGONEK = {"ą": ("a", 4), "ę": ("e", 3), "į": ("i", 1), "ų": ("u", 5),
          "Ą": ("A", 7), "Ę": ("E", 5), "Į": ("I", 1), "Ų": ("U", 5)}
OGONEK_IT = {"ą": 5, "į": 2, "ų": 6}
CEDILLA = {"ç": ("c", 2), "Ç": ("C", 3), "ş": ("s", 2), "Ş": ("S", 2), "ţ": ("t", 2), "Ţ": ("T", 3)}
COMMA_BELOW = {"ș": ("s", 2), "Ș": ("S", 2), "ț": ("t", 2), "Ț": ("T", 3)}
STROKE = {"ł": ("l", [(0, 4), (2, 6)]), "Ł": ("L", [(0, 3), (2, 5)]),
          "đ": ("d", [(3, 8), (5, 8)]), "Đ": ("D", [(0, 5), (2, 5), (3, 5)])}
# the caron on an ascender becomes a small apostrophe to its right: (base, x, y of the ball)
CARON_APOS = {"ď": ("d", 6, 10), "ľ": ("l", 3, 10), "ť": ("t", 3, 9), "Ľ": ("L", 4, 9)}


def _compose(glyphs, italic=False):
    # dotless i for the accented i's
    gi = glyphs["i"]
    glyphs["ı"] = {"width": gi["width"], "dots": [d for d in gi["dots"] if d[1] < 7]}
    for ch, (base, mark) in COMPOSE.items():
        b = glyphs["ı" if base == "i" else base]
        w = b["width"]
        centre = CENTRE.get(base, (w - 1) / 2)
        odd, even = ACCENT[mark]
        pat = even if centre % 1 else odd
        aw = len(pat[0])
        x0 = round(centre - (aw - 1) / 2)
        # lowercase marks: y9–y8 (one row: y8); capitals (and l) keep a row of air above y9: y12–y11
        high = base.isupper() or base in TALL
        top = (12 if len(pat) == 2 else 11) if high else (9 if len(pat) == 2 else 8)
        if base == "A" and mark == "ring":      # the ring closes on the apex
            pat, x0, top = [".-.", "+.+"], 3, 11
        if base == "a" and mark == "ring":
            pat, top = [".+.", "+.+", ".+."], 9
        dots = list(b["dots"])
        for i, row in enumerate(pat):
            for j, c in enumerate(row):
                if c in TONE:
                    dots.append((x0 + j, top - i, TONE[c]))
        glyphs[ch] = {"width": w, "dots": dots}
    for ch, (base, cx) in OGONEK.items():
        cx = OGONEK_IT.get(ch, cx) if italic else cx
        glyphs[ch] = {"width": glyphs[base]["width"],
                      "dots": glyphs[base]["dots"] + [(cx, -1, 0.5), (cx - 1, -2, 0.5), (cx, -3, 0.0)]}
    for ch, (base, cx) in CEDILLA.items():
        glyphs[ch] = {"width": glyphs[base]["width"],
                      "dots": glyphs[base]["dots"] + [(cx, -1, 0.5), (cx - 1, -2, 0.0)]}
    for ch, (base, cx) in COMMA_BELOW.items():
        glyphs[ch] = {"width": glyphs[base]["width"],
                      "dots": glyphs[base]["dots"] + [(cx, -2, 1.3), (cx - 1, -3, 0.0)]}
    for ch, (base, pts) in STROKE.items():
        glyphs[ch] = {"width": glyphs[base]["width"],
                      "dots": glyphs[base]["dots"] + [(x, y, 0.0) for x, y in pts]}
    for ch, (base, mx, my) in CARON_APOS.items():
        glyphs[ch] = {"width": max(glyphs[base]["width"], mx + 1),
                      "dots": glyphs[base]["dots"] + [(mx, my, 1.3), (mx - 1, my - 1, 0.0)]}
    glyphs["ø"] = {"width": 5, "dots": glyphs["o"]["dots"] +
                        [(0, -1, 0.0), (1, 1, 0.0), (2, 3, 0.0), (3, 5, 0.0), (4, 7, 0.0)]}
    glyphs["Ø"] = {"width": 8, "dots": glyphs["O"]["dots"] +
                        [(1, 0, 0.0), (2, 2, 0.0), (3, 4, 0.0), (4, 5, 0.0), (5, 7, 0.0), (6, 9, 0.0)]}
    return glyphs


# ---------------------------------------------------------------------------
# SWASH CAPITALS (italic only; OpenType swsh / ss01). Each is the italic
# capital with flourishes laid over it, so it keeps the capital's advance and
# its flourishes hang into the sidebearings. One vocabulary throughout:
#   entry   a ball at the far left, its hairline arching over into the stem
#   tail    a stem foot that sweeps under the baseline and curls up into a ball
#   exit    a leg or arm that curls up and ends in a ball
# Patches are (x, top y, rows) in the capital's own grid: a tone character
# sets a dot, 'x' erases one, '.' leaves the cell alone.
# ---------------------------------------------------------------------------
ENTRY = (-3, 10, [".+-.", "O..."])        # arches over the cap height into the serif
TAIL = (-3, 0, ["O..", ".+-"])            # sweeps under the baseline and curls back up
SWASH = {
    "A": [(-3, 10, [".+----", "O....."]), (-2, 0, ["..-xx", "O-..."]), (6, 1, ["...-", "xx-."])],
    "B": [(-1, 9, ["..", "-.", "O."]), TAIL],
    "C": [(6, 10, [".O", "-."])],
    "D": [ENTRY, TAIL],
    "E": [ENTRY, (6, 1, ["xO"])],
    "F": [ENTRY, TAIL],
    "G": [(6, 8, ["O"]), (6, 3, ["x"]), (1, 0, ["....#", "....+", "O---."])],
    "H": [ENTRY, TAIL, (5, 1, ["...-", "xx-."])],
    "I": [ENTRY, (2, 1, [".O"])],
    "J": [(0, 9, ["O-"]), (-1, 1, [".x..#", "..xx#", "O..+.", ".--.."])],
    "K": [ENTRY, (5, 1, ["....O", "xx+-."])],
    "L": [ENTRY, TAIL, (6, 1, ["xO"])],
    "M": [ENTRY, (-1, 0, [".x.x", "O-.."]), (6, 1, ["...-", "xx-."])],
    "N": [ENTRY, (5, 10, ["..O", "x.x"]), (-1, 0, [".x.x", "O-.."])],
    "O": [(6, 10, [".O", "+."])],
    "P": [ENTRY, TAIL],
    "Q": [(6, 0, ["...O", "---."])],
    "R": [ENTRY, (7, 1, [".O", "+."])],
    "S": [(5, 10, [".O"]), (-2, 1, ["O.x", ".--"])],
    "T": [(-1, 8, ["Ox"]), (0, 0, ["x.x+x", "O--.."])],
    "U": [ENTRY, (7, 1, [".-", "-."])],
    "V": [ENTRY, (6, 10, ["..O", "x.x"])],
    "W": [ENTRY, (10, 10, ["..O", "x.x"])],
    "X": [ENTRY, (6, 1, ["..O", "x.x"]), (-1, 0, [".x.x", "O-.."])],
    "Y": [ENTRY, (6, 10, ["..O", "x.x"]), (1, 0, ["..x.x", "O..+.", ".--.."])],
    "Z": [(-1, 8, ["Ox"]), (6, 1, ["xO"])],
}


def _swash(glyphs):
    for ch, patches in SWASH.items():
        cells = {(x, y): t for x, y, t in glyphs[ch]["dots"]}
        for x0, top, rows in patches:
            for i, row in enumerate(rows):
                for j, c in enumerate(row):
                    if c == "x":
                        cells.pop((x0 + j, top - i), None)
                    elif c in TONE:
                        cells[(x0 + j, top - i)] = TONE[c]
        glyphs[ch + ".swsh"] = {"width": glyphs[ch]["width"],
                                "dots": [(x, y, t) for (x, y), t in sorted(cells.items())]}
    return glyphs


def _parse_src(src):
    glyphs = {}
    ch = None
    for raw in src.strip("\n").split("\n"):
        line = raw.rstrip()
        if not line:
            continue
        if line.startswith("== "):
            parts = line.split(" ")
            ch, top = parts[1], int(parts[2])
            glyphs[ch] = {"top": top, "rows": []}
            continue
        glyphs[ch]["rows"].append(line)
    out = {}
    for ch, gd in glyphs.items():
        rows = gd["rows"]
        w = max(len(r) for r in rows)
        bad = [r for r in rows if len(r) != w]
        assert not bad, f"{ch!r}: ragged rows {bad}"
        for r in rows:
            assert set(r) <= set(".#+-O"), (ch, r)
        dots = []
        for i, r in enumerate(rows):
            y = gd["top"] - i
            assert y >= -3, f"{ch!r}: below the descender"
            for x, c in enumerate(r):
                if c in TONE:
                    dots.append((x, y, TONE[c]))
        out[ch] = {"width": w, "dots": dots}
    return out


def shear(y):
    """Horizontal offset of row y in the italic, in grid pitches."""
    import math
    return (y - ITALIC_PIVOT) * math.tan(math.radians(ITALIC_ANGLE))


def parse(italic=False):
    out = _parse_src(SRC)
    if italic:
        out.update(_parse_src(ITALIC_SRC))
    out = _compose(out, italic)
    if italic:
        out = _swash(out)
        # an exit flick hangs into the sidebearing: if the last column holds only
        # the hairline tip of the flick (row 1), the advance closes up by one pitch
        for g in out.values():
            last = [d for d in g["dots"] if d[0] == g["width"] - 1]
            if last and all(y == 1 and t == 0.0 for _, y, t in last):
                g["width"] -= 1
        out = {ch: {"width": g["width"],
                    "dots": [(round(x + shear(y), 4), y, t) for x, y, t in g["dots"]]}
               for ch, g in out.items()}
    out[" "] = {"width": 3, "dots": []}
    out[" "] = {"width": 3, "dots": []}
    return out


def dump():
    """Write glyphs.json / glyphs-italic.json for the specimen pages and films."""
    import json
    import os
    here = os.path.dirname(os.path.abspath(__file__))
    for italic, name in ((False, "glyphs.json"), (True, "glyphs-italic.json")):
        g = parse(italic)
        data = {ch: {"w": v["width"], "d": [list(d) for d in v["dots"]]} for ch, v in g.items()}
        with open(os.path.join(here, name), "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    print(len(parse()), "roman glyphs,", len(parse(True)), "italic glyphs")
    dump()
