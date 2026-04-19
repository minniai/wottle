import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const boardCss = readFileSync(
  resolve(__dirname, "../../../app/styles/board.css"),
  "utf-8",
);

const DECLARED_TOKENS = new Set([
  "--paper",
  "--paper-2",
  "--paper-3",
  "--ink",
  "--ink-2",
  "--ink-3",
  "--ink-soft",
  "--ochre",
  "--ochre-deep",
  "--ochre-tint",
  "--p1",
  "--p1-tint",
  "--p1-deep",
  "--p2",
  "--p2-tint",
  "--p2-deep",
  "--good",
  "--warn",
  "--bad",
  "--hair",
  "--hair-strong",
  "--shadow-sm",
  "--shadow-md",
  "--shadow-lg",
  "--font-inter",
  "--font-fraunces",
  "--font-jetbrains-mono",
  "--font-sans",
]);

describe("board.css theme-flip audit", () => {
  test("no hard-coded navy or slate hex values", () => {
    const navyHex = boardCss.match(
      /#(0[Bb]1220|0[aA]1220|07101[Bb]|1[Ee]293[Bb]|0[Ff]172[Aa])/g,
    );
    expect(navyHex).toBeNull();
  });

  test("no cream-on-dark rgba usage", () => {
    const creamRgba = boardCss.match(/rgba\(242,\s*234,\s*211/g);
    expect(creamRgba).toBeNull();
  });

  test("references var(--paper) or var(--ink) at least once", () => {
    expect(boardCss).toMatch(/var\(--(paper|ink)/);
  });

  test("every var(--X) reference resolves to a declared token", () => {
    // Allowlist for local scope variables (computed per-rule, not declared in globals.css)
    const LOCAL_SCOPE_VARS = new Set([
      "--board-grid-font-size",
      "--board-grid-gap",
      "--board-max-h",
      "--board-size",
      "--chrome-height",
      "--highlight-color",
    ]);

    const refs = Array.from(boardCss.matchAll(/var\((--[a-zA-Z0-9-]+)\)/g));
    const undeclared = refs
      .map((m) => m[1])
      .filter(
        (name) =>
          !DECLARED_TOKENS.has(name) && !LOCAL_SCOPE_VARS.has(name),
      );
    const unique = Array.from(new Set(undeclared)).sort();
    expect(unique, `Undeclared tokens: ${unique.join(", ")}`).toEqual([]);
  });
});
