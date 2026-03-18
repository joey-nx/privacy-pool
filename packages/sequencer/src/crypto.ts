/**
 * Shared crypto helpers for Latent scripts (Poseidon2 + ECIES).
 *
 * All circuit-related hashing functions live here to avoid duplication.
 * Uses @aztec/bb.js BarretenbergSync for Poseidon2 (same backend as SDK).
 */

import { BarretenbergSync } from "@aztec/bb.js";
import { secp256k1 } from "@noble/curves/secp256k1";
import { hmac } from "@noble/hashes/hmac";
import { sha256 } from "@noble/hashes/sha2";
import { keccak256 as ethKeccak256, concat, getBytes } from "ethers";

// ============================================================
// Domain Separators (must match circuit)
// ============================================================

export const DOMAIN_COMMITMENT = 1n;
export const DOMAIN_NULLIFIER = 2n;
export const DOMAIN_MERKLE = 3n;
export const DOMAIN_COMPLIANCE = 4n;
export const DOMAIN_NPK = 5n;

export const TREE_DEPTH = 32;
export const REGISTRATION_DEPTH = 16;

// ============================================================
// Initialization (BarretenbergSync)
// ============================================================

let bb: BarretenbergSync | null = null;
let useMsgpackApi = false;

export async function initCrypto(): Promise<void> {
  if (bb) return;
  bb = await BarretenbergSync.initSingleton();
  useMsgpackApi = bb.poseidon2Permutation
    .toString()
    .includes("fromPoseidon2Permutation");
}

function getBb(): BarretenbergSync {
  if (!bb) throw new Error("Crypto not initialized. Call initCrypto() first.");
  return bb;
}

// ============================================================
// Poseidon2 Sponge Construction
//
// Matches the Noir circuit's manual sponge exactly:
//   t=4, rate=3, capacity=1
//   absorb into state[0..rate], permute when rate is full,
//   final permute for remaining, squeeze state[0].
// ============================================================

function poseidon2Permutation(state: bigint[]): bigint[] {
  const api = getBb() as any;
  if (useMsgpackApi) {
    const inputs = state.map((v) => bigintToBytes32(v));
    const { outputs } = api.poseidon2Permutation({ inputs });
    return outputs.map((buf: Uint8Array) => bytes32ToBigint(buf));
  }
  const inputs = state.map((v) => {
    const buf = bigintToBytes32(v);
    return { toBuffer: () => buf };
  });
  const outputs: any[] = api.poseidon2Permutation(inputs);
  return outputs.map((fr: any) => bytes32ToBigint(fr.toBuffer()));
}

// Sponge hash for 2 inputs: one partial absorb + squeeze
export function poseidon2Hash2(a: bigint, b: bigint): bigint {
  const state = [a, b, 0n, 0n];
  const result = poseidon2Permutation(state);
  return result[0];
}

// Sponge hash for 3 inputs: one full absorb
export function poseidon2Hash3(a: bigint, b: bigint, c: bigint): bigint {
  const state = [a, b, c, 0n];
  const result = poseidon2Permutation(state);
  return result[0];
}

// Sponge hash for 5 inputs: one full absorb + one partial absorb (2/3) + squeeze
export function poseidon2Hash5(
  a: bigint, b: bigint, c: bigint, d: bigint, e: bigint,
): bigint {
  let state = [a, b, c, 0n];
  state = poseidon2Permutation(state);
  state[0] += d;
  state[1] += e;
  state = poseidon2Permutation(state);
  return state[0];
}

// Sponge hash for 6 inputs: two full absorbs
export function poseidon2Hash6(
  a: bigint, b: bigint, c: bigint,
  d: bigint, e: bigint, f: bigint,
): bigint {
  let state = [a, b, c, 0n];
  state = poseidon2Permutation(state);
  state[0] += d;
  state[1] += e;
  state[2] += f;
  state = poseidon2Permutation(state);
  return state[0];
}

// ============================================================
// Circuit-matching Hash Functions
// ============================================================

export function computeNpk(nsk: bigint): bigint {
  return poseidon2Hash2(nsk, DOMAIN_NPK);
}

export function computeCommitment(
  secret: bigint,
  npk: bigint,
  amount: bigint,
  blockNumber: bigint,
  depositor: bigint,
): bigint {
  return poseidon2Hash6(
    secret, npk, amount, blockNumber, depositor, DOMAIN_COMMITMENT,
  );
}

export function computeNullifier(secret: bigint, nsk: bigint): bigint {
  return poseidon2Hash3(secret, nsk, DOMAIN_NULLIFIER);
}

export function computeComplianceHash(
  depositor: bigint,
  recipient: bigint,
  amount: bigint,
  secret: bigint,
): bigint {
  return poseidon2Hash5(depositor, recipient, amount, secret, DOMAIN_COMPLIANCE);
}

export function poseidon2Merkle(left: bigint, right: bigint): bigint {
  return poseidon2Hash3(left, right, DOMAIN_MERKLE);
}

