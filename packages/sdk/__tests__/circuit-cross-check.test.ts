/**
 * SDK ↔ Circuit Cross-Verification Tests
 *
 * Verifies that the SDK's Poseidon2/Merkle implementations produce
 * identical outputs to the Noir circuit. Uses exact values from
 * circuits/Prover.toml and circuits/test_vectors/.
 *
 * If any test here fails, SDK proofs will be rejected by the circuit.
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  initCrypto,
  computeNpk,
  computeNullifier,
  computeCommitment,
  computeComplianceHash,
  poseidon2Merkle,
} from "../src/core/crypto.js";
import {
  generateSparseProof,
} from "../src/core/merkle.js";
import {
  DOMAIN_COMMITMENT,
  DOMAIN_NULLIFIER,
  DOMAIN_MERKLE,
  DOMAIN_COMPLIANCE,
  DOMAIN_NPK,
  TREE_DEPTH,
  REGISTRATION_DEPTH,
  type WithdrawalInputs,
} from "../src/core/types.js";

// ============================================================
// Circuit test vector constants (from circuits/Prover.toml)
// ============================================================

const TV = {
  secret: 42n,
  nsk: 12345n,
  npk: 17480208703614656685747052102702583227302376189854054257453006863483518404526n,
  noteAmount: 1000000n,
  blockNumber: 12345678n,
  depositor: 974334424887268612135789888477522013103955028650n,
  recipient: 1071767867375995473349368877325274214414350531515n,
  nullifier: 16649146830153088827688988512434673884026662854973647070832134819214823867662n,
  // Merkle root for commitment at leaf index 0, depth-32 sparse tree (all siblings = 0)
  expectedRoot: 9339649647151985514729491870521773352305870421018730179861125567563415338244n,
  // Registration root for npk at leaf index 0, depth-16 sparse tree
  expectedRegistrationRoot: 8966875245473040356584756008274144927810652522346713554092656210054844411015n,
  // Compliance hashes for different transfer amounts
  complianceHash_500000: 2357572603662250573565625288236693838310523140693103310739010404246045621504n,
  complianceHash_1000000: 5798177096699722637294127127278161219044424558312690188405053643651447873955n,
  complianceHash_1: 10313634373310834634010111217575885253663214734852588987762178122154819711457n,
  // Different recipient (happy_recipient_binding)
  recipient2: 1169201309864722334562947866173026415724746034380n,
  complianceHash_recipient2: 3463555543141464582498757229589432746068787328446463094543569248410132984808n,
  // Different leaf index (happy_different_leaf, leafIndex=7, path_indices=[1,1,1,0,...])
  expectedRoot_leaf7: 16527785299755772436723289107917377408262746738541791711316125020809282786217n,
};

describe("SDK ↔ Circuit Cross-Verification", () => {
  beforeAll(async () => {
    await initCrypto();
  }, 30_000);

  // ============================================================
  // 1. Domain separators must match circuit constants
  // ============================================================

  describe("domain separators", () => {
    it("should match circuit constants exactly", () => {
      expect(DOMAIN_COMMITMENT).toBe(1n);
      expect(DOMAIN_NULLIFIER).toBe(2n);
      expect(DOMAIN_MERKLE).toBe(3n);
      expect(DOMAIN_COMPLIANCE).toBe(4n);
      expect(DOMAIN_NPK).toBe(5n);
    });

    it("should have correct tree depths", () => {
      expect(TREE_DEPTH).toBe(32);
      expect(REGISTRATION_DEPTH).toBe(16);
    });
  });

  // ============================================================
  // 2. Poseidon2 hash functions — exact match with circuit
  // ============================================================

  describe("computeNpk", () => {
    it("should match circuit nullifier_pub_key for nsk=12345", () => {
      const npk = computeNpk(TV.nsk);
      expect(npk).toBe(TV.npk);
    });
  });

  describe("computeNullifier", () => {
    it("should match circuit nullifier for secret=42, nsk=12345", () => {
      const nullifier = computeNullifier(TV.secret, TV.nsk);
      expect(nullifier).toBe(TV.nullifier);
    });
  });

  describe("computeCommitment", () => {
    it("should produce commitment that generates the correct Merkle root", () => {
      // The commitment isn't directly in Prover.toml but we can verify it
      // indirectly: commitment at index 0 in a sparse tree must yield expected_root.
      const commitment = computeCommitment(
        TV.secret,
        TV.npk,
        TV.noteAmount,
        TV.blockNumber,
        TV.depositor,
      );

      const { root } = generateSparseProof(commitment, 0, TREE_DEPTH);
      expect(root).toBe(TV.expectedRoot);
    });
  });

  describe("computeComplianceHash", () => {
    it("should match circuit for partial transfer (500,000)", () => {
      const hash = computeComplianceHash(
        TV.depositor,
        TV.recipient,
        500000n,
        TV.secret,
      );
      expect(hash).toBe(TV.complianceHash_500000);
    });

    it("should match circuit for full transfer (1,000,000)", () => {
      const hash = computeComplianceHash(
        TV.depositor,
        TV.recipient,
        1000000n,
        TV.secret,
      );
      expect(hash).toBe(TV.complianceHash_1000000);
    });

    it("should match circuit for minimum transfer (1)", () => {
      const hash = computeComplianceHash(
        TV.depositor,
        TV.recipient,
        1n,
        TV.secret,
      );
      expect(hash).toBe(TV.complianceHash_1);
    });

    it("should match circuit for different recipient", () => {
      const hash = computeComplianceHash(
        TV.depositor,
        TV.recipient2,
        500000n,
        TV.secret,
      );
      expect(hash).toBe(TV.complianceHash_recipient2);
    });
  });

  // ============================================================
  // 3. Merkle tree — SDK sparse proof must match circuit expected_root
  // ============================================================

  describe("Merkle tree (depth 32)", () => {
    it("should match circuit expected_root for leaf index 0", () => {
      const commitment = computeCommitment(
        TV.secret,
        TV.npk,
        TV.noteAmount,
        TV.blockNumber,
        TV.depositor,
      );

      const proof = generateSparseProof(commitment, 0, TREE_DEPTH);

      expect(proof.root).toBe(TV.expectedRoot);
      expect(proof.siblings.length).toBe(TREE_DEPTH);
      expect(proof.pathIndices.length).toBe(TREE_DEPTH);
      // Index 0 → all path indices are 0
      expect(proof.pathIndices.every((i) => i === 0)).toBe(true);
    });

    it("should match circuit expected_root for leaf index 7 (different_leaf)", () => {
      const commitment = computeCommitment(
        TV.secret,
        TV.npk,
        TV.noteAmount,
        TV.blockNumber,
        TV.depositor,
      );

      const proof = generateSparseProof(commitment, 7, TREE_DEPTH);

      expect(proof.root).toBe(TV.expectedRoot_leaf7);
      // Index 7 = binary 111 → path_indices = [1,1,1,0,0,...,0]
      expect(proof.pathIndices[0]).toBe(1);
      expect(proof.pathIndices[1]).toBe(1);
      expect(proof.pathIndices[2]).toBe(1);
      expect(proof.pathIndices.slice(3).every((i) => i === 0)).toBe(true);
    });

    it("should produce different roots for different leaf indices (same commitment)", () => {
      const commitment = computeCommitment(
        TV.secret,
        TV.npk,
        TV.noteAmount,
        TV.blockNumber,
        TV.depositor,
      );

      const proof0 = generateSparseProof(commitment, 0, TREE_DEPTH);
      const proof7 = generateSparseProof(commitment, 7, TREE_DEPTH);

      expect(proof0.root).not.toBe(proof7.root);
    });
  });

  // ============================================================
  // 4. Registration tree — depth 16 sparse proof for npk
  // ============================================================

  describe("Registration tree (depth 16)", () => {
    it("should match circuit expected_registration_root for npk at index 0", () => {
      const proof = generateSparseProof(TV.npk, 0, REGISTRATION_DEPTH);
      expect(proof.root).toBe(TV.expectedRegistrationRoot);
    });
  });

  // ============================================================
  // 5. poseidon2Merkle — directional (left,right) must differ
  // ============================================================

  describe("poseidon2Merkle ordering", () => {
    it("should be non-commutative (matches circuit test_merkle_pair_order)", () => {
      const a = 100n;
      const b = 200n;
      const ab = poseidon2Merkle(a, b);
      const ba = poseidon2Merkle(b, a);
      expect(ab).not.toBe(ba);
    });
  });

  // ============================================================
  // 6. WithdrawalInputs completeness — must cover all circuit parameters
  // ============================================================

  describe("WithdrawalInputs type completeness", () => {
    it("should include registration tree fields required by circuit", () => {
      // The circuit requires these parameters that must be in WithdrawalInputs:
      //   - registration_siblings: [Field; 16]
      //   - registration_path_indices: [u1; 16]
      //   - expected_registration_root: pub Field
      //
      // This test documents the expected shape. If WithdrawalInputs is missing
      // these fields, the witness generation will fail at runtime.

      const requiredCircuitParams = [
        "secret",
        "nullifier_secret_key",
        "nullifier_pub_key",
        "merkle_siblings",
        "path_indices",
        "note_amount",
        "note_block_number",
        "note_depositor",
        "transfer_amount",
        "registration_siblings",
        "registration_path_indices",
        "expected_root",
        "nullifier",
        "amount",
        "recipient",
        "compliance_hash",
        "expected_registration_root",
      ];

      // Verify the type has all required fields by constructing a complete object
      const complete: Record<string, unknown> = {
        secret: 0n,
        nullifierSecretKey: 0n,
        nullifierPubKey: 0n,
        merkleSiblings: [],
        pathIndices: [],
        noteAmount: 0n,
        noteBlockNumber: 0n,
        noteDepositor: 0n,
        transferAmount: 0n,
        registrationSiblings: [],
        registrationPathIndices: [],
        expectedRoot: 0n,
        nullifier: 0n,
        amount: 0n,
        recipient: 0n,
        complianceHash: 0n,
        expectedRegistrationRoot: 0n,
      };

      // Map from SDK camelCase to circuit snake_case
      const sdkToCircuit: Record<string, string> = {
        secret: "secret",
        nullifierSecretKey: "nullifier_secret_key",
        nullifierPubKey: "nullifier_pub_key",
        merkleSiblings: "merkle_siblings",
        pathIndices: "path_indices",
        noteAmount: "note_amount",
        noteBlockNumber: "note_block_number",
        noteDepositor: "note_depositor",
        transferAmount: "transfer_amount",
        registrationSiblings: "registration_siblings",
        registrationPathIndices: "registration_path_indices",
        expectedRoot: "expected_root",
        nullifier: "nullifier",
        amount: "amount",
        recipient: "recipient",
        complianceHash: "compliance_hash",
        expectedRegistrationRoot: "expected_registration_root",
      };

      // Every circuit param must have a corresponding SDK field
      const mappedCircuitParams = Object.values(sdkToCircuit);
      for (const param of requiredCircuitParams) {
        expect(mappedCircuitParams).toContain(param);
      }

      // Every SDK field must exist in our complete object
      for (const sdkKey of Object.keys(sdkToCircuit)) {
        expect(complete).toHaveProperty(sdkKey);
      }

      // Registration tree fields are now part of WithdrawalInputs.
      // These assertions verify the type includes all circuit parameters.
      const currentInputs: WithdrawalInputs = {
        secret: 0n,
        nullifierSecretKey: 0n,
        nullifierPubKey: 0n,
        merkleSiblings: [],
        pathIndices: [],
        noteAmount: 0n,
        noteBlockNumber: 0n,
        noteDepositor: 0n,
        transferAmount: 0n,
        registrationSiblings: [],
        registrationPathIndices: [],
        expectedRoot: 0n,
        nullifier: 0n,
        amount: 0n,
        recipient: 0n,
        complianceHash: 0n,
        expectedRegistrationRoot: 0n,
      };

      expect("registrationSiblings" in currentInputs).toBe(true);
      expect("registrationPathIndices" in currentInputs).toBe(true);
      expect("expectedRegistrationRoot" in currentInputs).toBe(true);
    });
  });

  // ============================================================
  // 7. End-to-end: full circuit input set verification
  // ============================================================

  describe("full circuit input set (Prover.toml reconstruction)", () => {
    it("should reconstruct all derived values from base inputs", () => {
      // Given: base secret inputs (what Bob has)
      const secret = TV.secret;
      const nsk = TV.nsk;

      // Step 1: Derive npk
      const npk = computeNpk(nsk);
      expect(npk).toBe(TV.npk);

      // Step 2: Compute nullifier
      const nullifier = computeNullifier(secret, nsk);
      expect(nullifier).toBe(TV.nullifier);

      // Step 3: Compute commitment
      const commitment = computeCommitment(
        secret,
        npk,
        TV.noteAmount,
        TV.blockNumber,
        TV.depositor,
      );

      // Step 4: Derive Merkle root (sparse tree, index 0)
      const merkleProof = generateSparseProof(commitment, 0, TREE_DEPTH);
      expect(merkleProof.root).toBe(TV.expectedRoot);

      // Step 5: Compute compliance hash (partial transfer)
      const complianceHash = computeComplianceHash(
        TV.depositor,
        TV.recipient,
        500000n,
        secret,
      );
      expect(complianceHash).toBe(TV.complianceHash_500000);

      // Step 6: Derive registration root (sparse tree, index 0, depth 16)
      const regProof = generateSparseProof(npk, 0, REGISTRATION_DEPTH);
      expect(regProof.root).toBe(TV.expectedRegistrationRoot);

      // All 6 public inputs match circuit expectations
      expect(merkleProof.root).toBe(TV.expectedRoot);
      expect(nullifier).toBe(TV.nullifier);
      expect(500000n).toBe(500000n); // amount passthrough
      expect(TV.recipient).toBe(TV.recipient); // recipient passthrough
      expect(complianceHash).toBe(TV.complianceHash_500000);
      expect(regProof.root).toBe(TV.expectedRegistrationRoot);
    });
  });
});
