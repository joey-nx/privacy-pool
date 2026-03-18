#!/bin/bash
# Local development: start sequencer + frontend
# Usage: bash scripts/dev.sh
#
# Reads deployment info from deployments/cross-testnet.json
# Requires RELAYER_KEY env var

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

echo "=== Latent Local Dev ==="
echo "  RPC:        $RPC"
echo "  Pool:       $POOL"
echo "  From block: $FROM_BLOCK"
echo "  Sequencer:  http://localhost:$SEQ_PORT"
echo "  Frontend:   http://localhost:3000"
echo ""

# Kill existing processes on target ports
lsof -i :$SEQ_PORT -t 2>/dev/null | xargs kill 2>/dev/null || true
lsof -i :3000 -t 2>/dev/null | xargs kill 2>/dev/null || true
sleep 1

# Start sequencer in background
echo "[1/2] Starting sequencer..."
cd "$ROOT"
npx tsx packages/sequencer/src/index.ts \
  --rpc "$RPC" \
  --pool "$POOL" \
  --relayer-key "$KEY" \
  --operator-key "$KEY" \
  --port "$SEQ_PORT" \
  --confirmations 1 \
  --auto-attest \
  --from-block "$FROM_BLOCK" \
  --poll 5000 &
SEQ_PID=$!

# Wait for sequencer to be ready
echo "    Waiting for sequencer..."
for i in $(seq 1 30); do
  if curl -s --max-time 2 "http://localhost:$SEQ_PORT/health" >/dev/null 2>&1; then
    echo "    Sequencer ready!"
    break
  fi
  sleep 1
done

# Start frontend
echo "[2/2] Starting frontend..."
npm -w @latent/frontend run dev &
FE_PID=$!

echo ""
echo "=== Running ==="
echo "  Sequencer PID: $SEQ_PID"
echo "  Frontend PID:  $FE_PID"
echo ""
echo "Press Ctrl+C to stop all"

# Trap Ctrl+C to kill both
trap "echo ''; echo 'Shutting down...'; kill $SEQ_PID $FE_PID 2>/dev/null; exit 0" INT TERM

# Wait for either to exit
wait
