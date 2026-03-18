/**
 * MetaMask EIP-1193 wallet integration.
 *
 * Handles wallet connection, account/network change detection,
 * and provider management for mobile web + desktop.
 */

import { BrowserProvider, type Signer, type Eip1193Provider } from "ethers";

export interface WalletState {
  provider: BrowserProvider;
  signer: Signer;
  address: string;
  chainId: number;
}

/**
 * Detect EIP-1193 provider (MetaMask or compatible).
 */
export function detectProvider(): Eip1193Provider | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  if (w.ethereum) return w.ethereum as Eip1193Provider;
  return null;
}

/**
 * Connect to MetaMask and return wallet state.
 *
 * Prompts the user to connect if not already connected.
 * Works in MetaMask mobile in-app browser and desktop extension.
 */
export async function connectWallet(): Promise<WalletState> {
  const ethereum = detectProvider();
  if (!ethereum) {
    throw new Error(
      "No EIP-1193 provider found. Please use MetaMask or a compatible wallet.",
    );
  }

  const provider = new BrowserProvider(ethereum);
  // Force account picker so user can switch wallets after disconnect
  try {
    await provider.send("wallet_requestPermissions", [{ eth_accounts: {} }]);
  } catch {
    // Fallback for wallets that don't support wallet_requestPermissions
    await provider.send("eth_requestAccounts", []);
  }

  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  const network = await provider.getNetwork();

  return {
    provider,
    signer,
    address,
    chainId: Number(network.chainId),
  };
}

/**
 * Silently reconnect to an already-authorized wallet.
 *
 * Uses eth_accounts (no popup) to check if MetaMask still has a connected account.
 * Returns null if no account is authorized — the user must call connectWallet() explicitly.
 */
export async function reconnectWallet(): Promise<WalletState | null> {
  const ethereum = detectProvider();
  if (!ethereum) return null;

  const provider = new BrowserProvider(ethereum);
  const accounts: string[] = await provider.send("eth_accounts", []);
  if (accounts.length === 0) return null;

  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  const network = await provider.getNetwork();

  return {
    provider,
    signer,
    address,
    chainId: Number(network.chainId),
  };
}

/**
 * Read current wallet state without triggering any popup.
 *
 * Used by event handlers (accountsChanged, chainChanged) to silently
 * refresh state. For initial connection with account picker, use connectWallet().
 */
export async function getWalletState(): Promise<WalletState> {
  const ethereum = detectProvider();
  if (!ethereum) {
    throw new Error("No EIP-1193 provider found.");
  }

  const provider = new BrowserProvider(ethereum);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  const network = await provider.getNetwork();

  return {
    provider,
    signer,
    address,
    chainId: Number(network.chainId),
  };
}

/**
 * Listen for account and chain changes.
 *
 * Returns an unsubscribe function.
 */
export function onWalletChange(
  callback: (state: WalletState | null) => void,
): () => void {
  const ethereum = detectProvider();
  if (!ethereum) return () => {};

  const eth = ethereum as Eip1193Provider & {
    on(event: string, handler: (...args: unknown[]) => void): void;
    removeListener(event: string, handler: (...args: unknown[]) => void): void;
  };

  const handleChange = async () => {
    try {
      // Use getWalletState (no popup) instead of connectWallet (triggers account picker)
      const state = await getWalletState();
      callback(state);
    } catch {
      callback(null);
    }
  };

  eth.on("accountsChanged", handleChange);
  eth.on("chainChanged", handleChange);

  return () => {
    eth.removeListener("accountsChanged", handleChange);
    eth.removeListener("chainChanged", handleChange);
  };
}

/**
 * Request network switch to the specified chain ID.
 */
export async function switchNetwork(chainId: number): Promise<void> {
  const ethereum = detectProvider();
  if (!ethereum) throw new Error("No EIP-1193 provider found.");

  await (ethereum as Eip1193Provider).request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: "0x" + chainId.toString(16) }],
  });
}
