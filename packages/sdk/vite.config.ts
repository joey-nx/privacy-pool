import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "CpsSdk",
      formats: ["es", "cjs"],
      fileName: "index",
    },
    rollupOptions: {
      external: ["ethers", "@aztec/bb.js", "@noir-lang/noir_js", "@noble/curves/secp256k1"],
    },
    target: "ES2022",
    sourcemap: true,
  },
});
