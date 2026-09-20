# Implementation Plan: Room Clarity

**Branch**: `048-room-clarity` | **Date**: 2026-09-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/048-room-clarity/spec.md`
**Design**: canvas https://claude.ai/artifact/95RjzxvNKFrqSm5bThtxvn

## Summary

Six player-facing changes to the Field & Ledger room, delivered as six slices in the order the spec prioritises them. One new component (the **slip**) and one new pure model (the **round state**) carry most of the work; the rest is copy, CSS and the removal of the unranked branch.

- **C1 Round state** (US2, US3) — a pure `roundState.ts` derives one of six beats from `MatchState` + field interaction + the reveal's `settled` flag, and feeds the live row's two lines, the field's turn frame, both bar sub-lines and the new ten-cell **round rail**. A 1.2s **settle hold** is a client-side timer on the `progress.settled` edge (`useReveal` has no completion callback); the store keeps the scored round as `holdRound` until it elapses, and `useFieldInteraction.canPick` is false while it is set.
- **C2 Slip** (US1, US7) — `Slip.tsx` mounts inside `.room__field-slot` (which gains `position: relative`; it has none today), carries `data-field-safe` so an open slip never cancels a pick, stays inside `.room` so the existing reduced-motion block covers it, traps focus with `useFocusTrap`, and is driven by a `slip` field in `roomStore` with kinds `signIn | resign | claimWin | matchOver`, precedence enforced in the store. The match-over slip replaces the final ledger notices; `review the field ▸` sets `slip: null` and the foot's `result ▸` restores it. Resign and claim-win migrate from `Notice` to slip kinds.
- **C3 No field before a name** (US4) — `LobbyRoomView` with `viewer === null` renders `Field` with `landedCount={0}` (the existing queue mechanism, no new prop) and the sign-in slip; the bottom bar's inline `NameInput` moves into the slip, keeping its test ids so `loginViaBar` survives. On sign-in the existing `lettersLanded` counter runs the setting-field motion.
- **C4 Rules page** (US5) — `app/rules/page.tsx` outside the `(room)` group, static, six sections, three `Field`-rendered figures, one table. `? rules`, the `rules` action, `firstMatchRules` and the `?` branch of `useRoomHotkeys` are deleted; the lobby controller stops generating and rendering the warm-up board while signed out (today it does, and so does the `landing` fixture); `how to play ▸` joins the lobby and final feet and the match `⋯` menu (`target="_blank"`).
- **C5 Rated only** (US6) — delete the `rated` distinction everywhere it was added by spec 045 (`bootstrapMatchRecord` input, `inviteService`, `isMatchRated`, `completeMatch` gate, `MatchState.rated`, `ledgerRows` params, copy). The column stays in the database (additive, unread); a follow-up migration may drop it.
- **C6 Fixtures, baselines, documents** — six new fixture phases, baselines at three viewports, DS §1/§5/§7/§8/§9/§10 amendments, rules doc §12 rows, CLAUDE.md.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22, React 19, Next.js 16 (App Router)
**Primary Dependencies**: Tailwind CSS 4.x, zustand (`roomStore`), Supabase JS v2, Zod. No new dependency.
**Storage**: Supabase PostgreSQL. No schema change; `matches.rated` stops being read and written (stays at its default `true`).
**Testing**: Vitest (JSDOM, stylesheet assertions, acceptance greps), Playwright visual projects against `/dev/room` at 1440×900 / 1280×800 / 390×844, `@axe-core/playwright`, two-player Playwright specs.
**Target Platform**: browsers at the three reference viewports; the rules page also at 390 wide as a scrolling page.
**Performance Goals**: unchanged SLAs. Nothing new on the move path; the round state is a memoised pure function; the settle hold is one `setTimeout`.
**Constraints**: eight colours, two families, no radius or shadow; the slip is the only overlay and the field's 32% fade is the only opacity change; geometry does not animate (the turn frame is an `outline`, not a border); one `aria-live` region for the live row plus one assertive announcement per slip.
**Scale/Scope**: about 34 files edited, 9 created, 4 deleted (notice kinds and copy). 22 phases × 3 viewports × 2 platforms of baselines. Estimated 5 days.

## Constitution Check

| Principle | Assessment | Verdict |
| --- | --- | --- |
| I. Server-Authoritative | No game-state mutation moves to the client. The settle hold delays *rendering* of the next round, not its creation; the server still opens round N+1 and the clock still runs from `rounds.started_at`. Rated-only removes a client-visible flag; rating writes stay in `completeMatch`. | PASS |
| II. Real-Time Performance | Nothing added to `submitMove`, `advanceRound` or the broadcast. The 1.2s hold is a deliberate UX pause after resolution and does not count toward move RTT. | PASS |
| III. Type-Safe End-to-End | `RoundState` and `SlipState` are discriminated unions in `lib/room`; `MatchState.rated` and `MatchBootstrapInput.rated` are removed, so every stale reader fails to compile. No new Server Action. | PASS |
| IV. Mobile-First | The slip is ≤300px on phones, its actions ≥44px and stacked; the rail stays in the collapsed ledger; the rules page is single-column below 900px. Cells unchanged at 35px. | PASS |
| V. Observability | A `performance.mark("room:settle-hold")` pair brackets the hold; slip open/close logged at debug level with kind and matchId. | PASS |
| VI. Clean Code | `deriveRoundState`, `liveLinesFor`, `barSublineFor`, `railCells`, `slipPrecedence` are small pure functions; no boolean params (kinds, not flags). | PASS |
| VII. TDD | Every task is `[test]` before `[impl]`; the visual baselines are updated only by `--update-snapshots` after the unit tests pass. | PASS |
| VIII. External Context | No external library API is introduced; Next.js `<Link target="_blank">` and `notFound()` are already in use. Context7 not required. | PASS |
| IX. Commits | Conventional Commits, one per passing test. | PASS |

**Design-system gate** (CLAUDE.md "Design (MANDATORY)"): four sentences of the design system are contradicted on purpose (§1.1 "nothing covers it", §1.8 "a `?` in the ledger foot", §1.9 "no modal", §10 "no overlays"; §6 "nothing is ever placed over the field" is the fifth). They are amended in the same change (FR-028) with the slip as the single named exception; the acceptance grep gains `Slip` as the only component allowed to set `position: absolute` inside the field slot. See Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/048-room-clarity/
├── plan.md              # this file
├── research.md          # Phase 0: decisions with alternatives
├── data-model.md        # Phase 1: RoundState, SlipState, rail, rated removal
├── quickstart.md        # Phase 1: see every new state from fixtures
├── contracts/
│   ├── slip.md          # the slip: kinds, precedence, focus, timing
│   ├── round-state.md   # beats → live row, frame, sublines, rail
│   ├── rated-only.md    # supersedes 045/contracts/rated-flag.md
│   ├── rules-route.md   # /rules page contract
│   └── fixture-phases.md# new phases and what each pins
└── tasks.md             # /speckit.tasks output
```

