/**
 * Spec 069 — the table. Every match begins with both players sitting down; the
 * server holds the letters until both are seated; a table that does not fill,
 * or that someone leaves, is void and rates nothing.
 * Tagged @two-player-playtest so CI runs it alone on the playtest project.
 */
import { expect, test, type Page } from "@playwright/test";

import { generateTestUsername, loginViaSlip } from "./helpers/matchmaking";

/** The tab reports itself hidden, so the server does not seat this player at creation (spec 069 R5). */
async function hideTab(page: Page): Promise<void> {
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

async function showTab(page: Page): Promise<void> {
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

/** A challenges B while A's tab is hidden; B's accept seats B, A waits at the table unseated. */
async function tableWithAUnseated(pageA: Page, pageB: Page, userB: string): Promise<string> {
  const row = pageA.getByTestId("ledger-here-now-row").filter({ hasText: `@${userB}` });
  await row.waitFor({ state: "visible", timeout: 60_000 });
  await row.getByRole("button", { name: /challenge/i }).click();
  await hideTab(pageA);
  // Let a table check report the hidden tab (every 3s) before B accepts.
  await pageA.waitForTimeout(3_500);
  const accept = pageB.getByTestId("notice-accept-challenge");
  await accept.waitFor({ state: "visible", timeout: 30_000 });
  await accept.click();
  for (const p of [pageA, pageB]) await expect(p).toHaveURL(/\/match\/[0-9a-f-]{36}/, { timeout: 30_000 });
  await showTab(pageA);
  return pageA.url().split("/match/")[1];
}

const letters = (p: Page) => p.getByTestId("field").getByRole("gridcell").allTextContents();

test.describe("The table", () => {
  test("an unseated player presses ready ▸; no letter arrives before both sit; the count runs to move 1 @two-player-playtest", async ({ browser }) => {
    test.setTimeout(150_000);
    const [contextA, contextB] = [await browser.newContext(), await browser.newContext()];
    const [pageA, pageB] = [await contextA.newPage(), await contextB.newPage()];
    try {
      const [userA, userB] = [generateTestUsername("table-a"), generateTestUsername("table-b")];
      await loginViaSlip(pageA, userA);
      await loginViaSlip(pageB, userB);
      await tableWithAUnseated(pageA, pageB, userB);

      // A is not seated: the ready slip, its primary and the drain; B is seated and waits.
      await expect(pageA.getByTestId("slip")).toHaveAttribute("data-kind", "ready");
      await expect(pageA.getByTestId("slip-ready")).toBeVisible();
      await expect(pageA.getByTestId("slip-table-label")).toContainText(/opponent found · 0:\d\d/);
      await expect(pageB.getByTestId("slip-seated")).toBeVisible();
      await expect(pageB.getByTestId("ledger-caption")).toContainText("opponent found");
      // The server has sent no letters to either player (FR-003).
      for (const p of [pageA, pageB]) expect((await letters(p)).join("")).toBe("");

      await pageA.waitForTimeout(600);
      await pageA.getByTestId("slip-ready").click();

      // The start is set; the slip lifts; the count runs; move 1 opens on both.
      for (const p of [pageA, pageB]) {
        await expect(p.getByTestId("ledger-live-row")).toContainText("move 1 · your move", { timeout: 20_000 });
        await expect(p.getByTestId("slip")).toHaveCount(0);
        expect((await letters(p)).join("").length).toBeGreaterThan(50);
      }
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test("leave voids the table: the leaver goes to the lobby, the other reads that nothing was rated @two-player-playtest", async ({ browser }) => {
    test.setTimeout(150_000);
    const [contextA, contextB] = [await browser.newContext(), await browser.newContext()];
    const [pageA, pageB] = [await contextA.newPage(), await contextB.newPage()];
    try {
      const [userA, userB] = [generateTestUsername("leave-a"), generateTestUsername("leave-b")];
      await loginViaSlip(pageA, userA);
      await loginViaSlip(pageB, userB);
      await tableWithAUnseated(pageA, pageB, userB);

      await pageA.getByTestId("slip-leave-table").click();
      await expect(pageA).toHaveURL(/\/lobby$/, { timeout: 20_000 });
      await expect(pageB.getByTestId("slip")).toHaveAttribute("data-kind", "void", { timeout: 20_000 });
      await expect(pageB.getByTestId("slip")).toContainText("left the table");
      await expect(pageB.getByTestId("slip")).toContainText("nothing was rated");
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test("a table whose 20s run out is void for both @two-player-playtest", async ({ browser }) => {
    test.setTimeout(150_000);
    const [contextA, contextB] = [await browser.newContext(), await browser.newContext()];
    const [pageA, pageB] = [await contextA.newPage(), await contextB.newPage()];
    try {
      const [userA, userB] = [generateTestUsername("late-a"), generateTestUsername("late-b")];
      await loginViaSlip(pageA, userA);
      await loginViaSlip(pageB, userB);
      await tableWithAUnseated(pageA, pageB, userB);

      await expect(pageB.getByTestId("slip")).toHaveAttribute("data-kind", "void", { timeout: 30_000 });
      await expect(pageB.getByTestId("slip")).toContainText("did not sit down");
      await expect(pageA.getByTestId("slip")).toContainText("You did not sit down in time");
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
