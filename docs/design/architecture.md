# System Architecture

> Privacy for the public, Transparency for regulators

## 1. Overview

### 문제와 해답

| 기존 블록체인 | 기존 프라이버시 (Tornado Cash) | Latent |
|---|---|---|
| 모든 거래가 공개 | 완전 익명 → OFAC 제재 | 조건부 프라이버시 |

**4계층 메커니즘**:

| 계층 | 기술 | 보호 대상 |
|------|------|-----------|
| Privacy Pool | Poseidon2 Merkle + ZK Proof | 송신자 익명화 |
| 2-Stage Withdrawal | 운영자 승인 + 24h timeout | 규제 통제 + 검열 저항 |
| Stealth Address | ECIES (secp256k1 ECDH) | 수신자 익명화 |
| Compliance Hash | 인서킷 해시 바인딩 + ECIES | 규제 준수 데이터 |

### 접근 권한

| 정보 | 관찰자 | 수신자 | 운영자 |
|------|--------|--------|--------|
| 전송 금액 / 스텔스 주소 | O | O | O |
| **실제 송신자** | **X** | **X** | **O** |
| **실제 수신자** | **X** | O (본인) | **O** |
| **거래 연결 (Alice↔Bob)** | **X** | **X** | **O** |

---

## 2. System Diagram

```mermaid
graph TB
    subgraph Client["Client Layer"]
        Frontend["Frontend (Next.js)"]
        SDK["@latent/sdk<br/>ZK Proving + ethers.js"]
        WASM["bb.js WASM"]
        Frontend --> SDK --> WASM
    end

    subgraph Infra["Off-Chain Infrastructure"]
        Sequencer["@latent/sequencer<br/>Merkle Tree + Scanner + Operator"]
        Store[(JSON Persistence)]
        Sequencer --> Store
    end

    subgraph Chain["On-Chain (EVM)"]
        Pool["PrivacyPoolV2"]
        Verifier["HonkVerifier"]
        Token["ERC20 Token"]
        Pool --> Verifier
        Pool --> Token
    end

    SDK -->|"EIP-1193"| MetaMask["MetaMask"]
    SDK -->|"REST API"| Sequencer
    MetaMask -->|"tx signing"| Pool
    Sequencer -->|"proposeRoot / confirmRoot / attestWithdrawal"| Pool
    Pool -->|"events"| Sequencer
```

### 컴포넌트

