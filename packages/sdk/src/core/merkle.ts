/**
 * Merkle tree construction and proof generation.
 *
 * Uses SDK's poseidon2Merkle (browser WASM via @aztec/bb.js).
 * For Node.js usage, scripts/lib/crypto.ts provides an equivalent
 * implementation backed by @aztec/foundation.
 */

import { poseidon2Merkle } from "./crypto.js";
import { TREE_DEPTH } from "./types.js";

// ============================================================
// Types
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

// ============================================================
// Full Merkle Tree
// ============================================================

/**
 * Build a complete Merkle tree from a list of leaf commitments.
 * Pads remaining leaves with 0n up to 2^depth.
 *
 * Returns the root and proofs for each real (non-padding) leaf.
 */
export function buildMerkleTree(
  leaves: bigint[],
  depth: number = TREE_DEPTH,
): MerkleTree {
  const numLeaves = leaves.length;
  const totalLeaves = 1 << depth;

  const paddedLeaves = new Array(totalLeaves).fill(0n);
  for (let i = 0; i < numLeaves; i++) {
    paddedLeaves[i] = leaves[i];
  }

  // Build level by level
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

  // Extract proofs for each real leaf
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

// ============================================================
// Sparse Merkle Proof
// ============================================================

/**
 * Generate a Merkle proof for a single leaf in a sparse tree
 * where all other leaves are 0n.
 *
 * Useful for testing or when only one deposit exists.
 */
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
