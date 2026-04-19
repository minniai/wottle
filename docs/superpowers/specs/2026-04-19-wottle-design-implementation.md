# Wottle Design Implementation — Phased Plan

**Date:** 2026-04-19
**Author:** brainstorm session with Claude
**Source:** `wottle-game-design/` handoff bundle (Claude Design export of Warm Editorial prototype)
**Target:** `/Users/ari/git/wottle` (Next.js 16, React 19, Tailwind CSS 4, Supabase, TypeScript 5)

---

## 1. Goal

Bring Wottle's production UI up to the quality of the Warm Editorial prototype that was mocked in Claude Design. The prototype spans six screens (Landing, Lobby, Matchmaking, Match, Post-game, Profile) built on a cream-paper-and-deep-ink design system with Fraunces, Inter, and JetBrains Mono.

Implementation is **iterative** — six independently-shippable phases, each its own branch and PR, each gated by the project's existing Speckit workflow and test suite.

## 2. Scope decisions

Locked during brainstorming:

| Decision | Chosen |
|---|---|
| Canonical HUD | `classic` (side-by-side cards with left-stripe accent) |
| Canonical tile style | `letterpress` (two-stop gradient, inset highlight/shadow) |
| Canonical frozen-tile style | `band` (corner band + subtle tint) |
| Canonical lobby layout | `classic` (hero + directory grid) |
| Feature depth | **Tight** — see §3 |
| Internationalisation | Skipped — English only; defer `next-intl` to a later spec |
| User-facing variant settings | None — variants are design-time choices, not preferences |

### 2.1 Tight-scope inclusions and exclusions

**In scope (Tight):**

- All six screens (Landing, Lobby, Matchmaking, Match, Post-game, Profile).
- Profile page + modal, including a new `rating_history` persistence layer (or derived query).
- Claim-win server action (forfeit opponent after 90s disconnect).
- Invite toast for received invitations.
- Empty-lobby state.
- Round-by-round chart on post-game.

**Explicitly deferred / skipped:**

- "Play a bot" — whole new bot system; button is disabled in empty-lobby state.
- "Spectate" — prototype marks this "(soon)"; remains out of scope.
- "Replay" link in match history — stubbed as "(soon)" in profile page.
- Magic-link auth — current session-cookie flow is preserved.
- `next-intl` / EN ↔ IS language toggle.

## 3. Foundation inventory

**What is already in production** (spec 019 `lobby-visual-foundation` and earlier):

- Fraunces + Inter wired via `next/font/google`.
- Lobby-shell primitives in `components/ui/` (Button, Card, Dialog, Avatar, Badge, Skeleton, Toast, ToastProvider).
- `LobbyHero`, `LobbyDirectory`, `LobbyList`, `LobbyCard`, `LobbyStatsStrip`, `PlayNowCard`, `InviteDialog`, `LobbyLoginForm`.
- Match client with board, HUD, timers, score-delta popup, round history, rematch (specs 002–018).
- `FinalSummary` post-game component (spec 006).
- Elo + player stats (spec 017).
- Brand tokens in Tailwind theme (partial — need OKLCH expansion).

**What is new in the design and not yet implemented** — see §4 for per-phase details.

## 4. Phasing

Six phases, approximately sixteen working days total. Each phase is its own branch, its own Speckit cycle, its own PR.

### Phase 1 — Foundation & Match surfaces (~3 days)

Branch: `020-wottle-foundation-match`

**Design tokens** — add to `app/globals.css` `:root` and extend `tailwind.config.ts`:

- Surfaces: `paper / paper-2 / paper-3`, `ink / ink-2 / ink-3 / ink-soft`.
- Accents: `ochre / ochre-deep / ochre-tint`.
- Player slots: `p1 / p1-tint / p1-deep`, `p2 / p2-tint / p2-deep`.
- Semantic: `good / warn / bad`.
- Lines: `hair / hair-strong`.
- Shadows: `--shadow-sm / --shadow-md / --shadow-lg`.

All values in OKLCH, matching the prototype's `styles.css`. Keep existing brand tokens as Tailwind aliases so spec 019 surfaces don't break.

