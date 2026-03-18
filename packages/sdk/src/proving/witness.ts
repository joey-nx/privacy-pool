/**
 * Witness generation using @noir-lang/noir_js.
 *
 * Takes circuit inputs and produces a compressed witness
 * suitable for proof generation with bb.js.
 */

import { Noir } from "@noir-lang/noir_js";
import type { CompiledCircuit } from "@noir-lang/types";
import type { WithdrawalInputs } from "../core/types.js";

let noirInstance: Noir | null = null;
let cachedBytecode: string | null = null;

/**
 * Initialize the witness generator with a compiled circuit.
 *
 * @param circuit - The compiled circuit JSON (from nargo compile output).
 *                  Must contain `bytecode`, `abi`, `debug_symbols`, and `file_map` fields.
 */
export async function initWitness(circuit: CompiledCircuit): Promise<void> {
  cachedBytecode = circuit.bytecode;
  noirInstance = new Noir(circuit);
}

/**
 * Generate a witness for a withdrawal proof.
 *
 * Maps the typed WithdrawalInputs to the circuit's expected input format
 * (all values as decimal strings keyed by circuit parameter names).
 */
export async function generateWitness(
  inputs: WithdrawalInputs,
): Promise<Uint8Array> {
  if (!noirInstance) {
    throw new Error("Witness generator not initialized. Call initWitness() first.");
  }

  // Map SDK types to circuit input names (see circuits/src/main.nr)
  const circuitInputs: Record<string, string | string[]> = {
    // Private inputs
    secret: inputs.secret.toString(),
    nullifier_secret_key: inputs.nullifierSecretKey.toString(),
    nullifier_pub_key: inputs.nullifierPubKey.toString(),
    merkle_siblings: inputs.merkleSiblings.map((s) => s.toString()),
    path_indices: inputs.pathIndices.map((i) => i.toString()),
    note_amount: inputs.noteAmount.toString(),
    note_block_number: inputs.noteBlockNumber.toString(),
    note_depositor: inputs.noteDepositor.toString(),
    transfer_amount: inputs.transferAmount.toString(),
    registration_siblings: inputs.registrationSiblings.map((s) => s.toString()),
    registration_path_indices: inputs.registrationPathIndices.map((i) => i.toString()),
    // Public inputs
    expected_root: inputs.expectedRoot.toString(),
    nullifier: inputs.nullifier.toString(),
    amount: inputs.amount.toString(),
    recipient: inputs.recipient.toString(),
    compliance_hash: inputs.complianceHash.toString(),
    expected_registration_root: inputs.expectedRegistrationRoot.toString(),
  };

  const { witness } = await noirInstance.execute(circuitInputs);
  return witness;
}

/**
 * Get the cached circuit bytecode (for prover initialization).
 */
export function getCircuitBytecode(): string | null {
  return cachedBytecode;
}
