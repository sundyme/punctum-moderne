/* PUNCTUM // SIGNAL — a 30 s beat-cut film for Punctum Moderne.
 *
 * 120 bpm (beat 0.5 s, bar 2 s), 15 bars. draw(ctx, T) paints one 1920×1080
 * frame as a pure function of time; events() exports the same timings for the
 * synthesized score. Every letter is built from the Punctum Moderne glyph dots
 * and the radius model of src/radii.py.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.createSignal = factory;
})(typeof self !== 'undefined' ? self : this, function createSignal(G) {
  'use strict';
  const W = 1920, H = 1080, TAU = Math.PI * 2, CX = W / 2, CY = H / 2;
  const BEAT = 0.5, BAR = 2, END = 30;
  const C = {
    ink: '#0B0A0D', paper: '#EEEBE3', violet: '#B9A4E8', verm: '#FF4B2B', amber: '#FFB347',
    blue: '#2F55FF', green: '#D8E9D6', phos: '#FFB000', flap: '#0F0F11', warm: '#0D0A08',
  };
  // scene starts
  const S = { SIGNAL: 0, MORSE: 1.75, MARQ: 4, RISO: 6, FLAP: 10, PRINT: 12, PUMP: 14, TUN: 16, CRT: 18, SORT: 20, DROP: 22, LOCK: 24, END: 26 };

  // ------------------------------------------------------------ math
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const lin = (t, a, b) => clamp((t - a) / (b - a));
  const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
  const expoOut = (x) => { x = clamp(x); return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x); };
  const expoIn = (x) => { x = clamp(x); return x <= 0 ? 0 : Math.pow(2, 10 * x - 10); };
  const expoIO = (x) => { x = clamp(x); return x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2; };
  const cubicIO = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const cubicOut = (x) => { x = clamp(x); return 1 - Math.pow(1 - x, 3); };
  const backOut = (x, s = 1.7) => { x = clamp(x); const c = s + 1; return 1 + c * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
  const logLerp = (a, b, t) => Math.exp(lerp(Math.log(a), Math.log(b), t));
  function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
  const beatIdx = (T) => Math.floor(T / BEAT + 1e-6);
  const kick = (T, k = 9) => Math.exp(-((T + 1e-6) % BEAT) * k);
  const since = (T, t0) => (T >= t0 ? T - t0 : 1e9);

  // ------------------------------------------------------------ radius model + glyphs
  const DISPLAY = [[100, 20, 7], [400, 40, 11], [900, 62, 16]];
  const TEXT = [[100, 30, 16], [400, 50, 30], [900, 66, 40]];
  function lt(t, w, i) {
    if (w <= t[0][0]) return t[0][i];
    for (let k = 0; k < t.length - 1; k++) { const a = t[k], b = t[k + 1]; if (w <= b[0]) return a[i] + (b[i] - a[i]) * (w - a[0]) / (b[0] - a[0]); }
    return t[t.length - 1][i];
  }
  function rad(tone, w = 500, c = 100, f = 0) {
    const rT = lt(DISPLAY, w, 1) + (lt(TEXT, w, 1) - lt(DISPLAY, w, 1)) * f;
    const rH = lt(DISPLAY, w, 2) + (lt(TEXT, w, 2) - lt(DISPLAY, w, 2)) * f;
    const st = rH + (rT - rH) * tone, mono = rT * 0.86;
    return (mono + (st - mono) * c / 100) / 100;
  }
  const LAY = new Map();
  function layout(text) {
    if (LAY.has(text)) return LAY.get(text);
    const out = []; let x = 0;
    for (let i = 0; i < text.length; i++) {
      const g = G[text[i]]; if (!g) continue;
      for (const [gx, gy, t] of g.d) out.push({ col: x + gx, row: gy, tone: t, ci: i });
      x += g.w + 1;
    }
    const L = { dots: out, width: Math.max(0, x - 1) };
    LAY.set(text, L); return L;
  }
  function place(text, x, y, p, o = {}) {
    const L = layout(text), w = o.w || 500, c = o.c == null ? 100 : o.c, f = o.f || 0;
    const x0 = o.align === 'l' ? x : o.align === 'r' ? x - (L.width - 1) * p : x - (L.width - 1) * p / 2;
    return L.dots.map((d) => ({ x: x0 + d.col * p, y: y - d.row * p, r: rad(d.tone, w, c, f) * p, tone: d.tone, col: d.col, row: d.row, ci: d.ci }));
  }
  const textW = (text, p) => (layout(text).width - 1) * p;

  // ------------------------------------------------------------ canvas helpers
  const pool = {};
  function buf(name) {
    let c = pool[name];
    if (!c) { c = pool[name] = document.createElement('canvas'); c.width = W; c.height = H; }
    const x = c.getContext('2d');
    x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.filter = 'none';
    x.clearRect(0, 0, W, H);
    return [c, x];
  }
  function bg(ctx, col) { ctx.fillStyle = col; ctx.fillRect(0, 0, W, H); }
  function fill(ctx, ds, color, k = 1) {
    ctx.fillStyle = color; ctx.beginPath();
    for (const d of ds) { const r = d.r * k; if (r <= 0.05) continue; ctx.moveTo(d.x + r, d.y); ctx.arc(d.x, d.y, r, 0, TAU); }
    ctx.fill();
  }
  function glow(ctx, fn, blur, a = 1) {
    fn(ctx);
    const [c, x] = buf('glow'); fn(x);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = a; ctx.filter = `blur(${blur}px)`; ctx.drawImage(c, 0, 0);
    ctx.globalAlpha = a * 0.55; ctx.filter = `blur(${blur * 3.5}px)`; ctx.drawImage(c, 0, 0);
    ctx.restore();
  }
  function vignette(ctx, a = 0.55) {
    const g = ctx.createRadialGradient(CX, CY, H * 0.35, CX, CY, H * 1.05);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${a})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  let noiseTile = null;
  function grain(ctx, T, amt) {
    if (!noiseTile) {
      noiseTile = document.createElement('canvas'); noiseTile.width = noiseTile.height = 256;
      const x = noiseTile.getContext('2d'), im = x.createImageData(256, 256);
      for (let i = 0; i < 256 * 256; i++) { const v = hash(i * 0.731 + 17.3) * 255 | 0; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
      x.putImageData(im, 0, 0);
    }
    const f = Math.round(T * 60);
    const ox = -Math.floor(hash(f * 1.3) * 256), oy = -Math.floor(hash(f * 2.7) * 256);
    ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = amt;
    for (let y = oy; y < H; y += 256) for (let x = ox; x < W; x += 256) ctx.drawImage(noiseTile, x, y);
    ctx.restore();
  }

  // ------------------------------------------------------------ HUD
  const SCENES = [
    [S.SIGNAL, 'SC 01 — SIGNAL'], [S.MORSE, 'SC 02 — MORSE'], [S.MARQ, 'SC 03 — MARQUEE'], [S.RISO, 'SC 04 — IRIS / RISO'],
    [S.FLAP, 'SC 06 — SPLIT-FLAP'], [S.PRINT, 'SC 07 — DOT MATRIX'], [S.PUMP, 'SC 08 — WGHT PUMP'], [S.TUN, 'SC 09 — Z-TUNNEL'],
    [S.CRT, 'SC 10 — CRT PHOSPHOR'], [S.SORT, 'SC 11 — PIXEL SORT'], [S.DROP, 'SC 12 — THE DROP'], [S.LOCK, 'SC 13 — LOCK'], [S.END, 'SC 14 — END'],
  ];
  function reg(ctx, x, y, s) {
    ctx.beginPath(); ctx.arc(x, y, s * 0.55, 0, TAU); ctx.moveTo(x - s, y); ctx.lineTo(x + s, y); ctx.moveTo(x, y - s); ctx.lineTo(x, y + s); ctx.stroke();
  }
  function hud(ctx, T, col, a = 0.78) {
    if (a <= 0.01) return;
    let label = SCENES[0][1];
    for (const [t, l] of SCENES) if (T >= t) label = l;
    if (T >= 7 && T < S.FLAP) label = 'SC 05 — RISOGRAPH';
    const f = Math.floor(T * 60 + 1e-6), ss = Math.floor(f / 60), ff = f % 60;
    const tc = `00:00:${String(ss).padStart(2, '0')}:${String(ff).padStart(2, '0')}`;
    ctx.save();
    ctx.globalAlpha = a; ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1.5;
    for (const [x, y] of [[64, 64], [W - 64, 64], [64, H - 64], [W - 64, H - 64]]) reg(ctx, x, y, 14);
    ctx.font = '500 17px "Punctum Moderne"'; ctx.textBaseline = 'middle';
    try { ctx.letterSpacing = '2px'; } catch (e) { /* older canvas */ }
    ctx.textAlign = 'left'; ctx.fillText('PUNCTUM // SIGNAL', 104, 64); ctx.fillText(label, 104, H - 64);
    ctx.textAlign = 'right'; ctx.fillText(tc, W - 104, 64); ctx.fillText('120 BPM', W - 168, H - 64);
    const b = beatIdx(T) % 4;
    for (let i = 0; i < 4; i++) { ctx.globalAlpha = a * (i === b ? 1 : 0.25); ctx.fillRect(W - 154 + i * 12, H - 68, 8, 8); }
    ctx.restore();
  }

  // ======================================================================
  // SC 01–02  SIGNAL → MORSE
  // ======================================================================
  const MORSE = (() => {
    const code = { P: '.--.', U: '..-', N: '-.', C: '-.-.', T: '-', M: '--' };
    const U = 0.0255;                      // one Morse unit (~ a 64th note): PUNCTUM ends at 3.59
    const t0 = 1.75;
    const els = []; const letters = [];
    let u = 0;
    for (const ch of 'PUNCTUM') {
      const s = code[ch], u0 = u;
      for (let i = 0; i < s.length; i++) {
        const len = s[i] === '.' ? 1 : 3;
        els.push({ t: t0 + u * U, dur: len * U, dash: s[i] === '-', ch });
        u += len + (i < s.length - 1 ? 1 : 0);
      }
      letters.push({ ch, t: t0 + u * U, tStart: t0 + u0 * U });
      u += 3;
    }
    const tEnd = t0 + u * U;               // ≈ 3.88
    return { els, letters, U, t0, tEnd };
  })();
  const HEAD = { x: 1480, y: 420 }, SPEED = 760;
  function sceneSignal(ctx, T) {
    bg(ctx, C.ink);
    // faint lattice
    ctx.fillStyle = `rgba(238,235,227,${0.07 * smooth(lin(T, 0, 0.6))})`;
    ctx.beginPath(); for (let x = 30; x < W; x += 40) for (let y = 20; y < H; y += 40) { ctx.moveTo(x + 1.3, y); ctx.arc(x, y, 1.3, 0, TAU); } ctx.fill();
    // the dot travels from centre to the write head on the 1.5 kick (a whip)
    const e = expoOut(lin(T, 1.5, 1.78));
    const x = lerp(CX, HEAD.x, e), y = lerp(CY, HEAD.y, e);
    const v = (lin(T, 1.5, 1.78) > 0 && lin(T, 1.5, 1.78) < 1) ? (1 - e) : 0;
    // speed lines appear with the whip
    speedLines(ctx, T, smooth(lin(T, 1.45, 1.6)));
    // pulse rings (one per kick)
    for (let b = 0; b < 4; b++) {
      const a = T - b * BEAT; if (a < 0) continue;
      const r = 40 + a * 980, al = 0.65 * (1 - a / 1.1);
      if (al <= 0) continue;
      ctx.strokeStyle = `rgba(185,164,232,${al})`; ctx.lineWidth = 3 - a * 2; ctx.beginPath(); ctx.arc(CX, CY, r, 0, TAU); ctx.stroke();
    }
    const R = 34 * (1 + 0.32 * kick(T, 10) * (T < 1.75 ? 1 : 0));
    if (T < 1.78) glow(ctx, (c) => {
      c.fillStyle = C.violet;
      c.save(); c.translate(x, y); c.scale(1 + v * 3.5, 1 - v * 0.45); c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fill(); c.restore();
      if (v > 0) { const g = c.createLinearGradient(x - 600 * v, 0, x, 0); g.addColorStop(0, 'rgba(185,164,232,0)'); g.addColorStop(1, 'rgba(185,164,232,0.6)'); c.fillStyle = g; c.fillRect(x - 600 * v - 200, y - R * 0.6, 600 * v + 200, R * 1.2); }
    }, 18, 0.9);
    if (T >= MORSE.t0) morseLine(ctx, T);
  }
  function speedLines(ctx, T, a) {
    if (a <= 0.01) return;
    for (let i = 0; i < 70; i++) {
      const y = 120 + hash(i) * 840, l = 200 + hash(i + 3) * 900;
      const x = ((hash(i + 9) * (W + l) - (T * (1400 + 1600 * hash(i + 2)))) % (W + l) + (W + l)) % (W + l) - l;
      const g = ctx.createLinearGradient(x, 0, x + l, 0);
      g.addColorStop(0, 'rgba(238,235,227,0)'); g.addColorStop(1, `rgba(238,235,227,${a * (0.05 + 0.12 * hash(i + 5))})`);
      ctx.fillStyle = g; ctx.fillRect(x, y, l, 1 + 2 * hash(i + 7));
    }
  }
  function morseLine(ctx, T) {
    const dx = (t) => (T - t) * SPEED;
    // perforated tape, scrolling with the code
    ctx.save(); ctx.translate(0, 650); ctx.rotate(-0.05);
    ctx.fillStyle = C.paper; ctx.fillRect(-100, -70, W + 300, 140);
    ctx.fillStyle = C.ink;
    const feedOff = (T * SPEED) % 26;
    ctx.beginPath(); for (let xx = -100 - feedOff; xx < W + 200; xx += 26) { ctx.moveTo(xx + 5, 0); ctx.arc(xx, 0, 5, 0, TAU); } ctx.fill();
    ctx.beginPath();
    for (const el of MORSE.els) {
      if (T < el.t) break;
      const xx = HEAD.x - dx(el.t);
      if (xx < -200) continue;
      ctx.moveTo(xx + 15, el.dash ? 34 : -34); ctx.arc(xx, el.dash ? 34 : -34, 15, 0, TAU);
      if (el.dash) { ctx.moveTo(xx - 26 + 15, 34); ctx.arc(xx - 26, 34, 15, 0, TAU); }
    }
    ctx.fill();
    ctx.restore();
    // the signal: violet dots and dashes with trails
    const head = T < MORSE.tEnd;
    glow(ctx, (c) => {
      for (const el of MORSE.els) {
        if (T < el.t) break;
        const xr = HEAD.x - dx(el.t);
        const on = Math.min(T - el.t, el.dur);
        const xl = HEAD.x - dx(el.t + on);
        if (xr < -60) continue;
        const tr = c.createLinearGradient(xl - 230, 0, xl, 0);
        tr.addColorStop(0, 'rgba(185,164,232,0)'); tr.addColorStop(1, 'rgba(185,164,232,0.45)');
        c.fillStyle = tr; c.fillRect(xl - 230, HEAD.y - 8, 230, 16);
        c.fillStyle = C.violet;
        c.beginPath(); c.arc(xl, HEAD.y, 17, 0, TAU); c.arc(xr, HEAD.y, 17, 0, TAU); c.fill();
        c.fillRect(Math.min(xl, xr), HEAD.y - 17, Math.abs(xr - xl), 34);
      }
    }, 14, 0.8);
    // letters above, as each group completes
    ctx.font = '400 30px "Punctum Moderne"'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    for (const L of MORSE.letters) {
      if (T < L.t) continue;
      const a = smooth(lin(T, L.t, L.t + 0.08));
      const xm = HEAD.x - ((T - L.tStart) * SPEED + (T - L.t) * SPEED) / 2;
      ctx.fillStyle = `rgba(238,235,227,${0.75 * a})`; ctx.fillText(L.ch, xm, HEAD.y - 70);
    }
    // the write head (the dot), until it lets go
    if (head) glow(ctx, (c) => { c.fillStyle = C.violet; c.beginPath(); c.arc(HEAD.x, HEAD.y, 34 * (1 + 0.25 * kick(T, 12)), 0, TAU); c.fill(); }, 16, 0.9);
  }
  // the last dot flies at the lens and becomes a bulb
  function flyDot(ctx, T) {
    const e = expoIn(lin(T, MORSE.tEnd - 0.02, 4.0));
    if (e <= 0) return;
    const x = lerp(HEAD.x, CX, cubicIO(lin(T, MORSE.tEnd - 0.02, 4.0))), y = lerp(HEAD.y, CY, cubicIO(lin(T, MORSE.tEnd - 0.02, 4.0)));
    const r = lerp(34, 1400, e);
    const col = `rgb(${lerp(185, 255, e) | 0},${lerp(164, 196, e) | 0},${lerp(232, 120, e) | 0})`;
    glow(ctx, (c) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }, 30, 0.8);
  }

  // ======================================================================
  // SC 03  MARQUEE — every dot a tungsten bulb
  // ======================================================================
  function bulb(ctx, x, y, r, on) {
    if (on > 0.05) {
      const g = ctx.createRadialGradient(x, y, r * 0.8, x, y, r * 2.7);
      g.addColorStop(0, `rgba(255,170,70,${0.7 * on})`); g.addColorStop(1, 'rgba(255,170,70,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2.7, 0, TAU); ctx.fill();
    }
    const g2 = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, 0, x, y, r);
    if (on > 0.05) { g2.addColorStop(0, '#fffaf0'); g2.addColorStop(0.35, `rgba(255,${200 + 30 * on | 0},120,1)`); g2.addColorStop(1, `rgba(255,${(130 + 60 * on) | 0},50,1)`); }
    else { g2.addColorStop(0, 'rgba(110,80,50,0.9)'); g2.addColorStop(0.6, 'rgba(48,32,22,1)'); g2.addColorStop(1, 'rgba(20,14,10,1)'); }
    ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = Math.max(1, r * 0.18); ctx.beginPath(); ctx.arc(x, y, r * 1.12, 0, TAU); ctx.stroke();
  }
  const MQ = (() => {
    const pw = 1720, ph = 560, px = (W - pw) / 2, py = 250;
    const letters = place('PUNCTUM', CX, py + 470, 30, { w: 400 });
    const border = [];
    for (let x = px + 40; x <= px + pw - 40; x += 46) border.push([x, py + 40]);
    for (let y = py + 86; y <= py + ph - 40; y += 46) border.push([px + pw - 40, y]);
    for (let x = px + pw - 86; x >= px + 40; x -= 46) border.push([x, py + ph - 40]);
    for (let y = py + ph - 86; y >= py + 86; y -= 46) border.push([px + 40, y]);
    // the bulb we arrive in, and the one we leave through
    const byDist = (tx, ty) => letters.reduce((b, d) => (Math.hypot(d.x - tx, d.y - ty) < Math.hypot(b.x - tx, b.y - ty) ? d : b));
    const inB = byDist(CX + 40, CY - 20), outB = byDist(CX - 260, CY + 40);
    return { pw, ph, px, py, letters, border, inB, outB };
  })();
  function marqueeDraw(ctx, T) {
    const { pw, ph, px, py, letters, border } = MQ;
    ctx.fillStyle = '#17120E'; ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = '#3a2c20'; ctx.lineWidth = 4; ctx.strokeRect(px + 16, py + 16, pw - 32, ph - 32);
    const step = Math.floor(T / 0.25 + 1e-6);
    const down = (T % BAR) < 0.14;
    border.forEach(([x, y], k) => bulb(ctx, x, y, 10, down || (k + step) % 3 === 0 ? 1 : 0));
    for (const d of letters) {
      const lit = down ? 1 : ((d.col + d.row * 2 + step) % 5 !== 0 ? 1 : 0);
      const fl = 0.85 + 0.15 * hash(d.col * 3.1 + d.row * 7.7 + step);
      bulb(ctx, d.x, d.y, Math.max(6, d.r * 1.05), lit * fl);
    }
  }
  function sceneMarquee(ctx, T) {
    bg(ctx, C.warm);
    // camera: arrive inside one bulb, pull back; leave by pushing into another
    const eIn = expoOut(lin(T, 4.0, 4.75));
    const eOut = expoIn(lin(T, 5.35, 6.0));
    let s = logLerp(70, 1, eIn), fx = lerp(MQ.inB.x, CX, eIn), fy = lerp(MQ.inB.y, CY, eIn);
    if (eOut > 0) { s = logLerp(1, 70, eOut); fx = lerp(CX, MQ.outB.x, Math.min(1, eOut * 3)); fy = lerp(CY, MQ.outB.y, Math.min(1, eOut * 3)); }
    const shake = 6 * kick(T, 14);
    ctx.save();
    ctx.translate(CX + (hash(beatIdx(T)) - 0.5) * shake, CY + (hash(beatIdx(T) + 9) - 0.5) * shake);
    ctx.scale(s, s); ctx.translate(-fx, -fy);
    marqueeDraw(ctx, T);
    ctx.restore();
    // floor reflection when the sign is whole
    const ra = smooth(lin(T, 4.45, 4.8)) * (1 - smooth(lin(T, 5.3, 5.5)));
    if (ra > 0.01) {
      const [c, x] = buf('refl');
      x.translate(0, 2 * 870); x.scale(1, -1); marqueeDraw(x, T);
      ctx.save(); ctx.globalAlpha = 0.16 * ra; ctx.filter = 'blur(6px)'; ctx.drawImage(c, 0, 0); ctx.restore();
      const g = ctx.createLinearGradient(0, 860, 0, H); g.addColorStop(0, 'rgba(13,10,8,0.2)'); g.addColorStop(1, 'rgba(13,10,8,1)');
      ctx.fillStyle = g; ctx.fillRect(0, 860, W, H - 860);
    }
    // zoom streaks on the push in/out
    const zs = Math.max(1 - eIn, eOut);
    if (zs > 0.02) zoomStreaks(ctx, zs, [255, 179, 71]);
    vignette(ctx, 0.6);
  }
  function zoomStreaks(ctx, a, rgb, r0b = 120) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 150; i++) {
      const ang = hash(i) * TAU, r0 = r0b + hash(i + 4) * 260, r1 = r0 + 200 + hash(i + 8) * 900;
      ctx.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a * (0.04 + 0.1 * hash(i + 2))})`; ctx.lineWidth = 1 + 3 * hash(i + 6);
      ctx.beginPath(); ctx.moveTo(CX + Math.cos(ang) * r0, CY + Math.sin(ang) * r0); ctx.lineTo(CX + Math.cos(ang) * r1, CY + Math.sin(ang) * r1); ctx.stroke();
    }
    ctx.restore();
  }

  // ======================================================================
  // SC 04–05  IRIS → RISO
  // ======================================================================
  function halftone(ctx, col, ang, step, valFn) {
    ctx.fillStyle = col; ctx.beginPath();
    const ca = Math.cos(ang), sa = Math.sin(ang), R = Math.hypot(W, H) / 2 + step;
    for (let u = -R; u < R; u += step) for (let v = -R; v < R; v += step) {
      const x = CX + u * ca - v * sa, y = CY + u * sa + v * ca;
      if (x < -step || x > W + step || y < -step || y > H + step) continue;
      const val = valFn(x, y); if (val <= 0.02) continue;
      const r = Math.sqrt(Math.min(1, val)) * step * 0.62;
      ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
    }
    ctx.fill();
  }
  const RISO = (() => {
    const A = place('Moderne', CX, 762, 31, { w: 700 });
    // grid lookup for the halftone layer (dot → coverage)
    return { A };
  })();
  function risoOffset(T) {
    // the red plate jumps out of register on every beat, then snaps in at 8.0
    if (T >= 8.0) { const s = since(T, 8.0); return [9 * Math.exp(-s * 18) * Math.cos(s * 60), 0]; }
    const b = beatIdx(T), a = lerp(70, 26, lin(T, 6.3, 8.0));
    const e = expoOut(((T % BEAT) / BEAT) * 3);
    const p0 = [(hash(b) - 0.5) * 2 * a, (hash(b + 3) - 0.5) * 1.2 * a], p1 = [(hash(b + 1) - 0.5) * 2 * a, (hash(b + 4) - 0.5) * 1.2 * a];
    return [lerp(p0[0], p1[0], e), lerp(p0[1], p1[1], e)];
  }
  function sceneRiso(ctx, T) {
    bg(ctx, C.paper);
    ctx.save(); ctx.globalCompositeOperation = 'multiply';
    // halftone sun, its screen slowly turning (moiré)
    const sunS = backOut(lin(T, 6.35, 6.9), 1.4);
    if (sunS > 0) halftone(ctx, C.verm, 0.26 + (T - 6) * 0.05, 22, (x, y) => { const d = Math.hypot(x - 1380, y - 360); return d < 330 * sunS ? 0.25 + 0.75 * ((x - 1050) / 660) : 0; });
    // blue plate slides in from the left, red plate from the right
    const eb = expoOut(lin(T, 6.25, 6.85)), er = expoOut(lin(T, 6.45, 7.05));
    const [ox, oy] = risoOffset(T);
    const dxB = (1 - eb) * -1400, dxR = (1 - er) * 1400 + ox;
    fill(ctx, RISO.A.map((d) => ({ ...d, x: d.x + dxB - 6, y: d.y - 6 })), C.blue);
    const R = RISO.A.map((d) => ({ x: d.x + dxR, y: d.y + oy, r: d.r }));
    halftone(ctx, C.verm, 1.31 - (T - 6) * 0.03, 9, (x, y) => {
      for (const d of R) { const dx = x - d.x; if (dx > d.r || dx < -d.r) continue; const q = Math.hypot(dx, y - d.y); if (q < d.r) return 1 - q / d.r * 0.5; }
      return 0;
    });
    // test strip + "No.02"
    const sw = [C.verm, C.blue, '#7a3a8f'];
    const ea = smooth(lin(T, 7.0, 7.3));
    sw.forEach((c, i) => { ctx.globalAlpha = ea; ctx.fillStyle = c; ctx.fillRect(140 + i * 46, 900, 40, 40); });
    ctx.globalAlpha = 1;
    ctx.font = '400 120px "Punctum Moderne"'; ctx.fillStyle = C.verm; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('No.02'.slice(0, Math.floor(clamp((T - 6.6) / 0.0625, 0, 5))), 140 + ox * 0.5, 250);
    ctx.restore();
    ctx.font = '500 18px "Punctum Moderne"'; ctx.fillStyle = '#2a2730'; ctx.globalAlpha = ea; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('RISO · 2 COLOUR · FLUO RED / MEDIUM BLUE · 600 DPI', 300, 920); ctx.globalAlpha = 1;
    // the register snap: a registration mark punches in at 8.0
    const sr = since(T, 8.0);
    if (sr < 0.5) {
      ctx.strokeStyle = `rgba(42,39,48,${1 - sr * 2})`; ctx.lineWidth = 3;
      reg(ctx, 1380, 360, 60 + sr * 500);
    }
  }
  function sceneIris(ctx, T) {
    // inside the bulb: amber, then a circular window onto the print
    const R = lerp(0, 1250, Math.pow(cubicIO(lin(T, 6.0, 6.6)), 1.3));
    if (R < 1240) {
      bg(ctx, '#FFB347');
      const g = ctx.createRadialGradient(CX, CY, 0, CX, CY, 1100); g.addColorStop(0, '#FFF6E0'); g.addColorStop(0.5, '#FFC468'); g.addColorStop(1, '#C26A1C');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      zoomStreaks(ctx, 1 - lin(T, 6.0, 6.6), [255, 255, 255], R * 0.9);
    }
    ctx.save(); ctx.beginPath(); ctx.arc(CX, CY, Math.max(R, 1), 0, TAU); ctx.clip();
    sceneRiso(ctx, T);
    ctx.restore();
    if (R > 1 && R < 1240) glow(ctx, (x) => { x.strokeStyle = '#FFE2A8'; x.lineWidth = 12; x.beginPath(); x.arc(CX, CY, R, 0, TAU); x.stroke(); }, 18, 1);
  }

  // ======================================================================
  // SC 06  SPLIT-FLAP
  // ======================================================================
  const FLAPCH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const FL = (() => {
    const rows = ['PUNCTUM ', 'MODERNE ', 'DIDONE  '];
    const tw = 168, th = 232, gap = 16;
    const x0 = (W - (8 * tw + 7 * gap)) / 2, y0 = 150;
    const tiles = [];
    rows.forEach((s, r) => {
      for (let i = 0; i < 8; i++) {
        const target = s[i];
        const n = target === ' ' ? 3 : 5 + Math.floor(hash(r * 8 + i) * 4);
        const seq = [];
        for (let k = 0; k < n; k++) seq.push(FLAPCH[Math.floor(hash(r * 31 + i * 7 + k * 3.3) * FLAPCH.length)]);
        seq.push(target);
        tiles.push({ x: x0 + i * (tw + gap), y: y0 + r * (th + gap), seq, t0: 10.0 + i * 0.0625 + r * 0.125, r, i });
      }
    });
    return { tiles, tw, th, x0, y0, gap, FLIP: 1 / 16 };
  })();
  function flapTile(ctx, x, y, w, h, ch, flip, nextCh) {
    const rr = 12;
    ctx.fillStyle = '#1b1b1e'; ctx.beginPath(); ctx.roundRect(x, y, w, h, rr); ctx.fill();
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(255,255,255,0.06)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(0,0,0,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x, y, w, h, rr); ctx.fill();
    const p = w / 10.5;
    const glyph = (c, top, bot) => {
      if (!c || c === ' ') return;
      ctx.save(); ctx.beginPath(); ctx.rect(x, top, w, bot - top); ctx.clip();
      fill(ctx, place(c, x + w / 2, y + h / 2 + 4.5 * p, p, { w: 600 }), C.paper); ctx.restore();
    };
    if (!flip) glyph(ch, y, y + h);
    else {
      glyph(nextCh, y, y + h / 2); glyph(ch, y + h / 2, y + h);
      const k = Math.cos(flip * Math.PI), hh = Math.abs(k) * h / 2;
      const fy = k > 0 ? y + h / 2 - hh : y + h / 2;
      ctx.fillStyle = k > 0 ? '#25252a' : '#1e1e22';
      ctx.beginPath(); ctx.roundRect(x, fy, w, Math.max(hh, 0.5), 8); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.rect(x, fy, w, hh); ctx.clip();
      ctx.translate(0, y + h / 2); ctx.scale(1, k); ctx.translate(0, -(y + h / 2));
      const c2 = k > 0 ? ch : nextCh;
      if (c2 && c2 !== ' ') fill(ctx, place(c2, x + w / 2, y + h / 2 + 4.5 * p, p, { w: 600 }), C.paper);
      ctx.restore();
      ctx.fillStyle = `rgba(255,179,71,${0.4 * Math.sin(flip * Math.PI)})`; ctx.fillRect(x, k > 0 ? fy : fy + hh - 3, w, 3);
    }
    ctx.fillStyle = '#050506'; ctx.fillRect(x, y + h / 2 - 2, w, 4);
    ctx.fillStyle = '#2b2b30'; ctx.fillRect(x - 6, y + h / 2 - 7, 8, 14); ctx.fillRect(x + w - 2, y + h / 2 - 7, 8, 14);
  }
  function sceneFlap(ctx, T) {
    bg(ctx, C.flap);
    const s = 1 + 0.05 * smooth(lin(T, 10, 12));
    ctx.save(); ctx.translate(CX, CY); ctx.scale(s, s); ctx.rotate(-0.012 * smooth(lin(T, 10, 12))); ctx.translate(-CX, -CY);
    for (const tl of FL.tiles) {
      const u = (T - tl.t0) / FL.FLIP;
      const n = tl.seq.length;
      let ch, flip = 0, next = null;
      if (u < 0) ch = ' ';
      else if (u >= n) ch = tl.seq[n - 1];
      else { const k = Math.floor(u); ch = k === 0 ? ' ' : tl.seq[k - 1]; next = tl.seq[k]; flip = u - k; }
      flapTile(ctx, tl.x, tl.y, FL.tw, FL.th, ch, flip, next);
    }
    if (beatIdx(T) % 2 === 0) { ctx.fillStyle = C.amber; ctx.font = '500 20px "Punctum Moderne"'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('● NOW BOARDING', FL.x0, FL.y0 + 3 * (FL.th + FL.gap) + 22); }
    ctx.restore();
    vignette(ctx, 0.5);
  }

  // ======================================================================
  // SC 07  DOT-MATRIX PRINTER
  // ======================================================================
  const PR = (() => {
    const lines = ['PUNCTUM MODERNE  v2.2', 'Aa Bb Cc Dd Ee Ff Gg', 'Hh Ii Jj Kk Ll Mm Nn', '0123456789 !?&@#', 'wght 100-900  CNTR  opsz', 'The dot is a signal.', '>>>>>>>>>>>>>>>>>>>>', 'RETRO SIGNAL / MODERN TYPE'];
    const LH = 120, p = 5.2, pw = 1260, px = (W - pw) / 2;
    return { lines, LH, p, pw, px, t0: 12.0, per: 0.25 };
  })();
  function printerDraw(ctx, T, feedExtra = 0) {
    const { lines, LH, p, pw, px, t0, per } = PR;
    const tl = T - t0;
    const li = Math.floor(tl / per);
    // paper advances one line at the end of each line (a fast line feed)
    let feed = 0;
    for (let i = 0; i <= Math.min(li, lines.length); i++) feed += smooth(clamp((tl - (i * per + per * 0.82)) / (per * 0.18)));
    const scroll = feed * LH + feedExtra;
    const baseY = 520;                      // where the current line prints
    ctx.save(); ctx.translate(CX, CY); ctx.rotate(-0.12 + 0.01 * Math.sin(T * 9)); ctx.translate(-CX, -CY);
    ctx.fillStyle = '#F2F0E8'; ctx.fillRect(px, -600, pw, H + 1200);
    const off = scroll % (2 * 96);
    for (let y = -600 - off, k = 0; y < H + 600; y += 96, k++) if (k % 2 === 0) { ctx.fillStyle = C.green; ctx.fillRect(px + 70, y, pw - 140, 96); }
    ctx.fillStyle = C.ink;
    const hoff = scroll % 42;
    ctx.beginPath(); for (let y = -590 - hoff; y < H + 600; y += 42) for (const x of [px + 34, px + pw - 34]) { ctx.moveTo(x + 10, y); ctx.arc(x, y, 10, 0, TAU); } ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 1.5; ctx.lineDashOffset = -scroll;
    for (const x of [px + 66, px + pw - 66]) { ctx.beginPath(); ctx.moveTo(x, -600); ctx.lineTo(x, H + 600); ctx.stroke(); }
    ctx.setLineDash([]);
    let headX = null, headY = baseY;
    for (let i = 0; i < lines.length; i++) {
      const y = baseY + (i - feed) * LH;
      if (y < -200 || y > H + 300) continue;
      const pr = clamp((tl - i * per) / (per * 0.8));
      if (pr <= 0) continue;
      const ds = place(lines[i], px + 120, y, p, { w: 600, align: 'l' });
      const xMax = px + 120 + pr * (pw - 260);
      fill(ctx, pr >= 1 ? ds : ds.filter((d) => d.x < xMax), '#1d1b22');
      if (pr < 1) { headX = xMax; headY = y; }
    }
    if (headX != null) {
      ctx.fillStyle = 'rgba(30,28,34,0.35)'; ctx.fillRect(headX - 300, headY - 64, 300, 80);
      ctx.fillStyle = '#26242a'; ctx.beginPath(); ctx.roundRect(headX + 6, headY - 92, 120, 132, 10); ctx.fill();
      ctx.fillStyle = C.verm; ctx.fillRect(headX + 6, headY - 26, 120, 5);
    }
    ctx.restore();
  }
  function scenePrinter(ctx, T) {
    bg(ctx, C.ink);
    const shake = T > 13.72 ? 14 * Math.exp(-(T - 13.72) * 25) : 0;
    ctx.save(); ctx.translate((hash(Math.round(T * 60)) - 0.5) * shake, (hash(Math.round(T * 60) + 5) - 0.5) * shake);
    printerDraw(ctx, T);
    ctx.restore();
    // vertical feed streaks
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.16;
    for (let i = 0; i < 40; i++) { ctx.fillStyle = '#fff'; ctx.fillRect(330 + hash(i) * 1260, ((hash(i + 2) * H - T * 2600) % H + H) % H, 2, 120 + hash(i + 3) * 300); }
    ctx.restore();
    vignette(ctx, 0.5);
  }

  // ======================================================================
  // SC 08  WGHT PUMP
  // ======================================================================
  function scenePump(ctx, T) {
    const ws = [100, 400, 700, 900], sw = W / 4;
    const k = kick(T, 7);
    const b = beatIdx(T);
    const ex = expoIn(lin(T, 15.5, 16.0));        // explode into z
    bg(ctx, C.ink);
    ws.forEach((w0, i) => {
      const t0 = 14 + i * 0.0625;
      const drop = expoOut(lin(T, t0, t0 + 0.18));
      if (drop <= 0) return;
      const inv = (i + b) % 2 === 1;
      const w = Math.min(900, w0 + 260 * k);
      ctx.save(); ctx.beginPath(); ctx.rect(i * sw, 0, sw, H); ctx.clip();
      ctx.translate(0, (1 - drop) * -H);
      bg(ctx, ex > 0 ? C.ink : inv ? C.paper : C.ink);
      let ds = place('a', i * sw + sw / 2, 760, 62 * (1 + 0.06 * k), { w });
      if (ex > 0) ds = ds.map((d, j) => { const s = 1 + ex * (3 + 4 * hash(j + i * 50)); return { x: CX + (d.x - CX) * s, y: CY + (d.y - CY) * s, r: d.r * (1 + ex * 3) }; });
      fill(ctx, ds, ex > 0 ? C.verm : inv ? C.ink : (i === 3 ? C.verm : C.paper));
      if (ex <= 0) { ctx.font = '500 22px "Punctum Moderne"'; ctx.fillStyle = inv ? C.ink : C.paper; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(`wght ${Math.round(w)}`, i * sw + 40, 990); }
      ctx.restore();
    });
  }

  // ======================================================================
  // SC 09  Z-TUNNEL
  // ======================================================================
  function sceneTunnel(ctx, T, squash = 1) {
    bg(ctx, C.ink);
    const t = T - S.TUN;
    const cx = CX + 50 * Math.sin(t * 1.7), cy = CY - 20 + 30 * Math.cos(t * 1.3);
    const morph = 0.5 + 0.5 * Math.cos((T % BEAT) / BEAT * TAU);   // CNTR: square ↔ round, once a beat
    ctx.save(); ctx.translate(CX, CY); ctx.scale(1, squash); ctx.translate(-CX, -CY);
    const NZ = 40, speed = 9 + 10 * t;
    for (let k = NZ; k >= 0; k--) {
      let z = ((k - (t * speed) % 1 - Math.floor(t * speed)) % NZ + NZ) % NZ + 0.3;
      const zz = z * 0.55, R = 1500 / zz, n = 56, tt = z / NZ;
      const col = `rgb(${lerp(255, 185, tt) | 0},${lerp(75, 164, tt) | 0},${lerp(43, 232, tt) | 0})`;
      ctx.fillStyle = col; ctx.globalAlpha = clamp(1.6 - tt * 1.4) * clamp(z * 1.2);
      const twist = (k + Math.floor(t * speed)) * 0.07 + t * 0.6;
      ctx.beginPath();
      for (let j = 0; j < n; j++) {
        const a = j / n * TAU + twist, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R * 0.92;
        const r = Math.max(0.8, 28 / zz * (0.5 + 0.5 * (((j + k) % 3) === 0)));
        const cr = r * lerp(0.15, 1, morph);
        ctx.roundRect(x - r, y - r, 2 * r, 2 * r, cr);
      }
      ctx.fill();
      if (z < 5) {
        ctx.strokeStyle = col; ctx.globalAlpha = 0.25; ctx.lineWidth = 2; ctx.beginPath();
        for (let j = 0; j < n; j += 2) { const a = j / n * TAU + twist; ctx.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R * 0.92); ctx.lineTo(cx + Math.cos(a) * R * 1.4, cy + Math.sin(a) * R * 1.3); }
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    glow(ctx, (x) => fill(x, place('P', cx, cy + 75, 16 * (1 + 0.15 * kick(T, 8)), { w: 700, c: lerp(0, 100, morph) }), C.paper), 12, 0.8);
    ctx.restore();
  }

  // ======================================================================
  // SC 10  CRT
  // ======================================================================
  const CRTL = [[2.4, '12'], [3.4, '18'], [4.8, '24'], [7, '36'], [10.5, '72'], [16, '144']];
  function crtContent(ctx, T, melt = 0) {
    let y = 230;
    const lines = [];
    CRTL.forEach(([p, lab], i) => {
      y += p * 10;
      const t0 = 18.25 + i * 0.1875;
      const pr = clamp((T - t0) / 0.18);
      if (pr > 0) lines.push({ p, lab, y, pr, f: clamp((18 - p) / 16) });
      y += 30;
    });
    glow(ctx, (x) => {
      for (const L of lines) {
        let ds = place('Punctum', 330, L.y, L.p, { w: 500, f: L.f, align: 'l' });
        const xMax = 330 + L.pr * textW('Punctum', L.p) + 20;
        ds = ds.filter((d) => d.x < xMax);
        // line-sync jitter on 16ths
        const jit = hash(Math.floor(T * 8) * 13 + L.y) > 0.82 ? (hash(L.y + T) - 0.5) * 40 : 0;
        fill(x, ds.map((d) => ({ ...d, x: d.x + jit })), C.phos);
        if (melt > 0) {
          x.save(); x.globalAlpha = 0.6;
          for (const d of ds) { const h = melt * 400 * hash(d.x * 0.37 + d.y); x.fillStyle = C.phos; x.fillRect(d.x - d.r * 0.8, d.y, d.r * 1.6, h); }
          x.restore();
        }
        x.font = '400 18px "Punctum Moderne"'; x.fillStyle = C.phos; x.textAlign = 'right'; x.textBaseline = 'alphabetic'; x.globalAlpha = L.pr; x.fillText(`opsz ${L.lab}`, 1600, L.y); x.globalAlpha = 1;
      }
    }, 6, 0.9);
    // rolling interference band
    const by = 110 + ((T - 18) * 420) % 860;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,176,0,0.07)'; ctx.fillRect(200, by, 1520, 30); ctx.restore();
  }
  function sceneCRT(ctx, T) {
    bg(ctx, '#08070A');
    const x0 = 200, y0 = 110, w = 1520, h = 860;
    const on = backOut(lin(T, 18.0, 18.22), 1.2);
    const melt = smooth(lin(T, 19.55, 20.0));
    ctx.globalAlpha = smooth(lin(T, 18.0, 18.3));
    ctx.strokeStyle = '#1d1a17'; ctx.lineWidth = 26; ctx.beginPath(); ctx.roundRect(x0 - 13, y0 - 13, w + 26, h + 26, 72); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.beginPath(); ctx.roundRect(x0, y0, w, h, 60); ctx.clip();
    ctx.translate(0, CY); ctx.scale(1, Math.max(0.004, on)); ctx.translate(0, -CY);
    ctx.fillStyle = '#120A02'; ctx.fillRect(x0, y0, w, h);
    crtContent(ctx, T, melt);
    // power-on flash
    const fl = 1 - lin(T, 18.0, 18.35);
    if (fl > 0) { ctx.fillStyle = `rgba(255,240,210,${fl * 0.9})`; ctx.fillRect(x0, y0, w, h); }
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    for (let y = y0; y < y0 + h; y += 4) ctx.fillRect(x0, y, w, 2);
    ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.roundRect(x0, y0, w, h, 60); ctx.clip();
    const g = ctx.createRadialGradient(CX, CY, h * 0.3, CX, CY, h * 0.85); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.75)'); ctx.fillStyle = g; ctx.fillRect(x0, y0, w, h);
    const rf = ctx.createLinearGradient(x0, y0, x0 + w * 0.4, y0 + h * 0.5); rf.addColorStop(0, 'rgba(255,255,255,0.07)'); rf.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = rf; ctx.fillRect(x0, y0, w, h);
    ctx.restore();
  }

  // ======================================================================
  // SC 11  PIXEL SORT
  // ======================================================================
  const WM = place('Punctum Moderne', CX, 470, 16, { w: 600 });
  function sceneSort(ctx, T) {
    bg(ctx, C.ink);
    const g0 = smooth(lin(T, 20.0, 21.3));
    const k16 = Math.floor(T * 8);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const d of WM) {
      const k = hash(d.col * 13.1 + d.row * 7.7);
      if (k < 0.5) continue;
      const len = (60 + 560 * Math.pow(k, 3)) * g0 * (0.85 + 0.3 * hash(k16 + d.col));
      if (len < 2) continue;
      const g = ctx.createLinearGradient(0, d.y, 0, d.y + len);
      const col = k > 0.9 ? '255,75,43' : '185,164,232';
      g.addColorStop(0, `rgba(${col},0.75)`); g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g; ctx.fillRect(d.x - d.r, d.y, d.r * 2, len);
    }
    const sp = 5 + 9 * hash(k16) * g0;
    ctx.globalAlpha = 0.85;
    fill(ctx, WM.map((d) => ({ ...d, x: d.x - sp })), 'rgb(255,60,40)');
    fill(ctx, WM.map((d) => ({ ...d, x: d.x + sp })), 'rgb(60,90,255)');
    ctx.globalAlpha = 1;
    fill(ctx, WM, '#d8d2f0');
    ctx.restore();
    // slice displacement, re-rolled every 8th
    const k8 = Math.floor(T * 4);
    const [c, x] = buf('slice'); x.drawImage(ctx.canvas, 0, 0);
    for (let s = 0; s < 4; s++) {
      const y = 330 + hash(k8 * 7 + s) * 240, h = 6 + hash(k8 * 3 + s) * 26, dx = (hash(k8 * 5 + s) - 0.5) * 200 * (0.4 + g0);
      ctx.drawImage(c, 0, y, W, h, dx, y, W, h);
    }
  }

  // ======================================================================
  // SC 12  THE DROP — the wordmark in every medium
  // ======================================================================
  const DROPMEDIA = [
    (c, T) => { bg(c, C.warm); const step = Math.floor(T / 0.125); for (const d of place('Punctum Moderne', CX, 590, 17, { w: 500 })) bulb(c, d.x, d.y, Math.max(3.5, d.r), (d.col + step) % 4 === 0 ? 0 : 1); },
    (c) => { bg(c, C.paper); c.save(); c.globalCompositeOperation = 'multiply'; fill(c, place('Punctum Moderne', CX - 6, 584, 17, { w: 700 }), C.blue); fill(c, place('Punctum Moderne', CX + 6, 594, 17, { w: 700 }), C.verm); c.restore(); },
    (c) => { bg(c, C.flap); fill(c, place('Punctum Moderne', CX, 590, 17, { w: 600 }), C.paper); c.fillStyle = '#050506'; c.fillRect(0, 503, W, 4); },
    (c) => { bg(c, C.green); fill(c, place('Punctum Moderne', CX, 590, 17, { w: 600 }), '#1d1b22'); },
    (c) => { bg(c, '#120A02'); glow(c, (x) => fill(x, place('Punctum Moderne', CX, 590, 17, { w: 500 }), C.phos), 5, 0.9); c.fillStyle = 'rgba(0,0,0,0.4)'; for (let y = 0; y < H; y += 4) c.fillRect(0, y, W, 2); },
    (c) => { bg(c, C.ink); glow(c, (x) => fill(x, place('Punctum Moderne', CX, 590, 17, { w: 500 }), C.violet), 10, 1); },
  ];
  const DROPCUTS = (() => {
    const cuts = [];
    for (let t = 22.0; t < 23.0 - 1e-6; t += 0.5) cuts.push(t);
    for (let t = 23.0; t < 23.5 - 1e-6; t += 0.25) cuts.push(t);
    for (let t = 23.5; t < 23.75 - 1e-6; t += 0.125) cuts.push(t);
    return cuts;
  })();
  function sceneDrop(ctx, T) {
    if (T < 23.75) {
      let ci = 0; for (let i = 0; i < DROPCUTS.length; i++) if (T >= DROPCUTS[i]) ci = i;
      const s = 1 + 0.09 * Math.exp(-(T - DROPCUTS[ci]) * 14);
      ctx.save(); ctx.translate(CX, CY); ctx.scale(s, s); ctx.translate(-CX, -CY);
      DROPMEDIA[ci % DROPMEDIA.length](ctx, T);
      ctx.restore();
      return;
    }
    // slit collage: six strips slam in, then close to the centre at 24.0
    const sw = W / 6;
    bg(ctx, C.ink);
    const close = expoIn(lin(T, 23.88, 24.0));
    DROPMEDIA.forEach((m, i) => {
      const e = expoOut(lin(T, 23.75 + i * 0.015, 23.86 + i * 0.015));
      const dy = (1 - e) * (i % 2 ? H : -H);
      const x0 = lerp(i * sw, CX - 4 + i * 1.3, close), w = lerp(sw, 2, close);
      ctx.save(); ctx.beginPath(); ctx.rect(x0, 0, w + 1, H); ctx.clip(); ctx.translate(0, dy); m(ctx, T); ctx.restore();
    });
    ctx.fillStyle = C.verm; for (let i = 1; i < 6; i++) ctx.fillRect(lerp(i * sw, CX, close) - 1, 0, 2, H);
  }

  // ======================================================================
  // SC 13–14  LOCK → END
  // ======================================================================
  const TAG = 'Retro signal. Modern type.';
  function sceneLock(ctx, T) {
    bg(ctx, C.ink);
    const t = T - S.LOCK;
    // the wordmark rides from centre-lock to its end position
    const eEnd = cubicIO(lin(T, 26.0, 26.6));
    const p = lerp(15, 12.5, eEnd), y = lerp(600, 520, eEnd);
    const s = lerp(1.22, 1, backOut(lin(T, 24.0, 24.42), 2.2));
    const fade = 1 - smooth(lin(T, 29.55, 29.95));
    const halo = 0.18 * (1 - eEnd * 0.6) + 0.12 * kick(T, 6) * (T < 26 ? 1 : 0);
    const g = ctx.createRadialGradient(CX, y - 45, 0, CX, y - 45, 760); g.addColorStop(0, `rgba(185,164,232,${halo * fade})`); g.addColorStop(1, 'rgba(185,164,232,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // shockwave rings of dots
    for (let k = 0; k < 3; k++) {
      const a = t - k * 0.09; if (a < 0 || a > 1.4) continue;
      const R = 300 + a * 1300, al = 0.55 * (1 - a / 1.4), n = 90 + k * 30;
      ctx.fillStyle = `rgba(185,164,232,${al})`; ctx.beginPath();
      for (let j = 0; j < n; j++) { const th = j / n * TAU; const x = CX + Math.cos(th) * R, yy = CY + Math.sin(th) * R * 0.62; ctx.moveTo(x + 3, yy); ctx.arc(x, yy, 3 - k * 0.6, 0, TAU); }
      ctx.fill();
    }
    let ds = place('Punctum Moderne', CX, y, p, { w: 500 });
    // dots settle in, a few frames apart, from where the collage left them
    ds = ds.map((d, j) => { const st = expoOut(lin(T, 24.0 + (d.col % 7) * 0.012, 24.28 + (d.col % 7) * 0.012)); const ox = (hash(j) - 0.5) * 140 * (1 - st), oy = (hash(j + 7) - 0.5) * 90 * (1 - st); return { ...d, x: CX + (d.x - CX) * s + ox, y: CY + (d.y - CY) * s + oy, r: d.r * s }; });
    const col = eEnd > 0 ? C.paper : '#F4F1FF';
    ctx.globalAlpha = fade;
    if (eEnd < 1) glow(ctx, (x) => fill(x, ds, col), 9, 0.7 * (1 - eEnd));
    else fill(ctx, ds, col);
    // tagline types in on 32nds; the cursor dot keeps time
    if (T >= 26.5) {
      const n = clamp(Math.floor((T - 26.5) / 0.0625), 0, TAG.length);
      ctx.font = '400 30px "Punctum Moderne"'; ctx.fillStyle = C.paper; ctx.textBaseline = 'alphabetic';
      try { ctx.letterSpacing = '1px'; } catch (e) { /* */ }
      const full = ctx.measureText(TAG).width;
      const sub = TAG.slice(0, n), sw = ctx.measureText(sub).width;
      ctx.textAlign = 'left'; ctx.globalAlpha = 0.92 * fade; ctx.fillText(sub, CX - full / 2, 620);
      const typing = n < TAG.length;
      const blinkOn = typing || ((T % BEAT) < BEAT * 0.55 && T < 29.5);
      if (blinkOn) { ctx.globalAlpha = 1; ctx.fillStyle = C.verm; ctx.beginPath(); ctx.arc(CX - full / 2 + sw + 16, 610, 8, 0, TAU); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    // the white lock flash
    const fl = 1 - lin(T, 24.0, 24.3);
    if (fl > 0) { ctx.fillStyle = `rgba(255,255,255,${0.85 * fl * fl})`; ctx.fillRect(0, 0, W, H); }
  }

  // ======================================================================
  // master
  // ======================================================================
  function draw(ctx, T) {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
    let hudCol = C.paper, hudA = 0.78, grainA = 0.06;
    if (T < S.MARQ) { sceneSignal(ctx, T); flyDot(ctx, T); }
    else if (T < S.RISO) { sceneMarquee(ctx, T); hudCol = C.amber; }
    else if (T < 6.6) { sceneIris(ctx, T); hudCol = '#2a2730'; }
    else if (T < 9.5) { sceneRiso(ctx, T); hudCol = '#2a2730'; grainA = 0.1; }
    else if (T < S.FLAP + 1.6) {
      // flip-tile wipe riso → flap (9.5–10.25), then the board
      if (T < 10.3) tileWipe(ctx, T, (c) => sceneRiso(c, T), (c) => sceneFlap(c, T), 9.5);
      else sceneFlap(ctx, T);
      hudCol = T < 10.0 ? '#2a2730' : C.paper;
    } else if (T < S.PRINT + 0.05 && T >= 11.6) {
      // paper feed wipe: the printer rises over the board
      const e = expoIO(lin(T, 11.6, 12.0));
      sceneFlap(ctx, T);
      const [c, x] = buf('wipe'); printerScene(x, T, (1 - e) * 2200);
      ctx.save(); ctx.translate(0, (1 - e) * H); ctx.drawImage(c, 0, 0); ctx.restore();
    }
    else if (T < S.PUMP) scenePrinter(ctx, T);
    else if (T < S.TUN) { scenePump(ctx, T); hudCol = C.verm; }
    else if (T < S.CRT) {
      const sq = 1 - expoIn(lin(T, 17.55, 18.0)) * 0.996;
      sceneTunnel(ctx, T, sq);
      if (T > 17.7) { const a = lin(T, 17.7, 18.0); ctx.fillStyle = `rgba(255,240,210,${a})`; ctx.fillRect(0, CY - 2 - 3 * a, W, 4 + 6 * a); }
    } else if (T < S.SORT) { sceneCRT(ctx, T); hudCol = C.phos; }
    else if (T < S.DROP) {
      sceneSort(ctx, T);
      // the break: strobe-freeze before the drop
      if (T >= 21.5) { const k = Math.floor((T - 21.5) / 0.0625); if (k % 2 === 1) { ctx.globalCompositeOperation = 'difference'; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; } if (T > 21.8) { ctx.fillStyle = `rgba(0,0,0,${lin(T, 21.8, 22.0)})`; ctx.fillRect(0, 0, W, H); } }
    } else if (T < S.LOCK) { sceneDrop(ctx, T); grainA = 0.08; }
    else { sceneLock(ctx, T); hudCol = C.violet; hudA = 0.78 * (1 - smooth(lin(T, 29.4, 29.8))); }
    // energy: a whisper of light on every kick in the busy middle
    if (T > 4 && T < 24) { const k = kick(T, 12); ctx.fillStyle = `rgba(255,255,255,${0.035 * k})`; ctx.fillRect(0, 0, W, H); }
    grain(ctx, T, grainA);
    hud(ctx, T, hudCol, hudA * (T < 0.1 ? T / 0.1 : 1));
    if (T > 29.85) { ctx.fillStyle = `rgba(11,10,13,${lin(T, 29.85, 30)})`; ctx.fillRect(0, 0, W, H); }
  }
  function printerScene(ctx, T, extra) {
    bg(ctx, C.ink);
    printerDraw(ctx, Math.max(T, 12.0), extra);
    vignette(ctx, 0.5);
  }
  function tileWipe(ctx, T, fa, fb, t0) {
    const [ca, xa] = buf('wa'); fa(xa);
    const [cb, xb] = buf('wb'); fb(xb);
    bg(ctx, C.flap);
    const nx = 12, ny = 7, tw = W / nx, th = H / ny;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const d = t0 + (i + j) * 0.028, u = clamp((T - d) / 0.16);
      const x = i * tw, y = j * th;
      const src = u < 0.5 ? ca : cb, sy = Math.abs(Math.cos(u * Math.PI));
      if (sy < 0.01) continue;
      ctx.drawImage(src, x, y, tw, th, x, y + th / 2 * (1 - sy), tw, th * sy);
      if (u > 0 && u < 1) { ctx.fillStyle = `rgba(255,179,71,${0.35 * Math.sin(u * Math.PI)})`; ctx.fillRect(x, y + th / 2 * (1 - sy), tw, 3); }
    }
  }

  // ------------------------------------------------------------ events for the score
  function events() {
    return {
      bpm: 120, end: END, S,
      morse: MORSE.els.map((e) => ({ t: e.t, dur: e.dur, dash: e.dash })), morseEnd: MORSE.tEnd,
      flaps: FL.tiles.flatMap((tl) => tl.seq.map((_, k) => tl.t0 + k * FL.FLIP)).sort((a, b) => a - b),
      printLines: PR.lines.map((_, i) => ({ t: PR.t0 + i * PR.per, dur: PR.per * 0.8, feed: PR.t0 + i * PR.per + PR.per * 0.82 })),
      dropCuts: DROPCUTS, risoSnap: 8.0, lock: 24.0,
      type: Array.from({ length: TAG.length }, (_, i) => 26.5 + i * 0.0625),
      cursorOff: 29.5,
    };
  }

  return { W, H, draw, events, S };
});
