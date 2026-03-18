#!/usr/bin/env bash
# Copy nargo compile output to SDK public directory.
# Usage: bash scripts/copy-circuit.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SDK_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$SDK_DIR")"

SRC="$PROJECT_ROOT/circuits/target/cps_circuit.json"
DST_DIR="$SDK_DIR/public/circuit"
DST="$DST_DIR/cps_circuit.json"

if [ ! -f "$SRC" ]; then
  echo "Error: $SRC not found. Run 'nargo compile' first."
  exit 1
fi

mkdir -p "$DST_DIR"
cp "$SRC" "$DST"
echo "Copied circuit artifact to $DST"
