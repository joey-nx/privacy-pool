# Coding Style Guide

## Language-Specific Guides

| Language | Scope |
|----------|-------|
| [TypeScript](#typescript) | SDK, Sequencer, Frontend, Scripts |
| [Rust](#rust) | Sequencer (future migration) |
| [Solidity](#solidity) | Contracts (Foundry conventions) |
| [Noir](#noir) | Circuits |

---

## TypeScript

### Naming Conventions

| Target | Convention | Example |
|--------|-----------|---------|
| Variables/Functions | camelCase | `computeNullifier` |
| Types/Interfaces | PascalCase | `MerkleProof` |
| Constants | UPPER_SNAKE_CASE | `TREE_DEPTH` |
| Enums | PascalCase | `ProofStage` |
| Enum members | UPPER_SNAKE_CASE | `PENDING` |
| Files | kebab-case | `merkle-tree.ts` |
| React Components | PascalCase | `DepositForm.tsx` |

### Module Structure

```typescript
// ✅ Good — imports grouped: external → internal → types
import { secp256k1 } from "@noble/curves/secp256k1";

import { poseidon2Merkle } from "./crypto.js";
import { TREE_DEPTH } from "./types.js";

import type { MerkleProof } from "./types.js";
```

### Error Handling

```typescript
// ✅ Good — typed errors with context
class LatentError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "LatentError";
  }
}

// ✅ Good — explicit error for invalid state
function getBb(): BarretenbergSync {
  if (!bb) throw new Error("Crypto not initialized. Call initCrypto() first.");
  return bb;
}

// ❌ Bad — silently swallowing errors
try { doThing(); } catch { /* ignore */ }
```

### Async Patterns

```typescript
// ✅ Good — explicit cleanup
export async function initProver(circuit: Uint8Array): Promise<void> {
  backend = new UltraHonkBackend(circuit, { threads: 1 });
}

export function disposeProver(): void {
  backend?.destroy();
  backend = null;
}

// ❌ Bad — no cleanup, resource leak
let backend = new UltraHonkBackend(circuit);
```

### Type Safety

```typescript
// ✅ Good — branded types for domain safety
type Field = bigint & { readonly __brand: "Field" };

// ✅ Good — discriminated unions
export type ProofStage =
  | { step: "merkle"; message: string }
  | { step: "prove"; message: string }
  | { step: "submit"; message: string };

// ❌ Bad — stringly typed
function process(stage: string) { }
```

### Exports

```typescript
// ✅ Good — explicit re-exports in index.ts
export { computeNpk, computeCommitment } from "./core/crypto.js";
export type { NoteData, EncryptedNote } from "./core/types.js";

// ❌ Bad — barrel re-export everything
export * from "./core/crypto.js";
```

### BigInt Handling

```typescript
// ✅ Good — consistent Field formatting
export function fieldToHex(field: bigint): string {
  return "0x" + field.toString(16).padStart(64, "0");
}

// ✅ Good — constant-time comparison for crypto
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
```

### Security Rules (TypeScript)

- **Never** log private keys, secrets, or NSK values
- **Always** verify MAC before decrypting (Encrypt-then-MAC)
- **Always** use constant-time comparison for cryptographic values
- **Never** use `Math.random()` for crypto — use `crypto.getRandomValues()` or library RNG
- **Always** clear sensitive data from memory when done (`Uint8Array.fill(0)`)

---

## Rust

> Sequencer may be migrated to Rust in the future.

### Naming Conventions

| Target | Convention | Example |
|--------|-----------|---------|
| Functions/Variables | snake_case | `compute_nullifier` |
| Types/Traits/Enums | PascalCase | `MerkleProof` |
| Constants | SCREAMING_SNAKE_CASE | `TREE_DEPTH` |
| Modules | snake_case | `merkle_tree` |

### Error Handling

```rust
// ❌ NEVER in production
let config = load_config().unwrap();

// ✅ ALWAYS use ? operator
let config = load_config()?;
let value = map.get("key").ok_or(Error::KeyNotFound)?;
```

### Custom Error Types

```rust
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ServiceError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("Validation failed: {0}")]
    Validation(String),
}
```

### Async/Await

```rust
// ✅ Good — with timeout
async fn fetch_data(url: &str) -> Result<Response, Error> {
    timeout(Duration::from_secs(30), reqwest::get(url)).await??
}

// ✅ Good — spawn_blocking for CPU work
async fn prove(data: Vec<u8>) -> Result<Proof, Error> {
    tokio::task::spawn_blocking(move || generate_proof(data)).await?
}
```

### Memory

```rust
// ✅ Good — borrow over clone
fn process(name: &str) -> String { name.to_uppercase() }
fn find_user<'a>(users: &'a [User], id: UserId) -> Option<&'a User> {
    users.iter().find(|u| u.id == id)
}

// ✅ Good — slices over Vec references
fn sum(values: &[i32]) -> i32 { values.iter().sum() }
```

### Pre-Commit Checklist (Rust)

- [ ] No `.unwrap()` in production paths
- [ ] `cargo fmt` — formatted
- [ ] `cargo clippy -- -D warnings` — no warnings
- [ ] `cargo nextest run` — tests pass

---

## Solidity

Foundry 프로젝트 컨벤션을 따른다.

- `forge fmt` 적용
- Custom errors 사용 (`error InsufficientBalance()`)
- NatSpec 문서화 (`@notice`, `@param`, `@dev`)
- Events emit for all state changes
- CEI pattern (Checks-Effects-Interactions)

## Noir

- Circuit 내 모든 해시는 도메인 분리 상수 사용
- Private/Public input 구분 명확히
- Constraint 수 최소화

---

**Related**: [Frontend Guide](frontend.md) | [Testing Strategy](testing.md) | [Git Workflow](git-workflow.md)
