#!/bin/bash
set -e
cd /workspace/ll-src
npx esbuild src/main.js --bundle --minify --format=iife --target=es2020 --outfile=/workspace/last-lantern/game.js --log-level=warning
cp index.html /workspace/last-lantern/index.html
ls -la /workspace/last-lantern/game.js
