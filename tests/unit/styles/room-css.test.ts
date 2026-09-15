import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "../../../app/styles/room.css"), "utf-8");
/** Rules only: a comment may name the selector it warns against. */
const rules = css.replace(/\/\*[\s\S]*?\*\//g, "");

/** Design system §6 — geometry never animates; only transform and opacity do. */
describe("room.css motion (design system §6)", () => {
  const keyframes = [...css.matchAll(/@keyframes\s+([a-z-]+)\s*{([\s\S]*?)}\s*}/g)];

  it("declares the room's keyframes", () => {
    const names = keyframes.map((m) => m[1]);
    for (const k of ["field-shake", "band-draw", "count-up", "lane-blink", "lane-search", "letter-land", "pin-fade"]) expect(names).toContain(k);
  });

  it("every keyframe animates only transform and opacity", () => {
    for (const [, name, body] of keyframes) {
      const props = [...body.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]).filter((p) => !/^\d|%|from|to$/.test(p));
      for (const p of props) expect(["transform", "opacity"], `${name} animates ${p}`).toContain(p);
    }
  });

  it("reduced motion zeroes durations and holds the low lane solid", () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation-duration: 0ms !important/);
    expect(css).toMatch(/prefers-reduced-motion: reduce\)[\s\S]*\.player-bar__lane--low \.player-bar__lane-fill[\s\S]*animation: none/);
  });

  it("no radii, shadows or gradients", () => {
    expect(css).not.toMatch(/border-radius:\s+(?!0\b)/);
    expect(css).not.toMatch(/box-shadow:\s+(?!inset 0 0 0 2px var\(--ink\)|none)/);
    expect(css).not.toContain("gradient");
  });
});

/** One declaration block by selector, so an assertion cannot match a neighbour's rule. */
function block(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`(^|\\n)${escaped}\\s*{([^}]*)}`));
  return match?.[2] ?? "";
}

/**
 * Design system §5.1 and spec 045 US2 (FR-006 to FR-009, FR-013). The target is
 * fixture B of the implementation review: paper cells, 1px rules that cross the
 * word bands, a 1.5px ink frame, and type that follows the cell at every size.
 */
describe("room.css field paint (spec 045 US2)", () => {
  const field = block(".field");

  it("paints the field paper, not the rule colour", () => {
    expect(field).toMatch(/background:\s*var\(--paper\)/);
    expect(field).not.toMatch(/background:\s*var\(--rule\)/);
  });

  it("has no grid gap — the rules are cell borders, so they cross the bands", () => {
    expect(field).toMatch(/gap:\s*0\s*;/);
    expect(field).not.toMatch(/gap:\s*1px/);
  });

  it("declares --cell-size from the measured field size, with no fallback anywhere", () => {
    expect(field).toMatch(/--cell-size:\s*calc\(var\(--field-size\)\s*\/\s*10\)/);
    expect(css, "a 48px fallback silently produces the wrong size (finding A2)").not.toContain("--cell-size, 48px");
  });

  it("drops the paper pseudo-element that painted beneath the field", () => {
    expect(css).not.toMatch(/\.field::before\s*{/);
  });

  it("keeps the 1.5px ink frame", () => {
    expect(field).toMatch(/border:\s*1\.5px solid var\(--ink\)/);
  });

  it("draws the rules as cell borders over a transparent cell", () => {
    const cell = block(".field__cell");
    expect(cell).toMatch(/background:\s*transparent/);
    expect(cell).toMatch(/border-right:\s*1px solid var\(--rule\)/);
    expect(cell).toMatch(/border-bottom:\s*1px solid var\(--rule\)/);
  });

  it("suppresses the rules on the outer edge", () => {
    // `.field__row { display: contents }` keeps the grid flat but NOT the DOM:
    // :nth-last-of-type(-n + 10) would match all ten cells of every row and
    // strip every horizontal rule (research §1).
    expect(block(".field__cell:nth-of-type(10n)")).toMatch(/border-right:\s*0/);
    expect(block(".field__row:last-child .field__cell")).toMatch(/border-bottom:\s*0/);
    expect(rules).not.toContain("nth-last-of-type(-n + 10)");
  });

  it("scales the letter and the numeral with the cell, flooring the numeral at 9px", () => {
    expect(block(".field__cell")).toMatch(/font-size:\s*calc\(var\(--cell-size\)\s*\*\s*0\.55\)/);
    expect(block(".field__value")).toMatch(/font-size:\s*max\(9px,\s*calc\(var\(--cell-size\)\s*\*\s*0\.18\)\)/);
  });

  it("hides the numeral below a 32px cell, where 18% is unreadable", () => {
    expect(css).toMatch(/\[data-cell-size="small"\][^{]*\.field__value\s*{[^}]*display:\s*none/);
  });

  it("does not inset the bars, so the seat square aligns with the field frame", () => {
    expect(block(".player-bar")).toMatch(/padding:\s*0\s*;/);
  });
});
