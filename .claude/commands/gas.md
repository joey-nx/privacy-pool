---
allowed-tools: Read, Grep, Glob, Bash(forge test:*), Bash(forge build:*)
description: 가스 최적화 분석
argument-hint: [contract-name]
---

$ARGUMENTS 컨트랙트 가스 최적화 분석:

## 분석 항목
1. **Storage**: 패킹 가능 여부, 불필요한 storage 접근
2. **Loops**: 무한 루프 위험, length 캐싱
3. **External calls**: 반복 호출 최소화
4. **Memory vs Calldata**: 함수 파라미터 최적화
5. **Custom errors**: require 문자열 → custom error

`forge test --gas-report` 실행 후 결과 분석.
