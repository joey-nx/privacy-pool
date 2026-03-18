import type { ProofStage } from "@latent/sdk";

/** Proof step identifier — derived from SDK's ProofStage union */
export type ProofStep = ProofStage["step"];

/** Multi-note sequential withdrawal progress (frontend-only) */
export interface WithdrawalProgress {
  isWithdrawing: boolean;
  currentNoteIndex: number;
  totalNotes: number;
  currentStep: ProofStage | null;
  completedTxHashes: string[];
  withdrawnLeafIndices: number[];
  withdrawnAmounts: bigint[];
  error: string | null;
}
