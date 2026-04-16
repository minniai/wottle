# Data Model: Lobby Visual Foundation

**Feature**: 019-lobby-visual-foundation
**Date**: 2026-04-16

## Storage Changes

**None.** This feature introduces no tables, columns, migrations, indexes, or RLS policies. All persisted state is read from existing tables (`players`, `lobby_presence`, `matches`) through already-wired Server Actions and API routes.

## New TypeScript Types (non-persisted)

All exported from `lib/types/match.ts` except where noted.

### `LobbyMatchesStats`

Response shape for the new matches-in-progress endpoint.

| Field | Type | Notes |
|-------|------|-------|
| matchesInProgress | number | Count of rows in `matches` with `status = 'active'`. Non-negative integer. |

### `ModeSelection`

Locally-held UI state in `PlayNowCard`. Not transmitted to the server this iteration (iteration 2 will promote it into the `startQueueAction` input).

| Value | Status |
|-------|--------|
| `"ranked"` | Active (default) |
| `"casual"` | Disabled placeholder (FR-006) |
| `"challenge"` | Disabled placeholder (FR-006) |

### `GeneratedAvatar` *(exported from `lib/ui/avatarGradient.ts`)*

Pure-function output consumed by `<Avatar />` when `avatarUrl` is null.

| Field | Type | Notes |
|-------|------|-------|
| background | string | `linear-gradient(135deg, hsl(h1 65% 45%), hsl(h2 65% 30%))` |
| foreground | string | `#F2EAD3` or `#0B1220`, chosen for ≥4.5:1 contrast |
| initials | string | 1–2 grapheme clusters from `displayName` (Intl.Segmenter) |

### `DirectoryOrderingInput` / `DirectoryOrderingOutput` *(exported from `lib/lobby/directoryOrdering.ts`)*

Inputs and outputs of the pure ordering function (FR-009a, FR-009b).

```typescript
interface DirectoryOrderingInput {
  players: PlayerIdentity[];
  selfId: string;
  viewerRating: number;
  cap: number;          // default 24 (LOBBY_DIRECTORY_CAP)
}

interface DirectoryOrderingOutput {
  visible: PlayerIdentity[]; // length ≤ cap; self always included
  hidden: PlayerIdentity[];  // remainder, preserved for "Show all"
}
```

### `ToastMessage` *(exported from `components/ui/Toast.tsx`)*

| Field | Type | Notes |
|-------|------|-------|
| id | string | Client-generated UUID |
| tone | `"success" \| "error" \| "info"` | Drives styling and aria-live politeness |
| title | string | Short label, required |
| description | string \| undefined | Secondary line, optional |
| autoDismissMs | number \| undefined | Default 4000; `null` keeps until user dismiss |

### `HeroWord` *(exported from `lib/lobby/heroWords.ts`)*

| Field | Type | Notes |
|-------|------|-------|
| letters | string[] | Grapheme-cluster array, preserves `Þ`/`Æ`/`Ð`/`Ö` |
| locale | `"is"` | Always Icelandic this iteration |
| isProductName | boolean | `true` only for `ORÐUSTA` |

## Existing Entities (unchanged)

### `players` table

Read-only via existing Server Actions. Columns consumed: `id`, `username`, `display_name`, `avatar_url`, `elo_rating`. No writes, no new columns.

### `lobby_presence` table

Read-only via existing presence channel. Columns consumed: `player_id`, `status`, `last_seen_at`. No schema change.

### `matches` table

New aggregate read for matches-in-progress count: `SELECT COUNT(*) FROM matches WHERE status = 'active'`. Zero impact on write path, conflict resolution, or RLS model. Existing RLS policy already allows authenticated reads of the aggregate.

### `PlayerIdentity` (existing type)

No change. The `avatarUrl` field remains `string | null`; `<Avatar />` renders the generated fallback when null, otherwise the asset.

### `RoundSummary`, `MatchState`, `TimerState`

Unaffected. Feature is lobby-scoped.

## State Machines

### `PlayNowCard` queue state

```
idle ── PlayNow click ──► queuing ─── matched ──► transitioning → match route
                                │
                                └── cancel click ──► idle
```

Transitions are driven by the existing `startQueueAction()` return values. No new server states.

### `InviteDialog` flow

```
closed ── Challenge click ──► open (send variant)
                                      │
                                      ├── confirm ──► sending ──► sent (toast) ──► closed
                                      └── cancel / Escape / backdrop ──► closed

closed ── incoming invite poll ──► open (receive variant)
                                           │
                                           ├── accept ──► joining ──► match route
                                           ├── decline ──► closed (toast)
                                           └── expiry timer ──► closed (toast)
```

Backed entirely by existing `sendInviteAction` and `respondInviteAction`. No new server states.

## Invariants & Validation

- **Avatar determinism**: `generateAvatar(id, name)` MUST return deep-equal output across repeated calls within a process and across different sessions for the same `id`. Enforced by unit test in `tests/unit/lib/ui/avatarGradient.spec.ts`.
- **Directory cap**: `orderDirectory({ cap: N }).visible.length ≤ N` for all inputs; self is always in `visible` even when ranking would place it outside the cap. Enforced by unit tests covering self-pinning, tie-breakers, and empty / single-player / overflow inputs.
- **Hero word set**: Set MUST include `ORÐUSTA` and MUST contain ≥3 additional words featuring at least one of Þ/Æ/Ð/Ö. Enforced by `heroWords.spec.ts` with a data-driven assertion.
- **Matches-in-progress count**: response count is ≥0 and is a finite integer; any non-conforming payload rejected client-side with a fallback of 0 (stats strip still renders, never throws).

## Constants (new)

Exported from `lib/constants/lobby.ts`:

| Name | Value | Purpose |
|------|-------|---------|
| `LOBBY_DIRECTORY_CAP` | `24` | Default cap for visible cards (FR-009a) |
| `LOBBY_STATS_POLL_MS` | `10_000` | Matches-in-progress poll cadence |
| `HERO_WORD_CYCLE_MS` | `5_000` | Cycle interval (FR-001a) |
| `HERO_WORD_FLIP_MS` | `350` | Per-letter flip duration |
| `HERO_WORD_STAGGER_MS` | `40` | Per-letter stagger between glyphs |
| `TOAST_DEFAULT_DISMISS_MS` | `4_000` | Matches existing toast behaviour |
