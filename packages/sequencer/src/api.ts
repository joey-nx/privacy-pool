/**
 * HTTP API server for the Latent Sequencer.
 *
 * Endpoints:
 *   GET  /health                        - Health check
 *   GET  /root                          - Current root info
 *   GET  /proof/:leafIndex              - Merkle proof for a leaf
 *   GET  /proofs?from=0&to=10           - Batch proof query
 *   GET  /stats                         - Tree and sequencer statistics
 *   GET  /notes?from=0&to=100           - Encrypted notes range (raw data only)
 *   GET  /registration/root             - Current registration tree root
 *   GET  /registration/proof/:npk       - Registration Merkle proof for NPK
 *   POST /operator/register             - Register KYC'd user (auth required)
 *   GET  /operator/users                - List registered users (auth required)
 *   GET  /operator/withdrawals          - Pending withdrawals (auth required)
 *   GET  /operator/withdrawals/:nul     - Specific withdrawal (auth required)
 *   POST /operator/attest/:nullifier    - Manual attestation (auth required)
 *   POST /operator/decrypt              - Compliance decryption (auth required)
 *   GET  /history/:address              - Transaction history by address (public)
 */

import { createServer, IncomingMessage, ServerResponse, Server } from "http";
import { ethers } from "ethers";
import { IncrementalMerkleTree } from "./tree.js";
import { NoteScanner } from "./scanner.js";
import { OperatorService } from "./operator.js";

export interface ApiDeps {
  tree: IncrementalMerkleTree;
  scanner: NoteScanner;
  operator: OperatorService;
  provider: ethers.JsonRpcProvider;
  contract: ethers.Contract;
  fromBlock: number;
  lastProcessedIndex: () => number;
  syncCommitments: () => Promise<number>;
  startTime: number;
  authToken?: string;
}