**Typography** — add JetBrains Mono via `next/font/google` exposed as `--font-mono` in `app/layout.tsx`. Inter stays default sans; Fraunces stays display.

**TopBar** — new `components/ui/TopBar.tsx`, sticky, `backdrop-filter: blur(12px)` on translucent paper. Wordmark ("Wottle" with small "word · battle" mono eyebrow) + simple screen-nav links. Mounted in `app/layout.tsx` so it's present across every screen. No language switch (scope §2).

**Match surfaces** — touch `components/game/BoardGrid.tsx`, `components/game/Board.tsx`, `app/styles/board.css`, `components/match/PlayerPanel.tsx`, `components/match/MatchShell.tsx`:

- Letterpress tile CSS — two-stop linear gradient (`paper` → `paper-2`), inset highlight (top) + shadow (bottom), 1px edge stroke. Hover lifts 2px; selected tile takes ochre-tint background + 2px ochre-deep ring.
- Coord labels on board edges — `A`–`J` on top, `1`–`10` on left. Mono 9px, muted. Configurable toggle stays internal (default on).
- Board wrap — repeating-linear-gradient for subtle grid texture + paired inset/outset shadow.
- HUD classic refresh — `.hud-card` with left-stripe accent (`p1` or `p2`), avatar, name + meta (color · elo · matches), italic Fraunces score 34px, mono clock pill (`.hud-clock.active` / `.low` states).
- Round pip bar — 10 pips, current pip is ochre-deep 5px tall, done pips ink-2, future pips hair-strong.
- Left rail cards — "How to play" (4-item ordered list), "Legend" (three frozen mini-tiles), "Your move" (selected-coord display + submitted state with "hidden from opponent" note).
- Right rail — existing `RoundHistoryPanel` restyles to dashed-border word rows with `.word-row.p1/.p2` tint; add "Tiles claimed" card (two counts + 3-segment p1/p2/remaining bar).

**No server / type changes.** Pure visual + layout.

**Tests:**

- Unit — `PlayerPanel` renders classic variant with correct slot accent.
- Unit — `BoardGrid` renders coord labels when `showCoords` prop set.
- Playwright smoke — topbar present on every screen; coord labels visible; classic HUD renders; pip bar reflects round number.

---

### Phase 2 — Post-game redesign (~2 days)

Branch: `021-post-game-redesign`

**Files** — `components/match/FinalSummary.tsx` (rewrite layout), new components:

- `components/match/PostGameVerdict.tsx` — eyebrow ("Match complete · 10 rounds · Xm Ys"), `.verdict.win` or `.verdict.loss` italic Fraunces 72px ("Victory." / "Defeat."), italic sub-display with point margin ("You out-read {opp} by N points.").
- `components/match/PostGameScoreboard.tsx` — two side-by-side cards. Each: avatar + name + `±N rating` meta (from existing `match_ratings` row for this match), italic Fraunces 56px score, foot-row with words-count + frozen-count + best-word.
- `components/match/RoundByRoundChart.tsx` — 10 columns × 120px, `p1` bar grows up, `p2` bar grows down, mono `R1`…`R10` labels. Derive per-round deltas from existing `word_score_entries.round_id` → `rounds.round_number`.
- `components/match/WordsOfMatch.tsx` — flat list of `WordScoreEntry` sorted by round ascending, tinted by player slot (`.word-row.p1/.p2`). Header: "Words of the match" + count ("N found").

Board miniature — reuse `<Board size={36} showCoords={false}>` wrapped in `transform: scale(0.75); transform-origin: top right`.

Action row — rematch (already wired via spec 016) + "Back to lobby".

**No server / type changes.**

**Tests:**

- Unit — verdict renders win/loss styling based on winner; chart scales bars from fixture data; words-of-match orders by round.
- Playwright — complete a match and see new post-game layout.

---

### Phase 3 — Lobby finish + challenge toast (~2 days)

Branch: `022-lobby-finish`

**Files** — existing `components/lobby/*` (minor token updates), new:

