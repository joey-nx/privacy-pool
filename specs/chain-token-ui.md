# Feature: 체인 정보 표시 & 토큰 선택 드롭다운

## 목적 (Why)
MetaMask 연결 후 사용자가 현재 연결된 체인(CROSS testnet)을 확인할 수 있어야 하고, 전송 시 어떤 토큰을 보낼지 선택할 수 있어야 한다.

## 결정사항 (What)
- **체인**: CROSS testnet (`chainId` TBD, RPC: `https://testnet.crosstoken.io:22001`)
- **토큰**: CROSSD (`0x9364ea6790f6e0ecfaa5164085f2a7de34ec55fb`)
- 체인 정보를 헤더 지갑 영역에 표시 (체인 아이콘 + 이름)
- Send 폼에 토큰 선택 드롭다운 추가 (현재는 CROSSD만)
- 잘못된 체인 연결 시 CROSS testnet으로 전환 유도

## 구현 범위

### 1. 체인/토큰 설정 파일
- `packages/frontend/src/packages/shared/config/chains.ts` — CROSS testnet 체인 정의
- `packages/frontend/src/packages/shared/config/tokens.ts` — CROSSD 토큰 정의

### 2. use-wallet 훅 확장
- `chainId` 상태 추가 및 `chainChanged` 이벤트 리스닝
- `switchChain()` 함수 추가 (잘못된 체인일 때 CROSS testnet으로 전환)
- 체인 미등록 시 `wallet_addEthereumChain`으로 자동 추가

### 3. 헤더 체인 정보 표시
- 지갑 연결 시 체인 아이콘 + 이름을 주소 옆에 표시
- 잘못된 체인이면 경고 배지 + 전환 버튼

### 4. Send 폼 토큰 드롭다운
- Amount 입력 필드 옆에 토큰 선택 드롭다운
- CROSSD 아이콘 + 심볼 표시
- 선택된 토큰 정보를 `onSend`에 전달

## 시나리오 (Scenarios)

### 정상 케이스
- Given 지갑이 CROSS testnet에 연결됨 When 헤더를 봄 Then 체인 아이콘 + "CROSS Testnet" 표시
- Given Send 탭 When 토큰 드롭다운 클릭 Then CROSSD 토큰이 아이콘과 함께 표시

### 경계값
- Given 지갑이 다른 체인(Ethereum Mainnet 등)에 연결됨 When 앱 진입 Then "Wrong Network" 경고 + 전환 버튼 표시
- Given MetaMask에 CROSS testnet이 없음 When 전환 시도 Then 자동으로 체인 추가 후 전환

### 실패 케이스
- Given 사용자가 체인 전환 거부 Then 경고 상태 유지, 기능 사용 불가 표시

## 범위 밖 (Out of scope)
- 토큰 잔액 조회 (ERC-20 balanceOf 호출 — 추후 SDK 연동 시)
- 커스텀 토큰 추가 기능
- 멀티 체인 지원
