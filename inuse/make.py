"""Generate the 'Punctum Moderne in Use' canvas: ten artboards + canvas.json.

Every string set in Punctum Moderne goes through P(), which fails the build if
the font lacks a glyph. Display sizes are multiples of 16 px so the dot pitch
lands on whole pixels.
"""
import json
import math
import os
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.join(ROOT, "project")
G = json.load(open(os.path.join(ROOT, "..", "src", "glyphs.json"), encoding="utf-8"))
FONT = "/_blob/d3c53ecf9f4eda84a99d0694877a6bff"

INK, PAPER, VIOLET, LILAC = "#131313", "#F1F0EC", "#4E347D", "#C9BBE8"
PM = "font-family: 'Punctum Moderne', 'Bodoni Moda', serif"
BOD = "font-family: 'Bodoni Moda', serif"


def P(s):
    miss = sorted({c for c in s if c not in G and c not in " \n"})
    assert not miss, f"missing glyphs {miss} in {s!r}"
    return s.replace("&", "&amp;")


def fvs(w, c=100, o=None):
    return f"font-variation-settings: 'wght' {w}, 'CNTR' {c}" + (f", 'opsz' {o}" if o else "")


def page(title, w, h, body, props=None, logic=None, lang="it"):
    props = dict(props or {})
    props["$preview"] = {"width": w, "height": h}
    logic = logic or "renderVals() { return {}; }"
    return f"""<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..700;1,6..96,400..500&amp;display=swap">
<style>
@font-face {{ font-family: "Punctum Moderne"; src: url("{FONT}") format("woff2"); font-weight: 100 900; font-display: block; }}
body {{ margin: 0; }}
</style>
</helmet>
{body}
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{json.dumps(props, ensure_ascii=False)}'>
class Component extends DCLogic {{
{logic}
}}
</script>
</body>
</html>
"""


B = {}  # name -> (title, w, h, html)

# ── 1 · exhibition poster ─────────────────────────────────────────────
TWEAK_FVS = "font-variation-settings: 'wght' 900, 'CNTR' {{cntr}}"  # bound to the cntr tweak


def line(txt, color):
    return (f'<div style="font-size: 352px; line-height: 264px; height: 264px; white-space: nowrap; '
            f'color: {color}; {TWEAK_FVS}">{P(txt)}</div>')


B["Main.dc.html"] = ("Exhibition poster", 900, 1200, page("Punto per punto", 900, 1200, f"""
<div style="width: 900px; height: 1200px; box-sizing: border-box; padding: 56px 64px 52px; background: {{{{bg}}}}; color: #F3EFE6; {PM}; display: flex; flex-direction: column; overflow: hidden">
  <div style="display: flex; justify-content: space-between; align-items: baseline; font-size: 22px; {fvs(600)}; padding-bottom: 18px; border-bottom: 1px solid rgba(243,239,230,.45)">
    <span>{P("Mostra di caratteri")}</span><span>{P("Parma")}</span><span style="font-variant-numeric: tabular-nums">{P("12.03–30.06.2027")}</span>
  </div>
  <div style="margin-top: 56px; display: flex; flex-direction: column">
    {line("Punto", "#F3EFE6")}
    {line("per", "#CDBFEA")}
    {line("punto", "#F3EFE6")}
  </div>
  <div style="margin-top: auto; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 40px; align-items: end; padding-top: 22px; border-top: 1px solid rgba(243,239,230,.45)">
    <p style="margin: 0; {BOD}; font-style: italic; font-size: 30px; line-height: 1.3; max-width: 15em">Una mostra sulla tipografia a punti, da Bodoni alla macchina.</p>
    <div style="font-size: 22px; line-height: 1.45; text-align: right; {fvs(600)}">{P("Ingresso libero")}<br>{P("mar–dom 10–18")}</div>
  </div>
</div>""", props={"bg": {"editor": "color", "default": VIOLET, "options": [VIOLET, INK, "#1E3B34"]},
                  "cntr": {"editor": "range", "default": 100, "min": 0, "max": 100, "step": 1}},
    logic="renderVals() { return { bg: this.props.bg ?? '#4E347D', cntr: this.props.cntr ?? 100 }; }"))

