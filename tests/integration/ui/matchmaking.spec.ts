/**
 * Spec 044 US8 — the ranked queue stays in the room: searching bar, letters
 * landing, the opponent writing in, then the match, with no route flash.
 */
import { expect, test, type BrowserContext } from "@playwright/test";

import { generateTestUsername } from "./helpers/matchmaking";

test.describe.configure({ mode: "serial", retries: 1 });
test.skip(({ browserName }) => browserName !== "chromium", "two-context queue flow runs on chromium only");

async function loginAs(context: BrowserContext, prefix: string) {
  const page = await context.newPage();
  const username = generateTestUsername(prefix);
  await page.goto("/");
  await page.getByTestId("player-bar-name-input").fill(username);
  await page.getByTestId("player-bar-action-play").click();
  await expect(page.getByTestId("ledger-here-now")).toBeVisible({ timeout: 20_000 });
  return { page, username };
}

test.describe("@matchmaking queue → found → match in the room", () => {
  test("play ranked ▸ searches; cancel ▸ returns to the lobby", async ({ browser }) => {
    const ctx = await browser.newContext();
    try {
      const { page } = await loginAs(ctx, "q-cancel");
      await page.getByTestId("player-bar-action-ranked").click();
      await expect(page.getByTestId("room")).toHaveAttribute("data-phase", "queue", { timeout: 15_000 });
      await expect(page.getByTestId("player-bar-top")).toContainText("Finding an opponent");
      await expect(page.getByTestId("player-bar-top").getByTestId("player-bar-lane")).toHaveAttribute("data-mode", "searching");
      await expect(page.getByTestId("ledger-hint")).toContainText(/setting the field · \d+ of 100 letters/);
      await page.getByTestId("ledger-cancel-queue").click();
      await expect(page.getByTestId("room")).toHaveAttribute("data-phase", "lobby", { timeout: 15_000 });
      await expect(page).toHaveURL(/\/lobby$/);
    } finally {
      await ctx.close();
    }
  });

  test("two players queue, are found, and the room enters the match without a versus screen", async ({ browser }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    try {
      const [a, b] = await Promise.all([loginAs(ctxA, "q-a"), loginAs(ctxB, "q-b")]);
      await Promise.all([a.page.getByTestId("player-bar-action-ranked").click(), b.page.getByTestId("player-bar-action-ranked").click()]);
      for (const p of [a.page, b.page]) {
        await expect(p.getByTestId("room")).toHaveAttribute("data-phase", /found|match/, { timeout: 60_000 });
      }
      await expect(a.page.getByTestId("player-bar-top")).toContainText(b.username.slice(0, 8), { timeout: 20_000 });
      await expect(a.page.getByTestId("room")).toHaveAttribute("data-phase", "match", { timeout: 20_000 });
      await expect(b.page.getByTestId("room")).toHaveAttribute("data-phase", "match", { timeout: 20_000 });
      await expect(a.page).toHaveURL(/\/match\/[0-9a-f-]+/);
      const idA = await a.page.getByTestId("room").getAttribute("data-match-id");
      const idB = await b.page.getByTestId("room").getAttribute("data-match-id");
      expect(idA).toBeTruthy();
      expect(idA).toBe(idB);
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});
