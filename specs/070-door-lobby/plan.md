# Implementation Plan: The door, the lobby, challenges and presence

**Branch**: `070-door-lobby` | **Date**: 2026-09-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/070-door-lobby/spec.md`, with clarifications Q1–Q4. Research decisions R1–R19 are in [research.md](./research.md).

## Summary

The door and the lobby become **pages**: no field, the room's grid, a masthead, a sticky **line slot** and a folio. The field appears only at a table.
- **The door:** the ORÐUSTA × WOTTLE lockup, the headline, the lede, the one name field, and here now.
- **The lobby:** your block, the form strip, here now with your record against each player, the band map of your last match, and your recent matches.
- **The line slot** follows the player to every signed-in page with one standing state: a call, your match, a lobby switch to confirm, your challenge, or your search. Each has a countdown, a drain, a cue, the tab title and the favicon.
- **Challenges** get a composer that states the stakes, a full lifecycle, a 60s life, withdraw, a 60s cooldown after a decline, and limits counted from rows.
- **Presence** becomes per tab (here, searching, in a match, away, gone).
- **Events** arrive as payload-free pokes on a per-player topic, with polls as the fallback.
- **In a live match,** Back and `⋯ go to the lobby` open a leave slip that never resigns.

**Technical approach:**
- **The server:** one additive migration (`presence_tabs`; lobby language, unseen result, challenge expiry and `left`, heartbeat source; eleven functions).
  - New routes: `/api/presence/beat`, `/api/presence/leave`, `/api/standing` and `/api/lobby/overview`, plus a rewritten `/api/lobby/players`.
  - New actions: send, withdraw, lobby switch.
  - A pokes module; three more steps in the cron sweep.
- **The client:**
  - A new `(pages)` route group with `PageFrame`.
  - A `StandingProvider` in the locale layout that owns heartbeat, channel, standing read, search, title, favicon, cue and notifications.
  - Pure derivations for the slot, rows, composer, form strip, band map and lockup.
  - The leave slip and the live Back guard in the match controller.
  - The queue room, the lobby room, the sign-in slip, the invite poll and the table check are retired.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22, React 19, Next.js 16.2 (App Router); PL/pgSQL.
**Primary Dependencies**: Supabase JS v2.108 (RPC; Realtime broadcast with `worker: true`), Zod, zustand, Tailwind 4. Browser APIs: Page Visibility, `navigator.sendBeacon`, the Notification API (feature-detected), Screen Wake Lock (existing `useWakeLock`), Web Audio (existing `playChallenge`). No new dependency.
**Storage**: Supabase PostgreSQL. One additive migration, `20260925001_door_lobby.sql` (data-model.md). `lobby_presence` stays as the per-player summary.
**Testing**:
- Vitest unit tests for every derivation in `contracts/page-derivations.md`, and for the hooks (fake timers, visibility, beacon, channel).
- Contract tests:
  - the public overview exposes no per-player match data;
  - standing needs a session;
  - the beacon routes accept text/plain;
  - `?next=` is validated.
- Integration against local Supabase:
  - `presence.test.ts`: tabs, away, gone, leaving grace, best-of-tabs;
  - `challenges.test.ts`: TTL, withdraw, cooldown, 6 a minute, three declines, crossed, gone → left, lobby switch;
  - `challenges.race.test.ts`: send, accept, withdraw and pairing at once, 100 rounds;
  - `head-to-head.test.ts` and `overview.test.ts`.
- Playwright:
  - `door.spec.ts`
  - `lobby-challenge.spec.ts` (two players)
  - `line-slot.spec.ts` (a call on `/rules`, sent across pages)
  - `presence.spec.ts` (close a tab, the row drops)
  - `leave-slip.spec.ts`
  - `lobby-language.spec.ts`
  - the existing two-player specs move from `/matchmaking` to the lobby's find button.
- The visual suite: `/dev/page` phases and the `leave` room phase at four viewports, plus the slot-overflow test.

**Target Platform**: Evergreen desktop and mobile browsers; Vercel serverless; pg_cron every 30s.
**Project Type**: Web application (one Next.js project).
**Performance Goals**:
- Heartbeat under 100ms p95; standing read under 150ms p95.
- A call is visible within 1s with the socket up, and within 3s without it (SC-001).
- A closed tab drops within 8s, or 45s without a beacon (SC-002).
- The lobby's first paint comes from the server with no presence wait (SC-008).
- The move path is untouched.

**Constraints**:
- Server-authoritative presence, gates, limits and lobby language.
- Pokes carry no ids, and the client never navigates on broadcast data.
- Nine colour tokens and two families: the lockup and strip use existing tokens, and seat colour on pages only as §8 item 6 lists.
- Nothing blinks; drains and counts step once a second under reduced motion.
- Only the slip covers a field, and nothing covers page content except the sticky masthead.
- Every fixed slot fits its longest string in both languages.
- One `h1` and the landmarks on every page.

**Scale/Scope**: 10 user stories and 48 FRs. About 60 files touched or added, about 12 deleted, one migration, 6 new Playwright specs, and 14 new fixture phases.

## Constitution Check

*GATE: must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Note |
|---|---|---|
| I. Server-authoritative | PASS | Presence states, gone, lobby language, every challenge gate, the cooldown and the limits are decided in SQL under player row locks. The client reports only visibility and input. Standing and lists are server reads, and the slot is derived from them. |
| II. Real-time performance | PASS | Pokes arrive in under 1s. The move RTT, validation and broadcast budgets are untouched. New gates: `perf:heartbeat` p95 < 100ms, `perf:standing` p95 < 150ms. The fallback polls are 3s while the socket is down and 12s while it is up. |
| III. Type-safe end to end | PASS | `StandingFacts`, `SlotState`, `LobbyRow`, `Overview` and the challenge statuses live in `lib/types/standing.ts`. Every action and route has a Zod input and an explicit return type. RPC rows are parsed with Zod. |
| IV. Progressive enhancement and mobile-first | PASS | Phone door, lobby and composer are acceptance scenarios, with a bottom slot and safe-area padding. The beacon, Notification, Wake Lock and the worker are feature-detected. The polls work with Realtime disabled. |
| V. Observability and resilience | PASS | Structured logs: `presence.transition`, `presence.gone`, `challenge.sent\|withdrawn\|declined\|expired\|left\|superseded\|refused {reason}`, `lobby.switch`, `poke.failed`. The sweep settles gone players and expired challenges if every client is lost. A poke failure falls back to the poll. |
| VI. Clean code | PASS | Derivations are pure modules, one per concern. Components render models only. Functions are under 20 lines. `send_challenge` is split into gate checks by helper functions. |
| VII. TDD | PASS | Each SQL function starts from a failing integration test, and each derivation from a failing unit test. The race test pins "one outgoing challenge; no challenge to a busy or gone player". |
| VIII. Context7 | PASS | The realtime `worker` option was checked against the installed `@supabase/realtime-js` 2.108 typings. It will be re-checked with Context7 before implementation, together with Next 16 `redirects()` and route-group layouts. |
| IX. Commit standards | PASS | Conventional commits. The migration lands with its integration tests. |

No violations. Complexity Tracking is empty.

**Post-design re-check:**
- The data model adds one table and keeps the old summary row, so no reader breaks mid-stage.
- Pokes are payload-free on HMAC topics.
- Every gate stays in SQL.

It still passes.

## Project Structure

### Documentation (this feature)

```text
specs/070-door-lobby/
├── spec.md
├── plan.md              # this file
├── research.md          # R1–R19
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── routes-and-actions.md
│   └── page-derivations.md
├── checklists/requirements.md
└── tasks.md             # /speckit.tasks
```

### Source Code (repository root)

```text
supabase/migrations/20260925001_door_lobby.sql     # NEW (data-model.md)

