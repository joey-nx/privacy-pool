# 참고 자료

> Privacy Pool 로드맵 관련 핵심 참고 자료. 각 항목마다 한줄 요약 + 우리 프로젝트와의 관계.

## EIP/ERC 표준

| 표준 | 요약 | 관계 |
|------|------|------|
| [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) | Agent Native Wallet — Agent 전용 스마트 계정 표준 | Phase 4 Unified Identity Tree의 Agent 신원 기반 |
| [ERC-8183](https://eips.ethereum.org/EIPS/eip-8183) | Intent-based Interaction Standard — Agent의 의도를 구조화된 형식으로 표현 | Phase 3 Intent Protocol 설계 시 참조 |
| [ERC-7710](https://eips.ethereum.org/EIPS/eip-7710) | Delegated Permissions — 권한 위임 프레임워크 | Agent에게 제한된 범위의 자금 접근 권한 위임 |
| [ERC-5564](https://eips.ethereum.org/EIPS/eip-5564) | Stealth Address Standard — 일회용 수신 주소 생성 | 현재 구현의 Stealth Address 레이어와 직접 관련 |
| [ERC-6538](https://eips.ethereum.org/EIPS/eip-6538) | Stealth Meta-Address Registry — 스텔스 주소 키 등록 온체인 레지스트리 | Stealth Address 키 배포 표준화에 활용 가능 |
| [ERC-4337](https://eips.ethereum.org/EIPS/eip-4337) | Account Abstraction — UserOperation 기반 스마트 계정 | Agent wallet 구현 시 인프라 레이어 (Bundler, Paymaster) |
| [EIP-7702](https://eips.ethereum.org/EIPS/eip-7702) | EOA→Smart Account 전환 — EOA에 코드를 임시 부여 | Agent가 EOA로 시작하여 점진적으로 기능 확장 시 활용 |

## 경쟁/관련 프로젝트

| 프로젝트 | 요약 | 관계 |
|----------|------|------|
| [0xbow](https://0xbow.io/) | Privacy Pool 첫 프로덕션 구현. Association Set Provider(ASP) 기반 컴플라이언스 | 가장 직접적인 경쟁자. 우리는 ASP 대신 Registration Tree + Compliance Hash 방식 |
| [Railgun](https://railgun.org/) | EVM 범용 프라이버시 시스템. UTXO + ZK-SNARKs | 범용 프라이버시에서 경험 풍부. 우리는 Agent 특화 + 규제 준수에 집중 |
| [Aztec](https://aztec.network/) | 프라이버시 L2. Noir 언어 개발사 | 우리 ZK 회로가 Noir 기반. Aztec의 암호 프리미티브(@aztec/foundation) 직접 사용 중 |
| [Labyrinth](https://labyrinth.technology/) | Compliant privacy protocol. 규제 준수형 프라이버시 | 유사한 포지셔닝. 차별점은 우리의 AI Agent 통합 |
| [Nocturne](https://nocturne.xyz/) | 프라이버시 프로토콜 (2024 종료) | 팀 해산으로 종료. 설계 문서와 실패 교훈 참고 가치 |

## AI Agent 프레임워크

| 프레임워크 | 요약 | 관계 |
|------------|------|------|
| [ElizaOS](https://elizaos.ai/) | 오픈소스 AI Agent 프레임워크. 플러그인 아키텍처, 멀티체인 지원 | Phase 2 MCP Server의 1차 통합 타겟. 플러그인으로 Privacy Pool 연결 |
| [Olas](https://olas.network/) | 자율 Agent 서비스 네트워크. Agent 조합(composition) 지원 | Olas Agent가 Privacy Pool을 서비스로 사용하는 시나리오 |
| [GAME by Virtuals](https://virtuals.io/) | Agent 게임이론 프레임워크. 전략적 의사결정 | Agent 전략 은닉이 필요한 대표 유스케이스 |
| [Wayfinder](https://wayfinder.ai/) | Agent 내비게이션 레이어. 온체인 경로 최적화 | Phase 3 Intent Solver와 시너지 — 경로 최적화 + 프라이버시 결합 |
| [Coinbase AgentKit](https://github.com/coinbase/agentkit) | Coinbase의 Agent 온체인 도구킷. MPC 지갑 통합 | MCP 표준 준수. 우리 MCP Server와 호환 가능한 인터페이스 설계 참고 |

## 학술 논문

| 논문 | 요약 | 관계 |
|------|------|------|
| [Privacy Pools (Buterin et al., 2023)](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4563364) | Privacy Pool 원논문. Association Set을 통한 규제 준수형 프라이버시 | 프로젝트 이론적 기반. ASP 대신 Registration Tree로 변형 구현 |
| [SoK: AI Agent Security](https://arxiv.org/abs/2502.02476) | AI Agent 보안 위협 체계화. Prompt injection, Tool abuse, 권한 탈취 | Phase 2 MCP 보안 모델 설계 시 위협 모델 참고 |
| [Agents on the Internet](https://arxiv.org/abs/2504.01382) | Agent가 인터넷을 사용할 때의 경제적 영향과 위험 | Agent Economy 이해. Shielded Intent의 필요성 근거 |
| [Device-Native Agents](https://arxiv.org/abs/2502.02137) | 디바이스 네이티브 Agent 아키텍처. 로컬 실행 + 프라이버시 | Client-side proving과 Agent의 교차점. Phase 2 설계 참고 |

## 규제 동향

| 항목 | 요약 | 관계 |
|------|------|------|
| FATF Travel Rule | 가상자산 이전 시 송수신인 정보 공유 의무 (1,000 USD 이상) | Compliance Hash가 Travel Rule 준수 경로를 제공. Operator가 필요 시 정보 제출 |
| MiCA (EU) | EU 암호자산 규제. 프라이버시 코인 상장폐지 압력 | "Compliant Privacy"가 MiCA 환경에서 유일한 생존 경로임을 뒷받침 |
| US Treasury 입장 | Tornado Cash 제재 + Privacy Pool 원논문에 대한 긍정적 반응 | Registration Tree 방식이 규제 기관이 수용 가능한 프라이버시 모델임을 시사 |
| OFAC SDN List | 미국 제재 대상 목록. 프라이버시 프로토콜의 컴플라이언스 필수 체크 | Registration Tree가 SDN 대상 배제를 온체인에서 강제하는 메커니즘 |
