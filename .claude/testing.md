# Testing Strategy

## CRITICAL RULE: Never Modify Tests Without Permission

**This is the MOST IMPORTANT rule.**

### Absolute Prohibition

Claude must **NEVER**:
- Delete test code
- Comment out tests
- Modify existing test assertions
- Change test expectations
- Remove or disable test cases

...without **explicit user approval FIRST**.

### What to Do Instead

```
⚠️ STOP and ASK:

"I've made changes that affect these tests:
- test_user_creation
- test_user_validation

The tests are failing because [specific reason].

Should I:
1. Update the tests to match the new behavior
2. Revert my changes to keep tests passing
3. Add new tests alongside the existing ones
4. Something else?"
```

---

## Test Matrix

| Component | Framework | Command | Config |
|-----------|-----------|---------|--------|
| Circuits | nargo test | `cd circuits && nargo test` | Nargo.toml |
| Contracts | Foundry | `cd contracts && forge test -vv` | foundry.toml |
| Sequencer | Vitest | `npx vitest run` | vitest.config.ts |
| SDK | Vitest | `cd sdk && npx vitest run` | sdk/vite.config.ts |
| Frontend | Vitest + Testing Library | `pnpm -w test` | vitest.config.ts |
| E2E | Shell + nargo + bb | `npm run test:e2e` | — |

---

## TypeScript Tests (Vitest)

### Test Structure

```typescript
import { describe, it, expect, beforeAll } from "vitest";

describe("MerkleTree", () => {
  describe("buildMerkleTree", () => {
    it("should compute correct root for single leaf", () => {
      // Arrange
      const leaf = 42n;

      // Act
      const tree = buildMerkleTree([leaf], 3);

      // Assert
      expect(tree.root).toBeDefined();
      expect(tree.proofs.size).toBe(1);
    });

    it("should produce valid proof for each leaf", () => {
      const leaves = [1n, 2n, 3n];
      const tree = buildMerkleTree(leaves, 3);

      for (const [idx, proof] of tree.proofs) {
        const verified = verifyProof(leaves[idx], proof, tree.root);
        expect(verified).toBe(true);
      }
    });
  });
});
```

### Naming Convention

```
<module>.test.ts              # Unit tests
<module>.integration.test.ts  # Integration tests
```

### Test Organization

| Type | Location | Purpose |
|------|----------|---------|
| Unit | `__tests__/<module>.test.ts` | Individual function/class |
| Integration | `__tests__/<module>.integration.test.ts` | Cross-module interaction |
| Fixtures | `__tests__/fixtures/` | Shared test data |

### Running Tests

```bash
# Run all sequencer tests
npx vitest run

# Run specific test file
npx vitest run scripts/sequencer/__tests__/tree.test.ts

# Watch mode
npx vitest

# With coverage
npx vitest run --coverage
```

### Async Tests

```typescript
it("should initialize crypto", async () => {
  await initCrypto();
  // After init, hash functions work
  const result = poseidon2Hash2(1n, 2n);
  expect(result).toBeTypeOf("bigint");
});
```

### Crypto Test Vectors

Deterministic test vectors are generated via `scripts/generate_test_vectors.ts`.
All ZK circuit tests use these same vectors to ensure consistency across:
- Noir circuit (nargo test)
- TypeScript SDK (Vitest)
- Solidity contracts (Foundry)

---

## Rust Tests

### Unit Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sync_function() {
        let result = calculate(42);
        assert_eq!(result, 84);
    }

    #[tokio::test]
    async fn test_async_function() {
        let service = create_test_service();
        let result = service.process().await;
        assert!(result.is_ok());
    }
}
```

### Test Organization

- **Unit tests**: `#[cfg(test)]` module at bottom of source file
- **Integration tests**: `tests/` directory
- **Test helpers**: `tests/common/mod.rs`

### Running Tests

```bash
cargo nextest run                    # All tests
cargo nextest run test_merkle        # Pattern matching
cargo nextest run -p sequencer       # Specific package
```

---

## Foundry Tests (Solidity)

```bash
forge test -vv                                    # All tests
forge test -vv --match-test testDeposit          # Specific test
forge test -vv --match-contract PrivacyPoolV2    # Specific contract
```

---

## Circuit Tests (Noir)

```bash
cd circuits && nargo test            # All 22 tests
cd circuits && nargo test test_npk   # Specific test
```

---

## When Tests Fail

❌ **WRONG**: "I've updated the tests."

✅ **RIGHT**: "Tests are failing because [reason]. Should I update them or revert?"

---

**Related**: [Coding Style](coding-style.md) | [Git Workflow](git-workflow.md)
