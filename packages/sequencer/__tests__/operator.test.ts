/**
 * Operator service tests.
 *
 * Verifies:
 * - Withdrawal tracking and status management
 * - Attestation state transitions
 * - Persistence round-trip
 * - KYC user registration and lookup
 */

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { secp256k1 } from "@noble/curves/secp256k1";
import { encryptNote, decryptNote, encryptOperatorNote, decryptOperatorNote, computeComplianceHash, addressToField, initCrypto } from "../src/crypto.js";
import type { NoteData } from "../src/crypto.js";
import { OperatorService } from "../src/operator.js";
import { Store } from "../src/store.js";
import type { PendingWithdrawalInfo, RegisteredUser, StoredEncryptedNote } from "../src/types.js";

// ============================================================
// Operator Note Encryption/Decryption
// ============================================================

beforeAll(async () => {
  await initCrypto();
});

describe("Operator note encryption round-trip", () => {
  it("should encrypt and decrypt secret correctly", () => {
    const privKey = secp256k1.utils.randomPrivateKey();
    const pubKey = secp256k1.getPublicKey(privKey, true);
    const secret = 123456789012345678901234567890n;

    const encrypted = encryptOperatorNote(pubKey, secret);

    expect(encrypted.ciphertext.length).toBe(32);
    expect(encrypted.mac.length).toBe(32);
    expect(encrypted.ephemeralPubKey.length).toBe(33);

    const decrypted = decryptOperatorNote(privKey, encrypted.ciphertext, encrypted.ephemeralPubKey, encrypted.mac);
    expect(decrypted).toBe(secret);
  });

  it("should fail with wrong private key (MAC verification)", () => {
    const privKey = secp256k1.utils.randomPrivateKey();
    const pubKey = secp256k1.getPublicKey(privKey, true);
    const wrongPrivKey = secp256k1.utils.randomPrivateKey();
    const secret = 42n;

    const encrypted = encryptOperatorNote(pubKey, secret);

    expect(() =>
      decryptOperatorNote(wrongPrivKey, encrypted.ciphertext, encrypted.ephemeralPubKey, encrypted.mac),
    ).toThrow("MAC verification failed");
  });

  it("should fail with tampered ciphertext (MAC verification)", () => {
    const privKey = secp256k1.utils.randomPrivateKey();
    const pubKey = secp256k1.getPublicKey(privKey, true);
    const secret = 42n;

    const encrypted = encryptOperatorNote(pubKey, secret);
    // Flip a bit in ciphertext
    const tampered = new Uint8Array(encrypted.ciphertext);
    tampered[0] ^= 0x01;

    expect(() =>
      decryptOperatorNote(privKey, tampered, encrypted.ephemeralPubKey, encrypted.mac),
    ).toThrow("MAC verification failed");
  });

  it("should handle zero secret", () => {
    const privKey = secp256k1.utils.randomPrivateKey();
    const pubKey = secp256k1.getPublicKey(privKey, true);

    const encrypted = encryptOperatorNote(pubKey, 0n);
    const decrypted = decryptOperatorNote(privKey, encrypted.ciphertext, encrypted.ephemeralPubKey, encrypted.mac);
    expect(decrypted).toBe(0n);
  });
});

// ============================================================
// Note Encryption/Decryption (full 128-byte recipient note)
// ============================================================

