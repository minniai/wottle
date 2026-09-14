# Research: Field & Ledger Redesign

**Feature**: `044-field-ledger-redesign` · **Date**: 2026-09-14
**Inputs**: `spec.md`, the design bundle (`docs/design_documentation/260914-wottle-new-design/`), a code map of the current match UI, engine/persistence path, and lobby/matchmaking/post-game/profile code (three read-only surveys, 2026-09-14).

Each item: **Decision** / **Rationale** / **Alternatives considered**. Items R1–R4 resolve the unknowns in the plan's Technical Context; R5–R14 fix the approach for each design surface.

---

## R1. Reading direction on scored word records (FR-013, FR-014)

**Decision**: Derive the direction from the tile order that is already stored; do not add a column. Add a pure helper `deriveReadingDirection(coordinates: Coordinate[]): ReadingDirection` (`"ltr" | "rtl" | "ttb" | "btt"`) in `lib/game-engine/readingDirection.ts`, and add an **optional** `direction?: ReadingDirection` to `WordScore` that the single row→`WordScore` mapper fills in. Consumers call the helper when the field is absent (older payloads).

**Rationale**: The scanner already builds a forward and a reversed `BoardWord` per run (`buildReverseBoardWord` reverses both letters and coordinates), and `WordScoreBreakdown.tiles` → `word_score_entries.tiles` (JSONB) → `WordScore.coordinates` preserve that order end to end. `coordinates[0]` is the reading start and `coordinates[1] − coordinates[0]` is the unit vector. A run valid both ways yields **one** record (overlapping same-axis readings conflict; the forward reading wins ties), so the design plan's "two chevrons" case never occurs — one chevron per band. No migration, no backfill, no change to the delete-then-insert idempotency in `computeWordScoresForRound`.

**Alternatives considered**: (a) `direction` column on `word_score_entries` + migration + backfill from `tiles` — rejected: redundant with data already present, touches the instant-scoring fast path's insert, and every read site has an explicit column list to update. (b) Client-only derivation with no type field — rejected: the mapper is a single place and typing it makes the contract explicit for the Zod schema and tests.

**Regression tests to pin (P0)**: `FÁR/RÁF scores once as the forward reading; a reverse-only word keeps reversed tile order; a single-direction run produces one record`; `BORÐA + GILT is rejected` (dictionary has `borða` and `gilt` but not `borðagilt`); `deriveReadingDirection` for all four vectors and a 1-tile degenerate input.

## R2. Preview scoring without exposing the dictionary (FR-018, Constitution I)

**Decision**: A read-only Server Action `previewSwap` (`app/actions/match/previewSwap.ts`) that runs the existing pure pipeline — `applySwap → scanFromSwapCoordinates → selectOptimalCombination → scoreBoardWords` — **without** `freezeTiles`, persistence or broadcast, and returns `{ words: { word, points }[], total }`. Two input shapes, validated with Zod: `{ matchId, from, to }` (server loads the authoritative board and frozen map) and `{ board, from, to }` (warm-up field; board validated as 10×10 uppercase Icelandic letters; frozen map empty). New rate-limit scope `match:preview-swap` (60/min per signed-in player; both variants require a session — spec Clarifications Q5, so no anonymous compute). Client calls it once per preview state entry (no polling) and shows `tap again to play` until the answer lands.

**Rationale**: The Icelandic wordlist is 54.9 MB / 3.7 M entries and `dictionary.ts` is Node-only (`fs`), so the design plan's "client-side scoring with the same function as the engine" cannot be done literally. The constitution forbids exposing the dictionary. The scan is already budgeted at <50 ms server-side and the dictionary is pre-warmed by `instrumentation.ts`, so a preview round-trip stays inside the 200 ms RTT budget. Preview is opt-in (decision Q2), so load is bounded.

**Alternatives considered**: (a) Ship a compressed DAWG/bloom filter of the dictionary — rejected: still tens of MB or gives false positives that would mis-price words. (b) Letter-value sum only, no dictionary check — rejected: prices non-words and contradicts "the same rules as the server". (c) Reuse `POST /api/match/[id]/move` with a dry-run flag — rejected: mixes a query into a command path that has rate limits and `after()` side effects.

