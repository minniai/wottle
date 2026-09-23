# Contract: `deriveScoreboard` and `<Scoreboard>`

## `lib/room/scoreboard.ts`

```ts
export interface ScoreboardInput {
  phase: "starting" | "live" | "over";
  moveState: MoveState | null;       // the viewer's beat (null when read-only or over)
  remainingMs: number;               // server-corrected
  clockLengthMs: number;             // 300_000
  elapsedMs?: number;                // over: 4:52 of 5:00
  msToStart?: number;                // starting: the 3·2·1 fill
  moveLimit: number;
  you: SeatInput;
  opp: SeatInput;
  readOnly: boolean;
}
export interface SeatInput {
  name: string; rating: number | null; movesPlayed: number; inFlight: boolean; score: number;
  reconnectMsLeft: number | null;    // opp: window open
  goneForMs: number | null;          // opp: window spent
  offline: boolean;                  // you: own outage
  finalLine?: string;                // over
}
export function deriveScoreboard(input: ScoreboardInput, copy: Copy): ScoreboardView;
```

This function is pure: the same input always gives the same output. It never reads `Date.now()`.

## `components/room/Scoreboard.tsx`

- `<section data-testid="scoreboard" aria-label={copy.SCOREBOARD}>`, holding three rows.
- **Clock row:** `data-testid="scoreboard-clock"`, `role="timer"`, not live, `data-phase`. The track is `aria-hidden`. The numeral is mono with tabular figures.
- **Player rows:** `data-testid="scoreboard-row-{seat}"`, with `data-seat`, and `style --seat-ink` from `getSeatColors(seat)`. Children:
  - `scoreboard-name`: a link to the profile, which opens in a new tab while the match is live;
  - `scoreboard-subline` and `scoreboard-turn` (the suffix, with `data-tone`);
  - `scoreboard-track`: `role="progressbar"`, `aria-valuetext` = `copy.movesLeft(n, limit)`, `data-mode`;
  - `scoreboard-total`: the count-up is applied by the caller.
- **Geometry:**

  | | Desktop | Phone (≤900px) |
  |---|---|---|
  | Rows | 40px | 34px |
  | Columns | 216 · 1fr · 64 | 112 · 1fr · 36 |
  | Gaps | 16px | 10px |
  | Padding | 14px | 8px |
  | Tick marks | yes | no |

  The frame is 1.5px `--ink`. Under 1:00 the clock row takes `--tint`, its ticks become `--ink`, and the numeral goes to weight 700.
- **No animation.** The only change per second is the text and the tick count. Under reduced motion, `starting` renders at its end state.
