export interface ChainConfig {
  chainId: number;
  chainIdHex: string;
  name: string;
  rpcUrl: string;
  blockExplorerUrl?: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

export const CROSS_TESTNET: ChainConfig = {
  chainId: 612044,
  chainIdHex: "0x956cc",
  name: "CROSS Testnet",
  rpcUrl: "https://testnet.crosstoken.io:22001",
  blockExplorerUrl: "https://explorer.crosstoken.io/612044",
  nativeCurrency: {
    name: "CROSS",
    symbol: "CROSS",
    decimals: 18,
  },
};

export const ANVIL_LOCAL: ChainConfig = {
  chainId: 31337,
  chainIdHex: "0x7a69",
  name: "Anvil Local",
  rpcUrl: "http://127.0.0.1:8545",
  nativeCurrency: {
    name: "ETH",
    symbol: "ETH",
    decimals: 18,
  },
};

export const SUPPORTED_CHAIN: ChainConfig =
  process.env.NEXT_PUBLIC_CHAIN_ID === "31337" ? ANVIL_LOCAL : CROSS_TESTNET;
