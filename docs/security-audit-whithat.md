# Privacy Pool V2 - White-Hat Security Audit Report

> **Date**: 2026-02-27
> **Scope**: PrivacyPoolV2.sol, UltraVerifier.sol, ZK Circuit (main.nr), SDK, Sequencer
> **Methodology**: Manual code review + threat modeling

---

## Executive Summary

Latent Privacy Pool V2의 전체 스택(스마트 컨트랙트, ZK 회로, SDK, 시퀀서)에 대한 화이트햇 보안 감사를 수행했다. **자금 탈취 가능성**에 초점을 맞춘 분석 결과, **Critical 3건, High 4건, Medium 3건, Low 3건**의 취약점을 식별했다.

| 심각도 | 건수 | 자금 탈취 가능 |
|--------|------|----------------|
| **Critical** | 3 | Yes |
| **High** | 4 | Conditional |
| **Medium** | 3 | No (DoS/정보유출) |
| **Low** | 3 | No |

---

## CRITICAL Findings

### C-01: Relayer + Operator 공모 시 풀 전체 자금 탈취

**파일**: `contracts/src/PrivacyPoolV2.sol:113-131`
**공격 벡터**: Root Manipulation Attack

#### 취약점 설명

온체인 컨트랙트는 Merkle root의 정당성을 **독립적으로 검증하지 않는다**. `commitments[]` 매핑에 저장된 실제 commitment들로부터 root를 재계산하지 않고, relayer가 제안하고 operator가 확인한 root를 무조건 신뢰한다.

```solidity
// proposeRoot: relayer가 임의의 root를 제안 가능
function proposeRoot(bytes32 newRoot, uint256 processedUpTo) external {
    require(msg.sender == relayer, "Only relayer");
    // !! newRoot가 실제 commitments[]와 일치하는지 검증 없음
    pendingRoot = PendingRoot(newRoot, processedUpTo, true);
}

// confirmRoot: operator가 확인하면 즉시 유효
function confirmRoot(bytes32 expectedRoot, uint256 expectedProcessedUpTo) external {
    require(msg.sender == operator, "Only operator");
    // !! operator도 동일한 root를 제출할 뿐, 온체인 검증 없음
    knownRoots[pendingRoot.root] = true;  // 영구 유효
}
```

#### 공격 시나리오

```
공격자: Relayer 키 + Operator 키 탈취 (또는 내부 공모)

1. 공격자가 가짜 commitment 생성:
   fake_commitment = poseidon2(attacker_secret, attacker_npk, POOL_BALANCE, ...)

2. 실제 commitments[0..N]에 fake_commitment를 추가한 가짜 Merkle tree 구성
   fake_root = merkleRoot([...real_commitments, fake_commitment])

3. Relayer로 proposeRoot(fake_root, N+1) 호출

4. Operator로 confirmRoot(fake_root, N+1) 호출
   → knownRoots[fake_root] = true !!

5. fake_commitment에 대한 유효한 ZK 증명 생성
   (attacker_secret, attacker_nsk 모두 알고 있으므로 가능)

6. initiateWithdrawal(proof, publicInputs) 호출
   → amount = POOL_BALANCE (풀 전체 잔액)

7. attestWithdrawal(nullifier) 즉시 호출 (operator 키 보유)
   또는 24시간 후 claimWithdrawal 호출

결과: 풀의 전체 토큰이 공격자에게 전송됨
```

#### 근본 원인

- 온체인에서 root 무결성을 검증하는 메커니즘 부재
- Relayer와 Operator 2개 키만 탈취하면 전체 자금 탈취 가능
- 확인된 root는 **영구적으로 유효** (`knownRoots`에서 삭제 불가)

#### 권장 조치

```
[단기] Operator를 multisig (Gnosis Safe)로 변경
[단기] Time-lock 추가: root 확인 후 N시간 후에 유효해지도록
[중기] 온체인 commitment 기반 root 재계산 검증 추가
[장기] Optimistic rollup 패턴 + fraud proof 도입
```

