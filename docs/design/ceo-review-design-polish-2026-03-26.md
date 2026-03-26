# CEO Review: feat/design-polish

**Date:** 2026-03-26
**Branch:** feat/design-polish
**Base:** main
**Mode:** HOLD SCOPE
**Approach:** B — 기능 결함 수정 + 디자인 패턴 개선

---

## Context

디자인 리뷰(`/design-review`)에서 13개 이슈 발견, 8개를 main에서 수정(heading weights, text contrast, touch targets 등). 이 브랜치에서 나머지 7개 이슈를 추가 수정:

| 커밋 | 내용 | 카테고리 |
|------|------|----------|
| `0d343c9` | 히어로 `<Link><button>` 중첩 제거 | HTML 유효성 |
| `ad9957a` | 히어로 파티클 8개 삭제, 글로우 축소 | AI 슬롭 감소 |
| `45b2692` | `<main>` 랜드마크 추가 | 접근성 |
| `10b9ddb` | 로케일 스위처 터치 타겟 44px | 접근성 |
| `4217d17` | 모달 dialog role + focus trap | 접근성 |
| `2438ea5` | 모바일 햄버거 메뉴 + 드로어 | 반응형 |
| `c783ff4` | How It Works 비대칭 2컬럼 레이아웃 | AI 슬롭 감소 |

---

## 전제 도전 (Step 0A)

**맞는 문제를 풀고 있는가?** YES.

WCAG 대비 미달, 44px 터치 타겟 미달, 잘못된 HTML 중첩, 접근성 부재는 "디자인 취향" 문제가 아니라 **기능적 결함**이다. 크립토 프로토콜에서 UI 품질은 보안 신뢰의 프록시 — 허술한 UI는 허술한 코드라는 인식을 만든다.

**아무것도 안 하면?** 모바일 사용자가 네비게이션 불가, 스크린리더 사용자가 모달에 갇힘, 검색 엔진이 사이트 구조 파악 불가.

## Dream State Delta

```
CURRENT (main)                  THIS PR                        12-MONTH IDEAL
─────────────────────           ──────────────────              ─────────────────────
디자인 점수 C+                   B-→B (추정)                     A
AI 슬롭 D+                      C→C+ (추정)                     A (고유 브랜드)
접근성 거의 없음                  기본 확보 (dialog, trap, nav)   WCAG AA 완전 준수
모바일 네비 없음                  햄버거 메뉴 추가                 네이티브급 경험
Inter 기본 폰트                  유지 (deferred)                 커스텀 디스플레이 서체
```

---

## 아키텍처 (Section 1)

```
┌──────────────── Landing Page ────────────────┐
│  <nav>  Logo │ [Desktop: inline] │ Controls  │
│              │ [Mobile: ☰→Drawer]│           │
│  <main>                                       │
│    Hero (1 glow + 5 circles)                  │
│    Features (direct icons, no circles)        │
│    HowItWorks (lg: 2-col asymmetric)          │
│    Compliance (unchanged)                     │
│  </main>                                      │
│  <footer>                                     │
│                                               │
│  [Modal Layer: Portal → body]                 │
│    SendSuccessModal (role=dialog, focus trap)  │
│    WithdrawalProgressModal (role=dialog, trap) │
└───────────────────────────────────────────────┘
```

- 커플링 변경 없음
- `useFocusTrap` 공유 훅으로 적절히 분리
- 롤백: `git revert` (개별 커밋 가능)

---

## 에러 & 레스큐 (Section 2)

| 코드패스 | 실패 가능성 | 처리 |
|---------|-----------|------|
| `useFocusTrap` — focusable 0개 | Tab 순환 대상 없음 | ✅ `els.length === 0` 가드 |
| Mobile drawer scroll lock | 언마운트 시 복원 | ✅ useEffect cleanup |
| AnimatePresence exit 중 리렌더 | motion/react 관리 | ✅ 라이브러리 수준 |

**CRITICAL GAP: 0**

---

## 보안 (Section 3)

- 공격 표면 확장: **없음** (새 endpoint/데이터 흐름 없음)
- 새 의존성: **없음**
- 사용자 입력: **없음** (i18n 키는 정적)

**보안 이슈: 0**

---

## 엣지 케이스 (Section 4)

| 인터랙션 | 엣지 케이스 | 처리? |
|---------|-----------|------|
| 모바일 메뉴 연타 | React 배칭 | ✅ |
| 메뉴+뒤로가기 | pathname watch | ✅ |
| 메뉴+화면 회전 | md:hidden CSS | ✅ |
| 모달+드로어 동시 | scroll lock 충돌 | ⚠️ 이론적이나 실제 불가 (다른 페이지) |
| focus trap 동적 콘텐츠 | 매 Tab 재쿼리 | ✅ |

---

