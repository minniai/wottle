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
    expect(css).not.toContain("gradient");
  });

  /**
   * Design system §2: shadows are banned, but `box-shadow: inset` with no blur
   * is how the system draws lines that must not affect layout — the picked
   * letter's 2px ring and the live row's 3px rule.
   */
  it("every box-shadow is an unblurred inset line in a token colour", () => {
    const shadows = [...css.matchAll(/box-shadow:\s*([^;]+);/g)].map((m) => m[1].trim());
    expect(shadows.length).toBeGreaterThan(0);
    for (const shadow of shadows) {
      if (shadow === "none") continue;
      expect(shadow, `${shadow} is not inset`).toMatch(/^inset /);
      const lengths = shadow.match(/-?\d+(\.\d+)?px/g) ?? [];
      expect(lengths.length, `${shadow} must be offset-x, offset-y, blur, spread`).toBeLessThanOrEqual(4);
      const blur = lengths[2];
      if (blur) expect(blur, `${shadow} is blurred`).toBe("0px");
      expect(shadow, `${shadow} must use a token`).toMatch(/var\(--[a-z-]+\)/);
    }
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

  it("owns its pointer gestures, so a drag does not pan the page", () => {
    expect(field).toMatch(/touch-action:\s*none/);
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

/**
 * Design system §4 and spec 045 US3 (FR-014). The field and the ledger are one
 * composition separated by one gutter; centring the stack inside its own column
 * put the slack between them instead, so the gutter grew with the window.
 */
describe("room.css composition (spec 045 US3)", () => {
  const room = block(".room");

  it("sizes the first column to the field and centres the pair", () => {
    expect(room).toMatch(/grid-template-columns:\s*auto var\(--ledger-width\)/);
    expect(room).toMatch(/justify-content:\s*center/);
  });

  it("does not centre the stack inside its own column", () => {
    expect(block(".room__stack")).not.toMatch(/margin:\s*0 auto/);
  });

  it("keeps one column below 900px", () => {
    const phone = css.slice(css.indexOf("@media (max-width: 900px)"));
    expect(phone).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\)/);
  });
});

/**
 * Spec 047 US2 (FR-007, review S1, amendment P3). The ledger is the height of
 * the stack — bars, gaps and field — never of the viewport. `align-self:
 * stretch` filled the grid row (100dvh) so the foot landed ~330px under the
 * bottom bar whenever the 720px field cap or the width bound the stack.
 */
describe("room.css ledger height (spec 047 US2)", () => {
  const ledger = block(".room__ledger");

  it("binds the ledger to the stack's height at ≥900px", () => {
    expect(ledger).toMatch(/align-self:\s*start/);
    expect(ledger).toMatch(
      /height:\s*calc\(var\(--field-size\) \+ 2 \* var\(--bar-height\) \+ 2 \* var\(--bar-gap\)\)/,
    );
  });

  it("is never stretched", () => {
    expect(ledger).not.toMatch(/align-self:\s*stretch/);
    expect(ledger).not.toMatch(/min-height/);
  });

  it("lets the phone ledger take its own height", () => {
    const phone = css.slice(css.indexOf("@media (max-width: 900px)"));
    const phoneLedger = phone.slice(phone.indexOf(".room__ledger"), phone.indexOf("}", phone.indexOf(".room__ledger")));
    expect(phoneLedger).toMatch(/height:\s*auto/);
  });
});

/**
 * Spec 047 US3 (FR-008, review S3, S6, amendment P1). One grid item per round:
 * the row owns its rule, so it is one continuous line instead of three dashes
 * across the column gaps; the label clears the live row's 3px rule; the hint
 * line disappears when it has nothing to say.
 */
describe("room.css ledger rows (spec 047 US3)", () => {
  it("the rows container stacks rows without columns or gaps of its own", () => {
    const rows = block(".ledger__rows");
    expect(rows).toMatch(/display:\s*grid/);
    expect(rows).toMatch(/grid-auto-rows:\s*minmax\(0, 1fr\)/);
    expect(rows).not.toMatch(/grid-template-columns/);
    expect(rows).not.toMatch(/column-gap/);
  });

  it("the row is the grid item and owns the rule", () => {
    const row = block(".ledger__row");
    expect(row).toMatch(/display:\s*grid/);
    expect(row).toMatch(/grid-template-columns:\s*34px 1fr 1fr/);
    expect(row).toMatch(/column-gap:\s*8px/);
    expect(row).toMatch(/grid-column:\s*1 \/ -1/);
    expect(row).toMatch(/border-bottom:\s*1px solid var\(--rule\)/);
    expect(block(".ledger__row > *")).not.toMatch(/border/);
  });

  it("the live row is tinted with the 3px rule at its left edge", () => {
    const live = block(".ledger__row--live");
    expect(live).toMatch(/background:\s*var\(--tint\)/);
    expect(live).toMatch(/box-shadow:\s*inset 3px 0 0 var\(--ink\)/);
  });

  it("round labels clear the live rule", () => {
    expect(block(".ledger__round")).toMatch(/padding-left:\s*6px/);
  });

  it("the seat header rule is ink (Fig. 2); the hint collapses when empty", () => {
    expect(block(".ledger__header")).toMatch(/border-bottom:\s*1px solid var\(--ink\)/);
    expect(block(".ledger__hint:empty")).toMatch(/display:\s*none/);
  });

  it("the second live line is muted and on its own line", () => {
    const line2 = block(".ledger__live-line2");
    expect(line2).toMatch(/display:\s*block/);
    expect(line2).toMatch(/color:\s*var\(--muted\)/);
  });
});

/**
 * Spec 045 US4 (FR-019). "Nothing is ever positioned over the field" is the
 * design's central rule; the sheet as written was a fixed panel at z-index 3
 * pinned to the bottom of the viewport, which would have covered the field and
 * the bottom bar the moment it was wired up.
 */
describe("room.css phone ledger sheet (spec 045 US4)", () => {
  const sheet = block(".ledger-sheet");

  it("sits in flow and scrolls within itself", () => {
    expect(sheet).toMatch(/flex:\s*1/);
    expect(sheet).toMatch(/min-height:\s*0/);
    expect(sheet).toMatch(/overflow-y:\s*auto/);
  });

  it("is never positioned over the room", () => {
    expect(sheet).not.toMatch(/position:\s*(fixed|absolute)/);
    expect(sheet).not.toMatch(/z-index/);
    expect(sheet).not.toMatch(/max-height:\s*\d+dvh/);
  });

  it("reserves no scrollbar gutter on a phone, where the room cannot scroll", () => {
    // 15px of reserved gutter took the cell to 34px on a classic-scrollbar
    // platform, under the floor FR-021 states (CI, 2026-09-16).
    const phone = css.slice(css.indexOf("@media (max-width: 900px)"));
    expect(phone).toMatch(/scrollbar-gutter:\s*auto/);
  });

  it("gives the phone ledger a column that can shrink, so the sheet can scroll", () => {
    const phone = css.slice(css.indexOf("@media (max-width: 900px)"));
    const ledger = phone.slice(phone.indexOf(".room__ledger"), phone.indexOf("}", phone.indexOf(".room__ledger")));
    expect(ledger).toMatch(/display:\s*flex/);
    expect(ledger).toMatch(/flex-direction:\s*column/);
    expect(ledger).toMatch(/min-height:\s*0/);
  });
});

/**
 * Design system §6 and spec 045 US5 (FR-027 to FR-030). Motion is a state
 * change: letters travel to each other's places, a released pin fades, a found
 * opponent's name is written in. All of it 0ms under reduced motion.
 */
describe("room.css motion, spec 045 US5", () => {
  it("exchanges two letters over 150ms by translating them", () => {
    expect(css).toMatch(/@keyframes letter-exchange\s*{[\s\S]*?translate\(var\(--dx\), var\(--dy\)\)/);
    const exchange = block(".field__cell--exchange > span:first-child");
    expect(exchange).toMatch(/letter-exchange 150ms/);
    expect(exchange).toMatch(/cubic-bezier\(0\.2, 0, 0\.2, 1\)/);
  });

  it("fades a released pin over 200ms with the keyframe that was declared and never used", () => {
    expect(block(".field__cell--unpinned")).toMatch(/pin-fade 200ms/);
  });

  it("writes a found opponent's name in over 200ms", () => {
    expect(block(".player-bar__name--writing")).toMatch(/200ms/);
  });

  it("all three are instant under reduced motion", () => {
    const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    // The blanket rule covers every animation inside .room.
    expect(reduced).toMatch(/\.room \*[\s\S]*animation-duration: 0ms !important/);
  });
});
