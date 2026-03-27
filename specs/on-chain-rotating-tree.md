# Feature: On-chain Rotating Merkle Tree

## 목적 (Why)

현재 off-chain Merkle tree 구조에서 relayer가 root를 제출하므로, 악의적 relayer가 가짜 root를 제출하여 풀 전체 자금을 탈취할 수 있다. On-chain tree로 전환하여 relayer 신뢰를 제거하고, deposit 즉시 root가 갱신되어 UX도 개선한다.

## 결정사항 (What)

### 1. On-chain Incremental Merkle Tree

- Contract가 deposit 시점에 직접 Poseidon2 Merkle tree를 업데이트
- `submitRoot()`, `proposeRoot()`, `confirmRoot()` 삭제
- Root는 항상 올바름 — relayer 신뢰 불필요
- Relayer 역할 축소: "root 제출자" → "API 서버 (Merkle proof 조회)"

### 2. Tree Depth: 20

- Max leaves per tree: 1,048,576 (약 100만)
- Deposit 가스: ~382K (현재 ~120K 대비 ~3.2배)
- 회로 depth도 32 → 20으로 변경 (proving time 단축)

### 3. 순환 트리 (Rotating Trees)

- Tree가 가득 차면 (leafCount == 2^20) 새 tree 시작
- 과거 tree의 root는 `knownRoots`에 보존 → 기존 deposit 영구 인출 가능
- `currentTreeIndex`로 active tree 추적

### 4. Poseidon2 Solidity 직접 구현

검증된 BN254 호환 Poseidon2 Solidity 라이브러리가 존재하지 않으므로 직접 작성한다.

**파라미터 원천**: Noir stdlib / Barretenberg 소스에서 직접 추출
- Field: BN254 scalar field (`p = 21888242871839275222246405745257275088548364400416034343698204186575808495617`)
- State width: t=4
- S-box: x^5 (d=5)
- Rounds: Rf=8 (full), Rp=56 (partial)
- Round constants: Barretenberg C++ 소스에서 추출
- External matrix (full rounds): M4 matrix
- Internal matrix (partial rounds): diag(D) + 1 형태

**구현 방침**:
- 순수 Solidity (Yul/assembly 미사용) — 가독성, 감사 용이성 우선
- Round constants를 `internal pure` 함수 또는 `constant`로 하드코딩
- 가스 최적화는 정확성 검증 이후 단계적으로

**검증 전략**:
- Foundry 테스트에서 Noir `poseidon2Hash` 출력과 cross-check (수백 개 test vector)
- `testinprod-io/Poseidon2T4.sol`을 참조 구현으로 활용 (differential test)
- Noir 회로 테스트에서 생성한 hash 값을 Solidity 테스트의 expected 값으로 사용

## 아키텍처

### Storage Layout

```solidity
uint256 public constant TREE_DEPTH = 20;
uint256 public constant MAX_LEAVES = 2 ** TREE_DEPTH; // 1,048,576

uint256 public currentTreeIndex;

// treeIndex → level → filled subtree hash
// 각 레벨에는 해당 레벨까지 채워진 가장 최근 subtree hash 저장
mapping(uint256 => bytes32[TREE_DEPTH]) public filledSubtrees;

// treeIndex → leaf count
mapping(uint256 => uint256) public leafCounts;

// 모든 tree의 모든 known roots (과거 tree 포함)
mapping(bytes32 => bool) public knownRoots;
bytes32 public currentRoot;
```

### Deposit Flow (변경 후)

```
User calls deposit(commitment, amount, encryptedNote):
  1. ERC20 transferFrom
  2. 현재 tree가 가득 찼으면 → currentTreeIndex++
  3. Incremental Merkle tree insert:
     - leaf = commitment
     - 20 levels를 올라가며 Poseidon2 hash
     - filledSubtrees 업데이트
     - currentRoot = 새 root
  4. knownRoots[currentRoot] = true
  5. Emit Deposit, EncryptedNote
```

### Incremental Insert 알고리즘

```
function _insert(bytes32 leaf) → bytes32 root:
    treeIdx = currentTreeIndex
    idx = leafCounts[treeIdx]
    require(idx < MAX_LEAVES)

    current = leaf
    for level in 0..TREE_DEPTH:
        if idx % 2 == 0:
            // 왼쪽 자식: 현재 값 저장, 오른쪽은 zero hash
            filledSubtrees[treeIdx][level] = current
            current = poseidon2(current, ZEROS[level])
        else:
            // 오른쪽 자식: 저장된 왼쪽과 hash
            current = poseidon2(filledSubtrees[treeIdx][level], current)
        idx = idx / 2

    leafCounts[treeIdx]++
    return current
```

`ZEROS[level]`: 빈 subtree의 hash (compile-time 상수, level별 고정)

### Zero Hashes (Precomputed)

```
ZEROS[0]  = 0  (empty leaf)
ZEROS[1]  = poseidon2(0, 0)
ZEROS[2]  = poseidon2(ZEROS[1], ZEROS[1])
...
ZEROS[19] = poseidon2(ZEROS[18], ZEROS[18])
```

이 값들은 contract에 상수로 하드코딩.

### Root 관리

```solidity
// deposit() 내부
bytes32 newRoot = _insert(commitment);
currentRoot = newRoot;
knownRoots[newRoot] = true;
```

- 매 deposit마다 root 갱신 → 즉시 유효
- 과거 root도 knownRoots에 남음 → 이전 deposit의 proof가 유효

### Tree 순환

