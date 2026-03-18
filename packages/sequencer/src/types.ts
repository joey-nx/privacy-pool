/**
 * Shared type definitions for the Latent Sequencer.
 */

// ============================================================
// Merkle Tree
// ============================================================

export interface MerkleProof {
  root: bigint;
  leafIndex: number;
  commitment: bigint;
  siblings: bigint[];
  pathIndices: number[];
}

// ============================================================
// Persistence
// ============================================================

export interface TreeState {
  leafCount: number;
  /** Map serialized as [key, value][] for JSON roundtrip */
  nodes: [string, string][];
}

export interface SyncState {
  lastSyncedBlock: number;
  lastProcessedIndex: number;
}

export interface PersistedState {
  tree: TreeState;
  sync: SyncState;
}

// ============================================================
// Note Scanner
// ============================================================

export interface StoredEncryptedNote {
  leafIndex: number;
  encryptedNote: string; // hex bytes
  blockNumber: number;
  txHash: string;
  depositor?: string; // tx.from address
  timestamp?: number; // block.timestamp * 1000 (ms)
  amount?: string; // Deposit event amount (bigint as string)
}

// ============================================================
// Operator
// ============================================================

export type WithdrawalStatus = "pending" | "attested" | "claimed" | "expired";

export interface PendingWithdrawalInfo {
  nullifier: string;
  recipient: string;
  amount: string; // bigint serialized as string
  complianceHash: string;
  deadline: number;
  status: WithdrawalStatus;
  initiatedAt: number;
  txHash: string;
  timestamp?: number; // block.timestamp * 1000 (ms)
}

export type ComplianceResult = "verified" | "mismatch" | "no_secret" | "no_depositor";

export interface ComplianceVerificationResult {
  result: ComplianceResult;
  leafIndex?: number; // matched deposit leaf index
}

// ============================================================
// KYC Registration
// ============================================================

export interface RegisteredUser {
  address: string; // Ethereum address (checksummed)
  npk: string; // Nullifier Public Key (bigint as string)
  encPubKey: string; // ECIES encryption public key (hex)
  registeredAt: number; // Unix timestamp (ms)
}

// ============================================================
// API
// ============================================================

export interface SequencerConfig {
  rpc: string;
  pool: string;
  relayerKey: string;
  operatorKey?: string;
  port: number;
  pollInterval: number;
  batchSize: number;
  batchTimeout: number;
  dataDir: string;
  confirmations: number;
  autoAttest: boolean;
  /** Block number to start scanning from (useful for deployed contracts). Default: 0 */
  fromBlock: number;
}