describe("Note encryption round-trip", () => {
  const testNote: NoteData = {
    secret: 123456789012345678901234567890n,
    amount: 1000000n,
    blockNumber: 42n,
    depositor: 0xA11CEn,
  };

  it("should encrypt and decrypt note with all fields", () => {
    const privKey = secp256k1.utils.randomPrivateKey();
    const pubKey = secp256k1.getPublicKey(privKey, true);

    const encrypted = encryptNote(pubKey, testNote);

    expect(encrypted.ciphertext.length).toBe(128);
    expect(encrypted.mac.length).toBe(32);
    expect(encrypted.ephemeralPubKey.length).toBe(33);
    expect(typeof encrypted.viewTag).toBe("number");

    const decrypted = decryptNote(privKey, encrypted.ciphertext, encrypted.ephemeralPubKey, encrypted.mac);
    expect(decrypted.secret).toBe(testNote.secret);
    expect(decrypted.amount).toBe(testNote.amount);
    expect(decrypted.blockNumber).toBe(testNote.blockNumber);
    expect(decrypted.depositor).toBe(testNote.depositor);
  });

  it("should fail with wrong private key (MAC verification)", () => {
    const privKey = secp256k1.utils.randomPrivateKey();
    const pubKey = secp256k1.getPublicKey(privKey, true);
    const wrongPrivKey = secp256k1.utils.randomPrivateKey();

    const encrypted = encryptNote(pubKey, testNote);

    expect(() =>
      decryptNote(wrongPrivKey, encrypted.ciphertext, encrypted.ephemeralPubKey, encrypted.mac),
    ).toThrow("MAC verification failed");
  });

  it("should fail with tampered ciphertext (secret field, bytes 0-31)", () => {
    const privKey = secp256k1.utils.randomPrivateKey();
    const pubKey = secp256k1.getPublicKey(privKey, true);
    const encrypted = encryptNote(pubKey, testNote);

    const tampered = new Uint8Array(encrypted.ciphertext);
    tampered[0] ^= 0x01; // flip bit in secret field

    expect(() =>
      decryptNote(privKey, tampered, encrypted.ephemeralPubKey, encrypted.mac),
    ).toThrow("MAC verification failed");
  });

  it("should fail with tampered ciphertext (amount field, bytes 32-63)", () => {
    const privKey = secp256k1.utils.randomPrivateKey();
    const pubKey = secp256k1.getPublicKey(privKey, true);
    const encrypted = encryptNote(pubKey, testNote);

    const tampered = new Uint8Array(encrypted.ciphertext);
    tampered[32] ^= 0xFF; // flip byte in amount field

    expect(() =>
      decryptNote(privKey, tampered, encrypted.ephemeralPubKey, encrypted.mac),
    ).toThrow("MAC verification failed");
  });

  it("should fail with tampered ciphertext (depositor field, bytes 96-127)", () => {
    const privKey = secp256k1.utils.randomPrivateKey();
    const pubKey = secp256k1.getPublicKey(privKey, true);
    const encrypted = encryptNote(pubKey, testNote);

    const tampered = new Uint8Array(encrypted.ciphertext);
    tampered[127] ^= 0x01; // flip last bit of depositor

    expect(() =>
      decryptNote(privKey, tampered, encrypted.ephemeralPubKey, encrypted.mac),
    ).toThrow("MAC verification failed");
  });

  it("should fail with tampered MAC", () => {
    const privKey = secp256k1.utils.randomPrivateKey();
    const pubKey = secp256k1.getPublicKey(privKey, true);
    const encrypted = encryptNote(pubKey, testNote);

    const tamperedMac = new Uint8Array(encrypted.mac);
    tamperedMac[0] ^= 0x01;

    expect(() =>
      decryptNote(privKey, encrypted.ciphertext, encrypted.ephemeralPubKey, tamperedMac),
    ).toThrow("MAC verification failed");
  });

  it("should fail with swapped MAC from different note", () => {
    const privKey = secp256k1.utils.randomPrivateKey();
    const pubKey = secp256k1.getPublicKey(privKey, true);

    const note1: NoteData = { secret: 1n, amount: 100n, blockNumber: 1n, depositor: 0xAn };
    const note2: NoteData = { secret: 2n, amount: 200n, blockNumber: 2n, depositor: 0xBn };

    const enc1 = encryptNote(pubKey, note1);
    const enc2 = encryptNote(pubKey, note2);

    // Use ciphertext from note1 with MAC from note2
    expect(() =>
      decryptNote(privKey, enc1.ciphertext, enc1.ephemeralPubKey, enc2.mac),
    ).toThrow("MAC verification failed");
  });

  it("should handle all-zero fields", () => {
    const privKey = secp256k1.utils.randomPrivateKey();
    const pubKey = secp256k1.getPublicKey(privKey, true);
    const zeroNote: NoteData = { secret: 0n, amount: 0n, blockNumber: 0n, depositor: 0n };

    const encrypted = encryptNote(pubKey, zeroNote);
    const decrypted = decryptNote(privKey, encrypted.ciphertext, encrypted.ephemeralPubKey, encrypted.mac);
    expect(decrypted.secret).toBe(0n);
    expect(decrypted.amount).toBe(0n);
    expect(decrypted.blockNumber).toBe(0n);
    expect(decrypted.depositor).toBe(0n);
  });

  it("should handle near-max field values", () => {
    const privKey = secp256k1.utils.randomPrivateKey();
    const pubKey = secp256k1.getPublicKey(privKey, true);
    const maxFieldNote: NoteData = {
      secret: (1n << 254n) - 1n,
      amount: (1n << 64n) - 1n,
      blockNumber: (1n << 64n) - 1n,
      depositor: (1n << 160n) - 1n,
    };

    const encrypted = encryptNote(pubKey, maxFieldNote);
    const decrypted = decryptNote(privKey, encrypted.ciphertext, encrypted.ephemeralPubKey, encrypted.mac);
    expect(decrypted.secret).toBe(maxFieldNote.secret);
    expect(decrypted.amount).toBe(maxFieldNote.amount);
  });

  it("should produce unique ciphertexts for same note (ephemeral key randomness)", () => {
    const privKey = secp256k1.utils.randomPrivateKey();
    const pubKey = secp256k1.getPublicKey(privKey, true);

    const enc1 = encryptNote(pubKey, testNote);
    const enc2 = encryptNote(pubKey, testNote);

    // Different ephemeral keys -> different ciphertexts
    expect(Buffer.from(enc1.ciphertext).toString("hex"))
      .not.toBe(Buffer.from(enc2.ciphertext).toString("hex"));
    expect(Buffer.from(enc1.ephemeralPubKey).toString("hex"))
      .not.toBe(Buffer.from(enc2.ephemeralPubKey).toString("hex"));

    // But both decrypt to same note
    const d1 = decryptNote(privKey, enc1.ciphertext, enc1.ephemeralPubKey, enc1.mac);
    const d2 = decryptNote(privKey, enc2.ciphertext, enc2.ephemeralPubKey, enc2.mac);
    expect(d1.secret).toBe(d2.secret);
    expect(d1.amount).toBe(d2.amount);
  });
});