- `components/lobby/InviteToast.tsx` — fixed top-right (`top: 80px; right: 24px`), 340px wide, ochre-deep left stripe, avatar + "Challenge received" eyebrow + name, body copy with opponent rating, Decline / Accept buttons. Animates in with `toastIn` keyframe (400ms cubic-bezier). Dismisses on accept/decline/timeout.
- `components/lobby/RecentGamesCard.tsx` — card with `.panel-head` ("Your recent games" + mono "Last 7 days"), rows using `.hist-row` grid (W/L/D chip + opponent + score + words-count + relative time).
- `components/lobby/TopOfBoardCard.tsx` — card with `.panel-head` ("Top of the board" + mono "Season 1"), top-6 players by elo with rank + 28px avatar + name + italic rating.
- `components/lobby/EmptyLobbyState.tsx` — shown when no other players are present (online-presence count minus the current user is `0`). Eyebrow "Nobody on the floor · {local time}", italic "The library is empty tonight." headline, sub-copy, primary "Join the queue" + ghost "Play a bot" (disabled per Tight scope), mono footer.

**Server actions** — add:

- `getRecentGames(playerId, limit: number = 6)` in `app/actions/matches/getRecentGames.ts` returning `{ result: 'win' | 'loss' | 'draw', opponent: { handle, name }, score: string, wordsFound: number, completedAt: Date }[]`. Queries `matches` joined to `word_score_entries` aggregate.
- `getTopPlayers(limit: number = 6)` in `app/actions/players/getTopPlayers.ts` returning `{ player, elo, wins, losses }[]`, ordered by `elo desc`.

Both actions: explicit return types, Zod input validation, scoped rate limit `lobby:read`.

**Invite toast wiring** — existing invitation realtime subscription (`lib/realtime/invitationChannel.ts`) already fires on received invite. `LobbyScreen` decides between `InviteDialog` (existing explicit flow) and `InviteToast` (new passive notification). Use toast as the default; dialog only for explicit sent-invite flow.

**Tests:**

- Integration — `getRecentGames` and `getTopPlayers` with seeded fixtures.
- Unit — `EmptyLobbyState` renders when `players.length <= 1`.
- Playwright — two-session: B invites A, A sees `InviteToast`, accepts, lands in match.

---

### Phase 4 — Landing + Matchmaking screens (~3 days)

Branch: `023-landing-matchmaking`

**Routing change** — today `app/page.tsx` redirects to `/lobby` (which contains login). After this phase:

- `/` — Landing (public). If a valid session cookie exists, redirect to `/lobby`; otherwise render the landing form.
- `/lobby` — as today, but the login form is removed (it lives on `/` now).
- `/matchmaking` — new route.
- `/match/[matchId]` — unchanged.

`LobbyLoginForm` logic is reused on the landing page.

**Landing** — `app/page.tsx` (or `app/(landing)/page.tsx`), `components/landing/LandingScreen.tsx`:

- Eyebrow "A real-time word duel · Icelandic".
- Italic display-xl headline "Play with *letters.*" (ochre-deep italic emphasis on "letters.").
- 52ch sub-copy — "Two players. Ten rounds. A ten-by-ten grid…".
- Username input (pill-shaped, 280px wide, rounded-full border) + primary "Enter lobby →".
- Validation hints row — "3–24 characters · letters, numbers, dashes".
- Decorative 6-tile "WOTTLE" vignette + mono eyebrow "WO-rd · ba-TTLE".

**Matchmaking** — `app/matchmaking/page.tsx` (auth-required, redirects to `/` if no session), `components/matchmaking/MatchmakingClient.tsx`:

Three phases driven by matchmaking-channel realtime events:

- `searching` — eyebrow "Ranked · 5+0 · Icelandic nouns", italic "Finding an opponent within ±N rating" (N expands +50/sec from 200), `.match-ring` (rotating ochre border, 220px) with user's 96px avatar centered, elapsed-seconds mono, "Cancel search" ghost button.
- `found` — "Opponent found" eyebrow, italic vs-block with both display-lg names, avatars (80px) side-by-side with mono ratings, "Both players ready."
- `starting` — same layout, subtitle "Assigning roles · generating board…", auto-navigates to `/match/[matchId]` when match-created event arrives.

