# Implementation Plan: Lobby Visual Foundation

**Branch**: `019-lobby-visual-foundation` | **Date**: 2026-04-16 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/019-lobby-visual-foundation/spec.md`

## Summary

Replace the "Phase 3" playtest lobby with a branded, mobile-first lobby. Introduce a thin Tailwind-wrapped UI primitives layer (Button, Card, Dialog, Avatar, Badge, Skeleton, Toast) under `components/ui/`, a Warm Editorial brand token system extending `tailwind.config.ts`, and a self-hosted Fraunces + Inter type pairing via `next/font`. Rebuild `app/(lobby)/page.tsx` as a hero-led composition: rotating Icelandic-noun tile motif (with **ORÐUSTA** first-class), live stats strip, dominant Play Now zone with mode pills (Ranked active; Casual/Challenge disabled), 24-card directory with gradient-initials avatars, and a Dialog-based invite flow. Lobby interaction and matchmaking Server Actions are untouched — this is a presentational and interaction overhaul.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19+, Next.js 16 (App Router)
**Primary Dependencies**: Tailwind CSS 4.x (theme extension), `next/font/google` (Fraunces variable + existing Inter), existing `zustand` presence store, existing `lib/a11y/useFocusTrap.ts` and `lib/a11y/rovingFocus.ts`. No Radix/shadcn/Framer Motion added.
**Storage**: None new. Reads existing `players`, `lobby_presence`, `matches` via already-wired Server Actions and API routes.
**Testing**: Vitest (unit/component), Playwright (E2E), `@axe-core/playwright` (accessibility audit — new dev dependency)
**Target Platform**: Web — modern evergreen browsers, iOS Safari 16+, Android Chrome 110+, desktop Chrome/Firefox/Safari current
**Project Type**: Web application (real-time competitive game)
**Performance Goals**: LCP < 2.0 s on throttled 4G mobile, CLS < 0.05, Lighthouse Performance ≥ 90; hero tile cycle at 60 FPS; skeleton shimmer and status pulse composited via GPU-only properties.
**Constraints**: No Framer Motion (constitution stack note permits CSS-transform animations; project convention is CSS-only — mirror `app/styles/board.css`). No new Realtime channel solely for lobby stats. Preserve all existing matchmaking / presence contracts. Generated avatars must be deterministic per `player.id` so the same player renders identically across sessions.
**Scale/Scope**: Playtest scale today (≤ ~30 online players); soft cap of 24 visible cards with inline expansion designed to carry through early access (≤ ~200 online).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Server-Authoritative | ✅ Pass | Zero new mutations; UI is a pure view over existing state. All interactions route through existing Server Actions (`loginAction`, `startQueueAction`, `sendInviteAction`, `respondInviteAction`). |
| II. Real-Time Performance | ✅ Pass | No new round-trips. Presence reuses existing WebSocket+polling. Matches-in-progress count polled every 10 s, no new Realtime subscription. Animations use only `transform` and `opacity`. |
| III. Type-Safe End-to-End | ✅ Pass | New UI primitives typed in TS. No new Server Actions. Consumed Server Action return shapes reused via existing `/lib/types` exports. |
| IV. Progressive Enhancement & Mobile-First | ✅ Pass | Spec is mobile-first by design (375 px baseline, sticky CTA, bottom-sheet dialog). CSS-only responsive switching (no JS viewport detection). |
| V. Observability & Resilience | ✅ Pass | Adds `performance.mark("lobby:lcp-candidate")` and `performance.mark("lobby:first-interaction")`. Polling-fallback indicator surfaces connection mode. |
| VI. Clean Code | ✅ Pass | Primitives are single-responsibility, ≤20-line functions; prop objects keep parameter counts ≤3; deterministic avatar generator is a pure function. |
| VII. TDD | ✅ Pass | Every primitive has a failing test written first (role, a11y contract, variant rendering). Deterministic avatar generator has unit tests. LobbyCard adopts Avatar with a failing test first. |
| VIII. External Context (Context7) | ✅ Pass | `next/font/google` Fraunces variable loading and `prefers-reduced-motion` patterns cited in research.md with source/version. |
| IX. Commit Standards | ✅ Pass | Conventional Commits; each passing primitive test commits separately per TDD rule. |

## Project Structure

### Documentation (this feature)

```text
specs/019-lobby-visual-foundation/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── consumed-apis.md # Phase 1 output — existing Server Actions / routes this feature depends on
├── checklists/
│   └── requirements.md  # From /speckit.specify
└── tasks.md             # Phase 2 output (/speckit.tasks — not created here)
```

### Source Code (repository root)

```text
components/ui/                       # NEW — design-system primitives
├── Button.tsx                        # NEW
├── Card.tsx                          # NEW
├── Dialog.tsx                        # NEW (composes lib/a11y/useFocusTrap)
├── Avatar.tsx                        # NEW (generated gradient-initials or asset)
├── Badge.tsx                         # NEW
├── Skeleton.tsx                      # NEW
├── Toast.tsx                         # NEW
└── ToastProvider.tsx                 # NEW (global toast context)

