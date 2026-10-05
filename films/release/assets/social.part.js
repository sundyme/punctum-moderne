  // ==================================================================== SOCIAL CUT — 9:16, 30 s, 120 bpm
  // Same engine, same dots, new cameras. Every shot hands its motion to the next one:
  // a rush through the a's bowl → a fly-over of the marquee → a dive into one bulb (white) → paper;
  // a push into a red ball → the g's red ball; whip → whip; a roll that becomes the italic lean;
  // falling capitals → falling flaps; a tilt into the printer; a card's red dot → the tunnel's light;
  // and the last full stop grows back into the first frame, so the clip loops.

  // ------------------------------------------------------------------ camera helpers
  const vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const vadd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const vmul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const vcross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const vnorm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  function upRoll(pos, tgt, roll) {
    const f = vnorm(vsub(tgt, pos));
    let r = vcross(f, [0, 1, 0]);
    if (Math.hypot(r[0], r[1], r[2]) < 1e-4) r = [1, 0, 0];
    r = vnorm(r);
    const u = vcross(r, f);
    return vadd(vmul(u, Math.cos(roll)), vmul(r, Math.sin(roll)));
  }
  const orbitPos = (tgt, d, yaw, pitch) => [tgt[0] + Math.sin(yaw) * Math.cos(pitch) * d, tgt[1] + Math.sin(pitch) * d, tgt[2] + Math.cos(yaw) * Math.cos(pitch) * d];
  function mkCam(pos, tgt, o = {}) {
    const dist = Math.hypot(...vsub(tgt, pos));
    return { pos, tgt, fov: o.fov ?? 0.6, aperture: o.ap ?? 0, focus: o.focus ?? dist, cocMax: o.coc ?? 60, up: upRoll(pos, tgt, o.roll || 0) };
  }
  // slide a camera sideways / vertically in its own frame (whip pans)
  function shiftCam(cam, side, vert = 0) {
    const f = vnorm(vsub(cam.tgt, cam.pos)), r = vnorm(vcross(f, cam.up)), u = cam.up;
    const d = vadd(vmul(r, side), vmul(u, vert));
    cam.pos = vadd(cam.pos, d); cam.tgt = vadd(cam.tgt, d);
    return cam;
  }

  // ------------------------------------------------------------------ social type (big, centred, inside the safe zone)
  const SB = (px) => `700 ${px}px SongB`;
  function zline(c, s, y, px, col, a, o = {}) {
    if (a <= 0) return;
    const t = o.t ?? 1e9, t0 = o.t0 ?? -1e9, ls = o.ls ?? Math.round(px * 0.08);
    c.save();
    c.font = SB(px); c.letterSpacing = ls + "px"; c.textBaseline = "alphabetic"; c.textAlign = "left";
    if (o.shadow !== false) { c.shadowColor = o.shadowCol || "rgba(0,0,0,0.45)"; c.shadowBlur = px * 0.35; }
    const chars = [...s];
    const tw = c.measureText(s).width - ls;
    let x0 = (o.x ?? W / 2) - tw / 2;
    for (let i = 0; i < chars.length; i++) {
      const u = e5(seg(t, t0 + i * 0.035, t0 + i * 0.035 + 0.32));
      if (u <= 0) continue;
      const x = x0 + c.measureText(chars.slice(0, i).join("")).width;
      c.globalAlpha = a * u; c.fillStyle = col;
      c.fillText(chars[i], x, y + (1 - u) * px * 0.45);
    }
    c.restore();
  }
  // caption: Chinese (bold Song) over English (Punctum)
  function scap(c, t, t0, t1, zh, en, o = {}) {
    if (t < t0 || t > t1 + 0.3) return;
    const out = 1 - sm(seg(t, t1, t1 + 0.22));
    const y = o.y ?? 1440, px = o.px ?? 66, col = o.col || "#f6f3ec";
    const lines = zh.split("\n");
    lines.forEach((ln, i) => zline(c, ln, y + i * px * 1.25, px, col, out, { t, t0: t0 + i * 0.12, shadow: o.shadow, shadowCol: o.shadowCol }));
    if (en) {
      const ey = y + (lines.length - 1) * px * 1.25 + px * 0.5 + 34;
      txt(c, en, W / 2, ey, { font: FONT(o.ew || 420, o.epx || 32, o.it), col, align: "center", a: out * sm(seg(t, t0 + 0.15, t0 + 0.45)) * 0.88, ls: 0.4 });
    }
  }
  function tag(c, col, a = 1) {
    if (a <= 0) return;
    c.save(); c.globalAlpha = a; c.fillStyle = S.red; c.beginPath(); c.arc(78, 205, 6, 0, 7); c.fill(); c.restore();
    txt(c, "PUNCTUM MODERNE", 96, 211, { font: FONT(500, 17), col, ls: 4.5, a });
  }

  // ---------------------------------------------------------------- A · HOOK 0–2  (red ball → the a → rush through its bowl)
  const HOOK_LAY = { sort: true, light: [-0.6, 0.8, 0.7], envTop: [0.7, 0.68, 0.82], envBot: [0.42, 0.3, 0.78] };
  const HOOK_BG = fixedBg([0.022, 0.014, 0.04], [0.0, 0.0, 0.003], { r: 1.1 });
  const LAV = hex("#b9a4e8"), LAV2 = hex("#cdbfea"), VIO = hex("#4e347d");
  // a field of out-of-focus dots around the hero ball (deterministic; reused by the last frame so the loop closes)
  function bokehField(b, c, a, t, wave = -1) {
    if (a <= 0) return;
    for (let i = 0; i < 150; i++) {
      const h1 = hash(i * 3.1 + 0.7), h2 = hash(i * 5.3 + 1.9), h3 = hash(i * 7.7 + 2.3), h4 = hash(i * 1.3 + 9.1);
      const front = i < 14;
      const z = front ? 0.6 + h3 * 0.9 : -2.5 - h3 * 30;
      const spread = front ? 1.2 : 1 + (-z) * 0.55;
      let x = (h1 - 0.5) * 2 * (front ? 4.5 : 9) * spread, y = (h2 - 0.5) * 2 * (front ? 7 : 15) * spread;
      if (front && Math.hypot(x, y) < 2.2) x += Math.sign(x || 1) * 2.4;
      const col = h4 < 0.55 ? C.white : h4 < 0.88 ? LAV : C.red;
      const dd = Math.hypot(x, y);
      const lit = wave >= 0 ? pulse(t, wave + dd * 0.035, 5) : 0;
      put(b, c[0] + x, c[1] + y, z, (front ? 0.16 : 0.08 + h2 * 0.18) * (1 + lit * 0.3), col, a * (front ? 0.8 : 1), (front ? 0 : 0.03) + lit * (front ? 0.5 : 1.4) + (h4 > 0.88 && !front ? 0.2 : 0), 1);
    }
  }
  const BALL_R = rad(1.3, 430, 100);
  const HOOK_CAM0 = { d: 2.6, yaw: 0.75, pitch: 0.22, roll: -0.32, fov: 1.0, ap: 1.1, ty: 0.14 };
  function hookA(t) {
    const b = buf(), g = buf();
    const bc = A_ORDER[0].d;
    A_ORDER.forEach((q, k) => {
      const ta = k === 0 ? -1 : -0.3 + k * 0.045;
      if (t < ta) return;
      const [x, y, tone] = q.d, ball = tone > 1.1;
      const pop = back(seg(t, ta, ta + 0.24), 2.4);
      const e = ball ? 0.25 + pulse(t, 0.9, 6) * 1.6 : pulse(t, ta, 9) * 2.0 + 0.04;
      const thump = ball ? 1 + 0.07 * Math.sin(Math.PI * seg(t, 0, 0.22)) : 1;
      put(b, x, y, 0, rad(tone, 430, 100) * pop * thump, ball ? C.red : C.white, 1, ball ? e * 0.4 : e, ball ? 8 : 1);
    });
    bokehField(b, [bc[0], bc[1], 0], 1, t, 0.0);
    // the first beat: two shock rings of light leave the ball
    const ring = buf();
    for (const [t0, g] of [[0.03, 1], [0.13, 0.55], [0.23, 0.3]]) {
      const u = e5(seg(t, t0, t0 + 0.75));
      if (u <= 0 || u >= 1) continue;
      const R = 0.56 + 2.8 * u;
      for (let q = 0; q < 160; q++) { const an = q / 160 * Math.PI * 2; put(ring, bc[0] + Math.cos(an) * R, bc[1] + Math.sin(an) * R, 0, 0.018 + 0.01 * (1 - u), [1, 0.9, 0.96], 1, 1.5 * g * (1 - u) * sm(seg(t, t0, t0 + 0.04)), 6); }
    }
    const la = sm(seg(t, 0.45, 1.1)) * 0.5;
    if (la > 0) for (let x = -9; x <= 14; x++) for (let y = -12; y <= 18; y++) {
      const dd = Math.hypot(x - bc[0], y - bc[1]);
      put(g, x, y, -0.6, 0.05, [0.45, 0.45, 0.5], la * sm(seg(t - 0.45, dd * 0.05, dd * 0.05 + 0.4)), 0, 0);
    }
    // macro on the ball → explosive pull-out → a breath → rush through the bowl
    const k = e5(seg(t, 0.28, 1.2));
    const rush = ei(seg(t, 1.55, 2.0));
    const ctr = [2.4, 2.0, 0];
    let tgt = v3([bc[0], bc[1] + HOOK_CAM0.ty, 0], [2.5, 2.6, 0], eio(seg(t, 0.28, 1.1)));
    tgt = v3(tgt, ctr, eio(seg(t, 1.15, 1.55)));
    const yaw = lerp(HOOK_CAM0.yaw, -0.12, k) - Math.max(0, t - 1) * 0.08;
    const pitch = lerp(HOOK_CAM0.pitch, 0.1, k);
    const d0 = lerp(HOOK_CAM0.d, 21, k) - Math.max(0, t - 1.2) * 2.5;
    let pos = orbitPos(tgt, d0, yaw, pitch);
    const shake = pulse(t, 0, 9) * 0.05;
    pos = vadd(pos, [Math.sin(t * 93) * shake, Math.sin(t * 71) * shake, 0]);
    if (rush > 0) {
      const dir = vnorm(vsub(pos, ctr));
      pos = vadd(ctr, vmul(dir, lerp(d0, -6, rush)));
      tgt = vsub(ctr, vmul(dir, lerp(0, 30, rush)));
    }
    const cam = mkCam(pos, tgt, { fov: lerp(HOOK_CAM0.fov, 0.75, k) + rush * 0.5, ap: lerp(HOOK_CAM0.ap, 0.3, k), focus: Math.max(1, d0), coc: 90, roll: lerp(HOOK_CAM0.roll, 0, k) + rush * 0.5 });
    return {
      t, cam, bg: HOOK_BG,
      layers: [lay(g, { billboard: false }), lay(b, HOOK_LAY), lay(ring, { additive: true })],
      post: { bloom: 0.6, thr: 1.05, vign: 0.72, grain: 0.016, ca: 0.004 * Math.sin(Math.PI * seg(t, 0, 0.3)) },
      tagCol: S.white,
      overlay(c) {
        const out = 1 - sm(seg(t, 1.55, 1.8));
        const lift = -160 * ei(seg(t, 1.55, 1.9));
        zline(c, "这套字体", 400 + lift, 96, S.white, out);
        zline(c, "没有一根线", 520 + lift, 96, S.white, out);
        txt(c, "This typeface has no lines.", W / 2, 590 + lift, { font: FONT(420, 34), col: S.white, align: "center", a: out * 0.85 });
        const u = e5(seg(t, 0.88, 1.12));
        if (u > 0) {
          c.save();
          c.translate(W / 2, 1490 - lift * 0.5); c.scale(1 + 0.3 * (1 - u), 1 + 0.3 * (1 - u));
          zline(c, "只有点。", 0, 132, S.red, u * out, { x: 0, shadowCol: "rgba(0,0,0,0.6)" });
          c.restore();
          txt(c, "Only dots.", W / 2, 1572 - lift * 0.5, { font: FONT(500, 40, true), col: S.white, align: "center", a: u * out * 0.9, ls: 1 });
        }
      },
    };
  }

  // ---------------------------------------------------------------- B · MARQUEE 2–5  (two blade signs; a rush in, a crane up, a dive into one bulb)
  const BLADES = [["PUNCTUM", -8.2], ["MODERNE", 8.2]].map(([w, x]) => {
    const dots = [];
    [...w].forEach((ch, i) => {
      const L = layout(ch, {});
      const cy = 40 - i * 13.5;
      for (const d of L.dots) dots.push([x - L.w / 2 + d[0], cy + d[1] - 5, d[2]]);
    });
    return { dots, x };
  });
  const BL_TOP = 40 + 7.5, BL_BOT = 40 - 6 * 13.5 - 7.5, BL_W = 14;
  const DIVE = (() => { const d = BLADES[1].dots.reduce((a, q) => (q[1] > a[1] - 0.01 && Math.abs(q[0] - 8.2) < Math.abs(a[0] - 8.2) + 0.5 ? q : a)); return [d[0], d[1], 0]; })();
  function marqueeB(t) {
    const lt = t - 2;
    const b = buf(), fr = buf(), wall = buf();
    const r0 = rad(1, 650, 0) * 0.95;
    const dv = eio(seg(t, 4.3, 4.95));
    BLADES.forEach((bl, bi) => bl.dots.forEach((d, i) => {
      const wave = Math.pow(0.5 + 0.5 * Math.cos(d[1] * 0.3 + lt * 11 + bi * 1.4), 6);
      let on = (0.4 + 0.75 * wave + (hash(i + bi * 999 + Math.floor(lt * 8)) > 0.93 ? 0.4 : 0)) * (0.85 + 0.5 * beatEnv(t, 6));
      if (bi === 1 && Math.abs(d[0] - DIVE[0]) < 1e-3 && Math.abs(d[1] - DIVE[1]) < 1e-3) on += 3 * ei(seg(t, 4.5, 5.0));
      put(b, d[0], d[1], 0.3, r0, C.gold, 1, on * 1.25, 2);
    }));
    // bulb borders around each blade, chasing
    for (const bl of BLADES) {
      const x0 = bl.x - BL_W / 2 - 1, x1 = bl.x + BL_W / 2 + 1;
      for (let y = BL_BOT; y <= BL_TOP; y += 2) for (const x of [x0, x1]) {
        const on = ((Math.round(y / 2) + Math.floor(t * 14)) % 3 === 0) ? 1.5 : 0.25;
        put(fr, x, y, 0.3, r0 * 0.75, C.gold, 1, on, 2);
      }
      for (let x = x0 + 2; x < x1 - 0.5; x += 2) for (const y of [BL_BOT, BL_TOP]) put(fr, x, y, 0.3, r0 * 0.75, C.gold, 1, ((Math.round(x / 2) + Math.floor(t * 14)) % 3 === 0) ? 1.5 : 0.25, 2);
    }
    // a dark wall of unlit dots behind, for depth
    for (let x = -40; x <= 40; x += 2) for (let y = -70; y <= 80; y += 2) put(wall, x, y, -3, 0.08, [0.55, 0.45, 0.32], 0.35, 0, 0);
    // rush in from far (carrying the hook's forward motion), crane up the blades, then dive into a bulb
    const k = e5(seg(t, 2.0, 3.0));
    const up = eio(seg(t, 2.2, 4.4));
    const tgtF = [lerp(0, 2, up), lerp(-22, 30, up), 0];
    const posF = [lerp(-14, 12, up), tgtF[1] - lerp(30, 14, up), lerp(160, 38, k) - 6 * up];
    const pos = v3(posF, [DIVE[0], DIVE[1] - 0.6, 2.2], dv);
    const tgt = v3(tgtF, DIVE, e5(seg(t, 4.3, 4.8)));
    const cam = mkCam(pos, tgt, { fov: lerp(1.25, 1.05, k), ap: 0.25 + dv * 1.0, focus: Math.hypot(...vsub(DIVE, pos)), coc: 80, roll: lerp(0.25, -0.12, up) * (1 - dv) });
    return {
      t, cam,
      bg: fixedBg(hex("#22150a"), hex("#040201"), { r: 1.0 }),
      layers: [lay(wall, { billboard: false }), quad({ pos: [-8.2, (BL_TOP + BL_BOT) / 2, 0], size: [BL_W + 4, BL_TOP - BL_BOT + 4], color: hex("#1a0f07"), mode: 4, p: [1.2, 0, 0, 0] }),
        quad({ pos: [8.2, (BL_TOP + BL_BOT) / 2, 0], size: [BL_W + 4, BL_TOP - BL_BOT + 4], color: hex("#1a0f07"), mode: 4, p: [1.2, 0, 0, 0] }), lay(fr, {}), lay(b, {})],
      post: { bloom: 0.85, thr: 1.0, vign: 0.75, grain: 0.017, ca: 0.0015, expo: 1 + 7 * ei(seg(t, 4.72, 5.0)) },
      tagCol: "#ffe6c2",
      overlay(c) {
        scap(c, t, 2.5, 4.3, "点阵上的 Didone", "A Didone on the dot matrix.", { y: 1500, col: "#ffe9cc", px: 70 });
      },
    };
  }

  // ---------------------------------------------------------------- C · PRESSURE 5–8  (riso: pen strokes break into dots)
  const LAG = layout("ag", {}), KAG = 1.75;
  const AG_OX = -LAG.w * KAG / 2 - 4.5, AG_OY = -3.6 * KAG + 1.6;
  const AG_BALL = (() => { const d = LAG.dots.find((q) => q[2] > 1.1 && q[3] === 0); return [AG_OX + d[0] * KAG, AG_OY + d[1] * KAG, 0]; })();
  function risoC(t) {
    const ts = t < 6 ? 10.0 + (t - 5) * 2.0 : 12.0 + (t - 6) * 0.9;
    const F = S3(ts);
    F.layers = F.layers.map((l) => (l && l.type === "quad" && l.size && l.size[0] === 70) ? Object.assign({}, l, { size: [150, 240] }) : l);
    // grazing view across the sheet → swing to face it on the shatter → push into the red ball
    const s = eio(seg(t, 5.7, 6.1));
    const g1 = seg(t, 5.0, 5.7);
    const p1 = { tgt: [-4.5, 2, 0], d: lerp(30, 27, g1), yaw: 0.25, pitch: lerp(-1.36, -1.22, g1), roll: 0.35, fov: 1.1 };
    const p2 = { tgt: [-4.5 + 1.5 * seg(t, 6.1, 7.6), -2, 0], d: lerp(66, 54, eio(seg(t, 6.1, 7.6))), yaw: 0, pitch: 0, roll: 0.06 * seg(t, 6.1, 7.6), fov: 0.9 };
    let tgt = v3(p1.tgt, p2.tgt, s), d = lerp(p1.d, p2.d, s);
    const yaw = lerp(p1.yaw, p2.yaw, s), pitch = lerp(p1.pitch, p2.pitch, s);
    let roll = lerp(p1.roll, p2.roll, s), fov = lerp(p1.fov, p2.fov, s);
    const push = ei(seg(t, 7.55, 8.0));
    tgt = v3(tgt, AG_BALL, eio(seg(t, 7.5, 7.9)));
    d = Math.exp(lerp(Math.log(d), Math.log(1.0), push));
    roll += 0.8 * push;
    const pos = orbitPos(tgt, d, yaw, pitch);
    F.cam = mkCam(pos, tgt, { fov, ap: 0.15 + push * 0.8, focus: d, roll });
    F.post = Object.assign({}, F.post, { expo: 1 + 6 * (1 - e5(seg(t, 5.0, 5.35))) });
    F.overlay = (c) => {
      scap(c, t, 6.15, 7.5, "粗笔成满点\n细线成针尖", "Thick strokes become full dots. Hairlines, pinpricks.", { y: 1380, col: "#15151b", px: 70, shadow: false, epx: 28 });
    };
    F.tagCol = "#15151b";
    return F;
  }

  // ---------------------------------------------------------------- D · WEIGHT 8–10.5  (the g pumps 100 ↔ 900 on the beat, orbited)
  const LGG = layout("g", {});
  const G_OX = -2.5, G_OY = -1.5;
  const G_BALL = (() => { const d = LGG.dots.find((q) => q[2] > 1.1); return [G_OX + d[0], G_OY + d[1], 0]; })();
  const WSEQ = [400, 900, 100, 900, 100, 900, 250];
  function wAt(t) {
    const lt = Math.max(0, t - 8);
    const i = Math.min(WSEQ.length - 2, Math.floor(lt / BEAT));
    return lerp(WSEQ[i], WSEQ[i + 1], back(seg(lt - i * BEAT, 0, 0.22), 1.3));
  }
  function weightD(t) {
    const b = buf(), gh = buf(), lat = buf();
    const w = wAt(t), w2 = wAt(t - 0.07);
    textDots(gh, LGG, { ox: G_OX, oy: G_OY, w: w2, col: C.red, z: -0.04 }, () => ({ a: 0.35 }));
    textDots(b, LGG, { ox: G_OX, oy: G_OY, w, col: C.white, ball: C.red, style: 1, emit: 0.05 }, (p) => (p.ball ? { e: 0.25 + 0.6 * beatEnv(t, 8) } : {}));
    for (let x = -14; x <= 14; x++) for (let y = -18; y <= 18; y++) put(lat, x, y, -2.5, 0.05, [0.5, 0.5, 0.56], 0.3 * sm(seg(t, 8.2, 8.8)), 0, 0);
    const k = e5(seg(t, 8.0, 8.85));
    const tgt = v3(G_BALL, [0, 1.6, 0], eio(seg(t, 8.0, 8.7)));
    let d = Math.exp(lerp(Math.log(1.0), Math.log(20), k)) * (1 - 0.035 * beatEnv(t, 8) * k);
    const whip = ei(seg(t, 10.3, 10.5));
    const yaw = lerp(-0.75, 0.45, eio(seg(t, 8.0, 10.3))) + whip * 1.6;
    const pitch = lerp(0.12, -0.12, eio(seg(t, 8.0, 10.3)));
    const cam = mkCam(orbitPos(tgt, d, yaw, pitch), tgt, { fov: lerp(1.0, 0.8, k), ap: lerp(0.9, 0.25, k), focus: d, roll: lerp(0.8, 0, k) * (1 - seg(t, 8, 8.9)) });
    return {
      t, cam, bg: fixedBg(hex("#121216"), hex("#020203"), { r: 1.1 }),
      layers: [lay(lat, { billboard: false }), lay(gh, {}), lay(b, { sort: true, light: [-0.5, 0.8, 0.7], envTop: [0.55, 0.58, 0.66] })],
      post: { bloom: 0.45, thr: 1.0, vign: 0.6, grain: 0.016 },
      tagCol: S.white,
      overlay(c) {
        const a = sm(seg(t, 8.5, 8.8)) * (1 - sm(seg(t, 10.25, 10.4)));
        txt(c, String(Math.round(cl(w, 100, 900))), W / 2, 470, { font: FONT(Math.round(cl(w, 100, 900)), 210), col: S.white, align: "center", a });
        txt(c, "WGHT   100 — 900", W / 2, 530, { font: FONT(500, 20), col: S.white, ls: 6, align: "center", a: a * 0.7 });
        scap(c, t, 8.65, 10.2, "字重只改变点的大小", "Weight moves the radius, never the dot.", { y: 1530, px: 64 });
      },
    };
  }

  // ---------------------------------------------------------------- E · CONTRAST 10.5–13  (LED → ink, seen from the side)
  const L5 = layout("Didone", {}), K5 = 0.95;
  const X5L = -L5.w * K5 / 2 - 6, X5R = L5.w * K5 / 2 + 6;
  function xbAt(ts) {
    if (ts < 20.25) return X5L;
    if (ts < 22) return lerp(X5L, X5R, eio(seg(ts, 20.25, 21.75)));
    if (ts < 23) return lerp(X5R, X5L, eio(seg(ts, 22.0, 22.75)));
    return lerp(X5L, X5R, e5(seg(ts, 23.0, 23.6)));
  }
  function cntrE(t) {
    const ts = 20.0 + (t - 10.5) * 1.44;
    const F = S5(ts);
    const xb = xbAt(ts);
    const yaw = lerp(-1.0, 0.7, e5(seg(t, 10.5, 10.9))) + 0.25 * eio(seg(t, 10.9, 12.9));
    const end = ei(seg(t, 12.7, 13.0));
    const tgt = [lerp(0, xb, 0.35), 0, 0];
    const d = 30 - 8 * end;
    F.layers = F.layers.map((l) => (l && l.type === "quad" && l.size && l.size[1] === 40) ? Object.assign({}, l, { size: [l.size[0], 260] }) : l);
    F.cam = mkCam(orbitPos(tgt, d, yaw, -0.12), tgt, { fov: 0.95, ap: 0.25, focus: d, roll: -0.3 * end });
    F.post = Object.assign({}, F.post, { flash: [0, 0, 0, 0] });
    F.tagCol = "#ffd9cf";
    F.overlay = (c) => {
      const v = Math.round(100 * (1 - seg(xb, X5L, X5R)));
      const a = sm(seg(t, 10.7, 10.95)) * (1 - sm(seg(t, 12.75, 12.95)));
      txt(c, String(v), W / 2, 470, { font: FONT(300, 210), col: "#ffd9cf", align: "center", a });
      txt(c, "CNTR   0 MACHINE — 100 PEN", W / 2, 530, { font: FONT(500, 20), col: "#ffd9cf", ls: 5, align: "center", a: a * 0.75 });
      scap(c, t, 10.95, 12.65, "对比度：从机器到笔", "Contrast: from machine to pen.", { y: 1470, col: "#ffe7df", px: 64 });
    };
    return F;
  }

  // ---------------------------------------------------------------- F · ITALIC 13–16.5  (the lean, an R drawn in light, 26 swash capitals)
  const RL = layout("R", { it: true, sw: true, align: "c" });
  const R_ORDER = (() => {
    const o = RL.dots.map((d, i) => ({ i, o: d[0] + d[1] * 0.25 })).sort((a, b) => a.o - b.o);
    const rank = new Array(RL.dots.length);
    o.forEach((q, j) => (rank[q.i] = j));
    return rank;
  })();
  const R_TA = (i) => 14.35 + R_ORDER[i] / RL.dots.length * 1.0;
  const AZ = "ABCDEFGHIJKLMNOPQRSTUVWXYZ", AZC = 4;
  const azCell = (j) => [(j % AZC - 1.5) * 14 + 7, -Math.floor(j / AZC) * 18 + 72];
  function italicF(t) {
    const sp = buf(), lat = buf();
    const lightDir = [-0.5, 0.75, 0.75];
    let cam, over = () => {};
    const post = { bloom: 0.7, thr: 0.95, vign: 0.6, grain: 0.016 };
    if (t < 14.3) {
      const sh = eio(seg(t, 13.0, 13.55)), m = eio(seg(t, 13.45, 14.0));
      const ox = -lerp(MORPH.wR, MORPH.wI, m) / 2;
      for (const [r, i] of MORPH.pairs) {
        const a = r ? [r[0], r[1], r[2]] : [i[0], i[1], 0];
        const b2 = i ? [i[0], i[1], i[2]] : [r[0], r[1], 0];
        const x = lerp(a[0], b2[0], m), y = lerp(a[1], b2[1], m);
        const rr = lerp(r ? rad(a[2], 450) : 0, i ? rad(b2[2], 450) : 0, m);
        const ball = (i && i[2] > 1.1 && m > 0.5) || (r && r[2] > 1.1 && m < 0.5);
        put(sp, ox + x + (y - PIV) * TAN * sh, y - 4, 0, rr, ball ? C.gold : C.white, 1, ball ? 1.2 : 0.06, 1);
      }
      for (let x = -44; x <= 44; x++) for (let y = -14; y <= 14; y++) put(lat, x + (y + 4 - PIV) * TAN * sh, y, -0.3, 0.06, [0.4, 0.45, 0.7], 0.3, 0, 0);
      const tx = lerp(-16, 12, eio(seg(t, 13.0, 14.3)));
      cam = mkCam([tx - 10, -14, 30], [tx + 3, -0.5, 0], { fov: 1.1, ap: 0.35, roll: lerp(-0.3, 0, e5(seg(t, 13.0, 13.4))) });
      shiftCam(cam, 30 * ei(seg(t, 14.15, 14.3)));
      over = (c) => scap(c, t, 13.15, 14.15, "点阵被推斜\n字母开始书写", "The grid leans. The letters begin to write.", { y: 1400, px: 64, it: true });
    } else {
      // the R, drawn in light; the camera rides the pen
      let hx = 0, hy = 0, hw = 0;
      RL.dots.forEach((d, i) => {
        const ta = R_TA(i);
        if (t < ta) return;
        const x = d[0] + (d[1] - PIV) * TAN, y = d[1] - 4.5;
        const ball = d[2] > 1.1, fl = pulse(t, ta, 6);
        const wgt = pulse(t, ta, 9) + 1e-3;
        hx += x * wgt; hy += y * wgt; hw += wgt;
        put(sp, x, y, 0, rad(d[2], 480) * back(seg(t, ta, ta + 0.25), 2.5), ball ? C.gold : mixc(C.white, C.gold, fl), 1, (ball ? 1.4 : 0.05) + fl * 2.5, 1);
      });
      const head = hw > 0 ? [hx / hw, hy / hw, 0] : [-4, -4.5, 0];
      // the other 25 capitals, around the R
      const g0 = 15.5;
      AZ.split("").forEach((ch, j) => {
        if (j === 17) return;
        const [cx, cy] = azCell(j);
        const dd = Math.hypot(cx, cy);
        const ta = g0 + dd * 0.0045;
        if (t < ta) return;
        const L = layout(ch, { it: true, sw: true });
        const fall = ei(seg(t, 16.2 + (j % AZC) * 0.025, 16.5));
        for (const d of L.dots) {
          const x = cx - L.w / 2 + d[0] + (d[1] - PIV) * TAN, y = cy + d[1] - 4.5 - fall * 90 * (1 + hash(j) * 0.5);
          const ball = d[2] > 1.1;
          put(sp, x, y, -fall * 12, rad(d[2], 480) * back(seg(t, ta, ta + 0.2)), ball ? C.gold : C.white, 1, (ball ? 1.3 : 0.05) + pulse(t, ta, 8) * 2, 1);
        }
      });
      // the R falls with them
      if (t > 16.2) {
        const fall = ei(seg(t, 16.25, 16.5));
        for (let q = 0; q < sp.n; q++) { /* R dots were put first */ if (q >= RL.dots.length) break; sp.d[q * STRIDE + 1] -= fall * 90; }
      }
      const pull = e5(seg(t, 15.45, 16.2));
      const ride = { tgt: head, d: 15, yaw: 0.25, pitch: -0.25 };
      const wide = { tgt: [7, 14, 0], d: 190, yaw: 0.0, pitch: -0.05 };
      const tg = v3(ride.tgt, wide.tgt, pull);
      tg[1] -= 40 * ei(seg(t, 16.3, 16.5));
      const d = Math.exp(lerp(Math.log(ride.d), Math.log(wide.d), pull));
      cam = mkCam(orbitPos(tg, d, lerp(ride.yaw, wide.yaw, pull), lerp(ride.pitch, wide.pitch, pull)), tg, { fov: lerp(1.0, 0.7, pull), ap: lerp(0.8, 0.05, pull), focus: d, coc: 60 });
      shiftCam(cam, -30 * (1 - e5(seg(t, 14.3, 14.5))) * (10 / 30));
      over = (c) => {
        scap(c, t, 14.4, 15.35, "一笔画出的花式 R", "A swash R, drawn in one stroke.", { y: 1460, px: 64, it: true, col: "#ffe2b8" });
        scap(c, t, 15.65, 16.25, "26 个花式大写", "26 swash capitals.", { y: 1460, px: 72, it: true, col: "#ffe2b8" });
      };
    }
    return {
      t, cam, bg: fixedBg(hex("#0f1838"), hex("#02030a"), { r: 1.2 }),
      layers: [lay(lat, { billboard: false }), lay(sp, { sort: true, light: lightDir, envTop: [0.35, 0.4, 0.75], envBot: [0.02, 0.02, 0.05] })],
      post, tagCol: "rgba(210,220,255,0.9)", overlay: over,
    };
  }

  // ---------------------------------------------------------------- G · CHARACTER SET 16.5–19  (a tall split-flap board, swung in perspective)
  const GC = 9, GR = 5;
  const GBOARD = [
    [16.5, ["266", "GLYPHS", "", "36", "LANGUAGES"]],
    [17.0, ["POLSKI", "ŻÓŁW", "ŁÓDŹ", "JEŻ", "ŚWIĘTO"]],
    [17.5, ["ČEŠTINA", "ŽLUŤOUČKÝ", "KŮŇ", "ÚPĚL", "ĎÁBEL"]],
    [18.0, ["MAGYAR", "ÁRVÍZ", "TŰRŐ", "TÜKÖR", "FÚRÓGÉP"]],
    [18.5, ["TÜRKÇE", "ŞOFÖR", "ÇABUCAK", "GÜVENDİ", "YAĞIZ"]],
  ].map(([t0, rows]) => [t0, rows.map((s) => { const a = [...s]; const pad = Math.floor((GC - a.length) / 2); const out = new Array(GC).fill(" "); a.forEach((ch, i) => { if (pad + i < GC) out[pad + i] = ch; }); return out; })]);
  const gDelay = (r, col) => col * 0.006 + r * 0.02 + hash(r * 31 + col) * 0.02;
  const gFlips = (r, col, si) => 2 + Math.floor(hash(r * 7 + col * 3 + si) * 2);
  function flapG(t) {
    const tw = 11.6, th = 19, bw = GC * tw, bh = GR * th;
    const tiles = [], b = buf();
    let si = 0;
    for (let i = 0; i < GBOARD.length; i++) if (t >= GBOARD[i][0]) si = i;
    for (let r = 0; r < GR; r++) for (let col = 0; col < GC; col++) {
      const cx = -bw / 2 + (col + 0.5) * tw, cy = bh / 2 - (r + 0.5) * th;
      const delay = gDelay(r, col);
      const cur = GBOARD[si][1][r][col], prev = si > 0 ? GBOARD[si - 1][1][r][col] : " ";
      const t0 = GBOARD[si][0] + delay;
      let ch = cur, phase = 0;
      const flips = cur === prev ? 0 : gFlips(r, col, si);
      const fd = 0.045, u = (t - t0) / fd;
      if (flips && u < flips) {
        if (u < 0) ch = prev;
        else { const k = Math.floor(u); ch = k === flips - 1 ? cur : FLAPSET[Math.floor(hash(r * 13 + col * 17 + k + si * 5) * FLAPSET.length)]; phase = u - k; }
      }
      const sq = Math.abs(Math.cos(phase * Math.PI));
      tiles.push(quad({ pos: [cx, cy, 0], size: [tw - 0.7, th - 0.8], color: hex("#1b1b1f"), mode: 4, p: [0.9, 0, 0, 0] }));
      if (ch !== " ") {
        const L = layout(ch, {});
        textDots(b, L, { ox: cx - L.w / 2, oy: 0, w: 520, col: C.cream, ball: C.red }, (p) => ({ y: cy + (p.dt[1] - 5) * sq, z: 0.05, c: p.ball ? C.red : mixc(C.cream, [0.3, 0.3, 0.3], 1 - sq), e: 0.08 }));
      }
    }
    for (let r = 0; r < GR; r++) tiles.push(quad({ pos: [0, bh / 2 - (r + 0.5) * th, 0.03], size: [bw, 0.12], color: hex("#050506"), mode: 0 }));
    const u = eio(seg(t, 16.5, 19));
    const tgt = [lerp(-6, 6, u), 40 * (1 - e5(seg(t, 16.5, 16.9))), 0];
    const d = 150;
    const cam = mkCam(orbitPos(tgt, d, lerp(-0.55, 0.42, u), lerp(-0.2, 0.1, u)), tgt, { fov: 1.0, ap: 0.3, focus: d, coc: 30, roll: lerp(0.06, -0.04, u) });
    shiftCam(cam, 0, -120 * ei(seg(t, 18.8, 19.0)));
    return {
      t, cam, bg: fixedBg(hex("#17171a"), hex("#030304"), { r: 1.2 }),
      layers: [quad({ pos: [0, 0, -0.2], size: [bw + 6, bh + 6], color: hex("#0c0c0e"), mode: 4, p: [1.5, 0, 0, 0] }), ...tiles, lay(b, { billboard: false })],
      post: { bloom: 0.25, thr: 1.2, vign: 0.65, grain: 0.017 },
      tagCol: S.white,
      overlay(c) { scap(c, t, 16.75, 18.85, "266 个字符 · 36 种语言", "Every accent, drawn dot by dot.", { y: 1500, px: 62 }); },
    };
  }

  // ---------------------------------------------------------------- H · IN USE 19–22.5  (printer, watch, menu, card — whip to whip)
  function useH(t) {
    let F, cam;
    const W1 = 20.4, W2 = 21.2, W3 = 21.9;
    if (t < W1) {
      const ts = 54 + (t - 19) * 1.43;
      F = printerShot(ts);
      const hx = headX(ts) * 0.7 + lerp(-9, 0, eio(seg(t, 19, W1))) * 0.3;
      cam = mkCam([hx + 6, 2.6, 8.5], [hx - 1.5, 0.6, 0], { fov: 1.0, ap: 0.9, coc: 40 });
      shiftCam(cam, 0, 30 * (1 - e5(seg(t, 19.0, 19.35))));
      shiftCam(cam, 22 * ei(seg(t, W1 - 0.14, W1)));
      F.over = (c) => scap(c, t, 19.2, W1 - 0.1, "点阵打印机", "Nine pins, one ribbon.", { y: 1500, px: 64 });
    } else if (t < W2) {
      F = S10(57.0 + (t - W1));
      const yaw = lerp(0.55, 0.25, eio(seg(t, W1, W2)));
      cam = mkCam(orbitPos([0, 0, 0], 66, yaw, -0.32), [0, 0, 0], { fov: 0.9, ap: 0.3 });
      shiftCam(cam, -40 * (1 - e5(seg(t, W1, W1 + 0.2))));
      shiftCam(cam, 40 * ei(seg(t, W2 - 0.14, W2)));
      F.over = (c) => scap(c, t, W1 + 0.1, W2 - 0.1, "表盘", "Watch face.", { y: 1500, px: 64 });
    } else if (t < W3) {
      F = S10(60.0 + (t - W2));
      const k = eio(seg(t, W2, W3));
      cam = mkCam([lerp(10, 4, k), lerp(-30, -24, k), lerp(48, 44, k)], [0, lerp(-3, 1, k), 0], { fov: 0.85, ap: 0.2 });
      shiftCam(cam, -40 * (1 - e5(seg(t, W2, W2 + 0.2))));
      shiftCam(cam, 40 * ei(seg(t, W3 - 0.14, W3)));
      F.over = (c) => scap(c, t, W2 + 0.1, W3 - 0.1, "菜单", "Menu.", { y: 1560, px: 64, col: "#f6f3ec" });
    } else {
      F = S10(61.1 + (t - W3) * 1.3);
      const push = ei(seg(t, 22.22, 22.5));
      const d = Math.exp(lerp(Math.log(38), Math.log(1.2), push));
      cam = mkCam([0, -4 * (1 - push), d], [0, 0, 0], { fov: 0.8, ap: 0.2 });
      shiftCam(cam, -40 * (1 - e5(seg(t, W3, W3 + 0.2))));
      F.over = (c) => scap(c, t, W3 + 0.05, 22.25, "名片", "Business card.", { y: 1500, px: 64 });
    }
    F.cam = cam;
    F.post = Object.assign({}, F.post, { glitch: 0, ca: 0, flash: [0, 0, 0, 0] });
    F.overlay = F.over;
    F.tagCol = S.white;
    return F;
  }

  // ---------------------------------------------------------------- I · SIGNAL 22.5–26  (a barrel-rolling corridor of type → the stacked wordmark)
  const WORD2 = layout("Punctum\nModerne", { align: "c", lead: 15 });
  const KW2 = 30 / WORD2.w, ZC2 = fit(62);
  const W2OY = 4 + 2.5 * KW2;
  const tsI = (t) => (t < 24 ? 62 + (t - 22.5) * (2 / 1.5) : 64 + (t - 24));
  function laneDot2(j, d, ts, extraR = 0) {
    const L = LANES[j];
    const per = (L.w + 1) * TS;
    const zr = -((((d[0] * TS - travel(ts)) % per) + per) % per) + 3;
    const ang = j / LANES.length * Math.PI * 2 + (ts - 62) * 0.32 + (d[1] - 5) * TS / TR;
    const R = TR + extraR;
    return [Math.cos(ang) * R, Math.sin(ang) * R, ZC2 + zr, zr];
  }
  function wordmark(b, t, o, fn) {
    textDots(b, WORD2, { k: KW2, ox: 0, oy: W2OY + (o.dy || 0), w: o.w ?? 520, col: C.white, ball: C.red, style: 1 }, fn);
  }
  function signalI(t) {
    const ts = tsI(t);
    const b = buf(), tun = buf(), bgd = buf();
    const open = ei(seg(ts, 63.2, 64.0));
    if (ts < 64.2) {
      const v = 22 + 150 * ei(seg(ts, 62, 63.4));
      for (let j = 0; j < LANES.length; j++) {
        const L = LANES[j];
        for (let q = 0; q < L.dots.length; q++) {
          const d = L.dots[q];
          const [x, y, z, zr] = laneDot2(j, d, ts, open * 70);
          if (zr < -150) continue;
          const fog = Math.exp(zr / 60) * (1 - seg(ts, 63.95, 64.2)) * seg(-zr, 1.5, 14);
          const ball = d[2] > 1.1;
          const r = rad(d[2], 520, 100) * TS * 1.15;
          const col = ball ? C.red : C.cream;
          put(tun, x, y, z, r, col, fog, ball ? 1.8 : 0.55, 0);
          for (let s = 1; s <= 2; s++) put(tun, x, y, z + s * v * 0.007, r * (1 - s * 0.2), col, fog * [0, 0.38, 0.14][s], ball ? 1.2 : 0.45, 6);
        }
      }
      // the card's red dot recedes and becomes the light at the end of the corridor
      const rec = e5(seg(t, 22.5, 22.95));
      put(tun, 0, 0, ZC2 - lerp(1.6, 220, rec), lerp(1.0, 1.6 + 3 * ei(seg(ts, 62, 63.6)), rec), mixc(C.red, [1, 0.9, 0.8], rec), 1 - open, lerp(1.2, 0.9, rec), 6);
    }
    wordmark(b, t, { w: lerp(380, 520, seg(ts, 64, 66)) }, (p) => {
      const h = hash(p.i * 2.3 + 1);
      const u = eio(seg(ts, 63.15 + h * 0.35, 63.98));
      if (u <= 0) return null;
      const j = p.i % LANES.length;
      const src = laneDot2(j, [p.i * 0.7, 5, 0], 63.15 + h * 0.35, 0);
      const sz = ZC2 - 25 - 60 * h;
      const sweep = (ts - 64.6) * 20 - 20, lx = p.y * 1.2 + p.x - sweep;
      const sheen = Math.exp(-lx * lx * 0.05) * seg(ts, 64.5, 64.8);
      return { x: lerp(src[0], p.x, u), y: lerp(src[1], p.y, u), z: lerp(sz, 0, u), r: p.r * lerp(0.6, 1, u), e: (1 - u) * 0.8 + 0.1 + sheen * 0.55 + pulse(ts, 64, 5) * 0.6 };
    });
    if (ts >= 64 && ts < 65.2) {
      const u = e5(seg(ts, 64, 65.2));
      for (let q = 0; q < 220; q++) { const a = q / 220 * Math.PI * 2; put(tun, Math.cos(a) * (6 + 70 * u), Math.sin(a) * (6 + 70 * u) * 1.7 + 4, -0.5, 0.18, C.cream, 1 - u, 1.6, 0); }
    }
    const ga = sm(seg(ts, 64.3, 65.5)) * 0.32;
    if (ga > 0) for (let x = -26; x <= 26; x += 2) for (let y = -40; y <= 40; y += 2) {
      const dd = Math.hypot(x, y - 4);
      put(bgd, x, y, -8, 0.07, [0.5, 0.5, 0.55], ga * sm(seg(ts - 64.3, dd * 0.02, dd * 0.02 + 0.5)), 0, 0);
    }
    const roll = lerp(-1.3, 0, eio(seg(ts, 62, 64)));
    const fov = lerp(0.95, 0.5, eio(seg(ts, 63.1, 64)));
    const camZ = ZC2 + 4 * (1 - e5(seg(ts, 64, 66)));
    const cam = { pos: [Math.sin((ts - 64) * 0.9) * 0.5 * seg(ts, 64, 66), 0, camZ], tgt: [0, 0, 0], up: [Math.sin(roll), Math.cos(roll), 0], fov,
      aperture: ts < 64 ? 0.3 : 0.1, focus: ts < 64 ? 40 : ZC2, cocMax: 18 };
    return {
      t, cam, bg: fixedBg(hex("#0c0c10"), hex("#000000"), { r: 1.0 }),
      layers: [lay(bgd, { billboard: false }), lay(tun, {}), lay(b, { sort: true, light: [-0.3, 0.6, 0.9], envTop: [0.5, 0.5, 0.6] })],
      post: { bloom: ts < 64 ? 0.75 : 0.45, thr: 1.0, vign: 0.7, grain: 0.016, ca: 0.003 * (1 - open) * seg(ts, 62, 63.5), flash: [1, 0.95, 0.9, pulse(ts, 64, 8) * 0.3] },
      tagCol: S.white,
      overlay(c) {
      },
    };
  }

  // ---------------------------------------------------------------- K · AXES 24–28  (the website's design-space panel, driving the dots live)
  const AXDY = 4.4;
  const AXK = [[24.0, 380, 100, 144], [24.5, 400, 100, 144], [25.25, 900, 100, 144], [25.75, 100, 100, 144],
    [26.5, 700, 0, 144], [27.0, 700, 100, 144], [27.5, 700, 100, 12], [27.95, 700, 100, 144]];
  const AXACT = ["", "w", "pad", "pad", "pad", "o", "o"];
  const NAMES9 = { 100: "Thin", 200: "ExtraLight", 300: "Light", 400: "Regular", 500: "Medium", 600: "SemiBold", 700: "Bold", 800: "ExtraBold", 900: "Black" };
  function axAt(t) {
    let i = 0;
    for (let k = 0; k < AXK.length - 1; k++) if (t >= AXK[k][0]) i = k;
    const A0 = AXK[i], A1 = AXK[i + 1];
    const u = i === 0 ? e5(seg(t, A0[0], A1[0])) : eio(seg(t, A0[0], A1[0]));
    return { w: lerp(A0[1], A1[1], u), c: lerp(A0[2], A1[2], u), o: lerp(A0[3], A1[3], u), i, u, act: AXACT[i], t0: A0[0], t1: A1[0] };
  }
  function axName(W_, C_, O_) {
    if (W_ % 100 !== 0 || (C_ !== 0 && C_ !== 100) || (O_ !== 144 && O_ !== 12)) return null;
    return (O_ === 12 ? "Text " : "") + (C_ === 0 ? "Slab " : "") + NAMES9[W_];
  }
  const STAGE_A = hex("#3b2866"), STAGE_B = hex("#0c0716");
  function stageGrid(bgd, t, t0, a = 1) {
    for (let x = -26; x <= 26; x += 2) for (let y = -40; y <= 40; y += 2) {
      const dd = Math.hypot(x, y - 4);
      const g = sm(seg(t - t0, dd * 0.02, dd * 0.02 + 0.5));
      put(bgd, x, y, -8, 0.075, LAV, 0.28 * g * a, 0.05 + pulse(t, t0 + dd * 0.02, 6) * 1.2, 0);
    }
  }
  function axesK(t) {
    const A = axAt(t);
    const b = buf(), bgd = buf(), fx = buf();
    const dy = AXDY * e5(seg(t, 24.0, 24.5));
    wordmark(b, t, { w: A.w }, (p) => ({ y: p.y + dy, r: rad(p.dt[2], A.w, A.c, opszF(A.o)) * KW2, e: 0.06 + pulse(t, 24.0, 5) * 0.5 }));
    stageGrid(bgd, t, 24.0);
    if (t < 25.2) {
      const u = e5(seg(t, 24, 25.2));
      for (let q = 0; q < 220; q++) { const an = q / 220 * Math.PI * 2; put(fx, Math.cos(an) * (6 + 70 * u), Math.sin(an) * (6 + 70 * u) * 1.7 + 4, -0.5, 0.16, LAV2, 1 - u, 1.8, 6); }
    }
    const camZ = ZC2 * lerp(1.0, 0.95, eio(seg(t, 24.4, 27.9)));
    const sc = ZC2 / camZ;
    const cam = { pos: [0, 0, camZ], tgt: [0, 0, 0], up: [0, 1, 0], fov: 0.5, aperture: 0, focus: camZ };
    return {
      t, cam, bg: fixedBg(STAGE_A, STAGE_B, { r: 1.0 }),
      layers: [lay(bgd, { billboard: false }), lay(fx, { additive: true }), lay(b, { sort: true, light: [-0.3, 0.6, 0.9], envTop: [0.75, 0.7, 0.9], envBot: [0.3, 0.2, 0.55] })],
      post: { bloom: 0.5, thr: 1.0, vign: 0.6, grain: 0.016, flash: [0.85, 0.75, 1, pulse(t, 24, 9) * 0.35] },
      tagA: 0,
      overlay(c) { axesUI(c, t, A, sc); },
    };
  }
  function axesUI(c, t, A, sc) {
    const CR = "#f3efe6", LV = "#cdbfea", LV2 = "#b9a4e8";
    const ui = (k) => e5(seg(t, 24.2 + k * 0.06, 24.55 + k * 0.06)) * (1 - sm(seg(t, 27.72 + k * 0.02, 27.98 + k * 0.02)));
    const W_ = Math.round(A.w), C_ = Math.round(A.c), O_ = Math.round(A.o);
    scap(c, t, 24.15, 27.75, "3 个可变轴 · 实时可调", "Three axes, live. Every position is a real style.", { y: 292, px: 64, epx: 28 });
    c.save();
    c.translate(W / 2, H / 2); c.scale(sc, sc); c.translate(-W / 2, -H / 2);
    const mono = (px) => `500 ${px}px Menlo, monospace`;
    // style line
    {
      const a = ui(0), y = 432 + (1 - a) * 20;
      const nm = axName(W_, C_, O_);
      const coords = `wght ${W_} · CNTR ${C_}` + (O_ !== 144 ? ` · opsz ${O_}` : "");
      c.save(); c.globalAlpha = a; c.textBaseline = "alphabetic";
      c.font = "400 22px SongCN"; const w1 = c.measureText("样式  ").width;
      c.font = nm ? FONT(600, 26) : "400 22px SongCN"; const w2 = c.measureText(nm || "介于命名样式之间").width;
      c.font = mono(19); const w3 = c.measureText(coords).width;
      let x = W / 2 - (w1 + w2 + 36 + w3) / 2;
      c.fillStyle = "rgba(243,239,230,0.6)"; c.font = "400 22px SongCN"; c.fillText("样式  ", x, y); x += w1;
      c.fillStyle = LV; c.font = nm ? FONT(600, 26) : "400 22px SongCN"; c.fillText(nm || "介于命名样式之间", x, y); x += w2 + 36;
      c.fillStyle = "rgba(243,239,230,0.75)"; c.font = mono(19); c.fillText(coords, x, y);
      c.restore();
    }
    // the pad: wght across, CNTR up
    const P0 = 96, P1 = 496, Q0 = 1010, Q1 = 1410;
    const fx = (w) => P0 + (w - 100) / 800 * (P1 - P0), fy = (cc) => Q1 - cc / 100 * (Q1 - Q0);
    {
      const a = ui(1);
      c.save(); c.globalAlpha = a; c.translate(0, (1 - a) * 30);
      c.strokeStyle = "rgba(243,239,230,0.14)"; c.lineWidth = 1;
      for (let k = 1; k < 8; k++) { const x = P0 + k * 50; c.beginPath(); c.moveTo(x + 0.5, Q0); c.lineTo(x + 0.5, Q1); c.stroke(); }
      c.beginPath(); c.moveTo(P0, (Q0 + Q1) / 2 + 0.5); c.lineTo(P1, (Q0 + Q1) / 2 + 0.5); c.stroke();
      c.strokeStyle = "rgba(243,239,230,0.75)"; c.strokeRect(P0 + 0.5, Q0 + 0.5, P1 - P0, Q1 - Q0);
      c.fillStyle = "rgba(243,239,230,0.45)";
      for (let w = 100; w <= 900; w += 100) for (const cc of [0, 100]) { c.beginPath(); c.arc(fx(w), fy(cc), 3.5, 0, 7); c.fill(); }
      // trail of the handle
      c.strokeStyle = "rgba(185,164,232,0.35)"; c.lineWidth = 2; c.beginPath();
      for (let k = 0; k <= 24; k++) { const B = axAt(Math.max(24, t - 0.3 + k * 0.0125)); const x = fx(B.w), y = fy(B.c); k ? c.lineTo(x, y) : c.moveTo(x, y); }
      c.stroke();
      const hx = fx(A.w), hy = fy(A.c);
      c.fillStyle = "#3b2866"; c.beginPath(); c.arc(hx, hy, 17, 0, 7); c.fill();
      c.strokeStyle = LV2; c.lineWidth = 1.5; c.beginPath(); c.arc(hx, hy, 17, 0, 7); c.stroke();
      c.fillStyle = LV2; c.beginPath(); c.arc(hx, hy, 12, 0, 7); c.fill();
      c.restore();
      txt(c, "wght  100 → 900", P0, Q1 + 40, { font: mono(17), col: CR, a: a * 0.65, ls: 1 });
      c.save(); c.globalAlpha = a * 0.65; c.translate(P0 - 22, Q1); c.rotate(-Math.PI / 2); c.font = mono(17); c.fillStyle = CR; c.fillText("CNTR  0 → 100", 0, 0); c.restore();
    }
    // three sliders
    const S0 = 584, S1 = 984;
    const rows = [["wght", A.w, 100, 900, String(W_)], ["CNTR", A.c, 0, 100, String(C_)], ["opsz", A.o, 12, 144, O_ === 144 ? "自动" : String(O_)]];
    const thumbs = [];
    rows.forEach(([lab, v, lo, hi, out], k) => {
      const a = ui(2 + k);
      const y = 1040 + k * 150 + (1 - a) * 30;
      txt(c, lab, S0, y, { font: mono(22), col: CR, a: a * 0.8 });
      if (out === "自动") txt(c, out, S1, y, { font: "400 22px SongCN", col: LV, align: "right", a });
      else txt(c, out, S1, y, { font: mono(22), col: LV, align: "right", a });
      const ty = y + 40, x = S0 + (v - lo) / (hi - lo) * (S1 - S0);
      c.save(); c.globalAlpha = a;
      c.fillStyle = "rgba(243,239,230,0.22)"; c.fillRect(S0, ty - 2, S1 - S0, 4);
      c.fillStyle = LV2; c.fillRect(S0, ty - 2, x - S0, 4);
      c.fillStyle = CR; c.beginPath(); c.arc(x, ty, 13, 0, 7); c.fill();
      c.strokeStyle = LV2; c.lineWidth = 3; c.beginPath(); c.arc(x, ty, 13, 0, 7); c.stroke();
      c.restore();
      thumbs.push([x, ty]);
    });
    // the CSS it writes
    {
      const a = ui(5);
      const css = `font-variation-settings: "wght" ${W_}, "CNTR" ${C_}` + (O_ !== 144 ? `, "opsz" ${O_}` : "") + ";";
      c.save(); c.globalAlpha = a * 0.3; c.fillStyle = CR; c.fillRect(P0, 1478, S1 - P0, 1); c.restore();
      txt(c, css, W / 2, 1530, { font: mono(19), col: CR, align: "center", a: a * 0.85 });
    }
    // a finger on the active control
    const i = A.i, act = AXACT[i];
    const nextAct = AXACT[i + 1] || "";
    const lead = t > A.t1 - 0.14 && nextAct ? nextAct : act;
    if (lead) {
      const target = lead === "pad" ? [fx(A.w), fy(A.c)] : lead === "w" ? thumbs[0] : lead === "o" ? thumbs[2] : thumbs[1];
      const press = act ? 0.82 : 1;
      const fa = sm(seg(t, 24.55, 24.7)) * (1 - sm(seg(t, 27.9, 28.0)));
      c.save(); c.globalAlpha = fa;
      c.fillStyle = "rgba(255,255,255,0.18)"; c.beginPath(); c.arc(target[0], target[1], 34 * press, 0, 7); c.fill();
      c.strokeStyle = "rgba(255,255,255,0.85)"; c.lineWidth = 2; c.beginPath(); c.arc(target[0], target[1], 34 * press, 0, 7); c.stroke();
      c.restore();
    }
    c.restore();
  }

  // ---------------------------------------------------------------- J · SIGNATURE 28–32  (tagline, call to action, the fall, and back to the first frame)
  const TAG2 = layout("A Didone on\nthe dot matrix.", { it: true, align: "c", lead: 15 });
  const KT2 = WORD2.w * KW2 * 0.8 / TAG2.w;
  function endJ(t) {
    const w = buf(), b = buf(), last = buf(), bgd = buf();
    const up = eio(seg(t, 28.0, 28.6));
    const fall = (i) => ei(seg(t, 30.9 + hash(i) * 0.35, 31.4 + hash(i) * 0.35));
    wordmark(w, t, { w: lerp(700, 520, up) }, (p) => {
      const f = fall(p.i + 500);
      return { y: p.y + lerp(AXDY, 9.5, up) - f * 34, a: 1 - f, e: 0.08 + 0.25 * pulse(t, 29.25, 5) * (p.ball ? 1 : 0) };
    });
    const ga = 1 - sm(seg(t, 30.8, 31.4));
    stageGrid(bgd, t, 22.0, ga);
    const nC = TAG2.chars.length;
    const oyT = -4.5 + 7.5 * KT2;
    let keep = null;
    textDots(b, TAG2, { k: KT2, ox: -0.4, oy: oyT, sh: 1, w: 470, col: C.white, ball: C.red, style: 1 }, (p) => {
      const ci = p.dt[3], isStop = ci === nC - 1;
      const ta = isStop ? 29.25 : 28.35 + ci / nC * 0.8 + hash(p.i * 1.7) * 0.05;
      if (t < ta) return null;
      if (isStop) { keep = p; return null; }
      const f = fall(p.i);
      return { r: p.r * back(seg(t, ta, ta + 0.22), 2), y: p.y - f * 34, a: 1 - f, e: pulse(t, ta, 9) * 1.6 + 0.05 };
    });
    // the full stop: pops last, stays, glides to centre, blinks once — then the camera falls into it,
    // ending exactly on the opening frame's red ball (same material, field, framing)
    const m = eio(seg(t, 31.2, 31.55));
    const push = eio(seg(t, 31.5, 32.0));
    if (keep) {
      const pop = back(seg(t, 29.25, 29.55), 2.6);
      const blink = t > 31.55 && t < 31.68 ? 0.15 : 1;
      const r = lerp(keep.r * pop, BALL_R, m);
      put(last, lerp(keep.x, 0, m), lerp(keep.y, 0, m), 0, r, C.red, 1, lerp(0.25 + pulse(t, 29.25, 6) * 2, 0.1, m) * blink, 8);
    }
    bokehField(last, [0, 0, 0], sm(seg(t, 31.45, 31.95)), t);
    const d = Math.exp(lerp(Math.log(ZC2), Math.log(HOOK_CAM0.d), push));
    const cam = mkCam(orbitPos([0, HOOK_CAM0.ty * push, 0], d, HOOK_CAM0.yaw * push, HOOK_CAM0.pitch * push), [0, HOOK_CAM0.ty * push, 0],
      { fov: lerp(0.5, HOOK_CAM0.fov, push), ap: HOOK_CAM0.ap * push, focus: d, coc: 90, roll: HOOK_CAM0.roll * push });
    const bk = sm(seg(t, 31.3, 31.9));
    return {
      t, cam, bg: fixedBg(mixc(STAGE_A, HOOK_BG.a, bk), mixc(STAGE_B, HOOK_BG.b, bk), { r: lerp(1.0, 1.1, bk) }),
      layers: [lay(bgd, { billboard: false }), lay(w, { light: [-0.3, 0.6, 0.9], envTop: [0.75, 0.7, 0.9], envBot: [0.3, 0.2, 0.55] }), lay(b, { light: [-0.3, 0.6, 0.9], envBot: [0.3, 0.2, 0.55] }), lay(last, HOOK_LAY)],
      post: { bloom: lerp(0.7, 0.6, push), thr: lerp(0.95, 1.05, push), vign: lerp(0.65, 0.72, push), grain: 0.016 },
      tagCol: S.white, tagA: sm(seg(t, 28.2, 28.5)) * (1 - sm(seg(t, 30.8, 31.2))),
      overlay(c) {
        const a = sm(seg(t, 29.3, 29.65)) * (1 - sm(seg(t, 30.85, 31.15)));
        const y0 = 1395;
        c.save(); c.globalAlpha = a * 0.5; c.fillStyle = "#cdbfea"; c.fillRect(W / 2 - 34 * a, y0 - 92, 68 * a, 2); c.restore();
        zline(c, "免费 · 开源 · 可商用", y0, 66, S.white, a, { t, t0: 29.3 });
        txt(c, "sundyme.github.io/punctum-moderne", W / 2, y0 + 70, { font: FONT(450, 36), col: "#cdbfea", align: "center", a, ls: 0.5 });
        txt(c, "FREE & OPEN SOURCE  ·  SIL OFL 1.1", W / 2, y0 + 116, { font: FONT(500, 19), col: S.white, ls: 5, align: "center", a: a * 0.7 });
      },
    };
  }

  // ==================================================================== timeline
  const SCENES = [[0, hookA], [2, marqueeB], [5, risoC], [8, weightD], [10.5, cntrE], [13, italicF], [16.5, flapG], [19, useH], [22.5, signalI], [24, axesK], [28, endJ]];
  function frame(t) {
    pi = 0;
    t = cl(t, 0, DUR - 1e-4);
    let s = SCENES[0][1];
    for (const [t0, f] of SCENES) if (t >= t0) s = f;
    const F = s(t);
    const o = F.overlay;
    F.overlay = (c) => { if (o) o(c); tag(c, F.tagCol || S.white, (F.tagA ?? 1) * 0.8); };
    return F;
  }

  // ==================================================================== events (for the score)
  const EV = [];
  const ev = (t, type, o = {}) => EV.push(Object.assign({ t, type }, o));
  ev(0, "hook");
  A_ORDER.forEach((q, k) => { const ta = -0.3 + k * 0.045; if (k > 0 && ta >= 0) ev(ta, "pop", { tone: q.d[2], k }); });
  ev(0.88, "reveal");
  ev(1.55, "rush", { d: 0.45 });
  ev(2.0, "impact", { big: 1 });
  ev(4.3, "dive", { d: 0.7 });
  ev(5.0, "drum", { d: 0.5 }); ev(5.5, "drum", { d: 0.5 }); ev(6.0, "shatter");
  ev(7.55, "rush", { d: 0.45 });
  ev(8.0, "impact");
  for (let i = 0; i < 5; i++) ev(8.0 + i * 0.5, "pump", { i });
  ev(10.3, "whip", { d: 0.35 });
  ev(10.5, "ledon"); ev(10.67, "scan", { d: 1.04 }); ev(11.89, "scan", { d: 0.52, rev: 1 }); ev(12.58, "scan", { d: 0.42 });
  ev(12.7, "whip", { d: 0.3 });
  ev(13.0, "shear", { d: 0.55 }); ev(13.45, "morph", { d: 0.55 });
  ev(14.15, "whip", { d: 0.3 });
  ev(14.35, "draw", { d: 1.0 });
  for (let j = 0; j < 25; j++) ev(15.5 + j * 0.013, "sparkle", { j });
  ev(16.2, "fall", { d: 0.3 });
  GBOARD.forEach(([t0], si) => {
    for (let r = 0; r < GR; r++) for (let col = 0; col < GC; col++) {
      const cur = GBOARD[si][1][r][col], prev = si > 0 ? GBOARD[si - 1][1][r][col] : " ";
      if (cur === prev) continue;
      const n = gFlips(r, col, si);
      for (let k = 0; k < n; k++) ev(t0 + gDelay(r, col) + k * 0.045, "flap", { pan: (col / (GC - 1)) * 2 - 1, last: k === n - 1 ? 1 : 0 });
    }
  });
  ev(18.8, "whip", { d: 0.3, down: 1 });
  PLINES.forEach((l) => { if (l.t0 !== null) { ev(19 + (l.t0 - 54) / 1.43, "printpass", { d: l.d / 1.43, dir: l.dir }); ev(19 + (l.feed - 54) / 1.43, "feed"); } });
  [20.26, 21.06, 21.76].forEach((x) => ev(x, "whip", { d: 0.28 }));
  ev(20.4, "watch"); ev(21.2, "menu"); ev(21.9, "card");
  ev(22.22, "rush", { d: 0.3 });
  ev(22.5, "riser", { d: 1.5 }); ev(22.5 + (63.15 - 62) * 0.75, "fold", { d: 0.6 }); ev(24.0, "drop"); ev(24.0, "shock");
  ev(24.15, "uiin");
  for (let k = 1; k < AXK.length - 1; k++) ev(AXK[k + 1][0], "snap", { k });
  { let prev = null; for (let x = 24.5; x < 27.95; x += 0.002) { const A = axAt(x); const key = Math.floor(A.w / 100) + "|" + Math.floor(A.c / 25) + "|" + Math.floor(A.o / 22); if (prev && key !== prev) ev(x, "detent", { act: A.act }); prev = key; } }
  ev(28.35, "type", { d: 0.8 }); ev(29.25, "pop", { tone: 1.3, k: 0, stop: 1 });
  ev(30.9, "fall", { d: 0.8, end: 1 });
  ev(31.55, "blink", { on: 1 });
  ev(31.5, "rush", { d: 0.5, end: 1 });

  window.FILM = { DUR, frame, EVENTS: EV, SCENES: SCENES.map((s) => s[0]) };
})();
