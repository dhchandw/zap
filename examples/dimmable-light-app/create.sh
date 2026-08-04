#!/usr/bin/env bash
# Recreate the Matter dimmable light .zap with the zap edit CLI, then generate.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

LIGHT="examples/dimmable-light-app/light.zap"
SCRIPT="examples/dimmable-light-app/light.yaml"
OUT="examples/dimmable-light-app/gen"
ZCL="./zcl-builtin/matter/zcl.json"
GEN="./test/gen-template/matter/gen-test.json"
ZAP=(node --unhandled-rejections=strict dist/src-electron/main-process/main.js)

if [[ ! -f dist/src-electron/main-process/main.js ]]; then
  echo "Backend not built. Run: npx tsc --build ./tsconfig.json" >&2
  exit 1
fi

rm -f "$LIGHT"
rm -rf "$OUT"
mkdir -p "$OUT"

"${ZAP[@]}" edit apply "$LIGHT" --new --script "$SCRIPT" \
  --zcl "$ZCL" --gen "$GEN" --no-suggest

"${ZAP[@]}" edit endpoint list "$LIGHT" --zcl "$ZCL" --gen "$GEN" --no-suggest
"${ZAP[@]}" edit cluster list "$LIGHT" --endpoint 1 --enabled-only \
  --zcl "$ZCL" --gen "$GEN" --no-suggest

"${ZAP[@]}" generate "$LIGHT" -o "$OUT" --zcl "$ZCL" --gen "$GEN"

echo
echo "Wrote $LIGHT and generated into $OUT"
echo "CurrentLevel default:"
rg -n "CurrentLevel|SIMPLE_DEFAULT\\(25\\)" "$OUT/endpoint-config.c" || true