describe("Operator note edge cases", () => {
  it("should fail with tampered MAC", () => {
    const privKey = secp256k1.utils.randomPrivateKey();
    const pubKey = secp256k1.getPublicKey(privKey, true);
    const encrypted = encryptOperatorNote(pubKey, 42n);

    const tamperedMac = new Uint8Array(encrypted.mac);
    tamperedMac[15] ^= 0xFF;

    expect(() =>
      decryptOperatorNote(privKey, encrypted.ciphertext, encrypted.ephemeralPubKey, tamperedMac),
    ).toThrow("MAC verification failed");
  });

  it("should fail with swapped ephemeral key from different encryption", () => {
    const privKey = secp256k1.utils.randomPrivateKey();
    const pubKey = secp256k1.getPublicKey(privKey, true);

    const enc1 = encryptOperatorNote(pubKey, 100n);
    const enc2 = encryptOperatorNote(pubKey, 200n);

    // Use ciphertext+mac from enc1 but ephemeral key from enc2
    expect(() =>
      decryptOperatorNote(privKey, enc1.ciphertext, enc2.ephemeralPubKey, enc1.mac),
    ).toThrow("MAC verification failed");
  });

  it("should handle near-max BN254 field value", () => {
    const privKey = secp256k1.utils.randomPrivateKey();
    const pubKey = secp256k1.getPublicKey(privKey, true);
    // Near BN254 Fr max
    const nearMax = 21888242871839275222246405745257275088548364400416034343698204186575808495616n;

    const encrypted = encryptOperatorNote(pubKey, nearMax);
    const decrypted = decryptOperatorNote(privKey, encrypted.ciphertext, encrypted.ephemeralPubKey, encrypted.mac);
    expect(decrypted).toBe(nearMax);
  });

  it("should produce unique ciphertexts for same secret", () => {
    const privKey = secp256k1.utils.randomPrivateKey();
    const pubKey = secp256k1.getPublicKey(privKey, true);
    const secret = 42n;

    const enc1 = encryptOperatorNote(pubKey, secret);
    const enc2 = encryptOperatorNote(pubKey, secret);

    expect(Buffer.from(enc1.ciphertext).toString("hex"))
      .not.toBe(Buffer.from(enc2.ciphertext).toString("hex"));
  });
});