export function createApiServer(deps: ApiDeps): Server {
  const { tree, scanner, operator } = deps;

  const server = createServer(async (req, res) => {
    // CORS headers for browser SDK access
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    // Handle preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      await handleRequest(req, res, deps);
    } catch (err: any) {
      console.error(`[api] Error: ${err.message}`);
      jsonResponse(res, 500, { error: "Internal server error" });
    }
  });

  return server;
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  deps: ApiDeps,
): Promise<void> {
  const { tree, scanner, operator } = deps;
  const urlObj = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const pathname = urlObj.pathname;
  const method = req.method ?? "GET";

  // --- Health ---
  if (pathname === "/health" && method === "GET") {
    jsonResponse(res, 200, { status: "ok", leafCount: tree.leafCount });
    return;
  }

  // --- Root ---
  if (pathname === "/root" && method === "GET") {
    jsonResponse(res, 200, {
      root: tree.leafCount > 0 ? tree.root.toString() : null,
      leafCount: tree.leafCount,
      lastProcessedIndex: deps.lastProcessedIndex(),
    });
    return;
  }

  // --- Stats ---
  if (pathname === "/stats" && method === "GET") {
    const uptimeMs = Date.now() - deps.startTime;
    jsonResponse(res, 200, {
      treeDepth: tree.depth,
      totalLeaves: tree.leafCount,
      pendingDeposits: tree.leafCount - deps.lastProcessedIndex(),
      uptimeSeconds: Math.floor(uptimeMs / 1000),
      noteCount: scanner.noteCount,
      withdrawalCount: operator.getWithdrawals().length,
    });
    return;
  }

  // --- Proof (single) ---
  const proofMatch = pathname.match(/^\/proof\/(\d+)$/);
  if (proofMatch && method === "GET") {
    const leafIndex = parseInt(proofMatch[1]);

    if (leafIndex >= tree.leafCount) {
      // On-demand sync: the leaf may exist on-chain but not yet in the local tree
      await deps.syncCommitments();
    }

    if (tree.leafCount === 0) {
      jsonResponse(res, 503, { error: "Tree not built yet" });
      return;
    }

    if (leafIndex >= tree.leafCount) {
      jsonResponse(res, 404, {
        error: `Leaf index ${leafIndex} out of range (max: ${tree.leafCount - 1})`,
      });
      return;
    }

    const proof = tree.getProof(leafIndex);
    jsonResponse(res, 200, {
      root: proof.root.toString(),
      leafIndex: proof.leafIndex,
      commitment: proof.commitment.toString(),
      siblings: proof.siblings.map((s) => s.toString()),
      pathIndices: proof.pathIndices,
    });
    return;
  }

  // --- Proofs (batch) ---
  if (pathname === "/proofs" && method === "GET") {
    const from = parseInt(urlObj.searchParams.get("from") ?? "0");
    const to = parseInt(urlObj.searchParams.get("to") ?? "0");

    if (tree.leafCount === 0) {
      jsonResponse(res, 503, { error: "Tree not built yet" });
      return;
    }

    const maxIdx = Math.min(to, tree.leafCount - 1);
    const proofs = [];
    for (let i = from; i <= maxIdx; i++) {
      const proof = tree.getProof(i);
      proofs.push({
        root: proof.root.toString(),
        leafIndex: proof.leafIndex,
        commitment: proof.commitment.toString(),
        siblings: proof.siblings.map((s) => s.toString()),
        pathIndices: proof.pathIndices,
      });
    }

    jsonResponse(res, 200, { proofs });
    return;
  }

  // --- Notes (range) ---
  // NOTE: /notes/scan (view tag filtering) endpoint was removed for privacy.
  // View tag filtering and ECIES decryption must happen client-side (SDK).
  // The server should never receive a user's viewing/encryption private key.
  if (pathname === "/notes" && method === "GET") {
    const from = parseInt(urlObj.searchParams.get("from") ?? "0");
    const to = parseInt(urlObj.searchParams.get("to") ?? "100");
    const notes = scanner.getNotes(from, to);
    jsonResponse(res, 200, { notes, count: notes.length });
    return;
  }

  // --- Registration (public, no auth — proofs are public data) ---

  // GET /registration/root
  if (pathname === "/registration/root" && method === "GET") {
    if (!operator.isEnabled) {
      jsonResponse(res, 503, { error: "Operator not configured" });
      return;
    }

    const info = operator.getRegistrationRoot();
    jsonResponse(res, 200, info);
    return;
  }

  // GET /registration/proof/:npk
  const regProofMatch = pathname.match(/^\/registration\/proof\/(\d+)$/);
  if (regProofMatch && method === "GET") {
    if (!operator.isEnabled) {
      jsonResponse(res, 503, { error: "Operator not configured" });
      return;
    }

    const npk = regProofMatch[1];
    const proof = operator.getRegistrationProof(npk);
    if (!proof) {
      jsonResponse(res, 404, { error: "NPK not registered" });
      return;
    }

    jsonResponse(res, 200, {
      root: proof.root.toString(),
      leafIndex: proof.leafIndex,
      npk,
      siblings: proof.siblings.map((s) => s.toString()),
      pathIndices: proof.pathIndices,
    });
    return;
  }

  // --- Operator public endpoint (no auth) ---

  // GET /operator/pubkey
  if (pathname === "/operator/pubkey" && method === "GET") {
    if (!operator.isEnabled) {
      jsonResponse(res, 503, { error: "Operator not configured" });
      return;
    }

    const encPubKey = operator.getEncPubKey();
    jsonResponse(res, 200, { encPubKey });
    return;
  }

  // --- Operator endpoints (auth required) ---

  // POST /operator/register
  // MVP: 인증 없이 자동 등록 허용 (KYC 미연동)
  // TODO: KYC 연동 시 checkAuth 복원
  if (pathname === "/operator/register" && method === "POST") {
    if (!operator.isEnabled) {
      jsonResponse(res, 503, { error: "Operator not configured" });
      return;
    }

    const body = await readBody(req);
    let parsed: { address: string; npk: string; encPubKey: string };
    try {
      parsed = JSON.parse(body);
    } catch {
      jsonResponse(res, 400, { error: "Invalid JSON body" });
      return;
    }

    if (!parsed.address || !parsed.npk || !parsed.encPubKey) {
      jsonResponse(res, 400, { error: "Missing address, npk, or encPubKey" });
      return;
    }

    const result = await operator.registerUser(parsed.address, parsed.npk, parsed.encPubKey);
    jsonResponse(res, result.success ? 200 : 409, result);
    return;
  }

  // GET /operator/users
  if (pathname === "/operator/users" && method === "GET") {
    if (!checkAuth(req, res, deps.authToken)) return;
    if (!operator.isEnabled) {
      jsonResponse(res, 503, { error: "Operator not configured" });
      return;
    }

    const users = operator.getUsers();
    jsonResponse(res, 200, { users, count: users.length });
    return;
  }

  // GET /operator/withdrawals
  if (pathname === "/operator/withdrawals" && method === "GET") {
    if (!checkAuth(req, res, deps.authToken)) return;
    if (!operator.isEnabled) {
      jsonResponse(res, 503, { error: "Operator not configured" });
      return;
    }

    const status = urlObj.searchParams.get("status");
    const withdrawals = status
      ? operator.getWithdrawalsByStatus(status as any)
      : operator.getWithdrawals();
    jsonResponse(res, 200, { withdrawals, count: withdrawals.length });
    return;
  }

  // GET /operator/withdrawals/:nullifier
  const withdrawalMatch = pathname.match(/^\/operator\/withdrawals\/(0x[0-9a-fA-F]+)$/);
  if (withdrawalMatch && method === "GET") {
    if (!checkAuth(req, res, deps.authToken)) return;
    if (!operator.isEnabled) {
      jsonResponse(res, 503, { error: "Operator not configured" });
      return;
    }

    const nullifier = withdrawalMatch[1];
    const withdrawal = operator.getWithdrawal(nullifier);
    if (!withdrawal) {
      jsonResponse(res, 404, { error: "Withdrawal not found" });
      return;
    }

    jsonResponse(res, 200, withdrawal);
    return;
  }

  // POST /operator/attest/:nullifier
  const attestMatch = pathname.match(/^\/operator\/attest\/(0x[0-9a-fA-F]+)$/);
  if (attestMatch && method === "POST") {
    if (!checkAuth(req, res, deps.authToken)) return;
    if (!operator.isEnabled) {
      jsonResponse(res, 503, { error: "Operator not configured" });
      return;
    }

    const nullifier = attestMatch[1];
    const result = await operator.attest(nullifier);
    jsonResponse(res, result.success ? 200 : 400, result);
    return;
  }

  // POST /operator/decrypt
  if (pathname === "/operator/decrypt" && method === "POST") {
    if (!checkAuth(req, res, deps.authToken)) return;
    if (!operator.isEnabled) {
      jsonResponse(res, 503, { error: "Operator not configured" });
      return;
    }

    const body = await readBody(req);
    let parsed: { ciphertext: string; ephemeralPubKey: string; mac: string };
    try {
      parsed = JSON.parse(body);
    } catch {
      jsonResponse(res, 400, { error: "Invalid JSON body" });
      return;
    }

    if (!parsed.ciphertext || !parsed.ephemeralPubKey || !parsed.mac) {
      jsonResponse(res, 400, { error: "Missing ciphertext, ephemeralPubKey, or mac" });
      return;
    }

    const result = operator.decryptCompliance(
      hexToBytes(parsed.ciphertext),
      hexToBytes(parsed.ephemeralPubKey),
      hexToBytes(parsed.mac),
    );

    if (!result) {
      jsonResponse(res, 400, { error: "Decryption failed" });
      return;
    }

    jsonResponse(res, 200, {
      depositor: result.depositor.toString(),
      amount: result.amount.toString(),
      blockNumber: result.blockNumber.toString(),
      secret: result.secret.toString(),
    });
    return;
  }

  // --- History (public, no auth) ---
  const historyMatch = pathname.match(/^\/history\/(0x[0-9a-fA-F]{40})$/);
  if (historyMatch && method === "GET") {
    const address = historyMatch[1].toLowerCase();

    // Deposits: query Deposit events from chain, filter by tx.from
    const deposits: {
      type: "deposit"; leafIndex: number; amount: string;
      txHash: string; blockNumber: number; timestamp: number | null;
    }[] = [];

    try {
      const depositFilter = deps.contract.filters.Deposit();
      const rawEvents = await deps.contract.queryFilter(depositFilter, deps.fromBlock || undefined);
      const depositEvents = rawEvents.filter(
        (e): e is ethers.EventLog => e instanceof ethers.EventLog,
      );

      // Batch-fetch tx.from for all deposit events, grouped by unique txHash
      const txHashSet = new Set(depositEvents.map((e) => e.transactionHash));
      const txFromMap = new Map<string, string>();
      await Promise.all(
        Array.from(txHashSet).map(async (hash) => {
          try {
            const tx = await deps.provider.getTransaction(hash);
            if (tx) txFromMap.set(hash, tx.from.toLowerCase());
          } catch { /* ignore */ }
        }),
      );

      // Deposit(bytes32 indexed commitment, uint256 indexed leafIndex, uint256 amount, uint256 timestamp)
      for (const event of depositEvents) {
        const from = txFromMap.get(event.transactionHash);
        if (from !== address) continue;
        deposits.push({
          type: "deposit",
          leafIndex: Number(event.args[1]),
          amount: (event.args[2] as bigint).toString(),
          txHash: event.transactionHash,
          blockNumber: event.blockNumber,
          timestamp: null,
        });
      }
    } catch (err: any) {
      console.error(`[api] History: failed to query Deposit events: ${err.message}`);
    }

    // Withdrawals: where this address is the recipient
    const allWithdrawals = operator.getWithdrawals();
    const withdrawals = allWithdrawals
      .filter((w) => w.recipient.toLowerCase() === address)
      .map((w) => ({
        type: "withdrawal" as const,
        nullifier: w.nullifier,
        amount: w.amount,
        status: w.status,
        txHash: w.txHash,
        blockNumber: w.initiatedAt,
        timestamp: w.timestamp ?? null,
      }));

    // Backfill missing timestamps from block data
    const allEntries = [...deposits, ...withdrawals];
    const missingBlocks = new Set<number>();
    for (const entry of allEntries) {
      if (entry.timestamp === null && entry.blockNumber > 0) {
        missingBlocks.add(entry.blockNumber);
      }
    }
    if (missingBlocks.size > 0) {
      const blockTimestamps = new Map<number, number>();
      await Promise.all(
        Array.from(missingBlocks).map(async (bn) => {
          try {
            const block = await deps.provider.getBlock(bn);
            if (block) blockTimestamps.set(bn, block.timestamp * 1000);
          } catch { /* ignore */ }
        }),
      );
      for (const entry of allEntries) {
        if (entry.timestamp === null) {
          entry.timestamp = blockTimestamps.get(entry.blockNumber) ?? null;
        }
      }
    }

    jsonResponse(res, 200, {
      deposits,
      withdrawals,
      total: deposits.length + withdrawals.length,
    });
    return;
  }

  // --- 404 ---
  jsonResponse(res, 404, { error: "Not found" });
}

// ============================================================
// Helpers
// ============================================================

function jsonResponse(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function checkAuth(req: IncomingMessage, res: ServerResponse, token?: string): boolean {
  if (!token) return true; // No auth configured

  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${token}`) {
    jsonResponse(res, 401, { error: "Unauthorized" });
    return false;
  }
  return true;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

function hexToBytes(hex: string): Uint8Array {
  const cleaned = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleaned.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
