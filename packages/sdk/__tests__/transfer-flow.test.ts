/**
 * Transfer flow tests — maps 1:1 to specs/transfer-flow.md scenarios.
 *
 * Tests the full P2P transfer UX flow:
 * Payment link generation → parsing → deposit crypto → note scanning → balance
 *
 * Chain/prover interactions are out of scope (unit test boundary).
 */

import { describe, it, expect, beforeAll } from "vitest";
import { secp256k1 } from "@noble/curves/secp256k1";
import {
  initCrypto,
  computeNpk,
  computeCommitment,
  encryptNote,
} from "../src/core/crypto.js";
import { scanNotes, computeBalance } from "../src/core/notes.js";
import { LatentClient } from "../src/client.js";
import {
  type LatentKeys,
  type StoredEncryptedNote,
  bytesToHex,
  bytes32ToBigint,
} from "../src/core/types.js";

// BN254 scalar field order
const BN254_FR_ORDER =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

/**
 * Generate test Latent keys without MetaMask.
 * Requires initCrypto() for computeNpk (Poseidon2).
 */
function generateTestKeys(): LatentKeys {
  const nskBytes = new Uint8Array(32);
  crypto.getRandomValues(nskBytes);
  const nsk = bytes32ToBigint(nskBytes) % BN254_FR_ORDER;

  const encPrivKey = secp256k1.utils.randomPrivateKey();
  const encPubKey = secp256k1.getPublicKey(encPrivKey, true);
  const npk = computeNpk(nsk);

  return { nsk, npk, encPrivKey, encPubKey };
}

function randomSecret(): bigint {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytes32ToBigint(bytes) % BN254_FR_ORDER;
}

/**
 * Serialize EncryptedNote to hex string matching on-chain StoredEncryptedNote format.
 * Format: [ephPubKey(33B) | ciphertext(128B) | mac(32B) | viewTag(1B)] = 194B
 */
function serializeEncryptedNote(note: {
  ciphertext: Uint8Array;
  mac: Uint8Array;
  ephemeralPubKey: Uint8Array;
  viewTag: number;
}): string {
  const bytes = new Uint8Array(194);
  bytes.set(note.ephemeralPubKey, 0);
  bytes.set(note.ciphertext, 33);
  bytes.set(note.mac, 161);
  bytes[193] = note.viewTag;
  return bytesToHex(bytes);
}

