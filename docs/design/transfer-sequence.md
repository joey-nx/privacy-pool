# Transfer Sequence: Alice → Bob

> Alice가 Bob에게 프라이버시를 보존하며 토큰을 송금하는 전체 흐름

## 1. 전체 흐름 요약

```mermaid
graph LR
    A[키 파생 & 등록] --> B[결제 링크 공유]
    B --> C[입금 & 암호화]
    C --> D[시퀀서 인덱싱]
    D --> E[노트 스캔 & 복호화]
    E --> F[ZK 증명 생성]
    F --> G[온체인 출금 요청]
    G --> H[운영자 승인 or 24h 클레임]
```

| 단계 | 주체 | 프라이버시 메커니즘 |
|------|------|-------------------|
| 키 파생 | Alice, Bob 각자 | EIP-191 서명 → 결정적 키 쌍 |
| 결제 링크 | Bob → Alice | 공개키만 노출 (npk + encPubKey) |
| 입금 | Alice | Poseidon2 커밋먼트 + ECIES 암호화 |
| 인덱싱 | 시퀀서 | 암호화된 노트만 저장 (복호화 불가) |
| 스캔 | Bob 클라이언트 | View tag 필터 + ECIES 로컬 복호화 |
| 증명 | Bob 클라이언트 | UltraHonk ZK proof (6개 제약조건) |
| 출금 | Bob → 온체인 | Nullifier로 이중 지출 방지 |
| 승인 | 운영자 or 타임아웃 | Compliance hash 검증 + 검열 저항 |

## 2. Phase 1: 키 파생 & 등록

Alice와 Bob 모두 동일한 키 파생 과정을 거친다.

```mermaid
sequenceDiagram
    participant W as MetaMask
    participant SDK as Latent SDK
    participant Seq as Sequencer

    Note over W, SDK: Alice & Bob 각자 수행

    SDK->>W: personal_sign("StealthTx Key Derivation v1")
    W-->>SDK: signature (EIP-191)
    SDK->>SDK: seed = keccak256(signature)
    SDK->>SDK: nsk = seed[0:32] mod FR_ORDER
    SDK->>SDK: encPrivKey = seed[0:32] (ECIES)
    SDK->>SDK: npk = poseidon2(nsk, DOMAIN_NPK)
    SDK->>SDK: encPubKey = secp256k1.getPublicKey(encPrivKey)

    Note over SDK: 결정적 파생 — 같은 지갑 = 같은 키

    SDK->>Seq: POST /operator/register { address, npk, encPubKey }
    Seq->>Seq: KYC 확인 & Registration Tree에 npk 삽입
    Seq-->>SDK: { registered: true }
```

**핵심 포인트**:
- `nsk`(nullifier secret key)는 절대 외부에 노출되지 않음
- `npk`, `encPubKey`만 공개되며, 이것으로 비밀키를 역산할 수 없음
- Registration Tree 등록은 KYC 게이트 역할 — 미등록 사용자는 출금 불가

## 3. Phase 2: 결제 링크 공유

```mermaid
sequenceDiagram
    participant Bob as Bob (수신자)
    participant App as Frontend
    participant Alice as Alice (송신자)

    Bob->>App: "결제 링크 생성" 클릭
    App->>App: URL = baseUrl/pay?npk={npk}&enc={encPubKey}
    App-->>Bob: QR 코드 + 링크

    Bob->>Alice: QR 코드 또는 링크 전달 (Telegram, 대면 등)

    Alice->>App: 결제 링크 접속
    App->>App: parsePaymentLink(url)
    App-->>Alice: Bob의 npk, encPubKey 추출 완료
```

**Why 결제 링크?**: Bob의 공개키를 안전하게 전달하는 최소한의 방법. 링크에는 비밀키가 포함되지 않으므로 유출되어도 자금 위험 없음.

## 4. Phase 3: 입금 (Alice → Privacy Pool)