**Wire-up** — entering `/matchmaking` enqueues via existing queue server action; cancelling dequeues; match-created event on the matchmaking realtime channel drives the phase transitions and final redirect.

**Tests:**

- Integration — landing redirects authenticated users to `/lobby`.
- Integration — `/matchmaking` redirects unauthenticated users to `/`.
- Playwright — full flow: landing → username → lobby → Play Now → matchmaking searching → found → match.

---

### Phase 5 — Profile modal + page (~4 days)

Branch: `024-profile`

**New table** (decision at implementation time):

- Option A — new `rating_history (player_id, rating, recorded_at)` table appended to from a Postgres trigger on `match_ratings`, or from the round-engine after rating recalculation. Backfill once.
- Option B — derive a rating series on the fly by joining `match_ratings` with `matches.completed_at` for the given player. Simpler (no migration), but O(N) per page load; fine if N ≤ 100.

Start with Option B; migrate to Option A if query cost is a problem in production.

**New server actions**:

- `getPlayerProfile(handle)` → `{ player, elo, wins, losses, draws, peakRating, bestWord, bestWordPts, form: ('W'|'L'|'D')[10], ratingHistory: { recordedAt: Date, rating: number }[], recentMatches: [...] }`. Zod-validated input, explicit return type.
- `getBestWords(playerId, limit: number = 12)` → `{ word: string, points: number }[]`, aggregated from `word_score_entries` by `(word, player_id)`, max points wins, ordered by points desc.

**New components**:

- `components/profile/PlayerProfileDialog.tsx` (modal) — mounted from `LobbyDirectory` card click. Avatar + name + eyebrow ("Player profile"), 4-stat grid (rating emphasised ochre-deep, wins, losses, best word), sparkline (bars sized from `ratingHistory`), form chips (10-square WWLWWDLWWW), "Challenge {first-name} →" primary + "Later" ghost.
- `app/profile/page.tsx` — own-profile full page (reads current user from session).
- `app/profile/[handle]/page.tsx` — public-profile full page by handle.
- `components/profile/ProfilePage.tsx` — shared layout:
  - Sidebar — 180px italic Fraunces avatar, italic display name, `@handle · member since {date}`, rating block (italic Fraunces 46px ochre-deep) with "▲ +N today", Play-now + Edit-profile buttons.
  - Main column — at-a-glance stats grid (matches, W-L-D, win rate, peak rating), rating chart (SVG path with area fill + dashed grid lines + endpoint dot), word cloud (`font-size: 16 + pts * 0.5`, top-3 words tinted ochre-deep), recent-matches list with "Replay →" link stubbed as "(soon)".

**Wire-up** — `LobbyDirectory` `PlayerCard.onClick` dispatches a selected-player event that opens `PlayerProfileDialog`. Topbar "Profile" nav routes to `/profile`.

**Tests:**

- Integration — both server actions with seeded fixtures.
- Unit — chart scaling math; word-cloud font-size formula; form chip colour for W/L/D.
- Playwright — click player in lobby → modal opens → Challenge button fires invite flow; navigate to `/profile` from topbar → all four sections render.

---

### Phase 6 — Disconnection modal + claim-win (~2 days)

Branch: `025-disconnect-modal`

**Server** — new `app/actions/matches/claimWin.ts`:

- Input: `{ matchId }`.
- Validates — caller is a participant; opponent has `last_seen_at` older than 90s; match is not already completed.
- Effect — marks match completed, writes final `MatchState` with calling player as winner, awards truncated score (current scores stand), writes `match_ratings` rows, closes the match. Broadcasts the final state via the match realtime channel so both clients navigate to post-game.
- Rate-limited under `match:claim-win` (1/minute).

**Client** — new `components/match/DisconnectionModal.tsx`:

