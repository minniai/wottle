# Data Model: Field & Ledger Redesign

**Feature**: `044-field-ledger-redesign` · **Date**: 2026-09-14

No new tables. Three additive changes to existing wire types, one new read-only action contract, one preferences shape, and the client-side room model. Server-authoritative state (`MatchState`, `RoundSummary`, `PartialRoundSummary`) is unchanged except where marked **new**.

---

## 1. Wire-type changes (server → client)

### 1.1 `WordScore` (`lib/types/match.ts`) — add `direction`

```ts
export type ReadingDirection = "ltr" | "rtl" | "ttb" | "btt";

export interface WordScore {
  playerId: string;
  word: string;
  length: number;
  lettersPoints: number;
  bonusPoints: number;
  totalPoints: number;
  /** Ordered from the reading start; coordinates[0] is where the chevron sits. */
  coordinates: Coordinate[];
  /** new — derived from `coordinates` by the row mapper; absent on legacy payloads. */
  direction?: ReadingDirection;
}
```

- **Derivation**: `deriveReadingDirection(coordinates)`: `dx>0 → ltr`, `dx<0 → rtl`, `dy>0 → ttb`, `dy<0 → btt` from `coordinates[1] − coordinates[0]`. Throws `InvalidWordGeometryError` for fewer than 2 coordinates or a non-orthogonal step.
- **Validation**: `wordScoreSchema` gains `direction: z.enum(["ltr","rtl","ttb","btt"]).optional()`.
- **Invariant**: exactly one `WordScore` per run; when both readings are words the record is the forward one (`ltr`/`ttb`). A reversed record (`rtl`/`btt`) exists only when the reversed reading alone is a word.
- **Filled by**: the shared mapper `mapWordScoreRow(row)` (`lib/match/wordScoreRow.ts`, new) used by `stateLoader.mapWordScores`, `publishRoundSummary`, `app/api/match/[id]/rounds/[round]/summary/route.ts` and `app/match/[id]/summary/page.tsx` (until the latter is retired).

### 1.2 `MatchState` — add disconnect anchor

```ts
export interface MatchState {
  // …existing fields unchanged…
  disconnectedPlayerId?: string | null;
  /** new — ISO timestamp when `disconnectedPlayerId` was first observed server-side. */
  disconnectedAt?: string | null;
  /** new — length of the reconnection window in ms (currently 90_000). */
  reconnectWindowMs?: number;
}
```

- **Source**: `loadMatchState` already consults `disconnectStore` (`getDisconnectedAt`) and heartbeat staleness; it now emits the anchor it used.
- **Consumers**: `PlayerBar` sub-line `reconnecting · m:ss left`; the ledger claim-win line appears when `now − disconnectedAt ≥ reconnectWindowMs`.

### 1.3 `SensoryPreferences` → `PlayerPreferences` (`lib/types/preferences.ts`)

```ts
export interface PlayerPreferences {
  soundEnabled: boolean;   // default true
  hapticsEnabled: boolean; // default true
  previewEnabled: boolean; // new — default false (decision Q2)
}
```

Stored under the existing `localStorage` key `wottle-sensory-prefs`; a stored object missing `previewEnabled` is read as `false`.

---

## 2. New read-only contract: `previewSwap`

See `contracts/preview-swap.openapi.yaml` and `contracts/preview-swap.md`.

```ts
type PreviewSwapInput =
  | { kind: "match"; matchId: string; from: Coordinate; to: Coordinate }
  | { kind: "warmup"; board: string[][]; from: Coordinate; to: Coordinate };

interface PreviewSwapResult {
  status: "ok" | "rejected" | "rate_limited" | "unauthenticated" | "error";
  words?: { word: string; points: number; direction: ReadingDirection }[];
  total?: number;
  error?: string;
}
```

- **Rules**: same pipeline as scoring minus freeze/persist. Match variant rejects swaps touching frozen tiles (`status: "rejected"`). Warm-up variant validates `board` as exactly 10×10 single uppercase letters from the Icelandic alphabet and uses an empty frozen map. Duplicate-word suppression is **not** applied (the preview prices the words as formed; the ledger row shows `0` for a duplicate only at resolution).
- **Side effects**: none. No rows, no broadcast, no timer change.
- **Auth**: both variants require a session (Q5); signed-out warm-up swaps are local only and never call this action.

---

## 3. Client room model (`lib/room/*`, not persisted)

### 3.1 `RoomState`

```ts
type RoomPhase = "lobby" | "queue" | "found" | "match" | "final";

interface RoomState {
  phase: RoomPhase;
  viewer: PlayerIdentity | null;          // null = empty bottom seat (landing)
  viewerSlot: PlayerSlot | null;          // from `match.timers.playerA.playerId`; null = read-only non-participant view (completed matches only, Q4)
  opponent: PlayerIdentity | null;        // null = empty top seat
  match: MatchState | null;               // server-authoritative snapshot
  board: string[][];                      // warm-up / placeholder / match board
  interaction: FieldInteraction;          // §3.3
  reveal: RevealProgress | null;          // §3.5
  ledger: LedgerModel;                    // §3.4
  notices: Notice[];                      // §3.6
  queue: { startedAt: number; lettersLanded: number } | null;
  found: { countdown: 3 | 2 | 1 } | null;
  connection: "realtime" | "polling";
}
```

