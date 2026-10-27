// Shared zh → en runtime for the site and the italic page. The page is written in Chinese;
// English comes from a dictionary keyed by whitespace-normalized text, plus a few rules for generated strings.
const I18N = __I18N__;
const i18n = (() => {
  const norm = (s) => s.replace(/\s+/g, " ").trim();
  const RULES = [
    [/^(\d+) 点 · (\d+)$/, (m) => `${m[1]} dots · ${m[2]}`],
    [/^(wght \d+ · CNTR \d+ · opsz) 自动$/, (m) => `${m[1]} auto`],
    [/^([\d.]+°) · (.+)$/, (m) => (I18N[m[2]] ? `${m[1]} · ${I18N[m[2]]}` : null)],
    [/^相当于字号 (\d+) px · opsz (\d+) · 文字母版占比 (\d+)%$/, (m) => `Equivalent to ${m[1]} px · opsz ${m[2]} · text master ${m[3]}%`],
    [/^《(.+)》$/, (m) => (I18N[m[1]] ? `“${I18N[m[1]]}”` : null)],
    [/^放大查看：(.+)$/, (m) => `Enlarge: ${I18N[m[1]] || m[1]}`],
    [/^(.+) · (\d+) 个静态字体$/, (m) => `${m[1]} · ${m[2]} static fonts`],
    [/^(.+), 各含 Italic$/, (m) => `${m[1]}, each with Italic`],
  ];
  const ATTRS = ["aria-label", "alt", "title", "placeholder", "aria-roledescription"];
  const CJK = /[　-〿一-鿿＀-￯]/;
  let lang = "zh";
  const lookup = (s) => {
    const k = norm(s);
    if (k in I18N) return I18N[k];
    for (const [re, f] of RULES) { const m = k.match(re); if (m) { const v = f(m); if (v != null) return v; } }
    return null;
  };
  const tr = (s) => (lang === "en" ? lookup(s) ?? s : s);
  const texts = new WeakMap(), attrs = new WeakMap();   // node -> { zh, en }
  const skip = (n) => { const p = n.parentElement; return !p || p.closest("script, style, [data-no-i18n]"); };
  function textNode(n) {
    if (skip(n)) return;
    const cur = n.nodeValue, rec = texts.get(n);
    const zh = rec && cur === rec.en ? rec.zh : cur;
    if (lang === "zh") { if (rec && cur === rec.en) n.nodeValue = rec.zh; return; }
    const en = lookup(zh);
    if (en == null) return;
    // English needs the spaces Chinese never had around inline code
    const lead = /^\s/.test(zh) || (n.previousSibling && n.previousSibling.nodeType === 1 && /^[A-Za-z0-9“(]/.test(en)) ? " " : "";
    const trail = /\s$/.test(zh) || (n.nextSibling && n.nextSibling.nodeType === 1 && /[A-Za-z0-9,;:.)”]$/.test(en)) ? " " : "";
    const out = lead + en + trail;
    texts.set(n, { zh, en: out });
    if (cur !== out) n.nodeValue = out;
  }
  function element(el) {
    for (const a of ATTRS) {
      if (!el.hasAttribute(a)) continue;
      const cur = el.getAttribute(a), map = attrs.get(el) || {}, rec = map[a];
      const zh = rec && cur === rec.en ? rec.zh : cur;
      if (lang === "zh") { if (rec && cur === rec.en) el.setAttribute(a, rec.zh); continue; }
      const en = lookup(zh);
      if (en == null) continue;
      map[a] = { zh, en }; attrs.set(el, map);
      if (cur !== en) el.setAttribute(a, en);
    }
  }
  function walk(root) {
    if (root.nodeType === 3) return textNode(root);
    if (root.nodeType !== 1 || root.closest("script, style, [data-no-i18n]")) return;
    element(root);
    root.querySelectorAll("*").forEach(element);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) if (CJK.test(n.nodeValue) || texts.has(n) || /^(Didone · 1788|Dot matrix · 1970s)$/.test(n.nodeValue.trim())) textNode(n);
  }
  // text that scripts write later (inspector, demos, captions) is translated as it appears
  new MutationObserver((ms) => {
    if (lang !== "en") return;
    for (const m of ms) {
      if (m.type === "childList") m.addedNodes.forEach(walk);
      else if (m.type === "characterData") textNode(m.target);
      else if (m.type === "attributes") element(m.target);
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  function set(l) {
    lang = l === "en" ? "en" : "zh";
    document.documentElement.lang = lang === "en" ? "en" : "zh-CN";
    walk(document.body);
    const b = document.getElementById("lang");
    if (b) { b.textContent = lang === "en" ? "中文" : "EN"; b.setAttribute("aria-label", lang === "en" ? "切换到中文" : "Switch to English"); b.lang = lang === "en" ? "zh-CN" : "en"; }
    try { localStorage.setItem("pm-lang", lang); } catch (e) {}
    document.dispatchEvent(new CustomEvent("langchange"));
  }
  function initial() {
    try { const q = new URLSearchParams(location.search).get("lang"); if (q === "en" || q === "zh") return q; } catch (e) {}
    try { const s = localStorage.getItem("pm-lang"); if (s === "en" || s === "zh") return s; } catch (e) {}
    const ls = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || "zh"];
    return ls.some((l) => /^zh/i.test(l)) ? "zh" : "en";
  }
  return { tr, set, initial, get lang() { return lang; } };
})();
const tr = i18n.tr;
