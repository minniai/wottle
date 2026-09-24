# Research: The door, the lobby, challenges and presence

Decisions for spec 070. Each item: **Decision**, **Rationale**, **Alternatives considered**. The code facts come from `main` at 0b87f345 (spec 069 merged).

## R1. Per-tab presence: a new table beside `lobby_presence`

**Decision.** Add a table `presence_tabs (tab_id uuid PK, player_id, language, visible, hidden_since, last_input_at, beat_at, cadence_ms, leaving_at, page)`. It holds one row per open tab and is written by the heartbeat route: every 10s while the tab is visible, every 30s while it is hidden.
- `lobby_presence` stays as the per-player summary that other code already reads: the orphan sweep, `create_match_between`, sign-out and the seed. The heartbeat keeps its `language` and sets `expires_at` to the latest gone deadline over the player's tabs.
- A SQL function `player_presence(p_language)` derives each player's state from their fresh tabs, their search and their pending or in-progress match: `here`, `searching`, `in_match` (with a move count) or `away`. Gone players are not returned.
- A tab is **fresh** while `beat_at > now − (3 × cadence_ms + 5s)`: 35s when visible, 95s when hidden. It is also fresh while `leaving_at` is null or less than 8s old.
- A player is **away** when every fresh tab has `visible = false` and `hidden_since < now − 2:00`.

**Rationale.**
- The spec's rules are per tab: the best state across tabs, and a reload, the language switch or closing a second tab changes nothing.
- Keeping the per-player row avoids rewriting six readers and the sweep migration, while the tabs carry the truth.
- Presence is always derived at read time, so there is no second copy to drift.
- The attention columns from spec 069 (`players.attention_*`) are written from the same heartbeat, so seating reads any signed-in page (US6.6).

**Alternatives considered.**
- Supabase Presence alone: it gives no hidden-since or last-input facts and no server-side read for challenge gates.
- A per-tab `jsonb` on `lobby_presence`: harder to index and to expire.
- Dropping `lobby_presence`: too wide for this stage.

## R2. The lobby list moves off Supabase Presence and onto pokes

**Decision.**
- Retire the `lobby-presence:{language}` Presence channel (`lib/realtime/presenceChannel.ts`, the Presence half of `presenceStore`).
- The list is read from `GET /api/lobby/players?language=`, which now calls `player_presence` and joins ratings and the viewer's head-to-head record.
- It is re-read on a `lobby` poke on the broadcast topic `lobby:{language}`, and on a fallback poll: 3s while the socket is down, 12s while it is up.
- The server pokes `lobby:{language}` only on transitions:
  - a player's first fresh tab arrives;
  - a tab changes visibility;
  - a leaving beacon arrives;
  - a search starts or ends;
  - a match is created or completes.

  A leaving poke carries `recheckInMs: 8500`, so clients re-read once more after the 8s grace. That is how a closed tab drops within 8s (SC-002).

**Rationale.** One source of truth (the tabs), one read path, and pokes that carry no player data (FR-034). Presence joins were the main reason a closed tab lingered; they cannot express `away`.

**Alternatives considered.** Keeping Presence as a fast path next to the tabs: two models that disagree. A server-sent stream per lobby: Vercel serverless cannot hold connections.

## R3. Gone is decided lazily, and settled by the sweep

**Decision.** A function `settle_gone_players()` finds players with a search or a pending challenge and no fresh tab. It then:
- cancels their search (`status='available'`, `queue_language` null, `search_paused` false);
- ends their pending challenges as `left`, both sent and received;
- returns the affected ids.

The function runs:
- in the 30s cron sweep;
- inside `send_challenge` and `accept_invite`, for the two players involved;
- after a leaving beacon's 8s grace, when the next `players` read runs.

Every affected player gets an `outcome` poke, and their lobby gets a `lobby` poke.

**Rationale.** Gone is a time-based fact with no event of its own. Reads that matter (sending, accepting, listing) check freshness directly, so a stale row is never acted on. The sweep only tidies rows and informs the other side.