# ── 2 · contrast plate: the same 'a' at CNTR 0 (lilac) under CNTR 100 (ink) ──
B["Contrasto.dc.html"] = ("Contrast plate", 900, 1200, page("Contrasto", 900, 1200, f"""
<div style="width: 900px; height: 1200px; box-sizing: border-box; position: relative; overflow: hidden; background-color: {PAPER}; background-image: radial-gradient(circle, #D2CFC6 0 2px, transparent 2.6px); background-size: 100px 100px; background-position: 50px 30px; color: {INK}; {PM}">
  <div style="position: absolute; left: 64px; right: 64px; top: 56px; display: flex; justify-content: space-between; align-items: baseline">
    <span style="font-size: 32px; {fvs(800)}">{P("Contrasto")}</span>
    <span style="{BOD}; font-style: italic; font-size: 22px; color: #5C5A55">Tavola dei punti</span>
  </div>
  <div aria-hidden="true" style="position: absolute; left: 150px; top: -270px; font-size: 1600px; line-height: 1600px; white-space: nowrap; color: {LILAC}; {fvs(900, 0)}">a</div>
  <div style="position: absolute; left: 150px; top: -270px; font-size: 1600px; line-height: 1600px; white-space: nowrap; color: {INK}; mix-blend-mode: multiply; {TWEAK_FVS}">a</div>
  <div style="position: absolute; left: 64px; right: 64px; bottom: 56px; display: grid; gap: 18px; padding-top: 20px; border-top: 1px solid {INK}">
    <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; font-size: 20px; {fvs(600)}">
      <div style="display: flex; gap: 12px; align-items: center"><span style="width: 18px; height: 18px; border-radius: 50%; background: {LILAC}; flex: none"></span>{P("CNTR 0 · ogni punto uguale")}</div>
      <div style="display: flex; gap: 12px; align-items: center"><span style="width: 18px; height: 18px; border-radius: 50%; background: {INK}; flex: none"></span>{P("CNTR 100 · i punti seguono la penna")}</div>
    </div>
    <p style="margin: 0; {BOD}; font-style: italic; font-size: 28px; line-height: 1.3">Stessi punti, stesso reticolo: cambia soltanto il raggio.</p>
  </div>
</div>""", props={"cntr": {"editor": "range", "default": 100, "min": 0, "max": 100, "step": 1}},
    logic="renderVals() { return { cntr: this.props.cntr ?? 100 }; }"))

# ── 3 · book cover ────────────────────────────────────────────────────
hours = "".join(
    f'<span style="width: 20px; height: 20px; border-radius: 50%; background: {"#A28AD9" if i < 3 else "#2E2D30"}"></span>'
    for i in range(12))
B["Copertina.dc.html"] = ("Book cover", 800, 1200, page("Le ore piccole", 800, 1200, f"""
<div style="width: 800px; height: 1200px; box-sizing: border-box; padding: 72px 72px 60px; background: #111112; color: #F1EEE7; {PM}; display: flex; flex-direction: column">
  <div style="font-size: 32px; letter-spacing: 0.0625em; {fvs(600)}">{P("LIVIA SERENI")}</div>
  <div style="margin-top: auto; display: flex; gap: 14px" aria-label="Dodici ore, le prime tre accese">{hours}</div>
  <p style="margin: 18px 0 40px; {BOD}; font-style: italic; font-size: 22px; color: #A9A59D">dall’una alle tre</p>
  <div style="font-size: 272px; line-height: 204px; {fvs(900)}">
    <div style="height: 204px; white-space: nowrap">{P("Le ore")}</div>
    <div style="height: 204px; white-space: nowrap">{P("piccole")}</div>
  </div>
  <p style="margin: 52px 0 0; {BOD}; font-style: italic; font-size: 30px; color: #A9A59D">Romanzo</p>
  <div style="margin-top: 72px; padding-top: 18px; border-top: 1px solid #3A3936; display: flex; justify-content: space-between; font-size: 20px; {fvs(600)}">
    <span>{P("Edizioni del Punto")}</span><span>{P("Notturni · 7")}</span>
  </div>
</div>"""))

# ── 4 · magazine cover ────────────────────────────────────────────────
lines = [("Saggio", "Il punto e la linea"), ("Storia", "Bodoni a Parma, 1768–1813"),
         ("Costume", "Perché la moda ama il Didone"), ("Officina", "Quattro toni, un reticolo")]
cover_lines = "\n".join(
    f'<div style="display: grid; gap: 4px"><span style="{BOD}; font-style: italic; font-size: 19px; color: #5C5A55">{k}</span>'
    f'<span style="font-size: 32px; line-height: 1.15; {fvs(650)}">{P(t)}</span></div>' for k, t in lines)
