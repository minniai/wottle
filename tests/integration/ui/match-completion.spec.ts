/**
 * Spec 044 US9 — the result is stated once, in the same room: resign ends the
 * match; the field stays; the ledger shows the verdict; the rematch request is a
 * ledger line on the other side; `lobby` returns to the lobby room.
 */
import { expect, test, type Page } from "@playwright/test";

import { generateTestUsername, loginViaSlip, startMatchWithDirectInvite } from "./helpers/matchmaking";
import { submitSwap } from "./helpers/swaps";

test.describe.configure({ mode: "serial", retries: 1 });

/** The field's letters as one string of 100 characters, row by row. */
async function readField(page: Page): Promise<string> {
  return page.getByTestId("field").evaluate((el) => {
    const letters = new Array(100).fill("?");
    el.querySelectorAll("[data-testid='field-cell']").forEach((cell) => {
      const x = Number(cell.getAttribute("data-x"));
      const y = Number(cell.getAttribute("data-y"));
      letters[y * 10 + x] = cell.querySelector("span")?.textContent ?? "?";
    });
    return letters.join("");
  });
}

/** Every band's word next to the letters the field shows on the cells it covers (spec 049). */
async function readBands(page: Page): Promise<{ word: string; spelled: string }[]> {
  const field = await readField(page);
  const bands = await page.getByTestId("field-band").evaluateAll((els) =>
    els.map((el) => ({ word: el.getAttribute("data-word") ?? "", cells: el.getAttribute("data-cells") ?? "" })),
  );
  return bands.map(({ word, cells }) => ({
    word: word.toLocaleUpperCase("is"),
    spelled: cells
      .split(";")
      .filter(Boolean)
      .map((c) => c.split(",").map(Number))
      .map(([x, y]) => field[y * 10 + x])
      .join(""),
  }));
}

const differences = (a: string, b: string): number => [...a].filter((letter, i) => letter !== b[i]).length;

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

      // Spec 049 US1: one move each is played so the final field has a board
      // that is not the starting one. On 2026-09-20 a finished match was served
      // the starting board, regenerated from the seed, under ten rounds of freezes.
      const startingBoard = await readField(pageA);
      await submitSwap(pageA);
      await submitSwap(pageB);
      for (const p of [pageA, pageB]) {
        await expect(p.getByTestId("scoreboard-row-you").getByTestId("scoreboard-track")).toHaveAttribute("aria-valuenow", "9", { timeout: 45_000 });
        await expect(p.getByTestId("scoreboard-row-opp")).toContainText("1 of 10", { timeout: 20_000 });
      }
      const playedBoard = await readField(pageA);
      const moved = differences(startingBoard, playedBoard);

      // A resigns through the live-row confirmation.
      await pageA.getByTestId("ledger-menu-trigger").click();
      await pageA.getByTestId("ledger-menu-item-resign").click();
      await pageA.getByTestId("slip-confirm-resign").click();

      for (const p of [pageA, pageB]) {
        await expect(p.getByTestId("room")).toHaveAttribute("data-phase", "final", { timeout: 30_000 });
        await expect(p.getByTestId("field")).toBeVisible();
        await expect(p.getByTestId("verdict")).toContainText(/(wins|draw) (\d+–\d+|−?\d+ to −?\d+)/);
        await expect(p.getByTestId("scoreboard-clock")).toContainText(/match over/i);
        await expect(p).toHaveURL(/\/match\/[0-9a-f-]+$/);
        // Spec 048 US1: the result is the one dialog in the room — the slip over the field.
        await expect(p.getByTestId("slip")).toHaveAttribute("data-kind", "matchOver", { timeout: 15_000 });
        await expect(p.getByTestId("slip")).toContainText(/wins|draw/);
        // Spec 071 (FR-001, FR-004, FR-008): the game raised it, so its headline has focus;
        // the detail says once why it ended; the tab names the winner.
        await expect(p.getByTestId("slip").getByRole("heading")).toBeFocused();
        await expect(p.getByTestId("slip-detail")).toHaveText(/resigned · \d:\d\d/i);
        await expect(p).toHaveTitle(/ wins · Wottle$/);
        // The final field is the played board, not the starting one, and every
        // settled band spells its word on it (spec 049 FR-001/FR-003).
        const finalBoard = await readField(p);
        expect(finalBoard).toBe(playedBoard);
        expect(differences(startingBoard, finalBoard)).toBe(moved);
        for (const band of await readBands(p)) expect(band.spelled).toBe(band.word);
      }
      // Every match is rated (spec 048 US6): an invite-created match writes rating rows too.
      await expect(pageB.getByTestId("scoreboard-row-you").getByTestId("scoreboard-subline")).toContainText(/\d+ → \d+ · [+−]\d+/, { timeout: 15_000 });

      // Spec 071 (FR-002): every action on the slip ignores activation for its first 500ms.
      await pageA.waitForTimeout(600);
      await pageB.waitForTimeout(600);
      // Esc lifts the slip (FR-006); result ▸ in the foot brings it back.
      await pageA.keyboard.press("Escape");
      await expect(pageA.getByTestId("slip")).toHaveCount(0);
      await pageA.getByTestId("ledger-result").click();
      await expect(pageA.getByTestId("slip")).toBeVisible();
      await pageA.waitForTimeout(600);
      // review the match ▸ opens review (spec 071); ◂ result brings the slip back.
      await pageA.getByTestId("slip-review-field").click();
      await expect(pageA.getByTestId("slip")).toHaveCount(0);
      await expect(pageA).toHaveURL(/\?review=\d+$/);
      await pageA.getByTestId("review-result").click();
      await expect(pageA.getByTestId("slip")).toBeVisible();
      await pageA.waitForTimeout(600);

      // Rematch: B asks on the slip, A's slip rewrites its action line and A declines; then A returns to the lobby.
      await pageB.getByTestId("slip-rematch").click();
      await expect(pageA.getByTestId("slip-accept-rematch")).toBeVisible({ timeout: 15_000 });
      await expect(pageA.getByTestId("slip")).toContainText("asks for a rematch");
      await pageA.waitForTimeout(600);
      await pageA.getByTestId("slip-decline-rematch").click();
      // Spec 071: the sender reads it on the slip's first row.
      await expect(pageB.getByTestId("slip-rematch-line")).toHaveText(/declined/, { timeout: 15_000 });

      await pageA.waitForTimeout(600);
      await pageA.getByTestId("slip-lobby").click();
      // Spec 070: the lobby is a page at the language's root, not a state of the room.
      await expect(pageA).toHaveURL(/\/en\/?$/, { timeout: 15_000 });
      await expect(pageA.getByTestId("lobby-find")).toBeVisible();
      // Reported 2026-09-21: the match-over slip stayed up over the lobby.
      await expect(pageA.getByTestId("slip")).toHaveCount(0);

      // Spec 071 (FR-007): the live guard is gone, so one Back from the result reaches the lobby.
      await pageB.goBack();
      await expect(pageB).toHaveURL(/\/en\/?$/, { timeout: 15_000 });
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
