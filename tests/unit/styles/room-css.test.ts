import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postcss from "postcss";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "../../../app/styles/room.css"), "utf-8");
/** Rules only: a comment may name the selector it warns against. */
const rules = css.replace(/\/\*[\s\S]*?\*\//g, "");

describe("room.css parses", () => {
  it("is valid CSS: a stray brace breaks the whole room, and the greps below would not notice", () => {
    expect(() => postcss.parse(css)).not.toThrow();
  });
});

/** Design system §6 — geometry never animates; only transform and opacity do. */
describe("room.css motion (design system §6)", () => {
  const keyframes = [...css.matchAll(/@keyframes\s+([a-z-]+)\s*{([\s\S]*?)}\s*}/g)];

  it("declares the room's keyframes", () => {
    const names = keyframes.map((m) => m[1]);
    for (const k of ["field-shake", "band-draw", "count-up", "lane-blink", "lane-search", "letter-land"]) expect(names).toContain(k);
    // Spec 050: nothing is pinned, so the pin fade is gone.
    expect(names).not.toContain("pin-fade");
  });

  it("every keyframe animates only transform and opacity", () => {
    for (const [, name, body] of keyframes) {
      const props = [...body.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]).filter((p) => !/^\d|%|from|to$/.test(p));
      for (const p of props) expect(["transform", "opacity"], `${name} animates ${p}`).toContain(p);
    }
  });

  it("reduced motion zeroes durations; no clock flashes anywhere (spec 068)", () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation-duration: 0ms !important/);
    // Spec 068 FR-006: the ledger clock and its inverted flash are gone; urgency is weight only.
    expect(rules).not.toMatch(/clock-flash|\.ledger__clock/);
    expect(css).not.toMatch(/player-bar__lane--low/);
  });

  it("the live row is one band: the beat spans it, the opponent's total on line 1 at the right", () => {
    expect(css).toMatch(/\.ledger__row--live \.ledger__live-text,\s*\.ledger__row--settled \.ledger__live-text\s*\{[^}]*grid-column:\s*1 \/ -1/);
    expect(css).toMatch(/\.ledger__live-text \+ \.ledger__words\s*\{[^}]*grid-column:\s*3;[^}]*grid-row:\s*1/);
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
    // Under a scoreboard the room passes its whole-pixel cell (spec 068); otherwise a tenth of the field.
    expect(field).toMatch(/--cell-size:\s*var\(--room-cell,\s*calc\(var\(--field-size\)\s*\/\s*10\)\)/);
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

  it("keeps the frame above edge-cell hover paint", () => {
    const frame = block(".field::after");
    expect(frame).toMatch(/border:\s*1\.5px solid var\(--ink\)/);
    expect(frame).toMatch(/pointer-events:\s*none/);
    expect(frame).toMatch(/z-index:\s*1/);
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
 * Spec 047 US4 (FR-010, review S7, amendment P4). A letter in both seats' words
 * is ink 700; its numeral is ink too, never the last record's seat colour. The
 * opponent's scored numerals keep the text variant (spec 045 decision 2).
 */
describe("room.css scored numerals (spec 047 US4, spec 049 US2)", () => {
  it("has no shared rule: a scored letter has one owner and one colour", () => {
    expect(rules).not.toMatch(/data-state="shared"/);
  });

  it("the opponent's scored numerals use the text variant of coral", () => {
    const scored = css.slice(css.indexOf('.field__cell[data-seat="opp"][data-state="frozen"] .field__value'));
    expect(scored.slice(0, scored.indexOf("}"))).toMatch(/color:\s*var\(--opp-text\)/);
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
    // Spec 050: a row never gets less than its content, so a tall live row
    // cannot push the territory out of the stack; the rest share the height.
    expect(rows).toMatch(/grid-auto-rows:\s*minmax\(min-content, 1fr\)/);
    expect(rows).toMatch(/min-height:\s*0/);
    expect(rows).not.toMatch(/grid-template-columns/);
    expect(rows).not.toMatch(/column-gap/);
  });

  it("the row is the grid item and owns the rule", () => {
    const row = block(".ledger__row");
    expect(row).toMatch(/display:\s*grid/);
    // The spine (2026-09-21): your cell, the move number, theirs.
    expect(row).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\) 40px minmax\(0, 1fr\)/);
    expect(row).toMatch(/column-gap:\s*0/);
    expect(row).toMatch(/grid-column:\s*1 \/ -1/);
    expect(row).toMatch(/border-bottom:\s*1px solid var\(--rule\)/);
    expect(block(".ledger__row > *")).not.toMatch(/border/);
  });

  it("the live row is tinted with the 3px rule at its left edge", () => {
    const live = block(".ledger__row--live");
    expect(live).toMatch(/background:\s*var\(--tint\)/);
    expect(live).toMatch(/box-shadow:\s*inset 3px 0 0 var\(--ink\)/);
  });

  it("the spine: the move number centred between two 1px rules", () => {
    const spine = block(".ledger__move");
    expect(spine).toMatch(/text-align:\s*center/);
    expect(spine).toMatch(/border-left:\s*1px solid var\(--rule\)/);
    expect(spine).toMatch(/border-right:\s*1px solid var\(--rule\)/);
    expect(block('.ledger__words[data-seat="you"]')).toMatch(/justify-content:\s*flex-end/);
    expect(block('.ledger__words[data-seat="you"]')).toMatch(/text-align:\s*right/);
    expect(block('.ledger__words[data-seat="opp"]')).toMatch(/justify-content:\s*flex-start/);
  });

  it("a miss is words in muted mono and a crimson −5 as bold as a score; nothing lost stays muted (spec 068)", () => {
    expect(block(".ledger__miss")).toMatch(/color:\s*var\(--muted\)/);
    expect(block(".ledger__miss")).toMatch(/text-transform:\s*uppercase/);
    expect(block(".ledger__total")).toMatch(/font-weight:\s*600/);
    expect(block(".points-lost")).toMatch(/color:\s*var\(--err\)/);
    expect(block(".points-none")).toMatch(/color:\s*var\(--muted\)/);
    expect(block(".points-lost")).not.toMatch(/font-weight/);
  });

  it("the total row closes the table in the seat colours", () => {
    expect(block(".ledger__totals")).toMatch(/border-bottom:\s*1\.5px solid var\(--ink\)/);
    expect(block(".ledger__totals-you")).toMatch(/color:\s*var\(--you\)/);
    expect(block(".ledger__totals-opp")).toMatch(/color:\s*var\(--opp\)/);
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

  // A tap is hit-tested at pointerup; a travelling letter must not answer for
  // the cell it is passing over.
  it("a letter never takes the pointer from its cell", () => {
    expect(block(".field__cell > span")).toMatch(/pointer-events: none/);
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

/** Spec 048 §5.9 — the slip is the one overlay; the field's fade is the one opacity change. */
describe("room.css slip (spec 048)", () => {
  const slip = rules.match(/\.slip \{[^}]*\}/)?.[0] ?? "";

  it("is a paper panel with a 1.5px ink frame, no radius, no shadow", () => {
    expect(slip).toMatch(/border: 1\.5px solid var\(--ink\)/);
    expect(slip).toMatch(/border-radius: 0/);
    expect(slip).not.toMatch(/box-shadow/);
    expect(slip).toMatch(/position: absolute/);
  });

  it("fades the field beneath to 32% and nothing else", () => {
    expect(rules).toMatch(/\.room__field-slot\[data-slipped\] > \.field \{[^}]*opacity: 0\.32/);
    expect(rules).toMatch(/\.room__field-slot \{[^}]*position: relative/);
    // One fade rule: nothing else in the sheet reacts to the slip.
    expect(rules.match(/data-slipped/g)?.length).toBe(1);
  });

  it("sits inside the reduced-motion scope by inheritance", () => {
    expect(rules).toMatch(/prefers-reduced-motion: reduce\)\s*\{\s*\.room \*,/);
  });
});

// Reported 2026-09-21: in a narrow ledger the queue's context (`10 moves each ·
// one 5:00 clock`) wrapped into the wordmark (`wottle10 MOVES EACH`).
describe("room.css the ledger caption", () => {
  it("keeps a gap after the wordmark, never shrinks it, and wraps the context right-aligned", () => {
    expect(block(".ledger__caption")).toMatch(/gap:\s*12px/);
    expect(block(".ledger__wordmark")).toMatch(/flex:\s*none/);
    expect(block(".ledger__caption-right")).toMatch(/text-align:\s*right/);
    expect(block(".ledger__caption-right")).toMatch(/justify-content:\s*flex-end/);
  });
});

// 2026-09-21: the lane is ten segments, the moves left; the ledger's rail is gone.
describe("room.css the segmented move lane", () => {
  it("is a 6px grid of ten segments, 3px apart, on the bar's edge", () => {
    const lane = block(".player-bar__lane--segments");
    expect(lane).toMatch(/display:\s*grid/);
    expect(lane).toMatch(/repeat\(10, minmax\(0, 1fr\)\)/);
    expect(lane).toMatch(/column-gap:\s*3px/);
    expect(lane).toMatch(/height:\s*6px/);
    expect(lane).toMatch(/background:\s*transparent/);
  });
  it("a move left is the seat colour, a spent one the rule, one in flight the 30% live tint", () => {
    expect(block('.player-bar__segment[data-state="left"]')).toMatch(/background:\s*var\(--seat-ink\)/);
    expect(block('.player-bar__segment[data-state="spent"]')).toMatch(/background:\s*var\(--rule\)/);
    expect(block('.player-bar__segment[data-state="scoring"]')).toMatch(/color-mix\(in srgb, var\(--seat-ink\) 30%, transparent\)/);
  });
  it("a disconnected player's moves left are outlined, not filled", () => {
    const outlined = block('.player-bar__lane--disconnected .player-bar__segment[data-state="left"]');
    expect(outlined).toMatch(/background:\s*transparent/);
    expect(outlined).toMatch(/inset 0 0 0 1\.5px var\(--seat-ink\)/);
  });
  it("the move rail's styles are gone", () => {
    expect(css).not.toMatch(/\.rail__cell|\.rail\s*\{/);
  });
});

// 2026-09-21: player names open their profiles; a link keeps the name's look.
describe("room.css profile links on names", () => {
  it("inherit the name's ink, with no underline until hover or keyboard focus", () => {
    for (const sel of [".player-bar__name--link", ".lobby-ledger__profile"]) {
      expect(block(sel)).toMatch(/color:\s*inherit/);
      expect(block(sel)).toMatch(/text-decoration:\s*none/);
    }
    expect(css).toMatch(/\.player-bar__name--link:hover,\s*\.player-bar__name--link:focus-visible,\s*\.lobby-ledger__profile:hover,\s*\.lobby-ledger__profile:focus-visible\s*\{[^}]*text-decoration:\s*underline/);
  });
});

// Reported 2026-09-21: nothing said what was clickable. Every action has a hover,
// a pressed and a keyboard-focus state, drawn with the tokens and the §6 timing.
describe("room.css interaction states", () => {
  const rule = (selector: string): string => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const m = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
    return m?.[1] ?? "";
  };

  it("primary actions invert on hover to paper inside a 1.5px ink frame, and take the tint when pressed", () => {
    expect(rule(".action-primary:hover:not(:disabled)")).toMatch(/background:\s*var\(--paper\)/);
    expect(rule(".action-primary:hover:not(:disabled)")).toMatch(/color:\s*var\(--ink\)/);
    expect(rule(".action-primary:hover:not(:disabled)")).toMatch(/inset 0 0 0 1\.5px var\(--ink\)/);
    expect(rule(".action-primary:active:not(:disabled)")).toMatch(/background:\s*var\(--tint\)/);
  });

  it("secondary actions underline on hover and dim when pressed", () => {
    expect(rule(".action-secondary:hover:not(:disabled)")).toMatch(/text-decoration:\s*underline/);
    expect(rule(".action-secondary:active:not(:disabled)")).toMatch(/color:\s*var\(--muted\)/);
  });

  it("keyboard focus is a 2px ink outline; a pointer click leaves no ring", () => {
    expect(rule(".action-primary:focus-visible,\n.action-secondary:focus-visible")).toMatch(/outline:\s*2px solid var\(--ink\)/);
    expect(rule(".action-primary:focus:not(:focus-visible),\n.action-secondary:focus:not(:focus-visible)")).toMatch(/outline:\s*none/);
  });

  it("state changes take the design system's 120ms ease", () => {
    expect(block(".action-primary")).toMatch(/transition:[^;]*120ms cubic-bezier\(0\.2, 0, 0\.2, 1\)/);
    expect(css).toMatch(/\n\.action-secondary \{[^}]*transition:[^;]*120ms/);
  });

  it("menu items tint their row on hover rather than underline", () => {
    expect(rule(".room-menu__list .action-secondary:hover")).toMatch(/background:\s*var\(--tint\)/);
    expect(rule(".room-menu__list .action-secondary:hover")).toMatch(/text-decoration:\s*none/);
  });

  it("a free letter takes the tint under the pointer only while the field takes picks", () => {
    expect(rule('.field:not([data-disabled]) .field__cell[data-state="free"]:hover')).toMatch(/background:\s*var\(--tint\)/);
  });
});

/** Spec 068 FR-012: the match ledger on the scoreboard's grid. */
describe("room.css the ledger's grid (spec 068)", () => {
  it("its first three rows take the scoreboard's row height; the header's ink rule closes the third", () => {
    expect(rules).toMatch(/\.ledger\[data-grid\] \.ledger__caption,\s*\.ledger\[data-grid\] \.ledger__state-line\s*\{[^}]*height:\s*var\(--sb-row\)/);
    expect(rules).toMatch(/\.ledger\[data-grid\] \.ledger__header\s*\{[^}]*height:\s*calc\(var\(--sb-row\) \+ 1\.5px\)[^}]*border-bottom:\s*1\.5px solid var\(--ink\)/);
  });

  it("each move row is exactly one cell tall, after the stack's gap and the field's frame", () => {
    expect(rules).toMatch(/\.ledger\[data-grid\] \.ledger__rows\s*\{[^}]*grid-auto-rows:\s*var\(--cell-size\)[^}]*margin-top:\s*calc\(var\(--bar-gap\) \+ 1\.5px\)/);
  });
});

/** Spec 068: the scoreboard's geometry (contracts/scoreboard.md) and its stillness (FR-006). */
describe("room.css scoreboard (spec 068)", () => {
  const block = (selector: string, source = rules): string => {
    const at = source.indexOf(`${selector} {`);
    expect(at, `${selector} is declared`).toBeGreaterThanOrEqual(0);
    return source.slice(at, source.indexOf("}", at));
  };
  const phone = rules.slice(rules.lastIndexOf("@media (max-width: 900px)", rules.indexOf("--sb-row: 34px")));

  it("draws three 40px rows on a 216 · track · 64 grid inside a 1.5px ink frame", () => {
    expect(block(".scoreboard")).toMatch(/border:\s*1\.5px solid var\(--ink\)/);
    const row = block(".scoreboard__row");
    expect(row).toMatch(/height:\s*var\(--sb-row\)/);
    expect(row).toMatch(/grid-template-columns:\s*216px minmax\(0, 1fr\) 64px/);
    expect(row).toMatch(/column-gap:\s*16px/);
    expect(row).toMatch(/padding:\s*0 14px/);
    expect(rules).toMatch(/--sb-row:\s*40px/);
  });

  it("on a phone the rows are 34px on a 112 · track · 36 grid", () => {
    expect(phone).toMatch(/--sb-row:\s*34px/);
    expect(phone).toMatch(/grid-template-columns:\s*112px minmax\(0, 1fr\) 36px/);
    expect(phone).toMatch(/column-gap:\s*10px/);
    expect(phone).toMatch(/padding:\s*0 8px/);
  });

  it("the clock and move tracks share the ten columns and their 3px gaps", () => {
    expect(block(".scoreboard__track")).toMatch(/grid-template-columns:\s*repeat\(10, minmax\(0, 1fr\)\)/);
    expect(block(".scoreboard__track")).toMatch(/column-gap:\s*3px/);
  });

  it("urgency is weight: under a minute the clock row takes the tint, its ticks ink and a 700 numeral", () => {
    expect(rules).toMatch(/\.scoreboard__row--clock\[data-phase="underMinute"\],\s*\.scoreboard__row--clock\[data-phase="lastSeconds"\]\s*\{[^}]*background:\s*var\(--tint\)/);
    expect(rules).toMatch(/\[data-phase="underMinute"\] \.scoreboard__numeral,[^{]*\{[^}]*font-weight:\s*700/);
  });

  it("nothing on the scoreboard animates", () => {
    const scoreboardRules = [...rules.matchAll(/(\.scoreboard[^{]*)\{([^}]*)\}/g)];
    for (const [, selector, body] of scoreboardRules) {
      expect(body, `${selector.trim()} animates`).not.toMatch(/animation|transition/);
    }
  });
});
