/**
 * Merkle tree unit tests — buildMerkleTree & generateSparseProof.
 *
 * Verifies tree construction, proof generation, and documents the
 * intentional difference between the two builders:
 *
 * - buildMerkleTree:     full tree, empty leaves = hash(0,0) recursively (production)
 * - generateSparseProof: sibling = raw 0n at every level (matches circuit test vectors)
 *
 * Both are self-consistent: proofs from each verify against its own root.
 * They produce DIFFERENT roots for the same leaf set — this is expected.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { initCrypto, poseidon2Merkle, computeCommitment } from "../src/core/crypto.js";
import {
  buildMerkleTree,
  generateSparseProof,
} from "../src/core/merkle.js";
import { TREE_DEPTH, REGISTRATION_DEPTH } from "../src/core/types.js";

// Small depth for fast tests (2^3 = 8 leaves)
const TEST_DEPTH = 3;

/** Manually compute Merkle root by walking siblings up the tree */
function verifyProof(
  leaf: bigint,
  siblings: bigint[],
  pathIndices: number[],
): bigint {
  let current = leaf;
  for (let i = 0; i < siblings.length; i++) {
    if (pathIndices[i] === 0) {
      current = poseidon2Merkle(current, siblings[i]);
    } else {
      current = poseidon2Merkle(siblings[i], current);
    }
  }
  return current;
}

