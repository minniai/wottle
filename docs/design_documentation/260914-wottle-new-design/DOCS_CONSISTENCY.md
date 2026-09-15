# Wottle — documentation changes for the Field & Ledger design

Every document below was read in the attached `wottle` repo. For each: what it says today that the new design contradicts, and the edit that makes it consistent. Apply these in the same PR as the step that makes them true (see `WOTTLE_DESIGN_PLAN.md §11`), except the rule clarifications in §1, which should land first because the engine tests depend on them.

Conventions used in the edits: the company/product name is written `Wottle`; players are `you` and `the opponent`; the two seat colours are teal (you) and coral (opponent); the surfaces are the **field** (board), the **player bars**, and the **ledger**.

---

## 1. `docs/prd_and_requirements/wottle_game_rules.md` (authoritative rules)

The rules document is the authority the design was built on, and it is already right on most of what the UI now renders: §3.1 fixes the **four orthogonal reading directions** (no diagonals), §3.5a and invariant I7a fix the **standalone / whole-run rule** (`violatesFrozenAdjacencyOnSameAxis`), §4 fixes per-letter coverage. Only these additions are needed:

1. **Clock model.** The document has no time-control section (grep for `chess clock`, `per round`, a clock budget returns nothing). Add one: each player has one 5:00 clock for the whole match (decided 14 September 2026); it runs while that player's move for the current round is open and stops when they submit; time spent in one round is not restored later. Name the type that carries it (`TimerState { playerId, remainingMs, status }` in `lib/types/match.ts`). State what happens at 0:00 (team decision — see plan §12).
2. **Double reading.** §3.1 says a run is valid "read forward or reversed". **Decided 14 September 2026: it scores once**, read forward, so FÁR/RÁF is one record — pinned by `doubleReading.test.ts`. The field shows one chevron per run and the ledger one word.
3. **Worked example for the UI.** Add BORÐA + GILT → BORÐAGILT to the §3.5a examples, since it is the case the design uses to explain why two bands never touch end to end.
4. Add a short **"What the player sees"** subsection that maps each rule to its rendering: frozen words → tinted band with a chevron at the reading start; a run valid both ways scores once, so one chevron per band; shared letter → ink letter inside two bands; clock → the lane at the edge of the player's bar; broadcast of the opponent's swap (§2) → their two letters pinned in their colour immediately.

## 2. `docs/prd_and_requirements/wottle_prd.md`, `wottle_technical_architecture.md`, `wottle_ideation.md`

The PRD predates the engine and contradicts the rules document. `wottle_technical_architecture.md` still specifies an 8-direction word finder (`type Direction = 'N' | 'NE' | …`, "Scan 8 directions", lines ~161, 241, 481, 534, 983–1059, 2842) and `wottle_ideation.md` line 17 says "readable in any direction"; align both with rules §3.1 (four orthogonal directions) or mark them historical. PRD edits:

- **Time control.** Replace any "5+0" notation with the 5:00-per-player match budget from the rules document — one clock per player for all ten rounds, not per round.
- **Scoring directions.** Replace "eight directions" (and any diagonal mention) with the four axial directions; add the double-scoring and whole-run rules by reference to the rules document.
- **Dictionary.** Replace "Icelandic nouns" with "the full BÍN inflected list" (matches `game-config.ts` and rules §3.3).
- **§1.3 desktop drag-to-swap.** Mark as delivered by the pick → preview → commit interaction (drag A→B produces a preview).
- **§7.2 timer colours and error colours.** Replace "timer displays in green while … amber … red" and "red flash on invalid move" with: clocks are lanes in the seat colour that thicken and blink under 1:00; an invalid pick shakes the letter in its own colour and writes the fact into the ledger's live row. Remove the "hidden from opponent until both submit" language wherever it survives (the swap is broadcast on submit since #210).
- **Screens list.** Replace landing / lobby / matchmaking / match / summary pages with the single **room** and its states (landing, lobby, queue, found, match, final), referencing the figures in the audit.
- Add a **Design** section pointing to `docs/design/WOTTLE_DESIGN_SYSTEM.md` (copy of `handoff/WOTTLE_DESIGN_SYSTEM.md`) as binding for all UI work.

## 3. `ds-bundle/README.md` and `ds-bundle/*` ("Building with Wottle Warm Editorial")

Superseded in full. Move `ds-bundle/` to `docs/archive/ds-bundle-warm-editorial/` and add a one-paragraph `README.md` at the old path: "Archived. Wottle's UI follows `docs/design/WOTTLE_DESIGN_SYSTEM.md` (Field & Ledger). This bundle documents the previous Warm Editorial look and is kept for reference only." Do not delete the render sheets; they are the before-images for the audit.

## 4. `docs/design_documentation/2604*-wottle-game-design/*` (Claude Design handoff bundles)

These are the handoff bundles for the previous design (prototype screens, `README.md` "CODING AGENTS: READ THIS FIRST"). Prepend to each `README.md`: "Superseded on <date> by the Field & Ledger design — see `docs/design/WOTTLE_DESIGN_PLAN.md`. Do not implement from this bundle." Move the folders under `docs/archive/`. Place the new bundle at `docs/design/`: `WOTTLE_DESIGN_PLAN.md`, `WOTTLE_DESIGN_SYSTEM.md`, `DOCS_CONSISTENCY.md`, and a PDF export of `Wottle UX Audit.dc.html` as `Wottle UX Audit.pdf`.

