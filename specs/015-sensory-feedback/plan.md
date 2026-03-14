# Implementation Plan: Sensory Feedback & Sequential Round Reveal

**Branch**: `015-sensory-feedback` | **Date**: 2026-03-14 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/015-sensory-feedback/spec.md`

## Summary

Five changes across three tiers:

1. **Round 1 Timer Parity** (server-side, 1 file): Round 1 is created without `started_at`, preventing per-player clock pause on first submission. Fix: populate `started_at` at round 1 creation in `lib/match/stateLoader.ts`.

2. **Sequential Round Resolution** (client-side, 2–3 files): Replace the current single-opponent-reveal with a two-step ordered reveal in `MatchClient.tsx`. Requires extending `RoundMove` with `submittedAt` so the client can determine submission order from the broadcast `RoundSummary`. Per-player word highlights are derived client-side from the existing `words: WordScore[]` array.

3. **Audio Feedback** (client-side, new module): Synthesize short sound effects via the Web Audio API — no audio file assets. A `useSoundEffects` hook exposes named trigger functions (`tileSelect`, `validSwap`, `wordDiscovery`, `invalidMove`). Triggered from `BoardGrid.tsx` and `MatchClient.tsx`.

4. **Haptic Feedback** (client-side, new module): Wrap `navigator.vibrate()` in a `useHapticFeedback` hook with named pattern constants. Fail silently on unsupported devices. Triggered from the same points as audio.

5. **Settings Panel** (client-side, new component + localStorage): Gear icon in the global root layout header (`app/layout.tsx`) opens a settings panel with two independent toggles — Sound Effects and Haptic Feedback — backed by a `useSensoryPreferences` hook that reads/writes `localStorage`. Preferences default to enabled.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20
**Primary Dependencies**: Next.js 16 (App Router), React 19+, Supabase JS v2, Web Audio API (browser-native), Vibration API (browser-native)
**Storage**: Browser `localStorage` (sensory preferences only); existing Supabase PostgreSQL (the `rounds.started_at` column already exists — just not populated for round 1)
**Testing**: Vitest (unit + integration); Playwright (E2E); Web Audio API and Vibration API mocked via `vi.stubGlobal()` in unit tests
**Target Platform**: Web, mobile-first (iOS Safari, Android Chrome, desktop browsers)
**Performance Goals**: Sound playback starts within 100ms of trigger; animations at 60fps; sequential reveal completes in ≤ 1.6s total
**Constraints**: `prefers-reduced-motion` respected for reveal animations; audio handles browser autoplay policy gracefully; haptics fail silently on unsupported devices
**Scale/Scope**: Client-only for audio/haptics/settings; server-side change limited to `stateLoader.ts` (add `started_at` to round 1 creation) and `roundSummary.ts` (add `submittedAt` to `RoundMove`)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Notes |
| --------- | ------ | ----- |
| I. Server-Authoritative | ✅ Pass | Round 1 timer fix is server-side. Audio/haptics/sequential reveal are presentation-layer only; they consume existing server-broadcast data (RoundSummary). No game state computed client-side. |
| II. Real-Time Performance | ✅ Pass | Sequential reveal is a presentation delay (≤1.6s post-round, not on the move RTT path). Audio synthesis via Web Audio API plays within 100ms (no network fetch). No impact on move RTT or broadcast latency. |
| III. Type-Safe End-to-End | ✅ Pass | `RoundMove` extended with `submittedAt: string`; `SensoryPreferences` type added to `/lib/types/`. All new hooks have explicit return types. |
| IV. Progressive Enhancement | ✅ Pass | Haptics and audio are opt-in enhancements; both default to enabled but can be disabled. Both fail silently. `prefers-reduced-motion` respected for animations. |
| V. Observability | ✅ Pass | Audio context creation failures and `navigator.vibrate` unavailability are caught and logged via existing structured logger. No new performance marks required (audio latency is browser-internal). |
| VI. Clean Code | ✅ Pass | Each new module is single-responsibility: preferences (localStorage), audio (Web Audio API), haptics (Vibration API), settings panel (UI). All functions ≤ 20 lines. |
| VII. TDD | ✅ Pass | All changes follow Red → Green → Refactor. Tests for `useSensoryPreferences`, `useSoundEffects`, `useHapticFeedback`, and the `stateLoader` round 1 fix written before implementation. |
| VIII. External Context | ✅ Pass | Web Audio API and Vibration API are well-documented W3C standards; no Context7 lookup required. `prefers-reduced-motion` is a standard CSS media query. |
| IX. Commit Standards | ✅ Pass | Conventional Commits format enforced; test commits before implementation commits per TDD. |

## Project Structure

### Documentation (this feature)

```text
specs/015-sensory-feedback/
├── plan.md              # This file
├── research.md          # Phase 0: decisions and rationale
├── data-model.md        # Phase 1: type changes and data shape
├── quickstart.md        # Phase 1: dev environment notes
├── contracts/
│   └── round-move.ts    # Extended RoundMove type contract
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
# New modules
lib/preferences/
└── useSensoryPreferences.ts   # localStorage hook: { soundEnabled, hapticsEnabled }

lib/audio/
└── useSoundEffects.ts         # Web Audio API synthesized sounds

lib/haptics/
└── useHapticFeedback.ts       # navigator.vibrate wrapper with named patterns

# New components
components/ui/
└── SettingsPanel.tsx          # Gear icon + toggles modal/popover

# Modified files
lib/types/match.ts             # Extend RoundMove with submittedAt: string
lib/scoring/roundSummary.ts    # Populate submittedAt on RoundMove from move_submissions.created_at
lib/match/stateLoader.ts       # Add started_at to round 1 upsert
components/match/MatchClient.tsx  # Replace single-reveal phases with two-step sequential reveal
components/game/BoardGrid.tsx     # Add audio/haptic trigger points
app/layout.tsx                    # Add gear icon to global header

# New tests
tests/unit/preferences/useSensoryPreferences.test.ts
tests/unit/audio/useSoundEffects.test.ts
tests/unit/haptics/useHapticFeedback.test.ts
tests/unit/match/stateLoader.round1Timer.test.ts
tests/unit/scoring/roundSummary.submittedAt.test.ts
tests/integration/ui/sensoryFeedback.spec.ts  # Playwright
```

**Structure Decision**: Single Next.js project (existing structure). New lib modules follow the established domain-based organization (`/lib/<domain>/`). UI components follow `/components/<domain>/`. No new routes or API endpoints required.

## Complexity Tracking

No constitution violations. No complexity justification required.
