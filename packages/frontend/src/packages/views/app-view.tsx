"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Wallet,
  Send,
  Download,
  ExternalLink,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link } from "~i18n/navigation";

import { LatentClient, type OwnedNote, type HistoryResponse } from "@latent/sdk";
import { parseUnits } from "ethers";

import { useLatent } from "~providers/latent-provider";
import { useWallet } from "~features/wallet/hooks/use-wallet";
import { PaymentLinkCard } from "~features/receive/components/payment-link-card";
import { ReceivedFundsCard } from "~features/withdrawal/components/received-funds-card";
import { WithdrawalProgressModal } from "~features/withdrawal/components/withdrawal-progress-modal";
import { useWithdrawal } from "~features/withdrawal/hooks/use-withdrawal";
import { SendForm } from "~features/transfer/components/send-form";
import { SendSuccessModal } from "~features/transfer/components/send-success-modal";
import { TransactionList } from "~features/history/components/transaction-list";
import { CrossChainIcon } from "~shared/components/icons/cross-chain-icon";
import { SUPPORTED_CHAIN } from "~shared/config/chains";
import { SUPPORTED_TOKENS, type TokenConfig } from "~shared/config/tokens";
import { formatTokenAmount } from "~shared/utils/format";

type Tab = "receive" | "send" | "history";

interface Transaction {
  type: "send" | "withdraw";
  amount: string;
  txHash: string;
  blockNumber?: string;
  timestamp: number;
  status: "completed" | "pending";
}

