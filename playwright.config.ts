import { defineConfig } from "@playwright/test";

const appPort = Number.parseInt(process.env.APP_PORT ?? "3000", 10);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${appPort}`;

export default defineConfig({
  testDir: "tests/integration/ui",
  timeout: 120_000, // Increased for CI environments with slower matchmaking
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
  },
  // In CI the server is started by the workflow; avoid double-starting which
  // can cause port collisions when running under act or with other services.
  webServer: process.env.CI
    ? undefined
    : {
        command: `pnpm dev --port ${appPort}`,
        url: `http://localhost:${appPort}`,
        reuseExistingServer: true,
      },
});