B["Rivista.dc.html"] = ("Magazine cover", 900, 1200, page("Moderne N° 07", 900, 1200, f"""
<div style="width: 900px; height: 1200px; box-sizing: border-box; padding: 40px 48px 0; position: relative; overflow: hidden; background: {PAPER}; color: {INK}; {PM}">
  <div style="font-size: 208px; line-height: 156px; height: 156px; white-space: nowrap; {fvs(900)}">{P("MODERNE")}</div>
  <div style="margin-top: 22px; display: flex; justify-content: space-between; padding-block: 10px; border-block: 1px solid {INK}; font-size: 18px; {fvs(650)}; font-variant-numeric: tabular-nums">
    <span>{P("N° 07")}</span><span>{P("Autunno 2026")}</span><span>{P("Rivista di caratteri")}</span><span>{P("€ 18")}</span>
  </div>
  <div aria-hidden="true" style="position: absolute; left: 352px; top: 650px; font-size: 640px; line-height: 640px; white-space: nowrap; color: {VIOLET}; {fvs(100)}">{P("07")}</div>
  <div style="position: relative; margin-top: 72px; width: 300px; display: grid; gap: 30px">
{cover_lines}
  </div>
</div>"""))

# ── 5 · editorial spread ──────────────────────────────────────────────
essay = [
    "Every dot-matrix display ever built has made the same promise: a letter is a pattern of lights, and each light is either on or off. It is an honest promise and a narrow one. A grid of switches can say where a stroke is, but never how it was made.",
    "Giambattista Bodoni spent forty-five years in Parma answering the second question. His letters record a pen that was never quite held, a broad nib kept flat, so that every vertical arrives heavy and every horizontal leaves as a thread. The contrast is the handwriting. Remove it and you have a skeleton; keep it and you have a voice.",
    "QUOTE",
    "Punctum Moderne puts the two ideas on one grid. The dots never move. What changes is their size: four tones, placed by hand for every point of every letter, from the full circle of a stem to the pin-prick of a serif. At a distance the eye does what it has always done with halftone and engraving, and fuses the points into strokes. Up close, the machine shows through.",
    "There is a practical side to this. Because every advance width is a whole number of dots, even kerning moves letters by whole dots, and lines set at a leading of one em lock into the same grid as the letters themselves. A page of it is one continuous field of points. Change the weight and the field darkens; change the contrast and it flattens into a plain machine pattern; change the size and it dissolves into ink.",
    "The result is less a compromise between two traditions than a translation. A dot cannot be thick or thin. It can only be large or small, and that turns out to be enough.",
]
paras = []
for i, t in enumerate(essay):
    if t == "QUOTE":
        paras.append(f'<blockquote style="margin: 6px 0 18px; padding-block: 14px; border-block: 1px solid {VIOLET}; break-inside: avoid; {PM}; font-size: 28px; line-height: 1.2; color: {VIOLET}; {fvs(650)}">{P("A dot cannot be thick or thin. It can only be large or small.")}</blockquote>')
    elif i == 0:
        paras.append(f'<p style="margin: 0 0 14px"><span style="float: left; {PM}; font-size: 128px; line-height: 80px; height: 80px; margin: 5px 10px 0 0; color: {INK}; {fvs(900)}">E</span>{t[1:]}</p>')
    else:
        paras.append(f'<p style="margin: 0 0 14px; text-indent: 1.4em">{t}</p>')
