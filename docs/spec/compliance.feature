# language: ko
Feature: 컴플라이언스 (Compliance)

  ZK 회로의 compliance hash 로 송수신자 정보를 바인딩하고,
  오프체인 ECIES 암호화 (HMAC-SHA256 인증) 로 운영자만 해독 가능하게 한다.

  # ============================================================
  # Compliance Hash (인서킷)
  # ============================================================

  Scenario: Compliance hash 가 depositor, recipient, amount, secret 을 바인딩
    Given depositor = 0xaAaA...aaAa, recipient = 0xbBbB...BbB, amount = 500000, secret = 42
    When compliance_hash = poseidon2([depositor, recipient, amount, secret, DOMAIN_COMPLIANCE])
    And 회로의 public input 으로 compliance_hash 제출
    Then 제약 조건 "Compliance hash mismatch" 를 통과
    # → secret salt로 Observer의 brute-force 역산 방지 (ADR-003)

  Scenario: Compliance hash 변조 시 증명 실패
    Given 올바른 compliance_hash
    When public input 의 compliance_hash 를 다른 값으로 교체
    Then 제약 조건 "Compliance hash mismatch" 로 실패

  Scenario: Compliance hash 민감도 — depositor 변경
    When depositor 만 다른 두 compliance_hash 를 계산
    Then 두 결과가 상이

  Scenario: Compliance hash 민감도 — recipient 변경
    When recipient 만 다른 두 compliance_hash 를 계산
    Then 두 결과가 상이

  Scenario: Compliance hash 민감도 — amount 변경
    When amount 만 다른 두 compliance_hash 를 계산
    Then 두 결과가 상이

  Scenario: Compliance hash 민감도 — secret 변경
    When secret 만 다른 두 compliance_hash 를 계산
    Then 두 결과가 상이

  # ============================================================
  # Recipient 주소 검증 (인서킷)
  # ============================================================

  Scenario: Recipient 이 Ethereum 주소 범위 (160-bit) 내
    Given recipient = 0xbBbB...BbBb (160-bit 주소)
    When ZK proof 생성
    Then 제약 조건 통과 (to_be_bytes::<20> 성공)

  Scenario: Recipient 이 2^160 이상이면 증명 실패
    Given recipient = 2^160 + 0xbBbB (절삭 공격 시도)
    When ZK proof 생성 시도
    Then constraint failure (160-bit 범위 초과)

  # ============================================================
  # Operator Note 암호화 (오프체인, HMAC-SHA256 인증)
  # ============================================================

  Scenario: Operator note 로 secret 암호화/복호화
    Given Operator 의 secp256k1 키 쌍 (privKey, pubKey)
    And secret = 42
    When Alice 가 pubKey 로 ECIES 암호화 (ECDH + KDF + XOR + HMAC-SHA256)
    Then 결과: ephemeralPubKey (33B) + ciphertext (32B) + mac (32B) = 97 bytes
    And Operator 가 privKey 로 MAC 검증 + 복호화하면 원본 secret 복원

  Scenario: Operator note 변조 시 복호화 거부
    Given 유효한 operator note (97B)
    When ciphertext 의 1 bit 를 변조
    Then MAC 검증 실패: "ECIES: MAC verification failed"
    # → ADR-004: HMAC-SHA256 인증으로 변조 탐지

  Scenario: On-chain payload 포맷
    Given 수신자 note (194B) 와 operator note (97B) 생성
    When deposit 시 [recipientNote | operatorNote] = 291 bytes 로 인코딩
    Then 시퀀서/SDK 에서 길이로 판별 (291B = recipient 194B + operator 97B)

  # ============================================================
  # ECIES 노트 암호화 (오프체인, HMAC-SHA256 인증)
  # ============================================================

  Scenario: ECIES 노트 암호화 및 복호화
    Given Bob 의 secp256k1 키 쌍 (privKey, pubKey)
    And 노트 데이터: secret, amount, blockNumber, depositor (128 bytes)
    When Alice 가 pubKey 로 ECIES 암호화 (ECDH + KDF + XOR + HMAC-SHA256)
    Then 결과: ephemeralPubKey (33B) + ciphertext (128B) + mac (32B) + viewTag (1B) = 194B
    And Bob 이 privKey 로 MAC 검증 + 복호화하면 원본 노트 데이터 복원

  Scenario: Recipient note 변조 시 복호화 거부
    Given 유효한 recipient note (194B)
    When ciphertext 의 임의 바이트를 변조
    Then MAC 검증 실패: "ECIES: MAC verification failed"

  Scenario: View tag 로 빠른 필터링
    Given Bob 의 privKey 와 Alice 의 ephemeralPubKey
    When viewTag = keccak256(ECDH(privKey, ephemeralPubKey))[0]
    Then 1 바이트 비교로 99.6% 의 무관한 이벤트를 빠르게 스킵

  # ============================================================
  # 2-Stage Withdrawal (Compliance 검증)
  # ============================================================

  Scenario: Operator 즉시 승인
    Given Bob 이 유효한 ZK proof 로 initiateWithdrawal 호출
    And Operator 가 compliance 검증 통과 확인
    When Operator 가 attestWithdrawal(nullifier) 호출
    Then Bob 에게 즉시 토큰 전송

  Scenario: 24h timeout 후 자동 출금 (검열 저항)
    Given Bob 이 유효한 ZK proof 로 initiateWithdrawal 호출
    And Operator 가 24시간 내 attestation 하지 않음
    When 24시간 경과 후 claimWithdrawal(nullifier) 호출
    Then Bob 에게 토큰 전송 (operator 승인 불필요)

  Scenario: 24h 미경과 시 claim 거부
    Given initiateWithdrawal 후 12시간 경과
    When claimWithdrawal(nullifier) 호출
    Then revert: "Window active"

  # ============================================================
  # KYC Registration (ZK 레벨 강제)
  # ============================================================

  Scenario: KYC 등록 사용자 출금 성공
    Given Bob 의 NPK 가 Registration Tree 에 등록됨
    When Bob 이 ZK proof 생성 (constraint 6: NPK in Registration Tree)
    Then proof 검증 통과 → withdrawal 가능

  Scenario: 미등록 사용자 출금 불가
    Given Carol 의 NPK 가 Registration Tree 에 미등록
    When Carol 이 ZK proof 생성 시도
    Then constraint 6 실패: Registration Tree Merkle proof 불일치

  # ============================================================
  # Operator Compliance 검증 흐름
  # ============================================================

  Scenario: Operator 가 compliance hash 를 독립적으로 검증
    Given WithdrawalInitiated 이벤트 수신 (nullifier, recipient, amount, complianceHash)
    And deposit 이벤트에서 depositor 주소 + encrypted operatorNote 조회
    When Operator 가 operator note 복호화 → secret 복원
    And poseidon2(depositor, recipient, amount, secret, DOMAIN_COMPLIANCE) 계산
    Then 계산된 hash == on-chain complianceHash 확인

  Scenario: Operator note 복호화 실패 시 fallback
    Given operator note 복호화 실패 (키 불일치 또는 손상)
    When Operator 가 compliance 검증 불가
    Then attestation 보류 → 24h timeout 후 사용자가 직접 claim

  # ============================================================
  # V2 EncryptedNote 이벤트
  # ============================================================

  Scenario: V2 deposit 시 암호화된 노트 이벤트 발생
    When PrivacyPoolV2.deposit(commitment, amount, encryptedNote) 호출
    Then EncryptedNote(leafIndex, encryptedNote) 이벤트 발생
    # → 수신자와 운영자가 각각 자신의 note 를 복호화
