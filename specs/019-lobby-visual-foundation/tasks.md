# Tasks: Lobby Visual Foundation

**Input**: Design documents from `/specs/019-lobby-visual-foundation/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/consumed-apis.md, quickstart.md

**Tests**: INCLUDED — Constitution Principle VII (TDD) is NON-NEGOTIABLE. Every primitive, pure helper, and user-visible behaviour has a failing test written before implementation.

**Organization**: Tasks are grouped by user story. Setup + Foundational phases unblock all stories.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US6); omitted for Setup, Foundational, and Polish phases
- Paths are absolute from repository root

## Path Conventions

- Web application layout (Next.js App Router), paths rooted at `/Users/ari/git/wottle`
- `app/`, `components/`, `lib/`, `tests/` at repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Brand tokens, typography, shared constants, and lobby-wide CSS scaffolding. Everything below depends on these.

- [X] T001 Register Fraunces variable font via `next/font/google` (subsets `["latin", "latin-ext"]`, `display: "swap"`, `preload: true`) in `/Users/ari/git/wottle/app/layout.tsx`; expose CSS variable `--font-fraunces` on the `<html>` element.
- [X] T002 Extend `theme.extend` in `/Users/ari/git/wottle/tailwind.config.ts` with `brand.{50,100,200,...,950}`, `surface.{0,1,2,3}`, `text.{primary,secondary,muted,inverse}`, `accent.{focus,warning,success}` scales; add `fontFamily.display = ["var(--font-fraunces)", "serif"]`. Leave existing `player.*` and `board.*` scales untouched (FR-003).
- [X] T003 [P] Create `/Users/ari/git/wottle/app/styles/lobby.css` with an empty scaffold: imports section, layer for lobby keyframes (to be populated in later phases), and a terminating `@media (prefers-reduced-motion: reduce)` block that resets `animation`/`transition` to `none` on every class in the file. Import it from `/Users/ari/git/wottle/app/globals.css`.
- [X] T004 [P] Create `/Users/ari/git/wottle/lib/constants/lobby.ts` exporting `LOBBY_DIRECTORY_CAP = 24`, `LOBBY_STATS_POLL_MS = 10_000`, `HERO_WORD_CYCLE_MS = 5_000`, `HERO_WORD_FLIP_MS = 350`, `HERO_WORD_STAGGER_MS = 40`, `TOAST_DEFAULT_DISMISS_MS = 4_000`.
- [X] T005 [P] Create `/Users/ari/git/wottle/lib/ui/tokens.ts` exporting typed accessors for the brand palette (`brandHex`, `surfaceHex`, `textHex`, `accentHex`) that mirror the Tailwind scales. Consumers are components that need hex values for inline styles (generated avatars, canvas).
- [X] T006 [P] Add `LobbyMatchesStats` and `ModeSelection` types to `/Users/ari/git/wottle/lib/types/match.ts`. `LobbyMatchesStats = { matchesInProgress: number }`. `ModeSelection = "ranked" | "casual" | "challenge"`.

**Checkpoint**: Tokens, fonts, CSS scaffold, and shared types exist. No primitive components yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: UI primitives library and pure helpers that every user story consumes. Constitution Principle VII: each primitive ships as a failing test followed by the minimum passing implementation.

**⚠️ CRITICAL**: No user story work may begin until this phase is complete.

### UI Primitives (TDD — test first, then impl)

- [X] T007 [P] Write failing Vitest spec at `/Users/ari/git/wottle/tests/unit/components/ui/Button.spec.tsx` asserting variants (`primary|secondary|ghost|danger`), sizes (`sm|md|lg`), `disabled` attribute, focus ring class, and forwarded `ref`.
- [X] T008 Implement `/Users/ari/git/wottle/components/ui/Button.tsx` until T007 passes. Use `React.forwardRef`, object props, Tailwind brand/accent tokens from T002.
- [X] T009 [P] Write failing Vitest spec at `/Users/ari/git/wottle/tests/unit/components/ui/Card.spec.tsx` asserting elevation variants (`0|1|2|3`), interactive variant (focus ring + hover transform), children rendering.
- [X] T010 Implement `/Users/ari/git/wottle/components/ui/Card.tsx` until T009 passes.
- [X] T011 [P] Write failing Vitest spec at `/Users/ari/git/wottle/tests/unit/components/ui/Dialog.spec.tsx` asserting `role="dialog"`, `aria-modal="true"`, required `aria-labelledby`, portal target, focus-trap cycling, Escape closes, backdrop click closes, focus returns to trigger on close.
- [X] T012 Implement `/Users/ari/git/wottle/components/ui/Dialog.tsx` composing `lib/a11y/useFocusTrap.ts`, rendered via `createPortal` to `document.body`, until T011 passes.
- [X] T013 [P] Write failing Vitest spec at `/Users/ari/git/wottle/tests/unit/components/ui/Avatar.spec.tsx` asserting asset-URL variant, generated-fallback variant (renders initials + gradient background), size variants (`sm|md|lg`), correct `aria-label` derived from `displayName`.
- [X] T014 Implement `/Users/ari/git/wottle/components/ui/Avatar.tsx` until T013 passes. Must consume `generateAvatar()` from T016 (adjust ordering if needed).
- [X] T015 [P] Write failing Vitest spec at `/Users/ari/git/wottle/tests/unit/lib/ui/avatarGradient.spec.ts` asserting determinism for the same `playerId`, 1–2-grapheme initials including Icelandic diacritics (`Ö`, `Þ`, combining characters), foreground contrast ≥4.5:1 against gradient midpoint.
- [X] T016 Implement `/Users/ari/git/wottle/lib/ui/avatarGradient.ts` (FNV-1a hash → HSL hue pair → gradient; `Intl.Segmenter` for initials; contrast-checked foreground) until T015 passes.
- [X] T017 [P] Write failing Vitest spec at `/Users/ari/git/wottle/tests/unit/components/ui/Badge.spec.tsx` asserting status variants (`available|matchmaking|in_match|offline|info|warning`), correct surface + accent token pairs, text content rendering.
- [X] T018 Implement `/Users/ari/git/wottle/components/ui/Badge.tsx` until T017 passes.
- [X] T018a [P] Extend T017's Badge spec and T018's implementation to support a `pulse?: boolean` prop (FR-025). When `pulse` is true, Badge applies a `lobby-status-dot--pulse` class that attaches the pulse animation to an inner dot element. Add `@keyframes status-pulse` (1.6 s `opacity: 1 → 0.6 → 1`, GPU-composited via `opacity` only) to `/Users/ari/git/wottle/app/styles/lobby.css`. Assert via spec that `animation-name` resolves to `status-pulse` when `pulse` is true and to `none` when absent or under `prefers-reduced-motion: reduce`. `LobbyCard` (T044) will enable `pulse` for `available` status.
- [X] T019 [P] Write failing Vitest spec at `/Users/ari/git/wottle/tests/unit/components/ui/Skeleton.spec.tsx` asserting rect and circle variants, `aria-hidden="true"`, shimmer class present, reduced-motion class fallback.
- [X] T020 Implement `/Users/ari/git/wottle/components/ui/Skeleton.tsx` until T019 passes; add `@keyframes skeleton-shimmer` to `/Users/ari/git/wottle/app/styles/lobby.css`.
- [X] T021 [P] Write failing Vitest spec at `/Users/ari/git/wottle/tests/unit/components/ui/Toast.spec.tsx` asserting `role="status"` (success/info) or `role="alert"` (error), no focus move on mount, auto-dismiss after `autoDismissMs`, manual dismiss button present.
- [X] T022 Implement `/Users/ari/git/wottle/components/ui/Toast.tsx` and `/Users/ari/git/wottle/components/ui/ToastProvider.tsx` (global context + queue) until T021 passes. Mount `ToastProvider` in `/Users/ari/git/wottle/app/layout.tsx`.

### Pure Helpers (TDD)

- [X] T023 [P] Write failing Vitest spec at `/Users/ari/git/wottle/tests/unit/lib/lobby/directoryOrdering.spec.ts` asserting: self always in `visible`; `available` ranks above other statuses; closer `|rating - viewerRating|` ranks higher; most-recently-seen wins ties; `visible.length ≤ cap`; empty input handled; single-player input returns `[self]`.
- [X] T024 Implement `/Users/ari/git/wottle/lib/lobby/directoryOrdering.ts` until T023 passes.
- [X] T025 [P] Write failing Vitest spec at `/Users/ari/git/wottle/tests/unit/lib/lobby/heroWords.spec.ts` asserting set includes `ORÐUSTA`, ≥3 additional Icelandic nouns feature at least one of Þ/Æ/Ð/Ö, each word has 4–8 letters, each word's `letters` field survives Icelandic grapheme boundaries.
- [X] T026 Implement `/Users/ari/git/wottle/lib/lobby/heroWords.ts` (curated typed tuple per research R6) until T025 passes.

### Matches-in-Progress Endpoint

- [X] T027 Write failing integration test at `/Users/ari/git/wottle/tests/integration/api/lobby-stats.spec.ts` asserting `GET /api/lobby/stats/matches-in-progress` returns `{ matchesInProgress: number }`, count is non-negative, respects rate limit on `lobby:stats` scope.
- [X] T028 Implement `/Users/ari/git/wottle/app/api/lobby/stats/matches-in-progress/route.ts` (Supabase `select("id", { count: "exact", head: true })` where `status = 'active'`), wire rate limiter, until T027 passes.

**Checkpoint**: Primitives library, pure helpers, stats endpoint all green. All user stories can begin in parallel from here.

---

## Phase 3: User Story 1 — Returning player starts a match fast (Priority: P1) 🎯 MVP

**Goal**: A logged-in player sees a single dominant Play Now action above the fold, activates it, and enters matchmaking without friction. This slice delivers the primary job-to-be-done.

**Independent Test**: Log in as an existing player on desktop and mobile viewports; confirm Play Now is visually dominant above the fold; confirm clicking it triggers the existing queue and transitions to a match when paired. E2E test drives this with two browser profiles.

### Tests for User Story 1 (write first, ensure FAIL)

- [X] T029 [P] [US1] Write failing Vitest spec at `/Users/ari/git/wottle/tests/unit/components/lobby/PlayNowCard.spec.tsx` covering the four visually-distinct states required by FR-005: (1) **idle-available** — Ranked pre-selected on mount, Casual and Challenge pills render with `aria-disabled="true"` and "Coming soon" accessible text, Play Now button present and enabled; (2) **queuing** — after activation, button shows the search state and is still enabled; (3) **cancelable** — elapsed-time readout visible, cancel-queue affordance present in place of Play Now; (4) **disabled-while-in-match** — when the presence store reports `updateSelfStatus("in_match")` (self status is `in_match`), Play Now renders disabled with an accessible "You are already in a match" explanation. Also preserves `data-testid="matchmaker-start-button"` on the primary button and `data-testid="matchmaker-queue-status"` on the status region for existing E2E selector compatibility.
- [X] T030 [P] [US1] Write failing Vitest spec at `/Users/ari/git/wottle/tests/unit/components/lobby/LobbyStatsStrip.spec.tsx` covering: online count derived from presence store (reactive update on add/remove); matches-in-progress count polled via provided fetcher; fallback to last-known value on fetch error; ≤10 s cadence enforced.

### Implementation for User Story 1

- [X] T031 [US1] Implement `/Users/ari/git/wottle/components/lobby/PlayNowCard.tsx`: mode-pill group (`useState<ModeSelection>("ranked")`), Play Now button wired to existing `startQueueAction` from `/Users/ari/git/wottle/app/actions/matchmaking/startQueue.ts`, queue elapsed timer, cancel affordance, renders `LobbyLoginForm` inline when no session. Preserves existing data-testids. Until T029 passes.
- [X] T032 [P] [US1] Implement `/Users/ari/git/wottle/components/lobby/LobbyStatsStrip.tsx`: subscribes to `useLobbyPresenceStore` for the online count, polls `/api/lobby/stats/matches-in-progress` every 10 s (`LOBBY_STATS_POLL_MS`) via `useEffect` + `setInterval`. Until T030 passes.
- [X] T032a [US1] Extend T030's spec and T032's implementation with a **connection-mode indicator** (FR-023). `LobbyStatsStrip` renders a subtle chip that reads `"Realtime"` when `useLobbyPresenceStore.getState().connectionMode === "realtime"` and `"Polling"` when it is `"polling"`; chip uses `Badge` variant `info` (realtime) or `warning` (polling); contains `aria-live="polite"` so mode changes are announced without focus move; non-alarming copy per FR-023. Extend the unit test to assert both states render and switch when the store changes. Ensures the indicator that previously lived on `MatchmakerControls` / `LobbyList` survives its deletion.
- [X] T033 [US1] Wire the MVP composition into `/Users/ari/git/wottle/app/(lobby)/page.tsx`: render `LobbyStatsStrip` + `PlayNowCard` when `session` exists. Hero and directory remain to be added in later stories; page continues to pass existing E2E `lobby-presence.spec.ts`.
- [X] T034 [US1] Add `performance.mark("lobby:first-interaction")` in `PlayNowCard` on first focus of the Play Now button or the mode pill group.

**Checkpoint**: A logged-in user on any viewport can activate Play Now above the fold and join matchmaking. MVP shippable.

---

## Phase 4: User Story 2 — First-time visitor learns what Wottle is and signs in (Priority: P1)

**Goal**: The logged-out lobby communicates the product identity (Icelandic word duel) within 3 seconds and lets the visitor sign in without navigating away. Delivers the top-of-funnel half of day-1 retention.

**Independent Test**: Load lobby logged-out at 1440 px and 375 px; confirm hero is visible, `ORÐUSTA` subtitle present, rotating Icelandic words cycle, login form is integrated in the CTA zone. E2E test asserts hero visibility and successful sign-in flow.

### Tests for User Story 2 (write first, ensure FAIL)

- [ ] T035 [P] [US2] Write failing Vitest spec at `/Users/ari/git/wottle/tests/unit/components/lobby/LobbyHero.spec.tsx` covering: wordmark "WOTTLE" rendered with display font class; `ORÐUSTA` subtitle present and labelled as Icelandic counterpart; tile motif renders first word from `heroWords` set; advances to next word after `HERO_WORD_CYCLE_MS`; under simulated `prefers-reduced-motion: reduce` the word does not advance and no CSS animation classes are applied.

### Implementation for User Story 2

- [ ] T036 [US2] Implement `/Users/ari/git/wottle/components/lobby/LobbyHero.tsx`: wordmark + ORÐUSTA subtitle + one-line tagline + tile motif composed of `<span>` glyphs with per-letter flip animation. Uses `useSyncExternalStore` over `window.matchMedia("(prefers-reduced-motion: reduce)")` to gate the `setInterval` that advances the word (research R4). Until T035 passes.
- [ ] T037 [US2] Add hero keyframes to `/Users/ari/git/wottle/app/styles/lobby.css`: `@keyframes hero-tile-flip` (350 ms rotateX flip), `@keyframes hero-tile-cascade-in` (600 ms stagger on first mount). Ensure terminating reduced-motion block resets them to `none`.
- [ ] T038 [US2] Update `/Users/ari/git/wottle/components/lobby/LobbyLoginForm.tsx` to consume the new `Button` primitive, `surface.*` and `text.*` tokens, and brand input styling. Remove competing-with-lobby framing; the form is now presentational within `PlayNowCard`'s CTA zone.
- [ ] T039 [US2] Update `/Users/ari/git/wottle/app/(lobby)/page.tsx` to render `LobbyHero` above `LobbyStatsStrip` for both logged-out and logged-in branches. For logged-out: `PlayNowCard` renders the `LobbyLoginForm` in place of Play Now (per US1 wiring). Add `performance.mark("lobby:lcp-candidate")` on hero mount.
- [ ] T040 [US2] Remove the "Phase 3 / Authenticate & Enter Lobby" header block and stale `lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]` two-column grid from `/Users/ari/git/wottle/app/(lobby)/page.tsx` (replaced by the new single-flow composition).

**Checkpoint**: Logged-out visitors see the branded hero with rotating Icelandic nouns and a one-step sign-in path. Logged-in flow (US1) continues to work.

---

## Phase 5: User Story 3 — Player browses the directory and challenges a specific opponent (Priority: P2)

**Goal**: The player scans the directory, sees avatars + ratings + statuses at a glance, and invokes Challenge from a card to open an invite Dialog with that opponent pre-selected.

**Independent Test**: With two logged-in browser profiles, player A finds player B in the directory and invokes Challenge; player B receives the invite Dialog; both sides accept; both navigate to the match. Includes directory >24-player soft cap behaviour.

### Tests for User Story 3 (write first, ensure FAIL)

- [ ] T041 [P] [US3] Update `/Users/ari/git/wottle/tests/unit/components/lobby/LobbyCard.spec.tsx`: add assertions for `Avatar` render (generated when `avatarUrl` null, asset when present), `Badge` status variant, Challenge action visible on non-self cards with `available` status, Challenge action disabled with `aria-disabled` on `in_match` cards, Challenge action absent on self card.
- [ ] T042 [P] [US3] Write failing Vitest spec at `/Users/ari/git/wottle/tests/unit/components/lobby/LobbyDirectory.spec.tsx` covering: renders skeleton rows while presence `status === "connecting"`; empty state when only self is online (with "Share invite link" affordance); applies `orderDirectory` with cap 24; renders "Show all N players" control when hidden.length > 0 and reveals hidden cards inline on activation; self always in the visible set.
- [ ] T043 [P] [US3] Write failing Vitest spec at `/Users/ari/git/wottle/tests/unit/components/lobby/InviteDialog.spec.tsx` covering: send variant opens with `opponentId` pre-selected, confirm button calls `sendInviteAction(opponentId)`, cancel/Escape/backdrop close without dispatching; receive variant renders sender identity and expiry time, Accept calls `respondInviteAction(id, "accepted")`, Decline calls `respondInviteAction(id, "declined")`; bottom-sheet positioning class applied below 640 px viewport.

### Implementation for User Story 3

- [ ] T044 [US3] Update `/Users/ari/git/wottle/components/lobby/LobbyCard.tsx` to consume `Avatar` (falls back to `generateAvatar`), `Badge` (status variant), and expose a Challenge button for non-self + non-`in_match` cards. Remove the redundant `<dl>` status repetition. Until T041 passes.
- [ ] T045 [US3] Implement `/Users/ari/git/wottle/components/lobby/LobbyDirectory.tsx`: applies `orderDirectory({ players, selfId, viewerRating, cap: LOBBY_DIRECTORY_CAP })`, renders `LobbyCard` grid, skeleton placeholders while presence store status is not `ready`, empty state with copy-app-URL affordance when only self online, "Show all N players" toggle when hidden set is non-empty. Until T042 passes.
- [ ] T046 [US3] Modify `/Users/ari/git/wottle/components/lobby/LobbyList.tsx` to compose `LobbyDirectory` instead of rendering cards directly. Preserve all existing `data-testid` attributes expected by `/Users/ari/git/wottle/tests/integration/ui/lobby-presence.spec.ts`; migrate any that moved via explicit test selector updates in T057.
- [ ] T047 [US3] Implement `/Users/ari/git/wottle/components/lobby/InviteDialog.tsx`: consumes `Dialog` primitive (T012); supports `variant: "send" | "receive"`; send variant wraps `sendInviteAction`, receive variant wraps `respondInviteAction` and polls `/api/lobby/invite` every 3 s (migrate cadence from current `MatchmakerControls`); toasts on success/error via `ToastProvider`; bottom-sheet class applied when viewport width < 640 px. Until T043 passes.
- [ ] T048 [US3] Wire Challenge click on `LobbyCard` → open `InviteDialog` with `variant="send"` and pre-selected `opponentId`. Wire the incoming-invite poll to auto-open `InviteDialog` with `variant="receive"`. Both wired inside `/Users/ari/git/wottle/app/(lobby)/page.tsx` via a lobby-level state hook.
- [ ] T049 [US3] Delete `/Users/ari/git/wottle/components/lobby/MatchmakerControls.tsx` and remove its import from anywhere still referencing it. Its queue behaviour lives in `PlayNowCard` (US1); its invite behaviour lives in `InviteDialog` (US3). Run `pnpm typecheck` and `pnpm test` to confirm zero references remain.

**Checkpoint**: Directory shows avatars, ratings, statuses, Challenge affordance; invite flow runs through a real Dialog; soft cap + "Show all" works.

---

## Phase 6: User Story 4 — Keyboard and screen-reader users navigate without barriers (Priority: P2)

**Goal**: A keyboard-only and a screen-reader user each complete the full lobby flow. Zero serious/critical axe violations on logged-out and logged-in views.

**Independent Test**: Run `@axe-core/playwright` audit on both lobby views; manual VoiceOver + NVDA sweep per the quickstart script.

### Tests for User Story 4 (write first, ensure FAIL)

- [ ] T050 [US4] Add `@axe-core/playwright` as a dev dependency in `/Users/ari/git/wottle/package.json` (pnpm add -D). Create `/Users/ari/git/wottle/tests/integration/ui/lobby-visual.spec.ts` with a logged-out axe scan expecting zero serious/critical violations. The test fails initially because of any residual violations introduced by new primitives.
- [ ] T051 [P] [US4] In `/Users/ari/git/wottle/tests/integration/ui/lobby-visual.spec.ts` add a "keyboard round-trip" test: tabs from the top of the page through hero → mode pills → Play Now → directory cards → footer, asserting every interactive element receives focus in source order and the focus ring is visible.
- [ ] T052 [P] [US4] In `/Users/ari/git/wottle/tests/integration/ui/lobby-visual.spec.ts` add a "dialog focus trap" test: triggers Challenge → Dialog opens → Tab cycles within Dialog → Escape closes → focus returns to the triggering card.

### Implementation for User Story 4

- [ ] T053 [US4] Address axe violations surfaced by T050 across primitives and lobby components (missing `aria-label`, contrast issues from token selection, form-label associations in reskin). Each fix points back to the specific component file; run T050 iteratively until zero serious/critical remain.
- [ ] T054 [US4] Wire `useFocusTrap` into `InviteDialog` paths that were previously missing it and ensure `Dialog` returns focus to the trigger element on close (implemented in T012, verified here under real lobby wiring).
- [ ] T055 [US4] Add `aria-live="polite"` announcement region to `PlayNowCard` for queue state changes and `aria-live="assertive"` to `InviteDialog` receive variant for invite arrival, without moving focus (FR-029).

**Checkpoint**: Axe clean on both views. Full flow keyboard-only. Announcements reach screen readers.

---

## Phase 7: User Story 5 — Mobile player completes the full flow (Priority: P3)

**Goal**: Mobile-first layout at 375 × 812: single column, sticky Play Now, bottom-sheet Dialog, 44×44 touch targets, no horizontal scroll.

**Independent Test**: Playwright device emulation at 375 × 812; verify no horizontal scroll, sticky CTA reachable, Dialog appears as bottom-sheet, all interactive elements ≥ 44 × 44 px.

### Tests for User Story 5 (write first, ensure FAIL)

- [ ] T056 [P] [US5] In `/Users/ari/git/wottle/tests/integration/ui/lobby-visual.spec.ts` add viewport blocks covering the full supported range per FR-031, FR-032, FR-033:
  - **Mobile (375 × 812 and 390 × 844)**: assert no horizontal scroll (`document.body.scrollWidth === document.body.clientWidth`), `PlayNowCard` primary button bounding box `bottom` within viewport when scrolled to directory bottom (sticky CTA per FR-031), `InviteDialog` has bottom-sheet class when opened.
  - **Tablet and small desktop (768 × 1024, 1024 × 768)**: assert no horizontal scroll; sticky-CTA rule deactivates (primary button is not position-sticky).
  - **Desktop (1280 × 800 and 1440 × 900)**: assert no horizontal scroll AND — for a logged-in viewer — that the hero region, Play Now CTA region, and first row of the directory are ALL within the initial viewport box (all three elements'`boundingBox().y + boundingBox().height <= window.innerHeight`) per FR-032.
  - **Widescreen (1920 × 1080)**: assert no horizontal scroll.
- [ ] T057 [P] [US5] In the same mobile viewport block, iterate every element matching `button, a, [role="button"]` inside the lobby and assert bounding box `width >= 44 && height >= 44`.
- [ ] T058 [P] [US5] Update selector references in `/Users/ari/git/wottle/tests/integration/ui/lobby-presence.spec.ts` for any `data-testid` that moved; add skeleton and empty-state assertions introduced in US3.

### Implementation for User Story 5

- [ ] T059 [US5] Add mobile layout rules to `/Users/ari/git/wottle/app/styles/lobby.css`: single-column below 640 px, `position: sticky; bottom: 0` on `PlayNowCard` primary control region with safe-area-inset-bottom padding via `env(safe-area-inset-bottom)`.
- [ ] T060 [US5] Add bottom-sheet variant to `/Users/ari/git/wottle/components/ui/Dialog.tsx`: when `bottomSheetOnMobile` prop is true (default), below 640 px the dialog anchors to viewport bottom, slides up with transform, full-width, with safe-area-inset padding. Enable the prop on `InviteDialog` consumption.
- [ ] T061 [US5] Audit every new interactive element in `PlayNowCard`, `LobbyCard`, `LobbyDirectory`, `InviteDialog`, `LobbyStatsStrip`, `LobbyHero`, and `LobbyLoginForm` for minimum 44×44 hitbox. Apply minimum-size utility classes or `::after` pseudo-element hitboxes where visual size is smaller.

**Checkpoint**: Full flow works on 375 × 812 with sticky CTA and bottom-sheet Dialog.

---

## Phase 8: User Story 6 — Reduced-motion user (Priority: P3)

**Goal**: Under `prefers-reduced-motion: reduce`, zero keyframes play while all state changes remain functionally observable.

**Independent Test**: Playwright launches with `reducedMotion: "reduce"` context; visits lobby; asserts no elements have active CSS animations and the hero word does not cycle.

### Tests for User Story 6 (write first, ensure FAIL)

- [ ] T062 [P] [US6] In `/Users/ari/git/wottle/tests/integration/ui/lobby-visual.spec.ts` add a reduced-motion block that launches a context with `reducedMotion: "reduce"`, snapshots the hero word, waits 6 s, asserts the word is unchanged, and asserts `getComputedStyle` returns `animation-name: none` for hero tiles, status pulse dot, skeleton rows, and CTA hover target.

### Implementation for User Story 6

- [ ] T063 [US6] Verify the `useSyncExternalStore`-backed `matchMedia` guard in `LobbyHero` (T036) actually skips the `setInterval` scheduling under reduced motion. Add a dedicated unit test case in `LobbyHero.spec.tsx` if not already covered by T035.
- [ ] T064 [US6] Audit `/Users/ari/git/wottle/app/styles/lobby.css` terminating `@media (prefers-reduced-motion: reduce)` block: ensure every keyframe added across US1–US5 is explicitly reset (`animation: none`, `transition: none`) and that static-state visual differentiation remains (e.g., `available` dot still visibly different, even without pulse).

**Checkpoint**: No ambient or cycling motion under reduced-motion. State changes remain observable.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Performance gating, token migration cleanup, and observability.

- [ ] T065 [P] Add `@lhci/cli` as dev dependency; create `/Users/ari/git/wottle/.lighthouserc.json` with assertions: `categories:performance >= 0.9`, `largest-contentful-paint < 2000`, `cumulative-layout-shift < 0.05`. Target URL `http://localhost:3000/`.
- [ ] T066 Add a Lighthouse CI job to `/Users/ari/git/wottle/.github/workflows/ci.yml` that boots the dev server, runs `lhci autorun`, and gates merge on assertion pass.
- [ ] T067 [P] Sweep migrated lobby components (`LobbyCard`, `LobbyList`, `LobbyLoginForm`, `app/(lobby)/page.tsx`) for leftover ad-hoc Tailwind literals like `white/10`, `slate-900/40`, `bg-slate-900/60`; replace with semantic `surface.*` / `text.*` / `accent.*` tokens. Reference `/Users/ari/git/wottle/lib/ui/tokens.ts` if inline style is required.
- [ ] T068 [P] Confirm all performance marks fire once in Chrome DevTools: `lobby:lcp-candidate` (at hero mount) and `lobby:first-interaction` (at first focus inside `PlayNowCard`). Add a dev-only assertion in `/Users/ari/git/wottle/lib/observability/marks.ts` if not already present to prevent regression.
- [ ] T069 [P] Update `/Users/ari/git/wottle/CLAUDE.md` "Current State" and "Completed Specs" sections to reflect 019 completion once merged; add an "In Progress" entry during implementation.
- [ ] T070 Run the full regression suite per `/Users/ari/git/wottle/specs/019-lobby-visual-foundation/quickstart.md` §3 and §6: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration && pnpm exec playwright test`. All green before review.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Independent; can start immediately.
- **Foundational (Phase 2)**: Depends on Setup. BLOCKS all user stories. Within Phase 2, primitive tests (T007, T009, T011, T013, T017, T019, T021) and helper tests (T015, T023, T025, T027) are all `[P]` against one another; each test is paired with its implementation task and that implementation is the ONLY task that depends on it in Phase 2.
- **Phase 3 (US1 MVP)**: Depends on Phase 2. Delivers the MVP.
- **Phase 4 (US2)**: Depends on Phase 2. May proceed in parallel with Phase 3 if two developers.
- **Phase 5 (US3)**: Depends on Phase 2. May proceed in parallel with Phase 3 and Phase 4.
- **Phase 6 (US4)**: Depends on Phases 3–5 (needs real components to audit).
- **Phase 7 (US5)**: Depends on Phases 3–5 (mobile layout modifies real components).
- **Phase 8 (US6)**: Depends on Phases 3–5 (audits keyframes introduced by earlier phases).
- **Phase 9 (Polish)**: Depends on all user stories complete.

### User Story Dependencies

- **US1 (P1 MVP)**: No story dependencies beyond Phase 2. First delivery milestone.
- **US2 (P1)**: No story dependencies beyond Phase 2. Ships hero and sign-in flow.
- **US3 (P2)**: No story dependencies beyond Phase 2. Ships directory + invite. Deletes `MatchmakerControls` (T049) only after its behaviours are wired into US1 and US3.
- **US4 (P2)**: Depends on US1+US2+US3 because it audits their output.
- **US5 (P3)**: Depends on US1+US2+US3 (adds mobile CSS + bottom-sheet to their components).
- **US6 (P3)**: Depends on US1+US2+US3 (audits keyframes they introduced).

### Within Each User Story

- Unit tests (marked `[P]` where independent) are written FIRST per Constitution Principle VII.
- Implementation tasks consume the tests and make them pass.
- Commit after each passing test per Principle VII.

### Parallel Opportunities

- **Setup Phase**: T003, T004, T005, T006 are all `[P]` against each other (distinct files).
- **Foundational Phase primitive tests**: T007, T009, T011, T013, T017, T019, T021, T023, T025 are all `[P]` (distinct files). Each test's paired impl task runs after its own test only. T018a runs after T018 (extends the Badge surface and adds a keyframe to `lobby.css`).
- **Foundational Phase avatarGradient/directoryOrdering/heroWords**: T015/T016, T023/T024, T025/T026 may proceed in parallel as three streams.
- **US1 tests**: T029, T030 `[P]` (distinct files). T032a depends on T032.
- **US3 tests**: T041, T042, T043 `[P]` (distinct files).
- **US4 tests**: T051, T052 `[P]` against T050 (same file but non-interacting blocks; flag as `[P]` because they can be authored in parallel).
- **US5 tests**: T056, T057, T058 `[P]`.
- **US1/US2/US3 implementation phases**: Can proceed by three developers in parallel once Foundational is green.
- **Polish tasks**: T065, T067, T068, T069 `[P]`.

---

## Parallel Example: Foundational Phase (primitives kickoff)

```bash
# One developer or one branch per stream — all four streams run concurrently:

