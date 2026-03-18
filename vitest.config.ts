import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Root vitest config for E2E or cross-package tests.
    // Individual packages have their own vitest.config.ts.
    include: [],
    testTimeout: 30000,
  },
});
