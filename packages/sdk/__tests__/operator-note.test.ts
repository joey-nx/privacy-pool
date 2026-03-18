/**
 * Operator note ECIES encryption/decryption round-trip tests.
 *
 * The operator note carries a single Field (the note secret) encrypted
 * for the operator's secp256k1 key pair. These tests verify:
 * - Round-trip: encrypt → decrypt recovers the original secret
 * - MAC integrity: tampered ciphertext/mac is rejected
 * - Key isolation: wrong private key cannot decrypt
 */

import { describe, it, expect, beforeAll } from "vitest";
import { secp256k1 } from "@noble/curves/secp256k1";
import {
  initCrypto,
  encryptOperatorNote,
  decryptOperatorNote,
} from "../src/core/crypto.js";
import { bytes32ToBigint } from "../src/core/types.js";

const BN254_FR_ORDER =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

function randomSecret(): bigint {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytes32ToBigint(bytes) % BN254_FR_ORDER;
}

function generateOperatorKeyPair() {
  const privKey = secp256k1.utils.randomPrivateKey();
  const pubKey = secp256k1.getPublicKey(privKey, true); // 33 bytes compressed
  return { privKey, pubKey };
}

describe("Operator Note ECIES", () => {
  beforeAll(async () => {
    await initCrypto();
  }, 30_000);

  // ============================================================
  // Round-trip
  // ============================================================

  describe("round-trip", () => {
    it("should decrypt to the original secret", () => {
      const operator = generateOperatorKeyPair();
      const secret = randomSecret();

      const encrypted = encryptOperatorNote(operator.pubKey, secret);
      const decrypted = decryptOperatorNote(
        operator.privKey,
        encrypted.ciphertext,
        encrypted.ephemeralPubKey,
        encrypted.mac,
      );

      expect(decrypted).toBe(secret);
    });

    it("should work with secret = 0", () => {
      const operator = generateOperatorKeyPair();

      const encrypted = encryptOperatorNote(operator.pubKey, 0n);
      const decrypted = decryptOperatorNote(
        operator.privKey,
        encrypted.ciphertext,
        encrypted.ephemeralPubKey,
        encrypted.mac,
      );

      expect(decrypted).toBe(0n);
    });

    it("should work with secret = 1", () => {
      const operator = generateOperatorKeyPair();

      const encrypted = encryptOperatorNote(operator.pubKey, 1n);
      const decrypted = decryptOperatorNote(
        operator.privKey,
        encrypted.ciphertext,
        encrypted.ephemeralPubKey,
        encrypted.mac,
      );

      expect(decrypted).toBe(1n);
    });

    it("should work with a large secret near BN254 field order", () => {
      const operator = generateOperatorKeyPair();
      const secret = BN254_FR_ORDER - 1n;

      const encrypted = encryptOperatorNote(operator.pubKey, secret);
      const decrypted = decryptOperatorNote(
        operator.privKey,
        encrypted.ciphertext,
        encrypted.ephemeralPubKey,
        encrypted.mac,
      );

      expect(decrypted).toBe(secret);
    });

    it("should produce different ciphertexts for the same secret (random ephemeral key)", () => {
      const operator = generateOperatorKeyPair();
      const secret = randomSecret();

      const e1 = encryptOperatorNote(operator.pubKey, secret);
      const e2 = encryptOperatorNote(operator.pubKey, secret);

      // Different ephemeral keys → different ciphertexts
      expect(e1.ephemeralPubKey).not.toEqual(e2.ephemeralPubKey);
      expect(e1.ciphertext).not.toEqual(e2.ciphertext);

      // But both decrypt to the same secret
      const d1 = decryptOperatorNote(operator.privKey, e1.ciphertext, e1.ephemeralPubKey, e1.mac);
      const d2 = decryptOperatorNote(operator.privKey, e2.ciphertext, e2.ephemeralPubKey, e2.mac);
      expect(d1).toBe(secret);
      expect(d2).toBe(secret);
    });

    it("should round-trip multiple different secrets with the same key pair", () => {
      const operator = generateOperatorKeyPair();
      const secrets = Array.from({ length: 5 }, () => randomSecret());

      for (const secret of secrets) {
        const encrypted = encryptOperatorNote(operator.pubKey, secret);
        const decrypted = decryptOperatorNote(
          operator.privKey,
          encrypted.ciphertext,
          encrypted.ephemeralPubKey,
          encrypted.mac,
        );
        expect(decrypted).toBe(secret);
      }
    });
  });

  // ============================================================
  // Output format
  // ============================================================

  describe("output format", () => {
    it("should produce 32-byte ciphertext", () => {
      const operator = generateOperatorKeyPair();
      const encrypted = encryptOperatorNote(operator.pubKey, randomSecret());
      expect(encrypted.ciphertext.length).toBe(32);
    });

    it("should produce 32-byte MAC", () => {
      const operator = generateOperatorKeyPair();
      const encrypted = encryptOperatorNote(operator.pubKey, randomSecret());
      expect(encrypted.mac.length).toBe(32);
    });

    it("should produce 33-byte compressed ephemeral public key", () => {
      const operator = generateOperatorKeyPair();
      const encrypted = encryptOperatorNote(operator.pubKey, randomSecret());
      expect(encrypted.ephemeralPubKey.length).toBe(33);
      // Compressed pubkey prefix is 0x02 or 0x03
      expect([0x02, 0x03]).toContain(encrypted.ephemeralPubKey[0]);
    });
  });

  // ============================================================
  // MAC integrity
  // ============================================================

  describe("MAC integrity", () => {
    it("should reject tampered ciphertext", () => {
      const operator = generateOperatorKeyPair();
      const encrypted = encryptOperatorNote(operator.pubKey, randomSecret());

      const tampered = new Uint8Array(encrypted.ciphertext);
      tampered[0] ^= 0xff;

      expect(() =>
        decryptOperatorNote(operator.privKey, tampered, encrypted.ephemeralPubKey, encrypted.mac),
      ).toThrow("MAC verification failed");
    });

    it("should reject tampered MAC", () => {
      const operator = generateOperatorKeyPair();
      const encrypted = encryptOperatorNote(operator.pubKey, randomSecret());

      const tamperedMac = new Uint8Array(encrypted.mac);
      tamperedMac[0] ^= 0xff;

      expect(() =>
        decryptOperatorNote(operator.privKey, encrypted.ciphertext, encrypted.ephemeralPubKey, tamperedMac),
      ).toThrow("MAC verification failed");
    });

    it("should reject tampered ephemeral public key", () => {
      const operator = generateOperatorKeyPair();
      const encrypted = encryptOperatorNote(operator.pubKey, randomSecret());

      // Use a completely different ephemeral key
      const wrongEphKey = secp256k1.getPublicKey(secp256k1.utils.randomPrivateKey(), true);

      expect(() =>
        decryptOperatorNote(operator.privKey, encrypted.ciphertext, wrongEphKey, encrypted.mac),
      ).toThrow("MAC verification failed");
    });
  });

  // ============================================================
  // Key isolation
  // ============================================================

  describe("key isolation", () => {
    it("should fail with a different operator private key", () => {
      const operator = generateOperatorKeyPair();
      const wrongOperator = generateOperatorKeyPair();
      const encrypted = encryptOperatorNote(operator.pubKey, randomSecret());

      expect(() =>
        decryptOperatorNote(wrongOperator.privKey, encrypted.ciphertext, encrypted.ephemeralPubKey, encrypted.mac),
      ).toThrow("MAC verification failed");
    });

    it("should not leak the secret when decryption fails", () => {
      const operator = generateOperatorKeyPair();
      const wrongOperator = generateOperatorKeyPair();
      const secret = randomSecret();
      const encrypted = encryptOperatorNote(operator.pubKey, secret);

      // The error message must not contain the secret
      try {
        decryptOperatorNote(wrongOperator.privKey, encrypted.ciphertext, encrypted.ephemeralPubKey, encrypted.mac);
        expect.unreachable("should have thrown");
      } catch (e) {
        expect((e as Error).message).not.toContain(secret.toString());
      }
    });
  });
});
