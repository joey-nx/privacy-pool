/**
 * Latent Sequencer — Entry Point
 *
 * Unified service combining:
 *   1. Merkle Tree Manager (incremental Poseidon2 tree + batch root submission)
 *   2. Note Scanner (EncryptedNote collection + view tag filtering)
 *   3. Operator Service (attestation + compliance decryption)
 *
 * Usage:
 *   npx tsx packages/sequencer/src/index.ts \
 *     --rpc <RPC_URL> --pool <POOL_ADDRESS> --relayer-key <KEY> \
 *     [--operator-key <KEY>] [--port 3000] [--poll 5000] \
 *     [--batch-size 100] [--batch-timeout 30000] \
 *     [--data-dir ./data/sequencer] [--confirmations 2] \
 *     [--auto-attest] [--auth-token <TOKEN>]
 */

import { initCrypto } from "./crypto.js";
import { IncrementalMerkleTree } from "./tree.js";
import { Store } from "./store.js";
import { ChainSync } from "./chain.js";
import { NoteScanner } from "./scanner.js";
import { OperatorService } from "./operator.js";
import { createApiServer, type ApiDeps } from "./api.js";
import type { SequencerConfig } from "./types.js";

// ============================================================
// CLI Argument Parser
// ============================================================

function parseArgs(): SequencerConfig & { authToken?: string } {
  const args = process.argv.slice(2);
  const config: SequencerConfig & { authToken?: string } = {
    rpc: "",
    pool: "",
    relayerKey: "",
    operatorKey: undefined,
    port: 3000,
    pollInterval: 5000,
    batchSize: 100,
    batchTimeout: 30000,
    dataDir: "./data/sequencer",
    confirmations: 2,
    autoAttest: false,
    fromBlock: 0,
    authToken: undefined,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--rpc": config.rpc = args[++i]; break;
      case "--pool": config.pool = args[++i]; break;
      case "--relayer-key": config.relayerKey = args[++i]; break;
      case "--operator-key": config.operatorKey = args[++i]; break;
      case "--port": config.port = parseInt(args[++i]); break;
      case "--poll": config.pollInterval = parseInt(args[++i]); break;
      case "--batch-size": config.batchSize = parseInt(args[++i]); break;
      case "--batch-timeout": config.batchTimeout = parseInt(args[++i]); break;
      case "--data-dir": config.dataDir = args[++i]; break;
      case "--confirmations": config.confirmations = parseInt(args[++i]); break;
      case "--auto-attest": config.autoAttest = true; break;
      case "--from-block": config.fromBlock = parseInt(args[++i]); break;
      case "--auth-token": config.authToken = args[++i]; break;
    }
  }

  if (!config.rpc || !config.pool || !config.relayerKey) {
    console.error(
      "Usage: npm run sequencer -- --rpc <URL> --pool <ADDRESS> --relayer-key <KEY>",
    );
    console.error("  Required: --rpc, --pool, --relayer-key");
    console.error("  Optional: --operator-key, --port, --poll, --batch-size, --batch-timeout");
    console.error("            --data-dir, --confirmations, --auto-attest, --auth-token");
    process.exit(1);
  }

  return config;
}

// ============================================================
// Main
// ============================================================

