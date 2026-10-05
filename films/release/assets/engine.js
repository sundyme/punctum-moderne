/* PUNCTUM MODERNE · RELEASE — WebGL2 dot engine.
 *
 * Everything on screen is a dot. A frame is a plain object:
 *   { bg, cam, layers: [dots | quad], post, overlay(ctx) }
 * Dots are instanced quads (billboards or lying in a layer's plane), shaded per material:
 *   0 ink · 1 sphere · 2 bulb · 3 led · 4 pixel · 5 ring · 6 glow
 * Depth of field widens each dot into a bokeh disc; motion blur accumulates sub-frames;
 * bloom, CRT, glitch, grain and the 2D overlay (HUD, captions) happen in one composite pass.
 */
(function () {
  "use strict";
  const STRIDE = 12; // x y z r | R G B A | emit style seed spin

  // ------------------------------------------------------------------ math
  const M = {
    persp(fov, asp, n, f) {
      const t = 1 / Math.tan(fov / 2), nf = 1 / (n - f);
      return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) * nf, -1, 0, 0, 2 * f * n * nf, 0];
    },
    look(e, c, up) {
      let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2];
      let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
      let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
      l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
      const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
      return [xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
        -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1];
    },
    mul(a, b) {
      const o = new Array(16);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k];
        o[i * 4 + j] = s;
      }
      return o;
    },
    // translate · rotZ · rotY · rotX · scale   (rot in radians)
    trs(p = [0, 0, 0], r = [0, 0, 0], s = 1) {
      const sx = Array.isArray(s) ? s[0] : s, sy = Array.isArray(s) ? s[1] : s, sz = Array.isArray(s) ? s[2] : s;
      const [a, b, c] = r;
      const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cc = Math.cos(c), sc = Math.sin(c);
      // R = Rz(c) Ry(b) Rx(a)
      const r00 = cc * cb, r01 = cc * sb * sa - sc * ca, r02 = cc * sb * ca + sc * sa;
      const r10 = sc * cb, r11 = sc * sb * sa + cc * ca, r12 = sc * sb * ca - cc * sa;
      const r20 = -sb, r21 = cb * sa, r22 = cb * ca;
      return [r00 * sx, r10 * sx, r20 * sx, 0, r01 * sy, r11 * sy, r21 * sy, 0, r02 * sz, r12 * sz, r22 * sz, 0, p[0], p[1], p[2], 1];
    },
  };

  // sRGB hex → linear rgb
  const lin = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  function hex(h, k = 1) {
    const n = parseInt(h.slice(1), 16);
    return [lin(((n >> 16) & 255) / 255) * k, lin(((n >> 8) & 255) / 255) * k, lin((n & 255) / 255) * k];
  }

  // ------------------------------------------------------------------ shaders
  const VS_DOT = `#version 300 es
  layout(location=0) in vec2 aC;
  layout(location=1) in vec4 iP;
  layout(location=2) in vec4 iC;
  layout(location=3) in vec4 iE;
  uniform mat4 uModel, uView, uProj;
  uniform float uScale, uPx, uAp, uFocus, uBill, uCocMax;
  out vec2 vUv; out vec4 vC; out vec4 vE; out float vR; out float vCoc; out float vQ;
  void main(){
    float st = iE.y;
    float q = st==2.0 ? 3.4 : (st==3.0 ? 2.6 : (st==6.0 ? 2.2 : 1.0));
    vec4 wp = uModel * vec4(iP.xyz, 1.0);
    vec4 vp = uView * wp;
    float depth = max(-vp.z, 1e-3);
    float r = iP.w * uScale;
    float rpx = r * uPx / depth;
    float coc = min(uAp * abs(1.0 - uFocus / depth) * 40.0, uCocMax);
    float ext = rpx * q + coc + 1.5;
    vec2 off = aC * ext;
    if (uBill > 0.5) {
      vp.xy += off * depth / uPx;
      gl_Position = uProj * vp;
    } else {
      // lie in the layer's plane: local x/y offset, sized for the dot's own depth
      vec2 lo = off * depth / uPx / uScale;
      float ca = cos(iE.w), sa = sin(iE.w);
      vec4 wq = uModel * vec4(iP.xyz + vec3(lo.x, lo.y * ca, lo.y * sa), 1.0);
      gl_Position = uProj * uView * wq;
    }
    if (iC.a <= 0.0 || iP.w <= 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vUv = off / max(rpx, 1e-4);
    vC = iC; vE = iE; vR = max(rpx, 1e-4); vCoc = coc; vQ = q;
  }`;

  const FS_DOT = `#version 300 es
  precision highp float;
  in vec2 vUv; in vec4 vC; in vec4 vE; in float vR; in float vCoc; in float vQ;
  uniform vec3 uLight; uniform vec3 uEnvTop; uniform vec3 uEnvBot; uniform float uTime;
  out vec4 o;
  float h1(float n){ return fract(sin(n*12.9898)*43758.5453); }
  float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(h2(i), h2(i+vec2(1,0)), f.x), mix(h2(i+vec2(0,1)), h2(i+vec2(1,1)), f.x), f.y); }
  void main(){
    float st = vE.y, emit = vE.x, seed = vE.z;
    vec3 col = vC.rgb; float a = vC.a;
    float bl = vCoc / vR;                  // blur in radius units
    float R2 = 1.0 + bl;
    float edge = max(1.0 / vR, 0.18 * bl);
    float energy = 1.0 / (R2 * R2);
    float d = length(vUv);
    vec3 rgb = vec3(0.0); float al = 0.0;
    if (st == 4.0) {                        // pixel: soft square
      vec2 q = abs(vUv);
      d = pow(pow(q.x, 5.0) + pow(q.y, 5.0), 0.2) * 1.02;
    }
    float cov = 1.0 - smoothstep(R2 - edge, R2 + edge, d);
    if (st == 0.0 || st == 4.0) {           // ink / pixel
      rgb = col * cov; al = cov;
      rgb += col * emit * cov;
      rgb *= energy; al *= energy;
      al *= a; rgb *= a;
    } else if (st == 1.0) {                 // glossy sphere
      vec2 p = vUv / R2;
      float dd = min(length(p), 1.0);
      vec3 n = normalize(vec3(p, sqrt(max(1.0 - dd * dd, 0.0)) + 1e-3));
      vec3 L = normalize(uLight);
      float diff = max(dot(n, L), 0.0);
      vec3 hv = normalize(L + vec3(0.0, 0.0, 1.0));
      float spec = pow(max(dot(n, hv), 0.0), 60.0);
      float rim = pow(1.0 - n.z, 3.0);
      vec3 env = mix(uEnvBot, uEnvTop, n.y * 0.5 + 0.5);
      vec3 c = col * (0.16 + 0.95 * diff) + env * rim * 0.6 + vec3(spec) * 1.6 * (1.0 - min(bl, 1.0));
      c += col * emit;
      rgb = c * cov * energy * a; al = cov * energy * a;
    } else if (st == 8.0) {                 // hero sphere: lacquer + clear coat, a dot-matrix softbox in the reflection, coloured rim
      vec2 p = vUv / R2;
      float dd = min(length(p), 1.0);
      vec3 n = normalize(vec3(p, sqrt(max(1.0 - dd * dd, 0.0)) + 1e-3));
      vec3 L = normalize(uLight);
      float ndl = dot(n, L);
      float wrap = max((ndl + 0.3) / 1.3, 0.0);
      vec3 base = col * (0.02 + 0.98 * pow(wrap, 2.4));
      base += col * vec3(1.0, 0.42, 0.25) * 0.35 * smoothstep(0.02, 0.25, wrap) * (1.0 - smoothstep(0.25, 0.7, wrap));  // warm terminator
      float fr = pow(1.0 - n.z, 5.0);
      float F = 0.04 + 0.96 * fr;
      vec2 sp = n.xy / max(n.z, 0.12);                       // reflection, in the tangent plane of the view
      vec2 q = (sp - vec2(-0.48, 0.52)) / vec2(0.5, 0.36);   // key softbox, up-left
      float box = 1.0 - smoothstep(0.82, 1.0, max(abs(q.x), abs(q.y)));
      vec2 gq = fract(q * vec2(5.0, 3.6)) - 0.5;
      float dotm = 1.0 - smoothstep(0.2, 0.3, length(gq * vec2(1.0, 0.72)));
      float panel = box * mix(0.1, 1.0, dotm);
      float kick = 1.0 - smoothstep(0.0, 0.16, length(sp - vec2(0.78, -0.2)));   // small kicker, right
      float strip = (1.0 - smoothstep(0.0, 0.05, abs(sp.y + 0.95))) * (1.0 - smoothstep(0.6, 1.4, abs(sp.x)));  // floor bounce line
      vec3 refl = vec3(1.0, 0.97, 0.94) * (panel * 3.0 + kick * 1.2) + vec3(0.9, 0.85, 1.0) * strip * 0.0;
      vec3 rimc = uEnvBot * pow(1.0 - n.z, 3.6) * smoothstep(0.1, -0.8, n.y) * 1.1;
      vec3 c = base * (1.0 - F) + refl * (0.12 + 0.88 * F) * (0.55 + 0.45 * smoothstep(0.0, 0.5, n.z)) * (1.0 - min(bl, 1.0)) + rimc + uEnvTop * fr * 0.12;
      c += col * emit;
      rgb = c * cov * energy * a; al = cov * energy * a;
    } else if (st == 2.0) {                 // bulb: glass, filament core, halo
      float core = 1.0 - smoothstep(0.42, 0.62 + bl, d);
      float glass = cov;
      vec3 g = col * 0.05 + vec3(0.02) * (1.0 - d);
      float hi = smoothstep(0.35, 0.0, length(vUv - vec2(-0.32, 0.36))) * 0.25;
      vec3 c = g * glass + vec3(hi) * glass * (1.0 - emit);
      c += (col * 3.0 + vec3(0.8, 0.7, 0.5) * 2.0 * core) * emit * mix(glass, core, 0.5);
      float halo = exp(-d * d * 0.9) * emit * 0.55 + exp(-d * 1.6) * emit * 0.25;
      rgb = (c * energy + col * halo) * a; al = glass * energy * a * 0.92;
    } else if (st == 3.0) {                 // led: diffused lens with hot centre
      float lens = cov;
      float hot = exp(-d * d * 3.0);
      vec3 offc = col * 0.07 + vec3(0.012);
      vec3 c = offc * lens + col * emit * (0.7 * lens + 1.8 * hot);
      float halo = exp(-d * d * 0.7) * emit * 0.35;
      rgb = (c * energy + col * halo) * a; al = lens * energy * a;
    } else if (st == 7.0) {                 // impact / riso ink: ragged edge, ribbon grain, rim build-up
      float ang = atan(vUv.y, vUv.x);
      float n = sin(ang * 3.0 + seed * 6.1) * 0.35 + sin(ang * 7.0 + seed * 3.7) * 0.25 + (vn(vec2(ang * 2.2 + seed * 9.0, seed)) - 0.5) * 0.8;
      float R3 = R2 * (1.0 + 0.045 * n);
      float c3 = 1.0 - smoothstep(R3 - edge * 1.3, R3 + edge * 1.3, d);
      vec2 q = vUv * 3.2 + seed * 7.3;
      float gr = vn(q) * 0.6 + vn(q * 2.7) * 0.4;
      float dens = (0.84 + 0.16 * gr) * (0.9 + 0.1 * smoothstep(0.45, 1.0, d / R3));
      float k = c3 * dens * a * energy;
      rgb = col * k; al = k;
    } else if (st == 5.0) {                 // ring
      float w = 0.16 + bl * 0.5;
      float ring = 1.0 - smoothstep(w - edge, w + edge, abs(d - (1.0 - w)));
      rgb = col * ring * (1.0 + emit) * a; al = ring * a;
    } else {                                // glow (additive only)
      float gl = exp(-d * d * 2.2) + 0.4 * exp(-d * d * 0.6);
      rgb = col * emit * gl * a; al = 0.0;
    }
    o = vec4(rgb, al);
  }`;

  const VS_QUAD = `#version 300 es
  layout(location=0) in vec2 aC;
  uniform mat4 uModel, uView, uProj;
  out vec2 vUv; out vec3 vW; out vec3 vN;
  void main(){
    vec4 wp = uModel * vec4(aC * 0.5, 0.0, 1.0);
    vW = wp.xyz;
    vN = normalize(mat3(uModel) * vec3(0.0, 0.0, 1.0));
    vUv = aC * 0.5 + 0.5;
    gl_Position = uProj * uView * wp;
  }`;

  const FS_QUAD = `#version 300 es
  precision highp float;
  in vec2 vUv; in vec3 vW; in vec3 vN;
  uniform int uMode; uniform vec4 uCol; uniform vec4 uCol2; uniform vec4 uP; uniform sampler2D uTex; uniform vec2 uSize;
  uniform vec3 uLightQ; uniform float uShade; uniform vec4 uLamp; uniform float uLampK;
  out vec4 o;
  float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(h2(i), h2(i+vec2(1,0)), f.x), mix(h2(i+vec2(0,1)), h2(i+vec2(1,1)), f.x), f.y); }
  void main(){
    vec4 c = uCol;
    vec2 px = vUv * uSize;                       // in layer units
    if (uMode == 1) {                            // paper
      float n = vn(px * 3.0) * 0.5 + vn(px * 11.0) * 0.3 + vn(px * 40.0) * 0.2;
      c.rgb *= 0.93 + 0.1 * n;
    } else if (uMode == 2) {                     // texture (premultiplied)
      c = texture(uTex, vec2(vUv.x, 1.0 - vUv.y)) * uCol.a;
    } else if (uMode == 3) {                     // green-bar printer paper: uP.x = scroll (layer units), uP.y = band
      float y = px.y + uP.x;
      float band = step(0.5, fract(y / (uP.y * 2.0)));
      c.rgb = mix(uCol.rgb, uCol2.rgb, band);
      float n = vn(px * 4.0) * 0.06;
      c.rgb *= 0.95 + n;
      // tractor-feed holes in the margins
      float m = uP.z;
      float hx = min(px.x, uSize.x - px.x);
      vec2 hc = vec2(m * 0.5, (floor(y / uP.w) + 0.5) * uP.w - uP.x);
      float hole = 1.0 - smoothstep(m * 0.17, m * 0.19, length(vec2(hx, px.y) - hc));
      c = mix(c, vec4(0.0), hole);
      float perf = step(hx, m) * step(m - 0.04, hx) * step(0.5, fract(y * 2.0)) * 0.2;
      c.rgb *= 1.0 - perf;
    } else if (uMode == 4) {                     // tile: rounded rect, subtle gradient
      vec2 q = abs(vUv - 0.5) * uSize;
      vec2 hs = uSize * 0.5 - uP.x;
      float d = length(max(q - hs, 0.0)) - uP.x;
      float a = 1.0 - smoothstep(-0.02, 0.02, d);
      c.rgb *= 0.85 + 0.3 * vUv.y;
      c *= a;
    } else if (uMode == 6) {                     // ribbon: woven nylon, inked
      float w = sin(px.x * 40.0) * sin(px.y * 40.0);
      c.rgb = uCol.rgb * (0.8 + 0.25 * w) + vec3(0.03) * smoothstep(0.3, 0.5, vUv.y) * (1.0 - smoothstep(0.5, 0.7, vUv.y));
    } else if (uMode == 7) {                     // brushed metal
      float br = vn(vec2(px.x * 0.6, px.y * 60.0)) * 0.5 + vn(vec2(px.x * 2.0, px.y * 200.0)) * 0.5;
      c.rgb = uCol.rgb * (0.75 + 0.35 * br) + uCol2.rgb * smoothstep(0.2, 0.0, abs(vUv.y - 0.82)) * 0.6;
    } else if (uMode == 8) {                     // soft shadow: uP.x = softness (layer units)
      vec2 q = abs(vUv - 0.5) * uSize;
      vec2 hs = uSize * 0.5 - uP.x;
      float d = length(max(q - hs, 0.0));
      c = vec4(uCol.rgb, 1.0) * uCol.a * (1.0 - smoothstep(0.0, uP.x, d));
      o = c; return;
    } else if (uMode == 5) {                     // crt glass: dark, curved sheen
      vec2 q = vUv - 0.5;
      float d = length(q * vec2(1.0, 0.9));
      c.rgb = uCol.rgb * (1.0 - d * 0.9) + uCol2.rgb * smoothstep(0.5, 0.0, length(q - vec2(-0.2, 0.25))) * 0.4;
    }
    if (uShade > 0.0) {
      float lam = 0.42 + 0.7 * max(dot(normalize(vN), normalize(uLightQ)), 0.0);
      c.rgb *= mix(1.0, lam, uShade);
    }
    if (uLampK > 0.0) {
      float dl = length(vW - uLamp.xyz) / uLamp.w;
      c.rgb *= mix(1.0, 0.25 + 0.95 * exp(-dl * dl), uLampK);
    }
    if (uMode != 2 && uMode != 4) c.rgb *= c.a;
    o = c;
  }`;

  const VS_FS = `#version 300 es
  layout(location=0) in vec2 aC; out vec2 vUv;
  void main(){ vUv = aC * 0.5 + 0.5; gl_Position = vec4(aC, 0.0, 1.0); }`;

  const FS_BG = `#version 300 es
  precision highp float; in vec2 vUv;
  uniform vec3 uA; uniform vec3 uB; uniform vec2 uC; uniform float uR; uniform float uNoise; uniform vec2 uRes; uniform float uT;
  out vec4 o;
  float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(h2(i), h2(i+vec2(1,0)), f.x), mix(h2(i+vec2(0,1)), h2(i+vec2(1,1)), f.x), f.y); }
  void main(){
    vec2 p = (vUv - uC) * vec2(uRes.x / uRes.y, 1.0);
    float k = smoothstep(0.0, uR, length(p));
    vec3 c = mix(uA, uB, k);
    if (uNoise > 0.0) {
      vec2 q = vUv * uRes / 3.0;
      float n = vn(q * 0.5) * 0.5 + vn(q * 1.7) * 0.3 + vn(q * 5.0) * 0.2;
      c *= 1.0 + (n - 0.5) * uNoise;
    }
    o = vec4(c, 1.0);
  }`;

  const FS_ACC = `#version 300 es
  precision highp float; in vec2 vUv; uniform sampler2D uT; uniform float uW; out vec4 o;
  void main(){ o = texture(uT, vUv) * uW; }`;

  const FS_DOWN = `#version 300 es
  precision highp float; in vec2 vUv; uniform sampler2D uT; uniform vec2 uTx; uniform float uThr; uniform int uPre; out vec4 o;
  void main(){
    vec3 c = texture(uT, vUv).rgb * 4.0;
    c += texture(uT, vUv + vec2(-1,-1) * uTx).rgb; c += texture(uT, vUv + vec2(1,-1) * uTx).rgb;
    c += texture(uT, vUv + vec2(-1,1) * uTx).rgb;  c += texture(uT, vUv + vec2(1,1) * uTx).rgb;
    c += (texture(uT, vUv + vec2(-2,0) * uTx).rgb + texture(uT, vUv + vec2(2,0) * uTx).rgb +
          texture(uT, vUv + vec2(0,-2) * uTx).rgb + texture(uT, vUv + vec2(0,2) * uTx).rgb) * 0.5;
    c /= 10.0;
    if (uPre == 1) {
      float br = max(c.r, max(c.g, c.b));
      float kn = uThr * 0.25;
      float soft = clamp(br - uThr + kn, 0.0, 2.0 * kn); soft = soft * soft / (4.0 * kn + 1e-4);
      float w = max(soft, br - uThr) / max(br, 1e-4);
      c *= max(w, 0.0);
      c = min(c, vec3(60.0));
    }
    o = vec4(c, 1.0);
  }`;

  const FS_UP = `#version 300 es
  precision highp float; in vec2 vUv; uniform sampler2D uT; uniform vec2 uTx; out vec4 o;
  void main(){
    vec3 c = texture(uT, vUv).rgb * 4.0;
    c += (texture(uT, vUv + vec2(-1,0)*uTx).rgb + texture(uT, vUv + vec2(1,0)*uTx).rgb + texture(uT, vUv + vec2(0,-1)*uTx).rgb + texture(uT, vUv + vec2(0,1)*uTx).rgb) * 2.0;
    c += texture(uT, vUv + vec2(-1,-1)*uTx).rgb + texture(uT, vUv + vec2(1,-1)*uTx).rgb + texture(uT, vUv + vec2(-1,1)*uTx).rgb + texture(uT, vUv + vec2(1,1)*uTx).rgb;
    o = vec4(c / 16.0, 1.0);
  }`;

  const FS_COMP = `#version 300 es
  precision highp float; in vec2 vUv;
  uniform sampler2D uScene, uBloom, uOver;
  uniform vec2 uRes; uniform float uT, uBloomK, uExpo, uCA, uScan, uCurve, uGrain, uVign, uGlitch, uSeed, uSort, uSat, uOverA;
  uniform vec4 uFlash; uniform vec3 uTint; uniform float uInvert, uMono;
  out vec4 o;
  float h1(float n){ return fract(sin(n * 12.9898) * 43758.5453); }
  float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
  vec3 toS(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
  vec3 samp(vec2 uv){ return texture(uScene, uv).rgb + texture(uBloom, uv).rgb * uBloomK; }
  void main(){
    vec2 uv = vUv;
    // CRT barrel
    vec2 cc = uv - 0.5;
    if (uCurve > 0.0) { float r2 = dot(cc, cc); uv = 0.5 + cc * (1.0 + uCurve * r2 + uCurve * 0.6 * r2 * r2); }
    bool outside = uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0;
    // glitch: displaced bands + pixel-sort smears
    float band = 0.0;
    if (uGlitch > 0.0 || uSort > 0.0) {
      float y = uv.y * uRes.y;
      float bh = mix(6.0, 90.0, h1(floor(y / 37.0) + uSeed * 7.0));
      float bi = floor(y / bh) + uSeed * 13.0;
      float g = h1(bi);
      if (g < uGlitch) { uv.x += (h1(bi + 3.1) - 0.5) * 0.22 * uGlitch; band = 1.0; }
      if (h1(bi + 9.7) < uSort) {
        float anchor = h1(bi + 5.3);
        float k = smoothstep(anchor - 0.05, anchor + 0.4, uv.x);
        uv.x = mix(uv.x, anchor, k * 0.985);
      }
    }
    vec3 c;
    float ca = uCA * (0.4 + length(cc) * 1.6) + band * 0.006 * uGlitch;
    if (ca > 0.0) {
      vec2 dir = normalize(cc + 1e-5) * ca;
      c = vec3(samp(uv + dir).r, samp(uv).g, samp(uv - dir).b);
    } else c = samp(uv);
    c *= uExpo;
    c *= uTint;
    c = aces(c);
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(l), c, uSat);
    if (uMono > 0.0) c = mix(c, vec3(l), uMono);
    // scanlines + aperture mask
    if (uScan > 0.0) {
      float s = 0.5 + 0.5 * sin(uv.y * uRes.y * 3.14159 / 2.0);
      c *= 1.0 - uScan * (1.0 - s) * 0.85;
      float m = mod(floor(gl_FragCoord.x), 3.0);
      vec3 mask = m == 0.0 ? vec3(1.0, 0.82, 0.82) : (m == 1.0 ? vec3(0.82, 1.0, 0.82) : vec3(0.82, 0.82, 1.0));
      c *= mix(vec3(1.0), mask, uScan * 0.6);
      c *= 1.0 + uScan * 0.25;
    }
    // vignette
    float v = smoothstep(0.95, 0.2, length(cc * vec2(1.0, 0.85)) * 1.15);
    c *= mix(1.0, v, uVign);
    if (outside) c = vec3(0.0);
    if (uCurve > 0.0) { vec2 e = smoothstep(vec2(0.0), vec2(0.012), uv) * smoothstep(vec2(0.0), vec2(0.012), 1.0 - uv); c *= e.x * e.y; }
    c = toS(c);
    if (uInvert > 0.0) c = mix(c, 1.0 - c, uInvert);
    // flash
    c = mix(c, uFlash.rgb, uFlash.a);
    // overlay (premultiplied sRGB)
    vec4 ov = texture(uOver, vec2(vUv.x, 1.0 - vUv.y)) * uOverA;
    c = ov.rgb + c * (1.0 - ov.a);
    // grain
    float gr = h2(gl_FragCoord.xy + fract(uT * 61.7) * 917.0) - 0.5;
    c += gr * uGrain;
    o = vec4(c, 1.0);
  }`;

  // ------------------------------------------------------------------ engine
  function createEngine(canvas, W, H) {
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, preserveDrawingBuffer: true, premultipliedAlpha: false });
    if (!gl) throw new Error("WebGL2 unavailable");
    gl.getExtension("EXT_color_buffer_float");
    gl.getExtension("EXT_color_buffer_half_float");

    function prog(vs, fs) {
      const p = gl.createProgram();
      for (const [t, s] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
        const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) + "\n" + s);
        gl.attachShader(p, sh);
      }
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const nm = gl.getActiveUniform(p, i).name; u[nm] = gl.getUniformLocation(p, nm); }
      return { p, u };
    }
    const P = {
      dot: prog(VS_DOT, FS_DOT), quad: prog(VS_QUAD, FS_QUAD), bg: prog(VS_FS, FS_BG), acc: prog(VS_FS, FS_ACC),
      down: prog(VS_FS, FS_DOWN), up: prog(VS_FS, FS_UP), comp: prog(VS_FS, FS_COMP),
    };

    // geometry
    const quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const MAXD = 240000;
    const inst = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, inst);
    gl.bufferData(gl.ARRAY_BUFFER, MAXD * STRIDE * 4, gl.DYNAMIC_DRAW);
    const vaoDot = gl.createVertexArray();
    gl.bindVertexArray(vaoDot);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, inst);
    for (let i = 0; i < 3; i++) {
      gl.enableVertexAttribArray(1 + i);
      gl.vertexAttribPointer(1 + i, 4, gl.FLOAT, false, STRIDE * 4, i * 16);
      gl.vertexAttribDivisor(1 + i, 1);
    }
    const vaoQ = gl.createVertexArray();
    gl.bindVertexArray(vaoQ);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    function target(w, h) {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      return { tex, fb, w, h };
    }
    const scene = target(W, H), acc = target(W, H);
    const blm = [];
    for (let i = 0, w = W >> 1, h = H >> 1; i < 7 && w > 8; i++, w >>= 1, h >>= 1) blm.push(target(w, h));

    // overlay canvas + texture cache for quad textures
    const over = document.createElement("canvas"); over.width = W; over.height = H;
    const octx = over.getContext("2d");
    const overTex = gl.createTexture();
    const texCache = new Map();
    function upload(tex, src) {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    function texFor(cv, dirty) {
      let t = texCache.get(cv);
      if (!t) { t = gl.createTexture(); texCache.set(cv, t); dirty = true; }
      if (dirty) upload(t, cv);
      return t;
    }

    const fsDraw = () => { gl.bindVertexArray(vaoQ); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); };

    // a 1×1 texture keeps the quad sampler off the render target (else WebGL drops the draw as a feedback loop)
    const dummy = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, dummy);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
    function drawScene(F) {
      const cam = F.cam;
      for (let u = 0; u < 4; u++) { gl.activeTexture(gl.TEXTURE0 + u); gl.bindTexture(gl.TEXTURE_2D, dummy); }
      gl.activeTexture(gl.TEXTURE0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, scene.fb);
      gl.viewport(0, 0, W, H);
      gl.disable(gl.BLEND);
      // background
      const bg = F.bg || {};
      gl.useProgram(P.bg.p);
      const A = bg.a || [0, 0, 0], B = bg.b || A;
      gl.uniform3fv(P.bg.u.uA, A); gl.uniform3fv(P.bg.u.uB, B);
      gl.uniform2fv(P.bg.u.uC, bg.c || [0.5, 0.5]); gl.uniform1f(P.bg.u.uR, bg.r || 1.2);
      gl.uniform1f(P.bg.u.uNoise, bg.noise || 0); gl.uniform2f(P.bg.u.uRes, W, H); gl.uniform1f(P.bg.u.uT, F.t || 0);
      fsDraw();

      const proj = M.persp(cam.fov || 0.6, W / H, cam.near || 0.1, cam.far || 4000);
      const view = M.look(cam.pos, cam.tgt, cam.up || [0, 1, 0]);
      const pxs = proj[5] * H / 2;
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      for (const L of F.layers) {
        if (!L) continue;
        const model = L.model || M.trs(L.pos, L.rot, L.scale ?? 1);
        if (L.type === "quad") {
          gl.useProgram(P.quad.p);
          const sz = L.size || [1, 1];
          const mm = M.mul(model, M.trs([0, 0, 0], [0, 0, 0], [sz[0], sz[1], 1]));
          gl.uniformMatrix4fv(P.quad.u.uModel, false, mm);
          gl.uniformMatrix4fv(P.quad.u.uView, false, view);
          gl.uniformMatrix4fv(P.quad.u.uProj, false, proj);
          gl.uniform1i(P.quad.u.uMode, L.mode || 0);
          const c = L.color || [1, 1, 1]; gl.uniform4f(P.quad.u.uCol, c[0], c[1], c[2], L.alpha ?? 1);
          const c2 = L.color2 || [0, 0, 0]; gl.uniform4f(P.quad.u.uCol2, c2[0], c2[1], c2[2], 1);
          gl.uniform4fv(P.quad.u.uP, L.p || [0, 0, 0, 0]);
          gl.uniform2fv(P.quad.u.uSize, sz);
          gl.uniform3fv(P.quad.u.uLightQ, L.light || [-0.4, 0.8, 0.5]);
          gl.uniform1f(P.quad.u.uShade, L.shade || 0);
          gl.uniform4fv(P.quad.u.uLamp, L.lamp || [0, 0, 10, 20]);
          gl.uniform1f(P.quad.u.uLampK, L.lampK || 0);
          if (L.tex) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texFor(L.tex, L.dirty)); gl.uniform1i(P.quad.u.uTex, 0); }
          if (L.additive) gl.blendFunc(gl.ONE, gl.ONE);
          fsDraw0(mm);
          if (L.additive) gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
          continue;
        }
        const d = L.data, n = Math.min(L.count ?? d.length / STRIDE, MAXD);
        if (!n) continue;
        if (L.sort) sortByDepth(d, n, model, view);
        gl.useProgram(P.dot.p);
        gl.uniformMatrix4fv(P.dot.u.uModel, false, model);
        gl.uniformMatrix4fv(P.dot.u.uView, false, view);
        gl.uniformMatrix4fv(P.dot.u.uProj, false, proj);
        const sc = Math.hypot(model[0], model[1], model[2]);
        gl.uniform1f(P.dot.u.uScale, sc);
        gl.uniform1f(P.dot.u.uPx, pxs);
        gl.uniform1f(P.dot.u.uAp, L.noDof ? 0 : (cam.aperture || 0));
        gl.uniform1f(P.dot.u.uFocus, cam.focus || 50);
        gl.uniform1f(P.dot.u.uCocMax, cam.cocMax || 60);
        gl.uniform1f(P.dot.u.uBill, L.billboard === false ? 0 : 1);
        gl.uniform3fv(P.dot.u.uLight, L.light || [-0.5, 0.7, 0.8]);
        gl.uniform3fv(P.dot.u.uEnvTop, L.envTop || [0.5, 0.5, 0.55]);
        gl.uniform3fv(P.dot.u.uEnvBot, L.envBot || [0.02, 0.02, 0.03]);
        gl.uniform1f(P.dot.u.uTime, F.t || 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, inst);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, d, 0, n * STRIDE);
        if (L.additive) gl.blendFunc(gl.ONE, gl.ONE);
        if (L.multiply) gl.blendFunc(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA);
        gl.bindVertexArray(vaoDot);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
        if (L.additive || L.multiply) gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      }
    }
    function fsDraw0() { gl.bindVertexArray(vaoQ); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }

    const tmpIdx = new Uint32Array(MAXD), tmpZ = new Float32Array(MAXD), tmpD = new Float32Array(MAXD * STRIDE);
    function sortByDepth(d, n, model, view) {
      const mv = M.mul(view, model);
      for (let i = 0; i < n; i++) {
        const o = i * STRIDE;
        tmpZ[i] = mv[2] * d[o] + mv[6] * d[o + 1] + mv[10] * d[o + 2] + mv[14];
        tmpIdx[i] = i;
      }
      const idx = Array.from(tmpIdx.subarray(0, n)).sort((a, b) => tmpZ[a] - tmpZ[b]); // far (more negative) first
      for (let i = 0; i < n; i++) tmpD.set(d.subarray(idx[i] * STRIDE, idx[i] * STRIDE + STRIDE), i * STRIDE);
      d.set(tmpD.subarray(0, n * STRIDE));
    }

    function bloom(src, thr) {
      gl.disable(gl.BLEND);
      gl.useProgram(P.down.p);
      let s = src;
      for (let i = 0; i < blm.length; i++) {
        const t = blm[i];
        gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb); gl.viewport(0, 0, t.w, t.h);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, s.tex);
        gl.uniform1i(P.down.u.uT, 0); gl.uniform2f(P.down.u.uTx, 1 / s.w, 1 / s.h);
        gl.uniform1f(P.down.u.uThr, thr); gl.uniform1i(P.down.u.uPre, i === 0 ? 1 : 0);
        fsDraw(); s = t;
      }
      gl.useProgram(P.up.p);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      for (let i = blm.length - 1; i > 0; i--) {
        const a = blm[i], b = blm[i - 1];
        gl.bindFramebuffer(gl.FRAMEBUFFER, b.fb); gl.viewport(0, 0, b.w, b.h);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, a.tex);
        gl.uniform1i(P.up.u.uT, 0); gl.uniform2f(P.up.u.uTx, 1 / a.w, 1 / a.h);
        fsDraw();
      }
      gl.disable(gl.BLEND);
      return blm[0];
    }

    // frameAt(t) → frame object; sub = sub-frame count; shutter in seconds
    function render(frameAt, t, sub = 1, shutter = 1 / 120) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, acc.fb); gl.viewport(0, 0, W, H);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      let F0 = null;
      for (let i = 0; i < sub; i++) {
        const ts = sub === 1 ? t : t + ((i + 0.5) / sub - 0.5) * shutter;
        const F = frameAt(ts);
        if (sub === 1 || i === Math.floor(sub / 2)) F0 = F;
        if (F.shutter === 0 && i > 0) { // scene asked for no blur: reuse first sub-frame
          continue;
        }
        drawScene(F);
        gl.bindFramebuffer(gl.FRAMEBUFFER, acc.fb); gl.viewport(0, 0, W, H);
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
        gl.useProgram(P.acc.p);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, scene.tex);
        gl.uniform1i(P.acc.u.uT, 0);
        gl.uniform1f(P.acc.u.uW, F.shutter === 0 ? 1 : 1 / sub);
        fsDraw();
        if (F.shutter === 0) break;
      }
      const F = frameAt(t);
      const post = Object.assign({ bloom: 0.6, thr: 1.0, expo: 1, ca: 0, scan: 0, curve: 0, grain: 0.016, vign: 0.5, glitch: 0, sort: 0,
        sat: 1, flash: [1, 1, 1, 0], tint: [1, 1, 1], invert: 0, mono: 0, seed: 0, overA: 1 }, F.post || {});
      const B = bloom(acc, post.thr);
      // overlay
      octx.setTransform(1, 0, 0, 1, 0, 0);
      octx.clearRect(0, 0, W, H);
      if (F.overlay) F.overlay(octx, t);
      upload(overTex, over);
      // composite
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H);
      gl.disable(gl.BLEND);
      gl.useProgram(P.comp.p);
      const u = P.comp.u;
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, acc.tex); gl.uniform1i(u.uScene, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, B.tex); gl.uniform1i(u.uBloom, 1);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, overTex); gl.uniform1i(u.uOver, 2);
      gl.uniform2f(u.uRes, W, H); gl.uniform1f(u.uT, t);
      gl.uniform1f(u.uBloomK, post.bloom); gl.uniform1f(u.uExpo, post.expo); gl.uniform1f(u.uCA, post.ca);
      gl.uniform1f(u.uScan, post.scan); gl.uniform1f(u.uCurve, post.curve); gl.uniform1f(u.uGrain, post.grain);
      gl.uniform1f(u.uVign, post.vign); gl.uniform1f(u.uGlitch, post.glitch); gl.uniform1f(u.uSort, post.sort);
      gl.uniform1f(u.uSeed, post.seed); gl.uniform1f(u.uSat, post.sat); gl.uniform4fv(u.uFlash, post.flash);
      gl.uniform3fv(u.uTint, post.tint); gl.uniform1f(u.uInvert, post.invert); gl.uniform1f(u.uMono, post.mono);
      gl.uniform1f(u.uOverA, post.overA);
      fsDraw();
      return F0;
    }
    return { gl, render, W, H };
  }

  window.PE = { createEngine, M, hex, STRIDE };
})();
