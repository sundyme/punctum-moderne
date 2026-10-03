// Load assets/film.js (a browser/UMD script) in Node with the full glyph set.
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'film.js'), 'utf8');
const m = { exports: {} };
new Function('module', 'exports', src)(m, m.exports);
const glyphs = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'glyphs.json'), 'utf8'));
module.exports = m.exports(glyphs);