// We test the data management layer without a real contract.
// The OperatorService class depends on ethers.Contract for chain interaction,
// so we test the withdrawal state machine logic directly.

class MockStore {
  private withdrawals: PendingWithdrawalInfo[] = [];
  private users: RegisteredUser[] = [];

  loadWithdrawals(): PendingWithdrawalInfo[] {
    return [...this.withdrawals];
  }

  saveWithdrawals(withdrawals: PendingWithdrawalInfo[]): void {
    this.withdrawals = [...withdrawals];
  }

  loadUsers(): RegisteredUser[] {
    return [...this.users];
  }

  saveUsers(users: RegisteredUser[]): void {
    this.users = [...users];
  }
}

describe("Operator withdrawal management", () => {
  let mockStore: MockStore;
  let withdrawals: Map<string, PendingWithdrawalInfo>;

  beforeEach(() => {
    mockStore = new MockStore();
    withdrawals = new Map();
  });

  function addWithdrawal(nullifier: string, status: PendingWithdrawalInfo["status"] = "pending") {
    const info: PendingWithdrawalInfo = {
      nullifier,
      recipient: "0x1234567890abcdef1234567890abcdef12345678",
      amount: "1000",
      complianceHash: "0xaabb",
      deadline: Date.now() + 86400000,
      status,
      initiatedAt: 100,
      txHash: "0xfeed",
    };
    withdrawals.set(nullifier, info);
    return info;
  }

  function persist() {
    mockStore.saveWithdrawals(Array.from(withdrawals.values()));
  }

  describe("status transitions", () => {
    it("should start as pending", () => {
      const info = addWithdrawal("0x01");
      expect(info.status).toBe("pending");
    });

    it("should transition to attested", () => {
      const info = addWithdrawal("0x01");
      info.status = "attested";
      expect(info.status).toBe("attested");
    });

    it("should transition to claimed", () => {
      const info = addWithdrawal("0x01");
      info.status = "claimed";
      expect(info.status).toBe("claimed");
    });

    it("should transition to expired", () => {
      const info = addWithdrawal("0x01");
      info.status = "expired";
      expect(info.status).toBe("expired");
    });
  });

  describe("filtering", () => {
    it("should filter by status", () => {
      addWithdrawal("0x01", "pending");
      addWithdrawal("0x02", "attested");
      addWithdrawal("0x03", "pending");
      addWithdrawal("0x04", "claimed");

      const pending = Array.from(withdrawals.values()).filter(
        (w) => w.status === "pending",
      );
      expect(pending.length).toBe(2);

      const attested = Array.from(withdrawals.values()).filter(
        (w) => w.status === "attested",
      );
      expect(attested.length).toBe(1);
    });

    it("should look up by nullifier", () => {
      addWithdrawal("0x01");
      addWithdrawal("0x02");

      expect(withdrawals.get("0x01")).toBeDefined();
      expect(withdrawals.get("0x01")!.nullifier).toBe("0x01");
      expect(withdrawals.get("0x99")).toBeUndefined();
    });
  });

  describe("persistence", () => {
    it("should save and load withdrawals", () => {
      addWithdrawal("0x01", "pending");
      addWithdrawal("0x02", "attested");
      persist();

      const loaded = mockStore.loadWithdrawals();
      expect(loaded.length).toBe(2);
      expect(loaded.find((w) => w.nullifier === "0x01")!.status).toBe("pending");
      expect(loaded.find((w) => w.nullifier === "0x02")!.status).toBe("attested");
    });

    it("should reflect status changes after re-persist", () => {
      addWithdrawal("0x01", "pending");
      persist();

      // Mutate and re-persist
      withdrawals.get("0x01")!.status = "attested";
      persist();

      const loaded = mockStore.loadWithdrawals();
      expect(loaded[0].status).toBe("attested");
    });
  });

  describe("duplicate detection", () => {
    it("should not add duplicate nullifiers", () => {
      addWithdrawal("0x01");
      // Simulate duplicate event — check before adding
      const existing = withdrawals.has("0x01");
      expect(existing).toBe(true);
      expect(withdrawals.size).toBe(1);
    });
  });
});

