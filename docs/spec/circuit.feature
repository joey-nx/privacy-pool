# language: ko
Feature: ZK 회로 제약 조건

  Latent Noir 회로는 Poseidon2 해시(t=4, rate=3, capacity=1)를 사용하며,
  6개의 제약 조건을 통해 프라이버시와 무결성을 동시에 보장한다.

  Background:
    Given Poseidon2 sponge (t=4, rate=3, capacity=1)로 해싱
    And 도메인 분리자:
      | 도메인          | 값 |
      | DOMAIN_COMMITMENT | 1 |
      | DOMAIN_NULLIFIER  | 2 |
      | DOMAIN_MERKLE     | 3 |
      | DOMAIN_COMPLIANCE | 4 |
      | DOMAIN_NPK        | 5 |

  # ============================================================
  # 1. NPK 바인딩 (Nullifier Public Key)
  # ============================================================

  Scenario: 유효한 NPK 바인딩
    Given Bob의 nullifier_secret_key (nsk) = 12345
    When npk = poseidon2([nsk, DOMAIN_NPK]) 를 계산
    And 회로에 nsk와 npk를 입력
    Then 제약 조건 "NPK does not match NSK" 를 통과

  Scenario: 잘못된 nsk → NPK 불일치
    Given Bob의 nsk = 12345 로 생성된 npk
    When 회로에 다른 nsk = 77777 을 입력 (npk는 Bob의 것 유지)
    Then 제약 조건 "NPK does not match NSK" 로 실패

  # ============================================================
  # 2. Merkle Inclusion (깊이 32)
  # ============================================================

  Scenario: 유효한 Merkle root 검증
    Given 커밋먼트가 Merkle 트리 (depth=32) 의 leaf index 0 에 삽입됨
    When 올바른 siblings 와 path_indices 로 root를 계산
    Then computed_root == expected_root 를 만족

  Scenario: 손상된 Merkle root
    Given 커밋먼트로 생성된 유효한 Merkle proof
    When expected_root 를 임의의 값 12345 로 교체
    Then 제약 조건 "Merkle root mismatch" 로 실패

  Scenario: 다른 leaf index 에서도 정상 동작
    Given 커밋먼트가 leaf index 7 에 삽입됨
    When 해당 인덱스의 siblings 와 path_indices 로 root를 계산
    Then computed_root == expected_root 를 만족

  # ============================================================
  # 3. Nullifier 정합성
  # ============================================================

  Scenario: 유효한 nullifier
    Given secret = 42, nsk = 12345
    When nullifier = poseidon2([secret, nsk, DOMAIN_NULLIFIER]) 를 계산
    And 회로에 동일한 secret, nsk, nullifier 를 입력
    Then 제약 조건 "Nullifier mismatch" 를 통과

  Scenario: 잘못된 nullifier
    Given 올바른 secret 과 nsk 로 생성된 nullifier
    When 회로의 public input nullifier 를 다른 값으로 교체
    Then 제약 조건 "Nullifier mismatch" 로 실패

  Scenario: Alice (예치자) 는 nsk 없이 출금 불가
    Given Alice 가 secret 을 알지만, Bob의 nsk 를 모름
    When Alice 가 자신의 nsk (= 99999) 로 회로를 실행
    Then Alice 의 computed_npk 가 커밋먼트의 npk 와 불일치
    And 제약 조건 "NPK does not match NSK" 로 실패

  # ============================================================
  # 4. 금액 유효성
  # ============================================================

  Scenario: 전액 전송
    Given note_amount = 1,000,000, transfer_amount = 1,000,000
    When 회로를 실행
    Then transfer_amount <= note_amount 를 만족
    And amount == transfer_amount 를 만족

  Scenario: 부분 전송
    Given note_amount = 1,000,000, transfer_amount = 500,000
    When 회로를 실행
    Then transfer_amount <= note_amount 를 만족

  Scenario: 최소 금액 (1)
    Given note_amount = 1,000,000, transfer_amount = 1
    When 회로를 실행
    Then transfer_amount > 0 를 만족
    And transfer_amount <= note_amount 를 만족

  Scenario: 잔액 초과 → 오버플로우
    Given note_amount = 1,000,000, transfer_amount = 1,000,001
    When 회로를 실행
    Then 제약 조건 "Insufficient note balance" 로 실패

  # ============================================================
  # 5. Compliance Hash
  # ============================================================

  Scenario: 유효한 compliance hash (secret salt 포함)
    Given depositor, recipient, transfer_amount, secret 으로 계산한 compliance_hash
    When compliance_hash = poseidon2([depositor, recipient, amount, secret, DOMAIN_COMPLIANCE])
    And 회로에 동일한 값을 입력
    Then 제약 조건 "Compliance hash mismatch" 를 통과

  Scenario: 변조된 compliance hash
    Given 유효한 compliance_hash 를 계산
    When 회로의 public input compliance_hash 를 12345 로 교체
    Then 제약 조건 "Compliance hash mismatch" 로 실패

  # ============================================================
  # 해시 결정성 및 민감도
  # ============================================================

  Scenario: 도메인 분리자 고유성
    Then DOMAIN_COMMITMENT != DOMAIN_NULLIFIER
    And DOMAIN_NULLIFIER != DOMAIN_MERKLE
    And DOMAIN_MERKLE != DOMAIN_COMPLIANCE
    And DOMAIN_COMPLIANCE != DOMAIN_NPK
    And DOMAIN_COMMITMENT != DOMAIN_NPK

  Scenario: NPK 결정성
    When 동일한 nsk 로 npk 를 두 번 계산
    Then 두 결과가 동일

  Scenario: NPK 민감도
    When 서로 다른 nsk (11111, 22222) 로 npk 를 계산
    Then 두 결과가 상이

  Scenario: Commitment 결정성
    When 동일한 (secret, npk, amount, block, depositor) 로 커밋먼트를 두 번 계산
    Then 두 결과가 동일

  Scenario: Commitment 민감도 — 각 필드 변경 시 결과 변경
    Then amount 변경 시 commitment 변경
    And block_number 변경 시 commitment 변경
    And depositor 변경 시 commitment 변경
    And npk 변경 시 commitment 변경
