import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/integration/ui",
  timeout: 120_000, // Increased for CI environments with slower matchmaking
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
  },
});
