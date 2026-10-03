// Load assets/engine.js (a browser/UMD script) in Node.
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'engine.js'), 'utf8');
const m = { exports: {} };
new Function('module', 'exports', src)(m, m.exports);
const glyphs = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'assets', 'glyphs.json'), 'utf8'));
module.exports = m.exports(glyphs);
