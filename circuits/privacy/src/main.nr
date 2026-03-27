use lib::{compute_npk, compute_commitment, compute_nullifier, compute_merkle_root, TREE_DEPTH};

// ============================================================
// Privacy Circuit (No Compliance)
//
// Verifies:
//   1. NPK binding: npk == poseidon2([nsk, DOMAIN_NPK])
//   2. Merkle inclusion: commitment exists in the tree (depth 32)
//   3. Nullifier correctness: derived from secret + nsk
//   4. Amount validity: transfer_amount <= note_amount
//
// Security: Only the holder of both `secret` AND `nsk` can withdraw.
//   - Alice (depositor) knows secret but NOT nsk -> cannot withdraw
//   - Bob (recipient) knows nsk AND receives secret via ECIES -> can withdraw
//
// No compliance hash, no registration tree -- pure privacy mode.
// ============================================================

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

    // Public inputs (4 Fields)
    expected_root: pub Field,
    nullifier: pub Field,
    amount: pub Field,
    recipient: pub Field,
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
}

// ============================================================
// Tests
// ============================================================

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

// --- Recipient range checks ---

#[test]
fn test_recipient_160bit_max() {
    let max_addr: Field = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;
    let _: [u8; 20] = max_addr.to_be_bytes();
}

#[test]
fn test_recipient_typical_address() {
    let addr: Field = 0xA11CE;
    let _: [u8; 20] = addr.to_be_bytes();
}

#[test]
fn test_recipient_zero() {
    let addr: Field = 0;
    let _: [u8; 20] = addr.to_be_bytes();
}

#[test(should_fail)]
fn test_recipient_exceeds_160bit_exact() {
    let too_big: Field = 0x10000000000000000000000000000000000000000;
    let _: [u8; 20] = too_big.to_be_bytes();
}

#[test(should_fail)]
fn test_recipient_truncation_attack() {
    let malicious: Field = 0x100000000000000000000000000000000000A11CE;
    let _: [u8; 20] = malicious.to_be_bytes();
}
