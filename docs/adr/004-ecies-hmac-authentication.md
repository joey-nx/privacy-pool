# ADR-004: ECIES HMAC-SHA256 Authentication

- **Status**: Accepted
- **Date**: 2026-02-25
- **Context**: ECIES 암호화에 MAC 없음 (ciphertext malleability)

## Problem

ECIES note 암호화가 XOR 스트림 암호만 사용하고 MAC이 없다. 공격자가 ciphertext의 비트를 플립하면 복호화 값이 예측 가능하게 변조된다 (XOR malleability).

```
원본: plaintext[i] ^ keyMaterial[i] = ciphertext[i]
변조: ciphertext[i] ^ delta → plaintext[i] ^ delta (예측 가능한 변조)
```

온체인 이벤트는 불변이지만, 오프체인 전송 중 변조 시 잘못된 secret으로 proof 생성 시도 (DoS). Operator note 변조 시 compliance 검증 실패.

## Decision Drivers

- 기존 ECIES 구조(ECDH + KDF + XOR) 유지하며 최소 변경
- 브라우저(SDK)와 Node.js(scripts) 양쪽에서 동작해야 함
- `@noble/hashes`가 양쪽 환경에서 이미 사용 가능 (transitive dependency)
- AES-GCM은 WebCrypto API 의존으로 동기 호출 불가

## Considered Options

### Option 1: HMAC-SHA256 (Chosen)

KDF에서 encryption key + MAC key를 분리 파생. `HMAC-SHA256(macKey, ciphertext)` 32바이트 MAC 추가.

**장점**: 기존 XOR 구조 유지, 동기 호출, `@noble/hashes` 활용, constant-time 비교
**단점**: Wire format 변경 (MAC 32B 추가)

### Option 2: AES-256-GCM

ECDH 공유 비밀에서 AES 키를 파생하고 GCM 모드로 암호화.

**기각 사유**: WebCrypto의 `subtle.encrypt`는 비동기 API. 현 구조에서 동기 호출 필요. Node.js와 브라우저 간 일관된 동기 API 확보 어려움.

### Option 3: ChaCha20-Poly1305

ECDH 공유 비밀에서 ChaCha20 키를 파생하고 Poly1305 MAC 적용.

**기각 사유**: `@noble/ciphers` 추가 dependency 필요. HMAC-SHA256으로 동일 보안 수준 달성 가능.

## Decision

**Option 1: HMAC-SHA256**

### KDF 변경

```typescript
// 기존: deriveKeyMaterial(sharedSecret, plaintext_length)
// 변경: deriveKeyMaterial(sharedSecret, plaintext_length + 32)
const keyMaterial = deriveKeyMaterial(sharedPoint, encLen + 32);
const encKey = keyMaterial.slice(0, encLen);
const macKey = keyMaterial.slice(encLen, encLen + 32);
```

기존 KDF 함수(`keccak256(shared_secret || counter)` 반복)를 그대로 사용하되 출력 길이만 확장. Encryption key 영역은 기존과 동일한 바이트 → **기존 KDF의 encryption key 부분은 변경 없음**.

### Wire Format

| 구성요소 | 기존 | 변경 |
|---------|------|------|
| Recipient note | `[ephPub(33) \| ct(128) \| viewTag(1)]` = 162B | `[ephPub(33) \| ct(128) \| mac(32) \| viewTag(1)]` = 194B |
| Operator note | `[ephPub(33) \| ct(32)]` = 65B | `[ephPub(33) \| ct(32) \| mac(32)]` = 97B |
| Combined | 227B | 291B |

### Constant-Time 비교

MAC 검증에 timing attack 방어를 위한 constant-time 비교 사용:

```typescript
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
```

### 영향 범위

| 파일 | 변경 |
|------|------|
| `scripts/lib/crypto.ts` | encrypt/decrypt에 MAC 추가 |
| `sdk/src/core/crypto.ts` | 동일 변경 (browser 버전) |
| `sdk/src/core/types.ts` | `EncryptedNote`, `OperatorNote`에 `mac` 필드 추가 |
| `sdk/src/core/notes.ts` | 파싱 오프셋 업데이트 |
| `sdk/src/chain/contracts.ts` | 직렬화 오프셋 업데이트 |
| `scripts/sequencer/operator.ts` | decrypt 호출에 `mac` 인자 추가 |

## Consequences

- On-chain calldata 64B/deposit 증가 (recipient 32B + operator 32B MAC)
- 기존 암호화된 노트와 비호환 (wire format 변경)
- 변조 시도 시 즉시 거부 (`ECIES: MAC verification failed`)
- Operator note 변조를 통한 compliance 우회 차단
