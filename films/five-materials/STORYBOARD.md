# STORYBOARD — Punctum Moderne · "Five Materials" (48 s, 1920×1080, 60 fps)

Tempo 90 bpm (bar = 2.667 s). Every chapter cut lands on a bar or half-bar.
src: index.html → assets/film.js (model + WebGL2 renderer) + assets/shaders.js.

| # | Time | Chapter | Picture | Sound | Status |
|---|------|---------|---------|-------|--------|
| P | 0.0–4.0 | The object | A black glossy sphere in a void; a key softbox and two strip lights find it. At 3.0 it lets go and falls out of frame. | Air, a low D swell, a rising shimmer as the light sweeps; a falling whoosh. | animated |
| 1 | 4.0–12.0 | 墨 Ink · 1788 | Top-down macro on cotton paper. The drop falls away from the lens and lands on the beat (4.667) as the ball terminal of an 'a'; splash satellites. Rain 6.0–8.0 builds the 'a' drop by drop (accelerating), camera pulls back; wet beads dry; push back into the ball. | Plops pitched by drop size, sub on the first impact, D add9 pad, a riser into the cut. | animated |
| 2 | 12.0–20.0 | 音 Music box · 1796 | Match cut: the ink ball becomes a steel pin head. Pull back from macro to a turned-brass drum whose pins spell "Punctum Moderne ·"; a blued steel comb plucks one column per 16th note; low pass over the pins. | The pins play themselves (row → D pentatonic, tone → velocity, tiny strum). | animated |
| 3 | 20.0–26.667 | 孔 Punch card · 1890 | A manila card punched with "Punctum", backlit; the lamp strikes; grazing shafts of light as it feeds; swing to the full card (dot-matrix numerals 0–F, interpretation line); rectangular Hollerith holes become round Didone dots with contrast (23.333); dive through the 'c' ball hole into white. | Reader clicks per column, settle clunk, the morph opens a bright chord, a riser into the strobe. | animated |
| 4 | 26.667–33.333 | 滴 Inkjet · 1984 | Strobe flash → high-speed macro of violet droplets with ligaments and satellites (0.2× speed ramping to 1×), then pull up to the head printing "Moderne"; rack to defocus. | Slow pizzicato in the slow-mo, then piezo ticks + landing taps, a soft pulse. | animated |
| 5 | 33.333–41.333 | 光 Light · 2026 | Cross-dissolve into light: "Punctum Moderne" as defocused discs (cat's-eye, onion rings, fringe); the focus sweeps left → right, each dot landing sharp; violet warms to white; city bokeh at the edges. | Pad swell; a sparkle for every dot as it lands sharp; the resolve at 38.78 (sub, D maj9, bells). | animated |
| F | 41.333–48.0 | Wordmark | The light dots settle into the flat white wordmark; "A dot-matrix Didone" / 一个点，穿过两百五十年。; everything fades but the ball of the 'r'; black. | Two tines under the lines; the last dot rings alone. | animated |

## Build notes
- Ink: height-field metaballs with ragged coverage, wet → dry gloss, perspective-projected falling drops with shadows and near-lens DOF.
- Music box: SDF ray-march of drum + pins (pin grid texture, 3×3 neighbour search) + comb (per-row deflection from pluck times); AO; studio-environment reflections only.
- Card: analytic plane + thickness parallax through the holes, translucent stock, rim glow, 44-step volumetric shafts; holes test the 2×2 nearest cells (the ball is wider than its cell).
- Inkjet: analytic spheres/capsules from a per-frame primitive texture; landed-dot grid texture; speed ramp via a time remap.
- Light: instanced bokeh discs, energy-conserving, focus sweep per dot.
- Post: scatter-as-gather DOF (signed CoC), dual-filter bloom, ACES, vignette, grain; 2× supersampling; 180° shutter motion blur on the fast moves.
