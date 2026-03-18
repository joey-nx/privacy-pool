/**
 * Incremental Merkle Tree (Poseidon2, depth 32)
 *
 * Replaces the naive `buildMerkleTree()` which allocates 2^depth leaves.
 * Only stores non-default nodes in a Map. Insert and proof are both O(log n).
 *
 * Zero hash chain:
 *   zeroHashes[0] = 0n  (empty leaf)
 *   zeroHashes[i] = poseidon2Merkle(zeroHashes[i-1], zeroHashes[i-1])
 */

import { poseidon2Merkle, TREE_DEPTH } from "./crypto.js";
import type { MerkleProof, TreeState } from "./types.js";

export class IncrementalMerkleTree {
  readonly depth: number;
  readonly zeroHashes: bigint[];

  private nodes: Map<string, bigint>;
  private _leafCount: number;
  private _root: bigint;

  constructor(depth: number = TREE_DEPTH) {
    this.depth = depth;
    this.zeroHashes = IncrementalMerkleTree.computeZeroHashes(depth);
    this.nodes = new Map();
    this._leafCount = 0;
    this._root = this.zeroHashes[depth];
  }

  get leafCount(): number {
    return this._leafCount;
  }

  get root(): bigint {
    return this._root;
  }

  /** Precompute the zero hash chain (done once per depth). */
  static computeZeroHashes(depth: number): bigint[] {
    const zeros: bigint[] = new Array(depth + 1);
    zeros[0] = 0n;
    for (let i = 1; i <= depth; i++) {
      zeros[i] = poseidon2Merkle(zeros[i - 1], zeros[i - 1]);
    }
    return zeros;
  }

  /** Insert a leaf at the next available index. Returns the new root. */
  insert(leaf: bigint): bigint {
    const leafIndex = this._leafCount;
    const maxLeaves = 2 ** this.depth;
    if (leafIndex >= maxLeaves) {
      throw new Error(`Tree is full (max ${maxLeaves} leaves)`);
    }

    this.setNode(0, leafIndex, leaf);

    let current = leaf;
    let idx = leafIndex;

    for (let level = 0; level < this.depth; level++) {
      const siblingIdx = idx ^ 1;
      const sibling = this.getNode(level, siblingIdx);
      const parentIdx = idx >> 1;

      const parent =
        idx % 2 === 0
          ? poseidon2Merkle(current, sibling)
          : poseidon2Merkle(sibling, current);

      this.setNode(level + 1, parentIdx, parent);
      current = parent;
      idx = parentIdx;
    }

    this._root = current;
    this._leafCount++;
    return this._root;
  }

  /** Generate a Merkle proof for the given leaf index. */
  getProof(leafIndex: number): MerkleProof {
    if (leafIndex < 0 || leafIndex >= this._leafCount) {
      throw new Error(
        `Leaf index ${leafIndex} out of range [0, ${this._leafCount})`,
      );
    }

    const siblings: bigint[] = [];
    const pathIndices: number[] = [];
    let idx = leafIndex;

    for (let level = 0; level < this.depth; level++) {
      const siblingIdx = idx ^ 1;
      siblings.push(this.getNode(level, siblingIdx));
      pathIndices.push(idx % 2 === 0 ? 0 : 1);
      idx = idx >> 1;
    }

    return {
      root: this._root,
      leafIndex,
      commitment: this.getNode(0, leafIndex),
      siblings,
      pathIndices,
    };
  }

  /** Get commitment (leaf value) at the given index. */
  getLeaf(leafIndex: number): bigint {
    return this.getNode(0, leafIndex);
  }

  // ============================================================
  // Serialization (for persistence)
  // ============================================================

  /** Export tree state for persistence. */
  export(): TreeState {
    const entries: [string, string][] = [];
    for (const [key, value] of this.nodes) {
      entries.push([key, value.toString()]);
    }
    return {
      leafCount: this._leafCount,
      nodes: entries,
    };
  }

  /** Import tree state from persistence. */
  static import(state: TreeState, depth: number = TREE_DEPTH): IncrementalMerkleTree {
    const tree = new IncrementalMerkleTree(depth);
    tree._leafCount = state.leafCount;
    for (const [key, value] of state.nodes) {
      tree.nodes.set(key, BigInt(value));
    }
    // Recompute root from the top node
    if (state.leafCount > 0) {
      tree._root = tree.getNode(depth, 0);
    }
    return tree;
  }

  // ============================================================
  // Internal helpers
  // ============================================================

  private nodeKey(level: number, index: number): string {
    return `${level}:${index}`;
  }

  private getNode(level: number, index: number): bigint {
    return this.nodes.get(this.nodeKey(level, index)) ?? this.zeroHashes[level];
  }

  private setNode(level: number, index: number, value: bigint): void {
    this.nodes.set(this.nodeKey(level, index), value);
  }
}
