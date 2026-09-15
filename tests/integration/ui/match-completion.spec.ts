/**
 * Spec 044 US9 — the result is stated once, in the same room: resign ends the
 * match; the field stays; the ledger shows the verdict; the rematch request is a
 * ledger line on the other side; `lobby` returns to the lobby room.
 */
import { expect, test, type Page } from "@playwright/test";

import { generateTestUsername, loginViaBar, startMatchWithDirectInvite } from "./helpers/matchmaking";

test.describe.configure({ mode: "serial", retries: 1 });

test.describe("@match-completion final room state", () => {
  test("resign → final: verdict in the ledger, field kept, rating lines, rematch line, back to lobby", async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    try {
      const userA = generateTestUsername("fin-a");
      const userB = generateTestUsername("fin-b");
      await loginViaBar(pageA, userA);
      await loginViaBar(pageB, userB);
      await startMatchWithDirectInvite(pageA, pageB, { timeoutMs: 60_000, playerBUsername: userB });
      await expect(pageA.getByTestId("room")).toHaveAttribute("data-phase", "match", { timeout: 20_000 });

      // A resigns through the live-row confirmation.
      await pageA.getByTestId("ledger-menu-trigger").click();
      await pageA.getByTestId("ledger-menu-item-resign").click();
      await pageA.getByTestId("notice-confirm-resign").click();

      for (const p of [pageA, pageB]) {
        await expect(p.getByTestId("room")).toHaveAttribute("data-phase", "final", { timeout: 30_000 });
        await expect(p.getByTestId("field")).toBeVisible();
        await expect(p.getByTestId("verdict")).toContainText(/wins \d+–\d+|draw \d+–\d+/);
        await expect(p.getByTestId("round-indicator")).toContainText(/final · 10 rounds/);
        await expect(p).toHaveURL(/\/match\/[0-9a-f-]+$/);
        expect(await p.locator("[role=dialog], [role=alertdialog]").count()).toBe(0);
      }
      // The winner's sub-line says wins once ratings land; the loser's shows a −n.
      await expect(pageB.getByTestId("player-bar-bottom").getByTestId("player-bar-subline")).toContainText(/→ \d+ · \+\d+ · wins|rating pending/, { timeout: 15_000 });

      // Rematch: B asks, A sees the line and declines; then A returns to the lobby.
      await pageB.getByTestId("ledger-rematch").click();
      await expect(pageA.getByTestId("notice-accept-rematch")).toBeVisible({ timeout: 15_000 });
      await expect(pageA.getByTestId("ledger-notice").filter({ hasText: "asks for a rematch" })).toBeVisible();
      await pageA.getByTestId("notice-decline-rematch").click();
      await expect(pageB.getByTestId("ledger-notice").filter({ hasText: /declined/ })).toBeVisible({ timeout: 15_000 });

      await pageA.getByTestId("ledger-lobby").click();
      await expect(pageA.getByTestId("room")).toHaveAttribute("data-phase", "lobby", { timeout: 15_000 });
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