**Alternatives considered.** A timer per tab on the server: not possible on serverless. Doing it only in the client: it would never run when every client is gone.

## R4. Lobby language is a column on `players`

**Decision.** Add `players.lobby_language` ('is' | 'en', nullable).
- Entering a lobby (the `/` or `/en` page render, signed in) calls `enter_lobby(p_player, p_language)`. With nothing out it switches at once. With a search or a challenge out it returns `needs_confirm`, with the list of things a switch would cancel, and leaves the language unchanged.
- `confirm_lobby_switch` performs the cancellations (search cancelled, outgoing withdrawn, incoming ended `left`) and switches.
- Heartbeats carry the tab's page language but write `presence_tabs.language` from `players.lobby_language`, so reading `/en/rules` never moves an Icelandic player.

**Rationale.** The server needs the lobby language for gates (challenges and the queue within one lobby) and for lists. A cookie would be invisible to the other player's reads. Keeping it after the session ends is harmless: it is the last lobby entered, which is what the spec says.

**Alternatives considered.** Deriving it from the most recent heartbeat's page locale: this is today's bug (reading `/en/rules` moves you). A session-cookie field: the server cannot read it for other players.

## R5. One standing read per tab replaces the invite poll and the table check

**Decision.** `GET /api/standing` returns the viewer's standing facts in one payload:
- incoming challenges, oldest first, each with the sender, rating, head-to-head record and `expiresAt`;
- the outgoing challenge with its status and, once accepted, `matchId`;
- recent outcomes from the last 5s;
- the search (from `players`: status, `queued_at`, `search_paused`, cooldown);
- the viewer's match: pending, in progress, or completed while away;
- the player channel's topic.

The client derives the one slot state with a pure `standingSlot(facts, now)` using the spec's precedence. It replaces:
- `GET /api/lobby/invite` polled by `useLobbyInvites` (lobby only);
- `useTableCheck` → `/api/match/active` (lobby and profile only).

It is read on every `challenge` / `outcome` / `table` / `seat` / `match` poke, and on a fallback poll (3s while the socket is down, 12s while it is up). `/api/match/active` stays for the match page's own use.

**Rationale.** The line slot is one element fed by one read. Two polls per page become one, on every page (FR-009, US4). The attention report (`visible`, `inputAgoMs`) rides on the same request, as `useTableCheck` does today.

**Alternatives considered.** Separate hooks per concern (invites, table, search): these are three polls, and the precedence would be spread across components.

## R6. Pokes on a per-player topic with an unguessable name

**Decision.**
- The topic is `player:{hmac}`: the first 32 hex of HMAC-SHA256(`WOTTLE_SESSION_SECRET`, player id). The standing read returns it.
- The server publishes with the service-role client's broadcast `send`, the same mechanism as `statePublisher`. The event name is the kind (`challenge`, `outcome`, `table`, `seat`, `rematch`, `match`) with an empty payload.
- The rematch broadcast on `match:{id}` that carries `newMatchId` (`lib/match/rematchBroadcast.ts`) becomes a `rematch` poke on both players' topics. `useRematchNegotiation` then reads the new match id from the match state route (FR-034).
- The browser client is created with `realtime: { worker: true }` (supabase-js 2.108 `RealtimeClientOptions.worker`), so the socket heartbeat runs in a worker and survives background throttling (FR-037).

**Rationale.** There is no Supabase Auth yet, so channels cannot be private by RLS. A payload-free poke on an unguessable topic leaks at most the timing of an event to someone who already holds the session secret. The client never navigates on broadcast data.

**Alternatives considered.** `player:{uuid}`: player ids are visible in URLs and lists. Private channels: they need Supabase Auth (next phase).

## R7. Challenges: expiry, withdraw, cooldown and limits in SQL

