# ADR-001: Merkle Root Integrity — Dual-Approval (Relayer + Operator)

- **Status**: Accepted (Updated 2026-02-25)
- **Date**: 2026-02-25
- **Context**: Relayer 무검증 root 제출 취약점 대응

## Problem

`PrivacyPoolV2.updateRoot()`는 relayer가 제출하는 root를 검증 없이 `knownRoots`에 등록한다. 단일 relayer 키가 탈취되면 가짜 root 등록 → 존재하지 않는 deposit에 대한 withdrawal이 가능하다.

## Decision Drivers

- EVM에 Poseidon2 precompile이 없어 온체인 Merkle 검증 불가
- 오프체인 Merkle tree는 이 제약 때문에 선택한 구조
- MVP에서 외부 인프라(Gnosis Safe) 없이 컨트랙트 레벨에서 해결 필요
- Operator 역할이 이미 존재하므로 추가 신뢰 가정 불필요

## Considered Options

### Option 1: Multisig Relayer (Gnosis Safe)

Relayer 주소를 Gnosis Safe 등 multisig로 설정.

**장점**: 구현 단순 (주소 변경만)
**단점**: 외부 인프라 의존, M-of-N 서명 조율 필요, 컨트랙트 자체에 보안 보장 없음

### Option 2: Dual-Approval (Chosen)

Relayer가 root를 제안(`proposeRoot`), Operator가 독립 검증 후 확인(`confirmRoot`).

**장점**: 컨트랙트 레벨 보안, 외부 인프라 불필요, 기존 역할 재활용
**단점**: 2 트랜잭션 필요 (가스 비용 ~2x), Operator 가용성 의존

### Option 3: Tree Update ZK Circuit (Deferred)

별도 Noir circuit이 `old_root + commitments[] → new_root` 전이를 증명.

**장점**: Trustless (수학적 보장)
**단점**: 추가 circuit 개발, 배치당 증명 생성 ~10-30초

## Decision

**Option 2: Dual-Approval**

### 컨트랙트 변경

```solidity
// 기존 (단일 트랜잭션, relayer만)
function updateRoot(bytes32 newRoot, uint256 processedUpTo) external;

// 변경 (2단계, relayer + operator)
function proposeRoot(bytes32 newRoot, uint256 processedUpTo) external;     // relayer only
function confirmRoot(bytes32 expectedRoot, uint256 expectedProcessedUpTo) external;  // operator only
function cancelProposedRoot() external;  // relayer or operator
```

### 핵심 설계

1. **독립 검증**: Operator는 `confirmRoot`에 자신이 계산한 root/processedUpTo를 명시적으로 전달. 제안과 불일치하면 revert.
2. **단일 pending**: 한 번에 하나의 제안만 존재. 새 제안 전 기존 제안 확인 또는 취소 필요.
3. **취소 가능**: Relayer 또는 Operator가 잘못된 제안을 취소 가능.

### 보안 분석

| 시나리오 | 결과 |
|----------|------|
| Relayer 키 탈취 | 가짜 root 제안 가능하지만 Operator 확인 없이는 활성화 불가 |
| Operator 키 탈취 | Root 제안 불가 (relayer 권한 필요) |
| 양쪽 모두 탈취 | 풀 자금 위험 (동일한 공격 표면이지만 확률 대폭 감소) |

### 시퀀서 변경

```typescript
// 기존
await contract.updateRoot(rootHex, processedUpTo);

// 변경 (relayer 시퀀서)
await contract.proposeRoot(rootHex, processedUpTo);
// Operator는 독립적으로 tree를 계산하고 confirmRoot 호출
```

## Canonical Tree Management

Merkle tree의 "원본"은 트리 자체가 아니라 **온체인 commitment 큐**(`commitments[0..N]`)이다.

```
On-Chain (Source of Truth)     Off-Chain (Derived Cache)
commitments[0] = c0     →     tree.insert(c0)
commitments[1] = c1     →     tree.insert(c1)
...                      →     ...
commitments[N-1]         →     tree.root == currentRoot
```

- 트리는 결정론적으로 파생되는 계산 결과 (materialized view)
- Relayer와 Operator가 독립적으로 동일한 트리를 구축하여 root 일치 여부 검증
- 시퀀서 장애 시 복구: 이벤트 0번부터 재생 → 동일 root 도출

## Future Migration

Tree Update ZK Circuit(Option 3)으로 전환 시:
- `proposeRoot` + `confirmRoot` → `verifyAndUpdateRoot(proof, publicInputs)`
- Trustless로 업그레이드하되 `setRelayer()`를 통해 proof-verifying contract 주소로 전환 가능

## Consequences

- Root 갱신에 2 트랜잭션 필요 (latency 증가)
- Operator 가용성이 root 갱신의 선행 조건 (24h timeout과 무관)
- 단일 키 타협으로 풀 자금 탈취 불가
