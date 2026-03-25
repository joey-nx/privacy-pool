# Payment Privacy Demo (3분 시나리오)

> 대상: 내부 데모 / CROSS testnet
> Pool: `0x5fB82D522C4e3471cB2b9578E6f5284Cef8c9a4D`

## 사전 준비

- 브라우저 2개 (Buyer, Merchant)
- 각 브라우저에 MetaMask 설치, CROSS testnet 설정 완료
- 양쪽 지갑에 CROSS 테스트넷 ETH 보유 (가스비용)
- Buyer 지갑에 USDT 잔액 확인
- 앱 접속: `http://localhost:13000` (docker-compose 기준)

## 데모 흐름

### Step 1. 앱 접속 (양쪽 브라우저)

양쪽 브라우저에서 `http://localhost:13000` 접속.

### Step 2. Buyer: 결제 실행

1. **Connect Wallet** — MetaMask 연결
2. **deriveKeys** — Privacy Pool 키 쌍 생성 (서명 1회)
3. **Deposit** 탭 진입
4. Merchant가 공유한 결제 링크(NPK 포함)로 USDT 입금
   - 금액 입력 → 수신자 NPK 자동 설정 → Deposit 실행
   - MetaMask 트랜잭션 승인 (approve + deposit)

### Step 3. 대기 (~30초)

- Sequencer가 새 root를 propose
- Operator가 on-chain에서 root confirm
- 화면에서 root 상태 업데이트 확인 가능

### Step 4. Merchant: 수령 및 출금

1. **Connect Wallet** — MetaMask 연결
2. **deriveKeys** — Privacy Pool 키 쌍 생성
3. **Scan Notes** — 자동으로 수신 노트 탐색
4. 수신된 결제 확인 (금액, 상태 표시)
5. **Withdraw** 실행
   - 출금 모달에서 "검증된 참여자" 배지 확인 (compliance 표시)
   - ZK proof 생성 → 트랜잭션 제출

### Step 5. 프라이버시 검증

블록 익스플로러에서 확인:

- **보이는 것**: Buyer → Pool 입금 tx, Pool → Merchant 출금 tx
- **보이지 않는 것**: Buyer와 Merchant 간 직접적 연결

Buyer가 누구에게 보냈는지, Merchant가 누구로부터 받았는지 on-chain에서 알 수 없다.

## 핵심 메시지

| 항목 | 설명 |
|------|------|
| 프라이버시 | 송금자-수신자 링크가 on-chain에 노출되지 않음 |
| 컴플라이언스 | 검증된 참여자만 풀 사용 가능 (배지로 시각 확인) |
| UX | 결제 링크 기반 — 기존 결제 흐름과 유사 |
