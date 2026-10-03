---
workflow: general-video
flow: automation
storyboard: yes
message: "Punctum — the life of one dot: a single point becomes a Didone"
destination: website-hero
aspect: 1920x1080
language: en
length: 60s master + 15s hero loop
angle: brand-film
---

## Intent

Brand film for the typeface Punctum Moderne (v2.2, a dot-matrix Didone, axes wght / CNTR / opsz).
It plays above the fold on the font's website and must stand up in a top-tier design exhibition:
premium, grand, exquisite picture and motion design. The concept is "the life of one dot".
One breathing dot is a pen's ball terminal, a print-head strike, a music-box pin, a pixel of a
wordmark, and then it returns to being one dot. The user asked for a mix of all five pitched ideas:
breath, pen, punch, music box and powers of ten.

## Assets

- ../fonts/PunctumModerne-VF.woff2 — the variable font, for the wordmark and any live text.
- ../src/glyphs.json — per-glyph dot data `{ch: {w, d: [[x, y, tone]]}}`. Every dot on screen is drawn from it.
- ../src/radii.py — the radius model (tone, weight, contrast, opsz → radius), mirrored in JS.

## Customizations

- Deliverables:
  - A 60s master at 1920×1080, 60fps, with a score.
  - A 15s silent, seamless hero loop: an edit of chapter V whose first and last frame is the single dot.
- The score is synthesized in code (no samples). It is driven by the same event table as the picture:
  - each sampled pen dot plucks a note;
  - each punch makes a dry tok;
  - the comb voices dots by tone: thick low, hairline high, ball bell.
- Six chapters: I Breath · II Pen · III Punch · IV Music box · V Powers of One · VI Back to the dot.

## Notes

- Black ground with paper-white dots. Parma violet appears only at key moments: the first ball terminal and the wordmark emergence.
- No voiceover. The only on-screen text is "Punctum Moderne" and "A dot-matrix Didone".
- A dark hero block on a light site is accepted.
- Everything is procedural and deterministic: no stock media and no unseeded randomness.