## 코드 품질 (Section 5)

- **기존 패턴 준수:** ✅
- **DRY:** scroll lock이 2곳에 분산 (focus trap + navigation) — **WARNING**, 향후 훅으로 통합 가능
- **과잉/과소 설계:** 적절
- `aria-hidden` 미처리 (모달 뒤 콘텐츠가 스크린리더에 노출) — **MEDIUM**

---

## 성능 (Section 7)

- 파티클 8개 삭제 → 렌더 성능 **개선**
- 모바일 드로어: 조건부 렌더링 (닫힌 상태에서 DOM에 없음)
- **성능 이슈: 0**

---

## 배포 (Section 9)

- DB 마이그레이션: 없음
- Feature flag: 불필요
- 롤백: `git revert` (전체 또는 개별)
- 스모크 테스트: 랜딩 로드 → 모바일 375px 네비 → 모달 Tab 키 → CTA 클릭

---

## 장기 궤적 (Section 10)

- **기술 부채:** scroll lock 중복 (소규모, S effort)
- **경로 의존성:** 없음
- **가역성:** 5/5
- **12개월 후 이해도:** 높음

---

## 미해결 (Deferred)

| # | 항목 | 이유 |
|---|------|------|
| 1 | Inter 폰트 교체 | 브랜드 결정 필요 |
| 2 | 색상 시맨틱 토큰화 | 대규모 리팩터 (ocean, not lake) |
| 3 | `aria-hidden` inert 처리 | 모달 뒤 콘텐츠 스크린리더 차단 |
| 4 | scroll lock 훅 통합 | DRY 개선 (S effort) |
| 5 | Compliance 섹션 분리 (4 jobs → 2-3) | 콘텐츠 구조 변경 필요 |
| 6 | 앱 UI stacked cards → proper layout | 대규모 재설계 |
| 7 | 컴포넌트 테스트 추가 | 프론트엔드 전반 테스트 부채 |

---

## 실패 모드 레지스트리

| 코드패스 | 실패 모드 | RESCUED? | TEST? | USER SEES? | LOGGED? |
|---------|----------|----------|-------|-----------|---------|
| useFocusTrap | focusable 0개 | Y | N | 무동작 | N |
| Mobile drawer | unmount 시 overflow 미복원 | Y (cleanup) | N | 스크롤 안됨 | N |
| Hero Link | 라우팅 실패 | Y (Next.js) | N | 404 | Y |

**CRITICAL GAP: 0**

---

## Completion Summary

```
+====================================================================+
|            MEGA PLAN REVIEW — COMPLETION SUMMARY                   |
+====================================================================+
| Mode selected        | HOLD SCOPE                                  |
| System Audit         | 15 commits, 12 files, 순수 UI               |
| Step 0               | Approach B 확인, HOLD SCOPE                 |
| Section 1  (Arch)    | 0 issues (clean architecture)               |
| Section 2  (Errors)  | 3 error paths mapped, 0 GAPS                |
| Section 3  (Security)| 0 issues                                    |
| Section 4  (Data/UX) | 5 edge cases mapped, 0 unhandled            |
| Section 5  (Quality) | 2 warnings (scroll lock DRY, aria-hidden)   |
| Section 6  (Tests)   | 0 new tests (기존 부채, 이 PR 범위 밖)       |
| Section 7  (Perf)    | 0 issues (파티클 제거로 개선)                |
| Section 8  (Observ)  | 0 gaps (프론트엔드 전용)                     |
| Section 9  (Deploy)  | 0 risks                                     |
| Section 10 (Future)  | 가역성: 5/5, 부채: 1 (scroll lock)          |
| Section 11 (Design)  | UI 개선 확인됨                               |
+--------------------------------------------------------------------+
| NOT in scope         | 7 items                                     |
| Dream state delta    | C+ → B (이 PR), 12개월 목표 A               |
| Error/rescue registry| 3 methods, 0 CRITICAL GAPS                  |
| Failure modes        | 3 total, 0 CRITICAL GAPS                    |
| TODOS.md updates     | 0 (기존 항목과 무관)                          |
| Scope proposals      | 0 (HOLD SCOPE)                              |
| CEO plan             | skipped (HOLD SCOPE)                        |
| Outside voice        | skipped (user requested fast completion)     |
| Lake Score           | N/A (HOLD SCOPE)                            |
| Diagrams produced    | 1 (system architecture)                     |
| Stale diagrams found | 0                                           |
| Unresolved decisions | 0                                           |
+====================================================================+
```

**결론:** 이 PR은 깨끗하다. 기능적 결함을 올바르게 수정하고, 새로운 위험을 도입하지 않으며, 모든 변경이 개별 revert 가능하다. 머지 권장.

---

*Generated by /plan-ceo-review on 2026-03-26 — HOLD SCOPE mode*