## R3. Placeholder queue board (decision Q3, FR-040)

**Decision**: Extract `generateBoard` from `scripts/supabase/generateBoard.ts` into `lib/game-engine/boardGenerator.ts` as a pure module (seed is a required parameter; the `node:crypto` default is dropped so it bundles for the browser). The queue state seeds a placeholder with `"queue:" + playerId + ":" + startedAt` and lands its letters ~100 ms apart. When `startQueueAction` reports `matched`, the room fetches `GET /api/match/[id]/state` (existing) and swaps only the cells whose letter differs (`diffBoards(a, b): Coordinate[]`, pure). The lobby warm-up field uses the same generator seeded per session.

**Rationale**: The board is generated deterministically from `matches.board_seed`, so the placeholder and real board come from one function. No server change is needed for the placeholder path; the state endpoint already returns the real board. `scripts/supabase/generateBoard.ts` becomes a re-export so seeding scripts keep working.

**Alternatives considered**: Returning `boardSeed` from `getMatchOverviewAction` so the client can generate the real board itself — viable and cheap, kept as an optional follow-up; not needed for the decided placeholder behaviour.

## R4. Fonts (FR-009, Constitution VIII)

**Decision**: `Zilla_Slab` (weights 500/600/700) and `Red_Hat_Mono` (400/500/600), subsets `latin` + `latin-ext`, via `next/font/google`, exposed as `--font-board` and `--font-mono`; `Fraunces` and `JetBrains_Mono` removed from `app/layout.tsx`.

**Provenance**: verified against the font catalogue bundled with Next.js 16.2.7 (`node_modules/next/dist/compiled/@next/font/dist/google/font-data.json`, read 2026-09-14): Zilla Slab offers 300–700 static weights with `latin`, `latin-ext`; Red Hat Mono offers 300–700 plus `variable` with `latin`, `latin-ext`. Both cover Þ Ð Æ Ö Ý. Context7 was not needed; the catalogue is the authoritative source for `next/font/google`.

## R5. One room across routes without a flash (FR-001, FR-003, SC-008)

**Decision**: A route group `app/(room)/` whose `layout.tsx` mounts one client `RoomShell` and reads the session once; `/`, `/lobby`, `/matchmaking` and `/match/[matchId]` move under it as thin pages that hydrate a client `roomStore` (zustand, `lib/room/roomStore.ts`) with server-loaded data and set the room state (`lobby | queue | found | match | final`). The layout persists across child navigations in the App Router, so the field, presence subscription and match channel never unmount. In-room transitions (`play ranked ▸`, matched, match end, rematch) call `router.replace` for the URL and set the store directly — no `router.refresh()`, no `loading.tsx` skeleton in the group. Profile pages stay outside the group (they use the same grid but are not the room).

**Rationale**: Today every boundary is a full navigation (`router.refresh()` on login, `push('/matchmaking')`, `push('/match/{id}')`, `push('/match/{id}/summary')`) that tears down the presence store and match channel; `LobbyList` even has a 250 ms unmount hack to survive lobby-internal navigation. A persisting layout is the idiomatic App Router way to keep one component tree alive under changing URLs, and deep links/reloads keep working because each URL still resolves to a page that hydrates the same store.

**Alternatives considered**: A single `/` route with client-only state — rejected: match URLs must survive reload and be shareable for reconnect. Keeping separate pages and animating between them — rejected: cannot satisfy "the field never unmounts".

## R6. Seat-relative colour (FR-010)

**Decision**: `lib/constants/seatColors.ts` exporting `type Seat = "you" | "opp"`, `resolveSeat(viewerSlot, slot): Seat`, and `getSeatColors(viewerSlot, slot): { ink: "var(--you)" | "var(--opp)", band: "var(--you-band)" | …, live: … }`. `lib/constants/playerColors.ts` and `lib/match/selfColorStore.ts` are deleted at P1; every consumer (`BoardGrid`, `MatchClient`, `deriveHighlightPlayerColors`, `derivePostGameHighlightColors`, `FinalSummary`, `PostGameScoreboard`) either goes through the new function or is itself retired.

