# Implementation Plan: The result, rematch and review

**Branch**: `071-result-rematch-review` | **Date**: 2026-09-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/071-result-rematch-review/spec.md`, with clarifications Q1–Q2. Research decisions R1–R17 are in [research.md](./research.md).

## Summary

The match ends properly, and it can be read back.

- **The result slip:**
  - It lands 600ms after the last reveal and focuses its headline.
  - Every action is guarded for 500ms.
  - It says once why the match ended (`moves_complete`, `incomplete`, `both_incomplete`, `forfeit`, and a new `ended_early`) and carries the viewer's best word.
  - Esc and `review the match ▸` lift it, and the game never raises it again.
- **Rematch:**
  - One locked function decides a request: completed and rated, within 2:00 of completion, both players with a fresh tab on this match (hidden counts), and one request per match.
  - A request lasts 30s (`expires_at`), expired lazily and by the sweep.
  - Accepting and crossing go through `create_match_between`.
  - A decline or expiry starts the pair's 60s cooldown, shared with challenges but outside the three-declines rule.
  - The state reaches the client as `MatchState.rematch` after payload-free pokes. An incoming request on a lifted slip or in review is the ledger's first line.
- **Review:**
  - `?review=n` on the match page, with the same Field and no remount.
  - Steps come from a new public `/moves` route: every received move in `global_seq` order, refusals included, plus a derived closing step for unplayed penalties.
  - The scrubber is the scoreboard's clock row (a slider). There are five labelled controls (phone: glyphs in the foot), a ledger of cells with a roving tabindex, and a cursor line in the live row's place.
  - Stepping forward reuses the exchange and band draw.
  - History runs guard → result → review. `/summary` → `?review=last`. Signed-out visitors can read a completed match.
- **The rules document:** §12 gets *Match over* amended and a new *Review* row.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22, React 19, Next.js 16.2 (App Router); PL/pgSQL.
**Primary Dependencies**: Supabase JS v2 (RPC; Realtime pokes from spec 070), Zod, zustand (`roomStore`), Tailwind 4. Browser: the History API (`pushState`/`replaceState`, synced by the App Router's `useSearchParams`), Page Visibility (autoplay), existing Web Audio cue, favicon and title hooks. No new dependency.
**Storage**: Supabase PostgreSQL. One additive migration, `20260926001_result_rematch_review.sql`:
- `presence_tabs.match_id`;
- `rematch_requests.expires_at`;
- `ended_reason` gains `ended_early`;
- new functions `player_on_match`, `pair_cooldown_until`, `request_rematch`, `decline_rematch`, `withdraw_rematch`, `expire_due_rematches` and `rematch_series`;
- changed functions `beat_tab`, `accept_rematch` and `send_challenge`.

See data-model.md.
**Testing**:
- Vitest unit tests for every derivation in `contracts/room-derivations.md`, plus the hooks (`useReview`, `useReviewAutoplay`, the guard, the history kinds) under fake timers.
- Contract tests for `/moves`: public, 404 for void or live, totals invariant.
- Integration tests against local Supabase:
  - `request_rematch` refusals (window, presence, one per match);
  - expiry, decline and withdraw;
  - the shared cooldown;
  - a 100-round race of crossed requests (one match each time).
- Playwright: `rematch-flow` (two browsers) and `review-flow` (one browser plus signed out).
- Visual baselines for the new fixture phases at 1280×800, 1440×900 and 390×844, in both languages.
- The slot-overflow, copy-parity and name-safe greps extended to the new strings.
- Perf benches for `/moves` and the rematch functions (T083, T084).

**Target Platform**: Web. Desktop 1280–1440 and phones from 360 wide. Vercel + Supabase.
**Project Type**: Web application (Next.js single repo).
**Performance Goals**:
- `/moves` is one round trip, under 150ms p95 locally for 20 moves.
- A review step renders under 100ms on a mid-range phone (SC-008).
- `request_rematch` is under 200ms p95.
- The existing move SLAs are unaffected, since nothing touches the move path.

**Constraints**:
- Server-authoritative: the offer, the window, presence and expiry are all decided in SQL.
- No payload in pokes.
- Nothing blinks. Review motion is 0ms under reduced motion.
- Crimson only for points lost.
- Seat colour through `getSeatColors`.
- Every line within its slot at 1440 and 390.

**Scale/Scope**:
- 5 artboards; about 16 new fixture phases.
- 1 migration, 1 route, 3 actions reshaped.
- About 12 new pure modules, 3 new components (`ReviewScrubber`, `ReviewControls`, `ReviewCell`).
- Changes to `Slip`, `Scoreboard`, `Ledger`, `MatchRoomController` and `useLiveBackGuard`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | How |
|---|---|---|
| I. Server-authoritative | ✅ | The offer, window, presence, one-per-match rule, expiry, cooldown and match creation are in `request_rematch` / `accept_rematch` / `pair_cooldown_until` under row locks. Review is read-only over stored rows, and the closing step is derived from the recorded totals and asserted equal to them. |
| II. Performance | ✅ | The move path is untouched. `/moves` is one query and cacheable (immutable once completed). A review step is prop changes on a mounted Field. |
| III. Type-safe | ✅ | Zod on every action and the route's params. `MovesResponse`, `RematchOffer` and `ReviewStep` are typed in `lib/types`. Explicit return types. |
| IV. Mobile-first | ✅ | F4 and F7: the slip is exactly the field's square, and the phone review controls are 44×44 with `aria-label`s. The scrubber is at least 32px tall, with a 44px hit area through padding. |
| V. Observability | ✅ | `match.rematch.requested / declined / expired / withdrawn / accepted` log events (`logWriter`), and `review.moves.served` timing marks. The integrity invariant (the last step equals the result) is logged if it ever fails in production. |
| VI. Clean code | ✅ | Pure derivations in `lib/review/` and `lib/room/`. The controller only wires. The rematch functions have one caller module (enforced by a grep test). |
| VII. TDD | ✅ | Every task in tasks.md starts with a failing test: unit, contract, integration or Playwright. Visual baselines change only with `--update-snapshots`. |
| VIII. Context7 | ✅ | Consulted for the Next.js 16 `useSearchParams` / native History API integration (R3) before implementation. |

No violations, so Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/071-result-rematch-review/
├── spec.md
├── plan.md               # this file
├── research.md           # R1–R17
├── data-model.md         # migration, types, review model
├── quickstart.md         # manual walk + gates
├── contracts/
│   ├── routes-and-actions.md
│   └── room-derivations.md
├── checklists/requirements.md
└── tasks.md              # /speckit.tasks
```

