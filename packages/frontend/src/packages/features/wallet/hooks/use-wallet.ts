"use client";

import { useState, useCallback, useEffect } from "react";
import { useLatent } from "~providers/latent-provider";
import { SUPPORTED_CHAIN } from "~shared/config/chains";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }
}

interface UseWalletReturn {
  address: string;
  chainId: number | null;
  isConnected: boolean;
  isConnecting: boolean;
  isCorrectChain: boolean;
  hasProvider: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchChain: () => Promise<void>;
  formatAddress: (addr: string) => string;
}

export function useWallet(): UseWalletReturn {
  const latent = useLatent();
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasProvider, setHasProvider] = useState(false);

  useEffect(() => {
    setHasProvider(!!window.ethereum);
  }, []);

  const isCorrectChain = latent.chainId === SUPPORTED_CHAIN.chainId;

  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      await latent.connect();
    } finally {
      setIsConnecting(false);
    }
  }, [latent]);

  const switchChain = useCallback(async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SUPPORTED_CHAIN.chainIdHex }],
      });
    } catch (error) {
      // Chain not added to wallet — add it
      if ((error as { code: number }).code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: SUPPORTED_CHAIN.chainIdHex,
              chainName: SUPPORTED_CHAIN.name,
              rpcUrls: [SUPPORTED_CHAIN.rpcUrl],
              nativeCurrency: SUPPORTED_CHAIN.nativeCurrency,
            },
          ],
        });
      }
    }
  }, []);

  const formatAddress = useCallback((addr: string) => {
    if (!addr) return "";
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  }, []);

  return {
    address: latent.address,
    chainId: latent.chainId,
    isConnected: latent.isConnected,
    isConnecting,
    isCorrectChain,
    hasProvider,
    connect,
    disconnect: latent.disconnect,
    switchChain,
    formatAddress,
  };
}