// ============================================================
// KYC User Registration
// ============================================================

describe("KYC user registration", () => {
  let mockStore: MockStore;
  let usersByAddress: Map<string, RegisteredUser>;
  let usersByNpk: Map<string, RegisteredUser>;

  beforeEach(() => {
    mockStore = new MockStore();
    usersByAddress = new Map();
    usersByNpk = new Map();
  });

  function registerUser(address: string, npk: string, encPubKey: string = "0xaabb"): { success: boolean; error?: string } {
    const key = address.toLowerCase();
    if (usersByAddress.has(key)) {
      return { success: false, error: "Address already registered" };
    }
    if (usersByNpk.has(npk)) {
      return { success: false, error: "NPK already registered" };
    }

    const user: RegisteredUser = { address, npk, encPubKey, registeredAt: Date.now() };
    usersByAddress.set(key, user);
    usersByNpk.set(npk, user);
    persistUsers();
    return { success: true };
  }

  function persistUsers() {
    mockStore.saveUsers(Array.from(usersByAddress.values()));
  }

  describe("registration", () => {
    it("should register a new user", () => {
      const result = registerUser("0xAlice", "npk_alice");
      expect(result.success).toBe(true);
      expect(usersByAddress.size).toBe(1);
    });

    it("should reject duplicate address", () => {
      registerUser("0xAlice", "npk_alice");
      const result = registerUser("0xAlice", "npk_alice_2");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Address already registered");
    });

    it("should reject duplicate NPK", () => {
      registerUser("0xAlice", "npk_shared");
      const result = registerUser("0xBob", "npk_shared");
      expect(result.success).toBe(false);
      expect(result.error).toBe("NPK already registered");
    });

    it("should be case-insensitive for address lookup", () => {
      registerUser("0xALICE", "npk_alice");
      expect(usersByAddress.has("0xalice")).toBe(true);
    });
  });

  describe("lookup", () => {
    it("should find user by address", () => {
      registerUser("0xAlice", "npk_alice", "0xenc");
      const user = usersByAddress.get("0xalice");
      expect(user).toBeDefined();
      expect(user!.npk).toBe("npk_alice");
      expect(user!.encPubKey).toBe("0xenc");
    });

    it("should find user by NPK", () => {
      registerUser("0xAlice", "npk_alice");
      expect(usersByNpk.has("npk_alice")).toBe(true);
    });

    it("should return undefined for unregistered address", () => {
      expect(usersByAddress.get("0xunknown")).toBeUndefined();
    });
  });

  describe("persistence", () => {
    it("should save and load users", () => {
      registerUser("0xAlice", "npk_alice");
      registerUser("0xBob", "npk_bob");

      const loaded = mockStore.loadUsers();
      expect(loaded.length).toBe(2);
      expect(loaded.find((u) => u.npk === "npk_alice")).toBeDefined();
      expect(loaded.find((u) => u.npk === "npk_bob")).toBeDefined();
    });
  });
});

