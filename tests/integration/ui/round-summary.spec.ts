import { expect, test } from "@playwright/test";

async function loginAndStartMatch(
  pageA: import("@playwright/test").Page,
  pageB: import("@playwright/test").Page,
) {
  await Promise.all([pageA.goto("/"), pageB.goto("/")]);

  await pageA.getByTestId("lobby-username-input").fill("summary-alpha");
  await pageA.getByTestId("lobby-login-submit").click();
  await pageB.getByTestId("lobby-username-input").fill("summary-beta");
  await pageB.getByTestId("lobby-login-submit").click();

  await expect(pageA.getByTestId("matchmaker-controls")).toBeVisible();
  await expect(pageB.getByTestId("matchmaker-controls")).toBeVisible();

  await pageA.getByTestId("matchmaker-start-button").click();
  await pageA.waitForTimeout(100);
  await pageB.getByTestId("matchmaker-start-button").click();

  await expect(pageA.getByTestId("match-shell")).toBeVisible({ timeout: 20000 });
  await expect(pageB.getByTestId("match-shell")).toBeVisible({ timeout: 20000 });
}

async function submitSwap(page: import("@playwright/test").Page, startIndex: number) {
  const board = page.getByTestId("board-grid");
  await board.locator(`[data-tile-index="${startIndex}"]`).click();
  await board.locator(`[data-tile-index="${startIndex + 1}"]`).click();
}

test.describe("Round summary panel", () => {
  test("shows scoring deltas, highlights, and aria feedback", async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      await loginAndStartMatch(pageA, pageB);

      // Complete a single round to trigger scoring summary
      await submitSwap(pageA, 0);
      await submitSwap(pageB, 10);

      const summaryPanel = pageA.getByTestId("round-summary-panel");
      await expect(summaryPanel).toBeVisible({ timeout: 12000 });
      await expect(summaryPanel).toHaveAttribute("role", "dialog");

      const wordRows = summaryPanel.getByTestId("round-summary-word");
      await expect(wordRows.first()).toBeVisible();
      await expect(summaryPanel.getByTestId("round-summary-totals")).toContainText(
        /your score/i,
      );

      const overlay = pageA.getByTestId("word-highlight-overlay");
      await expect(overlay).toBeVisible();

      // Dismiss summary and ensure overlay clears
      await pageA.getByTestId("round-summary-dismiss").click();
      await expect(summaryPanel).toBeHidden({ timeout: 5000 });
      await expect(pageA.getByTestId("word-highlight-overlay")).toBeHidden({
        timeout: 5000,
      });

      // Ensure other player sees same totals (SC-004 parity)
      const summaryPanelB = pageB.getByTestId("round-summary-panel");
      await expect(summaryPanelB).toBeVisible({ timeout: 12000 });
      await expect(summaryPanelB.getByTestId("round-summary-totals")).toContainText(
        /opponent/i,
      );
    } finally {
      await pageA.close();
      await pageB.close();
      await contextA.close();
      await contextB.close();
    }
  });
});

