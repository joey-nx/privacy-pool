# language: ko
Feature: 예치 (Deposit)

  사용자가 ERC20 토큰과 커밋먼트를 제출하여 Privacy Pool에 자금을 예치한다.
  PrivacyPoolV2 는 오프체인 Poseidon2 Merkle 트리를 사용한다.

  Scenario: 예치 — 커밋먼트 큐에 저장
    Given PrivacyPoolV2 컨트랙트와 MockUSDT
    And Alice 가 토큰을 approve
    When Alice 가 deposit(commitment, amount, encryptedNote) 호출
    Then commitmentCount 가 1 로 증가
    And commitments[0] == commitment
    And 컨트랙트 잔액이 amount 만큼 증가

  Scenario: 예치 — root 미변경
    Given V2 컨트랙트의 currentRoot
    When deposit 호출 후
    Then currentRoot 는 변경되지 않음
    # root 는 relayer 의 updateRoot 으로만 변경

  Scenario: 예치 — Deposit + EncryptedNote 이벤트
    When deposit(commitment, amount, encryptedNote) 호출
    Then Deposit(commitment, leafIndex, amount, timestamp) 이벤트 발생
    And EncryptedNote(leafIndex, encryptedNote) 이벤트 발생

  Scenario: 예치 — 영액 거부
    When deposit(commitment, 0, "") 호출
    Then "Zero deposit" 로 revert

  Scenario: 다중 예치 — commitmentCount 증가
    When 3회 연속 예치
    Then commitmentCount == 3
    And 컨트랙트 잔액 == 3 * DEPOSIT_AMOUNT
