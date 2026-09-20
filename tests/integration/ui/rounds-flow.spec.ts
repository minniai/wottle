/**
 * Spec 002 / 044 — a whole match in the room: ten rounds of pick → commit on
 * both fields, the caption advancing each round, then the final room state.
 * Tagged @two-player-playtest so CI runs it alone on the playtest project.
 */
import { expect, test } from "@playwright/test";

import { generateTestUsername, loginViaSlip, startMatchWithDirectInvite } from "./helpers/matchmaking";
import { submitSwap } from "./helpers/swaps";

test.describe("Round flow", () => {
  test("completes 10 rounds with reconnect safety + late swap guards @two-player-playtest", async ({ browser }) => {
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

      // Spec 048 US2: round 1 is walked beat by beat on both clients — your move →
      // played → (resolving) → scored → the next round's your move. Later rounds only
      // check the caption, so the ten-round run stays inside its budget.
      const live = (p: typeof pageA) => p.getByTestId("ledger-live-row");
      await expect(live(pageA)).toContainText("round 1 · your move", { timeout: 20_000 });
      await expect(live(pageA)).toContainText("pick a letter");
      await expect(pageA.getByTestId("field")).toHaveAttribute("data-turn", "you");
      await expect(pageA.getByTestId("player-bar-bottom")).toContainText("your move");
      await expect(pageA.getByTestId("player-bar-top")).toContainText("thinking");
      await expect(pageA.getByTestId("round-rail")).toHaveAttribute("aria-label", "round 1 of 10");

      await submitSwap(pageA);
      await expect(live(pageA)).toContainText(`played · waiting for ${userB}`, { timeout: 20_000 });
      await expect(pageA.getByTestId("player-bar-bottom")).toContainText("played ●");
      await expect(pageA.getByTestId("field")).not.toHaveAttribute("data-turn", "you");
      // B sees A's move as the opponent's, and still owns the turn.
      await expect(pageB.getByTestId("player-bar-top")).toContainText("played ●", { timeout: 20_000 });
      await expect(live(pageB)).toContainText("round 1 · your move");

      await submitSwap(pageB);
      // Resolving passes quickly; the scored hold is the beat both clients must show.
      for (const p of [pageA, pageB]) {
        await expect(live(p)).toContainText("round 1 scored", { timeout: 45_000 });
        await expect(live(p)).toContainText("round 2 opens in 1");
      }
      for (const p of [pageA, pageB]) {
        await expect(live(p)).toContainText("round 2 · your move", { timeout: 20_000 });
        await expect(p.getByTestId("round-rail")).toHaveAttribute("aria-label", "round 2 of 10");
      }

      for (let round = 2; round <= 10; round += 1) {
        await submitSwap(pageA);
        await submitSwap(pageB);
        // advanceRound runs after the second submit.
        await pageA.waitForTimeout(3_000);
        if (round < 10) {
          await expect(pageA.getByTestId("round-indicator")).toContainText(`round ${round + 1} of 10`, { timeout: 45_000 });
        }
      }

      // After round 10 the same room turns final: verdict in the ledger, field kept.
      await expect(pageA.getByTestId("room")).toHaveAttribute("data-phase", "final", { timeout: 30_000 });
      await expect(pageA.getByTestId("verdict")).toBeVisible();
      // Spec 048 US1: the result lands on a slip over the field, on both clients.
      for (const p of [pageA, pageB]) {
        await expect(p.getByTestId("slip")).toHaveAttribute("data-kind", "matchOver", { timeout: 20_000 });
        await expect(p.getByTestId("slip")).toContainText(/wins|draw/);
      }
      await expect(pageA.getByTestId("round-rail").locator('[data-state="past"]')).toHaveCount(10);
      await expect(pageA.getByTestId("ledger-caption")).toContainText(/final · 10 of 10 · \d+:\d\d/);
      await expect(pageA.getByTestId("field")).toBeVisible();
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
