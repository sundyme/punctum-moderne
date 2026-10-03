---
format: 1920x1080
duration: 60s
message: "Punctum — the life of one dot: a single point becomes a Didone"
arc: Breath → Pen → Punch → Music box → Powers of One → Back to the dot
audience: designers, type lovers and exhibition audiences arriving at the Punctum Moderne site
mode: collaborative
version: v1
---

# Punctum — the life of one dot

## Decisions

- **Message**: A single dot, placed with intent, is enough to become a Didone.
- **Audience and arc**: Designers and type lovers who land on the site's hero, and exhibition audiences.
  - The arc follows a life: breath, then the pen, the punch, the music box, powers of one, and back to the dot.
  - It is a closed loop: the last frame equals the first.
- **Format**: 1920×1080 at 60fps.
  - Master: 60.0s.
  - Hero loop: 15.0s, silent.
  - No voiceover and no captions.
  - The score is synthesized in code (no samples). It is driven by the same event table as the picture.
- **Spine**:
  - **One continuous take; the camera never cuts.**
  - Every chapter has exactly one hero dot, a ball terminal (tone 1.3):
    - I: the lone dot.
    - II: the ball of 'a'.
    - III–IV: the ball of 'r' in "Moderne".
    - V: the ball of 'r' in the wordmark (it contains a whole paragraph of text).
    - VI: it becomes the lone dot again.
- **Brand tokens** (from the launch page `site/template.html`, dark theme):
  - ground `#0C0B0E` (paper `#0F0F10` tinted slightly violet)
  - dots `#EDEBE6` (ink `#EDEDE9`)
  - Parma violet `#B9A4E8`; deep violet wash `#241E31`
  - grid points `#222225`
  - Typeface: Punctum Moderne v2.2 only.
    - Every dot is drawn from `src/glyphs.json` with the radius model in `src/radii.py`.
    - The tagline uses the real font file `PunctumModerne-VF.woff2`.
- **On-screen text**: only "Punctum Moderne" and "A dot-matrix Didone". The text inside the discs in V is also just these two lines repeated.
- **Bans**:
  - no cuts, camera shake, glitch, neon, lens flare or gradient text
  - no confetti or random particles
  - no third string of text
  - no stock sound effects
  - Two motion failures to avoid:
    - **Slideshow**: each chapter as a separate card. The single take prevents it.
    - **Screensaver**: motion that says nothing. Every move must be a typographic operation: write, sample, strike, play, zoom.
- **Held frames**: 16.0–17.4s (the violet 'a' is still and only the bell decays) and 52.6–55.0s (wordmark plus tagline).
- **Background layer**:
  - registration points at the current cell pitch, alpha ≈ 0.14
  - very faint film grain (seeded per frame)
  - corner vignette
  - very light dot bloom (≤ 0.25)
- **Direction**: the paper only ever moves left (II→III→IV). The camera only pulls back (II→III, V); the one exception is the zoom-in back to the dot in VI.

## Changes from v1

- The keyframes are drawn with the real glyph data (16 frames).
- Wordmark changed to wght 600 / 28px pitch.
- VI changed from shrinking to converging into the ball.
- Sampling: the ink drops to a ghost at 16% so the dots stand out.

## Built (as rendered)

- **Architecture**:
  - One continuous take = one canvas clip.
  - `assets/engine.js` paints each frame as a pure function of time (glyph data + the radii.py radius model, including the opsz text master).
  - The tagline is a DOM clip set in the real woff2.
  - The score `assets/score.wav` is synthesized by `tools/score.py` from `assets/events.json`, which `tools/export-events.cjs` exports from the same engine.
- **Hero loop** is its own project, `../film-loop` (one root composition per project). The engine is synced with `tools/sync-loop.sh`.
- **Timing changes from the sketches**:
  - IV: the comb sits at x = 474 (the left quarter), so the paper only ever moves left after the push-in.
    - The feed ramps in from 29.3s and decelerates to a stop at 43.8s.
    - First pluck 29.76s, last 42.72s (151 tine events).
  - V: the pull-back runs 43.8 → 51.0s.
    - The disc first slides to frame centre, then settles where the 'r' ball sits.
    - As the text shrinks it switches toward the opsz text master (fuller hairlines).
    - Fusion 49.9 → 51.15s; violet at 51.0s.
  - Tagline: 64px, real font, 52.0–52.6s in, 55.0–55.6s out.
- **Seams**: frame 60.0 = frame 0 (grain period 15s); in the loop, frame 15.0 = frame 0.

## Frame 1 — I Breath

- scene: A single dot breathing on black; faint registration points appear around it
- duration: 8s
- poster: 5.5s
- transition_in: cut
- status: animated
- src: index.html
- time: 0.0–8.0
- hero: the lone dot (r = 54px, the ball radius of 'a' at a 110px pitch)
- audio: room tone rises from silence. A low D2 sustained note swells and fades with the breath (amplitude = dot radius).