lib/ui/
├── avatarGradient.ts                 # NEW — deterministic gradient+initials from player.id
└── tokens.ts                         # NEW — TS accessors for brand tokens (for inline styles / canvas)

lib/lobby/
├── directoryOrdering.ts              # NEW — pure fn: rank+cap presence list (FR-009a)
└── heroWords.ts                      # NEW — curated rotation set (ORÐUSTA + ≥3 Icelandic nouns)

app/(lobby)/
└── page.tsx                          # MODIFY — hero + CTA zone + directory + login

app/styles/
├── lobby.css                         # NEW — keyframes mirroring board.css conventions
└── globals.css                       # MODIFY — register lobby.css, add safe-area inset vars

app/layout.tsx                       # MODIFY — load Fraunces via next/font, mount ToastProvider

components/lobby/
├── LobbyHero.tsx                     # NEW — wordmark + ORÐUSTA + rotating tile motif
├── LobbyStatsStrip.tsx               # NEW — online/matches counts
├── PlayNowCard.tsx                   # NEW — primary CTA + mode pills + queue state
├── InviteDialog.tsx                  # NEW — Dialog-based invite flow (replaces modal dropdown)
├── LobbyDirectory.tsx                # NEW — grid wrapper with soft cap + "Show all N"
├── LobbyList.tsx                     # MODIFY — consume Card/Skeleton, use directoryOrdering
├── LobbyCard.tsx                     # MODIFY — adopt Avatar, Badge; Challenge action
├── LobbyLoginForm.tsx                # MODIFY — reskin, relocated into CTA zone when logged-out
└── MatchmakerControls.tsx            # DELETE (superseded by PlayNowCard + InviteDialog)

tailwind.config.ts                   # MODIFY — brand.*, surface.*, text.*, accent.* tokens; Fraunces family

tests/unit/components/ui/             # NEW
├── Button.spec.tsx
├── Card.spec.tsx
├── Dialog.spec.tsx
├── Avatar.spec.tsx
├── Badge.spec.tsx
├── Skeleton.spec.tsx
└── Toast.spec.tsx

tests/unit/lib/ui/
└── avatarGradient.spec.ts            # NEW

tests/unit/lib/lobby/
├── directoryOrdering.spec.ts         # NEW
└── heroWords.spec.ts                 # NEW

tests/unit/components/lobby/
├── LobbyCard.spec.tsx                # MODIFY — add Avatar + Challenge assertions
├── LobbyHero.spec.tsx                # NEW
├── PlayNowCard.spec.tsx              # NEW
├── InviteDialog.spec.tsx             # NEW
└── LobbyDirectory.spec.tsx           # NEW

