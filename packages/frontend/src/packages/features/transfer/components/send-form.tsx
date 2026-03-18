"use client";

import { useState } from "react";
import { Loader2, AlertTriangle, Check } from "lucide-react";
import { parseUnits } from "ethers";
import { useTranslations } from "next-intl";

import { CROSSD_TOKEN, type TokenConfig } from "~shared/config/tokens";

const SEND_STEPS = ["prepare", "encrypt", "approve", "submit", "confirm"] as const;

interface SendFormProps {
  isSending: boolean;
  sendStep?: string | null;
  onSend: (address: string, amount: string, token: TokenConfig) => void;
  initialAddress?: string;
  balance?: string | null;
  rawBalance?: bigint | null;
}

export function SendForm({ isSending, sendStep, onSend, initialAddress = "", balance, rawBalance }: SendFormProps) {
  const t = useTranslations("send");
  const [sendAddress, setSendAddress] = useState(initialAddress);
  const [sendAmount, setSendAmount] = useState("");
  const selectedToken = CROSSD_TOKEN;

  const isInsufficientBalance = (() => {
    if (rawBalance == null || !sendAmount) return false;
    try {
      const amountWei = parseUnits(sendAmount, selectedToken.decimals);
      return amountWei > rawBalance;
    } catch {
      return false;
    }
  })();

  const handleSubmit = () => {
    if (isInsufficientBalance) return;
    onSend(sendAddress, sendAmount, selectedToken);
    if (!isSending) {
      setSendAddress("");
      setSendAmount("");
    }
  };

  return (
    <div className="card-surface p-6">
      <div className="space-y-4">
        <h3 className="text-xl mb-4 flex items-center gap-2">
          <div className="accent-dot" />
          {t("title")}
        </h3>
        <p className="text-sm text-gray-600 dark:text-white/60">
          {t("description")}
        </p>

        <div>
          <label className="block text-sm mb-2 text-gray-700 dark:text-white/70">
            {t("recipientLabel")}
          </label>
          <input
            type="text"
            value={sendAddress}
            onChange={(e) => setSendAddress(e.target.value)}
            placeholder={t("placeholder")}
            className="w-full px-4 py-3 border outline-none transition-colors font-mono text-xs bg-white border-gray-300 focus:border-gray-500 dark:bg-black/50 dark:border-gray-700 dark:focus:border-gray-600"
          />
        </div>

        <div>
          {balance != null && (
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-gray-700 dark:text-white/70">{t("amountLabel")}</label>
              <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-white/50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedToken.iconUrl}
                  alt={selectedToken.symbol}
                  className="w-3.5 h-3.5"
                />
                <span>
                  {balance} {selectedToken.symbol}
                </span>
              </div>
            </div>
          )}
          <div className="flex items-stretch">
            <div className="flex items-center gap-2 px-4 py-3 border border-r-0 bg-gray-50 border-gray-300 dark:bg-gray-800/70 dark:border-gray-700">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedToken.iconUrl}
                alt={selectedToken.symbol}
                className="w-5 h-5"
              />
              <span className="text-sm font-medium">{selectedToken.symbol}</span>
            </div>
            <input
              type="text"
              value={sendAmount}
              onChange={(e) => setSendAmount(e.target.value)}
              placeholder="0.0"
              className="flex-1 min-w-0 px-4 py-3 border outline-none transition-colors bg-white border-gray-300 focus:border-gray-500 dark:bg-black/50 dark:border-gray-700 dark:focus:border-gray-600"
            />
          </div>
        </div>

        {isInsufficientBalance && (
          <div className="flex items-center gap-2 px-3 py-2 border border-red-300 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500 dark:text-red-400 shrink-0" />
            <span className="text-xs text-red-600 dark:text-red-400">
              {t("insufficientBalance", { symbol: selectedToken.symbol })}
            </span>
          </div>
        )}

        {isSending && sendStep && (
          <div className="space-y-2 p-4 border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
            {SEND_STEPS.map((step) => {
              const currentIdx = SEND_STEPS.indexOf(sendStep as typeof SEND_STEPS[number]);
              const stepIdx = SEND_STEPS.indexOf(step);
              const isComplete = stepIdx < currentIdx;
              const isCurrent = step === sendStep;

              return (
                <div key={step} className="flex items-center gap-3">
                  {isComplete ? (
                    <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  ) : isCurrent ? (
                    <Loader2 className="w-5 h-5 animate-spin text-amber-600 dark:text-amber-400" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                  )}
                  <span className={`text-sm ${
                    isCurrent
                      ? "text-gray-900 dark:text-white font-medium"
                      : isComplete
                        ? "text-gray-500 dark:text-gray-500"
                        : "text-gray-400 dark:text-gray-600"
                  }`}>
                    {t(`step${step.charAt(0).toUpperCase() + step.slice(1)}`)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={isSending || !sendAddress || !sendAmount || isInsufficientBalance}
          className="w-full px-6 py-4 btn-primary font-medium flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isSending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t("processing")}
            </>
          ) : (
            t("sendButton")
          )}
        </button>
      </div>
    </div>
  );
}