B["Spread.dc.html"] = ("Editorial spread", 1600, 1000, page("The machine learned the pen", 1600, 1000, f"""
<div style="width: 1600px; height: 1000px; display: flex; background: #E6E4DE">
  <div style="width: 800px; height: 1000px; box-sizing: border-box; padding: 64px 72px 48px; background: #F4F3EF; color: {INK}; {PM}; display: flex; flex-direction: column; position: relative">
    <div style="font-size: 18px; letter-spacing: 0.125em; color: {VIOLET}; {fvs(700)}">{P("ESSAY")}</div>
    <div style="margin-top: 56px; font-size: 128px; line-height: 96px; {fvs(900)}">
      <div style="height: 96px; white-space: nowrap">{P("The machine")}</div>
      <div style="height: 96px; white-space: nowrap">{P("learned")}</div>
      <div style="height: 96px; white-space: nowrap">{P("the pen.")}</div>
    </div>
    <p style="margin: 56px 0 0; {BOD}; font-style: italic; font-size: 30px; line-height: 1.35; max-width: 17em">On grids, nibs and the two centuries between a Parma printing house and a field of lights.</p>
    <p style="margin: 22px 0 0; font-size: 18px; {fvs(600)}">{P("Words by Ines Calvo")}</p>
    <div style="margin-top: auto; display: flex; gap: 20px; font-size: 15px; color: #6A6862; {fvs(600)}; font-variant-numeric: tabular-nums"><span>{P("48")}</span><span>{P("Moderne · Autunno 2026")}</span></div>
    <div style="position: absolute; right: 0; top: 0; bottom: 0; width: 36px; background: linear-gradient(90deg, rgba(0,0,0,0), rgba(0,0,0,.07))"></div>
  </div>
  <div style="width: 800px; height: 1000px; box-sizing: border-box; padding: 64px 64px 48px 72px; background: #F4F3EF; color: #1C1B19; display: flex; flex-direction: column; position: relative">
    <div style="position: absolute; left: 0; top: 0; bottom: 0; width: 28px; background: linear-gradient(90deg, rgba(0,0,0,.06), rgba(0,0,0,0))"></div>
    <div style="column-count: 2; column-gap: 32px; {BOD}; font-size: 16.5px; line-height: 1.58; hyphens: auto; text-align: left">
      {"".join(paras)}
    </div>
    <div style="margin-top: auto; display: flex; justify-content: flex-end; gap: 20px; {PM}; font-size: 15px; color: #6A6862; {fvs(600)}; font-variant-numeric: tabular-nums"><span>{P("The machine learned the pen")}</span><span>{P("49")}</span></div>
  </div>
</div>""", lang="en"))

# ── 6 · fragrance box, front face ─────────────────────────────────────
B["Profumo.dc.html"] = ("Fragrance box", 800, 1000, page("Violetta", 800, 1000, f"""
<div style="width: 800px; height: 1000px; box-sizing: border-box; position: relative; background: #F3F2EF; color: {VIOLET}; {PM}">
  <div style="position: absolute; inset: 28px; border: 1.5px solid {VIOLET}"></div>
  <div style="position: absolute; inset: 38px; border: 0.75px solid {VIOLET}"></div>
  <div style="position: absolute; inset: 38px; display: flex; flex-direction: column; align-items: center; text-align: center; padding: 84px 40px 72px">
    <div style="font-size: 20px; letter-spacing: 0.125em; {fvs(650)}">{P("CASA PUNCTUM")}</div>
    <div style="margin-top: 6px; {BOD}; font-style: italic; font-size: 19px">Parma</div>
    <div style="margin-top: auto; font-size: 176px; line-height: 132px; height: 132px; white-space: nowrap; {fvs(900)}">{P("Violetta")}</div>
    <div style="margin-top: 26px; {BOD}; font-style: italic; font-size: 36px">Eau de Parfum</div>
    <div style="margin-top: 34px; font-size: 48px; line-height: 1; {fvs(700)}" aria-hidden="true">{P("· • ·")}</div>
    <div style="margin-top: auto; font-size: 26px; {fvs(650)}">{P("50 ml")}</div>
    <div style="margin-top: 4px; font-size: 16px; {fvs(600)}">{P("1.7 fl. oz.")}</div>
  </div>
</div>"""))

# ── 7 · menu ──────────────────────────────────────────────────────────
menu = [("ANTIPASTI", [("Torta fritta", "con salumi del territorio", "9"),
                       ("Culatello di Zibello", "stagionato ventiquattro mesi", "16")]),
        ("PRIMI", [("Tortelli d’erbetta", "burro e Parmigiano Reggiano", "13"),
                   ("Anolini in brodo", "brodo di tre carni", "14")]),
        ("SECONDI", [("Punta di vitello ripiena", "cotta lentamente al forno", "19"),
                     ("Trippa alla parmigiana", "pomodoro e Parmigiano", "15")]),
        ("DOLCI", [("Zuppa inglese", "alchermes e crema", "7"), ("Caffè", "", "2")])]
leader = "." * 80
sec_html = []
for label, items in menu:
    rows = []
    for name, desc, price in items:
        d = f'<div style="{BOD}; font-style: italic; font-size: 15px; color: #6A6862; margin-top: 1px">{desc}</div>' if desc else ""
        rows.append(f'''<div>
        <div style="display: flex; align-items: baseline; gap: 8px; font-size: 22px; {fvs(600)}">
          <span style="white-space: nowrap">{P(name)}</span>
          <span aria-hidden="true" style="flex: 1; overflow: hidden; white-space: nowrap; color: #A8A59E; min-width: 24px">{leader}</span>
          <span style="font-variant-numeric: tabular-nums">{P(price)}</span>
        </div>{d}</div>''')
    sec_html.append(f'''<div style="display: grid; gap: 12px">
      <div style="font-size: 15px; letter-spacing: 0.125em; color: {VIOLET}; {fvs(750)}">{P(label)}</div>
      {"".join(rows)}
    </div>''')
