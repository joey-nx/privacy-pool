/**
 * MetaMask signature-based deterministic Latent key derivation.
 *
 * Flow: personal_sign(message) → keccak256(signature) → Latent keys
 * Same wallet always produces the same keys — no backup needed.
 */

import { type Signer, keccak256 as ethKeccak256 } from "ethers";
import { secp256k1 } from "@noble/curves/secp256k1";
import { computeNpk } from "./crypto.js";
import { type LatentKeys, hexToBytes, bytes32ToBigint } from "./types.js";

// BN254 scalar field order (Fr)
const BN254_FR_ORDER =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

const DERIVATION_MESSAGE = "StealthTx Key Derivation v1";

/**
 * Derive Latent keys from a MetaMask signer.
 *
 * The signer signs a deterministic message, and the resulting signature
 * is hashed to produce the Latent secret keys. This is a one-way derivation:
 * - Same wallet → same Latent keys (deterministic, no backup needed)
 * - Different wallet → different Latent keys (ECDSA private key differs)
 * - Third party → cannot derive (no access to private key)
 */
export async function deriveKeys(signer: Signer): Promise<LatentKeys> {
  // personal_sign produces EIP-191 signature
  const signature = await signer.signMessage(DERIVATION_MESSAGE);
  const sigBytes = hexToBytes(signature);

  // Derive nsk from keccak256(signature)
  const seed = hexToBytes(ethKeccak256(sigBytes));
  const nsk = bytes32ToBigint(seed) % BN254_FR_ORDER;

  // Derive encPrivKey from keccak256(seed ++ "enc")
  const encSeed = new Uint8Array(seed.length + 3);
  encSeed.set(seed, 0);
  encSeed.set(new TextEncoder().encode("enc"), seed.length);
  const encKeyBytes = hexToBytes(ethKeccak256(encSeed));

  // secp256k1 private key must be in [1, n-1]
  const n = secp256k1.CURVE.n;
  let encPrivKeyBigint = bytes32ToBigint(encKeyBytes) % n;
  if (encPrivKeyBigint === 0n) encPrivKeyBigint = 1n;
  const encPrivKeyHex = encPrivKeyBigint.toString(16).padStart(64, "0");
  const encPrivKey = hexToBytes(encPrivKeyHex);

  const encPubKey = secp256k1.getPublicKey(encPrivKey, true); // 33 bytes compressed
  const npk = computeNpk(nsk);

  return { nsk, npk, encPrivKey, encPubKey };
}

// ============================================================
// Persistent key cache (localStorage)
//
// Keys are deterministic (same wallet → same keys), so caching
// avoids repeated MetaMask signature prompts across sessions.
// ============================================================

const CACHE_PREFIX = "stealthtx_keys_v1_";

export function cacheKeys(address: string, keys: LatentKeys): void {
  if (typeof localStorage === "undefined") return;

  const data = {
    nsk: keys.nsk.toString(),
    npk: keys.npk.toString(),
    encPrivKey: Array.from(keys.encPrivKey),
    encPubKey: Array.from(keys.encPubKey),
  };
  localStorage.setItem(CACHE_PREFIX + address.toLowerCase(), JSON.stringify(data));
}

export function loadCachedKeys(address: string): LatentKeys | null {
  if (typeof localStorage === "undefined") return null;

  const raw = localStorage.getItem(CACHE_PREFIX + address.toLowerCase());
  if (!raw) return null;

  const data = JSON.parse(raw);
  return {
    nsk: BigInt(data.nsk),
    npk: BigInt(data.npk),
    encPrivKey: new Uint8Array(data.encPrivKey),
    encPubKey: new Uint8Array(data.encPubKey),
  };
}

export function clearCachedKeys(address: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(CACHE_PREFIX + address.toLowerCase());
}
