#!/bin/bash
# Start frontend only
# Usage: bash scripts/dev-frontend.sh

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== Latent Frontend ==="
echo "  URL: http://localhost:3000"
echo ""

# Kill existing process on port 3000
lsof -i :3000 -t 2>/dev/null | xargs kill 2>/dev/null || true
sleep 1

echo "Starting frontend..."
cd "$ROOT"
exec npm -w @latent/frontend run dev