B["Menu.dc.html"] = ("Restaurant menu", 700, 1000, page("Osteria del Punto", 700, 1000, f"""
<div style="width: 700px; height: 1000px; box-sizing: border-box; padding: 52px 56px 44px; background: #F4F3EF; color: {INK}; {PM}; display: flex; flex-direction: column">
  <div style="font-size: 128px; line-height: 96px; {fvs(900)}">
    <div style="height: 96px; white-space: nowrap">{P("Osteria")}</div>
    <div style="height: 96px; white-space: nowrap">{P("del Punto")}</div>
  </div>
  <div style="margin-top: 26px; padding-bottom: 14px; border-bottom: 1px solid {INK}; display: flex; justify-content: space-between; align-items: baseline">
    <span style="{BOD}; font-style: italic; font-size: 20px">Cucina parmigiana</span>
    <span style="font-size: 15px; {fvs(600)}">{P("Prezzi in euro")}</span>
  </div>
  <div style="margin-top: 26px; flex: 1; display: flex; flex-direction: column; justify-content: space-between">
    {"".join(sec_html)}
  </div>
</div>"""))

# ── 8 · wayfinding ────────────────────────────────────────────────────
def panel(arrow_left, arrow_right, l1, l2, sub, first=False):
    arrow = ""
    if arrow_left or arrow_right:
        arrow = (f'<div style="font-size: 256px; line-height: 160px; height: 160px; {fvs(900)}; '
                 f'text-align: {"left" if arrow_left else "right"}" aria-hidden="true">{P(arrow_left or arrow_right)}</div>')
    else:
        arrow = f'<div style="height: 160px; display: flex; align-items: center"><span style="width: 64px; height: 64px; border-radius: 50%; background: #A28AD9"></span></div>'
    label = f'<div style="height: 96px; white-space: nowrap">{P(l1)}</div>' + (f'<div style="height: 96px; white-space: nowrap">{P(l2)}</div>' if l2 else "")
    return f'''<div style="box-sizing: border-box; padding: 44px 48px 48px; display: flex; flex-direction: column; {"" if first else "border-left: 1px solid #3A3A3E;"}">
    {arrow}
    <div style="margin-top: auto; font-size: 128px; line-height: 96px; {fvs(700, 0)}">{label}</div>
    <div style="margin-top: 22px; font-size: 22px; color: #9D9B95; {fvs(550)}">{P(sub)}</div>
  </div>'''
B["Segnaletica.dc.html"] = ("Wayfinding", 1680, 600, page("Segnaletica", 1680, 600, f"""
<div style="width: 1680px; height: 600px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); background: #141416; color: #F1EFEA; {PM}">
  {panel("←", None, "Sala dei", "Punzoni", "Sala 12 · Punzoni e matrici", first=True)}
  {panel(None, "→", "Biblioteca", None, "Sala 14 · Volumi a stampa, 1768–1813")}
  {panel(None, None, "Uscita", None, "Exit · Sortie · Ausgang")}
</div>"""))

# ── 9 · business cards ────────────────────────────────────────────────
B["Biglietti.dc.html"] = ("Business cards", 1180, 600, page("Studio Punto", 1180, 600, f"""
<div style="width: 1180px; height: 600px; background: #E2E0DA; display: flex; align-items: center; justify-content: center; gap: 56px; {PM}">
  <div style="width: 520px; height: 336px; box-sizing: border-box; padding: 30px 34px 30px 34px; background: {VIOLET}; color: #F3EFE6; display: flex; flex-direction: column; transform: rotate(-2deg); box-shadow: 0 1px 2px rgba(0,0,0,.10), 0 16px 36px rgba(40,30,60,.22)">
    <div style="font-size: 224px; line-height: 168px; height: 168px; {fvs(900)}">{P("P.")}</div>
    <div style="margin-top: auto; align-self: flex-end; text-align: right">
      <div style="font-size: 18px; {fvs(650)}">{P("Studio Punto")}</div>
      <div style="{BOD}; font-style: italic; font-size: 15px; opacity: .85">Caratteri e segni</div>
    </div>
  </div>
  <div style="width: 520px; height: 336px; box-sizing: border-box; padding: 34px 36px 30px; background: #F7F6F2; color: {INK}; display: flex; flex-direction: column; box-shadow: 0 1px 2px rgba(0,0,0,.08), 0 16px 36px rgba(0,0,0,.14)">
    <div style="font-size: 48px; line-height: 1; {fvs(900)}">{P("Marta Vigilante")}</div>
    <div style="margin-top: 10px; {BOD}; font-style: italic; font-size: 17px; color: #4A4843">Disegnatrice di caratteri</div>
    <div style="margin-top: auto; display: grid; gap: 3px; font-size: 15px; {fvs(550)}; font-variant-numeric: tabular-nums">
      <span>{P("marta@studiopunto.example")}</span><span>{P("+39 0521 000 000")}</span><span style="color: {VIOLET}">{P("Studio Punto · Parma")}</span>
    </div>
  </div>
</div>"""))

