// node tools/export_events.cjs → assets/events.json (the film's cue list, for the score)
const fs = require('fs'), path = require('path'), vm = require('vm');
const A = path.join(__dirname, '..', 'assets');
const ctx = { window: {}, Math, Map, Set, Array, Object, Float32Array, JSON, console };
ctx.PE = ctx.window.PE = { M: { trs: () => [], mul: () => [], persp: () => [], look: () => [] }, hex: () => [0, 0, 0], STRIDE: 12 };
vm.createContext(ctx); ctx.window = ctx; ctx.window.PE = ctx.PE;
vm.runInContext(fs.readFileSync(path.join(A, 'data.js'), 'utf8'), ctx);
const SOC = process.argv.includes('--social');
vm.runInContext(fs.readFileSync(path.join(A, SOC ? 'social.js' : 'film.js'), 'utf8'), ctx);
const ev = ctx.window.FILM.EVENTS.slice().sort((a, b) => a.t - b.t);
fs.writeFileSync(path.join(A, SOC ? 'events_social.json' : 'events.json'), JSON.stringify(ev));
const c = {}; ev.forEach(e => c[e.type] = (c[e.type] || 0) + 1);
console.log(ev.length, c);