export function AppView() {
  const t = useTranslations("app");
  const searchParams = useSearchParams();
  const latent = useLatent();
  const wallet = useWallet();
  const withdrawal = useWithdrawal();

  const initialTab = searchParams.get("tab") === "send" ? "send" : "receive";
  const initialAddress = useMemo(() => {
    const npk = searchParams.get("npk");
    const enc = searchParams.get("enc");
    if (npk && enc && typeof window !== "undefined") {
      return `${window.location.origin}/pay?npk=${encodeURIComponent(npk)}&enc=${encodeURIComponent(enc)}`;
    }
    return "";
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [paymentLink, setPaymentLink] = useState("");
  const [isGeneratingKeys, setIsGeneratingKeys] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendStep, setSendStep] = useState<string | null>(null);
  const [receivedNotes, setReceivedNotes] = useState<OwnedNote[]>([]);
  const [transactionHistory, setTransactionHistory] = useState<Transaction[]>(
    [],
  );
  const [showWalletDropdown, setShowWalletDropdown] = useState(false);
  const [sendSuccessTxHash, setSendSuccessTxHash] = useState<string | null>(null);
  const [tokenBalance, setTokenBalance] = useState<string | null>(null);
  const [rawTokenBalance, setRawTokenBalance] = useState<bigint | null>(null);
  const [withdrawnLeafIndices, setWithdrawnLeafIndices] = useState<Set<number>>(new Set());
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const autoScannedRef = useRef(false);
  const prevAddressRef = useRef<string>("");
  const historyLoadedRef = useRef(false);

  const loadHistory = useCallback(async () => {
    if (!wallet.isConnected) return;
    setIsLoadingHistory(true);
    try {
      const history: HistoryResponse = await latent.client.getHistory();
      const items: Transaction[] = [
        ...history.deposits.map((d) => ({
          type: "send" as const,
          amount: d.amount
            ? formatTokenAmount(BigInt(d.amount), SUPPORTED_TOKENS[0].decimals)
            : "?",
          txHash: d.txHash,
          blockNumber: d.blockNumber?.toString(),
          timestamp: d.timestamp ?? 0,
          status: "completed" as const,
        })),
        ...history.withdrawals.map((w) => ({
          type: "withdraw" as const,
          amount: formatTokenAmount(BigInt(w.amount), SUPPORTED_TOKENS[0].decimals),
          txHash: w.txHash,
          blockNumber: w.blockNumber?.toString(),
          timestamp: w.timestamp ?? 0,
          status: (w.status === "pending" || w.status === "expired" ? "pending" : "completed") as "completed" | "pending",
        })),
      ].sort((a, b) => {
        const bnA = parseInt(a.blockNumber ?? "0");
        const bnB = parseInt(b.blockNumber ?? "0");
        return bnB - bnA;
      });
      setTransactionHistory(items);
    } catch (err) {
      console.error("[app-view] Failed to load history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [wallet.isConnected, latent.client]);

  useEffect(() => {
    if (wallet.address === prevAddressRef.current) return;
    const isSwitch = prevAddressRef.current !== "" && wallet.address !== "";
    prevAddressRef.current = wallet.address;
    if (!isSwitch) return;

    setPaymentLink("");
    setReceivedNotes([]);
    setTransactionHistory([]);
    setWithdrawnLeafIndices(new Set());
    setTokenBalance(null);
    setRawTokenBalance(null);
    setSendSuccessTxHash(null);
    setActiveTab("receive");
    autoScannedRef.current = false;
    historyLoadedRef.current = false;
  }, [wallet.address]);

  useEffect(() => {
    if (latent.hasKeys && !paymentLink) {
      const link = latent.client.generatePaymentLink(
        window.location.origin + "/pay",
      );
      setPaymentLink(link);
    }
  }, [latent.hasKeys, latent.client, paymentLink]);

  useEffect(() => {
    if (!showWalletDropdown) return;
    const handler = () => setShowWalletDropdown(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [showWalletDropdown]);

  useEffect(() => {
    if (activeTab !== "send" || !wallet.isConnected) return;
    let cancelled = false;
    const fetchBalance = () => {
      latent.client
        .getTokenBalance()
        .then((bal) => {
          if (!cancelled) {
            setRawTokenBalance(bal);
            setTokenBalance(formatTokenAmount(bal, SUPPORTED_TOKENS[0].decimals));
          }
        })
        .catch(() => {});
    };
    fetchBalance();
    const interval = setInterval(fetchBalance, 10_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeTab, wallet.isConnected, latent.client]);

  useEffect(() => {
    if (activeTab === "receive" && paymentLink && !autoScannedRef.current) {
      autoScannedRef.current = true;
      handleScanNotes();
    }
  }, [activeTab, paymentLink]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab === "history" && wallet.isConnected && !historyLoadedRef.current) {
      historyLoadedRef.current = true;
      loadHistory();
    }
  }, [activeTab, wallet.isConnected, loadHistory]);

  useEffect(() => {
    const { isWithdrawing, completedTxHashes, withdrawnLeafIndices: progressLeafIndices, withdrawnAmounts } = withdrawal.progress;
    if (isWithdrawing || completedTxHashes.length === 0) return;

    const newItems: Transaction[] = completedTxHashes
      .filter(
        (hash) => !transactionHistory.some((tx) => tx.txHash === hash),
      )
      .map((txHash, i) => ({
        type: "withdraw" as const,
        amount: formatTokenAmount(
          withdrawnAmounts[i] ?? 0n,
          SUPPORTED_TOKENS[0].decimals,
        ),
        txHash,
        timestamp: Date.now(),
        status: "completed" as const,
      }));

    if (newItems.length > 0) {
      setTransactionHistory((prev) => [...newItems, ...prev]);
      loadHistory();
    }

    setWithdrawnLeafIndices((prev) => {
      const next = new Set(prev);
      for (const idx of progressLeafIndices) next.add(idx);
      return next;
    });
  }, [withdrawal.progress.isWithdrawing]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerateKeys = async () => {
    setIsGeneratingKeys(true);
    try {
      await latent.deriveKeys();
      const link = latent.client.generatePaymentLink(
        window.location.origin + "/pay",
      );
      setPaymentLink(link);
    } finally {
      setIsGeneratingKeys(false);
    }
  };

  const handleScanNotes = async () => {
    setIsScanning(true);
    try {
      const notes = await latent.client.scanMyNotes();
      setReceivedNotes(notes);
    } finally {
      setIsScanning(false);
    }
  };

  const handleWithdrawNote = (note: OwnedNote) => {
    if (!wallet.address) return;
    withdrawal.startWithdrawal([note], wallet.address);
  };

  const handleDisconnect = useCallback(() => {
    wallet.disconnect();
    setShowWalletDropdown(false);
    setPaymentLink("");
    setReceivedNotes([]);
    setTransactionHistory([]);
    setWithdrawnLeafIndices(new Set());
    setTokenBalance(null);
    setRawTokenBalance(null);
    autoScannedRef.current = false;
    historyLoadedRef.current = false;
    prevAddressRef.current = "";
  }, [wallet]);

  const handleCloseModal = () => {
    withdrawal.reset();
  };

  const handleSend = async (paymentLinkUrl: string, amount: string, token: TokenConfig) => {
    if (!paymentLinkUrl || !amount) return;
    setIsSending(true);
    setSendStep(null);
    try {
      const { recipientNpk, recipientEncPubKey } =
        LatentClient.parsePaymentLink(paymentLinkUrl);
      const amountBigint = parseUnits(amount, token.decimals);
      const result = await latent.client.deposit({
        recipientNpk,
        recipientEncPubKey,
        amount: amountBigint,
        onProgress: (stage) => setSendStep(stage.step),
      });
      const historyItem: Transaction = {
        type: "send",
        amount,
        txHash: result.txHash,
        timestamp: Date.now(),
        status: "completed",
      };
      setTransactionHistory((prev) => [historyItem, ...prev]);
      setSendSuccessTxHash(result.txHash);
      latent.client.getTokenBalance().then((bal) => {
        setRawTokenBalance(bal);
        setTokenBalance(formatTokenAmount(bal, token.decimals));
      }).catch(() => {});
      loadHistory();
    } finally {
      setIsSending(false);
      setSendStep(null);
    }
  };

  const tabs: { key: Tab; icon: typeof Download; label: string }[] = [
    { key: "receive", icon: Download, label: t("tabReceive") },
    { key: "send", icon: Send, label: t("tabSend") },
    { key: "history", icon: ExternalLink, label: t("tabHistory") },
  ];

  return (
    <div className="min-h-screen transition-colors duration-300 bg-white text-gray-900 dark:bg-gray-950 dark:text-white">
      {/* Background */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-gray-100/40 via-white to-white dark:from-gray-900/40 dark:via-gray-950 dark:to-black" />

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b backdrop-blur-sm sticky top-0 z-[100] border-gray-200 dark:border-gray-800">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <ArrowLeft className="w-5 h-5" />
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full animate-pulse bg-amber-600 dark:bg-amber-400" />
                <span className="text-xl tracking-wider font-light">
                  {t("brand")}
                </span>
              </div>
            </Link>

            {!wallet.isConnected ? (
              <button
                onClick={wallet.connect}
                disabled={wallet.isConnecting}
                className="px-6 py-2 btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                <Wallet className="w-4 h-4" />
                {wallet.isConnecting ? t("connecting") : t("metamask")}
              </button>
            ) : (
              <div className="flex items-center gap-3">
                {!wallet.isCorrectChain && (
                  <button
                    onClick={wallet.switchChain}
                    className="flex items-center gap-2 px-3 py-2 border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/20"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">{t("wrongNetwork")}</span>
                  </button>
                )}

                <div className="relative">
                  <div
                    className="px-4 py-2 border flex items-center gap-3 cursor-pointer transition-all duration-200 border-gray-300 bg-gray-100/50 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800/50 dark:hover:bg-gray-800"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowWalletDropdown(!showWalletDropdown);
                    }}
                  >
                    {wallet.isCorrectChain ? (
                      <CrossChainIcon className="w-4 h-4" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                    )}
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-sm font-mono">
                      {wallet.formatAddress(wallet.address)}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-200 ${showWalletDropdown ? "rotate-180" : ""}`}
                    />
                  </div>

                  <AnimatePresence>
                    {showWalletDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 mt-2 w-56 border shadow-2xl z-[9999] overflow-hidden bg-white border-gray-200 dark:bg-gray-900 dark:border-gray-700"
                      >
                        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                          <div className="text-xs mb-1 text-gray-500">
                            {t("connectedWallet")}
                          </div>
                          <div className="text-sm font-mono">
                            {wallet.formatAddress(wallet.address)}
                          </div>
                        </div>
                        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                          <div className="text-xs mb-1 text-gray-500">
                            {t("network")}
                          </div>
                          <div className="flex items-center gap-2">
                            <CrossChainIcon className="w-3.5 h-3.5" />
                            <span className="text-sm">
                              {wallet.isCorrectChain
                                ? SUPPORTED_CHAIN.name
                                : t("unknownNetwork", { chainId: String(wallet.chainId ?? "?") })}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDisconnect();
                          }}
                          className="w-full px-4 py-3 text-sm text-red-500 hover:bg-red-500/10 transition-colors text-left"
                        >
                          {t("disconnectWallet")}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Main */}
        <main className="max-w-4xl mx-auto px-6 py-12">
          {!wallet.isConnected ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-20"
            >
              <Wallet className="w-16 h-16 mx-auto mb-6 text-gray-600 dark:text-gray-400" />
              <h2 className="text-3xl mb-4">{t("connectHeading")}</h2>
              <p className="mb-8 text-gray-600 dark:text-white/60">
                {t("connectDescription")}
              </p>
              <button
                onClick={wallet.connect}
                disabled={wallet.isConnecting}
                className="px-8 py-4 btn-primary disabled:opacity-50 w-full sm:w-auto"
              >
                {wallet.isConnecting
                  ? t("connecting")
                  : t("connectButton")}
              </button>

              {!wallet.hasProvider && (
                <div className="mt-8 p-4 border border-yellow-500/30 bg-yellow-500/10 max-w-md mx-auto">
                  <p className="text-sm text-yellow-700 dark:text-yellow-200">
                    {t("noMetamask")}{" "}
                    <a
                      href="https://metamask.io/download/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-1 underline hover:text-yellow-600 dark:hover:text-yellow-100"
                    >
                      {t("downloadHere")}
                    </a>
                  </p>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {!wallet.isCorrectChain && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-8 p-4 border flex items-center justify-between border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10"
                >
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    <div>
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                        {t("wrongNetworkTitle")}
                      </p>
                      <p className="text-xs text-amber-600 dark:text-amber-400/80">
                        {t("wrongNetworkDesc", { chainName: SUPPORTED_CHAIN.name })}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={wallet.switchChain}
                    className="px-4 py-2 text-sm font-medium border transition-colors border-amber-400 text-amber-700 hover:bg-amber-100 dark:border-amber-500/50 dark:text-amber-300 dark:hover:bg-amber-500/20"
                  >
                    {t("switchNetwork")}
                  </button>
                </motion.div>
              )}

              {/* Tabs */}
              <div className="flex gap-4 mb-8 border-b border-gray-200 dark:border-gray-800">
                {tabs.map(({ key, icon: Icon, label }) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`px-6 py-3 transition-all duration-300 relative ${
                      activeTab === key
                        ? "text-gray-900 dark:text-gray-300"
                        : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-400"
                    }`}
                  >
                    <Icon className="w-4 h-4 inline mr-2" />
                    {label}
                    {activeTab === key && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-600 dark:bg-amber-400"
                      />
                    )}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                {activeTab === "receive" && (
                  <motion.div
                    key="receive"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-6"
                  >
                    <PaymentLinkCard
                      paymentLink={paymentLink}
                      isGenerating={isGeneratingKeys}
                      onGenerate={handleGenerateKeys}
                    />
                    {paymentLink && (
                      <ReceivedFundsCard
                        notes={[...receivedNotes].sort((a, b) => Number(b.blockNumber - a.blockNumber))}
                        isScanning={isScanning}
                        onScan={handleScanNotes}
                        formatAddress={wallet.formatAddress}
                        onWithdrawNote={handleWithdrawNote}
                        isWithdrawing={withdrawal.progress.isWithdrawing}
                        withdrawnLeafIndices={withdrawnLeafIndices}
                      />
                    )}
                    <WithdrawalProgressModal
                      progress={withdrawal.progress}
                      onClose={handleCloseModal}
                    />
                  </motion.div>
                )}

                {activeTab === "send" && (
                  <motion.div
                    key="send"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <SendForm isSending={isSending} sendStep={sendStep} onSend={handleSend} initialAddress={initialAddress} balance={tokenBalance} rawBalance={rawTokenBalance} />
                    <SendSuccessModal
                      txHash={sendSuccessTxHash}
                      onClose={() => setSendSuccessTxHash(null)}
                    />
                  </motion.div>
                )}

                {activeTab === "history" && (
                  <motion.div
                    key="history"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                  >
                    <TransactionList
                      transactions={transactionHistory}
                      formatAddress={wallet.formatAddress}
                      isLoading={isLoadingHistory}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </main>
      </div>
    </div>
  );
}
