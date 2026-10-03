/* PUNCTUM // SIGNAL — storyboard keyframes, drawn with the real glyph dots.
 * KEYS[i].draw(ctx) paints one 1920×1080 key pose. The film engine grows out
 * of these same scene functions. */
(function (root) {
  'use strict';
  const G = root.PM_GLYPHS;
  const W = 1920, H = 1080, TAU = Math.PI * 2;
  const C = {
    ink: '#0B0A0D', paper: '#EEEBE3', violet: '#B9A4E8', verm: '#FF4B2B', amber: '#FFB347',
    blue: '#2F55FF', green: '#D8E9D6', phos: '#FFB000',
  };
  // ---- radius model (src/radii.py)
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
  function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
  function layout(text) {
    const out = []; let x = 0;
    for (let i = 0; i < text.length; i++) {
      const g = G[text[i]]; if (!g) continue;
      for (const [gx, gy, t] of g.d) out.push({ col: x + gx, row: gy, tone: t, ci: i });
      x += g.w + 1;
    }
    return { dots: out, width: Math.max(0, x - 1) };
  }
  /** dots of `text` placed with its baseline at y; align: 'c' | 'l' | 'r'. */
  function place(text, x, y, p, o = {}) {
    const L = layout(text), w = o.w || 500, c = o.c == null ? 100 : o.c, f = o.f || 0;
    const x0 = o.align === 'l' ? x : o.align === 'r' ? x - (L.width - 1) * p : x - (L.width - 1) * p / 2;
    return L.dots.map((d) => ({ x: x0 + d.col * p, y: y - d.row * p, r: rad(d.tone, w, c, f) * p, tone: d.tone, col: d.col, row: d.row, ci: d.ci }));
  }
  function fill(ctx, ds, color, k = 1) {
    ctx.fillStyle = color; ctx.beginPath();
    for (const d of ds) { ctx.moveTo(d.x + d.r * k, d.y); ctx.arc(d.x, d.y, d.r * k, 0, TAU); }
    ctx.fill();
  }
  const off = (() => { let c; return () => { if (!c) { c = document.createElement('canvas'); c.width = W; c.height = H; } const x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.filter = 'none'; x.clearRect(0, 0, W, H); return [c, x]; }; })();
  /** draw something, then add a blurred copy of it on top ('lighter'). */
  function glow(ctx, fn, blur, a = 1) {
    fn(ctx);
    const [c, x] = off(); fn(x);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; ctx.filter = `blur(${blur}px)`; ctx.drawImage(c, 0, 0);
    ctx.filter = `blur(${blur * 3.5}px)`; ctx.globalAlpha = a * 0.6; ctx.drawImage(c, 0, 0); ctx.restore();
  }
  function bg(ctx, col) { ctx.fillStyle = col; ctx.fillRect(0, 0, W, H); }
  function grain(ctx, amt = 0.05, seed = 1, light = true) {
    ctx.save(); ctx.globalAlpha = amt; ctx.fillStyle = light ? '#fff' : '#000';
    for (let i = 0; i < 9000; i++) { const x = hash(i * 1.37 + seed) * W, y = hash(i * 2.71 + seed * 3) * H; ctx.fillRect(x, y, 1.4, 1.4); }
    ctx.restore();
  }
  function vignette(ctx, a = 0.55) {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${a})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  // ---- HUD: print registration marks + signal readouts (a motif through the film)
  function reg(ctx, x, y, s, col) {
    ctx.strokeStyle = col; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, s * 0.55, 0, TAU); ctx.moveTo(x - s, y); ctx.lineTo(x + s, y); ctx.moveTo(x, y - s); ctx.lineTo(x, y + s); ctx.stroke();
  }
  function hud(ctx, col, sc, tc, extra) {
    ctx.save();
    ctx.globalAlpha = 0.75;
    for (const [x, y] of [[64, 64], [W - 64, 64], [64, H - 64], [W - 64, H - 64]]) reg(ctx, x, y, 14, col);
    ctx.font = '500 17px "Punctum Moderne"'; ctx.fillStyle = col; ctx.textBaseline = 'middle';
    ctx.letterSpacing = '2px';
    ctx.textAlign = 'left'; ctx.fillText('PUNCTUM // SIGNAL', 104, 64); ctx.fillText(sc, 104, H - 64);
    ctx.textAlign = 'right'; ctx.fillText(tc, W - 104, 64); ctx.fillText(extra || '120 BPM', W - 104, H - 64);
    ctx.restore();
  }

  // ======================================================================
  const KEYS = [];
  const key = (t, name, draw) => KEYS.push({ t, name, draw });

  // 1 · SIGNAL — one dot, pulsing on the kick
  key('0:00', 'SIGNAL', (ctx) => {
    bg(ctx, C.ink);
    ctx.fillStyle = 'rgba(238,235,227,0.07)';
    for (let x = 30; x < W; x += 40) for (let y = 20; y < H; y += 40) { ctx.beginPath(); ctx.arc(x, y, 1.3, 0, TAU); ctx.fill(); }
    for (const [r, a, w] of [[86, 0.55, 3], [170, 0.28, 2], [300, 0.12, 1.5], [470, 0.05, 1]]) {
      ctx.strokeStyle = `rgba(185,164,232,${a})`; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(W / 2, H / 2, r, 0, TAU); ctx.stroke();
    }
    glow(ctx, (x) => { x.fillStyle = C.violet; x.beginPath(); x.arc(W / 2, H / 2, 34, 0, TAU); x.fill(); }, 18, 0.9);
    ctx.fillStyle = C.paper;
    for (let i = 0; i < 4; i++) { ctx.globalAlpha = i === 0 ? 1 : 0.22; ctx.fillRect(W / 2 - 66 + i * 36, 860, 24, 6); }
    ctx.globalAlpha = 1;
    hud(ctx, C.paper, 'SC 01 — SIGNAL', '00:00:00');
  });

  // 2 · MORSE — the dot repeats into code and whips across the frame
  key('0:02', 'MORSE', (ctx) => {
    bg(ctx, C.ink);
    const code = '.--. ..- -. -.-. - ..- --';  // P U N C T U M
    // speed lines
    for (let i = 0; i < 70; i++) {
      const y = 140 + hash(i) * 800, x = hash(i + 9) * W, l = 200 + hash(i + 3) * 900;
      const g = ctx.createLinearGradient(x, 0, x + l, 0); g.addColorStop(0, 'rgba(238,235,227,0)'); g.addColorStop(1, `rgba(238,235,227,${0.05 + 0.12 * hash(i + 5)})`);
      ctx.fillStyle = g; ctx.fillRect(x, y, l, 1 + 2 * hash(i + 7));
    }
    // perforated Wheatstone tape
    ctx.save(); ctx.translate(W / 2, 640); ctx.rotate(-0.06);
    ctx.fillStyle = C.paper; ctx.fillRect(-1100, -70, 2200, 140);
    ctx.fillStyle = C.ink;
    for (let x = -1080; x < 1100; x += 26) { ctx.beginPath(); ctx.arc(x, 0, 5, 0, TAU); ctx.fill(); }
    let cx = -900;
    for (const ch of code) {
      if (ch === ' ') { cx += 52; continue; }
      ctx.beginPath(); ctx.arc(cx, ch === '.' ? -34 : 34, 15, 0, TAU); if (ch === '-') ctx.arc(cx + 26, 34, 15, 0, TAU); ctx.fill();
      cx += ch === '-' ? 78 : 52;
    }
    ctx.restore();
    // the signal itself: violet dots and dashes with motion trails
    let x = 300;
    const y = 380;
    glow(ctx, (c) => {
      let xx = x;
      for (const ch of code) {
        if (ch === ' ') { xx += 46; continue; }
        const len = ch === '.' ? 0 : 70;
        const tr = c.createLinearGradient(xx - 260, 0, xx, 0); tr.addColorStop(0, 'rgba(185,164,232,0)'); tr.addColorStop(1, 'rgba(185,164,232,0.55)');
        c.fillStyle = tr; c.fillRect(xx - 260, y - 9, 260, 18);
        c.fillStyle = C.violet; c.beginPath(); c.arc(xx, y, 18, 0, TAU); c.fill();
        if (len) { c.fillRect(xx, y - 18, len, 36); c.beginPath(); c.arc(xx + len, y, 18, 0, TAU); c.fill(); }
        xx += len + 58;
      }
    }, 14, 0.8);
    ctx.font = '400 26px "Punctum Moderne"'; ctx.fillStyle = C.paper; ctx.globalAlpha = 0.6; ctx.textAlign = 'left';
    ctx.fillText('P     U     N    C      T   U     M', 300, 300); ctx.globalAlpha = 1;
    hud(ctx, C.paper, 'SC 02 — MORSE / WHIP PAN', '00:00:02:00');
  });

  function bulb(ctx, x, y, r, on, col = [255, 179, 71]) {
    const [R, Gc, B] = col;
    if (on > 0.05) {
      const g = ctx.createRadialGradient(x, y, r * 0.8, x, y, r * 2.6);
      g.addColorStop(0, `rgba(${R},${Gc},${B},${0.7 * on})`); g.addColorStop(1, `rgba(${R},${Gc},${B},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2.6, 0, TAU); ctx.fill();
    }
    const g2 = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, 0, x, y, r);
    if (on > 0.05) { g2.addColorStop(0, '#fffaf0'); g2.addColorStop(0.35, `rgba(255,${200 + 30 * on | 0},120,1)`); g2.addColorStop(1, `rgba(${R},${Gc * 0.75 | 0},${B * 0.5 | 0},1)`); }
    else { g2.addColorStop(0, 'rgba(110,80,50,0.9)'); g2.addColorStop(0.6, 'rgba(48,32,22,1)'); g2.addColorStop(1, 'rgba(20,14,10,1)'); }
    ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = Math.max(1, r * 0.18); ctx.beginPath(); ctx.arc(x, y, r * 1.12, 0, TAU); ctx.stroke();
  }
  function marquee(ctx, s = 1, cx = W / 2, cy = H / 2) {
    ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-W / 2, -H / 2);
    // sign plate
    const pw = 1720, ph = 560, px = (W - pw) / 2, py = 250;
    ctx.fillStyle = '#17120E'; ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = '#3a2c20'; ctx.lineWidth = 4; ctx.strokeRect(px + 16, py + 16, pw - 32, ph - 32);
    // border chase bulbs
    let k = 0;
    const per = [];
    for (let x = px + 40; x <= px + pw - 40; x += 46) { per.push([x, py + 40]); }
    for (let y = py + 86; y <= py + ph - 40; y += 46) per.push([px + pw - 40, y]);
    for (let x = px + pw - 86; x >= px + 40; x -= 46) per.push([x, py + ph - 40]);
    for (let y = py + ph - 86; y >= py + 86; y -= 46) per.push([px + 40, y]);
    for (const [x, y] of per) bulb(ctx, x, y, 10, (k++ % 3) === 0 ? 1 : 0);
    // the letters: every dot is a bulb
    const ds = place('PUNCTUM', W / 2, py + 470, 30, { w: 400 });
    for (const d of ds) {
      const lit = ((d.col + d.row * 2) % 5 !== 2) ? 1 : 0.0;
      bulb(ctx, d.x, d.y, Math.max(6, d.r * 1.05), lit);
    }
    ctx.restore();
  }
  // 3 · MARQUEE — Vegas bulbs, chasing on the beat
  key('0:04', 'MARQUEE', (ctx) => {
    bg(ctx, '#0D0A08');
    marquee(ctx);
    // floor reflection
    ctx.save(); ctx.globalAlpha = 0.16; ctx.translate(0, 2 * 870); ctx.scale(1, -1); ctx.filter = 'blur(6px)';
    marquee(ctx); ctx.restore();
    const g = ctx.createLinearGradient(0, 860, 0, H); g.addColorStop(0, 'rgba(13,10,8,0.2)'); g.addColorStop(1, 'rgba(13,10,8,1)');
    ctx.fillStyle = g; ctx.fillRect(0, 860, W, H - 860);
    vignette(ctx, 0.6);
    hud(ctx, C.amber, 'SC 03 — MARQUEE / CHASE ON 8THS', '00:00:04:00');
  });

  // halftone field helper: dot size from a value function, on a rotated screen
  function halftone(ctx, col, ang, step, valFn, x0 = 0, y0 = 0, w = W, h = H) {
    ctx.fillStyle = col; ctx.beginPath();
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const R = Math.hypot(w, h);
    for (let u = -R; u < R; u += step) for (let v = -R; v < R; v += step) {
      const x = x0 + w / 2 + u * ca - v * sa, y = y0 + h / 2 + u * sa + v * ca;
      if (x < x0 - step || x > x0 + w + step || y < y0 - step || y > y0 + h + step) continue;
      const val = valFn(x, y);
      if (val <= 0.02) continue;
      const r = Math.sqrt(Math.min(1, val)) * step * 0.62;
      ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
    }
    ctx.fill();
  }
  function riso(ctx, x0 = 0, y0 = 0, w = W, h = H) {
    ctx.fillStyle = C.paper; ctx.fillRect(x0, y0, w, h);
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();
    ctx.globalCompositeOperation = 'multiply';
    // big halftone sun, vermilion
    halftone(ctx, C.verm, 0.26, 22, (x, y) => { const d = Math.hypot(x - 1380, y - 360); return d < 330 ? 0.25 + 0.75 * ((x - 1050) / 660) : 0; });
    // "Moderne" — violet-blue layer, then vermilion layer out of register
    const dsA = place('Moderne', W / 2 + 12, 768, 31, { w: 700 });
    const dsB = place('Moderne', W / 2 - 8, 756, 31, { w: 700 });
    fill(ctx, dsB, C.blue);
    halftone(ctx, C.verm, 1.31, 9, (x, y) => { for (const d of dsA) { const q = Math.hypot(x - d.x, y - d.y); if (q < d.r) return 1 - q / d.r * 0.5; } return 0; });
    ctx.restore();
  }
  // 4 · IRIS — the camera dives through one bulb; inside it, print
  key('0:06', 'IRIS DIVE', (ctx) => {
    bg(ctx, '#0D0A08');
    marquee(ctx, 3.2, W / 2 + 330, H / 2 - 240);
    // zoom streaks
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 160; i++) {
      const a = hash(i) * TAU, r0 = 330 + hash(i + 4) * 120, r1 = r0 + 200 + hash(i + 8) * 700;
      ctx.strokeStyle = `rgba(255,179,71,${0.04 + 0.08 * hash(i + 2)})`; ctx.lineWidth = 1 + 3 * hash(i + 6);
      ctx.beginPath(); ctx.moveTo(W / 2 + Math.cos(a) * r0, H / 2 + Math.sin(a) * r0); ctx.lineTo(W / 2 + Math.cos(a) * r1, H / 2 + Math.sin(a) * r1); ctx.stroke();
    }
    ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.arc(W / 2, H / 2, 330, 0, TAU); ctx.clip();
    riso(ctx);
    ctx.restore();
    glow(ctx, (x) => { x.strokeStyle = C.amber; x.lineWidth = 10; x.beginPath(); x.arc(W / 2, H / 2, 334, 0, TAU); x.stroke(); }, 16, 1);
    hud(ctx, C.amber, 'SC 04 — IRIS THROUGH A BULB', '00:00:06:00');
  });

  // 5 · RISO — two-colour halftone overprint, sliding into register
  key('0:08', 'RISO', (ctx) => {
    riso(ctx);
    grain(ctx, 0.06, 5, false);
    ctx.save(); ctx.globalCompositeOperation = 'multiply';
    // colour bars + registration
    const sw = [C.verm, C.blue, '#7a3a8f'];
    sw.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(140 + i * 46, 900, 40, 40); });
    ctx.restore();
    ctx.font = '500 18px "Punctum Moderne"'; ctx.fillStyle = '#2a2730'; ctx.textAlign = 'left';
    ctx.fillText('RISO · 2 COLOUR · FLUO RED / MEDIUM BLUE · 600 DPI', 300, 922);
    ctx.font = '400 120px "Punctum Moderne"'; ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = C.verm; ctx.globalAlpha = 0.9;
    ctx.fillText('No.02', 140, 250); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    hud(ctx, '#2a2730', 'SC 05 — RISOGRAPH / MISREGISTER → REGISTER', '00:00:08:00');
  });

  function flapTile(ctx, x, y, w, h, ch, flip = 0, nextCh = null) {
    const r = 12;
    const body = (yy, hh, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(x, yy, w, hh, r); ctx.fill(); };
    body(y, h, '#1b1b1e');
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(255,255,255,0.06)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(0,0,0,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
    const p = w / 10.5;
    const glyph = (c, clipTop, clipBot, sy = 1, col = C.paper) => {
      if (!c || c === ' ') return;
      ctx.save(); ctx.beginPath(); ctx.rect(x, clipTop, w, clipBot - clipTop); ctx.clip();
      ctx.translate(0, y + h / 2); ctx.scale(1, sy); ctx.translate(0, -(y + h / 2));
      fill(ctx, place(c, x + w / 2, y + h / 2 + 4.5 * p, p, { w: 600 }), col); ctx.restore();
    };
    if (!flip) glyph(ch, y, y + h);
    else {
      glyph(nextCh, y, y + h / 2); glyph(ch, y + h / 2, y + h);
      // the falling flap, foreshortened (upper half of the old char going over the hinge)
      const k = Math.cos(flip * Math.PI), hh = Math.abs(k) * h / 2, spread = 1 + 0.08 * Math.sin(flip * Math.PI);
      ctx.save();
      const fy = k > 0 ? y + h / 2 - hh : y + h / 2;
      ctx.fillStyle = k > 0 ? '#25252a' : '#1e1e22';
      ctx.beginPath(); ctx.roundRect(x - (spread - 1) * w / 2, fy, w * spread, hh, 8); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.rect(x - 20, fy, w + 40, hh); ctx.clip();
      ctx.translate(x + w / 2, y + h / 2); ctx.scale(spread, k); ctx.translate(-(x + w / 2), -(y + h / 2));
      const c2 = k > 0 ? ch : nextCh;
      if (c2 && c2 !== ' ') fill(ctx, place(c2, x + w / 2, y + h / 2 + 4.5 * p, p, { w: 600 }), C.paper);
      ctx.restore();
      ctx.fillStyle = `rgba(255,179,71,${0.35 * Math.sin(flip * Math.PI)})`; ctx.fillRect(x, k > 0 ? fy : fy + hh - 3, w, 3);
      ctx.restore();
    }
    ctx.fillStyle = '#050506'; ctx.fillRect(x, y + h / 2 - 2, w, 4);
    ctx.fillStyle = '#2b2b30'; ctx.fillRect(x - 6, y + h / 2 - 7, 8, 14); ctx.fillRect(x + w - 2, y + h / 2 - 7, 8, 14);
  }
  // 6 · SPLIT-FLAP — the departures board
  key('0:10', 'SPLIT-FLAP', (ctx) => {
    bg(ctx, '#0F0F11');
    const rows = ['PUNCTUM ', 'MODERNE ', 'DIDONE  '];
    const tw = 168, th = 232, gap = 16;
    const x0 = (W - (8 * tw + 7 * gap)) / 2, y0 = 150;
    rows.forEach((s, r) => {
      for (let i = 0; i < 8; i++) {
        const flip = (r === 2 && (i === 4 || i === 5)) ? (i === 4 ? 0.3 : 0.72) : 0;
        flapTile(ctx, x0 + i * (tw + gap), y0 + r * (th + gap), tw, th, s[i], flip, i === 4 ? 'S' : 'O');
      }
    });
    ctx.fillStyle = C.amber; ctx.font = '500 20px "Punctum Moderne"'; ctx.textAlign = 'left';
    ctx.fillText('● NOW BOARDING', x0, y0 + 3 * (th + gap) + 22);
    vignette(ctx, 0.5);
    hud(ctx, C.paper, 'SC 06 — SPLIT-FLAP / CLACK ON 16THS', '00:00:10:00');
  });

  // 7 · DOT-MATRIX PRINTER — tractor feed racing upward
  key('0:12', 'DOT MATRIX', (ctx) => {
    bg(ctx, C.ink);
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-0.12); ctx.translate(-W / 2, -H / 2);
    const pw = 1260, px = (W - pw) / 2;
    ctx.fillStyle = '#F2F0E8'; ctx.fillRect(px, -300, pw, H + 600);
    for (let y = -300, k = 0; y < H + 300; y += 96, k++) if (k % 2 === 0) { ctx.fillStyle = C.green; ctx.fillRect(px + 70, y, pw - 140, 96); }
    ctx.fillStyle = C.ink;
    for (let y = -290; y < H + 300; y += 42) { for (const x of [px + 34, px + pw - 34]) { ctx.beginPath(); ctx.arc(x, y, 10, 0, TAU); ctx.fill(); } }
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 1.5;
    for (const x of [px + 66, px + pw - 66]) { ctx.beginPath(); ctx.moveTo(x, -300); ctx.lineTo(x, H + 300); ctx.stroke(); }
    ctx.setLineDash([]);
    const lines = ['PUNCTUM MODERNE  v2.2', 'Aa Bb Cc Dd Ee Ff Gg', '0123456789 !?&@#', 'wght 100-900  CNTR  opsz', 'The dot is a signal.'];
    lines.forEach((s, i) => fill(ctx, place(s, px + 120, 120 + i * 120, 5.2, { w: 600, align: 'l' }), '#1d1b22'));
    // the line being printed + head
    const ds = place('PRINTING ...', px + 120, 120 + 5 * 120, 5.2, { w: 600, align: 'l' }).filter((d) => d.x < px + 560);
    fill(ctx, ds, '#1d1b22');
    const hx = px + 580;
    ctx.fillStyle = 'rgba(30,28,34,0.5)'; ctx.fillRect(hx - 260, 120 + 5 * 120 - 64, 260, 80);
    ctx.fillStyle = '#26242a'; ctx.beginPath(); ctx.roundRect(hx - 30, 120 + 5 * 120 - 90, 120, 130, 10); ctx.fill();
    ctx.fillStyle = C.verm; ctx.fillRect(hx - 30, 120 + 5 * 120 - 24, 120, 5);
    ctx.restore();
    // vertical feed blur streaks
    ctx.save(); ctx.globalAlpha = 0.18; ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 40; i++) { ctx.fillStyle = '#fff'; ctx.fillRect(330 + hash(i) * 1260, hash(i + 2) * H, 2, 120 + hash(i + 3) * 300); }
    ctx.restore();
    vignette(ctx, 0.5);
    hud(ctx, C.paper, 'SC 07 — 9-PIN PRINTER / FEED WIPE', '00:00:12:00');
  });

  // 8 · WEIGHT PUMP — wght 100→900 on every beat, strobe inversion
  key('0:14', 'WEIGHT PUMP', (ctx) => {
    const ws = [100, 400, 700, 900];
    const sw = W / 4;
    ws.forEach((w, i) => {
      const inv = i % 2 === 1;
      ctx.save(); ctx.beginPath(); ctx.rect(i * sw, 0, sw, H); ctx.clip();
      bg(ctx, inv ? C.paper : C.ink);
      fill(ctx, place('a', i * sw + sw / 2, 760, 62, { w }), inv ? C.ink : (i === 3 ? C.verm : C.paper));
      ctx.font = '500 22px "Punctum Moderne"'; ctx.fillStyle = inv ? C.ink : C.paper; ctx.textAlign = 'left';
      ctx.fillText(`wght ${w}`, i * sw + 40, 990);
      ctx.restore();
    });
    hud(ctx, C.verm, 'SC 08 — WGHT PUMP / STROBE INVERT', '00:00:14:00');
  });

  // 9 · TUNNEL — the dots break into z and we fly through
  key('0:16', 'Z-TUNNEL', (ctx) => {
    bg(ctx, C.ink);
    const cx = W / 2 + 60, cy = H / 2 - 20;
    for (let z = 40; z >= 1; z--) {
      const zz = z * 0.55;
      const R = 1500 / zz, n = 56;
      const t = z / 40;
      const col = `rgb(${255 * (1 - t) + 185 * t | 0},${75 * (1 - t) + 164 * t | 0},${43 * (1 - t) + 232 * t | 0})`;
      ctx.fillStyle = col; ctx.globalAlpha = Math.min(1, 1.6 - t * 1.3);
      ctx.beginPath();
      for (let k = 0; k < n; k++) {
        const a = k / n * TAU + z * 0.07;
        const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R * 0.92;
        const r = Math.max(0.8, 28 / zz * (0.5 + 0.5 * ((k + z) % 3 === 0)));
        ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
      }
      ctx.fill();
      if (z < 6) { // streaks on the near rings
        ctx.strokeStyle = col; ctx.globalAlpha = 0.25; ctx.lineWidth = 2;
        for (let k = 0; k < n; k += 2) { const a = k / n * TAU + z * 0.07; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R * 0.92); ctx.lineTo(cx + Math.cos(a) * R * 1.35, cy + Math.sin(a) * R * 1.24); ctx.stroke(); }
      }
    }
    ctx.globalAlpha = 1;
    glow(ctx, (x) => fill(x, place('P', cx, cy + 75, 16, { w: 700 }), C.paper), 12, 0.8);
    hud(ctx, C.paper, 'SC 09 — Z-TUNNEL / CNTR SHATTER', '00:00:16:00');
  });

  // 10 · CRT — phosphor, scanlines, optical sizes cascading
  function crt(ctx, x0, y0, w, h, contentFn) {
    ctx.save();
    ctx.beginPath(); ctx.roundRect(x0, y0, w, h, 60); ctx.clip();
    ctx.fillStyle = '#120A02'; ctx.fillRect(x0, y0, w, h);
    contentFn(ctx);
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    for (let y = y0; y < y0 + h; y += 4) ctx.fillRect(x0, y, w, 2);
    const g = ctx.createRadialGradient(x0 + w / 2, y0 + h / 2, h * 0.3, x0 + w / 2, y0 + h / 2, h * 0.85);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.75)'); ctx.fillStyle = g; ctx.fillRect(x0, y0, w, h);
    const rf = ctx.createLinearGradient(x0, y0, x0 + w * 0.4, y0 + h * 0.5); rf.addColorStop(0, 'rgba(255,255,255,0.07)'); rf.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rf; ctx.fillRect(x0, y0, w, h);
    ctx.restore();
    ctx.strokeStyle = '#1d1a17'; ctx.lineWidth = 26; ctx.beginPath(); ctx.roundRect(x0 - 13, y0 - 13, w + 26, h + 26, 72); ctx.stroke();
  }
  key('0:18', 'CRT', (ctx) => {
    bg(ctx, '#08070A');
    crt(ctx, 200, 110, 1520, 860, (c) => {
      glow(c, (x) => {
        let y = 230;
        for (const [p, lab] of [[2.4, '12'], [3.4, '18'], [4.8, '24'], [7, '36'], [10.5, '72'], [16, '144']]) {
          y += p * 10; fill(x, place('Punctum', 330, y, p, { w: 500, f: Math.max(0, Math.min(1, (18 - p) / 16)), align: 'l' }), C.phos);
          x.font = '400 18px "Punctum Moderne"'; x.fillStyle = C.phos; x.textAlign = 'right'; x.fillText(`opsz ${lab}`, 1600, y);
          y += 30;
        }
      }, 6, 0.9);
      // a rolling glitch band
      c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(255,176,0,0.08)'; c.fillRect(200, 640, 1520, 26);
      c.globalCompositeOperation = 'source-over';
    });
    hud(ctx, C.phos, 'SC 10 — CRT PHOSPHOR / OPSZ CASCADE', '00:00:18:00');
  });

  // 11 · PIXEL SORT — the wordmark melts into streaks
  key('0:20', 'PIXEL SORT', (ctx) => {
    bg(ctx, C.ink);
    const ds = place('Punctum Moderne', W / 2, 470, 16, { w: 600 });
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const d of ds) {
      const k = hash(d.col * 13.1 + d.row * 7.7);
      if (k < 0.55) continue;
      const len = 60 + 520 * Math.pow(k, 3);
      const g = ctx.createLinearGradient(0, d.y, 0, d.y + len);
      const col = k > 0.9 ? '255,75,43' : '185,164,232';
      g.addColorStop(0, `rgba(${col},0.75)`); g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g; ctx.fillRect(d.x - d.r, d.y, d.r * 2, len);
    }
    ctx.globalAlpha = 0.85;
    fill(ctx, ds.map((d) => ({ ...d, x: d.x - 7 })), 'rgb(255,60,40)');
    fill(ctx, ds.map((d) => ({ ...d, x: d.x + 7 })), 'rgb(60,90,255)');
    ctx.globalAlpha = 1;
    fill(ctx, ds, '#d8d2f0');
    ctx.restore();
    // displaced slices
    const [c, x] = off(); x.drawImage(ctx.canvas, 0, 0);
    for (const [y, h, dx] of [[380, 22, 60], [432, 10, -90], [300, 14, 30]]) ctx.drawImage(c, 0, y, W, h, dx, y, W, h);
    hud(ctx, C.paper, 'SC 11 — PIXEL SORT / DATAMOSH', '00:00:20:00');
  });

  // 12 · THE DROP — every medium at once, slit-scan
  key('0:22', 'THE DROP', (ctx) => {
    const media = [
      (c) => { bg(c, '#0D0A08'); for (const d of place('Punctum Moderne', W / 2, 590, 17, { w: 500 })) bulb(c, d.x, d.y, Math.max(3.5, d.r), 1); },
      (c) => { bg(c, C.paper); c.globalCompositeOperation = 'multiply'; fill(c, place('Punctum Moderne', W / 2 - 6, 584, 17, { w: 700 }), C.blue); fill(c, place('Punctum Moderne', W / 2 + 6, 594, 17, { w: 700 }), C.verm); c.globalCompositeOperation = 'source-over'; },
      (c) => { bg(c, '#0F0F11'); fill(c, place('Punctum Moderne', W / 2, 590, 17, { w: 600 }), C.paper); c.fillStyle = '#050506'; c.fillRect(0, 503, W, 4); },
      (c) => { bg(c, C.green); fill(c, place('Punctum Moderne', W / 2, 590, 17, { w: 600 }), '#1d1b22'); },
      (c) => { bg(c, '#120A02'); glow(c, (x) => fill(x, place('Punctum Moderne', W / 2, 590, 17, { w: 500 }), C.phos), 5, 0.9); c.fillStyle = 'rgba(0,0,0,0.4)'; for (let y = 0; y < H; y += 4) c.fillRect(0, y, W, 2); },
      (c) => { bg(c, C.ink); glow(c, (x) => fill(x, place('Punctum Moderne', W / 2, 590, 17, { w: 500 }), C.violet), 10, 1); },
    ];
    const sw = W / media.length;
    media.forEach((m, i) => { ctx.save(); ctx.beginPath(); ctx.rect(i * sw, 0, sw + 1, H); ctx.clip(); m(ctx); ctx.restore(); });
    ctx.fillStyle = C.verm; for (let i = 1; i < media.length; i++) ctx.fillRect(i * sw - 1, 0, 2, H);
    hud(ctx, C.paper, 'SC 12 — THE DROP / 8TH-NOTE MEDIA CUTS', '00:00:22:00');
  });

  // 13 · LOCK — everything snaps to the clean wordmark, shockwave
  key('0:24', 'LOCK', (ctx) => {
    bg(ctx, C.ink);
    const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 700); g.addColorStop(0, 'rgba(185,164,232,0.18)'); g.addColorStop(1, 'rgba(185,164,232,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (const [R, n, r, a] of [[420, 90, 3, 0.5], [640, 120, 2.4, 0.3], [900, 150, 2, 0.14]]) {
      ctx.fillStyle = `rgba(185,164,232,${a})`; ctx.beginPath();
      for (let k = 0; k < n; k++) { const t = k / n * TAU; ctx.moveTo(W / 2 + Math.cos(t) * R + r, H / 2 + Math.sin(t) * R * 0.62); ctx.arc(W / 2 + Math.cos(t) * R, H / 2 + Math.sin(t) * R * 0.62, r, 0, TAU); }
      ctx.fill();
    }
    glow(ctx, (x) => fill(x, place('Punctum Moderne', W / 2, 600, 15, { w: 500 }), '#F4F1FF'), 9, 0.7);
    hud(ctx, C.violet, 'SC 13 — LOCK / SHOCKWAVE', '00:00:24:00');
  });

  // 14 · END — wordmark, line, a cursor that keeps blinking
  key('0:26', 'END', (ctx) => {
    bg(ctx, C.ink);
    fill(ctx, place('Punctum Moderne', W / 2, 520, 12.5, { w: 500 }), C.paper);
    ctx.textAlign = 'center'; ctx.fillStyle = C.paper;
    ctx.font = '400 30px "Punctum Moderne"'; ctx.globalAlpha = 0.92; ctx.fillText('Retro signal. Modern type.', W / 2, 620);
    ctx.font = '300 22px "Songti SC", serif'; ctx.globalAlpha = 0.62; ctx.letterSpacing = '6px'; ctx.fillText('复古的信号，前卫的字。', W / 2, 676);
    ctx.globalAlpha = 1; ctx.letterSpacing = '0px';
    ctx.fillStyle = C.verm; ctx.beginPath(); ctx.arc(W / 2 + 252, 610, 8, 0, TAU); ctx.fill();
    hud(ctx, C.paper, 'SC 14 — END / CURSOR BLINK', '00:00:26:00');
  });

  root.PM_BOARD = { KEYS, W, H };
})(typeof self !== 'undefined' ? self : this);
