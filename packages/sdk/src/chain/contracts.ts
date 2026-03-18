/**
 * PrivacyPoolV2 + ERC20 contract interaction layer.
 *
 * Provides typed functions for deposit, withdrawal, and read operations.
 * All write operations go through the user's MetaMask signer.
 */

import { Contract, type Signer, type Provider } from "ethers";
import { POOL_ABI, ERC20_ABI } from "./abi.js";
import {
  fieldToHex,
  bytesToHex,
  type EncryptedNote,
  type OperatorNote,
} from "../core/types.js";

// ============================================================
// Contract Instances
// ============================================================

export function getPoolContract(
  address: string,
  signerOrProvider: Signer | Provider,
): Contract {
  return new Contract(address, POOL_ABI, signerOrProvider);
}

export function getTokenContract(
  address: string,
  signerOrProvider: Signer | Provider,
): Contract {
  return new Contract(address, ERC20_ABI, signerOrProvider);
}

// ============================================================
// Write Operations
// ============================================================

/**
 * Approve + Deposit tokens into the privacy pool.
 *
 * Handles ERC20 approval if needed, then calls deposit().
 */
export async function deposit(
  signer: Signer,
  poolAddress: string,
  tokenAddress: string,
  commitment: bigint,
  amount: bigint,
  encryptedNote: EncryptedNote,
  operatorNote?: OperatorNote,
  onProgress?: (stage: "submit" | "confirm") => void,
): Promise<{ txHash: string; leafIndex: number }> {
  const pool = getPoolContract(poolAddress, signer);
  const token = getTokenContract(tokenAddress, signer);
  const userAddress = await signer.getAddress();

  // Check and approve allowance
  const allowance: bigint = await token.allowance(userAddress, poolAddress);
  if (allowance < amount) {
    const approveTx = await token.approve(poolAddress, amount);
    await approveTx.wait();
  }

  // Encode encrypted note: [ephPubKey(33B) | ciphertext(128B) | mac(32B) | viewTag(1B)] = 194B
  // With operator note: [recipientNote(194B) | opEphPubKey(33B) | opCiphertext(32B) | opMac(32B)] = 291B
  const recipientNoteLen = 194;
  const operatorNoteLen = 97; // 33 + 32 + 32
  const totalLen = operatorNote ? recipientNoteLen + operatorNoteLen : recipientNoteLen;
  const noteBytes = new Uint8Array(totalLen);
  noteBytes.set(encryptedNote.ephemeralPubKey, 0);   // 0..33
  noteBytes.set(encryptedNote.ciphertext, 33);        // 33..161
  noteBytes.set(encryptedNote.mac, 161);              // 161..193
  noteBytes[193] = encryptedNote.viewTag;             // 193

  if (operatorNote) {
    noteBytes.set(operatorNote.ephemeralPubKey, 194); // 194..227
    noteBytes.set(operatorNote.ciphertext, 227);      // 227..259
    noteBytes.set(operatorNote.mac, 259);             // 259..291
  }

  onProgress?.("submit");

  const tx = await pool.deposit(
    fieldToHex(commitment),
    amount,
    bytesToHex(noteBytes),
  );

  onProgress?.("confirm");
  const receipt = await tx.wait();

  // Extract leafIndex from Deposit event
  const depositLog = receipt.logs.find(
    (log: { topics: string[] }) =>
      log.topics[0] === pool.interface.getEvent("Deposit")!.topicHash,
  );
  const parsed = pool.interface.parseLog({
    topics: depositLog.topics,
    data: depositLog.data,
  });
  const leafIndex = Number(parsed!.args.leafIndex);

  return { txHash: receipt.hash, leafIndex };
}

/**
 * Initiate a withdrawal with a ZK proof (Stage 1).
 */
export async function initiateWithdrawal(
  signer: Signer,
  poolAddress: string,
  proof: Uint8Array,
  publicInputs: string[],
): Promise<{ txHash: string }> {
  const pool = getPoolContract(poolAddress, signer);

  // publicInputs are already hex-encoded field elements from the prover
  const tx = await pool.initiateWithdrawal(
    bytesToHex(proof),
    publicInputs,
  );
  const receipt = await tx.wait();

  return { txHash: receipt.hash };
}

/**
 * Claim a withdrawal after the attestation window expires (Stage 2b).
 */
export async function claimWithdrawal(
  signer: Signer,
  poolAddress: string,
  nullifier: string,
): Promise<{ txHash: string }> {
  const pool = getPoolContract(poolAddress, signer);
  const tx = await pool.claimWithdrawal(nullifier);
  const receipt = await tx.wait();
  return { txHash: receipt.hash };
}

// ============================================================
// Read Operations
// ============================================================

export interface PendingWithdrawal {
  recipient: string;
  amount: bigint;
  complianceHash: string;
  deadline: number;
  completed: boolean;
}

export async function getWithdrawalStatus(
  provider: Provider,
  poolAddress: string,
  nullifier: string,
): Promise<PendingWithdrawal | null> {
  const pool = getPoolContract(poolAddress, provider);
  const pw = await pool.pendingWithdrawals(nullifier);

  if (pw.recipient === "0x0000000000000000000000000000000000000000") {
    return null;
  }

  return {
    recipient: pw.recipient,
    amount: pw.amount,
    complianceHash: pw.complianceHash,
    deadline: Number(pw.deadline),
    completed: pw.completed,
  };
}

export async function getTokenBalance(
  provider: Provider,
  tokenAddress: string,
  account: string,
): Promise<bigint> {
  const token = getTokenContract(tokenAddress, provider);
  return token.balanceOf(account);
}