// ============================================================
// Merkle Tree
// ============================================================

export interface MerkleProof {
  siblings: bigint[];
  pathIndices: number[];
}

export interface MerkleTree {
  root: bigint;
  leaves: bigint[];
  proofs: Map<number, MerkleProof>;
}

export function buildMerkleTree(leaves: bigint[], depth: number = TREE_DEPTH): MerkleTree {
  const numLeaves = leaves.length;
  const totalLeaves = 1 << depth; // 2^depth

  // Pad leaves with zeros
  const paddedLeaves = new Array(totalLeaves).fill(0n);
  for (let i = 0; i < numLeaves; i++) {
    paddedLeaves[i] = leaves[i];
  }

  // Build tree level by level
  const levels: bigint[][] = [paddedLeaves];
  let currentLevel = paddedLeaves;

  for (let d = 0; d < depth; d++) {
    const nextLevel: bigint[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      nextLevel.push(poseidon2Merkle(currentLevel[i], currentLevel[i + 1]));
    }
    levels.push(nextLevel);
    currentLevel = nextLevel;
  }

  const root = currentLevel[0];

  // Build proofs for each real leaf
  const proofs = new Map<number, MerkleProof>();
  for (let leafIdx = 0; leafIdx < numLeaves; leafIdx++) {
    const siblings: bigint[] = [];
    const pathIndices: number[] = [];
    let idx = leafIdx;

    for (let d = 0; d < depth; d++) {
      const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
      siblings.push(levels[d][siblingIdx]);
      pathIndices.push(idx % 2 === 0 ? 0 : 1);
      idx = Math.floor(idx / 2);
    }

    proofs.set(leafIdx, { siblings, pathIndices });
  }

  return { root, leaves: paddedLeaves, proofs };
}

// Generate Merkle proof for a single leaf in a sparse tree (most leaves = 0)
export function generateSparseProof(
  leaf: bigint,
  leafIndex: number,
  depth: number = TREE_DEPTH,
): { root: bigint; siblings: bigint[]; pathIndices: number[] } {
  const siblings: bigint[] = [];
  const pathIndices: number[] = [];
  let current = leaf;
  let idx = leafIndex;

  for (let level = 0; level < depth; level++) {
    const sibling = 0n;
    siblings.push(sibling);

    if (idx % 2 === 0) {
      pathIndices.push(0);
      current = poseidon2Merkle(current, sibling);
    } else {
      pathIndices.push(1);
      current = poseidon2Merkle(sibling, current);
    }
    idx = Math.floor(idx / 2);
  }

  return { root: current, siblings, pathIndices };
}

// ============================================================
// ECIES Note Encryption/Decryption
//
// Encrypts note data (secret, amount, blockNumber, depositor) with
// Bob's encryption public key using ECIES (secp256k1 + keccak256 KDF).
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
  ephemeralPubKey: Uint8Array;
  viewTag: number;
}

function bigintToBytes32(value: bigint): Uint8Array {
  const hex = value.toString(16).padStart(64, "0");
  return getBytes("0x" + hex);
}

function bytes32ToBigint(bytes: Uint8Array): bigint {
  return BigInt("0x" + Buffer.from(bytes).toString("hex"));
}

// Encode note data as 128 bytes: 4 * 32 bytes (bigint fields)
function encodeNoteData(note: NoteData): Uint8Array {
  const encoded = new Uint8Array(128);
  encoded.set(bigintToBytes32(note.secret), 0);
  encoded.set(bigintToBytes32(note.amount), 32);
  encoded.set(bigintToBytes32(note.blockNumber), 64);
  encoded.set(bigintToBytes32(note.depositor), 96);
  return encoded;
}

function decodeNoteData(encoded: Uint8Array): NoteData {
  return {
    secret: bytes32ToBigint(encoded.slice(0, 32)),
    amount: bytes32ToBigint(encoded.slice(32, 64)),
    blockNumber: bytes32ToBigint(encoded.slice(64, 96)),
    depositor: bytes32ToBigint(encoded.slice(96, 128)),
  };
}

// KDF: derive key material from ECDH shared secret
function deriveKeyMaterial(sharedSecret: Uint8Array, length: number): Uint8Array {
  const key = new Uint8Array(length);
  const chunks = Math.ceil(length / 32);
  for (let i = 0; i < chunks; i++) {
    const hashInput = concat([sharedSecret, new Uint8Array([i])]);
    const chunk = getBytes(ethKeccak256(hashInput));
    const offset = i * 32;
    const copyLen = Math.min(32, length - offset);
    key.set(chunk.slice(0, copyLen), offset);
  }
  return key;
}

