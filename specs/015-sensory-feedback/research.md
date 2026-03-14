# Research: Sensory Feedback & Sequential Round Reveal

**Branch**: `015-sensory-feedback` | **Date**: 2026-03-14

## Decision 1: Audio Implementation — Web Audio API Synthesis

**Decision**: Synthesize all sound effects at runtime using the browser's Web Audio API. No audio file assets.

**Rationale**:
- Zero asset management: no `.mp3`/`.ogg` files to host, version, or CDN-cache.
- Instant playback: oscillator nodes start in microseconds — easily within the 100ms requirement.
- Works offline and avoids network-dependent loading states.
- Smaller bundle: no audio files bundled with the app.
- Web Audio API is supported in all target browsers (Chrome, Safari, Firefox, Edge; iOS Safari 14.5+).

**How it works**: A single `AudioContext` is created lazily on first user interaction (respecting autoplay policy). Each sound is a short sequence of oscillator + gain nodes configured for the desired timbre and duration:
- Tile select: 880Hz sine, 80ms, fast decay
- Valid swap: 440→660Hz sine sweep, 180ms
- Word discovery: 523+659+784Hz chord (C5 major), 350ms, slow decay
- Invalid move: 180Hz sawtooth, 120ms, immediate decay
- Match start: 392→523→659Hz arpeggio, 400ms
- Match end: 659→523→392Hz descending, 400ms

**Autoplay policy handling**: `AudioContext` is created in a `"suspended"` state until the browser receives a user gesture. A `resume()` call is made on first interaction. All sound trigger calls check `context.state` and skip silently if still suspended.

**Alternatives considered**:
- Bundled `.mp3` files in `/public/sounds/`: Rejected — requires asset creation, loading states, CORS headers, and increases bundle/initial load.
- Howler.js library: Rejected — external dependency for a simple feature; Web Audio API covers the use case natively.
- HTML5 `<audio>` elements: Rejected — worse timing guarantees, harder to preload for low-latency playback.

---

## Decision 2: Sequential Reveal Order — `submittedAt` on `RoundMove`

**Decision**: Extend `RoundMove` with `submittedAt: string` (ISO timestamp from `move_submissions.created_at`). The client orders the two reveal steps by comparing these timestamps.

**Rationale**:
- Server-authoritative ordering: submission timestamps come from the database record, not the client clock.
- Minimal change: `aggregateRoundSummary()` already queries `move_submissions`; adding `created_at` to the projection is a one-line change.
- The existing `RoundMove[]` array in `RoundSummary` is the natural place for this data — no new broadcast field needed.
- Aligns with Constitution I (server-authoritative): order is determined by the server, not client-side inference.

**Implementation path**:
1. Extend `RoundMove` type: `{ playerId: string; from: Coordinate; to: Coordinate; submittedAt: string }`
2. Update `aggregateRoundSummary()` in `lib/scoring/roundSummary.ts` to accept submission records with `created_at` and map them onto `RoundMove.submittedAt`.
3. `MatchClient` sorts `moves` by `submittedAt` ascending to determine reveal order.

**Alternatives considered**:
- Use array index as implicit order (first element = first submission): Rejected — relies on undocumented ordering of Supabase query results; fragile.
- Separate `firstSubmitterId` field on `RoundSummary`: Rejected — redundant; `submittedAt` is more informative and enables future features (e.g., showing submission timing gap).
- Client-side timestamp comparison using when the broadcast arrives: Rejected — violates Constitution I; network jitter would make this unreliable.

---

## Decision 3: Per-Player Word Highlights — Computed Client-Side

**Decision**: Derive per-player highlight coordinates client-side from the existing `RoundSummary.words: WordScore[]` array. No server changes needed.

**Rationale**:
- `WordScore` already carries `playerId` and `coordinates: Coordinate[]`. Filtering by `playerId` and flattening `coordinates` gives the tiles to highlight for each reveal step.
- Zero new data fields; zero new broadcast payload size.

