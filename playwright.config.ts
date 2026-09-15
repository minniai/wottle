import { defineConfig, devices } from "@playwright/test";

const appPort = Number.parseInt(process.env.APP_PORT ?? "3000", 10);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${appPort}`;

/** The three reference viewports of the design (spec 045 FR-004). */
const VISUAL_VIEWPORTS = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1280x800", width: 1280, height: 800 },
  { name: "390x844", width: 390, height: 844 },
] as const;

export default defineConfig({
  testDir: "tests/integration/ui",
  timeout: 180_000, // Increased for CI playtest suite; invite modal + presence can be slow
  expect: {
    timeout: 10_000,
    // Spec 045 US1: a small tolerance absorbs anti-aliasing; animations are
    // frozen so a screenshot never races the room's own motion.
    toHaveScreenshot: { maxDiffPixelRatio: 0.002, animations: "disabled" as const },
  },
  projects: [
    {
      name: "chromium",
      // The visual suite has its own per-viewport projects below; it must not
      // also run here, where the viewport is whatever Desktop Chrome defaults to.
      testIgnore: /room-fixtures\.spec\.ts/,
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
    ...VISUAL_VIEWPORTS.map(({ name, width, height }) => ({
      name: `visual-${name}`,
      testMatch: /room-fixtures\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], baseURL, viewport: { width, height } },
    })),
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
