"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { OwnedNote } from "@latent/sdk";
import type { WithdrawalProgress } from "~shared/types/withdrawal";
import { useLatent } from "~providers/latent-provider";

const INITIAL_PROGRESS: WithdrawalProgress = {
  isWithdrawing: false,
  currentNoteIndex: 0,
  totalNotes: 0,
  currentStep: null,
  completedTxHashes: [],
  withdrawnLeafIndices: [],
  withdrawnAmounts: [],
  error: null,
};

export function useWithdrawal() {
  const { client } = useLatent();
  const [progress, setProgress] = useState<WithdrawalProgress>(INITIAL_PROGRESS);
  const abortRef = useRef(false);

  // beforeunload guard while withdrawing
  useEffect(() => {
    if (!progress.isWithdrawing) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [progress.isWithdrawing]);

  const startWithdrawal = useCallback(
    async (notes: OwnedNote[], recipientAddress: string) => {
      if (notes.length === 0) return;
      abortRef.current = false;

      setProgress({
        isWithdrawing: true,
        currentNoteIndex: 0,
        totalNotes: notes.length,
        currentStep: null,
        completedTxHashes: [],
        withdrawnLeafIndices: [],
        withdrawnAmounts: [],
        error: null,
      });

      const txHashes: string[] = [];
      const leafIndices: number[] = [];
      const amounts: bigint[] = [];

      for (let i = 0; i < notes.length; i++) {
        if (abortRef.current) break;

        setProgress((prev) => ({
          ...prev,
          currentNoteIndex: i,
          currentStep: null,
        }));

        try {
          const result = await client.withdraw({
            note: notes[i],
            amount: notes[i].amount,
            recipientAddress,
            onProgress: (stage) => {
              setProgress((prev) => ({ ...prev, currentStep: stage }));
            },
          });

          txHashes.push(result.txHash);
          leafIndices.push(notes[i].leafIndex);
          amounts.push(notes[i].amount);
          setProgress((prev) => ({
            ...prev,
            completedTxHashes: [...txHashes],
            withdrawnLeafIndices: [...leafIndices],
            withdrawnAmounts: [...amounts],
          }));
        } catch (err) {
          setProgress((prev) => ({
            ...prev,
            isWithdrawing: false,
            error:
              err instanceof Error
                ? err.message
                : "Withdrawal failed. Please try again.",
          }));
          return;
        }
      }

      setProgress((prev) => ({
        ...prev,
        isWithdrawing: false,
        currentStep: null,
      }));
    },
    [client],
  );

  const reset = useCallback(() => {
    abortRef.current = true;
    setProgress(INITIAL_PROGRESS);
  }, []);

  return { progress, startWithdrawal, reset };
}
