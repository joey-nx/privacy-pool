---
allowed-tools: Bash(forge test:*)
description: Forge 테스트 실행
argument-hint: [test-pattern]
---

forge test 실행. 인자가 있으면 --match-test로 필터링.

$ARGUMENTS 가 있으면: `forge test --match-test "$ARGUMENTS" -vvv`
없으면: `forge test`

실패 시 원인 분석 후 수정 방안 제시.
