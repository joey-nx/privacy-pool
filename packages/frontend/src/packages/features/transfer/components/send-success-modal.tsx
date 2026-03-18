"use client";

import { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Check, X, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { SUPPORTED_CHAIN } from "~shared/config/chains";

interface SendSuccessModalProps {
  txHash: string | null;
  onClose: () => void;
}

export function SendSuccessModal({ txHash, onClose }: SendSuccessModalProps) {
  const t = useTranslations("sendSuccess");

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (txHash) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [txHash, handleKeyDown]);

  if (!txHash) return null;

  const explorerUrl = `${SUPPORTED_CHAIN.blockExplorerUrl}/tx/${txHash}`;

  return createPortal(
    <AnimatePresence>
      {txHash && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="relative card-surface p-6 max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-1 text-gray-500 hover:text-gray-800 dark:text-white/50 dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-4">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="w-6 h-6 text-green-500" />
              </div>
              <h4 className="text-lg font-medium">{t("title")}</h4>
            </div>

            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-3 text-xs font-mono border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors mb-4"
            >
              <ExternalLink className="w-3.5 h-3.5 shrink-0 text-gray-500" />
              <span className="truncate">{txHash}</span>
            </a>

            <button onClick={onClose} className="w-full px-6 py-3 btn-primary">
              {t("done")}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