## 5. `docs/superpowers/specs/`

- `2026-04-19-wottle-design-implementation.md` (Warm Editorial phased plan): mark **superseded** at the top, pointing to the new plan. Do not delete; the phase notes explain why the current code looks as it does.
- `2026-06-18-prominent-match-timers-design.md` (O-59): add an **Outcome** section: the requirement (prominent, urgency-aware clocks) is now met by the clock lanes at the inner edges of the player bars plus the mm:ss at the bar's centre; the five-tone ramp and the two renderings are retired; `deriveClockUrgency` keeps only the <1:00 threshold. Note the open question to O-59's authors on numerals.
- `2026-06-16-scored-words-side-panels-design.md` (O-71): add an **Outcome** section: scored words are shown in the ledger's rounds table (both players in one table, one row per round) and as bands on the field; the two side panels are retired.
- Any spec that references `HudCard`, `RoundPipBar`, `ScoredWordsCard`, `TilesClaimedCard`, `ScoreDeltaPopup`, `MatchLeftRail`, `LobbyHero`, `MatchRing`, `PostGameScoreboard`, `RematchBanner`: add a line "Component retired in the Field & Ledger rebuild; see plan §11."

## 6. `specs/*` and `docs/proposals/*` that describe retired UI

Add a `SUPERSEDED.md` (one paragraph, link to the plan, name of the replacing component) to each of: `specs/005-board-ui-animations`, `008-score-delta-popup`, `011-board-ui-polish`, `012-round-history-and-game-recap`, `014-move-playability-improvements` (UI part only — the shake stays), `015-sensory-feedback` (sequential reveal part; audio/haptics stay), `016-rematch-post-game-loop` (UI part), `018-match-hud-layout`, `019-lobby-visual-foundation`, `043-scoring-resolution-viz`. Same one-line note at the top of `docs/proposals/004-board-ui-and-animations.md`, `004-game-screen-redesign.md`, `004-next-feature-recommendation-match-ui.md`, `008-score-delta-popup.md`, `012-round-history-and-game-recap.md`, `014-move-feedback-improvement.md`, `015-sensory-feedback-sequential-reveal.md`, `016-rematch-and-post-game-loop.md`. Keep every folder for history; the engine/server parts of these specs remain valid.

## 7. `README.md` (repo root)

- **Overview**: keep the game description; replace any mention of the chess clock / per-round timer with the 5:00-per-player match budget.
- **UI / design** paragraph: replace the Warm Editorial description with two sentences: "Wottle's UI is the Field & Ledger system: a ruled field of letters framed by two player bars, with a single ledger beside it. Everything about the look is in `docs/design/WOTTLE_DESIGN_SYSTEM.md`; all UI work must follow it."
- **Project structure**: add `components/room/` (Room, PlayerBar, Ledger, Field) and remove the deleted component folders as they go.
- **Screens**: replace the five-page list with the room and its states.

## 8. `CLAUDE.md` (repo root, agent instructions)

Update **Project Overview → Current State** (it says the Warm Editorial redesign is in progress; replace with the Field & Ledger rebuild and link the plan) and the **Warm Editorial Redesign** phase table (mark superseded). Add a **Design** section:

```
## Design
- The UI follows docs/design/WOTTLE_DESIGN_SYSTEM.md. Do not add colours, radii, shadows, gradients or fonts outside it.
- Every visible element is a letter (or a state of a letter) on the field, a fact about one player in that player's bar, or a fact about the match in the ledger. If a new element is none of these, do not add it.
- Colours are seat-relative: `--you` teal, `--opp` coral, always via getSeatColors(). Never map colour to player_a/player_b.
- Nothing is ever positioned over the field. No modals, banners, toasts or overlays during a match; state changes are written into the bars or the ledger's live row.
- Copy: sentence case, no exclamation marks, one idea per line, mono uppercase for labels. See design system §8.
```

Also update any component lists in `CLAUDE.md` that name the retired components.

## 9. Tests documentation

Where `tests/` READMEs or spec quickstarts name `data-testid`s (`hud-card`, `round-pip-bar`, `your-move-card`, `scored-words-card`, `tiles-claimed-card`, `match-ring`, `post-game-scoreboard-card`, `rematch-banner`), replace with the new ids listed in plan §10.

## 10. Things the docs must *not* say any more (grep list)

`Warm Editorial`, `Fraunces`, `JetBrains Mono`, `Inter`, `letterpress`, `ochre`, `--p1`, `--p2`, `5+0`, `5-minute`, `chess clock`, `Icelandic nouns`, `eight directions`, `diagonal`, `hidden from opponent`, `Move submitted`, `wants a rematch!`, `HUD card`, `pip bar`, `side panel`, `word cloud`, `match ring`.

Run this grep over `README.md`, `CLAUDE.md`, `docs/` (excluding `docs/archive/`) and `specs/` at the end of P5; it should return nothing.
