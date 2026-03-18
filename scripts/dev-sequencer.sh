#!/bin/bash
# Start sequencer only
# Usage: bash scripts/dev-sequencer.sh

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY="$ROOT/deployments/cross-testnet.json"

if [ ! -f "$DEPLOY" ]; then
  echo "ERROR: $DEPLOY not found. Deploy contracts first."
  exit 1
fi

# Parse deployment config
RPC=$(node -e "console.log(require('$DEPLOY').rpcUrl)")
POOL=$(node -e "console.log(require('$DEPLOY').contracts.PrivacyPoolV2)")
FROM_BLOCK=$(node -e "console.log(require('$DEPLOY').deployBlock)")
SEQ_PORT=$(node -e "console.log(require('$DEPLOY').sequencer.port)")

# Relayer/operator key (env var required)
KEY="${RELAYER_KEY:?ERROR: RELAYER_KEY env var is required}"

echo "=== Latent Sequencer ==="
echo "  RPC:        $RPC"
echo "  Pool:       $POOL"
echo "  From block: $FROM_BLOCK"
echo "  Port:       http://localhost:$SEQ_PORT"
echo ""

# Kill existing process on target port
lsof -i :$SEQ_PORT -t 2>/dev/null | xargs kill 2>/dev/null || true
sleep 1

echo "Starting sequencer..."
cd "$ROOT"
exec npx tsx packages/sequencer/src/index.ts \
  --rpc "$RPC" \
  --pool "$POOL" \
  --relayer-key "$KEY" \
  --operator-key "$KEY" \
  --port "$SEQ_PORT" \
  --confirmations 1 \
  --auto-attest \
  --from-block "$FROM_BLOCK" \
  --poll 5000