lib/
├── types/standing.ts                     # NEW StandingFacts, SlotState, LobbyRow, Overview, InviteStatus, Outcome
├── presence/constants.ts                 # NEW one module shared by client and server (FR-032)
├── presence/presenceService.ts           # NEW beat, leave, playerPresence, lobbyCounts (RPC + Zod)
├── matchmaking/challengeService.ts       # NEW send, withdraw, respond, expire, settleGone; replaces the invite half of inviteService
├── matchmaking/inviteService.ts          # − sendDirectInvite, getOutgoingInvite, mode writes; queue code stays
├── matchmaking/lobbyLanguage.ts          # NEW enterLobby, confirmSwitch
├── matchmaking/headToHead.ts             # NEW
├── matchmaking/presenceStore.ts          # − Supabase Presence; list read on pokes + fallback poll
├── matchmaking/profile.ts                # fetchLobbySnapshot → player_presence
├── lobby/overview.ts                     # NEW counts, lastMatch + bands, form
├── realtime/pokes.ts                     # NEW pokePlayer, pokeLobby, topicFor (HMAC)
├── realtime/presenceChannel*.ts          # DELETED
├── supabase/browser.ts                   # realtime: { worker: true }
├── match/rematchBroadcast.ts             # → pokes, no newMatchId
├── match/heartbeatRepository.ts          # source + cadence; stepped out
├── match/stateLoader.ts                  # steppedOutPlayerId; clear unseen_result on a completed read
├── match/tableService.ts                 # + seat/table pokes
├── brand/lockup.ts                       # NEW lockup, strip, cell geometry
├── pages/standingSlot.ts, slotLines.ts, pagePrimary.ts, lobbyRows.ts, composer.ts,
│   formStrip.ts, bandMap.ts              # NEW pure derivations
├── auth/nextParam.ts                     # NEW
├── room/slip.ts                          # + leave kind; − signIn kind
├── room/tabTitle.ts                      # page beats
├── room/useMatchmaking.ts                # moved under the provider; no page of its own
├── room/useRematchNegotiation.ts         # reads the new match id on a rematch poke
└── i18n/copy/{en,is}.ts, types.ts        # door, lobby, slot, composer, outcomes, leave, switch, glossary; retired strings removed