export function encryptNote(
  recipientPubKey: Uint8Array,
  noteData: NoteData,
): EncryptedNote {
  const ephPrivKey = secp256k1.utils.randomPrivateKey();
  const ephPubKey = secp256k1.getPublicKey(ephPrivKey, true); // 33 bytes compressed

  // ECDH shared secret
  const sharedPoint = secp256k1.getSharedSecret(ephPrivKey, recipientPubKey);

  // View tag: first byte of keccak256(shared_secret)
  const sharedHash = getBytes(ethKeccak256(sharedPoint));
  const viewTag = sharedHash[0];

  // Key derivation: 128 bytes for encryption + 32 bytes for MAC
  const keyMaterial = deriveKeyMaterial(sharedPoint, 160);
  const encKey = keyMaterial.slice(0, 128);
  const macKey = keyMaterial.slice(128, 160);

  // XOR encrypt
  const plaintext = encodeNoteData(noteData);
  const ciphertext = new Uint8Array(128);
  for (let i = 0; i < 128; i++) {
    ciphertext[i] = plaintext[i] ^ encKey[i];
  }

  // HMAC-SHA256 authentication
  const mac = hmac(sha256, macKey, ciphertext);

  return { ciphertext, mac, ephemeralPubKey: ephPubKey, viewTag };
}

export function decryptNote(
  privKey: Uint8Array,
  ciphertext: Uint8Array,
  ephemeralPubKey: Uint8Array,
  mac: Uint8Array,
): NoteData {
  // ECDH shared secret
  const sharedPoint = secp256k1.getSharedSecret(privKey, ephemeralPubKey);

  // Key derivation: 128 bytes for encryption + 32 bytes for MAC
  const keyMaterial = deriveKeyMaterial(sharedPoint, 160);
  const encKey = keyMaterial.slice(0, 128);
  const macKey = keyMaterial.slice(128, 160);

  // Verify MAC before decryption
  const expectedMac = hmac(sha256, macKey, ciphertext);
  if (!constantTimeEqual(mac, expectedMac)) {
    throw new Error("ECIES: MAC verification failed");
  }

  // XOR decrypt
  const plaintext = new Uint8Array(128);
  for (let i = 0; i < 128; i++) {
    plaintext[i] = ciphertext[i] ^ encKey[i];
  }

  return decodeNoteData(plaintext);
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

export function computeViewTag(
  privKey: Uint8Array,
  pubKey: Uint8Array,
): number {
  const sharedPoint = secp256k1.getSharedSecret(privKey, pubKey);
  const sharedHash = getBytes(ethKeccak256(sharedPoint));
  return sharedHash[0];
}

// ============================================================
// Operator Note Encryption/Decryption
//
// Encrypts just the `secret` field for the operator, so they
// can verify compliance_hash without learning the full note.
// Uses the same ECIES scheme (secp256k1 ECDH + keccak256 KDF).
// ============================================================

export interface OperatorNote {
  ciphertext: Uint8Array; // 32 bytes (one Field)
  mac: Uint8Array; // 32 bytes HMAC-SHA256
  ephemeralPubKey: Uint8Array; // 33 bytes compressed
}

export function encryptOperatorNote(
  operatorPubKey: Uint8Array,
  secret: bigint,
): OperatorNote {
  const ephPrivKey = secp256k1.utils.randomSecretKey();
  const ephPubKey = secp256k1.getPublicKey(ephPrivKey, true);

  const sharedPoint = secp256k1.getSharedSecret(ephPrivKey, operatorPubKey);
  // 32 bytes for encryption + 32 bytes for MAC
  const keyMaterial = deriveKeyMaterial(sharedPoint, 64);
  const encKey = keyMaterial.slice(0, 32);
  const macKey = keyMaterial.slice(32, 64);

  const plaintext = bigintToBytes32(secret);
  const ciphertext = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    ciphertext[i] = plaintext[i] ^ encKey[i];
  }

  const mac = hmac(sha256, macKey, ciphertext);

  return { ciphertext, mac, ephemeralPubKey: ephPubKey };
}

export function decryptOperatorNote(
  privKey: Uint8Array,
  ciphertext: Uint8Array,
  ephemeralPubKey: Uint8Array,
  mac: Uint8Array,
): bigint {
  const sharedPoint = secp256k1.getSharedSecret(privKey, ephemeralPubKey);
  const keyMaterial = deriveKeyMaterial(sharedPoint, 64);
  const encKey = keyMaterial.slice(0, 32);
  const macKey = keyMaterial.slice(32, 64);

  // Verify MAC before decryption
  const expectedMac = hmac(sha256, macKey, ciphertext);
  if (!constantTimeEqual(mac, expectedMac)) {
    throw new Error("ECIES: Operator note MAC verification failed");
  }

  const plaintext = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    plaintext[i] = ciphertext[i] ^ encKey[i];
  }

  return bytes32ToBigint(plaintext);
}

// ============================================================
// Conversion Helpers
// ============================================================

export function addressToField(address: string): bigint {
  return BigInt(address);
}

export function fieldToAddress(field: bigint): string {
  return "0x" + (field & ((1n << 160n) - 1n)).toString(16).padStart(40, "0");
}

export function fieldToHex(field: bigint): string {
  return "0x" + field.toString(16).padStart(64, "0");
}

export function fieldToString(field: bigint): string {
  return `"${field.toString()}"`;
}