tests/integration/ui/
├── lobby-presence.spec.ts            # MODIFY — update selectors; add skeleton/empty assertions
└── lobby-visual.spec.ts              # NEW — hero above-fold, Dialog focus trap, reduced-motion, a11y audit
```

**Structure Decision**: A new `components/ui/` directory establishes the project's first proper primitives layer. Lobby-specific assemblies stay in `components/lobby/`. New helper pure functions live under `lib/ui/` and `lib/lobby/`. CSS mirrors the `app/styles/board.css` convention with a sibling `app/styles/lobby.css`. No new routes or Server Actions.

## Architecture

### Composition

```text
app/(lobby)/page.tsx  (Server Component)
└── LobbyShell
    ├── LobbyHero                     ── wordmark + ORÐUSTA + rotating tile motif
    ├── LobbyStatsStrip               ── online count (presence-reactive) · matches count (10s poll)
    ├── PlayNowCard                   ── primary CTA zone
    │   ├── ModePills (Ranked | Casual* | Challenge*)  *disabled
    │   ├── PlayNowButton (uses selectedMode)
    │   ├── QueueStatus (elapsed, cancel)
    │   └── LobbyLoginForm (only when session absent)
    ├── LobbyDirectory
    │   ├── LobbyCard × N (first 24 via directoryOrdering)
    │   ├── ShowAllButton (when players.length > 24)
    │   └── EmptyState / Skeleton variants
    ├── InviteDialog (portal, opens from LobbyCard.Challenge or PlayNowCard.Invite)
    └── ToastProvider region
```

### Data Flow

- **Session**: unchanged. `readLobbySession()` server-side → page.tsx decides logged-in vs logged-out composition.
- **Presence**: unchanged. `useLobbyPresenceStore` (Zustand) selectors feed `LobbyStatsStrip.online`, `LobbyDirectory.players`, and `LobbyCard` status.
- **Matches-in-progress count**: new `/api/lobby/stats/matches-in-progress` GET endpoint polled every 10 s from `LobbyStatsStrip` (reuses same pattern as existing `/api/lobby/players`). Alternative considered: add count to existing presence snapshot response (see research R5).
- **Mode selection**: `useState<"ranked" | "casual" | "challenge">("ranked")` inside `PlayNowCard`. Casual/Challenge pills rendered with `aria-disabled="true"` and ignore click. Play Now calls existing `startQueueAction()` which takes no mode arg today; the `mode` value is captured locally for UX but not transmitted — iteration 2 wires the Server Action.
- **Invite flow**: `InviteDialog` receives `{ open, opponentId?, onClose }` props. Uses `useFocusTrap`. On confirm, calls existing `sendInviteAction(targetId)` unchanged. Incoming invites still polled via existing `/api/lobby/invite` GET; the response drives a Dialog variant auto-opened for acceptance.

### Deterministic Avatar

`lib/ui/avatarGradient.ts`:

```typescript
export interface GeneratedAvatar {
  background: string;   // linear-gradient(...) CSS
  foreground: string;   // hex color for the monogram
  initials: string;     // 1–2 grapheme clusters, preserves combining diacritics
}

export function generateAvatar(playerId: string, displayName: string): GeneratedAvatar;
```

Uses a 32-bit FNV-1a hash of `playerId` → hue pair → gradient; contrast-checked against hueLightness to pick foreground `#0B1220` or `#F2EAD3`. `initials` extracts the first 1–2 grapheme clusters via `Intl.Segmenter` so Icelandic accented letters and combining marks survive.

### Directory Ordering

`lib/lobby/directoryOrdering.ts`:

```typescript
export interface DirectoryOrderingInput {
  players: PlayerIdentity[];
  selfId: string;
  viewerRating: number;
  cap: number; // default 24
}

export interface DirectoryOrderingOutput {
  visible: PlayerIdentity[]; // always includes self; length ≤ cap
  hidden: PlayerIdentity[];  // remainder for "Show all"
}

export function orderDirectory(input: DirectoryOrderingInput): DirectoryOrderingOutput;
```