### Source Code (repository root)

```text
lib/room/
├── roundState.ts            # NEW  deriveRoundState, liveLinesFor, barSublineFor
├── slip.ts                  # NEW  SlipState union, slipPrecedence, slipCopy
├── roomStore.ts             # +slip, +holdRound, setSlip/clearSlip, beginHold/endHold
├── ledgerRows.ts            # liveText takes RoundState; rated params removed; railCells
├── ledgerTypes.ts           # LedgerAction −"rules" +"howToPlay" +"result" +"keepWaiting"; Notice −firstMatchRules −resignConfirm −claimWin
├── notices.ts               # resignConfirm/claimWin builders removed
└── liveState.ts             # unchanged (field interaction → picking/previewing)
lib/constants/copy.ts        # +round-state strings, +slip strings, +HOW_TO_PLAY; −unranked family, −RULES, −FIRST_MATCH_RULES
lib/types/match.ts           # MatchState.rated removed
lib/matchmaking/service.ts   # MatchBootstrapInput.rated + isMatchRated removed
lib/matchmaking/inviteService.ts  # rated: false removed
app/actions/match/{completeMatch,requestRematch,respondToRematch}.ts  # rated gate/inheritance removed
app/actions/auth/login.ts    # unchanged (called from the slip's NameInput)

components/room/
├── Slip.tsx                 # NEW  the overlay; role=dialog, useFocusTrap, kinds rendered by slipCopy
├── RoundRail.tsx            # NEW  ten cells, aria-label "round N of 10"
├── Room.tsx                 # renders <Slip/> inside .room__field-slot when store.slip != null
├── hooks/useRoomHotkeys.ts  # −"?" branch
├── hooks/useFieldInteraction.ts  # canPick false while holdRound is set or a slip is up
├── Field.tsx                # +turnFrame?: Seat | null → data-turn attribute
├── PlayerBar.tsx            # subline already a string; nameInput prop removed
├── NameInput.tsx            # moves into the slip; test ids kept
├── Ledger.tsx               # +RoundRail under caption (all variants with a match); foot −rules +howToPlay/+result
├── LedgerFoot.tsx           # RULES button removed; actions from variant
├── RoomMenu.tsx             # match variant +"how to play" (new tab)
├── LobbyRoomView.tsx        # viewer null → landedCount 0 + signIn slip; NO_ACCOUNT bar copy
├── LobbyRoomController.tsx  # −rules action, −"?" hotkey
├── QueueRoomController.tsx  # −"?" hotkey
├── MatchRoomController.tsx  # roundState, settle hold, slip dispatch (resign/claimWin/matchOver), −firstMatch, −"?"
├── MatchRoomView.tsx        # −rated; +roundState → Field turnFrame, bar sublines, ledger rail
└── hooks/useSettleHold.ts   # NEW  settled → holdRound for HOLD_MS

app/rules/page.tsx           # NEW  static page; components/rules/{RulesFigure,ScoringTable}.tsx
app/styles/room.css          # .room__field-slot gains position: relative; .slip, [data-slipped] field fade, .field[data-turn] outline, .rail, .ledger__row--settled, .ledger__live-line1 (17px board); additions inside the existing `.room *` reduced-motion block
app/dev/room/fixtures.ts     # +landing-slip, resign, claim-win, over-slip, settle, rules

tests/unit/lib/room/{roundState,slip,roundRail,settleHold}.spec.ts
tests/unit/components/room/{Slip,RoundRail,LobbyRoomView.signedOut,Ledger.rail}.spec.tsx
tests/unit/lib/room/rankedCaptions.spec.ts        # rewritten: no rank label
tests/unit/styles/acceptance-grep.test.ts         # +unranked, +"? rules", +firstMatchRules; slip exception
tests/integration/ui/{room-fixtures,match-completion,rounds-flow,rules-page}.spec.ts
tests/integration/ui/helpers/matchmaking.ts       # loginViaBar → loginViaSlip (same test ids)
tests/integration/ui/README.md                    # test-id inventory gains slip-*, rail
docs/design_documentation/260914-wottle-new-design/WOTTLE_DESIGN_SYSTEM.md
docs/prd_and_requirements/wottle_game_rules.md   # §12 rows; rules page content mirrors §2–§6
CLAUDE.md
```