**Decision.**
- Add `match_invitations.expires_at` (created + 60s), `decided_at` and the status `left`. Set `PLAYTEST_INVITE_EXPIRY_SECONDS` to 60.
- A new `send_challenge(p_sender, p_recipient, p_language)` locks both players in id order. In one transaction it:
  - checks the gates: both in the same lobby language, the recipient fresh and `here` or `searching`, neither at a table or in a match, the table-leave cooldown, a decline cooldown for the pair of 60s from the latest `declined`, at most 6 sent in the last minute, and whether three declines from this recipient within 10 minutes silence the sender;
  - withdraws the sender's other pending challenge and cancels their search;
  - accepts a crossed challenge through `accept_invite`;
  - inserts the challenge.

  A silenced challenge is inserted as `declined` with `decided_at` = now and `auto_declined = true`, so the sender sees `declined` and the recipient sees nothing.
- `withdraw_challenge(p_sender, p_invite)` is a compare-and-set from pending to withdrawn.
- `expire_challenges()` runs in the sweep and pokes both players.
- The sender's `lobby_presence.mode` write is dropped (spec §7.4: sending changes nothing about the sender).
- "For the session" in the three-declines rule is taken as 4 hours from the third decline, the session cookie's lifetime.

**Rationale.** Limits counted from rows hold across serverless instances (§7.8). One locked function makes send, cross and supersede atomic, which is the stage 1 pattern.

**Alternatives considered.** Rate limits in `assertWithinRateLimit`: it is in memory per instance. Tracking the recipient's actual session start: the cookie is not visible to SQL, and 4 hours matches it.

## R8. Head-to-head in one query

**Decision.** `head_to_head(p_viewer, p_language)` returns `(opponent_id, wins, losses, draws)` over matches where:
- `state = 'completed'`;
- `ended_reason is distinct from 'void'`;
- the viewer is a player;
- `language = p_language`.

It groups by the other player and reads `winner_id`. It is joined into the players read and the standing read. It uses indexes on `(player_a_id, language) where state='completed'` and the same for `player_b_id`.

**Rationale.** FR-038a: one query per lobby view. Every completed match already stores its players, language and winner.

**Alternatives considered.** A materialised table updated at settlement: more moving parts for a beta-sized table. Per-row client calls: N+1.

## R9. The lobby overview route

**Decision.** `GET /api/lobby/overview?language=` returns:
- `counts`: here, searching and playing, for this lobby and the other, from `player_presence`;
- for a session: `lastMatch`, the viewer's last completed, rated match in that language (opponent, both scores, duration, `completedAt`, and `bands`: each `word_score_entries` row's tiles and owner seat), and `form`, the last ten `match_ratings` results in that language, oldest first;
- signed out: `here`, at most 8 rows of name, rating and state (Q2), and `more`, the remainder count.

`getRecentGames` also excludes `state = 'abandoned'`. The stats route gains `?language=`. The page server components call the same functions directly for the first paint (SC-008). The client re-reads on `lobby` pokes.

**Rationale.** S10 names the route. The door and the masthead switch need counts for a lobby the viewer is not in.

**Alternatives considered.** Three small routes: more requests on every page.

## R10. Pages move out of the room shell

**Decision.** A new route group `app/[locale]/(pages)` with a layout that renders `PageFrame`. The group holds `/` (the door or the lobby), `/profile`, `/profile/[handle]` and `/rules`.
- `PageFrame` is the masthead, the line slot (signed in only), `main` and the folio.
- The profile and rules pages move into the group (their content is unchanged, spec assumption).
- `(room)` keeps only `/match/[matchId]`.
- `/lobby` and `/matchmaking`, with their `/en` forms, are 308 redirects in `next.config` `redirects()` (`permanent: true`).
- Deleted:
  - `QueueRoomController` and `QueueRoomView`;
  - `LobbyRoomController`, `LobbyRoomView`, `LobbyRoomPage` and `LobbyLedger`;
  - the `signIn` slip kind;
  - `NameInput`'s slip use (the door owns the one name input);
  - `useLobbyInvites` and `useTableCheck`.
- The void slip's queue action (spec 069) pushes `/` with the search running, instead of `/matchmaking`.

**Rationale.** Principle 1: a page has no field. The room shell mounts a field and bars, and the pages need neither. A persistent layout keeps the masthead and slot mounted across page turns (M1).

**Alternatives considered.** Rendering pages inside `RoomShell` with the field hidden: that is the confusion spec 070 removes.