| 컴포넌트 | 위치 | 역할 | 문서 |
|----------|------|------|------|
| ZK Circuit | `circuits/` | 6개 제약조건 검증 (Poseidon2) | [circuit.md](./circuit.md) |
| Smart Contracts | `contracts/` | 온체인 검증, dual-approval root, 2-stage withdrawal | [contracts.md](./contracts.md) |
| Sequencer | `packages/sequencer/` | Incremental Merkle, scanner, operator, registration tree | [sequencer.md](./sequencer.md) |
| Crypto Library | `packages/sequencer/src/crypto.ts` | Poseidon2, ECIES, Merkle (Node.js) | [circuit.md](./circuit.md#crypto-library) |
| Web SDK | `packages/sdk/` | 브라우저 ZK proving, ethers.js | [sdk.md](./sdk.md) |
| Frontend | `packages/frontend/` | Next.js 앱 (React 19, Tailwind v4) | — |

---

## 3. Data Flow

```mermaid
sequenceDiagram
    participant Alice as Alice (예치자)
    participant SDK as Web SDK
    participant MM as MetaMask
    participant Pool as PrivacyPoolV2
    participant Seq as Sequencer
    participant Bob as Bob (수신자)
    participant Op as Operator

    Note over Alice,Op: === Deposit ===
    Alice->>SDK: deposit(recipientNpk, encPubKey, amount)
    SDK->>SDK: commitment = poseidon2([secret, npk, amount, ...])
    SDK->>SDK: encryptedNote = ECIES(recipientPubKey, noteData)
    SDK->>MM: approve + deposit tx
    MM->>Pool: deposit(commitment, amount, encryptedNote)
    Pool-->>Seq: Deposit + EncryptedNote events

    Note over Alice,Op: === Merkle Root ===
    Seq->>Seq: IncrementalMerkleTree.insert(commitment)
    Seq->>Pool: proposeRoot + confirmRoot(newRoot)

    Note over Alice,Op: === Note Discovery ===
    Bob->>SDK: scanMyNotes()
    SDK->>Seq: GET /notes?from=0&to=N
    SDK->>SDK: view tag 필터 → ECIES 복호화 → OwnedNote[]

    Note over Alice,Op: === Withdrawal ===
    Bob->>SDK: withdraw(note, amount, recipientAddr)
    SDK->>Seq: GET /proof/:leafIndex
    SDK->>SDK: noir_js → witness → bb.js → ZK proof
    SDK->>MM: initiateWithdrawal(proof, publicInputs)
    MM->>Pool: tx 제출 → HonkVerifier.verify()

    Note over Alice,Op: === Claim ===
    alt Operator 즉시 승인
        Op->>Pool: attestWithdrawal(nullifier)
    else 24h 타임아웃
        Bob->>Pool: claimWithdrawal(nullifier)
    end
    Pool->>Bob: token.transfer(recipient, amount)
```

---

## 4. Compliance Flow

> Operator는 위변조 불가능한 값으로 송금자·수신자·금액을 추적한다.

### 4.1 Actors

```mermaid
graph TB
    subgraph Public["공개 영역"]
        Alice["Alice (Depositor)<br/>누구나 입금 가능"]
        Bob["Bob (Recipient)<br/>KYC 등록 필수"]
        Observer["Observer<br/>블록체인 관찰자"]
    end

    subgraph Trusted["신뢰 영역 (Off-Chain)"]
        Operator["Operator<br/>KYC DB · 출금 승인 · Compliance 복호화"]
        Sequencer["Sequencer/Relayer<br/>Merkle Tree · Root 제출"]
    end

    subgraph Onchain["On-Chain"]
        Pool["PrivacyPoolV2<br/>입금 큐 · ZK 검증 · 2-Stage 출금"]
        Circuit["ZK Circuit<br/>6개 제약조건 (위변조 방지)"]
    end

    Alice -->|"deposit()"| Pool
    Bob -->|"initiateWithdrawal(proof)"| Pool
    Pool -->|"events"| Sequencer
    Sequencer -->|"proposeRoot() + confirmRoot()"| Pool
    Operator -->|"attestWithdrawal()"| Pool
    Operator -->|"updateRegistrationRoot()"| Pool
    Operator -->|"setRelayer()"| Pool
    Circuit -.->|"compliance_hash 검증"| Pool
```

### 4.2 KYC 등록 흐름

```mermaid
sequenceDiagram
    participant User as User (SDK)
    participant MM as MetaMask
    participant Op as Operator
    participant DB as KYC DB
    participant RegTree as Registration Tree
    participant Pool as PrivacyPoolV2

    Note over User,MM: ① 키 생성 (User 로컬)
    User->>MM: 서명 요청 (deriveKeys)
    MM-->>User: signature
    User->>User: NSK = kdf(signature)<br/>NPK = poseidon2(NSK, DOMAIN_NPK)<br/>encPubKey = secp256k1(encPrivKey)
    Note over User: NSK, encPrivKey는 User만 보유 (비밀)<br/>NPK, encPubKey는 공개 가능

    Note over User,Pool: ② KYC 등록
    User->>Op: KYC 신청 (신분증 + address + NPK + encPubKey)
    Op->>Op: KYC 심사 (신원 확인)
    Op->>DB: registerUser(address, npk, encPubKey)
    Op->>RegTree: insert(npk) → tree root 갱신
    Op->>Pool: updateRegistrationRoot(newRoot)
    Note over Pool: knownRegistrationRoots[newRoot] = true
    Note over User: 이제 출금 시 ZK proof 생성 가능<br/>(회로 constraint 6: NPK ∈ Registration Tree)
```

### 4.3 Compliance 추적 흐름

```mermaid
sequenceDiagram
    participant Alice as Alice (Depositor)
    participant Pool as PrivacyPoolV2
    participant Seq as Sequencer
    participant Bob as Bob (Recipient)
    participant Circuit as ZK Circuit
    participant Op as Operator

    Note over Alice,Op: ① 입금 (누구나 가능)
    Alice->>Alice: secret = CSPRNG 랜덤값 생성
    Alice->>Alice: commitment = poseidon2(<br/>secret, recipientNpk, amount,<br/>blockNumber, depositor, DOMAIN_COMMITMENT)
    Alice->>Alice: encryptedNote = ECIES(recipientEncPubKey,<br/>{secret, amount, blockNumber, depositor})
    Alice->>Alice: operatorNote = ECIES(operatorPubKey, {secret})
    Alice->>Pool: deposit(commitment, amount,<br/>encryptedNote || operatorNote)
    Pool-->>Seq: Deposit event (commitment, amount, timestamp)
    Pool-->>Seq: EncryptedNote event (leafIndex, encData)
    Note over Op: Operator가 아는 것:<br/>depositor 주소, 금액 (이벤트에서)<br/>recipient는 아직 모름 (commitment 해시 안에 숨겨짐)

    Note over Alice,Op: ② Merkle Tree 갱신
    Seq->>Seq: tree.insert(commitment)
    Seq->>Pool: proposeRoot + confirmRoot(newRoot)

    Note over Alice,Op: ③ 수신자 노트 발견
    Bob->>Seq: GET /notes (encrypted notes 다운로드)
    Bob->>Bob: ECIES 복호화 → OwnedNote 확인

    Note over Alice,Op: ④ 출금 (ZK Proof로 위변조 방지)
    Bob->>Seq: GET /proof/:leafIndex (Merkle proof)
    Bob->>Circuit: witness 생성
    Note over Circuit: 6개 제약조건 검증:<br/>1. NPK = poseidon2(NSK) ✓<br/>2. commitment ∈ Merkle Tree ✓<br/>3. nullifier 정확성 ✓<br/>4. amount ≤ note_amount ✓<br/>5. compliance_hash = poseidon2(<br/>   depositor, recipient, amount, secret) ✓<br/>6. NPK ∈ Registration Tree ✓
    Circuit-->>Bob: ZK proof + public inputs
    Note over Bob: public inputs에 포함:<br/>compliance_hash (위변조 불가)

    Bob->>Pool: initiateWithdrawal(proof, publicInputs)
    Pool->>Pool: HonkVerifier.verify(proof) ✓
    Pool-->>Op: WithdrawalInitiated event<br/>(nullifier, recipient, amount, compliance_hash)

    Note over Alice,Op: ⑤ Operator Compliance 검토
    Op->>Op: ECIES 복호화 → {depositor, recipient, amount} 확인
    Op->>Op: Operator note 복호화 → secret 복원
    Op->>Op: compliance_hash 검증:<br/>poseidon2(depositor, recipient, amount, secret) == on-chain 값?
    Op->>Op: KYC DB 조회:<br/>depositor ∈ DB? recipient NPK ∈ DB?

    Note over Alice,Op: ⑥ 출금 완료
    alt Operator 승인
        Op->>Pool: attestWithdrawal(nullifier)
        Pool->>Bob: 즉시 토큰 전송
    else 24h 타임아웃 (검열 저항)
        Bob->>Pool: claimWithdrawal(nullifier)
        Pool->>Bob: 토큰 전송
    end
```

### 4.4 위변조 방지 메커니즘

| 공격 시나리오 | 방어 메커니즘 |
|-------------|-------------|
| Bob이 가짜 depositor를 compliance_hash에 넣음 | ZK circuit이 commitment의 원래 depositor로 해시 계산 → proof 실패 |
| Bob이 가짜 recipient를 넣음 | ZK circuit이 public input의 recipient로 해시 계산 → on-chain 값과 불일치 |
| Bob이 금액을 조작 | ZK circuit이 실제 transfer_amount로 해시 계산 → proof 실패 |
| 미등록 사용자가 출금 시도 | ZK circuit constraint 6: NPK가 Registration Tree에 없으면 proof 생성 불가 |
| Observer가 compliance_hash를 brute-force 역산 | secret salt 추가 → Observer는 secret을 모르므로 역산 불가 |
| 서명 위조 시도 | ECDSA 복원 → operator 주소 불일치 시 revert |

### 4.5 정보 가시성 매트릭스

```mermaid
graph LR
    subgraph Observer["👁 Observer (블록체인 관찰자)"]
        O1["✅ 입금 금액"]
        O2["✅ 출금 금액"]
        O3["✅ depositor 주소 (tx.from)"]
        O4["✅ recipient 스텔스 주소"]
        O5["❌ depositor ↔ recipient 연결"]
        O6["❌ 실제 recipient 신원"]
    end

    subgraph Operator_view["🔑 Operator"]
        P1["✅ 위의 모든 것"]
        P2["✅ depositor ↔ recipient 연결"]
        P3["✅ 실제 recipient 신원 (KYC DB)"]
        P4["✅ compliance_hash 복호화"]
    end
```

---

## 5. Project Structure

```
latent-mvp/                          # pnpm/npm workspaces monorepo
├── circuits/                        # ZK Circuit (Noir)
│   ├── src/main.nr                  # 6 constraints, 31 tests, Poseidon2
│   └── Prover.toml                  # 샘플 입력
│
├── contracts/                       # Smart Contracts (Foundry)
│   ├── src/
│   │   ├── PrivacyPoolV2.sol        # 핵심 컨트랙트 (dual-approval root)
│   │   ├── UltraVerifier.sol        # 자동생성 (수정 금지)
│   │   └── MockUSDT.sol             # 테스트용 ERC20
│   └── test/                        # 73 Foundry tests
│
├── packages/
│   ├── sdk/                         # @latent/sdk (브라우저)
│   │   ├── src/                     # client, core, proving, chain, api
│   │   └── __tests__/               # 76 Vitest tests
│   │
│   ├── sequencer/                   # @latent/sequencer (Node.js)
│   │   ├── src/                     # tree, chain, scanner, operator, api, crypto
│   │   └── __tests__/               # 71 Vitest tests
│   │
│   └── frontend/                    # @latent/frontend (Next.js 15 + React 19)
│       └── src/                     # App Router, Tailwind v4
│
├── scripts/                         # 유틸리티 스크립트
│   ├── lib/crypto.ts                # 공유 Poseidon2 + ECIES (E2E/벡터 생성용)
│   ├── generate_test_vectors.ts     # E2E 시나리오 생성
│   ├── e2e_test.sh                  # 전체 E2E 테스트
│   └── dev.sh                       # 개발 서버 실행
│
├── specs/                           # IDD 의도 문서
└── docs/                            # 설계 문서
```

---

## 6. Tests

| 레이어 | 도구 | 테스트 수 | 명령어 |
|--------|------|----------|--------|
| Circuit | `nargo test` | 31 | `cd circuits && nargo test` |
| Contracts | `forge test` | 73 | `cd contracts && forge test -vv` |
| SDK | `vitest` | 76 | `npm run test:sdk` |
| Sequencer | `vitest` | 71 | `npm run test:sequencer` |
| E2E | `e2e_test.sh` | — | `npm run test:e2e` |

---

## 7. Tool Versions

| 도구 | 버전 | 비고 |
|------|------|------|
| nargo | 1.0.0-beta.18 | Noir 컴파일러 |
| bb | 3.0.0-nightly.20260102 | Barretenberg 증명 백엔드 |
| Foundry | latest | Solidity 테스트 |
| @aztec/bb.js | 3.0.0-nightly.20260102 | 브라우저 WASM proving |
| @noir-lang/noir_js | 1.0.0-beta.18 | 브라우저 witness 생성 |

**주요 제약**: nargo↔bb, @noir-lang/noir_js↔nargo, @aztec/bb.js↔bb 버전이 반드시 일치해야 함.
