# Phase 1d — Left-Rail Instructional Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill the Phase 1c left-rail placeholder on the desktop match screen with three instructional cards — `HowToPlayCard` (4-step ordered list), `LegendCard` (three frozen mini-tiles with captions), and `YourMoveCard` (live selected-tile coordinates or submitted state) — so new players get onboarding hints while a match is in progress.

**Architecture:** Three purely presentational `*Card` components composed by a new `MatchLeftRail` container. The `YourMoveCard` needs access to `BoardGrid`'s current tile selection, which currently lives in `BoardGrid`'s internal `useState`. Lift the observation (not ownership) by adding a new `onSelectionChange?: (sel: Coordinate | null) => void` prop to `BoardGrid` that fires whenever its `selected` changes. `MatchClient` keeps a mirror in its own state and passes `selection` + `submittedSelection` to `YourMoveCard`. Mobile keeps the existing overlay-history-button flow — the left rail is desktop-only via the Phase 1c `.match-layout__rail--left` CSS media query.

**Tech Stack:** React 19 + Next.js 16 App Router, Tailwind CSS 4 (Phase 1a/1c tokens), Vitest + React Testing Library, Playwright.

**Branch:** `027-left-rail-phase-1d`, branched from `origin/main` (PRs #109 and #110 merged).

**Prerequisites:**

- Read spec `docs/superpowers/specs/2026-04-19-wottle-design-implementation.md` §4 Phase 1 and Phase 1c plan `docs/superpowers/plans/2026-04-20-phase-1c-hud-classic.md` — Phase 1d completes the deferred scope called out there.
- Prototype reference: `/tmp/wottle-design/wottle-game-design/project/prototype/screens/Match.jsx` lines 89–122 (left rail content).

**Test commands (run after every task):**

- `pnpm lint` — zero warnings.
- `pnpm typecheck` — exit 0.
- `pnpm test -- --run` — unit suite.
- `pnpm exec playwright test --grep @left-rail` — new Playwright tag added in Task 7.

---

## Scope decisions

**In scope (this plan):**

1. `HowToPlayCard` — static card with the prototype's 4-step ordered list.
2. `LegendCard` — three rows (your territory / opponent's territory / shared letter) each with a small p1/p2/split swatch.
3. `YourMoveCard` — shows a contextual message based on selection + submission state, using the `ABCDEFGHIJ` + `1..10` coordinate format from Phase 1b's `BoardCoordLabels`.
4. `BoardGrid` — add optional `onSelectionChange` callback so the selection can be observed by a sibling component.
5. `MatchLeftRail` — stacks the three cards in the left rail.
6. `MatchClient` — mount `MatchLeftRail`, thread selection + submission state.
7. `@left-rail` Playwright smoke.

**Deferred / not in this plan:**

- Inline round log replacing the history overlay portal — the existing portal + "History" button (Phase 1c right rail) still works; an inline log is a nice-to-have, not a regression, and would add significant right-rail real estate work. Phase 1e territory.
- Removing the now-unused `PlayerPanel` full variant — kept in place because `RoundHistoryInline` lives inside it and its accumulated-words list is still rendered by consumers of the full variant elsewhere. Audit + cleanup deferred.

---

## File Structure

**Create:**

- `components/match/HowToPlayCard.tsx` — static ordered-list card.
- `tests/unit/components/match/HowToPlayCard.test.tsx` — unit tests.
- `components/match/LegendCard.tsx` — three-row legend card.
- `tests/unit/components/match/LegendCard.test.tsx` — unit tests.
- `components/match/YourMoveCard.tsx` — contextual selection / submission card.
- `tests/unit/components/match/YourMoveCard.test.tsx` — unit tests (covers the 4 state variants + coordinate formatting).
- `components/match/MatchLeftRail.tsx` — container that stacks the three cards.
- `tests/unit/components/match/MatchLeftRail.test.tsx` — unit tests.
- `lib/util/coord.ts` — shared `formatCoord(x, y): string` helper, returning e.g. `"A1"` for `(0, 0)`.
- `tests/unit/lib/util/coord.test.ts` — unit tests for `formatCoord`.
- `tests/integration/ui/left-rail.spec.ts` — Playwright smoke.

**Modify:**

- `components/game/BoardGrid.tsx` — add `onSelectionChange?: (sel: Coordinate | null) => void` prop and `useEffect` that fires it when `selected` changes.
- `components/match/MatchClient.tsx` — add `selectedTile` state, wire `onSelectionChange`, mount `<MatchLeftRail />` in the left-rail container, compute `submittedSelection` from existing `lockedSwapTiles`.

**Not touched:**

- `app/styles/board.css`, `.match-layout` rules — Phase 1c rail container already renders cards in a flex column.
- `RoundHistoryPanel`, `RoundHistoryInline`, history overlay portal — untouched.
- `PlayerPanel` full variant — untouched (deferred).

---

## Task 1: `formatCoord` shared helper

**Files:**

- Create: `lib/util/coord.ts`
- Create: `tests/unit/lib/util/coord.test.ts`

Pure utility so `BoardCoordLabels` (Phase 1b) and `YourMoveCard` (Phase 1d) both share the `"A1"` format.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/lib/util/coord.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import { formatCoord } from "@/lib/util/coord";

describe("formatCoord", () => {
  test("returns A1 for (0, 0)", () => {
    expect(formatCoord(0, 0)).toBe("A1");
  });

  test("returns J10 for (9, 9)", () => {
    expect(formatCoord(9, 9)).toBe("J10");
  });

  test("returns E7 for (4, 6)", () => {
    expect(formatCoord(4, 6)).toBe("E7");
  });

  test("throws on out-of-range x", () => {
    expect(() => formatCoord(10, 0)).toThrow(/column/i);
    expect(() => formatCoord(-1, 0)).toThrow(/column/i);
  });

  test("throws on out-of-range y", () => {
    expect(() => formatCoord(0, 10)).toThrow(/row/i);
    expect(() => formatCoord(0, -1)).toThrow(/row/i);
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `pnpm test -- --run tests/unit/lib/util/coord.test.ts`
Expected: import fails.

- [ ] **Step 3: Create `lib/util/coord.ts`**

```ts
const COLUMNS = "ABCDEFGHIJ";

export function formatCoord(x: number, y: number): string {
  if (x < 0 || x >= COLUMNS.length) {
    throw new RangeError(`Column index out of range: ${x}`);
  }
  if (y < 0 || y >= 10) {
    throw new RangeError(`Row index out of range: ${y}`);
  }
  return `${COLUMNS[x]}${y + 1}`;
}
```

- [ ] **Step 4: Run the test**

Run: `pnpm test -- --run tests/unit/lib/util/coord.test.ts`
Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/util/coord.ts tests/unit/lib/util/coord.test.ts
git commit -m "feat(util): add formatCoord(x,y) helper for ABCDEFGHIJ + 1..10 format

Shared by BoardCoordLabels (Phase 1b) and YourMoveCard (Phase 1d).
Throws RangeError on out-of-range input so callers can trust the
return type."
```

---

## Task 2: `HowToPlayCard`

**Files:**

- Create: `components/match/HowToPlayCard.tsx`
- Create: `tests/unit/components/match/HowToPlayCard.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/components/match/HowToPlayCard.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { HowToPlayCard } from "@/components/match/HowToPlayCard";

describe("HowToPlayCard", () => {
  test("renders the 'How to play' eyebrow", () => {
    render(<HowToPlayCard />);
    expect(screen.getByText("How to play")).toBeInTheDocument();
  });

  test("renders an ordered list with four steps", () => {
    render(<HowToPlayCard />);
    const list = screen.getByRole("list");
    expect(list.tagName).toBe("OL");
    expect(within(list).getAllByRole("listitem")).toHaveLength(4);
  });

  test("steps describe the swap-and-form-words flow", () => {
    render(<HowToPlayCard />);
    expect(screen.getByText(/Tap any unfrozen tile/i)).toBeInTheDocument();
    expect(screen.getByText(/Tap a second tile to swap/i)).toBeInTheDocument();
    expect(
      screen.getByText(/New 3\+ letter words in any direction score/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Claimed letters freeze in your color/i),
    ).toBeInTheDocument();
  });

  test("root has the wottle card styling", () => {
    render(<HowToPlayCard />);
    const card = screen.getByTestId("how-to-play-card");
    expect(card.className).toMatch(/bg-paper/);
    expect(card.className).toMatch(/border-hair/);
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `pnpm test -- --run tests/unit/components/match/HowToPlayCard.test.tsx`
Expected: import fails.

- [ ] **Step 3: Create `components/match/HowToPlayCard.tsx`**

```tsx
export function HowToPlayCard() {
  return (
    <div
      data-testid="how-to-play-card"
      className="rounded-xl border border-hair bg-paper p-4 shadow-wottle-sm"
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
        How to play
      </div>
      <ol className="mt-2.5 list-decimal pl-5 text-[13px] leading-[1.7] text-ink-3">
        <li>Tap any unfrozen tile.</li>
        <li>Tap a second tile to swap.</li>
        <li>New 3+ letter words in any direction score.</li>
        <li>Claimed letters freeze in your color.</li>
      </ol>
    </div>
  );
}
```

- [ ] **Step 4: Run the test**

Run: `pnpm test -- --run tests/unit/components/match/HowToPlayCard.test.tsx`
Expected: all 4 pass.

- [ ] **Step 5: Commit**

```bash
git add components/match/HowToPlayCard.tsx tests/unit/components/match/HowToPlayCard.test.tsx
git commit -m "feat(match): add HowToPlayCard for Phase 1d left rail

Static instructional card: mono 'How to play' eyebrow plus a four-step
ordered list. Paper surface, hair border, standard shadow-wottle-sm
to match the other match-screen cards."
```

---

## Task 3: `LegendCard`

**Files:**

- Create: `components/match/LegendCard.tsx`
- Create: `tests/unit/components/match/LegendCard.test.tsx`

Renders three rows, each with a tiny colour swatch and a caption. Swatches use inline styles driven by `var(--p1)`, `var(--p2)`, and a 50/50 diagonal gradient between the two (matching `.tile.frozen-both` from the prototype).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/components/match/LegendCard.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { LegendCard } from "@/components/match/LegendCard";

describe("LegendCard", () => {
  test("renders the 'Legend' eyebrow", () => {
    render(<LegendCard />);
    expect(screen.getByText("Legend")).toBeInTheDocument();
  });

  test("renders three captions", () => {
    render(<LegendCard />);
    expect(screen.getByText("Your territory")).toBeInTheDocument();
    expect(screen.getByText("Opponent's territory")).toBeInTheDocument();
    expect(screen.getByText("Shared letter")).toBeInTheDocument();
  });

  test("renders three swatches", () => {
    render(<LegendCard />);
    expect(screen.getAllByTestId("legend-swatch")).toHaveLength(3);
  });

  test("your-territory swatch uses the p1 slot", () => {
    render(<LegendCard />);
    const swatches = screen.getAllByTestId("legend-swatch");
    expect(swatches[0].dataset.slot).toBe("p1");
    expect(swatches[1].dataset.slot).toBe("p2");
    expect(swatches[2].dataset.slot).toBe("both");
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `pnpm test -- --run tests/unit/components/match/LegendCard.test.tsx`
Expected: import fails.

- [ ] **Step 3: Create `components/match/LegendCard.tsx`**

```tsx
type Slot = "p1" | "p2" | "both";

const SLOT_STYLES: Record<Slot, React.CSSProperties> = {
  p1: {
    background: "color-mix(in oklab, var(--p1-tint) 75%, var(--paper))",
    boxShadow: "inset 3px 0 0 var(--p1)",
  },
  p2: {
    background: "color-mix(in oklab, var(--p2-tint) 75%, var(--paper))",
    boxShadow: "inset 3px 0 0 var(--p2)",
  },
  both: {
    background:
      "linear-gradient(135deg, color-mix(in oklab, var(--p1-tint) 80%, var(--paper)) 50%, color-mix(in oklab, var(--p2-tint) 80%, var(--paper)) 50%)",
  },
};

function Swatch({ slot }: { slot: Slot }) {
  return (
    <span
      data-testid="legend-swatch"
      data-slot={slot}
      aria-hidden="true"
      className="inline-block h-[22px] w-[22px] flex-shrink-0 rounded-[4px] border border-hair"
      style={SLOT_STYLES[slot]}
    />
  );
}

export function LegendCard() {
  return (
    <div
      data-testid="legend-card"
      className="rounded-xl border border-hair bg-paper p-4 shadow-wottle-sm"
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
        Legend
      </div>
      <div className="mt-3 flex flex-col gap-2.5 text-[13px] text-ink-3">
        <div className="flex items-center gap-3">
          <Swatch slot="p1" />
          <span>Your territory</span>
        </div>
        <div className="flex items-center gap-3">
          <Swatch slot="p2" />
          <span>Opponent&apos;s territory</span>
        </div>
        <div className="flex items-center gap-3">
          <Swatch slot="both" />
          <span>Shared letter</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test**

Run: `pnpm test -- --run tests/unit/components/match/LegendCard.test.tsx`
Expected: all 4 pass.

- [ ] **Step 5: Commit**

```bash
git add components/match/LegendCard.tsx tests/unit/components/match/LegendCard.test.tsx
git commit -m "feat(match): add LegendCard for Phase 1d left rail

Three-row legend with small coloured swatches — p1 tint + ochre edge
for 'your territory', p2 tint + slate-teal edge for opponent, and a
diagonal both-tint gradient for shared letters. Mirrors the prototype's
frozen-p1/frozen-p2/frozen-both tile legend."
```

---

## Task 4: `YourMoveCard`

**Files:**

- Create: `components/match/YourMoveCard.tsx`
- Create: `tests/unit/components/match/YourMoveCard.test.tsx`

Four state variants:

1. Idle, no selection — `"Select your first tile."`
2. Idle, one tile picked — `"Picked A1. Pick a second."`
3. Submitted — eyebrow `"Submitted"`, coords `"A1 ↔ B2"`, footnote `"Hidden from opponent until both submit."`
4. Match over / resolving — same as submitted (no special handling needed; caller decides).

Props:

```ts
interface YourMoveCardProps {
  selection: Coordinate | null;            // currently picked first tile (null if none)
  submittedMove: [Coordinate, Coordinate] | null;  // the locked pair after submission
}
```

- [ ] **Step 1: Write the failing test**

Create `tests/unit/components/match/YourMoveCard.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { YourMoveCard } from "@/components/match/YourMoveCard";

describe("YourMoveCard", () => {
  test("renders the 'Your move' eyebrow", () => {
    render(<YourMoveCard selection={null} submittedMove={null} />);
    expect(screen.getByText("Your move")).toBeInTheDocument();
  });

  test("empty state prompts the first pick", () => {
    render(<YourMoveCard selection={null} submittedMove={null} />);
    expect(screen.getByText("Select your first tile.")).toBeInTheDocument();
  });

  test("single selection shows the coordinate", () => {
    render(
      <YourMoveCard
        selection={{ x: 0, y: 0 }}
        submittedMove={null}
      />,
    );
    expect(screen.getByText(/Picked/i)).toBeInTheDocument();
    expect(screen.getByText("A1")).toBeInTheDocument();
    expect(screen.getByText(/Pick a second/i)).toBeInTheDocument();
  });

  test("submitted state shows both coords joined by ↔", () => {
    render(
      <YourMoveCard
        selection={null}
        submittedMove={[
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ]}
      />,
    );
    expect(screen.getByText("Submitted")).toBeInTheDocument();
    expect(screen.getByText("A1 ↔ B2")).toBeInTheDocument();
    expect(
      screen.getByText(/Hidden from opponent until both submit/i),
    ).toBeInTheDocument();
  });

  test("submitted state overrides selection", () => {
    render(
      <YourMoveCard
        selection={{ x: 2, y: 3 }}
        submittedMove={[
          { x: 4, y: 5 },
          { x: 6, y: 7 },
        ]}
      />,
    );
    expect(screen.queryByText(/Select your first tile/i)).not.toBeInTheDocument();
    expect(screen.queryByText("C4")).not.toBeInTheDocument();
    expect(screen.getByText("E6 ↔ G8")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `pnpm test -- --run tests/unit/components/match/YourMoveCard.test.tsx`
Expected: import fails.

- [ ] **Step 3: Create `components/match/YourMoveCard.tsx`**

```tsx
import type { Coordinate } from "@/lib/types/board";
import { formatCoord } from "@/lib/util/coord";

interface YourMoveCardProps {
  selection: Coordinate | null;
  submittedMove: [Coordinate, Coordinate] | null;
}

export function YourMoveCard({ selection, submittedMove }: YourMoveCardProps) {
  return (
    <div
      data-testid="your-move-card"
      className="rounded-xl border border-hair bg-paper p-4 shadow-wottle-sm"
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
        Your move
      </div>
      <div className="mt-2.5 text-[13px] leading-[1.6] text-ink-3">
        {submittedMove ? (
          <SubmittedState move={submittedMove} />
        ) : selection ? (
          <SinglePickState selection={selection} />
        ) : (
          <span className="text-ink-soft">Select your first tile.</span>
        )}
      </div>
    </div>
  );
}

function SinglePickState({ selection }: { selection: Coordinate }) {
  return (
    <span>
      Picked{" "}
      <b className="font-mono font-medium text-ink">
        {formatCoord(selection.x, selection.y)}
      </b>
      . Pick a second.
    </span>
  );
}

function SubmittedState({ move }: { move: [Coordinate, Coordinate] }) {
  const [from, to] = move;
  return (
    <div>
      <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-soft">
        Submitted
      </div>
      <div className="mt-1.5 font-mono text-ink">
        {formatCoord(from.x, from.y)} ↔ {formatCoord(to.x, to.y)}
      </div>
      <div className="mt-2 text-[12px] text-ink-soft">
        Hidden from opponent until both submit.
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test + full suite**

```
pnpm test -- --run tests/unit/components/match/YourMoveCard.test.tsx
pnpm test -- --run
```

Both pass.

- [ ] **Step 5: Commit**

```bash
git add components/match/YourMoveCard.tsx tests/unit/components/match/YourMoveCard.test.tsx
git commit -m "feat(match): add YourMoveCard with selection + submitted states

Four visual states: empty prompt, single-pick with coord, submitted
('A1 ↔ B2' with 'hidden until both submit' footnote). Uses the shared
formatCoord helper so the coordinate format matches BoardCoordLabels."
```

---

## Task 5: `BoardGrid` `onSelectionChange` callback

**Files:**

- Modify: `components/game/BoardGrid.tsx`
- Modify: `tests/unit/components/game/` (new test file or extend existing)

The `BoardGrid` currently keeps `selected` as internal `useState<SelectedTile | null>(null)`. Add an optional callback that fires whenever the selection changes, without changing ownership or the existing `onTileSelect` (which is for audio feedback).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/components/game/BoardGridSelection.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { BoardGrid } from "@/components/game/BoardGrid";

const grid = Array.from({ length: 10 }, () =>
  Array.from({ length: 10 }, () => "A"),
) as string[][];

describe("BoardGrid onSelectionChange", () => {
  test("fires null initially (no change on mount) and after a pick", async () => {
    const onSelectionChange = vi.fn();
    render(
      <BoardGrid
        grid={grid}
        matchId="m-1"
        onSelectionChange={onSelectionChange}
      />,
    );

    // Initial call reports the current (null) selection once.
    await waitFor(() => {
      expect(onSelectionChange).toHaveBeenCalled();
    });
    expect(onSelectionChange).toHaveBeenLastCalledWith(null);

    const firstTile = screen.getAllByTestId("board-tile")[0];
    fireEvent.click(firstTile);

    await waitFor(() => {
      expect(onSelectionChange).toHaveBeenLastCalledWith({ x: 0, y: 0 });
    });
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `pnpm test -- --run tests/unit/components/game/BoardGridSelection.test.tsx`
Expected: either the callback is not received or `onSelectionChange` is undefined on the type.

- [ ] **Step 3: Update `components/game/BoardGrid.tsx`**

Find the `BoardGridProps` interface (near line 20-66). Locate the last prop in the interface — right after `onInvalidMove?: () => void;`. Add:

```tsx
  /** Fired whenever the currently-selected first tile changes (null when deselected). */
  onSelectionChange?: (selection: Coordinate | null) => void;
```

Find the `BoardGridInternal` (or equivalent) prop destructuring — the function receives `onTileSelect`, `onValidSwap`, `onInvalidMove`. Add `onSelectionChange` to the destructured props.

Then, immediately after the `const [selected, setSelected] = useState<SelectedTile | null>(null);` line (around line 222), add:

```tsx
  useEffect(() => {
    onSelectionChange?.(selected);
  }, [selected, onSelectionChange]);
```

Ensure `useEffect` is imported (it probably already is). If not, add it to the React import line at the top of the file.

- [ ] **Step 4: Run the test**

Run: `pnpm test -- --run tests/unit/components/game/BoardGridSelection.test.tsx`
Expected: 1 test passes.

Run the full suite to check for regressions: `pnpm test -- --run`

- [ ] **Step 5: Commit**

```bash
git add components/game/BoardGrid.tsx tests/unit/components/game/BoardGridSelection.test.tsx
git commit -m "feat(game): expose BoardGrid selection via onSelectionChange callback

Additive prop so a sibling component (YourMoveCard in Phase 1d) can
observe the currently-picked first tile without owning the state.
Callback fires once on mount with null and then on every change."
```

---

## Task 6: `MatchLeftRail` container

**Files:**

- Create: `components/match/MatchLeftRail.tsx`
- Create: `tests/unit/components/match/MatchLeftRail.test.tsx`

Simple flex-column container that stacks the three cards. Takes the same `selection` + `submittedMove` props as `YourMoveCard` and forwards them.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/components/match/MatchLeftRail.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { MatchLeftRail } from "@/components/match/MatchLeftRail";

describe("MatchLeftRail", () => {
  test("renders all three instructional cards", () => {
    render(<MatchLeftRail selection={null} submittedMove={null} />);
    expect(screen.getByTestId("how-to-play-card")).toBeInTheDocument();
    expect(screen.getByTestId("legend-card")).toBeInTheDocument();
    expect(screen.getByTestId("your-move-card")).toBeInTheDocument();
  });

  test("forwards selection to YourMoveCard", () => {
    render(
      <MatchLeftRail
        selection={{ x: 2, y: 4 }}
        submittedMove={null}
      />,
    );
    expect(screen.getByText("C5")).toBeInTheDocument();
  });

  test("forwards submittedMove to YourMoveCard", () => {
    render(
      <MatchLeftRail
        selection={null}
        submittedMove={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
      />,
    );
    expect(screen.getByText("A1 ↔ B2")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `pnpm test -- --run tests/unit/components/match/MatchLeftRail.test.tsx`
Expected: import fails.

- [ ] **Step 3: Create `components/match/MatchLeftRail.tsx`**

```tsx
import type { Coordinate } from "@/lib/types/board";

import { HowToPlayCard } from "./HowToPlayCard";
import { LegendCard } from "./LegendCard";
import { YourMoveCard } from "./YourMoveCard";

interface MatchLeftRailProps {
  selection: Coordinate | null;
  submittedMove: [Coordinate, Coordinate] | null;
}

export function MatchLeftRail({ selection, submittedMove }: MatchLeftRailProps) {
  return (
    <>
      <HowToPlayCard />
      <LegendCard />
      <YourMoveCard selection={selection} submittedMove={submittedMove} />
    </>
  );
}
```

(The parent `.match-layout__rail--left` is already a `flex flex-col gap-3` container per Phase 1c CSS, so we just emit the cards as a fragment.)

- [ ] **Step 4: Run the test + full suite + typecheck**

```
pnpm test -- --run tests/unit/components/match/MatchLeftRail.test.tsx
pnpm test -- --run
pnpm typecheck
```

All pass.

- [ ] **Step 5: Commit**

```bash
git add components/match/MatchLeftRail.tsx tests/unit/components/match/MatchLeftRail.test.tsx
git commit -m "feat(match): add MatchLeftRail container

Fragment-returning composer for HowToPlay / Legend / YourMove cards.
Parent .match-layout__rail--left (Phase 1c) already provides the flex
column + gap so no extra wrapper is needed."
```

---

## Task 7: Wire `MatchLeftRail` into `MatchClient`

**Files:**

- Modify: `components/match/MatchClient.tsx`

`MatchClient` holds a new `selectedTile` state, passes `onSelectionChange={setSelectedTile}` to `BoardGrid`, derives `submittedMove` from `lockedSwapTiles`, and mounts `<MatchLeftRail />` inside the empty left-rail div.

- [ ] **Step 1: Verify current left-rail placeholder shape**

Run: `grep -n "match-layout-rail-left\|lockedSwapTiles\|const \[selectedTile" components/match/MatchClient.tsx | head -5`

Expect: one `match-layout-rail-left` div around line 766 and the `lockedSwapTiles` declaration around line 118. No `selectedTile` yet.

- [ ] **Step 2: Add imports**

Near the other match-component imports, add:

```tsx
import { MatchLeftRail } from "@/components/match/MatchLeftRail";
```

Near the `Coordinate` type import block, ensure `Coordinate` is already available in scope (it is — used by `lockedSwapTiles`).

- [ ] **Step 3: Add `selectedTile` state**

Find the block of `useState` declarations near the top of the component (around line 117):

```tsx
  const [moveLocked, setMoveLocked] = useState(false);
  const [lockedSwapTiles, setLockedSwapTiles] = useState<[Coordinate, Coordinate] | null>(null);
```

After those two lines, add:

```tsx
  const [selectedTile, setSelectedTile] = useState<Coordinate | null>(null);
```

- [ ] **Step 4: Wire `onSelectionChange` on `BoardGrid`**

Find the `<BoardGrid ... />` invocation (around line 795). Its prop list ends with:

```tsx
              onInvalidMove={() => { playInvalidMove(); vibrateInvalidMove(); }}
```

Add a new line before the closing `/>`:

```tsx
              onSelectionChange={setSelectedTile}
```

Result:

```tsx
              onTileSelect={playTileSelect}
              onValidSwap={() => { playValidSwap(); vibrateValidSwap(); }}
              onInvalidMove={() => { playInvalidMove(); vibrateInvalidMove(); }}
              onSelectionChange={setSelectedTile}
            />
```

- [ ] **Step 5: Mount `<MatchLeftRail />` inside the left-rail container**

Find the left-rail placeholder div (around line 766):

```tsx
          <div
            data-testid="match-layout-rail-left"
            className="match-layout__rail--left"
          />
```

Replace with:

```tsx
          <div
            data-testid="match-layout-rail-left"
            className="match-layout__rail--left"
          >
            <MatchLeftRail
              selection={selectedTile}
              submittedMove={moveLocked ? lockedSwapTiles : null}
            />
          </div>
```

- [ ] **Step 6: Run the full suite + typecheck**

```
pnpm test -- --run
pnpm typecheck
```

Both pass. If a Playwright spec that interacts with the match screen now fails because an unexpected element appears in the left rail, update the assertion to scope queries (e.g., `within(pageA.getByTestId("match-layout-rail-right"))`) rather than removing the new cards.

- [ ] **Step 7: Commit**

```bash
git add components/match/MatchClient.tsx
git commit -m "feat(match): mount MatchLeftRail in the desktop left rail

Adds selectedTile state, wires BoardGrid.onSelectionChange, and passes
selection + (moveLocked ? lockedSwapTiles : null) to the rail so
YourMoveCard updates live as the player picks tiles and then locks the
submitted state the moment the move is confirmed."
```

---

## Task 8: Playwright `@left-rail` smoke

**Files:**

- Create: `tests/integration/ui/left-rail.spec.ts`

- [ ] **Step 1: Inspect the match-helper pattern**

Run: `grep -l "startMatchWithDirectInvite" tests/integration/ui/*.spec.ts | head -3`

Read one existing spec (e.g. `hud-classic.spec.ts` or `match-completion.spec.ts`) to mirror the exact two-player match setup.

- [ ] **Step 2: Write the test**

Create `tests/integration/ui/left-rail.spec.ts`. Copy the login + two-player helper pattern from `hud-classic.spec.ts` verbatim; only the assertions differ:

```ts
import { test, expect, type Page } from "@playwright/test";

import {
  generateTestUsername,
  startMatchWithDirectInvite,
} from "./helpers/matchmaking";

async function loginPlayer(page: Page, username: string) {
  await page.goto("/lobby");
  await page.fill('input[name="username"]', username);
  await page.click('button[type="submit"]');
  await expect(page.getByTestId("lobby-shell")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByTestId("matchmaker-start-button")).toBeVisible({
    timeout: 10_000,
  });
}

test.describe("@left-rail Phase 1d instructional cards", () => {
  test("renders How to play, Legend, and Your move cards", async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      const userA = generateTestUsername("rail-alpha");
      const userB = generateTestUsername("rail-beta");

      await loginPlayer(pageA, userA);
      await loginPlayer(pageB, userB);

      const [matchIdA, matchIdB] = await startMatchWithDirectInvite(pageA, pageB, {
        timeoutMs: 60_000,
        playerBUsername: userB,
      });
      expect(matchIdA).toBeTruthy();
      expect(matchIdA).toEqual(matchIdB);

      await expect(pageA.getByTestId("match-shell")).toBeVisible({
        timeout: 10_000,
      });

      const leftRail = pageA.getByTestId("match-layout-rail-left");
      await expect(leftRail).toBeVisible();
      await expect(leftRail.getByTestId("how-to-play-card")).toBeVisible();
      await expect(leftRail.getByTestId("legend-card")).toBeVisible();
      await expect(leftRail.getByTestId("your-move-card")).toBeVisible();

      // Empty selection state
      await expect(
        leftRail.getByText("Select your first tile."),
      ).toBeVisible();
    } finally {
      await pageA.close();
      await pageB.close();
      await contextA.close();
      await contextB.close();
    }
  });

  test("YourMoveCard updates when a tile is picked", async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      const userA = generateTestUsername("rail-pick-alpha");
      const userB = generateTestUsername("rail-pick-beta");

      await loginPlayer(pageA, userA);
      await loginPlayer(pageB, userB);

      await startMatchWithDirectInvite(pageA, pageB, {
        timeoutMs: 60_000,
        playerBUsername: userB,
      });

      await expect(pageA.getByTestId("match-shell")).toBeVisible({
        timeout: 10_000,
      });

      const leftRail = pageA.getByTestId("match-layout-rail-left");
      const tiles = pageA.getByTestId("board-tile");
      await tiles.nth(0).click();

      // After picking the top-left tile (0,0), the card shows A1.
      await expect(leftRail.getByText("A1")).toBeVisible();
      await expect(leftRail.getByText(/Pick a second/i)).toBeVisible();
    } finally {
      await pageA.close();
      await pageB.close();
      await contextA.close();
      await contextB.close();
    }
  });
});
```

- [ ] **Step 3: Run the test**

Run: `pnpm exec playwright test --grep @left-rail`

Expected outcomes:
- **Both pass** — commit.
- **Supabase / dev-server not available** — commit the file anyway as DONE_WITH_CONCERNS; CI will run it.
- **An assertion fails** — inspect the DOM snapshot, likely a mismatch on `data-testid`. Correct and retry.

- [ ] **Step 4: Commit**

```bash
git add tests/integration/ui/left-rail.spec.ts
git commit -m "test(match): Playwright smoke for Phase 1d left rail

Locks in the three instructional cards in the desktop left rail, plus
YourMoveCard's live update from 'Select your first tile' to the picked
coordinate after a single tile click."
```

---

## Task 9: Verification sweep

- [ ] **Step 1: Run the complete unit suite**

Run: `pnpm test -- --run`
Expected: all unit tests pass.

- [ ] **Step 2: Run the full Playwright suite**

Run: `pnpm exec playwright test`
Expected: all tests pass. If another spec intermittently fails due to the new left-rail appearance (e.g., a selector that used to find one `board-tile` now finds many), narrow the selector scope; do not remove the new cards.

- [ ] **Step 3: Run lint + typecheck**

```
pnpm lint
pnpm typecheck
```

Both exit 0.

- [ ] **Step 4: Manual visual sanity check**

Run `pnpm dev` and open `/match/<match-id>` with a live match. Confirm:

- Left rail (desktop, ≥ 900px) shows three paper-surface cards: *How to play*, *Legend*, *Your move*.
- Picking one tile on the board updates *Your move* to `Picked A1. Pick a second.` (or equivalent coord).
- Submitting the pair flips *Your move* to the `Submitted` state with the two coords joined by ↔.
- Mobile (< 900px) shows nothing in place of the left rail — the compact bars still handle everything.

- [ ] **Step 5: Commit any targeted assertion updates**

If Playwright assertion narrowing was needed in Step 2, those are their own commits. Otherwise no further commits.

---

## Self-Review Checklist

- [x] `formatCoord` util is shared by the new `YourMoveCard` (and can back-fill `BoardCoordLabels` if we want in a follow-up).
- [x] Three cards cover the prototype's left-rail content.
- [x] `BoardGrid` selection observability is additive (`onSelectionChange` is optional, no behavioural change when omitted).
- [x] `MatchLeftRail` is a fragment so the Phase 1c rail container's flex-column already gives the stacking.
- [x] `MatchClient` passes `moveLocked ? lockedSwapTiles : null` so the submitted state only shows after the server confirms the swap; it clears when the next round starts and `moveLocked` goes back to false.
- [x] No task touches `.match-layout` CSS, `RoundHistoryPanel`, `PlayerPanel` full variant, or the history overlay — all outside Phase 1d scope.
- [x] No placeholders or under-specified steps.
- [x] Every test file uses the existing `@testing-library/react` + `vitest` conventions with `data-testid` for deterministic lookups where text could be ambiguous.

---

## Out-of-scope (deferred)

- **Inline round log in the right rail** — the existing overlay portal works fine; replacing it with an inline card would be polish, not a regression. Phase 1e can pick it up along with any other right-rail densification.
- **Removing the unused `PlayerPanel` full variant** — `RoundHistoryInline` still lives inside it and is surfaced on desktop when the history button opens the overlay. Will audit and clean up once we're sure no consumer depends on the full variant path.