# Stream 1 — Button + Card
Task: "T007 Write failing Button spec"  → "T008 Implement Button"
Task: "T009 Write failing Card spec"    → "T010 Implement Card"

# Stream 2 — Dialog + Avatar (Avatar depends on avatarGradient)
Task: "T011 Write failing Dialog spec"  → "T012 Implement Dialog"
Task: "T015 Write failing avatarGradient spec" → "T016 Implement avatarGradient"
Task: "T013 Write failing Avatar spec"  → "T014 Implement Avatar"

# Stream 3 — Badge + Skeleton + Toast
Task: "T017 Write failing Badge spec"   → "T018 Implement Badge"
Task: "T019 Write failing Skeleton spec" → "T020 Implement Skeleton"
Task: "T021 Write failing Toast spec"   → "T022 Implement Toast + ToastProvider"

# Stream 4 — Pure helpers + stats endpoint
Task: "T023 Write failing directoryOrdering spec" → "T024 Implement directoryOrdering"
Task: "T025 Write failing heroWords spec"         → "T026 Implement heroWords"
Task: "T027 Write failing lobby-stats integration test" → "T028 Implement stats route"
```

---

## Implementation Strategy

### MVP First (User Story 1 only — returning-player slice)

1. Complete Phase 1: Setup (T001–T006).
2. Complete Phase 2: Foundational (T007–T028).
3. Complete Phase 3: User Story 1 (T029–T034).
4. **STOP and VALIDATE** at this checkpoint: log in, press Play Now, confirm match-found transition. Existing `lobby-presence.spec.ts` still green.
5. Deploy / demo as MVP.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. + US1 → demo to stakeholders (returning-player flow).
3. + US2 → demo (new-visitor flow + branded hero).
4. + US3 → demo (directory + invite Dialog).
5. + US4 → a11y sign-off.
6. + US5 → mobile sign-off.
7. + US6 → reduced-motion sign-off.
8. + Polish → Lighthouse gate enforced; ready to land.

### Parallel Team Strategy

Three developers post-Foundational:

- Developer A: US1 (T029–T034) — CTA + stats.
- Developer B: US2 (T035–T040) — Hero + sign-in.
- Developer C: US3 (T041–T049) — Directory + invite Dialog.
- Converge on US4 + US5 + US6 with whoever frees up first.

---

## Notes

- `[P]` tasks touch different files and have no dependencies on in-flight tasks.
- `[Story]` labels trace user-story lineage for merge-window planning.
- Tests MUST fail on authoring; each implementation task exists to make exactly one test green.
- Commit after each passing test per Constitution Principle VII; never commit a failing test.
- `MatchmakerControls.tsx` is deleted in T049 (end of US3). Do not delete earlier or US1 and US3 wiring regresses.
- Preserve existing `data-testid` attributes (`matchmaker-start-button`, `matchmaker-queue-status`, `matchmaker-invite-button`, `matchmaker-invite-modal`, `matchmaker-toast`, `matchmaker-invite-accept`, `matchmaker-invite-decline`) on the new components so `tests/integration/ui/lobby-presence.spec.ts` keeps passing without mass rewrite; update only those selectors the refactor genuinely moves in T058.
