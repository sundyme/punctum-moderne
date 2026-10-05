/* PUNCTUM MODERNE — the film. 72 s, 120 bpm, 36 bars.
 * FILM.frame(t) is a pure function of time; FILM.EVENTS drives the score.
 * World unit = one dot pitch (1/16 em). Glyph dots come from the font source (assets/data.js).
 */
(function () {
  "use strict";
  const { M, hex, STRIDE } = PE;
  const D = window.PMD;
  const W = 1920, H = 1080, DUR = 72, BEAT = 0.5;

  // ------------------------------------------------------------------ math
  const cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (t, a, b) => cl((t - a) / (b - a));
  const sm = (x) => { x = cl(x); return x * x * (3 - 2 * x); };
  const eio = (x) => { x = cl(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const eo = (x) => 1 - Math.pow(1 - cl(x), 3);
  const e5 = (x) => 1 - Math.pow(1 - cl(x), 5);
  const ei = (x) => Math.pow(cl(x), 3);
  const back = (x, s = 1.7) => { x = cl(x); return 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
  const hash = (n) => { const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
  const pulse = (t, at, dec = 10) => (t >= at ? Math.exp(-(t - at) * dec) : 0);
  const beatEnv = (t, dec = 7, per = BEAT) => { const p = ((t % per) + per) % per; return Math.exp(-p * dec); };
  const v3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const mixc = v3;

  // ------------------------------------------------------------------ palette (linear)
  const C = {
    ink: hex("#0b0b0d"), paper: hex("#ece6d6"), cream: hex("#f3eee2"), mint: hex("#cfe6d2"), red: hex("#ff4a2a"),
    blue: hex("#2a43dc"), gold: hex("#ffb347"), white: hex("#f6f3ec"), amber: hex("#ffae1a"), violet: hex("#4e347d"),
    night: hex("#0a1028"), green: hex("#123c2e"), led: hex("#ff3b1f"),
  };
  const S = { // sRGB strings for the overlay
    ink: "#0b0b0d", paper: "#ece6d6", white: "#f6f3ec", red: "#ff4a2a", blue: "#2a43dc", gold: "#ffb347", mint: "#a9d6b4", amber: "#ffae1a",
  };

  // ------------------------------------------------------------------ radius model (pitch units)
  const DISP = [[100, 0.20, 0.07], [400, 0.40, 0.11], [900, 0.62, 0.16]];
  const TXT = [[100, 0.30, 0.16], [400, 0.50, 0.30], [900, 0.66, 0.40]];
  function lt(tab, w, i) {
    if (w <= tab[0][0]) return tab[0][i];
    for (let k = 0; k < tab.length - 1; k++) {
      const a = tab[k], b = tab[k + 1];
      if (w <= b[0]) return a[i] + (b[i] - a[i]) * (w - a[0]) / (b[0] - a[0]);
    }
    return tab[tab.length - 1][i];
  }
  function rad(tone, w = 400, c = 100, f = 0) {
    const rT = lt(DISP, w, 1) + (lt(TXT, w, 1) - lt(DISP, w, 1)) * f;
    const rH = lt(DISP, w, 2) + (lt(TXT, w, 2) - lt(DISP, w, 2)) * f;
    const st = rH + (rT - rH) * tone, mono = rT * 0.86;
    return mono + (st - mono) * (c / 100);
  }
  const OPSZ = [[12, 1], [16, 0.98], [24, 0.85], [48, 0.55], [96, 0.2], [144, 0]];
  function opszF(px) {
    if (px <= 12) return 1;
    for (let k = 0; k < OPSZ.length - 1; k++) {
      const a = OPSZ[k], b = OPSZ[k + 1];
      if (px <= b[0]) return a[1] + (b[1] - a[1]) * (px - a[0]) / (b[0] - a[0]);
    }
    return 0;
  }

  // ------------------------------------------------------------------ text layout (cached)
  const TAN = D.TAN, PIV = D.PIV;
  const LCACHE = new Map();
  function glyphOf(ch, it, sw) {
    const G = it ? D.I : D.R;
    if (sw && G[ch + ".swsh"]) return [ch + ".swsh", G[ch + ".swsh"]];
    if (G[ch]) return [ch, G[ch]];
    return [" ", G[" "] || { w: 4, d: [] }];
  }
  // → { dots: [[x, y, tone, ci, line]], w, chars: [{x, w, ch}] }
  function layout(str, o = {}) {
    const key = str + "|" + (o.it ? 1 : 0) + (o.sw ? 1 : 0) + (o.kern === false ? 0 : 1) + "|" + (o.track || 0) + "|" + (o.lead || 15) + "|" + (o.align || "l");
    let r = LCACHE.get(key);
    if (r) return r;
    const K = o.it ? D.KI : D.KR;
    const lines = str.split("\n");
    const dots = [], chars = [];
    let maxw = 0, ci = 0;
    const lws = [];
    lines.forEach((ln, li) => {
      let x = 0, prev = null;
      const start = dots.length, cstart = chars.length;
      for (const ch of ln) {
        const [nm, g] = glyphOf(ch, o.it, o.sw);
        if (prev && o.kern !== false) { const k = K[prev + "\u0001" + nm]; if (k) x += k; }
        for (const [dx, y, tn] of g.d) dots.push([x + dx, y - li * (o.lead || 15), tn, ci, li]);
        chars.push({ x, w: g.w, ch, nm, line: li, i: ci });
        x += g.w + 1 + (o.track || 0);
        prev = nm; ci++;
      }
      const lw = Math.max(0, x - 1 - (o.track || 0));
      lws.push(lw); maxw = Math.max(maxw, lw);
      if (o.align === "c") {
        const off = -lw / 2;
        for (let i = start; i < dots.length; i++) dots[i][0] += off;
        for (let i = cstart; i < chars.length; i++) chars[i].x += off;
      }
    });
    r = { dots, w: maxw, chars, lws, n: lines.length };
    LCACHE.set(key, r);
    return r;
  }

  // ------------------------------------------------------------------ dot buffers
  const pool = []; let pi = 0;
  function buf() {
    if (!pool[pi]) pool[pi] = { d: new Float32Array(160000 * STRIDE), n: 0 };
    const b = pool[pi++]; b.n = 0; return b;
  }
  function put(b, x, y, z, r, c, a = 1, emit = 0, style = 0, seed = 0, rot = 0) {
    if (r <= 0 || a <= 0 || b.n >= 160000) return;
    const o = b.n * STRIDE, d = b.d;
    d[o] = x; d[o + 1] = y; d[o + 2] = z; d[o + 3] = r;
    d[o + 4] = c[0]; d[o + 5] = c[1]; d[o + 6] = c[2]; d[o + 7] = a;
    d[o + 8] = emit; d[o + 9] = style; d[o + 10] = seed; d[o + 11] = rot;
    b.n++;
  }
  const lay = (b, o = {}) => Object.assign({ type: "dots", data: b.d, count: b.n }, o);
  const quad = (o) => Object.assign({ type: "quad" }, o);

  // projection of a world point (after model) to overlay pixels
  function project(cam, model, p) {
    const proj = M.persp(cam.fov || 0.6, W / H, cam.near || 0.1, cam.far || 4000);
    const view = M.look(cam.pos, cam.tgt, cam.up || [0, 1, 0]);
    const m = M.mul(proj, M.mul(view, model || M.trs()));
    const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12];
    const y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
    const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
    return [(x / w * 0.5 + 0.5) * W, (1 - (y / w * 0.5 + 0.5)) * H, w];
  }
  // camera distance so that `h` world units fill the frame height
  const fit = (h, fov = 0.5) => h / (2 * Math.tan(fov / 2));

  // ------------------------------------------------------------------ overlay type
  const FONT = (w, px, it = false) => `${it ? "italic " : ""}${w} ${px}px PM`;
  function txt(c, s, x, y, o = {}) {
    c.save();
    c.font = o.font || FONT(500, 14);
    c.letterSpacing = (o.ls ?? 0) + "px";
    c.fillStyle = o.col || "#fff";
    c.globalAlpha = o.a ?? 1;
    c.textAlign = o.align || "left";
    c.textBaseline = o.base || "alphabetic";
    c.fillText(s, x, y);
    const w = c.measureText(s).width;
    c.restore();
    return w;
  }
  // typed-on text: characters arrive over `dur`, a small dot cursor leads
  function typed(c, s, x, y, t0, t, dur, o = {}) {
    if (t < t0) return;
    const n = Math.floor(s.length * cl((t - t0) / dur));
    const shown = [...s].slice(0, n).join("");
    const w = txt(c, shown, x, y, o);
    if (n < s.length && o.cursor !== false) {
      c.save(); c.fillStyle = o.cur || S.red; c.globalAlpha = o.a ?? 1;
      c.beginPath(); c.arc(x + w + 8, y - (o.cy || 9), o.cr || 4, 0, 7); c.fill(); c.restore();
    }
  }
  // bilingual caption: English in Punctum, Chinese in Song
  function caption(c, t, t0, t1, en, zh, o = {}) {
    if (t < t0 - 0.01 || t > t1 + 0.4) return;
    const a = sm(seg(t, t0, t0 + 0.2)) * (1 - sm(seg(t, t1, t1 + 0.35)));
    const x = o.x ?? 120, y = o.y ?? 930, col = o.col || S.white;
    typed(c, en, x, y, t0, t, o.dur ?? Math.min(0.7, en.length * 0.022), { font: FONT(o.w || 420, o.px || 38, o.it), col, a, ls: o.ls ?? 0.3, cy: 12, cr: 5 });
    if (zh) txt(c, zh, x + 2, y + (o.gap || 44), { font: `400 ${o.zpx || 22}px SongCN`, col, a: a * 0.78 * sm(seg(t, t0 + 0.15, t0 + 0.45)), ls: 3 });
  }

  // HUD: registration marks, release slate, chapter, beat lamps, timecode
  const CHAP = [
    [0, "01", "CARRIER"], [6, "02", "TITLE"], [10, "03", "PRESSURE"], [16, "04", "WEIGHT"], [20, "05", "CONTRAST"],
    [24, "06", "OPTICAL SIZE"], [28, "07", "ONE GRID"], [36, "08", "ITALIC"], [46, "09", "CHARACTER SET"],
    [54, "10", "IN USE"], [62, "11", "SIGNAL"], [68, "12", "SIGNATURE"],
  ];
  function hud(c, t, o = {}) {
    const col = o.col || "rgba(246,243,236,0.72)", a = o.a ?? 1;
    if (a <= 0) return;
    c.save();
    c.globalAlpha = a;
    c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 1;
    const m = 44;
    for (const [x, y] of [[m, m], [W - m, m], [m, H - m], [W - m, H - m]]) {
      c.beginPath(); c.arc(x, y, 7, 0, 7); c.stroke();
      c.beginPath(); c.moveTo(x - 13, y); c.lineTo(x + 13, y); c.moveTo(x, y - 13); c.lineTo(x, y + 13); c.stroke();
    }
    c.restore();
    let ch = CHAP[0];
    for (const k of CHAP) if (t >= k[0]) ch = k;
    const f = FONT(500, 13);
    txt(c, "PUNCTUM MODERNE", 70, 49, { font: f, col, ls: 3.2, a });
    txt(c, "A DIDONE ON THE DOT MATRIX", 262, 49, { font: f, col, ls: 3.2, a: a * 0.6 });
    txt(c, `${ch[1]} / 12   ${ch[2]}`, W - 70, 49, { font: f, col, ls: 3.2, a, align: "right" });
    // beat lamps
    const b = Math.floor(t / BEAT) % 4;
    txt(c, "120 BPM", 70, H - 39, { font: f, col, ls: 3.2, a });
    c.save(); c.globalAlpha = a;
    for (let i = 0; i < 4; i++) {
      c.beginPath(); c.arc(170 + i * 16, H - 44, i === b ? 4 : 2.2, 0, 7);
      c.fillStyle = i === b ? (o.lamp || S.red) : col; c.fill();
    }
    c.restore();
    const fr = Math.floor(t * 60);
    const tc = [Math.floor(fr / 3600), Math.floor(fr / 60) % 60, fr % 60].map((v) => String(v).padStart(2, "0")).join(":");
    txt(c, "00:" + tc, W - 70, H - 39, { font: f, col, ls: 3.2, a, align: "right" });
  }

  // ------------------------------------------------------------------ shared builders
  // put a laid-out text into a buffer.  fn(dot) may return {x,y,z,r,c,a,e,s} overrides or null to skip
  function textDots(b, L, o, fn) {
    const { w = 400, c = 100, f = 0, col = C.white, ball = null, style = 0, emit = 0, sh = 0, z = 0, ox = 0, oy = 0, k = 1 } = o;
    for (let i = 0; i < L.dots.length; i++) {
      const dt = L.dots[i];
      let x = dt[0], y = dt[1];
      x += (y - PIV) * TAN * sh;
      let r = rad(dt[2], w, c, f);
      const isBall = dt[2] > 1.1;
      let cc = isBall && ball ? ball : col;
      let p = { x: ox + x * k, y: oy + y * k, z, r: r * k, c: cc, a: 1, e: emit, s: style, i, dt, ball: isBall };
      if (fn) { const q = fn(p); if (q === null) continue; if (q) p = Object.assign(p, q); }
      put(b, p.x, p.y, p.z, p.r, p.c, p.a, p.e, p.s, p.seed ?? (i * 0.6180339 % 1) * 10, p.rot || 0);
    }
  }
  const fixedBg = (a, b = a, o = {}) => Object.assign({ a, b }, o);

  // ==================================================================== SCENES
  // ---------------------------------------------------------------- 01 CARRIER 0–6
  const A_GLYPH = D.R["a"];
  const A_ORDER = (() => {
    const ds = A_GLYPH.d.map((d, i) => ({ d, i }));
    const ball = ds.find((q) => q.d[2] > 1.1);
    const rest = ds.filter((q) => q !== ball);
    // reveal along the pen path: walk nearest neighbours from the ball
    const order = [ball]; const left = rest.slice();
    let cur = ball;
    while (left.length) {
      let bi = 0, bd = 1e9;
      left.forEach((q, i) => { const dd = Math.hypot(q.d[0] - cur.d[0], q.d[1] - cur.d[1]); if (dd < bd) { bd = dd; bi = i; } });
      cur = left.splice(bi, 1)[0]; order.push(cur);
    }
    return order;
  })();
  const MORSE_P = [[0.6, 0.1], [0.8, 0.3], [1.2, 0.3], [1.6, 0.1]];
  const A_T = (k) => (k === 0 ? 0.25 : 2.0 + (k - 1) * 0.11);
  function S1(t) {
    const cx = 2.5, cy = 3;
    const bc = A_ORDER[0].d;
    let morse = 0;
    for (const [a, d] of MORSE_P) if (t >= a && t < a + d) morse = 1;
    // camera: macro on the ball → pull back and orbit
    const k = eio(seg(t, 1.95, 4.6));
    const yaw = lerp(0.62, -0.22, eio(seg(t, 1.9, 6))) + Math.sin(t * 0.7) * 0.03;
    const dist = t < 1.95 ? lerp(15, 3.6, eio(seg(t, 0.0, 1.95))) : lerp(3.6, 17, k);
    const tgt = v3([bc[0], bc[1], 0], [cx, cy, 0], eio(seg(t, 1.95, 4.2)));
    const pos = [tgt[0] + Math.sin(yaw) * dist, tgt[1] + lerp(0.6, 3.5, k) * Math.min(1, dist / 3.6), Math.cos(yaw) * dist];
    // whip at the end
    const wh = ei(seg(t, 5.72, 6.0));
    tgt[0] += wh * 18; pos[0] += wh * 10;
    const cam = { pos, tgt, fov: 0.5, aperture: t < 1.95 ? 1.0 : lerp(1.3, 0.35, k), focus: dist, cocMax: 90 };
    const b = buf();
    A_ORDER.forEach((q, kk) => {
      const ta = A_T(kk);
      if (t < ta) return;
      const [x, y, tone] = q.d;
      const pop = back(seg(t, ta, ta + 0.32), 2.2);
      const ball = tone > 1.1;
      let r = rad(tone, 430, 100) * pop;
      let e = pulse(t, ta, 7) * 2.2;
      if (ball) { e += 0.12 + morse * 1.6 + beatEnv(t - 2, 6) * 0.35 * seg(t, 2, 2.2); }
      e += wh * 2.5;
      const col = ball ? C.red : mixc(C.white, C.gold, wh);
      put(b, x, y, 0, r, col, 1, e, 1);
    });
    // the matrix behind: unlit lattice
    const g = buf();
    const la = sm(seg(t, 2.2, 3.6)) * 0.55;
    if (la > 0) for (let x = -6; x <= 11; x++) for (let y = -4; y <= 10; y++) {
      const dd = Math.hypot(x - cx, y - cy);
      const a = la * sm(seg(t - 2.2, dd * 0.12, dd * 0.12 + 0.6));
      put(g, x, y, -0.6, 0.05, [0.4, 0.4, 0.45], a * 0.7, 0, 0);
    }
    const intro = sm(seg(t, 0.05, 0.6));
    const flash = pulse(t, 6.0 - 1e-3, 30) * 0;
    return {
      t, cam,
      bg: fixedBg([0.012, 0.012, 0.016], [0.0, 0.0, 0.0], { r: 1.1 }),
      layers: [lay(g, { billboard: false, noDof: false }), lay(b, { sort: true, light: [-0.6, 0.8, 0.7], envTop: [0.55, 0.58, 0.65] })],
      post: { bloom: 0.55, thr: 1.1, expo: intro, vign: 0.7, grain: 0.016, flash: [1, 1, 1, flash] },
      overlay(c) {
        hud(c, t, { a: sm(seg(t, 0.4, 1.2)) });
        // morse readout
        if (t > 0.5 && t < 2.2) {
          const a = sm(seg(t, 0.5, 0.7)) * (1 - sm(seg(t, 1.9, 2.2)));
          txt(c, "· — — ·", W / 2, H - 150, { font: FONT(500, 20), col: S.white, ls: 8, a: a * 0.8, align: "center" });
          txt(c, "P", W / 2, H - 118, { font: FONT(500, 13), col: S.white, ls: 4, a: a * 0.5, align: "center" });
        }
        // the four tones, labelled on the beat
        const lab = [
          [[4, 4], "THICK", "pen pressing", "粗点 · 下压", 4.0],
          [[0, 1], "TRANSITION", "pen relaxing", "过渡点 · 放松", 4.5],
          [[2, 0], "HAIRLINE", "pen lifting", "发丝点 · 抬起", 5.0],
          [[0, 5], "BALL", "the drop", "球点 · 收笔", 5.5],
        ];
        lab.forEach(([p, en, sub, zh, t0], i) => {
          if (t < t0) return;
          const a = sm(seg(t, t0, t0 + 0.12)) * (1 - sm(seg(t, 5.7, 5.85)));
          const s = project(cam, null, [p[0], p[1], 0]);
          const rr = (rad([1, 0.5, 0, 1.3][i], 430) * 1.35) * (cam ? (H / 2) / Math.tan(0.25) / s[2] : 1);
          const side = i % 2 ? -1 : 1;
          const lx = s[0] + side * 150, ly = s[1] - 60 - (i === 3 ? 30 : 0);
          c.save(); c.globalAlpha = a; c.strokeStyle = i === 3 ? S.red : S.white; c.lineWidth = 1.2;
          c.beginPath(); c.arc(s[0], s[1], rr + 8, 0, 7); c.stroke();
          const ang = Math.atan2(ly - s[1], lx - s[0]);
          c.beginPath(); c.moveTo(s[0] + Math.cos(ang) * (rr + 8), s[1] + Math.sin(ang) * (rr + 8)); c.lineTo(lx, ly); c.lineTo(lx + side * 24, ly); c.stroke();
          c.restore();
          const tx = lx + side * 34, al = side > 0 ? "left" : "right";
          txt(c, en, tx, ly + 6, { font: FONT(600, 19), col: i === 3 ? S.red : S.white, ls: 3.5, a, align: al });
          txt(c, sub, tx, ly + 34, { font: FONT(400, 22, true), col: S.white, a: a * 0.75, align: al });
          txt(c, zh, tx, ly + 62, { font: "400 18px SongCN", col: S.white, a: a * 0.6, align: al, ls: 2 });
        });
      },
    };
  }

  // ---------------------------------------------------------------- 02 TITLE 6–10  (marquee)
  function S2(t) {
    const lt = t - 6;
    const frontal = t >= 8;
    const L = frontal ? layout("PUNCTUM\nMODERNE", { align: "c", lead: 15, track: 1 }) : layout("PUNCTUM MODERNE", { track: 1 });
    const ox = frontal ? 0 : -L.w / 2, oy = frontal ? 1.5 : -5;
    const b = buf(), fr = buf();
    const r0 = rad(1, 650, 0) * 0.95;
    const off = frontal ? seg(t, 9.45, 9.95) : 0;
    textDots(b, L, {}, (p) => {
      const x = ox + p.dt[0], y = oy + p.dt[1];
      let on;
      if (!frontal) {
        const wave = Math.pow(0.5 + 0.5 * Math.cos((x * 0.16 - lt * 9) % (Math.PI * 2)), 6);
        on = 0.35 + 0.65 * wave + (hash(p.i + Math.floor(lt * 8)) > 0.92 ? 0.4 : 0);
      } else {
        const bi = Math.floor((t - 8) / BEAT);
        const pat = [1, (Math.round(x) & 1) ? 1 : 0.15, (Math.round(x) & 1) ? 0.15 : 1, 1][bi % 4];
        on = pat * (0.85 + 0.6 * beatEnv(t, 6));
        const cut = (x + L.w / 2) / L.w; // switch-off sweep, left → right, stepped on 16ths
        if (off > 0 && cut < Math.floor(off * 8) / 8 + 0.01) on = 0.06;
      }
      return { x, y, r: r0, c: C.gold, e: on * (frontal ? 0.9 : 1.3), s: 2 };
    });
    // frame of bulbs around the sign
    const fw = (frontal ? 70 : L.w + 8), fh = frontal ? 34 : 18, fcx = 0, fcy = frontal ? -4.5 : -1;
    for (let i = 0; i <= fw / 2; i++) for (const yy of [fcy - fh / 2, fcy + fh / 2]) {
      const x = fcx - fw / 2 + i * 2;
      const on = 0.3 + 0.7 * ((i + Math.floor(t * 8)) % 3 === 0 ? 1 : 0);
      put(fr, x, yy, 0, r0 * 0.8, C.gold, 1, on * (frontal && off > 0.5 ? 0.1 : 1.3), 2);
    }
    for (let j = 1; j < fh / 2; j++) for (const xx of [fcx - fw / 2, fcx + fw / 2]) {
      const on = 0.3 + 0.7 * ((j + Math.floor(t * 8)) % 3 === 0 ? 1 : 0);
      put(fr, xx, fcy - fh / 2 + j * 2, 0, r0 * 0.8, C.gold, 1, on * (frontal && off > 0.5 ? 0.1 : 1.3), 2);
    }
    let cam;
    if (!frontal) {
      const u = eio(seg(t, 6, 8.02));
      const px = lerp(-L.w / 2 - 6, L.w / 2 - 22, u);
      cam = { pos: [px, -9, 13], tgt: [px + 16, -3.5, 0], fov: 0.62, aperture: 0.8, focus: 17, cocMax: 120 };
    } else {
      const u = eo(seg(t, 8, 10));
      cam = { pos: [0, -3 + u * 0.6, fit(40, 0.5) * lerp(1.1, 1.0, u)], tgt: [0, -3.5, 0], fov: 0.5, aperture: 0.2, focus: fit(40, 0.5) };
    }
    const flash = pulse(t, 8.0, 9) * 0.55 + pulse(t, 6.0, 10) * 0.35;
    return {
      t, cam,
      bg: fixedBg(hex("#1d1209"), hex("#040201"), { r: 1.0, c: [0.5, 0.55] }),
      layers: [
        quad({ pos: [fcx, fcy, -0.6], size: [fw + 3, fh + 3], color: hex("#1a0f07"), mode: 4, p: [1.2, 0, 0, 0] }),
        lay(fr, { billboard: false }), lay(b, { billboard: false }),
      ],
      post: { bloom: frontal ? 0.6 : 0.85, thr: 1.0, vign: 0.75, grain: 0.017, flash: [1, 0.92, 0.8, flash], ca: 0.0015, glitch: off > 0.85 ? 0.3 : 0, seed: Math.floor(t * 30) },
      overlay(c) {
        hud(c, t, { col: "rgba(255,226,180,0.7)", lamp: S.gold });
        caption(c, t, 8.25, 9.7, "A Didone on the dot matrix.", "点阵上的 Didone", { y: 935, col: "#ffe6c2" });
      },
    };
  }

  // ---------------------------------------------------------------- 03 PRESSURE 10–16 (riso)
  const PEN_LINKS = (() => {
    const L = layout("ag", {}), out = [];
    for (let i = 0; i < L.dots.length; i++) for (let j = i + 1; j < L.dots.length; j++) {
      const a = L.dots[i], b = L.dots[j];
      if (a[3] !== b[3]) continue;
      if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 1.5) out.push([i, j]);
    }
    return out;
  })();
  function S3(t) {
    const L = layout("ag", {});
    const k = 1.75; // letter scale
    const ox = -L.w * k / 2 - 4.5, oy = -3.6 * k + 1.6;
    const drumB = seg(t, 10.0, 10.8), drumR = seg(t, 10.95, 11.65);
    const yTop = 9.5, yBot = -12;
    const bY = lerp(yTop, yBot, drumB), rY = lerp(13.5, yBot, drumR);
    const brk = (i) => e5(seg(t, 12.0 + hash(i * 3.1) * 0.22, 12.3 + hash(i * 3.1) * 0.22));
    const mis = [Math.sin(Math.floor(t * 2) * 1.7) * 0.12, Math.cos(Math.floor(t * 2) * 2.3) * 0.1];
    const blue = buf(), red = buf(), sun = buf();
    // the pen: discs swept between neighbouring dots, thick where the pen presses
    const penR = (tone) => (0.16 + 0.62 * Math.min(tone, 1) + (tone > 1.1 ? 0.12 : 0)) * k;
    for (const [i, j] of PEN_LINKS) {
      const a = L.dots[i], c = L.dots[j];
      const m = Math.min(brk(i), brk(j));
      const s1 = 1 - e5(seg(m, 0, 0.6));
      if (s1 <= 0) continue;
      for (let q = 1; q < 6; q++) {
        const u = q / 6;
        const x = ox + lerp(a[0], c[0], u) * k, y = oy + lerp(a[1], c[1], u) * k;
        if (y < bY - 0.3) continue;
        put(blue, x, y, 0, lerp(penR(a[2]), penR(c[2]), u) * s1, C.blue, 0.93, 0, 7, (i * 7 + q) % 10);
      }
    }
    textDots(blue, L, { k, ox, oy }, (p) => {
      if (p.y < bY - 0.3) return null;
      const pen = penR(p.dt[2]);
      const real = rad(p.dt[2], 430, 100) * k;
      const m = brk(p.i);
      if (p.ball && m > 0.5) return null; // balls go to the red drum
      return { r: lerp(pen, real, m), c: C.blue, a: 1, s: 7 };
    });
    textDots(red, L, { k, ox, oy }, (p) => {
      if (!p.ball || brk(p.i) < 0.5) return null;
      return { x: p.x + mis[0], y: p.y + mis[1], r: rad(1.3, 430, 100) * k * back(seg(t, 12.15, 12.5)), c: C.red, a: 0.95, s: 7 };
    });
    // halftone sun (red drum)
    const scx = 17, scy = 5.2, sr = 6.6;
    for (let x = -10; x <= 10; x++) for (let y = -10; y <= 10; y++) {
      const X = scx + x * 0.92 + (y & 1) * 0.46, Y = scy + y * 0.8;
      const d = Math.hypot(X - scx, Y - scy) / sr;
      if (d > 1.05 || Y < rY) continue;
      const r = 0.47 * Math.sqrt(cl(1.05 - d * d * 0.9)) * (1 - 0.15 * Math.sin(t * 3 + X));
      put(sun, X + mis[0], Y + mis[1], 0, r, C.red, 1, 0, 7, (x * 13 + y * 7 + 100) % 10);
    }
    // paper flips away at the end
    const flip = ei(seg(t, 15.45, 16.0));
    const model = M.trs([0, -flip * 4, 0], [-flip * 1.5, 0, flip * 0.15], 1);
    const camZ = lerp(fit(26), fit(22), eio(seg(t, 10, 15.4)));
    const cam = { pos: [0, 0, camZ], tgt: [0, 0, 0], fov: 0.5, aperture: 0.15, focus: camZ };
    return {
      t, cam,
      bg: fixedBg([0.0, 0.0, 0.0]),
      layers: [
        quad({ model: M.mul(model, M.trs([0, 0, -0.05])), size: [70, 44], color: C.paper, mode: 1, shade: 0.5, light: [-0.3, 0.6, 0.75], lamp: [-12, 14, 26, 46], lampK: 0.35 }),
        lay(sun, { model, billboard: false, multiply: true }), lay(blue, { model, billboard: false }), lay(red, { model, billboard: false, multiply: true }),
      ],
      post: { bloom: 0.05, thr: 3, vign: 0.35, grain: 0.016, expo: lerp(0.25, 1, sm(seg(t, 10.0, 10.35))) },
      overlay(c) {
        const ink = "rgba(20,20,26,0.75)";
        hud(c, t, { col: ink, a: 1 - flip });
        // riso drum lines
        for (const [u, y0, col] of [[drumB, bY, S.blue], [drumR, rY, S.red]]) {
          if (u <= 0 || u >= 1) continue;
          const s = project(cam, model, [0, y0, 0]);
          c.save(); c.globalAlpha = 0.5; c.fillStyle = col; c.fillRect(0, s[1] - 1, W, 2); c.restore();
        }
        if (flip < 0.3) {
          caption(c, t, 12.55, 15.3, "Thick stems become full dots.", "粗笔成满点", { col: "#16161c", y: 925, gap: 42 });
          caption(c, t, 13.6, 15.3, "Hairlines become pinpricks.", "细线成针尖", { col: "#16161c", x: 1050, y: 925, gap: 42 });
          // radius callouts
          const a = sm(seg(t, 13.0, 13.3)) * (1 - sm(seg(t, 15.2, 15.45)));
          if (a > 0) {
            const th = L.dots.find((d) => d[2] === 1 && d[3] === 0 && d[1] === 3), hl = L.dots.find((d) => d[2] === 0 && d[3] === 0 && d[1] === 6);
            for (const [d, lab] of [[th, "r 0.40"], [hl, "r 0.11"]]) {
              if (!d) continue;
              const s = project(cam, model, [ox + d[0] * k, oy + d[1] * k, 0]);
              c.save(); c.globalAlpha = a; c.strokeStyle = "#16161c"; c.lineWidth = 1;
              c.beginPath(); c.moveTo(s[0], s[1]); c.lineTo(s[0] - 90, s[1] - 70); c.lineTo(s[0] - 150, s[1] - 70); c.stroke(); c.restore();
              txt(c, lab, s[0] - 156, s[1] - 76, { font: FONT(500, 15), col: "#16161c", a, ls: 2, align: "right" });
            }
          }
        }
      },
    };
  }

  // ---------------------------------------------------------------- 04 WEIGHT 16–20
  function S4(t) {
    const camZ = 60, fov = 0.3;
    const vh = 2 * camZ * Math.tan(fov / 2), vw = vh * W / H;
    const cam = { pos: [0, 0, camZ], tgt: [0, 0, 0], fov, aperture: 0, focus: camZ };
    const layers = [];
    let post = { bloom: 0.25, thr: 1.2, vign: 0.3, grain: 0.016 };
    let readW = 400;
    if (t < 18) {
      const pw = vw / 4;
      const La = layout("a", {});
      for (let i = 0; i < 4; i++) {
        const tin = 16 + i * 0.125;
        const u = e5(seg(t, tin, tin + 0.4));
        const y = (1 - u) * -vh;
        const dark = i % 2 === 0;
        const x = -vw / 2 + pw * (i + 0.5);
        layers.push(quad({ pos: [x, y, -0.1], size: [pw + 0.02, vh], color: dark ? C.ink : C.paper, mode: dark ? 0 : 1 }));
        const shift = Math.floor(Math.max(0, t - 17) / BEAT);
        const ws = [100, 400, 700, 900];
        const target = ws[(i + shift) % 4], prevw = ws[(i + shift + 3) % 4];
        const w = t < 17 ? ws[i] : lerp(prevw, target, e5(seg((t - 17) % BEAT, 0, 0.22)));
        if (i === 1) readW = w;
        const b = buf(), k = 1.05;
        textDots(b, La, { k, ox: x - La.w * k / 2 + 0.1, oy: y - 3 * k - 0.5, w, col: dark ? C.white : C.ink, ball: C.red });
        layers.push(lay(b, { billboard: false }));
      }
    } else {
      const L = layout("Moderne", {});
      const k = 0.52;
      const u = seg(t, 18.0, 19.75);
      const w = 100 + 800 * (u < 0.5 ? eio(u * 2) : eio((1 - u) * 2));
      readW = w;
      const b = buf(), g = buf();
      const ox = -L.w * k / 2, oy = -3.4 * k - 1.2;
      textDots(b, L, { k, ox, oy, w, col: C.white, ball: C.red, emit: 0.15 });
      // ghost of the previous weight trails the motion
      const w2 = 100 + 800 * (u - 0.05 < 0.5 ? eio(Math.max(0, u - 0.05) * 2) : eio((1 - (u - 0.05)) * 2));
      textDots(g, L, { k, ox, oy, w: w2, col: C.red }, (p) => ({ a: 0.35 }));
      layers.push(lay(g, { billboard: false }), lay(b, { billboard: false }));
      post.flash = [1, 1, 1, pulse(t, 18, 14) * 0.7];
      // turn into LEDs at the very end
      const toLed = seg(t, 19.75, 20);
      if (toLed > 0) { post.glitch = toLed * 0.5; post.seed = Math.floor(t * 40); }
    }
    return {
      t, cam, bg: fixedBg(C.ink), layers, post,
      overlay(c) {
        hud(c, t, { col: t < 18 ? "rgba(246,243,236,0.0)" : "rgba(246,243,236,0.7)", a: t < 18 ? 0 : 1 });
        if (t < 18) {
          const pw = W / 4;
          ["wght 100", "wght 400", "wght 700", "wght 900"].forEach((s, i) => {
            const shift = Math.floor(Math.max(0, t - 17) / BEAT);
            const ws = [100, 400, 700, 900][(i + shift) % 4];
            txt(c, "wght " + (t < 17 ? [100, 400, 700, 900][i] : ws), pw * i + 40, H - 46, { font: FONT(500, 14), col: i % 2 ? "#16161c" : S.white, ls: 3, a: e5(seg(t, 16 + i * 0.125, 16.4 + i * 0.125)) });
          });
        } else {
          txt(c, String(Math.round(readW)).padStart(3, "0"), 118, 250, { font: FONT(Math.round(readW), 96), col: S.white, a: 0.95 });
          txt(c, "WGHT  100 — 900", 124, 290, { font: FONT(500, 14), col: S.white, ls: 4, a: 0.7 });
          caption(c, t, 18.25, 19.6, "Weight moves the radius, never the dot.", "字重只改变点的半径，不移动点", { y: 930 });
        }
      },
    };
  }

  // ---------------------------------------------------------------- 05 CONTRAST 20–24
  function S5(t) {
    const L = layout("Didone", {});
    const k = 0.95;
    const ox = -L.w * k / 2, oy = -5 * k + 1;
    let xb; // bar position in world x
    const xl = ox - 6, xr = ox + L.w * k + 6;
    if (t < 20.25) xb = xl;
    else if (t < 22) xb = lerp(xl, xr, eio(seg(t, 20.25, 21.75)));
    else if (t < 23) xb = lerp(xr, xl, eio(seg(t, 22.0, 22.75)));
    else xb = lerp(xl, xr, e5(seg(t, 23.0, 23.6)));
    const camZ = fit(24);
    const cam = { pos: [0, 0, camZ], tgt: [0, 0, 0], fov: 0.5, aperture: 0, focus: camZ };
    const off = buf(), on = buf(), ink = buf(), sp = buf();
    // dark lattice of unlit LEDs over the sign
    for (let x = Math.floor(xl) - 4; x <= xr + 4; x++) for (let y = -10; y <= 11; y++) {
      if (x < xb) continue;
      put(off, x, y, 0, 0.33, C.led, 1, 0.0, 3);
    }
    const cntr = (x) => (x < xb ? 100 : 0);
    textDots(on, L, { k, ox, oy }, (p) => {
      if (p.x < xb) return null;
      const fl = 1 + 0.15 * Math.sin(t * 40 + p.i);
      return { x: Math.round(p.x), y: Math.round(p.y), r: 0.33, c: C.led, e: 1.7 * fl, s: 3, z: 0.01 };
    });
    textDots(ink, L, { k, ox, oy, w: 520, col: C.ink, ball: C.red }, (p) => (p.x >= xb ? null : {}));
    // bar sparks
    for (let i = 0; i < 40; i++) {
      const y = -10 + i * 0.55, j = hash(i + Math.floor(t * 30) * 0.37);
      put(sp, xb + (j - 0.5) * 0.5, y, 0.1, 0.05 + j * 0.12, [1, 0.8, 0.7], 1, 4 * j, 6);
    }
    const vis = xb > xl + 0.1 && xb < xr - 0.1;
    return {
      t, cam, bg: fixedBg(hex("#0a0505"), hex("#020101")),
      layers: [
        quad({ pos: [(xb + -80) / 2, 0, -0.05], size: [Math.max(0.001, xb + 80), 40], color: C.paper, mode: 1 }),
        lay(off, { billboard: false }), lay(on, { billboard: false }), lay(ink, { billboard: false }),
        vis ? quad({ pos: [xb, 0, 0.05], size: [0.12, 40], color: [6, 3, 2.4], mode: 0, additive: true }) : null,
        vis ? lay(sp, { additive: true }) : null,
      ],
      post: { bloom: 0.8, thr: 1.0, vign: 0.5, grain: 0.016, flash: [1, 0.5, 0.4, pulse(t, 20, 12) * 0.5] },
      overlay(c) {
        const s = project(cam, null, [xb, 0, 0]);
        const lightLeft = s[0] > W * 0.45;
        hud(c, t, { col: lightLeft ? "rgba(20,20,26,0.7)" : "rgba(255,200,190,0.65)" });
        if (vis) {
          const v = Math.round(100 * cl((s[0] - 0) / W));
          txt(c, "CNTR", s[0] + 14, 150, { font: FONT(500, 13), col: "#ffd9cf", ls: 4 });
        }
        txt(c, "0 · MACHINE", W - 120, 150, { font: FONT(500, 14), col: "#ff9b85", ls: 4, align: "right", a: sm(seg(t, 20.1, 20.4)) * (s[0] < W - 260 ? 1 : 0) });
        txt(c, "100 · PEN", 120, 150, { font: FONT(500, 14), col: "#16161c", ls: 4, a: s[0] > 360 ? 1 : 0 });
        caption(c, t, 21.9, 23.85, "Contrast: from machine to pen.", "对比度：从机器到笔", { y: 930, col: s[0] > 700 ? "#16161c" : "#ffe1d8" });
      },
    };
  }

  // ---------------------------------------------------------------- 06 OPTICAL SIZE 24–28 (CRT)
  const OPS = [144, 96, 60, 36, 24, 16, 12];
  function S6(t) {
    const b = buf();
    const str = "Punctum Moderne";
    const L = layout(str, {});
    // sizes in world pitch: 144 px → 1.0
    let y = 25;
    const x0 = -32;
    const rows = [];
    OPS.forEach((px, i) => {
      const k = px / 144 * 0.95;
      const ta = 24.1 + i * 0.25;
      rows.push({ px, k, y, ta });
      if (t >= ta) {
        const f = opszF(px);
        const a = sm(seg(t, ta, ta + 0.06));
        textDots(b, L, { k, ox: x0, oy: y - 7 * k, f, w: 400 }, (p) => ({ c: C.amber, e: 1.4 * a * (1 + 0.6 * pulse(t, ta, 8)), s: 0, r: p.r }));
      }
      y -= Math.max(16 * k, 2.6) + 1.2;
    });
    // CRT power on/off: the picture collapses to a line, then a dot
    const on = e5(seg(t, 24.0, 24.28));
    const offY = 1 - ei(seg(t, 27.55, 27.78)), offX = 1 - ei(seg(t, 27.76, 27.95));
    const sy = Math.max(0.004, on * offY), sx = Math.max(0.002, offX);
    // camera: push into the 12 px line
    const z12 = rows[6];
    const u = eio(seg(t, 26.0, 26.9));
    const camZ0 = fit(56), camZ1 = fit(4.2);
    const cx = lerp(2, x0 + 4.5, u), cy = lerp(0, z12.y - 0.3, u);
    const cam = { pos: [cx, cy, lerp(camZ0, camZ1, u)], tgt: [cx, cy, 0], fov: 0.5, aperture: 0, focus: 30 };
    const model = M.trs([0, 0, 0], [0, 0, 0], [1, 1, 1]);
    const scr = M.trs([cx, cy, 0], [0, 0, 0], [sx, sy, 1]);
    const m2 = M.mul(scr, M.trs([-cx, -cy, 0]));
    const dot = buf();
    const lastDot = seg(t, 27.8, 28.0);
    if (offX < 1) put(dot, cx, cy, 0.1, 0.35 * (1 - lastDot * 0.5), [1, 1, 1], 1, 4 * (1 - offX) + 1, 6);
    return {
      t, cam,
      bg: fixedBg(hex("#0b0904"), hex("#010100"), { r: 0.9 }),
      layers: [quad({ model: M.mul(m2, M.trs([cx, cy, -0.1])), size: [200, 120], color: hex("#1a1407"), mode: 0, alpha: 0.6 }), lay(b, { model: m2, billboard: false }), lay(dot, { additive: true })],
      post: { bloom: 0.75, thr: 0.8, scan: 0.55, curve: 0.14, vign: 0.8, grain: 0.016, ca: 0.002, expo: 1 + (1 - on) * 3 + (1 - offY) * 2, flash: [1, 0.9, 0.7, pulse(t, 24, 16) * 0.2] },
      overlay(c) {
        if (sy < 0.5 && t > 27) return;
        hud(c, t, { col: "rgba(255,190,90,0.65)", lamp: S.amber, a: on });
        rows.forEach((r) => {
          if (t < r.ta || u > 0.2) return;
          const s = project(cam, null, [x0 - 2, r.y - 6 * r.k, 0]);
          txt(c, `opsz ${r.px}`, s[0], s[1], { font: FONT(500, 13), col: "#ffcf80", ls: 3, align: "right", a: (1 - u * 5) * sm(seg(t, r.ta, r.ta + 0.1)) });
        });
        caption(c, t, 26.6, 27.5, "At 12 px, the hairlines fatten.", "字越小，细线越饱满", { y: 930, col: "#ffd79a" });
      },
    };
  }

  // ---------------------------------------------------------------- 07 ONE GRID 28–36
  const KWORD = "LAVA Toyota";
  const KPAIRS = (() => {
    const L = layout(KWORD, { kern: false });
    const out = [];
    for (let i = 1; i < L.chars.length; i++) {
      const k = D.KR[L.chars[i - 1].nm + "\u0001" + L.chars[i].nm];
      if (k) out.push({ i, k });
    }
    return out;
  })();
  const ROWS7 = ["Punctum Moderne Didone", "Thin Light Regular Bold Black", "Slab Text Italic Swash", "wght 100 900 CNTR 0 100 opsz 12 144", "Roman & Italic one grid"];
  function S7(t) {
    const lt = t - 28;
    const lat = buf(), tx = buf();
    // camera: top-down → tilted crane
    const tilt = eio(seg(t, 31.6, 34.2));
    const graze = eio(seg(t, 34.0, 36));
    const sh = eio(seg(t, 35.0, 35.75));
    const dist = lerp(fit(64), 56, tilt);
    const ang = lerp(0, 1.05, tilt) + graze * 0.25;
    const yaw = tilt * 0.25 + graze * 0.2;
    const tgt = [graze * 10, lerp(6, 0, tilt), 0];
    const cam = {
      pos: [tgt[0] + Math.sin(yaw) * Math.sin(ang) * dist, tgt[1] - Math.cos(yaw) * Math.sin(ang) * dist, Math.cos(ang) * dist],
      tgt, up: [0, 0, 1], fov: 0.5, aperture: tilt * 0.9, focus: dist, cocMax: 50,
    };
    if (tilt < 0.001) cam.up = [0, 1, 0];
    else cam.up = [0, 0, 1];
    // lattice with guide rows
    const R = 64;
    for (let x = -R; x <= R; x++) for (let y = -24; y <= 30; y++) {
      const d = Math.hypot(x, y - 6);
      const g = sm((lt + 0.12) * 2.6 - d * 0.04);
      if (g <= 0) continue;
      const guide = (y === 0 || y === 7 || y === 10) && lt > 1.0 && lt < 4.0;
      const gx = x + (y - PIV) * TAN * sh;
      put(lat, gx, y, 0, guide ? 0.11 : 0.075, guide ? C.red : C.mint, (guide ? 0.9 : 0.33) * g, guide ? 0.3 : 0, 0);
    }
    // kerning word: unkerned → snap pair by pair on the beat
    if (t < 33.2) {
      const L = layout(KWORD, { kern: false });
      const shift = new Array(L.chars.length).fill(0);
      KPAIRS.forEach((p, j) => {
        const ta = 30.0 + j * 0.5;
        const m = e5(seg(t, ta, ta + 0.09));
        for (let i = p.i; i < shift.length; i++) shift[i] += p.k * m;
      });
      const a = sm(seg(t, 28.5, 28.9)) * (1 - sm(seg(t, 32.6, 33.1)));
      textDots(tx, L, { ox: -L.w / 2, oy: 1, w: 520, col: C.white, ball: C.red, emit: 0.35 }, (p) => ({ x: p.x + Math.round(shift[p.dt[3]] * 8) / 8 + (p.y - PIV) * TAN * sh, a }));
    }
    // stepping rows
    if (t >= 32.6) {
      const a = sm(seg(t, 32.6, 33.0));
      ROWS7.forEach((s, i) => {
        const L = layout(s, {});
        const dir = i % 2 ? -1 : 1;
        const sp = 8 + i * 4 + graze * 30;
        const step = Math.floor((t - 32.6) * sp) * dir;
        const ox = (dir > 0 ? -L.w - 10 : 10) + step - 0 + (dir > 0 ? 40 : -40);
        const oy = 22 - i * 13;
        textDots(tx, L, { ox, oy, w: 450, col: C.white, ball: C.red, emit: 0.3 }, (p) => ({ x: p.x + (p.y - PIV) * TAN * sh, a }));
      });
    }
    // the CRT's last dot, carried across the cut: it seeds the grid's ripple, then cools
    const seed = buf(), sk = 1 - e5(seg(t, 28.0, 28.55));
    if (sk > 0) put(seed, 0, 6, 0.1, 0.35 * lerp(0.4, 1, sk) * fit(64) / fit(4.2) * 0.12, [1, 1, 1], 1, 3.5 * sk, 6);
    return {
      t, cam, bg: fixedBg(hex("#07100b"), hex("#010302"), { r: 1.3 }),
      layers: [lay(lat, { billboard: false }), lay(tx, { billboard: false }), lay(seed, { additive: true })],
      post: { bloom: 0.55, thr: 0.9, vign: 0.6, grain: 0.016, sort: seg(t, 35.4, 36) * 0.35, glitch: seg(t, 35.6, 36) * 0.4, seed: Math.floor(t * 24), flash: [0.8, 1, 0.9, pulse(t, 28, 10) * 0.12] },
      overlay(c) {
        hud(c, t, { col: "rgba(190,230,200,0.7)" });
        if (lt > 1.0 && lt < 4.0) {
          const a = sm(seg(lt, 1.0, 1.3)) * (1 - sm(seg(lt, 3.6, 4.0)));
          [[0, "BASELINE"], [7, "X-HEIGHT  7"], [10, "CAP HEIGHT  10"]].forEach(([y, s]) => {
            const p = project(cam, null, [-54, y, 0]);
            txt(c, s, p[0] - 10, p[1] + 5, { font: FONT(500, 13), col: S.red, ls: 3, align: "right", a });
          });
          const p1 = project(cam, null, [24, -3, 0]), p2 = project(cam, null, [25, -3, 0]);
          c.save(); c.globalAlpha = a; c.strokeStyle = S.mint; c.beginPath(); c.moveTo(p1[0], p1[1] + 14); c.lineTo(p1[0], p1[1] + 22); c.lineTo(p2[0], p2[1] + 22); c.lineTo(p2[0], p2[1] + 14); c.stroke(); c.restore();
          txt(c, "1 PITCH = 1/16 EM", p2[0] + 14, p2[1] + 27, { font: FONT(500, 13), col: S.mint, ls: 3, a });
        }
        // kern tags
        KPAIRS.forEach((pr, j) => {
          const ta = 30.0 + j * 0.5;
          if (t < ta || t > 33) return;
          const L = layout(KWORD, { kern: false });
          const ch = L.chars[pr.i];
          const p = project(cam, null, [-L.w / 2 + ch.x - 0.5, 13.2, 0]);
          const a = sm(seg(t, ta, ta + 0.08)) * (1 - sm(seg(t, 32.6, 33)));
          txt(c, (pr.k > 0 ? "+" : "−") + Math.abs(pr.k), p[0], p[1], { font: FONT(600, 22), col: S.red, a, align: "center" });
        });
        caption(c, t, 30.1, 32.4, "Kerning moves in whole dots.", "字距按整点移动，网格从不断开", { y: 930, col: "#e9f5ec" });
        caption(c, t, 33.4, 35.3, "One pitch is 1/16 em. Every line is 16.", "一个点距是 1/16 em，每一行正好 16 个点距", { y: 930, col: "#e9f5ec" });
      },
    };
  }

  // ---------------------------------------------------------------- 08 ITALIC 36–46
  const MORPH = (() => {
    const s = "Italique";
    const LR = layout(s, {}), LI = layout(s, { it: true });
    const out = [];
    for (let ci = 0; ci < LR.chars.length; ci++) {
      const rd = LR.dots.filter((d) => d[3] === ci), id = LI.dots.filter((d) => d[3] === ci);
      const used = new Set();
      const pairs = [];
      for (const d of id) {
        let bi = -1, bd = 2.6;
        rd.forEach((r, j) => { if (used.has(j)) return; const dd = Math.hypot(r[0] - LR.chars[ci].x - (d[0] - LI.chars[ci].x), r[1] - d[1]); if (dd < bd) { bd = dd; bi = j; } });
        if (bi >= 0) { used.add(bi); pairs.push([rd[bi], d]); } else pairs.push([null, d]);
      }
      rd.forEach((r, j) => { if (!used.has(j)) pairs.push([r, null]); });
      out.push(...pairs);
    }
    return { pairs: out, wR: LR.w, wI: LI.w };
  })();
  const SIXTEEN = "adfhiklmnpqruvwy";
  function S8(t) {
    const layers = [];
    const sp = buf(), lat = buf();
    let cam, post = { bloom: 0.7, thr: 0.95, vign: 0.6, grain: 0.016 };
    const bg = fixedBg(hex("#0d1430"), hex("#02030a"), { r: 1.2 });
    const lightDir = [-0.5, 0.75, 0.75];
    const sh = eio(seg(t, 36.2, 37.0));
    let over = () => {};
    if (t < 38) {
      const m = eio(seg(t, 37.0, 37.7));
      const k = 1;
      const ox = -lerp(MORPH.wR, MORPH.wI, m) / 2;
      for (const [r, i] of MORPH.pairs) {
        const a = r ? [r[0], r[1], r[2]] : [i[0], i[1], 0];
        const b = i ? [i[0], i[1], i[2]] : [r[0], r[1], 0];
        const x = lerp(a[0], b[0], m), y = lerp(a[1], b[1], m);
        let rr = lerp(r ? rad(a[2], 450) : 0, i ? rad(b[2], 450) : 0, m);
        const ball = (i && i[2] > 1.1 && m > 0.5) || (r && r[2] > 1.1 && m < 0.5);
        put(sp, ox + x + (y - PIV) * TAN * sh, y - 4, 0, rr, ball ? C.gold : C.white, 1, ball ? 1.2 : 0.06, 1);
      }
      for (let x = -40; x <= 40; x++) for (let y = -12; y <= 14; y++) put(lat, x + (y + 4 - PIV) * TAN * sh, y, -0.3, 0.06, [0.4, 0.45, 0.7], 0.3 * sm(seg(t, 36, 36.4)), 0, 0);
      const yaw = Math.sin((t - 36) * 0.5) * 0.18;
      const d = fit(36);
      cam = { pos: [Math.sin(yaw) * d, 1, Math.cos(yaw) * d], tgt: [0, 0, 0], fov: 0.5, aperture: 0.25, focus: d };
      post.flash = [0.6, 0.7, 1, pulse(t, 36, 9) * 0.3];
      over = (c) => {
        txt(c, `${(Math.atan(TAN * sh) * 180 / Math.PI).toFixed(1)}°`, 120, 230, { font: FONT(300, 84, true), col: S.white, a: 0.9 });
        txt(c, "LATTICE SHEAR", 126, 268, { font: FONT(500, 14), col: S.white, ls: 4, a: 0.65 });
        caption(c, t, 37.2, 37.9, "The grid leans. The letters begin to write.", "点阵被推斜，字母开始书写", { y: 930, it: true });
      };
    } else if (t < 40) {
      const cols = 8;
      SIXTEEN.split("").forEach((ch, j) => {
        const ta = 38.0 + j * 0.0625 + (j >= 8 ? 0.25 : 0);
        const m = eio(seg(t, ta + 0.25, ta + 0.6));
        const LR = layout(ch, {}), LI = layout(ch, { it: true });
        const cx = (j % cols - (cols - 1) / 2) * 11, cy = j < cols ? 4.5 : -12.5;
        const ap = back(seg(t, ta, ta + 0.25));
        for (const [L, w8, isI] of [[LR, 1 - m, false], [LI, m, true]]) {
          if (w8 <= 0.01) continue;
          for (const d of L.dots) {
            const x = cx - L.w / 2 + d[0] + (isI ? (d[1] - PIV) * TAN : 0), y = cy + d[1];
            const ball = d[2] > 1.1;
            put(sp, x, y, 0, rad(d[2], 450) * w8 * ap, ball ? C.gold : C.white, 1, ball ? 1.2 : 0.05, 1);
          }
        }
      });
      const pan = (t - 38) * 0.9;
      const d = fit(58);
      cam = { pos: [pan - 1, -3, d], tgt: [pan - 1, -3, 0], fov: 0.5, aperture: 0, focus: d };
      over = (c) => caption(c, t, 38.3, 39.8, "Sixteen lowercase, redrawn as a cursive.", "十六个小写，重画成书写体", { y: 960, it: true });
    } else if (t < 44) {
      // swash R drawn in light, then the line
      const reveal = t < 42;
      const L = layout(reveal ? "R" : "Rendezvous\nat Midnight", { it: true, sw: true, align: "c", lead: 17 });
      const order = L.dots.map((d, i) => ({ d, i, o: d[0] + d[1] * 0.25 })).sort((a, b) => a.o - b.o);
      const rank = new Map(order.map((q, j) => [q.i, j]));
      const n = L.dots.length;
      let head = 0;
      L.dots.forEach((d, i) => {
        const ta = reveal ? 40.05 + rank.get(i) / n * 1.6 : 42.0 + hash(i) * 0.4;
        if (t < ta) return;
        const x = d[0] + (d[1] - PIV) * TAN, y = d[1] - (reveal ? 4.5 : -3);
        const ball = d[2] > 1.1;
        const fl = pulse(t, ta, 6);
        if (reveal && fl > 0.5) head = Math.max(head, x);
        put(sp, x, y, 0, rad(d[2], reveal ? 480 : 520) * back(seg(t, ta, ta + 0.25), 2.5), ball ? C.gold : mixc(C.white, C.gold, fl), 1, (ball ? 1.4 : 0.05) + fl * 2.5, 1);
      });
      if (reveal) {
        const u = seg(t, 40.0, 41.8);
        const fx = lerp(-9, 8, eio(u));
        const d = lerp(fit(15), fit(24), eio(seg(t, 41.2, 42)));
        cam = { pos: [fx * 0.6, 0.5, d], tgt: [fx * 0.6, -0.5, 0], fov: 0.5, aperture: 0.8, focus: d, cocMax: 70 };
        over = (c) => {
          const a = sm(seg(t, 40.2, 40.5));
          txt(c, "R.swsh", 120, 300, { font: FONT(300, 96, true), col: S.gold, a });
          txt(c, "ENTRY BALL  ·  HAIRLINE ARCH  ·  BALL EXIT", 126, 345, { font: FONT(500, 14), col: S.white, ls: 4, a: a * 0.7 });
        };
      } else {
        const d = fit(62);
        const u = eo(seg(t, 42, 44));
        cam = { pos: [0, 1, d * lerp(1.12, 1, u)], tgt: [0, 0.5, 0], fov: 0.5, aperture: 0.1, focus: d };
        post.flash = [1, 0.85, 0.6, pulse(t, 42, 10) * 0.5];
        over = (c) => caption(c, t, 42.3, 43.8, "Twenty-six swash capitals.  swsh · ss01", "二十六个花式大写", { y: 960, it: true, col: "#ffe2b8" });
      }
    } else {
      const AZ = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      const cols = 9;
      AZ.split("").forEach((ch, j) => {
        const ta = 44.0 + j * 0.05;
        if (t < ta) return;
        const L = layout(ch, { it: true, sw: true });
        const cx = (j % cols - (cols - 1) / 2) * 13.5, cy = 15 - Math.floor(j / cols) * 17;
        const fall = ei(seg(t, 45.55 + (j % cols) * 0.02, 45.95));
        for (const d of L.dots) {
          const x = cx - L.w / 2 + d[0] + (d[1] - PIV) * TAN, y = cy + d[1] - 4 - fall * 40 * (1 + hash(j));
          const ball = d[2] > 1.1;
          put(sp, x, y, fall * -10, rad(d[2], 480) * back(seg(t, ta, ta + 0.2)), ball ? C.gold : C.white, 1, (ball ? 1.3 : 0.05) + pulse(t, ta, 8) * 2, 1);
        }
      });
      const d = fit(86);
      cam = { pos: [2, -2, d], tgt: [2, -2, 0], fov: 0.5, aperture: 0, focus: d, up: [Math.sin((t - 44) * 0.05), 1, 0] };
      over = (c) => txt(c, "A — Z  ·  .swsh", 120, H - 110, { font: FONT(500, 14), col: S.gold, ls: 4, a: sm(seg(t, 44, 44.3)) });
    }
    layers.push(lay(lat, { billboard: false }), lay(sp, { sort: true, light: lightDir, envTop: [0.35, 0.4, 0.75], envBot: [0.02, 0.02, 0.05] }));
    return {
      t, cam, bg, layers, post,
      overlay(c) { hud(c, t, { col: "rgba(200,210,255,0.68)", lamp: S.gold }); over(c); },
    };
  }

  // ---------------------------------------------------------------- 09 CHARACTER SET 46–54 (split-flap)
  const COLS = 22, ROWS = 3;
  const BOARD = [
    [46.0, ["266", "CHARACTERS", "36 LANGUAGES"]],
    [47.0, ["POLSKI", "PCHNĄĆ W TĘ ŁÓDŹ", "JEŻA LUB OŚM SKRZYŃ"]],
    [48.0, ["ČEŠTINA", "PŘÍLIŠ ŽLUŤOUČKÝ", "KŮŇ ÚPĚL ĎÁBELSKÉ ÓDY"]],
    [49.0, ["MAGYAR", "ÁRVÍZTŰRŐ", "TÜKÖRFÚRÓGÉP"]],
    [50.0, ["TÜRKÇE", "PIJAMALI HASTA YAĞIZ", "ŞOFÖRE ÇABUCAK GÜVENDİ"]],
    [51.0, ["LIETUVIŲ", "ĮLINKDAMA ŠPAGA", "PRAGRĘŽĖ ARBŪZĄ"]],
    [52.0, ["HRVATSKI", "GOJAZNI ĐAČIĆ", "S BICIKLOM DRŽI HMELJ"]],
    [53.0, ["ROMAN & ITALIC", "LATIN EXTENDED-A", "© ™ § ¶ ± ÷ ¢ ¥"]],
  ];
  const FLAPSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ĄČĘŁŃŚŹŻŮÁÉÍÓÚŐŰÇŞĞÜÖ";
  const center = (s) => { const a = [...s]; const pad = Math.floor((COLS - a.length) / 2); const out = new Array(COLS).fill(" "); a.forEach((ch, i) => { if (pad + i < COLS) out[pad + i] = ch; }); return out; };
  const BOARDC = BOARD.map(([t0, rows]) => [t0, rows.map(center)]);
  function S9(t) {
    const tw = 11.6, th = 19;
    const bw = COLS * tw, bh = ROWS * th;
    const tiles = [], b = buf();
    let si = 0;
    for (let i = 0; i < BOARDC.length; i++) if (t >= BOARDC[i][0]) si = i;
    for (let r = 0; r < ROWS; r++) for (let col = 0; col < COLS; col++) {
      const cx = -bw / 2 + (col + 0.5) * tw, cy = bh / 2 - (r + 0.5) * th;
      const delay = col * 0.007 + r * 0.03 + hash(r * 31 + col) * 0.03;
      const cur = BOARDC[si][1][r][col], prev = si > 0 ? BOARDC[si - 1][1][r][col] : " ";
      const t0 = BOARDC[si][0] + delay;
      let ch = cur, phase = 0;
      const flips = cur === prev ? 0 : 2 + Math.floor(hash(r * 7 + col * 3 + si) * 2);
      const fd = 0.05;
      const u = (t - t0) / fd;
      if (t < 46.0 + delay) { ch = " "; }
      else if (flips && u < flips) {
        const k = Math.max(0, Math.floor(u));
        ch = k === flips - 1 ? cur : FLAPSET[Math.floor(hash(r * 13 + col * 17 + k + si * 5) * FLAPSET.length)];
        phase = u - Math.floor(u);
        if (u < 0) { ch = prev; phase = 0; }
      }
      const sq = Math.abs(Math.cos(phase * Math.PI)); // flap squash
      tiles.push(quad({ pos: [cx, cy, 0], size: [tw - 0.7, th - 0.8], color: hex("#1b1b1f"), mode: 4, p: [0.9, 0, 0, 0] }));
      if (ch !== " ") {
        const L = layout(ch, {});
        const gy = cy - 5 + 0.5;
        textDots(b, L, { ox: cx - L.w / 2, oy: 0, w: 520, col: C.cream, ball: C.red }, (p) => ({ y: cy + (p.dt[1] - 5) * sq, z: 0.05, c: p.ball ? C.red : mixc(C.cream, [0.3, 0.3, 0.3], 1 - sq), e: 0.08 }));
      }
    }
    // hinge lines
    for (let r = 0; r < ROWS; r++) tiles.push(quad({ pos: [0, bh / 2 - (r + 0.5) * th, 0.03], size: [bw, 0.12], color: hex("#050506"), mode: 0 }));
    const u = eio(seg(t, 46, 54));
    const yaw = lerp(-0.2, 0.2, u), pitch = lerp(0.08, -0.05, u);
    const d = lerp(fit(185), fit(166), eio(seg(t, 46.0, 50))) * lerp(1, 1.08, eio(seg(t, 51.8, 54)));
    const tgt = [lerp(-4, 4, u), -5, 0];
    const cam = { pos: [tgt[0] + Math.sin(yaw) * d, tgt[1] + Math.sin(pitch) * d, Math.cos(yaw) * d], tgt, fov: 0.5, aperture: 0.35, focus: d, cocMax: 30 };
    return {
      t, cam, bg: fixedBg(hex("#141416"), hex("#030304"), { r: 1.2 }),
      layers: [quad({ pos: [0, 0, -0.2], size: [bw + 6, bh + 6], color: hex("#0c0c0e"), mode: 4, p: [1.5, 0, 0, 0] }), ...tiles, lay(b, { billboard: false })],
      post: { bloom: 0.25, thr: 1.2, vign: 0.65, grain: 0.017, flash: [1, 1, 1, pulse(t, 46, 12) * 0.22] },
      overlay(c) {
        hud(c, t, {});
        caption(c, t, 46.3, 49.6, "266 characters. 36 languages.", "266 个字符，覆盖 36 种语言", { y: 960 });
        caption(c, t, 50.2, 53.6, "Every accent drawn dot by dot.", "每一个变音符号，都逐点画出", { y: 960 });
      },
    };
  }

  // ---------------------------------------------------------------- 10 IN USE 54–62
  // 54–56: a nine-pin printer, staged for real: green-bar paper wrapped over the platen,
  // a carriage that strikes each column through a ribbon, line feeds that roll the print up the cylinder.
  const PS = 0.14, PLH = 15 * PS, PRC = 4.2, PHI_M = 1.15, PAPER_W = 40;
  const PLINES = [
    ["Thin  Light  Regular  Bold  Black", null, 0, 1],
    ["Slab  Text  Italic  ·  54 styles", null, 0, -1],
    ["PUNCTUM MODERNE", 54.04, 0.5, 1],
    ["Roman & Italic  ·  266 glyphs", 54.66, 0.56, -1],
    ["wght  CNTR  opsz  ·  SIL OFL 1.1", 55.36, 0.52, 1],
  ].map(([s, t0, d, dir], i) => {
    const L = layout(s, {});
    const x0 = -15.5;
    return { s, L, t0, d, dir, i, x0, xa: x0 - 0.6, xb: x0 + L.w * PS + 0.6, feed: t0 === null ? -1 : t0 + d + 0.03 };
  });
  const PFEEDS = PLINES.map((l) => l.feed);
  function pFeed(t) { // paper advance (arc length)
    let f = 0;
    for (const ft of PFEEDS) f += ft < 0 ? PLH : PLH * e5(seg(t, ft, ft + 0.085));
    return f;
  }
  function arcPos(a) { // arc length on the paper path → [y, z, surface angle]
    if (a <= PRC * PHI_M) { const ph = a / PRC; return [PRC * Math.sin(ph), PRC * (Math.cos(ph) - 1), -ph]; }
    const e = a - PRC * PHI_M, y0 = PRC * Math.sin(PHI_M), z0 = PRC * (Math.cos(PHI_M) - 1);
    return [y0 + Math.cos(PHI_M) * e, z0 - Math.sin(PHI_M) * e, -PHI_M];
  }
  function headX(t) {
    for (const l of PLINES) {
      if (l.t0 === null) continue;
      if (t < l.t0) return l.dir > 0 ? l.xa : l.xb;
      if (t <= l.t0 + l.d + 0.06) { const u = seg(t, l.t0, l.t0 + l.d); return l.dir > 0 ? lerp(l.xa, l.xb, u) : lerp(l.xb, l.xa, u); }
    }
    const l = PLINES[PLINES.length - 1];
    return l.dir > 0 ? l.xb : l.xa;
  }
  const INK = hex("#22263a");
  function printerShot(t) {
    const lt = t - 54;
    const F = pFeed(t), hx = headX(t);
    const layers = [];
    const lamp = [-6, 7, 7, 16], light = [-0.35, 0.8, 0.5];
    // the paper, in strips around the platen
    for (let a = -6; a < 30; a += 0.12) {
      const [y, z, r] = arcPos(a + 0.06);
      layers.push(quad({ model: M.trs([0, y, z], [r, 0, 0]), size: [PAPER_W, 0.13], color: hex("#f4f1e8"), color2: hex("#d3e9d6"),
        mode: 3, p: [a - F + 50, PLH * 2, 2.4, 1.27], shade: 0.9, light, lamp, lampK: 0.55 }));
    }
    // ink
    const ink = buf();
    for (const l of PLINES) {
      const printedAt = l.t0 === null ? -1 : l.t0;
      if (printedAt > t) continue;
      const fi = l.i * PLH;           // feed state when this line was struck
      const mis = l.dir < 0 ? 0.035 : 0;
      for (let q = 0; q < l.L.dots.length; q++) {
        const d = l.L.dots[q];
        const x = l.x0 + d[0] * PS + mis;
        if (l.t0 !== null && t < l.t0 + l.d + 0.06 && (l.dir > 0 ? x > hx : x < hx)) continue;
        const a = (d[1] - 4) * PS - fi + F - PLH * 2 + PLH * 2;
        const [y, z, r] = arcPos(a);
        const h = hash(q * 1.7 + l.i * 31);
        put(ink, x, y, z + 0.004, PS * 0.6 * (0.95 + 0.1 * h), INK, 0.9 + 0.1 * h, 0, 7, h * 10, r);
      }
    }
    layers.push(lay(ink, { billboard: false, multiply: true }));
    // ribbon across the print line, the bail bar above, the chassis below
    layers.push(quad({ model: M.trs([0, -1.05, 0.14]), size: [PAPER_W + 4, 0.55], color: hex("#141519"), mode: 6, shade: 0.6, light, lamp, lampK: 0.4 }));
    const [by, bz] = arcPos(PRC * 0.95);
    layers.push(quad({ model: M.trs([0, by + 0.05, bz + 0.45], [-0.95, 0, 0]), size: [PAPER_W + 6, 0.22], color: hex("#9a9ea6"), color2: [1.2, 1.2, 1.2], mode: 7, p: [0, 0, 0, 0], shade: 0.8, light, lamp, lampK: 0.4 }));
    for (const rx of [-11, -3, 5, 13]) layers.push(quad({ model: M.trs([rx, by + 0.05, bz + 0.5], [-0.95, 0, 0]), size: [1.1, 0.5], color: hex("#1b1b1d"), mode: 4, p: [0.2, 0, 0, 0], shade: 0.6, light }));
    layers.push(quad({ model: M.trs([0, -6.7, 3.4]), size: [70, 8.2], color: hex("#1a1b1f"), mode: 1, shade: 0.4, light, lamp, lampK: 0.6 }));
    layers.push(quad({ model: M.trs([0, -2.62, 3.41]), size: [70, 0.06], color: [0.55, 0.55, 0.58], mode: 0 }));
    // carriage: side faces, top, front plate, pin nose
    const hz0 = 0.3, hz1 = 2.2, hy0 = -2.4, hy1 = 0.75, hw = 1.25;
    const body = hex("#2c2f35"), hl = [0.9, 0.92, 1.0];
    layers.push(quad({ model: M.trs([hx - hw / 2, (hy0 + hy1) / 2, (hz0 + hz1) / 2], [0, -Math.PI / 2, 0]), size: [hz1 - hz0, hy1 - hy0], color: body, mode: 7, color2: hl, shade: 0.8, light, lamp, lampK: 0.4 }));
    layers.push(quad({ model: M.trs([hx + hw / 2, (hy0 + hy1) / 2, (hz0 + hz1) / 2], [0, Math.PI / 2, 0]), size: [hz1 - hz0, hy1 - hy0], color: body, mode: 7, color2: hl, shade: 0.8, light, lamp, lampK: 0.4 }));
    layers.push(quad({ model: M.trs([hx, hy1, (hz0 + hz1) / 2], [-Math.PI / 2, 0, 0]), size: [hw, hz1 - hz0], color: hex("#3a3e46"), mode: 7, color2: hl, shade: 0.9, light, lamp, lampK: 0.4 }));
    layers.push(quad({ model: M.trs([hx, (hy0 + hy1) / 2, hz1]), size: [hw, hy1 - hy0], color: hex("#23262b"), mode: 7, color2: hl, p: [0, 0, 0, 0], shade: 0.7, light, lamp, lampK: 0.45 }));
    layers.push(quad({ model: M.trs([hx, -0.35, hz0 - 0.05]), size: [0.5, 1.5], color: hex("#0e0f11"), mode: 4, p: [0.1, 0, 0, 0] }));
    // a little label on the carriage
    const cx = lerp(-9.5, -2.5, eio(seg(t, 54, 56)));
    const cam = { pos: [cx + 4.5, 5.2 - lt * 0.3, 17.5], tgt: [cx, 1.0, -0.8], fov: 0.5, aperture: 0.9, focus: 18.3, cocMax: 30 };
    return { cam, layers, bg: fixedBg(hex("#121316"), hex("#050506")), post: { bloom: 0.15, thr: 1.3, vign: 0.6, grain: 0.016 } };
  }

  const SHOTS = ["9-PIN PRINTER", "POSTER", "WATCH", "PERFUME", "SIGNAGE", "MENU", "CARD"];
  const SHOT_T = [54, 56, 57, 58, 59, 60, 61];
  function S10(t) {
    let i = 0;
    for (let k = 0; k < SHOT_T.length; k++) if (t >= SHOT_T[k]) i = k;
    const lt = t - SHOT_T[i];
    const b = buf(), b2 = buf();
    let cam, layers = [], bg, post = { bloom: 0.4, thr: 1.1, vign: 0.55, grain: 0.016 }, hudCol = "rgba(246,243,236,0.7)", label = SHOTS[i];
    const punch = 1 - e5(seg(lt, 0, 0.5)); // push-in on every cut
    const stdCam = (h, roll = 0, x = 0, y = 0) => { const d = fit(h) * (1 + punch * 0.25); return { pos: [x, y, d], tgt: [x, y, 0], fov: 0.5, aperture: 0, focus: d, up: [Math.sin(roll), Math.cos(roll), 0] }; };
    if (i === 0) {
      const P = printerShot(t);
      cam = P.cam; layers = P.layers; bg = P.bg; post = P.post;
    } else if (i === 1) {
      const L = layout("Punto\nper punto", { lead: 14, align: "c" });
      const k = 0.9;
      textDots(b, L, { k, ox: 0, oy: 2, w: 900, col: C.cream, ball: C.red, emit: 0.05 });
      cam = stdCam(30, 0.04 * punch, 0, -2);
      bg = fixedBg(hex("#121214"), hex("#060607"));
      layers = [lay(b, { billboard: false })];
    } else if (i === 2) {
      // watch face
      const R0 = 14;
      for (let m = 0; m < 60; m++) {
        const a = m / 60 * Math.PI * 2;
        const hr = m % 5 === 0;
        put(b, Math.sin(a) * R0, Math.cos(a) * R0, 0, hr ? 0.42 : 0.16, m === 0 ? C.red : C.cream, 1, hr ? 0.2 : 0, 0);
      }
      const hrA = (lt * 2.2 + 0.3) * Math.PI * 2 / 12 * 3, mnA = lt * Math.PI * 2 * 1.8;
      for (let s = 1; s <= 8; s++) put(b, Math.sin(hrA) * s, Math.cos(hrA) * s, 0.02, 0.36, C.cream, 1, 0.1, 0);
      for (let s = 1; s <= 12; s++) put(b, Math.sin(mnA) * s, Math.cos(mnA) * s, 0.03, s === 12 ? 0.45 : 0.24, s === 12 ? C.red : C.cream, 1, 0.1, 0);
      put(b, 0, 0, 0.05, 0.6, C.red, 1, 0.3, 0);
      const L = layout("Orologio", {});
      textDots(b, L, { k: 0.32, ox: -L.w * 0.32 / 2, oy: -7.5, w: 600, col: C.cream, ball: C.red });
      cam = stdCam(34, -0.08 + punch * 0.1);
      bg = fixedBg(hex("#17110d"), hex("#040302"));
      layers = [quad({ pos: [0, 0, -0.12], size: [34.6, 34.6], color: hex("#6b5a48"), mode: 4, p: [17.3, 0, 0, 0] }),
        quad({ pos: [0, 0, -0.1], size: [33, 33], color: hex("#211812"), mode: 4, p: [16.5, 0, 0, 0] }), lay(b, { billboard: false })];
    } else if (i === 3) {
      const L = layout("Violetta", { it: true, sw: true });
      textDots(b, L, { ox: -L.w / 2 - 3, oy: -4, w: 600, col: hex("#f1e6ff"), ball: hex("#ffd28a"), sh: 1, emit: 0.05, style: 1 });
      const yaw = (lt - 0.5) * 0.5;
      const d = fit(34);
      cam = { pos: [Math.sin(yaw) * d, 2, Math.cos(yaw) * d * (1 + punch * 0.2)], tgt: [0, 0, 0], fov: 0.5, aperture: 0.6, focus: d };
      bg = fixedBg(hex("#5a3d8f"), hex("#170c2a"), { c: [0.45, 0.6] });
      layers = [lay(b, { sort: true, light: [-0.4, 0.8, 0.6], envTop: [0.8, 0.7, 1.0], envBot: [0.1, 0.05, 0.2] })];
      post.bloom = 0.5;
    } else if (i === 4) {
      const L = layout("Binario 3", {});
      textDots(b, L, { ox: -L.w / 2 - 6, oy: 0, w: 650, c: 60, col: C.white, ball: hex("#ffd400"), emit: 0.6 });
      for (let s = 0; s < 9; s++) put(b, L.w / 2 + 2 + s, 4, 0, 0.4, hex("#ffd400"), 1, 0.8, 0);
      for (let s = 1; s < 4; s++) { put(b, L.w / 2 + 10 - s, 4 + s, 0, 0.4, hex("#ffd400"), 1, 0.8, 0); put(b, L.w / 2 + 10 - s, 4 - s, 0, 0.4, hex("#ffd400"), 1, 0.8, 0); }
      const L2 = layout("Segnaletica · Platform", {});
      textDots(b, L2, { k: 0.35, ox: -L.w / 2 - 6, oy: -8, w: 500, c: 60, col: C.white, emit: 0.4 });
      cam = stdCam(38, 0, 2, 0);
      cam.pos[0] -= 4 * (1 - lt); cam.tgt[0] = cam.pos[0] + 2;
      bg = fixedBg(hex("#0f3424"), hex("#05140d"));
      layers = [lay(b, { billboard: false })];
    } else if (i === 5) {
      const L = layout("Osteria\ndel Punto", { it: true, sw: true, align: "c", lead: 15 });
      textDots(b, L, { k: 0.8, ox: 0, oy: 6, w: 520, col: hex("#1d1a1e"), ball: C.red, sh: 1, style: 7 });
      const items = ["Risotto al nero ..... 18", "Tagliolini ......... 16", "Torta di pere ....... 9"];
      items.forEach((s, j) => { const Li = layout(s, {}); textDots(b2, Li, { k: 0.3, ox: -Li.w * 0.15, oy: -8 - j * 5, f: 0.9, w: 450, col: hex("#1d1a1e"), ball: C.red, style: 7 }); });
      const model = M.trs([0, 0, 0], [-0.35, 0, 0.12 - lt * 0.08], 1);
      const lamp = [-14, 16, 14, 40], light = [-0.4, 0.7, 0.6];
      layers = [quad({ model: M.mul(model, M.trs([1.2, -1.6, -0.3])), size: [46, 58], color: [0, 0, 0], alpha: 0.55, mode: 8, p: [2.5, 0, 0, 0] }),
        quad({ model: M.mul(model, M.trs([0, 0, -0.05])), size: [44, 56], color: C.paper, mode: 1, shade: 0.7, light, lamp, lampK: 0.5 }),
        lay(b, { model, billboard: false, multiply: true }), lay(b2, { model, billboard: false, multiply: true })];
      cam = { pos: [0, -6, fit(36) * (1 + punch * 0.2)], tgt: [0, -1, 0], fov: 0.5, aperture: 0.1, focus: fit(36) };
      bg = fixedBg(hex("#2a2622"), hex("#0c0a08"));
    } else {
      const flip = eio(seg(lt, 0.35, 0.75));
      const model = M.trs([0, 0, 0], [0.25 - lt * 0.2, flip * Math.PI + (lt - 0.5) * 0.4, -0.1], 1);
      const L = layout("Studio Punto", {});
      if (flip < 0.5) textDots(b, L, { k: 0.34, ox: -L.w * 0.17, oy: -1.2, w: 500, col: hex("#2c2a2e"), ball: C.red, style: 7 }, (p) => ({ z: 0.06 }));
      else put(b, 0, 0, -0.06, 0.9, C.red, 1, 0, 7, 3);
      const light = [-0.4, 0.7, 0.6];
      layers = [quad({ model: M.mul(M.trs([1.5, -2.2, -6]), model), size: [36, 22], color: [0, 0, 0], alpha: 0.6, mode: 8, p: [2.2, 0, 0, 0] }),
        quad({ model, size: [34, 20], color: C.cream, mode: 1, shade: 0.85, light, lamp: [-10, 12, 18, 40], lampK: 0.4 }), lay(b, { model, billboard: false, multiply: true })];
      cam = { pos: [0, 0, fit(30) * (1 + punch * 0.2)], tgt: [0, 0, 0], fov: 0.5, aperture: 0.2, focus: fit(30) };
      bg = fixedBg(hex("#2b2b2e"), hex("#08080a"));
    }
    // stutter + flash on each cut
    post.glitch = Math.max(post.glitch || 0, pulse(lt, 0, 22) * 0.5);
    post.seed = Math.floor(t * 30);
    post.ca = 0.004 * pulse(lt, 0, 12);
    post.flash = [1, 1, 1, pulse(lt, 0, 25) * 0.18];
    return {
      t, cam, bg, layers, post,
      overlay(c) {
        hud(c, t, { col: hudCol });
        const lc = hudCol;
        txt(c, `IN USE  ${String(i + 1).padStart(2, "0")} / 07`, 120, 150, { font: FONT(500, 13), col: lc, ls: 4 });
        txt(c, label, 120, 176, { font: FONT(600, 22), col: lc, ls: 5 });
        if (i === 0) caption(c, t, 54.25, 55.9, "Set in Punctum Moderne.", "用 Punctum Moderne 排出来", { y: 960, col: "#f6f3ec" });
      },
    };
  }

  // ---------------------------------------------------------------- 11 SIGNAL 62–68 (a corridor of type → the wordmark)
  const WORD = layout("Punctum Moderne", {});
  const LANES = ["PUNCTUM MODERNE  ·  ", "ROMAN & ITALIC  ·  ", "266 GLYPHS  ·  ", "WGHT 100 900  ·  ", "CNTR 0 100  ·  ",
    "OPSZ 12 144  ·  ", "26 SWASH CAPITALS  ·  ", "ONE GRID  ·  ", "SIL OFL 1.1  ·  ", "FREE & OPEN  ·  ",
    "THIN LIGHT REGULAR BOLD BLACK  ·  ", "SLAB  ·  TEXT  ·  ITALIC  ·  ", "36 LANGUAGES  ·  ", "1/16 EM  ·  ", "DIDONE  ·  DOT MATRIX  ·  ", "54 STYLES  ·  "].map((s) => layout(s.repeat(Math.ceil(900 / (s.length * 8))), {}));
  const TS = 0.22, TR = 9, ZC = fit(44);
  function travel(t) { // distance flown, accelerating into the fold
    const lt = Math.max(0, t - 62), u = seg(t, 62, 63.4);
    return 22 * lt + 150 * (u < 1 ? 1.4 * Math.pow(u, 4) / 4 : 0.35 + (t - 63.4));
  }
  function laneDot(j, d, t, extraR = 0) { // world position of a lane dot at time t
    const L = LANES[j];
    const per = (L.w + 1) * TS;
    let zr = -((((d[0] * TS - travel(t)) % per) + per) % per) + 3;
    const ang = j / LANES.length * Math.PI * 2 + (t - 62) * 0.32 + (d[1] - 5) * TS / TR;
    const R = TR + extraR;
    return [Math.cos(ang) * R, Math.sin(ang) * R, ZC + zr, zr];
  }
  function S11(t) {
    const b = buf(), tun = buf(), bgd = buf();
    const lt = t - 62;
    const open = ei(seg(t, 63.2, 64.0));              // walls open out as the name forms
    const kW = 0.62, wox = -WORD.w * kW / 2, woy = -2.2;
    if (t < 64.2) {
      const v = 22 + 150 * ei(seg(t, 62, 63.4));
      for (let j = 0; j < LANES.length; j++) {
        const L = LANES[j];
        for (let q = 0; q < L.dots.length; q++) {
          const d = L.dots[q];
          const [x, y, z, zr] = laneDot(j, d, t, open * 70);
          if (zr < -150) continue;
          const fog = Math.exp(zr / 60) * (1 - seg(t, 63.95, 64.2)) * seg(-zr, 1.5, 14);
          const ball = d[2] > 1.1;
          const r = rad(d[2], 520, 100) * TS * 1.15;
          const c = ball ? C.red : C.cream;
          put(tun, x, y, z, r, c, fog, ball ? 1.8 : 0.55, 0);
          for (let s = 1; s <= 2; s++) put(tun, x, y, z + s * v * 0.007, r * (1 - s * 0.2), c, fog * [0, 0.38, 0.14][s], ball ? 1.2 : 0.45, 6);
        }
      }
      // the light at the end of the corridor
      put(tun, 0, 0, ZC - 220, 1.6 + 3 * ei(seg(t, 62, 63.6)), [1, 0.9, 0.8], 1 - open, 0.9, 6);
    }
    // the name: each dot flies in from a wall of the corridor
    textDots(b, WORD, { k: kW, ox: wox, oy: woy, w: lerp(380, 520, seg(t, 64, 66)), col: C.white, ball: C.red, style: 1 }, (p) => {
      const h = hash(p.i * 2.3 + 1);
      const u = eio(seg(t, 63.15 + h * 0.35, 63.98));
      if (u <= 0) return null;
      const j = p.i % LANES.length;
      const src = laneDot(j, [p.i * 0.7, 5, 0], 63.15 + h * 0.35, 0);
      const sz = ZC - 25 - 60 * h;
      const x = lerp(src[0], p.x, u), y = lerp(src[1], p.y, u), z = lerp(sz, 0, u);
      const sweep = (t - 64.6) * 20 - 30;
      const lx = p.x - sweep;
      const sheen = Math.exp(-lx * lx * 0.05) * seg(t, 64.5, 64.8);
      return { x, y, z, r: p.r * lerp(0.6, 1, u), e: (1 - u) * 0.8 + 0.1 + sheen * 0.55 + pulse(t, 64, 5) * 0.6 + beatEnv(t, 6) * 0.05 * seg(t, 64, 68) };
    });
    // shock ring on the downbeat, then the grid settles in behind the name
    if (t >= 64 && t < 65.2) {
      const u = e5(seg(t, 64, 65.2));
      for (let q = 0; q < 220; q++) {
        const a = q / 220 * Math.PI * 2;
        put(tun, Math.cos(a) * (6 + 80 * u) * 1.6, Math.sin(a) * (6 + 80 * u), -0.5, 0.18, C.cream, 1 - u, 1.6, 0);
      }
    }
    const ga = sm(seg(t, 64.3, 65.5)) * 0.32;
    if (ga > 0) for (let x = -50; x <= 50; x += 2) for (let y = -28; y <= 28; y += 2) {
      const dd = Math.hypot(x, y);
      put(bgd, x, y, -8, 0.07, [0.5, 0.5, 0.55], ga * sm(seg(t - 64.3, dd * 0.02, dd * 0.02 + 0.5)), 0, 0);
    }
    const breathe = Math.sin((t - 64) * 0.9) * 0.6 * seg(t, 64, 68);
    const roll = (1 - open) * 0.25 * Math.sin(lt * 1.4);
    const cam = { pos: [breathe, 0, ZC + 4 * (1 - e5(seg(t, 64, 66)))], tgt: [0, 0, 0], up: [Math.sin(roll), Math.cos(roll), 0], fov: 0.5,
      aperture: t < 64 ? 0.3 : 0.12, focus: t < 64 ? 40 : ZC, cocMax: 18 };
    return {
      t, cam, bg: fixedBg(hex("#0c0c10"), hex("#000000"), { r: 1.0 }),
      layers: [lay(bgd, { billboard: false }), lay(tun, {}), lay(b, { sort: true, light: [-0.3, 0.6, 0.9], envTop: [0.5, 0.5, 0.6] })],
      post: { bloom: t < 64 ? 0.75 : 0.45, thr: 1.0, vign: 0.7, grain: 0.016, ca: 0.0025 * (1 - open) * seg(t, 62, 63.5), flash: [1, 0.95, 0.9, pulse(t, 64, 8) * 0.35] },
      overlay(c) {
        hud(c, t, {});
        if (t > 65.6) {
          const s = "Roman & Italic   ·   wght  CNTR  opsz   ·   266 glyphs   ·   26 swash capitals   ·   54 styles";
          c.save(); c.font = FONT(500, 17); c.letterSpacing = "2.5px"; const sw = c.measureText(s).width; c.restore();
          typed(c, s, W / 2 - sw / 2, 770, 65.6, t, 1.0, { font: FONT(500, 17), col: "rgba(246,243,236,0.85)", ls: 2.5 });
        }
      },
    };
  }

  // ---------------------------------------------------------------- 12 SIGNATURE 68–72
  // The wordmark settles, the line it stands for types itself out in italic dots,
  // and the full stop — the same red ball the film began with — is the last to leave.
  const TAG = layout("A Didone on the dot matrix.", { it: true });
  function S12(t) {
    const w = buf(), b = buf(), last = buf();
    const up = eio(seg(t, 68.0, 68.75));
    const fall = (i) => ei(seg(t, 70.4 + hash(i) * 0.5, 71.2 + hash(i) * 0.5));
    // wordmark: rises a little and settles (continuous with the tunnel's last frame)
    const kW = lerp(0.62, 0.5, up), oyW = lerp(-2.2, 2.6, up);
    textDots(w, WORD, { k: kW, ox: -WORD.w * kW / 2, oy: oyW, w: 520, col: C.white, ball: C.red, style: 1 }, (p) => {
      const f = fall(p.i + 500);
      return { y: p.y - f * 20, a: 1 - f, e: 0.08 + 0.25 * pulse(t, 69.45, 5) * (p.ball ? 1 : 0) };
    });
    // tagline: typed, char by char, in italic
    const kT = WORD.w * 0.5 * 0.74 / TAG.w;
    const oxT = -TAG.w * kT / 2 - 0.6, oyT = -5.6;
    const nC = TAG.chars.length;
    let keep = null;
    textDots(b, TAG, { k: kT, ox: oxT, oy: oyT, sh: 1, w: 470, col: C.white, ball: C.red, style: 1 }, (p) => {
      const ci = p.dt[3];
      const isStop = ci === nC - 1;
      const ta = isStop ? 69.45 : 68.45 + ci / nC * 0.85 + hash(p.i * 1.7) * 0.06;
      if (t < ta) return null;
      if (isStop) { keep = p; return null; }
      const f = fall(p.i);
      const pop = back(seg(t, ta, ta + 0.22), 2);
      return { r: p.r * pop, y: p.y - f * 20, a: 1 - f, e: pulse(t, ta, 9) * 1.6 + 0.05 };
    });
    // the full stop: pops last, stays while everything falls, glides to centre and blinks
    if (keep) {
      const m = eio(seg(t, 70.85, 71.45));
      const pop = back(seg(t, 69.45, 69.75), 2.6);
      const blink = t > 71.45 ? (Math.floor((t - 71.45) / 0.25) % 2 === 0 ? 1 : 0.15) : 1;
      const fade = 1 - seg(t, 71.85, 72);
      const r = keep.r * pop * lerp(1, 2.4, m);
      put(last, lerp(keep.x, 0, m), lerp(keep.y, 0, m), 0, r, C.red, fade, (0.25 + pulse(t, 69.45, 6) * 2 + 1.1 * m) * blink, 1);
    }
    // slow push-in, carried on from the tunnel
    const d = lerp(fit(44), fit(40), eio(seg(t, 68.0, 71.6)));
    const cam = { pos: [0, 0, d], tgt: [0, 0, 0], fov: 0.5, aperture: 0, focus: d };
    return {
      t, cam, bg: fixedBg(hex("#0c0c10"), hex("#000000"), { r: 1.0 }),
      layers: [lay(w, { light: [-0.3, 0.6, 0.9] }), lay(b, { light: [-0.3, 0.6, 0.9] }), lay(last, { light: [-0.3, 0.6, 0.9] })],
      post: { bloom: 0.8, thr: 0.9, vign: 0.7, grain: 0.016 },
      overlay(c) {
        const a = sm(seg(t, 69.6, 70.0)) * (1 - sm(seg(t, 70.4, 70.8)));
        hud(c, t, { a: 1 - sm(seg(t, 70.6, 71.2)) });
        const s = project(cam, null, [0, oyT - 4.2, 0]);
        c.save(); c.globalAlpha = a * 0.45; c.fillStyle = "#f6f3ec"; c.fillRect(W / 2 - 28 * a, s[1], 56 * a, 1); c.restore();
        txt(c, "sundyme.github.io/punctum-moderne", W / 2, s[1] + 52, { font: FONT(400, 30), col: "#f6f3ec", align: "center", a, ls: 0.5 });
        txt(c, "FREE  ·  SIL OPEN FONT LICENSE 1.1  ·  ROMAN & ITALIC", W / 2, s[1] + 94, { font: FONT(500, 14), col: "#f6f3ec", ls: 4, align: "center", a: a * 0.7 });
        txt(c, "点阵上的 Didone · 免费开源", W / 2, s[1] + 132, { font: "400 19px SongCN", col: "#f6f3ec", align: "center", a: a * 0.55, ls: 4 });
      },
    };
  }

  // ==================================================================== timeline
  const SCENES = [[0, S1], [6, S2], [10, S3], [16, S4], [20, S5], [24, S6], [28, S7], [36, S8], [46, S9], [54, S10], [62, S11], [68, S12]];
  function frame(t) {
    pi = 0;
    t = cl(t, 0, DUR - 1e-4);
    let s = SCENES[0][1];
    for (const [t0, f] of SCENES) if (t >= t0) s = f;
    const F = s(t);
    if (t > DUR - 0.2) F.post = Object.assign({}, F.post, { expo: (F.post.expo ?? 1) * (1 - seg(t, DUR - 0.2, DUR)) });
    return F;
  }

  // ==================================================================== events (for the score)
  const EV = [];
  const ev = (t, type, o = {}) => EV.push(Object.assign({ t, type }, o));
  MORSE_P.forEach(([a, d]) => ev(a, "morse", { d }));
  A_ORDER.forEach((q, k) => ev(A_T(k), "pop", { tone: q.d[2], k }));
  [4.0, 4.5, 5.0, 5.5].forEach((x, i) => ev(x, "label", { i }));
  ev(5.72, "whoosh", { d: 0.28 });
  ev(6.0, "impact"); ev(8.0, "impact", { big: 1 }); ev(9.45, "switchoff", { d: 0.5 });
  ev(10.0, "drum", { d: 0.8 }); ev(10.95, "drum", { d: 0.7 }); ev(12.0, "shatter"); ev(15.45, "whoosh", { d: 0.55 });
  for (let i = 0; i < 4; i++) ev(16 + i * 0.125, "slam", { i });
  for (let i = 0; i < 6; i++) ev(17 + i * 0.5, "pump", { i });
  ev(18, "impact"); ev(19.75, "glitch", { d: 0.25 });
  ev(20.0, "ledon"); ev(20.25, "scan", { d: 1.5 }); ev(22.0, "scan", { d: 0.75, rev: 1 }); ev(23.0, "scan", { d: 0.6 });
  ev(24.0, "crton"); OPS.forEach((px, i) => ev(24.1 + i * 0.25, "line", { i })); ev(26.0, "zoom", { d: 0.9 }); ev(27.55, "crtoff");
  ev(28.0, "impact"); ev(28.0, "ripple", { d: 1.2 });
  KPAIRS.forEach((p, j) => ev(30.0 + j * 0.5, "snap", { k: p.k }));
  ev(32.6, "stepper", { d: 3.4 }); ev(35.4, "glitch", { d: 0.6 });
  ev(36.0, "impact"); ev(36.2, "shear", { d: 0.8 }); ev(37.0, "morph", { d: 0.7 });
  for (let j = 0; j < 16; j++) ev(38.0 + j * 0.0625 + (j >= 8 ? 0.25 : 0) + 0.25, "tick", { j });
  ev(40.05, "draw", { d: 1.6 }); ev(42.0, "impact", { big: 1 });
  for (let j = 0; j < 26; j++) ev(44.0 + j * 0.05, "sparkle", { j });
  ev(45.55, "fall", { d: 0.45 });
  BOARD.forEach(([t0], i) => ev(t0, "flaps", { i }));
  for (let si = 0; si < BOARDC.length; si++) for (let r = 0; r < ROWS; r++) for (let col = 0; col < COLS; col++) {
    const cur = BOARDC[si][1][r][col], prev = si > 0 ? BOARDC[si - 1][1][r][col] : " ";
    if (cur === prev) continue;
    const delay = col * 0.007 + r * 0.03 + hash(r * 31 + col) * 0.03;
    const flips = 2 + Math.floor(hash(r * 7 + col * 3 + si) * 2);
    for (let k = 0; k < flips; k++) ev(BOARDC[si][0] + delay + k * 0.05, "flap", { pan: (col / (COLS - 1)) * 2 - 1, last: k === flips - 1 ? 1 : 0 });
  }
  SHOT_T.forEach((x, i) => ev(x, "cut", { i, shot: SHOTS[i] }));
  PLINES.forEach((l) => { if (l.t0 !== null) { ev(l.t0, "printpass", { d: l.d, dir: l.dir }); ev(l.feed, "feed"); } });
  ev(63.15, "fold", { d: 0.85 }); ev(64.0, "shock");
  ev(62.0, "riser", { d: 1.4 }); ev(64.0, "drop"); ev(65.6, "type", { d: 1.0 });
  ev(68.0, "impact"); ev(68.45, "type", { d: 0.85 }); ev(69.45, "pop", { tone: 1.3, k: 0 });
  for (let i = 0; i < 6; i++) ev(71.45 + i * 0.25, "blink", { on: i % 2 === 0 ? 1 : 0 });
  ev(70.4, "fall", { d: 1.2 });

  window.FILM = { DUR, frame, EVENTS: EV, SCENES: SCENES.map((s) => s[0]) };
})();
