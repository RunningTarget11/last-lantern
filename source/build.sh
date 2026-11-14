#!/bin/sh
set -e
cd /workspace/lem-src
npx esbuild src/game.js --bundle --minify --format=iife --target=es2019 --outfile=dist/game.js --log-level=warning
cp index.html dist/index.html
ls -la dist/game.js
