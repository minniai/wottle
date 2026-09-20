/**
 * Spec 044 US9 — the result is stated once, in the same room: resign ends the
 * match; the field stays; the ledger shows the verdict; the rematch request is a
 * ledger line on the other side; `lobby` returns to the lobby room.
 */
import { expect, test, type Page } from "@playwright/test";

import { generateTestUsername, loginViaSlip, startMatchWithDirectInvite } from "./helpers/matchmaking";

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
      await loginViaSlip(pageA, userA);
      await loginViaSlip(pageB, userB);
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
        // Every match in this suite is started by direct invite, and a
        // directory challenge is unranked since 15 September 2026 (spec 045
        // decision 1) — so the caption names it and no rating line is written.
        await expect(p.getByTestId("round-indicator")).toContainText(/final · unranked · 10 rounds/);
        await expect(p).toHaveURL(/\/match\/[0-9a-f-]+$/);
        // Spec 048 US1: the result is the one dialog in the room — the slip over the field.
        await expect(p.getByTestId("slip")).toHaveAttribute("data-kind", "matchOver", { timeout: 15_000 });
        await expect(p.getByTestId("slip")).toContainText(/wins|draw/);
      }
      // These matches are invite-created and therefore unranked, so no rating is
      // written and the bar says so rather than waiting on one that never comes.
      await expect(pageB.getByTestId("player-bar-bottom").getByTestId("player-bar-subline")).toContainText(/unranked · no rating change/, { timeout: 15_000 });

      // review the field ▸ lifts the slip; result ▸ in the foot brings it back.
      await pageA.getByTestId("slip-review-field").click();
      await expect(pageA.getByTestId("slip")).toHaveCount(0);
      await pageA.getByTestId("ledger-result").click();
      await expect(pageA.getByTestId("slip")).toBeVisible();

      // Rematch: B asks on the slip, A's slip rewrites its action line and A declines; then A returns to the lobby.
      await pageB.getByTestId("slip-rematch").click();
      await expect(pageA.getByTestId("slip-accept-rematch")).toBeVisible({ timeout: 15_000 });
      await expect(pageA.getByTestId("slip")).toContainText("asks for a rematch");
      await pageA.getByTestId("slip-decline-rematch").click();
      await expect(pageB.getByTestId("ledger-notice").filter({ hasText: /declined/ })).toBeVisible({ timeout: 15_000 });

      await pageA.getByTestId("slip-lobby").click();
      await expect(pageA.getByTestId("room")).toHaveAttribute("data-phase", "lobby", { timeout: 15_000 });
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
