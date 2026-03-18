# language: ko
Feature: 2단계 출금 (2-Stage Withdrawal)

  출금은 3개의 함수로 구성된 2단계 프로세스:
    Stage 1: initiateWithdrawal — ZK 증명 검증 후 자금 보류
    Stage 2a: attestWithdrawal — 운영자가 즉시 승인
    Stage 2b: claimWithdrawal — 24시간 타임아웃 후 누구나 호출 가능

  PrivacyPoolV2 는 5개 Field 공개 입력을 사용한다.

  # ============================================================
  # Stage 1: initiateWithdrawal
  # ============================================================

  Scenario: 유효한 ZK 증명으로 출금 개시
    Given 유효한 deposit 과 Merkle root 가 등록됨
    When initiateWithdrawal(proof, publicInputs) 호출
    Then PendingWithdrawal 이 저장됨:
      | 필드            | 값                              |
      | recipient       | publicInputs 에서 추출된 주소    |
      | amount          | publicInputs 에서 추출된 금액    |
      | complianceHash  | publicInputs 에서 추출된 해시    |
      | deadline        | block.timestamp + 24 hours       |
      | completed       | false                            |
    And nullifier 가 사용됨으로 마킹
    And 자금은 컨트랙트에 보류 (수신자에게 미전송)

  Scenario: WithdrawalInitiated 이벤트 발생
    When 유효한 initiateWithdrawal 호출
    Then WithdrawalInitiated(nullifier, recipient, amount, complianceHash) 이벤트 발생

  Scenario: 중복 nullifier 거부
    Given 이미 사용된 nullifier
    When 동일한 nullifier 로 initiateWithdrawal 호출
    Then "Nullifier used" 로 revert

  Scenario: 공개 입력 부족 거부
    When 5개 미만의 공개 입력으로 호출
    Then "Too few public inputs" 로 revert

  Scenario: 알 수 없는 Merkle root 거부
    Given knownRoots 에 없는 root 를 공개 입력에 포함
    When initiateWithdrawal 호출
    Then "Unknown root" 로 revert

  Scenario: ZK 증명 검증 실패 시 거부
    Given verifier.verify() 가 revert 하는 설정
    When initiateWithdrawal 호출
    Then verifier 의 revert 메시지로 트랜잭션 실패

  # ============================================================
  # Stage 2a: attestWithdrawal (운영자 즉시 승인)
  # ============================================================

  Scenario: 운영자 승인 → 자금 즉시 전송
    Given 보류 중인 출금 (completed = false)
    When operator 가 attestWithdrawal(nullifier) 호출
    Then recipient 에게 amount 만큼 토큰 전송
    And completed = true 로 마킹
    And WithdrawalAttested 및 WithdrawalClaimed(attested=true) 이벤트 발생

  Scenario: 비운영자 승인 거부
    Given 보류 중인 출금
    When operator 가 아닌 주소에서 attestWithdrawal 호출
    Then "Only operator" 로 revert

  Scenario: 존재하지 않는 출금 승인 거부
    When 등록되지 않은 nullifier 로 attestWithdrawal 호출
    Then "No pending withdrawal" 로 revert

  Scenario: 이미 완료된 출금 재승인 거부
    Given completed = true 인 출금
    When attestWithdrawal 재호출
    Then "Already completed" 로 revert

  # ============================================================
  # Stage 2b: claimWithdrawal (24시간 타임아웃)
  # ============================================================

  Scenario: 타임아웃 후 누구나 claim 가능
    Given 보류 중인 출금 (deadline 경과)
    When 임의의 주소에서 claimWithdrawal(nullifier) 호출
    Then recipient 에게 amount 만큼 토큰 전송 (호출자가 아닌 원래 수신자)
    And completed = true 로 마킹
    And WithdrawalClaimed(attested=false) 이벤트 발생

  Scenario: 타임아웃 전 claim 거부
    Given deadline 미경과 (block.timestamp < deadline)
    When claimWithdrawal 호출
    Then "Window active" 로 revert

  Scenario: 존재하지 않는 출금 claim 거부
    When 등록되지 않은 nullifier 로 claimWithdrawal 호출
    Then "No pending withdrawal" 로 revert

  Scenario: 이미 완료된 출금 재claim 거부
    Given operator 가 이미 attestWithdrawal 완료
    When 24시간 후 claimWithdrawal 호출
    Then "Already completed" 로 revert
