export interface TokenConfig {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  iconUrl: string;
}

export const CROSSD_TOKEN: TokenConfig = {
  address: "0x9364ea6790f6e0ecfaa5164085f2a7de34ec55fb",
  symbol: "CROSSD",
  name: "CROSSD",
  decimals: 18,
  iconUrl: "https://contents.crosstoken.io/wallet/token/images/CROSSD.svg",
};

function resolveExtraTokens(): TokenConfig[] {
  const addr = process.env.NEXT_PUBLIC_TOKEN_ADDRESS;
  if (!addr || addr === CROSSD_TOKEN.address) return [];

  return [
    {
      address: addr,
      symbol: process.env.NEXT_PUBLIC_TOKEN_SYMBOL ?? "USDT",
      name: process.env.NEXT_PUBLIC_TOKEN_NAME ?? "Mock USDT",
      decimals: process.env.NEXT_PUBLIC_TOKEN_DECIMALS
        ? parseInt(process.env.NEXT_PUBLIC_TOKEN_DECIMALS)
        : 6,
      iconUrl: CROSSD_TOKEN.iconUrl,
    },
  ];
}

export const SUPPORTED_TOKENS: TokenConfig[] = [CROSSD_TOKEN, ...resolveExtraTokens()];
