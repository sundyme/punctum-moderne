/* Punctum — film engine.
 *
 * Every frame is a pure function of time T (seconds): draw(ctx, T) paints one
 * 1920×1080 frame of the 60 s master; drawLoop(ctx, T) paints the 15 s hero
 * loop. All dots come from the Punctum Moderne glyph data and the radius model
 * of src/radii.py (display master). events() exports the same timings the
 * picture uses, so the synthesized score is cut to the frame.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.createPunctum = factory;
})(typeof self !== 'undefined' ? self : this, function createPunctum(G) {
  'use strict';
  const W = 1920, H = 1080, TAU = Math.PI * 2, CX = 960, CY = 540;
  const BG = '#0C0B0E', DOT = '#EDEBE6', VIOLET = '#B9A4E8';
  const RGB_DOT = [237, 235, 230], RGB_VIOLET = [185, 164, 232];

  // ------------------------------------------------------------ radius model
  const DISPLAY = [[100, 20, 7], [400, 40, 11], [900, 62, 16]];
  const TEXT = [[100, 30, 16], [400, 50, 30], [900, 66, 40]];
  const OPSZ_CURVE = [[12, 1.0], [16, 0.98], [24, 0.85], [48, 0.55], [96, 0.2], [144, 0.0]];
  function lt(table, w, i) {
    if (w <= table[0][0]) return table[0][i];
    for (let k = 0; k < table.length - 1; k++) {
      const a = table[k], b = table[k + 1];
      if (w <= b[0]) return a[i] + (b[i] - a[i]) * (w - a[0]) / (b[0] - a[0]);
    }
    return table[table.length - 1][i];
  }
  function textFraction(opsz) {
    const c = OPSZ_CURVE;
    if (opsz <= c[0][0]) return c[0][1];
    for (let k = 0; k < c.length - 1; k++) {
      if (opsz <= c[k + 1][0]) return c[k][1] + (c[k + 1][1] - c[k][1]) * (opsz - c[k][0]) / (c[k + 1][0] - c[k][0]);
    }
    return 0;
  }
  /** radii.py radius(): tone, weight, contrast, text fraction f (0 display … 1 text). */
  function radius(tone, w, c, f = 0) {
    const rT = lt(DISPLAY, w, 1) + (lt(TEXT, w, 1) - lt(DISPLAY, w, 1)) * f;
    const rH = lt(DISPLAY, w, 2) + (lt(TEXT, w, 2) - lt(DISPLAY, w, 2)) * f;
    const stressed = rH + (rT - rH) * tone, mono = rT * 0.86;
    return mono + (stressed - mono) * c / 100;
  }
  const rpx = (tone, p, c = 100, w = 400, f = 0) => radius(tone, w, c, f) / 100 * p;
  // optical size of text drawn at `pitch` px per cell: font-size = 16 cells
  const fAt = (pitch) => textFraction(pitch * 16);

  // ------------------------------------------------------------ easing
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
  const sineIO = (x) => { x = clamp(x); return 0.5 - 0.5 * Math.cos(Math.PI * x); };
  const outQuad = (x) => { x = clamp(x); return 1 - (1 - x) * (1 - x); };
  function mixColor(t) {
    if (t <= 0.002) return DOT;
    if (t >= 0.998) return VIOLET;
    const c = RGB_DOT.map((v, i) => Math.round(lerp(v, RGB_VIOLET[i], t)));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }

  // ------------------------------------------------------------ glyphs
  function layout(text) {
    const out = [];
    let x = 0;
    for (let i = 0; i < text.length; i++) {
      const g = G[text[i]];
      if (!g) throw new Error('missing glyph ' + text[i]);
      for (const [gx, gy, t] of g.d) out.push({ col: x + gx, row: gy, tone: t, ci: i });
      x += g.w + 1;
    }
    return { dots: out, width: x - 1 };
  }
  const textWidth = (s) => layout(s).width;

  // ------------------------------------------------------------ frame builder
  // Dots are batched per (layer, colour, alpha) into one path each; overlapping
  // circles in one path fill as a union, so ink strokes keep a uniform alpha.
  class Frame {
    constructor() { this.groups = new Map(); this.lines = []; this.rings = []; this.images = []; }
    dot(x, y, r, color = DOT, a = 1, layer = 1) {
      if (!(r > 0.05) || a <= 0.004) return;
      if (x < -r || x > W + r || y < -r || y > H + r) return;
      a = Math.round(clamp(a) * 160) / 160;
      const key = layer + '|' + color + '|' + a;
      let g = this.groups.get(key);
      if (!g) { g = { layer, color, a, d: [] }; this.groups.set(key, g); }
      g.d.push(x, y, r);
    }
    line(pts, w, a, color = DOT) { if (a > 0.004) this.lines.push({ pts, w, a, color }); }
    ring(x, y, r, w, a) { if (a > 0.004 && r > 0) this.rings.push({ x, y, r, w, a }); }
    image(img, x, y, w, h, a) { if (a > 0.004) this.images.push({ img, x, y, w, h, a }); }
    lattice(pitch, ox, oy, alphaFn, base = 0.13, size = 1.6) {
      if (pitch < 5 || base <= 0.004) return;
      const i0 = Math.floor(-ox / pitch) - 1, i1 = Math.ceil((W - ox) / pitch) + 1;
      const j0 = Math.floor(-oy / pitch) - 1, j1 = Math.ceil((H - oy) / pitch) + 1;
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        const x = ox + i * pitch, y = oy + j * pitch;
        const a = base * (alphaFn ? alphaFn(x, y) : 1);
        this.dot(x, y, size, DOT, a, 0);
      }
    }
    flushGroups(ctx, layer) {
      for (const g of this.groups.values()) {
        if (g.layer !== layer) continue;
        ctx.globalAlpha = g.a;
        ctx.fillStyle = g.color;
        ctx.beginPath();
        const d = g.d;
        for (let i = 0; i < d.length; i += 3) {
          ctx.moveTo(d[i] + d[i + 2], d[i + 1]);
          ctx.arc(d[i], d[i + 1], d[i + 2], 0, TAU);
        }
        ctx.fill();
      }
    }
    render(ctx) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);
      this.flushGroups(ctx, 0);
      ctx.lineCap = 'round';
      for (const l of this.lines) {
        ctx.globalAlpha = l.a; ctx.strokeStyle = l.color; ctx.lineWidth = l.w;
        ctx.beginPath(); ctx.moveTo(l.pts[0], l.pts[1]);
        for (let i = 2; i < l.pts.length; i += 2) ctx.lineTo(l.pts[i], l.pts[i + 1]);
        ctx.stroke();
      }
      for (const im of this.images) {
        ctx.globalAlpha = im.a;
        ctx.drawImage(im.img, im.x, im.y, im.w, im.h);
      }
      this.flushGroups(ctx, 1);
      this.flushGroups(ctx, 2);
      ctx.strokeStyle = DOT;
      for (const r of this.rings) {
        ctx.globalAlpha = r.a; ctx.lineWidth = r.w;
        ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  // ------------------------------------------------------------ post: bloom, vignette, grain
  const hasDOM = typeof document !== 'undefined';
  const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  let post = null;
  function initPost() {
    if (post || !hasDOM) return post;
    const small = mkCanvas(W / 4, H / 4);
    const blur = mkCanvas(W / 4, H / 4);
    const vig = mkCanvas(W, H);
    const v = vig.getContext('2d');
    const g = v.createRadialGradient(CX, CY, H * 0.62, CX, CY, H * 1.12);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.3)');
    v.fillStyle = g; v.fillRect(0, 0, W, H);
    // seeded grain tiles (mulberry32)
    let seed = 0x5eed1e;
    const rnd = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const tiles = [];
    for (let k = 0; k < 6; k++) {
      const c = mkCanvas(256, 256), x = c.getContext('2d');
      const id = x.createImageData(256, 256);
      for (let i = 0; i < id.data.length; i += 4) {
        const n = (rnd() + rnd() + rnd()) / 3;
        const v8 = Math.round(n * 255);
        id.data[i] = id.data[i + 1] = id.data[i + 2] = v8; id.data[i + 3] = 255;
      }
      x.putImageData(id, 0, 0);
      tiles.push(c);
    }
    post = { small, blur, vig, tiles };
    return post;
  }
  function postProcess(ctx, T, bloomAmt = 0.2) {
    const p = initPost();
    if (!p) return;
    const sc = p.small.getContext('2d'), bc = p.blur.getContext('2d');
    sc.globalCompositeOperation = 'copy';
    sc.drawImage(ctx.canvas, 0, 0, W / 4, H / 4);
    bc.globalCompositeOperation = 'copy';
    bc.filter = 'blur(7px)';
    bc.drawImage(p.small, 0, 0);
    bc.filter = 'none';
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = bloomAmt;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(p.blur, 0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(p.vig, 0, 0);
    // grain: tile chosen and offset by frame index (deterministic)
    const f = Math.round(T * 60) % 900;   // 15 s grain period: frame 0 == loop end == master end
    const tile = p.tiles[f % p.tiles.length];
    const ox = (f * 97) % 256, oy = (f * 61) % 256;
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = 0.07;
    const pat = ctx.createPattern(tile, 'repeat');
    ctx.save(); ctx.translate(-ox, -oy); ctx.fillStyle = pat; ctx.fillRect(0, 0, W + 256, H + 256); ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  // ================================================================ I Breath
  const R_I = rpx(1.3, 110);
  const P2 = 110;
  function breathFront(T) { return (T - 2.5) / 3.5 * 1250; }
  function drawBreath(F, T) {
    const front = breathFront(T);
    F.lattice(P2, CX, CY, (x, y) => smooth((front - Math.hypot(x - CX, y - CY)) / 260));
    const amp = 8 * (1 - smooth((T - 6.4) / 1.6));
    F.dot(CX, CY, R_I + amp * Math.sin(TAU * T / 4));
  }

  // ================================================================ II Pen
  const A_STROKES = [
    [[0, 5], [1, 6], [2, 6], [3, 6], [4, 5], [4, 4], [4, 3], [4, 2], [4, 1], [4, 0], [5, 0]],
    [[3, 3], [2, 3], [1, 3], [0, 2], [0, 1], [1, 0], [2, 0], [3, 0]],
  ];
  const A_TONE = {};
  for (const [x, y, t] of G.a.d) A_TONE[x + ',' + y] = t;
  const aWorld = (gx, gy) => [CX + gx * P2, CY - (gy - 5) * P2];
  const A_CENTER = aWorld(2.5, 3);
  const PAN_END = [CX - A_CENTER[0], CY - A_CENTER[1]];
  const PEN_T = [[8.0, 11.2], [11.55, 13.0]];
  const SAMPLE_T0 = 13.0, SAMPLE_DT = 2.0 / 19;
  const A_ORDER = A_STROKES.flat();

  function catmull(pts, steps = 60) {
    const out = [], n = pts.length;
    for (let i = 0; i < n - 1; i++) {
      const p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, n - 1)];
      for (let k = 0; k < steps; k++) {
        const u = k / steps, u2 = u * u, u3 = u2 * u;
        out.push([0, 1, 2].map((j) => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * u
          + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * u2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * u3)));
      }
    }
    out.push(pts[n - 1]);
    return out;
  }
  function resample(path, step) {
    const out = [path[0]];
    let acc = 0;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i];
      const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
      acc += d;
      while (acc >= step) {
        acc -= step;
        const t = 1 - acc / (d || 1);
        out.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]);
      }
    }
    out.push(path[path.length - 1]);
    return out;
  }
  const INK = A_STROKES.map((st) => resample(catmull(st.map(([gx, gy]) => {
    const [x, y] = aWorld(gx, gy);
    return [x, y, rpx(A_TONE[gx + ',' + gy], P2) * 0.9];
  })), 1.6));
  // pen pressure → ink speed: the stroke slows through thick passages
  const INK_T = INK.map((path) => {
    const cum = [0];
    for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + 1 / (0.35 + path[i][2] / 48));
    const tot = cum[cum.length - 1];
    return cum.map((c) => c / tot);
  });
  function inkCount(si, T) {
    const [t0, t1] = PEN_T[si];
    const prog = sineIO((T - t0) / (t1 - t0));
    const cum = INK_T[si];
    let lo = 0, hi = cum.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] <= prog) lo = m + 1; else hi = m; }
    return lo;
  }

  function penTransform(T) {
    const u = sineIO((T - 8) / 5);
    const ox = PAN_END[0] * u, oy = PAN_END[1] * u;
    const e = smooth((T - 17.4) / 1.6);
    const s = Math.pow(30 / 110, e), dx = -1200 * e * e, dy = 15 * e;
    return { s, map: (x, y) => [CX + (x + ox - CX) * s + dx, CY + (y + oy - CY) * s + dy], e };
  }
  function drawPen(F, T) {
    const tf = penTransform(T), s = tf.s, M = tf.map;
    const o = M(CX, CY);
    F.lattice(P2 * s, o[0], o[1], null, 0.13 * (1 - 0.0 * tf.e), lerp(1.6, 1.3, tf.e));
    // sampling grid hairlines
    if (T > 12.6) {
      const gBase = 0.28 * (1 - smooth((T - 15.0) / 1.2)) + 0.06;
      const gA = gBase * (1 - tf.e);
      // cell borders of the 'a' grid (rows 0–6, cols 0–5) plus one cell of margin
      const top = CY - 2.5 * P2, bot = CY + 6.5 * P2, left = CX - 1.5 * P2, right = CX + 6.5 * P2;
      for (let i = 0; i <= 8; i++) {
        const a = gA * smooth((T - 12.7 - 0.05 * i) / 0.35);
        const wx = left + i * P2;
        const [x0, y0] = M(wx, top), [x1, y1] = M(wx, bot);
        F.line([x0, y0, x1, y1], 1.3, a);
      }
      for (let j = 0; j <= 9; j++) {
        const a = gA * smooth((T - 12.7 - 0.04 * j) / 0.35);
        const wy = top + j * P2;
        const [x0, y0] = M(left, wy), [x1, y1] = M(right, wy);
        F.line([x0, y0, x1, y1], 1.3, a);
      }
    }
    // ink
    let inkA = 1;
    if (T >= SAMPLE_T0) inkA = 0.16 + 0.84 * (1 - smooth((T - SAMPLE_T0) / 0.45)) - 0.16 * smooth((T - 14.6) / 0.8);
    if (inkA > 0.004) {
      for (let si = 0; si < 2; si++) {
        if (T < PEN_T[si][0]) continue;
        const n = inkCount(si, T), path = INK[si];
        for (let k = 0; k < n; k++) {
          const [x, y] = M(path[k][0], path[k][1]);
          F.dot(x, y, path[k][2] * s, DOT, inkA, 1);
        }
      }
    }
    // the ball is there from the start; the rest arrive by sampling
    const violet = smooth((T - 15.0) / 0.5) * (1 - smooth((T - 17.6) / 1.2));
    for (let i = 0; i < A_ORDER.length; i++) {
      const [gx, gy] = A_ORDER[i];
      const ts = SAMPLE_T0 + i * SAMPLE_DT;
      const isBall = i === 0;
      if (!isBall && T < ts) continue;
      const age = T - ts;
      const pop = age >= 0 ? 1 + 0.22 * Math.exp(-age * 7) : 1;
      const [wx, wy] = aWorld(gx, gy);
      const [x, y] = M(wx, wy);
      const r = rpx(A_TONE[gx + ',' + gy], P2) * pop * s;
      F.dot(x, y, r, isBall ? mixColor(violet) : DOT, 1, isBall ? 2 : 1);
      if (age >= 0 && age < 0.55) F.ring(x, y, r + age * 170 * s, 1.5, 0.5 * (1 - age / 0.55));
    }
  }

  // ================================================================ III Punch / IV Music box (one strip)
  const P3 = 30;
  const WORD = layout('Moderne');
  const WD = WORD.dots, WD_W = WORD.width;          // 48 columns
  const HEAD_X = CX + (WD_W - 1) / 2 * P3;          // last column lands with the word centred
  const BASE3 = CY + 5 * P3;
  const STRIKES = (() => {
    const d0 = 0.26, d1 = 0.04, r = Math.pow(d1 / d0, 1 / (WD_W - 1));
    const ts = []; let t = 19.6;
    for (let i = 0; i < WD_W; i++) { ts.push(t); t += d0 * Math.pow(r, i); }
    return ts;
  })();
  const STEP_D = STRIKES.map((t, i) => (i < WD_W - 1 ? Math.min(0.07, 0.6 * (STRIKES[i + 1] - t)) : 0));
  function feedA(T) {
    let a = 0;
    for (let i = 0; i < WD_W - 1; i++) {
      if (T <= STRIKES[i]) break;
      a += outQuad((T - STRIKES[i]) / STEP_D[i]);
    }
    return a;
  }
  const cntr = (T) => 100 * sineIO((T - 26.0) / 1.6);
  const zoom34 = (T) => Math.pow(2, sineIO((T - 28.0) / 1.4));
  // IV feed (columns past the comb): ramp in, constant, ramp out
  const COLDT = 0.27, V0 = 1 / COLDT, TA = 29.3, TR = 1.0, TD = 42.8, TRD = 1.0;
  const S = (x) => x * x * x - x * x * x * x / 2;   // ∫ smoothstep
  function feedU(T) {
    if (T <= TA) return 0;
    if (T <= TA + TR) return V0 * TR * S((T - TA) / TR);
    const base = V0 * TR * 0.5;
    if (T <= TD) return base + V0 * (T - TA - TR);
    const b2 = base + V0 * (TD - TA - TR);
    if (T <= TD + TRD) { const x = (T - TD) / TRD; return b2 + V0 * TRD * (x - S(x)); }
    return b2 + V0 * TRD * 0.5;
  }
  const U_END = feedU(99);
  function stripX(col, T) { const Z = zoom34(T); return Z * (HEAD_X - P3 * (feedA(T) - col)) - P3 * Z * feedU(T); }
  function stripY(row, T) { const Z = zoom34(T); return CY + Z * (BASE3 - (row + 0.5) * P3 - CY); }
  const COMB_X0 = 474, TILT = Math.tan(4 * Math.PI / 180);
  const combX = (y) => COMB_X0 + TILT * (CY - y);
  // crossing time of every dot (strip moves left past the comb after TA)
  const CROSS = WD.map((d) => {
    const f = (T) => stripX(d.col, T) - combX(stripY(d.row, T));
    let lo = TA, hi = TD + TRD;
    if (f(lo) <= 0) return lo;
    for (let k = 0; k < 50; k++) { const m = (lo + hi) / 2; if (f(m) > 0) lo = m; else hi = m; }
    return hi;
  });
  const P4 = 60;

  function drawStrip(F, T) {
    const Z = zoom34(T), p = P3 * Z, c = cntr(T);
    const A = feedA(T), U = feedU(T);
    // lattice moves with the paper
    const ox = stripX(0, T), oy = stripY(0, T);
    F.lattice(p, ox, oy, null, 0.12, lerp(1.3, 1.5, Z - 1));
    const dimUnplayed = 1 - 0.58 * smooth((T - 28.2) / 1.2);
    // tines + comb
    const combA = smooth((T - 28.9) / 0.6) * (1 - smooth((T - 42.9) / 0.8));
    const lastPluck = new Array(10).fill(-9);
    for (let i = 0; i < WD.length; i++) {
      const tc = CROSS[i];
      if (tc <= T && tc > lastPluck[WD[i].row]) lastPluck[WD[i].row] = tc;
    }
    if (combA > 0) {
      for (let row = 0; row < 10; row++) {
        const y = stripY(row, T), x0 = combX(y) + 6;
        const L = 760 - row * 46;
        const age = T - lastPluck[row];
        if (age < 1.6) {
          const amp = 7 * Math.exp(-age * 3.2), ph = Math.cos(age * 55);
          const pts = [];
          for (let k = 0; k <= 32; k++) { const u = k / 32; pts.push(x0 + u * L, y + amp * Math.sin(Math.PI * u) * ph); }
          F.line(pts, 1.6, combA * (0.2 + 0.5 * Math.exp(-age * 2.5)));
        } else {
          F.line([x0, y, x0 + L, y], 1.3, combA * 0.2);
        }
      }
      const yt = stripY(10.4, T), yb = stripY(-0.4, T);
      F.line([combX(yt), yt, combX(yb), yb], 2, combA * 0.6);
    }
    // print head (III)
    const headA = smooth((T - 18.9) / 0.6) * (1 - smooth((T - 27.6) / 0.6));
    if (headA > 0) {
      const hx = HEAD_X + 0.9 * P3;
      F.line([hx, BASE3 - 11 * P3, hx, BASE3 + P3], 1.5, 0.45 * headA);
      let k = 0;
      while (k < WD_W && STRIKES[k] <= T) k++;
      const last = k ? STRIKES[k - 1] : -9;
      const fire = Math.exp(-(T - last) * 14);
      const live = new Set(WD.filter((d) => d.col === k - 1).map((d) => d.row));
      for (let row = 0; row < 10; row++) {
        const y = BASE3 - (row + 0.5) * P3, hot = live.has(row) && T - last < 0.4;
        F.line([hx + 6, y, hx + 1.6 * P3, y], hot ? 2.2 : 1.4, headA * (0.35 + 0.6 * fire * hot));
      }
    }
    // dots
    for (let i = 0; i < WD.length; i++) {
      const d = WD[i];
      const ts = STRIKES[d.col];
      if (T < ts) continue;
      const x = stripX(d.col, T), y = stripY(d.row, T);
      let r = rpx(d.tone, p, c);
      const sAge = T - ts;
      r *= 1 + 0.35 * Math.exp(-sAge * 18);
      const cAge = T - CROSS[i];
      let a = 1;
      if (cAge < 0) a = dimUnplayed;
      else {
        const pulse = Math.exp(-cAge * 6);
        r *= 1 + 0.28 * pulse;
        a = 0.88 + 0.12 * pulse;
        if (cAge < 0.7) F.ring(x, y, r + cAge * 120, 1.3, 0.3 * (1 - cAge / 0.7));
      }
      F.dot(x, y, r, DOT, a, 1);
    }
  }

  // ================================================================ V Powers of One
  const WM = ['Punctum', 'Moderne'];
  const P5 = 28, W_WM = 600;
  const WM_LEFT = (W - textWidth(WM[0]) * P5) / 2;
  const WM_BASE = [400, 400 + 14 * P5];
  const DISC_R = 72;                          // text cells in the ball disc
  const BALL = 1.3;
  const CELLS_PER_WM = DISC_R / (radius(BALL, W_WM, 100) / 100);
  const S_END = P5 / CELLS_PER_WM;
  const WMD = [];
  WM.forEach((line, li) => {
    for (const d of layout(line).dots) {
      WMD.push({ x: WM_LEFT + (d.col + 0.5) * P5, y: WM_BASE[li] - (d.row + 0.5) * P5, tone: d.tone, li, ch: line[d.ci], col: d.col, row: d.row });
    }
  });
  const TARGET = WMD.find((d) => d.li === 1 && d.ch === 'r' && d.tone > 1.1);
  WMD.forEach((d) => { d.isT = d === TARGET; d.phase = (d.col * 7 + d.row * 3 + d.li) % 5; d.Rc = radius(d.tone, W_WM, 100) / 100 * CELLS_PER_WM; });
  const LINE_TXT = 'Punctum Moderne · A dot-matrix Didone · ';
  const PERIOD = layout(LINE_TXT);
  const PW = PERIOD.width + 1;
  const M_OFF = textWidth('Punctum ') + 1;
  const START0 = -(M_OFF + WD_W / 2);
  function discLines(R, phase) {
    const out = [];
    for (let li = -5; li <= 5; li++) {
      const base = -5 + 16 * li;
      if (Math.abs(base + 5) > R + 6) continue;
      const start = START0 + li * 37 + phase * 23;
      const k0 = Math.floor((-R - start) / PW) - 1, k1 = Math.ceil((R - start) / PW) + 1;
      for (let k = k0; k <= k1; k++) {
        for (const d of PERIOD.dots) {
          const x = start + k * PW + d.col + 0.5, y = base + d.row + 0.5;
          if (x * x + y * y <= R * R) out.push(x, y, d.tone, li === 0 && k === 0 && d.ci >= 8 && d.ci <= 14 ? 1 : 0);
        }
      }
    }
    return out;
  }
  const discCache = new Map();
  function discDots(R, phase) {
    const key = R.toFixed(2) + '|' + phase;
    if (!discCache.has(key)) discCache.set(key, discLines(R, phase));
    return discCache.get(key);
  }
  // texture mip chain per disc (only in the browser)
  const TEX = 3;
  const F_LO = textFraction(TEX * 16);   // 0.55: the texture master matching the vector switch
  const texCache = new Map();
  function discTex(R, phase, f) {
    const key = R.toFixed(2) + '|' + phase + '|' + f;
    if (texCache.has(key)) return texCache.get(key);
    const size = Math.ceil(2 * R * TEX) + 2;
    const c = mkCanvas(size, size), x = c.getContext('2d');
    x.fillStyle = DOT;
    x.beginPath();
    const d = discDots(R, phase), h = size / 2;
    for (let i = 0; i < d.length; i += 4) {
      const r = Math.max(rpx(d[i + 2], TEX, 100, 400, f), 0.45);
      const px = h + d[i] * TEX, py = h - d[i + 1] * TEX;
      x.moveTo(px + r, py); x.arc(px, py, r, 0, TAU);
    }
    x.fill();
    const levels = [{ c, scale: TEX }];
    let cur = c, scale = TEX;
    while (cur.width > 8) {
      const n = mkCanvas(Math.max(2, Math.ceil(cur.width / 2)), Math.max(2, Math.ceil(cur.height / 2)));
      const nx = n.getContext('2d');
      nx.imageSmoothingQuality = 'high';
      nx.drawImage(cur, 0, 0, n.width, n.height);
      scale /= 2;
      levels.push({ c: n, scale });
      cur = n;
    }
    texCache.set(key, levels);
    return levels;
  }
  function pickLevel(levels, s) {
    let best = levels[0];
    for (const l of levels) if (l.scale >= s * 0.999) best = l;
    return best;
  }

  /** Draw the wordmark world: every wordmark dot is a disc of text.
   * s: screen px per text cell; P: screen position of the target disc centre. */
  function drawPowers(F, o) {
    const { s, P, ctxA = 1, fuse = 0, violet = 0, nbA = 1, line0A = 1 } = o;
    const k = CELLS_PER_WM * s / P5;
    const vec = s >= TEX;
    const fs = fAt(s);
    const wHi = clamp((fs - F_LO) / (1 - F_LO));     // blend between the two texture masters
    for (const d of WMD) {
      const cx = P[0] + (d.x - TARGET.x) * k, cy = P[1] + (d.y - TARGET.y) * k;
      const R = d.Rc * s;
      if (cx < -R || cx > W + R || cy < -R || cy > H + R) continue;
      const a = d.isT ? 1 : nbA;
      if (a <= 0.004) continue;
      const col = d.isT ? mixColor(violet) : DOT;
      if (fuse < 1) {
        if (vec) {
          const dd = discDots(d.Rc, d.isT ? 0 : d.phase);
          for (let i = 0; i < dd.length; i += 4) {
            const x = cx + dd[i] * s, y = cy - dd[i + 1] * s;
            const r = rpx(dd[i + 2], s, 100, 400, fs);
            if (x < -r || x > W + r || y < -r || y > H + r) continue;
            const isLine0 = d.isT && dd[i + 3];
            F.dot(x, y, r, DOT, a * (1 - fuse) * (isLine0 ? line0A : ctxA), 1);
          }
        } else if (hasDOM && R >= 1.2) {
          const ph = d.isT ? 0 : d.phase;
          const lo = pickLevel(discTex(d.Rc, ph, F_LO), s), hi = pickLevel(discTex(d.Rc, ph, 1), s);
          const size = lo.c.width / lo.scale * s;
          if (wHi < 0.999) F.image(lo.c, cx - size / 2, cy - size / 2, size, size, a * (1 - fuse));
          if (wHi > 0.001) F.image(hi.c, cx - size / 2, cy - size / 2, size, size, a * (1 - fuse) * wHi);
        } else {
          F.dot(cx, cy, R, DOT, a * 0.3 * (1 - fuse), 1);
        }
      }
      if (fuse > 0) F.dot(cx, cy, R, col, a * fuse, d.isT ? 2 : 1);
    }
  }

  const V_T0 = 43.8, V_T1 = 51.0;
  const P0V = [510 + 60 * (WD_W / 2 - 0.5 + 0.5 - U_END) - 0, CY];
  // the word centre (col 23.5) at the end of IV: x = 510 + 60 * (23.5 - U_END)
  P0V[0] = 510 + 60 * (23.5 - U_END);
  function zoomV(T) { return P4 * Math.pow(S_END / P4, smooth((T - V_T0) / (V_T1 - V_T0))); }
  // the disc we are inside first slides to frame centre, then settles where
  // the 'r' ball sits in the final wordmark layout
  function camV(T) {
    const u1 = sineIO((T - V_T0) / 2.8), u2 = sineIO((T - 48.0) / 3.0);
    const x = lerp(lerp(P0V[0], CX, u1), TARGET.x, u2), y = lerp(lerp(P0V[1], CY, u1), TARGET.y, u2);
    return [x, y];
  }
  function drawV(F, T) {
    const s = zoomV(T), P = camV(T);
    // text lattice while the cells are still large, wordmark lattice for the hold
    F.lattice(s, P[0] + 0.5 * s, P[1] + 0.5 * s, null, 0.12 * smooth((s - 7) / 12), 1.5);
    F.lattice(P5, WM_LEFT + 0.5 * P5, WM_BASE[0] - 0.5 * P5, null, 0.075 * smooth((T - 51.4) / 1.0), 1.3);
    drawPowers(F, {
      s, P,
      ctxA: smooth((T - 44.0) / 1.8),
      line0A: 0.9 + 0.1 * smooth((T - 43.8) / 1.0),
      fuse: smooth((T - 49.9) / 1.25),
      violet: smooth((T - 51.0) / 0.6),
    });
  }

  // ================================================================ VI Back to the dot
  const BALL_PX = rpx(BALL, P5, 100, W_WM);
  const MAXD = Math.max(...WMD.map((d) => Math.hypot(d.x - TARGET.x, d.y - TARGET.y)));
  function drawReturn(F, o) {
    const { zu, tc, violet, breath, latA = 0 } = o;   // tc: time since the collapse began
    const k = lerp(1, R_I / BALL_PX, zu);
    const px = lerp(TARGET.x, CX, zu), py = lerp(TARGET.y, CY, zu);
    if (latA > 0) F.lattice(P5 * k, px + (WM_LEFT + 0.5 * P5 - TARGET.x) * k, py + (WM_BASE[0] - 0.5 * P5 - TARGET.y) * k, null, 0.075 * latA, 1.3);
    for (const d of WMD) {
      if (d.isT) continue;
      const dist = Math.hypot(d.x - TARGET.x, d.y - TARGET.y);
      const u = clamp((tc - 1.3 * dist / MAXD) / 0.95);
      if (u >= 1) continue;
      const pull = u * u * u;
      const wx = lerp(d.x, TARGET.x, pull), wy = lerp(d.y, TARGET.y, pull);
      F.dot(px + (wx - TARGET.x) * k, py + (wy - TARGET.y) * k, rpx(d.tone, P5, 100, W_WM) * (1 - smooth(u)) * k, DOT, 1, 1);
    }
    F.dot(px, py, BALL_PX * k + breath, mixColor(violet), 1, 2);
  }
  function drawVI(F, T) {
    const zu = sineIO((T - 55.3) / 2.3);
    const amp = 8 * smooth((T - 57.2) / 0.8);
    drawReturn(F, {
      zu, tc: T - 55.2, violet: 1 - smooth((T - 56.2) / 1.6),
      breath: amp * Math.sin(TAU * T / 4), latA: 1 - smooth((T - 55.2) / 0.8),
    });
  }

  // ================================================================ master
  function build(T) {
    const F = new Frame();
    if (T < 8) drawBreath(F, T);
    else if (T < 19) drawPen(F, T);
    else if (T < V_T0) drawStrip(F, T);
    else if (T < 55.2) drawV(F, T);
    else drawVI(F, T);
    return F;
  }
  function draw(ctx, T) {
    build(T).render(ctx);
    postProcess(ctx, T, 0.2 + 0.14 * smooth((T - 46.5) / 1.5) * (1 - smooth((T - 50.6) / 1.2)));
  }

  // ================================================================ hero loop (15 s)
  const L_SC0 = R_I / DISC_R, L_SC1 = 14;
  function buildLoop(T) {
    const F = new Frame();
    if (T < 2.0) {
      const env = 1 - smooth((T - 1.0) / 1.0);
      F.dot(CX, CY, R_I + 8 * env * Math.sin(TAU * T / 4), DOT, 1, 2);
    } else if (T < 5.5) {
      const s = L_SC0 * Math.pow(L_SC1 / L_SC0, smooth((T - 2.0) / 3.5));
      drawPowers(F, { s, P: [CX, CY], fuse: 1 - smooth((T - 2.3) / 1.4), nbA: 0 });
    } else if (T < 13.2) {
      const s = L_SC1 * Math.pow(S_END / L_SC1, smooth((T - 5.5) / 5.0));
      const u = sineIO((T - 5.5) / 4.6);
      F.lattice(P5, WM_LEFT + 0.5 * P5, WM_BASE[0] - 0.5 * P5, null, 0.075 * smooth((T - 10.6) / 1.0), 1.3);
      drawPowers(F, {
        s, P: [lerp(CX, TARGET.x, u), lerp(CY, TARGET.y, u)],
        fuse: smooth((T - 9.6) / 0.9), violet: smooth((T - 10.0) / 0.6),
        nbA: smooth((T - 5.0) / 0.6),
      });
    } else {
      // 13.2–15.0 maps onto VI 55.2–57.6
      const tv = 55.2 + (T - 13.2) * (2.4 / 1.8);
      const amp = 8 * smooth((T - 14.2) / 0.8);
      drawReturn(F, {
        zu: sineIO((tv - 55.3) / 2.3), tc: (tv - 55.2), violet: 1 - smooth((T - 13.6) / 1.2),
        breath: amp * Math.sin(TAU * (T - 15) / 4), latA: 1 - smooth((T - 13.2) / 0.6),
      });
    }
    return F;
  }
  function drawLoop(ctx, T) {
    buildLoop(T).render(ctx);
    postProcess(ctx, T, 0.2);
  }

  // ================================================================ event table for the score
  function events() {
    const ev = { samples: [], strikes: [], comb: [], bells: [] };
    A_ORDER.forEach(([gx, gy], i) => ev.samples.push({ t: SAMPLE_T0 + i * SAMPLE_DT, row: gy, tone: A_TONE[gx + ',' + gy] }));
    ev.pen = PEN_T.map(([t0, t1], si) => {
      // ink speed envelope sampled at 200 Hz: d(arc fraction)/dt × pressure
      const env = [];
      for (let t = t0; t <= t1 + 1e-9; t += 0.005) {
        const n0 = inkCount(si, t), n1 = inkCount(si, t + 0.005);
        const k = Math.min(n0, INK[si].length - 1);
        env.push([+t.toFixed(3), (n1 - n0) / 0.005, INK[si][k][2] / R_I]);
      }
      return { t0, t1, env };
    });
    ev.bells.push({ t: 15.0, kind: 'violet-a' });
    STRIKES.forEach((t, col) => {
      const pins = WD.filter((d) => d.col === col);
      ev.strikes.push({ t, col, pins: pins.length, mass: pins.reduce((a, d) => a + d.tone, 0) });
    });
    ev.contrast = { t0: 26.0, t1: 27.6 };
    WD.forEach((d, i) => ev.comb.push({ t: CROSS[i], row: d.row, tone: d.tone, col: d.col, ch: 'Moderne'[d.ci] }));
    ev.comb.sort((a, b) => a.t - b.t);
    ev.vzoom = [];
    for (let t = V_T0; t <= 52; t += 0.02) ev.vzoom.push([+t.toFixed(2), zoomV(t)]);
    ev.resolve = 51.0;
    ev.absorb = WMD.filter((d) => !d.isT).map((d) => +(55.2 + 1.3 * Math.hypot(d.x - TARGET.x, d.y - TARGET.y) / MAXD + 0.95).toFixed(4));
    ev.marks = { V_T0, V_T1, TA, TD, U_END, S_END, CROSS_FIRST: Math.min(...CROSS), CROSS_LAST: Math.max(...CROSS) };
    return ev;
  }

  return { W, H, draw, drawLoop, build, buildLoop, events, consts: { R_I, S_END, TARGET, WM_LEFT, WM_BASE, P5, STRIKES, CROSS, U_END } };
});
