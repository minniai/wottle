# Feature Specification: Room Clarity

**Feature Branch**: `048-room-clarity`
**Created**: 2026-09-20
**Status**: Draft
**Design**: canvas https://claude.ai/artifact/95RjzxvNKFrqSm5bThtxvn (nine artboards: landing slip, resign slip, your move, played, settle, match over, phone played, phone match over, rules page)
**Input**: User description: "Room clarity: six player-facing improvements to the Field & Ledger room. (1) A slip laid over the field for the four major moments — sign-in, resign, claim the win, match over. (2) All matches rated. (3) No field before a name. (4) Rules leave the room for a long-form page. (5) Round-flow signals in the live row, the field frame and the bars, with a settle hold. (6) A ten-cell round rail in the ledger."

## Background

The Field & Ledger room (specs 044, 045, 047) put every fact in one of three homes and forbade anything over the field. The first playtests after 047 found that this discipline made the biggest moments the quietest ones: players did not notice the match had ended, could not tell whether a round was in progress, whether they had played, whether the opponent had, or which of the ten rounds they were in. The signed-out landing shows a full field to nobody, the unranked option adds a branch no player asked for, and the `? rules` foot link with its three-sentence notice teaches nothing to the person who needs it.

This feature keeps the room's grammar (eight tokens, two type families, three homes) and adds one permitted overlay, the **slip**, for the moments a player must notice or decide. Everything else is stronger signals in the homes that already exist.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The match ends and the player knows it (Priority: P1)

When the tenth round settles, a slip lands over the field stating the result once and offering what to do next. The player cannot miss it, cannot mistake it for another round, and can lift it to study the final field.

**Why this priority**: The end of the match is the moment the product is judged. Today players keep waiting for a round that never comes.

**Independent Test**: Play a match to completion on two clients (or open the `over-slip` fixture); the slip appears on both, states the same result, and each of its actions leads where it says.

**Acceptance Scenarios**:

1. **Given** round 10 has resolved and the last band has settled, **When** 600ms have passed, **Then** a slip is centred over the field reading `Kári wins` (the winner's name, in the winner's seat colour), the score with each total in its seat's ink, the detail line (`by 43 points · 10 words to 8 · territory 32–25`), both players' rating lines (`1187 → 1199 · +12`), and the actions `rematch ▸`, `new opponent ▸`, `review the field ▸`, with `lobby` beneath. The field beneath is faded.
2. **Given** the slip is up, **When** the player chooses `review the field ▸`, **Then** the slip lifts, the field returns to full strength, the ledger shows the final state, and the ledger foot offers `result ▸`, which brings the slip back.
3. **Given** the slip is up, **When** the opponent requests a rematch, **Then** the slip's action line becomes `Kári asks for a rematch · accept ▸ · decline`; no separate ledger notice appears.
4. **Given** a draw, **When** the slip lands, **Then** its headline reads `draw 140–140` in ink.
5. **Given** the viewer is not a participant (read-only completed match), **When** the page opens, **Then** the slip shows the result and rating lines with only `lobby` as an action.
6. **Given** `prefers-reduced-motion`, **When** the slip lands, **Then** it appears with no fade and no delay beyond the settle.

---

### User Story 2 - A round is legible from start to settle (Priority: P1)

At every moment of a round the player can read, without hunting, which round it is, whose move it is, whether they have played, whether the opponent has, that the round is resolving, and that it has scored and the next one has begun.

**Why this priority**: The round is the unit of play. Every confusion reported traces to one of its beats having no signal.

**Independent Test**: Open the `idle`, `played`, `opp-played`, `reveal` and new `settle` fixtures; each beat has the signals in the table below and no other. Then play two rounds live on two clients and confirm the beats appear in order on both.

**Acceptance Scenarios**:

