# Contract: additive changes to existing broadcasts and loaders

All changes are optional fields; existing clients ignore them, new clients fall back when absent.

## `WordScore.direction?: "ltr" | "rtl" | "ttb" | "btt"`
- Carried in `RoundSummary.words`, `PartialRoundSummary.words`, the round summary route and the summary page loader.
- Filled by `mapWordScoreRow` from the stored `tiles` order; `deriveReadingDirection(coordinates)` is the fallback for payloads without it.
- `lib/match/schemas.ts` `wordScoreSchema`: `.optional()` enum.
- Regression tests: `FÁR/RÁF → one record, ltr`; `reverse-only word → one record with reversed tiles (rtl)`; `single-direction run → one record`; `BORÐA + GILT → GILT rejected`.

## `MatchState.disconnectedAt?: string | null`, `MatchState.reconnectWindowMs?: number`
- Emitted by `loadMatchState` whenever `disconnectedPlayerId` is set: `disconnectedAt` from `disconnectStore.getDisconnectedAt` or the heartbeat's last-seen timestamp; `reconnectWindowMs = RECONNECT_WINDOW_MS` (90 000).
- Travels on the `state` Realtime event and `GET /api/match/[matchId]/state`.
- Consumers: `PlayerBar` sub-line countdown; ledger claim-win line.

## `lib/game-engine/boardGenerator.ts` (moved from `scripts/supabase/generateBoard.ts`)
- `generateBoard({ seed: string; weights?: Record<string, number> }): string[][]` — pure, deterministic, browser-safe. `scripts/supabase/generateBoard.ts` re-exports it and supplies `randomUUID()` as the default seed for CLI use.
- `diffBoards(a, b): Coordinate[]` — coordinates whose letter differs; used to swap placeholder letters when the real board arrives.

## Rate-limit scopes
- New: `match:preview-swap` (60/min per signed-in player; no anonymous key). Existing scopes unchanged.

## Unchanged (explicitly)
`submitMove`, `POST /api/match/[id]/move`, `startQueueAction`, `cancelQueueAction`, `getMatchOverviewAction`, rematch actions, `claimWinAction`, `resignMatch`, `loginAction`, `logoutAction`, presence channel, `word_score_entries` schema, `matches` schema.