## R11. Where the standing machinery lives

**Decision.** A client `StandingProvider` is mounted in `app/[locale]/layout.tsx` when a session exists, so it runs on pages and on the match page. It owns:
- `useTabPresence`: the tab id in `sessionStorage` (wrapped in try/catch, falling back to an in-memory id), the heartbeat cadence switching on `visibilitychange`, attention, and the `pagehide` beacon to `POST /api/presence/leave`;
- `usePlayerChannel`: pokes, and the poll cadence switch;
- `useStandingFacts`: the standing read;
- the search (`useMatchmaking`, moved out of the queue controller so a search continues across pages);
- `useTabTitle`, `useFavicon`, the `challenge` cue and `useNotifications`.

The line slot component reads the provider. On the match page the provider runs, but no slot renders (field states have none). The match controller keeps its own title while a match is live.

**Rationale.** FR-009 ("on every page") and S5 ("providers moved to `app/[locale]/layout.tsx`"). One heartbeat per tab no matter which page it is on.

**Alternatives considered.** A provider per page group: two heartbeats during a navigation, and none on the match page.

## R12. `stepped out` from the page heartbeat

**Decision.**
- While the viewer's match is in progress and the tab is on a page, the presence heartbeat also upserts `match_heartbeats` with a new column `source = 'page'` and the tab's cadence. The match state route's poll writes `source = 'match'`.
- The loader reports the opponent as **stepped out** when their latest heartbeat is fresh and `source = 'page'`. Fresh here uses the presence rule (3 × cadence + 5s), not the 10s match threshold.
- `reconnecting` starts only when neither source is fresh.
- `MatchState` gains `steppedOutPlayerId`, and the scoreboard sub-line reads `stepped out` / `brá sér frá`.

**Rationale.** FR-031. A player in the lobby is not disconnected, and the 90s window must not start against them.

**Alternatives considered.** Treating any page heartbeat as a match heartbeat with no source: the opponent could not tell `stepped out` from playing.

## R13. Match over while away

**Decision.** Add `players.unseen_result_match_id`.
- `completeMatchInternal` sets it for each player whose latest match heartbeat for that match is not a fresh `source = 'match'`.
- The match state route clears it when the player loads the completed match. Sign-out clears it too.
- The standing read returns it as `match: {kind: 'over', …}`, with the verdict and the detail.

**Rationale.** B8's `Your match is over · Kári wins 88–46` must survive a reload until opened, and must not appear for a player who watched it end.

**Alternatives considered.** Deriving it from "completed after my last match-page heartbeat": the same data, but with no clear point at which it is cleared.

## R14. The leave slip and the live Back guard

**Decision.**
- Add the slip kind `leave` (rank: match over > end early > resign > leave > ready | void).
- `useLiveBackGuard` pushes a `guard` history entry on the first pick of a live match (the pick is a user activation) and records `history.state.kind`.
- `popstate` onto the guard's predecessor raises the leave slip and re-pushes the guard. `go to the lobby` does `history.go(-1)` past the guard and then pushes `/`.
- Returning to a live match replaces an existing guard rather than stacking another.
- `beforeunload` is armed only while the match is `in_progress`. After completion the guard is disarmed and skipped.
- `RoomMenu`'s `leave` becomes `go to the lobby`, which raises the same slip.
- `confirmResign` is reachable only from `⋯ resign`.

**Rationale.** FR-041 to FR-043. This follows the table guard from spec 069 (`useTableBackGuard`), which is armed only before go.

**Alternatives considered.** Intercepting Next router navigation: it does not see the browser's Back.

## R15. Marks: lockup, strip and cell

**Decision.** The lockup, strip and cell are pure React SVG and HTML components generated from one geometry module, `lib/brand/lockup.ts`: cells, bands, chevrons and numerals, computed from the language packs' letter values and a cell size.
- The favicon is a static SVG per locale and state, in `public/brand/cell-{is,en}{,-call}.svg`. The locale layout's `generateMetadata` sets it, and `useFavicon` swaps the `<link rel=icon>` href while a call is pending.
- `app/icon.png` is deleted. An `apple-icon.png` per locale is rendered once from the SVG by a script and committed.
- The arrival motion uses the existing `letter-land` and `band-draw` keyframes behind a `sessionStorage` flag (try/catch).

