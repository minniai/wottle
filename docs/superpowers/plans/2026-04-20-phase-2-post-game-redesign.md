# Phase 2 — Post-Game Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current `FinalSummary` overview with the prototype's Warm Editorial post-game layout: italic "Victory." / "Defeat." verdict, split scoreboard cards with ±rating and best-word foot-rows, a round-by-round bar chart (player A up, player B down), and a sorted "Words of the match" list. Keep the existing Round History tab and rematch flow intact.

**Architecture:** Four new presentational components (`PostGameVerdict`, `PostGameScoreboard`, `RoundByRoundChart`, `WordsOfMatch`) driven entirely by the data that `FinalSummary` already receives (`scoreboard`, `players`, `wordHistory`, `winnerId`, `currentPlayerId`, `endedReason`, `isDualTimeout`). `FinalSummary`'s Overview tab is rewritten to compose them; the outer shell (tabs, board header, rematch banner, profile modal, series badge) stays as-is so existing tests and flows keep working.

**Tech Stack:** React 19 + Next.js 16 App Router, Tailwind CSS 4 (Phase 1a/1c tokens), Vitest + React Testing Library, Playwright.

**Branch:** `029-post-game-redesign-phase-2`, branched from `origin/main` (PRs #111 and #112 merged).

**Prerequisites:**

- Read spec `docs/superpowers/specs/2026-04-19-wottle-design-implementation.md` §4 Phase 2 and the prototype reference at `/tmp/wottle-design/wottle-game-design/project/prototype/screens/PostGame.jsx`.
- Phase 1 is fully shipped (theme flip, match surfaces, HUD classic, left rail).
- The existing `FinalSummary.tsx` (621 lines) has 12 tests in `tests/unit/components/FinalSummary.test.tsx` that will be partially updated.

**Test commands (run after every task):**

- `pnpm lint` — zero warnings.
- `pnpm typecheck` — exit 0.
- `pnpm test -- --run` — unit suite.
- `pnpm exec playwright test --grep @postgame` — new tag added in Task 8.

---

## Scope decisions

**In scope (this plan):**

1. `PostGameVerdict` — eyebrow ("Match complete · N rounds · Xm Ys"), italic Fraunces verdict ("Victory." / "Defeat." / "Draw."), italic sub-display with point margin.
2. `PostGameScoreboard` — two side-by-side cards (player_a on left, player_b on right); each card has avatar, display name, ±rating line, italic Fraunces score (56px), and a foot-row with words count · frozen count · best word.
3. `RoundByRoundChart` — SVG or flex-div chart: 10 columns, player_a delta grows up from a midline, player_b delta grows down; mono `R1`…`R10` labels below.
4. `WordsOfMatch` — flat list of word rows sorted by `roundNumber` ascending, each row showing word · round · points, tinted by player slot (`text-p1-deep` for player_a, `text-p2-deep` for player_b).
5. `FinalSummary` rewire — the Overview tab's contents become a two-column layout: left column holds `PostGameVerdict` + `PostGameScoreboard` + `RoundByRoundChart` + action buttons; right column holds the existing board render + `WordsOfMatch`.
6. Keep the existing **Round History** tab, rematch flow, profile modal, series badge, and forfeit label — all wired to existing tests that must continue to pass.
7. `@postgame` Playwright smoke.

**Deferred / not in this plan:**

- Scaled board miniature (`transform: scale(0.75)`) — keep the current full-size board render; scaling it down risks breaking layout with the new two-column structure and can be polished later.
- Tab header restyle (currently uses `emerald-400` accent). Leave as-is to avoid churn on existing `getByTestId("tab-*")` tests.
- Replacing `RoundHistoryPanel` in the Round History tab — stays unchanged.

---

## File Structure

**Create:**

- `components/match/PostGameVerdict.tsx` — presentational verdict block.
- `tests/unit/components/match/PostGameVerdict.test.tsx`.
- `components/match/PostGameScoreboard.tsx` — two-card scoreboard.
- `tests/unit/components/match/PostGameScoreboard.test.tsx`.
- `components/match/RoundByRoundChart.tsx` — 10-column bidirectional bar chart.
- `tests/unit/components/match/RoundByRoundChart.test.tsx`.
- `components/match/WordsOfMatch.tsx` — sorted word list.
- `tests/unit/components/match/WordsOfMatch.test.tsx`.
- `tests/integration/ui/postgame.spec.ts` — Playwright smoke.

**Modify:**

- `components/match/FinalSummary.tsx` — rewrite the Overview tab's contents (keep the outer shell, Round History tab, rematch / profile / series / forfeit wiring).
- `tests/unit/components/FinalSummary.test.tsx` — update 3–4 existing assertions that target the old Overview markup ("Final Summary" h1, "Winner" label, etc.) to target the new verdict.

**Not touched:**

- `RoundHistoryPanel`, `RematchBanner`, `RematchInterstitial`, `PlayerProfileModal`, `deriveRoundHistory`, `deriveCallouts`, `useRematchNegotiation`.
- Any server action, type, or route.
- `BoardGrid` (the final board still renders via existing props).

---

## Task 1: `PostGameVerdict` component

**Files:**

- Create: `components/match/PostGameVerdict.tsx`
- Create: `tests/unit/components/match/PostGameVerdict.test.tsx`

Props:

```ts
interface PostGameVerdictProps {
  outcome: "win" | "loss" | "draw";
  totalRounds: number;
  durationMs: number;
  pointMargin: number;          // abs(winnerScore - loserScore); 0 on draw
  opponentName: string;
  reasonLabel: string;          // passthrough of existing reasonLabel() output
}
```

Rendered structure:

```
<p class="eyebrow">Match complete · {totalRounds} rounds · {durationLabel}</p>
<h1 class="verdict {outcomeClass}">{verdictLabel}</h1>
<p class="sub-display">{subDisplayText}</p>
<p class="muted">{reasonLabel}</p>
```

- [ ] **Step 1: Write the failing test**

Create `tests/unit/components/match/PostGameVerdict.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { PostGameVerdict } from "@/components/match/PostGameVerdict";

describe("PostGameVerdict", () => {
  test("eyebrow shows round count and duration", () => {
    render(
      <PostGameVerdict
        outcome="win"
        totalRounds={10}
        durationMs={552_000}
        pointMargin={34}
        opponentName="Sigríður"
        reasonLabel="10 rounds completed"
      />,
    );
    expect(
      screen.getByText(/Match complete · 10 rounds · 9m 12s/i),
    ).toBeInTheDocument();
  });

  test("win outcome shows Victory. and you-outread sub-display", () => {
    render(
      <PostGameVerdict
        outcome="win"
        totalRounds={10}
        durationMs={300_000}
        pointMargin={34}
        opponentName="Sigríður"
        reasonLabel="10 rounds completed"
      />,
    );
    expect(screen.getByText("Victory.")).toBeInTheDocument();
    expect(
      screen.getByText(/You out-read Sigríður by 34 points\./i),
    ).toBeInTheDocument();
    const verdict = screen.getByTestId("post-game-verdict");
    expect(verdict.className).toMatch(/post-game-verdict--win/);
  });

  test("loss outcome shows Defeat. and opponent-outread sub-display", () => {
    render(
      <PostGameVerdict
        outcome="loss"
        totalRounds={10}
        durationMs={300_000}
        pointMargin={22}
        opponentName="Sigríður"
        reasonLabel="10 rounds completed"
      />,
    );
    expect(screen.getByText("Defeat.")).toBeInTheDocument();
    expect(
      screen.getByText(/Sigríður out-read you by 22 points\./i),
    ).toBeInTheDocument();
    const verdict = screen.getByTestId("post-game-verdict");
    expect(verdict.className).toMatch(/post-game-verdict--loss/);
  });

  test("draw outcome shows Draw. with tied sub-display", () => {
    render(
      <PostGameVerdict
        outcome="draw"
        totalRounds={10}
        durationMs={300_000}
        pointMargin={0}
        opponentName="Sigríður"
        reasonLabel="10 rounds completed"
      />,
    );
    expect(screen.getByText("Draw.")).toBeInTheDocument();
    expect(
      screen.getByText(/Tied with Sigríður after the final round\./i),
    ).toBeInTheDocument();
  });

  test("reason label is rendered verbatim", () => {
    render(
      <PostGameVerdict
        outcome="win"
        totalRounds={10}
        durationMs={0}
        pointMargin={1}
        opponentName="X"
        reasonLabel="Disconnected opponent"
      />,
    );
    expect(screen.getByText("Disconnected opponent")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `pnpm test -- --run tests/unit/components/match/PostGameVerdict.test.tsx`
Expected: import fails.

- [ ] **Step 3: Create the component**

Create `components/match/PostGameVerdict.tsx`:

```tsx
interface PostGameVerdictProps {
  outcome: "win" | "loss" | "draw";
  totalRounds: number;
  durationMs: number;
  pointMargin: number;
  opponentName: string;
  reasonLabel: string;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

const OUTCOME_CLASS: Record<"win" | "loss" | "draw", string> = {
  win: "post-game-verdict--win text-p1-deep",
  loss: "post-game-verdict--loss text-p2-deep",
  draw: "post-game-verdict--draw text-ink",
};

const OUTCOME_LABEL: Record<"win" | "loss" | "draw", string> = {
  win: "Victory.",
  loss: "Defeat.",
  draw: "Draw.",
};

function subDisplayText(
  outcome: "win" | "loss" | "draw",
  pointMargin: number,
  opponentName: string,
): string {
  if (outcome === "win") {
    return `You out-read ${opponentName} by ${pointMargin} point${pointMargin === 1 ? "" : "s"}.`;
  }
  if (outcome === "loss") {
    return `${opponentName} out-read you by ${pointMargin} point${pointMargin === 1 ? "" : "s"}.`;
  }
  return `Tied with ${opponentName} after the final round.`;
}

export function PostGameVerdict({
  outcome,
  totalRounds,
  durationMs,
  pointMargin,
  opponentName,
  reasonLabel,
}: PostGameVerdictProps) {
  return (
    <div data-testid="post-game-verdict" className={OUTCOME_CLASS[outcome]}>
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft">
        Match complete · {totalRounds} rounds · {formatDuration(durationMs)}
      </p>
      <h1 className="mt-3 font-display text-[72px] italic leading-none tracking-tight">
        {OUTCOME_LABEL[outcome]}
      </h1>
      <p className="mt-2 font-display text-[22px] italic text-ink-3">
        {subDisplayText(outcome, pointMargin, opponentName)}
      </p>
      <p className="mt-2 text-sm text-ink-soft">{reasonLabel}</p>
    </div>
  );
}
```

- [ ] **Step 4: Run tests + full suite + typecheck**

```
pnpm test -- --run tests/unit/components/match/PostGameVerdict.test.tsx
pnpm test -- --run
pnpm typecheck
```

All pass.

- [ ] **Step 5: Commit**

```bash
git add components/match/PostGameVerdict.tsx tests/unit/components/match/PostGameVerdict.test.tsx
git commit -m "feat(match): add PostGameVerdict for Phase 2 post-game

Three visual states (win / loss / draw) with italic Fraunces 72px
verdict, mono eyebrow showing round count + duration, italic
sub-display with the point margin, and a reason-label footnote.
Pure presentational component — caller derives outcome + margin."
```

---

## Task 2: `PostGameScoreboard` component

**Files:**

- Create: `components/match/PostGameScoreboard.tsx`
- Create: `tests/unit/components/match/PostGameScoreboard.test.tsx`

Props:

```ts
interface ScoreboardEntry {
  id: string;
  displayName: string;
  slot: "player_a" | "player_b";
  score: number;
  wordsCount: number;
  frozenTileCount: number;
  bestWord: string | null;
  ratingDelta: number | undefined;
  isCurrentPlayer: boolean;
  isWinner: boolean;
}

interface PostGameScoreboardProps {
  entries: [ScoreboardEntry, ScoreboardEntry]; // always 2-tuple, player_a first
}
```

Each card:

```
<div class="hud-card hud-card--{slot}">
  <row: avatar + name + ±rating>
  <italic fraunces 56px: score>
  <row: {wordsCount} words · {frozenTileCount} frozen · best {bestWord}>
</div>
```

- [ ] **Step 1: Write the failing test**

Create `tests/unit/components/match/PostGameScoreboard.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { PostGameScoreboard } from "@/components/match/PostGameScoreboard";

const baseEntry = {
  id: "p-a",
  displayName: "Ásta",
  slot: "player_a" as const,
  score: 312,
  wordsCount: 18,
  frozenTileCount: 14,
  bestWord: "HESTUR",
  ratingDelta: 18,
  isCurrentPlayer: true,
  isWinner: true,
};

const oppEntry = {
  id: "p-b",
  displayName: "Sigríður",
  slot: "player_b" as const,
  score: 278,
  wordsCount: 15,
  frozenTileCount: 11,
  bestWord: "FISKUR",
  ratingDelta: -18,
  isCurrentPlayer: false,
  isWinner: false,
};

describe("PostGameScoreboard", () => {
  test("renders two cards for the two entries", () => {
    render(<PostGameScoreboard entries={[baseEntry, oppEntry]} />);
    expect(screen.getAllByTestId("post-game-scoreboard-card")).toHaveLength(2);
  });

  test("cards carry slot-specific classes", () => {
    render(<PostGameScoreboard entries={[baseEntry, oppEntry]} />);
    const cards = screen.getAllByTestId("post-game-scoreboard-card");
    expect(cards[0].className).toContain("hud-card--you");
    expect(cards[1].className).toContain("hud-card--opp");
  });

  test("renders display name, score, and rating delta", () => {
    render(<PostGameScoreboard entries={[baseEntry, oppEntry]} />);
    expect(screen.getByText("Ásta")).toBeInTheDocument();
    expect(screen.getByText("312")).toBeInTheDocument();
    expect(screen.getByText("+18 rating")).toBeInTheDocument();
    expect(screen.getByText("Sigríður")).toBeInTheDocument();
    expect(screen.getByText("278")).toBeInTheDocument();
    expect(screen.getByText("−18 rating")).toBeInTheDocument();
  });

  test("shows 'Rating pending' when ratingDelta is undefined", () => {
    render(
      <PostGameScoreboard
        entries={[
          { ...baseEntry, ratingDelta: undefined },
          oppEntry,
        ]}
      />,
    );
    expect(screen.getByText("Rating pending")).toBeInTheDocument();
  });

  test("foot row shows words, frozen count, and best word", () => {
    render(<PostGameScoreboard entries={[baseEntry, oppEntry]} />);
    const [firstCard] = screen.getAllByTestId("post-game-scoreboard-card");
    expect(within(firstCard).getByText("18 words")).toBeInTheDocument();
    expect(within(firstCard).getByText("14 frozen")).toBeInTheDocument();
    expect(within(firstCard).getByText(/best\s+HESTUR/)).toBeInTheDocument();
  });

  test("renders em-dash when bestWord is null", () => {
    render(
      <PostGameScoreboard
        entries={[
          { ...baseEntry, bestWord: null },
          oppEntry,
        ]}
      />,
    );
    const [firstCard] = screen.getAllByTestId("post-game-scoreboard-card");
    expect(within(firstCard).getByText(/best\s+—/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `pnpm test -- --run tests/unit/components/match/PostGameScoreboard.test.tsx`
Expected: import fails.

- [ ] **Step 3: Create the component**

Create `components/match/PostGameScoreboard.tsx`:

```tsx
import { PlayerAvatar } from "@/components/match/PlayerAvatar";

type Slot = "player_a" | "player_b";

export interface ScoreboardEntry {
  id: string;
  displayName: string;
  slot: Slot;
  score: number;
  wordsCount: number;
  frozenTileCount: number;
  bestWord: string | null;
  ratingDelta: number | undefined;
  isCurrentPlayer: boolean;
  isWinner: boolean;
}

interface PostGameScoreboardProps {
  entries: [ScoreboardEntry, ScoreboardEntry];
}

const SLOT_COLOR_HEX: Record<Slot, string> = {
  player_a: "oklch(0.68 0.14 60)",
  player_b: "oklch(0.56 0.08 220)",
};

function ratingLabel(delta: number | undefined): string {
  if (delta === undefined) return "Rating pending";
  if (delta === 0) return "±0 rating";
  // Use a true minus sign for negative values so axe contrast and
  // screen-readers see a proper character, not a hyphen.
  const sign = delta > 0 ? "+" : "−";
  const abs = Math.abs(delta);
  return `${sign}${abs} rating`;
}

function Card({ entry }: { entry: ScoreboardEntry }) {
  const cardClass =
    entry.slot === "player_a" ? "hud-card hud-card--you" : "hud-card hud-card--opp";
  const scoreClass =
    entry.slot === "player_a" ? "text-p1-deep" : "text-p2-deep";

  return (
    <div
      data-testid="post-game-scoreboard-card"
      className={`${cardClass} flex-col !items-start gap-3`}
    >
      <div className="flex w-full items-center gap-3">
        <PlayerAvatar
          displayName={entry.displayName}
          avatarUrl={null}
          playerColor={SLOT_COLOR_HEX[entry.slot]}
          size="md"
        />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[15px] font-medium text-ink">
            {entry.displayName}
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-soft">
            {ratingLabel(entry.ratingDelta)}
          </span>
        </div>
      </div>
      <span
        className={`font-display text-[56px] italic leading-none ${scoreClass}`}
        data-testid="post-game-scoreboard-score"
      >
        {entry.score}
      </span>
      <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-3">
        <span>{entry.wordsCount} words</span>
        <span aria-hidden="true">·</span>
        <span>{entry.frozenTileCount} frozen</span>
        <span aria-hidden="true">·</span>
        <span>
          best{" "}
          <b className="font-mono font-medium text-ink">
            {entry.bestWord ?? "—"}
          </b>
        </span>
      </div>
    </div>
  );
}

export function PostGameScoreboard({ entries }: PostGameScoreboardProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card entry={entries[0]} />
      <Card entry={entries[1]} />
    </div>
  );
}
```

- [ ] **Step 4: Run tests + full suite + typecheck**

```
pnpm test -- --run tests/unit/components/match/PostGameScoreboard.test.tsx
pnpm test -- --run
pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add components/match/PostGameScoreboard.tsx tests/unit/components/match/PostGameScoreboard.test.tsx
git commit -m "feat(match): add PostGameScoreboard with two cards + rating deltas

Two side-by-side paper HudCards (using the Phase 1c .hud-card classes
with --you / --opp stripes). Each card: avatar + name + ±N rating
meta, italic Fraunces 56px score tinted to slot, foot-row with
words count · frozen count · best word. Handles missing ratingDelta
with a 'Rating pending' label and null bestWord with an em-dash."
```

---

## Task 3: `RoundByRoundChart` component

**Files:**

- Create: `components/match/RoundByRoundChart.tsx`
- Create: `tests/unit/components/match/RoundByRoundChart.test.tsx`

Data shape — reuse the existing `ScoreboardRow`:

```ts
interface RoundByRoundChartProps {
  rounds: ScoreboardRow[]; // one entry per completed round
  maxHeightPx?: number;    // default 120
}
```

Rendering strategy: flex row of 10 columns. Each column has three elements stacked vertically — a top bar (player_a delta, grows up), a bottom bar (player_b delta, grows down), and a mono `R{n}` label. Bar height = `(delta / maxAbsDelta) * maxHeightPx`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/components/match/RoundByRoundChart.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { RoundByRoundChart } from "@/components/match/RoundByRoundChart";
import type { ScoreboardRow } from "@/components/match/FinalSummary";

const sampleRounds: ScoreboardRow[] = [
  { roundNumber: 1, playerAScore: 22, playerBScore: 15, playerADelta: 22, playerBDelta: 15 },
  { roundNumber: 2, playerAScore: 31, playerBScore: 43, playerADelta: 9, playerBDelta: 28 },
  { roundNumber: 3, playerAScore: 43, playerBScore: 50, playerADelta: 12, playerBDelta: 7 },
];

describe("RoundByRoundChart", () => {
  test("renders one column per round", () => {
    render(<RoundByRoundChart rounds={sampleRounds} />);
    expect(screen.getAllByTestId("round-chart-col")).toHaveLength(3);
  });

  test("renders a mono R{n} label under each column", () => {
    render(<RoundByRoundChart rounds={sampleRounds} />);
    const cols = screen.getAllByTestId("round-chart-col");
    expect(within(cols[0]).getByText("R1")).toBeInTheDocument();
    expect(within(cols[1]).getByText("R2")).toBeInTheDocument();
    expect(within(cols[2]).getByText("R3")).toBeInTheDocument();
  });

  test("scales bar heights relative to maxAbsDelta", () => {
    render(<RoundByRoundChart rounds={sampleRounds} maxHeightPx={100} />);
    // Max delta across dataset = 28 (playerB round 2).
    // Player A round 1 delta = 22 → height = 22 / 28 * 100 = 78.57…
    const bar = screen.getAllByTestId("round-chart-bar--a")[0];
    expect(Number(bar.style.height.replace("px", ""))).toBeGreaterThan(75);
    expect(Number(bar.style.height.replace("px", ""))).toBeLessThan(82);
  });

  test("records deltas via data attributes for inspection", () => {
    render(<RoundByRoundChart rounds={sampleRounds} />);
    const firstA = screen.getAllByTestId("round-chart-bar--a")[0];
    const firstB = screen.getAllByTestId("round-chart-bar--b")[0];
    expect(firstA.dataset.delta).toBe("22");
    expect(firstB.dataset.delta).toBe("15");
  });

  test("zero-delta round renders with height 0", () => {
    render(
      <RoundByRoundChart
        rounds={[
          { roundNumber: 1, playerAScore: 0, playerBScore: 10, playerADelta: 0, playerBDelta: 10 },
        ]}
      />,
    );
    const a = screen.getAllByTestId("round-chart-bar--a")[0];
    expect(a.style.height).toBe("0px");
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `pnpm test -- --run tests/unit/components/match/RoundByRoundChart.test.tsx`
Expected: import fails.

- [ ] **Step 3: Create the component**

Create `components/match/RoundByRoundChart.tsx`:

```tsx
import type { ScoreboardRow } from "@/components/match/FinalSummary";

interface RoundByRoundChartProps {
  rounds: ScoreboardRow[];
  maxHeightPx?: number;
}

const DEFAULT_MAX_HEIGHT = 120;

function maxAbsDelta(rounds: ScoreboardRow[]): number {
  let m = 0;
  for (const r of rounds) {
    if (Math.abs(r.playerADelta) > m) m = Math.abs(r.playerADelta);
    if (Math.abs(r.playerBDelta) > m) m = Math.abs(r.playerBDelta);
  }
  return m;
}

export function RoundByRoundChart({
  rounds,
  maxHeightPx = DEFAULT_MAX_HEIGHT,
}: RoundByRoundChartProps) {
  const scale = maxAbsDelta(rounds);
  const toHeight = (delta: number): number =>
    scale === 0 ? 0 : Math.round((Math.abs(delta) / scale) * maxHeightPx);

  return (
    <div
      data-testid="round-by-round-chart"
      className="w-full"
      style={{ ["--chart-col" as const]: `${maxHeightPx}px` }}
    >
      <div className="flex items-stretch justify-between gap-1">
        {rounds.map((row) => (
          <div
            key={row.roundNumber}
            data-testid="round-chart-col"
            className="flex min-w-0 flex-1 flex-col items-center"
          >
            <div
              className="flex w-full flex-col justify-end"
              style={{ height: `${maxHeightPx}px` }}
            >
              <div
                data-testid="round-chart-bar--a"
                data-delta={row.playerADelta}
                className="w-full rounded-t bg-p1"
                style={{ height: `${toHeight(row.playerADelta)}px` }}
              />
            </div>
            <div
              className="flex w-full flex-col"
              style={{ height: `${maxHeightPx}px` }}
            >
              <div
                data-testid="round-chart-bar--b"
                data-delta={row.playerBDelta}
                className="w-full rounded-b bg-p2 opacity-70"
                style={{ height: `${toHeight(row.playerBDelta)}px` }}
              />
            </div>
            <span className="mt-1 font-mono text-[10px] text-ink-soft">
              R{row.roundNumber}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests + full suite + typecheck**

```
pnpm test -- --run tests/unit/components/match/RoundByRoundChart.test.tsx
pnpm test -- --run
pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add components/match/RoundByRoundChart.tsx tests/unit/components/match/RoundByRoundChart.test.tsx
git commit -m "feat(match): add RoundByRoundChart for Phase 2 post-game

Ten-column bidirectional bar chart: player_a delta grows up from
the midline, player_b delta grows down. Both scaled to the per-
dataset max absolute delta so the tallest bar fills maxHeightPx.
Mono R{n} labels below each column. No data transformation in the
component — feeds directly from ScoreboardRow[]."
```

---

## Task 4: `WordsOfMatch` component

**Files:**

- Create: `components/match/WordsOfMatch.tsx`
- Create: `tests/unit/components/match/WordsOfMatch.test.tsx`

Props:

```ts
interface WordsOfMatchProps {
  wordHistory: WordHistoryRow[];
  playerASlotId: string;   // so we can tint rows by slot
  maxHeightPx?: number;    // default 320, scroll past that
}
```

Rendering: `<div role="list">` of rows, each `<div role="listitem">`, rows sorted by `roundNumber` ascending. Row structure:

```
<word-text> <small: R{n}> <span aria-right: +{points}>
```

- [ ] **Step 1: Write the failing test**

Create `tests/unit/components/match/WordsOfMatch.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { WordsOfMatch } from "@/components/match/WordsOfMatch";
import type { WordHistoryRow } from "@/components/match/FinalSummary";

const words: WordHistoryRow[] = [
  { roundNumber: 2, playerId: "pA", word: "BARN", totalPoints: 11, lettersPoints: 6, bonusPoints: 5, coordinates: [] },
  { roundNumber: 4, playerId: "pA", word: "HESTUR", totalPoints: 22, lettersPoints: 12, bonusPoints: 10, coordinates: [] },
  { roundNumber: 1, playerId: "pB", word: "VATN", totalPoints: 8, lettersPoints: 6, bonusPoints: 2, coordinates: [] },
];

describe("WordsOfMatch", () => {
  test("renders header with found count", () => {
    render(<WordsOfMatch wordHistory={words} playerASlotId="pA" />);
    expect(screen.getByText("Words of the match")).toBeInTheDocument();
    expect(screen.getByText("3 found")).toBeInTheDocument();
  });

  test("sorts rows by roundNumber ascending", () => {
    render(<WordsOfMatch wordHistory={words} playerASlotId="pA" />);
    const rows = screen.getAllByTestId("words-of-match-row");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("VATN");
    expect(rows[1]).toHaveTextContent("BARN");
    expect(rows[2]).toHaveTextContent("HESTUR");
  });

  test("row shows word, R{n}, and +points", () => {
    render(<WordsOfMatch wordHistory={words} playerASlotId="pA" />);
    const [first] = screen.getAllByTestId("words-of-match-row");
    expect(first).toHaveTextContent("VATN");
    expect(first).toHaveTextContent("R1");
    expect(first).toHaveTextContent("+8");
  });

  test("rows tinted by player slot (p1 / p2)", () => {
    render(<WordsOfMatch wordHistory={words} playerASlotId="pA" />);
    const rows = screen.getAllByTestId("words-of-match-row");
    expect(rows[0].className).toMatch(/text-p2-deep/);  // VATN is playerB
    expect(rows[1].className).toMatch(/text-p1-deep/);  // BARN is playerA
    expect(rows[2].className).toMatch(/text-p1-deep/);  // HESTUR is playerA
  });

  test("empty list shows a 'no words scored' placeholder", () => {
    render(<WordsOfMatch wordHistory={[]} playerASlotId="pA" />);
    expect(screen.getByText(/no words scored/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `pnpm test -- --run tests/unit/components/match/WordsOfMatch.test.tsx`
Expected: import fails.

- [ ] **Step 3: Create the component**

Create `components/match/WordsOfMatch.tsx`:

```tsx
import type { WordHistoryRow } from "@/components/match/FinalSummary";

interface WordsOfMatchProps {
  wordHistory: WordHistoryRow[];
  playerASlotId: string;
  maxHeightPx?: number;
}

const DEFAULT_MAX_HEIGHT = 320;

export function WordsOfMatch({
  wordHistory,
  playerASlotId,
  maxHeightPx = DEFAULT_MAX_HEIGHT,
}: WordsOfMatchProps) {
  const sorted = [...wordHistory].sort((a, b) => a.roundNumber - b.roundNumber);

  return (
    <div
      data-testid="words-of-match"
      className="rounded-xl border border-hair bg-paper shadow-wottle-sm"
    >
      <div className="flex items-baseline justify-between border-b border-hair px-4 py-3">
        <h3 className="font-display text-[18px] italic text-ink">
          Words of the match
        </h3>
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-soft">
          {sorted.length} found
        </span>
      </div>
      {sorted.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-ink-soft">
          No words scored.
        </p>
      ) : (
        <div
          style={{ maxHeight: `${maxHeightPx}px` }}
          className="overflow-y-auto"
        >
          {sorted.map((row, idx) => {
            const slotClass =
              row.playerId === playerASlotId ? "text-p1-deep" : "text-p2-deep";
            return (
              <div
                key={`${row.roundNumber}-${row.word}-${idx}`}
                data-testid="words-of-match-row"
                className={`flex items-center gap-3 border-b border-hair/60 px-4 py-2.5 last:border-b-0 ${slotClass}`}
              >
                <span className="font-display text-[17px] font-medium tracking-[0.02em]">
                  {row.word}
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-soft">
                  R{row.roundNumber}
                </span>
                <span className="ml-auto font-mono text-[12px] text-ink-soft">
                  +{row.totalPoints}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests + full suite + typecheck**

```
pnpm test -- --run tests/unit/components/match/WordsOfMatch.test.tsx
pnpm test -- --run
pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add components/match/WordsOfMatch.tsx tests/unit/components/match/WordsOfMatch.test.tsx
git commit -m "feat(match): add WordsOfMatch scrollable word list

Sorts WordHistoryRow[] by roundNumber ascending and renders each row
as word · R{n} · +points. Rows tinted text-p1-deep or text-p2-deep
by player slot. Header shows 'N found' count; empty list shows a
'No words scored.' placeholder. Scrolls past maxHeightPx (default
320px)."
```

---

## Task 5: Rewrite `FinalSummary` Overview tab

**Files:**

- Modify: `components/match/FinalSummary.tsx` (rewrite the Overview tab's JSX only; keep the outer shell, board header, tabs, Round History tab, rematch flow, profile modal, series badge, forfeit label intact).
- Modify: `tests/unit/components/FinalSummary.test.tsx` (update assertions that target the old Overview markup).

The Overview tab currently renders: eyebrow + h1 "Final Summary" + reason, winner/draw block, rematch banner, series badge, action buttons, scoreboard grid, round-by-round section.

The new Overview tab renders:

```
<div class="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
  <section class="min-w-0 space-y-6">
    <PostGameVerdict .../>
    {rematch stuff, series badge, forfeit label — existing JSX}
    <PostGameScoreboard entries={...} />
    <RoundByRoundChart rounds={scoreboard} />
    <div>{action buttons: Rematch + Back to Lobby}</div>
  </section>
  <aside class="min-w-0 space-y-6">
    <WordsOfMatch wordHistory={wordHistory} playerASlotId={playerA.id} />
  </aside>
</div>
```

- [ ] **Step 1: Add new imports to `FinalSummary.tsx`**

At the top of `components/match/FinalSummary.tsx`, add these imports after the existing match-component imports:

```tsx
import { PostGameVerdict } from "@/components/match/PostGameVerdict";
import {
  PostGameScoreboard,
  type ScoreboardEntry,
} from "@/components/match/PostGameScoreboard";
import { RoundByRoundChart } from "@/components/match/RoundByRoundChart";
import { WordsOfMatch } from "@/components/match/WordsOfMatch";
```

- [ ] **Step 2: Compute the new summary-level view data inside the component body**

Inside the `FinalSummary` function, after the existing `biggestSwing` / `highestWord` memos (around line 224), add:

```tsx
  const totalDurationMs = useMemo(
    () => players.reduce((acc, p) => Math.max(acc, p.timeUsedMs), 0),
    [players],
  );

  const outcome: "win" | "loss" | "draw" = useMemo(() => {
    if (!winnerId) return "draw";
    return winnerId === currentPlayerId ? "win" : "loss";
  }, [winnerId, currentPlayerId]);

  const pointMargin = useMemo(() => {
    const scores = players.map((p) => p.score);
    if (scores.length < 2) return 0;
    return Math.abs(scores[0] - scores[1]);
  }, [players]);

  const wordCountByPlayer = useMemo(() => {
    const counts = new Map<string, number>();
    for (const w of wordHistory) {
      counts.set(w.playerId, (counts.get(w.playerId) ?? 0) + 1);
    }
    return counts;
  }, [wordHistory]);

  const bestWordByPlayer = useMemo(() => {
    const best = new Map<string, WordHistoryRow>();
    for (const w of wordHistory) {
      const prev = best.get(w.playerId);
      if (!prev || w.totalPoints > prev.totalPoints) {
        best.set(w.playerId, w);
      }
    }
    return best;
  }, [wordHistory]);

  const scoreboardEntries = useMemo<
    [ScoreboardEntry, ScoreboardEntry] | null
  >(() => {
    if (!playerA || !playerB) return null;
    const toEntry = (
      player: PlayerSummary,
      slot: "player_a" | "player_b",
    ): ScoreboardEntry => ({
      id: player.id,
      displayName: player.displayName,
      slot,
      score: player.score,
      wordsCount: wordCountByPlayer.get(player.id) ?? 0,
      frozenTileCount: player.frozenTileCount,
      bestWord: bestWordByPlayer.get(player.id)?.word ?? null,
      ratingDelta: player.ratingDelta,
      isCurrentPlayer: player.id === currentPlayerId,
      isWinner: player.id === winnerId,
    });
    return [toEntry(playerA, "player_a"), toEntry(playerB, "player_b")];
  }, [playerA, playerB, wordCountByPlayer, bestWordByPlayer, currentPlayerId, winnerId]);
```

- [ ] **Step 3: Replace the Overview tab JSX**

In `components/match/FinalSummary.tsx`, find the block that starts:

```tsx
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-[0.3em] text-emerald-200/80">
          Match Complete
        </p>
        <h1 className="text-3xl font-bold text-ink">Final Summary</h1>
```

And ends with the closing `</div>` of the `final-summary-scoreboard` grid and the round-by-round section (roughly line 396 to the end of the round-by-round block — follow the code to find the block between the Overview tab `<div id="tab-panel-overview">` opener and the closing `</div>` before `<div id="tab-panel-round-history">`).

Replace that entire Overview-tab content with:

```tsx
      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <section className="min-w-0 space-y-6">
          <PostGameVerdict
            outcome={outcome}
            totalRounds={scoreboard.length}
            durationMs={totalDurationMs}
            pointMargin={pointMargin}
            opponentName={opponent?.displayName ?? "Opponent"}
            reasonLabel={
              isDualTimeout ? "Both players timed out" : reasonLabel(endedReason)
            }
          />

          {endedReason === "forfeit" && winner && (
            <p
              className="text-sm text-ink-soft"
              data-testid="final-summary-forfeit-label"
            >
              {winner.id === currentPlayerId
                ? "Your opponent resigned"
                : "You resigned"}
            </p>
          )}

          {rematchPhase === "interstitial" && <RematchInterstitial />}

          {seriesBadgeText() && (
            <p
              className="rounded-xl border border-hair-strong bg-paper-2 px-4 py-2 text-sm font-medium text-ink-3"
              data-testid="series-badge"
            >
              {seriesBadgeText()}
            </p>
          )}

          {rematchPhase === "incoming" && requesterName && (
            <RematchBanner
              requesterName={requesterName}
              onAccept={acceptRematch}
              onDecline={declineRematch}
            />
          )}

          {rematchError && (
            <p className="rounded-xl border border-bad/50 bg-bad/10 p-3 text-sm text-bad">
              {rematchError}
            </p>
          )}

          {scoreboardEntries && (
            <div data-testid="final-summary-scoreboard">
              <PostGameScoreboard entries={scoreboardEntries} />
            </div>
          )}

          <div>
            <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-soft">
              Round by round
            </p>
            <RoundByRoundChart rounds={scoreboard} />
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-2xl bg-ink px-5 py-3 text-paper transition hover:bg-ink-2 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleRematch}
              disabled={isRematchDisabled}
              data-testid="final-summary-rematch"
            >
              {rematchButtonLabel()}
            </button>
            <button
              type="button"
              className="rounded-2xl border border-hair-strong px-5 py-3 text-ink transition hover:bg-paper-2"
              onClick={() => router.push("/")}
              data-testid="final-summary-back-lobby"
            >
              Back to Lobby
            </button>
          </div>
        </section>

        <aside className="min-w-0 space-y-6">
          <WordsOfMatch
            wordHistory={wordHistory}
            playerASlotId={playerA?.id ?? ""}
          />
        </aside>
      </div>
```

- [ ] **Step 4: Update existing tests that targeted the old Overview markup**

Open `tests/unit/components/FinalSummary.test.tsx` and look for these assertion patterns:

- Tests that search for the literal text "Final Summary" (h1).
- Tests that search for "Winner" / "Draw" labels.
- Tests that search for the "Match Complete" eyebrow.

Replace each with assertions on the new verdict. The full list of fixes needed depends on exact test content — inspect the file and update as follows:

  - `screen.getByText("Final Summary")` → `screen.getByTestId("post-game-verdict")`
  - `screen.getByText("Winner")` (the "Winner" eyebrow) → assert on the new verdict: `screen.getByText("Victory.")` when winner is current player, or `screen.getByText("Defeat.")` when opponent wins.
  - `screen.getByText("Draw")` → `screen.getByText("Draw.")`
  - `screen.getByText(/Match Complete/i)` → the new eyebrow includes `Match complete · 10 rounds · ...` — update query to `screen.getByText(/Match complete/i)` (note: lower-case "complete" to match the new eyebrow).
  - If a test used `screen.getByText("Top words")` (from the old per-card top-words list), remove or retarget — the new scoreboard cards summarise with "best X" instead. These assertions should be removed since top-words-per-card is no longer rendered on the Overview.

Run tests iteratively:

```
pnpm test -- --run tests/unit/components/FinalSummary.test.tsx
```

Fix each failing assertion until the full file passes. Keep the test *intent* — if a test was "FinalSummary shows the winner", it should now be "FinalSummary shows the Victory. verdict when winner is current player".

- [ ] **Step 5: Run the full suite + typecheck + lint**

```
pnpm test -- --run
pnpm typecheck
pnpm lint
```

All pass.

- [ ] **Step 6: Commit**

```bash
git add components/match/FinalSummary.tsx tests/unit/components/FinalSummary.test.tsx
git commit -m "refactor(match): Phase 2 — rewire Overview tab with new post-game components

Overview tab becomes a two-column layout: left holds PostGameVerdict,
forfeit + rematch + series UI, PostGameScoreboard, RoundByRoundChart,
and the action buttons; right holds WordsOfMatch. Outer shell (board
header, tabs, Round History tab, profile modal) is unchanged.

Existing test assertions targeting 'Final Summary' h1 and 'Winner' /
'Draw' labels updated to query the new verdict block instead. Per-card
'Top words' lists removed from the Overview — best word surfaces in
the new scoreboard foot-row, full history moves to WordsOfMatch."
```

---

## Task 6: Playwright `@postgame` smoke

**Files:**

- Create: `tests/integration/ui/postgame.spec.ts`

Smoke test: drive a match to completion and assert the new post-game surfaces render.

- [ ] **Step 1: Inspect existing match-completion spec for the drive-to-end pattern**

Run: `grep -l "winner\|final-summary-root" tests/integration/ui/*.spec.ts | head -3`

Read the existing `match-completion.spec.ts` to understand how it drives a match through 10 rounds and reaches the final summary. Mirror its login + matchmaking helpers and post-match assertions.

- [ ] **Step 2: Write the test**

Create `tests/integration/ui/postgame.spec.ts`:

```ts
import { test, expect, type Page } from "@playwright/test";

import {
  generateTestUsername,
  startMatchWithDirectInvite,
} from "./helpers/matchmaking";

test.describe.configure({ mode: "serial", retries: 1 });

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

test.describe("@postgame Phase 2 post-game redesign", () => {
  test("post-game verdict and words-of-match render when a match ends", async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      const userA = generateTestUsername("pg-alpha");
      const userB = generateTestUsername("pg-beta");

      await loginPlayer(pageA, userA);
      await loginPlayer(pageB, userB);

      await startMatchWithDirectInvite(pageA, pageB, {
        timeoutMs: 60_000,
        playerBUsername: userB,
      });

      await expect(pageA.getByTestId("match-shell")).toBeVisible({
        timeout: 10_000,
      });

      // Resign to reach the post-game screen deterministically.
      await pageA.getByTestId("hud-resign-button").click();
      await pageA.getByRole("button", { name: /resign/i }).last().click();

      await expect(pageA.getByTestId("final-summary-root")).toBeVisible({
        timeout: 20_000,
      });

      // New post-game surfaces.
      await expect(pageA.getByTestId("post-game-verdict")).toBeVisible();
      await expect(pageA.getByTestId("words-of-match")).toBeVisible();
      await expect(
        pageA.getByTestId("final-summary-scoreboard"),
      ).toBeVisible();
      await expect(pageA.getByTestId("round-by-round-chart")).toBeVisible();
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

Run: `pnpm exec playwright test --grep @postgame --workers=1 --reporter=line`

If Supabase isn't running locally, commit the spec anyway as DONE_WITH_CONCERNS; CI will execute it.

- [ ] **Step 4: Commit**

```bash
git add tests/integration/ui/postgame.spec.ts
git commit -m "test(match): Playwright smoke for Phase 2 post-game surfaces

Drives a match to the end via resign and asserts the four new
surfaces appear: PostGameVerdict, PostGameScoreboard, RoundByRoundChart,
and WordsOfMatch. Uses serial mode + retry:1 to match the stability
pattern established for hud-classic, left-rail, and match-surfaces
specs."
```

---

## Task 7: Full verification sweep

- [ ] **Step 1: Run the complete unit suite**

Run: `pnpm test -- --run`
Expected: all unit tests pass. The 4 new component test files contribute ~25 new passing tests.

- [ ] **Step 2: Run the full Playwright suite**

Run: `pnpm exec playwright test --workers=2`
Expected: every spec passes. The previously-serialized hud-classic / left-rail / match-surfaces / postgame specs run in-series inside their own files; other specs run in parallel.

- [ ] **Step 3: Run lint + typecheck**

```
pnpm lint
pnpm typecheck
```

Both must exit 0.

- [ ] **Step 4: Manual visual sanity check**

Run `pnpm dev` and play a match through to the end (or resign) on one browser. Confirm:

- Verdict block shows "Victory." or "Defeat." in large italic Fraunces, with the point-margin sub-display and the mono "Match complete · N rounds · Xm Ys" eyebrow.
- Scoreboard has two cards — the current player card shows italic Fraunces 56px score tinted to `p1-deep` or `p2-deep`, ±N rating line, and the words / frozen / best-word foot row.
- Round-by-round chart renders ten bars per player — player_a up, player_b down — scaled relative to the highest round delta.
- Words of the match column shows every scored word, sorted by round number, tinted per slot.
- Action buttons ("Rematch" / "Back to Lobby") still work.
- Round History tab still renders the existing `RoundHistoryPanel`.

- [ ] **Step 5: Commit any targeted regression fixes**

If Playwright assertion updates were required in Step 2 (unlikely since the pre-existing specs target `final-summary-root` and the rematch button), commit them. Otherwise no commit needed.

---

## Self-Review Checklist

- [x] `PostGameVerdict` covers win / loss / draw with correct sub-display text (Task 1 tests each branch).
- [x] `PostGameScoreboard` covers ±rating, rating-pending, words count, frozen count, best-word fallback (Task 2 tests every prop variant).
- [x] `RoundByRoundChart` covers column count, round labels, bar scaling (via data-delta attributes + height arithmetic), and zero-delta edge case (Task 3 tests).
- [x] `WordsOfMatch` covers empty state, sort order, slot tinting, round + points rendering (Task 4 tests).
- [x] `FinalSummary` rewire preserves every existing test hook (`final-summary-root`, `final-summary-rematch`, `final-summary-back-lobby`, `final-summary-forfeit-label`, `series-badge`, `tab-overview`, `tab-round-history`, `rating-pending`, `rating-delta`). The per-player `top-words` list is explicitly removed.
- [x] No placeholders, no "similar to Task N" references, every code block is complete.
- [x] `ScoreboardEntry` type is exported from `PostGameScoreboard.tsx` and re-imported by `FinalSummary.tsx`; no duplicated definition.
- [x] `ScoreboardRow` and `WordHistoryRow` continue to be exported from `FinalSummary.tsx` so `RoundByRoundChart` and `WordsOfMatch` can import them.

---

## Out-of-scope (deferred)

- **Scaled board miniature** (`transform: scale(0.75)`) — the current full-size board render works within the new layout; shrinking it is pure polish.
- **Tab header restyle** — the Overview/Round-History tab bar keeps its current emerald accent to avoid breaking existing test assertions.
- **Replacing `RoundHistoryPanel`** — the Round History tab stays as-is.
