# Implementation Plan: Field & Ledger Redesign

**Branch**: `044-field-ledger-redesign` | **Date**: 2026-09-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/044-field-ledger-redesign/spec.md`; design bundle `docs/design_documentation/260914-wottle-new-design/` (system, plan, docs consistency, audit PDF); decisions Q1–Q3 (5:00 clock, instant commit default with opt-in preview, placeholder queue board).

## Summary

Replace every player-facing screen with one **room** — opponent bar / field / your bar on the left, one ledger on the right — rendered by a persisting `app/(room)/layout.tsx` so the field never unmounts across lobby → queue → found → match → final. Seven colour tokens, two fonts, seat-relative colour, no element ever over the field. Server contracts change additively only: `WordScore.direction` (derived from the stored tile order, no migration), `MatchState.disconnectedAt`/`reconnectWindowMs`, and a new read-only `previewSwap` Server Action so the opt-in preview can price a swap without exposing the dictionary. Work ships in six independently mergeable steps (P0–P5) that each retire a named set of components and end with the two-player Playwright flow green.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22 (`.nvmrc`), React 19, Next.js 16.2.7 (App Router)
**Primary Dependencies**: Tailwind CSS 4.x (via `@config tailwind.config.ts`), `next/font/google` (Zilla Slab 500/600/700, Red Hat Mono 400/500/600 — verified in the Next 16.2.7 font catalogue, research R4), Supabase JS v2 (Realtime + Postgres), Zod, zustand (already used for presence; reused for `roomStore` and `preferencesStore`), Web Audio + Vibration APIs (existing). No Framer Motion, no Radix, no new runtime dependency. Dev: `@axe-core/playwright` (new dev dependency for accessibility gates).
**Storage**: Supabase PostgreSQL — **no schema change**. Reads `word_score_entries.tiles` (order already encodes reading direction), `matches.frozen_tiles`, `matches.player_*_timer_ms`, `match_ratings`, `players`, `lobby_presence`, `rematch_requests`. `localStorage` for `PlayerPreferences` (existing key, one new boolean).
**Testing**: Vitest (unit + component via Testing Library, integration against local Supabase), Playwright (two-player E2E, serial mode + `retries: 1` in CI), Artillery (perf), axe (a11y). TDD Red → Green → Refactor per task.
**Target Platform**: Web — desktop ≥1100px, laptop 900–1100px, phones ≥390px portrait; Chromium in CI; Vercel + Supabase Cloud in production.
**Project Type**: Single Next.js web application (App Router, Server Actions, Client Components).
**Performance Goals**: Move RTT <200 ms p95 (unchanged path); `previewSwap` server compute <50 ms, RTT <200 ms p95; Realtime broadcast <100 ms (unchanged); 60 fps for band draw, preview exchange, picked scale, count-up (transform/opacity only); reveal + settle for three words <2.5 s; first paint of the room with no skeleton.
**Constraints**: Dictionary never reaches the browser (55 MB, Node-only loader); nothing positioned over the field; seven colour tokens + `#B9B4A6` future-row grey only; `border-radius: 0`; no viewport-unit maths for the field (ResizeObserver); no scroll at 1440×900 / 1280×800 / 390×844; `prefers-reduced-motion` → 0 ms end states; lanes `aria-valuemax=300`; coral text ≥17 px only.
**Scale/Scope**: ~20 retired components (~5 k lines incl. `BoardGrid` 943, `MatchClient` 1 382, `FinalSummary` 625), ~12 new components under `components/room/` each <300 lines, ~10 pure modules under `lib/room/`, 1 new Server Action + HTTP wrapper, 27 existing Playwright specs of which ~14 are replaced by 3 new ones. Two concurrent players per match; lobby ≤24 listed players (existing caps).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|---|---|---|
| I. Server-authoritative (NON-NEGOTIABLE) | **PASS** | No client-side scoring: the preview is a read-only Server Action (`previewSwap`, R2) that never persists or broadcasts; commit still goes through `submitMove`/`POST /api/match/[id]/move`; direction is derived from server-stored tile order (R1); placeholder board is cosmetic and replaced by the server board (R3). Clock stays server-ticked; the lane only renders `remainingMs`. |
| II. Real-time performance (NON-NEGOTIABLE) | **PASS** | Move path untouched. `previewSwap` reuses the pre-warmed dictionary and the <50 ms scan; called once per preview, never polled; perf script `tests/perf/preview-swap.yml` gates <200 ms p95. Animations are `transform`/`opacity` only (band `scaleX/scaleY`, picked `scale(1.08)`, preview `translate`); no layout properties animate. |
| III. Type-safe end-to-end | **PASS** | `previewSwap(input): Promise<PreviewSwapResult>` with Zod discriminated-union input; `ReadingDirection`, `PlayerPreferences`, `RoomState` in `lib/types/` / `lib/room/`; `wordScoreSchema` extended; client calls Server Actions directly. |
| IV. Progressive enhancement & mobile-first | **PASS with one justified deviation** | Touch-first whole-cell targets ≥44 px effective on 390 px; keyboard (arrows/Space/Enter/Esc/?/M) and drag are desktop enhancements; polling fallback retained (`connection: "polling"` in `roomStore`); own connection state is written into the viewer's bar sub-line (`reconnecting`), so status is shown without a badge. **Deviation**: the constitution's "scrollable container with pinch-to-zoom (50–150%)" is replaced by a full-width non-scrolling field — see Complexity Tracking. |
| V. Observability & resilience | **PASS** | `performance.mark("field:hydrated")`, `room:phase-change`, `preview-swap.priced` structured log; reconnection window now carried in `MatchState.disconnectedAt` (fixes the restart-from-zero countdown, R13); game continues on Realtime failure via the existing safety poller, moved into `roomStore`. |
| VI. Clean Code | **PASS** | Pure reducers/planners (`fieldInteraction`, `revealSequence`, `ledgerRows`, `bandGeometry`) separate from rendering; every new component <300 lines and functions <20 lines; the `lib → components` import in `currentRoundScored.ts` is removed; dead code (`GearMenu`, `SettingsPanel`, `matchmaking.css`, `getMatchRatings` either wired or deleted, `featureFlags` unchanged) removed as touched. |
| VII. TDD (NON-NEGOTIABLE) | **PASS** | Every task in `/speckit.tasks` starts with a failing test; the style regex tests are rewritten red-first (R7); Playwright `room-flow` is written before P4 lands; each passing test committed separately (`test(room): …`). |
| VIII. External context providers | **PASS** | Font availability verified against the Next.js 16.2.7 bundled `font-data.json` with provenance recorded in R4; no other external library behaviour is relied upon beyond what is already in the repo. |
| IX. Commit messages | **PASS** | Conventional Commits, `type(scope): subject` <80 chars; scopes `room`, `field`, `ledger`, `bars`, `engine`, `docs`. |
| Stack standards | **PASS** | Next.js 16 / React 19 / Tailwind 4 / Supabase / Server Actions; CSS transforms for animation (Framer Motion optional, not used); components organised by feature (`components/room/`). |

