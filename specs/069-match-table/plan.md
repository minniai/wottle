# Implementation Plan: The table

**Branch**: `069-match-table` | **Date**: 2026-09-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/069-match-table/spec.md`, with clarifications Q1–Q3.

## Summary

Every match begins at a **table**. The server holds the letters until both players are seated. A player is seated by their own press, or by a visible tab with input in the last 30s. Anyone else gets `ready ▸` and 20s.
- **The second seat** writes the board and sets `started_at = now + 4.5s` in one compare-and-set. The 3·2·1 plays in the scoreboard's clock row while the letters land.
- **A table that does not fill, or that someone leaves,** is **void**: nothing is rated or recorded. The seated queue player is requeued at the front, and the absent player's search stops.
- **The queue becomes fair:**
  - `queued_at` order, and only players seen in the last 10s;
  - a hidden tab pauses its search;
  - the 3:00 check;
  - a requeue at the front after a void.
- **A cooldown of 5 minutes** follows two table leaves in 10 minutes.

**Technical approach:**
- **The server:** one migration adds the table columns and five functions (`seat_player`, `start_table_if_seated`, `void_table`, `find_due_tables`, `table_leave_cooldown_until`), changes `create_match_between` and `pair_from_queue`, and drops `start_match_if_ready`.
  - The loader stops starting matches and stops returning a pending board.
  - Two new actions, `seatAction` and `leaveTableAction`, and a pause beacon.
  - The cron sweep adds due tables.
- **The client:**
  - The match controller renders the `table` and `void` beats with two new slip kinds.
  - A `useTableCheck` hook on the lobby and profile (the queue has its own poll) takes a player to a table from anywhere.
  - A `useAttention` hook reports visibility and input.
  - The queue drops its inline `found` phase for a push to `/match/:id`.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22, React 19, Next.js 16.2 (App Router); PL/pgSQL.
**Primary Dependencies**: Supabase JS v2 (RPC, Realtime), Zod, zustand (`roomStore`), Tailwind 4. Browser APIs: Page Visibility, Screen Wake Lock (feature-detected), `navigator.sendBeacon`, Web Audio (existing `useSoundEffects`). No new dependency.
**Storage**: Supabase PostgreSQL. One additive migration, `20260924001_the_table.sql`: 5 columns on `matches`, 6 on `players`, `ended_reason` widened with `'void'`, 5 new functions, 2 changed, 1 dropped.
**Testing**:
- Vitest for unit tests: derivations, slip models, stakes, queue view.
- Contract tests: no board before seats; a pending match can't be resigned.
- Integration against local Supabase: `table.race.test.ts`, 100 rounds.
- Playwright: `table.spec.ts`, plus `sitDownIfAsked` in every two-player spec.
- The visual suite: 6 new phases and the phone table.
**Target Platform**: Evergreen desktop and mobile browsers; Vercel serverless; pg_cron every 30s.
**Project Type**: Web application (one Next.js project).
**Performance Goals**:
- The seat RTT is under 200ms p95; it is one locked RPC plus a publish.
- The two rooms' 3·2·1 agree within 250ms (SC-004); both count from the server's `started_at` with drift correction.
- The queue query stays indexed: `(queue_language, queued_at) where status='matchmaking'`.
**Constraints**:
- Server-authoritative seats, start and void.
- No board leaves the server before both seats.
- Nothing blinks; time still steps under reduced motion.
- The slip is the only thing over the field.
- Nine colour tokens.
- No field state scrolls on a phone.
**Scale/Scope**: 8 user stories; about 35 files; a migration; about 8 E2E specs gain `sitDownIfAsked`.

## Constitution Check

*GATE: must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Note |
|---|---|---|
| I. Server-authoritative | PASS | Seating, the start time, the void, requeue and the cooldown are decided in SQL under the match row lock. The client reports attention; the server decides the seat. The board is written only by the completing seat. |
| II. Real-time performance | PASS | The move path is unchanged. A seat is one RPC. The start is anchored to server time. A state publish follows each seat and void, and the 2s poll stays as the fallback. |
| III. Type-safe end to end | PASS | `MatchTable`, `Stakes`, `VoidReason` and `QueueView` are in `lib/types`. Every new action has a Zod input and an explicit return type. RPC results are parsed with Zod. |
| IV. Progressive enhancement and mobile-first | PASS | The phone table is a story. Wake Lock and `sendBeacon` are feature-detected. The 44×44 targets are kept. |
| V. Observability and resilience | PASS | Structured logs `table.seated`, `table.started`, `table.void {reason}`, `queue.paused`, `queue.requeued`, `table.cooldown`. The lazy void and the sweep cover a lost client, and pending rows from before the release are voided. |
| VI. Clean code | PASS | The slip and queue logic are pure models; one controller branch per beat; functions under 20 lines. |
| VII. TDD | PASS | Each function and derivation starts from a failing test. The race test pins "never started without both seats". |
| VIII. Context7 | PASS | No new library. Wake Lock follows MDN; nothing to fetch. |
| IX. Commit standards | PASS | Conventional commits. The migration lands with its integration test. |

No violations. Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/069-match-table/
├── spec.md
├── plan.md              # this file
├── research.md          # R1–R11
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── table-functions.md
│   ├── actions-and-routes.md
│   └── room-derivations.md
├── checklists/requirements.md
└── tasks.md             # /speckit.tasks
```

### Source Code (repository root)

