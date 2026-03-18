"use client";

import { motion } from "motion/react";
import { Send, Download, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { SUPPORTED_CHAIN } from "~shared/config/chains";

interface Transaction {
  type: "send" | "withdraw";
  amount: string;
  txHash: string;
  blockNumber?: string;
  timestamp: number;
  status: "completed" | "pending";
}

interface TransactionListProps {
  transactions: Transaction[];
  formatAddress: (addr: string) => string;
  isLoading?: boolean;
}

export function TransactionList({
  transactions,
  formatAddress,
  isLoading,
}: TransactionListProps) {
  const t = useTranslations("history");

  return (
    <div className="card-surface p-6">
      <h3 className="text-xl mb-4 flex items-center gap-2">
        <div className="accent-dot" />
        {t("title")}
      </h3>
      <p className="text-sm mb-6 text-gray-600 dark:text-white/60">
        {t("description")}
      </p>

      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 mx-auto mb-4 border-2 border-gray-300 border-t-amber-500 rounded-full animate-spin dark:border-gray-600 dark:border-t-amber-400" />
            <p className="text-sm text-gray-600 dark:text-white/60">
              {t("loading")}
            </p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12">
            <ExternalLink className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-700" />
            <p className="text-sm text-gray-600 dark:text-white/60">
              {t("emptyHeading")}
            </p>
            <p className="text-xs mt-2 text-gray-500 dark:text-white/40">
              {t("emptyText")}
            </p>
          </div>
        ) : (
          transactions.map((tx, index) => (
            <motion.div
              key={`${tx.txHash}-${index}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="p-4 border transition-all duration-300 bg-gray-50 border-gray-200 hover:border-gray-300 dark:bg-black/50 dark:border-gray-800 dark:hover:border-gray-700"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className={`p-2 rounded-full ${
                        tx.type === "send"
                          ? "bg-gray-200 dark:bg-gray-700"
                          : "bg-green-500/20"
                      }`}
                    >
                      {tx.type === "send" ? (
                        <Send className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      ) : (
                        <Download className="w-4 h-4 text-green-400" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-lg">
                        {tx.amount} ETH
                      </div>
                      <div className="text-xs text-gray-500 dark:text-white/50">
                        {tx.type === "send" ? t("sent") : t("withdrawn")} &bull;{" "}
                        {tx.timestamp > 0
                          ? `${new Date(tx.timestamp).toLocaleDateString()} ${new Date(tx.timestamp).toLocaleTimeString()}`
                          : tx.blockNumber
                            ? `Block #${tx.blockNumber}`
                            : "Unknown"}
                      </div>
                    </div>
                  </div>

                  <div className="ml-14 space-y-1">
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-white/40">
                      <span className="font-mono">
                        Tx: {formatAddress(tx.txHash)}
                      </span>
                      <button
                        onClick={() =>
                          window.open(
                            `${SUPPORTED_CHAIN.blockExplorerUrl}/tx/${tx.txHash}`,
                            "_blank",
                          )
                        }
                        className="transition-colors text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>

                    {tx.blockNumber && tx.blockNumber !== "pending" && (
                      <div className="text-xs text-gray-500 dark:text-white/40">
                        Block #{tx.blockNumber}
                      </div>
                    )}

                    <div
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs ${
                        tx.status === "completed"
                          ? "bg-green-500/20 text-green-400"
                          : "bg-yellow-500/20 text-yellow-400"
                      }`}
                    >
                      <div
                        className={`w-1 h-1 rounded-full ${
                          tx.status === "completed"
                            ? "bg-green-400"
                            : "bg-yellow-400 animate-pulse"
                        }`}
                      />
                      {tx.status === "completed" ? t("completed") : t("pending")}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