async function main(): Promise<void> {
  const config = parseArgs();
  const startTime = Date.now();

  // Initialize Barretenberg WASM (Poseidon2) before any crypto usage
  await initCrypto();

  console.log("[sequencer] Starting Latent Sequencer...");
  console.log(`[sequencer] RPC: ${config.rpc}`);
  console.log(`[sequencer] Pool: ${config.pool}`);
  console.log(`[sequencer] HTTP port: ${config.port}`);
  console.log(`[sequencer] Poll: ${config.pollInterval}ms, Batch: ${config.batchSize}/${config.batchTimeout}ms`);
  console.log(`[sequencer] Data dir: ${config.dataDir}`);
  console.log(`[sequencer] Confirmations: ${config.confirmations}`);

  // --- Initialize store ---
  const store = new Store(config.dataDir);
  store.init();

  // --- Initialize tree (from persisted state or fresh) ---
  let tree: IncrementalMerkleTree;
  const persistedState = store.loadState();
  if (persistedState) {
    tree = IncrementalMerkleTree.import(persistedState.tree);
    console.log(`[sequencer] Restored tree (${tree.leafCount} leaves, root: ${tree.root})`);
  } else {
    tree = new IncrementalMerkleTree();
    console.log("[sequencer] Starting with empty tree");
  }

  // --- Initialize chain sync ---
  const chain = new ChainSync(config, tree, store);
  await chain.initialize(persistedState?.sync);

  // --- Initialize note scanner ---
  const scanner = new NoteScanner(chain.contract, store, chain.provider);
  await scanner.init();

  // --- Initialize operator ---
  const operator = new OperatorService(chain.contract, store, chain.provider);
  await operator.init(config.operatorKey, config.autoAttest);

  // --- Initial sync ---
  console.log("[sequencer] Performing initial sync...");

  // Confirm any pending root left from a previous session BEFORE proposing new ones
  if (operator.isEnabled) {
    const confirmResult = await operator.confirmRoot();
    if (confirmResult.success) {
      await chain.resyncProcessedIndex();
    }
  }

  const newDeposits = await chain.syncCommitments();
  if (newDeposits > 0) {
    const proposed = await chain.maybeSubmitRoot(true); // Force submit on startup if pending
    if (proposed && operator.isEnabled) {
      await operator.confirmRoot();
      await chain.resyncProcessedIndex();
    }
  }
  await scanner.scan(config.fromBlock || undefined);
  if (operator.isEnabled) {
    // Rebuild operator secrets from persisted notes (recover after restart)
    operator.rebuildSecrets(scanner.getAllNotes());
    // Decrypt operator notes for any newly scanned notes
    for (const note of scanner.getAllNotes()) {
      operator.tryDecryptOperatorNote(note.encryptedNote, note.leafIndex);
    }
    await operator.scanWithdrawals(config.fromBlock || undefined, scanner.getAllNotes());
  }

  // --- Start HTTP API ---
  const apiDeps: ApiDeps = {
    tree,
    scanner,
    operator,
    provider: chain.provider,
    contract: chain.contract,
    fromBlock: config.fromBlock,
    lastProcessedIndex: () => chain.syncState.lastProcessedIndex,
    syncCommitments: () => chain.syncCommitments(),
    startTime,
    authToken: config.authToken,
  };

  const server = createApiServer(apiDeps);
  server.listen(config.port, () => {
    console.log(`[sequencer] HTTP API listening on http://localhost:${config.port}`);
    console.log(`[sequencer]   GET  /health`);
    console.log(`[sequencer]   GET  /root`);
    console.log(`[sequencer]   GET  /proof/:index`);
    console.log(`[sequencer]   GET  /proofs?from=0&to=10`);
    console.log(`[sequencer]   GET  /stats`);
    console.log(`[sequencer]   GET  /notes?from=0&to=100`);
    if (operator.isEnabled) {
      console.log(`[sequencer]   GET  /registration/root`);
      console.log(`[sequencer]   GET  /registration/proof/:npk`);
    }
    if (operator.isEnabled) {
      console.log(`[sequencer]   GET  /operator/withdrawals`);
      console.log(`[sequencer]   POST /operator/attest/:nullifier`);
      console.log(`[sequencer]   POST /operator/decrypt`);
    }
  });

  // --- Poll loop ---
  console.log(`[sequencer] Starting poll loop (${config.pollInterval}ms)...`);
  setInterval(async () => {
    try {
      // Confirm any pending root before proposing a new one
      if (operator.isEnabled) {
        const confirmResult = await operator.confirmRoot();
        if (confirmResult.success) {
          // Resync local state so submitRoot doesn't re-propose the same index
          await chain.resyncProcessedIndex();
        }
      }

      // Sync deposits
      const newCount = await chain.syncCommitments();
      await chain.maybeSubmitRoot();

      // Scan notes (with compliance logging for newly discovered notes)
      const noteCountBefore = scanner.noteCount;
      await scanner.scan();
      if (operator.isEnabled && scanner.noteCount > noteCountBefore) {
        const allNotes = scanner.getAllNotes();
        for (let i = noteCountBefore; i < allNotes.length; i++) {
          operator.tryDecryptOperatorNote(allNotes[i].encryptedNote, allNotes[i].leafIndex);
        }
      }

      // Scan withdrawals (pass notes for compliance verification)
      if (operator.isEnabled) {
        await operator.scanWithdrawals(undefined, scanner.getAllNotes());
      }
    } catch (err: any) {
      console.error(`[sequencer] Poll error: ${err.message}`);
    }
  }, config.pollInterval);

  // NOTE: Real-time event listeners (contract.on) removed.
  // Many RPC nodes (including CROSS Testnet) expire eth_newFilter subscriptions,
  // causing "filter not found" errors. The poll loop above handles all sync tasks.

  // --- Graceful shutdown ---
  const shutdown = () => {
    console.log("[sequencer] Shutting down...");
    chain.persistState();
    server.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[sequencer] Fatal error:", err);
  process.exit(1);
});
