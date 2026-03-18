use std::hash::poseidon2_permutation;

// ============================================================
// Latent Privacy Circuit -- Poseidon2
//
// Verifies:
//   1. NPK binding: npk == poseidon2([nsk, DOMAIN_NPK])
//   2. Merkle inclusion: commitment exists in the tree (depth 32)
//   3. Nullifier correctness: derived from secret + nsk
//   4. Amount validity: transfer_amount <= note_amount
//   5. Compliance hash: binds depositor + recipient + amount + secret
//   6. Registration: npk exists in Registration Tree (depth 16)
//
// Security: Only the holder of both `secret` AND `nsk` can withdraw,
//           AND their npk must be registered (KYC-bound).
//   - Alice (depositor) knows secret but NOT nsk -> cannot withdraw
//   - Bob (recipient) knows nsk AND receives secret via ECIES -> can withdraw
//   - Unregistered user -> proof generation fails (constraint 6)
// ============================================================

// Domain separators to prevent cross-context hash collisions
global DOMAIN_COMMITMENT: Field = 1;
global DOMAIN_NULLIFIER: Field = 2;
global DOMAIN_MERKLE: Field = 3;
global DOMAIN_COMPLIANCE: Field = 4;
global DOMAIN_NPK: Field = 5;

// Registration tree depth (max 65,536 registered users)
global REGISTRATION_DEPTH: u32 = 16;

fn main(
    // Private inputs
    secret: Field,
    nullifier_secret_key: Field,
    nullifier_pub_key: Field,
    merkle_siblings: [Field; 32],
    path_indices: [u1; 32],
    note_amount: Field,
    note_block_number: Field,
    note_depositor: Field,
    transfer_amount: Field,
    registration_siblings: [Field; REGISTRATION_DEPTH],
    registration_path_indices: [u1; REGISTRATION_DEPTH],

    // Public inputs (6 Fields)
    expected_root: pub Field,
    nullifier: pub Field,
    amount: pub Field,
    recipient: pub Field,
    compliance_hash: pub Field,
    expected_registration_root: pub Field,
) {
    // 1. Verify NPK binding: npk must derive from nsk
    let computed_npk = compute_npk(nullifier_secret_key);
    assert(computed_npk == nullifier_pub_key, "NPK does not match NSK");

    // 2. Verify commitment and Merkle inclusion
    let commitment = compute_commitment(
        secret,
        nullifier_pub_key,
        note_amount,
        note_block_number,
        note_depositor,
    );
    let computed_root = compute_merkle_root(commitment, merkle_siblings, path_indices);
    assert(computed_root == expected_root, "Merkle root mismatch");

    // 3. Verify nullifier (requires both secret AND nsk)
    let computed_nullifier = compute_nullifier(secret, nullifier_secret_key);
    assert(computed_nullifier == nullifier, "Nullifier mismatch");

    // 4. Verify amount constraints (u64 range + bounds)
    assert(transfer_amount as u64 > 0, "Transfer amount must be positive");
    assert(amount == transfer_amount, "Public amount mismatch");
    assert(transfer_amount as u64 <= note_amount as u64, "Insufficient note balance");

    // 4.5 Verify recipient fits in 160 bits (Ethereum address range)
    //     to_be_bytes::<20> constrains recipient < 2^160, preventing
    //     truncation mismatch between circuit Field and contract address.
    let _: [u8; 20] = recipient.to_be_bytes();

    // 5. Verify compliance hash (salted with secret to prevent brute-force)
    let computed_compliance_hash = compute_compliance_hash(
        note_depositor, recipient, transfer_amount, secret,
    );
    assert(computed_compliance_hash == compliance_hash, "Compliance hash mismatch");

    // 6. Verify sender is registered (npk exists in Registration Tree)
    let computed_registration_root = compute_merkle_root_n(
        nullifier_pub_key,
        registration_siblings,
        registration_path_indices,
    );
    assert(
        computed_registration_root == expected_registration_root,
        "NPK not in registration tree",
    );
}

// ============================================================
// Poseidon2 Sponge Construction
//
// Uses poseidon2_permutation (t=4, rate=3, capacity=1).
// Matches the Noir stdlib internal Poseidon2::hash behavior:
//   absorb inputs into state[0..rate], permute when rate is full,
//   final permute for remaining, squeeze state[0].
// ============================================================

// Sponge hash for 2 inputs: one partial absorb + squeeze
fn poseidon2_hash_2(a: Field, b: Field) -> Field {
    let mut state: [Field; 4] = [0; 4];
    state[0] = a;
    state[1] = b;
    // cache_size=2, not full (rate=3), squeeze triggers final permutation
    let result = poseidon2_permutation(state, 4);
    result[0]
}