---

### C-02: Operator 키 교체 불가 — 영구적 Single Point of Failure

**파일**: `contracts/src/PrivacyPoolV2.sol:85`

#### 취약점 설명

`operator` 주소는 constructor에서 한 번 설정되면 **변경할 방법이 없다**.

```solidity
constructor(address _verifier, address _token, address _operator, address _relayer) {
    operator = _operator;  // 영구 고정
    relayer = _relayer;     // setRelayer()로 변경 가능
}

// setRelayer() 존재하지만 setOperator()는 없음!
function setRelayer(address newRelayer) external {
    require(msg.sender == relayer, "Only relayer");
    relayer = newRelayer;
}
```

#### 공격 시나리오

**시나리오 A: Operator 키 분실**
- 새 root 확인 불가 → 새 입금 처리 불가
- 등록 root 갱신 불가 → 새 사용자 출금 불가
- 출금 attestation 불가 → 모든 출금 24시간 대기 강제
- **결과**: 프로토콜 기능 마비 (자금은 24시간 후 claimWithdrawal로 회수 가능)

**시나리오 B: Operator 키 탈취**
- C-01과 결합 시 자금 탈취 가능
- 키 교체 불가 → **영구적 취약 상태**
- 컨트랙트 재배포 외 대응 방법 없음
- **결과**: 모든 사용자가 새 컨트랙트로 마이그레이션 필요

#### 권장 조치

```solidity
// setOperator() 추가 + timelock 패턴
address public pendingOperator;
uint256 public operatorTransferTime;

function proposeOperator(address newOperator) external {
    require(msg.sender == operator, "Only operator");
    pendingOperator = newOperator;
    operatorTransferTime = block.timestamp + 48 hours;
}

function acceptOperator() external {
    require(msg.sender == pendingOperator);
    require(block.timestamp >= operatorTransferTime);
    operator = pendingOperator;
}
```

---

### C-03: Partial Withdrawal 시 잔액 영구 소실

**파일**: `circuits/src/main.nr` (amount constraint) + `contracts/src/PrivacyPoolV2.sol:153-183`

#### 취약점 설명

ZK 회로가 **부분 출금**(transfer_amount < note_amount)을 허용하지만, **잔액(change) 처리 메커니즘이 없다**.

```noir
// 회로: 부분 출금 허용
assert(transfer_amount as u64 <= note_amount as u64, "Insufficient note balance");
```

```solidity
// 컨트랙트: nullifier 소진 후 amount만 전송
nullifiers[nullifier] = true;           // nullifier 영구 소진
pendingWithdrawals[nullifier] = PendingWithdrawal({
    amount: amount,                      // transfer_amount만 전송
    // note_amount - transfer_amount = 영구 소실!
});
```

#### 공격 시나리오

```
피해자: 100 USDT 노트 보유

1. 실수로 withdraw(amount: 50 USDT) 호출
2. ZK 증명 검증 통과 (50 <= 100)
3. nullifier 소진 (이 노트는 다시 사용 불가)
4. 50 USDT만 수신

결과: 나머지 50 USDT는 풀에 잠겨 영구 회수 불가
       (nullifier가 소진되었으므로 같은 노트로 재출금 불가)
```

이 문제는 의도적 설계일 수 있으나, SDK에서 `amount` 파라미터를 사용자가 직접 지정할 수 있어 **실수로 인한 자금 손실**이 발생할 수 있다.

#### 근본 원인

- UTXO 모델에서 change output이 없음
- 회로의 `<=` 조건이 부분 출금을 허용하지만 잔액 처리 로직 부재

#### 권장 조치

```
[방법 A] 회로에서 전액 출금만 허용:
  assert(transfer_amount == note_amount)

[방법 B] Change note 지원 (Tornado Cash Nova 방식):
  - 출금 시 change commitment도 함께 생성
  - 새 commitment을 트리에 삽입

[최소 조치] SDK에서 부분 출금 방지:
  if (amount !== note.amount) throw Error("Partial withdrawal not supported")
```

