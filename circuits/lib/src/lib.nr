use std::hash::poseidon2_permutation;

mod test_vectors;

// ============================================================
// Latent Privacy Circuit -- Shared Library
//
// Common functions used by both privacy and compliance circuits:
//   - Domain separators
//   - Poseidon2 sponge hash variants
//   - NPK, commitment, nullifier computation
//   - Merkle root computation
// ============================================================

// Domain separators to prevent cross-context hash collisions
pub global DOMAIN_COMMITMENT: Field = 1;
pub global DOMAIN_NULLIFIER: Field = 2;
pub global DOMAIN_MERKLE: Field = 3;
pub global DOMAIN_NPK: Field = 5;

// ============================================================
// Poseidon2 Sponge Construction
//
// Uses poseidon2_permutation (t=4, rate=3, capacity=1).
// Matches the Noir stdlib internal Poseidon2::hash behavior:
//   absorb inputs into state[0..rate], permute when rate is full,
//   final permute for remaining, squeeze state[0].
// ============================================================

// Sponge hash for 2 inputs: one partial absorb + squeeze
pub fn poseidon2_hash_2(a: Field, b: Field) -> Field {
    let mut state: [Field; 4] = [0; 4];
    state[0] = a;
    state[1] = b;
    // cache_size=2, not full (rate=3), squeeze triggers final permutation
    let result = poseidon2_permutation(state, 4);
    result[0]
}

// Sponge hash for 3 inputs: one full absorb, no extra squeeze permutation
pub fn poseidon2_hash_3(a: Field, b: Field, c: Field) -> Field {
    let mut state: [Field; 4] = [0; 4];
    state[0] = a;
    state[1] = b;
    state[2] = c;
    // cache full (rate=3), duplex triggered, cache_size resets to 0
    // squeeze: cache_size==0, no extra permutation
    let result = poseidon2_permutation(state, 4);
    result[0]
}

// Sponge hash for 5 inputs: one full absorb + one partial absorb (2/3) + squeeze
pub fn poseidon2_hash_5(a: Field, b: Field, c: Field, d: Field, e: Field) -> Field {
    let mut state: [Field; 4] = [0; 4];
    // chunk 1: [a, b, c] -> full rate, duplex
    state[0] = a;
    state[1] = b;
    state[2] = c;
    state = poseidon2_permutation(state, 4);
    // chunk 2: [d, e] -> cache_size=2, squeeze triggers final permutation
    state[0] += d;
    state[1] += e;
    state = poseidon2_permutation(state, 4);
    state[0]
}

// Sponge hash for 6 inputs: two full absorbs, no extra squeeze permutation
pub fn poseidon2_hash_6(
    a: Field, b: Field, c: Field, d: Field, e: Field, f: Field,
) -> Field {
    let mut state: [Field; 4] = [0; 4];
    // chunk 1: [a, b, c]
    state[0] = a;
    state[1] = b;
    state[2] = c;
    state = poseidon2_permutation(state, 4);
    // chunk 2: [d, e, f]
    state[0] += d;
    state[1] += e;
    state[2] += f;
    state = poseidon2_permutation(state, 4);
    state[0]
}

// ============================================================
// Core Functions
// ============================================================

// npk = poseidon2([nsk, DOMAIN_NPK])
pub fn compute_npk(nsk: Field) -> Field {
    poseidon2_hash_2(nsk, DOMAIN_NPK)
}

// commitment = poseidon2([secret, npk, amount, block, depositor, DOMAIN_COMMITMENT])
pub fn compute_commitment(
    secret: Field,
    npk: Field,
    amount: Field,
    block_number: Field,
    depositor: Field,
) -> Field {
    poseidon2_hash_6(secret, npk, amount, block_number, depositor, DOMAIN_COMMITMENT)
}

// nullifier = poseidon2([secret, nsk, DOMAIN_NULLIFIER])
pub fn compute_nullifier(secret: Field, nsk: Field) -> Field {
    poseidon2_hash_3(secret, nsk, DOMAIN_NULLIFIER)
}

// Merkle node hash with domain separation
pub fn poseidon2_merkle(left: Field, right: Field) -> Field {
    poseidon2_hash_3(left, right, DOMAIN_MERKLE)
}

// Commitment tree depth (matching on-chain IncrementalMerkleTree)
pub global TREE_DEPTH: u32 = 20;

// Compute Merkle root from leaf and proof path (depth 20)
pub fn compute_merkle_root(
    leaf: Field,
    siblings: [Field; TREE_DEPTH],
    path_indices: [u1; TREE_DEPTH],
) -> Field {
    let mut current = leaf;
    for i in 0..TREE_DEPTH {
        if path_indices[i] == 0 {
            current = poseidon2_merkle(current, siblings[i]);
        } else {
            current = poseidon2_merkle(siblings[i], current);
        }
    }
    current
}

// Compute Merkle root for arbitrary-depth tree (used for registration tree)
pub fn compute_merkle_root_n<let N: u32>(
    leaf: Field,
    siblings: [Field; N],
    path_indices: [u1; N],
) -> Field {
    let mut current = leaf;
    for i in 0..N {
        if path_indices[i] == 0 {
            current = poseidon2_merkle(current, siblings[i]);
        } else {
            current = poseidon2_merkle(siblings[i], current);
        }
    }
    current
}

// ============================================================
// Tests
// ============================================================

#[test]
fn test_npk_deterministic() {
    let nsk: Field = 12345;
    let npk1 = compute_npk(nsk);
    let npk2 = compute_npk(nsk);
    assert(npk1 == npk2, "Same nsk must produce same npk");
}

#[test]
fn test_npk_uniqueness() {
    let npk_a = compute_npk(11111);
    let npk_b = compute_npk(22222);
    assert(npk_a != npk_b, "Different nsk must produce different npk");
}