**Concept**: Before the film begins there is only a point. Frame 0 shows the dot at rest. Every later chapter is a different life of this dot.

**Motion**:
- 0–8s: the dot BREATHES twice, about 4s per cycle; its radius swings between 46 and 62px.
- 2.5–6s: registration points FADE IN at a 110px pitch, starting near the dot and spreading outward. They reveal that the dot sits on a grid.
- 6–8s: the last in-breath swells to the ball size and holds, ready to be picked up by the pen.

**Constraint**: no text and no camera movement. The first visible motion (the breath) starts within 0.2s.

**Why**: It establishes the protagonist and the grid: a typeface starts from one point.

## Frame 2 — II Pen

- scene: A pointed pen starts from the dot and writes a Didone 'a'; the grid samples the ink into 19 dots; the first dot is revealed as the ball terminal of 'a'
- duration: 11s
- poster: 16.2s
- transition_in: continuous (same take)
- status: animated
- src: index.html
- time: 8.0–19.0
- hero: the ball of 'a' (the first dot)
- audio:
  - The pen nib leaves a fine paper scratch, louder with pressure.
  - At sampling, each dot plucks a note in pen order (pitch = row, timbre = tone), so the stroke becomes a melody.
  - The ball reveal sounds a single bell (D5 + A5).

**Concept**: Didone contrast comes from a pointed pen: pressure makes thick strokes and lifting makes hairlines. The pen starts at the dot and writes the whole 'a'. Then the grid "translates" the ink into dots, and the viewer realizes the first dot was the ball of 'a' all along.

**Motion**:
- 8.0–13.0s: ink DRAWS out of the dot along the 'a' stroke order: arch hairline → stem thick stroke → bowl hairline → left bowl thick stroke → foot. Line width follows pressure.
  - Meanwhile the camera PANS slowly so that 'a' settles at frame center. The pitch stays at 110px; 'a' is about 660×770px.
- 13.0–15.0s: grid hairlines SWEEP across. Each cell the ink passes through SNAPS into a dot in pen order, and the ink fades out.
- 15.0s: the ball of 'a' turns Parma violet (the first violet moment).
- 16.0–17.4s: **held frame**.
- 17.4–19.0s: the paper starts to FEED left. The camera PULLS BACK from a 110px pitch toward 30px. 'a' leaves the frame on the left and the violet fades back to white.

**Constraint**: no visible pen or hand; only the ink line is shown.

**Why**: It shows Punctum's origin: Didone contrast from the pen is translated into dot sizes.

## Frame 3 — III Punch

- scene: A print head on the right strikes "Moderne" column by column, accelerating, with all dots equal; then the contrast breathes once and the word becomes a Didone
- duration: 10s
- poster: 27.6s
- transition_in: continuous (same take)
- status: animated
- src: index.html
- time: 19.0–29.0
- hero: the ball of 'r' in "Moderne"
- audio:
  - Each column strike is a dry *tok*; louder when the column has more pins.
  - The interval shrinks from 0.32s to 0.05s, so the strikes accelerate into a printer's zip.
  - After the last strike there is 0.4s of silence.
  - When the contrast breathes, a pad chord in D major add9 blooms.

**Concept**: The machine half of the face. A 10-pin print head is fixed at the right of the frame while the paper feeds left one column per strike. "Moderne" is first printed at CNTR 0 (every dot equal, a slab dot-matrix). Once it is complete, the contrast breathes once (0 → 100) and the machine becomes a Didone. This demonstrates the CNTR axis.

**Motion**:
- 19.6–25.6s: 48 STRIKES. Each strike makes the pin column flash briefly and the paper step one cell left. The pitch is 30px and the head sits at x = 1680.
- 25.6–26.2s: stop.
- 26.2–27.8s: CNTR 0 → 100 (power2.inOut). Stems SWELL and hairlines SHRINK to pin-pricks; the ball of 'r' grows to 1.3×.
- 28.0–29.0s: the paper changes from stepping to a constant feed, and the camera PUSHES IN to a 60px pitch for IV.

**Constraint**: no printer body; only 10 pin marks and one hairline axis.

**Why**: It shows the machine half of "dot-matrix Didone" and the CNTR axis.

## Frame 4 — IV Music box

- scene: "Moderne" scrolls left past a slightly tilted comb; every dot crossing the comb plays a tine, so the letters are performed
- duration: 14s
- poster: 36.0s
- transition_in: continuous (same take)
- status: animated
- src: index.html
- time: 29.0–43.0
- hero: the ball of 'r' (when it crosses, a bell sounds instead of a tine)
- audio:
  - Each tine is a synthesized music-box tine with inharmonic partials 1 / 2.76 / 5.40.
  - Rows 0–9 map to D major pentatonic, D3–B4.
  - Thick dots add the lower octave (warm), hairlines add the upper octave (glassy), and a ball plays a bell.
  - Because the comb is tilted, each column is rolled top to bottom like an arpeggio.
  - The low D drone continues underneath.

