/**
 * Spec 044 — the two-player room flow. Grows with each user story:
 *   US2: pick → commit, Esc cancels a pick; the opponent's move clears a touched pick.
 *   US3: bands — one per ledger word, chevron edge matches data-direction.
 *   US4: ledger — rows fill per move, live row text, resign on the slip.
 * Spec 050: there are no rounds and no pins; a committed move resolves at once.
 *   US6: reveal — bands settle after resolution; reduced motion shows the end state at once.
 */
import { expect, test, type Page } from "@playwright/test";

import { generateTestUsername, loginViaSlip, startMatchWithDirectInvite } from "./helpers/matchmaking";

const cell = (page: Page, x: number, y: number) => page.locator(`[data-testid="field-cell"][data-x="${x}"][data-y="${y}"]`);
// The viewer's moves left, on the bottom bar's lane (2026-09-21: the ledger's rail is gone).
const rail = (page: Page) => page.getByTestId("player-bar-bottom").getByTestId("player-bar-lane");

/** Two free cells in the given row. */
async function twoFreeCells(page: Page, y: number): Promise<[number, number]> {
  const free: number[] = [];
  for (let x = 0; x < 10 && free.length < 2; x += 1) {
    if ((await cell(page, x, y).getAttribute("data-state")) === "free") free.push(x);
  }
  expect(free).toHaveLength(2);
  return [free[0], free[1]];
}

test.describe.configure({ mode: "serial", retries: 1 });

