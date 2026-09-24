/**
 * Spec 070 US8 (T108): Back in a live match raises the leave slip, which never
 * resigns. Going to the lobby leaves the match running: the lobby's slot holds
 * it, the opponent reads `stepped out`, and `back to the match ▸` returns. A
 * match that ends while the player is away stays in their slot.
 * Tagged @two-player-playtest so CI runs it alone on the playtest project.
 */
import { expect, test } from "@playwright/test";

import { generateTestUsername, loginViaSlip, startMatchWithDirectInvite } from "./helpers/matchmaking";
import { waitForYourMove } from "./helpers/swaps";

test("the leave slip never resigns; the match waits in the lobby's slot @two-player-playtest", async ({ browser }) => {
  test.setTimeout(180_000);
  const [contextA, contextB] = [await browser.newContext(), await browser.newContext()];
  try {
    const [pageA, pageB] = [await contextA.newPage(), await contextB.newPage()];
    const [nameA, nameB] = [generateTestUsername("leave-a"), generateTestUsername("leave-b")];
    await loginViaSlip(pageA, nameA);
    await loginViaSlip(pageB, nameB);
    const [matchId] = await startMatchWithDirectInvite(pageA, pageB, { playerBUsername: nameB, timeoutMs: 60_000 });
    await waitForYourMove(pageA);

    // A pick arms the guard; Back raises the slip with `stay ▸` focused, and Escape keeps playing.
    await pageA.getByTestId("field").getByRole("gridcell").first().click();
    await pageA.goBack();
    const slip = pageA.getByTestId("slip");
    await expect(slip).toHaveAttribute("data-kind", "leave", { timeout: 10_000 });
    await expect(pageA.getByTestId("slip-stay")).toBeFocused();
    await pageA.keyboard.press("Escape");
    await expect(slip).toHaveCount(0);
    expect(pageA.url()).toContain(`/match/${matchId}`);

    // Go to the lobby: the match runs on; A's slot holds it and B reads `stepped out`.
    await pageA.goBack();
    await expect(slip).toHaveAttribute("data-kind", "leave", { timeout: 10_000 });
    await pageA.waitForTimeout(600);
    await pageA.getByTestId("slip-go-to-lobby").click();
    await expect(pageA.getByTestId("lobby-find").or(pageA.getByTestId("line-slot-desktop"))).toBeVisible({ timeout: 20_000 });
    const slotA = pageA.getByTestId("line-slot-desktop");
    await expect(slotA.getByTestId("line-slot-line1")).toContainText(new RegExp(`Your match · ${nameB}`, "i"), { timeout: 15_000 });
    await expect(pageB.getByTestId("scoreboard-row-opp").getByTestId("scoreboard-subline")).toContainText("stepped out", { timeout: 30_000 });

    // Back to the match returns; then away again while B resigns: the result waits in A's slot.
    await pageA.waitForTimeout(600);
    await slotA.getByTestId("slot-backToMatch").click();
    await expect(pageA).toHaveURL(new RegExp(`/match/${matchId}`), { timeout: 15_000 });
    await expect(pageA.getByTestId("room")).toHaveAttribute("data-phase", "match");
    await pageA.getByTestId("ledger-menu-trigger").click();
    await pageA.getByTestId("ledger-menu-item-leave").click();
    await pageA.waitForTimeout(600);
    await pageA.getByTestId("slip-go-to-lobby").click();
    await expect(slotA.getByTestId("line-slot-line1")).toContainText(new RegExp(`Your match · ${nameB}`, "i"), { timeout: 15_000 });

    await pageB.getByTestId("ledger-menu-trigger").click();
    await pageB.getByTestId("ledger-menu-item-resign").click();
    await pageB.getByTestId("slip-confirm-resign").click();
    await expect(slotA.getByTestId("line-slot-line1")).toContainText("Your match is over", { timeout: 20_000 });
  } finally {
    await contextA.close();
    await contextB.close();
  }
});