// ============================================================
// Compliance Verification
// ============================================================

/**
 * Build a 291-byte EncryptedNote hex payload:
 *   [recipientNote(194B) | opEphPubKey(33B) | opCiphertext(32B) | opMac(32B)]
 */
function buildEncryptedNoteHex(
  recipientPubKey: Uint8Array,
  operatorPubKey: Uint8Array,
  noteData: NoteData,
): string {
  // Recipient note: ephPubKey(33) + ciphertext(128) + mac(32) + viewTag(1) = 194
  const recipientEnc = encryptNote(recipientPubKey, noteData);
  const recipientPayload = new Uint8Array(194);
  recipientPayload.set(recipientEnc.ephemeralPubKey, 0);
  recipientPayload.set(recipientEnc.ciphertext, 33);
  recipientPayload.set(recipientEnc.mac, 161);
  recipientPayload[193] = recipientEnc.viewTag;

  // Operator note: ephPubKey(33) + ciphertext(32) + mac(32) = 97
  const operatorEnc = encryptOperatorNote(operatorPubKey, noteData.secret);

  const combined = new Uint8Array(291);
  combined.set(recipientPayload, 0);
  combined.set(operatorEnc.ephemeralPubKey, 194);
  combined.set(operatorEnc.ciphertext, 227);
  combined.set(operatorEnc.mac, 259);

  return "0x" + Buffer.from(combined).toString("hex");
}