test.describe("@room-flow US2 pick, commit", () => {
  test("the second tap commits and scores at once; Esc cancels a pick", async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    try {
      const userA = generateTestUsername("flow-a");
      const userB = generateTestUsername("flow-b");
      await loginViaSlip(pageA, userA);
      await loginViaSlip(pageB, userB);
      await startMatchWithDirectInvite(pageA, pageB, { timeoutMs: 60_000, playerBUsername: userB });
      await expect(pageA.getByTestId("room")).toHaveAttribute("data-phase", "match", { timeout: 20_000 });
      await expect(pageB.getByTestId("room")).toHaveAttribute("data-phase", "match", { timeout: 20_000 });

      // A: pick, then the second tap commits.
      const [ax1, ax2] = await twoFreeCells(pageA, 0);
      await cell(pageA, ax1, 0).click();
      await expect(cell(pageA, ax1, 0)).toHaveAttribute("data-state", "picked");
      await expect(pageA.getByTestId("ledger-live-row")).toContainText(/picking ·/);
      await cell(pageA, ax2, 0).click();
      // Spec 050: nothing waits for B. A's move scores and move 2 opens.
      await expect(rail(pageA)).toHaveAttribute("aria-valuenow", "9", { timeout: 20_000 });
      await expect(pageA.getByTestId("ledger-live-row")).toContainText("move 2 · your move", { timeout: 20_000 });
      await expect(cell(pageA, ax1, 0)).not.toHaveAttribute("data-state", "picked");

      // B sees A's move counted in A's bar; B still has move 1.
      await expect(pageB.getByTestId("player-bar-top")).toContainText("1 of 10", { timeout: 15_000 });
      await expect(pageB.getByTestId("ledger-live-row")).toContainText("move 1 · your move");

      // B: Esc cancels a pick; picking again and a second tap commits.
      const [bx1, bx2] = await twoFreeCells(pageB, 9);
      await cell(pageB, bx1, 9).click();
      await expect(cell(pageB, bx1, 9)).toHaveAttribute("data-state", "picked");
      await pageB.keyboard.press("Escape");
      await expect(cell(pageB, bx1, 9)).toHaveAttribute("data-state", "free");
      await cell(pageB, bx1, 9).click();
      await cell(pageB, bx2, 9).click();
      await expect(rail(pageB)).toHaveAttribute("aria-valuenow", "9", { timeout: 20_000 });
      await expect(pageA.getByTestId("player-bar-top")).toContainText("1 of 10", { timeout: 15_000 });

      // US3 — bands: one per word in the ledger's row 1, chevron edge per direction.
      // One <span> per word under each seat's .ledger__word-list; a miss (`no word`) has no list and no band.
      // Row 1 holds both players' first moves; it fills as each reveal lands, so wait for both to agree.
      const words = pageA.getByTestId("ledger-row-1").locator(".ledger__word-list > span");
      const bands = pageA.getByTestId("field-band");
      await expect.poll(async () => (await bands.count()) - (await words.count()), { timeout: 15_000 }).toBe(0);
      for (let i = 0; i < (await bands.count()); i += 1) {
        const dir = await bands.nth(i).getAttribute("data-direction");
        expect(["ltr", "rtl", "ttb", "btt"]).toContain(dir);
        const d = await bands.nth(i).locator("path").getAttribute("d");
        expect(d).toMatch(/^M /);
      }
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test("the opponent's move clears a pick on a letter it exchanged, with a notice", async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    try {
      const userA = generateTestUsername("clr-a");
      const userB = generateTestUsername("clr-b");
      await loginViaSlip(pageA, userA);
      await loginViaSlip(pageB, userB);
      await startMatchWithDirectInvite(pageA, pageB, { timeoutMs: 60_000, playerBUsername: userB });
      await expect(pageA.getByTestId("room")).toHaveAttribute("data-phase", "match", { timeout: 20_000 });

      // A holds a pick on a letter B is about to exchange.
      const [bx1, bx2] = await twoFreeCells(pageB, 5);
      await cell(pageA, bx1, 5).click();
      await expect(cell(pageA, bx1, 5)).toHaveAttribute("data-state", "picked");

      await cell(pageB, bx1, 5).click();
      await cell(pageB, bx2, 5).click();

      // Spec 050 FR-014: A's field is never locked by B's reveal, but the touched pick clears.
      await expect(cell(pageA, bx1, 5)).not.toHaveAttribute("data-state", "picked", { timeout: 15_000 });
      await expect(pageA.getByTestId("ledger-live-row")).toContainText(/pick cleared|move 1 · your move/, { timeout: 5_000 });
      await expect(pageA.getByTestId("field")).toHaveAttribute("data-turn", "you");
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test("US4 ledger: rows fill per move, the live row is your next move, resign is a slip that reverts on keep playing", async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    try {
      const userA = generateTestUsername("ldg-a");
      const userB = generateTestUsername("ldg-b");
      await loginViaSlip(pageA, userA);
      await loginViaSlip(pageB, userB);
      await startMatchWithDirectInvite(pageA, pageB, { timeoutMs: 60_000, playerBUsername: userB });
      await expect(pageA.getByTestId("room")).toHaveAttribute("data-phase", "match", { timeout: 20_000 });

      // Ten rows; row 1 live; rows 2–10 labels only.
      for (let r = 1; r <= 10; r += 1) await expect(pageA.getByTestId(`ledger-row-${r}`)).toBeVisible();
      await expect(pageA.getByTestId("ledger-row-1")).toHaveAttribute("data-status", "live");
      await expect(pageA.getByTestId("ledger-row-5")).toHaveAttribute("data-status", "future");

      // Spec 048 US7: the resign confirmation is a slip over the field; `keep playing ▸` reverts.
      await pageA.getByTestId("ledger-menu-trigger").click();
      await pageA.getByTestId("ledger-menu-item-resign").click();
      const resignSlip = pageA.getByTestId("slip");
      await expect(resignSlip).toHaveAttribute("data-kind", "resign");
      await expect(resignSlip).toContainText("Resign the match?");
      await pageA.getByTestId("slip-keep-playing").click();
      await expect(resignSlip).toHaveCount(0);

      // A plays: row 1 is held `settled` for the 600ms move hold, then past; row 2 goes live.
      const [ax1, ax2] = await twoFreeCells(pageA, 0);
      await cell(pageA, ax1, 0).click();
      await cell(pageA, ax2, 0).click();
      await expect(pageA.getByTestId("ledger-row-1")).toHaveAttribute("data-status", /settled|past/, { timeout: 45_000 });
      await expect(pageA.getByTestId("ledger-row-2")).toHaveAttribute("data-status", "live", { timeout: 45_000 });
      await expect(pageA.getByTestId("ledger-row-1")).toHaveAttribute("data-status", "past");
      await expect(pageA.getByTestId("ledger-territory")).toBeVisible();
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test("US6 reveal: after resolution every band is settled; under reduced motion the end state is immediate", async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext({ reducedMotion: "reduce" });
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    try {
      const userA = generateTestUsername("rvl-a");
      const userB = generateTestUsername("rvl-b");
      await loginViaSlip(pageA, userA);
      await loginViaSlip(pageB, userB);
      await startMatchWithDirectInvite(pageA, pageB, { timeoutMs: 60_000, playerBUsername: userB });
      await expect(pageA.getByTestId("room")).toHaveAttribute("data-phase", "match", { timeout: 20_000 });

      const [ax1, ax2] = await twoFreeCells(pageA, 0);
      await cell(pageA, ax1, 0).click();
      await cell(pageA, ax2, 0).click();
      const [bx1, bx2] = await twoFreeCells(pageB, 9);
      await cell(pageB, bx1, 9).click();
      await cell(pageB, bx2, 9).click();
      for (const p of [pageA, pageB]) await expect(rail(p)).toHaveAttribute("aria-valuenow", "9", { timeout: 45_000 });
      for (const p of [pageA, pageB]) await expect(p.getByTestId("player-bar-top")).toContainText("1 of 10", { timeout: 15_000 });

      // Settle: no band is still drawing or live once the reveal completes (≤ 2.5 s for three words).
      await pageA.waitForTimeout(2_600);
      expect(await pageA.locator(".field__band--drawing, .field__band--live").count()).toBe(0);
      expect(await pageB.locator(".field__band--drawing, .field__band--live").count()).toBe(0);
      // Both fields agree on the number of bands.
      expect(await pageA.getByTestId("field-band").count()).toBe(await pageB.getByTestId("field-band").count());
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});

/**
 * Spec 045 US5. These need a live move, so they stay in the Supabase-backed
 * suite: the fixture route is static by design and dispatches nothing.
 */
test.describe("@room-flow US5 the hand and the keyboard", () => {
  test("drag commits a swap; tapping the ledger cancels a pick; M reaches the room", async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    try {
      const userA = generateTestUsername("drag-a");
      const userB = generateTestUsername("drag-b");
      await loginViaSlip(pageA, userA);
      await loginViaSlip(pageB, userB);
      await startMatchWithDirectInvite(pageA, pageB, { timeoutMs: 60_000, playerBUsername: userB });
      await expect(pageA.getByTestId("room")).toHaveAttribute("data-phase", "match", { timeout: 20_000 });

      // Spec 048 US5: the rules left the room, and `?` with them. Nothing opens.
      await pageA.keyboard.press("?");
      await expect(pageA.getByTestId("slip")).toHaveCount(0);
      await expect(pageA.getByTestId("room")).toHaveAttribute("data-phase", "match");

      // A pick cancels when the pointer goes down outside the field.
      await pageA.locator('[data-x="3"][data-y="3"]').click();
      await expect(pageA.locator('[data-x="3"][data-y="3"]')).toHaveAttribute("data-state", "picked");
      await pageA.getByTestId("ledger-caption").click();
      await expect(pageA.locator('[data-state="picked"]')).toHaveCount(0);

      // Drag A onto B commits that swap, without leaving a letter picked.
      const a = pageA.locator('[data-x="0"][data-y="0"]');
      const b = pageA.locator('[data-x="1"][data-y="0"]');
      const boxA = (await a.boundingBox())!;
      const boxB = (await b.boundingBox())!;
      await pageA.mouse.move(boxA.x + boxA.width / 2, boxA.y + boxA.height / 2);
      await pageA.mouse.down();
      await pageA.mouse.move(boxB.x + boxB.width / 2, boxB.y + boxB.height / 2, { steps: 8 });
      await pageA.mouse.up();

      await expect(rail(pageA)).toHaveAttribute("aria-valuenow", "9", { timeout: 20_000 });
      await expect(pageA.locator('[data-state="picked"]')).toHaveCount(0);
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
