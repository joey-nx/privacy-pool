# Feature: Stealth Privacy Withdrawal — "본 계좌로 바로 수취" UX

## 목적 (Why)

Privacy Pool의 Note + ZK Proof 기반 인출 흐름에서 Stealth Address가 중간에 개입하지만,
사용자 UI에서는 이를 완전히 추상화하여 **"내 지갑으로 바로 받기"** 경험을 제공한다.

현재 `ReceivedNotesCard`는 개별 노트 단위로 "Withdraw" 버튼을 노출하고 있으나,
사용자 관점에서는 **총 수신 잔액을 본인 EOA로 한 번에 수취**하는 것이 자연스럽다.

## 설계 원칙

### Stealth Identity ↔ 현 아키텍처 매핑

현재 시스템의 `npk + encPubKey`가 이미 Stealth Meta-Address 역할을 수행한다.
별도의 EIP-5564 도입 없이 현 구조를 유지한다 (ZK 회로에서 secp256k1 연산 비용이 높음).

```
┌─────────────────────────┬──────────────────────────────────┐
│ Stealth Address 개념    │ Latent 구현체                     │
├─────────────────────────┼──────────────────────────────────┤
│ Stealth Meta-Address    │ npk + encPubKey (Payment Link)   │
│ Ephemeral Key           │ ECIES ephemeral key (per-note)   │
│ Stealth Instance        │ commitment (poseidon2 hash)      │
│ Stealth Private Key     │ nsk + secret                     │
│ Stealth Scan            │ View tag filter + ECIES decrypt  │
│ Claim/Spend             │ ZK Proof + initiateWithdrawal    │
└─────────────────────────┴──────────────────────────────────┘
```

### Privacy 보장

| 관찰자 | 볼 수 있는 것 | 볼 수 없는 것 |
|--------|---------------|---------------|
| 외부 (Etherscan) | Bob이 Privacy Pool에서 X USDT 인출 | 누가 (Alice) 보냈는지 |
| Operator | Alice → Bob, 금액, compliance hash | note secret (operator note로 별도 복호화) |
| Alice | 자신이 Bob에게 보낸 사실 | Bob의 다른 거래 |
| Bob | 수신 금액, 출처(depositor) | 다른 사용자의 deposit |

### Compliance 보장 (소유권 보호)

Note를 인출하려면 세 가지 조건이 **동시에** 충족되어야 한다:

1. **`nsk` 소유**: `npk == poseidon2([nsk, DOMAIN_NPK])` — Bob만 보유
2. **`secret` 복호화**: ECIES로 `encPubKey`에 암호화됨 — Bob만 복호화
3. **KYC 등록**: `npk`가 registration tree에 존재 — 미등록 시 proof 생성 불가

→ ComplianceData에서 확인된 소유자(Bob) 이외에 다른 누구도 인출할 수 없다.

## 결정사항 (What)

- Per-user Stealth Identity (하나의 npk를 모든 payment에 사용)
- Receive 탭에 **Privacy Balance** 카드 추가: 총 수신 잔액 표시
- **"Withdraw to My Wallet"** 버튼: 모든 owned notes를 순차 인출
- 개별 노트 목록은 상세 영역(확장형)으로 이동
- Withdrawal 진행 상태를 단계별 progress UI로 표시
- SDK `LatentClient`의 기존 API(`scanMyNotes`, `withdraw`, `getPrivacyBalance`) 활용 — SDK 변경 없음

## 시나리오 (Scenarios)

### 정상 케이스: Bob이 수신 잔액을 확인하고 본 계좌로 수취

```
Given  Alice가 Bob에게 100 USDT를 Privacy Pool로 입금했다
And    Bob이 지갑을 연결하고 키를 파생했다
When   Bob이 Receive 탭을 열면
Then   자동으로 scanMyNotes()가 실행된다
And    Privacy Balance 카드에 "100 USDT" 잔액이 표시된다
And    "Withdraw to My Wallet" 버튼이 활성화된다
```

