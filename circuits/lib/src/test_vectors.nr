// Test vector generator for cross-checking Solidity Poseidon2 implementation.
// Run: cd circuits/lib && nargo test --show-output

use crate::{
    poseidon2_hash_2, poseidon2_hash_3, poseidon2_hash_5, poseidon2_hash_6,
    poseidon2_merkle, compute_npk, compute_commitment, compute_nullifier,
    DOMAIN_COMMITMENT, DOMAIN_NULLIFIER, DOMAIN_MERKLE, DOMAIN_NPK,
};

#[test]
fn test_vector_hash_2() {
    // hash_2(0, 0)
    let r = poseidon2_hash_2(0, 0);
    std::println(f"hash_2(0,0) = {r}");

    // hash_2(1, 2)
    let r2 = poseidon2_hash_2(1, 2);
    std::println(f"hash_2(1,2) = {r2}");

    // hash_2(123456, 789012)
    let r3 = poseidon2_hash_2(123456, 789012);
    std::println(f"hash_2(123456,789012) = {r3}");
}

#[test]
fn test_vector_hash_3() {
    let r = poseidon2_hash_3(0, 0, 0);
    std::println(f"hash_3(0,0,0) = {r}");

    let r2 = poseidon2_hash_3(1, 2, 3);
    std::println(f"hash_3(1,2,3) = {r2}");
}

#[test]
fn test_vector_merkle() {
    // poseidon2_merkle(left, right) = hash_3(left, right, DOMAIN_MERKLE)
    let r = poseidon2_merkle(0, 0);
    std::println(f"merkle(0,0) = {r}");

    let r2 = poseidon2_merkle(1, 2);
    std::println(f"merkle(1,2) = {r2}");
}

#[test]
fn test_vector_hash_5() {
    let r = poseidon2_hash_5(1, 2, 3, 4, 5);
    std::println(f"hash_5(1,2,3,4,5) = {r}");
}

#[test]
fn test_vector_hash_6() {
    let r = poseidon2_hash_6(1, 2, 3, 4, 5, 6);
    std::println(f"hash_6(1,2,3,4,5,6) = {r}");
}