Transitions: `lobby →(play ranked)→ queue →(matched)→ found →(countdown 0)→ match →(state=completed)→ final →(rematch accepted)→ found | →(new opponent)→ queue | →(lobby)→ lobby`. `queue →(cancel)→ lobby`. Every transition keeps `board` mounted; `queue → found` diff-swaps `board` to the real one.

### 3.2 `Seat` and colours

```ts
type Seat = "you" | "opp";
resolveSeat(viewerSlot: PlayerSlot, slot: PlayerSlot): Seat;
getSeatColors(seat: Seat): { ink: string; band: string; live: string }; // CSS var refs
```

Position is a function of seat: `opp` is always the top bar, `you` the bottom. When `viewerSlot` is null (read-only final room), player A renders as `you`-coloured bottom and player B as `opp`-coloured top, with no `· you` marker.

### 3.3 `FieldInteraction` (pure reducer)

```ts
type FieldInteraction =
  | { kind: "idle" }
  | { kind: "picked"; a: Coordinate }
  | { kind: "preview"; a: Coordinate; b: Coordinate; price: PreviewPrice | "pending" }
  | { kind: "committed"; a: Coordinate; b: Coordinate };

type FieldEvent =
  | { type: "tap"; at: Coordinate }
  | { type: "drag"; from: Coordinate; to: Coordinate }
  | { type: "escape" } | { type: "tapOutside" }
  | { type: "opponentPinned"; tiles: [Coordinate, Coordinate] }
  | { type: "roundAdvanced" } | { type: "priced"; price: PreviewPrice };

reduceField(state, event, ctx: { previewEnabled: boolean; frozen: Set<string>; pinned: Set<string> }):
  { next: FieldInteraction; effects: FieldEffect[] };
type FieldEffect = "submit" | "requestPrice" | "shake" | "soundPick" | "soundCommit" | "haptic" | { notice: string };
```

Rules: tapping a frozen/pinned coordinate → `shake` + notice, state unchanged; second tap with `previewEnabled=false` → `committed` + `submit`; with `true` → `preview` + `requestPrice`; tap `a` again in `picked`/`preview` → `idle`; `opponentPinned` covering `a` or `b` → `idle` + notice.

### 3.4 `LedgerModel`

```ts
interface LedgerRow {
  round: number;                       // 1..10
  status: "past" | "live" | "future";
  you: { words: WordCell[]; total: number } | null;
  opp: { words: WordCell[]; total: number } | null;
  liveText?: string;                   // `picking · T (2)` | `played ●` | words as they land
  folded: boolean;                     // totals only (fold rule)
}
interface WordCell { word: string; points: number; isDuplicate: boolean; coordinates: Coordinate[]; direction: ReadingDirection }
interface Territory { you: number; opp: number; free: number }   // from FrozenTileMap
interface LedgerModel { caption: string; rows: LedgerRow[]; territory: Territory; hint: string; verdict?: Verdict }
interface Verdict { winnerName: string | null; scoreLine: string; detailLine: string } // `Kári wins 170–127` / `by 43 points · 10 words to 8 · territory 32–25`
```

`buildLedgerRows(match, accumulated, viewerSlot)` is pure; `foldRows(rows, lineCounts)` is pure.

### 3.5 `RevealProgress`

```ts
interface RevealStep { at: number; kind: "band" | "write" | "countUp" | "settle"; wordIndex?: number }
interface RevealProgress { key: string; bandsDrawn: number; wordsWritten: number; totalsShown: boolean; settled: boolean }
```

`planReveal(words, { reducedMotion, alreadyDrawn: Set<bandId> })` → `RevealStep[]` — words whose band id is in `alreadyDrawn` get no `band`/`write` step, only the shared `settle` (Q3); `countUp` targets the total minus the delta already shown; the key is `${roundNumber}` for a full summary or `buildPartialRevealKey(partial)` for a first-mover reveal.

### 3.6 `Notice`

```ts
type Notice =
  | { kind: "frozen"; ownerName: string; round: number; expiresAt: number }
  | { kind: "pickCleared"; reason: "opponentPinned" | "frozen" }
  | { kind: "rematchRequest"; requesterName: string }
  | { kind: "resignConfirm"; expiresAt: number }
  | { kind: "firstMatchRules" }              // emitted when viewer gamesPlayed === 0 at match start (server stat, Q2)
  | { kind: "claimWin"; opponentName: string };
```

Rendered as live-row-styled lines only; at most one `frozen`/`pickCleared` at a time.

### 3.7 `WordBand` (render model)

```ts
interface WordBand {
  id: string;                 // `${playerId}:${word}:${coordinates[0].x},${coordinates[0].y}:${direction}`
  seat: Seat;
  cells: Coordinate[];
  direction: ReadingDirection;
  strength: "settled" | "live";      // 14% | 30%
  round: number;
  dimmed: boolean;                   // row hover elsewhere
}
computeBandRect(cells, direction): { x: number; y: number; w: number; h: number; chevronEdge: "left"|"right"|"top"|"bottom" } // percent units
```

Insets: 20% of a cell on the short axis, 5% on the long axis; chevron edge = `left` (ltr), `right` (rtl), `top` (ttb), `bottom` (btt).

---

## 4. Retired client models

`ScoreDelta`, `WordHistoryRow`/`ScoreboardRow` (as component-exported types — moved to `lib/room/ledgerRows.ts`), `ClockTone`/`ClockUrgency` (replaced by `isLowClock`), `PlayerColorSet`, `selfColorStore`, `MatchmakingClient.Phase`, `RematchPhase` stays (hook reused) but its UI states render as notices.
