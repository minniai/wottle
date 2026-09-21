/**
 * Spec 044 US5 — an opponent's disconnect is written into their bar, not an
 * overlay: the sub-line counts the reconnection window down from the server
 * anchor, the lane goes dashed, and the one match clock keeps running
 * (spec 050: the clock never pauses).
 */
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { generateTestUsername, loginViaSlip, startMatchWithDirectInvite } from "./helpers/matchmaking";

test.describe.configure({ mode: "serial", retries: 1 });
test.skip(({ browserName }) => browserName !== "chromium", "two-context realtime flow runs on chromium only");

async function loginAs(context: BrowserContext, prefix: string) {
  const page = await context.newPage();
  const username = generateTestUsername(prefix);
  await loginViaSlip(page, username);
  return { page, username };
}

/** Playwright force-closes contexts without `pagehide`; replicate the beacon the production client sends. */
async function notifyServerOfDisconnect(page: Page) {
  const matchId = page.url().match(/\/match\/([0-9a-f-]+)/)?.[1];
  if (!matchId) return;
  await page.evaluate((id) => fetch(`/api/match/${id}/disconnect`, { method: "POST", keepalive: true }), matchId);
}

test.describe("@reconnect-flow disconnect is a bar state", () => {
  test("opponent bar counts the window down with a dashed lane; the match clock runs on; no overlay", async ({ browser }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    try {
      const [a, b] = await Promise.all([loginAs(ctxA, "dc-a"), loginAs(ctxB, "dc-b")]);
      await startMatchWithDirectInvite(a.page, b.page, { timeoutMs: 60_000, playerBUsername: b.username });
      await expect(a.page.getByTestId("room")).toHaveAttribute("data-phase", "match", { timeout: 20_000 });
      await expect(b.page.getByTestId("room")).toHaveAttribute("data-phase", "match", { timeout: 20_000 });

      await notifyServerOfDisconnect(b.page);
      await ctxB.close();

      const topBar = a.page.getByTestId("player-bar-top");
      await expect(topBar.getByTestId("player-bar-subline")).toContainText(/reconnecting · \d:\d\d left/, { timeout: 20_000 });
      await expect(topBar.getByTestId("player-bar-lane")).toHaveAttribute("data-mode", "disconnected");
      const clockBefore = await a.page.getByTestId("match-clock").textContent();
      await expect.poll(() => a.page.getByTestId("match-clock").textContent(), { timeout: 5_000 }).not.toBe(clockBefore);
      // Nothing over the field while the window runs; end early is a slip, and only for a player with ten moves.
      expect(await a.page.locator("[role=dialog], [role=alertdialog]").count()).toBe(0);

      // The countdown moves.
      const first = await topBar.getByTestId("player-bar-subline").textContent();
      await a.page.waitForTimeout(2_100);
      const second = await topBar.getByTestId("player-bar-subline").textContent();
      expect(second).not.toBe(first);
    } finally {
      await ctxA.close();
    }
  });
});
