# ADR-003: Compliance Hash Salt — Secret으로 Brute-Force 방어

- **Status**: Accepted
- **Date**: 2026-02-25
- **Context**: Compliance hash brute-force 역산 취약점

## Problem

`compliance_hash = poseidon2(depositor, recipient, amount, DOMAIN_COMPLIANCE)`의 모든 입력이 Observer에게 공개되어 있어 brute-force로 depositor↔recipient 연결이 가능하다.

| 입력 | 출처 | Observer 접근 |
|------|------|:------------:|
| depositor | deposit tx의 `msg.sender` | O |
| recipient | withdrawal event | O |
| amount | withdrawal event | O |
| DOMAIN_COMPLIANCE | 상수 (4) | O |

Observer가 모든 depositor를 순회하며 `poseidon2(depositor_i, recipient, amount, 4)`를 계산하면 on-chain compliance_hash와 일치하는 depositor를 찾을 수 있다. Depositor 풀이 작으면 사실상 즉시 역산 가능.

## Decision Drivers

- Observer의 depositor↔recipient 연결 차단이 핵심 프라이버시 요구사항
- Operator는 compliance 검증을 위해 모든 정보에 접근 가능해야 함
- Circuit public inputs 변경 없이 해결해야 함 (compliance_hash는 여전히 1개 Field)
- 기존 `secret` 값을 재활용하여 추가 엔트로피 도입 없이 해결 가능

## Considered Options

### Option 1: Secret Salt (Chosen)

기존 note의 `secret` (128-bit+ CSPRNG)을 compliance_hash에 salt로 추가.

```
compliance_hash = poseidon2(depositor, recipient, amount, secret, DOMAIN_COMPLIANCE)
```

Operator가 `secret`을 알아야 하므로, deposit 시 `secret`을 Operator의 공개키로 ECIES 암호화하여 on-chain에 포함 (operator note, 65B).

**장점**: 기존 `secret` 재활용, circuit public inputs 불변, 구현 단순
**단점**: On-chain note payload 65B 증가 (162B → 227B)

### Option 2: 별도 Random Nonce

Compliance 전용 random nonce를 생성하여 salt로 사용.

**기각 사유**: 이미 존재하는 `secret`이 동일 목적을 달성. 별도 nonce는 불필요한 복잡도.

### Option 3: Encryption-Based Compliance

Compliance 정보를 hash 대신 완전히 암호화하여 on-chain에 저장.

**기각 사유**: ZK circuit에서 암호화 검증 불가. 현 구조에서는 hash binding이 필수.

## Decision

**Option 1: Secret Salt**

### Circuit 변경

```noir
// 기존: poseidon2_hash_4(depositor, recipient, amount, DOMAIN_COMPLIANCE)
// 변경: poseidon2_hash_5(depositor, recipient, amount, secret, DOMAIN_COMPLIANCE)
fn compute_compliance_hash(depositor: Field, recipient: Field, amount: Field, secret: Field) -> Field {
    poseidon2_hash_5(depositor, recipient, amount, secret, DOMAIN_COMPLIANCE)
}
```

- `poseidon2_hash_5` 신규 추가 (t=4, rate=3: full absorb + partial 2/3 absorb)
- `poseidon2_hash_4` 제거 (미사용)

### On-Chain Note Payload

```
기존 (194B): [recipientNote: ephPubKey(33B) | ciphertext(128B) | mac(32B) | viewTag(1B)]
변경 (291B): [recipientNote(194B) | operatorNote: ephPubKey(33B) | ciphertext(32B) | mac(32B)]
```

- Operator note = ECIES(operatorPubKey, {secret}) + HMAC-SHA256 — 97 bytes
- Solidity 변경 없음 (`bytes calldata encryptedNote`는 임의 길이 허용)
- Note: MAC 인증은 ADR-004에서 별도 결정

### Operator Pubkey 배포

- `GET /operator/pubkey` 엔드포인트 추가 (인증 불필요 — 공개 정보)
- SDK `LatentClientConfig.operatorEncPubKey` 설정으로 operator note 생성

### 보안 분석

| 주체 | secret 접근 | 자금 탈취 가능 | 이유 |
|------|:-----------:|:------------:|------|
| Bob (수신자) | O | O | secret + nsk 보유 |
| Operator | O (operator note) | **X** | nsk 미보유 — ZK proof 생성 불가 |
| Alice (예치자) | O (생성자) | **X** | nsk 미보유 |
| Observer | **X** | X | secret, nsk 모두 미보유 |

Operator가 `secret`을 알아도 `nsk` 없이는 NPK 도출, nullifier 생성, commitment 재현이 불가능하므로 자금 탈취 위험 없음.

## Consequences

- Compliance hash brute-force 역산 완전 차단
- On-chain storage 97B/deposit 증가 (calldata 비용: ~97 * 16 = 1,552 gas 추가, HMAC 포함)
- Operator가 secret 복호화 실패 시 compliance 검증 불가 → 24h timeout으로 fallback (검열 저항 유지)
- `poseidon2_hash_4`가 회로/TypeScript 모두에서 제거됨 (미사용 코드 정리)
