# ============================================================
# Shared dependency stage — used by both frontend and sequencer
# ============================================================
FROM node:25-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/sdk/package.json packages/sdk/package.json
COPY packages/frontend/package.json packages/frontend/package.json
COPY packages/sequencer/package.json packages/sequencer/package.json

RUN npm ci

# ============================================================
# Target: sequencer
# ============================================================
FROM node:25-alpine AS sequencer
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

COPY package.json ./
COPY packages/sequencer/ packages/sequencer/

RUN mkdir -p /app/data && chown -R node:node /app/data
VOLUME ["/app/data"]

USER node
EXPOSE 3002

ENV SEQ_PORT=3002
ENV SEQ_POLL=5000
ENV SEQ_CONFIRMATIONS=1
ENV SEQ_DATA_DIR=/app/data

CMD npx tsx packages/sequencer/src/index.ts \
    --rpc "$RPC_URL" \
    --pool "$POOL_ADDRESS" \
    --relayer-key "$RELAYER_KEY" \
    --operator-key "$OPERATOR_KEY" \
    --port "$SEQ_PORT" \
    --confirmations "$SEQ_CONFIRMATIONS" \
    --auto-attest \
    --from-block "$FROM_BLOCK" \
    --poll "$SEQ_POLL" \
    --data-dir "$SEQ_DATA_DIR"

# ============================================================
# Target: frontend — build stage
# ============================================================
FROM node:25-alpine AS frontend-builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

COPY package.json package-lock.json ./
COPY packages/sdk/ packages/sdk/
COPY packages/frontend/ packages/frontend/

# Build SDK: vite produces JS bundles, tsc emits .d.ts for downstream types.
# tsc may report errors from @aztec/bb.js platform differences (Alpine vs macOS)
# but still emits declarations (noEmitOnError defaults to false).
RUN npx -w @latent/sdk vite build && \
    (npx -w @latent/sdk tsc --emitDeclarationOnly || true)

ARG NEXT_PUBLIC_SEQUENCER_URL=http://localhost:3002
ARG NEXT_PUBLIC_POOL_ADDRESS=0x5fB82D522C4e3471cB2b9578E6f5284Cef8c9a4D
ARG NEXT_PUBLIC_TOKEN_ADDRESS=0x9364ea6790f6e0ecfaa5164085f2a7de34ec55fb
ARG NEXT_PUBLIC_CIRCUIT_URL=/circuit/latent_circuit.json
ARG NEXT_PUBLIC_OPERATOR_ENC_PUB_KEY

ENV NEXT_PUBLIC_SEQUENCER_URL=$NEXT_PUBLIC_SEQUENCER_URL
ENV NEXT_PUBLIC_POOL_ADDRESS=$NEXT_PUBLIC_POOL_ADDRESS
ENV NEXT_PUBLIC_TOKEN_ADDRESS=$NEXT_PUBLIC_TOKEN_ADDRESS
ENV NEXT_PUBLIC_CIRCUIT_URL=$NEXT_PUBLIC_CIRCUIT_URL
ENV NEXT_PUBLIC_OPERATOR_ENC_PUB_KEY=$NEXT_PUBLIC_OPERATOR_ENC_PUB_KEY

RUN npm -w @latent/frontend run build

# ============================================================
# Target: frontend — production runner
# ============================================================
FROM node:25-alpine AS frontend
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=frontend-builder /app/packages/frontend/.next/standalone ./
COPY --from=frontend-builder /app/packages/frontend/.next/static ./packages/frontend/.next/static
COPY --from=frontend-builder /app/packages/frontend/public ./packages/frontend/public

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "packages/frontend/server.js"]