1. **Given** a new round opens and it is the player's move, **When** the ledger renders, **Then** the live row's first line reads `round 4 · your move` in the board face, its second line the instruction (`pick a letter`), the field's frame is drawn 3px in the player's seat colour, and the player's bar sub-line ends `· your move`.
2. **Given** the player commits a swap, **When** the move is accepted, **Then** the field frame returns to its 1.5px ink rule, the live row reads `played · waiting for Kári` over `Kári is thinking · their clock runs`, the player's bar sub-line ends `· played ●`, and the opponent's bar sub-line ends `· thinking`.
3. **Given** the opponent has played and the viewer has not, **When** the state arrives, **Then** the opponent's sub-line ends `· played ●`, the opponent's pins show on the field, and the live row still reads `round 4 · your move`.
4. **Given** both have played, **When** the round resolves, **Then** the live row reads `resolving round 4` for the duration of the reveal while the bands draw.
5. **Given** the reveal has finished, **When** the settle hold begins, **Then** the scored row stays tinted for 1.2s reading `round 4 scored` over `you +12 · Kári +0 · round 5 opens in 1`, with the round's words beneath; the next row opens as the live row only when the hold ends.
6. **Given** the settle hold, **When** the next round's state arrives early, **Then** the hold still runs its full 1.2s before the live row moves; the player cannot pick a letter until it has.
7. **Given** the opponent's clock expires while the player waits, **When** the pass is synthesised, **Then** the live row reads `resolving round 4` as for any other resolution.

---

### User Story 3 - Ten rounds are counted where the player looks (Priority: P1)

A rail of ten cells at the top of the ledger shows the rounds played, the round in progress and the rounds to come, on every device, with the ledger open or collapsed.

**Why this priority**: The round number is the single most-asked question in playtests. The caption's eleven-pixel label did not answer it.

**Independent Test**: Open any match fixture at 1440, 1280 and 390 wide; the rail is visible with the correct cell states; at 390 it remains visible with the ledger collapsed.

**Acceptance Scenarios**:

1. **Given** round 4 of 10, **When** the ledger renders, **Then** the rail shows cells 1–3 filled ink with paper numerals, cell 4 tinted with a 2px ink frame and a heavier numeral, cells 5–10 outlined in the rule colour with light numerals; the caption reads `round 4 of 10`.
2. **Given** the final state, **When** the ledger renders, **Then** all ten cells are filled and the caption reads `final · 10 of 10`.
3. **Given** a phone (below 900px) with the ledger collapsed, **When** the live row shows, **Then** the rail sits between the caption and the live row.
4. **Given** a screen reader, **When** it reaches the rail, **Then** it reads `round 4 of 10` once; the cells themselves are not announced individually.

---

### User Story 4 - No field before a name (Priority: P2)

A visitor who has not signed in sees the room with an empty ruled frame where the field will be, and a slip asking for a name. Signing in lifts the slip and sets the field in front of them.

**Why this priority**: A field with no player is a demo, not a game. The name is the one thing the product needs; the slip makes it the one thing on screen.

**Independent Test**: Open the landing signed out; no letter is rendered anywhere. Enter a name; the slip lifts and the letters land.

**Acceptance Scenarios**:

1. **Given** no session, **When** the landing opens, **Then** the field slot shows the 1.5px ink frame and the cell rules with no letters and no values, the top bar reads `No opponent yet` with no action, the bottom bar reads `sign in to set the field`, and a slip centred over the field carries the wordmark, the line `two players · one field · Icelandic words`, a name input, `play ▸`, `no account needed`, and `new here · how to play ▸`.
2. **Given** the slip, **When** a valid name is submitted, **Then** the slip lifts, the bottom bar becomes the player's bar, `play ranked ▸` appears in the top bar, and the hundred letters land with the existing setting-field motion.
3. **Given** the slip, **When** an invalid name is submitted (too short, too long, taken), **Then** the slip stays and the error is written beneath the input in the muted mono style; nothing else on screen changes.
4. **Given** a session cookie that has expired, **When** any room route opens, **Then** the room renders as scenario 1 rather than showing a field with an empty seat.
5. **Given** a direct link to a live match without a session, **When** it opens, **Then** the sign-in slip shows over the empty frame and, after sign-in, the existing non-participant guard applies.

---

### User Story 5 - Rules are learned outside the room (Priority: P2)

The rules are a page of their own: six sections with figures and a scoring table, reachable from the lobby, the result and the match menu. They never appear inside the room and never interrupt a match.

**Why this priority**: The current rules affordance is invisible to the people who need it, and the room is the wrong place for a lesson.

**Independent Test**: Reach the page from each of its three entry points; confirm the match keeps running when opened from the menu; confirm `? rules` and the first-match notice are gone from every room state.

**Acceptance Scenarios**:

1. **Given** the lobby or the final state, **When** the player chooses `how to play ▸` in the ledger foot, **Then** the rules page opens in the same tab with `back to the lobby ▸` at the top and bottom.
2. **Given** a live match, **When** the player opens the `⋯` menu, **Then** it offers `how to play`, which opens the rules page in a new tab; the match, its clocks and its transport continue unaffected.
3. **Given** the rules page, **When** it renders, **Then** it has exactly these sections in order: the round, words, freezing, scoring, the clock, winning; the first three carry a figure drawn with the field's own grammar (a swap, two bands with chevrons, a crossing with a shared letter); scoring carries a table of the four scoring rules; the page ends with `play ranked ▸`.
4. **Given** any room state, **When** it renders, **Then** neither `? rules` nor the first-match three-sentence notice is present, and the `?` hotkey does nothing.
5. **Given** the rules page on a phone, **When** it renders, **Then** it is a single column with the figures beneath their text and no horizontal scroll.

---

### User Story 6 - Every match is rated (Priority: P2)

There is one kind of match. Directory challenges and queue matches are both ranked, both move ratings, and no screen mentions an unranked alternative.

**Why this priority**: The unranked branch exists for a distinction no player chose; removing it deletes copy, a column's worth of branches and a decision.

**Independent Test**: Accept a directory challenge and play it out; ratings move. Search every room state for `unranked`; none is found.

**Acceptance Scenarios**:

1. **Given** the lobby directory, **When** it renders, **Then** its heading reads `here now` and each row's action is `challenge ▸`; no mention of unranked.
2. **Given** a match started from a directory challenge, **When** it completes, **Then** both players' rating lines show a change, exactly as for a queue match.
3. **Given** any match or final caption, **When** it renders, **Then** it reads `round 4 of 10` or `final · 10 of 10 · 18:50` with no `ranked ·` prefix; the word `ranked` survives only in the lobby's `play ranked ▸` and the queue sub-line.
4. **Given** a match row written before this change with the unranked flag set, **When** its final state is viewed, **Then** it renders as a ranked match whose rating lines read `rating pending` if no rating row exists.

---

### User Story 7 - Resigning and claiming the win are decided on a slip (Priority: P3)

The two decisions that end a match early are put to the player on a slip, in the same voice as the result.

**Why this priority**: A decision that ends the match deserves the same weight as the match ending. Today both are one-line notices in the ledger.

**Independent Test**: Open the `resign` fixture and trigger the claim-win condition on a live match; both slips show, and cancelling each returns the room unchanged.

**Acceptance Scenarios**:

1. **Given** a live match, **When** the player chooses `resign ▸` in the ledger foot, **Then** a slip reads `Resign the match?` with the round and the player's remaining clock above it, `Kári wins · your rating moves as a loss` beneath, and the actions `yes, resign ▸` (primary) and `keep playing ▸`; both clocks keep running.
2. **Given** the resign slip, **When** `keep playing ▸` or Escape is chosen, **Then** the slip lifts and the field is exactly as before.
3. **Given** the opponent has been disconnected past the reconnection window, **When** the ledger would offer `claim the win ▸`, **Then** instead a slip reads `Kári is gone` over `0:00 left to reconnect`, with `claim the win ▸` (primary) and `keep waiting ▸`.
4. **Given** the claim-win slip, **When** the opponent reconnects, **Then** the slip lifts on its own and the opponent's bar resumes.

---

### Edge Cases

- A match ends by resignation, clock expiry or abandonment: the match-over slip lands with the reason in its label line (`match over · resigned`, `match over · out of time`, `match over · Kári left`).
- The match-over slip is up and the player reloads: it lands again immediately (no 600ms delay, the bands are already settled).
- Two slips are due at once (opponent leaves during a resign confirmation): the resign slip is dropped and the claim-win slip shows; a match-over slip replaces any other slip.
- A round resolves while the resign slip is up: the reveal runs beneath it; the slip stays; the settle hold runs; the slip's round line updates.
- The settle hold overlaps the reconnection window or a disconnect: the hold completes, then the disconnect state applies.
- The player's own clock hits 0:00 during their move: the field frame returns to ink and the live row reads `out of time · waiting for Kári`.
- On a phone, the slip is 300px wide and never wider than the field; its actions stack.
- The rail on a 260px ledger (900–1100px viewports) uses 26px cells; numerals remain 12px.
- A name is entered while offline: the slip shows the existing connection error beneath the input.
- The rules page is opened from the menu on a phone where a new tab is a full navigation: the match resumes from the safety poll on return, as after any backgrounding.

