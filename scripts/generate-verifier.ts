/**
 * Generate UltraVerifier.sol from the compiled circuit using @aztec/bb.js.
 *
 * Ensures the on-chain verifier matches the SDK's proving configuration
 * (UltraHonk with EVM verifier target).
 *
 * Usage: tsx scripts/generate-verifier.ts
 */

import { Barretenberg, UltraHonkBackend } from "@aztec/bb.js";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");

const CIRCUIT_PATH = resolve(
  PROJECT_ROOT,
  "packages/frontend/public/circuit/latent_circuit.json",
);
const OUTPUT_PATH = resolve(PROJECT_ROOT, "contracts/src/UltraVerifier.sol");

async function main() {
  console.log("Loading circuit from", CIRCUIT_PATH);
  const circuit = JSON.parse(readFileSync(CIRCUIT_PATH, "utf-8"));

  console.log("Initializing Barretenberg...");
  const api = await Barretenberg.new({ threads: 1 });
  const backend = new UltraHonkBackend(circuit.bytecode, api);

  console.log("Generating verification key (EVM target)...");
  const vk = await backend.getVerificationKey({ verifierTarget: "evm" });

  console.log("Generating Solidity verifier...");
  const solidity = await backend.getSolidityVerifier(vk, {
    verifierTarget: "evm",
  });

  writeFileSync(OUTPUT_PATH, solidity);
  console.log("Written to", OUTPUT_PATH);

  await api.destroy();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