**Gate result (pre-research)**: PASS. **Gate result (post-design)**: PASS — one deviation documented below; no new runtime, no new table, no Edge Function.

## Project Structure

### Documentation (this feature)

```text
specs/044-field-ledger-redesign/
├── plan.md                         # This file
├── research.md                     # Phase 0 — R1–R15 decisions
├── data-model.md                   # Phase 1 — wire additions, previewSwap, room model
├── quickstart.md                   # Phase 1 — per-step verification + manual smoke
├── contracts/
│   ├── preview-swap.openapi.yaml   # HTTP wrapper of the previewSwap action
│   ├── preview-swap.md             # Server Action contract
│   ├── match-state-additions.md    # WordScore.direction, MatchState.disconnectedAt, boardGenerator move
│   └── room-components.md          # Room / PlayerBar / Field / Ledger props + test ids
├── checklists/requirements.md
└── tasks.md                        # Phase 2 — /speckit.tasks (not created here)
```

### Source Code (repository root)

```text
app/
├── layout.tsx                      # fonts → Zilla_Slab + Red_Hat_Mono (--font-board/--font-mono); TopBar removed; imports globals.css + styles/room.css
├── globals.css                     # seven tokens + alpha derivatives + --future-label
├── styles/room.css                 # NEW — room grid, field, bands, bars, ledger, keyframes, reduced-motion (replaces board.css; lobby/profile/matchmaking.css deleted)
├── (room)/                         # NEW route group — one persisting RoomShell
│   ├── layout.tsx                  # reads session once → <RoomShell session>{children}</RoomShell>
│   ├── page.tsx                    # "/"  → hydrates roomStore(phase: lobby, viewer: null | session.player)
│   ├── lobby/page.tsx              # "/lobby" → same as "/" with session required
│   ├── matchmaking/page.tsx        # "/matchmaking" → phase: queue
│   └── match/[matchId]/page.tsx    # loadMatchState + profiles → phase: match | final (also serves old /summary via redirect)
├── profile/…                       # kept routes; render components/profile/ProfilePage (rebuilt, same grid)
├── actions/match/previewSwap.ts    # NEW Server Action (contracts/preview-swap.md)
└── api/match/preview/route.ts      # NEW HTTP wrapper (OpenAPI)

lib/
├── types/match.ts                  # + ReadingDirection, WordScore.direction?, MatchState.disconnectedAt?/reconnectWindowMs?
├── types/preferences.ts            # PlayerPreferences (+ previewEnabled)
├── game-engine/readingDirection.ts # NEW deriveReadingDirection
├── game-engine/boardGenerator.ts   # MOVED from scripts/supabase/generateBoard.ts (pure, seeded) + diffBoards
├── match/wordScoreRow.ts           # NEW single row→WordScore mapper (fills direction)
├── match/schemas.ts                # wordScoreSchema.direction optional
├── match/stateLoader.ts            # emits disconnectedAt / reconnectWindowMs; uses wordScoreRow
├── constants/seatColors.ts         # NEW resolveSeat / getSeatColors (replaces playerColors.ts)
├── constants/copy.ts               # NEW fixed strings from design system §8 (one module, no inline copy)
├── preferences/preferencesStore.ts # NEW zustand store (replaces useSensoryPreferences internals)
└── room/                           # NEW pure client model
    ├── roomStore.ts                # zustand RoomState + transitions; owns match channel + safety poller
    ├── fieldInteraction.ts         # reducer idle→picked→(preview)→committed
    ├── bandGeometry.ts             # computeBandRect + chevron edge
    ├── revealSequence.ts           # planReveal (400/120 ms, reduced-motion → settle)
    ├── ledgerRows.ts               # buildLedgerRows, foldRows, buildVerdict, territory
    ├── clock.ts                    # isLowClock, formatClock, laneFraction (budget 300_000)
    └── notices.ts                  # Notice builders + expiry

components/
├── room/                           # NEW
│   ├── RoomShell.tsx               # client: subscribes presence/match channel via roomStore; renders Room
│   ├── Room.tsx                    # grid: PlayerBar(top) / Field / PlayerBar(bottom) | Ledger
│   ├── PlayerBar.tsx  ├── ClockLane.tsx  ├── NameInput.tsx
│   ├── Field.tsx      ├── FieldCell.tsx  ├── FieldBands.tsx
│   ├── Ledger.tsx     ├── LedgerRow.tsx  ├── LedgerLiveRow.tsx ├── LedgerFoot.tsx ├── LedgerSheet.tsx ├── LobbyLedger.tsx
│   ├── RoomMenu.tsx                # the ⋯ menu (sound, preview, profile, sign out | resign, leave)
│   └── hooks/ useFieldSize.ts useReveal.ts useClockTick.ts useMeasuredLines.ts useReducedMotion.ts
├── profile/ProfilePage.tsx …       # rebuilt on the same grid (P5); ProfileSidebar/Stat/WordCloud/MatchHistoryList deleted
├── match/useRematchNegotiation.ts  # KEPT (hook); every other components/match/* file deleted by P4
├── game/                           # DELETED by P3 (BoardGrid, Board, BoardCoordLabels, MoveFeedback, usePinchZoom)
├── lobby/, landing/, matchmaking/  # DELETED by P4 (queue logic extracted to lib/room/roomStore + useMatchmaking)
├── player/                         # PlayerProfileModal etc. DELETED by P5 (profile is a page)
└── ui/                             # Dialog + useFocusTrap kept for LedgerSheet; Avatar/Badge/Button/Card/GearMenu/SettingsPanel/Skeleton/Toast*/TopBar/UserMenu deleted

scripts/supabase/generateBoard.ts   # re-exports lib/game-engine/boardGenerator with randomUUID default seed

tests/
├── unit/lib/game-engine/{readingDirection,doubleReading,wholeRun.bordaGilt,boardGenerator.pure}.test.ts
├── unit/lib/match/{wordScoreRow,stateLoader.disconnectedAt}.test.ts
├── unit/lib/room/{fieldInteraction,bandGeometry,revealSequence,ledgerRows,clock,notices,roomStore}.spec.ts
├── unit/lib/constants/seatColors.spec.ts
├── unit/components/room/{PlayerBar,Field,FieldBands,Ledger,LedgerSheet,Room}.spec.tsx
├── unit/styles/{tokens,acceptance-grep}.test.ts          # replace the eight Warm Editorial regex tests
├── integration/match/previewSwap.spec.ts                 # match + warm-up inputs, rate limit, zero rows written
├── contract/preview-swap.contract.test.ts                # OpenAPI-backed
├── integration/ui/{room-flow,room-layout,profile-room}.spec.ts   # replace ~14 retired specs
└── perf/preview-swap.yml
```

