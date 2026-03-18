# language: ko
Feature: V2 Root 관리 (Relayer)

  PrivacyPoolV2 에서는 Merkle 트리를 오프체인에서 관리하며,
  relayer 가 새로운 root 를 컨트랙트에 제출한다.

  Background:
    Given PrivacyPoolV2 컨트랙트 (relayer 주소 설정됨)

  # ============================================================
  # updateRoot — Relayer 의 Merkle root 제출
  # ============================================================

  Scenario: Relayer 가 root 업데이트
    Given 1건의 deposit 이 큐에 존재 (commitmentCount = 1)
    When relayer 가 updateRoot(newRoot, processedUpTo=1) 호출
    Then currentRoot == newRoot
    And knownRoots[newRoot] == true
    And lastProcessedIndex == 1

  Scenario: RootUpdated 이벤트 발생
    When relayer 가 updateRoot(newRoot, processedUpTo) 호출
    Then RootUpdated(newRoot, processedUpTo) 이벤트 발생

  Scenario: 비 relayer 는 root 업데이트 불가
    When relayer 가 아닌 주소에서 updateRoot 호출
    Then "Only relayer" 로 revert

  Scenario: 새 커밋먼트 없으면 거부
    Given lastProcessedIndex == 0, commitmentCount == 0
    When updateRoot(root, processedUpTo=0) 호출
    Then "No new commitments" 로 revert

  Scenario: processedUpTo 가 commitmentCount 초과 시 거부
    Given commitmentCount == 1
    When updateRoot(root, processedUpTo=2) 호출
    Then "Exceeds commitments" 로 revert

  Scenario: 여러 차례 root 업데이트
    Given 3건의 deposit
    When relayer 가 updateRoot(root1, 2) → 이후 updateRoot(root2, 3) 호출
    Then lastProcessedIndex == 3
    And knownRoots[root1] == true
    And knownRoots[root2] == true
    And currentRoot == root2

  # ============================================================
  # Relayer HTTP API
  # ============================================================

  Scenario: Relayer 가 Merkle proof 제공
    Given relayer 서비스가 구동 중
    When GET /proof/:leafIndex 요청
    Then { root, leafIndex, commitment, siblings, pathIndices } 응답

  Scenario: Relayer 상태 조회
    When GET /root 요청
    Then { root, leafCount, lastProcessedIndex } 응답
