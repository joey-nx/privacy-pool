"use client";

import { Loader2, CheckCircle } from "lucide-react";
import type { OwnedNote } from "@latent/sdk";
import { useTranslations, useLocale } from "next-intl";
import { formatTokenAmount, fieldToAddress } from "~shared/utils/format";
import { SUPPORTED_TOKENS } from "~shared/config/tokens";

interface ReceivedFundsCardProps {
  notes: OwnedNote[];
  isScanning: boolean;
  onScan: () => void;
  formatAddress: (addr: string) => string;
  onWithdrawNote: (note: OwnedNote) => void;
  isWithdrawing: boolean;
  withdrawnLeafIndices: Set<number>;
}

export function ReceivedFundsCard({
  notes,
  isScanning,
  onScan,
  formatAddress,
  onWithdrawNote,
  isWithdrawing,
  withdrawnLeafIndices,
}: ReceivedFundsCardProps) {
  const t = useTranslations("receivedFunds");
  const locale = useLocale();
  const symbol = SUPPORTED_TOKENS[0].symbol;
  const decimals = SUPPORTED_TOKENS[0].decimals;

  function formatNoteTime(timestamp?: number): string {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60_000);

    if (diffMin < 1) return t("justNow");
    if (diffMin < 60) return t("minutesAgo", { count: diffMin });

    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return t("hoursAgo", { count: diffHours });

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return t("daysAgo", { count: diffDays });

    return date.toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="card-surface p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl flex items-center gap-2">
          <div className="accent-dot animate-pulse" />
          {t("title")}
        </h3>
        <button
          onClick={onScan}
          disabled={isScanning || isWithdrawing}
          className="px-4 py-2 text-sm border transition-all duration-300 flex items-center gap-2 disabled:opacity-50 border-gray-400 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
        >
          {isScanning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t("scanning")}
            </>
          ) : (
            t("scanButton")
          )}
        </button>
      </div>

      {notes.length === 0 ? (
        <p className="text-sm text-center py-8 text-gray-600 dark:text-white/60">
          {t("emptyState")}
        </p>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => {
            const isWithdrawn = withdrawnLeafIndices.has(note.leafIndex);

            return (
              <div
                key={note.leafIndex}
                className={`flex items-center justify-between p-4 border ${
                  isWithdrawn
                    ? "bg-green-50/50 border-green-200 dark:bg-green-900/10 dark:border-green-800/50"
                    : "bg-gray-50 border-gray-200 dark:bg-black/50 dark:border-gray-800"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {formatTokenAmount(note.amount, decimals)} {symbol}
                    </span>
                    {isWithdrawn && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        <CheckCircle className="w-3 h-3" />
                        {t("withdrawn")}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-white/50">
                    <span>Block #{note.blockNumber.toString()}</span>
                    {note.timestamp && (
                      <>
                        <span className="text-gray-300 dark:text-white/20">|</span>
                        <span>{formatNoteTime(note.timestamp)}</span>
                      </>
                    )}
                  </div>
                  <div className="text-xs font-mono text-gray-400 dark:text-white/40 truncate">
                    From: {formatAddress(fieldToAddress(note.depositor))}
                  </div>
                </div>
                {isWithdrawn ? (
                  <div className="shrink-0 ml-3 px-4 py-2 text-sm text-green-600 dark:text-green-400 font-medium">
                    {t("completed")}
                  </div>
                ) : (
                  <button
                    onClick={() => onWithdrawNote(note)}
                    disabled={isWithdrawing}
                    className="px-4 py-2 btn-primary text-sm disabled:opacity-50 shrink-0 ml-3"
                  >
                    {t("withdraw")}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
