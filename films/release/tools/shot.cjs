// node tools/shot.cjs t1 t2 ...  [--sub N] [--out dir]  → frames/t_XX.XX.png  (+ contact sheet via python)
const puppeteer = require(process.env.PUPPETEER_CORE || 'puppeteer-core');
const path = require('path');
const args = process.argv.slice(2);
let sub = 1, out = path.join(__dirname, '..', 'frames');
const ts = [];
let PAGE = 'index.html', VW = 1920, VH = 1080;
for (let i = 0; i < args.length; i++) { if (args[i] === '--sub') sub = +args[++i]; else if (args[i] === '--out') out = args[++i]; else if (args[i] === '--social') { PAGE = 'social.html'; VW = 1080; VH = 1920; } else ts.push(+args[i]); }
(async () => {
  const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new',
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage();
  await p.setViewport({ width: VW, height: VH, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warn') errs.push(m.text()); });
  await p.goto('http://localhost:8790/' + PAGE, { waitUntil: 'load' });
  await p.waitForFunction('window.READY === true', { timeout: 30000 }).catch(() => {});
  if (errs.length) console.log('errors', errs.slice(0, 5));
  for (const t of ts) {
    const t0 = Date.now();
    await p.evaluate((t, s) => renderAt(t, s), t, sub);
    const f = path.join(out, `t_${t.toFixed(2)}.png`);
    await p.screenshot({ path: f, optimizeForSpeed: true });
    console.log(f, Date.now() - t0, 'ms');
  }
  console.log(await p.evaluate(() => { const gl = document.createElement('canvas').getContext('webgl2'); const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'n/a'; }));
  await b.close();
})();