app/
├── [locale]/layout.tsx                   # StandingProvider when signed in; icons per locale
├── [locale]/(pages)/layout.tsx           # NEW PageFrame (masthead, slot, main, folio)
├── [locale]/(pages)/page.tsx             # NEW door | lobby
├── [locale]/(pages)/profile/**           # MOVED from [locale]/profile (content unchanged)
├── [locale]/(pages)/rules/page.tsx       # MOVED from [locale]/rules
├── [locale]/(room)/{page,lobby,matchmaking,LobbyRoomPage}.tsx   # DELETED
├── [locale]/(room)/layout.tsx            # match only
├── [locale]/dev/page/**                  # NEW page fixtures
├── actions/challenge/{send,withdraw,respond}.ts                  # NEW; respond replaces respondInvite
├── actions/lobby/{enterLobby,confirmSwitch}.ts                   # NEW
├── actions/match/getRecentGames.ts       # exclude abandoned
├── actions/auth/logout.ts                # clear unseen_result
├── api/presence/{beat,leave}/route.ts    # NEW
├── api/standing/route.ts                 # NEW
├── api/lobby/overview/route.ts           # NEW (public)
├── api/lobby/players/route.ts            # player_presence + head_to_head
├── api/lobby/presence/route.ts           # DELETED (superseded by beat)
├── api/lobby/invite/route.ts             # GET deleted; withdraw beacon added
├── api/cron/sweep-stale-matches/route.ts # + expire, settle gone, prune tabs
└── icon.png                              # DELETED → public/brand/cell-*.svg, apple-icon per locale
next.config.ts                            # 308 redirects

components/
├── page/PageFrame.tsx, Masthead.tsx, LineSlot.tsx, BottomSlot.tsx, Folio.tsx     # NEW
├── page/Lockup.tsx, Strip.tsx, LanguageSwitch.tsx, PageMenu.tsx                  # NEW
├── page/door/{Door,DoorForm,HereNowList,HowItPlays}.tsx                          # NEW
├── page/lobby/{Lobby,YourBlock,FormStrip,HereNowTable,ComposerRow,BandMap,
│              LastMatch,RecentMatches}.tsx                                       # NEW
├── standing/StandingProvider.tsx         # NEW
├── standing/hooks/{useTabPresence,usePlayerChannel,useStandingFacts,useHeldOutcome,
│                   useTabTitle,useFavicon,useNotifications,useLobbyList}.ts      # NEW
├── room/MatchRoomController.tsx          # leave slip, live Back guard, beforeunload, stepped out, rematch poke
├── room/Slip.tsx                         # + leave; − signIn
├── room/RoomMenu.tsx                     # leave → go to the lobby
├── room/Scoreboard.tsx                   # stepped out sub-line
├── room/hooks/useLiveBackGuard.ts        # NEW
├── room/{LobbyRoomController,LobbyRoomView,LobbyLedger,QueueRoomController,
│         QueueRoomView,NameInput}.tsx    # DELETED (NameInput's validation moves into DoorForm)
├── room/hooks/{useLobbyInvites,useTableCheck}.ts                                 # DELETED
└── profile/ProfilePage.tsx               # − useTableCheck (the provider covers it)

app/styles/pages.css                      # NEW page grid, masthead, slot, rows, composer, strip, lockup (tokens only)
docs/design_documentation/260914-wottle-new-design/WOTTLE_DESIGN_SYSTEM.md   # §8 items 1, 3, 4, 7, 10, 13
CLAUDE.md                                 # Design, architecture §7 flow, directory structure, fixtures, gaps

tests/
├── unit/lib/pages/*.spec.ts, unit/lib/brand/lockup.spec.ts, unit/lib/auth/nextParam.spec.ts
├── unit/components/standing/*.spec.tsx, unit/components/page/**/*.spec.tsx
├── unit/i18n/name-safe-grep.test.ts      # §8 item 13 banned variants
├── contract/{overview-public,standing-auth,beacons,next-param}.contract.test.ts
├── integration/db/{presence,challenges,challenges.race,head-to-head,overview,lobby-language}.test.ts
├── integration/ui/{door,lobby-challenge,line-slot,presence,leave-slip,lobby-language}.spec.ts
├── integration/ui/slot-overflow.spec.ts
├── perf/{heartbeat,standing}.bench.ts    # pnpm perf:heartbeat, perf:standing
└── visual: page phases + leave
```

**Structure decisions.**
- Pages get their own route group and CSS file.
- The standing machinery lives once, in the locale layout.
- The SQL functions carry every rule, and `challengeService.ts` and `presenceService.ts` are their only TypeScript callers (a grep test, as for `tableService`).

## Phases and sequencing

```text
A. Server core (US3, US6, US9, US10)      B. Pages (US1, US2)                      C. Slot + flows (US3–US5, US7, US8)
────────────────────────────────────      ───────────────────                      ───────────────────────────────────
migration + presence/challenge tests      lockup/strip/cell geometry               StandingProvider (beat, channel,
presence beat/leave, player_presence        + favicon swap                           standing, search, title, cue, notify)
send/withdraw/respond, expire, gone       (pages) group, PageFrame, redirects      LineSlot + BottomSlot, slot models
head_to_head, overview, players read      door (+ returning, ?next, arrival)       composer, sent/outcomes, call, B8
pokes + rematch → poke, worker socket     lobby (block, form, table, band map,     lobby-language confirm
lobby language functions                    recent, new, empty, phone)             leave slip + live Back guard
cron: expire, settle gone, prune          delete lobby/queue rooms, sign-in slip   stepped out, match over while away
                                          /dev/page fixtures                       docs, glossary grep, baselines, perf