**Rationale**: The design forbids binding colour to `player_a`/`player_b`. The 14% and 30% alphas are the only allowed variants, so they are tokens (`--you-band`, `--you-live`, `--opp-band`, `--opp-live`) rather than computed at call sites.

## R7. Tokens, Tailwind and the style tests (FR-007, FR-008)

**Decision**: `app/globals.css` declares exactly `--paper --ink --rule --tint --muted --you --opp` (+ the four alpha derivatives from R6, `--future-label` for `#B9B4A6`, `--font-board`, `--font-mono`). `tailwind.config.ts` shrinks to `colors: { paper, ink, rule, tint, muted, you, opp }`, `fontFamily: { board, mono }`, `borderRadius: { DEFAULT: "0", none: "0" }`, no `boxShadow`, no legacy aliases. `app/styles/lobby.css`, `profile.css`, `matchmaking.css` are deleted; `board.css` is replaced by `app/styles/room.css` (layout + field + bars + ledger; only `@keyframes` for shake, band draw, count-up, lane blink, letter land, plus the reduced-motion block). The regex-over-CSS tests in `tests/unit/styles/` are replaced by one `tokens.test.ts` (seven values declared, no others) and one `acceptance-grep.test.ts` that runs the design plan §10 greps (`rounded-`, `shadow-`, `gradient`, `emerald`, `red-`, `amber`, `Fraunces`, `Inter`, `JetBrains`) over `app/` and `components/`, initially scoped to the folders each step has converted and widened per step.

**Rationale**: The existing style tests assert the Warm Editorial contract and will break mechanically; replacing them with the new contract is TDD-red for P1. Tailwind still handles layout utilities; the theme is where the seven-token rule is enforced.

## R8. Room layout and field sizing (FR-002, FR-003, FR-004)

**Decision**: `Room` is a CSS grid (`minmax(0,1fr) 340px`, gap 56px at ≥1100px; `260px`/40px at 900–1100px; one column below 900px). `useFieldSize(roomRef)` (ResizeObserver) computes `min(roomHeight − 2·barHeight − 2·12 − 48, 720)` and sets `--field-size` on the stack; the ledger stretches to the stack's height via the grid row. Below 900px the ledger renders only its live row under the bottom bar; `LedgerSheet` (a plain `<dialog>`-free bottom sheet using `useFocusTrap`) shows the rest.

**Rationale**: The design system forbids viewport-unit maths; ResizeObserver is exact and handles browser chrome and on-screen keyboards. The existing `usePinchZoom` is removed — the field is full width and cells are ≥37px on 390px (see Constitution IV justification in `plan.md`).

## R9. Field states and bands (FR-011–FR-016)

**Decision**: `Field` renders 100 `FieldCell` buttons over a `FieldBands` SVG sibling (absolute, `pointer-events:none`, same box) — bands are below cells in paint order and cells have transparent backgrounds, so nothing is "over" the field. Band geometry is a pure function `computeBandRects(word, cellSize)` (`lib/room/bandGeometry.ts`) returning the rect in percent units and the chevron edge from `direction`. Cell state is a pure reducer `fieldInteraction.ts` with states `idle | picked | preview | committed` and events `tap(coord) | drag(from,to) | esc | opponentPin(coords) | frozenTap(coord)`, parameterised by `previewEnabled`. Band draw animates `transform: scaleX/scaleY` from the reading start (GPU) with `transform-origin` set per direction; count-up uses a RAF hook; all read `prefers-reduced-motion` through one `useReducedMotion()`.

**Rationale**: Keeping the interaction machine pure makes the opt-in preview, the opponent-pin interruption and Esc handling unit-testable without DOM; the SVG keeps geometry under 60 lines; transforms keep 60 fps.

## R10. Reveal choreography (FR-045, US6)

