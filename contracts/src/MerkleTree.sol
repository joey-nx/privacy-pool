// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Poseidon2} from "./Poseidon2.sol";

/// @title IncrementalMerkleTree - On-chain Poseidon2 Merkle tree with rotation
/// @notice Depth-20 incremental Merkle tree. When a tree fills (2^20 = 1,048,576 leaves),
///         a new tree is started automatically. All historical roots remain valid.
/// @dev Uses Poseidon2.hash_3(left, right, DOMAIN_MERKLE) as the node hash,
///      matching the Noir circuit's poseidon2_merkle function.
abstract contract IncrementalMerkleTree {
    uint256 public constant TREE_DEPTH = 20;
    uint256 public constant MAX_LEAVES = 1 << TREE_DEPTH; // 1,048,576
    uint256 internal constant DOMAIN_MERKLE = 3;

    /// @dev Zero hashes for each level. ZEROS[0] = empty leaf = 0.
    ///      ZEROS[i+1] = poseidon2_merkle(ZEROS[i], ZEROS[i]).
    ///      Precomputed to avoid on-chain recomputation.
    uint256[TREE_DEPTH] internal ZEROS;

    /// @dev Filled subtrees for each active tree.
    ///      filledSubtrees[treeIndex][level] = most recent left-child hash at that level.
    mapping(uint256 => uint256[TREE_DEPTH]) internal filledSubtrees;

    /// @dev Leaf count per tree.
    mapping(uint256 => uint256) public leafCounts;

    /// @dev Index of the currently active tree.
    uint256 public currentTreeIndex;

    /// @dev Current Merkle root (updated on every insert).
    bytes32 public currentRoot;

    /// @dev All roots ever produced (across all trees). Used for withdrawal validation.
    mapping(bytes32 => bool) public knownRoots;

    /// @dev Total number of leaves inserted across all trees.
    uint256 public totalLeaves;

    // ============================================================
    // Initialization (called in constructor, gas paid by deployer)
    // ============================================================

    /// @dev Compute zero hashes. Called once during construction.
    function _initZeros() internal {
        // ZEROS[0] = 0 (empty leaf)
        ZEROS[0] = 0;
        for (uint256 i = 1; i < TREE_DEPTH; i++) {
            ZEROS[i] = _merkleHash(ZEROS[i - 1], ZEROS[i - 1]);
        }
    }

    // ============================================================
    // Insert
    // ============================================================

    /// @notice Insert a leaf into the current tree. Rotates to a new tree if full.
    /// @param leaf The commitment to insert (Field element as uint256).
    /// @return root The new Merkle root after insertion.
    /// @return leafIndex The global leaf index (across all trees).
    function _insert(uint256 leaf) internal returns (bytes32 root, uint256 leafIndex) {
        uint256 treeIdx = currentTreeIndex;
        uint256 localIdx = leafCounts[treeIdx];

        // Rotate if current tree is full
        if (localIdx >= MAX_LEAVES) {
            treeIdx++;
            currentTreeIndex = treeIdx;
            localIdx = 0;
        }

        // Incremental Merkle tree insert
        uint256 current = leaf;
        uint256 idx = localIdx;

        for (uint256 level = 0; level < TREE_DEPTH; level++) {
            if (idx % 2 == 0) {
                // Left child: store current hash, pair with zero
                filledSubtrees[treeIdx][level] = current;
                current = _merkleHash(current, ZEROS[level]);
            } else {
                // Right child: pair with stored left sibling
                current = _merkleHash(filledSubtrees[treeIdx][level], current);
            }
            idx >>= 1;
        }

        leafCounts[treeIdx] = localIdx + 1;
        leafIndex = totalLeaves;
        totalLeaves++;

        root = bytes32(current);
        currentRoot = root;
        knownRoots[root] = true;
    }

    // ============================================================
    // Merkle hash (matching Noir circuit)
    // ============================================================

    /// @dev poseidon2_merkle(left, right) = poseidon2_hash_3(left, right, DOMAIN_MERKLE)
    function _merkleHash(uint256 left, uint256 right) internal pure returns (uint256) {
        return Poseidon2.hash_3(left, right, DOMAIN_MERKLE);
    }

    // ============================================================
    // View functions
    // ============================================================

    /// @notice Get the leaf count for a specific tree.
    function getTreeLeafCount(uint256 treeIndex) external view returns (uint256) {
        return leafCounts[treeIndex];
    }

    /// @notice Get the current tree's remaining capacity.
    function remainingCapacity() external view returns (uint256) {
        return MAX_LEAVES - leafCounts[currentTreeIndex];
    }
}
