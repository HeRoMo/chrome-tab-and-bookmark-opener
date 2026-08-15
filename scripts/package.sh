#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

VERSION=$(node -p "require('./package.json').version")
OUT_DIR="dist"
OUT_FILE="${OUT_DIR}/Chrome tab and bookmark opener-${VERSION}.alfredworkflow"

mkdir -p "$OUT_DIR"
rm -f "$OUT_FILE"

cd workflow
zip -r -X "../${OUT_FILE}" . -x ".*"
cd ..

echo "Packaged: ${OUT_FILE}"