// Sponge hash for 3 inputs: one full absorb, no extra squeeze permutation
fn poseidon2_hash_3(a: Field, b: Field, c: Field) -> Field {
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
fn poseidon2_hash_5(a: Field, b: Field, c: Field, d: Field, e: Field) -> Field {
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
fn poseidon2_hash_6(
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
fn compute_npk(nsk: Field) -> Field {
    poseidon2_hash_2(nsk, DOMAIN_NPK)
}

// commitment = poseidon2([secret, npk, amount, block, depositor, DOMAIN_COMMITMENT])
fn compute_commitment(
    secret: Field,
    npk: Field,
    amount: Field,
    block_number: Field,
    depositor: Field,
) -> Field {
    poseidon2_hash_6(secret, npk, amount, block_number, depositor, DOMAIN_COMMITMENT)
}

// nullifier = poseidon2([secret, nsk, DOMAIN_NULLIFIER])
fn compute_nullifier(secret: Field, nsk: Field) -> Field {
    poseidon2_hash_3(secret, nsk, DOMAIN_NULLIFIER)
}

// compliance_hash = poseidon2([depositor, recipient, amount, secret, DOMAIN_COMPLIANCE])
fn compute_compliance_hash(depositor: Field, recipient: Field, amount: Field, secret: Field) -> Field {
    poseidon2_hash_5(depositor, recipient, amount, secret, DOMAIN_COMPLIANCE)
}

// Merkle node hash with domain separation
fn poseidon2_merkle(left: Field, right: Field) -> Field {
    poseidon2_hash_3(left, right, DOMAIN_MERKLE)
}

// Compute Merkle root from leaf and proof path (32-level tree)
fn compute_merkle_root(
    leaf: Field,
    siblings: [Field; 32],
    path_indices: [u1; 32],
) -> Field {
    let mut current = leaf;
    for i in 0..32 {
        if path_indices[i] == 0 {
            current = poseidon2_merkle(current, siblings[i]);
        } else {
            current = poseidon2_merkle(siblings[i], current);
        }
    }
    current
}

// Compute Merkle root for arbitrary-depth tree (used for registration tree)
fn compute_merkle_root_n<let N: u32>(
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
fn test_compliance_hash_deterministic() {
    let h1 = compute_compliance_hash(0xAABBCC, 0xDDEEFF, 1000, 42);
    let h2 = compute_compliance_hash(0xAABBCC, 0xDDEEFF, 1000, 42);
    assert(h1 == h2, "Same inputs must produce same compliance hash");
}

#[test]
fn test_compliance_hash_sensitivity_amount() {
    let h1 = compute_compliance_hash(0xAABBCC, 0xDDEEFF, 1000, 42);
    let h2 = compute_compliance_hash(0xAABBCC, 0xDDEEFF, 1001, 42);
    assert(h1 != h2, "Different amount must produce different compliance hash");
}

#[test]
fn test_compliance_hash_sensitivity_depositor() {
    let h1 = compute_compliance_hash(0xAABBCC, 0xDDEEFF, 1000, 42);
    let h2 = compute_compliance_hash(0x112233, 0xDDEEFF, 1000, 42);
    assert(h1 != h2, "Different depositor must produce different compliance hash");
}

#[test]
fn test_compliance_hash_sensitivity_recipient() {
    let h1 = compute_compliance_hash(0xAABBCC, 0xDDEEFF, 1000, 42);
    let h2 = compute_compliance_hash(0xAABBCC, 0x112233, 1000, 42);
    assert(h1 != h2, "Different recipient must produce different compliance hash");
}

#[test]
fn test_compliance_hash_sensitivity_secret() {
    let h1 = compute_compliance_hash(0xAABBCC, 0xDDEEFF, 1000, 42);
    let h2 = compute_compliance_hash(0xAABBCC, 0xDDEEFF, 1000, 43);
    assert(h1 != h2, "Different secret must produce different compliance hash");
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

    let mut siblings: [Field; 32] = [0; 32];
    siblings[0] = sibling;
    let path_indices: [u1; 32] = [0; 32];

    let root = compute_merkle_root(leaf, siblings, path_indices);

    // Manually compute: level 0 = poseidon2(leaf, sibling), then chain with zeros
    let mut manual = expected;
    for _ in 1..32 {
        manual = poseidon2_merkle(manual, 0);
    }
    assert(root == manual, "Merkle root must match manual computation");
}

#[test]
fn test_merkle_root_right_path() {
    let leaf: Field = 0x33;
    let sibling: Field = 0x44;

    let mut siblings: [Field; 32] = [0; 32];
    siblings[0] = sibling;
    let mut path_indices: [u1; 32] = [0; 32];
    path_indices[0] = 1;

    let root = compute_merkle_root(leaf, siblings, path_indices);

    let mut manual = poseidon2_merkle(sibling, leaf);
    for _ in 1..32 {
        manual = poseidon2_merkle(manual, 0);
    }
    assert(root == manual, "Right-path merkle root must match manual computation");
}

#[test]
fn test_amount_valid() {
    let note_amount: u64 = 1000;
    let transfer_amount: u64 = 500;
    assert(transfer_amount <= note_amount, "Amount should be valid");
}

#[test]
fn test_amount_exact() {
    let note_amount: u64 = 1000;
    let transfer_amount: u64 = 1000;
    assert(transfer_amount <= note_amount, "Exact amount should be valid");
}

#[test(should_fail)]
fn test_amount_overflow() {
    let note_amount: u64 = 1000;
    let transfer_amount: u64 = 1001;
    assert(transfer_amount <= note_amount, "Should fail: insufficient balance");
}

#[test(should_fail)]
fn test_zero_amount_rejected() {
    let transfer_amount: u64 = 0;
    assert(transfer_amount > 0, "Transfer amount must be positive");
}

#[test]
fn test_domain_separators_distinct() {
    assert(DOMAIN_COMMITMENT != DOMAIN_NULLIFIER);
    assert(DOMAIN_NULLIFIER != DOMAIN_MERKLE);
    assert(DOMAIN_MERKLE != DOMAIN_COMPLIANCE);
    assert(DOMAIN_COMPLIANCE != DOMAIN_NPK);
    assert(DOMAIN_COMMITMENT != DOMAIN_NPK);
}

// ============================================================
// Registration Tree Tests
// ============================================================

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

#[test]
fn test_registration_depth_constant() {
    assert(REGISTRATION_DEPTH == 16, "Registration depth must be 16");
}

// ============================================================
// Recipient Range Check Tests
// ============================================================

// --- Valid values ---

#[test]
fn test_recipient_160bit_max() {
    // Max Ethereum address: 2^160 - 1
    let max_addr: Field = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;
    let _: [u8; 20] = max_addr.to_be_bytes();
}

#[test]
fn test_recipient_160bit_max_minus_one() {
    // 2^160 - 2: second-to-last valid address
    let addr: Field = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFE;
    let _: [u8; 20] = addr.to_be_bytes();
}

#[test]
fn test_recipient_typical_address() {
    let addr: Field = 0xA11CE;
    let _: [u8; 20] = addr.to_be_bytes();
}

#[test]
fn test_recipient_zero() {
    // Zero is a valid 160-bit value (lower boundary)
    let addr: Field = 0;
    let _: [u8; 20] = addr.to_be_bytes();
}

#[test]
fn test_recipient_one() {
    let addr: Field = 1;
    let _: [u8; 20] = addr.to_be_bytes();
}

#[test]
fn test_recipient_2_pow_159() {
    // Midpoint of 160-bit range
    let addr: Field = 0x8000000000000000000000000000000000000000;
    let _: [u8; 20] = addr.to_be_bytes();
}

#[test]
fn test_recipient_high_byte_max() {
    // Only highest byte of 20 bytes set to 0xFF
    let addr: Field = 0xFF00000000000000000000000000000000000000;
    let _: [u8; 20] = addr.to_be_bytes();
}

// --- Invalid values (must fail) ---

#[test(should_fail)]
fn test_recipient_exceeds_160bit_exact() {
    // 2^160 -- smallest invalid value
    let too_big: Field = 0x10000000000000000000000000000000000000000;
    let _: [u8; 20] = too_big.to_be_bytes();
}

#[test(should_fail)]
fn test_recipient_exceeds_160bit_by_one() {
    // 2^160 + 1
    let too_big: Field = 0x10000000000000000000000000000000000000001;
    let _: [u8; 20] = too_big.to_be_bytes();
}

#[test(should_fail)]
fn test_recipient_truncation_attack() {
    // Attack scenario: 2^160 + 0xA11CE truncates to 0xA11CE in Solidity
    // Circuit must reject this to prevent compliance hash / recipient mismatch
    let malicious: Field = 0x100000000000000000000000000000000000A11CE;
    let _: [u8; 20] = malicious.to_be_bytes();
}

#[test(should_fail)]
fn test_recipient_large_field_value() {
    // 2^200 -- far above the valid range
    let huge: Field = 0x100000000000000000000000000000000000000000000000000;
    let _: [u8; 20] = huge.to_be_bytes();
}

#[test(should_fail)]
fn test_recipient_bn254_field_max() {
    // BN254 Fr modulus - 1 (max possible Field value)
    let p_minus_1: Field = 21888242871839275222246405745257275088548364400416034343698204186575808495616;
    let _: [u8; 20] = p_minus_1.to_be_bytes();
}