```text
supabase/migrations/20260924001_the_table.sql   # NEW columns, functions; drop start_match_if_ready; void old pending

lib/
├── types/match.ts                  # MatchTable, Stakes, VoidReason; board nullable; endedReason 'void'
├── match/stateLoader.ts            # − startIfReady/START_GRACE_MS; lazy void, start_table_if_seated; table, stakes; no pending board
├── match/tableService.ts           # NEW seat, leave, voidDueTable, startIfSeated (RPC + Zod + publish + logs)
├── match/createMatch.ts            # pressed_by; start_table_if_seated after a full creation
├── rating/stakes.ts                # NEW stakesFor
├── matchmaking/inviteService.ts    # queued_at order, freshness, pause, cooldown, attention; sendDirectInvite cooldown
├── matchmaking/attention.ts        # NEW recordAttention (clamp, write)
├── room/moveState.ts               # table and void beats
├── room/tableSlip.ts               # NEW readySlipModel, voidSlipModel
├── room/queueView.ts               # NEW
├── room/scoreboard.ts              # table and void phases
├── room/slip.ts                    # ready and void kinds; ranking
├── room/tabTitle.ts                # table, starting, searching
├── room/roomStore.ts               # − found phase
├── room/useMatchmaking.ts          # attention, pause beacon, resume, 3:00 check, no unmount leak
└── i18n/copy/{en,is}.ts, types.ts  # table, void, queue, cooldown strings; ErrorCodes not_started, table_cooldown

app/
├── actions/match/seat.ts, leaveTable.ts        # NEW
├── actions/match/resignMatch.ts                # refuse before go
├── actions/matchmaking/startQueue.ts, resumeQueue.ts (NEW), cancelQueue.ts, sendInvite.ts
├── api/matchmaking/pause/route.ts              # NEW beacon
├── api/match/active/route.ts                   # attention, cooldownUntil, notice
├── api/cron/sweep-stale-matches/route.ts       # + due tables
├── actions/match/getRecentGames.ts, getBestWords.ts, requestRematch.ts   # exclude void
└── [locale]/dev/room/fixtures.ts, RoomFixture.tsx                        # + 6 phases, phone table

components/
├── room/MatchRoomController.tsx, MatchRoomView.tsx   # table/void beats, slip, guard entry, match-start, announcements
├── room/Slip.tsx                                     # ready and void kinds (desktop and phone square)
├── room/Scoreboard.tsx                               # table sub-lines, the still clock row
├── room/Ledger.tsx                                   # `opponent found` caption; phone facts line
├── room/QueueRoomController.tsx                      # push to the table; queue view lines
├── room/LobbyRoomController.tsx                      # useTableCheck; cooldown in the find slot; table_missed notice
├── room/hooks/useTableCheck.ts, useAttention.ts, useWakeLock.ts   # NEW
├── room/hooks/useSoundEffects.ts                     # challenge cue; match-start wired
└── profile/ProfilePage.tsx                           # useTableCheck

docs/prd_and_requirements/wottle_game_rules.md       # §2a, §12 (S13)
docs/design_documentation/260914-wottle-new-design/WOTTLE_DESIGN_SYSTEM.md   # slip kinds, table sub-lines
CLAUDE.md                                            # Design, architecture §4a/§5/§7, disconnect, fixtures
TODOS.md                                             # the resign stake closed

tests/
├── unit/lib/room/{tableSlip,queueView,moveState.table,scoreboard.table,tabTitle}.spec.ts
├── unit/lib/rating/stakes.spec.ts
├── unit/components/room/{Slip.table,MatchRoomController.table}.spec.tsx
├── unit/hooks/{useAttention,useTableCheck,useWakeLock}.spec.ts
├── contract/{no-board-before-seats,resign-pending}.contract.test.ts
├── integration/db/table.race.test.ts
└── integration/ui/table.spec.ts (+ sitDownIfAsked in helpers/matchmaking.ts and the two-player specs)
```

**Structure decision.** The existing single Next.js project. The database functions carry the rules. `lib/match/tableService.ts` is the only TypeScript caller of the table functions. The room stays pure in `lib/room/`.

## Phases and sequencing

```text
A. Server (US1–US3 core)                     B. Room (US1–US3 UI)                  C. Queue + rest (US4–US8)
────────────────────────                     ────────────────────                  ─────────────────────────
migration + race test ─┐                     moveState beats ─┐                    queued_at/freshness/pause
tableService (seat,    ├─ loader: no board,  tableSlip models ├─ Controller + Slip  3:00 check, resume, beacon
  leave, void, start)  │  lazy void, stakes  scoreboard table │  + Scoreboard      cooldown (server + find slot)
create_match_between ──┤                     guard entry, go  ┘  E2E sitDownIfAsked useTableCheck on 3 pages
cron due tables ───────┘                     queue → push /match/:id                phone table, wake lock, titles, cue
resign refuses pending                                                               resign stake; docs; fixtures; baselines
```

Phase A leaves the old room working: a pending match renders as today's `yourMove` with no board, so it must land together with Phase B's `table` beat. A and B ship as one PR slice. Phase C is additive.

## Risks

| Risk | Mitigation |
|---|---|
| The E2E two-player specs stall at the table | `sitDownIfAsked` for both pages right after pairing, in the same commit that makes seating required. |
| Playwright tabs report `visible` but have had no input for 30s, so they aren't seated | Intended behaviour. The helper presses `ready ▸`, and one spec asserts the auto-seat right after a click. |
| A hidden tab's timers are throttled, so the pause poll arrives late | The `visibilitychange` beacon is primary, and the 10s freshness filter is the backstop. |
| Matches pending at the release | The migration gives them a past deadline, and the first read or sweep voids them without a rating. |
| A void leaks into history | `ended_reason <> 'void'` in every finished-match reader, and a unit grep test lists the readers. |
| Icelandic strings marked (?) | Added to CLAUDE.md gap 4. |
| The Linux baselines differ from darwin | Taken from the CI visual job's artifacts, as before. |

## Complexity Tracking

None.