- Shown the moment the match state reports the opponent as disconnected (existing reconnection flow already emits this). The disconnected player is gone; only the still-connected player renders this modal.
- Positioned absolutely over the board area with a blurred ink backdrop (`.disc-overlay`).
- Card with pulse indicator (`discPulse` keyframe, warn-colored), eyebrow "Connection lost" (warn), italic "{opponent} dropped out.", copy "The match is paused. We'll wait up to 90 seconds for them to reconnect, or you can claim the win.", 90s mono countdown (28px tabular-nums).
- Actions — "Keep waiting" ghost + "Claim win" primary. The claim-win server action's own validation requires `last_seen_at` ≥ 90s; if the user clicks Claim Win before that threshold the action rejects with a friendly message, which the client surfaces as a small banner. After 90s of continued disconnect the claim button becomes unambiguously clickable.
- If the opponent reconnects before the claim, the modal dismisses gracefully (existing reconnection flow already drives this state).

Replaces the current text-only disconnect banner.

**Tests:**

- Integration — `claimWin` rejects if opponent still connected; succeeds after 90s; idempotent on double-call.
- Playwright — two-session: session B force-disconnects (close page), session A sees `DisconnectionModal`, clicks Claim Win, both sessions navigate to post-game with A as winner.

---

## 5. Cross-cutting principles

- **Animations** — CSS transforms + opacity + keyframes only, GPU-accelerated, no Framer Motion. Every animation honours `prefers-reduced-motion: reduce` by collapsing to a no-op or an instant state swap (existing pattern from specs 008, 010).
- **Performance** — move-RTT < 200ms p95, word-validation < 50ms, realtime broadcast < 100ms p95 (constitution). Nothing in this plan adds work on the critical round-resolution path.
- **TDD** — each phase follows Red → Green → Refactor. Failing test first, minimal implementation, refactor while green. Commits follow conventional-commits (`feat(scope): …`, `test(scope): …`).
- **Type safety** — every new Server Action has an explicit return type and Zod input validation. Shared types go in `lib/types/`.
- **Lint + typecheck + tests** — must stay green at every PR. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `pnpm exec playwright test`.
- **Rate limiting** — new server actions get scoped limits via `assertWithinRateLimit()`.
- **Observability** — new Server Actions instrument performance marks and structured logs consistent with existing patterns.

## 6. Speckit workflow per phase

Each phase is a full Speckit cycle:

1. `/speckit.specify` — feature spec under `specs/0XX-<branch-name>/`, referencing this design doc.
2. `/speckit.clarify` — resolve any phase-specific ambiguity.
3. `/speckit.plan` — implementation plan.
4. `/speckit.tasks` — dependency-ordered task list.
5. `/speckit.implement` — TDD execution.

## 7. Risks and mitigations

| Risk | Mitigation |
|---|---|
| OKLCH token migration breaks existing spec 019 surfaces | Keep today's brand tokens as Tailwind aliases that resolve to the new OKLCH values. Visual regression sweep in Phase 1 on lobby. |
| Letterpress tile gradients cost repaint on animated boards | Tiles are static outside of swap + scored-glow; gradients compile to single paint. Spot-check with Chrome perf trace in Phase 1. |
| Phase 5 rating-history query cost at scale | Start with the derived-from-`match_ratings` path (no migration). Switch to `rating_history` table only if queries exceed target. |
| Claim-win race with reconnection | Server action validates `last_seen_at` age at transaction time; reconnection event cancels any pending claim by marking the player connected before the action runs. |
| Routing change in Phase 4 breaks existing session cookies | `/lobby` continues to accept the same cookie; only the unauthenticated path changes (`/` renders landing instead of redirecting). |

## 8. Out of scope (deferred)

- Bot opponents (empty-lobby "Play a bot").
- Spectate mode.
- Match replays (the Replay link stays stubbed).
- Magic-link auth.
- `next-intl` / EN ↔ IS toggle.
- User-facing settings for HUD / tile / frozen / lobby variants.
- `dimensional` and `paper` tile styles; `chess` and `topbottom` HUD styles; `arena` and `minimal` lobby layouts (these remain as design exploration in the prototype).

## 9. Approvals

- **Phasing and scope** — approved during brainstorming, 2026-04-19.
- **Per-phase detail** — approved during brainstorming, 2026-04-19.
- **Design doc** — awaiting user review before proceeding to `writing-plans`.