```solidity
function deposit(...) {
    if (leafCounts[currentTreeIndex] >= MAX_LEAVES) {
        currentTreeIndex++;
        // filledSubtrees[currentTreeIndex]는 기본값 0 → 자동으로 빈 트리
    }
    bytes32 newRoot = _insert(commitment);
    // ...
}
```

## 삭제 대상

| 함수/구조체 | 이유 |
|------------|------|
| `submitRoot()` | On-chain tree가 자동으로 root 갱신 |
| `proposeRoot()` | 동일 |
| `confirmRoot()` | 동일 |
| `cancelProposedRoot()` | 동일 |
| `PendingRoot` struct | 동일 |
| `pendingRoot` state | 동일 |
| `lastProcessedIndex` | leafCount로 대체 |
| `commitments` mapping | tree에 직접 삽입, 별도 저장 불필요 (이벤트로 충분) |

## 유지 대상

| 함수 | 변경 |
|------|------|
| `deposit()` | 내부에서 `_insert()` 호출 추가 |
| `withdraw()` | 변경 없음 (knownRoots 검증 동일) |
| `initiateWithdrawal()` | 변경 없음 |
| `attestWithdrawal()` | 변경 없음 |
| `claimWithdrawal()` | 변경 없음 |
| `setRelayer()` | 유지 (API 서버 역할로 relayer 존속) |

## 회로 변경

### Privacy Circuit

```diff
  fn main(
      ...
-     merkle_siblings: [Field; 32],
-     path_indices: [u1; 32],
+     merkle_siblings: [Field; 20],
+     path_indices: [u1; 20],
      ...
  )
```

`compute_merkle_root`도 depth 20 전용으로 변경, 또는 generic `compute_merkle_root_n<20>` 사용.

### Compliance Circuit

동일한 depth 변경.

### lib

`compute_merkle_root` 함수의 depth를 파라미터화하거나 20으로 고정.

## Sequencer 영향

### 삭제

- `ChainSync.maybeSubmitRoot()` — on-chain에서 자동
- `proposeRoot()` / `confirmRoot()` 호출 로직
- `OperatorService.confirmRoot()` — operator의 root 확인 역할 소멸

### 유지/변경

- `IncrementalMerkleTree` — 여전히 off-chain에서 유지 (API용 proof 조회)
- Deposit 이벤트 수집 → 로컬 tree에 반영 (proof serving용)
- **Off-chain tree는 on-chain tree의 미러** — 동기화 실패 시 chain에서 재구축 가능

## SDK 영향

- `getProof(leafIndex)` → sequencer API 호출은 동일
- Root는 contract에서 직접 읽기 가능 (`currentRoot` 또는 `knownRoots`)
- `submitRoot` 관련 로직 삭제

## 시나리오 (Scenarios)

### 정상 케이스

```
Given: Pool이 privacy mode로 배포됨 (depth 20 on-chain tree)
When:  Alice가 1000 USDT를 deposit
Then:  commitmentCount == 1
  And: currentRoot이 갱신됨
  And: knownRoots[currentRoot] == true
  And: Bob이 즉시 withdrawal proof 생성 가능
```

```
Given: Tree #0에 1,048,575개의 deposit이 있음 (마지막 1개 남음)
When:  Alice가 deposit
Then:  Tree #0이 가득 참 (leafCounts[0] == 1,048,576)
When:  Bob이 다음 deposit
Then:  currentTreeIndex == 1
  And: leafCounts[1] == 1
  And: Tree #0의 root는 여전히 knownRoots에 유효
```

### 경계값

```
Given: Tree #0이 가득 참
When:  Tree #1에 첫 deposit
Then:  Tree #1의 anonymity set == 1 (경계 약화 인지)
  And: Tree #0의 기존 depositor는 anonymity set == 1,048,576 유지
```

### 실패 케이스

```
Given: Contract에 Poseidon2 구현
When:  잘못된 round constant로 hash 계산
Then:  On-chain root와 off-chain root가 불일치
  And: Withdrawal proof가 실패
```

## 가스 비용 추정

| 항목 | 가스 |
|------|------|
| ERC20 transferFrom | ~55K |
| 20× Poseidon2 hash | ~330K |
| 20× SLOAD (filledSubtrees, warm) | ~2K |
| ~10× SSTORE (filledSubtrees, warm) | ~50K |
| knownRoots SSTORE (new) | ~22K |
| Event emit × 2 | ~3K |
| **Total deposit** | **~462K** |

## 범위 밖 (Out of scope)

- Batch withdrawal 구현 (별도 feature)
- Cross-tree anonymity set 통합 (Tree of Trees)
- Poseidon2 precompile 최적화 (EIP 의존)
- L2 배포 최적화
- Sequencer/SDK 코드 변경 (이번 스펙은 컨트랙트 + 회로만)

## 구현 순서

1. **Poseidon2 파라미터 추출**: Noir stdlib / Barretenberg C++ 소스에서 round constants, MDS matrix 추출
2. **Poseidon2 Solidity** (`contracts/src/Poseidon2.sol`): 순수 Solidity 구현
3. **Cross-check 테스트**: Noir에서 알려진 입력의 hash 출력 → Foundry 테스트의 expected 값으로 사용
4. **Zero hashes** 사전 계산 + 상수화 (depth 20)
5. **Incremental Merkle tree** + 순환 로직 (`contracts/src/MerkleTree.sol`)
6. **PrivacyPoolV2.sol 리팩토링**: root 제출 함수 삭제, deposit에 tree insert 추가
7. **회로 depth 32 → 20** 변경 (privacy + compliance 모두)
8. **통합 테스트**: deposit → on-chain root 갱신 → withdrawal proof 검증, tree 순환, gas 측정