Ranking: (1) `available` before other statuses; (2) smaller `|rating - viewerRating|` first; (3) most-recently-seen first. Self always pinned into `visible`.

### Animation Budget

All motion lives in `app/styles/lobby.css`:

- `@keyframes hero-tile-flip` — 350 ms rotateX flip per letter, staggered 40 ms per glyph
- `@keyframes status-pulse` — 1.6 s opacity 1 → 0.6 → 1 on `available` dot
- `@keyframes skeleton-shimmer` — 1.2 s translateX gradient sweep
- `@keyframes cta-hover-lift` — `transform: translateY(-1px)` on `:hover`
- `@keyframes hero-tile-cascade-in` — 600 ms stagger on first mount

All guarded by `@media (prefers-reduced-motion: reduce)` → `animation: none`.

### Constitution Post-Design Re-check

All gates remain Pass. No new server mutations introduced. Performance budget respected because the only new I/O is a 10 s HTTP poll for the matches-in-progress count (one row `SELECT COUNT(*)` with RLS allow). No constitutional complexity justification required.

## Implementation Phases

### Phase A — Foundation & Tokens (4 tasks)

1. Register `Fraunces` variable font via `next/font/google` in `app/layout.tsx`; add CSS variable `--font-fraunces`.
2. Extend `tailwind.config.ts` with `brand.*`, `surface.*`, `text.*`, `accent.*`, font family `display`.
3. Create `app/styles/lobby.css` with keyframes and reduced-motion guards; import from `app/globals.css`.
4. Create `lib/ui/tokens.ts` with TS accessors (for inline styles / dynamic scenarios).

### Phase B — UI Primitives (7 tasks, TDD)

5. `Button` + spec (variants, sizes, `disabled`, focus ring, forwarded ref).
6. `Card` + spec (elevation variants, interactive variant with focus ring).
7. `Dialog` + spec (open/close, focus trap, Escape, backdrop click, focus return).
8. `Avatar` + spec (asset vs generated; size variants; aria-label derives from displayName).
9. `Badge` + spec (status variants mapping to `surface + accent` pairs).
10. `Skeleton` + spec (rect/circle variants; reduced-motion static bg).
11. `Toast` + `ToastProvider` + spec (enqueue, dismiss, live region; no focus move).

### Phase C — Lobby Pure Helpers (2 tasks, TDD)

12. `lib/ui/avatarGradient.ts` + spec (deterministic, contrast, Intl.Segmenter initials).
13. `lib/lobby/directoryOrdering.ts` + spec (ordering rules, self-pinning, cap behaviour).

### Phase D — Hero & Word Cycle (3 tasks)

14. `lib/lobby/heroWords.ts` + spec (curated set containing ORÐUSTA and ≥3 Icelandic nouns with Þ/Æ/Ð/Ö).
15. `components/lobby/LobbyHero.tsx` + spec (wordmark, ORÐUSTA subtitle, tile motif, cycle timer with `prefers-reduced-motion` fallback to single fixed word).
16. Hero CSS in `lobby.css` (tile flip keyframes, stagger, cascade-in).

### Phase E — CTA Zone (3 tasks)

17. `components/lobby/PlayNowCard.tsx` + spec (mode pills, Ranked pre-selected, Casual/Challenge disabled with tooltip/aria-disabled, queue state, cancel).
18. Reskin `LobbyLoginForm.tsx` to consume new Button/input styles; ensure it renders inside `PlayNowCard` when session absent.
19. `components/lobby/LobbyStatsStrip.tsx` + spec (online count from presence store, matches count from poll).

### Phase F — Directory (4 tasks)

20. Modify `LobbyCard.tsx` to adopt `Avatar`, `Badge`, add `Challenge` action; update unit spec.
21. `components/lobby/LobbyDirectory.tsx` + spec (applies `orderDirectory`, renders skeletons, empty state, "Show all N").
22. Modify `LobbyList.tsx` to compose `LobbyDirectory` and expose `data-testid` surface expected by existing E2E selectors.
23. Wire `Challenge` click → open `InviteDialog` with pre-selected opponent.