**Concept**: The dots are pins on a music-box cylinder and the comb plucks them. Each letter has its own melody: an M stem is a harp glissando, and a hairline is a single high note. The type is heard.

**Motion**:
- The paper FEEDS left at a constant speed: 48 columns in about 13s (0.27s per column ≈ eighth notes at 111 BPM).
- The comb sits at x = 960 and is tilted about 4°. Ten tines extend to the right as hairlines; their lengths encode pitch (longer is lower).
- When a dot crosses the comb, it brightens and enlarges slightly (PULSE). The matching tine VIBRATES with a decaying sine and a hairline ripple spreads out.
- Played dots stay at 85% brightness.

**Constraint**: no notation, waveforms or spectrum bars. The music is shown only by the tines and the dots.

**Why**: It turns "dots" from a visual unit into rhythm: the face has a voice.

## Frame 5 — V Powers of One

- scene: A logarithmic pull-back: "Moderne" is one line in a circular paragraph, the paragraph is one dot, and that dot is the 'r' ball terminal of the giant wordmark "Punctum Moderne"; tagline below
- duration: 12s
- poster: 53.5s
- transition_in: continuous (same take)
- status: animated
- src: index.html
- time: 43.0–55.0
- hero: the 'r' ball of the wordmark, which is the circular paragraph we were inside (the second violet moment)
- audio:
  - All voices come in together. As more text becomes visible, a granular shimmer of tiny plucks grows denser and quieter.
  - The drone rises.
  - At 51.0s it resolves into one full chord: low D + pad + violet bell.
  - The tagline enters in silence.

**Concept**: Powers of Ten in reverse. II turned one dot into one letter; V turns one word into one dot. The disc we were inside is the 'r' ball of the wordmark, so the 'r' contains "Moderne", which contains 'r', and so on: an endless recursion.

**Motion**:
- 43.0–51.0s: the camera PULLS BACK logarithmically, from a text pitch of 60px to 0.18px (about 340×).
  - 43–45s: the comb fades out, and the other text in the disc ("Punctum Moderne · A dot-matrix Didone", repeated) FADES IN.
  - Then the circular edge of the paragraph appears, then the surrounding discs, until all discs form the dot matrix of "Punctum Moderne" (two lines left-aligned, wordmark pitch 28px, wght 600 for more presence on screen).
- 50.4–51.4s: the text inside each disc FUSES into solid ink. The thousands of characters become dots, and the dots become strokes.
- 51.0s: the target disc is the 'r' ball and turns Parma violet.
- 52.0–52.6s: "A dot-matrix Didone" FADES IN, set with the real font file (opsz text).
- 52.6–55.0s: **held frame**.

**Constraint**: no fly-through blur or warp. The pull-back must be a clean, continuous logarithmic zoom.

**Why**: It reveals the name and the whole system in one moment; this is the film's peak.

## Frame 6 — VI Back to the dot

- scene: The wordmark disappears in a wave radiating from the violet ball; the ball returns to the center, turns white, and breathes, exactly matching the first frame
- duration: 5s
- poster: 58.0s
- transition_in: continuous (same take)
- status: animated
- src: index.html
- time: 55.0–60.0
- hero: the lone dot (which was the 'r' ball)
- audio: the chord decays back to the low D and room tone, which fade to silence at 60.0s, matching 0.0s.

**Concept**: The life comes full circle. All the letters go back to the point that started them.

**Motion**:
- 55.0–55.6s: the tagline fades out.
- 55.2–57.4s: from nearest to farthest, the other dots CONVERGE along their own lines into the ball, accelerating (power3.in) and shrinking until they are absorbed.
- Meanwhile the camera PUSHES IN on the ball: it moves to the center and its radius grows from 16.7px back to 54px.
- 56.0–58.0s: the violet fades back to paper white.
- 57.0–60.0s: one breath. The state at t = 60.0 is pixel-identical to t = 0.

**Constraint**: no "THE END", logo card or URL; the film closes on the dot.

**Why**: It closes the loop. The site hero, the exhibition loop and the film's meaning all share the same frame.

## Frame 7 — Hero loop (separate deliverable)

- scene: A 15s silent loop: the dot breathes → the camera dives into the dot to reveal the circular paragraph → it pulls back and the wordmark appears → hold → the wordmark returns to the dot
- duration: 15s
- poster: 11.5s
- transition_in: cut
- status: animated
- src: ../film-loop/index.html
- time: 0.0–15.0 (separate render)
- audio: none

**Structure**:
- 0–2s: breath (the same frame as the master's 0.0).
- 2–5.5s: PUSH IN on the dot, about 40×, until a line of "Punctum Moderne · A dot-matrix Didone" is readable inside it.
- 5.5–10.5s: the logarithmic pull-back from V; the wordmark resolves and the 'r' ball turns violet.
- 10.5–13.2s: hold on the wordmark and tagline.
- 13.2–15.0s: the collapse from VI; the last frame equals the first.

**Why**: It is the website's first screen. The whole film's idea fits in 15s, and it loops with no visible seam.
