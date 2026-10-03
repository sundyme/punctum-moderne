// Write assets/events.json from the film model (the score's single source of timing).
const fs = require('fs'), path = require('path');
const F = require('./film-node.cjs');
fs.writeFileSync(path.join(__dirname, '..', 'assets', 'events.json'), JSON.stringify(F.events()));
const e = F.events();
console.log('events.json:', e.ink.length, 'ink,', e.plucks.length, 'plucks,', e.clicks.length, 'clicks,', e.jet.length, 'jet,', e.light.focus.length, 'focus; sharp', e.light.sharp.toFixed(2));