**Rationale.** §6: the marks are the game's own cells, and one geometry keeps the three sizes consistent. Swapping a favicon needs a URL, so static files are simplest.

**Alternatives considered.** Canvas-drawn favicons at runtime: fonts are not loaded in time for the first paint.

## R16. Notifications, sound and title

**Decision.**
- `useNotifications` wraps the Notification API and is feature-detected. Opt-in is stored in `localStorage` (try/catch), per viewer. Permission is requested only from `⋯ notifications · on` or `tell me when someone is here ▸`.
- A notification is shown only when `document.visibilityState === 'hidden'`.
- The `challenge` cue is `playChallenge`, which respects the toggle and the first-gesture unlock.
- `tabTitle.ts` gains page beats: `door`, `lobby`, `incoming (n)`, `sent`, `searching`, `arrival`, `your match`, `over`. `useTabTitle` in the provider sets them when the match controller is not mounted.

**Rationale.** §7.7: Web Push is phase 2, and nothing is requested on load.

**Alternatives considered.** A service worker for notifications: phase 2 (S18).

## R17. Fixtures for pages

**Decision.** A route `/dev/page?phase=…` (behind `ROOM_FIXTURES`, like `/dev/room`) renders the page frame from static fixtures with no database. The phases are `door`, `is-door`, `door-returning`, `lobby-signed-in`, `lobby-empty`, `lobby-new`, `composer`, `challenge-sent`, `challenge-in`, `searching`, `match-running`, `match-over-away` and `switch-confirm`. `leave` is added to `/dev/room`.
- The visual suite runs them at 1440×900, 390×844, 390×664 and 360×640, plus an `is-*` set.
- `slot-overflow.spec.ts` renders every fixed slot with the longest Icelandic and English strings and fails on overflow.
- The retired `lobby`, `queue`, `landing-slip` and `returning-slip` room phases and their baselines are deleted, along with the orphan `landing-visual-*` files.

**Rationale.** The spec 045 lesson: every state the player can see gets a fixture and a baseline.

## R18. Performance

**Decision.** Every presence heartbeat is one upsert on `presence_tabs` and one upsert on `lobby_presence`, plus a lobby poke only on a transition. The perf gate `pnpm perf:heartbeat` asserts a p95 under 100ms on local Supabase. `player_presence` and `head_to_head` are indexed:
- `presence_tabs (player_id)` and `presence_tabs (language, beat_at)`;
- `matches (player_a_id, language) where state='completed'`, and the same for `player_b_id`.

The standing read is asserted under 150ms p95 (`pnpm perf:standing`).

**Rationale.** 100 players with 2 tabs each is about 20 heartbeats a second. The constitution's real-time budget still applies to the move path, and this stage does not touch that path.

## R19. SC-002, restated

**Decision.** SC-002 now reads:
- a closed tab disappears within 8s when it closes normally (the beacon plus the leaving poke's recheck);
- otherwise within 45s: the 35s gone threshold plus one 12s fallback refresh while the socket is up.

The spec is amended.

**Rationale.** Without an event, gone is noticed on the next read. A read every 12s is the fallback cadence FR-035 allows.

## T001 check (2026-09-23)

- **Supabase `realtime.worker`:** confirmed from the installed `@supabase/realtime-js` 2.108 typings (`RealtimeClientOptions.worker`, `workerUrl`). Context7 has no entry that covers it.
- **Next.js:** `redirects()` with `permanent: true` returns 308. Route groups share URL space, so `(pages)` and `(room)` must never both define `/`.
- **Nothing differs from R6 or R10.**
- **Found while checking:** `next.config.ts` denies `screen-wake-lock` in `Permissions-Policy`. That blocks the Wake Lock that spec 069 and this spec rely on (US3.3, US5.7). T092 removes the denial.
