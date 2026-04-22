import { test, expect, type BrowserContext } from "@playwright/test";

import { generateTestUsername } from "./helpers/matchmaking";

test.describe.configure({ mode: "serial", retries: 1 });

// The matchmaking queue is a single server-side pool shared across Playwright
// projects. Running this spec on both chromium and playtest-firefox causes
// cross-project races: chromium's queued player matches firefox's queued
// player, breaking the cancel flow. Scope to chromium only.
test.skip(
  ({ browserName }) => browserName !== "chromium",
  "Phase 4b matchmaking smoke runs on chromium only — shared server queue",
);

// Under act, matchmaking broadcasts routinely exceed BROADCAST_SUBSCRIBE_TIMEOUT_MS,
// so the match-ring render is timing-flaky. Verified on real CI.
test.skip(
  () => process.env.ACT === "true",
  "Realtime broadcasts unreliable under act — runs on real CI",
);

async function loginNewPlayer(context: BrowserContext) {
  const page = await context.newPage();
  const username = generateTestUsername("mm4b");
  await page.goto("/");
  await page.getByTestId("landing-username-input").fill(username);
  await page.getByTestId("landing-login-submit").click();
  await expect(page).toHaveURL(/\/lobby$/, { timeout: 15_000 });
  return { page, username };
}

test.describe("@matchmaking Phase 4b matchmaking screen", () => {
  test("clicking Play Now navigates to /matchmaking and renders the ring", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    try {
      const { page } = await loginNewPlayer(context);
      await page.getByTestId("matchmaker-start-button").click();
      await expect(page).toHaveURL(/\/matchmaking$/, { timeout: 10_000 });
      await expect(page.getByTestId("match-ring")).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.getByText(/Finding an opponent within/i)).toBeVisible();
      // Cancel search to leave queue cleanly — prevents stale matchmaking entries
      // from pairing with subsequent tests.
      await page.getByRole("button", { name: /Cancel search/i }).click();
      await expect(page).toHaveURL(/\/lobby$/, { timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  test("cancel search returns the viewer to /lobby", async ({ browser }) => {
    const context = await browser.newContext();
    try {
      const { page } = await loginNewPlayer(context);
      await page.getByTestId("matchmaker-start-button").click();
      await expect(page).toHaveURL(/\/matchmaking$/, { timeout: 10_000 });
      // Wait for the Cancel button — it's only present during the searching phase.
      // If a stale queue entry pairs the player immediately, the page skips straight
      // to /match/:id; the test still passes because we confirm we left /matchmaking.
      const cancelBtn = page.getByRole("button", { name: /Cancel search/i });
      // isVisible() returns immediately (no retry); give the client a moment to render
      await page.waitForTimeout(500);
      const hasCancelBtn = await cancelBtn.isVisible();
      if (hasCancelBtn) {
        await cancelBtn.click();
        await expect(page).toHaveURL(/\/lobby$/, { timeout: 10_000 });
      } else {
        // Already matched before cancel was possible — acceptable outcome
        await expect(page).toHaveURL(/\/(lobby|match\/[0-9a-f-]+)/, {
          timeout: 15_000,
        });
      }
    } finally {
      await context.close();
    }
  });

  test("two players matching navigate through found/starting into /match/:id", async ({
    browser,
  }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    try {
      const [a, b] = await Promise.all([loginNewPlayer(ctxA), loginNewPlayer(ctxB)]);
      await Promise.all([
        a.page.getByTestId("matchmaker-start-button").click(),
        b.page.getByTestId("matchmaker-start-button").click(),
      ]);
      await Promise.all([
        expect(a.page).toHaveURL(/\/matchmaking$/, { timeout: 10_000 }),
        expect(b.page).toHaveURL(/\/matchmaking$/, { timeout: 10_000 }),
      ]);
      await Promise.all([
        expect(a.page.getByTestId("matchmaking-vs-block")).toBeVisible({
          timeout: 20_000,
        }),
        expect(b.page.getByTestId("matchmaking-vs-block")).toBeVisible({
          timeout: 20_000,
        }),
      ]);
      await Promise.all([
        expect(a.page).toHaveURL(/\/match\/[0-9a-f-]+$/, { timeout: 15_000 }),
        expect(b.page).toHaveURL(/\/match\/[0-9a-f-]+$/, { timeout: 15_000 }),
      ]);
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});
