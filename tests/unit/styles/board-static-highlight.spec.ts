import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Regression for issue #208 follow-up: hovering a round/word in the post-game
 * Round History panel must NOT change the board's footprint. Any non-`inset`
 * box-shadow with a positive spread paints OUTSIDE the tile and made the
 * board appear to expand under the cursor, shifting the page below it.
 *
 * The static-highlight rule is allowed to change `background`, `border-color`,
 * `border-width` (border-box keeps the outer dimensions stable), and `inset`
 * box-shadows. Outer-spread shadows are forbidden.
 */
function extractStaticHighlightRule(css: string): string {
  const start = css.indexOf(
    ".board-grid__cell--scored.board-grid__cell--scored-static",
  );
  if (start === -1) {
    throw new Error("static highlight rule not found in board.css");
  }
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  return css.slice(open + 1, close);
}

function extractBoxShadow(rule: string): string | null {
  const match = rule.match(/box-shadow\s*:\s*([^;]+);/);
  return match ? match[1].trim() : null;
}

/**
 * Split a `box-shadow` value on commas that aren't inside parentheses
 * (color-mix(), oklch(), etc. contain commas).
 */
function splitShadowLayers(value: string): string[] {
  const layers: string[] = [];
  let depth = 0;
  let buffer = "";
  for (const ch of value) {
    if (ch === "(") depth += 1;
    else if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) {
      layers.push(buffer.trim());
      buffer = "";
    } else {
      buffer += ch;
    }
  }
  if (buffer.trim()) layers.push(buffer.trim());
  return layers;
}

describe("board.css — static highlight rule", () => {
  const css = readFileSync(
    resolve(__dirname, "../../../app/styles/board.css"),
    "utf-8",
  );
  const rule = extractStaticHighlightRule(css);

  it("box-shadow does not contain any outer (non-inset) layer", () => {
    const value = extractBoxShadow(rule);
    expect(value, "expected the static rule to declare box-shadow").not.toBeNull();
    const layers = splitShadowLayers(value!);
    for (const layer of layers) {
      expect(
        layer.startsWith("inset"),
        `outer-spread shadow paints outside the tile and shifts the board: "${layer}"`,
      ).toBe(true);
    }
  });
});
