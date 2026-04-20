# Phase 1c — HUD Classic & Layout Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the match screen into a top-spanning horizontal HUD (opponent card · center chrome · current-player card) with a secondary row for the board plus right rail, replacing the vertical left/right `PlayerPanel` full variants. Deliver the prototype's Warm Editorial `.hud-card` look: paper surface, left-stripe player accent, italic Fraunces score, mono clock pill.

**Architecture:** Introduce two new components — `HudCard` (horizontal paper-surfaced card with slot-coloured left stripe) and `MatchCenterChrome` (eyebrow + round pip bar + turn-status text) — and mount them in a new two-row `.match-layout` (`top-strip` + `board-row`). Existing mobile compact bars (`match-layout__compact-top/bottom`) stay. `PlayerPanel` compact variant stays; the full variant becomes unused on desktop but is kept in the file for now to avoid churn. `RoundPipBar` moves out of `PlayerPanel` (where Phase 1b wired it) and into `MatchCenterChrome` — a single shared bar between the two HUD cards.

**Tech Stack:** Tailwind CSS 4 (uses Phase 1a tokens), React 19, Next.js 16 App Router, Vitest + React Testing Library, Playwright.

**Branch:** `025-hud-classic-phase-1c`, branched from `origin/main` (Phase 1b and hotfixes #106/#107/#108 are already merged).

**Prerequisites:**

- Read spec `docs/superpowers/specs/2026-04-19-wottle-design-implementation.md` §4 Phase 1.
- Read Phase 1b plan `docs/superpowers/plans/2026-04-19-phase-1b-match-surfaces.md` — its out-of-scope section defines what this plan picks up.
- Prototype reference: `/tmp/wottle-design/wottle-game-design/project/prototype/styles.css` lines 306–366 (`.hud-card`, `.avatar`, `.hud-name`, `.hud-meta`, `.hud-score`, `.hud-clock`). Prototype Match.jsx lines 53–84 show the classic HUD structure.

**Test commands (run after every task):**

- `pnpm lint` — zero warnings.
- `pnpm typecheck` — exit 0.
- `pnpm test -- --run` — unit suite.
- `pnpm exec playwright test --grep @hud-classic` — new Playwright tag added in Task 7.

---

## Scope decisions

**In scope (this plan):**

1. `HudCard` component — horizontal layout with avatar, name + meta, clock pill, italic Fraunces score, optional children slot, slot-coloured left stripe.
2. `MatchCenterChrome` component — eyebrow "Round N / M", shared `RoundPipBar`, status text ("YOUR MOVE · SWAP TWO TILES" / "WAITING FOR OPPONENT" / "RESOLVING ROUND").
3. New `.match-layout` CSS on desktop (≥ 900px) — two rows: top HUD strip (opp · center · you) and board row (left-rail placeholder · board · right rail).
4. `MatchClient` composition rewired to use the new structure.
5. `RoundPipBar` removed from `PlayerPanel` full variant; the single shared pip bar lives in `MatchCenterChrome`.
6. `TilesClaimedCard` stays in the layout — moves from the left rail (Phase 1b hotfix #108) to the right rail under the current-player side, since the current-player HUD card now sits on the right of the top strip and the rail below it is the right rail.
7. Current-player controls (History / Resign) — rendered as a small secondary row below the current-player `HudCard`.
8. `@hud-classic` Playwright smoke.

**Deferred to Phase 1d:**

- Left-rail instructional cards — "How to play", "Legend", "Your move" (selected-tile coords + submitted status).
- Replacing the existing History overlay portal with an inline right-rail round log (the overlay still works via the existing history button in Phase 1c).
- Removing or consolidating `PlayerPanel`'s now-unused full variant code path (leave it in place until Phase 1d to minimise churn).

**Not touched by this plan:**

- Mobile compact bars (`match-layout__compact-top/bottom`) — behaviour and appearance preserved.
- `BoardGrid`, `BoardCoordLabels`, letterpress CSS from Phase 1b.
- Frozen-tile overlay colours (stay as the dark-mode rgba values for now; a Phase 1c or later cleanup can migrate to `p1`/`p2` token tints).
- `RoundHistoryPanel` overlay — the history button still opens it.

---

## File Structure

**Create:**

- `components/match/HudCard.tsx` — horizontal HUD card (avatar + name/meta + clock pill + italic score + left-stripe accent + optional children).
- `tests/unit/components/match/HudCard.test.tsx` — unit tests.
- `components/match/MatchCenterChrome.tsx` — eyebrow + RoundPipBar + status text.
- `tests/unit/components/match/MatchCenterChrome.test.tsx` — unit tests.
- `tests/integration/ui/hud-classic.spec.ts` — Playwright smoke.

**Modify:**

- `app/styles/board.css` — add `.hud-card` + related classes; rewrite `.match-layout` desktop rules for the new two-row structure.
- `components/match/PlayerPanel.tsx` — remove the `<RoundPipBar />` mount from the full variant (pip bar now lives in `MatchCenterChrome`); full variant continues to exist but is no longer mounted by `MatchClient`'s desktop layout.
- `tests/unit/components/PlayerPanel.test.tsx` — drop the `RoundPipBar` assertion that was added in Phase 1b (the full variant no longer renders it).
- `components/match/MatchClient.tsx` — replace the desktop `match-layout__panel--left` / `--right` blocks with a top HUD strip (`HudCard` × 2 + `MatchCenterChrome`) plus a board row (left rail placeholder + board area + right rail with `TilesClaimedCard`). Keep mobile compact bars intact.

**Not created (Phase 1d territory):**

- `components/match/HowToPlayCard.tsx`
- `components/match/LegendCard.tsx`
- `components/match/YourMoveCard.tsx`
- `components/match/MatchLeftRail.tsx`

---

## Task 1: Add `.hud-card` CSS

**Files:**

- Modify: `app/styles/board.css` (append new block after the existing `.match-layout` rules).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/styles/hud-card-css.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const boardCss = readFileSync(
  resolve(__dirname, "../../../app/styles/board.css"),
  "utf-8",
);

describe(".hud-card CSS", () => {
  test("declares .hud-card with paper background and hair border", () => {
    const block = boardCss.match(/\.hud-card\s*\{[^}]*\}/s);
    expect(block).not.toBeNull();
    expect(block?.[0]).toMatch(/background:\s*var\(--paper\)/);
    expect(block?.[0]).toMatch(/border:\s*1px solid var\(--hair\)/);
  });

  test("declares .hud-card--you::after stripe using var(--p1)", () => {
    expect(boardCss).toMatch(
      /\.hud-card--you::after\s*\{[^}]*background:\s*var\(--p1\)/s,
    );
  });

  test("declares .hud-card--opp::after stripe using var(--p2)", () => {
    expect(boardCss).toMatch(
      /\.hud-card--opp::after\s*\{[^}]*background:\s*var\(--p2\)/s,
    );
  });

  test("declares .hud-card__score with font-display italic", () => {
    const block = boardCss.match(/\.hud-card__score\s*\{[^}]*\}/s);
    expect(block).not.toBeNull();
    expect(block?.[0]).toMatch(/font-family:\s*var\(--font-fraunces\)/);
    expect(block?.[0]).toMatch(/font-style:\s*italic/);
  });

  test("declares .hud-card__clock with mono font + tabular-nums", () => {
    const block = boardCss.match(/\.hud-card__clock\s*\{[^}]*\}/s);
    expect(block).not.toBeNull();
    expect(block?.[0]).toMatch(/font-variant-numeric:\s*tabular-nums/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- --run tests/unit/styles/hud-card-css.test.ts`
Expected: 5 failures.

- [ ] **Step 3: Append the CSS to `app/styles/board.css`**

Append this block to the end of `app/styles/board.css`:

```css
/* ─── HUD card (Phase 1c) ───────────────────────────────────────────── */

.hud-card {
  position: relative;
  padding: 16px 18px;
  background: var(--paper);
  border: 1px solid var(--hair);
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 14px;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.hud-card--you::after,
.hud-card--opp::after {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  pointer-events: none;
}

.hud-card--you::after {
  background: var(--p1);
}

.hud-card--opp::after {
  background: var(--p2);
}

.hud-card__identity {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.hud-card__name {
  font-size: 15px;
  font-weight: 500;
  color: var(--ink);
  line-height: 1.1;
  max-width: 12rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hud-card__meta {
  font-family: var(--font-jetbrains-mono), ui-monospace, monospace;
  font-size: 10px;
  color: var(--ink-soft);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-top: 3px;
}

.hud-card__score {
  margin-left: auto;
  font-family: var(--font-fraunces), serif;
  font-style: italic;
  font-weight: 500;
  font-size: 34px;
  line-height: 1;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}

.hud-card__clock {
  font-family: var(--font-jetbrains-mono), ui-monospace, monospace;
  font-size: 15px;
  letter-spacing: 0.04em;
  color: var(--ink-2);
  padding: 5px 10px;
  border-radius: 6px;
  background: var(--paper-2);
  border: 1px solid var(--hair);
  font-variant-numeric: tabular-nums;
}

.hud-card__clock--active {
  background: color-mix(in oklab, var(--good) 15%, var(--paper));
  color: color-mix(in oklab, var(--good) 80%, var(--ink));
  border-color: color-mix(in oklab, var(--good) 40%, transparent);
}

.hud-card__clock--low {
  background: color-mix(in oklab, var(--bad) 12%, var(--paper));
  color: var(--bad);
  border-color: color-mix(in oklab, var(--bad) 40%, transparent);
}
```

- [ ] **Step 4: Run the test**

Run: `pnpm test -- --run tests/unit/styles/hud-card-css.test.ts`
Expected: all 5 pass.

- [ ] **Step 5: Full suite + typecheck**

```
pnpm test -- --run
pnpm typecheck
```

Both pass.

- [ ] **Step 6: Commit**

```bash
git add app/styles/board.css tests/unit/styles/hud-card-css.test.ts
git commit -m "feat(match): add .hud-card CSS for Phase 1c classic HUD

Paper surface, hair border, slot-coloured left stripe (p1 for current
player, p2 for opponent), italic Fraunces score, mono clock pill with
active/low states. Mirrors the prototype's .hud-card rules."
```

---

## Task 2: `HudCard` component

**Files:**

- Create: `components/match/HudCard.tsx`
- Create: `tests/unit/components/match/HudCard.test.tsx`

Accepts a single `slot: "you" | "opp"` prop that drives the left-stripe colour (via `.hud-card--you` or `.hud-card--opp`), plus renderable props for the avatar, name, meta, clock, score, and optional `children` (for scoreDelta popup or controls).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/components/match/HudCard.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { HudCard } from "@/components/match/HudCard";

describe("HudCard", () => {
  test("renders name, meta, score, clock", () => {
    render(
      <HudCard
        slot="you"
        avatar={<div data-testid="avatar" />}
        name="Ásta Kristín"
        meta="White · 1728"
        clock="2:00"
        score={198}
      />,
    );
    expect(screen.getByText("Ásta Kristín")).toBeInTheDocument();
    expect(screen.getByText("White · 1728")).toBeInTheDocument();
    expect(screen.getByText("2:00")).toBeInTheDocument();
    expect(screen.getByText("198")).toBeInTheDocument();
    expect(screen.getByTestId("avatar")).toBeInTheDocument();
  });

  test("applies hud-card--you for current player", () => {
    render(
      <HudCard
        slot="you"
        avatar={<div />}
        name="You"
        meta="m"
        clock="0:00"
        score={0}
      />,
    );
    const card = screen.getByTestId("hud-card");
    expect(card.className).toContain("hud-card--you");
    expect(card.className).not.toContain("hud-card--opp");
  });

  test("applies hud-card--opp for opponent", () => {
    render(
      <HudCard
        slot="opp"
        avatar={<div />}
        name="Them"
        meta="m"
        clock="0:00"
        score={0}
      />,
    );
    const card = screen.getByTestId("hud-card");
    expect(card.className).toContain("hud-card--opp");
  });

  test("supports active/low clock states", () => {
    const { rerender } = render(
      <HudCard
        slot="you"
        avatar={<div />}
        name="Y"
        meta="m"
        clock="2:00"
        clockState="active"
        score={0}
      />,
    );
    expect(screen.getByTestId("hud-card-clock").className).toContain(
      "hud-card__clock--active",
    );

    rerender(
      <HudCard
        slot="you"
        avatar={<div />}
        name="Y"
        meta="m"
        clock="0:30"
        clockState="low"
        score={0}
      />,
    );
    expect(screen.getByTestId("hud-card-clock").className).toContain(
      "hud-card__clock--low",
    );
  });

  test("renders children below identity block when provided", () => {
    render(
      <HudCard
        slot="you"
        avatar={<div />}
        name="Y"
        meta="m"
        clock="0:00"
        score={0}
      >
        <button data-testid="extra">Resign</button>
      </HudCard>,
    );
    expect(screen.getByTestId("extra")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- --run tests/unit/components/match/HudCard.test.tsx`
Expected: import fails.

- [ ] **Step 3: Create the component**

Create `components/match/HudCard.tsx`:

```tsx
import type { ReactNode } from "react";

type ClockState = "idle" | "active" | "low";

interface HudCardProps {
  slot: "you" | "opp";
  avatar: ReactNode;
  name: string;
  meta: string;
  clock: string;
  clockState?: ClockState;
  score: number;
  children?: ReactNode;
}

export function HudCard({
  slot,
  avatar,
  name,
  meta,
  clock,
  clockState = "idle",
  score,
  children,
}: HudCardProps) {
  const slotClass = slot === "you" ? "hud-card--you" : "hud-card--opp";
  const clockStateClass =
    clockState === "active"
      ? "hud-card__clock--active"
      : clockState === "low"
        ? "hud-card__clock--low"
        : "";

  return (
    <div data-testid="hud-card" className={`hud-card ${slotClass}`}>
      {avatar}
      <div className="hud-card__identity">
        <span className="hud-card__name" title={name}>
          {name}
        </span>
        <span className="hud-card__meta">{meta}</span>
      </div>
      <span
        data-testid="hud-card-clock"
        className={`hud-card__clock ${clockStateClass}`.trim()}
      >
        {clock}
      </span>
      <span className="hud-card__score">{score}</span>
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Run the test**

Run: `pnpm test -- --run tests/unit/components/match/HudCard.test.tsx`
Expected: all 5 tests pass.

- [ ] **Step 5: Full suite + typecheck**

```
pnpm test -- --run
pnpm typecheck
```

Both pass.

- [ ] **Step 6: Commit**

```bash
git add components/match/HudCard.tsx tests/unit/components/match/HudCard.test.tsx
git commit -m "feat(match): add HudCard component for Phase 1c classic HUD

Horizontal paper card with avatar, name + meta, mono clock pill with
active/low states, italic Fraunces score, and an optional children
slot for score-delta popups or controls. Slot prop ('you' or 'opp')
drives the left-stripe player colour."
```

---

## Task 3: `MatchCenterChrome` component

**Files:**

- Create: `components/match/MatchCenterChrome.tsx`
- Create: `tests/unit/components/match/MatchCenterChrome.test.tsx`

Renders the center column of the top HUD strip: eyebrow "Round N / M", the shared `RoundPipBar`, and a status label ("YOUR MOVE · SWAP TWO TILES" / "WAITING FOR OPPONENT" / "RESOLVING ROUND").

- [ ] **Step 1: Write the failing test**

Create `tests/unit/components/match/MatchCenterChrome.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { MatchCenterChrome } from "@/components/match/MatchCenterChrome";

describe("MatchCenterChrome", () => {
  test("renders the eyebrow with current/total rounds", () => {
    render(
      <MatchCenterChrome
        currentRound={3}
        totalRounds={10}
        status="your-move"
      />,
    );
    expect(screen.getByText("Round 3 / 10")).toBeInTheDocument();
  });

  test("renders the shared RoundPipBar", () => {
    render(
      <MatchCenterChrome
        currentRound={3}
        totalRounds={10}
        status="your-move"
      />,
    );
    expect(screen.getByLabelText("Round 3 of 10")).toBeInTheDocument();
  });

  test.each([
    ["your-move", "YOUR MOVE · SWAP TWO TILES"],
    ["waiting", "WAITING FOR OPPONENT"],
    ["resolving", "RESOLVING ROUND"],
  ] as const)("status=%s renders label %s", (status, expected) => {
    render(
      <MatchCenterChrome
        currentRound={1}
        totalRounds={10}
        status={status}
      />,
    );
    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- --run tests/unit/components/match/MatchCenterChrome.test.tsx`
Expected: import fails.

- [ ] **Step 3: Create the component**

Create `components/match/MatchCenterChrome.tsx`:

```tsx
import { RoundPipBar } from "./RoundPipBar";

type MatchStatus = "your-move" | "waiting" | "resolving";

interface MatchCenterChromeProps {
  currentRound: number;
  totalRounds: number;
  status: MatchStatus;
}

const STATUS_LABELS: Record<MatchStatus, string> = {
  "your-move": "YOUR MOVE · SWAP TWO TILES",
  waiting: "WAITING FOR OPPONENT",
  resolving: "RESOLVING ROUND",
};

export function MatchCenterChrome({
  currentRound,
  totalRounds,
  status,
}: MatchCenterChromeProps) {
  return (
    <div
      data-testid="match-center-chrome"
      className="flex flex-col items-center gap-2.5 px-4"
    >
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft">
        Round {currentRound} / {totalRounds}
      </span>
      <RoundPipBar current={currentRound} total={totalRounds} />
      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft">
        {STATUS_LABELS[status]}
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Run the test**

Run: `pnpm test -- --run tests/unit/components/match/MatchCenterChrome.test.tsx`
Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/match/MatchCenterChrome.tsx tests/unit/components/match/MatchCenterChrome.test.tsx
git commit -m "feat(match): add MatchCenterChrome for Phase 1c HUD centre column

Eyebrow 'Round N / M', shared RoundPipBar, and mono status label
('YOUR MOVE · SWAP TWO TILES', 'WAITING FOR OPPONENT', 'RESOLVING
ROUND'). Sits between the two HudCards in the top HUD strip."
```

---

## Task 4: Remove `RoundPipBar` from `PlayerPanel` full variant

**Files:**

- Modify: `components/match/PlayerPanel.tsx`
- Modify: `tests/unit/components/PlayerPanel.test.tsx`

The pip bar is now shared and lives in `MatchCenterChrome`. The full variant keeps the "Round N / 10" text — it's still used by any remaining full-variant consumers (though `MatchClient` stops using it in Task 5).

- [ ] **Step 1: Update the existing pip-bar test assertions**

In `tests/unit/components/PlayerPanel.test.tsx`, find the test added in Phase 1b:

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

Replace its body so it asserts the opposite (the full variant no longer renders the pip bar but does render the "Round N / 10" text it replaced):

```tsx
test("full variant renders 'Round N / M' text (pip bar moved to MatchCenterChrome)", () => {
  render(
    <PlayerPanel
      player={defaultPlayer}
      gameState={{ ...defaultGameState, currentRound: 7, totalRounds: 10 }}
      variant="full"
    />,
  );
  expect(screen.getByText("Round 7 / 10")).toBeInTheDocument();
  expect(screen.queryByLabelText("Round 7 of 10")).not.toBeInTheDocument();
});
```

Also locate the test added earlier in Phase 1b that used `getByLabelText(/Round 3 of 10/)` and restore it to the pre-Phase-1b text assertion:

```tsx
// Before Phase 1b this test was:
//   expect(screen.getByText("Round 3 / 10")).toBeInTheDocument();
// Restore that form now that the pip bar is no longer inside PlayerPanel.
```

(If multiple tests use `getByLabelText("Round 3 of 10")` style assertions, update each to `getByText("Round 3 / 10")`.)

- [ ] **Step 2: Run the tests to verify failures**

Run: `pnpm test -- --run tests/unit/components/PlayerPanel.test.tsx`
Expected: the updated tests fail because the pip bar still renders.

- [ ] **Step 3: Update `components/match/PlayerPanel.tsx`**

Remove the `RoundPipBar` import — find the line `import { RoundPipBar } from "./RoundPipBar";` and delete it.

In `FullPanel`, find:

```tsx
      <div data-testid="round-indicator" className="w-full px-4">
        <RoundPipBar
          current={gameState.currentRound}
          total={gameState.totalRounds}
        />
      </div>
```

Replace with:

```tsx
      <span data-testid="round-indicator" className="text-xs text-ink-soft">
        Round {gameState.currentRound} / {gameState.totalRounds}
      </span>
```

Leave `CompactPanel` untouched — it already uses a `R{gameState.currentRound}` text span.

- [ ] **Step 4: Run the tests**

Run: `pnpm test -- --run tests/unit/components/PlayerPanel.test.tsx`
Expected: all tests pass.

- [ ] **Step 5: Full suite + typecheck**

```
pnpm test -- --run
pnpm typecheck
```

Both pass.

- [ ] **Step 6: Commit**

```bash
git add components/match/PlayerPanel.tsx tests/unit/components/PlayerPanel.test.tsx
git commit -m "refactor(match): remove RoundPipBar from PlayerPanel full variant

The pip bar is now shared across both HUD cards and lives in
MatchCenterChrome. PlayerPanel full variant reverts to the text
'Round N / M' indicator (compact variant unchanged)."
```

---

## Task 5: New `.match-layout` CSS — top strip + board row

**Files:**

- Modify: `app/styles/board.css` (rewrite the desktop `@media (min-width: 900px)` block for `.match-layout`).

The existing desktop rule lays out the layout as a single horizontal flex row (left panel · board · right panel). Replace that with a CSS grid that stacks a top HUD strip over a board row. The board row is itself a three-column grid (left-rail placeholder · board · right rail).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/styles/match-layout-css.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- --run tests/unit/styles/match-layout-css.test.ts`
Expected: 4 failures.

- [ ] **Step 3: Find the existing `.match-layout` desktop block**

Open `app/styles/board.css` and locate the block that begins `@media (min-width: 900px) {` containing `.match-layout { flex-direction: row; … }`. The current block roughly spans lines 453–478 and looks like:

```css
@media (min-width: 900px) {
  .match-layout {
    flex-direction: row;
    align-items: flex-start;
    justify-content: center;
    gap: 1rem;
  }

  .match-layout__panel {
    display: block;
    width: 16rem;
    flex-shrink: 0;
  }

  .match-layout__board {
    --chrome-height: 48px;
    flex: 0 0 auto;
    width: min(calc(100dvh - var(--chrome-height) - 2rem), calc(100% - 30rem));
  }

  /* Hide compact bars on desktop */
  .match-layout__compact-top,
  .match-layout__compact-bottom {
    display: none;
  }
}
```

Replace that entire `@media (min-width: 900px) { … }` block with:

```css
@media (min-width: 900px) {
  .match-layout {
    display: grid;
    grid-template-rows: auto 1fr;
    gap: 1rem;
  }

  .match-layout__hud-strip {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 1.125rem;
    align-items: center;
  }

  .match-layout__board-row {
    display: grid;
    grid-template-columns: 18rem auto 20rem;
    gap: 1.5rem;
    align-items: start;
    justify-content: center;
  }

  .match-layout__rail--left,
  .match-layout__rail--right {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-width: 0;
  }

  .match-layout__board {
    --chrome-height: 48px;
    flex: 0 0 auto;
    width: min(calc(100dvh - var(--chrome-height) - 2rem), 38rem);
  }

  /* Hide compact bars on desktop */
  .match-layout__compact-top,
  .match-layout__compact-bottom {
    display: none;
  }

  /* Legacy left/right panel classes — no longer rendered by MatchClient,
     but kept so stray consumers render as hidden rather than breaking. */
  .match-layout__panel {
    display: none;
  }
}
```

Keep the mobile-default `.match-layout` flex column rules and the `.match-layout__panel { display: none }` default outside the media query intact — those sit above the desktop block and were:

```css
.match-layout {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.match-layout__board {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  min-width: 0;
}

.match-layout__panel {
  display: none;
}

.match-layout__compact-top,
.match-layout__compact-bottom {
  width: 100%;
}
```

The mobile-default `.match-layout` (flex column) still works with the new grid rules — it just won't be a grid until the media query kicks in.

- [ ] **Step 4: Run the test**

Run: `pnpm test -- --run tests/unit/styles/match-layout-css.test.ts`
Expected: all 4 pass.

- [ ] **Step 5: Full suite + typecheck**

```
pnpm test -- --run
pnpm typecheck
```

Both pass. Any existing tests that don't touch `.match-layout` CSS should continue to pass.

- [ ] **Step 6: Commit**

```bash
git add app/styles/board.css tests/unit/styles/match-layout-css.test.ts
git commit -m "feat(match): rewrite .match-layout for Phase 1c top-strip + board-row

Desktop layout becomes a two-row grid: top HUD strip (1fr auto 1fr for
opp / center / you) and board row (18rem · auto · 20rem for left rail,
board, right rail). Mobile layout unchanged — compact bars still stack
above/below the board."
```

---

## Task 6: Rewire `MatchClient` to the new layout

**Files:**

- Modify: `components/match/MatchClient.tsx`

Replace the two `match-layout__panel--left` / `--right` blocks (each currently rendering a full `<PlayerPanel variant="full">`) with a new top HUD strip (two `HudCard`s + `MatchCenterChrome`) and a bottom board row (left-rail placeholder + existing board area + right rail with `TilesClaimedCard`).

- [ ] **Step 1: Read the current composition**

Run: `grep -n "match-layout__panel\|TilesClaimedCard\|PlayerAvatar\|PLAYER_A_HEX" components/match/MatchClient.tsx | head -15`

You should see two `match-layout__panel` blocks (around lines 690 and 805–806 after Phase 1b + hotfix #108) and a single `TilesClaimedCard` under the left panel.

- [ ] **Step 2: Add imports**

Near the other match-component imports at the top of `components/match/MatchClient.tsx`, add:

```tsx
import { HudCard } from "@/components/match/HudCard";
import { MatchCenterChrome } from "@/components/match/MatchCenterChrome";
import { PlayerAvatar } from "@/components/match/PlayerAvatar";
```

(`PlayerAvatar` may already be imported via `PlayerPanel`. Verify with `grep -n "^import.*PlayerAvatar" components/match/MatchClient.tsx` — if present, skip that line. If not, add it.)

- [ ] **Step 3: Derive a status string near `playerSlot`**

Find the line where `playerSlot` is defined:

```tsx
const playerSlot: "player_a" | "player_b" =
  matchState.timers.playerA.playerId === currentPlayerId ? "player_a" : "player_b";
```

Immediately after the existing `opponentSlot` declaration a few lines below, add:

```tsx
const centerStatus: "your-move" | "waiting" | "resolving" =
  matchState.state === "resolving"
    ? "resolving"
    : currentTimer.status === "paused"
      ? "waiting"
      : "your-move";
```

- [ ] **Step 4: Replace the desktop layout JSX**

Find the top of the layout wrapper, which currently reads:

```tsx
      <div className="match-layout">
        {/* Desktop: left panel (current player) */}
        <div className="match-layout__panel match-layout__panel--left flex flex-col gap-3">
          <PlayerPanel ... variant="full" ... />
          <TilesClaimedCard ... />
        </div>

        {/* Board area */}
        <div className="match-layout__board">
          … (compact bars, BoardGrid, roundAnnounce, compact bars) …
        </div>

        {/* Desktop: right panel (opponent) */}
        <div className="match-layout__panel match-layout__panel--right">
          <PlayerPanel ... variant="full" ... />
        </div>
      </div>
```

Replace the surrounding structure so it becomes:

```tsx
      <div className="match-layout">
        {/* Desktop: top HUD strip (hidden on mobile) */}
        <div className="match-layout__hud-strip hidden lg:grid">
          <HudCard
            slot="opp"
            avatar={
              <PlayerAvatar
                displayName={(opponentSlot === "player_a" ? playerProfiles.playerA : playerProfiles.playerB).displayName}
                avatarUrl={(opponentSlot === "player_a" ? playerProfiles.playerA : playerProfiles.playerB).avatarUrl}
                playerColor={getPlayerColors(opponentSlot).hex}
                size="sm"
              />
            }
            name={(opponentSlot === "player_a" ? playerProfiles.playerA : playerProfiles.playerB).displayName}
            meta={`Opponent · ${(opponentSlot === "player_a" ? playerProfiles.playerA : playerProfiles.playerB).eloRating || "Unrated"}`}
            clock={formatClockMMSS(opponentTimeLeft)}
            clockState={deriveClockState(opponentTimer.status === "running", opponentTimeLeft < 60)}
            score={opponentScore}
          />
          <MatchCenterChrome
            currentRound={matchState.currentRound}
            totalRounds={10}
            status={centerStatus}
          />
          <HudCard
            slot="you"
            avatar={
              <PlayerAvatar
                displayName={(playerSlot === "player_a" ? playerProfiles.playerA : playerProfiles.playerB).displayName}
                avatarUrl={(playerSlot === "player_a" ? playerProfiles.playerA : playerProfiles.playerB).avatarUrl}
                playerColor={getPlayerColors(playerSlot).hex}
                size="sm"
              />
            }
            name={(playerSlot === "player_a" ? playerProfiles.playerA : playerProfiles.playerB).displayName}
            meta={`You · ${(playerSlot === "player_a" ? playerProfiles.playerA : playerProfiles.playerB).eloRating || "Unrated"}`}
            clock={formatClockMMSS(timeLeftSeconds)}
            clockState={deriveClockState(!isPaused, timeLeftSeconds < 60)}
            score={playerScore}
          >
            {scoreDelta ? (
              <ScoreDeltaPopup
                key={matchState.lastSummary?.roundNumber}
                delta={scoreDelta}
              />
            ) : null}
          </HudCard>
        </div>

        <div className="match-layout__board-row">
          {/* Left rail placeholder — Phase 1d fills it */}
          <div
            data-testid="match-layout-rail-left"
            className="match-layout__rail--left hidden lg:flex"
          />

          <div className="match-layout__board">
            {/* Mobile: compact opponent bar */}
            <div className="match-layout__compact-top" data-testid="game-chrome-opponent">
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
                variant="compact"
                isDisconnected={matchState.disconnectedPlayerId === opponentTimer.playerId}
              />
            </div>

            <BoardGrid
              grid={matchState.board}
              matchId={matchId}
              frozenTiles={matchState.frozenTiles ?? {}}
              playerSlot={playerSlot}
              disabled={moveLocked}
              showLockBanner={false}
              lockedTiles={lockedSwapTiles}
              opponentRevealTiles={
                animationPhase === "round-recap" && activeRevealMove
                  ? [activeRevealMove.from, activeRevealMove.to]
                  : null
              }
              scoredTileHighlights={
                animationPhase === "round-recap"
                  ? activeRevealHighlights
                  : []
              }
              highlightPlayerColors={
                animationPhase === "round-recap"
                  ? highlightPlayerColors
                  : {}
              }
              highlightDurationMs={animationPhase === "round-recap" ? (matchState.state === "completed" ? 2400 : 1200) : 800}
              highlightDelayMs={animationPhase === "round-recap" ? 450 : 0}
              onSwapComplete={handleSwapComplete}
              onSwapError={({ message }) => handleSwapError(message)}
              onTileSelect={playTileSelect}
              onValidSwap={() => { playValidSwap(); vibrateValidSwap(); }}
              onInvalidMove={() => { playInvalidMove(); vibrateInvalidMove(); }}
            />

            {roundAnnounce && (
              <div
                key={`${matchState.currentRound}-${roundAnnounce}`}
                className={`round-announce${roundAnnounce === "Rounds Complete" ? " round-announce--final" : ""}`}
                style={{ position: "absolute", top: "50%", left: "50%", zIndex: 25 }}
                data-testid="round-announce"
              >
                {roundAnnounce}
              </div>
            )}

            {/* Mobile: compact player bar */}
            <div className="match-layout__compact-bottom" data-testid="game-chrome-player">
              <PlayerPanel
                player={playerSlot === "player_a" ? playerProfiles.playerA : playerProfiles.playerB}
                gameState={{
                  score: playerScore,
                  timerSeconds: timeLeftSeconds,
                  isPaused,
                  hasSubmitted: currentTimer.status === "paused",
                  currentRound: matchState.currentRound,
                  totalRounds: 10,
                  playerColor: getPlayerColors(playerSlot).hex,
                }}
                variant="compact"
              />
            </div>
          </div>

          {/* Right rail — current-player-side widgets */}
          <div
            data-testid="match-layout-rail-right"
            className="match-layout__rail--right hidden lg:flex"
          >
            <TilesClaimedCard
              frozenTiles={matchState.frozenTiles ?? {}}
              currentPlayerSlot={playerSlot}
            />
            <div className="flex gap-2">
              {roundHistory.length > 0 && (
                <button
                  type="button"
                  onClick={() => setHistoryOpen((v) => !v)}
                  className="flex-1 rounded-lg border border-hair-strong px-3 py-2 text-sm text-ink-soft hover:bg-paper-2 hover:text-ink"
                  data-testid="hud-history-button"
                  aria-label="Round history"
                >
                  History ({roundHistory.length})
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowResignDialog(true)}
                disabled={
                  matchState.state === "resolving" ||
                  matchState.state === "completed" ||
                  isResigning
                }
                className="flex-1 rounded-lg border border-red-400/50 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40"
                data-testid="hud-resign-button"
                aria-label="Resign match"
              >
                Resign
              </button>
            </div>
          </div>
        </div>
      </div>
```

Two things to verify are *already in scope* in `MatchClient`:

- `formatClockMMSS` — likely already imported from `TimerDisplay` or inlined. If not, add the helper inline at the top of `MatchClient`:

  ```tsx
  function formatClockMMSS(seconds: number): string {
    const clamped = Math.max(0, Math.floor(seconds));
    const m = Math.floor(clamped / 60);
    const s = clamped % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }
  ```

- `deriveClockState` — new tiny helper. Add this at the top of `MatchClient` next to the other helpers:

  ```tsx
  function deriveClockState(isRunning: boolean, isLow: boolean): "idle" | "active" | "low" {
    if (isLow) return "low";
    if (isRunning) return "active";
    return "idle";
  }
  ```

- [ ] **Step 5: Run the full suite + typecheck**

```
pnpm test -- --run
pnpm typecheck
```

Existing `PlayerPanel` tests (compact variant) still pass. Any tests that assert on `match-layout__panel--left` / `--right` selectors will need updating — check `tests/integration/ui/` and fix any broken Playwright assertions to use `match-layout__rail--left` / `--right` where applicable. Do NOT mock or skip tests — if a test's DOM assumption is invalid after the refactor, update the assertion to the new structure and record the change in the commit message.

- [ ] **Step 6: Commit**

```bash
git add components/match/MatchClient.tsx
git commit -m "feat(match): rewire MatchClient to Phase 1c top-strip layout

Desktop: top HUD strip (opp HudCard · MatchCenterChrome · you HudCard)
over a board row (left-rail placeholder · board · right rail with
TilesClaimedCard + History/Resign controls). Mobile compact bars
preserved — they still stack above/below the board.

Legacy match-layout__panel--left / --right blocks removed; left rail
is an empty placeholder Phase 1d will fill with the instructional cards."
```

---

## Task 7: Playwright `@hud-classic` smoke

**Files:**

- Create: `tests/integration/ui/hud-classic.spec.ts`

- [ ] **Step 1: Inspect the helper**

Run: `grep -n "^export function" tests/integration/ui/helpers/matchmaking.ts | head -5`

Use `startMatchWithRetry` (or whichever helper returns a running match on `pageA`).

- [ ] **Step 2: Write the test**

Create `tests/integration/ui/hud-classic.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

import { startMatchWithRetry } from "./helpers/matchmaking";

test.describe("@hud-classic Phase 1c HUD", () => {
  test("top strip shows two HUD cards and a centre chrome", async ({
    browser,
  }) => {
    const { pageA, cleanup } = await startMatchWithRetry(browser);
    try {
      await expect(pageA.getByTestId("match-center-chrome")).toBeVisible();
      const hudCards = pageA.getByTestId("hud-card");
      await expect(hudCards).toHaveCount(2);
    } finally {
      await cleanup();
    }
  });

  test("HUD cards carry slot-coloured left stripe classes", async ({
    browser,
  }) => {
    const { pageA, cleanup } = await startMatchWithRetry(browser);
    try {
      const cards = pageA.getByTestId("hud-card");
      const firstClass = await cards.nth(0).getAttribute("class");
      const secondClass = await cards.nth(1).getAttribute("class");
      expect(firstClass).toMatch(/hud-card--opp/);
      expect(secondClass).toMatch(/hud-card--you/);
    } finally {
      await cleanup();
    }
  });

  test("right rail shows tiles-claimed and History+Resign buttons", async ({
    browser,
  }) => {
    const { pageA, cleanup } = await startMatchWithRetry(browser);
    try {
      const rightRail = pageA.getByTestId("match-layout-rail-right");
      await expect(rightRail).toBeVisible();
      await expect(
        rightRail.getByTestId("tiles-claimed-card"),
      ).toBeVisible();
      await expect(rightRail.getByTestId("hud-resign-button")).toBeVisible();
    } finally {
      await cleanup();
    }
  });

  test("left rail placeholder is present (Phase 1d will fill it)", async ({
    browser,
  }) => {
    const { pageA, cleanup } = await startMatchWithRetry(browser);
    try {
      await expect(
        pageA.getByTestId("match-layout-rail-left"),
      ).toBeVisible();
    } finally {
      await cleanup();
    }
  });
});
```

If the helper returns a different destructuring shape, adjust the three `const { pageA, cleanup } = …` lines and keep assertions identical.

- [ ] **Step 3: Run the test**

Run: `pnpm exec playwright test --grep @hud-classic`

Expected outcomes:
- All 4 pass — commit.
- Dev-server / Supabase startup failure — commit the file with DONE_WITH_CONCERNS; the test runs in CI. Do NOT debug Supabase startup here.
- An assertion mismatch — report the actual DOM and pause for guidance.

- [ ] **Step 4: Commit**

```bash
git add tests/integration/ui/hud-classic.spec.ts
git commit -m "test(match): Playwright smoke for Phase 1c classic HUD

Locks in two HudCards in the top strip, centre chrome between them,
right rail with tiles-claimed + History/Resign, and an empty left rail
placeholder for Phase 1d."
```

---

## Task 8: Full verification sweep

- [ ] **Step 1: Run the complete unit suite**

Run: `pnpm test -- --run`
Expected: all unit tests pass.

- [ ] **Step 2: Run the full Playwright suite**

Run: `pnpm exec playwright test`
Expected: all tests pass. Some specs may hard-code assertions on `.match-layout__panel--left` / `--right` or on inline RoundPipBar being inside PlayerPanel — update those assertions to match the new structure (the top HUD strip, the `.match-layout__rail--*` elements, and the standalone `MatchCenterChrome`). Record any updates in a targeted commit.

- [ ] **Step 3: Run lint + typecheck**

```
pnpm lint
pnpm typecheck
```

Both must exit 0.

- [ ] **Step 4: Manual visual sanity check**

Run `pnpm dev` and open `/match/<match-id>` with a live match. Confirm:

- Top row shows two paper-surfaced HUD cards side by side with a mono-labelled centre chrome between them.
- Left HUD card has a red (p2) left-stripe; right HUD card has an ochre (p1) left-stripe.
- Clock pill is mono + tabular; score is italic Fraunces 34px.
- Pip bar in the centre chrome reflects the current round.
- Below the HUD, the board sits between an empty left rail placeholder and a right rail containing the `Tiles claimed` card plus the History/Resign buttons.
- On mobile (narrow viewport), the old compact bars still render above and below the board and the top HUD strip is hidden.

If anything reads poorly, file a follow-up — do NOT attempt extra visual fixes in this plan.

- [ ] **Step 5: Commit any targeted regressions**

If Playwright assertion updates were required in Step 2, those are their own commit messages. Otherwise no new commit needed.

---

## Self-Review Checklist

- [x] HUD classic refresh (hud-card + centre chrome) is covered by Tasks 1, 2, 3, 6.
- [x] Layout restructure (two-row grid on desktop) is covered by Task 5.
- [x] `RoundPipBar` relocation from `PlayerPanel` to `MatchCenterChrome` is covered by Tasks 3 (adds it centrally) and 4 (removes it from `PlayerPanel`).
- [x] `TilesClaimedCard` relocation from left rail (Phase 1b hotfix #108) to right rail is covered by Task 6.
- [x] History / Resign controls have an explicit new home (right rail, under `TilesClaimedCard`) — Task 6.
- [x] Mobile compact bars are preserved verbatim — Task 6.
- [x] Left-rail cards (HowToPlay / Legend / YourMove) are explicitly deferred to Phase 1d — called out in scope decisions and referenced in Task 6's left-rail placeholder.
- [x] No placeholders in task steps — every CSS block, component body, and JSX block is fully specified.
- [x] Tailwind + OKLCH tokens used (`bg-paper`, `border-hair`, `text-ink-soft`, `font-mono`, etc.); no dark-mode class reintroductions.
- [x] Helper identifier consistency: `formatClockMMSS` and `deriveClockState` defined inline in `MatchClient` and used by the two `HudCard` invocations (Task 6).

---

## Out-of-scope (deferred to Phase 1d)

- **Left-rail instructional cards** — `HowToPlayCard` (4-step ordered list), `LegendCard` (three frozen mini-tiles with captions), `YourMoveCard` (current selected-tile coords + submitted state).
- **Inline round log** — moving `RoundHistoryPanel` out of the history overlay portal into the right rail; keep the overlay-on-button-click flow for now.
- **Removing the unused `PlayerPanel` full variant** — leave the code path in place until Phase 1d for minimum churn; MatchClient just stops rendering it on desktop in this plan.

A Phase 1d plan will pick these up with a clean canvas now that the layout has a proper left rail.
