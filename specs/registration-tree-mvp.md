# Feature: Registration Tree MVP Integration

## 목적 (Why)

Circuit(constraint 6)과 Contract(`knownRegistrationRoots`)에 이미 구현된 registration tree 검증을 SDK와 Sequencer에서 연결하여, compliant privacy pool의 핵심 가치인 **검증 가능한 KYC compliance**를 MVP에서 입증한다.

## 결정사항 (What)

- Circuit과 Contract는 변경하지 않음 (이미 완성)
- Sequencer에 in-memory `IncrementalMerkleTree(depth=16)` 인스턴스 추가
- `registerUser()` 시 NPK를 registration tree에 삽입하고, 루트를 on-chain에 제출
- SDK `WithdrawalInputs`에 registration 3개 필드 추가
- SDK `client.withdraw()`에서 sequencer로부터 registration proof를 받아 circuit input에 포함
- MVP 단순화: tree persistence 없음 (서버 재시작 시 등록된 사용자 목록으로부터 재구축)

## 변경 범위

### Layer 1: Sequencer — Registration Tree 관리

#### 1a. `OperatorService`에 registration tree 추가

```
operator.ts 변경:
- IncrementalMerkleTree(REGISTRATION_DEPTH) 인스턴스 필드 추가
- init()에서 persisted users를 순서대로 tree에 삽입하여 재구축
- registerUser()에서 NPK를 tree에 삽입 → root를 on-chain 제출
- getRegistrationProof(npk) 메서드 추가 → leafIndex 조회 + tree.getProof()
- getRegistrationRoot() 메서드 추가
```

#### 1b. Registration root on-chain 제출

```
chain.ts 변경:
- POOL_ABI에 updateRegistrationRoot(bytes32) 추가
- operator가 사용하는 별도 wallet (operatorKey) 로 tx 제출
  → ChainSync가 아닌 OperatorService에서 직접 contract 호출
```

#### 1c. API 엔드포인트

```
api.ts 변경:
- GET /registration/proof/:npk — registration tree의 Merkle proof 반환
  (인증 불필요 — proof 자체는 공개 정보)
- GET /registration/root — 현재 registration root 반환
```

### Layer 2: SDK — WithdrawalInputs 확장

#### 2a. Types

```
types.ts 변경:
- WithdrawalInputs에 3개 필드 추가:
  registrationSiblings: bigint[]
  registrationPathIndices: number[]
  expectedRegistrationRoot: bigint
```

#### 2b. Witness Generation

```
witness.ts 변경:
- circuitInputs에 3개 필드 매핑:
  registration_siblings → inputs.registrationSiblings
  registration_path_indices → inputs.registrationPathIndices
  expected_registration_root → inputs.expectedRegistrationRoot
```

#### 2c. Sequencer Client

```
sequencer.ts 변경:
- getRegistrationProof(npk: string) 메서드 추가
- getRegistrationRoot() 메서드 추가

types.ts 변경:
- RegistrationProofResponse 인터페이스 추가
```

#### 2d. Client withdrawal flow

```
client.ts 변경:
- withdraw() Stage 1.5: sequencer에서 registration proof 조회
- withdrawalInputs에 registration 필드 포함
```

### Layer 3: Cross-check Test 업데이트

```
circuit-cross-check.test.ts 변경:
- WithdrawalInputs 완전성 테스트: .toBe(false) → .toBe(true)
```

## 시나리오 (Scenarios)

### 정상 케이스

**S1: KYC 등록 → registration root on-chain 제출**
- Given: Operator가 활성화된 sequencer
- When: POST /operator/register로 user 등록
- Then: NPK가 registration tree에 삽입되고, on-chain에 updateRegistrationRoot 호출됨

**S2: 등록된 사용자가 출금**
- Given: registration tree에 NPK가 등록된 사용자
- When: SDK에서 withdraw() 호출
- Then: sequencer에서 registration proof를 받고, circuit input에 포함하여 증명 생성 → on-chain 검증 통과

**S3: 서버 재시작 후 registration tree 복구**
- Given: 등록된 사용자 3명이 persisted users에 존재
- When: sequencer 재시작
- Then: init()에서 3명의 NPK를 순서대로 tree에 삽입하여 동일한 root 재구축

### 경계값

**S4: 첫 번째 사용자 등록 (빈 tree → 1 leaf)**
- Given: registration tree가 비어있음
- When: 첫 사용자 등록
- Then: root가 `sparse_proof(npk, index=0, depth=16).root`와 일치

**S5: 중복 등록 시도**
- Given: NPK "0x123..." 이 이미 등록됨
- When: 동일 NPK로 재등록 시도
- Then: 409 에러 반환, tree 상태 변경 없음

### 실패 케이스

**S6: 미등록 사용자 출금 시도**
- Given: NPK가 registration tree에 없는 사용자
- When: SDK에서 withdraw() 호출
- Then: sequencer가 404 반환 (registration proof 없음), 출금 불가

**S7: Registration root가 on-chain에 없는 상태에서 출금**
- Given: registration root 제출이 실패한 상태
- When: 사용자가 직접 proof를 만들어 initiateWithdrawal() 호출
- Then: contract에서 "Unknown registration root" 로 revert

## 범위 밖 (Out of scope)

- Registration tree persistence (별도 JSON 파일) — 재시작 시 users 목록에서 재구축
- 사용자 등록 해제 (KYC revocation)
- Registration root 제출 배치 최적화
- Dual-approval (registration root는 operator 단독 제출)
- Frontend UI (등록 화면)