### 정상 케이스: Bob이 "Withdraw to My Wallet" 클릭

```
Given  Bob의 Privacy Balance가 100 USDT (노트 1개)이다
When   Bob이 "Withdraw to My Wallet"을 클릭한다
Then   Withdrawal Progress 모달이 표시된다
And    단계별 진행 상태가 표시된다:
       Step 1: "Merkle proof 조회 중..."
       Step 2: "회로 입력값 계산 중..."
       Step 3: "Witness 생성 중..."
       Step 4: "ZK 증명 생성 중... (약 30-60초)"
       Step 5: "트랜잭션 제출 중..."
And    완료 시 txHash가 표시된다
And    Privacy Balance가 0으로 갱신된다
And    Transaction History에 withdraw 기록이 추가된다
```

### 정상 케이스: 복수 노트를 순차 인출

```
Given  Bob이 3개의 노트를 보유하고 있다 (50 + 30 + 20 = 100 USDT)
When   Bob이 "Withdraw to My Wallet"을 클릭한다
Then   3개의 노트가 순차적으로 인출된다
And    각 노트의 진행 상태가 "1/3", "2/3", "3/3"으로 표시된다
And    하나가 실패하면 나머지는 중단되고 에러가 표시된다
And    이미 인출된 노트는 잔액에서 차감된다
```

### 정상 케이스: 수신 노트가 없는 경우

```
Given  Bob에게 입금된 노트가 없다
When   Bob이 Receive 탭을 열면
Then   Privacy Balance가 "0 USDT"로 표시된다
And    "Withdraw to My Wallet" 버튼이 비활성화된다
And    안내 메시지가 표시된다: "No funds to withdraw. Share your payment link to receive."
```

### 경계값: Withdrawal 진행 중 페이지 이탈

```
Given  Bob이 ZK proof 생성 중이다 (Step 4)
When   Bob이 탭을 닫거나 페이지를 벗어나려 한다
Then   beforeunload 경고가 표시된다: "Proof generation in progress. Leaving may lose progress."
```

### 실패 케이스: 잔액은 있으나 Merkle root 미확정

```
Given  Alice가 방금 deposit했다
And    Relayer/Operator가 아직 새 root를 확정하지 않았다
When   Bob이 scanMyNotes() 후 withdraw를 시도한다
Then   "Merkle root not yet confirmed. Please try again later." 에러가 표시된다
And    Privacy Balance는 "(pending)" 상태로 표시된다
```

## UI 구조

```
Receive 탭
├── PaymentLinkCard        (기존, 변경 없음)
│   └── Payment Link 생성/복사/QR/공유
│
├── PrivacyBalanceCard     (신규)
│   ├── Privacy Balance: "100 USDT"
│   ├── [Withdraw to My Wallet] 버튼
│   ├── 수신 주소 표시: "→ 0x1234...abcd (My Wallet)"
│   └── 노트 상세 (접기/펼치기)
│       ├── Note #0: 50 USDT (Block #123)
│       ├── Note #1: 30 USDT (Block #125)
│       └── Note #2: 20 USDT (Block #130)
│
└── WithdrawalProgressModal (신규, 인출 중 표시)
    ├── Step indicator (1~5)
    ├── Current step description
    ├── Progress bar / spinner
    ├── 노트 진행 카운터 (e.g., "2/3 notes")
    └── 완료 시: txHash 링크 + "Done" 버튼
```

## 범위 밖 (Out of scope)

- SDK 변경 (기존 `scanMyNotes`, `withdraw`, `getPrivacyBalance` API 그대로 사용)
- 부분 인출 UI (특정 금액만 인출하는 기능 — 향후 별도 스펙)
- 자동 인출 (polling + auto-withdraw — 향후 별도 스펙)
- EIP-5564 호환 stealth address 레이어 (현 npk+encPubKey 구조가 ZK에서 더 효율적)
- Per-payment stealth npk 파생 (Per-user로 확정)
- Operator attestation UI (operator 측 화면)
