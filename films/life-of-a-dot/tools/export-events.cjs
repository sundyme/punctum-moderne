// Write assets/events.json from the engine (the score's single source of timing).
const fs = require('fs'), path = require('path');
const E = require('./engine-node.cjs');
fs.writeFileSync(path.join(__dirname, '..', 'assets', 'events.json'), JSON.stringify(E.events()));
console.log('events.json written');