```mermaid
sequenceDiagram
    participant Alice as Alice SDK
    participant Chain as PrivacyPoolV2
    participant Seq as Sequencer

    Note over Alice: 1. 커밋먼트 생성
    Alice->>Alice: secret = CSPRNG() mod FR_ORDER
    Alice->>Alice: commitment = poseidon2(secret, Bob.npk,<br/>amount, blockNumber, Alice.addr, DOMAIN_COMMITMENT)

    Note over Alice: 2. ECIES 암호화 (Bob만 복호화 가능)
    Alice->>Alice: ephPrivKey = random()
    Alice->>Alice: sharedSecret = ECDH(ephPrivKey, Bob.encPubKey)
    Alice->>Alice: viewTag = keccak256(sharedSecret)[0] (1 byte)
    Alice->>Alice: encKey, macKey = KDF(sharedSecret)
    Alice->>Alice: plaintext = secret | amount | blockNumber | depositor
    Alice->>Alice: ciphertext = plaintext XOR encKey
    Alice->>Alice: mac = HMAC-SHA256(macKey, ciphertext)

    Note over Alice: 3. Operator Note 암호화 (선택)
    Alice->>Alice: operatorNote = ECIES(operator.encPubKey, secret)

    Note over Alice: 4. 온체인 입금
    Alice->>Chain: ERC20.approve(pool, amount)
    Alice->>Chain: deposit(commitment, amount, encryptedNote)
    Chain-->>Chain: emit Deposit(commitment, amount, blockNumber)
    Chain-->>Chain: emit EncryptedNote(leafIndex, encryptedNote_hex)

    Note over Seq: 5. 시퀀서가 이벤트 감지
    Seq->>Chain: poll EncryptedNote events
    Chain-->>Seq: [{ leafIndex, encryptedNote, blockNumber, txHash }]
    Seq->>Seq: encrypted-notes.json에 저장
    Seq->>Seq: Merkle Tree에 commitment 삽입
```

### 암호화 데이터 구조

```
EncryptedNote (194 bytes):
┌──────────────────┬────────────┬─────────┬──────────┐
│ ephemeralPubKey  │ ciphertext │   mac   │ viewTag  │
│    (33 bytes)    │ (128 bytes)│(32 bytes)│ (1 byte) │
└──────────────────┴────────────┴─────────┴──────────┘

ciphertext 복호화 후:
┌──────────┬──────────┬─────────────┬───────────┐
│  secret  │  amount  │ blockNumber │ depositor │
│ (32 bytes)│(32 bytes)│  (32 bytes) │ (32 bytes)│
└──────────┴──────────┴─────────────┴───────────┘
```

## 5. Phase 4: 시퀀서 인덱싱 & Merkle Root 배치

```mermaid
sequenceDiagram
    participant Chain as PrivacyPoolV2
    participant Scanner as Note Scanner
    participant Tree as Merkle Tree
    participant Relayer as Relayer

    loop 블록 폴링
        Scanner->>Chain: getEvents("EncryptedNote", fromBlock, toBlock)
        Chain-->>Scanner: EncryptedNote[] events
        Scanner->>Scanner: encrypted-notes.json에 원자적 저장
    end

    Scanner->>Tree: insert(commitment) — O(log n)
    Tree->>Tree: poseidon2Merkle(left, right) 경로 갱신
    Tree->>Tree: root 재계산

    Relayer->>Chain: proposeRoot(newRoot, processedUpTo)
    Chain-->>Chain: pendingRoot = { root, proposed: true }

    Note over Relayer: Operator 확인 (dual-approval)
    Relayer->>Chain: confirmRoot(root, processedUpTo)
    Chain-->>Chain: latestRoot = root, roots[root] = true
```

**Why Incremental Merkle Tree?**: 리프 삽입이 O(log n)이므로 전체 트리 재구축(O(n·log n)) 대비 효율적. 상태는 `state.json`에 영속화되어 재시작 시 체인과 동기화.

## 6. Phase 5: Bob의 노트 스캔 & 복호화

