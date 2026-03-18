"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { LatentClient } from "@latent/sdk";
import { latentConfig } from "~shared/config/latent";

interface LatentContextValue {
  client: LatentClient;
  isReady: boolean;
  address: string;
  chainId: number | null;
  isConnected: boolean;
  hasKeys: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  deriveKeys: () => Promise<void>;
}

const LatentContext = createContext<LatentContextValue | null>(null);

interface LatentProviderProps {
  children: ReactNode;
}

export function LatentProvider({ children }: LatentProviderProps) {
  const clientRef = useRef<LatentClient | null>(null);
  const disconnectedRef = useRef(false);
  const [isReady, setIsReady] = useState(false);
  const [address, setAddress] = useState("");
  const [chainId, setChainId] = useState<number | null>(null);
  const [hasKeys, setHasKeys] = useState(false);

  // Singleton client
  if (!clientRef.current) {
    clientRef.current = new LatentClient(latentConfig);
  }
  const client = clientRef.current;

  // Init WASM once, then try silent reconnect
  useEffect(() => {
    let cancelled = false;
    client.init().then(async () => {
      if (cancelled) return;
      setIsReady(true);
      // Silently restore previous wallet connection (no MetaMask popup)
      try {
        const addr = await client.reconnect();
        if (cancelled || !addr) return;
        disconnectedRef.current = false;
        setAddress(addr);
        setChainId(client.getChainId());
        const keysLoaded = client.getKeys() !== null;
        setHasKeys(keysLoaded);
        if (keysLoaded) {
          await client.register();
          client.preloadProver().catch(() => {});
        }
      } catch {
        // No previously authorized account — user must click Connect
      }
    });
    return () => {
      cancelled = true;
    };
  }, [client]);

  // Listen for account/chain changes (ignore if user disconnected)
  useEffect(() => {
    const unsub = client.onAccountChange((newAddress) => {
      if (disconnectedRef.current) return;
      if (newAddress) {
        setAddress(newAddress);
        setChainId(client.getChainId());
        setHasKeys(client.getKeys() !== null);
      } else {
        setAddress("");
        setChainId(null);
        setHasKeys(false);
      }
    });
    return unsub;
  }, [client]);

  const connect = useCallback(async () => {
    disconnectedRef.current = false;
    const addr = await client.connect();
    setAddress(addr);
    setChainId(client.getChainId());
    const keysLoaded = client.getKeys() !== null;
    setHasKeys(keysLoaded);
    // If keys were loaded from localStorage cache, ensure registration
    // MVP: KYC 미연동 — 자동 등록. TODO: 추후 KYC 연동
    if (keysLoaded) {
      await client.register();
      client.preloadProver().catch(() => {});
    }
  }, [client]);

  const disconnect = useCallback(() => {
    disconnectedRef.current = true;
    client.disconnect();
    setAddress("");
    setChainId(null);
    setHasKeys(false);
  }, [client]);

  const deriveKeys = useCallback(async () => {
    await client.deriveKeys();
    setHasKeys(true);
    // MVP: KYC 미연동 — 키 생성 후 자동으로 operator에 등록
    // TODO: 추후 KYC 프로세스 연동 시 KYC 승인 후에만 register() 호출
    await client.register();
    // 출금 대비 WASM(noir_js + bb.js) 사전 로드 — fire-and-forget
    client.preloadProver().catch(() => {});
  }, [client]);

  const value: LatentContextValue = {
    client,
    isReady,
    address,
    chainId,
    isConnected: address !== "",
    hasKeys,
    connect,
    disconnect,
    deriveKeys,
  };

  return (
    <LatentContext.Provider value={value}>{children}</LatentContext.Provider>
  );
}

export function useLatent(): LatentContextValue {
  const ctx = useContext(LatentContext);
  if (!ctx) {
    throw new Error("useLatent must be used within a LatentProvider");
  }
  return ctx;
}
