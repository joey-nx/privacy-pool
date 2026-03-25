# Phase 1b TODO List

> Engineering review에서 도출된 항목

---

## 1. Dual-approval 키 분리

- **What**: Operator와 Relayer 역할을 별도 EOA로 분리
- **Why**: 단일 키가 탈취되면 root 조작과 출금 릴레이 모두 가능해 단일 장애점(SPOF)이 됨
- **Context**: CROSS 배포에서 operator=relayer 동일 EOA 사용 중. 새 체인 배포 시 반드시 별도 키 사용 필요. (Codex outside voice 발견)

## 2. OPERATOR_ENC_PUB_KEY 필수화

- **What**: `NEXT_PUBLIC_OPERATOR_ENC_PUB_KEY` 미설정 시 SDK에서 경고 로그 또는 에러 throw 추가
- **Why**: 미설정 시 compliance 검증이 조용히 실패(silent failure)하여 검증 없이 통과될 수 있음
- **Context**: 현재 프론트엔드 빌드 파이프라인에 환경변수를 추가했으나, SDK 레벨에서 미설정에 대한 방어 로직 없음

## 3. Deposit-side registration check

- **What**: Deposit 시 수신자의 registration 여부를 확인하는 로직 추가
- **Why**: 미등록 수신자에게 입금하면 자금이 출금 불가능한 상태로 잠길 수 있음
- **Context**: ADR-002 명세에는 deposit 시 수신자 registration 확인이 포함되어 있으나 현재 구현에 누락

## 4. KYC 연동

- **What**: 사용자 등록(register) 시 KYC 프로세스 연동
- **Why**: 현재 auto-register로 인증 없이 누구나 참여 가능하여 compliance 요건 미충족
- **Context**: 테스트넷에서는 auto-register로 운영 중. 실서비스 배포 전 KYC provider 연동 필요

## 5. 가스 비용 벤치마크

- **What**: UltraVerifier의 L2 가스 프로파일링 실행 및 문서화
- **Why**: ZK proof 검증 가스 비용이 L2 환경에서 경제적으로 실행 가능한지 확인 필요
- **Context**: Withdraw 시 on-chain proof verification 비용이 사용자 부담. L2별 가스 모델 차이에 따른 비용 산정 필요
