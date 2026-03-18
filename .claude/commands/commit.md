# 커밋 생성

커밋을 생성합니다. 코드 변경사항이 포함된 경우 품질 검사를 먼저 수행합니다.

## 절차

1. **변경사항 분석**
   - `git status`와 `git diff`로 변경된 파일 확인
   - 변경이 코드(`.sol`, `.s.sol`, `.t.sol`)인지 문서(`.md`, `.json`, `.toml`)인지 판별

2. **커밋 단위 분리 (코드 리뷰 용이성)**
   - 변경사항을 논리적 단위로 분류:
     - **기능별 분리**: 서로 다른 기능은 별도 커밋으로 분리
     - **계층별 분리**: 컨트랙트, 테스트, 문서, 스크립트 등 레이어별 분리 고려
     - **의존성 순서**: 의존 관계가 있는 경우 의존되는 코드 먼저 커밋
   - 분리 기준:
     - 하나의 커밋 = 하나의 논리적 변경 (Single Responsibility)
     - 리뷰어가 각 커밋을 독립적으로 이해할 수 있어야 함
     - 각 커밋은 빌드 및 테스트가 통과해야 함
   - **사용자에게 분리 계획 제시**:
     - 제안된 커밋 단위 목록 표시
     - 각 커밋에 포함될 파일과 변경 내용 요약
     - 사용자 승인 후 순차적으로 커밋 진행
   - 예시:
     ```
     커밋 1: feat(executor): add BuybackExecutor contract
       - src/executors/BuybackExecutor.sol
       - src/interfaces/IBuybackExecutor.sol
     
     커밋 2: test(executor): add BuybackExecutor unit tests
       - test/executors/BuybackExecutor.t.sol
     
     커밋 3: docs(executor): add BuybackExecutor specification
       - docs/spec/buyback_executor.md
     ```

3. **유사 커밋 확인 (Squash 검토)** - 각 커밋 단위별로 수행
   - `git log -5 --oneline`으로 최근 5개 커밋 확인
   - 현재 변경사항과 유사한 작업 내용의 커밋이 있는지 판단:
     - 동일한 scope (예: 둘 다 `registry` 관련)
     - 동일한 type (예: 둘 다 `fix` 또는 `refactor`)
     - 연속적인 작업 (예: 같은 기능의 추가 수정)
   - **유사 커밋 발견 시**:
     - 사용자에게 squash 여부 확인
     - 승인 시 해당 커밋까지 `git reset --soft HEAD~N` 후 통합 커밋 생성
     - `git push --force-with-lease` 로 원격 업데이트
     - **주의**: 이미 PR 리뷰가 진행 중이거나 다른 사람이 브랜치를 사용 중이면 squash 비권장
   - **유사 커밋 없으면**: 일반 커밋 절차 진행

4. **문서-코드 일관성 검토**
   - 변경된 코드와 관련된 문서(README, 스펙, NatSpec 주석) 확인
   - 코드 변경사항이 문서 내용과 일치하는지 검토
   - 불일치 발견 시 사용자에게 보고하고 수정 필요 여부 확인
   - 예: 함수 시그니처 변경 시 관련 문서 업데이트 필요 여부

5. **코드 변경 시 품질 검사** (문서만 변경된 경우 건너뜀)
   - `forge fmt` - 코드 포맷팅 확인 및 적용
   - `forge build` - 빌드 성공 확인
   - `forge test` - 테스트 통과 확인
   - 검사 실패 시 커밋 중단하고 문제 보고

6. **커밋 메시지 작성**
   - git-workflow.md 규칙 준수
   - 형식: `<type>(<scope>): <summary>`
   - body에 WHY 설명 포함
   - **Squash 시**: 통합된 모든 변경사항을 포괄하는 메시지 작성

7. **커밋 실행** - 분리된 각 단위별로 순차 실행
   - 변경사항 스테이징 (해당 단위의 파일만)
   - 커밋 생성 (또는 squash 커밋)
   - 결과 확인
   - **다음 커밋 단위로 이동** (모든 단위 완료 시까지 반복)
   - **Squash 시**: `git push --force-with-lease` 실행
