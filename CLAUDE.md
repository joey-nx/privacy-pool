# Claude Development Guidelines

> Guide Claude to write high-quality code with proper testing and git workflow

## 강제 조항 (Invariants)

모든 MUST/MUST NOT 규칙은 **[docs/iv.md](docs/iv.md)**에 정의되어 있다.

- **작업 전**: iv.md를 읽고 관련 조항 파악
- **작업 후**: 각 항목 위반 여부를 자가 검증
- **새 조항 도출 시**: iv.md에 추가

## 핵심 원칙

| 원칙 | 설명 |
|------|------|
| **질문 우선** | 불확실하면 가정하지 말고 질문한다. 요구사항, 접근 방식, 영향 범위 모두 해당 |
| **단순함 우선** | 기존 코드 재사용 > 공식 패키지 > 새 코드 작성 |
| **영향 분석** | 변경 전 사용처·테스트·동작 변경·성능을 파악. 기존 로직 영향 시 사용자 먼저 확인 |
| **게으름 금지** | 근본 원인을 찾는다. 임시 수정 없음. 시니어 개발자 기준 |
| **최소 영향** | 변경은 필요한 부분만. 새로운 버그 도입 금지 |

## 개발 워크플로우 — Intent-Driven Development (IDD)

```
Phase 0        Phase 1          Phase 2             Phase 3          Phase 4
대화/탐색  →   의도 문서화   →   테스트 우선 구현  →   사용자 검증  →   확정
(User ↔ AI)    (AI→User 승인)    (AI)                (User)           (AI)
```

> **적용 범위**: 기능 추가, 아키텍처 변경, 복잡한 버그 수정 등 비자명한 작업에 적용.
> 단순 수정(오타, 포맷팅, 명백한 버그)은 Phase 1을 생략하고 바로 구현 가능.

### Phase 0: 대화/탐색 (User ↔ AI)
1. [docs/iv.md](docs/iv.md) 관련 조항 확인
2. 사용자가 방향 제시, 질의응답으로 구체화
3. 주요 시나리오, 경계값, 제약조건 도출
4. 불확실하면 → **질문**

### Phase 1: 의도 문서화 (AI 작성 → User 승인)
대화 결과를 `docs/specs/<feature>.md`로 구조화:

```markdown
# Feature: <이름>

## 목적 (Why)
한 문장으로 이 변경이 필요한 이유

## 결정사항 (What)
- 대화에서 합의된 설계 결정 목록

## 시나리오 (Scenarios)
### 정상 케이스
- Given ... When ... Then ...

### 경계값
- 최소/최대/제로/오버플로우 등

### 실패 케이스
- 잘못된 입력, 권한 부족 등

## 범위 밖 (Out of scope)
이번에 하지 않는 것
```

**게이트**: 사용자 승인 없이 Phase 2로 진행하지 않는다.

### Phase 2: 테스트 우선 구현 (AI)
1. 의도 문서의 시나리오를 **테스트로 먼저 변환** (시나리오:테스트 = 1:1)
2. 테스트 통과를 위한 코드 구현
3. 기존 코드 검색 (Glob/Grep), [Coding Style](.claude/coding-style.md) 준수
4. 변경을 집중적이고 원자적으로 유지

### Phase 3: 사용자 검증 (User)
- "이 테스트들이 내 의도를 커버하는가?"
- "구현이 의도 문서와 일치하는가?"
- [docs/iv.md](docs/iv.md) MUST/MUST NOT 점검
- 갭 발견 시 → Phase 0으로 복귀

### Phase 4: 확정 (AI)
1. [Git Workflow](.claude/git-workflow.md) 규칙에 따라 커밋
2. ADR 작성 (아키텍처 결정이 있을 경우)
3. 의도 문서는 `specs/`에 영구 보존

## 워크플로우 오케스트레이션

### 1. 플랜 모드 기본값
- 비자명한 작업(3단계 이상 또는 아키텍처 결정)에는 반드시 플랜 모드 진입
- 일이 틀어지면 즉시 STOP하고 재계획 — 계속 밀어붙이지 말 것
- 빌드뿐 아니라 검증 단계에도 플랜 모드 활용
- 모호함을 줄이기 위해 사전에 상세 스펙 작성

### 2. 서브에이전트 전략
- 메인 컨텍스트 윈도우를 깨끗하게 유지하기 위해 서브에이전트를 적극 활용
- 리서치, 탐색, 병렬 분석은 서브에이전트에 위임
- 복잡한 문제에는 서브에이전트를 통해 더 많은 컴퓨팅 투입
- 집중된 실행을 위해 서브에이전트당 하나의 작업만 배정

### 3. 자기개선 루프
- 사용자로부터 수정 받을 때마다 `tasks/lessons.md`에 패턴 업데이트
- 동일한 실수를 방지하는 규칙을 스스로 작성
- 실수율이 낮아질 때까지 이 레슨들을 가차 없이 반복 개선

### 4. 변경 설명
- 각 단계에서 고수준 변경 요약 제공

### 5. 결과 문서화
- `tasks/todo.md`에 검토 섹션 추가

### 6. 레슨 캡처
- 수정 후 `tasks/lessons.md` 업데이트

## 기술 스택

### 핵심 도구

| 도구 | 버전 | 용도 |
|------|------|------|
| TypeScript | 5+ | SDK, Sequencer, Frontend, Scripts |
| Node.js | 18+ | 런타임 (tsx) |
| Noir (nargo) | 1.0.0-beta.18 | ZK 회로 |
| Foundry (forge) | 1.5.1+ | Solidity 빌드/테스트 |
| Rust | 1.75+ | Sequencer 향후 마이그레이션 대상 |

### 프론트엔드

| 도구 | 버전 | 용도 |
|------|------|------|
| Next.js | 16+ | App Router, RSC |
| React | 19+ | UI 프레임워크 |
| Tailwind CSS | v4 | 스타일링 |
| pnpm | 10+ | 패키지 매니저 |
| wagmi + viem | latest | 블록체인 연동 |

### 테스트

```bash
# 회로
cd circuits && nargo test

# 컨트랙트
cd contracts && forge test -vv

# 시퀀서
npx vitest run

# SDK
cd sdk && npx vitest run

# E2E
npm run test:e2e
```

## 문서 작성 규칙

- **다이어그램**: Mermaid만 사용 (ASCII art 금지)
- **스타일**: SBE — Given-When-Then으로 동작 명세
- **결정 기록**: 모든 설계 결정에 "왜(Why)" 포함
- **간결함**: 모든 문장이 가치를 더해야 한다. 중복 금지

## 참고 문서

| 문서 | 내용 |
|------|------|
| [docs/iv.md](docs/iv.md) | MUST/MUST NOT 강제 조항 |
| [.claude/coding-style.md](.claude/coding-style.md) | 코딩 스타일 (TypeScript, Rust, Solidity, Noir) |
| [.claude/frontend.md](.claude/frontend.md) | 프론트엔드 가이드 (Next.js, FSD, Tailwind) |
| [.claude/testing.md](.claude/testing.md) | 테스트 전략 (Vitest, Foundry, nargo) |
| [.claude/git-workflow.md](.claude/git-workflow.md) | 커밋 컨벤션, 브랜치 전략 |
| [specs/](specs/) | 의도 문서 (IDD Phase 1 산출물) |
