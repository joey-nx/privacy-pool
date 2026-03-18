# ADR (Architecture Decision Record) 생성

현재 대화에서 논의된 기술적 결정을 ADR로 기록합니다.

## 절차

1. **대화 분석**
   - 현재 대화에서 논의된 기술적 결정을 식별
   - 결정이 명확하지 않으면 사용자에게 확인 요청

2. **기존 ADR 확인**
   - `docs/adr/` 디렉토리의 기존 ADR 파일 목록 확인
   - 중복 주제가 있는지 확인
   - 다음 번호 결정 (예: 001, 002, ...)

3. **ADR 작성**
   - 파일명: `docs/adr/{번호}-{kebab-case-제목}.md`
   - 아래 템플릿 사용:

```markdown
# ADR-{번호}: {제목}

- **Status**: Accepted | Proposed | Deprecated | Superseded by ADR-{N}
- **Date**: {YYYY-MM-DD}
- **Context**: {한 줄 요약}

## Problem

{해결하려는 문제. 2-3문장으로 간결하게.}

## Considered Options

### Option 1: {이름} (Chosen | Rejected | Deferred)

{설명. 장단점 포함.}

### Option 2: {이름} (Chosen | Rejected | Deferred)

{설명. 장단점 포함.}

## Decision

{최종 결정과 이유. 구체적으로.}

## Consequences

{결정으로 인한 영향. 긍정적/부정적 모두 포함.}
```

4. **작성 원칙**
   - **간결**: 각 섹션은 필요한 정보만. 장황한 설명 금지.
   - **Why 중심**: "무엇을 결정했나"보다 "왜 그렇게 결정했나"가 중요
   - **옵션 비교**: 기각된 옵션도 반드시 기록 (같은 논의 반복 방지)
   - **코드 예시**: 필요한 경우 최소한의 코드 스니펫 포함

5. **사용자 확인**
   - 작성된 ADR 내용을 사용자에게 보여주고 승인 요청
   - 승인 후 파일 생성
