/* Punctum Moderne — "Five Materials".
 *
 * A 48 s film rendered entirely in WebGL2 as a pure function of time T.
 * One dot passes through five materials that share its shape:
 *   ink drop (1788) · music-box pin (1796) · punched hole (1890) ·
 *   inkjet droplet (1984) · light (2026)
 * Every dot comes from the Punctum Moderne glyph data and the radius model of
 * src/radii.py. model() / events() run in Node too (score export); attach()
 * needs a browser canvas.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.createFilm = factory;
})(typeof self !== 'undefined' ? self : this, function createFilm(G) {
  'use strict';
  const W = 1920, H = 1080, TAU = Math.PI * 2;
  const BEAT = 2 / 3, BAR = 8 / 3;
  const TS = { P: 0, INK: 4, MB: 12, CARD: 20, JET: 80 / 3, LIGHT: 100 / 3, FIN: 124 / 3, END: 48 };

  // ------------------------------------------------------------ radius model
  const DISPLAY = [[100, 20, 7], [400, 40, 11], [900, 62, 16]];
  const TEXT = [[100, 30, 16], [400, 50, 30], [900, 66, 40]];
  function lt(table, w, i) {
    if (w <= table[0][0]) return table[0][i];
    for (let k = 0; k < table.length - 1; k++) {
      const a = table[k], b = table[k + 1];
      if (w <= b[0]) return a[i] + (b[i] - a[i]) * (w - a[0]) / (b[0] - a[0]);
    }
    return table[table.length - 1][i];
  }
  /** radii.py radius() as a fraction of the pitch. */
  function rad(tone, w = 500, c = 100, f = 0) {
    const rT = lt(DISPLAY, w, 1) + (lt(TEXT, w, 1) - lt(DISPLAY, w, 1)) * f;
    const rH = lt(DISPLAY, w, 2) + (lt(TEXT, w, 2) - lt(DISPLAY, w, 2)) * f;
    const stressed = rH + (rT - rH) * tone, mono = rT * 0.86;
    return (mono + (stressed - mono) * c / 100) / 100;
  }

  // ------------------------------------------------------------ easing
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const lin = (t, a, b) => clamp((t - a) / (b - a));
  const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
  const sineIO = (x) => { x = clamp(x); return 0.5 - 0.5 * Math.cos(Math.PI * x); };
  const cubicIO = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const quintIO = (x) => { x = clamp(x); return x < 0.5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2; };
  const expoOut = (x) => { x = clamp(x); return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x); };
  const cubicIn = (x) => { x = clamp(x); return x * x * x; };
  const cubicOut = (x) => { x = clamp(x); return 1 - Math.pow(1 - x, 3); };
  const backOut = (x, s = 1.4) => { x = clamp(x); const c3 = s + 1; return 1 + c3 * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
  const logLerp = (a, b, t) => Math.exp(lerp(Math.log(a), Math.log(b), t));
  const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

  // ------------------------------------------------------------ glyphs
  function layout(text) {
    const out = []; let x = 0;
    for (let i = 0; i < text.length; i++) {
      const g = G[text[i]];
      if (!g) throw new Error('missing glyph ' + text[i]);
      for (const [gx, gy, t] of g.d) out.push({ col: x + gx, row: gy, tone: t, ci: i });
      x += g.w + 1;
    }
    return { dots: out, width: x - 1 };
  }

  // ======================================================================
  // I  INK — one 'a', drop by drop, on warm paper (top-down macro)
  // ======================================================================
  const INK = (() => {
    const g = G.a;
    const dots = g.d.map(([x, y, t]) => ({ x, y, tone: t, R: rad(t, 500) }));
    const order = [[0, 5], [1, 6], [2, 6], [3, 6], [4, 5], [4, 4], [4, 3], [3, 3], [2, 3], [1, 3],
      [0, 2], [0, 1], [1, 0], [2, 0], [3, 0], [4, 2], [4, 1], [4, 0], [5, 0]];
    const seq = order.map(([x, y]) => dots.find((d) => d.x === x && d.y === y));
    if (seq.some((d) => !d) || seq.length !== dots.length) throw new Error('ink order');
    const T0 = TS.INK + BEAT;              // first impact on the beat (4.667)
    const A = TS.INK + 3 * BEAT, B = TS.INK + 6 * BEAT; // 6.0 → 8.0 accelerating rain
    const n = seq.length - 1, q = 0.86;
    const d0 = (B - A) * (1 - q) / (1 - Math.pow(q, n - 1));
    let t = A;
    seq[0].tl = T0; seq[0].tf = 0.667;
    for (let k = 1; k <= n; k++) {
      seq[k].tl = t; seq[k].tf = 0.34;
      t += d0 * Math.pow(q, k - 1);
    }
    seq[n].tl = B;
    // satellites (splash) — mostly from the first, largest drop
    const sats = [];
    const ball = seq[0];
    for (let k = 0; k < 7; k++) {
      const a = TAU * (k / 7 + 0.13 * hash(k + 3)) + 0.4;
      const dist = ball.R * (1.55 + 0.9 * hash(k + 11));
      sats.push({ x: ball.x + Math.cos(a) * dist, y: ball.y + Math.sin(a) * dist,
        R: 0.018 + 0.03 * hash(k + 21), tl: T0 + 0.05 + 0.07 * hash(k + 31), tf: 0.0, sat: 1 });
    }
    for (const k of [4, 9, 13]) {
      const d = seq[k];
      const a = TAU * hash(k + 41);
      sats.push({ x: d.x + Math.cos(a) * d.R * 1.6, y: d.y + Math.sin(a) * d.R * 1.6,
        R: 0.016 + 0.012 * hash(k + 51), tl: d.tl + 0.06, tf: 0.0, sat: 1 });
    }
    const all = seq.concat(sats);
    const Rball = ball.R;
    const S_MACRO = 230 / Rball, S_FULL = 96;
    const C_BALL = [ball.x, ball.y], C_FULL = [2.5, 3.05];
    function cam(T) {
      let S, C;
      if (T < 6.0) { S = S_MACRO * lerp(1.0, 0.94, lin(T, 4.6, 6.0)); C = C_BALL; }
      else if (T < 10.667) {
        const e = cubicIO(lin(T, 6.0, 9.4));
        S = logLerp(S_MACRO * 0.94, S_FULL, e) * lerp(1, 1.035, lin(T, 9.4, 10.667));
        C = [lerp(C_BALL[0], C_FULL[0], e), lerp(C_BALL[1], C_FULL[1], e)];
      } else {
        const e = cubicIn(lin(T, 10.667, 12.0));
        S = logLerp(S_FULL * 1.035, S_MACRO, e);
        const ec = sineIO(lin(T, 10.667, 11.7));
        C = [lerp(C_FULL[0], C_BALL[0], ec), lerp(C_FULL[1], C_BALL[1], ec)];
      }
      return { C, S };
    }
    return { all, seq, cam, T0, Hc: 8.0, H0: 7.4 };
  })();

  // ======================================================================
  // II  MUSIC BOX — "Punctum Moderne · " in steel pins round a brass drum
  // ======================================================================
  const MB = (() => {
    const L = layout('Punctum Moderne · ');
    const NCOL = L.width + 1, NROW = 11;
    const a = 0.08, Rc = NCOL * a / TAU, dth = TAU / NCOL;
    const Pc = 1 / 6;                       // one column per 16th note at 90 bpm
    const omega = dth / Pc, thComb = -0.95, pinLen = 0.052;
    const pins = new Float32Array(NCOL * NROW);
    for (const d of L.dots) pins[d.row * NCOL + d.col] = rad(d.tone, 500) * a;
    const phi = (T) => omega * (T - TS.MB) - thComb;
    // plucks: column j reaches the comb at TS.MB + j*Pc
    const plucks = [];
    for (const d of L.dots) plucks.push({ t: TS.MB + d.col * Pc, row: d.row, tone: d.tone, col: d.col });
    plucks.sort((p, q) => p.t - q.t);
    const byRow = Array.from({ length: NROW }, () => []);
    for (const p of plucks) byRow[p.row].push(p.t);
    function deflections(T) {
      const out = new Float32Array(16);
      for (let i = 0; i < NROW; i++) {
        let v = 0;
        for (const tp of byRow[i]) {
          const s = T - tp;
          if (s < -0.09 || s > 1.2) continue;
          if (s < 0) v += -0.010 * (1 + s / 0.09);
          else v += 0.008 * Math.exp(-s * 5) * Math.cos(TAU * 7.5 * s);
        }
        out[i] = clamp(v, -0.014, 0.014);
      }
      return out;
    }
    // the 'c' ball: hero pin for the match cut
    const cDot = L.dots.find((d) => d.ci === 3 && d.tone > 1.2);
    const rowY = (row) => (row - (NROW - 1) / 2) * a;
    function pinAngle(col, T) { return col * dth - phi(T); }
    function cam(T) {
      // cylindrical camera around the drum axis
      const ang = pinAngle(cDot.col, T);
      const yb = rowY(cDot.row);
      const macroR = Rc + pinLen + 0.426;
      const e1 = quintIO(lin(T, 12.25, 15.6));
      const eHold = sineIO(lin(T, 15.6, 18.2));
      const e3 = cubicIO(lin(T, 18.0, 20.0));
      let th = lerp(ang, -0.30, e1); th = lerp(th, -0.42, eHold);
      let rho = logLerp(macroR, 5.3, e1); rho = lerp(rho, 4.7, eHold);
      let y = lerp(yb, 1.05, e1); y = lerp(y, 0.92, eHold);
      let tgt = [Math.sin(ang) * (Rc + 0.03) * (1 - e1) + (-0.35) * e1, yb * (1 - e1) + (-0.02) * e1, Math.cos(ang) * (Rc + 0.03) * (1 - e1) + 0.2 * e1];
      // final move: drift toward the comb tips
      const tc = [Math.sin(-0.32) * Rc, -0.02, Math.cos(-0.32) * Rc];
      th = lerp(th, 0.18, e3); rho = lerp(rho, Rc + 1.05, e3); y = lerp(y, 0.10, e3);
      tgt = mix3(tgt, tc, e3);
      const pos = [Math.sin(th) * rho, y, Math.cos(th) * rho];
      const focus = Math.hypot(pos[0] - tgt[0], pos[1] - tgt[1], pos[2] - tgt[2]);
      const fov = lerp(lerp(26, 30, e1), 24, e3);
      const aper = lerp(lerp(70, 26, e1), 46, e3);
      return { pos, tgt, focus, fov, aper };
    }
    return { NCOL, NROW, a, Rc, dth, omega, thComb, pinLen, pins, phi, plucks, deflections, cam, rowY };
  })();

  // ======================================================================
  // III  PUNCH CARD — "Punctum" punched through manila, backlit
  // ======================================================================
  const CARD = (() => {
    const L = layout('Punctum');
    const NC = 64, NR = 16, P = 0.1, BASE = 3;
    const ox = Math.floor((NC - L.width) / 2);
    const holes = new Float32Array(NC * NR * 4);
    for (const d of L.dots) {
      const c = ox + d.col, r = BASE + d.row;
      const k = (r * NC + c) * 4;
      holes[k] = rad(d.tone, 500); holes[k + 1] = 1; holes[k + 2] = d.tone;
    }
    const gridW = NC * P, gridH = NR * P;
    const card = { hw: gridW / 2 + 0.26, top: gridH / 2 + 0.62, bot: -(gridH / 2 + 0.3) };
    const grid0 = [-gridW / 2 + P / 2, -gridH / 2 + P / 2];   // centre of cell (0,0) in card coords
    // the 'c' ball hole for the dive
    const cb = L.dots.find((d) => d.ci === 3 && d.tone > 1.2);
    const diveHole = [grid0[0] + (ox + cb.col) * P, grid0[1] + (BASE + cb.row) * P];
    const T = TS.CARD;
    const slide = (t) => lerp(3.2, 0, cubicOut(lin(t, T, T + 2.9)));
    const morph = (t) => backOut(lin(t, T + 3.333, T + 4.25), 1.2);
    // reader clicks: one per column while the card feeds
    function cam(t) {
      const e = quintIO(lin(t, T + 0.2, T + 3.333));
      const az = lerp(-1.18, 0, e), el = lerp(0.10, 0.02, e);
      const dist = lerp(2.1, 7.4, e);
      const look = [lerp(0.9, 0, e), lerp(0.05, 0.05, e), 0];
      let pos = [look[0] + Math.sin(az) * Math.cos(el) * dist, look[1] + Math.sin(el) * dist, Math.cos(az) * Math.cos(el) * dist];
      let tgt = look;
      // dive into the ball hole
      const ed = cubicIn(lin(t, T + 4.6, T + 6.667));
      const dh = [diveHole[0], diveHole[1], 0];
      const posD = [dh[0], dh[1], 0.06];
      pos = [logLerp(pos[0] + 10, posD[0] + 10, ed) - 10, logLerp(pos[1] + 10, posD[1] + 10, ed) - 10, logLerp(pos[2], posD[2], ed)];
      tgt = mix3(tgt, dh, smooth(lin(t, T + 4.4, T + 5.6)));
      const focus = Math.hypot(pos[0] - tgt[0], pos[1] - tgt[1], pos[2] - tgt[2]);
      return { pos, tgt, focus, fov: lerp(34, 30, e), aper: lerp(40, 10, e) };
    }
    const clicks = [];
    for (let c = 0; c < NC; c += 1) {
      // column c passes the read line when slide puts it there; sample the slide curve
      const xLine = 1.2;
      for (let k = 0; k < 400; k++) {
        const t = T + k * 0.008, t2 = t + 0.008;
        const x1 = grid0[0] + c * P + slide(t), x2 = grid0[0] + c * P + slide(t2);
        if ((x1 - xLine) * (x2 - xLine) <= 0 && x1 !== x2) { clicks.push({ t, col: c }); break; }
      }
    }
    return { NC, NR, P, holes, card, grid0, slide, morph, cam, clicks, ox, BASE, diveHole };
  })();

  // ======================================================================
  // IV  INKJET — "Moderne" printed in violet, slow motion, strobe-lit
  // ======================================================================
  const JET = (() => {
    const L = layout('Moderne');
    const pj = 0.1, NROW = 11;
    const x0 = -L.width * pj / 2;
    const colX = (c) => x0 + c * pj, rowZ = (r) => -(r - 5) * pj;
    const v = 12 * pj, xStart = x0 - 0.8;
    const tf = 0.42, yN = 0.62;
    const drops = L.dots.map((d) => {
      const tauF = (colX(d.col) - xStart) / v + 0.003 * d.row;
      return { x: colX(d.col), z: rowZ(d.row), r: rad(d.tone, 500) * pj, rd: rad(d.tone, 500) * pj * 0.62, tauF, tauL: tauF + tf, tone: d.tone, col: d.col, row: d.row };
    });
    const T0 = TS.JET, TAU0 = 0.95;
    // speed ramp: 0.2× until 28.1, up to 1× by 29.1
    const s0 = 0.2, ra = T0 + 1.433, rb = T0 + 2.433;
    function tau(T) {
      if (T <= ra) return TAU0 + s0 * (T - T0);
      const base = TAU0 + s0 * (ra - T0);
      if (T <= rb) { const u = T - ra, d = rb - ra; return base + s0 * u + (1 - s0) * (u * u) / (2 * d) * 1; }
      return base + s0 * (rb - ra) + (1 - s0) * (rb - ra) / 2 + (T - rb);
    }
    const headX = (tu) => xStart + v * tu;
    function cam(T) {
      const tu = tau(T), hx = headX(tu);
      const e = cubicIO(lin(T, T0 + 1.9, T0 + 4.6));
      const posA = [hx + 0.42, 0.25, 1.02], tgtA = [hx - 0.10, 0.29, 0.0];
      const posB = [0.05, 3.0, 5.0], tgtB = [0.0, 0.0, -0.08];
      let pos = mix3(posA, posB, e), tgt = mix3(tgtA, tgtB, e);
      const ep = sineIO(lin(T, T0 + 4.6, TS.LIGHT));
      pos = mix3(pos, [0.0, 2.55, 4.3], ep);
      const focus0 = Math.hypot(pos[0] - tgt[0], pos[1] - tgt[1], pos[2] - tgt[2]);
      const rack = smooth(lin(T, T0 + 5.85, TS.LIGHT));
      const focus = lerp(focus0, 0.6, rack);
      return { pos, tgt, focus, fov: lerp(24, 31, e), aper: lerp(lerp(46, 16, e), 60, rack) };
    }
    return { L, pj, drops, tau, headX, cam, tf, yN, colX, rowZ, NROW, x0, T0 };
  })();

  // ======================================================================
  // V  LIGHT — the wordmark as points of light, rack focus
  // ======================================================================
  const LIGHT = (() => {
    const L = layout('Punctum Moderne');
    const P0 = 16;
    const rows = 11;
    const pts = L.dots.map((d) => ({
      u: d.col - L.width / 2, v: d.row - 4.5, r: rad(d.tone, 500), tone: d.tone, xn: d.col / L.width, ci: d.ci,
    }));
    // the 'r' ball of Moderne: the last dot to leave
    const rBall = pts.findIndex((p, i) => L.dots[i].ci === 12 && p.tone > 1.2);
    const bg = [];
    for (let k = 0; bg.length < 18 && k < 400; k++) {
      const x = hash(k * 3 + 1) * 2100 - 90, y = hash(k * 3 + 2) * 1200 - 60;
      if (y > 330 && y < 750 && x > 120 && x < 1800) continue;
      bg.push({ x, y, R: 46 + 90 * hash(k * 3 + 3), b: 0.006 + 0.010 * hash(k + 70), hue: hash(k + 90), drift: (hash(k + 110) - 0.5) * 12 });
    }
    const k0 = TS.LIGHT, SWEEP = 1.1, DUR = 3.8, LEAD = 0.55;
    const defocus = (T, xn) => 1.25 * (1 - cubicIO(lin(T, k0 + LEAD + xn * SWEEP, k0 + LEAD + xn * SWEEP + DUR)));
    const focusT = (xn) => k0 + LEAD + xn * SWEEP + DUR * 0.78;   // ≈ the moment a dot reads as sharp
    const sharp = k0 + LEAD + SWEEP + DUR;
    return { L, pts, P0, rBall, bg, rows, defocus, focusT, sharp };
  })();

  // ------------------------------------------------------------ events (score)
  function events() {
    const ev = { tempo: 90, chapters: TS };
    ev.ink = INK.all.map((d) => ({ t: d.tl, R: d.R, x: d.x, y: d.y, sat: !!d.sat, tone: d.tone || 0 }));
    ev.plucks = MB.plucks.filter((p) => p.t < TS.CARD + 0.25).map((p) => ({ t: p.t, row: p.row, tone: p.tone }));
    ev.clicks = CARD.clicks;
    ev.morph = TS.CARD + 3.333;
    ev.jet = JET.drops.map((d) => ({ fire: tauToT(d.tauF), land: tauToT(d.tauL), r: d.r, tone: d.tone, row: d.row }));
    ev.light = { rackStart: TS.LIGHT + 0.55, sharp: LIGHT.sharp, focus: LIGHT.pts.map((q, i) => ({ t: LIGHT.focusT(q.xn), row: LIGHT.L.dots[i].row, tone: q.tone, xn: q.xn })) };
    ev.fin = { tagline: 42.1, zh: 42.9, othersFade: [46.0, 46.9], lastFade: [47.25, 47.95], end: TS.END };
    ev.card = { settle: TS.CARD + 2.9, morph: TS.CARD + 3.333, dive: [TS.CARD + 4.6, TS.JET] };
    ev.inkPush = [10.667, 12.0];
    return ev;
  }
  function tauToT(tu) { // invert JET.tau by bisection
    let a = TS.JET - 10, b = TS.JET + 20;
    for (let i = 0; i < 60; i++) { const m = (a + b) / 2; if (JET.tau(m) < tu) a = m; else b = m; }
    return (a + b) / 2;
  }

  // ======================================================================
  // RENDERER
  // ======================================================================
  function attach(canvas, opts = {}) {
    const SS = opts.ss || 1;
    const RW = Math.round(W * SS), RH = Math.round(H * SS);
    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, alpha: false, depth: false, premultipliedAlpha: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('webgl2 unavailable');
    if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('EXT_color_buffer_float unavailable');
    gl.getExtension('OES_texture_float_linear');
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const SH = window.PM_SHADERS;

    const errors = [];
    function compile(fsSrc, vsSrc) {
      const mk = (type, src) => {
        const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
          const log = gl.getShaderInfoLog(s); errors.push(log); console.error(log);
        }
        return s;
      };
      const p = gl.createProgram();
      gl.attachShader(p, mk(gl.VERTEX_SHADER, vsSrc || SH.vsFull));
      gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fsSrc));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { const l = gl.getProgramInfoLog(p); errors.push(l); console.error(l); }
      const locs = {};
      p.u = (n) => (n in locs ? locs[n] : (locs[n] = gl.getUniformLocation(p, n)));
      return p;
    }
    const pre = SH.common;
    const prog = {
      pro: compile(pre + SH.prologue), ink: compile(pre + SH.ink), mb: compile(pre + SH.musicbox),
      card: compile(pre + SH.card), jet: compile(pre + SH.jet), light: compile(SH.lightFS, SH.lightVS),
      dof: compile(SH.dof), down: compile(SH.down), up: compile(SH.up), mix: compile(SH.mix), scale: compile(SH.scale), comp: compile(SH.comp),
    };

    function makeTex(w, h, ifmt, fmt, type, filter, data) {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, type, data || null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    }
    function fbo(w, h) {
      const tex = makeTex(w, h, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR);
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      return { fb, tex, w, h };
    }
    const fA = fbo(RW, RH), fB = fbo(RW, RH), dA = fbo(RW, RH), dB = fbo(RW, RH), fM = fbo(RW, RH), fAcc = fbo(RW, RH);
    const blo = [];
    { let w = RW, h = RH; for (let i = 0; i < 6; i++) { w = Math.max(1, w >> 1); h = Math.max(1, h >> 1); blo.push(fbo(w, h)); } }

    // data textures
    const pinTex = makeTex(MB.NCOL, MB.NROW, gl.R32F, gl.RED, gl.FLOAT, gl.NEAREST, MB.pins);
    const holeTex = makeTex(CARD.NC, CARD.NR, gl.RGBA32F, gl.RGBA, gl.FLOAT, gl.NEAREST, CARD.holes);
    // jet landed-dot grid: (r, tauLand, tone, 1)
    const JNC = JET.L.width + 1, JNR = JET.NROW;
    const jg = new Float32Array(JNC * JNR * 4);
    for (const d of JET.drops) { const k = (d.row * JNC + d.col) * 4; jg[k] = d.r; jg[k + 1] = d.tauL; jg[k + 2] = d.tone; jg[k + 3] = 1; }
    const jetTex = makeTex(JNC, JNR, gl.RGBA32F, gl.RGBA, gl.FLOAT, gl.NEAREST, jg);
    // punch-card print (dot-matrix numerals, interpretation line)
    const printTex = (() => {
      const c = document.createElement('canvas');
      const PX = 300; // px per unit
      const cw = Math.round(CARD.card.hw * 2 * PX), chh = Math.round((CARD.card.top - CARD.card.bot) * PX);
      c.width = cw; c.height = chh;
      const x = c.getContext('2d');
      x.clearRect(0, 0, cw, chh);
      const toPx = (u, v) => [(u + CARD.card.hw) * PX, (CARD.card.top - v) * PX];
      const glyphAt = (ch, u, v, p, a) => { // u,v = baseline-left in card units, p = pitch
        const g = G[ch]; if (!g) return 0;
        for (const [gx, gy, t] of g.d) {
          const [px, py] = toPx(u + gx * p, v + gy * p);
          x.globalAlpha = a; x.beginPath(); x.arc(px, py, Math.max(0.6, rad(t, 400, 100, 0.8) * p * PX), 0, TAU); x.fill();
        }
        return g.w;
      };
      const text = (s, u, v, p, a) => { let cx = u; for (const ch of s) { const w = glyphAt(ch, cx, v, p, a); cx += ((G[ch] && G[ch].w) || 3) * p + p; } return cx; };
      x.fillStyle = '#3a2a1c';
      const HEX = '0123456789ABCDEF';
      const P = CARD.P, gp = P * 0.062;
      for (let r = 0; r < CARD.NR; r++) for (let col = 0; col < CARD.NC; col++) {
        const k = (r * CARD.NC + col) * 4;
        if (CARD.holes[k + 1] > 0) continue;
        const cxu = CARD.grid0[0] + col * P, cyu = CARD.grid0[1] + r * P;
        const ch = HEX[CARD.NR - 1 - r];
        const w = (G[ch] && G[ch].w) || 5;
        glyphAt(ch, cxu - (w - 1) * gp / 2, cyu - 4.5 * gp, gp, 0.62);
      }
      // column numbers along the bottom margin
      for (let col = 0; col < CARD.NC; col += 1) {
        const s = String(col + 1);
        const cxu = CARD.grid0[0] + col * P;
        let wsum = 0; for (const ch of s) wsum += (G[ch].w + 1); wsum -= 1;
        text(s, cxu - wsum * 0.0085 / 2, CARD.grid0[1] - P * 0.5 - 0.07, 0.0085, 0.6);
      }
      text('PUNCTUM MODERNE', CARD.grid0[0], CARD.card.top - 0.34, 0.026, 0.8);
      { const yr = '1890 · 2026'; let wsum = 0; for (const ch of yr) wsum += ((G[ch] && G[ch].w) || 3) + 1; wsum -= 1;
        text(yr, CARD.grid0[0] + (CARD.NC - 1) * P - wsum * 0.026, CARD.card.top - 0.34, 0.026, 0.8); }
      // thin rule under the interpretation line
      x.globalAlpha = 0.35; x.fillRect(toPx(CARD.grid0[0], 0)[0], toPx(0, CARD.card.top - 0.45)[1], CARD.NC * P * PX - 0.5 * P * PX, 1.2);
      const t = makeTex(cw, chh, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, c);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      return t;
    })();

    // light instances
    const instBuf = gl.createBuffer();
    const MAXI = 400;
    const instData = new Float32Array(MAXI * 8);
    const lightVAO = gl.createVertexArray();
    gl.bindVertexArray(lightVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
    gl.bufferData(gl.ARRAY_BUFFER, instData.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 32, 0); gl.vertexAttribDivisor(0, 1);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 16); gl.vertexAttribDivisor(1, 1);
    gl.bindVertexArray(vao);

    // ---------------------------------------------------------------- helpers
    function target(f) { gl.bindFramebuffer(gl.FRAMEBUFFER, f ? f.fb : null); gl.viewport(0, 0, f ? f.w : W, f ? f.h : H); }
    function use(p) { gl.useProgram(p); return p; }
    const u1 = (p, n, v) => gl.uniform1f(p.u(n), v);
    const u2 = (p, n, a, b) => gl.uniform2f(p.u(n), a, b);
    const u3 = (p, n, v) => gl.uniform3f(p.u(n), v[0], v[1], v[2]);
    const u4 = (p, n, v) => gl.uniform4f(p.u(n), v[0], v[1], v[2], v[3]);
    const ui = (p, n, v) => gl.uniform1i(p.u(n), v);
    function bindTex(p, n, unit, tex) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); ui(p, n, unit); }
    function full() { gl.drawArrays(gl.TRIANGLES, 0, 3); }
    function common(p, T, envW, envRot, envW2) {
      u2(p, 'uRes', RW, RH); u1(p, 'uT', T); u1(p, 'uSS', SS);
      u4(p, 'uEnvW', envW); u1(p, 'uEnvRot', envRot || 0); u4(p, 'uEnvW2', envW2 || [0, 0, 0, 0]);
    }
    function camU(p, c) {
      u3(p, 'uCam', c.pos); u3(p, 'uTgt', c.tgt);
      u1(p, 'uF', 0.5 / Math.tan((c.fov * Math.PI / 180) / 2));
      u1(p, 'uFocus', c.focus); u1(p, 'uAper', c.aper * SS);
    }

    // ---------------------------------------------------------------- scenes
    function drawPrologue(T, f) {
      const p = use(prog.pro); target(f); common(p, T, [lerp(0, 16, sineIO(lin(T, 0.2, 2.6))), lerp(0, 22, sineIO(lin(T, 0.9, 3.0))), 0.0, 0.03], lerp(-0.55, 0.22, sineIO(lin(T, 0, 4))));
      const fall = Math.max(0, T - 3.0);
      const y = -0.5 * 5.6 * fall * fall;
      const wob = Math.exp(-Math.max(0, T - 2.6) * 2.0) * (T > 2.6 ? 1 : 0);
      const sY = 1 + 0.035 * Math.sin((T - 2.6) * 11) * wob + Math.min(0.22, fall * 0.35);
      u3(p, 'uC', [0, y, 0]); u3(p, 'uR', [1 / Math.sqrt(sY), sY, 1 / Math.sqrt(sY)]);
      u3(p, 'uCam', [0, 0.1 + y * 0.18, 6.2]); u3(p, 'uTgt', [0, y * 0.25, 0]);
      u1(p, 'uF', 0.5 / Math.tan(15 * Math.PI / 180));
      u1(p, 'uGlow', sineIO(lin(T, 0.4, 2.8)));
      full();
    }
    const inkD = new Float32Array(48 * 4), inkB = new Float32Array(48 * 4);
    function drawInk(T, f) {
      const p = use(prog.ink); target(f); common(p, T, [14, 6, 10, 0.04], 0.0);
      const { C, S } = INK.cam(T);
      u2(p, 'uC', C[0], C[1]); u1(p, 'uS', S * SS);
      let n = 0;
      for (const d of INK.all) {
        if (n >= 48) break;
        inkD.set([d.x, d.y, d.R, d.tl], n * 4); inkB.set([d.tf, d.sat ? 1 : 0, 0, 0], n * 4); n++;
      }
      gl.uniform4fv(p.u('uD[0]'), inkD); gl.uniform4fv(p.u('uDB[0]'), inkB); ui(p, 'uN', n);
      u1(p, 'uHc', INK.Hc); u1(p, 'uH0', INK.H0); u1(p, 'uAper', 26 * SS);
      full();
    }
    function drawMB(T, f) {
      const p = use(prog.mb); target(f);
      common(p, T, [3.0, 4.0, 0.6, 0.035], 0.15 + 0.05 * Math.sin(T * 0.3), [2.6, 1.5, 1.1, 0]);
      camU(p, MB.cam(T));
      bindTex(p, 'uPin', 0, pinTex);
      u1(p, 'uNCol', MB.NCOL); u1(p, 'uNRow', MB.NROW); u1(p, 'uA', MB.a); u1(p, 'uRc', MB.Rc);
      u1(p, 'uDth', MB.dth); u1(p, 'uRot', MB.phi(T)); u1(p, 'uThc', MB.thComb); u1(p, 'uPinLen', MB.pinLen);
      gl.uniform1fv(p.u('uDefl[0]'), MB.deflections(T));
      full();
    }
    function drawCard(T, f) {
      const p = use(prog.card); target(f);
      common(p, T, [1, 1, 1, 0.05], 0.0);
      const c = CARD.cam(T);
      camU(p, c);
      bindTex(p, 'uHoles', 0, holeTex); bindTex(p, 'uPrint', 1, printTex);
      u2(p, 'uGrid', CARD.NC, CARD.NR); u1(p, 'uP', CARD.P);
      u2(p, 'uGrid0', CARD.grid0[0], CARD.grid0[1]);
      u3(p, 'uCardB', [CARD.card.hw, CARD.card.top, CARD.card.bot]);
      u1(p, 'uSlide', CARD.slide(T)); u1(p, 'uMorph', CARD.morph(T));
      const dens = lerp(0.5, 0.11, sineIO(lin(T, TS.CARD + 0.5, TS.CARD + 3.5)));
      u1(p, 'uHaze', dens);
      // the lamp strikes: a short tungsten flicker, then steady
      const on = lin(T, TS.CARD + 0.04, TS.CARD + 0.5);
      const flick = on > 0 && on < 1 ? 0.55 + 0.45 * Math.abs(Math.sin(on * 31.0 + 0.7)) : 1;
      u1(p, 'uBack', 7.0 * smooth(on) * flick * (1 + 1.6 * cubicIn(lin(T, TS.CARD + 5.6, TS.JET))));
      full();
    }
    const primData = new Float32Array(160 * 3 * 4);
    const primTex = makeTex(160, 3, gl.RGBA32F, gl.RGBA, gl.FLOAT, gl.NEAREST, primData);
    function drawJet(T, f) {
      const p = use(prog.jet); target(f);
      common(p, T, [10, 9, 6, 0.02], -0.2);
      const c = JET.cam(T); camU(p, c);
      const tu = JET.tau(T), hx = JET.headX(tu);
      let nd = 0, nt = 0;
      primData.fill(0);
      const D = (k, v) => primData.set(v, k * 4), TA = (k, v) => primData.set(v, (160 + k) * 4), TB = (k, v) => primData.set(v, (320 + k) * 4);
      for (const d of JET.drops) {
        const s = tu - d.tauF;
        if (s < 0 || s > JET.tf + 0.05) continue;
        const yd = JET.yN - (JET.yN - d.rd * 0.9) * (s / JET.tf);
        const grow = clamp(s / 0.045);
        if (s <= JET.tf && nd < 160) { D(nd++, [d.x, Math.max(yd, d.rd * 0.6), d.z, d.rd * Math.cbrt(grow)]); }
        if (s < 0.17) {
          const top = s < 0.05 ? JET.yN : lerp(JET.yN, yd + d.rd * 2.6, smooth((s - 0.05) / 0.12));
          const th = d.rd * lerp(0.42, 0.16, clamp(s / 0.17));
          if (top > yd + d.rd * 0.5 && nt < 160) { TA(nt, [d.x, yd, d.z, th]); TB(nt, [d.x, top, d.z, 0]); nt++; }
        } else if (s < JET.tf + 0.04 && nd < 160) {
          const gap = d.rd * lerp(2.6, 0.0, clamp((s - 0.17) / (JET.tf + 0.04 - 0.17)));
          D(nd++, [d.x, Math.max(yd + gap, d.rd * 0.3), d.z, d.rd * 0.4]);
        }
      }
      gl.bindTexture(gl.TEXTURE_2D, primTex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 160, 3, gl.RGBA, gl.FLOAT, primData);
      ui(p, 'uND', nd); ui(p, 'uNT', nt);
      bindTex(p, 'uJet', 0, jetTex); bindTex(p, 'uPrim', 1, primTex);
      u2(p, 'uJGrid', JNC, JNR); u1(p, 'uPj', JET.pj); u1(p, 'uX0', JET.x0);
      u1(p, 'uTau', tu); u1(p, 'uHead', hx); u1(p, 'uYN', JET.yN);
      u1(p, 'uStrobe', 1.0 + 5.0 * Math.exp(-(T - TS.JET) * 9));
      u1(p, 'uPool', lerp(0.55, 2.6, cubicIO(lin(T, TS.JET + 1.9, TS.JET + 4.8))));
      full();
    }
    function lightInstances(T) {
      const Lt = LIGHT;
      const k0 = TS.LIGHT;
      // rack focus sweeps left → right: each dot lands in focus LIGHT.focusT(xn)
      const e = cubicIO(lin(T, k0 + 1.05, k0 + 4.85));
      const u = lerp(1.25, 0, e);
      const CMAX = 64 * SS;
      // finale: size + position
      const ef = cubicIO(lin(T, TS.FIN, TS.FIN + 1.6));
      const pitch = lerp(P0push(T), 12.4, ef) * SS;
      const cy = (H / 2 + lerp(0, -46, ef)) * SS, cx = W / 2 * SS;
      const breath = 1 + 0.035 * u;            // focus breathing
      const white = smooth(lin(T, TS.FIN + 0.1, TS.FIN + 1.4));
      const warm = [1.0, 0.93, 0.84], violet = [0.62, 0.50, 0.98], dotc = [0.93, 0.92, 0.90];
      const tint = smooth(lin(T, k0 + 0.6, k0 + 4.2));
      const lastFade = smooth(lin(T, 46.0, 46.9)), endFade = smooth(lin(T, 47.25, 47.95));
      let n = 0;
      const put = (x, y, R, b, col, ce) => { if (n >= MAXI) return; instData.set([x, y, R, b, col[0], col[1], col[2], ce], n * 8); n++; };
      // far city bokeh behind
      const bgA = (1 - smooth(lin(T, TS.FIN - 0.4, TS.FIN + 0.8))) * smooth(lin(T, k0 - 0.4, k0 + 0.8));
      if (bgA > 0) for (const b of Lt.bg) {
        const hc = b.hue < 0.5 ? mix3([1.0, 0.72, 0.42], [1, 0.9, 0.8], b.hue * 2) : mix3([0.62, 0.5, 1.0], [0.75, 0.85, 1.0], b.hue * 2 - 1);
        put((b.x + b.drift * (T - k0)) * SS, b.y * SS, b.R * SS * lerp(1.0, 0.82, e), b.b * bgA, hc, 1);
      }
      for (let i = 0; i < Lt.pts.length; i++) {
        const q = Lt.pts[i];
        const rd = q.r * pitch;
        const D = LIGHT.defocus(T, q.xn);
        const R = Math.sqrt(rd * rd + (CMAX * D) * (CMAX * D));
        const x = cx + q.u * pitch * breath, y = cy - q.v * pitch * breath;
        const energy = Math.pow(rd / R, 1.25);
        let b = lerp(3.2 * energy, 1.0, white);
        let col = mix3(mix3(violet, warm, tint), dotc, white);
        if (i === Lt.rBall) {
          b *= 1 - endFade * 0.0;
        } else b *= 1 - lastFade;
        if (i === Lt.rBall) b *= 1 - endFade;
        put(x, y, R, b, col, D > 0.02 ? 1 : 0);
      }
      return n;
    }
    function P0push(T) { return LIGHT.P0 * lerp(1, 1.055, sineIO(lin(T, TS.LIGHT + 4.6, TS.FIN))); }
    function drawLight(T, f) {
      target(f);
      gl.clearColor(0.0, 0.0, 0.0, 0.0); gl.clear(gl.COLOR_BUFFER_BIT);
      const p = use(prog.light);
      u2(p, 'uRes', RW, RH);
      const n = lightInstances(T);
      gl.bindVertexArray(lightVAO);
      gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, instData.subarray(0, n * 8));
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
      gl.disable(gl.BLEND);
      gl.bindVertexArray(vao);
    }

    // ---------------------------------------------------------------- post
    function dof(src, dst, maxR) {
      const p = use(prog.dof); target(dst);
      bindTex(p, 'uSrc', 0, src.tex); u2(p, 'uTexel', 1 / src.w, 1 / src.h); u1(p, 'uMaxR', Math.min(maxR, 40 * SS)); u1(p, 'uStep', 1.6 * SS * SS);
      full();
      return dst;
    }
    function bloom(src) {
      let s = src;
      const pd = use(prog.down);
      for (let i = 0; i < blo.length; i++) {
        target(blo[i]); bindTex(pd, 'uSrc', 0, s.tex); u2(pd, 'uTexel', 1 / s.w, 1 / s.h); full(); s = blo[i];
      }
      const pu = use(prog.up);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      for (let i = blo.length - 1; i > 0; i--) {
        target(blo[i - 1]); bindTex(pu, 'uSrc', 0, blo[i].tex); u2(pu, 'uTexel', 1 / blo[i].w, 1 / blo[i].h); full();
      }
      gl.disable(gl.BLEND);
      return blo[0];
    }

    const SCENES = {
      pro: { draw: drawPrologue, dof: 0 },
      ink: { draw: drawInk, dof: 40 },
      mb: { draw: drawMB, dof: 40 },
      card: { draw: drawCard, dof: 34 },
      jet: { draw: drawJet, dof: 40 },
      light: { draw: drawLight, dof: 0 },
    };
    function plan(T) {
      if (T < TS.INK) return [['pro', 1]];
      if (T < TS.MB) return [['ink', 1]];
      if (T < TS.CARD) return [['mb', 1]];
      if (T < TS.JET) return [['card', 1]];
      const x0 = TS.LIGHT - 0.5;
      if (T < x0) return [['jet', 1]];
      if (T < TS.LIGHT + 0.25) return [['jet', 1], ['light', sineIO(lin(T, x0, TS.LIGHT + 0.25))]];
      return [['light', 1]];
    }
    function grade(T) {
      // exposure, bloom, vignette, grain, fade, fadeColor
      const g = { expo: 1.0, bloom: 0.05, vig: 0.55, grain: 0.022, fade: 0, fadeCol: [0, 0, 0] };
      if (T < TS.INK) { g.expo = 1.25; g.bloom = 0.04; g.fade = 1 - smooth(lin(T, 0.0, 0.9)); }
      else if (T < TS.MB) { g.expo = 1.55; g.bloom = 0.035; g.vig = 0.5; }
      else if (T < TS.CARD) { g.expo = 1.15; g.bloom = 0.05; }
      else if (T < TS.JET) {
        g.expo = 1.0; g.bloom = 0.07;
        const w = cubicIn(lin(T, TS.CARD + 5.9, TS.JET)); g.fade = w; g.fadeCol = [1, 0.97, 0.93];
      } else if (T < TS.LIGHT) {
        g.expo = 1.15; g.bloom = 0.06;
        g.fade = 0.9 * Math.exp(-(T - TS.JET) * 7.5); g.fadeCol = [1, 0.97, 0.93];
      } else { g.expo = 1.0; g.bloom = lerp(0.12, 0.05, smooth(lin(T, TS.FIN, TS.FIN + 1.4))); g.vig = 0.45; }
      if (T > 47.8) g.fade = Math.max(g.fade, smooth(lin(T, 47.8, 48.0)));
      return g;
    }
    // motion blur where the camera moves fast: average sub-frames over a 180° shutter
    const BLUR = [[10.95, 12.0, 5], [12.0, 12.9, 4], [12.9, 14.2, 3], [25.5, TS.JET, 5], [TS.JET, TS.JET + 0.35, 3], [20.0, 21.6, 3]];
    const SEGS = [0, TS.INK, TS.MB, TS.CARD, TS.JET, TS.LIGHT, TS.END];
    function shutter(T) { for (const [a, b, n] of BLUR) if (T >= a && T < b) return n; return 1; }
    function sceneImage(T) {
      const pl = plan(T);
      const outs = [];
      pl.forEach(([id, w], k) => {
        const sc = SCENES[id];
        const f = k === 0 ? fA : fB, d = k === 0 ? dA : dB;
        sc.draw(T, f);
        outs.push([sc.dof ? dof(f, d, sc.dof * SS) : f, w]);
      });
      let img = outs[0][0];
      if (outs.length > 1) {
        const p = use(prog.mix); target(fM);
        bindTex(p, 'uA', 0, outs[0][0].tex); bindTex(p, 'uB', 1, outs[1][0].tex); u1(p, 'uW', outs[1][1]);
        full(); img = fM;
      }
      return img;
    }
    function draw(T) {
      const n = shutter(T);
      let img;
      if (n === 1) img = sceneImage(T);
      else {
        let s0 = 0, s1 = TS.END;
        for (let i = 0; i < SEGS.length - 1; i++) if (T >= SEGS[i] && T < SEGS[i + 1]) { s0 = SEGS[i]; s1 = SEGS[i + 1]; }
        target(fAcc); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        for (let k = 0; k < n; k++) {
          const tk = clamp(T + ((k + 0.5) / n - 0.5) / 120, s0, s1 - 1e-4);
          const im = sceneImage(tk);
          const p = use(prog.scale); target(fAcc);
          gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
          bindTex(p, 'uSrc', 0, im.tex); u1(p, 'uW', 1 / n); full();
          gl.disable(gl.BLEND);
        }
        img = fAcc;
      }
      const b = bloom(img);
      const g = grade(T);
      const p = use(prog.comp); target(null);
      bindTex(p, 'uImg', 0, img.tex); bindTex(p, 'uBloom', 1, b.tex);
      u2(p, 'uRes', W, H); u1(p, 'uSS', SS);
      u1(p, 'uExpo', g.expo); u1(p, 'uBloomK', g.bloom); u1(p, 'uVig', g.vig); u1(p, 'uGrain', g.grain);
      u1(p, 'uFade', g.fade); u3(p, 'uFadeCol', g.fadeCol); u1(p, 'uFrame', Math.round(T * 60) % 600);
      full();
    }
    return { draw, errors, gl };
  }

  return { W, H, TS, BEAT, BAR, INK, MB, CARD, JET, LIGHT, events, attach, rad, layout };
});
