"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Loader2, Copy, Check, QrCode, AlertCircle, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useTranslations } from "next-intl";
import { useCopyClipboard } from "~shared/hooks/use-copy-clipboard";

interface PaymentLinkCardProps {
  paymentLink: string;
  isGenerating: boolean;
  onGenerate: () => void;
}

export function PaymentLinkCard({
  paymentLink,
  isGenerating,
  onGenerate,
}: PaymentLinkCardProps) {
  const t = useTranslations("receive");
  const { copied, copy } = useCopyClipboard();
  const [showQR, setShowQR] = useState(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowQR(false);
    },
    [],
  );

  useEffect(() => {
    if (showQR) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [showQR, handleKeyDown]);

  return (
    <div className="card-surface p-6">
      <h3 className="text-xl mb-4 flex items-center gap-2">
        <div className="accent-dot" />
        {paymentLink ? t("titleWithLink") : t("titleWithoutLink")}
      </h3>
      <p className="text-sm mb-6 text-gray-600 dark:text-white/60">
        {paymentLink ? t("descWithLink") : t("descWithoutLink")}
      </p>

      {!paymentLink ? (
        <button
          onClick={onGenerate}
          disabled={isGenerating}
          className="w-full px-6 py-3 btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t("generatingKeys")}
            </>
          ) : (
            t("generateButton")
          )}
        </button>
      ) : (
        <div className="space-y-4">
          <div className="p-4 border font-mono text-xs break-all bg-gray-50 border-gray-300 dark:bg-black/50 dark:border-gray-700">
            {paymentLink}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => copy(paymentLink)}
              className="px-4 py-2 border transition-all duration-300 flex items-center justify-center gap-2 border-gray-300 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span className="hidden sm:inline">{t("copied")}</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span className="hidden sm:inline">{t("copy")}</span>
                </>
              )}
            </button>

            <button
              onClick={() => setShowQR(true)}
              className="px-4 py-2 border transition-all duration-300 flex items-center justify-center gap-2 border-gray-300 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              <QrCode className="w-4 h-4" />
              <span className="hidden sm:inline">{t("qrCode")}</span>
            </button>

            <button
              onClick={() => {
                const message = t("shareMessage");
                window.open(
                  `https://t.me/share/url?url=${encodeURIComponent(paymentLink)}&text=${encodeURIComponent(message)}`,
                  "_blank",
                );
              }}
              className="px-4 py-2 border transition-all duration-300 flex items-center justify-center gap-2 border-gray-300 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
              </svg>
              <span className="hidden sm:inline">{t("share")}</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-white/50">
            <AlertCircle className="w-4 h-4" />
            {t("reusableInfo")}
          </div>

          {showQR && createPortal(
            <div
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40"
              onClick={() => setShowQR(false)}
            >
              <div
                className="relative card-surface p-6 max-w-sm w-full mx-4"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setShowQR(false)}
                  className="absolute top-3 right-3 p-1 text-gray-500 hover:text-gray-800 dark:text-white/50 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
                <h4 className="text-lg font-medium mb-4 text-center">
                  {t("qrTitle")}
                </h4>
                <div className="flex justify-center p-4 bg-white rounded-lg">
                  <QRCodeSVG
                    value={paymentLink}
                    size={240}
                    level="M"
                  />
                </div>
                <p className="text-xs text-center mt-4 text-gray-500 dark:text-white/50">
                  {t("qrScanText")}
                </p>
              </div>
            </div>,
            document.body,
          )}
        </div>
      )}
    </div>
  );
}