```mermaid
sequenceDiagram
    participant Bob as Bob SDK
    participant Seq as Sequencer API

    Bob->>Seq: GET /root
    Seq-->>Bob: { root, leafCount, lastProcessedIndex }

    Bob->>Seq: GET /notes?from=0&to=leafCount
    Seq-->>Bob: StoredEncryptedNote[]

    loop 각 암호화된 노트
        Bob->>Bob: ephPubKey, ciphertext, mac, viewTag 파싱

        Note over Bob: View Tag 필터 (99.6% 스킵)
        Bob->>Bob: expected = keccak256(ECDH(encPrivKey, ephPubKey))[0]
        alt viewTag ≠ expected
            Bob->>Bob: SKIP (내 노트 아님)
        else viewTag == expected
            Note over Bob: ECIES 복호화 시도
            Bob->>Bob: sharedSecret = ECDH(encPrivKey, ephPubKey)
            Bob->>Bob: encKey, macKey = KDF(sharedSecret)
            Bob->>Bob: HMAC 검증
            Bob->>Bob: plaintext = ciphertext XOR encKey
            Bob->>Bob: { secret, amount, blockNumber, depositor } 추출

            Note over Bob: 커밋먼트 검증
            Bob->>Bob: recomputed = poseidon2(secret, myNpk,<br/>amount, blockNumber, depositor, DOMAIN_COMMITMENT)
            alt recomputed == stored commitment
                Bob->>Bob: ✅ OwnedNote에 추가
            else
                Bob->>Bob: ❌ 커밋먼트 불일치 — 스킵
            end
        end
    end

    Bob->>Bob: balance = Σ(ownedNotes.amount)
```

**Why 클라이언트 사이드 스캔?**: 서버는 암호화된 노트만 저장하고 복호화 키를 알 수 없음. Bob의 `encPrivKey`는 브라우저를 떠나지 않으므로 서버 침해 시에도 프라이버시 유지.

## 7. Phase 6: ZK 증명 생성 & 출금

```mermaid
sequenceDiagram
    participant Bob as Bob SDK
    participant Seq as Sequencer API
    participant Noir as noir_js (WASM)
    participant BB as bb.js UltraHonk
    participant Chain as PrivacyPoolV2
    participant Verifier as HonkVerifier

    Note over Bob: 1. 증명 입력 수집
    Bob->>Seq: GET /proof/{leafIndex}
    Seq-->>Bob: MerkleProof { siblings[], pathIndices[] }
    Bob->>Seq: GET /registration/proof/{npk}
    Seq-->>Bob: RegistrationProof { siblings[], pathIndices[] }

    Note over Bob: 2. 회로 입력 구성
    Bob->>Bob: nullifier = poseidon2(secret, nsk, DOMAIN_NULLIFIER)
    Bob->>Bob: complianceHash = poseidon2(depositor, recipient,<br/>amount, secret, DOMAIN_COMPLIANCE)

    Note over Bob: 3. Witness 생성
    Bob->>Noir: execute(circuitInputs)
    Noir-->>Bob: witness (compressed binary)

    Note over Bob: 4. ZK Proof 생성 (5~120초)
    Bob->>BB: generateProof(witness, { verifierTarget: "evm" })
    BB-->>Bob: { proof, publicInputs[] }

    Note over Bob: 5. 온체인 출금 요청
    Bob->>Chain: initiateWithdrawal(proof, publicInputs)
    Chain->>Verifier: verify(proof, publicInputs)
    Verifier-->>Chain: ✅ valid

    Chain->>Chain: nullifiers[nullifier] = true (이중 지출 방지)
    Chain->>Chain: withdrawals[nullifier] = { amount, recipient, PENDING }
    Chain-->>Chain: emit WithdrawalInitiated(nullifier, recipient, amount, complianceHash)
```

### 회로 제약조건 (6개)

| # | 제약조건 | 검증 내용 |
|---|---------|----------|
| 1 | Nullifier 파생 | `nullifier == poseidon2(secret, nsk, DOMAIN_NULLIFIER)` |
| 2 | NPK 정확성 | `npk == poseidon2(nsk, DOMAIN_NPK)` |
| 3 | Merkle 포함 | `commitment ∈ Merkle Tree (root 검증)` |
| 4 | 금액 일관성 | `transferAmount ≤ noteAmount` |
| 5 | Compliance Hash | `hash == poseidon2(depositor, recipient, amount, secret, DOMAIN_COMPLIANCE)` |
| 6 | 등록 확인 | `npk ∈ Registration Tree` |

## 8. Phase 7: 운영자 승인 & 토큰 수령