---

## HIGH Findings

### H-01: Registration Root Replay — 탈퇴/차단된 사용자의 출금 가능

**파일**: `contracts/src/PrivacyPoolV2.sol:136,162`

#### 취약점 설명

`knownRegistrationRoots`는 한 번 등록되면 **영구 유효**하다. 사용자가 KYC에서 탈퇴하거나 제재 대상이 되어도, 해당 사용자가 포함된 **과거 registration root**를 사용하면 출금이 가능하다.

```solidity
mapping(bytes32 => bool) public knownRegistrationRoots;  // 삭제 메커니즘 없음

function updateRegistrationRoot(bytes32 newRoot) external {
    knownRegistrationRoots[newRoot] = true;  // 추가만 가능, 이전 root 무효화 없음
}

function initiateWithdrawal(...) external {
    require(knownRegistrationRoots[registrationRoot], "Unknown registration root");
    // 최신 root인지 확인하지 않음!
}
```

#### 공격 시나리오

```
1. Alice가 KYC 등록 → registrationRoot_v1에 Alice.npk 포함
2. Alice가 제재 대상으로 분류 → registrationRoot_v2에서 제거
3. Alice가 registrationRoot_v1을 사용하여 출금 시도
4. knownRegistrationRoots[v1] == true → 통과!
5. ZK 증명: Alice.npk가 v1 트리에 포함됨 → 검증 통과!

결과: 제재 대상 사용자가 자금 인출 성공
```

#### 권장 조치

```solidity
// 최신 registration root만 허용
function initiateWithdrawal(...) external {
    require(registrationRoot == currentRegistrationRoot, "Stale registration root");
}

// 또는 epoch 기반 유효 기간 도입
mapping(bytes32 => uint256) public registrationRootEpoch;
```

---

### H-02: Merkle Root 영구 유효 — 폐기된 Root로 출금 가능

**파일**: `contracts/src/PrivacyPoolV2.sol:127`

#### 취약점 설명

`knownRoots`에 저장된 root는 **삭제할 방법이 없다**. C-01 공격이 한 번이라도 성공하면, 악의적 root가 영구적으로 유효하게 남는다.

```solidity
knownRoots[pendingRoot.root] = true;  // 추가만 가능
// removeRoot() 함수 없음
```

#### 권장 조치

```solidity
// Root 무효화 함수 추가 (multisig/governance 제어)
function revokeRoot(bytes32 root) external onlyGovernance {
    delete knownRoots[root];
}
```

---

### H-03: Emergency Pause 메커니즘 부재

**파일**: `contracts/src/PrivacyPoolV2.sol` (전체)

#### 취약점 설명

취약점 발견 시 입금/출금을 중단할 수 있는 **비상 정지 기능이 없다**. 공격이 진행 중이어도 풀을 멈출 방법이 없다.

- `deposit()`: 제한 없이 호출 가능
- `initiateWithdrawal()`: 제한 없이 호출 가능
- `claimWithdrawal()`: 24시간 후 누구나 호출 가능

#### 권장 조치

```solidity
bool public paused;

modifier whenNotPaused() {
    require(!paused, "Paused");
    _;
}

function pause() external {
    require(msg.sender == operator, "Only operator");
    paused = true;
}

function unpause() external {
    require(msg.sender == operator, "Only operator");
    paused = false;
}

function deposit(...) external whenNotPaused { ... }
function initiateWithdrawal(...) external whenNotPaused { ... }
// claimWithdrawal은 검열 저항을 위해 pause 대상에서 제외 고려
```

---

### H-04: 시퀀서 사용자 등록 API 미인증

**파일**: `packages/sequencer/src/api.ts` — `POST /operator/register`

#### 취약점 설명

사용자 등록 엔드포인트에 **인증이 없다**. 누구나 임의의 address + NPK + encPubKey 조합으로 등록할 수 있다.

