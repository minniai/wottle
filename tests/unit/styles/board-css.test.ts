import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const boardCss = readFileSync(
  resolve(__dirname, "../../../app/styles/board.css"),
  "utf-8",
);

describe("board.css theme-flip audit", () => {
  test("no hard-coded dark navy rgba(15, 23, 42, X) values", () => {
    const darkNavyRgba = boardCss.match(/rgba\(15,\s*23,\s*42/g);
    expect(darkNavyRgba).toBeNull();
  });

  test("no hard-coded cream/light rgba(248, 250, 252, X) values", () => {
    const creamRgba = boardCss.match(/rgba\(248,\s*250,\s*252/g);
    expect(creamRgba).toBeNull();
  });

  test("no hard-coded slate rgba(148, 163, 184, X) values", () => {
    const slateRgba = boardCss.match(/rgba\(148,\s*163,\s*184/g);
    expect(slateRgba).toBeNull();
  });

  test("no hard-coded pure white #fff or #ffffff", () => {
    const whiteHex = boardCss.match(/#(?:fff|ffffff)/gi);
    expect(whiteHex).toBeNull();
  });

  test("no hard-coded amber #ca8a04", () => {
    const amberHex = boardCss.match(/#ca8a04/i);
    expect(amberHex).toBeNull();
  });

  test("references var(--paper), var(--ink), or color-mix at least once", () => {
    const hasTokens =
      /var\(--(paper|ink)/.test(boardCss) ||
      /color-mix\(/.test(boardCss);
    expect(hasTokens).toBe(true);
  });
});
