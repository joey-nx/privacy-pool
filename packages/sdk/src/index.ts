/**
 * @latent/sdk — Latent Privacy Pool SDK
 *
 * Client-side ZK proving with MetaMask integration.
 *
 * Usage:
 *   import { LatentClient } from '@latent/sdk'
 *
 *   const client = new LatentClient({ sequencerUrl, poolAddress, tokenAddress })
 *   await client.init()
 *   await client.connect()
 *   await client.deriveKeys()
 */

// Main facade
export { LatentClient, type LatentClientConfig } from "./client.js";

// Core modules (for advanced usage)
export {
  initCrypto,
  poseidon2Hash2,
  poseidon2Hash3,
  poseidon2Hash5,
  poseidon2Hash6,
  computeNpk,
  computeCommitment,
  computeNullifier,
  computeComplianceHash,
  poseidon2Merkle,
  encryptNote,
  decryptNote,
  computeViewTag,
  encryptOperatorNote,
  decryptOperatorNote,
} from "./core/crypto.js";

export {
  deriveKeys,
  cacheKeys,
  loadCachedKeys,
  clearCachedKeys,
} from "./core/keys.js";

export {
  scanNotes,
  tryDecryptNote,
  computeBalance,
} from "./core/notes.js";

// Proving
export { initWitness, generateWitness } from "./proving/witness.js";
export { initProver, generateProof, disposeProver } from "./proving/prover.js";

// Chain
export {
  connectWallet,
  getWalletState,
  onWalletChange,
  switchNetwork,
  detectProvider,
  type WalletState,
} from "./chain/wallet.js";

export {
  deposit,
  initiateWithdrawal,
  claimWithdrawal,
  getWithdrawalStatus,
  getTokenBalance,
} from "./chain/contracts.js";

// API
export { SequencerClient } from "./api/sequencer.js";

// Types
export type {
  LatentKeys,
  NoteData,
  EncryptedNote,
  OperatorNote,
  OwnedNote,
  StoredEncryptedNote,
  MerkleProofResponse,
  RootInfo,
  StatsResponse,
  ProofResult,
  WithdrawalInputs,
  DepositParams,
  DepositStage,
  WithdrawParams,
  DepositResult,
  WithdrawalResult,
  ProofStage,
  HistoryDeposit,
  HistoryWithdrawal,
  HistoryResponse,
} from "./core/types.js";

// Merkle tree
export {
  buildMerkleTree,
  generateSparseProof,
  type MerkleProof,
  type MerkleTree,
} from "./core/merkle.js";

// Utility
export {
  bigintToBytes32,
  bytes32ToBigint,
  addressToField,
  fieldToAddress,
  fieldToHex,
  bytesToHex,
  hexToBytes,
  DOMAIN_COMMITMENT,
  DOMAIN_NULLIFIER,
  DOMAIN_MERKLE,
  DOMAIN_COMPLIANCE,
  DOMAIN_NPK,
  TREE_DEPTH,
  REGISTRATION_DEPTH,
} from "./core/types.js";