```typescript
// api.ts: 인증 없이 등록 허용
app.post("/operator/register", async (req, res) => {
    const { address, npk, encPubKey } = req.body;
    // 서명 검증 없음!
    // address 소유권 확인 없음!
    const result = await operator.registerUser(address, npk, encPubKey);
});
```

#### 공격 시나리오

```
1. 공격자가 자신의 NPK를 피해자의 address로 등록
   POST /operator/register { address: victim, npk: attacker_npk, encPubKey: attacker_key }

2. 피해자가 나중에 등록 시도하면 "Address already registered" 실패

3. 결과: 피해자 출금 불가 (등록 트리에 자신의 NPK가 없음)
```

#### 권장 조치

```typescript
// EIP-712 서명 검증 추가
app.post("/operator/register", async (req, res) => {
    const { address, npk, encPubKey, signature } = req.body;
    const recovered = ethers.verifyMessage(
        `Register NPK: ${npk}`, signature
    );
    if (recovered.toLowerCase() !== address.toLowerCase()) {
        return res.status(401).json({ error: "Invalid signature" });
    }
    // ...
});
```

---

## MEDIUM Findings

### M-01: 키 유도의 단일 장애점

**파일**: `packages/sdk/src/core/keys.ts:28-54`

모든 키(nsk, npk, encPrivKey, encPubKey)가 **단일 `personal_sign` 서명**에서 파생된다.

```typescript
const signature = await signer.signMessage(DERIVATION_MESSAGE);
// 이 signature 하나로 모든 키가 결정됨
const nsk = keccak256(signature) % BN254_FR_ORDER;
const encPrivKey = keccak256(seed ++ "enc");
```

**위험**: Signature가 유출되면 nsk, npk, encPrivKey 모두 노출 → 모든 노트 복호화 + nullifier 계산 가능.

`DERIVATION_MESSAGE`가 고정 문자열이므로, 피싱 사이트가 동일한 메시지로 서명을 요청하면 키가 탈취된다.

**권장 조치**: EIP-712 구조화된 서명 사용, 도메인 바인딩 추가.

---

### M-02: ERC-777/Hook 토큰 Reentrancy 가능성

**파일**: `contracts/src/PrivacyPoolV2.sol:98-107` (deposit)

`deposit()`에서 `transferFrom()`을 **상태 변경 전에** 호출한다:

```solidity
function deposit(bytes32 commitment, uint256 amount, bytes calldata encryptedNote) external {
    require(amount > 0, "Zero deposit");
    require(token.transferFrom(msg.sender, address(this), amount), "Transfer failed");
    // ↑ 외부 호출 먼저
    uint256 leafIndex = commitmentCount;  // ↓ 상태 변경 나중
    commitments[leafIndex] = commitment;
    commitmentCount++;
}
```

ERC-777 `tokensToSend` 훅이 있는 토큰의 경우, transferFrom 중 re-enter가 가능하다. 현재 CROSSD 토큰이 순수 ERC-20이라면 문제 없지만, 토큰 변경 시 위험하다.

**권장 조치**: CEI 패턴 적용 또는 ReentrancyGuard 추가.

---

### M-03: Operator가 모든 Secret을 복호화 가능

**파일**: `packages/sdk/src/core/crypto.ts` (encryptOperatorNote)

입금 시 `secret`이 operator에게 암호화되어 전송된다:

```typescript
const operatorNote = encryptOperatorNote(operatorEncPubKey, secret);
```

Operator는 모든 입금의 `secret`을 알 수 있다. `secret` + commitment 정보로 depositor, recipient, amount를 역추적할 수 있다. 이는 설계 의도(compliance)이지만:

- Operator가 `secret`을 알아도 `nsk`를 모르므로 직접 출금은 불가
- 그러나 C-01 공격과 결합하면: operator가 secret을 알고 + fake root를 삽입할 수 있으므로, **자신의 npk로 commitment를 재구성하여 탈취 가능**

**권장 조치**: Operator note 암호화를 선택 사항으로 유지하되, compliance 필요 시 MPC 기반 분산 복호화 고려.

---

## LOW Findings

### L-01: View Tag 프라이버시 누출

