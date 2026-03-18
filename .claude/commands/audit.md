---
allowed-tools: Read, Grep, Glob
description: 컨트랙트 보안 검토
argument-hint: [contract-name]
---

$ARGUMENTS 컨트랙트 보안 검토 수행:

## 체크리스트
1. **접근 제어**: onlyOwner, onlyRole 적용 여부
2. **Reentrancy**: 외부 호출 전 상태 변경 (CEI 패턴)
3. **오버플로우**: Solidity 0.8+ 확인
4. **입력 검증**: zero address, zero amount 체크
5. **이벤트**: 상태 변경 시 이벤트 발생
6. **Upgradeable**: storage collision, initializer 보호

## 결과
- Critical/High/Medium/Low/Info 분류
- 각 이슈별 위치, 설명, 권장 수정안
