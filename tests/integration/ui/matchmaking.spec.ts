/**
 * Spec 044 US8 — the queue stays in the room: searching bar, letters
 * landing, the opponent writing in, then the match, with no route flash.
 */
import { expect, test, type BrowserContext } from "@playwright/test";

import { generateTestUsername, loginViaSlip, sitDownIfAsked } from "./helpers/matchmaking";

test.describe.configure({ mode: "serial", retries: 1 });
test.skip(({ browserName }) => browserName !== "chromium", "two-context queue flow runs on chromium only");

async function loginAs(context: BrowserContext, prefix: string) {
  const page = await context.newPage();
  const username = generateTestUsername(prefix);
  await loginViaSlip(page, username);
  return { page, username };
}

test.describe("@matchmaking queue → found → match in the room", () => {
  test("find an opponent ▸ searches; cancel ▸ returns to the lobby", async ({ browser }) => {
    const ctx = await browser.newContext();
    try {
      const { page } = await loginAs(ctx, "q-cancel");
      await page.getByTestId("player-bar-action-find").click();
      await expect(page.getByTestId("room")).toHaveAttribute("data-phase", "queue", { timeout: 15_000 });
      await expect(page.getByTestId("player-bar-top")).toContainText("Finding an opponent");
      await expect(page.getByTestId("player-bar-top").getByTestId("player-bar-lane")).toHaveAttribute("data-mode", "searching");
      // Spec 045 B7: the queue's progress is a live row, as Fig. 7 draws it;
      // the hint keeps the queue's own context line.
      await expect(page.getByTestId("ledger-live-row")).toContainText(/setting the field · \d+ of 100 letters/);
      await page.getByTestId("ledger-cancel-queue").click();
      await expect(page.getByTestId("room")).toHaveAttribute("data-phase", "lobby", { timeout: 15_000 });
      await expect(page).toHaveURL(/\/lobby$/);
    } finally {
      await ctx.close();
    }
  });

  test("two players queue, are found, play in the room, see the result, and new opponent searches again", async ({ browser }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    try {
      const [a, b] = await Promise.all([loginAs(ctxA, "q-a"), loginAs(ctxB, "q-b")]);
      await Promise.all([a.page.getByTestId("player-bar-action-find").click(), b.page.getByTestId("player-bar-action-find").click()]);
      for (const p of [a.page, b.page]) {
        await expect(p.getByTestId("room")).toHaveAttribute("data-phase", "match", { timeout: 60_000 });
      }
      // The table names the opponent on the scoreboard (spec 068, spec 069).
      await expect(a.page.getByTestId("scoreboard-row-opp")).toContainText(b.username.slice(0, 8), { timeout: 20_000, ignoreCase: true });
      await expect(a.page.getByTestId("room")).toHaveAttribute("data-phase", "match", { timeout: 20_000 });
      await expect(b.page.getByTestId("room")).toHaveAttribute("data-phase", "match", { timeout: 20_000 });
      await expect(a.page).toHaveURL(/\/match\/[0-9a-f-]+/);
      const idA = await a.page.getByTestId("room").getAttribute("data-match-id");
      const idB = await b.page.getByTestId("room").getAttribute("data-match-id");
      expect(idA).toBeTruthy();
      expect(idA).toBe(idB);
      // Spec 069: the match begins at the table; resigning waits for go.
      await Promise.all([sitDownIfAsked(a.page), sitDownIfAsked(b.page)]);
      for (const p of [a.page, b.page]) await expect(p.getByTestId("ledger-live-row")).toContainText("move 1 · your move", { timeout: 20_000 });

      // Reported 2026-09-21: a queue-found match that ended fell back to the queue view
      // (`Finding an opponent · ranked · 0:00`) instead of the result. A resigns.
      await a.page.getByTestId("ledger-menu-trigger").click();
      await a.page.getByTestId("ledger-menu-item-resign").click();
      await a.page.getByTestId("slip-confirm-resign").click();
      for (const p of [a.page, b.page]) {
        await expect(p.getByTestId("room")).toHaveAttribute("data-phase", "final", { timeout: 30_000 });
        await expect(p.getByTestId("room")).toHaveAttribute("data-match-id", idA!);
        await expect(p.getByTestId("slip")).toHaveAttribute("data-kind", "matchOver", { timeout: 15_000 });
        await expect(p.getByTestId("verdict")).toContainText(/wins|draw/);
        await expect(p.getByTestId("scoreboard-row-opp")).not.toContainText("Finding an opponent");
      }

      // new opponent ▸ from that result goes back to a fresh search.
      await a.page.getByTestId("slip-new-opponent").click();
      await expect(a.page.getByTestId("room")).toHaveAttribute("data-phase", "queue", { timeout: 15_000 });
      await expect(a.page.getByTestId("player-bar-top")).toContainText("Finding an opponent");
      await expect(a.page).toHaveURL(/\/matchmaking$/);
      await a.page.getByTestId("ledger-cancel-queue").click();
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});