# ── 10 · watch face, 10:08 ────────────────────────────────────────────
cx = cy = 300
ticks = []
for m in range(60):
    a = math.radians(m * 6 - 90)
    x, y = cx + 196 * math.cos(a), cy + 196 * math.sin(a)
    if m % 5 == 0:
        d, col = 10, "#F1EFEA"
    elif 1 <= m <= 8:
        d, col = 6, "#A28AD9"
    else:
        d, col = 4, "#4A4A4F"
    ticks.append(f'<span style="position: absolute; left: {x - d/2:.1f}px; top: {y - d/2:.1f}px; width: {d}px; height: {d}px; border-radius: 50%; background: {col}"></span>')
B["Orologio.dc.html"] = ("Watch face", 600, 600, page("Orologio", 600, 600, f"""
<div style="width: 600px; height: 600px; position: relative; background: #E2E0DA; {PM}">
  <div style="position: absolute; left: 50px; top: 50px; width: 500px; height: 500px; border-radius: 50%; background: #2B2B2F; box-shadow: 0 20px 44px rgba(0,0,0,.28)"></div>
  <div style="position: absolute; left: 66px; top: 66px; width: 468px; height: 468px; border-radius: 50%; background: #0D0D0F"></div>
  <div aria-hidden="true">{"".join(ticks)}</div>
  <div style="position: absolute; left: 66px; top: 66px; width: 468px; height: 468px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #F1EFEA">
    <div style="font-size: 16px; letter-spacing: 0.125em; color: #8D8B86; {fvs(650)}">{P("PARMA")}</div>
    <div style="margin-top: 8px; font-size: 160px; line-height: 120px; height: 120px; white-space: nowrap; font-variant-numeric: tabular-nums; {fvs(900, 0)}">{P("10:08")}</div>
    <div style="margin-top: 18px; font-size: 22px; color: #A9A7A1; {fvs(550)}">{P("sab 3 ottobre")}</div>
  </div>
</div>"""))

# ── canvas index ──────────────────────────────────────────────────────
rows = [
    (0, ["Main.dc.html", "Contrasto.dc.html", "Copertina.dc.html", "Rivista.dc.html"]),
    (1560, ["Spread.dc.html", "Profumo.dc.html", "Menu.dc.html"]),
    (2900, ["Segnaletica.dc.html", "Biglietti.dc.html", "Orologio.dc.html"]),
]
boards, order, notes = {}, [], {}
row_titles = ["Posters & covers", "Editorial, packaging, menu", "Space, identity, screen"]
for (y, names), ttl in zip(rows, row_titles):
    x = 0
    for n in names:
        title, w, h, _ = B[n]
        boards[n] = {"x": x, "y": y, "w": w, "h": h, "title": title}
        order.append(n)
        x += w + 80
    notes[f"row{len(notes) + 1}"] = {"x": 0, "y": y - 260, "text": ttl, "kind": "title1", "maxW": x - 80}

index = {"v": 3, "createdOnFiles": {"v": 1, "at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")},
         "title": "Punctum Moderne in Use", "launch": {"view": "canvas"}, "pages": [],
         "boards": boards, "order": order, "notes": notes, "designSystems": []}

os.makedirs(PROJ, exist_ok=True)
with open(os.path.join(PROJ, "canvas.json"), "w", encoding="utf-8") as fh:
    json.dump(index, fh, ensure_ascii=False, indent=1)
for n, (_, _, _, html) in B.items():
    with open(os.path.join(PROJ, n), "w", encoding="utf-8") as fh:
        fh.write(html)
print("wrote", len(B), "artboards:", ", ".join(B))
