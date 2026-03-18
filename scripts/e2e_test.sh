#!/usr/bin/env bash
# =============================================================================
# CPS Circuit E2E Test
#
# Runs the full proof lifecycle for all test scenarios:
#   1. Generate test vectors (9 scenarios)
#   2. Compile circuit (once)
#   3. For each scenario:
#      - Happy path: execute -> prove (with --write_vk) -> verify
#      - Negative: execute should fail with expected constraint
#   4. (Optional) On-chain verification via Foundry
#
# Usage: bash scripts/e2e_test.sh [--no-onchain]
# =============================================================================

set -euo pipefail

# Add common tool paths (nargo, bb, foundry)
export PATH="$HOME/.nargo/bin:$HOME/.bb:$HOME/.foundry/bin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CIRCUIT_DIR="$PROJECT_ROOT/circuits"
VECTORS_DIR="$CIRCUIT_DIR/test_vectors"
CONTRACTS_DIR="$PROJECT_ROOT/contracts"
PROVER_TOML="$CIRCUIT_DIR/Prover.toml"
PROVER_TOML_BACKUP=""

# bb output paths
BB_VK_DIR="$CIRCUIT_DIR/out"
BB_PROOF_DIR="$CIRCUIT_DIR/target/proof"

NO_ONCHAIN=false
if [[ "${1:-}" == "--no-onchain" ]]; then
  NO_ONCHAIN=true
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Counters
PASS=0
FAIL=0
TOTAL=0

# =============================================================================
# Helpers
# =============================================================================

now_ms() {
  perl -MTime::HiRes -e 'print int(Time::HiRes::time()*1000)'
}

elapsed() {
  local start=$1
  local end
  end=$(now_ms)
  echo $(( end - start ))
}

