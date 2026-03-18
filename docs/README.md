# Latent Documentation

> Compliant Privacy Stablecoin — 조건부 프라이버시 결제 시스템

## Documents

| 문서 | 내용 |
|------|------|
| [design/architecture.md](./design/architecture.md) | 시스템 개요, 데이터 흐름, 프로젝트 구조 |
| [design/circuit.md](./design/circuit.md) | ZK 회로 설계, 제약조건, 암호화 프리미티브 |
| [design/contracts.md](./design/contracts.md) | PrivacyPoolV2 스마트 컨트랙트 |
| [design/sequencer.md](./design/sequencer.md) | 시퀀서 서비스 (Merkle Tree + Scanner + Operator) |
| [design/sdk.md](./design/sdk.md) | Web SDK (브라우저 ZK proving + MetaMask) |
| [design/compliance.md](./design/compliance.md) | Compliance 요구사항 및 설계 |
| [design/security.md](./design/security.md) | 보안 분석 및 프로덕션 전 필수 조치 |

## Specifications

| 문서 | 내용 |
|------|------|
| [spec/circuit.feature](./spec/circuit.feature) | ZK 회로 BDD 시나리오 |
| [spec/deposit.feature](./spec/deposit.feature) | 예치 BDD 시나리오 |
| [spec/withdrawal.feature](./spec/withdrawal.feature) | 2단계 출금 BDD 시나리오 |
| [spec/compliance.feature](./spec/compliance.feature) | 컴플라이언스 BDD 시나리오 |
| [spec/root-management.feature](./spec/root-management.feature) | Root 관리 BDD 시나리오 |

## Architecture Decision Records

| ADR | 결정 |
|-----|------|
| [ADR-001](./adr/001-merkle-root-integrity.md) | Merkle Root 무결성 — Dual-Approval (Relayer + Operator) |
| [ADR-002](./adr/002-registration-tree.md) | Registration Tree — KYC-Bound NPK 검증 |
| [ADR-003](./adr/003-compliance-hash-salt.md) | Compliance Hash Salt — brute-force 방어 |
| [ADR-004](./adr/004-ecies-hmac-authentication.md) | ECIES HMAC-SHA256 인증 — ciphertext 변조 방어 |
