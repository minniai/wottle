/**
 * Spec 050 US1–US3, US5 — a whole match in the room: ten moves each, whenever
 * each player likes, on one shared clock. A plays three in a row while B idles,
 * B's ledger fills A's rows as they resolve, and once both have ten the room
 * turns final with `moves_complete`.
 * Tagged @two-player-playtest so CI runs it alone on the playtest project.
 */
import { expect, test, type Page } from "@playwright/test";

import { generateTestUsername, loginViaSlip, startMatchWithDirectInvite } from "./helpers/matchmaking";
import { submitSwap } from "./helpers/swaps";

const live = (p: Page) => p.getByTestId("ledger-live-row");
// The viewer's moves left, on the bottom bar's lane (2026-09-21: the ledger's rail is gone).
const rail = (p: Page) => p.getByTestId("scoreboard-row-you").getByTestId("scoreboard-track");

test.describe("Move flow", () => {
  test("ten moves each at their own pace, then the final room @two-player-playtest", async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      const userA = generateTestUsername("flow-alpha");
      const userB = generateTestUsername("flow-beta");
      await loginViaSlip(pageA, userA);
      await loginViaSlip(pageB, userB);

      const [matchIdA, matchIdB] = await startMatchWithDirectInvite(pageA, pageB, { timeoutMs: 120_000, playerBUsername: userB });
      expect(matchIdA).toBeTruthy();
      expect(matchIdA).toEqual(matchIdB);
      for (const p of [pageA, pageB]) await expect(p.getByTestId("room")).toHaveAttribute("data-phase", "match", { timeout: 20_000 });

      // Move 1 is the viewer's on both clients; the clock is drawn once, in the caption.
      for (const p of [pageA, pageB]) {
        await expect(live(p)).toContainText("move 1 · your move", { timeout: 20_000 });
        await expect(p.getByTestId("field")).toHaveAttribute("data-turn", "you");
        await expect(p.getByTestId("scoreboard-row-you")).toContainText("move 1 of 10");
        await expect(p.getByTestId("scoreboard-clock")).toHaveText(/\d:\d\d/);
        await expect(rail(p)).toHaveAttribute("aria-valuenow", "10");
      }

      // A plays three in a row; B never has to wait and keeps move 1.
      for (let n = 1; n <= 3; n += 1) {
        await submitSwap(pageA);
        await expect(rail(pageA)).toHaveAttribute("aria-valuenow", `${10 - n}`, { timeout: 20_000 });
      }
      await expect(live(pageB)).toContainText("move 1 · your move");
      await expect(pageB.getByTestId("field")).toHaveAttribute("data-turn", "you");
      await expect(pageB.getByTestId("scoreboard-row-opp")).toContainText("3 of 10", { timeout: 20_000 });
      await expect(pageB.getByTestId("scoreboard-row-you")).toContainText("move 1 of 10");
      // B's ledger holds A's three moves in A's column: rows 1–3 are past.
      for (let r = 1; r <= 3; r += 1) {
        await expect(pageB.getByTestId(`ledger-row-${r}`)).not.toHaveAttribute("data-status", "future");
      }

      // B catches up; then both finish, interleaved.
      for (let n = 1; n <= 10; n += 1) {
        await submitSwap(pageB);
        if (n <= 7) await submitSwap(pageA);
      }

      // Both have ten: the match ends at once, without waiting for the clock.
      for (const p of [pageA, pageB]) {
        await expect(p.getByTestId("room")).toHaveAttribute("data-phase", "final", { timeout: 45_000 });
        await expect(p.getByTestId("slip")).toHaveAttribute("data-kind", "matchOver", { timeout: 20_000 });
        await expect(p.getByTestId("slip")).toContainText(/wins|draw/);
        await expect(rail(p)).toHaveAttribute("aria-valuenow", "0");
        await expect(p.getByTestId("ledger-caption")).toContainText(/final · \d+:\d\d/);
        await expect(p.getByTestId("field")).toBeVisible();
      }
      await expect(pageA.getByTestId("verdict")).toBeVisible();
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
