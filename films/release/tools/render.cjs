// node tools/render.cjs [--workers 3] [--sub 8] [--fps 60] [--from 0] [--to 72] [--out renders/name.mp4]
// Each worker renders a contiguous range of frames in its own headless Chrome (GPU, Metal), piping PNGs
// into ffmpeg (x264 crf 12, intermediate); segments are concatenated and muxed with assets/score.wav.
const puppeteer = require(process.env.PUPPETEER_CORE || 'puppeteer-core');
const { spawn, execFileSync } = require('child_process');
const path = require('path'), fs = require('fs');
const A = {}; process.argv.slice(2).forEach((a, i, arr) => { if (a.startsWith('--')) A[a.slice(2)] = arr[i + 1]; });
const W = +(A.workers || 3), SUB = +(A.sub || 8), FPS = +(A.fps || 60), FROM = +(A.from || 0), TO = +(A.to || 72);
const ROOT = path.join(__dirname, '..');
const SOC = 'social' in A || process.argv.includes('--social');
const PAGE = SOC ? 'social.html' : 'index.html', VW = SOC ? 1080 : 1920, VH = SOC ? 1920 : 1080;
const OUT = path.resolve(ROOT, A.out || 'renders/Punctum-Moderne-Release-2400.mp4');
const TMP = path.join(ROOT, 'renders', process.argv.includes('--social') ? 'seg_social' : 'seg'); fs.mkdirSync(TMP, { recursive: true });
const f0 = Math.round(FROM * FPS), f1 = Math.round(TO * FPS), total = f1 - f0;
const per = Math.ceil(total / W);
let done = 0; const t0 = Date.now();
async function worker(k) {
  const a = f0 + k * per, b = Math.min(f1, a + per);
  if (a >= b) return null;
  const seg = path.join(TMP, `seg${k}.mp4`);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '10', '-pix_fmt', 'yuv420p', '-r', String(FPS), seg], { stdio: ['pipe', 'inherit', 'inherit'] });
  const br = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new',
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const p = await br.newPage();
  await p.setViewport({ width: VW, height: VH, deviceScaleFactor: 1 });
  p.on('pageerror', e => console.error('pageerror', k, e.message));
  await p.goto('http://localhost:8790/' + PAGE, { waitUntil: 'load' });
  await p.waitForFunction('window.READY === true', { timeout: 60000 });
  for (let f = a; f < b; f++) {
    await p.evaluate((t, s) => renderAt(t, s), f / FPS, SUB);
    const png = await p.screenshot({ type: 'png', optimizeForSpeed: true });
    if (!ff.stdin.write(png)) await new Promise(r => ff.stdin.once('drain', r));
    done++;
    if (done % 120 === 0) { const el = (Date.now() - t0) / 1000; console.log(`${done}/${total}  ${el.toFixed(0)}s  eta ${(el / done * (total - done)).toFixed(0)}s`); }
  }
  await br.close();
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  return seg;
}
(async () => {
  const segs = (await Promise.all([...Array(W).keys()].map(worker))).filter(Boolean);
  const list = path.join(TMP, 'list.txt');
  fs.writeFileSync(list, segs.map(s => `file '${s}'`).join('\n'));
  const silent = path.join(TMP, 'silent.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', silent]);
  const wav = path.join(ROOT, 'assets', SOC ? 'score_social.wav' : 'score.wav');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, '-ss', String(FROM), '-t', String(TO - FROM), '-i', wav,
    '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', String(A.crf || 17), '-tune', 'film', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
    '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '320k', '-shortest', OUT]);
  console.log('done', OUT, ((Date.now() - t0) / 1000).toFixed(0) + 's');
})();
