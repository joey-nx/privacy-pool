"use client";

import { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Check, X, Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import type { WithdrawalProgress, ProofStep } from "~shared/types/withdrawal";
import { SUPPORTED_TOKENS } from "~shared/config/tokens";
import { SUPPORTED_CHAIN } from "~shared/config/chains";

interface WithdrawalProgressModalProps {
  progress: WithdrawalProgress;
  onClose: () => void;
}

export function WithdrawalProgressModal({
  progress,
  onClose,
}: WithdrawalProgressModalProps) {
  const t = useTranslations("withdrawal");

  const ALL_STEPS: { step: ProofStep; label: string }[] = [
    { step: "merkle", label: t("stepMerkle") },
    { step: "compute", label: t("stepCompute") },
    { step: "witness", label: t("stepWitness") },
    { step: "prove", label: t("stepProve") },
    { step: "submit", label: t("stepSubmit") },
  ];

  const {
    isWithdrawing,
    currentNoteIndex,
    totalNotes,
    currentStep,
    completedTxHashes,
    error,
  } = progress;

  const isVisible =
    isWithdrawing || completedTxHashes.length > 0 || error !== null;
  const isSuccess = !isWithdrawing && !error && completedTxHashes.length > 0;
  const activeStepIdx = currentStep ? ALL_STEPS.findIndex((s) => s.step === currentStep.step) : -1;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isWithdrawing) onClose();
    },
    [isWithdrawing, onClose],
  );

  useEffect(() => {
    if (isVisible) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isVisible, handleKeyDown]);

  if (!isVisible) return null;

  const explorerTxUrl = (hash: string) =>
    `${SUPPORTED_CHAIN.blockExplorerUrl}/tx/${hash}`;

  return createPortal(
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40"
          onClick={isWithdrawing ? undefined : onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="relative card-surface p-6 max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {!isWithdrawing && (
              <button
                onClick={onClose}
                className="absolute top-3 right-3 p-1 text-gray-500 hover:text-gray-800 dark:text-white/50 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            )}

            <h4 className="text-lg font-medium mb-1 text-center">
              {error
                ? t("failed")
                : isSuccess
                  ? t("complete")
                  : t("withdrawing")}
            </h4>

            {totalNotes > 1 && (
              <p className="text-sm text-center text-gray-500 dark:text-white/50 mb-4">
                {t("noteCounter", { index: Math.min(currentNoteIndex + 1, totalNotes), total: totalNotes })}
              </p>
            )}
            {totalNotes <= 1 && <div className="mb-4" />}

            <div className="space-y-3 mb-6">
              {ALL_STEPS.map((s, idx) => {
                const isDone =
                  isSuccess ||
                  (!error && activeStepIdx > idx) ||
                  (error && activeStepIdx > idx);
                const isActive = isWithdrawing && activeStepIdx === idx;

                return (
                  <div key={s.step} className="flex items-center gap-3">
                    <div className="shrink-0">
                      {isDone ? (
                        <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 text-green-500" />
                        </div>
                      ) : isActive ? (
                        <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
                          <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500" />
                        </div>
                      )}
                    </div>

                    <span
                      className={`text-sm ${
                        isDone
                          ? "text-green-600 dark:text-green-400"
                          : isActive
                            ? "text-amber-600 dark:text-amber-400 font-medium"
                            : "text-gray-400 dark:text-gray-500"
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {error && (
              <div className="mb-4 p-3 border border-red-300 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              </div>
            )}

            {isSuccess && (
              <div className="mb-4 space-y-2">
                {completedTxHashes.map((hash, i) => (
                  <a
                    key={hash}
                    href={explorerTxUrl(hash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2 text-xs font-mono border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors truncate"
                  >
                    <ExternalLink className="w-3.5 h-3.5 shrink-0 text-gray-500" />
                    <span className="truncate">
                      {totalNotes > 1 ? `#${i + 1} ` : ""}
                      {hash}
                    </span>
                  </a>
                ))}
                <p className="text-xs text-center text-gray-500 dark:text-white/50">
                  {t("successMessage", { count: completedTxHashes.length, symbol: SUPPORTED_TOKENS[0].symbol })}
                </p>
              </div>
            )}

            {!isWithdrawing && (
              <button
                onClick={onClose}
                className="w-full px-6 py-3 btn-primary"
              >
                {error ? t("close") : t("done")}
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
