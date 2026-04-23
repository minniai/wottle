import { test, expect, type BrowserContext, type Page } from "@playwright/test";

import {
  generateTestUsername,
  startMatchWithDirectInvite,
} from "./helpers/matchmaking";

test.describe.configure({ mode: "serial", retries: 1 });

// Dual-context disconnect smoke shares presence + match-channel state across
// Playwright projects. Scope to chromium only to avoid realtime races with
// the parallel playtest-firefox project.
test.skip(
  ({ browserName }) => browserName !== "chromium",
  "Phase 6 disconnect-modal runs on chromium only",
);

async function loginAs(context: BrowserContext, prefix: string) {
  const page = await context.newPage();
  const username = generateTestUsername(prefix);
  await page.goto("/");
  await page.getByTestId("landing-username-input").fill(username);
  await page.getByTestId("landing-login-submit").click();
  await expect(page).toHaveURL(/\/lobby$/, { timeout: 15_000 });
  return { page, username };
}

async function waitForMatch(page: Page) {
  await expect(page).toHaveURL(/\/match\/[0-9a-f-]+/, { timeout: 20_000 });
  await expect(page.getByTestId("board-grid")).toBeVisible({ timeout: 15_000 });
}

// Playwright's `ctxB.close()` force-kills the browser context, so the
// `pagehide` → `sendBeacon` path wired in MatchClient doesn't reliably reach
// the server. Production users hit `/api/match/:id/disconnect` via the beacon
// on tab teardown; we replicate that explicitly here so the test isn't racing
// the teardown.
async function notifyServerOfDisconnect(page: Page) {
  const match = page.url().match(/\/match\/([0-9a-f-]+)/);
  if (!match) return;
  const [, matchId] = match;
  await page.evaluate(
    (id) => fetch(`/api/match/${id}/disconnect`, { method: "POST", keepalive: true }),
    matchId,
  );
}

test.describe("@disconnect-modal Phase 6", () => {
  test("opponent disconnect shows modal with Claim win disabled during countdown", async ({
    browser,
  }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    try {
      const [a, b] = await Promise.all([
        loginAs(ctxA, "dc-show-a"),
        loginAs(ctxB, "dc-show-b"),
      ]);

      await startMatchWithDirectInvite(a.page, b.page, {
        playerBUsername: b.username,
      });
      await Promise.all([waitForMatch(a.page), waitForMatch(b.page)]);

      // Player B disconnects — closing the context tears down the Realtime
      // channel, which the server observes and broadcasts.
      await notifyServerOfDisconnect(b.page);
      await ctxB.close();

      // Modal should render on A within a few seconds.
      await expect(a.page.getByTestId("disconnection-modal")).toBeVisible({
        timeout: 20_000,
      });

      // Claim win is disabled while the 90s countdown is running.
      await expect(
        a.page.getByRole("button", { name: /Claim win/i }),
      ).toBeDisabled();
    } finally {
      await ctxA.close();
      // ctxB already closed above
    }
  });

  test("Keep waiting dismisses the modal", async ({ browser }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    try {
      const [a, b] = await Promise.all([
        loginAs(ctxA, "dc-keep-a"),
        loginAs(ctxB, "dc-keep-b"),
      ]);

      await startMatchWithDirectInvite(a.page, b.page, {
        playerBUsername: b.username,
      });
      await Promise.all([waitForMatch(a.page), waitForMatch(b.page)]);

      await notifyServerOfDisconnect(b.page);
      await ctxB.close();

      const modal = a.page.getByTestId("disconnection-modal");
      await expect(modal).toBeVisible({ timeout: 20_000 });

      await a.page.getByRole("button", { name: /Keep waiting/i }).click();
      await expect(modal).toBeHidden({ timeout: 5_000 });
    } finally {
      await ctxA.close();
    }
  });
});