## Requirements *(mandatory)*

### Functional Requirements

**The slip**

- **FR-001**: The room MUST provide a slip: a paper panel with a 1.5px ink frame and no radius or shadow, centred over the field, with the field and its bands faded to 32% beneath it. It is the only element ever drawn over the field.
- **FR-002**: A slip MUST appear for exactly these moments and no others: sign-in on landing, resign confirmation, claim the win, and match over. A rematch request rewrites the match-over slip's action line rather than opening a new slip or a ledger notice.
- **FR-003**: The match-over slip MUST land 600ms after the last band of the final reveal has settled, MUST state the verdict in the winner's name and seat colour (`draw` in ink), the score with each total in its seat's ink, the detail line, both rating lines, and the actions `rematch ▸`, `new opponent ▸`, `review the field ▸`, `lobby`.
- **FR-004**: `review the field ▸` MUST lift the slip and restore the field; the ledger foot MUST then offer `result ▸`, which restores the slip.
- **FR-005**: The resign slip MUST show the round, the player's remaining clock, the consequence line, and the actions `yes, resign ▸` and `keep playing ▸`; clocks MUST keep running while it is up; Escape MUST cancel it.
- **FR-006**: The claim-win slip MUST replace the `claim the win ▸` ledger line, offer `claim the win ▸` and `keep waiting ▸`, and lift itself if the opponent reconnects.
- **FR-007**: A slip MUST trap focus while open, be announced once assertively, and return focus to the element that opened it (or the live row) when it lifts. Under `prefers-reduced-motion` it MUST appear and lift with no transition.
- **FR-008**: The slip's copy MUST follow the room's copy rules: sentence case, no exclamation marks, names not pronouns in the verdict.

**Rated only**

- **FR-009**: Every match MUST be rated. Directory challenges MUST create rated matches and MUST write rating rows on completion.
- **FR-010**: The strings `unranked`, `here now · challenge for an unranked match`, `unranked · no rating change`, the unranked final caption and the `ranked ·` caption prefix MUST be removed; the room MUST contain no unranked branch. The word `ranked` MUST survive only in `play ranked ▸` and the queue bar sub-line.
- **FR-011**: A pre-existing match row flagged unranked MUST render as ranked; if it has no rating row, its rating line reads `rating pending`.

**No field before a name**

- **FR-012**: When there is no valid session, every room route MUST render the field slot as an empty ruled frame (frame and cell rules, no letters, no values) with the sign-in slip over it; the bars MUST carry no action and no name.
- **FR-013**: The sign-in slip MUST carry the wordmark, one descriptive line, a labelled name input, `play ▸`, `no account needed` and `new here · how to play ▸`; validation errors MUST appear beneath the input without lifting the slip.
- **FR-014**: On successful sign-in the slip MUST lift and the letters MUST land with the existing setting-field motion (0ms under reduced motion).

**Rules outside the room**

- **FR-015**: `? rules`, the `rules` ledger action, the first-match three-sentence notice and the `?` hotkey MUST be removed from every room state.
- **FR-016**: A rules page MUST exist at its own route with six sections in this order — the round, words, freezing, scoring, the clock, winning — three figures drawn with the field's grammar, a four-row scoring table, `back to the lobby ▸` at top and bottom and `play ranked ▸` at the end. It MUST be single-column below 900px.
- **FR-017**: `how to play ▸` MUST appear in the lobby and final ledger feet (same-tab navigation) and as `how to play` in the match `⋯` menu (new tab); opening it from a match MUST NOT pause, resign or disconnect the match.
- **FR-018**: The rules page content MUST agree with `docs/prd_and_requirements/wottle_game_rules.md`; where they differ the rules document is corrected in the same change.

**Round-flow signals**

