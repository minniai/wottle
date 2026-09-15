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
      timeout: 300_000, // First test has cold-start; presence settles can be slow.
    },
  ],
  use: {
    baseURL,
    // Failure evidence for CI: the trace + error-context page snapshot land in test-results/.
    // No single action may hang a test for its whole budget (a locator read waiting on an element that left the DOM did).
    actionTimeout: 15_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // In CI the server is started by the workflow; avoid double-starting.
  webServer: process.env.CI
    ? undefined
    : {
        command: `pnpm dev --port ${appPort}`,
        url: `http://localhost:${appPort}`,
        reuseExistingServer: true,
      },
});
