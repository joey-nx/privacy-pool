use lib::{
    compute_npk, compute_commitment, compute_nullifier, compute_merkle_root,
    compute_merkle_root_n, poseidon2_hash_5, TREE_DEPTH,
};

// ============================================================
// Compliance Circuit
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
// ============================================================

global DOMAIN_COMPLIANCE: Field = 4;

// Registration tree depth (max 65,536 registered users)
global REGISTRATION_DEPTH: u32 = 16;

// compliance_hash = poseidon2([depositor, recipient, amount, secret, DOMAIN_COMPLIANCE])
fn compute_compliance_hash(depositor: Field, recipient: Field, amount: Field, secret: Field) -> Field {
    poseidon2_hash_5(depositor, recipient, amount, secret, DOMAIN_COMPLIANCE)
}

fn main(
    // Private inputs
    secret: Field,
    nullifier_secret_key: Field,
    nullifier_pub_key: Field,
    merkle_siblings: [Field; TREE_DEPTH],
    path_indices: [u1; TREE_DEPTH],
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
// Compliance-specific Tests
// ============================================================

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
fn test_registration_depth_constant() {
    assert(REGISTRATION_DEPTH == 16, "Registration depth must be 16");
}

// Amount and recipient tests (shared with privacy circuit)

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
fn test_recipient_160bit_max() {
    let max_addr: Field = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;
    let _: [u8; 20] = max_addr.to_be_bytes();
}

#[test(should_fail)]
fn test_recipient_exceeds_160bit_exact() {
    let too_big: Field = 0x10000000000000000000000000000000000000000;
    let _: [u8; 20] = too_big.to_be_bytes();
}
