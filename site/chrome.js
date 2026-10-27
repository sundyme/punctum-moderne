// Theme and sound switches shared by the site and the italic page (#theme, #sound in the page header).
// Theme: dark unless the visitor picked light (localStorage pm-theme); THEME_BOOT in <head> sets it before paint.
// Sound: small synthesized sounds for the page's controls, off until the visitor turns them on (pm-sound).
// The palette is the music-box demo's: D major pentatonic, struck like a pin or plucked like a tine.
const pageChrome = (() => {
  const root = document.documentElement;
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
  };
  const $ = (id) => document.getElementById(id);

  /* ── theme ─────────────────────────────────────────────── */
  const meta = document.querySelector('meta[name="theme-color"]');
  function setTheme(t, save) {
    root.setAttribute("data-theme", t);
    if (save) store.set("pm-theme", t);
    if (meta) meta.setAttribute("content", getComputedStyle(document.body || root).backgroundColor);
    const b = $("theme");
    if (b) {
      const label = t === "dark" ? "切换到浅色" : "切换到深色";
      b.setAttribute("aria-label", label);
      b.setAttribute("title", label);
    }
  }
  setTheme(root.getAttribute("data-theme") === "light" ? "light" : "dark", false);

  /* ── sound ─────────────────────────────────────────────── */
  let on = store.get("pm-sound") === "on", ac = null, bus = null, last = 0;
  const PENTA = [0, 2, 4, 7, 9];
  const hz = (k) => 293.66 * Math.pow(2, (12 * Math.floor(k / 5) + PENTA[((k % 5) + 5) % 5]) / 12); // k-th step above D4
  const active = () => !navigator.userActivation || navigator.userActivation.hasBeenActive;
  function ctx() {
    if (!ac) {
      if (!active()) return null;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
      bus = ac.createGain(); bus.gain.value = 0.5;
      const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 8500;
      const comp = ac.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4;
      bus.connect(lp); lp.connect(comp); comp.connect(ac.destination);
    }
    if (ac.state !== "running") { const p = ac.resume && ac.resume(); if (p && p.catch) p.catch(() => {}); }
    return ac.state === "running" ? ac : null;
  }
  function env(g, t0, peak, decay) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
  }
  // a pin strike: a short glassy blip
  function tick(f = 1800, v = 0.25, delay = 0) {
    const a = ctx(); if (!a) return;
    const t0 = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
    o.type = "triangle"; o.frequency.setValueAtTime(f, t0); o.frequency.exponentialRampToValueAtTime(f * 0.7, t0 + 0.05);
    env(g, t0, v, 0.06);
    o.connect(g); g.connect(bus); o.start(t0); o.stop(t0 + 0.08);
  }
  // a music-box tine: fundamental plus the comb's inharmonic overtone
  function tine(k, v = 0.3, delay = 0, decay = 0.9) {
    const a = ctx(); if (!a) return;
    const t0 = a.currentTime + delay, f = hz(k);
    [[1, 1], [4.2, 0.18], [2, 0.12]].forEach(([m, w]) => {
      const o = a.createOscillator(), g = a.createGain();
      o.type = "sine"; o.frequency.value = f * m;
      env(g, t0, v * w, m === 1 ? decay : decay * 0.35);
      o.connect(g); g.connect(bus); o.start(t0); o.stop(t0 + decay + 0.05);
    });
  }
  // a soft low knock, for opening and closing things
  function knock(up = true, v = 0.35) {
    const a = ctx(); if (!a) return;
    const t0 = a.currentTime, o = a.createOscillator(), g = a.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(up ? 140 : 220, t0); o.frequency.exponentialRampToValueAtTime(up ? 230 : 120, t0 + 0.12);
    env(g, t0, v, 0.18);
    o.connect(g); g.connect(bus); o.start(t0); o.stop(t0 + 0.2);
  }
  // split-flap: a few quick ticks, used when the page itself flips (theme, language)
  const flap = (n = 4) => { for (let i = 0; i < n; i++) tick(1300 + 260 * i, 0.16, i * 0.032); };
  const rate = (ms) => { const t = performance.now(); if (t - last < ms) return false; last = t; return true; };

  function setSound(v, save) {
    on = v;
    if (save) store.set("pm-sound", v ? "on" : "off");
    const b = $("sound");
    if (b) {
      // a toggle keeps its name; aria-pressed carries the state and the tooltip says what a click does
      b.setAttribute("aria-pressed", String(v));
      b.setAttribute("aria-label", "音效");
      b.setAttribute("title", v ? "关闭音效" : "打开音效");
    }
    if (!v) {                                   // switching off silences the music-box demo as well
      const mb = $("music-sound");
      if (mb && mb.getAttribute("aria-pressed") === "true") mb.click();
    }
  }
  setSound(on, false);

  // a remembered "on" starts the audio on the first gesture, where browsers allow it
  ["pointerdown", "pointerup", "keydown"].forEach((t) => addEventListener(t, () => { if (on) ctx(); }, true));

  /* ── wiring ────────────────────────────────────────────── */
  $("theme")?.addEventListener("click", () => {
    setTheme(root.getAttribute("data-theme") === "dark" ? "light" : "dark", true);
    if (on) flap(4);
  });
  $("sound")?.addEventListener("click", () => {
    setSound(!on, true);
    if (on) { tine(5, 0.28); tine(7, 0.28, 0.07); tine(9, 0.3, 0.14, 1.2); }
  });

  // every other control, by delegation: buttons and links strike, tabs and nav links pluck, copy rings
  document.addEventListener("click", (e) => {
    if (!on) return;
    const el = e.target.closest("a, button, [role=tab], summary, .board-frame");
    if (!el || el.id === "theme" || el.id === "sound") return;
    if (el.id === "lang") return flap(3);
    const nav = el.closest(".nav ul, .car-tabs, .seg, [role=tablist]");
    if (nav) {
      const items = [...nav.querySelectorAll("a, button")];
      return tine(3 + Math.max(0, items.indexOf(el)), 0.26);
    }
    if (/copy/.test(el.id)) { tine(10, 0.24); return tine(12, 0.2, 0.06, 1.4); }
    if (el.id === "lb-close") return knock(false);
    if (el.matches(".board-frame")) return knock(true);                                    // a specimen board opens
    const txt = (el.textContent || "").trim();
    if ([...txt].length === 1) return tine(4 + (txt.codePointAt(0) % 7), 0.22, 0, 0.6);   // a glyph in the character set
    tick(1700, 0.22);
  }, true);

  // sliders tick as they pass each step of the range, higher as the value grows
  const steps = new WeakMap();
  document.addEventListener("input", (e) => {
    const r = e.target;
    if (!on || !(r instanceof HTMLInputElement) || r.type !== "range") return;
    const lo = +r.min || 0, hi = +r.max || 100, k = Math.round(((+r.value - lo) / (hi - lo || 1)) * 14);
    if (steps.get(r) === k) return;
    steps.set(r, k);
    if (rate(28)) tick(hz(k + 3) * 2, 0.2);
  });

  // the design-space pad moves the sliders in code, so listen to the drag itself
  let padCell = -1;
  document.addEventListener("pointermove", (e) => {
    if (!on || !e.buttons) return;
    const pad = e.target.closest && e.target.closest("#pad");
    if (!pad) return;
    const b = pad.getBoundingClientRect();
    const x = Math.round(((e.clientX - b.left) / b.width) * 8), y = Math.round(((e.clientY - b.top) / b.height) * 4);
    const cell = x * 10 + y;
    if (cell !== padCell && rate(40)) { padCell = cell; tick(hz(x + 3) * 2, 0.18); }
  });

  // the hero lattice: a faint pin under the pointer as it crosses each cell
  let heroCell = -1;
  document.addEventListener("pointermove", (e) => {
    if (!on || e.pointerType === "touch" && !e.buttons) return;
    const cv = e.target.id === "hero-cv" ? e.target : null;
    if (!cv) return;
    const b = cv.getBoundingClientRect(), s = Math.max(18, b.width / 40);
    const cx = Math.floor((e.clientX - b.left) / s), cy = Math.floor((e.clientY - b.top) / s);
    const cell = cx * 1000 + cy;
    if (cell === heroCell || !rate(55)) return;
    heroCell = cell;
    const rows = Math.max(1, Math.floor(b.height / s));
    tick(hz(12 - Math.round((cy / rows) * 10)) * 2, 0.08);
  });

  return { setTheme, setSound, tick, tine };
})();
