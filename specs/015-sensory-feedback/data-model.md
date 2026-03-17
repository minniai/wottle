# Data Model: Sensory Feedback & Sequential Round Reveal

**Branch**: `015-sensory-feedback` | **Date**: 2026-03-14

## Overview

No new database tables or columns are required. Changes are:
1. One existing column now populated (`rounds.started_at` for round 1)
2. Two TypeScript type extensions (`RoundMove`, new `SensoryPreferences`)
3. Three new client-side modules with no server persistence

---

## Type Changes

### 1. `RoundMove` — Extended with `submittedAt`

**File**: `lib/types/match.ts`

**Before**:
```typescript
export interface RoundMove {
  playerId: string;
  from: Coordinate;
  to: Coordinate;
}
```

**After**:
```typescript
export interface RoundMove {
  playerId: string;
  from: Coordinate;
  to: Coordinate;
  /** ISO timestamp from move_submissions.created_at. Used to determine sequential reveal order. */
  submittedAt: string;
}
```

**Population**: `lib/scoring/roundSummary.ts` — `aggregateRoundSummary()` receives submission records that include `created_at`; maps it to `submittedAt` on each `RoundMove`.

**Consumer**: `MatchClient.tsx` — sorts `RoundSummary.moves` by `submittedAt` ascending to determine which player's move to reveal first.

---

### 2. `SensoryPreferences` — New Type

**File**: `lib/types/preferences.ts` *(new file)*

```typescript
export interface SensoryPreferences {
  soundEnabled: boolean;
  hapticsEnabled: boolean;
}

export const SENSORY_PREFERENCES_DEFAULT: SensoryPreferences = {
  soundEnabled: true,
  hapticsEnabled: true,
};

export const SENSORY_PREFS_STORAGE_KEY = "wottle-sensory-prefs";
```

---

## Client-Side Modules

### 3. `useSensoryPreferences` Hook

**File**: `lib/preferences/useSensoryPreferences.ts`

**Shape**:
```typescript
function useSensoryPreferences(): {
  preferences: SensoryPreferences;
  setSoundEnabled: (enabled: boolean) => void;
  setHapticsEnabled: (enabled: boolean) => void;
}
```

**Behaviour**:
- Reads from `localStorage[SENSORY_PREFS_STORAGE_KEY]` on mount; falls back to `SENSORY_PREFERENCES_DEFAULT` if key absent or malformed.
- Writes back to `localStorage` on every change (synchronous, no debounce needed for two boolean values).
- Changes propagate immediately to all consumers via React state.
- SSR-safe: `localStorage` access guarded with `typeof window !== "undefined"`.

---

### 4. `useSoundEffects` Hook

**File**: `lib/audio/useSoundEffects.ts`

**Shape**:
```typescript
function useSoundEffects(enabled: boolean): {
  playTileSelect: () => void;
  playValidSwap: () => void;
  playWordDiscovery: () => void;
  playInvalidMove: () => void;
  playMatchStart: () => void;
  playMatchEnd: () => void;
}
```

**Behaviour**:
- Creates an `AudioContext` lazily on first call (respects browser autoplay policy).
- Each `play*` function is a no-op when `enabled === false` or `AudioContext.state === "suspended"`.
- Each sound is synthesized with oscillator nodes (see research.md § Decision 1 for parameters).
- `AudioContext` is shared (singleton per hook instance) to avoid resource exhaustion.
- On unmount, the `AudioContext` is closed.

---

### 5. `useHapticFeedback` Hook

**File**: `lib/haptics/useHapticFeedback.ts`

**Shape**:
```typescript
function useHapticFeedback(enabled: boolean): {
  vibrateValidSwap: () => void;
  vibrateInvalidMove: () => void;
  vibrateMatchStart: () => void;
  vibrateMatchEnd: () => void;
}
```

**Behaviour**:
- Each function calls `navigator.vibrate(pattern)` when `enabled === true` and `navigator.vibrate` exists.
- Returns silently (no error) when the Vibration API is unavailable.
- Vibration patterns (see research.md § Decision 5).

---

## Database

### `rounds.started_at` — Now Populated for Round 1

**Table**: `rounds`
**Column**: `started_at TIMESTAMPTZ` (already exists, nullable)
**Change**: `lib/match/stateLoader.ts` populates this field at round 1 creation.

**Before** (stateLoader.ts, round 1 upsert):
```typescript
{
  match_id: matchId,
  round_number: 1,
  state: "collecting",
  board_snapshot_before: initialBoard,
  // started_at NOT set — intentional legacy omission
}
```

**After**:
```typescript
{
  match_id: matchId,
  round_number: 1,
  state: "collecting",
  board_snapshot_before: initialBoard,
  started_at: new Date().toISOString(),
}
```

**Impact**: `clockEnforcer.ts`'s `computeElapsedMs()` and `stateLoader.ts`'s timer status computation now correctly track elapsed time and pause status in round 1. No migration needed — the column accepts `NULL` for existing matches; only new matches created after this change benefit.

---

## Animation Phase State Machine

### `AnimationPhase` — Extended in `MatchClient.tsx`

**Before**:
```typescript
type AnimationPhase =
  | "idle"
  | "revealing-opponent-move"  // 1000ms
  | "highlighting"             // 800ms
  | "showing-summary";
```

**After**:
```typescript
type AnimationPhase =
  | "idle"
  | "revealing-player-one"    // 700ms — first submitter's swap + word highlights + score delta
  | "revealing-player-two"    // 700ms — second submitter's swap + word highlights + score delta
  | "showing-summary";
```

**Phase data available at each step**:
- Active player ID: `sortedMoves[0].playerId` (step 1), `sortedMoves[1].playerId` (step 2)
- Active swap tiles: `{ from, to }` from the active `RoundMove`
- Active word highlights: `words.filter(w => w.playerId === activePlayerId).flatMap(w => w.coordinates)`
- Active score delta: `words.filter(w => w.playerId === activePlayerId).reduce((sum, w) => sum + w.totalPoints, 0)`

**Reduced-motion path**: When `prefers-reduced-motion` is active, the same phase transitions fire at the same timing, but CSS transition classes are not applied — state changes appear instantly.

**Single-submission path**: When `moves.length === 1`, only `"revealing-player-one"` fires; `"revealing-player-two"` is skipped.
