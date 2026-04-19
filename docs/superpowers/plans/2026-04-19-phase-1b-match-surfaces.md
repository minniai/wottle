# Phase 1b — Match Surfaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the in-match board to the prototype's Warm Editorial feel — letterpress tile gradients, A–J / 1–10 coord labels, a round-progress pip bar, and a tiles-claimed widget — without restructuring the existing `.match-layout` grid.

**Architecture:** Additive CSS + small components. Modify `.board-grid__cell` in `app/styles/board.css` to the prototype's two-stop linear gradient + inset highlight/shadow. Wrap `BoardGrid` with edge coord labels. Replace the "Round N / 10" text in `PlayerPanel` with a new `RoundPipBar` component. Add a `TilesClaimedCard` to `MatchClient`'s right rail under the opponent panel, deriving counts from `matchState.frozenTiles`. HUD classic refresh and left-rail instructional cards are **deferred to Phase 1c**.

**Tech Stack:** Tailwind CSS 4 (uses Phase 1a tokens), React 19, Next.js 16 App Router, Vitest + React Testing Library, Playwright.

**Branch:** `021-match-surfaces-phase-1b`, branched from `020-theme-flip-phase-1a` (so Phase 1a's theme flip is already present — Phase 1b visuals depend on the OKLCH tokens).

**Prerequisites:**

- Phase 1a merged or branched from — see spec `docs/superpowers/specs/2026-04-19-wottle-design-implementation.md` §4 Phase 1, and the completed Phase 1a plan `docs/superpowers/plans/2026-04-19-phase-1a-theme-flip.md`.
- Prototype reference: `/tmp/wottle-design/wottle-game-design/project/prototype/styles.css` lines 736–825 (letterpress tile rules), lines 289–304 (coord labels), lines 371–379 (round pip bar), lines 170–175 (tiles-claimed progress bar). `/tmp/wottle-design/wottle-game-design/project/prototype/primitives.jsx` for `RoundBar` and `Board` component shape.

**Test commands (run after every task):**

- `pnpm lint` — zero warnings.
- `pnpm typecheck` — exit 0.
- `pnpm test -- --run` — unit suite.
- `pnpm exec playwright test --grep @match-surfaces` — new Playwright tag added in Task 8.

---

## Scope decisions

**In scope (this plan):**

1. Letterpress tile CSS — modify existing `.board-grid__cell` rules.
2. A–J / 1–10 coord labels rendered around the board.
3. `RoundPipBar` component replacing the existing "Round N / 10" text in `PlayerPanel`.
4. `TilesClaimedCard` component mounted in `MatchClient`'s right-rail area under the opponent panel.
5. `@match-surfaces` Playwright smoke test.

**Deferred to Phase 1c:**

- HUD classic refresh (`PlayerPanel` full-variant visual overhaul — left-stripe accent, italic Fraunces score, mono clock pill, and a top-spanning HUD layout).
- Left-rail instructional cards (How to play, Legend, Your move).

Reason for the split: the HUD refresh implies a `.match-layout` restructuring (top-spanning HUD rather than left/right rails). That's a larger, more disruptive change best shipped separately so the additive visual polish in this plan can land on its own merits.

---

## File Structure

**Create:**

- `components/match/RoundPipBar.tsx` — 10-pip progress bar (current ochre-deep, done ink-2, future hair-strong).
- `tests/unit/components/match/RoundPipBar.test.tsx` — unit tests for RoundPipBar.
- `components/match/TilesClaimedCard.tsx` — counts frozen tiles per owner + three-segment progress bar.
- `tests/unit/components/match/TilesClaimedCard.test.tsx` — unit tests for TilesClaimedCard.
- `components/game/BoardCoordLabels.tsx` — edge coord labels (A–J columns, 1–10 rows) rendered as a wrapper around `BoardGrid`.
- `tests/unit/components/game/BoardCoordLabels.test.tsx` — unit tests for BoardCoordLabels.
- `tests/integration/ui/match-surfaces.spec.ts` — Playwright smoke.

**Modify:**

- `app/styles/board.css` — update `.board-grid__cell` base and hover rules to the letterpress treatment; add coord-label styles.
- `components/match/PlayerPanel.tsx` — replace the "Round N / 10" span with `<RoundPipBar current={…} total={…} />`.
- `components/game/Board.tsx` — wrap `BoardGrid` with `BoardCoordLabels`.
- `components/match/MatchClient.tsx` — mount `<TilesClaimedCard />` in the right rail under the opponent `PlayerPanel`.

**Not touched in this plan:**

- The match-layout grid structure (`.match-layout` CSS) — stays as-is.
- `BoardGrid` internals (tile rendering, click handlers, animations).
- `PlayerPanel`'s avatar/score/timer structure — only the one "Round N / 10" span swaps.
- `FinalSummary`, `RoundSummaryPanel`, `RoundHistoryPanel` — untouched.

---

## Task 1: Letterpress tile CSS on `.board-grid__cell`

**Files:**

- Modify: `app/styles/board.css` (the `.board-grid__cell`, `.board-grid__cell:hover, .board-grid__cell:focus-within` blocks — lines 56–121 of the Phase-1a tip).

The current cell uses a **radial** gradient + mixed inset shadows. Replace with a two-stop **linear** gradient + prototype letterpress inset stack. Visually: cream-paper tiles look like they're pressed into the board, with a subtle top highlight and bottom shadow.

- [ ] **Step 1: Write a failing CSS-audit test**

Create `tests/unit/styles/board-letterpress.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- --run tests/unit/styles/board-letterpress.test.ts`
Expected: 3 failures.

- [ ] **Step 3: Rewrite the `.board-grid__cell` and `:hover` rules**

In `app/styles/board.css`, find the existing `.board-grid__cell` block (currently uses `background: radial-gradient(...)` and `box-shadow: inset 0 1px 0 color-mix(in oklab, var(--p1) 12%, transparent), ...`). Replace the whole block with:

```css
.board-grid__cell {
  appearance: none;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1 / 1;
  min-width: 0;
  border-radius: 0.65rem;
  border: 1px solid color-mix(in oklab, var(--ink) 8%, transparent);
  background: linear-gradient(
    180deg,
    var(--paper) 0%,
    color-mix(in oklab, var(--paper-2) 95%, var(--paper)) 100%
  );
  color: var(--ink);
  font-weight: 500;
  font-size: var(--board-grid-font-size);
  letter-spacing: 0;
  text-transform: uppercase;
  cursor: pointer;
  overflow: visible;
  box-shadow:
    inset 0 1px 0 color-mix(in oklab, #fff 80%, transparent),
    inset 0 -1px 0 color-mix(in oklab, var(--ink) 10%, transparent),
    inset 0 0 0 1px color-mix(in oklab, var(--ink) 8%, transparent),
    0 1px 0 color-mix(in oklab, var(--ink) 6%, transparent);
  transition:
    transform 200ms ease-out,
    border-color 150ms ease,
    box-shadow 150ms ease;
}
```

Then find the `.board-grid__cell:hover, .board-grid__cell:focus-within` block and replace with:

```css
.board-grid__cell:hover,
.board-grid__cell:focus-within {
  transform: translateY(-2px);
  box-shadow:
    inset 0 1px 0 color-mix(in oklab, #fff 90%, transparent),
    inset 0 0 0 1px color-mix(in oklab, var(--ochre-deep) 30%, transparent),
    0 4px 10px color-mix(in oklab, var(--ink) 16%, transparent);
  outline: none;
}
```

Leave every other `.board-grid__cell--…` variant (selected, opponent-reveal, locked, frozen, scored, invalid) untouched — they layer on top of the new base.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test -- --run tests/unit/styles/board-letterpress.test.ts`
Expected: 3 passing tests.

- [ ] **Step 5: Run the full suite + typecheck**

```
pnpm test -- --run
pnpm typecheck
```

Both must pass. The board-ui Playwright spec asserts behaviour, not colours, so it should be unaffected.

- [ ] **Step 6: Commit**

```bash
git add app/styles/board.css tests/unit/styles/board-letterpress.test.ts
git commit -m "feat(match): letterpress tile treatment on .board-grid__cell

Swap radial-gradient + player-tinted inset shadows for the prototype's
two-stop linear gradient + letterpress inset stack (top highlight, bottom
shadow, thin ink outline, soft ground shadow). Hover lifts 2px with an
ochre-deep accent ring instead of the player-colour glow."
```

---

## Task 2: `BoardCoordLabels` component — A–J / 1–10 edge labels

**Files:**

- Create: `components/game/BoardCoordLabels.tsx`
- Create: `tests/unit/components/game/BoardCoordLabels.test.tsx`

The component is a pure presentational wrapper that renders ten A–J labels above the board and ten 1–10 labels to the left. It takes `children` (the board itself) and arranges everything in a two-row-two-column CSS grid.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/components/game/BoardCoordLabels.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { BoardCoordLabels } from "@/components/game/BoardCoordLabels";

describe("BoardCoordLabels", () => {
  test("renders columns A through J", () => {
    render(
      <BoardCoordLabels>
        <div data-testid="inner">inner</div>
      </BoardCoordLabels>,
    );
    const cols = screen.getByTestId("board-coords-top");
    expect(within(cols).getByText("A")).toBeInTheDocument();
    expect(within(cols).getByText("J")).toBeInTheDocument();
    expect(within(cols).getAllByRole("presentation")).toHaveLength(10);
  });

  test("renders rows 1 through 10", () => {
    render(
      <BoardCoordLabels>
        <div data-testid="inner">inner</div>
      </BoardCoordLabels>,
    );
    const rows = screen.getByTestId("board-coords-left");
    expect(within(rows).getByText("1")).toBeInTheDocument();
    expect(within(rows).getByText("10")).toBeInTheDocument();
    expect(within(rows).getAllByRole("presentation")).toHaveLength(10);
  });

  test("renders the board child unchanged", () => {
    render(
      <BoardCoordLabels>
        <div data-testid="inner">inner</div>
      </BoardCoordLabels>,
    );
    expect(screen.getByTestId("inner")).toBeInTheDocument();
  });

  test("labels use the mono font utility", () => {
    render(
      <BoardCoordLabels>
        <div />
      </BoardCoordLabels>,
    );
    expect(screen.getByTestId("board-coords-top").className).toMatch(/font-mono/);
    expect(screen.getByTestId("board-coords-left").className).toMatch(/font-mono/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- --run tests/unit/components/game/BoardCoordLabels.test.tsx`
Expected: the import fails — `BoardCoordLabels` does not exist yet.

- [ ] **Step 3: Create the component**

Create `components/game/BoardCoordLabels.tsx`:

```tsx
import type { ReactNode } from "react";

const COLS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
const ROWS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

interface BoardCoordLabelsProps {
  children: ReactNode;
}

export function BoardCoordLabels({ children }: BoardCoordLabelsProps) {
  return (
    <div className="board-coords">
      <div
        data-testid="board-coords-top"
        className="board-coords__top font-mono text-[9px] uppercase tracking-[0.06em] text-ink-soft"
      >
        {COLS.map((c) => (
          <span key={c} role="presentation">
            {c}
          </span>
        ))}
      </div>
      <div
        data-testid="board-coords-left"
        className="board-coords__left font-mono text-[9px] uppercase tracking-[0.06em] text-ink-soft"
      >
        {ROWS.map((r) => (
          <span key={r} role="presentation">
            {r}
          </span>
        ))}
      </div>
      <div className="board-coords__board">{children}</div>
    </div>
  );
}
```

- [ ] **Step 4: Add the layout CSS**

Append to `app/styles/board.css` (at the bottom):

```css
/* Board coord labels (A–J columns, 1–10 rows) — Phase 1b */
.board-coords {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: auto 1fr;
  gap: 0.25rem 0.25rem;
}
.board-coords__top {
  grid-column: 2;
  grid-row: 1;
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  padding: 0 var(--board-grid-gap, 0.5rem);
}
.board-coords__left {
  grid-column: 1;
  grid-row: 2;
  display: grid;
  grid-template-rows: repeat(10, 1fr);
  padding: var(--board-grid-gap, 0.5rem) 0;
}
.board-coords__top > span,
.board-coords__left > span {
  display: flex;
  align-items: center;
  justify-content: center;
}
.board-coords__board {
  grid-column: 2;
  grid-row: 2;
  min-width: 0;
}
```

- [ ] **Step 5: Run the test**

Run: `pnpm test -- --run tests/unit/components/game/BoardCoordLabels.test.tsx`
Expected: all 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git add components/game/BoardCoordLabels.tsx tests/unit/components/game/BoardCoordLabels.test.tsx app/styles/board.css
git commit -m "feat(match): add BoardCoordLabels wrapper with A–J / 1–10 edges

Pure presentational wrapper. A-J spans along the top, 1-10 along the
left, mono 9px ink-soft. Board content slots into the main grid cell."
```

---

## Task 3: Mount `BoardCoordLabels` around `BoardGrid`

**Files:**

- Modify: `components/game/Board.tsx`

`Board.tsx` currently renders `<BoardGrid … />` directly inside a `<div className="space-y-4">`. Wrap `BoardGrid` with `BoardCoordLabels`.

- [ ] **Step 1: Write a failing integration test**

Append a new file `tests/unit/components/game/BoardIntegration.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

vi.mock("@/components/game/BoardGrid", () => ({
  BoardGrid: () => <div data-testid="board-grid-stub" />,
}));

import { Board } from "@/components/game/Board";

const emptyGrid = Array.from({ length: 10 }, () =>
  Array.from({ length: 10 }, () => "A"),
) as string[][];

describe("Board composition", () => {
  test("wraps BoardGrid with BoardCoordLabels", () => {
    render(<Board initialGrid={emptyGrid} matchId="m-1" />);
    expect(screen.getByTestId("board-coords-top")).toBeInTheDocument();
    expect(screen.getByTestId("board-coords-left")).toBeInTheDocument();
    expect(screen.getByTestId("board-grid-stub")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- --run tests/unit/components/game/BoardIntegration.test.tsx`
Expected: both `board-coords-*` lookups fail.

- [ ] **Step 3: Update `components/game/Board.tsx`**

Find the existing import block and add:

```tsx
import { BoardCoordLabels } from "./BoardCoordLabels";
```

Find the returned JSX:

```tsx
  return (
    <div className="space-y-4">
      <BoardGrid
        grid={grid}
        matchId={matchId}
        onSwapComplete={handleSwapComplete}
        onSwapError={handleSwapError}
      />
      <MoveFeedback feedback={feedback} onDismiss={dismissFeedback} />
    </div>
  );
```

Replace with:

```tsx
  return (
    <div className="space-y-4">
      <BoardCoordLabels>
        <BoardGrid
          grid={grid}
          matchId={matchId}
          onSwapComplete={handleSwapComplete}
          onSwapError={handleSwapError}
        />
      </BoardCoordLabels>
      <MoveFeedback feedback={feedback} onDismiss={dismissFeedback} />
    </div>
  );
```

- [ ] **Step 4: Run the test**

Run: `pnpm test -- --run tests/unit/components/game/BoardIntegration.test.tsx`
Expected: the three assertions pass.

- [ ] **Step 5: Full unit suite + typecheck**

```
pnpm test -- --run
pnpm typecheck
```

Both pass.

- [ ] **Step 6: Commit**

```bash
git add components/game/Board.tsx tests/unit/components/game/BoardIntegration.test.tsx
git commit -m "feat(match): wrap BoardGrid with BoardCoordLabels

A-J column and 1-10 row labels now appear along the board edges on
every match screen."
```

---

## Task 4: `RoundPipBar` component

**Files:**

- Create: `components/match/RoundPipBar.tsx`
- Create: `tests/unit/components/match/RoundPipBar.test.tsx`

Ten horizontal pips. The first `current - 1` pips are `done` (ink-2). Pip `current` is `ochre-deep`, 5px tall (others are 3px). Remaining pips are `hair-strong`. The bar has an ARIA label "Round N of M".

- [ ] **Step 1: Write the failing test**

Create `tests/unit/components/match/RoundPipBar.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { RoundPipBar } from "@/components/match/RoundPipBar";

describe("RoundPipBar", () => {
  test("renders a pip per total rounds", () => {
    render(<RoundPipBar current={1} total={10} />);
    const bar = screen.getByTestId("round-pip-bar");
    expect(within(bar).getAllByTestId("round-pip")).toHaveLength(10);
  });

  test("aria-label describes current/total", () => {
    render(<RoundPipBar current={7} total={10} />);
    expect(
      screen.getByLabelText("Round 7 of 10"),
    ).toBeInTheDocument();
  });

  test("pips before `current` have the done state", () => {
    render(<RoundPipBar current={3} total={10} />);
    const pips = screen.getAllByTestId("round-pip");
    expect(pips[0].dataset.state).toBe("done");
    expect(pips[1].dataset.state).toBe("done");
  });

  test("pip at index `current - 1` is the current pip", () => {
    render(<RoundPipBar current={3} total={10} />);
    const pips = screen.getAllByTestId("round-pip");
    expect(pips[2].dataset.state).toBe("current");
  });

  test("pips after `current` have the future state", () => {
    render(<RoundPipBar current={3} total={10} />);
    const pips = screen.getAllByTestId("round-pip");
    expect(pips[3].dataset.state).toBe("future");
    expect(pips[9].dataset.state).toBe("future");
  });

  test("accepts total > 10", () => {
    render(<RoundPipBar current={12} total={15} />);
    const pips = screen.getAllByTestId("round-pip");
    expect(pips).toHaveLength(15);
    expect(pips[11].dataset.state).toBe("current");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- --run tests/unit/components/match/RoundPipBar.test.tsx`
Expected: import fails — component doesn't exist.

- [ ] **Step 3: Create the component**

Create `components/match/RoundPipBar.tsx`:

```tsx
interface RoundPipBarProps {
  current: number;
  total: number;
}

function pipState(index: number, current: number): "done" | "current" | "future" {
  if (index < current - 1) return "done";
  if (index === current - 1) return "current";
  return "future";
}

const PIP_CLASSES: Record<"done" | "current" | "future", string> = {
  done: "h-[3px] bg-ink-2",
  current: "h-[5px] bg-ochre-deep",
  future: "h-[3px] bg-hair-strong",
};

export function RoundPipBar({ current, total }: RoundPipBarProps) {
  return (
    <div
      data-testid="round-pip-bar"
      role="progressbar"
      aria-label={`Round ${current} of ${total}`}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current}
      className="flex items-center gap-1"
    >
      {Array.from({ length: total }, (_, i) => {
        const state = pipState(i, current);
        return (
          <span
            key={i}
            data-testid="round-pip"
            data-state={state}
            className={`w-[22px] rounded-[2px] transition-colors ${PIP_CLASSES[state]}`}
          />
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test -- --run tests/unit/components/match/RoundPipBar.test.tsx`
Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/match/RoundPipBar.tsx tests/unit/components/match/RoundPipBar.test.tsx
git commit -m "feat(match): add RoundPipBar progress indicator

Ten pips by default (configurable via total): done pips are 3px ink-2,
the current pip is 5px ochre-deep, future pips are 3px hair-strong.
Exposes an aria-live-friendly progressbar role and 'Round N of M' label."
```

---

## Task 5: Wire `RoundPipBar` into `PlayerPanel` full variant

**Files:**

- Modify: `components/match/PlayerPanel.tsx`
- Modify: `tests/unit/components/PlayerPanel.test.tsx`

Replace the "Round N / 10" text span with the new pip bar. The compact variant keeps the "R N" text since pips don't fit in the compact bar.

- [ ] **Step 1: Add the failing assertion**

Append a new test to the existing `describe("PlayerPanel full variant", …)` block in `tests/unit/components/PlayerPanel.test.tsx`, immediately after the existing "full variant uses paper surface and hair border" test:

```tsx
test("full variant renders a RoundPipBar for progress", () => {
  render(
    <PlayerPanel
      player={defaultPlayer}
      gameState={{ ...defaultGameState, currentRound: 7, totalRounds: 10 }}
      variant="full"
    />,
  );
  expect(screen.getByLabelText("Round 7 of 10")).toBeInTheDocument();
  expect(screen.queryByText("Round 7 / 10")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- --run tests/unit/components/PlayerPanel.test.tsx`
Expected: the new test fails.

- [ ] **Step 3: Update `components/match/PlayerPanel.tsx`**

Add the import near the other match-component imports at the top of the file:

```tsx
import { RoundPipBar } from "./RoundPipBar";
```

Find this line in `FullPanel` (near line 99):

```tsx
      <span data-testid="round-indicator" className="text-xs text-ink-soft">
        Round {gameState.currentRound} / {gameState.totalRounds}
      </span>
```

Replace with:

```tsx
      <div data-testid="round-indicator" className="w-full px-4">
        <RoundPipBar
          current={gameState.currentRound}
          total={gameState.totalRounds}
        />
      </div>
```

Leave `CompactPanel`'s `<span data-testid="round-indicator" …>R{gameState.currentRound}</span>` untouched.

- [ ] **Step 4: Run the test**

Run: `pnpm test -- --run tests/unit/components/PlayerPanel.test.tsx`
Expected: the new test passes. Verify the other existing tests in the file still pass — in particular any test that asserted on the `Round N / 10` text string. If one fails, update the assertion to `getByLabelText("Round N of 10")`.

- [ ] **Step 5: Full suite + typecheck**

```
pnpm test -- --run
pnpm typecheck
```

Both pass.

- [ ] **Step 6: Commit**

```bash
git add components/match/PlayerPanel.tsx tests/unit/components/PlayerPanel.test.tsx
git commit -m "feat(match): swap Round N / 10 text for RoundPipBar in PlayerPanel

Full variant only — the compact bar keeps the text label because pips
don't fit in the compact layout's horizontal space."
```

---

## Task 6: `TilesClaimedCard` component

**Files:**

- Create: `components/match/TilesClaimedCard.tsx`
- Create: `tests/unit/components/match/TilesClaimedCard.test.tsx`

Renders a card with "Tiles claimed" eyebrow, two labelled counts (You / Opponent), and a three-segment progress bar (you / opponent / remaining). Takes `frozenTiles: FrozenTileMap`, `currentPlayerSlot: "player_a" | "player_b"`, `boardSize: number = 100` (default 10×10).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/components/match/TilesClaimedCard.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { TilesClaimedCard } from "@/components/match/TilesClaimedCard";
import type { FrozenTileMap } from "@/lib/types/match";

function frozen(ownerByKey: Record<string, "player_a" | "player_b">): FrozenTileMap {
  return Object.fromEntries(
    Object.entries(ownerByKey).map(([k, owner]) => [k, { owner }]),
  );
}

describe("TilesClaimedCard", () => {
  test("counts the current player's frozen tiles", () => {
    const tiles = frozen({ "0,0": "player_a", "1,0": "player_a", "2,0": "player_b" });
    render(
      <TilesClaimedCard
        frozenTiles={tiles}
        currentPlayerSlot="player_a"
      />,
    );
    const youBlock = screen.getByTestId("tiles-claimed-you");
    const oppBlock = screen.getByTestId("tiles-claimed-opponent");
    expect(youBlock).toHaveTextContent("2");
    expect(oppBlock).toHaveTextContent("1");
  });

  test("swaps the perspective when current slot is player_b", () => {
    const tiles = frozen({ "0,0": "player_a", "1,0": "player_a", "2,0": "player_b" });
    render(
      <TilesClaimedCard
        frozenTiles={tiles}
        currentPlayerSlot="player_b"
      />,
    );
    expect(screen.getByTestId("tiles-claimed-you")).toHaveTextContent("1");
    expect(screen.getByTestId("tiles-claimed-opponent")).toHaveTextContent("2");
  });

  test("renders three progress segments sized by count", () => {
    const tiles = frozen({ "0,0": "player_a", "1,0": "player_a", "2,0": "player_b" });
    render(
      <TilesClaimedCard
        frozenTiles={tiles}
        currentPlayerSlot="player_a"
        boardSize={100}
      />,
    );
    const bar = screen.getByTestId("tiles-claimed-bar");
    const segs = bar.querySelectorAll("[data-testid='tiles-claimed-segment']");
    expect(segs).toHaveLength(3);
    expect(segs[0].getAttribute("data-count")).toBe("2");
    expect(segs[1].getAttribute("data-count")).toBe("1");
    expect(segs[2].getAttribute("data-count")).toBe("97");
  });

  test("handles empty frozenTiles", () => {
    render(
      <TilesClaimedCard
        frozenTiles={{}}
        currentPlayerSlot="player_a"
      />,
    );
    expect(screen.getByTestId("tiles-claimed-you")).toHaveTextContent("0");
    expect(screen.getByTestId("tiles-claimed-opponent")).toHaveTextContent("0");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- --run tests/unit/components/match/TilesClaimedCard.test.tsx`
Expected: import fails.

- [ ] **Step 3: Create the component**

Create `components/match/TilesClaimedCard.tsx`:

```tsx
import type { FrozenTileMap, FrozenTileOwner } from "@/lib/types/match";

interface TilesClaimedCardProps {
  frozenTiles: FrozenTileMap;
  currentPlayerSlot: FrozenTileOwner;
  boardSize?: number;
}

function countByOwner(tiles: FrozenTileMap): Record<FrozenTileOwner, number> {
  let a = 0;
  let b = 0;
  for (const key in tiles) {
    if (tiles[key].owner === "player_a") a += 1;
    else b += 1;
  }
  return { player_a: a, player_b: b };
}

export function TilesClaimedCard({
  frozenTiles,
  currentPlayerSlot,
  boardSize = 100,
}: TilesClaimedCardProps) {
  const counts = countByOwner(frozenTiles);
  const youCount = counts[currentPlayerSlot];
  const oppSlot: FrozenTileOwner =
    currentPlayerSlot === "player_a" ? "player_b" : "player_a";
  const oppCount = counts[oppSlot];
  const remaining = Math.max(0, boardSize - youCount - oppCount);

  const youClass =
    currentPlayerSlot === "player_a" ? "bg-p1" : "bg-p2";
  const oppClass = currentPlayerSlot === "player_a" ? "bg-p2" : "bg-p1";

  return (
    <div
      data-testid="tiles-claimed-card"
      className="rounded-xl border border-hair bg-paper p-4 shadow-wottle-sm"
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
        Tiles claimed
      </div>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <div data-testid="tiles-claimed-you">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
            You
          </div>
          <div
            className={`font-display text-[32px] italic leading-none ${
              currentPlayerSlot === "player_a" ? "text-p1-deep" : "text-p2-deep"
            }`}
          >
            {youCount}
          </div>
        </div>
        <div data-testid="tiles-claimed-opponent">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
            Opponent
          </div>
          <div
            className={`font-display text-[32px] italic leading-none ${
              oppSlot === "player_a" ? "text-p1-deep" : "text-p2-deep"
            }`}
          >
            {oppCount}
          </div>
        </div>
      </div>
      <div
        data-testid="tiles-claimed-bar"
        className="mt-3 flex h-1.5 gap-1 overflow-hidden rounded"
      >
        <div
          data-testid="tiles-claimed-segment"
          data-count={youCount}
          className={youClass}
          style={{ flex: youCount }}
        />
        <div
          data-testid="tiles-claimed-segment"
          data-count={oppCount}
          className={oppClass}
          style={{ flex: oppCount }}
        />
        <div
          data-testid="tiles-claimed-segment"
          data-count={remaining}
          className="bg-paper-3"
          style={{ flex: remaining }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test**

Run: `pnpm test -- --run tests/unit/components/match/TilesClaimedCard.test.tsx`
Expected: 4 passing tests.

- [ ] **Step 5: Commit**

```bash
git add components/match/TilesClaimedCard.tsx tests/unit/components/match/TilesClaimedCard.test.tsx
git commit -m "feat(match): add TilesClaimedCard widget

Derives per-player frozen-tile counts from FrozenTileMap, renders italic
Fraunces numerals plus a three-segment progress bar (you / opponent /
remaining) tinted to match the p1/p2 palette."
```

---

## Task 7: Mount `TilesClaimedCard` in `MatchClient` right rail

**Files:**

- Modify: `components/match/MatchClient.tsx`

Add the card inside the existing right-rail container below the opponent `PlayerPanel`.

- [ ] **Step 1: Sanity-check the insertion point**

Run: `grep -n "match-layout__panel--right" components/match/MatchClient.tsx`

Expected: one match around line 805. Verify the right-rail block looks like:

```tsx
        <div className="match-layout__panel match-layout__panel--right">
          <PlayerPanel
            player={…}
            …
            variant="full"
            isDisconnected={…}
          />
        </div>
```

- [ ] **Step 2: Add the import**

Near the other match-component imports at the top of `components/match/MatchClient.tsx`, add:

```tsx
import { TilesClaimedCard } from "@/components/match/TilesClaimedCard";
```

- [ ] **Step 3: Insert `<TilesClaimedCard … />` in the right rail**

Find the right-rail block (see Step 1). Replace:

```tsx
        <div className="match-layout__panel match-layout__panel--right">
          <PlayerPanel
            player={opponentSlot === "player_a" ? playerProfiles.playerA : playerProfiles.playerB}
            gameState={{
              score: opponentScore,
              timerSeconds: opponentTimeLeft,
              isPaused: opponentTimer.status !== "running",
              hasSubmitted: opponentTimer.status === "paused",
              currentRound: matchState.currentRound,
              totalRounds: 10,
              playerColor: getPlayerColors(opponentSlot).hex,
            }}
            roundHistory={{
              playerId: opponentTimer.playerId,
              accumulatedWords,
              completedRounds,
            }}
            variant="full"
            isDisconnected={matchState.disconnectedPlayerId === opponentTimer.playerId}
          />
        </div>
```

With:

```tsx
        <div className="match-layout__panel match-layout__panel--right flex flex-col gap-3">
          <PlayerPanel
            player={opponentSlot === "player_a" ? playerProfiles.playerA : playerProfiles.playerB}
            gameState={{
              score: opponentScore,
              timerSeconds: opponentTimeLeft,
              isPaused: opponentTimer.status !== "running",
              hasSubmitted: opponentTimer.status === "paused",
              currentRound: matchState.currentRound,
              totalRounds: 10,
              playerColor: getPlayerColors(opponentSlot).hex,
            }}
            roundHistory={{
              playerId: opponentTimer.playerId,
              accumulatedWords,
              completedRounds,
            }}
            variant="full"
            isDisconnected={matchState.disconnectedPlayerId === opponentTimer.playerId}
          />
          <TilesClaimedCard
            frozenTiles={matchState.frozenTiles ?? {}}
            currentPlayerSlot={playerSlot}
          />
        </div>
```

(The `flex flex-col gap-3` is added so the card stacks cleanly below the panel.)

- [ ] **Step 4: Full suite + typecheck**

```
pnpm test -- --run
pnpm typecheck
```

Both pass. `playerSlot` is already in scope in `MatchClient` — no additional wiring needed.

- [ ] **Step 5: Commit**

```bash
git add components/match/MatchClient.tsx
git commit -m "feat(match): mount TilesClaimedCard in right rail

Card sits below the opponent panel, reads from matchState.frozenTiles
and playerSlot. No behavioural change to the panel or board."
```

---

## Task 8: Playwright `@match-surfaces` smoke

**Files:**

- Create: `tests/integration/ui/match-surfaces.spec.ts`

One smoke that opens an existing match fixture flow, confirms coord labels render, confirms the pip bar is present with the correct aria label, and confirms the tiles-claimed card is visible.

- [ ] **Step 1: Find a match-flow helper**

Run: `grep -rn "match-shell\|loadMatchState\|two-player-playtest" tests/integration/ui/helpers/ | head -5`

The existing helpers in `tests/integration/ui/helpers/matchmaking.ts` already set up a two-player match. Reuse them via import.

- [ ] **Step 2: Write the test**

Create `tests/integration/ui/match-surfaces.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

import { startMatchWithRetry } from "./helpers/matchmaking";

test.describe("@match-surfaces Phase 1b visuals", () => {
  test("board edges show A-J and 1-10 coord labels", async ({ browser }) => {
    const { pageA, cleanup } = await startMatchWithRetry(browser);
    try {
      const top = pageA.getByTestId("board-coords-top");
      await expect(top).toBeVisible();
      await expect(top.getByText("A", { exact: true })).toBeVisible();
      await expect(top.getByText("J", { exact: true })).toBeVisible();

      const left = pageA.getByTestId("board-coords-left");
      await expect(left).toBeVisible();
      await expect(left.getByText("1", { exact: true })).toBeVisible();
      await expect(left.getByText("10", { exact: true })).toBeVisible();
    } finally {
      await cleanup();
    }
  });

  test("player panel shows a pip progress bar", async ({ browser }) => {
    const { pageA, cleanup } = await startMatchWithRetry(browser);
    try {
      await expect(pageA.getByLabel(/Round \d+ of \d+/)).toBeVisible();
      const pips = pageA.getByTestId("round-pip");
      await expect(pips.first()).toBeVisible();
    } finally {
      await cleanup();
    }
  });

  test("right rail shows the tiles-claimed card", async ({ browser }) => {
    const { pageA, cleanup } = await startMatchWithRetry(browser);
    try {
      const card = pageA.getByTestId("tiles-claimed-card");
      await expect(card).toBeVisible();
      await expect(card.getByText("Tiles claimed")).toBeVisible();
      await expect(card.getByTestId("tiles-claimed-you")).toBeVisible();
      await expect(card.getByTestId("tiles-claimed-opponent")).toBeVisible();
    } finally {
      await cleanup();
    }
  });
});
```

`startMatchWithRetry` is defined in `tests/integration/ui/helpers/matchmaking.ts`. Before running, open that helper file and read its return shape — if it returns something other than `{ pageA, cleanup }` (e.g., `{ page1, page2, close }`), adjust the destructuring in each test to match. Keep the assertions identical.

- [ ] **Step 3: Run the test**

Run: `pnpm exec playwright test --grep @match-surfaces`
Expected: 3/3 tests pass in chromium (firefox included if config auto-enables it). If the dev server / Supabase fails to start, record the error and commit the file with a DONE_WITH_CONCERNS note — do not attempt to debug service startup here.

- [ ] **Step 4: Commit**

```bash
git add tests/integration/ui/match-surfaces.spec.ts
git commit -m "test(match): Playwright smoke for coord labels, pip bar, tiles claimed card

Locks in the Phase 1b visible surfaces by asserting each appears in a
live two-player-match fixture flow."
```

---

## Task 9: Full verification sweep

- [ ] **Step 1: Run the complete unit suite**

Run: `pnpm test -- --run`
Expected: all unit tests pass (~720+ tests).

- [ ] **Step 2: Run the full Playwright suite**

Run: `pnpm exec playwright test`
Expected: all tests pass. If a Playwright spec asserts a specific colour / shadow that was changed by the letterpress task, update the assertion to the new expected value in a targeted commit.

- [ ] **Step 3: Run lint + typecheck**

```
pnpm lint
pnpm typecheck
```

Both must exit 0. (If `pnpm lint` breaks on a `minimatch` error, re-run `pnpm install` in the worktree to ensure a real `node_modules` exists — this was a Phase 1a learning.)

- [ ] **Step 4: Manual visual sanity check**

Run `pnpm dev` and open `/match/<match-id>` with a live match. Confirm:

- Board tiles have a cream-paper letterpress feel (top highlight, bottom shadow, subtle ink outline).
- A–J labels sit along the top of the board; 1–10 labels sit along the left.
- Full-variant `PlayerPanel` shows a 10-pip progress bar below the score (no longer "Round N / 10" text).
- Right rail shows the "Tiles claimed" card below the opponent panel with two counts + a progress bar.
- Compact (mobile) bars still show the "R N" text and no pip bar (intentional).

If anything reads poorly, file a follow-up — do NOT attempt extra visual fixes in this plan.

- [ ] **Step 5: Commit nothing (or targeted regressions only)**

If any assertion updates were required during Step 2, those are their own commit messages. Otherwise no new commit needed.

---

## Self-Review Checklist

- [x] Every in-scope bullet (letterpress / coords / pip / tiles-claimed) has an explicit task.
- [x] The deferred-to-1c bullets (HUD classic refresh, left rail cards) are listed in the scope-decisions section so nothing is silently dropped.
- [x] Each task follows TDD red → green → commit.
- [x] No placeholders ("TBD", "appropriate", "similar to"), no unreferenced types or functions.
- [x] `FrozenTileMap` / `FrozenTileOwner` type usage is consistent with the existing `lib/types/match.ts` export names.
- [x] `RoundPipBar` test data-attribute contract (`data-state`, `data-testid="round-pip"`) is locked in tests and consumed by the component.
- [x] `TilesClaimedCard` segment test (`data-count`) is locked in tests and consumed by the component.
- [x] The Playwright smoke is fenced behind an `@match-surfaces` grep so it can be run quickly in isolation.
- [x] Task 9 verifies the plan holistically with concrete visual checks.

---

## Out-of-scope (deferred to Phase 1c)

- **HUD classic refresh** — `PlayerPanel` full variant restructured as a prototype `.hud-card`: left-stripe accent (`::after` with `p1` / `p2` background), avatar + name stacked horizontally, italic Fraunces 34px score, mono clock pill. Plus moving both panels to a top-spanning strip in `.match-layout` instead of left/right rails.
- **Left rail instructional cards** — "How to play", "Legend", "Your move" cards rendered in a new left-rail container.

Both require `.match-layout` restructuring and touch the most-tested components. Ship them as Phase 1c after Phase 1b merges so the additive changes land cleanly first.
