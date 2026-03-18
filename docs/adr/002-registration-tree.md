# ADR-002: Registration Tree — KYC 바인딩 via ZK Proof

> Status: Accepted | Date: 2026-02-25

## Context

현재 CPS는 **누구나** deposit/withdraw 할 수 있다. Compliance hash가 depositor/recipient/amount를 바인딩하지만, 이들이 **적법한 사용자(KYC 통과)인지 온체인에서 강제하지 않는다**. Operator의 오프체인 판단에만 의존하며, 이는 우회 가능하다 (직접 컨트랙트 호출).

### 해결해야 할 문제

1. **수신자 적법성**: recipient의 `npk`/`encPubKey`가 operator에게 등록된 값인지 검증
2. **송신자 적법성**: withdrawal 시 proof 생성자가 등록된 사용자인지 검증
3. **검증 강제성**: 오프체인 검증은 우회 가능 → ZK 회로 레벨에서 강제 필요

## Decision

**Registration Merkle Tree (depth 16)** 를 도입하고, ZK 회로에 6번째 제약조건을 추가한다.

### Registration Flow

```
사용자 → KYC 통과 → operator에게 npk 등록
→ operator가 Registration Tree에 npk 삽입
→ registration_root 온체인 제출
```

### 회로 확장

```
제약조건 6: compute_merkle_root(npk, reg_siblings, reg_path) == expected_registration_root
```

- **Registration leaf = `npk` 직접 사용** (추가 해시 불필요)
- 회로가 이미 `npk = poseidon2(nsk, DOMAIN_NPK)` 검증 (제약조건 1)
- 따라서 "nsk를 아는 등록된 사용자만 출금 가능" 이 회로 레벨에서 보장됨

### 레이어별 역할

| 단계 | 검증 주체 | 검증 내용 |
|------|----------|----------|
| **등록** | Operator (오프체인) | KYC 통과 → npk를 Registration Tree에 삽입 |
| **Deposit** | Sequencer (오프체인) | recipient npk가 Registration Tree에 존재하는지 확인 |
| **Withdrawal** | ZK 회로 (온체인 강제) | proof 생성자의 npk가 Registration Tree에 존재 |
| **Attestation** | Operator (오프체인) | compliance_hash 복호화 → KYC 매핑 최종 확인 |

### Deposit 단계 보안

Sequencer가 미등록 recipient의 deposit을 Merkle tree에 삽입 거부. 직접 컨트랙트 호출로 commitment가 큐에 들어가더라도, sequencer가 note tree에 미포함 → recipient가 withdrawal proof 생성 불가.

## 성능 영향 분석

### Tree Depth 선택: 16

| Depth | 최대 사용자 | 추가 Poseidon2 해시 | 증명 시간 증가 |
|:-----:|:---------:|:-----------------:|:------------:|
| 12 | 4,096 | +12 | +32% |
| **16** | **65,536** | **+16** | **+43%** |
| 20 | 1,048,576 | +20 | +54% |

### Proof Generation Time

| 항목 | 변경 전 | 변경 후 (예상) |
|------|:------:|:------------:|
| Poseidon2 해시 수 | ~37 | ~54 (+16 Merkle + 1 비교) |
| 증명 시간 (bb) | 0.18s | **~0.26s** |
| 메모리 | 34MB | ~40MB |

→ 브라우저 UX에 영향 없는 수준 (1초 미만)

### Gas Cost

| 항목 | 변경 전 | 변경 후 | 차이 |
|------|:------:|:------:|:----:|
| Public inputs | 5 Fields | 6 Fields | +1 |
| 추가 SLOAD | — | `knownRegistrationRoots` | +2,100 gas |
| Proof verification | ~2.9M gas | ~2.9M gas | **변동 없음** |
| **총 증가** | | | **~4,200 gas (+0.14%)** |

→ Honk proof verification 비용은 회로 크기와 무관 (constant-size proof)

### 회로 입출력 변경

```diff
 fn main(
     // 기존 private inputs (9개)
     secret, nullifier_secret_key, nullifier_pub_key,
     merkle_siblings: [Field; 32], path_indices: [u1; 32],
     note_amount, note_block_number, note_depositor, transfer_amount,
+    // 추가 private inputs (2개)
+    registration_siblings: [Field; 16],
+    registration_path_indices: [u1; 16],

     // 기존 public inputs (5개)
     expected_root, nullifier, amount, recipient, compliance_hash,
+    // 추가 public input (1개)
+    expected_registration_root: pub Field,
 )
```

## Alternatives Considered

### A. 온체인 Registry (allowlist mapping)

```solidity
mapping(bytes32 => bool) public registeredNpks;
require(registeredNpks[npkHash], "Not registered");
```

- 장점: 구현 단순
- **단점**: npk 해시가 온체인에 노출 → 등록 여부 추적 가능 → 프라이버시 약화

### B. 오프체인 전용 (Sequencer + Operator 검증만)

- 장점: 회로 변경 없음
- **단점**: 직접 컨트랙트 호출로 우회 가능 → 보안 보장 불가

### C. Registration Tree (depth 16) + ZK 회로 강제 ← **선택**

- 장점: 프라이버시 유지 + 온체인 강제
- 단점: 회로 크기 증가
- **선택 근거**: 증명 시간 +43%는 허용 범위이며, 프라이버시와 보안을 모두 만족

## Consequences

### Positive
- 미등록 사용자는 withdrawal proof 생성 자체가 불가능
- Registration root만 온체인 → 개별 등록 정보 비공개
- 기존 5개 제약조건과 독립적 → 사이드 이펙트 없음

### Negative
- Operator가 Registration Tree 관리 책임 추가
- 회로 변경 → UltraVerifier.sol 재생성 필요
- 65,536 사용자 초과 시 회로 업그레이드 필요

### Migration
- 기존 컨트랙트 재배포 필요 (public inputs 수 변경)
- 기존 proof는 호환되지 않음 (회로 변경)