### Source Code (repository root)

```text
supabase/migrations/20260926001_result_rematch_review.sql      # new

app/
├── api/match/[matchId]/moves/route.ts                          # new: public moves of a completed match
├── api/match/[matchId]/state/route.ts                          # rematch offer + series
├── api/presence/beat/route.ts                                  # matchId
├── api/cron/sweep-stale-matches/route.ts                       # expire_due_rematches + pokes
├── actions/match/requestRematch.ts                             # → rematchService.request
├── actions/match/respondToRematch.ts                           # → accept / decline
├── actions/match/withdrawRematch.ts                            # new (replaces cancelRematch.ts)
├── actions/match/claimWin.ts                                   # completes as ended_early
├── actions/match/completeMatch.ts                              # ended_early is a natural reason
├── [locale]/(room)/match/[matchId]/page.tsx                    # signed-out read-only; keep query
└── [locale]/match/[matchId]/summary/page.tsx                   # → ?review=last

lib/
├── review/                                                     # new
│   ├── movesRepository.ts   buildReviewSteps.ts   reviewParam.ts
│   ├── scrubber.ts          cursorLines.ts        ledgerCells.ts   bandsAtStep.ts
├── match/rematchService.ts   rematchRepository.ts   stateLoader.ts   rematchAnnouncements.ts
├── room/resultDetail.ts   bestWord.ts   rematchView.ts   ledgerCallLine.ts   scoreboard.ts   slip.ts
├── presence/presenceService.ts
├── standing/readStanding.ts                                    # cooldowns via pair_cooldown_until
├── i18n/copy/{en,is}.ts                                        # result, rematch, review strings
└── types/match.ts                                              # RematchOffer, SeriesView, ended_early

components/room/
├── Slip.tsx                     # headline focus, guard, negotiation row
├── Scoreboard.tsx               # review clock row → ReviewScrubber
├── ReviewScrubber.tsx           # new
├── ReviewControls.tsx           # new (desktop words; phone glyphs)
├── Ledger.tsx  LedgerFoot.tsx  LedgerSheet.tsx                 # review cells, cursor line, foot primary
├── MatchRoomController.tsx  MatchRoomView.tsx                  # review mode wiring, read-only, titles
└── hooks/ useReview.ts  useReviewAutoplay.ts  useActivationGuard.ts
          useLiveBackGuard.ts (result kind)  useMatchOverSlip.ts  useRematchNegotiation.ts (thin)
components/standing/hooks/useTabPresence.ts                     # sends matchId

app/[locale]/dev/room/{fixtures.ts, RoomFixture.tsx, reviewFixture.ts}   # new phases

docs/prd_and_requirements/wottle_game_rules.md                 # §12 Match over, Review (S13)
docs/design_documentation/260914-wottle-new-design/WOTTLE_DESIGN_SYSTEM.md  # scrubber, review cells
CLAUDE.md                                                       # spec 071 paragraph

tests/
├── unit/lib/review/*.spec.ts   unit/lib/room/{resultDetail,rematchView,bestWord}.spec.ts
├── unit/components/room/{Slip.matchOver,ReviewScrubber,ReviewControls,Ledger.review}.spec.tsx
├── unit/components/room/hooks/{useReview,useReviewAutoplay,useLiveBackGuard}.spec.tsx
├── unit/match/rematch-one-caller.test.ts
├── contract/match-moves.contract.test.ts
├── integration/db/{rematch.test.ts, rematch.race.test.ts, pair-cooldown.test.ts}
└── integration/ui/{rematch-flow.spec.ts, review-flow.spec.ts, room-fixtures.spec.ts, slot-overflow.spec.ts}
```

**Structure Decision**: The single Next.js project already in place. Review logic gets its own domain folder (`lib/review/`), as the constitution requires by-feature organisation. Rematch stays in `lib/match/`, where its service and repository already live.

## Phasing (for tasks)

1. **Foundation:** the migration, the types, `/moves`, `buildReviewSteps` with its invariant test, and the `ended_early` reason.
2. **US1, the result:** detail, best word, focus, guard, title, the history `result` kind.
3. **US2 and US6, rematch:** the SQL functions, the service, the actions, `MatchState.rematch`, `deriveRematchView`, the slip row, the ledger call line, the cooldown union, series, and the sweep.
4. **US3 and US4, review:** param, hook, scrubber, controls, ledger cells, cursor line, step motion, autoplay, history, `/summary`.
5. **US5:** signed-out and non-participant review.
6. **US8:** phone result and review.
7. **US7:** third-party call ordering.
8. **US9 and polish:** the rules and design docs, CLAUDE.md, fixtures and baselines (macOS here, Linux from CI), overflow, copy parity, name-safe grep, docs:check, and a native-read list.

## Complexity Tracking

None.
