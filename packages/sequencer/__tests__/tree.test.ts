/**
 * IncrementalMerkleTree correctness tests.
 *
 * Verifies that the incremental tree produces identical roots and proofs
 * to the naive buildMerkleTree() at depth 10.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { IncrementalMerkleTree } from "../src/tree.js";
import { buildMerkleTree, poseidon2Merkle, initCrypto } from "../src/crypto.js";

const TEST_DEPTH = 10;

// BN254 scalar field modulus
const FR_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

function randomField(): bigint {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const raw = BigInt("0x" + Buffer.from(bytes).toString("hex"));
  return raw % FR_MODULUS;
}

beforeAll(async () => {
  await initCrypto();
});

describe("IncrementalMerkleTree", () => {
  describe("zero hashes", () => {
    it("should compute zero hash chain correctly", () => {
      const zeros = IncrementalMerkleTree.computeZeroHashes(5);
      expect(zeros[0]).toBe(0n);
      expect(zeros[1]).toBe(poseidon2Merkle(0n, 0n));
      expect(zeros[2]).toBe(poseidon2Merkle(zeros[1], zeros[1]));
      expect(zeros[3]).toBe(poseidon2Merkle(zeros[2], zeros[2]));
    });
  });

  describe("empty tree", () => {
    it("should have root equal to zeroHashes[depth]", () => {
      const tree = new IncrementalMerkleTree(TEST_DEPTH);
      const zeros = IncrementalMerkleTree.computeZeroHashes(TEST_DEPTH);
      expect(tree.root).toBe(zeros[TEST_DEPTH]);
      expect(tree.leafCount).toBe(0);
    });
  });

  describe("single leaf", () => {
    it("should match buildMerkleTree for 1 leaf", () => {
      const leaf = 42n;
      const incTree = new IncrementalMerkleTree(TEST_DEPTH);
      incTree.insert(leaf);

      const naiveTree = buildMerkleTree([leaf], TEST_DEPTH);
      expect(incTree.root).toBe(naiveTree.root);
    });
  });

  describe("multiple leaves — root match", () => {
    const counts = [2, 3, 5, 10, 50, 100];

    for (const count of counts) {
      it(`should match buildMerkleTree root for ${count} leaves`, () => {
        const leaves = Array.from({ length: count }, (_, i) => BigInt(i + 1));

        const incTree = new IncrementalMerkleTree(TEST_DEPTH);
        for (const leaf of leaves) {
          incTree.insert(leaf);
        }

        const naiveTree = buildMerkleTree(leaves, TEST_DEPTH);
        expect(incTree.root).toBe(naiveTree.root);
      });
    }
  });

  describe("proof correctness", () => {
    it("should produce proofs that match buildMerkleTree", () => {
      const leaves = [100n, 200n, 300n, 400n, 500n];
      const incTree = new IncrementalMerkleTree(TEST_DEPTH);
      for (const leaf of leaves) {
        incTree.insert(leaf);
      }

      const naiveTree = buildMerkleTree(leaves, TEST_DEPTH);

      for (let i = 0; i < leaves.length; i++) {
        const incProof = incTree.getProof(i);
        const naiveProof = naiveTree.proofs.get(i)!;

        expect(incProof.root).toBe(naiveTree.root);
        expect(incProof.commitment).toBe(leaves[i]);
        expect(incProof.siblings).toEqual(naiveProof.siblings);
        expect(incProof.pathIndices).toEqual(naiveProof.pathIndices);
      }
    });
  });

  describe("proof verification", () => {
    it("proof should recompute root correctly", () => {
      const leaves = [11n, 22n, 33n];
      const incTree = new IncrementalMerkleTree(TEST_DEPTH);
      for (const leaf of leaves) {
        incTree.insert(leaf);
      }

      // Manually verify proof for leaf index 1
      const proof = incTree.getProof(1);
      let current = proof.commitment;
      for (let i = 0; i < TEST_DEPTH; i++) {
        if (proof.pathIndices[i] === 0) {
          current = poseidon2Merkle(current, proof.siblings[i]);
        } else {
          current = poseidon2Merkle(proof.siblings[i], current);
        }
      }
      expect(current).toBe(incTree.root);
    });
  });

  describe("incremental insert consistency", () => {
    it("batch insert should equal sequential insert", () => {
      const leaves = Array.from({ length: 20 }, (_, i) => BigInt(i * 7 + 3));

      // Sequential: insert one by one, check root at each step
      const incTree = new IncrementalMerkleTree(TEST_DEPTH);
      const rootsAfterEach: bigint[] = [];
      for (const leaf of leaves) {
        incTree.insert(leaf);
        rootsAfterEach.push(incTree.root);
      }

      // Verify: final root matches naive
      const naiveTree = buildMerkleTree(leaves, TEST_DEPTH);
      expect(incTree.root).toBe(naiveTree.root);

      // Verify: intermediate roots are correct
      for (let i = 0; i < leaves.length; i++) {
        const partialNaive = buildMerkleTree(leaves.slice(0, i + 1), TEST_DEPTH);
        expect(rootsAfterEach[i]).toBe(partialNaive.root);
      }
    });
  });

  describe("random leaves", () => {
    it("should match buildMerkleTree for 30 random leaves", () => {
      const leaves = Array.from({ length: 30 }, () => randomField());

      const incTree = new IncrementalMerkleTree(TEST_DEPTH);
      for (const leaf of leaves) {
        incTree.insert(leaf);
      }

      const naiveTree = buildMerkleTree(leaves, TEST_DEPTH);
      expect(incTree.root).toBe(naiveTree.root);
    });
  });

  describe("serialization", () => {
    it("should export and import correctly", () => {
      const leaves = [10n, 20n, 30n, 40n, 50n];
      const tree = new IncrementalMerkleTree(TEST_DEPTH);
      for (const leaf of leaves) {
        tree.insert(leaf);
      }

      const exported = tree.export();
      const json = JSON.stringify(exported);
      const parsed = JSON.parse(json);
      const imported = IncrementalMerkleTree.import(parsed, TEST_DEPTH);

      expect(imported.root).toBe(tree.root);
      expect(imported.leafCount).toBe(tree.leafCount);

      // Proofs should be identical
      for (let i = 0; i < leaves.length; i++) {
        const origProof = tree.getProof(i);
        const importedProof = imported.getProof(i);
        expect(importedProof.siblings).toEqual(origProof.siblings);
        expect(importedProof.pathIndices).toEqual(origProof.pathIndices);
      }
    });

    it("should support continued insertion after import", () => {
      const tree1 = new IncrementalMerkleTree(TEST_DEPTH);
      tree1.insert(100n);
      tree1.insert(200n);

      const imported = IncrementalMerkleTree.import(tree1.export(), TEST_DEPTH);
      imported.insert(300n);

      const reference = new IncrementalMerkleTree(TEST_DEPTH);
      reference.insert(100n);
      reference.insert(200n);
      reference.insert(300n);

      expect(imported.root).toBe(reference.root);
    });
  });

  describe("error handling", () => {
    it("should throw on out-of-range proof request", () => {
      const tree = new IncrementalMerkleTree(TEST_DEPTH);
      tree.insert(1n);
      expect(() => tree.getProof(1)).toThrow("out of range");
      expect(() => tree.getProof(-1)).toThrow("out of range");
    });

    it("should throw when tree is full", () => {
      const tree = new IncrementalMerkleTree(3); // 8 leaves max
      for (let i = 0; i < 8; i++) {
        tree.insert(BigInt(i));
      }
      expect(() => tree.insert(99n)).toThrow("full");
    });
  });
});
