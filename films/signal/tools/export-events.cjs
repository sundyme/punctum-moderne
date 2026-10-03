const fs = require('fs'), path = require('path');
const F = require('./film-node.cjs');
const e = F.events();
fs.writeFileSync(path.join(__dirname, '..', 'assets', 'events.json'), JSON.stringify(e));
console.log('events:', e.morse.length, 'morse, end', e.morseEnd.toFixed(3), '|', e.flaps.length, 'flaps |', e.dropCuts.length, 'cuts');
