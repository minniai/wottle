import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const boardCss = readFileSync(
  resolve(__dirname, "../../../app/styles/board.css"),
  "utf-8",
);

describe(".match-layout Phase 1c structure", () => {
  test("declares .match-layout__hud-strip for top HUD", () => {
    expect(boardCss).toMatch(/\.match-layout__hud-strip\s*\{/);
  });

  test("declares .match-layout__board-row for below the HUD", () => {
    expect(boardCss).toMatch(/\.match-layout__board-row\s*\{/);
  });

  test("declares .match-layout__rail--left and --right", () => {
    expect(boardCss).toMatch(/\.match-layout__rail--left\s*\{/);
    expect(boardCss).toMatch(/\.match-layout__rail--right\s*\{/);
  });

  test("hud-strip uses grid 1fr auto 1fr on desktop", () => {
    const desktopBlock = boardCss.match(
      /@media\s*\(min-width:\s*900px\)\s*\{[\s\S]*?\n\}/,
    );
    expect(desktopBlock).not.toBeNull();
    expect(desktopBlock?.[0]).toMatch(
      /\.match-layout__hud-strip\s*\{[^}]*grid-template-columns:\s*1fr auto 1fr/s,
    );
  });
});