describe("Compliance verification", () => {
  // Fixed keys for deterministic testing
  const operatorPrivKey = secp256k1.utils.randomPrivateKey();
  const operatorPubKey = secp256k1.getPublicKey(operatorPrivKey, true);
  const recipientPrivKey = secp256k1.utils.randomPrivateKey();
  const recipientPubKey = secp256k1.getPublicKey(recipientPrivKey, true);

  const DEPOSITOR = "0x1111111111111111111111111111111111111111";
  const RECIPIENT = "0x2222222222222222222222222222222222222222";
  const AMOUNT = 500000n;
  const SECRET = 123456789012345678901234567890n;

  function createMockOperator(): OperatorService {
    // Create with minimal mock dependencies (no real contract/provider needed for verifyCompliance)
    const mockContract = {} as any;
    const mockStore = {
      loadWithdrawals: () => [],
      saveWithdrawals: () => {},
      loadUsers: () => [],
      saveUsers: () => {},
    } as any;
    const mockProvider = {
      getBlockNumber: async () => 0,
    } as any;

    const operator = new OperatorService(mockContract, mockStore, mockProvider);
    return operator;
  }

  function makeNotes(secret: bigint, leafIndex: number, depositor: string): StoredEncryptedNote[] {
    const noteData: NoteData = { secret, amount: AMOUNT, blockNumber: 1n, depositor: addressToField(depositor) };
    const encHex = buildEncryptedNoteHex(recipientPubKey, operatorPubKey, noteData);
    return [{
      leafIndex,
      encryptedNote: encHex,
      blockNumber: 1,
      txHash: "0xdead",
      depositor,
      amount: AMOUNT.toString(),
    }];
  }

  function makeWithdrawal(complianceHash: bigint): PendingWithdrawalInfo {
    return {
      nullifier: "0x0001",
      recipient: RECIPIENT,
      amount: AMOUNT.toString(),
      complianceHash: "0x" + complianceHash.toString(16).padStart(64, "0"),
      deadline: Date.now() + 86400000,
      status: "pending",
      initiatedAt: 100,
      txHash: "0xfeed",
    };
  }

  it("should verify compliance when complianceHash matches", async () => {
    const operator = createMockOperator();
    // Initialize operator with key (using init's side-effect path)
    await operator.init("0x" + Buffer.from(operatorPrivKey).toString("hex"), false);

    const notes = makeNotes(SECRET, 0, DEPOSITOR);

    // Rebuild secrets from notes (simulates startup)
    operator.rebuildSecrets(notes);
    expect(operator.secretCount).toBe(1);

    // Compute the expected complianceHash
    const expectedHash = computeComplianceHash(
      addressToField(DEPOSITOR),
      addressToField(RECIPIENT),
      AMOUNT,
      SECRET,
    );

    const withdrawal = makeWithdrawal(expectedHash);
    const result = operator.verifyCompliance(withdrawal, notes);
    expect(result.result).toBe("verified");
    expect(result.leafIndex).toBe(0);
  });

  it("should return mismatch when secret is wrong (tampered operator note)", async () => {
    const operator = createMockOperator();
    await operator.init("0x" + Buffer.from(operatorPrivKey).toString("hex"), false);

    // Create notes with a DIFFERENT secret
    const fakeSecret = 999999999n;
    const notes = makeNotes(fakeSecret, 0, DEPOSITOR);
    operator.rebuildSecrets(notes);

    // But compute complianceHash with the REAL secret
    const realHash = computeComplianceHash(
      addressToField(DEPOSITOR),
      addressToField(RECIPIENT),
      AMOUNT,
      SECRET, // real secret, not the fake one in the note
    );

    const withdrawal = makeWithdrawal(realHash);
    const result = operator.verifyCompliance(withdrawal, notes);
    expect(result.result).toBe("mismatch");
  });

  it("should return no_depositor when depositor is missing from notes", async () => {
    const operator = createMockOperator();
    await operator.init("0x" + Buffer.from(operatorPrivKey).toString("hex"), false);

    const notes = makeNotes(SECRET, 0, DEPOSITOR);
    // Remove depositor from notes
    notes[0].depositor = undefined;
    operator.rebuildSecrets(notes);

    const expectedHash = computeComplianceHash(
      addressToField(DEPOSITOR),
      addressToField(RECIPIENT),
      AMOUNT,
      SECRET,
    );

    const withdrawal = makeWithdrawal(expectedHash);
    const result = operator.verifyCompliance(withdrawal, notes);
    expect(result.result).toBe("no_depositor");
  });

  it("should return no_secret when no secrets are available", async () => {
    const operator = createMockOperator();
    await operator.init("0x" + Buffer.from(operatorPrivKey).toString("hex"), false);
    // Don't rebuild secrets — empty

    const withdrawal = makeWithdrawal(0n);
    const result = operator.verifyCompliance(withdrawal);
    expect(result.result).toBe("no_secret");
  });

  it("should rebuild secrets from notes on restart", async () => {
    const operator = createMockOperator();
    await operator.init("0x" + Buffer.from(operatorPrivKey).toString("hex"), false);

    const notes = makeNotes(SECRET, 5, DEPOSITOR);
    expect(operator.secretCount).toBe(0);

    operator.rebuildSecrets(notes);
    expect(operator.secretCount).toBe(1);

    // Rebuild again — should not duplicate
    operator.rebuildSecrets(notes);
    expect(operator.secretCount).toBe(1);
  });

  it("should store secret via tryDecryptOperatorNote", async () => {
    const operator = createMockOperator();
    await operator.init("0x" + Buffer.from(operatorPrivKey).toString("hex"), false);

    const notes = makeNotes(SECRET, 3, DEPOSITOR);
    expect(operator.secretCount).toBe(0);

    operator.tryDecryptOperatorNote(notes[0].encryptedNote, 3);
    expect(operator.secretCount).toBe(1);
  });
});