```

**Order of landing.**
- A lands first. It is behind no flag, but it changes nothing visible:
  - the old lobby keeps working, because `lobby_presence` is still written;
  - the old invite poll keeps reading the invitations table;
  - the 60s TTL is compatible.
- B and C land together: deleting the lobby room removes the old slot for challenges, so the new line slot must arrive in the same slice.
- The Playwright two-player specs move to the find button in the same commit that deletes `/matchmaking`'s page.

## Risks

| Risk | Mitigation |
|---|---|
| Two-player E2E specs relied on `/matchmaking` and the lobby ledger's invite buttons | Helpers `findOpponent(page)`, `challenge(page, name)` and `acceptCall(page)` are added in `helpers/matchmaking.ts`, and every spec is migrated in the same commit. |
| Heartbeat volume (every 10s per visible tab) | Two small upserts per beat, and a lobby poke only on a transition. There is a perf gate, and the tab rows are pruned by the sweep. |
| A tab closed with no beacon (mobile kill, crash) stays `here` for up to 35s | The spec accepts this (SC-002 amended to 45s). The send and accept gates check freshness at that moment. |
| Stale players are shown `here` between the gone threshold and the next read | The next list read drops them. The gates refuse actions against them with `that player has left`. |
| Unguessable topics still leak event timing to anyone with the secret | Pokes carry no payload. Private channels come with Supabase Auth (next phase). |
| Moving profile and rules into `(pages)` changes their layout | Their content components are unchanged, and the visual baselines for profile are regenerated and reviewed. |
| The lobby-language confirm might trap a player with a stale search | Confirm cancels everything listed, and leaving the page changes nothing. The search's own 3:00 check still stops it. |
| Icelandic strings marked (?) | Shipped as drafted and listed in CLAUDE.md gap 4 for the native read. |
| Linux visual baselines | Taken from the CI visual job's artifacts, as before. |
| Favicon swapping is not supported in every browser (Safari caches) | The title `(1)` is the primary signal (§6). The favicon is best-effort. |

## Complexity Tracking

None.