**Structure Decision**: Single Next.js application (existing). The only structural additions are the `(room)` route group with a persisting layout, `components/room/`, and `lib/room/`. Everything else is replacement in place, organised by feature per Constitution VI.

## Step plan (each step ships alone; order from design plan §11)

| Step | Work | Contract / data changes | Retires | Gate |
|---|---|---|---|---|
| **P0** | `deriveReadingDirection` + `wordScoreRow` mapper + `WordScore.direction`; `MatchState.disconnectedAt`; `previewSwap` action + route + rate scope; `boardGenerator` move; `PlayerPreferences.previewEnabled`; copy module; regression tests `FÁR/RÁF`, `BORÐA + GILT` | all additive (R1, R2, R3, R13, R14) | — | unit + integration + contract green; no client change |
| **P1** | tokens/fonts/Tailwind; `room.css` skeleton; `(room)` layout + `RoomShell` + `roomStore` (match phase only, wrapping existing `MatchClient` internals temporarily); `PlayerBar` + `ClockLane` replacing HUD cards and compact bars; TopBar removed; `RoomMenu` | — | `HudCard`, `PlayerPanel`, `TimerDisplay`, `PlayerAvatar`, `MatchCenterChrome`, `RoundPipBar`, `TopBar`, `UserMenu`, `deriveClockUrgency` tones | style tests rewritten; `room-layout.spec` at three viewports; two-player flow green |
| **P2** | `Ledger` match variant: caption, header, rows, live row, territory, hint, notices (rematch/resign/first match/frozen), foot; `ledgerRows` + fold; row hover → band dim | — | `MatchLeftRail` + 3 cards, `ScoredWordsCard`, `TilesClaimedCard`, `ScoreDeltaPopup`, `RoundSummaryPanel`, `RoundHistoryPanel`, resign dialog | `Ledger` unit tests; fold fixtures; notices never open dialogs |
| **P3** | `Field` + `FieldCell` + `FieldBands`; `fieldInteraction` reducer (instant commit default, preview opt-in); shake + live-row notice; opponent pin handling; `revealSequence` + `useReveal` replacing `animationPhase`; remove `board.css` | preview calls `previewSwap` | `BoardGrid`, `Board`, `BoardCoordLabels`, `MoveFeedback`, `usePinchZoom`, lock banner, round announce, `WordHighlightOverlay`, `currentRoundScored`, `deriveHighlightPlayerColors`, `playerColors.ts`, `selfColorStore` | reducer + geometry + reveal unit tests; `room-flow` pick/commit/preview/Esc/opponent-pin |
| **P4** | Room phases lobby / queue / found / final: name input in the bar, warm-up field, `LobbyLedger` (here now, last matches), queue with placeholder letters landing + diff-swap, found countdown, final verdict + rating sub-lines + rematch notices + actions; `useMatchmaking` extracted from `MatchmakingClient`; old `/match/[id]/summary` redirects into the room | reads `getMatchOverviewAction`, `startQueueAction`, rematch actions, `match_ratings` via `getMatchRatings` | `LandingScreen`, `LandingTileVignette`, `LobbyHero`, `LobbyStatsStrip`, `PlayNowCard`, `LobbyList`, `LobbyDirectory`, `LobbyCard`, `EmptyLobbyState`, `InviteDialog`, `InviteToast`, `RecentGamesCard`, `TopOfBoardCard`, `MatchmakingClient`, `MatchRing`, `MatchmakingVsBlock`, `FinalSummary`, `PostGameVerdict`, `PostGameScoreboard`, `RoundByRoundChart`, `WordsOfMatch`, `RematchBanner`, `RematchInterstitial`, `DisconnectionModal`, `useCountdown`, `MatchClient`, `MatchShell`, `Toast*`, `lobby.css`, `matchmaking.css` | `room-flow` end to end; SC-008 field identity check |
| **P5** | `ProfilePage` on the room grid (identity, hairline chart, record row, best words, recent matches); `@axe-core/playwright` gates; acceptance greps widened to all of `app/` + `components/`; test-id docs + remaining `DOCS_CONSISTENCY.md` items; delete unused `ui/` primitives | — | `ProfileSidebar`, `ProfileStat`, `ProfileRatingChart` (rebuilt), `ProfileWordCloud`, `ProfileMatchHistoryList`, `PlayerProfileModal`, `ProfileSparkline`, `ProfileFormChips`, `ProfileActions`, `Avatar`, `Badge`, `Button`, `Card`, `Skeleton`, `GearMenu`, `SettingsPanel`, `profile.css` | grep list empty; axe clean; 1440×900 / 1280×800 / 390×844 acceptance |

