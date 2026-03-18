/**
 * ZK proof generation using @aztec/bb.js UltraHonkBackend.
 *
 * Generates EVM-compatible Honk proofs from compressed witnesses.
 * Runs entirely client-side via WASM.
 */

import { Barretenberg, UltraHonkBackend } from "@aztec/bb.js";
import type { ProofResult } from "../core/types.js";

let api: Barretenberg | null = null;
let backend: UltraHonkBackend | null = null;

export interface ProverConfig {
  /** Number of WASM threads. Default: 1 (safe for mobile). */
  threads?: number;
}

/**
 * Initialize the prover with a compiled circuit.
 *
 * This loads the WASM module and SRS (Structured Reference String).
 * Call once at app startup or before first proof.
 *
 * @param circuitBytecode - The circuit's base64/hex bytecode string (from compiled JSON's `bytecode` field)
 */
export async function initProver(
  circuitBytecode: string,
  config?: ProverConfig,
): Promise<void> {
  const threads =
    config?.threads ??
    (typeof navigator !== "undefined" ? navigator.hardwareConcurrency ?? 4 : 4);

  api = await Barretenberg.new({ threads });
  backend = new UltraHonkBackend(circuitBytecode, api);
}

/**
 * Generate a ZK proof from a compressed witness.
 *
 * Uses UltraHonk with EVM verifier target (keccak-based Fiat-Shamir).
 * Expected time: ~5-15s desktop, ~30-120s mobile.
 */
export async function generateProof(
  witness: Uint8Array,
): Promise<ProofResult> {
  if (!backend) {
    throw new Error("Prover not initialized. Call initProver() first.");
  }

  const { proof, publicInputs } = await backend.generateProof(witness, {
    verifierTarget: "evm",
  });

  return { proof, publicInputs };
}

/**
 * Dispose WASM resources. Call when done proving to free memory.
 */
export async function disposeProver(): Promise<void> {
  backend = null;
  if (api) {
    await api.destroy();
    api = null;
  }
}
