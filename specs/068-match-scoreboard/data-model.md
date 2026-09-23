# Data model: spec 068

There is no persistent data. Every entity below is a **client view model**, derived and never stored, computed from `MatchState`, `MoveResolution`, the room store and the current second.

## ScoreboardView

The output of `deriveScoreboard(input)`.

```ts
interface ScoreboardView {
  clock: ClockRow;
  opp: PlayerRow;
  you: PlayerRow;
}

interface ClockRow {
  phase: "starting" | "running" | "underMinute" | "lastSeconds" | "time" | "over";
  label: string;            // "≈27s a move" | "match clock" | "last 12s" | "time" | "starts in 3" | "match over · 4:52 of 5:00"
  numeral: string;          // "3:12"
  ticksLeft: number;        // 0..60 = ceil(remainingMs / 5000); starting: fills 0 → 60
  blocks: number[];         // 10 entries, each 0..6 ticks
}

interface PlayerRow {
  seat: "you" | "opp";
  name: string;
  rating: number | null;
  subline: string;          // the muted part: "1265 · opponent"
  suffix: string | null;    // "6 of 10 · playing", "move 4 of 10", "behind pace", "gone for 2:04", …
  suffixTone: "seat" | "muted";
  segments: SegmentState[]; // 10: "left" | "scoring" | "spent"
  laneMode: "moves" | "outlined";   // outlined = disconnected or offline
  total: number;
  behindPace: boolean;      // viewer only
  movesLeft: number;        // for the lane's aria-valuetext
}
```

**Validation rules**
- `blocks[k] = clamp(ticksLeft − 6k, 0, 6)`, and the sum of `blocks` equals `ticksLeft`.
- `behindPace` is true only for `seat === "you"`, with `movesLeft > 0` and `movesLeft − remainingMs/30000 ≥ 1`.
- `label` is the pace only while the viewer's move state is `yourMove` or `rejected`.
- The pace is `round(remainingSeconds / movesLeft)`; a value under 1 reads `<1s a move`.

**Clock row phases**

```text
starting ──(started_at)──▶ running ──(<60s)──▶ underMinute ──(≤15s)──▶ lastSeconds ──(0)──▶ time
                                                                                              │
any ─────────────────────────────(match completed)───────────────────────────────────▶ over ◀┘
```

**Sub-line suffixes**

| Seat | Condition | Suffix |
|---|---|---|
| opp | reconnect window open | `reconnecting · 0:42 left` (the muted part drops "opponent") |
| opp | window spent | `8 of 10 · gone for 2:04` |
| opp | 10 played | `10 of 10 · done` |
| opp | move in flight | `6 of 10 · scoring` |
| opp | otherwise | `6 of 10 · playing` |
| you | own outage | `offline · reconnecting` (lane outlined) |
| you | 10 played | `10 of 10 · done` |
| you | move in flight | `move 4 of 10 · scoring` |
| you | behind pace | `move 8 · behind pace` (seat tone) |
| you | yourMove or rejected | `move 4 of 10` (seat tone) |
| both | starting | `ready` |
| both | over | rating line (`1204 → 1212 · +8 · wins` or `rating pending`) |

## FieldGeometry

The output of `computeFieldSize`.

```ts
interface FieldGeometry {
  layout: "bars" | "scoreboard";
  cell: number;   // desktop scoreboard: integer px ≤ 71; phone: field / 10
  field: number;  // scoreboard: cell × 10 + 3; bars: as today, width-bounded
}
```

## LastMoves

```ts
type LastMoves = Record<"you" | "opp", Coordinate[]>;  // 0..2 cells each
```

Derived from each seat's latest `resolved` resolution: `swap.from` and `swap.to`, minus the cells frozen in the current frozen map.

## Line2Source

```ts
type Line2Kind = "offline" | "back" | "submitError" | "refused" | "pickCleared" | "endEarlyOffer" | "missedOrStakes" | "instruction";

interface Line2Source {
  kind: Line2Kind;
  text: string;
  pointsLost?: { value: number; label: string };  // rendered via the one --err helper
  action?: "endEarly";
}
```

`selectLine2(sources)` returns the first active source in `Line2Kind` order.

## Outage

It lives in `roomStore.connection`:

```ts
interface Outage {
  lostAt: number | null;
  recoveredAt: number | null;
}
```

`offline = lostAt !== null && recoveredAt === null`. `awayMs = recoveredAt − lostAt`, and `back` is shown for 4s after `recoveredAt`.

## Colour tokens

There are nine: `--paper`, `--ink`, `--rule`, `--tint`, `--muted`, `--you` `#147D7A`, `--opp` `#B56A4F`, `--opp-text` `#A1583D`, `--err` `#AD1F3D`. The derived `--opp-band` (14%) and `--opp-live` (30%) follow `--opp`.
