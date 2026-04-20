import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const boardCss = readFileSync(
  resolve(__dirname, "../../../app/styles/board.css"),
  "utf-8",
);

describe(".board-grid__cell letterpress treatment", () => {
  test("uses a linear-gradient background (not radial) on the base cell", () => {
    const match = boardCss.match(
      /\.board-grid__cell\s*\{[^}]*?background:\s*linear-gradient\(/s,
    );
    expect(match).not.toBeNull();
  });

  test("declares the letterpress top-highlight inset shadow using #fff", () => {
    expect(boardCss).toMatch(
      /inset 0 1px 0 color-mix\(in oklab, #fff 80%, transparent\)/,
    );
  });

  test("declares the letterpress bottom-shadow inset using var(--ink)", () => {
    expect(boardCss).toMatch(
      /inset 0 -1px 0 color-mix\(in oklab, var\(--ink\) 10%, transparent\)/,
    );
  });
});