**Per-player score delta**: Similarly derived client-side:
```
playerDelta = words.filter(w => w.playerId === id).reduce((sum, w) => sum + w.totalPoints, 0)
```

---

## Decision 4: Animation Phase Machine — Two Sequential Steps

**Decision**: Replace the current `AnimationPhase` union with a two-step reveal:

```
"idle"
  → "revealing-player-one"   (~600–800ms: first submitter's swap + their word highlights + score delta)
  → "revealing-player-two"   (~600–800ms: second submitter's swap + their word highlights + score delta)
  → "showing-summary"
```

**Rationale**: The current machine has `"revealing-opponent-move" → "highlighting" → "showing-summary"`. The new structure is a direct extension: each player gets their own reveal step. The existing CSS classes (`board-grid__cell--scored`, `board-grid__cell--opponent-reveal`) are reused; the component applies them per-player in sequence.

**Timing**: Each step is 700ms. Total = 1.4s ≤ 1.6s maximum (FR-003a).

**Reduced motion**: When `window.matchMedia("(prefers-reduced-motion: reduce)").matches`, CSS transitions are suppressed (the board updates state without animated transitions). The timing and phase sequence are preserved so data still appears in the correct order (FR-003b).

---

## Decision 5: Haptic Patterns — `navigator.vibrate()` Only

**Decision**: Use the standard Vibration API (`navigator.vibrate()`) exclusively with these patterns:

| Event | Pattern |
| ----- | ------- |
| Valid swap | `[15]` — single 15ms pulse |
| Invalid move | `[30, 50, 30]` — double staccato |
| Match start | `[100]` — distinct longer pulse |
| Match end | `[50, 30, 50]` — two-pulse closure |

**Rationale**: Standard W3C API, no dependencies. Supported on Android Chrome; silently no-ops on iOS Safari (iOS does not implement the Vibration API) and desktop — which is the desired behaviour (FR-016).

---

## Decision 6: Settings Persistence — `localStorage`

**Decision**: Store preferences as a single JSON object at key `wottle-sensory-prefs` in `localStorage`.

```json
{ "soundEnabled": true, "hapticsEnabled": true }
```

**Rationale**: Documented in spec Assumptions. No server-side preferences infrastructure exists; adding one would require a migration, auth changes, and server action. `localStorage` survives browser sessions (unlike `sessionStorage`), requires no login, and takes effect instantly.

**Default**: Both `true` (enabled). On first visit, no key exists → defaults apply → both features active.

---

## Decision 7: Settings UI Entry Point — Root Layout Header

**Decision**: Add the gear icon to the global root layout header in `app/layout.tsx`. The `SettingsPanel` component renders as a modal overlay when the icon is clicked.

**Rationale**: The root layout header is the only UI element visible on every page (lobby and match). Adding the gear icon here satisfies FR-019 (accessible from both lobby and in-match) with a single implementation. `GameChrome` (match-only) was considered but rejected because it would require duplicating the settings control in the lobby.

**Implementation**: The gear icon is a `<button>` in the header. The `SettingsPanel` is a client component with its own `useState` for open/closed. `useSensoryPreferences` hook is consumed inside `SettingsPanel` and wherever audio/haptic triggers fire.

---

## Decision 8: Round 1 Timer Fix — Add `started_at` at Creation

**Decision**: Add `started_at: new Date().toISOString()` to the round 1 `upsert` call in `lib/match/stateLoader.ts`.

**Rationale**: All subsequent rounds (2–10) set `started_at` at creation in `roundEngine.ts`. Round 1 was the only exception, left intentionally blank as a legacy holdover from first-move advantage design. Removing the exception makes all round creation code identical in intent. The `rounds.started_at` column already exists with the correct type — no migration needed.

**Side effects**: With `started_at` set, `computeElapsedMs()` in `clockEnforcer.ts` will correctly deduct time from the submitting player's clock in round 1. The `stateLoader`'s timer status computation (`"running"` vs `"paused"`) will also correctly pause the submitting player's displayed timer in round 1.