- **FR-019**: The live row's first line MUST be the round state in the board face at 17px: `round N · your move`, `played · waiting for <name>`, `resolving round N`, `round N scored`, `out of time · waiting for <name>`. Its second line MUST be the instruction or fact for that state (`pick a letter`, `picking · T (2) · tap a second letter`, `<name> is thinking · their clock runs`, `you +12 · <name> +0 · round N+1 opens in 1`).
- **FR-020**: While it is the viewer's move, the field frame MUST be drawn 3px in the viewer's seat colour without changing the field's size; at every other time it MUST be the 1.5px ink rule.
- **FR-021**: Bar sub-lines MUST carry the turn: the viewer's ends `· your move` (seat colour) or `· played ●`; the opponent's ends `· thinking` or `· played ●`. Outside a live round the sub-lines are unchanged from today.
- **FR-022**: After the reveal, the scored row MUST hold as the tinted row for 1.2s reading `round N scored` with the per-seat deltas and the round's words, and the next live row MUST open only when the hold ends; field interaction MUST be disabled during the hold. Under reduced motion the hold is still 1.2s (it is a reading pause, not motion).
- **FR-023**: Every state in FR-019 MUST be announced through the live row's polite live region exactly once per change.

**Round rail**

- **FR-024**: The ledger MUST show a rail of ten cells directly beneath the caption, spanning the ledger's width: rounds before the current one filled ink with paper numerals; the current one tinted with a 2px ink frame and a 600-weight numeral; later ones outlined in the rule colour with the future-label grey numeral. In the final state all ten are filled.
- **FR-025**: On phones the rail MUST remain visible with the ledger collapsed, between the caption and the live row.
- **FR-026**: The rail MUST have one accessible name, `round N of 10`; its cells MUST be hidden from assistive technology. The caption MUST read `round N of 10` (`final · 10 of 10 · m:ss` when complete).

**Fixtures, baselines and documentation**

- **FR-027**: The fixture route MUST gain the phases `landing-slip`, `resign`, `claim-win`, `over-slip`, `settle` and `rules`, and existing phases MUST show the new signals; the visual suite MUST cover them at the three viewports and its baselines MUST be updated in the same change.
- **FR-028**: The design system MUST be amended in the same change: §1.1, §1.8, §1.9, §6 and §10 to admit the slip as the one permitted overlay and the one permitted opacity change and to retire the in-room rules; a new §5.9 slip; §5.4 for the rail and the live-row lines; §5.1 for the turn frame; §5.3 for the turn sub-lines; §7 (the five beats) for the settle beat; §8 for every string added or removed; §9 for the slip's focus and announcement rules. The rules document §12 MUST gain rows for the slip, the rail and the turn frame.

### Key Entities

- **Slip**: The one overlay. Has a kind (sign-in, resign, claim-win, match-over), a headline, a label line, body lines, and one to three actions of which at most one is primary. Exactly one slip may be up at a time; match-over outranks claim-win, which outranks resign.
- **Round state**: The beat the current round is in from the viewer's seat: your move, played, opponent played, resolving, scored (settle hold), out of time. Drives the live row, the field frame and both bar sub-lines.
- **Round rail**: The ten rounds as cells with one of three states: past, current, future.
- **Match** (existing): loses its `rated` distinction; every match is rated.

## Assumptions

- Winner line uses names (`Kári wins`), never `you win`; decided with the design on 2026-09-20.
- The settle hold is a fixed 1.2s and is not shortened by a tap; it is the only place the room deliberately withholds interaction.
- The rules page uses the room's two type families; the design system permits a text face outside the room but none is needed.
- The `⋯` menu opens the rules in a new tab because a same-tab navigation would tear down the match transport; the match survives backgrounding as it does today.
- Rows flagged unranked before this change are few (directory challenges since 2026-09-15) and are shown as ranked without a data migration; no historical rating is recomputed.
- The fixture route and the visual suite are the acceptance instruments, as in spec 045; no new tooling.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a moderated playtest, 10 of 10 players state the match result and their rating change within 5 seconds of the match ending, without prompting.
- **SC-002**: Asked at a random moment in a live match, 9 of 10 players correctly answer which round it is, whether they have played, and whether the opponent has, in under 3 seconds each.
- **SC-003**: No letter is rendered on any room route without a valid session; the visual suite's signed-out baselines contain no glyph in the field slot.
- **SC-004**: The string `unranked` occurs nowhere in player-facing copy or in the room's code paths; the acceptance grep returns nothing.
- **SC-005**: The rules page can be reached from the lobby, the result and a live match; opening it from a live match changes nothing in that match's state on either client.
- **SC-006**: Every room state renders from the fixture route without a database, and the visual suite passes at 1440, 1280 and 390 wide with the updated baselines.
- **SC-007**: Axe reports no violation on any room state with a slip up, and keyboard users can complete sign-in, resign and the match-over actions without a pointer.
