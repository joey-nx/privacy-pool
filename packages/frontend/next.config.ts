import type { NextConfig } from "next";
import path from "path";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // Transpile @latent/sdk source directly — no pre-build needed
  transpilePackages: ["@latent/sdk"],
  webpack(config) {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    // Resolve @latent/sdk to source for instant HMR
    config.resolve.alias = {
      ...config.resolve.alias,
      "@latent/sdk": path.resolve(__dirname, "../sdk/src/index.ts"),
    };

    // Allow .js imports to resolve .ts files (SDK uses .js extensions in imports)
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    };

    // Fallback for Node.js modules not available in browser
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
    };

    return config;
  },
};

export default withNextIntl(nextConfig);
