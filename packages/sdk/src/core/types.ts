// ============================================================
// Domain Separators (must match circuit: circuits/src/main.nr)
// ============================================================

export const DOMAIN_COMMITMENT = 1n;
export const DOMAIN_NULLIFIER = 2n;
export const DOMAIN_MERKLE = 3n;
export const DOMAIN_COMPLIANCE = 4n;
export const DOMAIN_NPK = 5n;

export const TREE_DEPTH = 32;
export const REGISTRATION_DEPTH = 16;

// ============================================================
// Key Types
// ============================================================

export interface LatentKeys {
  nsk: bigint;
  npk: bigint;
  encPrivKey: Uint8Array;
  encPubKey: Uint8Array; // 33 bytes compressed secp256k1
}

// ============================================================
// Note Types
// ============================================================

export interface NoteData {
  secret: bigint;
  amount: bigint;
  blockNumber: bigint;
  depositor: bigint;
}

export interface EncryptedNote {
  ciphertext: Uint8Array;
  mac: Uint8Array; // 32 bytes HMAC-SHA256
  ephemeralPubKey: Uint8Array; // 33 bytes compressed
  viewTag: number;
}

export interface OperatorNote {
  ciphertext: Uint8Array; // 32 bytes (one Field)
  mac: Uint8Array; // 32 bytes HMAC-SHA256
  ephemeralPubKey: Uint8Array; // 33 bytes compressed
}

export interface OwnedNote {
  leafIndex: number;
  secret: bigint;
  amount: bigint;
  blockNumber: bigint;
  depositor: bigint;
  commitment: bigint;
  /** Block timestamp in milliseconds (populated by scanMyNotes). */
  timestamp?: number;
}

// ============================================================
// Sequencer API Types
// ============================================================

export interface StoredEncryptedNote {
  leafIndex: number;
  encryptedNote: string; // hex
  blockNumber: number;
  txHash: string;
  depositor?: string;
  timestamp?: number;
  amount?: string;
}

export interface MerkleProofResponse {
  root: string;
  leafIndex: number;
  commitment: string;
  siblings: string[];
  pathIndices: number[];
}

export interface RegistrationProofResponse {
  root: string;
  leafIndex: number;
  npk: string;
  siblings: string[];
  pathIndices: number[];
}

export interface RootInfo {
  root: string | null;
  leafCount: number;
  lastProcessedIndex: number;
}

export interface StatsResponse {
  treeDepth: number;
  totalLeaves: number;
  pendingDeposits: number;
  uptimeSeconds: number;
  noteCount: number;
  withdrawalCount: number;
}

// ============================================================
// History Types
// ============================================================

export interface HistoryDeposit {
  type: "deposit";
  leafIndex: number;
  amount: string | null;
  txHash: string;
  blockNumber: number;
  timestamp: number | null;
}

export interface HistoryWithdrawal {
  type: "withdrawal";
  nullifier: string;
  amount: string;
  status: string;
  txHash: string;
  blockNumber: number;
  timestamp: number | null;
}

export interface HistoryResponse {
  deposits: HistoryDeposit[];
  withdrawals: HistoryWithdrawal[];
  total: number;
}

// ============================================================
// Proof Types
// ============================================================

export interface ProofResult {
  proof: Uint8Array;
  publicInputs: string[];
}

export interface WithdrawalInputs {
  // Private inputs
  secret: bigint;
  nullifierSecretKey: bigint;
  nullifierPubKey: bigint;
  merkleSiblings: bigint[];
  pathIndices: number[];
  noteAmount: bigint;
  noteBlockNumber: bigint;
  noteDepositor: bigint;
  transferAmount: bigint;
  registrationSiblings: bigint[];
  registrationPathIndices: number[];
  // Public inputs
  expectedRoot: bigint;
  nullifier: bigint;
  amount: bigint;
  recipient: bigint;
  complianceHash: bigint;
  expectedRegistrationRoot: bigint;
}

// ============================================================
// Transaction Types
// ============================================================

export type DepositStage =
  | { step: "prepare"; message: string }
  | { step: "encrypt"; message: string }
  | { step: "approve"; message: string }
  | { step: "submit"; message: string }
  | { step: "confirm"; message: string };

export interface DepositParams {
  recipientNpk: bigint;
  recipientEncPubKey: Uint8Array;
  amount: bigint;
  onProgress?: (stage: DepositStage) => void;
}

export interface WithdrawParams {
  note: OwnedNote;
  amount: bigint;
  recipientAddress: string;
  onProgress?: (stage: ProofStage) => void;
}

export type ProofStage =
  | { step: "merkle"; message: string }
  | { step: "compute"; message: string }
  | { step: "witness"; message: string }
  | { step: "prove"; message: string }
  | { step: "submit"; message: string };

export interface DepositResult {
  txHash: string;
  leafIndex: number;
  commitment: bigint;
}

export interface WithdrawalResult {
  txHash: string;
  nullifier: bigint;
}

// ============================================================
// Conversion Helpers
// ============================================================

export function bigintToBytes32(value: bigint): Uint8Array {
  const hex = value.toString(16).padStart(64, "0");
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function bytes32ToBigint(bytes: Uint8Array): bigint {
  let hex = "0x";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return BigInt(hex);
}

export function addressToField(address: string): bigint {
  return BigInt(address);
}

export function fieldToAddress(field: bigint): string {
  return "0x" + (field & ((1n << 160n) - 1n)).toString(16).padStart(40, "0");
}

export function fieldToHex(field: bigint): string {
  return "0x" + field.toString(16).padStart(64, "0");
}

export function bytesToHex(bytes: Uint8Array): string {
  let hex = "0x";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

export function hexToBytes(hex: string): Uint8Array {
  const cleaned = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleaned.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