describe("Transfer Flow", () => {
  beforeAll(async () => {
    await initCrypto();
  }, 30000);

  let bobKeys: LatentKeys;
  const aliceDepositor = BigInt("0x70997970C51812dc3A010C7d01b50e0d17dc79C8");

  beforeAll(() => {
    bobKeys = generateTestKeys();
  });

  // ============================================================
  // Scenario 1: Bob이 결제 링크를 생성하여 Alice에게 공유
  // ============================================================

  describe("결제 링크 생성 (Bob)", () => {
    it("should encode npk and encPubKey into URL", () => {
      const baseUrl = "https://app.latent.com/pay";
      const npk = bobKeys.npk.toString();
      const enc = bytesToHex(bobKeys.encPubKey);
      const url = `${baseUrl}?npk=${npk}&enc=${enc}`;

      expect(url).toContain(`npk=${npk}`);
      expect(url).toContain(`enc=${enc}`);
      expect(url.startsWith(baseUrl)).toBe(true);
    });

    it("should produce a parseable URL with both parameters", () => {
      const baseUrl = "https://app.latent.com/pay";
      const url = `${baseUrl}?npk=${bobKeys.npk.toString()}&enc=${bytesToHex(bobKeys.encPubKey)}`;

      const parsed = new URL(url);
      expect(parsed.searchParams.get("npk")).toBeTruthy();
      expect(parsed.searchParams.get("enc")).toBeTruthy();
    });
  });

  // ============================================================
  // Scenario 2: Alice가 결제 링크로 송금
  // ============================================================

  describe("결제 링크 파싱 + 입금 (Alice)", () => {
    it("should extract correct npk and encPubKey from payment link", () => {
      const url = `https://app.latent.com/pay?npk=${bobKeys.npk.toString()}&enc=${bytesToHex(bobKeys.encPubKey)}`;

      const parsed = LatentClient.parsePaymentLink(url);

      expect(parsed.recipientNpk).toBe(bobKeys.npk);
      expect(parsed.recipientEncPubKey).toEqual(bobKeys.encPubKey);
    });

    it("should handle encPubKey with and without 0x prefix", () => {
      const encHex = bytesToHex(bobKeys.encPubKey); // has 0x prefix
      const encNoPrefix = encHex.slice(2);

      const withPrefix = LatentClient.parsePaymentLink(
        `https://app.latent.com/pay?npk=${bobKeys.npk}&enc=${encHex}`,
      );
      const withoutPrefix = LatentClient.parsePaymentLink(
        `https://app.latent.com/pay?npk=${bobKeys.npk}&enc=${encNoPrefix}`,
      );

      expect(withPrefix.recipientEncPubKey).toEqual(withoutPrefix.recipientEncPubKey);
      expect(withPrefix.recipientEncPubKey).toEqual(bobKeys.encPubKey);
    });

    it("should produce valid commitment and encrypted note from parsed keys", () => {
      const url = `https://app.latent.com/pay?npk=${bobKeys.npk.toString()}&enc=${bytesToHex(bobKeys.encPubKey)}`;
      const { recipientNpk, recipientEncPubKey } = LatentClient.parsePaymentLink(url);

      const secret = randomSecret();
      const amount = 100_000000n;
      const blockNumber = 42n;

      const commitment = computeCommitment(
        secret,
        recipientNpk,
        amount,
        blockNumber,
        aliceDepositor,
      );

      const encrypted = encryptNote(recipientEncPubKey, {
        secret,
        amount,
        blockNumber,
        depositor: aliceDepositor,
      });

      expect(commitment).toBeTypeOf("bigint");
      expect(commitment).not.toBe(0n);
      expect(encrypted.ciphertext.length).toBe(128);
      expect(encrypted.mac.length).toBe(32);
      expect(encrypted.ephemeralPubKey.length).toBe(33);
    });
  });

  // ============================================================
  // Scenario 3: Bob이 수신된 노트를 스캔
  // ============================================================

  describe("수신 확인 (Bob scans notes)", () => {
    it("should find and decrypt note encrypted for Bob", () => {
      const secret = randomSecret();
      const amount = 100_000000n;
      const blockNumber = 42n;

      const encrypted = encryptNote(bobKeys.encPubKey, {
        secret,
        amount,
        blockNumber,
        depositor: aliceDepositor,
      });

      const storedNote: StoredEncryptedNote = {
        leafIndex: 0,
        encryptedNote: serializeEncryptedNote(encrypted),
        blockNumber: 42,
        txHash: "0xabc123",
      };

      const found = scanNotes([storedNote], bobKeys.encPrivKey, bobKeys.npk);

      expect(found.length).toBe(1);
      expect(found[0].secret).toBe(secret);
      expect(found[0].amount).toBe(amount);
      expect(found[0].blockNumber).toBe(blockNumber);
      expect(found[0].depositor).toBe(aliceDepositor);
      expect(found[0].leafIndex).toBe(0);
    });

    it("should verify commitment matches during scan", () => {
      const secret = randomSecret();
      const amount = 100_000000n;
      const blockNumber = 42n;

      const expectedCommitment = computeCommitment(
        secret,
        bobKeys.npk,
        amount,
        blockNumber,
        aliceDepositor,
      );

      const encrypted = encryptNote(bobKeys.encPubKey, {
        secret,
        amount,
        blockNumber,
        depositor: aliceDepositor,
      });

      const storedNote: StoredEncryptedNote = {
        leafIndex: 5,
        encryptedNote: serializeEncryptedNote(encrypted),
        blockNumber: 42,
        txHash: "0xdef",
      };

      const found = scanNotes([storedNote], bobKeys.encPrivKey, bobKeys.npk);

      expect(found.length).toBe(1);
      expect(found[0].commitment).toBe(expectedCommitment);
    });

    it("should compute correct balance from multiple notes", () => {
      const amounts = [50_000000n, 30_000000n, 20_000000n];
      const notes: StoredEncryptedNote[] = amounts.map((amount, i) => {
        const encrypted = encryptNote(bobKeys.encPubKey, {
          secret: randomSecret(),
          amount,
          blockNumber: BigInt(100 + i),
          depositor: aliceDepositor,
        });
        return {
          leafIndex: i,
          encryptedNote: serializeEncryptedNote(encrypted),
          blockNumber: 100 + i,
          txHash: `0x${i}`,
        };
      });

      const found = scanNotes(notes, bobKeys.encPrivKey, bobKeys.npk);
      const balance = computeBalance(found);

      expect(found.length).toBe(3);
      expect(balance).toBe(100_000000n);
    });

    it("should not find notes encrypted for a different recipient", () => {
      const otherKeys = generateTestKeys();

      const encrypted = encryptNote(otherKeys.encPubKey, {
        secret: randomSecret(),
        amount: 100_000000n,
        blockNumber: 42n,
        depositor: aliceDepositor,
      });

      const storedNote: StoredEncryptedNote = {
        leafIndex: 0,
        encryptedNote: serializeEncryptedNote(encrypted),
        blockNumber: 42,
        txHash: "0xabc",
      };

      const found = scanNotes([storedNote], bobKeys.encPrivKey, bobKeys.npk);
      expect(found.length).toBe(0);
    });

    it("should filter mixed notes and only return own", () => {
      const otherKeys = generateTestKeys();
      const bobSecret = randomSecret();

      const bobNote = encryptNote(bobKeys.encPubKey, {
        secret: bobSecret,
        amount: 200_000000n,
        blockNumber: 10n,
        depositor: aliceDepositor,
      });

      const otherNote = encryptNote(otherKeys.encPubKey, {
        secret: randomSecret(),
        amount: 500_000000n,
        blockNumber: 11n,
        depositor: aliceDepositor,
      });

      const notes: StoredEncryptedNote[] = [
        {
          leafIndex: 0,
          encryptedNote: serializeEncryptedNote(otherNote),
          blockNumber: 11,
          txHash: "0x0",
        },
        {
          leafIndex: 1,
          encryptedNote: serializeEncryptedNote(bobNote),
          blockNumber: 10,
          txHash: "0x1",
        },
      ];

      const found = scanNotes(notes, bobKeys.encPrivKey, bobKeys.npk);

      expect(found.length).toBe(1);
      expect(found[0].amount).toBe(200_000000n);
      expect(found[0].secret).toBe(bobSecret);
      expect(found[0].leafIndex).toBe(1);
    });
  });

  // ============================================================
  // Scenario 5: 결제 링크 파라미터 누락
  // ============================================================

  describe("경계값: 결제 링크 에러", () => {
    it("should throw on missing npk parameter", () => {
      expect(() =>
        LatentClient.parsePaymentLink("https://app.latent.com/pay?enc=0x02abc"),
      ).toThrow("Invalid payment link: missing npk or enc parameter");
    });

    it("should throw on missing enc parameter", () => {
      expect(() =>
        LatentClient.parsePaymentLink("https://app.latent.com/pay?npk=12345"),
      ).toThrow("Invalid payment link: missing npk or enc parameter");
    });

    it("should throw on empty URL (no parameters)", () => {
      expect(() =>
        LatentClient.parsePaymentLink("https://app.latent.com/pay"),
      ).toThrow("Invalid payment link: missing npk or enc parameter");
    });
  });

  // ============================================================
  // Scenario 9: 잘못된 encPubKey로 암호화
  // ============================================================

  describe("실패: 잘못된 encPubKey", () => {
    it("should not be scannable when encrypted with wrong key", () => {
      const wrongPubKey = secp256k1.getPublicKey(
        secp256k1.utils.randomPrivateKey(),
        true,
      );

      const encrypted = encryptNote(wrongPubKey, {
        secret: randomSecret(),
        amount: 100_000000n,
        blockNumber: 42n,
        depositor: aliceDepositor,
      });

      const storedNote: StoredEncryptedNote = {
        leafIndex: 0,
        encryptedNote: serializeEncryptedNote(encrypted),
        blockNumber: 42,
        txHash: "0xabc",
      };

      const found = scanNotes([storedNote], bobKeys.encPrivKey, bobKeys.npk);
      expect(found.length).toBe(0);
    });
  });

  // ============================================================
  // E2E: 결제 링크 → 입금 → 스캔 (전체 흐름, 체인 제외)
  // ============================================================

  describe("E2E: payment link → deposit crypto → scan", () => {
    it("should complete full transfer flow without chain", () => {
      // Phase 1: Bob generates payment link
      const baseUrl = "https://app.latent.com/pay";
      const paymentUrl = `${baseUrl}?npk=${bobKeys.npk.toString()}&enc=${bytesToHex(bobKeys.encPubKey)}`;

      // Phase 2: Alice parses the link (received via Telegram)
      const { recipientNpk, recipientEncPubKey } =
        LatentClient.parsePaymentLink(paymentUrl);

      // Phase 3: Alice creates deposit (crypto only — no chain)
      const secret = randomSecret();
      const amount = 250_000000n;
      const blockNumber = 1000n;

      const commitment = computeCommitment(
        secret,
        recipientNpk,
        amount,
        blockNumber,
        aliceDepositor,
      );

      const encrypted = encryptNote(recipientEncPubKey, {
        secret,
        amount,
        blockNumber,
        depositor: aliceDepositor,
      });

      // Simulate on-chain storage
      const storedNote: StoredEncryptedNote = {
        leafIndex: 7,
        encryptedNote: serializeEncryptedNote(encrypted),
        blockNumber: 1000,
        txHash: "0xdeadbeef",
      };

      // Phase 4: Bob scans and finds the note
      const found = scanNotes([storedNote], bobKeys.encPrivKey, bobKeys.npk);

      expect(found.length).toBe(1);
      expect(found[0].amount).toBe(250_000000n);
      expect(found[0].secret).toBe(secret);
      expect(found[0].commitment).toBe(commitment);
      expect(found[0].leafIndex).toBe(7);
      expect(found[0].blockNumber).toBe(blockNumber);
      expect(found[0].depositor).toBe(aliceDepositor);
    });
  });
});
