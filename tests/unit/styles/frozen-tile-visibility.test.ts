import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const boardCss = readFileSync(
  resolve(__dirname, "../../../app/styles/board.css"),
  "utf-8",
);

/**
 * Regression guard for the Phase 1b letterpress change.
 *
 * `BoardGrid` sets the frozen-tile tint via an inline React
 * `style={{ backgroundColor: FROZEN_COLORS[owner] }}`. The Phase 1b
 * letterpress treatment on `.board-grid__cell` paints an opaque
 * `linear-gradient(...)` as the cell background, which hides the
 * inline backgroundColor unless `.board-grid__cell--frozen` explicitly
 * clears `background-image`.
 *
 * If this test fails, frozen tiles will render as plain cream paper
 * with no player-colour tint — a silent UX regression.
 */
describe("frozen-tile visibility", () => {
  test(".board-grid__cell--frozen clears background-image so inline tint shows", () => {
    const frozenBlock = boardCss.match(
      /\.board-grid__cell--frozen\s*\{[^}]*\}/s,
    );
    expect(frozenBlock).not.toBeNull();
    expect(frozenBlock?.[0]).toMatch(/background-image:\s*none/);
  });
});