log_info()  { echo -e "${CYAN}[INFO]${NC} $*"; }
log_pass()  { echo -e "${GREEN}[PASS]${NC} $*"; }
log_fail()  { echo -e "${RED}[FAIL]${NC} $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_step()  { echo -e "${BOLD}${CYAN}==>${NC} $*"; }

# Backup and restore Prover.toml
backup_prover_toml() {
  if [[ -f "$PROVER_TOML" ]]; then
    PROVER_TOML_BACKUP=$(mktemp)
    cp "$PROVER_TOML" "$PROVER_TOML_BACKUP"
  fi
}

restore_prover_toml() {
  if [[ -n "$PROVER_TOML_BACKUP" && -f "$PROVER_TOML_BACKUP" ]]; then
    cp "$PROVER_TOML_BACKUP" "$PROVER_TOML"
    rm -f "$PROVER_TOML_BACKUP"
  fi
}

cleanup() {
  restore_prover_toml
}

trap cleanup EXIT

# =============================================================================
# Prerequisites
# =============================================================================

check_prerequisites() {
  log_step "Checking prerequisites..."
  local missing=0

  for cmd in nargo bb npx; do
    if ! command -v "$cmd" &>/dev/null; then
      log_fail "Missing required tool: $cmd"
      missing=1
    fi
  done

  if [[ "$NO_ONCHAIN" == false ]]; then
    if ! command -v forge &>/dev/null; then
      log_warn "forge not found. On-chain tests will be skipped."
      NO_ONCHAIN=true
    fi
  fi

  if [[ $missing -ne 0 ]]; then
    echo "Install missing tools and re-run."
    exit 1
  fi

  log_info "nargo: $(nargo --version 2>&1 | head -1)"
  log_info "bb:    $(bb --version 2>&1 | head -1)"
  echo ""
}

# =============================================================================
# Phase 1: Generate Test Vectors
# =============================================================================

generate_vectors() {
  log_step "Generating test vectors..."
  local t
  t=$(now_ms)
  npx tsx "$SCRIPT_DIR/generate_test_vectors.ts" --e2e
  log_info "Vectors generated in $(elapsed "$t")ms"
  echo ""
}

# =============================================================================
# Phase 2: Compile Circuit
# =============================================================================

compile_circuit() {
  log_step "Compiling circuit..."
  local t
  t=$(now_ms)
  (cd "$CIRCUIT_DIR" && nargo compile)
  log_info "Compiled in $(elapsed "$t")ms"
  echo ""
}

# =============================================================================
# Phase 3: Run Scenarios
# =============================================================================

run_scenarios() {
  log_step "Running scenarios..."
  echo ""

  backup_prover_toml

  local names
  names=$(npx tsx "$SCRIPT_DIR/parse_manifest.ts" names)

  while IFS= read -r name; do
    TOTAL=$((TOTAL + 1))
    local expected
    expected=$(npx tsx "$SCRIPT_DIR/parse_manifest.ts" result "$name")

    echo -e "${BOLD}--- [$TOTAL] $name (expected: $expected) ---${NC}"

    # Copy scenario's Prover.toml into circuit dir
    cp "$VECTORS_DIR/$name/Prover.toml" "$PROVER_TOML"

    if [[ "$expected" == "pass" ]]; then
      run_happy_path "$name"
    else
      run_negative "$name"
    fi

    echo ""
  done <<< "$names"
}

run_happy_path() {
  local name=$1
  local t_total t_exec t_prove t_verify
  t_total=$(now_ms)

  # Execute
  t_exec=$(now_ms)
  if ! (cd "$CIRCUIT_DIR" && nargo execute) 2>&1; then
    log_fail "$name: execute failed (expected success)"
    FAIL=$((FAIL + 1))
    return
  fi
  log_info "  execute: $(elapsed "$t_exec")ms"

  # Prove (with --write_vk to ensure VK-proof consistency)
  rm -rf "$BB_PROOF_DIR"
  t_prove=$(now_ms)
  if ! (cd "$CIRCUIT_DIR" && bb prove -b ./target/cps_circuit.json -w ./target/cps_circuit.gz -o ./target/proof -t evm --write_vk) 2>&1; then
    log_fail "$name: prove failed"
    FAIL=$((FAIL + 1))
    return
  fi
  log_info "  prove:   $(elapsed "$t_prove")ms"

  # Copy VK from prove output to standard location for on-chain verification
  mkdir -p "$BB_VK_DIR"
  cp "$BB_PROOF_DIR/vk" "$BB_VK_DIR/vk"

  # Verify
  t_verify=$(now_ms)
  if ! (cd "$CIRCUIT_DIR" && bb verify -k ./target/proof/vk -p ./target/proof/proof -i ./target/proof/public_inputs -t evm) 2>&1; then
    log_fail "$name: verify failed"
    FAIL=$((FAIL + 1))
    return
  fi
  log_info "  verify:  $(elapsed "$t_verify")ms"

  log_pass "$name (total: $(elapsed "$t_total")ms)"
  PASS=$((PASS + 1))
}

run_negative() {
  local name=$1
  local constraint
  constraint=$(npx tsx "$SCRIPT_DIR/parse_manifest.ts" constraint "$name")

  local t
  t=$(now_ms)

  # Execute should fail
  local output
  if output=$(cd "$CIRCUIT_DIR" && nargo execute 2>&1); then
    log_fail "$name: execute succeeded (expected failure)"
    FAIL=$((FAIL + 1))
    return
  fi

  # Check that the expected constraint message appears in output
  if echo "$output" | grep -q "$constraint"; then
    log_pass "$name: correctly failed with '$constraint' ($(elapsed "$t")ms)"
    PASS=$((PASS + 1))
  else
    log_fail "$name: failed but with unexpected message"
    echo "  Expected: $constraint"
    echo "  Got: $output"
    FAIL=$((FAIL + 1))
  fi
}

# =============================================================================
# Phase 4: On-chain Verification (Foundry)
# =============================================================================

run_onchain_verification() {
  if [[ "$NO_ONCHAIN" == true ]]; then
    log_warn "Skipping on-chain verification (--no-onchain or forge not found)"
    return
  fi

  log_step "On-chain verification..."
  echo ""

  # Generate Solidity verifier from VK
  local t
  t=$(now_ms)
  log_info "Generating Solidity verifier..."
  (cd "$CIRCUIT_DIR" && bb write_solidity_verifier -k ./out/vk -o "$CONTRACTS_DIR/src/UltraVerifier.sol")
  log_info "Solidity verifier generated in $(elapsed "$t")ms"

  # Verify proof file exists
  if [[ ! -f "$BB_PROOF_DIR/proof" ]]; then
    log_fail "No proof file found. Run happy path first."
    return
  fi

  # Run Foundry tests (reads proof/public_inputs directly from circuits/target/proof/)
  t=$(now_ms)
  log_info "Running forge test..."
  if (cd "$CONTRACTS_DIR" && forge test -vv); then
    log_pass "On-chain verification passed ($(elapsed "$t")ms)"
  else
    log_fail "On-chain verification failed"
  fi

  echo ""
}

# =============================================================================
# Summary
# =============================================================================

print_summary() {
  echo ""
  echo -e "${BOLD}============================================${NC}"
  echo -e "${BOLD}  E2E Test Summary${NC}"
  echo -e "${BOLD}============================================${NC}"
  echo -e "  Total:  $TOTAL"
  echo -e "  ${GREEN}Passed: $PASS${NC}"
  if [[ $FAIL -gt 0 ]]; then
    echo -e "  ${RED}Failed: $FAIL${NC}"
  else
    echo -e "  Failed: $FAIL"
  fi
  echo -e "${BOLD}============================================${NC}"

  if [[ $FAIL -gt 0 ]]; then
    exit 1
  fi
}

# =============================================================================
# Main
# =============================================================================

main() {
  echo ""
  echo -e "${BOLD}CPS Circuit E2E Test${NC}"
  echo -e "${BOLD}====================${NC}"
  echo ""

  local t_global
  t_global=$(now_ms)

  check_prerequisites
  generate_vectors
  compile_circuit
  run_scenarios
  run_onchain_verification
  print_summary

  echo ""
  log_info "Total time: $(elapsed "$t_global")ms"
}

main