#[test]
fn test_nullifier_deterministic() {
    let secret: Field = 99999;
    let nsk: Field = 12345;
    let n1 = compute_nullifier(secret, nsk);
    let n2 = compute_nullifier(secret, nsk);
    assert(n1 == n2, "Same inputs must produce same nullifier");
}

#[test]
fn test_nullifier_uniqueness_secret() {
    let nsk: Field = 12345;
    let n1 = compute_nullifier(11111, nsk);
    let n2 = compute_nullifier(22222, nsk);
    assert(n1 != n2, "Different secret must produce different nullifier");
}

#[test]
fn test_nullifier_uniqueness_nsk() {
    let secret: Field = 99999;
    let n1 = compute_nullifier(secret, 11111);
    let n2 = compute_nullifier(secret, 22222);
    assert(n1 != n2, "Different nsk must produce different nullifier");
}

#[test]
fn test_commitment_deterministic() {
    let c1 = compute_commitment(100, 200, 1000, 50, 0xAABBCC);
    let c2 = compute_commitment(100, 200, 1000, 50, 0xAABBCC);
    assert(c1 == c2, "Same inputs must produce same commitment");
}

#[test]
fn test_commitment_sensitivity_amount() {
    let c1 = compute_commitment(100, 200, 1000, 50, 0xAABBCC);
    let c2 = compute_commitment(100, 200, 1001, 50, 0xAABBCC);
    assert(c1 != c2, "Different amount must produce different commitment");
}

#[test]
fn test_commitment_sensitivity_block() {
    let c1 = compute_commitment(100, 200, 1000, 50, 0xAABBCC);
    let c2 = compute_commitment(100, 200, 1000, 51, 0xAABBCC);
    assert(c1 != c2, "Different block must produce different commitment");
}

#[test]
fn test_commitment_sensitivity_depositor() {
    let c1 = compute_commitment(100, 200, 1000, 50, 0xAABBCC);
    let c2 = compute_commitment(100, 200, 1000, 50, 0xDDEEFF);
    assert(c1 != c2, "Different depositor must produce different commitment");
}

#[test]
fn test_commitment_sensitivity_npk() {
    let c1 = compute_commitment(100, 200, 1000, 50, 0xAABBCC);
    let c2 = compute_commitment(100, 300, 1000, 50, 0xAABBCC);
    assert(c1 != c2, "Different npk must produce different commitment");
}

#[test]
fn test_merkle_pair_order() {
    let a: Field = 0x01;
    let b: Field = 0x02;
    let h_ab = poseidon2_merkle(a, b);
    let h_ba = poseidon2_merkle(b, a);
    assert(h_ab != h_ba, "poseidon2(a,b) must differ from poseidon2(b,a)");
}

#[test]
fn test_merkle_root_single_level() {
    let leaf: Field = 0x11;
    let sibling: Field = 0x22;
    let expected = poseidon2_merkle(leaf, sibling);

    let mut siblings: [Field; TREE_DEPTH] = [0; TREE_DEPTH];
    siblings[0] = sibling;
    let path_indices: [u1; TREE_DEPTH] = [0; TREE_DEPTH];

    let root = compute_merkle_root(leaf, siblings, path_indices);

    // Manually compute: level 0 = poseidon2(leaf, sibling), then chain with zeros
    let mut manual = expected;
    for _ in 1..TREE_DEPTH {
        manual = poseidon2_merkle(manual, 0);
    }
    assert(root == manual, "Merkle root must match manual computation");
}

#[test]
fn test_merkle_root_right_path() {
    let leaf: Field = 0x33;
    let sibling: Field = 0x44;

    let mut siblings: [Field; TREE_DEPTH] = [0; TREE_DEPTH];
    siblings[0] = sibling;
    let mut path_indices: [u1; TREE_DEPTH] = [0; TREE_DEPTH];
    path_indices[0] = 1;

    let root = compute_merkle_root(leaf, siblings, path_indices);

    let mut manual = poseidon2_merkle(sibling, leaf);
    for _ in 1..TREE_DEPTH {
        manual = poseidon2_merkle(manual, 0);
    }
    assert(root == manual, "Right-path merkle root must match manual computation");
}

#[test]
fn test_domain_separators_distinct() {
    assert(DOMAIN_COMMITMENT != DOMAIN_NULLIFIER);
    assert(DOMAIN_NULLIFIER != DOMAIN_MERKLE);
    assert(DOMAIN_MERKLE != DOMAIN_NPK);
    assert(DOMAIN_COMMITMENT != DOMAIN_NPK);
}

#[test]
fn test_registration_root_single_level_generic() {
    let leaf: Field = 0x55;
    let sibling: Field = 0x66;

    let mut siblings: [Field; 16] = [0; 16];
    siblings[0] = sibling;
    let path_indices: [u1; 16] = [0; 16];

    let root = compute_merkle_root_n(leaf, siblings, path_indices);

    let mut manual = poseidon2_merkle(leaf, sibling);
    for _ in 1..16 {
        manual = poseidon2_merkle(manual, 0);
    }
    assert(root == manual, "Registration root must match manual computation");
}

#[test]
fn test_registration_root_right_path_generic() {
    let leaf: Field = 0x77;
    let sibling: Field = 0x88;

    let mut siblings: [Field; 16] = [0; 16];
    siblings[0] = sibling;
    let mut path_indices: [u1; 16] = [0; 16];
    path_indices[0] = 1;

    let root = compute_merkle_root_n(leaf, siblings, path_indices);

    let mut manual = poseidon2_merkle(sibling, leaf);
    for _ in 1..16 {
        manual = poseidon2_merkle(manual, 0);
    }
    assert(root == manual, "Right-path registration root must match");
}
