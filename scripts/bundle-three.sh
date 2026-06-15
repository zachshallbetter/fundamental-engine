#!/usr/bin/env bash
# Generate the no-build IIFE bundle of @fundamental-engine/three for a vendored, build-step-free page
# (e.g. Habitat). Three is the page's global — the `three` import is aliased to a CJS shim that returns
# window.THREE, so the bundle reuses the page's single THREE instance. Run `pnpm build` first (the
# bundle entry is packages/three/dist). Usage: scripts/bundle-three.sh [outfile]
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${1:-dist-bundle/fundamental-engine-three.js}"
mkdir -p "$(dirname "$OUT")"
ESBUILD="$(find node_modules/.pnpm -path '*/esbuild@*/node_modules/esbuild/bin/esbuild' | sort -V | tail -1)"
THREE_V="$(node -p "require('./packages/three/package.json').version")"
CORE_V="$(node -p "require('./packages/core/package.json').version")"
"$ESBUILD" packages/three/dist/index.js \
  --bundle --format=iife --global-name=FieldUI --platform=browser \
  --alias:three=./scripts/three-global-shim.cjs \
  --banner:js="// fundamental-engine-three.js — @fundamental-engine/three@${THREE_V} + @fundamental-engine/core@${CORE_V} bundled for the no-build page (three -> window.THREE). Generated; do not edit." \
  --outfile="$OUT"
echo "wrote $OUT"
