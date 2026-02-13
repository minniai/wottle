import { defineConfig, devices } from "@playwright/test";

const appPort = Number.parseInt(process.env.APP_PORT ?? "3000", 10);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${appPort}`;

export default defineConfig({
  testDir: "tests/integration/ui",
  timeout: 180_000, // Increased for CI playtest suite; invite modal + presence can be slow
  expect: {
    timeout: 10_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        baseURL,
        ...(process.env.CI && {
          launchOptions: {
            args: [
              "--no-sandbox",
              "--disable-setuid-sandbox",
              "--disable-dev-shm-usage",
              "--disable-gpu",
              "--disable-software-rasterizer",
            ],
          },
        }),
      },
    },
    {
      name: "playtest-firefox",
      use: { ...devices["Desktop Firefox"], baseURL },
      timeout: 300_000, // First test has cold-start; presence can take 3+ min in act/Docker
    },
  ],
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