**Decision**: `lib/room/revealSequence.ts` — `planReveal(words, options): RevealStep[]` produces timed steps (`band(i) at t`, `ledgerWrite(i) at t`, `countUp at t`, `settle at t`) with 400 ms/120 ms stagger, or a single `settle at 0` under reduced motion. `useReveal(plan)` schedules steps with one `setTimeout` chain and exposes `{ bandsDrawn, wordsWritten, totalsShown, settled }`. It replaces `animationPhase`, `highlightTimerRef`, `roundAnnounce` and the recap timers in `MatchClient`. The partial (first-mover) reveal and the full round summary feed the same planner; dedupe keys stay (`buildPartialRevealKey`, `${playerId}-${submittedAt}`). The planner receives the set of band ids already drawn this round so a first-mover word revealed mid-round is not drawn again at resolution (spec Clarifications Q3).

## R11. Ledger rows and the fold rule (FR-031, FR-034)

**Decision**: `lib/room/ledgerRows.ts` — `buildLedgerRows(state): LedgerRow[]` (ten rows, per-seat word cells, totals, `live` flag) and `foldRows(rows, measured: LineCount[]): LedgerRow[]` (collapse rounds older than the last three to totals when any row measures >3 lines). Line counts come from a `useMeasuredLines` hook (offsetHeight ÷ line-height) after layout; folding is a pure function of the measurements so it is unit-tested with fixtures.

## R12. Player bar clocks (FR-025–FR-029)

**Decision**: `PlayerBar` receives `clockMs`, `clockRunning`, `budgetMs` (300 000) and renders the lane as a `role="progressbar"` div with `width: calc(var(--lane-fraction) * 100%)`; `deriveClockUrgency` is reduced to `isLowClock(ms) => ms < 60_000` (the yellow/red tones and the 30 s/15 s thresholds are deleted with their tests, replaced by a `< 1:00` test). Client ticking reuses the existing 1 s `timerTick` approach from `MatchClient`, extracted to `useClockTick(timers)`.

## R13. Disconnect without an overlay (FR-027)

**Decision**: Extend `MatchState` with `disconnectedAt?: string | null` and `reconnectWindowMs?: number`, populated by `loadMatchState` from the disconnect store / heartbeat staleness (both already know the timestamp). The bar sub-line counts down from that anchor; `DisconnectionModal` and the client-side `disconnectStartedAt` reconstruction are removed. `claimWinAction` is reachable from a live-row line (`opponent gone · claim the win ▸`) once the window has elapsed.

**Rationale**: Today a client that mounts mid-disconnect restarts the 90 s from zero; the sub-line countdown needs the true anchor. Small, additive contract change on an existing broadcast.

## R14. Preferences with cross-component sync (FR-019, FR-046)

**Decision**: Replace the per-hook `useState` in `useSensoryPreferences` with a zustand store `lib/preferences/preferencesStore.ts` holding `{ soundEnabled, hapticsEnabled, previewEnabled }` under the existing `localStorage` key (migrating the old shape by defaulting `previewEnabled: false`). The `⋯` menu and the field read the same store, so toggling preview or sound applies immediately.

**Rationale**: The current hook has no cross-component sync (toggling in `UserMenu` does not reach `MatchClient` until remount); the `⋯` menu and the field are separate subtrees.

## R15. Testing approach

**Decision**: Unit (Vitest + Testing Library): pure modules first (`readingDirection`, `bandGeometry`, `fieldInteraction`, `revealSequence`, `ledgerRows`, `seatColors`, `boardGenerator`, `diffBoards`, `previewSwap` scoring path with a stub dictionary), then components (`PlayerBar`, `Ledger`, `Field`, `Room` states). Integration (Vitest + Supabase): `previewSwap` action (match and warm-up inputs, rate limit, no rows written), `loadMatchState` `disconnectedAt`, `WordScore.direction` mapping. Playwright: one new two-player `room-flow.spec.ts` covering landing name entry without navigation → queue → found → pick/commit → opponent pin during preview (preview on) → reveal → final → rematch notice, plus `room-layout.spec.ts` for the three viewports and the overlap check (SC-001/SC-002); retired specs are deleted with their components. Accessibility: `@axe-core/playwright` on each room state.

**Rationale**: Matches the constitution's TDD and coverage requirements and the design plan §10; the existing two-player helpers in `tests/integration/ui/helpers/matchmaking.ts` are reused.