**Risks and mitigations**

- *Persisting layout vs. server-loaded match state*: the match page hydrates `roomStore` on mount; in-room transitions call `router.replace` and set the store directly, so a reload of `/match/[id]` still works. Mitigation: `room-flow` asserts the field element identity is stable and a reload restores the same phase.
- *Two-player Playwright contention*: keep CI serial + `retries: 1`; the new specs reuse `helpers/matchmaking.ts`.
- *Style regex tests break mechanically at P1*: they are replaced, red-first, by `tokens.test.ts` and `acceptance-grep.test.ts` (R7).
- *`previewSwap` abuse*: rate-limited 60/min per signed-in player (no anonymous access), warm-up board validated to the alphabet; the action is a pure function of its input and writes nothing.
- *Reduced-motion and 60 fps*: single `useReducedMotion()` gate; only `transform`/`opacity` animate; Playwright asserts end states under `reducedMotion: "reduce"`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Constitution IV "board responsiveness: scrollable container with pinch-to-zoom (50–150%)" is replaced by a full-width, non-scrolling field with whole-cell hit targets (`usePinchZoom` deleted). | Design system §4 and spec FR-003/SC-001 require the room to fit 390×844 without scrolling and forbid geometry that moves the field; cells are ≥37 px CSS (≥44 px effective hit target) at 390 px, meeting the 44 px touch rule directly. | Keeping zoom/scroll would reintroduce the "wrong height budget" audit finding and put the field under a scroll container, breaking the "nothing over the field / no scrolling" acceptance. Recommend amending Constitution IV wording in a follow-up governance PR (rationale + impact recorded here). |