```mermaid
sequenceDiagram
    participant Chain as PrivacyPoolV2
    participant Op as Operator
    participant Bob as Bob

    Note over Op: 1. 출금 이벤트 감지
    Op->>Chain: scan WithdrawalInitiated events
    Chain-->>Op: { nullifier, recipient, amount, complianceHash }

    Note over Op: 2. Compliance 검증 (선택)
    Op->>Op: operatorNote 복호화 → secret 획득
    Op->>Op: expectedHash = poseidon2(depositor, recipient, amount, secret)
    Op->>Op: expectedHash == on-chain complianceHash? ✅

    alt 운영자 승인 (Fast Path)
        Op->>Chain: attestWithdrawal(nullifier)
        Chain->>Chain: status = ATTESTED
        Chain->>Bob: ERC20.transfer(recipient, amount)
        Note over Bob: ✅ 즉시 수령
    else 운영자 미응답 (24h Timeout)
        Note over Bob: 24시간 대기
        Bob->>Chain: claimWithdrawal(nullifier)
        Chain->>Chain: require(block.timestamp > initiatedAt + 24h)
        Chain->>Chain: status = CLAIMED
        Chain->>Bob: ERC20.transfer(recipient, amount)
        Note over Bob: ✅ 지연 수령 (검열 저항)
    end
```

**Why 2-Stage Withdrawal?**:
- **Fast Path**: 운영자가 compliance 확인 후 즉시 승인 → 사용자 경험 최적화
- **Timeout Path**: 운영자가 악의적으로 거부해도 24시간 후 자동 클레임 → 검열 저항

## 9. 전체 시퀀스 다이어그램 (End-to-End)

```mermaid
sequenceDiagram
    actor Alice as Alice (송신자)
    actor Bob as Bob (수신자)
    participant SDK_A as Alice SDK
    participant SDK_B as Bob SDK
    participant Pool as PrivacyPoolV2
    participant Seq as Sequencer
    participant Op as Operator

    Note over Alice, Op: ── Phase 1: 준비 ──

    Bob->>SDK_B: 키 파생 & 등록
    SDK_B->>Seq: POST /operator/register
    Seq-->>SDK_B: registered ✅
    SDK_B-->>Bob: 결제 링크 (npk + encPubKey)
    Bob->>Alice: 결제 링크 전달

    Note over Alice, Op: ── Phase 2: 입금 ──

    Alice->>SDK_A: send(Bob.link, 100 USDC)
    SDK_A->>SDK_A: secret 생성, commitment 계산
    SDK_A->>SDK_A: ECIES 암호화 (Bob.encPubKey)
    SDK_A->>Pool: deposit(commitment, 100, encNote)
    Pool-->>Pool: emit Deposit + EncryptedNote

    Note over Alice, Op: ── Phase 3: 인덱싱 ──

    Seq->>Pool: poll events
    Seq->>Seq: Merkle Tree 삽입 + root 갱신
    Seq->>Pool: proposeRoot → confirmRoot

    Note over Alice, Op: ── Phase 4: 수신 확인 ──

    Bob->>SDK_B: scanMyNotes()
    SDK_B->>Seq: GET /notes
    SDK_B->>SDK_B: viewTag 필터 → ECIES 복호화
    SDK_B-->>Bob: "100 USDC 수신됨"

    Note over Alice, Op: ── Phase 5: 출금 ──

    Bob->>SDK_B: withdraw(note, 100, Bob.address)
    SDK_B->>Seq: GET /proof/{leafIndex}
    SDK_B->>Seq: GET /registration/proof/{npk}
    SDK_B->>SDK_B: ZK Proof 생성 (UltraHonk)
    SDK_B->>Pool: initiateWithdrawal(proof, publicInputs)
    Pool-->>Pool: verify → emit WithdrawalInitiated

    Note over Alice, Op: ── Phase 6: 승인 & 수령 ──

    Op->>Pool: scan WithdrawalInitiated
    Op->>Op: compliance 검증
    Op->>Pool: attestWithdrawal(nullifier)
    Pool->>Bob: 100 USDC 전송 ✅
```

## 10. 프라이버시 & 보안 속성 요약

| 속성 | 메커니즘 | 외부 관찰자 | 수신자 | 운영자 |
|------|---------|-----------|--------|--------|
| **송신자 익명** | ZK proof (nullifier) | ❌ 불가 | ❌ 불가 | ✅ 가능 |
| **수신자 익명** | ECIES + stealth address | ❌ 불가 | ✅ 본인 | ✅ 가능 |
| **금액 은닉** | commitment 해시 | ❌ 불가 | ✅ 복호화 | ✅ 가능 |
| **이중 지출 방지** | on-chain nullifier 레지스트리 | — | — | — |
| **검열 저항** | 24h timeout 자동 클레임 | — | ✅ | — |
| **규제 준수** | compliance hash + operator note | — | — | ✅ 검증 |