### Phase G — Invite Dialog (2 tasks)

24. `components/lobby/InviteDialog.tsx` + spec (send-flow variant for outbound, receive-flow variant for incoming; uses `Dialog` primitive; bottom-sheet on mobile; wires `sendInviteAction` / `respondInviteAction`; emits toasts).
25. Delete `MatchmakerControls.tsx` after its behaviours live in `PlayNowCard` + `InviteDialog`; migrate incoming-invite poll into `InviteDialog` self-mount.

### Phase H — Page Shell & Observability (3 tasks)

26. Rewrite `app/(lobby)/page.tsx` into the new composition (logged-out vs logged-in branches share hero, swap CTA body).
27. Mount `ToastProvider` in `app/layout.tsx`; add `performance.mark("lobby:lcp-candidate")` at hero mount and `performance.mark("lobby:first-interaction")` on first `PlayNowCard` or form focus.
28. Add new `/api/lobby/stats/matches-in-progress` GET route (Supabase count query, `select=COUNT` with `status = 'active'` filter). Response typed via shared `LobbyMatchesStats` interface in `lib/types`.

### Phase I — E2E, A11y, Performance (4 tasks)

29. `tests/integration/ui/lobby-visual.spec.ts` — desktop (1440) and mobile (375) viewport checks: hero present, Play Now above fold, directory ≤24 cards, Dialog focus trap round-trip, Escape returns focus, `prefers-reduced-motion` disables keyframes.
30. Add `@axe-core/playwright` dev dep; integrate into `lobby-visual.spec.ts` for a11y pass on logged-out and logged-in views (zero serious/critical violations).
31. Update `tests/integration/ui/lobby-presence.spec.ts` selectors for new `data-testid`s; add skeleton + empty-state assertions.
32. Lighthouse CI configuration (`.lighthouserc.json`) and GitHub Actions step gating Performance ≥ 90, LCP < 2.0 s, CLS < 0.05 on the lobby route.

### Phase J — Cleanup (2 tasks)

33. Delete `MatchmakerControls.tsx` and its tests (after Phase G).
34. Remove any now-unused Tailwind utility literals (`white/10`, `slate-900/40`) from migrated components; replace with semantic tokens.

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Fraunces variable font FOIT on first load hurts LCP | High (SC-005) | `next/font/google` with `display: "swap"` and `preload: true`; ship as variable so no multi-weight waterfall. |
| Hero tile cycle keyframes jank on low-end mobile | Medium | `transform`/`opacity` only; respect reduced-motion; if devtools FPS < 55 during Lighthouse, fall back to 8 s cycle (longer idle, same effect). |
| Delete `MatchmakerControls` before InviteDialog handles incoming invites → regression | High | Keep deletion as final Phase J task; E2E tests in Phase I prove parity first. |
| 24-card soft cap ordering confuses users ("where's my friend?") | Medium | Self always pinned; "Show all N" always visible when cap exceeded; card anchor fragment lets URL deep-link to a username later. |
| Existing E2E suite expects `data-testid="matchmaker-start-button"` etc. | Medium | Preserve the same `data-testid`s on the new `PlayNowCard` controls; add assertions during Phase F/G tasks, not Phase J. |
| `@axe-core/playwright` adds a dev dependency | Low | Dev-only; constitution allows test tooling additions. |
| `lobby.css` keyframes override reduced-motion globally | Low | Mirror `board.css` convention: one media query at bottom of file resetting all lobby `animation` + `transition` to `none`. |
| New `/api/lobby/stats/matches-in-progress` endpoint leaks counts to unauthenticated clients | Low | Count is non-sensitive aggregate; keep it public like `/api/lobby/players`. Rate-limit via existing middleware scope. |

## Complexity Tracking

No constitution violations. No complexity justification needed.