**파일**: `packages/sdk/src/core/crypto.ts`

View tag (1바이트)는 약 1/256 확률로 false positive를 생성한다. 시퀀서가 API 접근 패턴을 모니터링하면, 어떤 사용자가 어떤 블록 범위의 노트에 관심이 있는지 추론할 수 있다.

---

### L-02: 회로 테스트 커버리지 갭

**파일**: `circuits/src/main.nr` (test section)

- 제약 조건 간 상호작용 테스트 없음 (예: 올바른 merkle root + 잘못된 nullifier)
- u64 경계값 테스트 없음 (2^64 - 1, 2^64)
- 부분 출금 시나리오 테스트 없음

---

### L-03: 시퀀서 API Rate Limiting 부재

**파일**: `packages/sequencer/src/api.ts`

모든 API 엔드포인트에 rate limiting이 없어 DoS 공격에 취약하다. 특히 `/notes` 엔드포인트는 대량 데이터를 반환하므로 resource exhaustion 가능.

---

## Attack Tree Summary

```
자금 탈취
├── [C-01] Relayer+Operator 키 탈취/공모
│   ├── Fake root 제출 → 가짜 commitment으로 전액 인출
│   └── [C-02] Operator 키 교체 불가 → 영구적 공격 가능
│
├── [C-03] 사용자 실수 유도
│   └── 부분 출금 → 잔액 영구 소실
│
├── [H-01] 제재 대상 사용자
│   └── 과거 registration root로 출금
│
├── [H-04] 시퀀서 등록 사칭
│   └── 피해자 address로 공격자 NPK 등록 → 피해자 출금 차단
│
└── [M-01] 키 유도 피싱
    └── personal_sign 서명 탈취 → 모든 노트 복호화
```

---

## Risk Matrix

```
Impact
  ^
  |  [C-01]●  [C-02]●
  |               [C-03]●
  |  [H-01]○  [H-02]○  [H-03]○
  |                          [H-04]○
  |  [M-01]△  [M-02]△  [M-03]△
  |  [L-01]□  [L-02]□  [L-03]□
  +--------------------------------> Likelihood
     Low      Medium      High

● Critical  ○ High  △ Medium  □ Low
```

---

## Prioritized Remediation Roadmap

### Phase 1 — 즉시 (배포 전 필수)

| # | 조치 | 대상 | 예상 난이도 |
|---|------|------|------------|
| 1 | Operator를 multisig로 교체 | 배포 설정 | 낮음 |
| 2 | `setOperator()` + timelock 추가 | 컨트랙트 | 중간 |
| 3 | Emergency pause 추가 | 컨트랙트 | 낮음 |
| 4 | 부분 출금 방지 (SDK 또는 회로) | SDK/회로 | 낮음 |
| 5 | 등록 API 서명 검증 | 시퀀서 | 중간 |

### Phase 2 — 단기 (출시 후 1개월)

| # | 조치 | 대상 | 예상 난이도 |
|---|------|------|------------|
| 6 | Registration root를 최신만 허용 | 컨트랙트 | 낮음 |
| 7 | Root 무효화 함수 추가 | 컨트랙트 | 낮음 |
| 8 | Rate limiting 추가 | 시퀀서 | 낮음 |
| 9 | EIP-712 키 유도 | SDK | 중간 |

### Phase 3 — 중기 (출시 후 3개월)

| # | 조치 | 대상 | 예상 난이도 |
|---|------|------|------------|
| 10 | Root 제출에 timelock 추가 | 컨트랙트 | 중간 |
| 11 | Change note 지원 (UTXO 모델) | 회로+컨트랙트 | 높음 |
| 12 | Fraud proof / Optimistic 패턴 | 컨트랙트 | 높음 |

---

## Disclaimer

이 리포트는 특정 시점의 코드 스냅샷을 기반으로 한 수동 검토이며, 모든 취약점을 발견했음을 보장하지 않는다. 프로덕션 배포 전 전문 보안 감사 업체의 추가 검토를 권장한다.
