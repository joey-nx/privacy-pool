/**
 * Browser-compatible Poseidon2 + ECIES crypto module.
 *
 * Ports scripts/lib/crypto.ts from @aztec/foundation (Node-only)
 * to @aztec/bb.js BarretenbergSync (browser WASM).
 *
 * All hash functions produce identical outputs to the Node version.
 */

import { BarretenbergSync } from "@aztec/bb.js";
import { secp256k1 } from "@noble/curves/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3";
import { hmac } from "@noble/hashes/hmac";
import { sha256 } from "@noble/hashes/sha256";

import {
  DOMAIN_COMMITMENT,
  DOMAIN_NULLIFIER,
  DOMAIN_MERKLE,
  DOMAIN_COMPLIANCE,
  DOMAIN_NPK,
  bigintToBytes32,
  bytes32ToBigint,
  type NoteData,
  type EncryptedNote,
  type OperatorNote,
} from "./types.js";

// ============================================================
// Initialization
// ============================================================

let bb: BarretenbergSync | null = null;
// true = cbind/msgpack API (bb.js ≥3.x): poseidon2Permutation({ inputs: Uint8Array[] })
// false = barretenberg_api (bb.js 2.x): poseidon2Permutation(Fr[]) where Fr has toBuffer()
let useMsgpackApi = false;

export async function initCrypto(): Promise<void> {
  if (bb) return;
  bb = await BarretenbergSync.initSingleton();
  // Detect which runtime API is active by inspecting the method source.
  // cbind API references 'fromPoseidon2Permutation'; barretenberg_api uses 'serializeBufferable'.
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
    // bb.js ≥3.x cbind API: { inputs: Uint8Array[] } → { outputs: Uint8Array[] }
    const inputs = state.map((v) => bigintToBytes32(v));
    const { outputs } = api.poseidon2Permutation({ inputs });
    return outputs.map((buf: Uint8Array) => bytes32ToBigint(buf));
  }
  // bb.js 2.x barretenberg_api: Fr[] → Fr[]
  // Fr-like objects with toBuffer() satisfy serializeBufferable()
  const inputs = state.map((v) => {
    const buf = bigintToBytes32(v);
    return { toBuffer: () => buf };
  });
  const outputs: any[] = api.poseidon2Permutation(inputs);
  return outputs.map((fr: any) => bytes32ToBigint(fr.toBuffer()));
}

export function poseidon2Hash2(a: bigint, b: bigint): bigint {
  const state = [a, b, 0n, 0n];
  const result = poseidon2Permutation(state);
  return result[0];
}

export function poseidon2Hash3(a: bigint, b: bigint, c: bigint): bigint {
  const state = [a, b, c, 0n];
  const result = poseidon2Permutation(state);
  return result[0];
}

export function poseidon2Hash5(
  a: bigint,
  b: bigint,
  c: bigint,
  d: bigint,
  e: bigint,
): bigint {
  let state = [a, b, c, 0n];
  state = poseidon2Permutation(state);
  state[0] += d;
  state[1] += e;
  state = poseidon2Permutation(state);
  return state[0];
}

export function poseidon2Hash6(
  a: bigint,
  b: bigint,
  c: bigint,
  d: bigint,
  e: bigint,
  f: bigint,
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
    secret,
    npk,
    amount,
    blockNumber,
    depositor,
    DOMAIN_COMMITMENT,
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
// ECIES Note Encryption/Decryption
// ============================================================

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

function keccak256(data: Uint8Array): Uint8Array {
  return keccak_256(data);
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLen = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

function deriveKeyMaterial(
  sharedSecret: Uint8Array,
  length: number,
): Uint8Array {
  const key = new Uint8Array(length);
  const chunks = Math.ceil(length / 32);
  for (let i = 0; i < chunks; i++) {
    const chunk = keccak256(concatBytes(sharedSecret, new Uint8Array([i])));
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
  // ECDH 
  const ephPrivKey = secp256k1.utils.randomSecretKey();
  const ephPubKey = secp256k1.getPublicKey(ephPrivKey, true);

  const sharedPoint = secp256k1.getSharedSecret(ephPrivKey, recipientPubKey);
  const sharedHash = keccak256(sharedPoint);
  const viewTag = sharedHash[0];

  // 128 bytes for encryption + 32 bytes for MAC
  const keyMaterial = deriveKeyMaterial(sharedPoint, 160);
  const encKey = keyMaterial.slice(0, 128);
  const macKey = keyMaterial.slice(128, 160);

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
  const sharedPoint = secp256k1.getSharedSecret(privKey, ephemeralPubKey);

  // 128 bytes for encryption + 32 bytes for MAC
  const keyMaterial = deriveKeyMaterial(sharedPoint, 160);
  const encKey = keyMaterial.slice(0, 128);
  const macKey = keyMaterial.slice(128, 160);

  // Verify MAC before decryption
  const expectedMac = hmac(sha256, macKey, ciphertext);
  if (!constantTimeEqual(mac, expectedMac)) {
    throw new Error("ECIES: MAC verification failed");
  }

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
  const sharedHash = keccak256(sharedPoint);
  return sharedHash[0];
}

// ============================================================
// Operator Note Encryption/Decryption
// ============================================================

export function encryptOperatorNote(
  operatorPubKey: Uint8Array,
  secret: bigint,
): OperatorNote {
  const ephPrivKey = secp256k1.utils.randomPrivateKey();
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
