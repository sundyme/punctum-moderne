#!/bin/sh
# The hero loop is its own HyperFrames project (one root composition per project);
# it shares the film's engine, glyph data and font.
set -e
HERE="$(cd "$(dirname "$0")/.." && pwd)"
LOOP="$HERE/../life-of-a-dot-loop"
mkdir -p "$LOOP/assets/fonts"
cp "$HERE/assets/engine.js" "$HERE/assets/glyphs.js" "$LOOP/assets/"
cp "$HERE/assets/fonts/PunctumModerne-VF.woff2" "$LOOP/assets/fonts/"
echo "synced engine → life-of-a-dot-loop/assets"
