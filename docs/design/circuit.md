# ZK Circuit

> `circuits/src/main.nr` — Poseidon2 기반 ZK 회로, 6개 제약조건

## Circuit Signature

```noir
fn main(
    // Private inputs (11)
    secret: Field,
    nullifier_secret_key: Field,
    nullifier_pub_key: Field,
    merkle_siblings: [Field; 32],
    path_indices: [u1; 32],
    note_amount: Field,
    note_block_number: Field,
    note_depositor: Field,
    transfer_amount: Field,
    registration_siblings: [Field; 16],
    registration_path_indices: [u1; 16],

    // Public inputs (6)
    expected_root: pub Field,
    nullifier: pub Field,
    amount: pub Field,
    recipient: pub Field,
    compliance_hash: pub Field,
    expected_registration_root: pub Field,
)
```

---

## 6 Constraints

| # | 검증 | 수식 | 목적 |
|---|------|------|------|
| 1 | NPK 바인딩 | `poseidon2([nsk, DOMAIN_NPK]) == npk` | 키 소유권 |
| 2 | Merkle 포함 | `merkle_root(commitment, siblings, path) == expected_root` | 예치 존재 증명 |
| 3 | Nullifier 정합성 | `poseidon2([secret, nsk, DOMAIN_NULLIFIER]) == nullifier` | 이중지불 방지 |
| 4 | 금액 유효성 | `transfer_amount > 0 && transfer_amount <= note_amount` | 부분 출금 지원 |
| 5 | Compliance Hash | `poseidon2([depositor, recipient, amount, secret, DOMAIN_COMPLIANCE]) == compliance_hash` | 규제 바인딩 (secret salt로 brute-force 방어) |
| 6 | Registration | `merkle_root(npk, reg_siblings, reg_path) == expected_registration_root` | KYC-bound NPK 검증 |

### 보안 모델

- **Alice (예치자)**: secret 알지만 Bob의 nsk 모름 → 출금 불가
- **Bob (수신자)**: ECIES로 secret 수신 + 자신의 nsk 보유 → 출금 가능
- **제3자**: secret도 nsk도 없음 → Nullifier 생성 불가

---

## Poseidon2 Sponge (t=4, rate=3, capacity=1)

`poseidon2_permutation(state, 4)`를 직접 사용한 sponge 구현.

| 함수 | 입력 수 | 흡수 패턴 | 용도 |
|------|--------|----------|------|
| `poseidon2_hash_2` | 2 | partial(2/3) | NPK 도출 |
| `poseidon2_hash_3` | 3 | full(3/3) | Nullifier, Merkle 노드 |
| `poseidon2_hash_5` | 5 | full(3) + partial(2/3) | Compliance hash (secret salt) |
| `poseidon2_hash_6` | 6 | full(3) + full(3) | Commitment |

### Domain Separators

```
DOMAIN_COMMITMENT = 1   DOMAIN_NULLIFIER = 2   DOMAIN_MERKLE = 3
DOMAIN_COMPLIANCE = 4   DOMAIN_NPK = 5
```

---

## Crypto Library

회로, 시퀀서, SDK에서 동일 로직을 3곳에서 구현. **동일 입력 → 동일 출력** 보장.

| 구현 | 위치 | Poseidon2 백엔드 | 환경 |
|------|------|-----------------|------|
| Circuit | `circuits/src/main.nr` | `std::poseidon2_permutation` | Noir 컴파일러 |
| Node.js | `packages/sequencer/src/crypto.ts` | `@aztec/foundation` (Fr) | Node.js |
| Browser | `packages/sdk/src/core/crypto.ts` | `@aztec/bb.js` (WASM) | 브라우저 |
| Scripts | `scripts/lib/crypto.ts` | `@aztec/foundation` (Fr) | Node.js (E2E/벡터 생성) |

### 주요 함수 (`packages/sequencer/src/crypto.ts`)

| 함수 | 용도 |
|------|------|
| `computeNpk(nsk)` | NPK 도출 |
| `computeCommitment(...)` | Note commitment |
| `computeNullifier(secret, nsk)` | 이중지불 방지 토큰 |
| `computeComplianceHash(depositor, recipient, amount, secret)` | 규제 바인딩 해시 (secret salt) |
| `poseidon2Merkle(left, right)` | Merkle 트리 노드 |
| `encryptNote(pubKey, noteData)` | 수신자 ECIES 암호화 |
| `decryptNote(privKey, ...)` | 수신자 ECIES 복호화 |
| `encryptOperatorNote(opPubKey, secret)` | Operator note ECIES 암호화 |
| `decryptOperatorNote(privKey, ...)` | Operator note ECIES 복호화 |
| `computeViewTag(privKey, pubKey)` | 빠른 note 필터링 |

### ECIES Note Format

```
Recipient note: [ephemeralPubKey (33B) | ciphertext (128B) | viewTag (1B)] = 162 bytes
Operator note:  [ephemeralPubKey (33B) | ciphertext (32B)]                 =  65 bytes
Full payload:   [recipientNote (162B) | operatorNote (65B)]                = 227 bytes
```

- Operator note encrypts only `secret` (1 Field = 32B) for compliance_hash verification
- Backward compatible: 162B (legacy) vs 227B (new) — determined by payload length

- 입력: secret(32) + amount(32) + blockNumber(32) + depositor(32) = 128B
- KDF: `keccak256(ECDH_shared_point ++ counter)` → 128B 키
- 암호화: XOR (stream cipher)

---

## Performance (Poseidon2 vs keccak256)

| 지표 | keccak256 | Poseidon2 | 개선 |
|------|-----------|-----------|------|
| Expression Width | 7,065 | 207 | 34x |
| Proving 시간 | 5.14s | 0.18s | 29x |
| 피크 메모리 | 1.74GB | 34MB | 51x |

---

## CLI

```bash
nargo compile                    # 컴파일
nargo test                       # 38 unit tests
nargo execute                    # witness 생성 (Prover.toml 사용)

bb prove -b target/latent_circuit.json -w target/latent_circuit.gz \
  -o target/proof --write_vk -t evm     # 증명 + VK 생성 (--write_vk 필수, -t evm 필수)
bb verify -p target/proof -k target/proof/vk   # 검증
```

> `bb write_vk` 단독 사용 시 VK 비결정성 문제. 반드시 `bb prove --write_vk` 사용.

### Verifier 재생성

회로 변경 후 온체인 Verifier를 갱신하려면:

```bash
bb write_solidity_verifier -k circuits/target/proof/vk \
  -o contracts/src/UltraVerifier.sol
```

**검증 체크리스트**:
- `NUMBER_OF_PUBLIC_INPUTS`: 공개 입력 수에 따라 결정 (현재 6개 → 22)
- `target/proof/public_inputs` 크기: `공개 입력 수 × 32 bytes` (현재 192 bytes)
- `forge test -vv`: Verifier.t.sol 3개 테스트 통과 확인