describe("Merkle Tree", () => {
  beforeAll(async () => {
    await initCrypto();
  }, 30_000);

  // ============================================================
  // buildMerkleTree
  // ============================================================

  describe("buildMerkleTree", () => {
    it("should build a tree with a single leaf", () => {
      const leaf = 12345n;
      const tree = buildMerkleTree([leaf], TEST_DEPTH);

      expect(tree.root).toBeTypeOf("bigint");
      expect(tree.root).not.toBe(0n);
      expect(tree.leaves.length).toBe(1 << TEST_DEPTH);
      expect(tree.leaves[0]).toBe(leaf);
      expect(tree.proofs.size).toBe(1);
    });

    it("should produce a valid proof for each leaf", () => {
      const leaves = [100n, 200n, 300n];
      const tree = buildMerkleTree(leaves, TEST_DEPTH);

      for (let i = 0; i < leaves.length; i++) {
        const proof = tree.proofs.get(i)!;
        expect(proof).toBeDefined();
        expect(proof.siblings.length).toBe(TEST_DEPTH);
        expect(proof.pathIndices.length).toBe(TEST_DEPTH);

        const computedRoot = verifyProof(leaves[i], proof.siblings, proof.pathIndices);
        expect(computedRoot).toBe(tree.root);
      }
    });

    it("should pad remaining leaves with 0n", () => {
      const leaves = [42n];
      const tree = buildMerkleTree(leaves, TEST_DEPTH);
      const totalLeaves = 1 << TEST_DEPTH;

      expect(tree.leaves[0]).toBe(42n);
      for (let i = 1; i < totalLeaves; i++) {
        expect(tree.leaves[i]).toBe(0n);
      }
    });

    it("should handle a full tree (all leaves populated)", () => {
      const totalLeaves = 1 << TEST_DEPTH;
      const leaves = Array.from({ length: totalLeaves }, (_, i) => BigInt(i + 1));
      const tree = buildMerkleTree(leaves, TEST_DEPTH);

      expect(tree.proofs.size).toBe(totalLeaves);

      for (let i = 0; i < totalLeaves; i++) {
        const proof = tree.proofs.get(i)!;
        const computedRoot = verifyProof(leaves[i], proof.siblings, proof.pathIndices);
        expect(computedRoot).toBe(tree.root);
      }
    });

    it("should produce correct path indices (left=0, right=1)", () => {
      const leaves = [10n, 20n, 30n, 40n];
      const tree = buildMerkleTree(leaves, TEST_DEPTH);

      // Leaf 0 (even index at every level) → first path index 0
      const proof0 = tree.proofs.get(0)!;
      expect(proof0.pathIndices[0]).toBe(0);

      // Leaf 1 (odd at level 0) → first path index 1
      const proof1 = tree.proofs.get(1)!;
      expect(proof1.pathIndices[0]).toBe(1);

      // Leaf 2 (even at level 0, odd at level 1)
      const proof2 = tree.proofs.get(2)!;
      expect(proof2.pathIndices[0]).toBe(0);
      expect(proof2.pathIndices[1]).toBe(1);

      // Leaf 3 (odd at level 0, odd at level 1)
      const proof3 = tree.proofs.get(3)!;
      expect(proof3.pathIndices[0]).toBe(1);
      expect(proof3.pathIndices[1]).toBe(1);
    });

    it("should produce different roots for different leaf sets", () => {
      const tree1 = buildMerkleTree([100n], TEST_DEPTH);
      const tree2 = buildMerkleTree([200n], TEST_DEPTH);
      expect(tree1.root).not.toBe(tree2.root);
    });

    it("should produce different roots when leaf order changes", () => {
      const tree1 = buildMerkleTree([100n, 200n], TEST_DEPTH);
      const tree2 = buildMerkleTree([200n, 100n], TEST_DEPTH);
      expect(tree1.root).not.toBe(tree2.root);
    });

    it("should only generate proofs for real leaves, not padding", () => {
      const leaves = [1n, 2n];
      const tree = buildMerkleTree(leaves, TEST_DEPTH);

      expect(tree.proofs.size).toBe(2);
      expect(tree.proofs.has(0)).toBe(true);
      expect(tree.proofs.has(1)).toBe(true);
      expect(tree.proofs.has(2)).toBe(false);
    });

    it("should produce deterministic results for same input", () => {
      const leaves = [111n, 222n, 333n];
      const tree1 = buildMerkleTree(leaves, TEST_DEPTH);
      const tree2 = buildMerkleTree(leaves, TEST_DEPTH);
      expect(tree1.root).toBe(tree2.root);
    });
  });

  // ============================================================
  // generateSparseProof
  // ============================================================

  describe("generateSparseProof", () => {
    it("should produce a valid root for index 0", () => {
      const leaf = 42n;
      const { root, siblings, pathIndices } = generateSparseProof(leaf, 0, TEST_DEPTH);

      expect(root).toBeTypeOf("bigint");
      expect(root).not.toBe(0n);
      expect(siblings.length).toBe(TEST_DEPTH);
      expect(pathIndices.length).toBe(TEST_DEPTH);

      // All siblings should be 0 (sparse)
      expect(siblings.every((s) => s === 0n)).toBe(true);
      // Index 0 → all path indices are 0
      expect(pathIndices.every((i) => i === 0)).toBe(true);
    });

    it("should produce correct path indices for index 7 (binary 111)", () => {
      const leaf = 42n;
      const { pathIndices } = generateSparseProof(leaf, 7, TEST_DEPTH);

      // 7 = 0b111 → first 3 bits are 1
      expect(pathIndices[0]).toBe(1);
      expect(pathIndices[1]).toBe(1);
      expect(pathIndices[2]).toBe(1);
    });

    it("should produce correct path indices for index 5 (binary 101)", () => {
      const leaf = 99n;
      const { pathIndices } = generateSparseProof(leaf, 5, 4);

      // 5 = 0b0101 → bits: 1, 0, 1, 0
      expect(pathIndices[0]).toBe(1);
      expect(pathIndices[1]).toBe(0);
      expect(pathIndices[2]).toBe(1);
      expect(pathIndices[3]).toBe(0);
    });

    it("should produce different roots for same leaf at different indices", () => {
      const leaf = 42n;
      const r0 = generateSparseProof(leaf, 0, TEST_DEPTH).root;
      const r1 = generateSparseProof(leaf, 1, TEST_DEPTH).root;
      const r7 = generateSparseProof(leaf, 7, TEST_DEPTH).root;

      expect(r0).not.toBe(r1);
      expect(r0).not.toBe(r7);
      expect(r1).not.toBe(r7);
    });

    it("should produce different roots for different leaves at same index", () => {
      const r1 = generateSparseProof(100n, 0, TEST_DEPTH).root;
      const r2 = generateSparseProof(200n, 0, TEST_DEPTH).root;
      expect(r1).not.toBe(r2);
    });

    it("proof should verify correctly via manual walk", () => {
      const leaf = 555n;
      const idx = 3;
      const { root, siblings, pathIndices } = generateSparseProof(leaf, idx, TEST_DEPTH);

      const computedRoot = verifyProof(leaf, siblings, pathIndices);
      expect(computedRoot).toBe(root);
    });

    it("should work with default TREE_DEPTH (32)", () => {
      const leaf = 42n;
      const { root, siblings, pathIndices } = generateSparseProof(leaf, 0);

      expect(siblings.length).toBe(TREE_DEPTH);
      expect(pathIndices.length).toBe(TREE_DEPTH);
      expect(root).toBeTypeOf("bigint");
    });

    it("should work with REGISTRATION_DEPTH (16)", () => {
      const leaf = 42n;
      const { root, siblings, pathIndices } = generateSparseProof(leaf, 0, REGISTRATION_DEPTH);

      expect(siblings.length).toBe(REGISTRATION_DEPTH);
      expect(pathIndices.length).toBe(REGISTRATION_DEPTH);
      expect(root).toBeTypeOf("bigint");
    });

    it("should match circuit test vector (commitment at index 0, depth 32)", () => {
      const commitment = computeCommitment(
        42n,
        17480208703614656685747052102702583227302376189854054257453006863483518404526n,
        1000000n,
        12345678n,
        974334424887268612135789888477522013103955028650n,
      );

      const { root } = generateSparseProof(commitment, 0, TREE_DEPTH);
      expect(root).toBe(
        9339649647151985514729491870521773352305870421018730179861125567563415338244n,
      );
    });

    it("should match circuit test vector (commitment at index 7, depth 32)", () => {
      const commitment = computeCommitment(
        42n,
        17480208703614656685747052102702583227302376189854054257453006863483518404526n,
        1000000n,
        12345678n,
        974334424887268612135789888477522013103955028650n,
      );

      const { root } = generateSparseProof(commitment, 7, TREE_DEPTH);
      expect(root).toBe(
        16527785299755772436723289107917377408262746738541791711316125020809282786217n,
      );
    });
  });

  // ============================================================
  // Empty-subtree convention difference (buildMerkleTree vs sparse)
  // ============================================================

  describe("empty-subtree convention", () => {
    it("poseidon2Merkle(0n, 0n) is NOT 0n — the core of the difference", () => {
      const hashOfZeros = poseidon2Merkle(0n, 0n);
      expect(hashOfZeros).not.toBe(0n);
    });

    it("buildMerkleTree uses hashed zeros, sparse uses raw zeros", () => {
      const leaf = 42n;
      const depth = 4;

      const tree = buildMerkleTree([leaf], depth);
      const sparse = generateSparseProof(leaf, 0, depth);

      // Roots MUST differ because of different empty-subtree convention
      expect(tree.root).not.toBe(sparse.root);

      // buildMerkleTree siblings contain hash(0,0) at level 1+
      const treeProof = tree.proofs.get(0)!;
      // Level 0 sibling is the raw 0n (the actual leaf value at index 1)
      expect(treeProof.siblings[0]).toBe(0n);
      // Level 1+ siblings are hash(0,0) chains, NOT raw 0n
      expect(treeProof.siblings[1]).not.toBe(0n);

      // sparse siblings are ALL raw 0n
      expect(sparse.siblings.every((s) => s === 0n)).toBe(true);
    });

    it("both produce self-consistent proofs despite different roots", () => {
      const leaf = 42n;
      const depth = 4;

      // Full tree: proof verifies against its own root
      const tree = buildMerkleTree([leaf], depth);
      const treeProof = tree.proofs.get(0)!;
      const treeRoot = verifyProof(leaf, treeProof.siblings, treeProof.pathIndices);
      expect(treeRoot).toBe(tree.root);

      // Sparse: proof verifies against its own root
      const sparse = generateSparseProof(leaf, 0, depth);
      const sparseRoot = verifyProof(leaf, sparse.siblings, sparse.pathIndices);
      expect(sparseRoot).toBe(sparse.root);
    });

    it("circuit test vectors use sparse (raw zero) convention", () => {
      // circuits/Prover.toml has merkle_siblings = ["0", "0", ..., "0"]
      // This matches generateSparseProof, NOT buildMerkleTree.
      // In production, the sequencer uses buildMerkleTree and provides
      // actual (non-zero) siblings in the proof response.
      const commitment = computeCommitment(
        42n,
        17480208703614656685747052102702583227302376189854054257453006863483518404526n,
        1000000n,
        12345678n,
        974334424887268612135789888477522013103955028650n,
      );

      const sparse = generateSparseProof(commitment, 0, TREE_DEPTH);
      const circuitExpectedRoot =
        9339649647151985514729491870521773352305870421018730179861125567563415338244n;

      expect(sparse.root).toBe(circuitExpectedRoot);
    });
  });

  // ============================================================
  // buildMerkleTree cross-leaf consistency
  // ============================================================

  describe("buildMerkleTree cross-leaf consistency", () => {
    it("all proofs in a multi-leaf tree resolve to the same root", () => {
      const leaves = [10n, 20n, 30n, 40n, 50n, 60n, 70n, 80n];
      const tree = buildMerkleTree(leaves, TEST_DEPTH);

      for (let i = 0; i < leaves.length; i++) {
        const proof = tree.proofs.get(i)!;
        const root = verifyProof(leaves[i], proof.siblings, proof.pathIndices);
        expect(root).toBe(tree.root);
      }
    });

    it("adding a leaf changes the root", () => {
      const tree1 = buildMerkleTree([100n], TEST_DEPTH);
      const tree2 = buildMerkleTree([100n, 200n], TEST_DEPTH);
      expect(tree1.root).not.toBe(tree2.root);
    });

    it("modifying a leaf changes the root but other proofs still verify", () => {
      const leaves1 = [10n, 20n, 30n, 40n];
      const leaves2 = [10n, 99n, 30n, 40n]; // changed leaf 1

      const tree1 = buildMerkleTree(leaves1, TEST_DEPTH);
      const tree2 = buildMerkleTree(leaves2, TEST_DEPTH);

      expect(tree1.root).not.toBe(tree2.root);

      // Both trees' proofs are internally consistent
      for (const [tree, leaves] of [[tree1, leaves1], [tree2, leaves2]] as const) {
        for (let i = 0; i < leaves.length; i++) {
          const proof = tree.proofs.get(i)!;
          const root = verifyProof(leaves[i], proof.siblings, proof.pathIndices);
          expect(root).toBe(tree.root);
        }
      }
    });
  });

  // ============================================================
  // Edge cases
  // ============================================================

  describe("edge cases", () => {
    it("buildMerkleTree with depth 1 (2 leaves)", () => {
      const tree = buildMerkleTree([10n, 20n], 1);
      expect(tree.root).toBe(poseidon2Merkle(10n, 20n));
      expect(tree.proofs.size).toBe(2);
    });

    it("buildMerkleTree with single leaf at depth 1", () => {
      const tree = buildMerkleTree([10n], 1);
      expect(tree.root).toBe(poseidon2Merkle(10n, 0n));

      const proof = tree.proofs.get(0)!;
      expect(proof.siblings).toEqual([0n]);
      expect(proof.pathIndices).toEqual([0]);
    });

    it("generateSparseProof at index 0, depth 1", () => {
      const { root, siblings, pathIndices } = generateSparseProof(10n, 0, 1);
      expect(root).toBe(poseidon2Merkle(10n, 0n));
      expect(siblings).toEqual([0n]);
      expect(pathIndices).toEqual([0]);
    });

    it("generateSparseProof at index 1, depth 1", () => {
      const { root } = generateSparseProof(10n, 1, 1);
      expect(root).toBe(poseidon2Merkle(0n, 10n));
    });

    it("buildMerkleTree and sparseProof agree at depth 1 (both sibling is raw 0n)", () => {
      // At depth 1, there's only 1 level. The sibling is always the raw leaf value.
      // For a single-leaf tree, sibling = 0n in both implementations.
      const leaf = 42n;
      const tree = buildMerkleTree([leaf], 1);
      const sparse = generateSparseProof(leaf, 0, 1);

      // At depth 1, both conventions produce the same result
      expect(tree.root).toBe(sparse.root);
    });
  });
});
