import type { LatentClientConfig } from "@latent/sdk";

export const latentConfig: LatentClientConfig = {
  sequencerUrl:
    process.env.NEXT_PUBLIC_SEQUENCER_URL ?? "http://localhost:3001",
  poolAddress:
    process.env.NEXT_PUBLIC_POOL_ADDRESS ??
    "0x0000000000000000000000000000000000000000",
  tokenAddress:
    process.env.NEXT_PUBLIC_TOKEN_ADDRESS ??
    "0x9364ea6790f6e0ecfaa5164085f2a7de34ec55fb",
  circuitUrl: process.env.NEXT_PUBLIC_CIRCUIT_URL ?? "/circuit/latent_circuit.json",
  operatorEncPubKey: process.env.NEXT_PUBLIC_OPERATOR_ENC_PUB_KEY,
};
