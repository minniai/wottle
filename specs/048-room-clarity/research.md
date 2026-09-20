# Phase 0 research — Room Clarity

No `NEEDS CLARIFICATION` remained in the spec; this file records the eight design-to-code decisions that shape the plan, each with the alternative rejected.

## R1 — The slip is store state, not a notice

**Decision**: `roomStore.slip: SlipState | null` with kinds `signIn | resign | claimWin | matchOver`, written only through `setSlip` (applies precedence) and `clearSlip`. `Slip.tsx` reads the store and renders inside `.room__field-slot`, which gains `position: relative` (room.css sets only its size today). It carries `data-field-safe` (a pointerdown outside `.field` otherwise cancels the pick) and stays inside `.room` so the `.room *` reduced-motion rule applies; no portal.

**Rationale**: Notices are a list rendered as ledger lines with expiry timers (`resignConfirm` has `RESIGN_CONFIRM_MS`); a slip is exactly one, modal, without expiry. Putting it in the store means the fixture route can seed it with no controller (spec 045's isolation rule) and `Room` can render it without the ledger knowing.

**Alternatives**: (a) a `Notice` kind rendered differently — rejected: notices are a list and the ledger owns them; (b) component-local state in `MatchRoomController` — rejected: the sign-in slip belongs to the lobby controller and the fixture route needs to seed it.

## R2 — The settle hold is a client timer keyed on the reveal

**Decision**: `useSettleHold({ settled, round })` sets `holdRound = round` when `useReveal` reports `settled` for a round whose reveal drew at least one band or totals changed, and clears it after `SETTLE_HOLD_MS = 1200`. While `holdRound === currentRound - 1`, the ledger shows that row as `settled` with the live text `round N scored` and does **not** open the next live row; `Field` receives `disabled`.

**Rationale**: The server opens round N+1 in the same broadcast that carries the summary (memory: O-78, "state broadcast bundles currentRound+lastSummary"), so the client is the only place a pause can exist. Keying on `settled` reuses the reveal plan's own clock instead of adding a second schedule; `useReveal` exposes no callback, so the hook watches the boolean edge the controller already observes. `useFieldInteraction` takes `canPick: false` while `holdRound` is set.

**Alternatives**: (a) a server-side delay before opening the next round — rejected: it would stop the clocks or steal time from the players, and the constitution keeps clock authority on the server; (b) a shorter hold that a tap can skip — rejected: the pause exists to be read.

**Reduced motion**: the hold stays 1200ms; it is a reading pause, not motion. Documented in DS §6.

## R3 — The turn frame is an outline

**Decision**: `Field` takes `turnFrame?: Seat | null` and sets `data-turn="you"`; CSS draws `outline: 3px solid var(--you); outline-offset: -3px` on `.field[data-turn="you"]`.

**Rationale**: DS §6 "geometry does not animate" and `useFieldSize` measures the slot; an outline paints inside the box without changing layout. Only the viewer's seat is ever framed (the opponent's turn is stated in their bar), so the value is `"you" | null` in practice, typed as `Seat` for the fixture's sake.

## R4 — Opponent played

**Decision**: `deriveRoundState` reads `oppTimer.status === "paused"` as "opponent played" (the timer pauses on submission, same rule `MatchRoomController` already uses for `youTimer`), with `pendingMoves` as the source of the pins (unchanged).

**Rationale**: Already the server's own signal; no new field on `MatchState`.

## R5 — `matches.rated` stays in the database

**Decision**: Remove every read and write of `rated` in code (`bootstrapMatchRecord`, `inviteService`, `isMatchRated`, `completeMatch`, `loadMatchState`, `MatchState`, `ledgerRows`, copy) and leave the column at its default. A follow-up migration may drop it once production has no unranked rows it wants to keep.

**Rationale**: Dropping a column is a production migration with its own review; nothing in this feature needs it. Rows written unranked since 15 September render as ranked (FR-011); they have no rating row, so their final bars read `rating pending`, which is true.

**Alternatives**: a migration setting `rated = true` everywhere — rejected: nothing reads it any more, so the write buys nothing.

## R6 — The sign-in slip keeps `NameInput` and its test ids

**Decision**: `NameInput` moves from `PlayerBar`'s `nameInput` slot into the `signIn` slip unchanged, keeping `player-bar-name-input` / `player-bar-action-play` test ids (renamed in a later cleanup, not here). `loginViaBar` is renamed `loginViaSlip` with the same body plus a wait for the slip to lift.

**Rationale**: 20+ Playwright specs sign in through the helper; the ids are the contract.

**Landing field**: `Field` already supports `landedCount` (queue). `LobbyRoomView` passes `landedCount={0}` when `viewer === null` and the lobby controller passes `canPick: false`; on sign-in the controller runs the same `setLettersLanded` ramp the queue uses (`~100ms apart`, DS §6) over the warm-up board it already generates. The `landing` fixture, which renders a full board today, becomes `landing-slip`.

## R7 — The rules page is static and outside the room

**Decision**: `app/rules/page.tsx` (server component, no store, no session read, `export const dynamic = "force-static"`), rendering `RulesFigure` (a `Field` at 300px with fixed literals) three times and a `ScoringTable`. Linked from the lobby/final feet with `<Link href="/rules">` and from the match `⋯` menu with `target="_blank" rel="noopener"`.

**Rationale**: A route in the `(room)` group would mount `RoomShell` and read the session; a slip would put a lesson over the field. A new tab from a live match keeps the transport alive; the constitution's reconnection rules already cover the phone case where a tab switch backgrounds the page.

**Content source**: `docs/prd_and_requirements/wottle_game_rules.md` §2–§6. The plan adds a unit test that the page's scoring table constants equal `DEFAULT_GAME_CONFIG` (length bonus, combo, duplicate = 0) so the page cannot drift from the engine.

## R8 — The rail sits under the caption in every match-bearing ledger

**Decision**: `RoundRail` renders between `.ledger__caption` and the column header in the `match` and `final` variants, and in the collapsed phone ledger between the caption and the live row. `queue` shows it with all ten cells future; `lobby` does not show it.

**Rationale**: FR-024/025; the queue rail reads "ten rounds are coming" at no cost.

**Accessibility**: `role="img"`, `aria-label="round 4 of 10"`; cells `aria-hidden`. The caption keeps the same text for sighted users; the live row announces the round change (FR-023).

## Handoff notes

- The chess.com reference flow (`docs/design_documentation/wottle screen flow as chesscom.tldraw`) shows the result modal over the board with rematch / new game / review; the slip is that pattern in the room's grammar.
- The April design-system artifact listed under "Design System" on claude.ai is the superseded look and must not be used as a source; the Field & Ledger tokens in the repo are the only source. <!-- retired-name -->