**Structure Decision**: Everything stays in the existing `lib/room` / `components/room` split. The rules page is the one thing outside the room and lives at `app/rules/`, not in the `(room)` group, so it never mounts `RoomShell` or the store.

## Phase 0 — research

See [research.md](./research.md). Decisions: slip as store state not notice (R1); settle hold on the client, keyed on `useReveal.settled` (R2); turn frame as `outline` (R3); opponent-played from `oppTimer.status === "paused"` and `pendingMoves` (R4); rated column left in place (R5); sign-in slip keeps `NameInput` and its test ids (R6); rules page static and outside the room (R7); rail as a sibling of the caption in every match-bearing variant (R8).

## Phase 1 — design

No persistence change. No new Server Action or API route. Contracts under [contracts/](./contracts/). Data model in [data-model.md](./data-model.md). Quickstart in [quickstart.md](./quickstart.md).

Post-design constitution re-check: unchanged, all PASS. The only client-side timing introduced (the hold) is presentational and cannot desynchronise the players: both clients hold for the same fixed interval after the same server event, and the server's clock is unaffected.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| An overlay over the field (DS §1.1, §1.9, §10) | Playtests show the end of the match and the two match-ending decisions are missed when stated as ledger lines. One component, four uses, precedence enforced. | Louder ledger lines (larger verdict, tinted final row) were the 044/045 answer and are what failed. |
| A deliberate 1.2s pause after resolution (FR-022) | Without a pause the next round's `your move` overwrites `scored` in the same frame; players never see the round close. | Keeping the scored row visible *beside* the new live row shows two tinted rows and confuses which is live. |
