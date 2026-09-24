/**
 * Spec 044 US8, spec 070 US5: the search runs in the lobby's line slot, in
 * place; a pairing opens the table; new opponent searches from the lobby again.
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
  test("find an opponent ▸ searches in the line slot; cancel ▸ ends it, in place", async ({ browser }) => {
    const ctx = await browser.newContext();
    try {
      const { page } = await loginAs(ctx, "q-cancel");
      await page.getByTestId("lobby-find").click();
      await expect(page.getByTestId("line-slot-line1").first()).toContainText("Searching for an opponent", { timeout: 15_000 });
      await expect(page.getByTestId("line-slot-desktop")).toHaveAttribute("data-style", "status");
      // A wait has no primary: find is gone while the search runs.
      await expect(page.getByTestId("lobby-find")).toHaveCount(0);
      await expect(page).toHaveURL(/\/en$/);
      await page.locator("[data-testid=slot-cancelSearch]:visible").first().click();
      await expect(page.getByTestId("lobby-find")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId("line-slot-desktop")).toHaveAttribute("data-style", "terms");
      await expect(page).toHaveURL(/\/en$/);
    } finally {
      await ctx.close();
    }
  });

  test("two players queue, are found, play in the room, see the result, and new opponent searches again", async ({ browser }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    try {
      const [a, b] = await Promise.all([loginAs(ctxA, "q-a"), loginAs(ctxB, "q-b")]);
      await Promise.all([a.page.getByTestId("lobby-find").click(), b.page.getByTestId("lobby-find").click()]);
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

      // new opponent ▸ from that result goes back to a fresh search, in the lobby.
      await a.page.getByTestId("slip-new-opponent").click();
      await expect(a.page).toHaveURL(/\/en$/, { timeout: 15_000 });
      await expect(a.page.getByTestId("line-slot-line1").first()).toContainText("Searching for an opponent", { timeout: 15_000 });
      await a.page.locator("[data-testid=slot-cancelSearch]:visible").first().click();
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });

  test("a hidden searcher is never paired; resume ▸ puts them back (spec 069 FR-021, T052)", async ({ browser }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    try {
      const [a, b] = await Promise.all([loginAs(ctxA, "hid-a"), loginAs(ctxB, "hid-b")]);
      await a.page.getByTestId("lobby-find").click();
      await expect(a.page.getByTestId("line-slot-line1").first()).toContainText("Searching for an opponent", { timeout: 15_000 });
      await a.page.waitForTimeout(1_500);
      await a.page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await expect(a.page.getByTestId("line-slot-line1").first()).toContainText("search paused");

      await b.page.getByTestId("lobby-find").click();
      await expect(b.page.getByTestId("line-slot-line1").first()).toContainText("Searching for an opponent", { timeout: 15_000 });
      // Several of B's polls: A is paused, so B keeps searching.
      await b.page.waitForTimeout(8_000);
      await expect(b.page).toHaveURL(/\/en$/);

      await a.page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await a.page.locator("[data-testid=slot-resume]:visible").first().click();
      for (const p of [a.page, b.page]) await expect(p).toHaveURL(/\/match\/[0-9a-f-]{36}/, { timeout: 20_000 });
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});
